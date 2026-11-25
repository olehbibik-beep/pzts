// Shared whale for asynchronous preparation; each operation owns its own token.
(() => {
    const scopes=new Map();
    window.startGoomBusy=(scope=document.body)=>{
        let entry=scopes.get(scope);
        if(!entry){const element=document.createElement('div');element.className='goom-busy-whale';element.setAttribute('role','status');element.setAttribute('aria-label',tr('Zpracování…'));element.innerHTML='<span class="busy-whale-mark"><img src="Logo.png" alt=""></span>';scope.append(element);entry={element,count:0};scopes.set(scope,entry);}
        entry.count++;scope.setAttribute('aria-busy','true');let ended=false;
        return ()=>{if(ended)return;ended=true;if(--entry.count===0){entry.element.remove();scopes.delete(scope);scope.removeAttribute('aria-busy');}};
    };
    window.goomBusyPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
})();
