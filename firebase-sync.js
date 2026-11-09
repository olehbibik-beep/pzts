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
        Boolean(floor.imgData) || floor.devices.length > 0 || floor.cables.length > 0 || Boolean(floor.legend?.visible)
    ) || Object.keys(customDeviceIcons || {}).length > 0;
}

function getCloudProjectCollection(firestore, userId) {
    return firestore.collection('users').doc(userId).collection('projects');
}

async function getCloudServices() {
    if (!window.getFirebaseServices) throw new Error(tr('Модуль Firebase не загружен.'));
    if (!window.hasCloudAccess?.()) throw new Error(tr('Cloudové úložiště je dostupné firemním účtům s vydaným klíčem.'));
    return window.getFirebaseServices();
}

async function syncProjectToCloud(manual = false) {
    if (!await window.ensureCloudAccess?.()) {
        if (manual) await window.openAccountPanel?.();
        return false;
    }
    if (!cloudUser) {
        setCloudSyncStatus(tr('Войдите через Google для синхронизации'), 'signed-out');
        if (manual) showAppAlert(tr('Сначала войдите через Google.'), tr('Облачные проекты'));
        return false;
    }
    if (!isSystemReady || !Array.isArray(floors) || floors.length === 0) {
        if (manual) showAppAlert(tr('Дождитесь загрузки проекта и повторите попытку.'), tr('Облачные проекты'));
        return false;
    }
    if (!manual && !cloudProjectId && !hasProjectContent()) return false;

    // Автоматически называем проект, если он "Nový projekt" при ручном сохранении
    if (manual && (!projectName || projectName === tr('Nový projekt'))) {
        const newName = await showAppPrompt(tr('Введите название для сохранения в облаке:'), tr('Сохранить проект'));
        if (!newName) return false;
        projectName = newName;
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
        setCloudSyncStatus(tr('Синхронизация…'), 'syncing');
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
                        name: payload.projectName || tr('Без названия'),
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
                if (conflictSnapshot.exists) throw new Error(tr('Не удалось создать копию конфликта. Повторите сохранение.'));
                transaction.set(conflictRef, {
                    name: tr`${payload.projectName || tr('Без названия')} (копия)`,
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
                        setCloudSyncStatus(tr('Проект сохранён, но старая версия не удалена'), 'error');
                        return true;
                    }
                }
            }

            setCloudSyncStatus(
                result.conflict ? tr('Изменения разошлись: сохранена отдельная копия') : tr('Облако: сохранено'),
                result.conflict ? 'conflict' : 'saved'
            );
            if (cloudProjectsModal?.style.display === 'flex') await refreshCloudProjects();
            return true;
        } catch (error) {
            console.error('Ошибка синхронизации с Firebase:', error);
            setCloudSyncStatus(tr`Ошибка облака: ${error.message}`, 'error');
            if (manual) showAppAlert(error.message, tr('Не удалось сохранить проект в облако'));
            return false;
        } finally {
            if (uploadedPath && storage && !uploadedObjectIsReferenced) {
                try {
                    await storage.ref(uploadedPath).delete();
                } catch (cleanupError) {
                    if (cleanupError.code !== 'storage/object-not-found') {
                        console.error('Не удалось очистить незавершённую загрузку Firebase Storage:', cleanupError);
                        setCloudSyncStatus(tr('Не удалось очистить незавершённую загрузку'), 'error');
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
    if (!cloudUser || !window.hasCloudAccess?.()) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
        cloudSyncTimer = null;
        syncProjectToCloud(false);
    }, 2500);
}

window.scheduleCloudSync = scheduleCloudSync;

async function refreshCloudProjects() {
    if (!cloudUser || !await window.ensureCloudAccess?.()) return;
    cloudProjectsList.replaceChildren();
    setCloudSyncStatus(tr('Загружаю список проектов…'), 'syncing');
    try {
        const { firestore } = await getCloudServices();
        const snapshot = await getCloudProjectCollection(firestore, cloudUser.uid)
            .orderBy('updatedAt', 'desc')
            .get();
        if (snapshot.empty) {
            cloudProjectsList.textContent = tr('В облаке пока нет проектов.');
        } else {
            snapshot.forEach(documentSnapshot => {
                const metadata = documentSnapshot.data();
                const row = document.createElement('article');
                row.className = 'cloud-project-row';
                const details = document.createElement('div');
                details.className = 'cloud-project-details';
                const name = document.createElement('strong');
                name.setAttribute('data-user-content', '');
                name.textContent = metadata.name || tr('Без названия');
                const updated = document.createElement('span');
                const date = metadata.updatedAt?.toDate?.();
                updated.textContent = date ? tr`Изменён: ${date.toLocaleString(window.getGoomLocale())}` : tr('Дата изменения неизвестна');
                details.append(name, updated);

                const actions = document.createElement('div');
                actions.className = 'cloud-project-actions';
                const openButton = document.createElement('button');
                openButton.type = 'button';
                openButton.className = 'btn-cad';
                openButton.textContent = tr('Открыть');
                openButton.addEventListener('click', () =>
                    openCloudProject(documentSnapshot.id, metadata)
                );
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'btn-cad cloud-project-delete';
                deleteButton.textContent = tr('Удалить');
                deleteButton.addEventListener('click', () =>
                    deleteCloudProject(documentSnapshot.id, metadata)
                );
                actions.append(openButton, deleteButton);
                row.append(details, actions);
                cloudProjectsList.appendChild(row);
            });
        }
        setCloudSyncStatus(tr`Проектов в облаке: ${snapshot.size}`, 'saved');
    } catch (error) {
        console.error('Не удалось загрузить список проектов из Firebase:', error);
        setCloudSyncStatus(tr`Ошибка списка: ${error.message}`, 'error');
    }
}

async function openCloudProject(projectId, metadata) {
    if (!await window.ensureCloudAccess?.()) { await window.openAccountPanel?.(); return; }
    if (!await showAppConfirm(tr`Открыть «${metadata.name || tr('Без названия')}»? Текущий проект будет заменён.`, tr('Открыть облачный проект'))) return;
    setCloudSyncStatus(tr('Загружаю проект…'), 'syncing');
    try {
        const { storage } = await getCloudServices();
        const downloadURL = await storage.ref(metadata.storagePath).getDownloadURL();
        const response = await fetch(downloadURL);
        if (!response.ok) throw new Error(tr('Не удалось загрузить файл проекта из Firebase Storage.'));
        const payload = await response.json();
        const imported = await importFileContent(
            new File([JSON.stringify(payload)], `${metadata.name || 'project'}.bips`, { type: 'application/json' }),
            { skipCloudSync: true }
        );
        if (!imported) {
            setCloudSyncStatus(tr('Не удалось открыть данные проекта'), 'error');
            return;
        }
        saveCloudPointer(projectId, metadata.revision);
        cloudProjectsModal.style.display = 'none';
        setCloudSyncStatus(tr('Облачный проект открыт'), 'saved');
    } catch (error) {
        console.error('Не удалось открыть облачный проект:', error);
        setCloudSyncStatus(tr`Ошибка открытия: ${error.message}`, 'error');
        showAppAlert(error.message, tr('Не удалось открыть облачный проект'));
    }
}

async function deleteCloudProject(projectId, metadata) {
    if (!await window.ensureCloudAccess?.()) { await window.openAccountPanel?.(); return; }
    if (!await showAppConfirm(tr`Удалить «${metadata.name || tr('Без названия')}» из облака?`, tr('Удалить проект'))) return;
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
        setCloudSyncStatus(tr`Ошибка удаления: ${error.message}`, 'error');
        showAppAlert(error.message, tr('Не удалось удалить облачный проект'));
    }
}

