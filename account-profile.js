(() => {
    let profile = null;
    let license = null;
    let grant = null;
    let uid = null;
    let generation = 0;
    let ready = Promise.resolve();
    let unsubscribe = [];
    let expiryTimer;
    const byId = id => document.getElementById(id);
    const userIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-2a8 8 0 0 1 16 0v2"></path></svg>';

    function normalizeIco(value) { return String(value || '').replace(/\s/g, ''); }
    function validIco(value) {
        const ico = normalizeIco(value);
        if (!/^\d{8}$/.test(ico)) return false;
        const sum = [...ico.slice(0, 7)].reduce((total, digit, index) => total + Number(digit) * (8 - index), 0);
        return Number(ico[7]) === (11 - sum % 11) % 10;
    }
    window.isValidCompanyIco = validIco;
    const millis = value => value?.toMillis?.() ?? value?.seconds * 1000;
    const paidUntil = () => millis(license?.applicationExpiresAt?.[APP_PRODUCT]);
    const grantedUntil = () => millis(grant?.expiresAt?.[APP_PRODUCT]);
    const hasPaidAccess = () => license?.status === 'active' && license.uid === uid && license.plan === 'pro'
        && license.paymentStatus === 'paid' && license.source === 'stripe' && license.billingMode === 'monthly'
        && license.applications?.includes(APP_PRODUCT) && paidUntil() > Date.now();
    window.hasProAccess = () => Boolean(window.getFirebaseUser()?.emailVerified && uid === window.getFirebaseUser()?.uid
        && (hasPaidAccess() || grantedUntil() > Date.now()));
    window.hasCloudAccess = window.hasProAccess;

    function feedback(message = '', error = false) {
        byId('accountFeedback').textContent = message;
        byId('accountFeedback').hidden = !message;
        byId('accountFeedback').dataset.error = String(error);
    }
    function render() {
        const user = window.getFirebaseUser();
        const company = profile?.accountType === 'company';
        const entitled = window.hasCloudAccess();
        byId('accountName').textContent = profile?.displayName || user?.displayName || '';
        byId('accountEmail').textContent = user?.email || '';
        byId('accountTypeLabel').textContent = tr(company ? 'Firma' : 'Osobní účet');
        byId('accountIcoLabel').hidden = !company;
        byId('accountIcoValue').hidden = !company;
        byId('accountIcoValue').textContent = profile?.ico || '';
        byId('accountEmailStatus').textContent = tr(user?.emailVerified ? 'E-mail je ověřen' : 'E-mail zatím není ověřen');
        byId('btnAccountVerifyEmail').hidden = Boolean(user?.emailVerified);
        byId('btnAccountRefresh').textContent = tr(user?.emailVerified ? 'Obnovit údaje' : 'E-mail jsem ověřil(a)');
        byId('accountCloudInfo').textContent = tr(entitled ? 'PRO je aktivní. Cloudové úložiště je připraveno.' : 'Cloudové úložiště je součástí PRO.');
        const hasKey = entitled && hasPaidAccess();
        byId('accountCloudKeyBlock').hidden = !hasKey;
        byId('accountCloudKey').value = hasKey ? license.licenseId || `PZTS-PRO-${license.keySuffix}` : '';
        byId('btnAccountCopyKey').hidden = !entitled;
        byId('btnManageSubscription').hidden = !license?.billingCustomerId;
        const formatDate = value => new Date(value).toLocaleDateString(getGoomLanguage() === 'cs' ? 'cs-CZ' : 'en-GB');
        const periods = [];
        if (Number.isFinite(paidUntil())) {
            periods.push(tr`Přístup do: ${formatDate(paidUntil())}` + ' · ' + tr(license.cancelAtPeriodEnd ? 'Automatické obnovení je vypnuto.' : 'Měsíční předplatné.'));
        }
        if (grantedUntil() > Date.now()) periods.push(tr`Přístup od správce do: ${formatDate(grantedUntil())}`);
        byId('accountSubscriptionPeriod').textContent = periods.join(' · ');
        const label = tr('Uživatelský účet');
        const toolbarButton = byId('btnOpenCloudProjectsToolbar');
        toolbarButton.setAttribute('aria-label', label);
        toolbarButton.setAttribute('data-tooltip', label);
        if (toolbarButton.dataset.icon !== 'user') {
            toolbarButton.dataset.icon = 'user';
            toolbarButton.innerHTML = userIcon;
        }
        document.documentElement.dataset.plan = entitled ? 'pro' : 'free';
    }
    function announce() {
        render();
        clearTimeout(expiryTimer);
        const expiryMs = Math.min(...[paidUntil(), grantedUntil()].filter(value => value > Date.now()));
        if (Number.isFinite(expiryMs)) expiryTimer = setTimeout(announce, Math.min(2147483647, expiryMs - Date.now() + 25));
        document.dispatchEvent(new CustomEvent('goom-account-changed', { detail: { user: window.getFirebaseUser(), profile, licensed: window.hasCloudAccess() } }));
    }
    function fillForm() {
        const user = window.getFirebaseUser();
        byId('accountDisplayName').value = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || '';
        byId('accountTypeSelect').value = profile?.accountType || 'personal';
        byId('accountIcoInput').value = profile?.ico || '';
        byId('accountIcoField').hidden = byId('accountTypeSelect').value !== 'company';
        window.refreshGoomSelects?.();
    }

    function profileData(user, data, createdAt) {
        const displayName = String(data.displayName || user.displayName || user.email?.split('@')[0] || '').trim().slice(0, 120);
        const accountType = data.accountType === 'company' ? 'company' : 'personal';
        const ico = accountType === 'company' ? normalizeIco(data.ico) : '';
        if (!displayName) throw new Error(tr('Zadejte své jméno.'));
        if (accountType === 'company' && !validIco(ico)) throw new Error(tr('Zadejte platné osmimístné IČO.'));
        const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
        return { displayName, email: user.email, accountType, ico, locale: window.getGoomLanguage(), createdAt: createdAt || timestamp, updatedAt: timestamp };
    }
    async function load(user, sessionGeneration) {
        if (sessionGeneration !== generation || user.uid !== uid) return;
        const db = await window.getFirebaseDatabase();
        const profileRef = db.collection('users').doc(user.uid);
        const licenseRef = db.collection('cloudLicenses').doc(user.uid);
        const grantRef = db.collection('goomProgramGrants').doc(user.uid);
        let [storedProfile, storedLicense, storedGrant] = await Promise.all([profileRef.get(), licenseRef.get(), grantRef.get().catch(() => null)]);
        if (sessionGeneration !== generation) return;
        if (!storedProfile.exists) {
            const pending = window.pendingAccountRegistration;
            const data = profileData(user, pending?.email === user.email ? pending : {}, null);
            await db.runTransaction(async transaction => {
                const existing = await transaction.get(profileRef);
                if (!existing.exists) transaction.set(profileRef, data);
            });
            storedProfile = await profileRef.get();
        }
        if (sessionGeneration !== generation) return;
        profile = storedProfile.data();
        license = storedLicense.exists ? storedLicense.data() : null;
        grant = storedGrant?.exists ? storedGrant.data() : null;
        announce();
        fillForm();
        if (sessionGeneration !== generation) return;
        if (!unsubscribe.length) {
            const watch = (ref, callback) => ref.onSnapshot(snapshot => {
                if (sessionGeneration !== generation) return;
                callback(snapshot.exists ? snapshot.data() : null);
                announce();
            }, () => {
                if (sessionGeneration !== generation) return;
                license = null;
                announce();
                feedback(tr('Údaje účtu nelze načíst. Zkuste to znovu.'), true);
            });
            unsubscribe = [watch(profileRef, value => { profile = value; }), watch(licenseRef, value => { license = value; }),
                grantRef.onSnapshot(snapshot => {
                    if (sessionGeneration !== generation) return;
                    grant = snapshot.exists ? snapshot.data() : null;
                    announce();
                }, () => {
                    if (sessionGeneration !== generation) return;
                    grant = null;
                    announce();
                })];
        }
    }
    window.refreshUserAccount = async () => {
        const user = window.getFirebaseUser();
        if (!user) return;
        await ready;
        if (user.uid !== uid || window.getFirebaseUser()?.uid !== user.uid) return;
        const sessionGeneration = generation;
        ready = load(user, sessionGeneration).catch(() => {
            if (sessionGeneration !== generation) return;
            license = null; grant = null;
            announce();
            feedback(tr('Údaje účtu nelze načíst. Zkuste to znovu.'), true);
        });
        await ready;
    };
    window.saveAccountProfile = async data => {
        const user = window.getFirebaseUser();
        if (!user) throw new Error(tr('Přihlaste se ke svému účtu.'));
        await ready;
        if (user.uid !== uid || window.getFirebaseUser()?.uid !== user.uid) return;
        const operationGeneration = generation;
        const db = await window.getFirebaseDatabase();
        const result = await db.runTransaction(async transaction => {
            const profileRef = db.collection('users').doc(user.uid);
            const oldProfile = await transaction.get(profileRef);
            const updated = profileData(user, data, oldProfile.exists ? oldProfile.data().createdAt : null);
            transaction.set(profileRef, updated);
            return updated;
        });
        if (generation !== operationGeneration) return;
        profile = result;
        announce();
        fillForm();
    };
    window.ensureCloudAccess = async () => {
        await ready;
        return window.hasCloudAccess();
    };
    window.openAccountPanel = async () => {
        if (!window.getFirebaseUser()) { showWelcomeScreen(); return; }
        const wasOpen = byId('userAccountModal').style.display === 'flex';
        byId('userAccountModal').style.display = 'flex';
        if (!wasOpen) byId('userAccountModal').querySelector('.account-card').scrollTop = 0;
        render(); fillForm();
        await ready;
        render(); fillForm();
    };

    document.addEventListener('goom-auth-state-changed', event => {
        const user = event.detail.user;
        if (user?.uid === uid) return;
        generation++;
        const sessionGeneration = generation;
        unsubscribe.forEach(stop => stop()); unsubscribe = [];
        uid = user?.uid || null;
        profile = null; license = null; grant = null;
        feedback();
        if (!user) byId('userAccountModal').style.display = 'none';
        announce();
        ready = user ? load(user, sessionGeneration).catch(() => {
            if (sessionGeneration !== generation) return;
            license = null; grant = null;
            announce();
            feedback(tr('Údaje účtu nelze načíst. Zkuste to znovu.'), true);
        }) : Promise.resolve();
    });
    document.querySelectorAll('[data-open-account]').forEach(button => button.addEventListener('click', async () => {
        await ready;
        await window.openAccountPanel();
    }));
    byId('btnWelcomeProfile').addEventListener('click', window.openAccountPanel);
    byId('btnAccountClose').addEventListener('click', () => { byId('userAccountModal').style.display = 'none'; });
    byId('accountTypeSelect').addEventListener('change', () => { byId('accountIcoField').hidden = byId('accountTypeSelect').value !== 'company'; });
    byId('accountProfileForm').addEventListener('submit', async event => {
        event.preventDefault();
        byId('btnAccountSave').disabled = true;
        try {
            await window.saveAccountProfile({ displayName: byId('accountDisplayName').value, accountType: byId('accountTypeSelect').value, ico: byId('accountIcoInput').value });
            feedback(tr('Údaje účtu byly uloženy.'));
        } catch (error) { feedback(error.code ? tr('Údaje účtu nelze načíst. Zkuste to znovu.') : error.message, true); }
        finally { byId('btnAccountSave').disabled = false; }
    });
    byId('btnAccountVerifyEmail').addEventListener('click', async () => {
        try {
            const auth = await getFirebaseAuth();
            auth.languageCode = window.getGoomLanguage();
            await auth.currentUser.sendEmailVerification();
            feedback(tr('Ověřovací e-mail byl odeslán. Po potvrzení klikněte na „E-mail jsem ověřil(a)“.'));
        } catch { feedback(tr('Ověření e-mailu se nepodařilo odeslat. Zkuste to z nastavení účtu.'), true); }
    });
    byId('btnAccountRefresh').addEventListener('click', async () => {
        byId('btnAccountRefresh').disabled = true;
        try { if (await window.ensureFirebaseSession()) { await window.refreshUserAccount(); render(); } }
        finally { byId('btnAccountRefresh').disabled = false; }
    });
    byId('btnAccountCopyKey').addEventListener('click', async () => {
        if (!window.hasProAccess()) return;
        try { await navigator.clipboard.writeText(byId('accountCloudKey').value); feedback(tr('Klíč byl zkopírován.')); }
        catch { byId('accountCloudKey').focus(); byId('accountCloudKey').select(); }
    });
    byId('btnAccountCloudProjects').addEventListener('click', async () => {
        if (await window.ensureCloudAccess()) { byId('userAccountModal').style.display = 'none'; await window.openCloudProjects(); }
    });
    byId('btnAccountSignOut').addEventListener('click', async () => {
        try { await (await getFirebaseAuth()).signOut(); }
        catch { feedback(tr('Не удалось выйти из аккаунта'), true); }
    });
    byId('btnManageSubscription').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const result = await window.callProBilling('createProPortal');
            const url = new URL(result.url);
            if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com') throw new Error('Invalid billing URL');
            location.assign(url.href);
        } catch { feedback(tr('Správu předplatného nyní nelze otevřít. Zkuste to později.'), true); }
        finally { button.disabled = false; }
    });
    window.addEventListener('goom-language-changed', render);
    render();
})();
