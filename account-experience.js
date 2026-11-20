(() => {
    const ui=window.goomUI,card=document.querySelector('#userAccountModal .account-card');
    const block=document.createElement('section');block.className='account-practice';
    block.innerHTML='<div class="account-initials" id="accountInitials" data-user-content aria-hidden="true"></div><div class="account-practice-info"><div class="account-practice-name" id="accountPracticeName" data-user-content></div><div class="account-practice-meta"><span id="accountPracticeTitle"></span><span id="accountPracticeTime"></span></div><div class="account-practice-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" id="accountPracticeProgress"><span></span></div><div class="account-practice-caption" id="accountPracticeCaption"></div></div>';
    card.querySelector('.account-columns').before(block);
    let account=null,total=null,failed=false,generation=0,unsubscribe=null,uid=null;
    const milestones=[0,1,5,15,40,100,250,500,1000];
    function render(){
        const name=String(account?.profile?.displayName||account?.user?.displayName||account?.user?.email?.split('@')[0]||'GooM').trim();const parts=name.split(/\s+/).filter(Boolean);
        document.getElementById('accountInitials').textContent=[parts[0],parts.length>1?parts.at(-1):null].filter(Boolean).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase();
        document.getElementById('accountPracticeName').textContent=name;document.getElementById('accountPracticeTitle').textContent=ui('Praxe ve všech programech','Practice across all apps','Praxis in allen Programmen','Практика во всех программах');
        const progress=document.getElementById('accountPracticeProgress'),caption=document.getElementById('accountPracticeCaption'),time=document.getElementById('accountPracticeTime');
        if(total===null){time.textContent=failed?ui('Nedostupné','Unavailable','Nicht verfügbar','Недоступно'):ui('Načítání…','Loading…','Laden…','Загрузка…');caption.textContent=ui('Počítá se pouze aktivní práce.','Only active time is counted.','Nur aktive Zeit wird gezählt.','Учитывается только активная работа.');progress.removeAttribute('aria-valuenow');progress.firstElementChild.style.width='0%';return;}
        const hours=total/3600,minutes=Math.floor(total/60);let level=milestones.findLastIndex(value=>hours>=value),start=milestones[level],next=milestones[level+1]||start+1000;
        const percent=Math.max(0,Math.min(100,(hours-start)/(next-start)*100));
        time.textContent=ui(`${Math.floor(minutes/60)} h ${minutes%60} min`,`${Math.floor(minutes/60)} h ${minutes%60} min`,`${Math.floor(minutes/60)} Std. ${minutes%60} Min.`,`${Math.floor(minutes/60)} ч ${minutes%60} мин`);
        caption.textContent=ui(`Úroveň ${level+1} · další milník ${next} h aktivní práce`,`Level ${level+1} · next milestone ${next} h of active work`,`Stufe ${level+1} · nächstes Ziel ${next} aktive Stunden`,`Уровень ${level+1} · следующая отметка ${next} ч активной работы`);
        progress.setAttribute('aria-label',document.getElementById('accountPracticeTitle').textContent);progress.setAttribute('aria-valuenow',Math.round(percent));progress.setAttribute('aria-valuetext',caption.textContent);progress.firstElementChild.style.width=percent+'%';
    }
    document.addEventListener('goom-account-changed',async event=>{
        account=event.detail;const next=account?.user?.emailVerified&&account.profile?account.user.uid:null;
        if(next===uid){render();return;}uid=next;const revision=++generation;unsubscribe?.();unsubscribe=null;total=null;failed=false;render();if(!next)return;
        try{const db=await window.getFirebaseDatabase();if(revision!==generation)return;const ref=db.collection('goomEditorUsage').doc(next);
            const accept=snapshot=>{if(revision!==generation)return;const data=snapshot.data();total=Number.isFinite(Number(data?.activeSeconds))?Math.max(0,Number(data.activeSeconds)):0;failed=false;render();};
            const reject=()=>{if(revision!==generation)return;failed=true;total=null;render();};
            if(typeof ref.onSnapshot==='function')unsubscribe=ref.onSnapshot(accept,reject);else accept(await ref.get());
        }catch{if(revision===generation){failed=true;render();}}
    });
    window.addEventListener('goom-language-changed',render);render();
})();