async function openCloudProjects() {
    cloudUser = await window.ensureFirebaseSession();
    if (!await window.ensureCloudAccess?.()) { await window.openAccountPanel?.(); return; }
    if (!cloudUser) {
        showAppAlert(tr('Войдите через Google, чтобы открыть облачные проекты.'), tr('Облачные проекты'));
        return;
    }
    cloudProjectsModal.style.display = 'flex';
    document.getElementById('btnCloudSaveCurrent').hidden = !isSystemReady;
    const userLabel = document.getElementById('cloudProjectsUser');
    if (userLabel) userLabel.textContent = cloudUser.displayName || cloudUser.email || tr('Google-пользователь');
    await refreshCloudProjects();
}
window.openCloudProjects = openCloudProjects;

document.querySelectorAll('[data-open-cloud-projects]').forEach(button => {
    button.addEventListener('click', openCloudProjects);
});
document.getElementById('btnCloudProjectsClose').addEventListener('click', () => {
    cloudProjectsModal.style.display = 'none';
});
document.getElementById('btnCloudRefresh').addEventListener('click', refreshCloudProjects);
document.getElementById('btnCloudAccount').addEventListener('click', () => {
    cloudProjectsModal.style.display = 'none';
    window.openAccountPanel();
});
document.getElementById('btnCloudSaveCurrent').addEventListener('click', async () => {
    const saved = await syncProjectToCloud(true);
    if (saved) await refreshCloudProjects();
});
document.getElementById('btnCloudSignOut').addEventListener('click', async () => {
    try {
        const auth = await getFirebaseAuth();
        await auth.signOut();
    } catch (error) {
        console.error('Ошибка выхода из Google-аккаунта:', error);
        showAppAlert(error.message, tr('Не удалось выйти из аккаунта'));
    }
});

document.addEventListener('goom-auth-state-changed', event => {
    cloudUser = event.detail.user;
    if (!cloudUser) {
        if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
        cloudProjectId = null;
        cloudProjectRevision = 0;
        setCloudSyncStatus(tr('Войдите через Google для синхронизации'), 'signed-out');
        return;
    }
    setCloudSyncStatus(tr(window.hasCloudAccess?.() ? 'Synchronizace je připravena' : 'Místní ukládání'), 'idle');
});

document.addEventListener('goom-account-changed', event => {
    if (!event.detail.licensed) {
        if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
        cloudSyncTimer = null;
        cloudProjectId = null;
        cloudProjectRevision = 0;
        cloudProjectsModal.style.display = 'none';
        setCloudSyncStatus(tr('Místní ukládání'), 'idle');
        return;
    }
    cloudUser = event.detail.user;
    loadCloudPointer(cloudUser);
    setCloudSyncStatus(tr('Synchronizace je připravena'), 'idle');
    scheduleCloudSync();
});

if (FIREBASE_CONFIG.apiKey) {
    getFirebaseAuth().catch(error => {
        console.error('Не удалось подключить Firebase:', error);
        setCloudSyncStatus(tr`Firebase недоступен: ${error.message}`, 'error');
    });
} else {
    setCloudSyncStatus(tr('Настройте Firebase для синхронизации'), 'error');
}
