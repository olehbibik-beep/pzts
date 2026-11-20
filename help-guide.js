(() => {
    const ui=window.goomUI,help=document.getElementById('helpPanel');
    const replay=document.createElement('button');replay.type='button';replay.id='btnStartGuide';replay.className='help-guide-row';replay.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg><span></span>';
    const manual=document.createElement('a');manual.className='help-guide-row';manual.id='btnOpenManual';manual.target='_blank';manual.rel='noopener';manual.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3Zm9 2v15"/></svg><span></span>';help.prepend(replay,manual);
    const welcome=document.createElement('button');welcome.type='button';welcome.className='welcome-guide-link';welcome.id='btnWelcomeGuide';document.querySelector('#welcomeModal .welcome-step-content')?.append(welcome);
    const start=()=>{help.classList.remove('open');window.startGoomOnboarding({force:true});};replay.onclick=start;welcome.onclick=start;
    function render(){replay.querySelector('span').textContent=ui('Spustit průvodce krok za krokem','Start the step-by-step tour','Schritt-für-Schritt-Rundgang','Начать пошаговое обучение');manual.querySelector('span').textContent=ui('Příručka: jak používat GooM','Manual: how to use GooM','Anleitung: GooM verwenden','Руководство: как пользоваться GooM');manual.href=`https://goom.cz/guide/?app=${APP_PRODUCT}&lang=${window.getGoomLanguage?.()||'cs'}`;welcome.textContent=replay.querySelector('span').textContent;replay.hidden=welcome.hidden=!!window.isGoomReadOnly?.();}
    window.addEventListener('goom-language-changed',render);render();
})();
