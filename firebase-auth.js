const firebaseSdkUrls = [
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js'
];

let firebaseSdkPromise;
let firebaseServicesPromise;
let firebaseAuthInstance;

const GOOGLE_SIGNIN_HTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5h6.5c3.8-3.5 6.1-8.6 6.1-14.7z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.5-5c-1.8 1.2-4.1 2-7 2-5.3 0-9.8-3.6-11.4-8.4H5.9v5.2C9.3 39.5 16 44 24 44z"/><path fill="#FBBC05" d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18l6.7-5.2z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4 16 4 9.3 8.5 5.9 15l6.7 5.2c1.6-4.8 6.1-8.4 11.4-8.4z"/></svg> Войти или зарегистрироваться с Google`;

function updateGoogleSignInButton(user) {
    const signInButton = document.getElementById('btnGoogleSignIn');
    if (!signInButton) return;
    signInButton.hidden = Boolean(user);
    document.getElementById('btnWelcomeContinue').hidden = !user;
    document.getElementById('googleAuthStatus').style.display = user ? 'flex' : 'none';
    document.getElementById('googleAuthUser').textContent = user
        ? `Вы вошли как ${user.displayName || user.email || 'Google-пользователь'}`
        : '';
    if (user) {
        signInButton.textContent = 'Аккаунт Google подключён';
        signInButton.style.background = '#22c55e';
        signInButton.style.color = '#121214';
    } else {
        signInButton.innerHTML = GOOGLE_SIGNIN_HTML;
        signInButton.style.background = '';
        signInButton.style.color = '';
    }
}

function loadFirebaseScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Не удалось загрузить Firebase SDK: ${url}`));
        document.head.appendChild(script);
    });
}

async function getFirebaseAuth() {
    if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.authDomain ||
        !FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.appId) {
        throw new Error('Сначала заполните веб-конфигурацию Firebase в config.js.');
    }

    if (!firebaseSdkPromise) {
        firebaseSdkPromise = (async () => {
            if (!window.firebase?.initializeApp) await loadFirebaseScript(firebaseSdkUrls[0]);
            if (!window.firebase?.auth) await loadFirebaseScript(firebaseSdkUrls[1]);
            if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
            firebaseAuthInstance = window.firebase.auth();
            window.getFirebaseUser = () => firebaseAuthInstance.currentUser;
            await firebaseAuthInstance.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
            firebaseAuthInstance.onAuthStateChanged(user => {
                updateGoogleSignInButton(user);
                if (!user) {
                    document.getElementById('cloudProjectsModal').style.display = 'none';
                    showWelcomeScreen();
                }
                document.dispatchEvent(new CustomEvent('goom-auth-state-changed', { detail: { user } }));
            });
            return firebaseAuthInstance;
        })().catch(error => {
            firebaseSdkPromise = null;
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

window.getFirebaseServices = getFirebaseServices;

const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
if (btnGoogleSignIn) {
    btnGoogleSignIn.addEventListener('click', async event => {
        const button = event.currentTarget;
        if (firebaseAuthInstance?.currentUser) {
            showWelcomeScreen('projects');
            return;
        }
        button.disabled = true;
        button.textContent = 'Вход выполняется...';
        try {
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                throw new Error('Google-вход доступен только на сайте с HTTPS или localhost. Откройте GOOM по адресу https://pzts.five.surf/.');
            }
            const auth = await getFirebaseAuth();
            await auth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider());
            showWelcomeScreen('projects');
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                console.error('Ошибка входа через Google:', error);
                const guidance = error.code === 'auth/unauthorized-domain'
                    ? 'Добавьте домен сайта в список разрешённых доменов Firebase Authentication.'
                    : error.code === 'auth/operation-not-allowed'
                        ? 'Включите провайдер Google в настройках Firebase Authentication.'
                        : error.message;
                showAppAlert(guidance, 'Не удалось войти через Google');
            }
        } finally {
            button.disabled = false;
            updateGoogleSignInButton(firebaseAuthInstance?.currentUser);
        }
    });
}

updateGoogleSignInButton(null);

const btnGoogleSignOut = document.getElementById('btnGoogleSignOut');
if (btnGoogleSignOut) {
    btnGoogleSignOut.addEventListener('click', async () => {
        try {
            await firebaseAuthInstance?.signOut();
        } catch (error) {
            console.error('Ошибка выхода из Google-аккаунта:', error);
            showAppAlert(error.message, 'Не удалось выйти из аккаунта');
        }
    });
}
