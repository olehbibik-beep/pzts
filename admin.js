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
    let loaded = false;
    let visitRequest = 0;
    let feedbackCursor = null, feedbackLoading = false, feedbackRevision = 0;
    let feedbackEntries = [], selectedFeedback = new Set(), feedbackWriting = false;
    const nav = [...document.querySelectorAll('[data-view]')];
    const viewTitles = { overview: 'Обзор', users: 'Пользователи', access: 'PROJECT и доступ', activity: 'Активность', feedback: 'Обратная связь', reviews:'Комментарии пользователей' };
    const server = { source: 'server' };
    const unavailable = Symbol('unavailable');

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
        loaded = false;
        query = '';
        tokens = [null];
        pageIndex = 0;
        nextPage = null;
        changing = false;
        byId('adminQuery').value = '';
        byId('adminWorkspace').hidden = true;
        byId('adminUsers').replaceChildren();
        byId('adminEvents').replaceChildren();
        byId('adminVisits').replaceChildren();
        byId('adminReviews').replaceChildren();reviewRows=[];reviewCursor=null;reviewGeneration++;
        byId('adminFeedback').replaceChildren();
        byId('adminMoreFeedback').hidden = true;
        feedbackCursor = null;
        feedbackLoading = false;
        feedbackRevision++; feedbackEntries = []; selectedFeedback.clear(); feedbackWriting = false;
        byId('adminUserFilter').value = 'all';
        if (dialog.open) dialog.close();
        byId('adminUserPrograms').replaceChildren();
        byId('adminUserTitle').textContent = '';
        byId('adminUserUid').textContent = '';
        byId('adminUserVisit').textContent = '';
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

    async function readOptional(read) {
        try { return await read; }
        catch (error) {
            if (error.code === 'permission-denied' || error.code === 'unavailable') return unavailable;
            throw error;
        }
    }

    async function readUser(profile, canReadPurchase) {
        const uid = profile.id;
        const get = name => db.collection(name).doc(uid).get(server);
        const [role, grant, visit, purchase, usage] = await Promise.all([
            get('goomAdmins'), get('goomProgramGrants'), readOptional(get('goomEditorActivity')),
            canReadPurchase ? readOptional(get('cloudLicenses')) : unavailable, readOptional(get('goomEditorUsage'))
        ]);
        const data = profile.data();
        const license = purchase === unavailable ? null : purchase.data();
        const validPurchase = license?.uid === uid && license.plan === 'pro' && license.status === 'active'
            && license.source === 'stripe' && license.paymentStatus === 'paid' && ['monthly', 'annual'].includes(license.billingMode);
        const programs = Object.fromEntries(Object.keys(programLabels).map(app => [app, {
            manualUntil: grant.data()?.expiresAt?.[app]?.toMillis() ?? null,
            companyUntil: license?.companySeat && license.companySeat.email === data.email?.toLowerCase() ? license.companySeat.applicationExpiresAt?.[app]?.toMillis?.() ?? null : null,
            tier: license?.applicationPlans?.[app] || 'pro',
            paidUntil: validPurchase && Array.isArray(license.applications) && license.applications.includes(app)
                ? license.applicationExpiresAt?.[app]?.toMillis?.() ?? null : null
        }]));
        return {
            uid, name: data.displayName || '', email: data.email || '', accountType: data.accountType, usage: usage === unavailable ? null : usage.data(), role: role.data()?.role || 'user',
            programs, billingAvailable: purchase !== unavailable, visit: visit === unavailable ? unavailable : visit.data()
        };
    }

    async function readUsers(search, cursor, options = {}) {
        const profiles = db.collection('users'), canReadPurchase = session.role === 'owner';
        const field = options.exact ? 'uid' : byId('adminSearchField').value;
        const filter = options.exact ? 'all' : byId('adminUserFilter').value;
        if (search && field === 'uid') {
            if (search.length > 128 || search.includes('/') || search === '.' || search === '..')
                throw Object.assign(new Error('Invalid UID'), { code: 'invalid-argument' });
            const profile = await profiles.doc(search).get(server);
            return { users: profile.exists ? [await readUser(profile, canReadPurchase)] : [], nextPage: null };
        }
        let list;
        if (search) list = profiles.orderBy(field).startAt(search).endAt(search + '\uf8ff');
        else if (filter === 'manual') list = db.collection('goomProgramGrants').where('expiresAt.' + program, '>', firebase.firestore.Timestamp.fromMillis(Date.now())).orderBy('expiresAt.' + program, 'desc');
        else if (filter === 'paid') list = db.collection('cloudLicenses').where('applicationExpiresAt.' + program, '>', firebase.firestore.Timestamp.fromMillis(Date.now())).orderBy('applicationExpiresAt.' + program, 'desc');
        else if (filter === 'recent') list = db.collection('goomEditorActivity').orderBy('lastSeen', 'desc');
        else if (filter === 'time') list = db.collection('goomEditorUsage').orderBy('applications.' + program, 'desc');
        else list = profiles.orderBy(firebase.firestore.FieldPath.documentId());
        if (cursor) list = list.startAfter(cursor);
        const page = await list.limit(pageSize).get(server);
        const records = await Promise.all(page.docs.map(async snapshot => {
            const profile = search || filter === 'all' ? snapshot : await profiles.doc(snapshot.id).get(server);
            return profile.exists ? readUser(profile, canReadPurchase) : null;
        }));
        return { users: records.filter(user => user && (filter !== 'paid' || user.programs[program].paidUntil > Date.now())),
            nextPage: page.size === pageSize ? page.docs.at(-1) : null };
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
                tokens = [null]; pageIndex = 0;
                renderPrograms();
                void loadUsers(0);
                byId('adminPrograms').querySelector('[aria-pressed="true"]').focus();
            });
            return button;
        });
        byId('adminPrograms').replaceChildren(...cards);
    }

    function dateLabel(value) { return value ? date.format(new Date(value)) : '—'; }

    function showView(view) {
        byId('programTitle').textContent = viewTitles[view];
        nav.forEach(button => {
            if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        const activity = view === 'activity';
        const feedback = view === 'feedback';
        const reviews=view==='reviews';
        byId('adminReviewsSection').hidden=!reviews;
        byId('adminPrograms').hidden = activity || feedback || reviews;
        byId('adminSummary').hidden = view !== 'overview';
        byId('adminUserList').hidden = activity || feedback || reviews;
        byId('adminVisitsSection').hidden = !activity;
        byId('adminAuditSection').hidden = !activity;
        byId('adminFeedbackSection').hidden = !feedback;
        byId('adminTable').dataset.view = view;
        if (activity) void Promise.all([loadVisits(), loadAudit()]);
        if (feedback) void loadFeedback();
        if(reviews)void loadReviews();
    }

    function paidLabel(user, application) {
        if (session.role !== 'owner') return 'Только владельцу';
        if (!user.billingAvailable) return 'Нет данных';
        const expiry = user.programs[application].paidUntil;
        return expiry > Date.now() ? `До ${dateLabel(expiry)}` : '—';
    }

    function visitLabel(visit) {
        if (visit === unavailable) return 'Нет данных';
        return visit ? `${dateLabel(visit.lastSeen?.toMillis())} · ${visit.application}` : '—';
    }

    function renderSummary() {
        const now = Date.now();
        let paid = 0, manual = 0, manualOnly = 0, free = 0, recent = 0;
        let unknown = 0;
        for (const user of users) {
            const access = user.programs[program];
            if (access.manualUntil > now) manual++;
            if (user.visit?.lastSeen?.toMillis() > now - 7 * 86_400_000) recent++;
            if (!user.billingAvailable) unknown++;
            else if (access.paidUntil > now) paid++;
            else if (access.manualUntil > now) manualOnly++;
            else free++;
        }
        const billingAvailable = loaded && session.role === 'owner' && unknown === 0;
        const activityAvailable = loaded && users.every(user => user.visit !== unavailable);
        byId('adminMetrics').replaceChildren(...[
            ['Пользователи', loaded ? users.length : '—'],
            ['Оплаченный PROJECT', billingAvailable ? paid : '—'],
            ['Ручной доступ', loaded ? manual : '—'],
            ['Посещали за 7 дней', activityAvailable ? recent : '—']
        ].map(([label, value]) => {
            const card = element('div', undefined, 'metric');
            card.append(element('span', label), element('strong', value));
            return card;
        }));
        byId('adminChartCaption').textContent = session.role !== 'owner'
            ? `${program} · данные об оплате видит владелец`
            : `${program} · текущий доступ`;
        const donut = byId('adminDonut');
        const paidStop = users.length ? 100 * paid / users.length : 0;
        const manualStop = users.length ? 100 * (paid + manualOnly) / users.length : 0;
        donut.style.background = billingAvailable ? `conic-gradient(var(--paid) 0 ${paidStop}%, var(--manual) ${paidStop}% ${manualStop}%, var(--free) ${manualStop}% 100%)` : '';
        donut.firstElementChild.textContent = billingAvailable ? users.length : '—';
        byId('adminBreakdown').replaceChildren(...[
            ['Оплаченный PROJECT', paid, 'paid'], ['Только ручной доступ', manualOnly, 'manual'], ['Без PROJECT', free, 'free']
        ].map(([label, value, color]) => {
            const item = element('li', label);
            item.style.setProperty('--dot', `var(--${color})`);
            item.append(element('strong', billingAvailable ? value : '—'));
            return item;
        }));
    }

    function durationLabel(seconds) {
        if (!Number.isFinite(seconds)) return 'Ещё нет данных';
        if (seconds < 60) return '< 1 мин';
        const minutes = Math.floor(seconds / 60), hours = Math.floor(minutes / 60);
        return hours ? hours + ' ч ' + minutes % 60 + ' мин' : minutes + ' мин';
    }
    function accessState(user, application) {
        const access = user.programs[application], now = Date.now();
        if (access.paidUntil > now) return { label: access.tier === 'company' ? 'COMPANY PROJECT' : 'PROJECT', kind: 'paid', icon: '▣', until: access.paidUntil };
        if (access.companyUntil > now) return { label: 'PROJECT · команда', kind: 'company', icon: '♧', until: access.companyUntil };
        if (access.manualUntil > now) return { label: 'PROJECT · вручную', kind: 'manual', icon: '◆', until: access.manualUntil };
        return { label: user.billingAvailable ? 'BASIC' : 'Оплата: нет доступа', kind: 'basic', icon: '○' };
    }
    function renderUsers() {
        const rows = users.map(user => {
            const row = element('tr'), account = element('td'), identity = element('div', undefined, 'account-cell');
            const avatar = element('span', (user.name || user.email || '?').slice(0, 1).toUpperCase(), 'avatar');
            const name = element('div'); name.append(element('strong', user.name || user.email || user.uid));
            if (user.email) name.append(element('span', user.email, 'subline'));
            if (user.role !== 'user') name.append(element('span', '◇ ' + roleLabels[user.role], 'role-label'));
            identity.append(avatar, name); account.append(identity);
            const programs = element('td'), indicators = element('div', undefined, 'program-indicators');
            for (const app of Object.keys(programLabels)) {
                const state = accessState(user, app), badge = element('span', app, 'program-dot ' + state.kind);
                badge.title = app + ' · ' + state.label + (state.until ? ' · до ' + dateLabel(state.until) : '');
                badge.setAttribute('aria-label', badge.title); indicators.append(badge);
            }
            programs.append(indicators);
            const tier = element('td'), state = accessState(user, program);
            tier.append(element('span', state.icon + ' ' + state.label, 'badge ' + state.kind));
            if (state.until) tier.append(element('span', 'До ' + dateLabel(state.until), 'subline'));
            const activity = element('td', undefined, 'activity-column');
            const active = user.usage?.activeSeconds > 0 && user.usage.updatedAt?.toMillis() > Date.now() - 90000;
            activity.append(element('span', active ? '● Активен' : visitLabel(user.visit), active ? 'online-label' : 'subline'));
            const time = element('span', '◷ ' + durationLabel(user.usage?.applications?.[program]), 'subline');
            time.title = program + ': активное время с момента обновления. Все программы: ' + durationLabel(user.usage?.activeSeconds); activity.append(time);
            const action = element('td'), button = element('button', '⋯', 'row-action'); button.type = 'button';
            button.setAttribute('aria-label', 'Открыть ' + (user.email || user.uid));
            button.addEventListener('click', () => { selectedUser = user; status('', false, 'adminUserStatus'); renderUserDialog(); dialog.showModal(); });
            action.append(button); row.append(account, programs, tier, activity, action); return row;
        });
        if (loaded && !rows.length) { const row = element('tr'), cell = element('td', 'Пользователи не найдены.'); cell.colSpan = 5; row.append(cell); rows.push(row); }
        byId('adminUsers').replaceChildren(...rows);
        byId('adminPrev').disabled = pageIndex === 0;
        byId('adminNext').disabled = !nextPage;
        byId('adminPage').textContent = !loaded ? 'Загружаем…' : 'Страница ' + (pageIndex + 1) + ' · ' + users.length + ' аккаунтов';
        byId('adminUsersHint').textContent = program + ' · по 25 аккаунтов, показатели относятся к этой странице';
        renderSummary();
    }

    async function loadUsers(index = pageIndex, search = query) {
        const currentEpoch = epoch;
        const revision = ++pageRequest;
        const pageToken = search === query ? tokens[index] : null;
        byId('adminTable').setAttribute('aria-busy', 'true');
        byId('adminPrev').disabled = byId('adminNext').disabled = true;
        try {
            const result = await readUsers(search, pageToken);
            if (currentEpoch !== epoch || revision !== pageRequest) return;
            if (search !== query) tokens = [null];
            query = search;
            pageIndex = index;
            users = result.users;
            loaded = true;
            nextPage = result.nextPage;
            tokens[index + 1] = nextPage;
            renderUsers();
            status('');
        } catch (error) {
            if (currentEpoch !== epoch || revision !== pageRequest) return;
            handleError(error, currentEpoch);
        } finally { if (revision === pageRequest && currentEpoch === epoch) { byId('adminTable').removeAttribute('aria-busy'); byId('adminPrev').disabled = pageIndex === 0; byId('adminNext').disabled = !nextPage; } }
    }

    async function loadVisits() {
        const currentEpoch = epoch;
        const revision = ++visitRequest;
        const list = byId('adminVisits');
        try {
            const snapshots = await readOptional(db.collection('goomEditorActivity').orderBy('lastSeen', 'desc').limit(pageSize).get(server));
            const items = snapshots === unavailable ? [element('li', 'Данные о посещениях недоступны.', 'muted')] :
                await Promise.all(snapshots.docs.map(async snapshot => {
                    const profile = (await db.collection('users').doc(snapshot.id).get(server)).data();
                    const item = element('li', profile?.displayName || profile?.email || snapshot.id);
                    item.append(element('span', visitLabel(snapshot.data()), 'subline'));
                    return item;
                }));
            if (currentEpoch !== epoch || revision !== visitRequest) return;
            list.replaceChildren(...(items.length ? items : [element('li', 'Посещений пока нет.', 'muted')]));
        } catch (error) {
            if (revision === visitRequest) handleError(error, currentEpoch);
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

    function feedbackRow(entry) {
        const item = element('li', undefined, 'feedback-item' + (entry.readAt ? '' : ' unread')); item.dataset.id = entry.id;
        const select = element('input'); select.type = 'checkbox'; select.checked = selectedFeedback.has(entry.id); select.setAttribute('aria-label', 'Выбрать сообщение от ' + entry.email);
        select.addEventListener('change', () => { select.checked ? selectedFeedback.add(entry.id) : selectedFeedback.delete(entry.id); updateFeedbackTools(); });
        const content = element('div', undefined, 'feedback-content'), heading = element('div', undefined, 'feedback-item-heading');
        const identity = element('div'); identity.append(element('strong', entry.name || entry.email));
        const email = element('a', entry.email, 'feedback-item-email'); email.href = 'mailto:' + encodeURIComponent(entry.email).replace('%40', '@'); identity.append(email);
        heading.append(identity, element('span', dateLabel(entry.sentAt?.toMillis()) + ' · ' + entry.application, 'muted'));
        const message = element('p', entry.message, 'feedback-item-message');
        const actions = element('div', undefined, 'feedback-actions'), read = element('button', entry.readAt ? '✉ Непрочитанное' : '✓ Прочитать'); read.type = 'button';
        read.addEventListener('click', () => void changeFeedback('read', [entry.id], !entry.readAt));
        const remove = element('button', 'Удалить', 'danger'); remove.type = 'button'; remove.addEventListener('click', () => void changeFeedback('delete', [entry.id]));
        actions.append(element('span', entry.readAt ? 'Прочитано' : 'Новое', 'badge ' + (entry.readAt ? '' : 'paid')), read, remove);
        content.append(heading, message, actions); item.append(select, content); return item;
    }
    function visibleFeedback() { return feedbackEntries.filter(entry => !byId('adminUnreadOnly').checked || !entry.readAt); }
    function updateFeedbackTools() {
        const visible = visibleFeedback(), selected = selectedFeedback.size;
        byId('adminReadFeedback').disabled = byId('adminDeleteFeedback').disabled = feedbackWriting || !selected;
        const all = byId('adminSelectFeedback'); all.checked = !!visible.length && visible.every(entry => selectedFeedback.has(entry.id)); all.indeterminate = !!selected && !all.checked;
        byId('adminFeedbackCount').textContent = 'Загружено: ' + feedbackEntries.length + ' · новых: ' + feedbackEntries.filter(entry => !entry.readAt).length + (selected ? ' · выбрано: ' + selected : '');
    }
    function renderFeedback() {
        byId('adminFeedback').replaceChildren(...visibleFeedback().map(feedbackRow)); updateFeedbackTools();
        status(visibleFeedback().length ? '' : 'В загруженных сообщениях ничего нет.', false, 'adminFeedbackStatus');
    }
    async function changeFeedback(action, ids, read = true) {
        if (!session || feedbackWriting || !ids.length) return;
        if (action === 'delete' && !confirm('Удалить сообщений: ' + ids.length + '? Восстановить их будет нельзя.')) return;
        const currentEpoch = epoch; feedbackWriting = true; feedbackRevision++; updateFeedbackTools();
        byId('adminFeedback').querySelectorAll('button,input').forEach(control => control.disabled = true);
        let failure = '';
        try {
            for (let offset = 0; offset < ids.length; offset += 25) {
                if (currentEpoch !== epoch) return;
                const chunk = ids.slice(offset, offset + 25), batch = db.batch();
                for (const id of chunk) { const ref = db.collection('goomFeedback').doc(id); action === 'delete' ? batch.delete(ref) : batch.update(ref, { readAt: read ? firebase.firestore.FieldValue.serverTimestamp() : null, readBy: read ? session.uid : null }); }
                await batch.commit();
                if (currentEpoch !== epoch) return;
                if (action === 'delete') feedbackEntries = feedbackEntries.filter(entry => !chunk.includes(entry.id));
                else feedbackEntries.forEach(entry => { if (chunk.includes(entry.id)) entry.readAt = read ? firebase.firestore.Timestamp.fromMillis(Date.now()) : null; });
                chunk.forEach(id => selectedFeedback.delete(id));
            }
        } catch (error) { failure = readableError(error); }
        finally { if (currentEpoch === epoch) { feedbackWriting = false; renderFeedback(); if (failure) status(failure, true, 'adminFeedbackStatus'); } }
    }
    async function loadFeedback(more = false) {
        if (!session || feedbackLoading || feedbackWriting || (more && !feedbackCursor)) return;
        const currentEpoch = epoch, revision = ++feedbackRevision, next = byId('adminMoreFeedback'), refresh = byId('adminRefreshFeedback');
        feedbackLoading = true; next.disabled = refresh.disabled = true;
        if (!more) { feedbackCursor = null; feedbackEntries = []; selectedFeedback.clear(); next.hidden = true; byId('adminFeedback').replaceChildren(); }
        status('Загружаем сообщения…', false, 'adminFeedbackStatus');
        try {
            let query = db.collection('goomFeedback').orderBy('sentAt', 'desc').limit(pageSize); if (more) query = query.startAfter(feedbackCursor);
            const result = await query.get(server); if (currentEpoch !== epoch || revision !== feedbackRevision) return;
            const known = new Set(feedbackEntries.map(entry => entry.id));
            feedbackEntries.push(...result.docs.filter(snapshot => !known.has(snapshot.id)).map(snapshot => ({ ...snapshot.data(), id: snapshot.id })));
            feedbackCursor = result.size === pageSize ? result.docs.at(-1) : null; next.hidden = !feedbackCursor; renderFeedback();
        } catch (error) {
            if (currentEpoch !== epoch) return;
            if (error.code === 'permission-denied') { feedbackEntries = []; selectedFeedback.clear(); byId('adminFeedback').replaceChildren(); feedbackCursor = null; next.hidden = true; }
            status(readableError(error), true, 'adminFeedbackStatus');
        } finally { if (currentEpoch === epoch) { feedbackLoading = false; next.disabled = refresh.disabled = false; updateFeedbackTools(); } }
    }

    function renderUserDialog() {
        const user = selectedUser;
        byId('adminUserTitle').textContent = user.name || user.email || user.uid;
        byId('adminUserUid').textContent = `${user.email || ''} · ${user.uid} · ${roleLabels[user.role]}`;
        byId('adminUserVisit').textContent = `Последнее посещение · ${visitLabel(user.visit)} · Активное время: ${durationLabel(user.usage?.activeSeconds)} (после обновления)`;
        const canEdit = user.uid !== session.uid && user.role !== 'owner' && (session.role === 'owner' || user.role === 'user');
        const canEditRole = canEdit && session.role === 'owner';
        const canGrant = canEdit || (user.uid === session.uid && session.role === 'owner');
        byId('adminRoleForm').hidden = !canEditRole;
        byId('adminRole').value = user.role;
        const rows = session.programs.map(application => {
            const row = element('section', undefined, 'grant');
            const manual = user.programs[application].manualUntil;
            row.append(element('h3', application),
                element('p', `Оплаченный PROJECT · ${paidLabel(user, application)}`, 'muted'),
                element('p', `Ручной доступ · ${manual > Date.now() ? dateLabel(manual) : '—'}`, 'muted'));
            if (!canGrant) return row;
            const form = element('form', undefined, 'control-row');
            const label = element('label', 'Дней доступа');
            const input = element('input');
            Object.assign(input, { type: 'number', min: '1', max: '365', step: '1', value: '30', required: true });
            label.append(input);
            const grantButton = element('button', 'Выдать PROJECT', 'primary');
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
            if (currentEpoch !== epoch) return;
            const { users: matches } = await readUsers(uid, null, { exact: true });
            if (currentEpoch !== epoch) return;
            await Promise.all([loadUsers(), loadAudit()]);
            if (currentEpoch !== epoch) return;
            selectedUser = matches[0];
            renderUserDialog();
            status(changed ? 'Изменения сохранены.' : 'Доступ уже настроен так.', false, 'adminUserStatus');
        } catch (error) { handleError(error, currentEpoch, 'adminUserStatus'); }
        finally {
            controls.forEach(control => { control.disabled = false; });
            if (currentEpoch === epoch) changing = false;
        }
    }

    let reviewRows=[],reviewCursor=null,reviewLoading=false,reviewGeneration=0,reviewWriting=false;
    async function reviewRequest(data){const token=await auth.currentUser?.getIdToken();if(!token)throw denied();const response=await fetch('https://europe-west1-pztsepscctv.cloudfunctions.net/goomReviews',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({data}),signal:AbortSignal.timeout(20000)}),body=await response.json();if(!response.ok||body.error)throw Object.assign(Error('Review request failed'),{code:body.error?.status?.toLowerCase().replaceAll('_','-')||'unavailable'});return body.data??body.result;}
    function renderReviews(){const filter=byId('adminReviewFilter').value,rows=reviewRows.filter(r=>filter==='all'||r.status===filter),labels={pending:'Ожидает проверки',published:'Опубликован',rejected:'Отклонён'};byId('adminReviews').replaceChildren(...(rows.length?rows.map(r=>{const li=element('li',undefined,'admin-review'),head=element('header'),name=element('div'),time=Math.max(0,r.activeSeconds||0)/3600,marks=[0,1,5,15,40,100,250,500,1000],level=marks.findLastIndex(h=>time>=h),upper=marks[level+1]||marks[level]+1000;name.append(element('strong',r.authorName),element('span',r.application+' · '+labels[r.status]+' · '+dateLabel(r.submittedAt),'subline'));const practice=element('div',undefined,'admin-review-practice');practice.append(element('small','Опыт при отправке: '+time.toLocaleString('ru',{maximumFractionDigits:1})+' ч · уровень '+(level+1)));const track=element('div',undefined,'admin-review-track'),fill=element('span');fill.style.width=Math.max(0,Math.min(100,(level+(time-marks[level])/(upper-marks[level]))/(marks.length-1)*100))+'%';track.append(fill);practice.append(track);name.append(practice);head.append(name);li.append(head,element('p',r.message,'admin-review-message'));const actions=element('div',undefined,'admin-review-actions');for(const[decision,label,cls]of [['publish','Опубликовать','primary'],['reject',r.status==='published'?'Снять публикацию':'Отклонить',''],['delete','Удалить','danger']]){if(decision==='publish'&&r.status==='published'||decision==='reject'&&r.status==='rejected')continue;const button=element('button',label,cls);button.type='button';button.disabled=reviewWriting;button.onclick=()=>{if(decision==='delete'&&!confirm('Удалить комментарий '+r.authorName+'?'))return;void moderateReview(r.id,decision);};actions.append(button);}li.append(actions);return li;}):[element('li',reviewLoading?'Загружаем…':'На этой странице нет комментариев для выбранного фильтра.','muted')]));byId('adminMoreReviews').hidden=!reviewCursor;byId('adminMoreReviews').disabled=reviewLoading||reviewWriting;byId('adminRefreshReviews').disabled=reviewLoading||reviewWriting;}
    async function loadReviews(more=false){if(!session||reviewLoading||reviewWriting)return;const currentEpoch=epoch,generation=++reviewGeneration;reviewLoading=true;if(!more){reviewRows=[];reviewCursor=null;}status('',false,'adminReviewStatus');renderReviews();try{const result=await reviewRequest({action:'list',status:'all',cursor:more?reviewCursor:null});if(currentEpoch!==epoch||generation!==reviewGeneration)return;const known=new Set(reviewRows.map(r=>r.id));reviewRows.push(...result.reviews.filter(r=>!known.has(r.id)));reviewCursor=result.cursor;}catch(error){if(currentEpoch===epoch){if(error.code==='permission-denied'){reviewRows=[];reviewCursor=null;}status(readableError(error),true,'adminReviewStatus');}}finally{reviewLoading=false;if(currentEpoch===epoch)renderReviews();}}
    async function moderateReview(id,decision){if(!session||reviewWriting)return;const currentEpoch=epoch;reviewWriting=true;renderReviews();try{const result=await reviewRequest({action:'moderate',id,decision});if(currentEpoch!==epoch)return;if(result.status==='deleted')reviewRows=reviewRows.filter(r=>r.id!==id);else reviewRows.forEach(r=>{if(r.id===id)r.status=result.status;});status('Изменения сохранены.',false,'adminReviewStatus');}catch(error){if(currentEpoch===epoch)status(readableError(error),true,'adminReviewStatus');}finally{reviewWriting=false;if(currentEpoch===epoch)renderReviews();}}
    byId('adminRefreshReviews').onclick=()=>void loadReviews();byId('adminMoreReviews').onclick=()=>void loadReviews(true);byId('adminReviewFilter').onchange=renderReviews;
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
            byId('adminUserFilter').querySelector('[value=paid]').disabled = session.role !== 'owner';
            byId('adminIdentity').textContent = `${user.email || user.uid} · ${roleLabels[session.role]}`;
            program = session.programs[0];
            showView('overview');
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
    byId('adminSearch').addEventListener('submit', event => { event.preventDefault(); byId('adminUserFilter').value = 'all'; tokens = [null]; void loadUsers(0, byId('adminQuery').value.trim()); });
    byId('adminUserFilter').addEventListener('change', () => { byId('adminQuery').value = ''; tokens = [null]; void loadUsers(0, ''); });
    byId('adminSearchField').addEventListener('change', () => { const field = byId('adminSearchField').value; byId('adminQuery').placeholder = field === 'uid' ? 'Точный UID' : field === 'email' ? 'E-mail начинается с…' : 'Имя начинается с…'; byId('adminSearchHint').textContent = field === 'uid' ? 'Точное совпадение UID.' : 'Поиск по началу ' + (field === 'email' ? 'e-mail' : 'имени') + ', с учётом регистра. По 25 на страницу.'; });
    byId('adminReset').addEventListener('click', () => { byId('adminQuery').value = ''; byId('adminUserFilter').value = 'all'; tokens = [null]; void loadUsers(0, ''); });
    byId('adminPrev').addEventListener('click', () => { if (pageIndex > 0) void loadUsers(pageIndex - 1); });
    byId('adminNext').addEventListener('click', () => { if (nextPage) void loadUsers(pageIndex + 1); });
    byId('adminRefreshAudit').addEventListener('click', loadAudit);
    byId('adminRefreshVisits').addEventListener('click', loadVisits);
    byId('adminRefreshFeedback').addEventListener('click', () => loadFeedback());
    byId('adminUnreadOnly').addEventListener('change', () => { selectedFeedback.clear(); renderFeedback(); });
    byId('adminSelectFeedback').addEventListener('change', event => { selectedFeedback.clear(); if (event.target.checked) visibleFeedback().forEach(entry => selectedFeedback.add(entry.id)); renderFeedback(); });
    byId('adminReadFeedback').addEventListener('click', () => void changeFeedback('read', [...selectedFeedback]));
    byId('adminDeleteFeedback').addEventListener('click', () => void changeFeedback('delete', [...selectedFeedback]));
    byId('adminMoreFeedback').addEventListener('click', () => loadFeedback(true));
    nav.forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
    byId('adminCloseDialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', event => { if (changing) event.preventDefault(); });
    byId('adminRoleForm').addEventListener('submit', event => {
        event.preventDefault();
        const role = byId('adminRole').value;
        if (role === selectedUser.role) return;
        if (confirm(`Назначить роль «${roleLabels[role]}» для ${selectedUser.email || selectedUser.uid}?`)) void change('role', { role });
    });
})();
