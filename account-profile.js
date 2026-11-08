(() => {
    let profile = null;
    let license = null;
    let uid = null;
    let generation = 0;
    let ready = Promise.resolve();
    let issuing = null;
    let issuedKey = null;
    let unsubscribe = [];
    const byId = id => document.getElementById(id);
    const userIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-2a8 8 0 0 1 16 0v2"></path></svg>';
    const cloudIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4.6 4.6 0 0 1-.2-9.2A6 6 0 0 1 18 10a4 4 0 0 1-.5 8H7Z"></path></svg>';

    function normalizeIco(value) { return String(value || '').replace(/\s/g, ''); }
    function validIco(value) {
        const ico = normalizeIco(value);
        if (!/^\d{8}$/.test(ico)) return false;
        const sum = [...ico.slice(0, 7)].reduce((total, digit, index) => total + Number(digit) * (8 - index), 0);
        return Number(ico[7]) === (11 - sum % 11) % 10;
    }
    window.isValidCompanyIco = validIco;
    window.hasCloudAccess = () => Boolean(window.getFirebaseUser()?.emailVerified && uid === window.getFirebaseUser()?.uid
        && profile?.accountType === 'company' && validIco(profile.ico)
        && license?.status === 'active' && license.uid === uid && license.ico === profile.ico);

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
        byId('accountCloudInfo').textContent = tr(entitled
            ? 'Klíč je vydán pro tento firemní účet. Cloudové projekty jsou dostupné.'
            : company && !user?.emailVerified ? 'Pro automatické vydání klíče ověřte svůj e-mail.'
                : 'Cloudové úložiště je dostupné firemním účtům s vydaným klíčem.');
        byId('accountCloudKeyBlock').hidden = !entitled;
        byId('accountCloudKey').value = entitled ? issuedKey || `GOOM-••••••••-${license.keySuffix}` : '';
        byId('btnAccountCopyKey').hidden = !issuedKey;
        const label = tr(entitled ? 'Облачные проекты' : 'Uživatelský účet');
        byId('menuAccountLabel').textContent = label;
        const toolbarButton = byId('btnOpenCloudProjectsToolbar');
        toolbarButton.setAttribute('aria-label', label);
        toolbarButton.setAttribute('data-tooltip', label);
        const icon = entitled ? 'cloud' : 'user';
        if (toolbarButton.dataset.icon !== icon) {
            toolbarButton.dataset.icon = icon;
            toolbarButton.innerHTML = entitled ? cloudIcon : userIcon;
            byId('btnMenuCloudProjects').querySelector('svg').outerHTML = entitled ? cloudIcon : userIcon;
        }
    }
    function announce() {
        render();
        document.dispatchEvent(new CustomEvent('goom-account-changed', { detail: { user: window.getFirebaseUser(), profile, licensed: window.hasCloudAccess() } }));
    }
    function fillForm() {
        const user = window.getFirebaseUser();
        byId('accountDisplayName').value = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || '';
        byId('accountTypeSelect').value = profile?.accountType || 'personal';
        byId('accountIcoInput').value = profile?.ico || '';
        byId('accountIcoField').hidden = byId('accountTypeSelect').value !== 'company';
    }

    async function createKey() {
        const bytes = crypto.getRandomValues(new Uint8Array(24));
        const key = 'GOOM-' + [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
        return { key, keyHash: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join(''), keySuffix: key.slice(-8) };
    }
    async function issueCompanyKey(rotate = false) {
        if (issuing) return issuing;
        const user = window.getFirebaseUser();
        if (!user?.emailVerified || profile?.accountType !== 'company' || !validIco(profile.ico)) return null;
        const operationGeneration = generation;
        const operation = (async () => {
            const db = await window.getFirebaseDatabase();
            const material = await createKey();
            const result = await db.runTransaction(async transaction => {
                const profileRef = db.collection('users').doc(user.uid);
                const licenseRef = db.collection('cloudLicenses').doc(user.uid);
                const storedProfile = await transaction.get(profileRef);
                const existing = await transaction.get(licenseRef);
                const company = storedProfile.data();
                if (company?.accountType !== 'company' || !validIco(company.ico)) throw new Error(tr('Zadejte platné osmimístné IČO.'));
                if (existing.exists && !rotate) return { license: existing.data(), key: null };
                const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
                const data = { uid: user.uid, ico: company.ico, status: 'active', keyHash: material.keyHash, keySuffix: material.keySuffix, issuedAt: existing.exists ? existing.data().issuedAt : timestamp, updatedAt: timestamp };
                transaction.set(licenseRef, data);
                return { license: data, key: material.key };
            });
            if (operationGeneration !== generation || uid !== user.uid) return null;
            license = result.license;
            if (result.key) issuedKey = result.key;
            announce();
            return result;
        })();
        issuing = operation;
        try { return await operation; } finally { if (issuing === operation) issuing = null; }
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
        let [storedProfile, storedLicense] = await Promise.all([profileRef.get(), licenseRef.get()]);
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
        announce();
        fillForm();
        await issueCompanyKey();
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
            unsubscribe = [watch(profileRef, value => { profile = value; }), watch(licenseRef, value => {
                if (issuedKey && value?.keySuffix !== issuedKey.slice(-8)) issuedKey = null;
                license = value;
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
            license = null;
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
            const licenseRef = db.collection('cloudLicenses').doc(user.uid);
            const oldProfile = await transaction.get(profileRef);
            const oldLicense = await transaction.get(licenseRef);
            const updated = profileData(user, data, oldProfile.exists ? oldProfile.data().createdAt : null);
            transaction.set(profileRef, updated);
            if (oldLicense.exists && (updated.accountType !== 'company' || oldLicense.data().ico !== updated.ico)) transaction.delete(licenseRef);
            return updated;
        });
        if (generation !== operationGeneration) return;
        if (profile?.ico !== result.ico || result.accountType !== 'company') { license = null; issuedKey = null; }
        profile = result;
        await issueCompanyKey();
        announce();
        fillForm();
    };
    window.ensureCloudAccess = async () => {
        await ready;
        return window.hasCloudAccess();
    };
    window.openAccountPanel = async () => {
        if (!window.getFirebaseUser()) { showWelcomeScreen(); return; }
        byId('userAccountModal').style.display = 'flex';
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
        profile = null; license = null; issuedKey = null; issuing = null;
        feedback();
        if (!user) byId('userAccountModal').style.display = 'none';
        announce();
        ready = user ? load(user, sessionGeneration).catch(() => {
            if (sessionGeneration !== generation) return;
            license = null;
            announce();
            feedback(tr('Údaje účtu nelze načíst. Zkuste to znovu.'), true);
        }) : Promise.resolve();
    });
    document.querySelectorAll('[data-open-account]').forEach(button => button.addEventListener('click', async () => {
        await ready;
        if (window.hasCloudAccess()) await window.openCloudProjects();
        else await window.openAccountPanel();
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
        if (!issuedKey) return;
        try { await navigator.clipboard.writeText(issuedKey); feedback(tr('Klíč byl zkopírován.')); }
        catch { byId('accountCloudKey').focus(); byId('accountCloudKey').select(); }
    });
    byId('btnAccountRotateKey').addEventListener('click', async () => {
        if (!await showAppConfirm(tr('Vygenerovat nový klíč? Předchozí klíč bude nahrazen.'))) return;
        byId('btnAccountRotateKey').disabled = true;
        try { await issueCompanyKey(true); } catch { feedback(tr('Cloudový klíč nelze vydat. Zkuste to znovu.'), true); }
        finally { byId('btnAccountRotateKey').disabled = false; }
    });
    byId('btnAccountCloudProjects').addEventListener('click', async () => {
        if (await window.ensureCloudAccess()) { byId('userAccountModal').style.display = 'none'; await window.openCloudProjects(); }
    });
    byId('btnAccountSignOut').addEventListener('click', async () => {
        try { await (await getFirebaseAuth()).signOut(); }
        catch { feedback(tr('Не удалось выйти из аккаунта'), true); }
    });
    window.addEventListener('goom-language-changed', render);
    render();
})();
