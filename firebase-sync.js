const cloudProjectsModal = document.getElementById('cloudProjectsModal');
const cloudProjectsList = document.getElementById('cloudProjectsList');
const cloudSyncStatusElement = document.getElementById('cloudProjectsStatus');
const cloudSyncIndicator = document.getElementById('cloudSyncIndicator');

const cloudPointerPrefix = 'goom.cloudProject.';
let cloudUser = null;
let cloudProjectId = null;
let cloudProjectRevision = 0;
let cloudSyncTimer = null;
let activeCloudSync = null;
let cloudSyncPending = false;

function createCloudId() {
    return crypto.randomUUID();
}

function setCloudSyncStatus(message, state = 'idle') {
    if (cloudSyncStatusElement) cloudSyncStatusElement.textContent = message;
    if (cloudSyncIndicator) {
        cloudSyncIndicator.textContent = message;
        cloudSyncIndicator.dataset.state = state;
        cloudSyncIndicator.title = message;
    }
}

function getCloudPointerKey(userId) {
    return `${cloudPointerPrefix}${userId}`;
}

function saveCloudPointer(projectId, revision) {
    cloudProjectId = projectId;
    cloudProjectRevision = revision;
    if (!cloudUser) return;
    localStorage.setItem(getCloudPointerKey(cloudUser.uid), JSON.stringify({ projectId, revision }));
}

function loadCloudPointer(user) {
    cloudProjectId = null;
    cloudProjectRevision = 0;
    if (!user) return;
    const serialized = localStorage.getItem(getCloudPointerKey(user.uid));
    if (!serialized) return;
    try {
        const pointer = JSON.parse(serialized);
        if (typeof pointer.projectId === 'string' && Number.isInteger(pointer.revision)) {
            cloudProjectId = pointer.projectId;
            cloudProjectRevision = pointer.revision;
        }
    } catch (error) {
        console.error('Не удалось прочитать локальную привязку облачного проекта:', error);
        localStorage.removeItem(getCloudPointerKey(user.uid));
    }
}

window.resetActiveCloudProject = () => {
    if (cloudUser) localStorage.removeItem(getCloudPointerKey(cloudUser.uid));
    cloudProjectId = null;
    cloudProjectRevision = 0;
};

window.setCloudSyncStatus = setCloudSyncStatus;

function hasProjectContent() {
    return floors.some(floor =>
        Boolean(floor.imgData) || floor.devices.length > 0 || floor.cables.length > 0
    ) || Object.keys(customDeviceIcons || {}).length > 0;
}

function getCloudProjectCollection(firestore, userId) {
    return firestore.collection('users').doc(userId).collection('projects');
}

async function getCloudServices() {
    if (!window.getFirebaseServices) throw new Error('Модуль Firebase не загружен.');
    return window.getFirebaseServices();
}

