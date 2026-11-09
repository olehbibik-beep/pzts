// Shared decorative background and motion. No layout changes or artificial loading delays.
(() => {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const svgNamespace='http://www.w3.org/2000/svg';
    function drawRandomBlueprint(element,width,height){
        const random=(a,b)=>a+Math.random()*(b-a),point=()=>({x:random(12,Math.max(14,width-12)),y:random(12,Math.max(14,height-12))});
        if(element.tagName.toLowerCase()==='circle'){
            const radius=random(10,Math.max(12,Math.min(width,height)*.16));
            element.setAttribute('r',radius);element.setAttribute('cx',random(radius+4,Math.max(radius+5,width-radius-4)));element.setAttribute('cy',random(radius+4,Math.max(radius+5,height-radius-4)));
        }else{
            const p=point(),q=point(),r=point();let d;
            switch(element.dataset.shape){
                case 'box': d=`M${p.x} ${p.y}H${q.x}V${q.y}H${p.x}Z`;break;
                case 'triangle': d=`M${p.x} ${p.y}L${q.x} ${q.y}L${r.x} ${r.y}Z`;break;
                case 'arc': d=`M${p.x} ${p.y}Q${q.x} ${q.y} ${r.x} ${r.y}`;break;
                default:d=`M${p.x} ${p.y}H${q.x}V${q.y}H${r.x}`;
            }
            element.setAttribute('d',d);
        }
    }
    window.attachModalBlueprint = container => {
        if(!container||container.querySelector(':scope > .modal-blueprint-host'))return;
        const host=document.createElement('div');host.className='modal-blueprint-host';host.setAttribute('aria-hidden','true');
        const svg=document.createElementNS(svgNamespace,'svg');svg.classList.add('modal-blueprint','welcome-blueprint');
        svg.setAttribute('preserveAspectRatio','xMinYMid meet');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
        host.appendChild(svg);container.prepend(host);
        const variants=['flow','line','box','triangle','arc'];
        const shapes=['circle',variants[Math.floor(Math.random()*variants.length)],variants[Math.floor(Math.random()*variants.length)]];
        shapes.forEach(shape=>{
            const element=document.createElementNS(svgNamespace,shape==='circle'?'circle':'path');
            element.dataset.shape=shape;element.setAttribute('pathLength','1');element.classList.add(shape==='circle'?'blueprint-circle':shape==='flow'?'blueprint-flow':'blueprint-trace');
            element.style.animationDuration=(13+Math.random()*19)+'s';element.style.animationDelay=(-Math.random()*28)+'s';
            svg.appendChild(element);
            element.addEventListener('animationiteration',()=>{if(element.tagName.toLowerCase()!=='circle')element.dataset.shape=variants[Math.floor(Math.random()*variants.length)];const box=svg.getBoundingClientRect();if(box.width&&box.height)drawRandomBlueprint(element,box.width,box.height);});
        });
        const resize=()=>{
            const box=svg.getBoundingClientRect();if(!box.width||!box.height)return;
            svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
            [...svg.children].forEach(element=>drawRandomBlueprint(element,box.width,box.height));
        };
        svg.setAttribute('viewBox','0 0 260 400');[...svg.children].forEach(element=>drawRandomBlueprint(element,260,400));
        new ResizeObserver(resize).observe(host);
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
