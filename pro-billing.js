(() => {
    const byId = id => document.getElementById(id);
    let purchasePending = false;
    let returnHandled = false;
    function render() {
        const active = Boolean(window.hasProAccess?.());
        byId('accountProStatus').textContent = tr(active ? 'PRO je aktivní.' : 'Váš účet používá bezplatnou verzi.');
        byId('accountProStatus').classList.toggle('active', active);
        byId('btnUpdatePro').hidden = active;
        byId('btnProPurchase').hidden = active;
        document.getElementById('btnOpenToolbarMenuEditor').classList.toggle('pro-lock', !active);
        if (active) byId('proPurchaseStatus').textContent = tr('PRO je aktivní.');
    }
    window.requestProUpgrade = () => {
        if (!window.getFirebaseUser()) { showWelcomeScreen(); return; }
        byId('proUpgradeModal').style.display = 'flex';
        byId('proPurchaseStatus').textContent = tr('Cena a podmínky se zobrazí na zabezpečené platební stránce.');
        render(); window.clearGoomTooltips?.();
    };
    byId('btnUpdatePro').addEventListener('click', window.requestProUpgrade);
    byId('btnProClose').addEventListener('click', () => { byId('proUpgradeModal').style.display = 'none'; });
    byId('btnProPurchase').addEventListener('click', async () => {
        if (purchasePending) return;
        if (!window.getFirebaseUser()?.emailVerified) {
            byId('proPurchaseStatus').textContent = tr('Před nákupem potvrďte svou e-mailovou adresu v nastavení účtu.');
            return;
        }
        purchasePending = true; byId('btnProPurchase').disabled = true;
        byId('proPurchaseStatus').textContent = tr('Připravujeme zabezpečenou platbu…');
        try {
            const result = await window.callProBilling('createProCheckout', { offer: document.querySelector('input[name="proOffer"]:checked').value, application: APP_PRODUCT });
            const url = new URL(result.url);
            if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Invalid checkout URL');
            window.location.assign(url.href);
        } catch (error) {
            byId('proPurchaseStatus').textContent = tr(error.code?.includes('already-exists')
                ? 'Máte již předplatné. Spravujte je v uživatelském účtu.'
                : 'Platbu nyní nelze otevřít. Zkuste to později.');
        } finally { purchasePending = false; byId('btnProPurchase').disabled = false; }
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
