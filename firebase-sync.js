const cloudProjectsModal = document.getElementById('cloudProjectsModal');
const cloudProjectsList = document.getElementById('cloudProjectsList');
const cloudSyncIndicator = document.getElementById('cloudSyncIndicator');
const cloudProjectLimit = 5;
// Older releases ordered by updatedAt, so their lists ignore this internal document.
const cloudListLock = '!goom-cloud-list';
let cloudUser = null;
let cloudProjectId = null;
let cloudWorkspace = 0;
let cloudActionInProgress = false;
let cloudListRequest = 0;
let visibleCloudProjects = [];

function setCloudSyncStatus(message, state = 'idle') {
    for (const element of [cloudSyncIndicator, document.getElementById('cloudProjectsStatus')]) {
        element.textContent = message;
        element.dataset.state = state;
    }
    cloudSyncIndicator.title = message;
    document.getElementById('projectLocationCloud').toggleAttribute('hidden', !cloudProjectId);
    document.getElementById('projectLocationLocal').toggleAttribute('hidden', Boolean(cloudProjectId));
}
window.setCloudSyncStatus = setCloudSyncStatus;

window.resetActiveCloudProject = () => {
    cloudWorkspace++;
    cloudProjectId = null;
    setCloudSyncStatus(tr('Místní ukládání'));
};

function getCloudProjectCollection(firestore, userId) {
    return firestore.collection('users').doc(userId).collection('projects');
}

function readCloudRows(collection) {
    return collection.get({ source: 'server' }).then(snapshot => {
        const rows = [];
        snapshot.forEach(doc => {
            if (doc.id !== cloudListLock) rows.push({ ...doc.data(), id: doc.id });
        });
        return rows.sort((a, b) => cloudRowDate(a) - cloudRowDate(b) || a.id.localeCompare(b.id));
    });
}

function cloudRowDate(project) {
    return project.createdAt?.toMillis?.() || project.updatedAt?.toMillis?.() || 0;
}

function cloudOperationMessage(error, action) {
    if (error.code === 'goom/cloud-limit') return tr('V cloudu je už 5 projektů. Nejdříve některý odstraňte.');
    if (error.code === 'storage/unauthorized') return tr(action === 'open'
        ? 'Firebase Storage nepovolil otevření tohoto projektu.'
        : 'Firebase Storage nepovolil uložení projektu. Obraťte se na správce.');
    if (error.code === 'storage/object-not-found') return tr('Soubor tohoto projektu v cloudu chybí.');
    if (error.code === 'storage/retry-limit-exceeded' || error instanceof TypeError)
        return tr('Cloudový soubor se nepodařilo stáhnout. Zkontrolujte připojení a zkuste to znovu.');
    return error.message;
}

async function getCloudServices(userId) {
    if (cloudUser?.uid !== userId || !window.hasCloudAccess?.()) throw new Error(tr('Cloudové úložiště je součástí PRO.'));
    return window.getFirebaseServices();
}

async function saveCloudProject(userId) {
    if (!isSystemReady || !floors.length) {
        showAppAlert(tr('Дождитесь загрузки проекта и повторите попытку.'), tr('Облачные проекты'));
        return false;
    }
    const workspace = cloudWorkspace;
    const { firestore, storage } = await getCloudServices(userId);
    const collection = getCloudProjectCollection(firestore, userId);
    const limitError = () => Object.assign(new Error('Cloud project limit'), { code: 'goom/cloud-limit' });
    if ((await readCloudRows(collection)).length >= cloudProjectLimit) throw limitError();
    if (!projectName || projectName === tr('Nový projekt')) {
        const name = await showAppPrompt(tr('Введите название для сохранения в облаке:'), tr('Сохранить проект'));
        if (!name || workspace !== cloudWorkspace || userId !== cloudUser?.uid) return false;
        projectName = name;
        document.getElementById('projectNameInput').value = name;
        triggerAutoSave();
    }
    if (workspace !== cloudWorkspace || userId !== cloudUser?.uid) return false;
    const payload = getProjectDataPayload();
    const serialized = JSON.stringify(payload);
    const id = crypto.randomUUID();
    const storagePath = `users/${userId}/projects/${id}/project.json`;
    const file = storage.ref(storagePath);
    const lock = collection.doc(cloudListLock);
    await file.putString(serialized, 'raw', { contentType: 'application/json; charset=utf-8' });
    try {
        await firestore.runTransaction(async transaction => {
            await transaction.get(lock);
            if ((await readCloudRows(collection)).length >= cloudProjectLimit) throw limitError();
            const now = window.firebase.firestore.FieldValue.serverTimestamp();
            transaction.set(collection.doc(id), {
                name: payload.projectName || tr('Без названия'), revision: 1, storagePath,
                sizeBytes: new TextEncoder().encode(serialized).length, createdAt: now, updatedAt: now
            });
            transaction.set(lock, { nonce: id });
        });
    } catch (error) {
        // Only clean up on a known rejection. A network error may leave commit status unknown.
        if (['goom/cloud-limit', 'permission-denied'].includes(error.code)) {
            await file.delete().catch(cleanupError => console.warn('Cloud upload cleanup:', cleanupError));
        }
        throw error;
    }
    if (workspace === cloudWorkspace && userId === cloudUser?.uid) cloudProjectId = id;
    return true;
}

