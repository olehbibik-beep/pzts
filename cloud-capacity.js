// Capacity reflects project slots in this editor, rather than an invented storage allowance.
(() => {
    const card=document.querySelector('.account-cloud'), info=document.getElementById('accountCloudInfo');
    const gauge=document.createElement('div');gauge.id='cloudCapacity';gauge.className='cloud-capacity';
    gauge.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true"><path class="capacity-track" d="M8 8 A52 52 0 0 1 8 112" pathLength="100"/><path class="capacity-fill" d="M8 8 A52 52 0 0 1 8 112" pathLength="100"/></svg><div class="capacity-value" data-user-content>—</div>';
    info.before(gauge);
    let owner=null, revision=0, used=null, loading=false, failed=false;
    const ui=window.goomUI;
    function render(){
        const allowed=Boolean(window.hasCloudAccess?.());gauge.hidden=!allowed;
        document.getElementById('accountCloudTitle').textContent='Cloud';
        const button=document.getElementById('btnAccountCloudProjects');
        button.querySelector('span').textContent=ui('Otevřít Cloud','Open Cloud','Cloud öffnen','Открыть Cloud','Otwórz Cloud');
        const free=used===null?null:Math.max(0,cloudProjectLimit-used);
        gauge.dataset.state=loading?'loading':failed?'error':free===null?'empty':'ready';
        gauge.querySelector('.capacity-value').textContent=free===null?'—':`${free} / ${cloudProjectLimit}`;
        const caption=!allowed?ui('Cloud je součástí Pro.','Cloud is included with Pro.','Cloud ist in Pro enthalten.','Cloud входит в Pro.','Cloud jest dostępny w Pro.')
            :loading?ui('Načítání…','Loading…','Wird geladen…','Загружаем…','Wczytywanie…')
            :failed?ui('Kapacitu nelze načíst. Zkuste to znovu.','Could not load capacity. Try again.','Kapazität konnte nicht geladen werden. Erneut versuchen.','Не удалось загрузить квоту. Попробуйте ещё раз.','Nie można wczytać limitu. Spróbuj ponownie.')
            :ui('Volná místa pro projekty','Free project slots','Freie Projektplätze','Свободные места для проектов','Wolne miejsca na projekty')+' · '+APP_PRODUCT;
        info.textContent=caption;
        const fill=gauge.querySelector('.capacity-fill');fill.style.strokeDasharray=`${free===null?0:free/cloudProjectLimit*100} 100`;
        gauge.setAttribute('role','meter');gauge.setAttribute('aria-label',caption);gauge.setAttribute('aria-valuemin','0');gauge.setAttribute('aria-valuemax',String(cloudProjectLimit));
        if(free===null)gauge.removeAttribute('aria-valuenow');else gauge.setAttribute('aria-valuenow',String(free));
    }
    window.refreshCloudCapacity=async()=>{
        const user=window.getFirebaseUser(),current=++revision;
        if(owner!==user?.uid){owner=user?.uid;used=null;}
        if(!user||!window.hasCloudAccess?.()){used=null;loading=false;failed=false;render();return;}
        loading=true;failed=false;render();
        try{
            const db=await getCloudDatabase(user.uid),collection=getCloudProjectCollection(db,user.uid);
            const snapshot=await collection.limit(cloudProjectLimit+2).get({source:'server'});let count=0;
            snapshot.forEach(doc=>{if(doc.id!==cloudListLock)count++;});
            if(current===revision&&window.getFirebaseUser()?.uid===user.uid)used=count;
        }catch{if(current===revision){used=null;failed=true;}}
        finally{if(current===revision){loading=false;render();}}
    };
    document.addEventListener('goom-account-changed',()=>{used=null;revision++;render();if(document.getElementById('userAccountModal').style.display==='flex')void window.refreshCloudCapacity();});
    document.addEventListener('goom-cloud-projects-changed',()=>void window.refreshCloudCapacity());
    window.addEventListener('goom-language-changed',render);render();
})();
