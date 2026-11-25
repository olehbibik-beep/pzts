(() => {
    const byId = id => document.getElementById(id);
    const pricing = byId('btnUpdatePro');
    let returnHandled = false;

    function render() {
        const active = Boolean(window.hasProAccess?.());
        const administrative = Boolean(window.hasAdminAccess?.());
        const tier = window.getOwnProTier?.() === 'company' ? 'Team' : 'Pro';
        document.querySelector('.pro-card h3').textContent = window.goomUI('Předplatné', 'Subscription', 'Abonnement', 'Подписка', 'Subskrypcja') + ' ' + tier;
        const status = byId('accountProStatus');
        status.textContent = administrative
            ? window.goomUI('Administrátor: plný přístup ke všem funkcím.', 'Administrator: full access to all features.', 'Administrator: voller Zugriff auf alle Funktionen.', 'Администратор: полный доступ ко всем функциям.', 'Administrator: pełny dostęp do funkcji.')
            : active ? tier + ' · ' + tr('Aktivní') : tr('Váš účet používá bezplatnou verzi.');
        status.classList.toggle('active', active);
        pricing.href = 'https://goom.cz/?lang=' + encodeURIComponent(getGoomLanguage()) + '#pricing';
        pricing.textContent = window.goomUI('Zobrazit tarify', 'View plans', 'Tarife ansehen', 'Смотреть тарифы', 'Zobacz plany');
        const guide = byId('goomGuideLink');
        guide.href = getGoomLanguage() === 'ru' ? 'https://goom.cz/guide/ru/' : 'https://goom.cz/guide/';
        guide.textContent = window.goomUI('Příručka', 'Guide', 'Handbuch', 'Справочник', 'Instrukcja');
        byId('btnOpenToolbarMenuEditor').classList.toggle('pro-lock', !active);
    }

    window.openProjectUpgrade = () => {
        hideUpgradeHint();
        const link = document.createElement('a');
        link.href = pricing.href;
        link.target = '_blank';
        link.rel = 'noopener';
        link.click();
    };

    const hint = document.createElement('div');
    hint.id = 'projectUpgradeHint';
    hint.hidden = true;
    hint.setAttribute('role', 'status');
    hint.innerHTML = '<button type="button" id="projectUpgradeAction"><span>UPGRADE</span><strong>Pro</strong></button><button type="button" id="projectUpgradeDismiss">×</button>';
    document.body.append(hint);
    let hintTimer;
    function hideUpgradeHint() {
        clearTimeout(hintTimer);
        hint.hidden = true;
    }
    window.requestProUpgrade = () => {
        if (window.hasProAccess?.()) return;
        window.clearGoomTooltips?.();
        clearTimeout(hintTimer);
        hint.hidden = false;
        hintTimer = setTimeout(hideUpgradeHint, 5000);
    };
    byId('projectUpgradeAction').onclick = window.openProjectUpgrade;
    byId('projectUpgradeDismiss').onclick = hideUpgradeHint;
    byId('projectUpgradeDismiss').setAttribute('aria-label', tr('Zavřít'));
    document.addEventListener('pointerdown', event => { if (!hint.contains(event.target)) hideUpgradeHint(); }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hideUpgradeHint(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) hideUpgradeHint(); });
    document.addEventListener('goom-account-changed', hideUpgradeHint);
    async function handleReturn() {
        const params = new URLSearchParams(location.search);
        if (returnHandled || !params.has('checkout') || !window.getFirebaseUser()) return;
        returnHandled = true;
        await window.openAccountPanel();
        let returnMessage = '';
        if (params.get('checkout') === 'success' && params.get('session_id')) {
            returnMessage = 'Ověřujeme platbu. PROJECT se aktivuje po potvrzení úhrady.';
            byId('accountProStatus').textContent = tr('Ověřujeme platbu. PROJECT se aktivuje po potvrzení úhrady.');
            try {
                await window.callProBilling('confirmProCheckout', { sessionId: params.get('session_id') });
                await window.refreshUserAccount();
            } catch { byId('accountProStatus').textContent = tr('Ověřujeme platbu. PROJECT se aktivuje po potvrzení úhrady.'); }
        } else returnMessage = 'Platba byla zrušena. Váš účet zůstává beze změny.';
        const clean = new URL(location.href);
        clean.searchParams.delete('checkout'); clean.searchParams.delete('session_id');
        history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
        render();
        if (!window.hasProAccess?.() && returnMessage) byId('accountProStatus').textContent = tr(returnMessage);
    }
    document.addEventListener('goom-account-changed', () => { render(); handleReturn(); });
    window.addEventListener('goom-language-changed', render);
    render();
})();
