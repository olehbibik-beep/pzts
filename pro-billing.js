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
        byId('accountProStatus').textContent = tr(active ? 'PROJECT je aktivní.' : 'Váš účet používá bezplatnou verzi.');
        byId('accountProStatus').classList.toggle('active', active);
        const tier = window.getOwnProTier?.();
        for (const button of buyButtons) {
            button.hidden = active || APP_PRODUCT === 'CCTV';
            button.disabled = purchasePending || active;
        }
        const basicAction=document.querySelector('.pro-plan-basic .pro-plan-action');if(basicAction)basicAction.textContent=tr(active?'Základní':'Aktivní');
        for(const card of document.querySelectorAll('.pro-plan-standard,.pro-plan-company')){let badge=card.querySelector('.pro-entitlement-active');if(!badge){badge=document.createElement('div');badge.className='pro-entitlement-active';card.querySelector('.pro-plan-actions').append(badge);}badge.textContent=tr('PROJECT je aktivní.');badge.hidden=!active||(tier==='company'?card.classList.contains('pro-plan-standard'):card.classList.contains('pro-plan-company'));}
        byId('btnUpdatePro').textContent=tr(active?'PROJECT je aktivní.':'Ceník PROJECT');
        for (const button of manageButtons) button.hidden = button.dataset.manageTier !== tier;
        for (const price of document.querySelectorAll('[data-pro-price]')) {
            const currency = price.dataset.currency;
            const euros = pricesInEuro[price.dataset.proPrice];
            const value = currency === 'CZK' ? Math.round(euros * czkPerEuro) : euros;
            const formatted = new Intl.NumberFormat(getGoomLocale(), { style: 'currency', currency,
                maximumFractionDigits: currency === 'CZK' ? 0 : 2 }).format(value);
            price.textContent = formatted;
        }
        document.getElementById('btnOpenToolbarMenuEditor').classList.toggle('pro-lock', !active && !window.hasAdminAccess?.());
    }
    window.openProjectUpgrade = () => {
        hideUpgradeHint();
        if (!window.getFirebaseUser()) { showWelcomeScreen(); return; }
        byId('proUpgradeModal').style.display = 'flex';
        byId('proPurchaseStatus').textContent = window.hasProAccess?.() ? tr('PROJECT je aktivní.')
            : APP_PRODUCT === 'CCTV' ? tr('Předplatné CCTV zatím nelze zakoupit.') : '';
        render(); window.clearGoomTooltips?.();
    };
    const hint=document.createElement('div');hint.id='projectUpgradeHint';hint.hidden=true;hint.setAttribute('role','status');
    hint.innerHTML='<button type="button" id="projectUpgradeAction"><span>UPGRADE</span><strong>PROJECT</strong></button><button type="button" id="projectUpgradeDismiss" aria-label="'+tr('Zavřít')+'">×</button>';
    document.body.append(hint);let hintTimer;
    function hideUpgradeHint(){clearTimeout(hintTimer);hint.hidden=true;}
    function scheduleHide(){clearTimeout(hintTimer);hintTimer=setTimeout(hideUpgradeHint,8000);}
    window.requestProUpgrade=()=>{window.clearGoomTooltips?.();hint.hidden=false;hint.getAnimations().forEach(a=>a.cancel());
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches)hint.animate([{transform:'translate(-50%,30px)',opacity:0},{transform:'translate(-50%,0)',opacity:1}],{duration:220,easing:'ease-out'});
        scheduleHide();};
    hint.addEventListener('mouseenter',()=>clearTimeout(hintTimer));hint.addEventListener('mouseleave',scheduleHide);
    hint.addEventListener('focusin',()=>clearTimeout(hintTimer));hint.addEventListener('focusout',scheduleHide);
    byId('projectUpgradeAction').onclick=window.openProjectUpgrade;byId('projectUpgradeDismiss').onclick=hideUpgradeHint;
    document.addEventListener('goom-account-changed',hideUpgradeHint);
    byId('btnUpdatePro').addEventListener('click', window.openProjectUpgrade);
    byId('btnProClose').addEventListener('click', () => { byId('proUpgradeModal').style.display = 'none'; });
    async function startCheckout(event) {
        if (APP_PRODUCT === 'CCTV' || purchasePending || window.hasProAccess?.()) return;
        const company = event.currentTarget.dataset.buyTier === 'company';
        if (!window.getFirebaseUser()?.emailVerified) {
            byId('proPurchaseStatus').textContent = tr('Před nákupem potvrďte svou e-mailovou adresu v nastavení účtu.');
            return;
        }
        if (company && !window.isGoomCompanyAccount?.()) {
            byId('proPurchaseStatus').textContent = tr('Pro nákup firemního PROJECT potřebujete firemní účet.');
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
