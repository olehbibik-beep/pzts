// Shared decorative background and motion. No layout changes or artificial loading delays.
(() => {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const svgMarkup = `<svg class="modal-blueprint welcome-blueprint" viewBox="0 0 520 580" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path class="blueprint-flow" pathLength="1" d="M-24 100H152Q176 100 176 124V206H436"></path>
        <path class="blueprint-flow blueprint-secondary" pathLength="1" d="M-16 472H260V332H440"></path>
        <path class="blueprint-trace" pathLength="1" d="M54 32V226H358M72 264H210V522H386"></path>
        <circle class="blueprint-circle" pathLength="1" cx="130" cy="372" r="72"></circle>
        <circle class="blueprint-circle blueprint-secondary" pathLength="1" cx="350" cy="156" r="46"></circle>
        <circle class="blueprint-circle blueprint-detail" pathLength="1" cx="274" cy="446" r="28"></circle>
    </svg>`;
    window.attachModalBlueprint = container => {
        if (!container || container.querySelector(':scope > .modal-blueprint-host')) return;
        const host = document.createElement('div');
        host.className = 'modal-blueprint-host'; host.setAttribute('aria-hidden', 'true');
        host.innerHTML = svgMarkup;
        container.prepend(host);
    };
    document.querySelectorAll('.modal-content:not(.welcome-card), .app-dialog-card').forEach(window.attachModalBlueprint);
    window.attachModalBlueprint(document.querySelector('.welcome-art-space'));

    const roots = [...document.querySelectorAll('.modal, .app-dialog-backdrop, #overviewScreen')];
    function sync(root) {
        const open = !root.hidden && (root.classList.contains('app-dialog-backdrop')
            ? root.style.display !== 'none' : ['flex','block','grid'].includes(root.style.display));
        root.dataset.modalOpen = String(open);
    }
    roots.forEach(root => { root.classList.add('motion-surface'); sync(root); });
    let contentAnimation;
    const welcomeContent = document.querySelector('.welcome-step-content');
    function fadeWelcomeContent() {
        if (reducedMotion.matches || document.getElementById('welcomeModal').dataset.modalOpen !== 'true') return;
        const from = contentAnimation?.playState === 'running' ? Number(getComputedStyle(welcomeContent).opacity) : .25;
        contentAnimation?.cancel();
        contentAnimation = welcomeContent.animate([{ opacity: from }, { opacity: 1 }], {
            duration: 180, easing: 'cubic-bezier(.22,.61,.36,1)'
        });
    }
    new MutationObserver(records => {
        let welcomeChanged = false;
        for (const record of records) {
            if (roots.includes(record.target)) sync(record.target);
            if ((record.target.id === 'welcomeModal' && record.attributeName === 'data-step')
                || (record.target.id === 'emailAuthForm' && record.attributeName === 'data-mode')) welcomeChanged = true;
        }
        if (welcomeChanged) fadeWelcomeContent();
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style','hidden','data-step','data-mode'] });
    const welcome = document.getElementById('welcomeModal');
    const image = welcome.querySelector('.welcome-art-space img');
    async function revealImage() {
        try { await image.decode(); } catch { /* Keep account controls available if artwork cannot load. */ }
        welcome.classList.remove('is-art-loading');
    }
    if (image.complete) revealImage();
    else { image.addEventListener('load', revealImage, { once: true }); image.addEventListener('error', revealImage, { once: true }); }

    window.dismissGoomPopup = popup => {
        if (reducedMotion.matches) { popup.remove(); return; }
        const ghost = popup.cloneNode(true);
        ghost.removeAttribute('id'); ghost.removeAttribute('role'); ghost.setAttribute('aria-hidden', 'true');
        ghost.querySelectorAll('[id], [role]').forEach(element => { element.removeAttribute('id'); element.removeAttribute('role'); });
        ghost.classList.add('popup-closing');
        popup.remove(); document.body.appendChild(ghost);
        ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out' }).finished.catch(() => {}).finally(() => ghost.remove());
    };
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) contentAnimation?.cancel(); });
})();
