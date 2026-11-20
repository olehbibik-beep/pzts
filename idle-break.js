(() => {
    const ui=window.goomUI,delay=10*60*1000;let lastActivity=Date.now(),locked=false,previousFocus=null;
    const overlay=document.createElement('section');overlay.id='idleBreakOverlay';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','idleBreakTitle');
    overlay.innerHTML='<div class="idle-break-content"><img src="Logo.png" alt=""><h2 id="idleBreakTitle"></h2><p id="idleBreakMessage"></p><button type="button" id="btnResumeEditor"></button></div>';document.body.append(overlay);
    const button=overlay.querySelector('button');
    function labels(){overlay.querySelector('h2').textContent=ui('Čas na odpočinek','Time for a break','Zeit für eine Pause','Пора отдохнуть');overlay.querySelector('p').textContent=ui('Projekt zůstává otevřený. Ovládání jsme pozastavili, aby náhodný dotyk nic nezměnil.','Your project is still open. Controls are paused to protect it from accidental touches.','Ihr Projekt bleibt geöffnet. Die Bedienung ist gegen versehentliche Berührungen gesperrt.','Проект остаётся открытым. Управление приостановлено, чтобы случайное нажатие ничего не изменило.');button.textContent=ui('Pokračovat v práci','Continue working','Weiterarbeiten','Продолжить работу');}
    function eligible(){return typeof isSystemReady!=='undefined'&&isSystemReady&&document.getElementById('onboardingBackdrop')?.hidden!==false&&!document.querySelector('.goom-busy-whale');}
    function lock(){if(locked||!eligible())return;previousFocus=document.activeElement;locked=true;window.goomIdleLocked=true;overlay.hidden=false;labels();button.focus({preventScroll:true});}
    function resume(){locked=false;window.goomIdleLocked=false;overlay.hidden=true;lastActivity=Date.now();previousFocus?.focus?.({preventScroll:true});document.dispatchEvent(new Event('goom-editor-resumed'));}
    function check(){if(Date.now()-lastActivity>=delay)lock();}
    for(const type of ['pointerdown','pointerup','pointermove','click','dblclick','keydown','keyup','wheel','touchstart'])window.addEventListener(type,event=>{
        if(!locked&&Date.now()-lastActivity>=delay)lock();
        if(locked){
            if(type==='keydown'&&event.target===button&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopImmediatePropagation();resume();return;}
            if(!button.contains(event.target)||type==='keydown'||type==='keyup'){event.preventDefault();event.stopImmediatePropagation();}
            return;
        }
        if(!document.hidden)lastActivity=Date.now();
    },{capture:true,passive:false});
    for(const type of ['pointerdown','pointerup','click'])button.addEventListener(type,event=>{event.stopPropagation();if(type==='click'){event.preventDefault();resume();}});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});document.addEventListener('goom-editor-resumed',()=>{lastActivity=Date.now();});
    document.addEventListener('goom-auth-state-changed',()=>{if(locked)resume();lastActivity=Date.now();});window.addEventListener('goom-language-changed',labels);
    setInterval(check,15000);labels();
})();
