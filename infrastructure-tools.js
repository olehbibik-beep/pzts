// Shared building routes retain editable topology independently of their palette artwork.
let activeTrunkEdit=null;
function trunkComponent(floor,cableId){const edges=new Set([cableId]),nodes=new Set();let changed=true;while(changed){changed=false;for(const c of floor.cables.filter(c=>c.kind==='trunk')){if(edges.has(c.id)||nodes.has(c.fromId)||nodes.has(c.toId)){if(!edges.has(c.id)){edges.add(c.id);changed=true;}for(const id of [c.fromId,c.toId])if(!nodes.has(id)){nodes.add(id);changed=true;}}}for(const d of floor.devices)if(d.attachedCableId&&edges.has(d.attachedCableId)&&!nodes.has(d.id)){nodes.add(d.id);changed=true;}}return{edges,nodes};}
function selectTrunkForEditing(floor,cableId,nodeId){const part=cableId?trunkComponent(floor,cableId):{edges:new Set(),nodes:new Set(nodeId?[nodeId]:[])};activeTrunkEdit={floor,cableId,...part};requestRedraw();return part;}
function showTrunkHandle(device){const floor=floors[currentFloorIndex];return isOwnPlanEntity(device)&&(selectedTool==='trunkTool'||activeDeviceIds.has(device.id)||activeTrunkEdit?.floor===floor&&activeTrunkEdit.nodes.has(device.id));}
function nearestTrunkPoint(floor,p,allowed=null){let best=null;const nodes=new Map(floor.devices.map(d=>[d.id,d]));for(const cable of floor.cables){if(cable.kind!=='trunk'||allowed&&!allowed.has(cable.id))continue;const a=nodes.get(cable.fromId),b=nodes.get(cable.toId);if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),x=a.x+dx*t,y=a.y+dy*t,distance=Math.hypot(x-p.x,y-p.y);if(!best||distance<best.distance)best={cable,t,x,y,distance};}return best;}
(() => {
    const palette=document.getElementById('deviceSetTools'),text=document.getElementById('textTools');
    for(const[type,label,icon]of [
        ['floorPassage','Mezipodlažní průchod','<circle cx="12" cy="12" r="9"/><path d="M7 17 17 7M10 7h7v7"/>'],
        ['trunkTool','Hlavní trasa','<path d="M3 12h18" stroke-width="4"/><path d="M7 7v10m10-10v10" stroke-width="1.5"/>']
    ]){const button=document.createElement('button');button.type='button';button.className='device-btn';button.dataset.type=type;button.title=tr(label);button.setAttribute('aria-label',tr(label));button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8">${icon}</svg>`;palette.insertBefore(button,text);}
    let trunkStart=null,press=null;
    const host=document.getElementById('canvasContainer');
    const point=e=>{const r=host.getBoundingClientRect();return{x:(e.clientX-r.left-offsetX)/scale,y:(e.clientY-r.top-offsetY)/scale};};
    const findDevice=(floor,p)=>[...floor.devices].reverse().find(d=>Math.hypot(d.x-p.x,d.y-p.y)<(d.type==='trunkJunction'?10/scale:22*(Number(document.getElementById('deviceSizeSlider').value)||14)/14));
    function junction(floor,hit){const near=[...floor.devices].reverse().find(d=>d.type==='trunkJunction'&&Math.hypot(d.x-hit.x,d.y-hit.y)<8/scale);if(near)return near;const node={id:genId(),type:'trunkJunction',ownerApplication:APP_PRODUCT,x:hit.x,y:hit.y,rotation:0,attachedCableId:hit.cable.id,attachedT:hit.t};floor.devices.push(node);return node;}
    function connect(floor,from,to,kind){if(!from||!to||from.id===to.id||floor.cables.some(c=>(c.fromId===from.id&&c.toId===to.id)||(c.fromId===to.id&&c.toId===from.id)))return false;const cable={id:genId(),ownerApplication:APP_PRODUCT,fromId:from.id,toId:to.id,isCustom:false,...(kind?{kind}:{})};recalcCableHandles(cable,from,to);floor.cables.push(cable);return cable;}
    function enabled(){return isSystemReady&&!isOverviewMode&&!window.isGoomReadOnly?.()&&!document.querySelector('.modal[data-modal-open="true"],.app-dialog-backdrop:not([hidden])');}
    function startSnapshot(floor){return{nodes:floor.devices.filter(isOwnPlanEntity).map(d=>({d,x:d.x,y:d.y,attachedCableId:d.attachedCableId,attachedT:d.attachedT})),cables:floor.cables.filter(isOwnPlanEntity).map(c=>({c,values:Object.fromEntries(['h1x','h1y','h2x','h2y','h3x','h3y'].map(k=>[k,c[k]]))}))};}
    function restore(snapshot){for(const row of snapshot.nodes){Object.assign(row.d,{x:row.x,y:row.y});for(const key of ['attachedCableId','attachedT'])if(row[key]===undefined)delete row.d[key];else row.d[key]=row[key];}for(const row of snapshot.cables)Object.assign(row.c,row.values);}
    host.addEventListener('pointerdown',e=>{
        if(!enabled()||e.button!==0||press)return;const floor=floors[currentFloorIndex],p=point(e),hit=findDevice(floor,p),nearest=floor.showConnections?nearestTrunkPoint(floor,p):null,line=nearest&&nearest.distance<12/scale?nearest:null;
        if(selectedTool!=='trunkTool'&&!line&&hit?.type!=='trunkJunction'&&activeTrunkEdit){activeTrunkEdit=null;requestRedraw();}
        if(!['select','cableTool','trunkTool'].includes(selectedTool))return;
        if(selectedTool!=='trunkTool'&&hit&&hit.type!=='trunkJunction'&&isOwnPlanEntity(hit))return;
        if(selectedTool!=='trunkTool'&&!line&&!(hit&&isInfrastructureDevice(hit)&&!isOwnPlanEntity(hit))&&hit?.type!=='trunkJunction')return;
        const carrier=hit?.attachedCableId||floor.cables.find(c=>c.kind==='trunk'&&(c.fromId===hit?.id||c.toId===hit?.id))?.id||line?.cable.id;
        const component=carrier?trunkComponent(floor,carrier):{edges:new Set(),nodes:new Set(hit?[hit.id]:[])};
        press={floor,p,hit,line,component,pointer:e.pointerId,clientX:e.clientX,clientY:e.clientY,drawing:selectedTool==='trunkTool',moved:false,changed:false,snapshot:startSnapshot(floor)};
        if(hit?.type==='trunkJunction'&&isOwnPlanEntity(hit))selectTrunkForEditing(floor,carrier,hit.id);else if(line&&!press.drawing)selectTrunkForEditing(floor,line.cable.id);
        e.preventDefault();e.stopImmediatePropagation();host.setPointerCapture(e.pointerId);
    },true);
    host.addEventListener('pointermove',e=>{
        if(!press||press.pointer!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();if(!enabled())return;
        if(Math.hypot(e.clientX-press.clientX,e.clientY-press.clientY)<5&&!press.moved)return;press.moved=true;const p=point(e),{floor,hit,line,component,snapshot}=press;
        if(hit?.type==='trunkJunction'&&isOwnPlanEntity(hit)){
            const original=snapshot.nodes.find(row=>row.d===hit);
            if(hit.attachedCableId){const nearest=nearestTrunkPoint(floor,p,component.edges);if(nearest){hit.attachedCableId=nearest.cable.id;hit.attachedT=nearest.t;hit.x=nearest.x;hit.y=nearest.y;}}
            else{hit.x=Math.round((original.x+p.x-press.p.x)/10)*10;hit.y=Math.round((original.y+p.y-press.p.y)/10)*10;}
        }else if(line&&isOwnPlanEntity(line.cable)&&!press.drawing){const dx=Math.round((p.x-press.p.x)/10)*10,dy=Math.round((p.y-press.p.y)/10)*10;for(const row of snapshot.nodes)if(component.nodes.has(row.d.id)&&!row.d.attachedCableId){row.d.x=row.x+dx;row.d.y=row.y+dy;}}
        else return;
        updateTrunkJunctions(floor);for(const c of floor.cables)if(isOwnPlanEntity(c)&&c.kind!=='trunk'&&!c.isCustom){const a=floor.devices.find(d=>d.id===c.fromId),b=floor.devices.find(d=>d.id===c.toId);if(a&&b)recalcCableHandles(c,a,b);}
        press.changed=snapshot.nodes.some(row=>row.d.x!==row.x||row.d.y!==row.y||row.d.attachedCableId!==row.attachedCableId||row.d.attachedT!==row.attachedT);isDragging=press.changed;requestRedraw();
    },true);
    host.addEventListener('pointerup',e=>{
        if(!press||press.pointer!==e.pointerId)return;const old=press;press=null;e.preventDefault();e.stopImmediatePropagation();isDragging=false;if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);
        if(!enabled()){restore(old.snapshot);requestRedraw();return;}if(old.moved){if(old.changed){activeDeviceIds.clear();saveStateToHistory();triggerAutoSave();}requestRedraw();return;}
        const floor=old.floor,p=point(e),beforeNodes=floor.devices.length,beforeCables=floor.cables.length;let node=old.hit;
        if(old.drawing){if(!node){node=old.line?junction(floor,old.line):{id:genId(),type:'trunkJunction',ownerApplication:APP_PRODUCT,x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10,rotation:0};if(!old.line)floor.devices.push(node);}const previous=floor.devices.find(d=>d.id===trunkStart),cable=connect(floor,previous,node,'trunk');trunkStart=node.id;activeDeviceIds.clear();selectTrunkForEditing(floor,cable?.id||node.attachedCableId||floor.cables.find(c=>c.kind==='trunk'&&(c.fromId===node.id||c.toId===node.id))?.id,node.id);}
        else{if(!node)node=old.line?junction(floor,old.line):null;if(!node)return;const previous=activeDeviceIds.size===1?floor.devices.find(d=>activeDeviceIds.has(d.id)):null;if(previous&&previous.type!=='trunkJunction')connect(floor,previous,node);activeDeviceIds.clear();activeDeviceIds.add(node.id);const carrier=node.attachedCableId||old.line?.cable.id||floor.cables.find(c=>c.kind==='trunk'&&(c.fromId===node.id||c.toId===node.id))?.id;selectTrunkForEditing(floor,carrier,node.id);}
        if(floor.devices.length!==beforeNodes||floor.cables.length!==beforeCables){calculateDynamicNumbersGlobal(floors);saveStateToHistory();triggerAutoSave();}requestRedraw();
    },true);
    host.addEventListener('pointercancel',e=>{if(!press||press.pointer!==e.pointerId)return;restore(press.snapshot);press=null;isDragging=false;requestRedraw();},true);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){trunkStart=null;activeTrunkEdit=null;if(press){restore(press.snapshot);press=null;isDragging=false;}requestRedraw();}});
    document.addEventListener('click',e=>{const button=e.target.closest('.device-btn[data-type]');if(button){trunkStart=null;activeTrunkEdit=null;if(button.dataset.type==='trunkTool'&&floors[currentFloorIndex]){floors[currentFloorIndex].showConnections=true;updateConnectionButton();}requestRedraw();}},true);
    const modal=document.createElement('div');modal.className='modal';modal.id='passageSettingsModal';modal.innerHTML='<form class="modal-content" style="max-width:420px"><div class="modal-title">Mezipodlažní průchod</div><label>Cílové podlaží<select id="passageTargetFloor" class="account-input"></select></label><label>Název<input id="passageName" class="account-input" maxlength="120"></label><div class="modal-buttons"><button type="button" class="btn-cad" id="passageCancel">Zavřít</button><button type="submit" class="btn-cad">Uložit</button></div></form>';document.body.append(modal);let editing=null;
    host.addEventListener('dblclick',e=>{if(!enabled())return;const d=findDevice(floors[currentFloorIndex],point(e));if(d?.type!=='floorPassage'||!isOwnPlanEntity(d))return;e.preventDefault();e.stopImmediatePropagation();editing=d;const select=document.getElementById('passageTargetFloor');select.replaceChildren(new Option('—',''),...floors.filter(f=>f!==floors[currentFloorIndex]).map(f=>new Option(f.name,f.name)));select.value=d.targetFloorName||'';document.getElementById('passageName').value=d.manualName||'';modal.style.display='flex';},true);
    document.getElementById('passageCancel').onclick=()=>modal.style.display='none';modal.querySelector('form').onsubmit=e=>{e.preventDefault();if(editing&&isOwnPlanEntity(editing)){editing.targetFloorName=document.getElementById('passageTargetFloor').value;editing.manualName=document.getElementById('passageName').value;saveStateToHistory();triggerAutoSave();requestRedraw();}modal.style.display='none';};
})();
function updateTrunkJunctions(floor){
 const byId=new Map(floor.devices.map(d=>[d.id,d]));for(const node of floor.devices)if(node.attachedCableId&&isOwnPlanEntity(node)){const c=floor.cables.find(c=>c.id===node.attachedCableId),a=byId.get(c?.fromId),b=byId.get(c?.toId);if(a&&b){const t=Math.max(0,Math.min(1,Number(node.attachedT)||0));node.x=a.x+(b.x-a.x)*t;node.y=a.y+(b.y-a.y)*t;}}
}
function getTrunkRouteStyle(cable=null){const shapes=Array.isArray(customDeviceIcons?.trunkTool)?customDeviceIcons.trunkTool:[];const source=cable&&!isOwnPlanEntity(cable)?cable.routeStyle:shapes.find(s=>s&&(s.routeWidth||s.routeColor));return{color:/^#[a-f0-9]{6}$/i.test(source?.routeColor||source?.color)?source.routeColor||source.color:'#38bdf8',width:Math.max(2,Math.min(24,Number(source?.routeWidth??source?.width)||8.5))};}
function drawInfrastructureDevice(context,device,baseSize,options={}){
 const size=(baseSize||16)/14;context.save();context.translate(device.x,device.y);context.strokeStyle=/^#[a-f0-9]{6}$/i.test(options.routeStyle?.color)?options.routeStyle.color:'#38bdf8';context.fillStyle=context.strokeStyle;context.lineWidth=2*size;context.beginPath();
 if(device.type==='trunkJunction'){context.arc(0,0,5/Math.max(.01,scale),0,Math.PI*2);context.fillStyle='#fff';context.fill();context.lineWidth=1.8/Math.max(.01,scale);context.stroke();}
 else{const shapes=!options.defaultIcon&&typeof getCustomDeviceShapes==='function'?getCustomDeviceShapes(device.type):null;context.save();context.rotate((device.rotation||0)*Math.PI/180);
  if(shapes?.length){context.scale(.1*size,.1*size);context.translate(-200,-200);for(const shape of shapes)drawEditorShape(context,shape);}
  else if(device.type==='trunkTool'){context.beginPath();context.moveTo(-13*size,0);context.lineTo(13*size,0);context.lineWidth=(options.routeStyle?.width?Math.min(10,Math.max(2,options.routeStyle.width)):5)*size;context.stroke();context.lineWidth=1.5*size;for(const x of [-6,6]){context.beginPath();context.moveTo(x*size,-6*size);context.lineTo(x*size,6*size);context.stroke();}}
  else{context.arc(0,0,11*size,0,Math.PI*2);context.stroke();context.beginPath();context.moveTo(-6*size,6*size);context.lineTo(6*size,-6*size);context.moveTo(0,-6*size);context.lineTo(6*size,-6*size);context.lineTo(6*size,0);context.stroke();}context.restore();
  if(!options.skipLabels){if(device.targetFloorName){context.font=10*size+'px sans-serif';context.textAlign='center';context.fillText(device.targetFloorName,0,23*size);}if(device.manualName){context.font=10*size+'px sans-serif';context.textAlign='center';context.fillText(device.manualName,0,(device.targetFloorName?37:23)*size);}}
 }context.restore();
}