function renderCloudProjects() {
    cloudProjectsList.replaceChildren();
    document.getElementById('cloudProjectCount').textContent = `${visibleCloudProjects.length} / ${cloudProjectLimit}`;
    if (!visibleCloudProjects.length) {
        cloudProjectsList.textContent = tr('В облаке пока нет проектов.');
        return;
    }
    for (const project of visibleCloudProjects) {
        const row = document.createElement('article');
        row.className = 'cloud-project-row';
        row.classList.toggle('current', project.id === cloudProjectId);
        const details = document.createElement('div');
        details.className = 'cloud-project-details';
        const name = document.createElement('strong');
        name.setAttribute('data-user-content', '');
        name.textContent = project.name || tr('Без названия');
        const date = document.createElement('span');
        date.textContent = cloudRowDate(project) ? new Date(cloudRowDate(project)).toLocaleString(window.getGoomLocale()) : '';
        details.append(name, date);
        const actions = document.createElement('div');
        actions.className = 'cloud-project-actions';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'btn-cad';
        open.textContent = tr(project.id === cloudProjectId ? 'Otevřeno' : 'Открыть');
        open.disabled = project.id === cloudProjectId;
        open.addEventListener('click', () => runCloudAction('open', userId => openCloudProject(userId, project), open));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-cad cloud-project-delete';
        remove.textContent = tr('Удалить');
        remove.addEventListener('click', () => runCloudAction('delete', userId => deleteCloudProject(userId, project), remove));
        actions.append(open, remove);
        row.append(details, actions);
        cloudProjectsList.appendChild(row);
    }
}

async function refreshCloudProjects(userId) {
    const request = ++cloudListRequest;
    const { firestore } = await getCloudServices(userId);
    const rows = await readCloudRows(getCloudProjectCollection(firestore, userId));
    if (request !== cloudListRequest || userId !== cloudUser?.uid) return;
    visibleCloudProjects = rows;
    renderCloudProjects();
}

async function openCloudProject(userId, project) {
    if (project.id === cloudProjectId) return false;
    const workspace = cloudWorkspace;
    if (isSystemReady && !await showAppConfirm(tr`Открыть «${project.name || tr('Без названия')}»? Текущий проект будет заменён.`, tr('Открыть облачный проект'))) return false;
    const { storage } = await getCloudServices(userId);
    const downloadURL = await storage.ref(project.storagePath).getDownloadURL();
    const response = await fetch(downloadURL);
    if (!response.ok) {
        if (response.status === 404) throw Object.assign(new Error('Missing cloud object'), { code: 'storage/object-not-found' });
        if (response.status === 401 || response.status === 403) throw Object.assign(new Error('Cloud download denied'), { code: 'storage/unauthorized' });
        throw new Error(tr('Не удалось загрузить файл проекта из Firebase Storage.'));
    }
    const blob = await response.blob();
    if (workspace !== cloudWorkspace || userId !== cloudUser?.uid) return false;
    const imported = await importFileContent(new File([blob], `${project.name || 'project'}.TECH`, { type: 'application/json' }), {
        canApply: () => workspace === cloudWorkspace && userId === cloudUser?.uid && window.hasCloudAccess?.()
    });
    if (!imported || userId !== cloudUser?.uid) return false;
    cloudProjectId = project.id;
    cloudProjectsModal.style.display = 'none';
    setCloudSyncStatus(tr('Облачный проект открыт'), 'saved');
    return true;
}

