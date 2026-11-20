(() => {
    // Change this version whenever publishing application files together.
    const version = '20261120-toolbar-3';
    let started = false;
    let pdfLoading = null;
    let pdfAttempt = 0;
    const pdfBase = new URL('vendor/pdfjs/', document.baseURI);
    window.ensurePlanPdfLibrary = () => {
        if (window.pdfjsLib?.getDocument) return Promise.resolve(window.pdfjsLib);
        if (!pdfLoading) {
            // Use .js for ES modules too: static hosts already serve it as JavaScript.
            // A fresh URL lets an upload or connection repair recover without reloading the editor.
            const retry = pdfAttempt++;
            pdfLoading = import(new URL(`legacy/build/pdf.min.js?v=${version}&attempt=${retry}`, pdfBase)).then(pdf => {
                pdf.GlobalWorkerOptions.workerSrc = new URL(`legacy/build/pdf.worker.min.js?v=${version}`, pdfBase).href;
                window.pdfjsLib = pdf;
                return pdf;
            }).catch(error => {
                pdfLoading = null;
                console.warn('PDF library:', error);
                throw new Error(tr('Knihovnu PDF nelze načíst. Obnovte stránku a zkuste to znovu.'));
            });
        }
        return pdfLoading;
    };
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
        const startup = document.getElementById('startupLoading');
        const subscription = new AbortController();
        const firstSession = new Promise(resolve => {
            document.addEventListener('goom-auth-state-changed', resolve, { once: true, signal: subscription.signal });
        });
        try {
            // Import/export libraries must not delay the welcome screen or run on phones.
            const libraries = [
                window.ensurePlanPdfLibrary(),
                ...(!window.isGoomReadOnly?.() ? [
                    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
                    loadScript('https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/dxf-parser.min.js')
                ] : [])
            ].map(promise => promise.catch(error => console.warn('Библиотека импорта/экспорта недоступна:', error)));
            window.planLibrariesReady = Promise.all(libraries);
            for (const name of ['modal-ui', 'busy-ui', 'config', 'state', 'project-legend', 'engine', 'storage', 'dialogs', 'render', 'map-contours', 'plan-renderer', 'render-performance', 'mobile-viewer', 'editor-interactions', 'editor-session', 'building-overview', 'svg-context', 'dxf-context', 'plan-export', 'app', 'satellite-map', 'photo-plan', 'experience-i18n', 'guide-steps', 'onboarding', 'help-guide', 'project-readiness', 'idle-break', 'firebase-auth', 'project-activity', 'editor-usage', 'account-experience', 'account-profile', 'pro-billing', 'firebase-sync', 'icon-editor', 'toolbar-menus', 'select-controls', 'tablet-tools', 'feedback', 'welcome-intro']) {
                if (name === 'state' && window.goomProduct === 'CCTV') await loadScript(`cctv.js?v=${version}`);
                await loadScript(`${name}.js?v=${version}`);
            }
            const editorReady = firstSession.then(() => Promise.all([window.localProjectStartup, window.initialEditorResume]));
            await withFirebaseTimeout(FIREBASE_CONFIG.apiKey ? editorReady : window.localProjectStartup).catch(() => {});
            await new Promise(requestAnimationFrame);
        } catch (error) {
            document.getElementById('googleAuthMessage').hidden = false;
            document.getElementById('googleAuthMessage').textContent = error.message;
        } finally {
            subscription.abort();
            startup.hidden = true;
        }
    }
    window.addEventListener('goom-device-support-changed', start);
    start();
})();
