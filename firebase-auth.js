const firebaseSdkUrls = [
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js'
];

let firebaseSdkPromise;
let firebaseServicesPromise;
let firebaseAuthInstance;

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
            await firebaseAuthInstance.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
            firebaseAuthInstance.onAuthStateChanged(user => {
                const status = document.getElementById('googleAuthStatus');
                const userLabel = document.getElementById('googleAuthUser');
                const signInButton = document.getElementById('btnGoogleSignIn');
                if (status) status.style.display = user ? 'flex' : 'none';
                if (userLabel) userLabel.textContent = user ? `Вы вошли как ${user.displayName || user.email || 'Google-пользователь'}` : '';
                if (signInButton) signInButton.textContent = user ? 'Аккаунт Google подключён' : 'Войти или зарегистрироваться с Google';
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

document.getElementById('btnGoogleSignIn').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            throw new Error('Google-вход доступен только на сайте с HTTPS. Откройте GOOM по адресу https://pzts.five.surf/.');
        }
        const auth = await getFirebaseAuth();
        await auth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider());
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
    }
});

document.getElementById('btnGoogleSignOut').addEventListener('click', async () => {
    try {
        await firebaseAuthInstance?.signOut();
    } catch (error) {
        console.error('Ошибка выхода из Google-аккаунта:', error);
        showAppAlert(error.message, 'Не удалось выйти из аккаунта');
    }
});
