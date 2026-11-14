(() => {
    const byId = id => document.getElementById(id);
    const roleLabels = { owner: 'Владелец', admin: 'Администратор', user: 'Пользователь' };
    const programLabels = {
        PZTS: 'Охранные системы', EPS: 'Пожарная сигнализация', CCTV: 'Видеонаблюдение', SK: 'Структурированная кабельная система'
    };
    const date = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
    const dialog = byId('adminUserDialog');
    let auth, db, session, selectedUser;
    const pageSize = 25;
    let epoch = 0, pageRequest = 0;
    let query = '', users = [], tokens = [null], pageIndex = 0, nextPage = null;
    let program = 'PZTS';
    let changing = false;

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function status(text, error = false, id = 'adminStatus') {
        const node = byId(id);
        node.textContent = text;
        node.hidden = !text;
        node.dataset.error = String(error);
    }

    function readableError(error) {
        const code = error.code?.split('/').at(-1);
        return {
            'permission-denied': 'Для этого действия нужны права администратора или владельца.',
            'unauthenticated': 'Войдите в аккаунт повторно.',
            'not-found': 'Пользователь не найден.',
            'failed-precondition': 'Для выдачи доступа нужен активный аккаунт с подтверждённым e-mail.',
            'invalid-argument': 'Проверьте введённые данные.',
            'invalid-credential': 'Не удалось войти. Проверьте e-mail и пароль.',
            'popup-closed-by-user': 'Вход отменён.'
        }[code] || 'Сервис недоступен. Попробуйте ещё раз.';
    }

    function clearWorkspace() {
        session = null;
        selectedUser = null;
        users = [];
        query = '';
        tokens = [null];
        pageIndex = 0;
        nextPage = null;
        changing = false;
        byId('adminQuery').value = '';
        byId('adminWorkspace').hidden = true;
        byId('adminUsers').replaceChildren();
        byId('adminEvents').replaceChildren();
        if (dialog.open) dialog.close();
        byId('adminUserPrograms').replaceChildren();
        byId('adminUserTitle').textContent = '';
        byId('adminUserUid').textContent = '';
    }

    function denied() {
        return Object.assign(new Error('Administrator access required'), { code: 'permission-denied' });
    }

    async function readSession() {
        const user = auth.currentUser;
        if (!user) throw denied();
        const record = await db.collection('goomAdmins').doc(user.uid).get({ source: 'server' });
        const role = record.data()?.role;
        if (!['owner', 'admin'].includes(role)) throw denied();
        return { uid: user.uid, role, programs: Object.keys(programLabels) };
    }

    async function readUser(profile) {
        const uid = profile.id;
        const collections = ['goomAdmins', 'goomProgramGrants'];
        const [role, grant] = await Promise.all(collections.map(name => db.collection(name).doc(uid).get({ source: 'server' })));
        const data = profile.data();
        const programs = Object.fromEntries(Object.keys(programLabels).map(app => [app, {
            manualUntil: grant.data()?.expiresAt?.[app]?.toMillis() ?? null
        }]));
        return { uid, name: data.displayName || '', email: data.email || '', role: role.data()?.role || 'user', programs };
    }

    async function readUsers(query, cursor) {
        const profiles = db.collection('users');
        if (query && !query.includes('@')) {
            if (query.length > 128 || query.includes('/') || query === '.' || query === '..') {
                throw Object.assign(new Error('Invalid UID'), { code: 'invalid-argument' });
            }
            const profile = await profiles.doc(query).get({ source: 'server' });
            return { users: profile.exists ? [await readUser(profile)] : [], nextPage: null };
        }
        let list = query ? profiles.where('email', '==', query) : profiles.orderBy(firebase.firestore.FieldPath.documentId());
        if (cursor) list = list.startAfter(cursor);
        const page = await list.limit(pageSize).get({ source: 'server' });
        return { users: await Promise.all(page.docs.map(readUser)), nextPage: !query && page.size === pageSize ? page.docs.at(-1) : null };
    }

    async function writeChange(action, { uid, role, application, days }) {
        const actorUid = session.uid;
        const ref = db.collection(action === 'role' ? 'goomAdmins' : 'goomProgramGrants').doc(uid);
        const audit = db.collection('goomAdminAudit').doc();
        const timestamp = firebase.firestore.FieldValue.serverTimestamp;
        return db.runTransaction(async transaction => {
            const previous = (await transaction.get(ref)).data();
            let before, after, data;
            if (action === 'role') {
                before = previous?.role || 'user';
                after = role;
                if (before === after) return { changed: false };
                data = { role, updatedBy: actorUid };
            } else {
                const expiresAt = { ...previous?.expiresAt };
                before = expiresAt[application] ?? null;
                after = days ? firebase.firestore.Timestamp.fromMillis(Date.now() + days * 86_400_000) : null;
                if (!after && !before) return { changed: false };
                if (after) expiresAt[application] = after;
                else delete expiresAt[application];
                data = { application, expiresAt };
            }
            transaction.set(ref, { ...data, updatedAt: timestamp(), auditId: audit.id });
            transaction.set(audit, { action, actorUid, targetUid: uid, before, after, application: application ?? null, createdAt: timestamp() });
            return { changed: true };
        });
    }

    function handleError(error, currentEpoch, target) {
        if (currentEpoch !== epoch) return;
        if (['permission-denied', 'unauthenticated'].includes(error.code)) {
            // A role or session may have been revoked while this page was open.
            const recheck = async () => {
                try { await readSession(); }
                catch {
                    if (currentEpoch !== epoch) return;
                    epoch++;
                    clearWorkspace();
                    status(readableError(error), true);
                }
            };
            void recheck();
        }
        status(readableError(error), true, target);
    }

    function renderPrograms() {
        const cards = session.programs.map(application => {
            const button = element('button', undefined, 'program');
            button.type = 'button';
            button.setAttribute('aria-pressed', String(program === application));
            button.append(element('strong', application), element('span', programLabels[application]));
            button.addEventListener('click', () => {
                program = application;
                renderPrograms();
                renderUsers();
                byId('adminPrograms').querySelector('[aria-pressed="true"]').focus();
            });
            return button;
        });
        byId('adminPrograms').replaceChildren(...cards);
        byId('adminActiveProgram').textContent = program;
    }

    function dateLabel(value) { return value ? date.format(new Date(value)) : '—'; }

    function accessLines(user, application) {
        const access = user.programs[application];
        return access.manualUntil > Date.now() ? [`Выдан до ${dateLabel(access.manualUntil)}`] : ['—'];
    }

    function renderUsers() {
        const rows = users.map(user => {
            const row = element('tr');
            const account = element('td');
            account.append(element('strong', user.name || user.email || user.uid));
            if (user.name && user.email) account.append(element('span', user.email, 'subline'));
            const access = element('td');
            access.append(...accessLines(user, program).map(text => element('span', text, 'subline')));
            const action = element('td');
            const button = element('button', 'Открыть');
            button.type = 'button';
            button.setAttribute('aria-label', `Открыть ${user.email || user.uid}`);
            button.addEventListener('click', () => {
                selectedUser = user;
                status('', false, 'adminUserStatus');
                renderUserDialog();
                dialog.showModal();
            });
            action.append(button);
            row.append(account, element('td', roleLabels[user.role]), access, action);
            return row;
        });
        byId('adminUsers').replaceChildren(...rows);
        byId('adminPrev').disabled = pageIndex === 0;
        byId('adminNext').disabled = !nextPage;
        byId('adminPage').textContent = users.length ? query ? `Найдено: ${users.length}` : `Страница ${pageIndex + 1}` : 'Нет пользователей';
    }

    async function loadUsers(index = pageIndex, search = query) {
        const currentEpoch = epoch;
        const revision = ++pageRequest;
        const pageToken = search === query ? tokens[index] : null;
        try {
            const result = await readUsers(search, pageToken);
            if (currentEpoch !== epoch || revision !== pageRequest) return;
            if (search !== query) tokens = [null];
            query = search;
            pageIndex = index;
            users = result.users;
            nextPage = result.nextPage;
            tokens[index + 1] = nextPage;
            renderUsers();
            status('');
        } catch (error) {
            if (currentEpoch !== epoch || revision !== pageRequest) return;
            handleError(error, currentEpoch);
        }
    }

    async function loadAudit() {
        const currentEpoch = epoch;
        try {
            const snapshots = await db.collection('goomAdminAudit').orderBy('createdAt', 'desc').limit(pageSize).get({ source: 'server' });
            const events = snapshots.docs.map(snapshot => {
                const entry = snapshot.data();
                return { ...entry, createdAt: entry.createdAt?.toMillis(), after: entry.after?.toMillis?.() ?? entry.after };
            });
            if (currentEpoch !== epoch) return;
            const items = events.map(event => {
                const actor = event.actorEmail || event.actorUid;
                const target = event.targetEmail || event.targetUid;
                const change = event.action === 'role'
                    ? `Роль — ${roleLabels[event.before]} → ${roleLabels[event.after]}`
                    : event.after ? `${event.application} — доступ до ${dateLabel(event.after)}` : `${event.application} — ручной доступ отозван`;
                const item = element('li', change);
                item.append(element('span', `${dateLabel(event.createdAt)} · ${actor} → ${target}`, 'subline'));
                return item;
            });
            byId('adminEvents').replaceChildren(...(items.length ? items : [element('li', 'Изменений пока нет.', 'muted')]));
        } catch (error) { handleError(error, currentEpoch); }
    }

    function renderUserDialog() {
        const user = selectedUser;
        byId('adminUserTitle').textContent = user.name || user.email || user.uid;
        byId('adminUserUid').textContent = `${user.email || ''} · ${user.uid} · ${roleLabels[user.role]}`;
        const canEdit = user.uid !== session.uid && user.role !== 'owner' && (session.role === 'owner' || user.role === 'user');
        const canEditRole = canEdit && session.role === 'owner';
        const canGrant = canEdit || (user.uid === session.uid && session.role === 'owner');
        byId('adminRoleForm').hidden = !canEditRole;
        byId('adminRole').value = user.role;
        const rows = session.programs.map(application => {
            const row = element('section', undefined, 'grant');
            row.append(element('h3', application), element('p', accessLines(user, application).join(' · '), 'muted'));
            if (!canGrant) return row;
            const form = element('form', undefined, 'control-row');
            const label = element('label', 'Дней доступа');
            const input = element('input');
            Object.assign(input, { type: 'number', min: '1', max: '365', step: '1', value: '30', required: true });
            label.append(input);
            const grantButton = element('button', 'Выдать Pro', 'primary');
            grantButton.type = 'submit';
            const revoke = element('button', 'Отозвать', 'danger');
            revoke.type = 'button';
            revoke.disabled = !(user.programs[application].manualUntil > Date.now());
            form.addEventListener('submit', event => {
                event.preventDefault();
                if (!grantButton.disabled) void change('grant', { application, days: input.valueAsNumber });
            });
            revoke.addEventListener('click', () => {
                if (confirm(`Отозвать ручной доступ к ${application} у ${user.email || user.uid}?`)) void change('grant', { application, days: 0 });
            });
            form.append(label, grantButton, revoke);
            row.append(form);
            return row;
        });
        byId('adminUserPrograms').replaceChildren(...rows);
    }

    async function change(action, fields) {
        if (changing || !selectedUser) return;
        const currentEpoch = epoch;
        const uid = selectedUser.uid;
        changing = true;
        const controls = [...dialog.querySelectorAll('button, input, select')].filter(control => !control.disabled);
        controls.forEach(control => { control.disabled = true; });
        status('Сохраняем…', false, 'adminUserStatus');
        try {
            const { changed } = await writeChange(action, { uid, ...fields });
            const { users: matches } = await readUsers(uid);
            if (currentEpoch !== epoch) return;
            selectedUser = matches[0];
            renderUserDialog();
            status(changed ? 'Изменения сохранены.' : 'Доступ уже настроен так.', false, 'adminUserStatus');
            await Promise.all([loadUsers(), loadAudit()]);
        } catch (error) { handleError(error, currentEpoch, 'adminUserStatus'); }
        finally {
            controls.forEach(control => { control.disabled = false; });
            if (currentEpoch === epoch) changing = false;
        }
    }

    async function onSession(user) {
        const currentEpoch = ++epoch;
        clearWorkspace();
        byId('adminLogin').hidden = Boolean(user);
        byId('adminSession').hidden = !user;
        byId('adminIdentity').textContent = user?.email || '';
        if (!user) { status(''); return; }
        status('Проверяем права доступа…');
        try {
            const verified = await readSession();
            if (currentEpoch !== epoch) return;
            session = verified;
            byId('adminIdentity').textContent = `${user.email || user.uid} · ${roleLabels[session.role]}`;
            program = session.programs[0];
            renderPrograms();
            renderUsers();
            byId('adminWorkspace').hidden = false;
            await Promise.all([loadUsers(0, ''), loadAudit()]);
        } catch (error) {
            if (currentEpoch === epoch) status(readableError(error), true);
        }
    }

    async function signIn(button, operation) {
        button.disabled = true;
        status('Выполняем вход…');
        try { await operation(); }
        catch (error) { status(readableError(error), true); }
        finally { button.disabled = false; }
    }

    try {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
        auth.onAuthStateChanged(onSession, error => status(readableError(error), true));
    } catch (error) { status(readableError(error), true); return; }

    byId('adminGoogle').addEventListener('click', event => signIn(event.currentTarget, () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())));
    byId('adminLoginForm').addEventListener('submit', event => {
        event.preventDefault();
        const { email, password } = event.currentTarget.elements;
        void signIn(event.submitter || event.currentTarget.querySelector('button'), async () => {
            try { await auth.signInWithEmailAndPassword(email.value.trim(), password.value); }
            finally { password.value = ''; }
        });
    });
    byId('adminSignOut').addEventListener('click', async () => {
        try { await auth.signOut(); } catch (error) { status(readableError(error), true); }
    });
    byId('adminSearch').addEventListener('submit', event => { event.preventDefault(); void loadUsers(0, byId('adminQuery').value.trim()); });
    byId('adminReset').addEventListener('click', () => { byId('adminQuery').value = ''; void loadUsers(0, ''); });
    byId('adminPrev').addEventListener('click', () => { if (pageIndex > 0) void loadUsers(pageIndex - 1); });
    byId('adminNext').addEventListener('click', () => { if (nextPage) void loadUsers(pageIndex + 1); });
    byId('adminRefreshAudit').addEventListener('click', loadAudit);
    byId('adminCloseDialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', event => { if (changing) event.preventDefault(); });
    byId('adminRoleForm').addEventListener('submit', event => {
        event.preventDefault();
        const role = byId('adminRole').value;
        if (role === selectedUser.role) return;
        if (confirm(`Назначить роль «${roleLabels[role]}» для ${selectedUser.email || selectedUser.uid}?`)) void change('role', { role });
    });
})();
