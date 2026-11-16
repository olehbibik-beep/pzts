(() => {
    const byId = id => document.getElementById(id);
    let purchasePending = false;
    let returnHandled = false;
    const pricesInEuro = { monthly: 6.90, annual: 72.86, companyMonthly: 8.90, companyAnnual: 93.98 };
    const buyButtons = [...document.querySelectorAll('[data-buy-tier]')];
    const manageButtons = [...document.querySelectorAll('[data-manage-tier]')];
    const czkPerEuro = 24.425; // Czech National Bank published rate for 2026-11-13.
    function render() {
        const active = Boolean(window.hasProAccess?.());
        byId('accountProStatus').textContent = tr(active ? 'PRO je aktivní.' : 'Váš účet používá bezplatnou verzi.');
        byId('accountProStatus').classList.toggle('active', active);
        const tier = window.getOwnProTier?.();
        for (const button of buyButtons) {
            button.hidden = button.dataset.buyTier === tier;
            button.disabled = purchasePending || Boolean(tier);
        }
        for (const button of manageButtons) button.hidden = button.dataset.manageTier !== tier;
        for (const price of document.querySelectorAll('[data-pro-price]')) {
            const currency = price.dataset.currency;
            const euros = pricesInEuro[price.dataset.proPrice];
            const value = currency === 'CZK' ? Math.round(euros * czkPerEuro) : euros;
            const formatted = new Intl.NumberFormat(getGoomLocale(), { style: 'currency', currency,
                maximumFractionDigits: currency === 'CZK' ? 0 : 2 }).format(value);
            price.textContent = currency === 'CZK' ? '≈ ' + formatted : formatted;
        }
        document.getElementById('btnOpenToolbarMenuEditor').classList.toggle('pro-lock', !active && !window.hasAdminAccess?.());
    }
    window.requestProUpgrade = () => {
        if (!window.getFirebaseUser()) { showWelcomeScreen(); return; }
        byId('proUpgradeModal').style.display = 'flex';
        byId('proPurchaseStatus').textContent = window.hasProAccess?.() ? tr('PRO je aktivní.') : '';
        render(); window.clearGoomTooltips?.();
    };
    byId('btnUpdatePro').addEventListener('click', window.requestProUpgrade);
    byId('btnProClose').addEventListener('click', () => { byId('proUpgradeModal').style.display = 'none'; });
    async function startCheckout(event) {
        if (purchasePending || window.hasOwnPaidPro?.()) return;
        const company = event.currentTarget.dataset.buyTier === 'company';
        if (!window.getFirebaseUser()?.emailVerified) {
            byId('proPurchaseStatus').textContent = tr('Před nákupem potvrďte svou e-mailovou adresu v nastavení účtu.');
            return;
        }
        if (company && !window.isGoomCompanyAccount?.()) {
            byId('proPurchaseStatus').textContent = tr('Pro nákup firemního PRO potřebujete firemní účet.');
            return;
        }
        const annual = document.querySelector('input[name="proPeriod"]:checked').value === 'annual';
        const offer = company ? (annual ? 'companyAnnual' : 'companyMonthly') : (annual ? 'annual' : 'monthly');
        purchasePending = true;
        render();
        byId('proPurchaseStatus').textContent = tr('Připravujeme zabezpečenou platbu…');
        try {
            const result = await window.callProBilling('createProCheckout', { offer, application: APP_PRODUCT });
            const url = new URL(result.url);
            if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Invalid checkout URL');
            window.location.assign(url.href);
        } catch (error) {
            byId('proPurchaseStatus').textContent = tr(error.code?.includes('already-exists')
                ? 'Máte již předplatné. Spravujte je v uživatelském účtu.'
                : 'Platbu nyní nelze otevřít. Zkuste to později.');
        } finally { purchasePending = false; render(); }
    }
    for (const button of buyButtons) button.addEventListener('click', startCheckout);
    for (const button of manageButtons) button.addEventListener('click', () => {
        byId('proUpgradeModal').style.display = 'none';
        byId('btnManageSubscription').click();
    });
    async function handleReturn() {
        const params = new URLSearchParams(location.search);
        if (returnHandled || !params.has('checkout') || !window.getFirebaseUser()) return;
        returnHandled = true;
        await window.openAccountPanel();
        let returnMessage = '';
        if (params.get('checkout') === 'success' && params.get('session_id')) {
            returnMessage = 'Ověřujeme platbu. PRO se aktivuje po potvrzení úhrady.';
            byId('accountProStatus').textContent = tr('Ověřujeme platbu. PRO se aktivuje po potvrzení úhrady.');
            try {
                await window.callProBilling('confirmProCheckout', { sessionId: params.get('session_id') });
                await window.refreshUserAccount();
            } catch { byId('accountProStatus').textContent = tr('Ověřujeme platbu. PRO se aktivuje po potvrzení úhrady.'); }
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
