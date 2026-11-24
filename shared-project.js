const sharedDeviceKinds={"EPS":{"panel":"control","eps_smoke":"detector","eps_heat":"detector","eps_heat_rise":"detector","eps_multi":"detector","eps_co":"detector","eps_flame_ir":"flame","eps_flame_uv":"flame","eps_flame_dual":"flame","eps_beam_tx":"beam","eps_beam_rx":"beam","eps_beam_reflector":"beam","eps_aspirating":"detector","eps_duct":"detector","eps_linear_heat":"detector","eps_manual":"manual","eps_sounder":"signal","eps_beacon":"signal","eps_sounder_beacon":"signal","eps_voice":"signal","eps_remote_indicator":"signal","eps_input":"module","eps_output":"module","eps_io":"module","eps_relay":"module","eps_isolator":"module","eps_psu":"control","eps_repeater":"control","eps_door_holder":"actuator","eps_damper":"actuator","eps_extinguishing":"actuator"},"SK":{"panel":"rack","sk_router":"active","sk_firewall":"active","sk_switch":"active","sk_poe_switch":"active","sk_core_switch":"active","sk_patch_panel":"passive","sk_fiber_panel":"fiber","sk_media_converter":"fiber","sk_ont":"fiber","sk_modem":"active","sk_access_point":"wireless","sk_mesh":"wireless","sk_bridge":"wireless","sk_antenna":"wireless","sk_outlet":"endpoint","sk_outlet_dual":"endpoint","sk_fiber_outlet":"fiber","sk_floor_box":"endpoint","sk_cp":"passive","sk_server":"server","sk_nas":"server","sk_ups":"power","sk_pdu":"power","sk_pc":"client","sk_printer":"client","sk_ip_phone":"client","sk_isp":"provider","sk_wifi_controller":"active","sk_fiber_splitter":"fiber","sk_splice_box":"fiber"}};
function sharedRouteColor(app,a,b){const kinds=[sharedDeviceKinds[app]?.[a?.type],sharedDeviceKinds[app]?.[b?.type]];if(app==='EPS')return kinds.includes('actuator')?'#a78bfa':kinds.includes('signal')?'#fbbf24':kinds.every(k=>['control','module'].includes(k))?'#38bdf8':'#ef4444';if(app==='SK')return kinds.includes('fiber')?'#fbbf24':kinds.includes('power')?'#94a3b8':'#38bdf8';return cableRouteColor(a||{},b||{});}
let projectApplicationIcons={},projectApplicationSettings={};
function projectDeviceSizeFromData(data){projectApplicationSettings={...(data.applicationSettings||{}),[data.application||'PZTS']:{...(data.applicationSettings?.[data.application||'PZTS']||{}),deviceSize:data.applicationSettings?.[data.application||'PZTS']?.deviceSize||data.deviceSize||16}};currentMaxLines=projectApplicationSettings[APP_PRODUCT]?.currentMaxLines||(data.application===APP_PRODUCT?data.currentMaxLines:10)||10;return projectApplicationSettings[APP_PRODUCT]?.deviceSize||16;}
const sharedSymbolCache=new Map();
function projectIconsFromData(data){projectApplicationIcons={...(data.applicationIcons||{}),...(!data.applicationIcons?.[data.application||'PZTS']?{[data.application||'PZTS']:sanitizeProjectIcons(data.customDeviceIcons)}:{})};return sanitizeProjectIcons(projectApplicationIcons[APP_PRODUCT]);}
// The editing boundary is the originating application, not the sheet's display theme.
const GOOM_APPLICATIONS=new Set(['PZTS','EPS','CCTV','SK']);
const isOwnPlanEntity=entity=>!entity?.ownerApplication||entity.ownerApplication===APP_PRODUCT;
const isInfrastructureDevice=device=>['floorPassage','trunkJunction'].includes(device?.type);
const sharedSymbolImages=new Map();
const sharedSymbolMethods=new Set(['save','restore','beginPath','closePath','moveTo','lineTo','rect','roundRect','arc','ellipse','bezierCurveTo','quadraticCurveTo','translate','scale','rotate','transform','setTransform','resetTransform','fill','stroke','fillRect','strokeRect','fillText','setLineDash']);
const sharedSymbolProperties=new Set(['fillStyle','strokeStyle','lineWidth','lineCap','lineJoin','font','textAlign','textBaseline','globalAlpha','shadowColor','shadowBlur']);
function sanitizeSharedSymbol(symbol){
    if(!symbol||!Array.isArray(symbol.ops)||symbol.ops.length>700)return null;
    const ops=symbol.ops.filter(op=>Array.isArray(op)&&op.length<14&&(
        op[0]==='property'?sharedSymbolProperties.has(op[1])&&['string','number'].includes(typeof op[2])&&String(op[2]).length<200&&!/url\(|javascript:/i.test(String(op[2]))
        :op[0]==='image'?typeof op[1]==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(op[1])&&op[1].length<2800000&&op.slice(2).every(Number.isFinite)
        :sharedSymbolMethods.has(op[0])&&op.slice(1).every(v=>typeof v==='number'?Number.isFinite(v)&&Math.abs(v)<1e7:typeof v==='boolean'?true:typeof v==='string'?v.length<500:Array.isArray(v)&&v.length<30&&v.every(Number.isFinite))));
    return {ops,stock:symbol.stock===true,size:Math.max(5,Math.min(80,Number(symbol.size)||14)),address:{prefix:String(symbol.address?.prefix||'').slice(0,20),number:String(symbol.address?.number||'').slice(0,30)},color:/^#[a-f0-9]{3,8}$/i.test(symbol.color)?symbol.color:'#8b9caa'};
}
function recordSharedSymbol(device,size=Number(document.getElementById('deviceSizeSlider')?.value)||14,shapes=null){
    const shapeSource=shapes||window.getCustomDeviceShapes?.(device.type),asset=window.epsSymbolAssets?.get(device.type)||window.skSymbolAssets?.get(device.type),key=APP_PRODUCT+':'+device.type+':'+size,cached=sharedSymbolCache.get(key);
    if(cached&&cached.shapeSource===shapeSource&&cached.asset===asset)return{...cached.symbol,address:getDeviceAddressParts(device)};
    const surface=document.createElement('canvas');surface.width=surface.height=128;const target=surface.getContext('2d'),ops=[];
    const recorder=new Proxy(target,{set(object,key,value){if(sharedSymbolProperties.has(key))ops.push(['property',key,value]);object[key]=value;return true;},get(object,key){
        if(key==='drawImage')return(image,...args)=>{const canvas=document.createElement('canvas');const ratio=Math.min(1,512/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height));canvas.width=Math.max(1,Math.round((image.naturalWidth||image.width)*ratio));canvas.height=Math.max(1,Math.round((image.naturalHeight||image.height)*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);ops.push(['image',canvas.toDataURL('image/png'),...args]);};
        const value=object[key];if(typeof value!=='function')return value;
        return(...args)=>{if(sharedSymbolMethods.has(key))ops.push([key,...args]);return value.apply(object,args);};
    }});
    const normalized={...device,x:0,y:0,rotation:0};
    if(shapes?.length){recorder.save();recorder.scale(.1*size/14,.1*size/14);recorder.translate(-200,-200);for(const shape of shapes)drawEditorShape(recorder,shape);recorder.restore();}
    else drawDevice(recorder,normalized,true,'original',{baseSize:size,skipLabels:true,portableCapture:true});
    const symbol=sanitizeSharedSymbol({ops,size,address:getDeviceAddressParts(device),color:COLORS[device.type]||'#8b9caa'});sharedSymbolCache.set(key,{shapeSource,asset,symbol});return symbol;
}
function snapshotPlanDevice(device){
    const ownerApplication=device.ownerApplication||APP_PRODUCT;
    const snapshot={...device,ownerApplication};
    if(isOwnPlanEntity(device)&&device.type!=='textNode')snapshot.portableSymbol=recordSharedSymbol(device);
    return snapshot;
}
async function prepareSharedProject(data){
    const application=GOOM_APPLICATIONS.has(data?.application)?data.application:'PZTS';
    const input=Array.isArray(data)?data:data.floors||data.fData||[data];
    const prepared=input.map(floor=>{const legends=sanitizeForeignLegends([...(floor.foreignLegends||[]),...(floor.legend?[{...floor.legend,ownerApplication:floor.legend.ownerApplication||application}]:[])]);const applicationReservations={...(floor.applicationReservations||{}),[application]:floor.applicationReservations?.[application]||floor.addressReservations||[]};return({...floor,applicationReservations,addressReservations:applicationReservations[APP_PRODUCT]||[],legend:legends.find(l=>l.ownerApplication===APP_PRODUCT)||null,foreignLegends:legends.filter(l=>l.ownerApplication!==APP_PRODUCT),devices:(floor.devices||[]).map(device=>{
        const ownerApplication=GOOM_APPLICATIONS.has(device.ownerApplication)?device.ownerApplication:application;
        let symbol=sanitizeSharedSymbol(device.portableSymbol);
        if(!symbol&&ownerApplication!==APP_PRODUCT){
            const stock=window.GOOM_SHARED_SYMBOLS?.[ownerApplication]?.[device.type];
            if(data.customDeviceIcons?.[device.type]?.length)symbol=recordSharedSymbol(device,Number(data.deviceSize)||14,sanitizeIconShapes(data.customDeviceIcons[device.type]));
            else if(stock)symbol=sanitizeSharedSymbol({...stock,size:Number(data.deviceSize)||stock.size});
            if(symbol)symbol.address={prefix:device.number&&!['panel','textNode','deactivated'].includes(device.type)?`${device.loopId||1}/`:'',number:device.number?String(device.number):''};
        }
        return {...device,ownerApplication,...(symbol?{portableSymbol:symbol}:{})};
    }),cables:(floor.cables||[]).map(cable=>({...cable,ownerApplication:GOOM_APPLICATIONS.has(cable.ownerApplication)?cable.ownerApplication:application,routeColor:cable.routeColor||sharedRouteColor(cable.ownerApplication||application,floor.devices?.find(d=>d.id===cable.fromId),floor.devices?.find(d=>d.id===cable.toId))}))});});
    await Promise.all(prepared.flatMap(f=>f.devices).flatMap(d=>(d.portableSymbol?.ops||[]).filter(op=>op[0]==='image').map(async op=>{if(sharedSymbolImages.has(op[1]))return;const image=new Image();sharedSymbolImages.set(op[1],image);image.src=op[1];await image.decode().catch(()=>{});} )));
    return prepared;
}
function drawForeignPlanDevice(context,device){
    const symbol=device.portableSymbol;
    if(device.type==='textNode'){const size=Number(device.textSize)||13;context.save();context.fillStyle='#8b9caa';context.font=`${size}px sans-serif`;context.fillText(String(device.manualName||''),device.x,device.y);context.restore();return;}
    context.save();context.translate(device.x,device.y);context.rotate((device.rotation||0)*Math.PI/180);
    if(symbol){
        // Legacy stock symbols were captured at 14; new symbols retain their saved size.
        const factor=symbol.stock?symbol.size/14:1;context.scale(factor,factor);
        for(const op of symbol.ops){if(op[0]==='property')context[op[1]]=op[2];else if(op[0]==='image'){const image=sharedSymbolImages.get(op[1]);if(image?.complete&&image.naturalWidth)context.drawImage(image,...op.slice(2));}else if(typeof context[op[0]]==='function')context[op[0]](...op.slice(1));}
    }else{context.strokeStyle='#8b9caa';context.lineWidth=2;context.strokeRect(-13,-13,26,26);context.fillStyle='#8b9caa';context.font='9px sans-serif';context.fillText(device.ownerApplication||'',-12,4);}
    context.restore();
    const label=symbol?.address,number=(label?.prefix||'')+(label?.number||'');
    context.save();context.textAlign='left';context.textBaseline='middle';context.font='bold 11px sans-serif';
    if(number){const w=context.measureText(number).width;context.fillStyle='#17191c';context.fillRect(device.x+17,device.y+13,w+8,18);context.fillStyle='#fff';context.fillText(number,device.x+21,device.y+22);}
    if(device.manualName){context.fillStyle=symbol?.color||'#8b9caa';context.font='11px sans-serif';context.fillText(device.manualName,device.x+19,device.y+(number?43:24));}context.restore();
}

function sanitizeForeignLegends(legends){return Array.isArray(legends)?legends.slice(0,8).filter(l=>l&&GOOM_APPLICATIONS.has(l.ownerApplication)&&Number.isFinite(l.x)&&Number.isFinite(l.y)&&Array.isArray(l.entries)).map(l=>({...l,entries:l.entries.slice(0,50).filter(e=>e&&typeof e.type==='string'&&typeof e.label==='string').map(e=>({...e,label:e.label.slice(0,160)}))})):[];}
function drawForeignLegends(context,floor){for(const legend of floor.foreignLegends||[]){if(legend.visible===false)continue;context.save();context.translate(legend.x,legend.y);const size=Math.max(.01,Math.min(100,Number(legend.scale)||1));context.scale(size,size);context.fillStyle='#7e909b';context.font='bold 13px sans-serif';context.fillText(legend.ownerApplication,0,12);context.font='12px sans-serif';legend.entries.forEach((entry,index)=>context.fillText('— '+entry.label,0,38+index*24));context.restore();}}
