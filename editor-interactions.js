function deviceBriefName(device){
    if (device.type === 'textNode' && device.plainText === true) return tr('Text na výkresu');
    const names={pir:'PIR detektor',pir_wl:'Bezdrátový PIR',magnet:'Magnetický kontakt',magnet_wl:'Bezdrátový magnet',glassbreak:'Detektor rozbití skla',panic:'Tísňové tlačítko',siren:'Siréna',panel:'Ústředna',keypad:'Klávesnice',expander:'Expandér',abax:'ABAX',textNode:'Poznámka',deactivated:'Neaktivní detektor',ramen:'Ramen'};
    return tr(names[device.type]||'Detektor');
}
function updateConnectionButton(){
    const button=document.getElementById('btnToggleConnections'),floor=floors[currentFloorIndex];if(!button||!floor)return;
    if(!button.querySelector('.connection-button-label'))button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><path class="connection-hidden-slash" d="M3 3l18 18"/></svg><span class="connection-button-label"></span>';
    const label=tr(floor.showConnections?'Skrýt kabely':'Zobrazit kabely');
    button.querySelector('.connection-button-label').textContent=label;
    button.querySelector('.connection-hidden-slash').style.visibility=floor.showConnections?'hidden':'visible';
    button.setAttribute('aria-pressed',String(floor.showConnections));button.setAttribute('aria-label',label);
}
function updateDeviceHover(event,x,y){
    const tooltip=document.getElementById('deviceTooltip');
    if(suppressedDeviceTooltipPoint&&Math.hypot(event.clientX-suppressedDeviceTooltipPoint.x,event.clientY-suppressedDeviceTooltipPoint.y)>4)suppressedDeviceTooltipPoint=null;
    if(isPanning||isDragging||isSelecting||event.pointerType==='touch'||event.buttons||suppressedDeviceTooltipPoint){
        tooltip.style.opacity='0';container.style.cursor=isPanning?'grabbing':'crosshair';
        if(window.hoveredDeviceId!==null){window.hoveredDeviceId=null;requestRedraw();}return;
    }
    const floor=floors[currentFloorIndex];if(!floor)return;
    const size=Number(document.getElementById('deviceSizeSlider').value)/14,labelScale=1+(size-1)*.5;
    let found;
    for(let i=floor.devices.length-1;i>=0;i--){
        const device=floor.devices[i];if(!showDeactivatedDevices&&device.type==='deactivated')continue;
        let hit;
        if(device.type==='textNode') hit=hitTestPlanTextNode(device,x,y,labelScale);
        else hit=Math.abs(device.x-x)<22*size&&Math.abs(device.y-y)<22*size;
        if(hit){found=device;break;}
    }
    const hovered=found?.id||null;
    if(window.hoveredDeviceId!==hovered){window.hoveredDeviceId=hovered;requestRedraw();}
    if(!found){tooltip.style.opacity='0';container.style.cursor='crosshair';return;}
    container.style.cursor='pointer';
    document.getElementById('ttType').textContent=deviceBriefName(found);
    const parts=getDeviceAddressParts(found),address=parts.prefix+parts.number;
    document.getElementById('ttNumber').textContent=address;document.getElementById('ttNumber').hidden=!address;
    document.getElementById('ttLoop').hidden=true;document.getElementById('ttName').hidden=true;
    tooltip.style.opacity='1';
    const width=tooltip.offsetWidth,height=tooltip.offsetHeight;
    tooltip.style.left=Math.max(12,Math.min(innerWidth-width-12,event.clientX+16))+'px';
    tooltip.style.top=Math.max(12,Math.min(innerHeight-height-12,event.clientY+16))+'px';
}

let rotationHandleSignature='';
function updateDeviceRotationHandles(visible,items){
    const handles=document.getElementById('tabletRotationHandles');
    const device=items.length===1?items[0]:null;
    const x=device?device.x*scale+offsetX:0,y=device?device.y*scale+offsetY:0;
    const shown=visible&&!!device&&!window.tabletPanMode&&x>=0&&y>=0&&x<=container.clientWidth&&y<=container.clientHeight;
    const radius=Math.min(92,Math.max(48,Number(document.getElementById('deviceSizeSlider').value)*scale+32));
    const theme=floors[currentFloorIndex]?getPlanTheme(floors[currentFloorIndex]):'dark';
    const signature=[shown,device?.id,x,y,radius,container.clientWidth,container.clientHeight,theme,getGoomLanguage()].join(':');
    if(signature===rotationHandleSignature)return;rotationHandleSignature=signature;handles.hidden=!shown;handles.dataset.theme=theme;if(!shown)return;
    for(const button of handles.querySelectorAll('button')){
        const direction=Number(button.dataset.rotateDirection);
        button.style.left=Math.max(24,Math.min(container.clientWidth-24,x+direction*radius))+'px';
        button.style.top=Math.max(24,Math.min(container.clientHeight-24,y-radius*.48))+'px';
        button.setAttribute('aria-label',tr(direction<0?'Otočit doleva':'Otočit doprava'));
    }
}
const rotationHandles=document.getElementById('tabletRotationHandles');
rotationHandles.addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-rotate-direction]');if(!button||!isSystemReady)return;
    event.preventDefault();event.stopPropagation();button.setPointerCapture(event.pointerId);clearCanvasDrag();
    stopDeviceRotation();startDeviceRotation(Number(button.dataset.rotateDirection),15);
});
rotationHandles.addEventListener('pointerup',event=>{event.preventDefault();event.stopPropagation();stopDeviceRotation();});
rotationHandles.addEventListener('pointercancel',()=>stopDeviceRotation());
rotationHandles.addEventListener('lostpointercapture',()=>stopDeviceRotation());
rotationHandles.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
rotationHandles.addEventListener('keydown',event=>{
    const button=event.target.closest('[data-rotate-direction]');if(!button||!['Enter',' '].includes(event.key)||event.repeat)return;
    event.preventDefault();startDeviceRotation(Number(button.dataset.rotateDirection),15);stopDeviceRotation();
});
