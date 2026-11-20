// Completion of project documentation, not a technical design certification.
(() => {
    const ui=window.goomUI,modal=document.getElementById('saveModal'),container=modal.querySelector('.plan-output-content');
    const region=document.createElement('section');region.className='project-readiness';region.id='projectReadiness';region.setAttribute('aria-live','polite');container.append(region);
    const meaningful=d=>d&&d.type&&d.plainText!==true&&!['plainText','textNode','deactivated','cableTool'].includes(d.type);
    window.evaluateProjectReadiness=(project)=>{
        const list=(project.floors||[]),all=list.flatMap(f=>f.devices||[]).filter(meaningful),ids=new Set(all.map(d=>d.id));
        const camera=APP_PRODUCT==='CCTV',panels=all.filter(d=>d.type===(camera?'cctv_nvr':'panel'));
        const main=panels.some(d=>d.isMainPanel)||panels.length===1;
        const sensors=all.filter(d=>camera?(typeof CCTV_CAMERAS!=='undefined'&&Object.hasOwn(CCTV_CAMERAS,d.type)||d.type==='cctv_doorbell'):['pir','pir_wl','magnet','magnet_wl','glassbreak','panic','smoke'].includes(d.type));
        const graph=new Map(all.map(d=>[d.id,new Set()]));let cableCount=0;for(const cable of list.flatMap(f=>f.cables||[])){if(ids.has(cable.fromId)&&ids.has(cable.toId)&&cable.fromId!==cable.toId){graph.get(cable.fromId).add(cable.toId);graph.get(cable.toId).add(cable.fromId);cableCount++;}}
        const primary=panels.find(d=>d.isMainPanel)||(panels.length===1?panels[0]:null),connected=new Set(),queue=primary?[primary.id]:[];
        while(queue.length){const id=queue.pop();if(connected.has(id))continue;connected.add(id);queue.push(...graph.get(id));}
        const wired=all.filter(d=>!['pir_wl','magnet_wl'].includes(d.type)),connectedCount=wired.filter(d=>connected.has(d.id)).length;
        const activeFloors=list.filter(f=>(f.devices||[]).some(meaningful)||(f.cables||[]).length||f.image||f.imgData||f.vectorPlan||f.pdfSource||f.rasterSource);
        const sourced=activeFloors.filter(f=>f.image||f.imgData||f.vectorPlan||f.pdfSource||f.rasterSource).length;
        const labels=all.filter(d=>String(d.manualName||'').trim()).length;
        let legendTypes=0,neededTypes=0;for(const floor of activeFloors){const types=new Set((floor.devices||[]).filter(meaningful).map(d=>d.type));const included=new Set(floor.legend?.visible!==false?(floor.legend?.entries||[]).map(e=>e.type):[]);neededTypes+=types.size;legendTypes+=[...types].filter(type=>included.has(type)).length;}
        const checks=[
            {id:'name',complete:!!String(project.name||'').trim(),weight:5,detail:''},
            {id:'drawing',complete:activeFloors.length>0&&sourced===activeFloors.length,weight:15,detail:`${sourced}/${activeFloors.length}`},
            {id:'main',complete:main,weight:20,detail:String(panels.length)},
            {id:'devices',complete:sensors.length>0,weight:20,detail:String(sensors.length)},
            {id:'cables',complete:wired.length>1&&cableCount>0&&connectedCount===wired.length,weight:20,detail:`${connectedCount}/${wired.length}`},
            {id:'labels',complete:all.length>0&&labels===all.length,weight:10,detail:`${labels}/${all.length}`},
            {id:'legend',complete:neededTypes>0&&legendTypes===neededTypes,weight:10,detail:`${legendTypes}/${neededTypes}`}
        ];
        const score=checks.reduce((sum,c)=>sum+(c.complete?c.weight:0),0);return{checks,score,grade:score>=85&&checks.slice(2,5).every(c=>c.complete)?2:score>=50?1:0};
    };
    function render(){if(getComputedStyle(modal).display==='none')return;const result=window.evaluateProjectReadiness({floors:typeof floors==='undefined'?[]:floors,name:document.getElementById('projectNameInput')?.value});
        const names={name:ui('Název','Name','Name','Название'),drawing:ui('Podklad','Drawing','Zeichnung','Подложка'),main:APP_PRODUCT==='CCTV'?'NVR':ui('Ústředna','Main panel','Zentrale','Централь'),devices:APP_PRODUCT==='CCTV'?ui('Kamery','Cameras','Kameras','Камеры'):ui('Detektory','Detectors','Melder','Датчики'),cables:ui('Vedení','Cables','Leitungen','Кабели'),labels:ui('Popisy','Labels','Beschriftung','Подписи'),legend:ui('Legenda','Legend','Legende','Легенда')};
        region.replaceChildren();const top=document.createElement('div');top.className='readiness-top';const title=document.createElement('span');title.className='readiness-title';title.textContent=ui('Připravenost projektu','Project completion','Projektvollständigkeit','Готовность проекта');const grade=document.createElement('span');grade.className='readiness-grade';const strong=document.createElement('strong');strong.textContent=`${result.score}/100`;grade.append(strong,` · ${[ui('Nízká','Low','Niedrig','Низкая'),ui('Dobrá','Good','Gut','Хорошая'),ui('Výborná','Excellent','Ausgezeichnet','Отличная')][result.grade]}`);top.append(title,grade);region.append(top);
        const list=document.createElement('ol');list.className='readiness-steps';for(const check of result.checks){const item=document.createElement('li');item.dataset.check=check.id;item.classList.toggle('complete',check.complete);const dot=document.createElement('span');dot.className='readiness-dot';dot.setAttribute('aria-hidden','true');dot.textContent=check.complete?'+':'−';const label=document.createElement('span');label.textContent=names[check.id];const detail=document.createElement('small');detail.className='readiness-detail';detail.textContent=check.detail;item.setAttribute('aria-label',`${names[check.id]}: ${check.complete?ui('hotovo','complete','vollständig','готово'):ui('doplnit','incomplete','ergänzen','дополнить')} ${check.detail}`);item.append(dot,label,detail);list.append(item);}region.append(list);
        const note=document.createElement('p');note.className='readiness-note';note.textContent=ui('Kontrola vyplnění: podklady na používaných podlažích, hlavní zařízení, propojení všech drátových prvků, názvy a legenda. Nenahrazuje technickou kontrolu.','Checks documentation: drawings on used floors, main device, connections for all wired devices, names and legend. Does not replace technical review.','Prüft Dokumentation: Zeichnungen genutzter Etagen, Hauptgerät, Verbindungen aller drahtgebundenen Geräte, Namen und Legende. Ersetzt keine technische Prüfung.','Проверка заполнения: подложки на используемых этажах, главное устройство, соединения всех проводных устройств, имена и легенда. Не заменяет техническую проверку.');region.append(note);
    }
    new MutationObserver(render).observe(modal,{attributes:true,attributeFilter:['style','class']});window.addEventListener('goom-language-changed',render);window.updateProjectReadiness=render;
})();
