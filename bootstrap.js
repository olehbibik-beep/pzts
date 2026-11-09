(() => {
    // Change this version whenever publishing application files together.
    const version = '20261109-floors-17';
    let started = false;
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timer = setTimeout(() => {
                script.remove();
                reject(new Error(tr('Не удалось загрузить приложение. Обновите страницу и попробуйте снова.')));
            }, 12000);
            script.src = src;
            script.onload = () => { clearTimeout(timer); resolve(); };
            script.onerror = () => { clearTimeout(timer); reject(new Error(tr('Не удалось загрузить приложение. Обновите страницу и попробуйте снова.'))); };
            document.body.appendChild(script);
        });
    }

    async function start() {
        if (started || !window.isGoomDeviceSupported()) return;
        started = true;
        try {
            // Import/export libraries must not delay the welcome screen or run on phones.
            const libraries = [
                loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js').then(() => {
                    if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                }),
                loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
                loadScript('https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/dxf-parser.min.js')
            ].map(promise => promise.catch(error => console.warn('Библиотека импорта/экспорта недоступна:', error)));
            window.planLibrariesReady = Promise.all(libraries);
            for (const name of ['modal-ui', 'config', 'state', 'engine', 'storage', 'dialogs', 'render', 'plan-renderer', 'render-performance', 'building-overview', 'svg-context', 'plan-export', 'app', 'onboarding', 'firebase-auth', 'account-profile', 'pro-billing', 'firebase-sync', 'icon-editor', 'toolbar-menus', 'select-controls', 'tablet-tools']) {
                await loadScript(`${name}.js?v=${version}`);
            }
            await Promise.all(libraries);
        } catch (error) {
            document.getElementById('googleAuthMessage').hidden = false;
            document.getElementById('googleAuthMessage').textContent = error.message;
        }
    }
    window.addEventListener('goom-device-support-changed', start);
    start();
})();