async function syncProjectToCloud(manual = false) {
    if (!cloudUser) {
        setCloudSyncStatus('Войдите через Google для синхронизации', 'signed-out');
        if (manual) showAppAlert('Сначала войдите через Google.', 'Облачные проекты');
        return false;
    }
    if (!isSystemReady || !Array.isArray(floors) || floors.length === 0) {
        if (manual) showAppAlert('Дождитесь загрузки проекта и повторите попытку.', 'Облачные проекты');
        return false;
    }
        if (!manual && !cloudProjectId && !hasProjectContent()) return false;

    // Автоматически называем проект, если он "Nový projekt" при ручном сохранении
    if (manual && (!payload.projectName || payload.projectName === 'Nový projekt')) {
        const newName = await showAppPrompt('Введите название для сохранения в облаке:', 'Сохранить проект');
        if (!newName) return false;
        projectName = newName;
        payload.projectName = newName;
        const pInput = document.getElementById('projectNameInput');
        if (pInput) pInput.value = newName;
    }

    if (activeCloudSync) {
        if (!manual) {
            cloudSyncPending = true;
            return false;
        }
        await activeCloudSync;
        if (activeCloudSync) return activeCloudSync;
    }

    activeCloudSync = (async () => {
        setCloudSyncStatus('Синхронизация…', 'syncing');
        let uploadedPath = null;
        let uploadedObjectIsReferenced = false;
        let storage = null;
        try {
            const services = await getCloudServices();
            const { firestore } = services;
            storage = services.storage;
            const payload = getProjectDataPayload();
            const serialized = JSON.stringify(payload);
            const currentId = cloudProjectId || createCloudId();
            const expectedRevision = cloudProjectId ? cloudProjectRevision : 0;
            const userId = cloudUser.uid;
            const projectRef = getCloudProjectCollection(firestore, userId).doc(currentId);
            uploadedPath = `users/${userId}/projects/${currentId}/${createCloudId()}.json`;
            await storage.ref(uploadedPath).putString(serialized, 'raw', {
                contentType: 'application/json; charset=utf-8'
            });

            const result = await firestore.runTransaction(async transaction => {
                const snapshot = await transaction.get(projectRef);
                const current = snapshot.exists ? snapshot.data() : null;
                const revisionMatches = current
                    ? current.revision === expectedRevision
                    : expectedRevision === 0;
                const now = window.firebase.firestore.FieldValue.serverTimestamp();

                if (revisionMatches) {
                    const revision = (current?.revision || 0) + 1;
                    transaction.set(projectRef, {
                        name: payload.projectName || 'Без названия',
                        revision,
                        storagePath: uploadedPath,
                        sizeBytes: new TextEncoder().encode(serialized).length,
                        createdAt: current?.createdAt || now,
                        updatedAt: now
                    });
                    return {
                        projectId: currentId,
                        revision,
                        previousPath: current?.storagePath || null,
                        conflict: false
                    };
                }

                const conflictId = createCloudId();
                const conflictRef = getCloudProjectCollection(firestore, userId).doc(conflictId);
                const conflictSnapshot = await transaction.get(conflictRef);
                if (conflictSnapshot.exists) throw new Error('Не удалось создать копию конфликта. Повторите сохранение.');
                transaction.set(conflictRef, {
                    name: `${payload.projectName || 'Без названия'} (копия)`,
                    revision: 1,
                    storagePath: uploadedPath,
                    sizeBytes: new TextEncoder().encode(serialized).length,
                    conflictOf: currentId,
                    createdAt: now,
                    updatedAt: now
                });
                return { projectId: conflictId, revision: 1, previousPath: null, conflict: true };
            });

            uploadedObjectIsReferenced = true;
            saveCloudPointer(result.projectId, result.revision);
            if (result.previousPath && result.previousPath !== uploadedPath) {
                try {
                    await storage.ref(result.previousPath).delete();
                } catch (error) {
                    if (error.code !== 'storage/object-not-found') {
                        console.error('Не удалось удалить прежнюю версию проекта из Firebase Storage:', error);
                        setCloudSyncStatus('Проект сохранён, но старая версия не удалена', 'error');
                        return true;
                    }
                }
            }

            setCloudSyncStatus(
                result.conflict ? 'Изменения разошлись: сохранена отдельная копия' : 'Облако: сохранено',
                result.conflict ? 'conflict' : 'saved'
            );
            if (cloudProjectsModal?.style.display === 'flex') await refreshCloudProjects();
            return true;
        } catch (error) {
            console.error('Ошибка синхронизации с Firebase:', error);
            setCloudSyncStatus(`Ошибка облака: ${error.message}`, 'error');
            if (manual) showAppAlert(error.message, 'Не удалось сохранить проект в облако');
            return false;
        } finally {
            if (uploadedPath && storage && !uploadedObjectIsReferenced) {
                try {
                    await storage.ref(uploadedPath).delete();
                } catch (cleanupError) {
                    if (cleanupError.code !== 'storage/object-not-found') {
                        console.error('Не удалось очистить незавершённую загрузку Firebase Storage:', cleanupError);
                        setCloudSyncStatus('Не удалось очистить незавершённую загрузку', 'error');
                    }
                }
            }
        }
    })();

    try {
        return await activeCloudSync;
    } finally {
        activeCloudSync = null;
        if (cloudSyncPending) {
            cloudSyncPending = false;
            scheduleCloudSync();
        }
    }
}

function scheduleCloudSync() {
    if (!cloudUser) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
        cloudSyncTimer = null;
        syncProjectToCloud(false);
    }, 2500);
}

window.scheduleCloudSync = scheduleCloudSync;

async function refreshCloudProjects() {
    if (!cloudUser) return;
    cloudProjectsList.replaceChildren();
    setCloudSyncStatus('Загружаю список проектов…', 'syncing');
    try {
        const { firestore } = await getCloudServices();
        const snapshot = await getCloudProjectCollection(firestore, cloudUser.uid)
            .orderBy('updatedAt', 'desc')
            .get();
        if (snapshot.empty) {
            cloudProjectsList.textContent = 'В облаке пока нет проектов.';
        } else {
            snapshot.forEach(documentSnapshot => {
                const metadata = documentSnapshot.data();
                const row = document.createElement('article');
                row.className = 'cloud-project-row';
                const details = document.createElement('div');
                details.className = 'cloud-project-details';
                const name = document.createElement('strong');
                name.textContent = metadata.name || 'Без названия';
                const updated = document.createElement('span');
                const date = metadata.updatedAt?.toDate?.();
                updated.textContent = date ? `Изменён: ${date.toLocaleString()}` : 'Дата изменения неизвестна';
                details.append(name, updated);

                const actions = document.createElement('div');
                actions.className = 'cloud-project-actions';
                const openButton = document.createElement('button');
                openButton.type = 'button';
                openButton.className = 'btn-cad';
                openButton.textContent = 'Открыть';
                openButton.addEventListener('click', () =>
                    openCloudProject(documentSnapshot.id, metadata)
                );
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'btn-cad cloud-project-delete';
                deleteButton.textContent = 'Удалить';
                deleteButton.addEventListener('click', () =>
                    deleteCloudProject(documentSnapshot.id, metadata)
                );
                actions.append(openButton, deleteButton);
                row.append(details, actions);
                cloudProjectsList.appendChild(row);
            });
        }
        setCloudSyncStatus(`Проектов в облаке: ${snapshot.size}`, 'saved');
    } catch (error) {
        console.error('Не удалось загрузить список проектов из Firebase:', error);
        setCloudSyncStatus(`Ошибка списка: ${error.message}`, 'error');
    }
}

