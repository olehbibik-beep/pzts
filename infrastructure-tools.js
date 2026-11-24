// Shared building routes are native plan objects and remain connectable on every floor.
(() => {
    const palette=document.getElementById('deviceSetTools'),text=document.getElementById('textTools');
    for(const[type,label,icon]of [
        ['floorPassage','Mezipodlažní průchod','<circle cx="12" cy="12" r="9"/><path d="M12 18V6m-4 4 4-4 4 4"/>'],
        ['trunkTool','Hlavní trasa','<path d="M3 18V7h18" stroke-width="4"/><circle cx="3" cy="18" r="2"/><circle cx="21" cy="7" r="2"/>']
    ]){const button=document.createElement('button');button.type='button';button.className='device-btn';button.dataset.type=type;button.title=tr(label);button.setAttribute('aria-label',tr(label));button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8">${icon}</svg>`;palette.insertBefore(button,text);}
    let trunkStart=null,press=null;
    const host=document.getElementById('canvasContainer');
    const point=e=>{const r=host.getBoundingClientRect();return{x:(e.clientX-r.left-offsetX)/scale,y:(e.clientY-r.top-offsetY)/scale};};
    const findDevice=(floor,p)=>[...floor.devices].reverse().find(d=>Math.hypot(d.x-p.x,d.y-p.y)<(isInfrastructureDevice(d)?14:22)*(Number(document.getElementById('deviceSizeSlider').value)||14)/14);
    function junction(floor,p){
        const near=findDevice(floor,p);if(near&&isInfrastructureDevice(near))return near;
        let best=null;
        for(const cable of floor.cables.filter(c=>c.kind==='trunk')){const from=floor.devices.find(d=>d.id===cable.fromId),to=floor.devices.find(d=>d.id===cable.toId);if(!from||!to)continue;const dx=to.x-from.x,dy=to.y-from.y,t=Math.max(0,Math.min(1,((p.x-from.x)*dx+(p.y-from.y)*dy)/(dx*dx+dy*dy||1))),x=from.x+dx*t,y=from.y+dy*t,distance=Math.hypot(x-p.x,y-p.y);if(distance<12/scale&&(!best||distance<best.distance))best={cable,t,x,y,distance};}
        if(!best)return null;
        const node={id:genId(),type:'trunkJunction',ownerApplication:APP_PRODUCT,x:best.x,y:best.y,rotation:0,attachedCableId:best.cable.id,attachedT:best.t};floor.devices.push(node);return node;
    }
    function connect(floor,from,to,kind){if(from.id===to.id)return;if(floor.cables.some(c=>(c.fromId===from.id&&c.toId===to.id)||(c.fromId===to.id&&c.toId===from.id)))return;
        const cable={id:genId(),ownerApplication:APP_PRODUCT,fromId:from.id,toId:to.id,isCustom:false,...(kind?{kind}:{} )};recalcCableHandles(cable,from,to);floor.cables.push(cable);
    }
    function enabled(){return isSystemReady&&!isOverviewMode&&!window.isGoomReadOnly?.()&&!document.querySelector('.modal[data-modal-open="true"],.app-dialog-backdrop:not([hidden])');}
    host.addEventListener('pointerdown',e=>{
        if(!enabled()||e.button!==0)return;const floor=floors[currentFloorIndex],p=point(e);
        const hit=findDevice(floor,p),mainRoute=floor.showConnections&&floor.cables.some(c=>{if(c.kind!=='trunk')return false;const a=floor.devices.find(d=>d.id===c.fromId),b=floor.devices.find(d=>d.id===c.toId);return a&&b&&distToSegmentSquared(p,a,b)<(12/scale)**2;});
        if(selectedTool==='trunkTool'||mainRoute||selectedTool==='cableTool'&&hit||hit&&isInfrastructureDevice(hit)&&!isOwnPlanEntity(hit)){press={x:e.clientX,y:e.clientY,pointer:e.pointerId};e.preventDefault();e.stopImmediatePropagation();host.setPointerCapture(e.pointerId);}
    },true);
    host.addEventListener('pointerup',e=>{
        if(!press||press.pointer!==e.pointerId)return;const old=press;press=null;e.preventDefault();e.stopImmediatePropagation();if(!enabled()||Math.hypot(old.x-e.clientX,old.y-e.clientY)>6)return;
        const floor=floors[currentFloorIndex],p=point(e);
        if(selectedTool==='trunkTool'){
            let node=findDevice(floor,p);if(!node){const snap=getSnappedCoords(p.x,p.y,floor,scale);node={id:genId(),type:'trunkJunction',ownerApplication:APP_PRODUCT,x:snap.x,y:snap.y,rotation:0};floor.devices.push(node);}
            const previous=floor.devices.find(d=>d.id===trunkStart);if(previous)connect(floor,previous,node,'trunk');trunkStart=node.id;activeDeviceIds.clear();
        }else{
            const node=findDevice(floor,p)||junction(floor,p);if(!node)return;
            const previous=floor.devices.find(d=>activeDeviceIds.has(d.id));if(previous)connect(floor,previous,node);activeDeviceIds.clear();activeDeviceIds.add(node.id);
        }
        calculateDynamicNumbersGlobal(floors);saveStateToHistory();requestRedraw();triggerAutoSave();
    },true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')trunkStart=null;});
    document.addEventListener('click',e=>{if(e.target.closest('.device-btn[data-type]'))trunkStart=null;},true);
    const modal=document.createElement('div');modal.className='modal';modal.id='passageSettingsModal';modal.innerHTML='<form class="modal-content" style="max-width:420px"><div class="modal-title">Mezipodlažní průchod</div><label>Cílové podlaží<select id="passageTargetFloor" class="account-input"></select></label><label>Název<input id="passageName" class="account-input" maxlength="120"></label><div class="modal-buttons"><button type="button" class="btn-cad" id="passageCancel">Zavřít</button><button type="submit" class="btn-cad">Uložit</button></div></form>';document.body.append(modal);let editing=null;
    host.addEventListener('dblclick',e=>{if(!enabled())return;const d=findDevice(floors[currentFloorIndex],point(e));if(d?.type!=='floorPassage'||!isOwnPlanEntity(d))return;e.preventDefault();e.stopImmediatePropagation();editing=d;const select=document.getElementById('passageTargetFloor');select.replaceChildren(new Option('—',''),...floors.filter(f=>f!==floors[currentFloorIndex]).map(f=>new Option(f.name,f.name)));select.value=d.targetFloorName||'';document.getElementById('passageName').value=d.manualName||'';modal.style.display='flex';},true);
    document.getElementById('passageCancel').onclick=()=>modal.style.display='none';modal.querySelector('form').onsubmit=e=>{e.preventDefault();if(editing&&isOwnPlanEntity(editing)){editing.targetFloorName=document.getElementById('passageTargetFloor').value;editing.manualName=document.getElementById('passageName').value;saveStateToHistory();triggerAutoSave();requestRedraw();}modal.style.display='none';};
})();
function updateTrunkJunctions(floor){
    const byId=new Map(floor.devices.map(d=>[d.id,d]));
    for(const node of floor.devices)if(node.attachedCableId&&isOwnPlanEntity(node)){const c=floor.cables.find(c=>c.id===node.attachedCableId),a=byId.get(c?.fromId),b=byId.get(c?.toId);if(a&&b){const t=Math.max(0,Math.min(1,Number(node.attachedT)||0));node.x=a.x+(b.x-a.x)*t;node.y=a.y+(b.y-a.y)*t;}}
}
function drawInfrastructureDevice(context,device,baseSize){
    const size=baseSize/14;context.save();context.translate(device.x,device.y);context.strokeStyle='#38bdf8';context.fillStyle='#38bdf8';context.lineWidth=2*size;context.beginPath();
    if(device.type==='trunkJunction'){context.arc(0,0,3*size,0,Math.PI*2);context.fill();}
    else{context.arc(0,0,11*size,0,Math.PI*2);context.stroke();context.beginPath();context.moveTo(0,7*size);context.lineTo(0,-7*size);context.moveTo(-4*size,-3*size);context.lineTo(0,-7*size);context.lineTo(4*size,-3*size);context.stroke();if(device.targetFloorName){context.font=`${10*size}px sans-serif`;context.textAlign='center';context.fillText(device.targetFloorName,0,23*size);}}
    if(device.manualName){context.font=`${10*size}px sans-serif`;context.textAlign='center';context.fillText(device.manualName,0,(device.targetFloorName?37:23)*size);}
    context.restore();
}
