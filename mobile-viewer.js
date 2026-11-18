(() => {
    if (!window.isGoomReadOnly?.()) return;
    const bar = document.createElement('nav');
    bar.id = 'mobileViewerBar';
    bar.setAttribute('aria-label', tr('Prohlížení cloudových plánů'));
    bar.innerHTML = `<div class="mobile-viewer-heading"><strong id="mobileViewerName"></strong><span>${tr('Pouze prohlížení')}</span><button id="mobileViewerAccount" class="mobile-viewer-account" type="button" aria-label="${tr('Uživatelský účet')}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg></button></div>
        <div class="mobile-viewer-actions"><button type="button" id="mobileViewerCloud">${tr('Cloudové projekty')}</button>
        <select id="mobileViewerFloor" aria-label="${tr('Podlaží')}"></select><button type="button" id="mobileViewerSearch">${APP_PRODUCT==='CCTV'?tr('Najít kameru'):tr('Najít detektor')}</button></div>
        <div class="mobile-viewer-zoom"><button type="button" data-view-zoom="0.8" aria-label="${tr('Oddálit')}">−</button><button type="button" id="mobileViewerFit">${tr('Celý plán')}</button><button type="button" data-view-zoom="1.25" aria-label="${tr('Přiblížit')}">+</button></div>`;
    document.body.insertBefore(bar, document.querySelector('.toolbar'));
    const welcome = document.createElement('button');
    welcome.id = 'mobileWelcomeCloud'; welcome.className = 'btn-cad'; welcome.type = 'button';
    welcome.textContent = tr('Otevřít cloudové projekty');
    document.getElementById('welcomeButtonsBlock').append(welcome);
    const open = async () => {
        if (!window.getFirebaseUser?.()) { showWelcomeScreen(); return; }
        if (!await window.ensureCloudAccess?.()) { await showAppAlert(tr('Cloudové úložiště je součástí PROJECT.'),tr('Cloudové projekty'));return; }
        await window.openCloudProjects?.();
    };
    welcome.addEventListener('click', open);
    document.getElementById('mobileViewerCloud').addEventListener('click', open);
    document.getElementById('mobileViewerAccount').addEventListener('click',()=>window.openAccountPanel?.());
    document.getElementById('mobileViewerSearch').addEventListener('click', () => document.getElementById('btnDetectorSearch').click());
    document.getElementById('mobileViewerFit').addEventListener('click', () => { centerCurrentFloor();requestRedraw(); });
    const floorSelect = document.getElementById('mobileViewerFloor');
    floorSelect.addEventListener('change', () => {currentFloorIndex=Number(floorSelect.value);changeFloor();});
    window.refreshMobileViewer = () => {
        document.getElementById('mobileViewerName').textContent = isSystemReady ? projectName : tr('Cloudové projekty');
        const signature = floors.map(floor => floor.name).join('\0');
        if (floorSelect.dataset.floors !== signature) {
            floorSelect.replaceChildren(...floors.map((floor,index) => new Option(floor.name,String(index))));
            floorSelect.dataset.floors=signature;
        }
        floorSelect.value=String(currentFloorIndex);floorSelect.disabled=!isSystemReady;
        window.refreshGoomSelects?.();
        document.getElementById('mobileViewerSearch').disabled=!isSystemReady||!window.hasProAccess?.();
    };
    function zoom(factor) {
        const x=planCanvasWidth()/2,y=planCanvasHeight()/2,next=Math.max(.01,Math.min(32,scale*factor));
        offsetX=x-(x-offsetX)*next/scale;offsetY=y-(y-offsetY)*next/scale;scale=next;requestRedraw();
    }
    bar.querySelectorAll('[data-view-zoom]').forEach(button=>button.addEventListener('click',()=>zoom(Number(button.dataset.viewZoom))));
    // Capture input before editor handlers: a finger can pan and pinch, never edit a device or cable.
    const points=new Map();let gesture=null;
    function snapshot() {
        const a=[...points.values()],rect=container.getBoundingClientRect();
        const x=a.reduce((s,p)=>s+p.x,0)/a.length-rect.left,y=a.reduce((s,p)=>s+p.y,0)/a.length-rect.top;
        return {x,y,distance:a.length>1?Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)):1};
    }
    function begin() {if(!points.size){gesture=null;return;}const p=snapshot();gesture={...p,scale,worldX:(p.x-offsetX)/scale,worldY:(p.y-offsetY)/scale};}
    for (const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture']) container.addEventListener(type,event=>{
        event.preventDefault();event.stopImmediatePropagation();
        if(!isSystemReady)return;
        if(type==='pointerdown'){points.set(event.pointerId,{x:event.clientX,y:event.clientY});container.setPointerCapture(event.pointerId);begin();}
        else if(type==='pointermove'&&points.has(event.pointerId)&&gesture){
            points.set(event.pointerId,{x:event.clientX,y:event.clientY});const p=snapshot();
            scale=Math.max(.01,Math.min(32,gesture.scale*p.distance/gesture.distance));
            offsetX=p.x-gesture.worldX*scale;offsetY=p.y-gesture.worldY*scale;requestRedraw();
        }else if(type!=='pointermove'){points.delete(event.pointerId);begin();}
    },{capture:true,passive:false});
    for(const type of ['click','dblclick','contextmenu']) container.addEventListener(type,event=>{event.preventDefault();event.stopImmediatePropagation();},true);
    const allowed = '#mobileViewerBar,#mobileWelcomeCloud,#welcomeAuthBlock,#welcomeEmailBlock,.welcome-controls,.ui-select-list,.ui-select-trigger,#btnWelcomeContinue,#btnWelcomeAccount,#btnWelcomeProfile,#btnCloudProjectsClose,#cloudProjectsList .cloud-project-actions button:not(.cloud-project-delete),#detectorSearchModal,#appDialog,#appDialogBackdrop,#btnAccountClose,#btnAccountCloudProjects,#btnAccountRefresh,#btnAccountVerifyEmail,#btnAccountSignOut,#btnProClose';
    document.addEventListener('click',event=>{
        const control=event.target.closest('button,a,select,input');
        if(control?.id==='btnAccountCloudProjects'&&!window.hasCloudAccess?.()){
            event.preventDefault();event.stopImmediatePropagation();void showAppAlert(tr('Cloudové úložiště je součástí PROJECT.'),tr('Cloudové projekty'));return;
        }
        if(control&&!control.closest(allowed)&&control.id!=='btnDetectorSearch'){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    document.addEventListener('goom-account-changed',event=>{
        if(isSystemReady&&(!event.detail.user||!event.detail.licensed)){
            floors=[];currentFloorIndex=-1;isSystemReady=false;activeDeviceIds.clear();
            clearDetectorSearchHighlight();requestRedraw();showWelcomeScreen(event.detail.user?'projects':'auth');
        }
        window.refreshMobileViewer();
    });
    window.addEventListener('goom-language-changed',window.refreshMobileViewer);
    window.refreshMobileViewer();
})();
