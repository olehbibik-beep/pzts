(() => {
    const ui=window.goomUI,help=document.getElementById('helpPanel');
    const replay=document.createElement('button');replay.type='button';replay.id='btnStartGuide';replay.className='help-guide-row';replay.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg><span></span>';
    const shortcuts=document.createElement('div');shortcuts.className='help-shortcuts';shortcuts.append(...help.children);help.append(replay,shortcuts);
    const welcome=document.createElement('button');welcome.type='button';welcome.className='welcome-guide-link';welcome.id='btnWelcomeGuide';document.querySelector('#welcomeModal .welcome-step-content')?.append(welcome);
    const start=()=>{help.classList.remove('open');window.startGoomOnboarding({force:true});};replay.onclick=start;welcome.onclick=start;
    function render(){replay.querySelector('span').textContent=ui('Spustit průvodce','Start guide','Rundgang starten','Запустить обучение');welcome.textContent=replay.querySelector('span').textContent;replay.hidden=welcome.hidden=!!window.isGoomReadOnly?.();}
    window.addEventListener('goom-language-changed',render);render();
})();