async function deleteCloudProject(userId, project) {
    if (!await showAppConfirm(tr`Удалить «${project.name || tr('Без названия')}» из облака?`, tr('Удалить проект'))) return false;
    const { firestore, storage } = await getCloudServices(userId);
    const collection = getCloudProjectCollection(firestore, userId);
    const ref = collection.doc(project.id);
    const lock = collection.doc(cloudListLock);
    const path = await firestore.runTransaction(async transaction => {
        await transaction.get(lock);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return null;
        transaction.delete(ref);
        transaction.set(lock, { nonce: crypto.randomUUID() });
        return snapshot.data().storagePath;
    });
    if (cloudProjectId === project.id && userId === cloudUser?.uid) window.resetActiveCloudProject();
    if (path) await storage.ref(path).delete().catch(error => {
        if (error.code !== 'storage/object-not-found') console.warn('Cloud file cleanup:', error);
    });
    await refreshCloudProjects(userId);
    return true;
}

async function runCloudAction(action, operation, button) {
    const userId = cloudUser?.uid;
    if (!userId || !window.hasCloudAccess?.() || cloudActionInProgress) return;
    const titles = {
        save: 'Не удалось сохранить проект в облако',
        open: 'Не удалось открыть облачный проект',
        delete: 'Не удалось удалить облачный проект',
        list: 'Облачные проекты'
    };
    cloudActionInProgress = true;
    if (button) button.disabled = true;
    const progress = tr(action === 'save' ? 'Ukládání kopie…' : action === 'delete' ? 'Odstraňování projektu…'
        : action === 'open' ? 'Загружаю проект…' : 'Загружаю список проектов…');
    const previous = { text: cloudSyncIndicator.textContent, state: cloudSyncIndicator.dataset.state };
    setCloudSyncStatus(progress, 'syncing');
    try {
        const success = await operation(userId);
        if (userId !== cloudUser?.uid) return;
        if (action === 'save' && success) {
            setCloudSyncStatus(tr('Облако: сохранено'), 'saved');
            if (cloudProjectsModal.style.display === 'flex') await refreshCloudProjects(userId).catch(error => console.warn('Cloud project list:', error));
        } else if (action === 'delete' && success) {
            setCloudSyncStatus(tr('Projekt byl odstraněn z cloudu.'), 'saved');
        } else if (action === 'list') {
            setCloudSyncStatus(tr(cloudProjectId ? 'Облачный проект открыт' : 'Místní ukládání'));
        } else if (action !== 'open' || !success) {
            setCloudSyncStatus(previous.text, previous.state);
        }
    } catch (error) {
        if (userId !== cloudUser?.uid) return;
        console.warn('Cloud project:', error);
        const message = cloudOperationMessage(error, action);
        setCloudSyncStatus(message, 'error');
        if (action !== 'list') showAppAlert(message, tr(titles[action]));
    } finally {
        cloudActionInProgress = false;
        if (button) button.disabled = false;
    }
}

async function openCloudProjects() {
    if (!await window.ensureCloudAccess?.()) { await window.openAccountPanel?.(); return; }
    if (!cloudUser) return;
    cloudProjectsModal.style.display = 'flex';
    const save = document.getElementById('btnCloudSaveCurrent');
    save.hidden = !isSystemReady;
    renderCloudProjects();
    await runCloudAction('list', refreshCloudProjects, save);
}
window.openCloudProjects = openCloudProjects;

document.getElementById('btnCloudProjectsClose').addEventListener('click', () => {
    cloudProjectsModal.style.display = 'none';
});
document.querySelectorAll('[data-save-cloud-project]').forEach(button => {
    button.addEventListener('click', () => runCloudAction('save', saveCloudProject, button));
});

document.addEventListener('goom-account-changed', event => {
    const { user, licensed } = event.detail;
    if (cloudUser?.uid !== user?.uid) {
        cloudUser = user;
        cloudListRequest++;
        visibleCloudProjects = [];
        window.resetActiveCloudProject();
    }
    if (!licensed) {
        cloudProjectId = null;
        setCloudSyncStatus(tr('Místní ukládání'));
        visibleCloudProjects = [];
        cloudListRequest++;
        cloudProjectsModal.style.display = 'none';
    }
});

cloudUser = window.getFirebaseUser?.();
setCloudSyncStatus(tr('Místní ukládání'));
window.addEventListener('goom-language-changed', () => {
    if (cloudProjectsModal.style.display === 'flex') renderCloudProjects();
});
if (FIREBASE_CONFIG.apiKey) {
    getFirebaseAuth().catch(error => {
        setCloudSyncStatus(tr`Firebase недоступен: ${error.message}`, 'error');
    });
}