async function openCloudProject(projectId, metadata) {
    if (!await showAppConfirm(`Открыть «${metadata.name || 'Без названия'}»? Текущий проект будет заменён.`, 'Открыть облачный проект')) return;
    setCloudSyncStatus('Загружаю проект…', 'syncing');
    try {
        const { storage } = await getCloudServices();
        const bytes = await storage.ref(metadata.storagePath).getBytes();
        const payload = JSON.parse(new TextDecoder().decode(bytes));
        const imported = await importFileContent(
            new File([JSON.stringify(payload)], `${metadata.name || 'project'}.bips`, { type: 'application/json' }),
            { skipCloudSync: true }
        );
        if (!imported) {
            setCloudSyncStatus('Не удалось открыть данные проекта', 'error');
            return;
        }
        saveCloudPointer(projectId, metadata.revision);
        cloudProjectsModal.style.display = 'none';
        setCloudSyncStatus('Облачный проект открыт', 'saved');
    } catch (error) {
        console.error('Не удалось открыть облачный проект:', error);
        setCloudSyncStatus(`Ошибка открытия: ${error.message}`, 'error');
        showAppAlert(error.message, 'Не удалось открыть облачный проект');
    }
}

async function deleteCloudProject(projectId, metadata) {
    if (!await showAppConfirm(`Удалить «${metadata.name || 'Без названия'}» из облака?`, 'Удалить проект')) return;
    try {
        const { firestore, storage } = await getCloudServices();
        await getCloudProjectCollection(firestore, cloudUser.uid).doc(projectId).delete();
        try {
            await storage.ref(metadata.storagePath).delete();
        } catch (error) {
            if (error.code !== 'storage/object-not-found') throw error;
        }
        if (projectId === cloudProjectId) window.resetActiveCloudProject();
        await refreshCloudProjects();
    } catch (error) {
        console.error('Не удалось удалить облачный проект:', error);
        setCloudSyncStatus(`Ошибка удаления: ${error.message}`, 'error');
        showAppAlert(error.message, 'Не удалось удалить облачный проект');
    }
}

async function openCloudProjects() {
    if (!cloudUser && window.firebase?.auth) {
        cloudUser = window.firebase.auth().currentUser;
    }
    if (!cloudUser) {
        showAppAlert('Войдите через Google, чтобы открыть облачные проекты.', 'Облачные проекты');
        return;
    }
    cloudProjectsModal.style.display = 'flex';
    const userLabel = document.getElementById('cloudProjectsUser');
    if (userLabel) userLabel.textContent = cloudUser.displayName || cloudUser.email || 'Google-пользователь';
    await refreshCloudProjects();
}

document.querySelectorAll('[data-open-cloud-projects]').forEach(button => {
    button.addEventListener('click', openCloudProjects);
});
document.getElementById('btnCloudProjectsClose').addEventListener('click', () => {
    cloudProjectsModal.style.display = 'none';
});
document.getElementById('btnCloudRefresh').addEventListener('click', refreshCloudProjects);
document.getElementById('btnCloudSaveCurrent').addEventListener('click', async () => {
    const saved = await syncProjectToCloud(true);
    if (saved) await refreshCloudProjects();
});
document.getElementById('btnCloudSignOut').addEventListener('click', async () => {
    try {
        const { auth } = await getCloudServices();
        await auth.signOut();
    } catch (error) {
        console.error('Ошибка выхода из Google-аккаунта:', error);
        showAppAlert(error.message, 'Не удалось выйти из аккаунта');
    }
});

document.addEventListener('goom-auth-state-changed', event => {
    cloudUser = event.detail.user;
    if (!cloudUser) {
        if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
        cloudProjectId = null;
        cloudProjectRevision = 0;
        setCloudSyncStatus('Войдите через Google для синхронизации', 'signed-out');
        return;
    }
    loadCloudPointer(cloudUser);
    setCloudSyncStatus(`Аккаунт: ${cloudUser.displayName || cloudUser.email || 'подключён'}`, 'idle');
    if (cloudProjectsModal?.style.display === 'flex') refreshCloudProjects();
    scheduleCloudSync();
});

if (FIREBASE_CONFIG.apiKey) {
    getFirebaseAuth().catch(error => {
        console.error('Не удалось подключить Firebase:', error);
        setCloudSyncStatus(`Firebase недоступен: ${error.message}`, 'error');
    });
} else {
    setCloudSyncStatus('Настройте Firebase для синхронизации', 'error');
}
