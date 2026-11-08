const firebaseSdkUrls = [
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js'
];

let firebaseSdkPromise;
let firebaseServicesPromise;
let firebaseAuthInstance;
let firebaseAuthReadyPromise;
let verifiedFirebaseUser = null;
let pendingAuthCheck = null;
let authCheckGeneration = 0;

window.getFirebaseUser = () => verifiedFirebaseUser && firebaseAuthInstance?.currentUser?.uid === verifiedFirebaseUser.uid
    ? verifiedFirebaseUser : null;

const GOOGLE_SIGNIN_HTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5h6.5c3.8-3.5 6.1-8.6 6.1-14.7z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.5-5c-1.8 1.2-4.1 2-7 2-5.3 0-9.8-3.6-11.4-8.4H5.9v5.2C9.3 39.5 16 44 24 44z"/><path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18l6.7-5.2z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4 16 4 9.3 8.5 5.9 15l6.7 5.2c1.6-4.8 6.1-8.4 11.4-8.4z"/></svg> Войти или зарегистрироваться с Google`;

function updateGoogleSignInButton(user, message = '', checking = false) {
    const signInButton = document.getElementById('btnGoogleSignIn');
    if (!signInButton) return;
    signInButton.hidden = Boolean(user);
    signInButton.style.display = user ? 'none' : 'flex';
    signInButton.disabled = checking;
    signInButton.innerHTML = checking ? tr('Проверяем вход…') : GOOGLE_SIGNIN_HTML;
    document.getElementById('btnWelcomeContinue').hidden = !user;
    document.getElementById('btnWelcomeProfile').hidden = !user;
    document.getElementById('welcomeEmailActions').hidden = Boolean(user);
    document.querySelectorAll('#welcomeEmailActions button').forEach(button => { button.disabled = checking; });
    document.getElementById('googleAuthStatus').style.display = user ? 'flex' : 'none';
    document.getElementById('googleAuthUser').textContent = user
        ? tr`Вы вошли как ${user.displayName || user.email || tr('Google-пользователь')}`
        : '';
    const feedback = document.getElementById('googleAuthMessage');
    feedback.textContent = message;
    feedback.hidden = !message;
    feedback.dataset.state = checking ? 'checking' : 'error';
}

function withFirebaseTimeout(promise) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(tr('Проверка входа заняла слишком много времени. Проверьте интернет и попробуйте снова.'))), 12000); })
    ]).finally(() => clearTimeout(timer));
}

function publishFirebaseSession(user, message = '') {
    verifiedFirebaseUser = user;
    updateGoogleSignInButton(user, message);
    if (!user) {
        document.getElementById('cloudProjectsModal').style.display = 'none';
        showWelcomeScreen();
    }
    document.dispatchEvent(new CustomEvent('goom-auth-state-changed', { detail: { user } }));
}

function verifyFirebaseSession(user) {
    if (pendingAuthCheck?.user === user) return pendingAuthCheck.promise;
    const generation = ++authCheckGeneration;
    verifiedFirebaseUser = null;
    if (!user) {
        pendingAuthCheck = null;
        publishFirebaseSession(null);
        return Promise.resolve(null);
    }
    updateGoogleSignInButton(null, tr('Проверяем сохранённую сессию…'), true);
    const check = { user };
    check.promise = (async () => {
        try {
            await withFirebaseTimeout((async () => {
                await user.reload();
                await user.getIdToken(true);
            })());
            if (generation !== authCheckGeneration || firebaseAuthInstance.currentUser?.uid !== user.uid) return null;
            publishFirebaseSession(firebaseAuthInstance.currentUser);
            return verifiedFirebaseUser;
        } catch (error) {
            if (generation !== authCheckGeneration) return null;
            const expired = ['auth/user-disabled', 'auth/user-not-found', 'auth/user-token-expired', 'auth/invalid-user-token'].includes(error.code);
            if (expired) await firebaseAuthInstance.signOut();
            publishFirebaseSession(null, expired
                ? tr('Сессия истекла. Войдите в аккаунт снова.')
                : tr('Не удалось проверить вход. Проверьте подключение и войдите снова.'));
            return null;
        } finally {
            if (pendingAuthCheck === check) pendingAuthCheck = null;
        }
    })();
    pendingAuthCheck = check;
    return check.promise;
}

window.ensureFirebaseSession = async () => {
    try {
        const auth = await getFirebaseAuth();
        await withFirebaseTimeout(firebaseAuthReadyPromise);
        return await verifyFirebaseSession(auth.currentUser);
    } catch (error) {
        publishFirebaseSession(null, error.message);
        return null;
    }
};

function loadFirebaseScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        const timer = setTimeout(() => { script.remove(); reject(new Error(tr('Не удалось загрузить сервис входа. Проверьте подключение и попробуйте снова.'))); }, 12000);
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => { clearTimeout(timer); reject(new Error(tr('Не удалось загрузить сервис входа. Проверьте подключение и попробуйте снова.'))); };
        document.head.appendChild(script);
    });
}

async function getFirebaseAuth() {
    if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.authDomain ||
        !FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.appId) {
        throw new Error(tr('Сначала заполните веб-конфигурацию Firebase в config.js.'));
    }

    if (!firebaseSdkPromise) {
        firebaseSdkPromise = (async () => {
            if (!window.firebase?.initializeApp) await loadFirebaseScript(firebaseSdkUrls[0]);
            if (!window.firebase?.auth) await loadFirebaseScript(firebaseSdkUrls[1]);
            if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
            firebaseAuthInstance = window.firebase.auth();
            await firebaseAuthInstance.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
            firebaseAuthReadyPromise = new Promise(resolve => {
                firebaseAuthInstance.onAuthStateChanged(user => {
                    verifyFirebaseSession(user).then(resolve).catch(error => {
                        publishFirebaseSession(null, error.message);
                        resolve(null);
                    });
                }, error => {
                    publishFirebaseSession(null, error.message);
                    resolve(null);
                });
            });
            return firebaseAuthInstance;
        })().catch(error => {
            firebaseSdkPromise = null;
            publishFirebaseSession(null, error.message);
            throw error;
        });
    }
    return firebaseSdkPromise;
}

async function getFirebaseServices() {
    if (!firebaseServicesPromise) {
        firebaseServicesPromise = (async () => {
            const auth = await getFirebaseAuth();
            if (!window.firebase.firestore) await loadFirebaseScript(firebaseSdkUrls[2]);
            if (!window.firebase.storage) await loadFirebaseScript(firebaseSdkUrls[3]);
            return {
                auth,
                firestore: window.firebase.firestore(),
                storage: window.firebase.storage()
            };
        })().catch(error => {
            firebaseServicesPromise = null;
            throw error;
        });
    }
    return firebaseServicesPromise;
}

window.getFirebaseDatabase = async () => {
    await getFirebaseAuth();
    if (!window.firebase.firestore) await loadFirebaseScript(firebaseSdkUrls[2]);
    return window.firebase.firestore();
};

window.getFirebaseServices = getFirebaseServices;

const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
if (btnGoogleSignIn) {
    btnGoogleSignIn.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = tr('Вход выполняется...');
        try {
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                throw new Error(tr('Google-вход доступен только на сайте с HTTPS или localhost. Откройте GOOM по адресу https://pzts.five.surf/.'));
            }
            const auth = await getFirebaseAuth();
            const provider = new window.firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            await auth.signInWithPopup(provider);
            if (await verifyFirebaseSession(auth.currentUser)) showWelcomeScreen('projects');
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Ошибка входа через Google:', error);
                const guidance = error.code === 'auth/unauthorized-domain'
                    ? tr('Добавьте домен сайта в список разрешённых доменов Firebase Authentication.')
                    : error.code === 'auth/operation-not-allowed'
                        ? tr('Включите провайдер Google в настройках Firebase Authentication.')
                        : error.message;
                showAppAlert(guidance, tr('Не удалось войти через Google'));
            }
        } finally {
            button.disabled = false;
            if (!pendingAuthCheck) updateGoogleSignInButton(window.getFirebaseUser(), document.getElementById('googleAuthMessage').textContent);
        }
    });
}

updateGoogleSignInButton(null, tr('Подключаем сервис входа…'), true);

const btnGoogleSignOut = document.getElementById('btnGoogleSignOut');
if (btnGoogleSignOut) {
    btnGoogleSignOut.addEventListener('click', async () => {
        try {
            await firebaseAuthInstance?.signOut();
        } catch (error) {
            console.error('Ошибка выхода из Google-аккаунта:', error);
            showAppAlert(error.message, tr('Не удалось выйти из аккаунта'));
        }
    });
}

function emailAuthError(error) {
    const messages = {
        'auth/email-already-in-use': 'Tato e-mailová adresa již má účet. Přihlaste se nebo obnovte heslo.',
        'auth/invalid-email': 'Zadejte platnou e-mailovou adresu.',
        'auth/weak-password': 'Heslo musí mít alespoň 8 znaků.',
        'auth/invalid-credential': 'Nesprávný e-mail nebo heslo.',
        'auth/wrong-password': 'Nesprávný e-mail nebo heslo.',
        'auth/user-not-found': 'Nesprávný e-mail nebo heslo.',
        'auth/operation-not-allowed': 'Přihlášení e-mailem není ve Firebase povoleno.',
        'auth/too-many-requests': 'Příliš mnoho pokusů. Zkuste to později.',
        'auth/network-request-failed': 'Zkontrolujte připojení k internetu.'
    };
    return tr(messages[error.code] || 'Přihlášení se nezdařilo');
}

function setEmailAuthMode(mode) {
    const register = mode === 'register';
    document.getElementById('emailAuthForm').dataset.mode = register ? 'register' : 'login';
    document.getElementById('emailAuthTitle').textContent = tr(register ? 'Registrace' : 'Přihlášení');
    document.getElementById('btnEmailAuthSubmit').textContent = tr(register ? 'Registrovat' : 'Přihlásit se');
    for (const id of ['emailNameField', 'emailConfirmField', 'emailTypeField', 'emailRegistrationHelp']) document.getElementById(id).hidden = !register;
    document.getElementById('emailDisplayName').required = register;
    document.getElementById('emailAuthConfirm').required = register;
    document.getElementById('emailAuthPassword').minLength = register ? 8 : 1;
    document.getElementById('emailAuthPassword').autocomplete = register ? 'new-password' : 'current-password';
    document.getElementById('emailAuthPassword').value = '';
    document.getElementById('emailAuthConfirm').value = '';
    document.getElementById('btnEmailResetPassword').hidden = register;
    document.getElementById('emailAuthFeedback').hidden = true;
    updateEmailCompanyFields();
    showWelcomeScreen('email');
}
function updateEmailCompanyFields() {
    const company = document.getElementById('emailAuthForm').dataset.mode === 'register' && document.getElementById('emailAccountType').value === 'company';
    document.getElementById('emailIcoField').hidden = !company;
    document.getElementById('emailCompanyHelp').hidden = !company;
    document.getElementById('emailCompanyIco').required = company;
}
document.getElementById('btnEmailSignIn').addEventListener('click', () => setEmailAuthMode('login'));
document.getElementById('btnEmailRegister').addEventListener('click', () => setEmailAuthMode('register'));
document.getElementById('emailAccountType').addEventListener('change', updateEmailCompanyFields);
document.getElementById('emailAuthForm').addEventListener('submit', async event => {
    event.preventDefault();
    const register = event.currentTarget.dataset.mode === 'register';
    const email = document.getElementById('emailAuthEmail').value.trim();
    const password = document.getElementById('emailAuthPassword').value;
    const accountType = document.getElementById('emailAccountType').value;
    const ico = document.getElementById('emailCompanyIco').value.trim();
    const feedback = document.getElementById('emailAuthFeedback');
    const submit = document.getElementById('btnEmailAuthSubmit');
    feedback.hidden = true;
    if (register && password !== document.getElementById('emailAuthConfirm').value) {
        feedback.textContent = tr('Hesla se neshodují.'); feedback.hidden = false; return;
    }
    if (register && accountType === 'company' && !window.isValidCompanyIco(ico)) {
        feedback.textContent = tr('Zadejte platné osmimístné IČO.'); feedback.hidden = false; return;
    }
    submit.disabled = true;
    let accountCreated = false;
    try {
        const auth = await getFirebaseAuth();
        auth.languageCode = window.getGoomLanguage();
        if (register) {
            window.pendingAccountRegistration = { email, displayName: document.getElementById('emailDisplayName').value.trim(), accountType, ico };
            const credential = await auth.createUserWithEmailAndPassword(email, password);
            accountCreated = true;
            await credential.user.updateProfile({ displayName: window.pendingAccountRegistration.displayName });
            if (!await verifyFirebaseSession(auth.currentUser)) return;
            await window.saveAccountProfile(window.pendingAccountRegistration);
            try { await credential.user.sendEmailVerification(); }
            catch { showAppAlert(tr('Ověření e-mailu se nepodařilo odeslat. Zkuste to z nastavení účtu.')); }
        } else {
            await auth.signInWithEmailAndPassword(email, password);
            if (!await verifyFirebaseSession(auth.currentUser)) return;
        }
        document.getElementById('emailAuthPassword').value = '';
        document.getElementById('emailAuthConfirm').value = '';
        showWelcomeScreen('projects');
        if (register) await window.openAccountPanel();
    } catch (error) {
        if (accountCreated) {
            showWelcomeScreen('auth');
            await window.openAccountPanel();
            showAppAlert(tr('Účet je založen, ale údaje se nepodařilo uložit. Doplňte je v nastavení účtu.'));
        } else { feedback.textContent = emailAuthError(error); feedback.hidden = false; }
    } finally {
        window.pendingAccountRegistration = null;
        submit.disabled = false;
    }
});
document.getElementById('btnEmailResetPassword').addEventListener('click', async () => {
    const email = document.getElementById('emailAuthEmail').value.trim();
    const feedback = document.getElementById('emailAuthFeedback');
    if (!email || !document.getElementById('emailAuthEmail').checkValidity()) {
        feedback.textContent = tr('Zadejte platnou e-mailovou adresu.'); feedback.hidden = false; return;
    }
    try {
        const auth = await getFirebaseAuth();
        auth.languageCode = window.getGoomLanguage();
        await auth.sendPasswordResetEmail(email);
        feedback.textContent = tr('Pokud účet existuje, obdržíte e-mail pro obnovení hesla.');
    } catch (error) {
        feedback.textContent = error.code === 'auth/user-not-found'
            ? tr('Pokud účet existuje, obdržíte e-mail pro obnovení hesla.') : emailAuthError(error);
    }
    feedback.hidden = false;
});
window.addEventListener('goom-language-changed', () => {
    const feedback = document.getElementById('googleAuthMessage');
    updateGoogleSignInButton(window.getFirebaseUser(), tr(feedback.textContent), document.getElementById('btnGoogleSignIn').disabled);
});
