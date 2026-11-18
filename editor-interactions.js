function deviceBriefName(device){
    if (device.type === 'textNode' && device.plainText === true) return tr('Text na výkresu');
    const names={pir:'PIR detektor',pir_wl:'Bezdrátový PIR',magnet:'Magnetický kontakt',magnet_wl:'Bezdrátový magnet',glassbreak:'Detektor rozbití skla',panic:'Tísňové tlačítko',siren:'Siréna',panel:'Ústředna',keypad:'Klávesnice',expander:'Expandér',abax:'ABAX',textNode:'Poznámka',deactivated:'Neaktivní detektor',...ADDITIONAL_DEVICE_LABELS};
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

const detectorSearchButton = document.getElementById('btnDetectorSearch');
const detectorSearchModal = document.getElementById('detectorSearchModal');
const detectorSearchForm = document.getElementById('detectorSearchForm');
const detectorSearchBus = document.getElementById('detectorSearchBus');
const detectorSearchNumber = document.getElementById('detectorSearchNumber');
const detectorSearchStatus = document.getElementById('detectorSearchStatus');
const detectorSearchResults = document.getElementById('detectorSearchResults');
let detectorSearchMatch = null;

function clearDetectorSearchHighlight() {
    if (!detectorSearchMatch) return;
    detectorSearchMatch = null;
    requestRedraw();
}

function drawDetectorSearchHighlight(context, floor) {
    if (detectorSearchMatch?.floor !== floor || !floor.devices.includes(detectorSearchMatch.device)) return;
    const { x, y } = detectorSearchMatch.device;
    const radius = Math.max(20 / scale, Number(deviceSizeSlider.value) * 1.85);
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.strokeStyle = '#243317';
    context.lineWidth = 5 / scale;
    context.stroke();
    context.strokeStyle = '#82d322';
    context.lineWidth = 2.5 / scale;
    context.stroke();
    context.restore();
}

function closeDetectorSearch() {
    detectorSearchModal.style.display = 'none';
    if (!detectorSearchButton.hidden) detectorSearchButton.focus({ preventScroll: true });
}

function showDetectorSearchMatch(match) {
    if (!window.hasProAccess?.() || !isSystemReady || floors[match.index] !== match.floor
        || !match.floor.devices.includes(match.device)) return;
    closeDetectorSearch();
    resetPlacementTool();
    if (currentFloorIndex !== match.index) {
        currentFloorIndex = match.index;
        changeFloor();
    }
    detectorSearchMatch = match;
    requestRedraw();
    // Let the modal close before starting the camera animation.
    requestAnimationFrame(() => {
        if (detectorSearchMatch !== match || currentFloorIndex !== match.index || isOverviewMode) return;
        const width = planCanvasWidth(), height = planCanvasHeight();
        const { x, y } = match.device;
        const left = x * scale + offsetX, top = y * scale + offsetY;
        const margin = Math.min(width / 4, height / 4, Math.max(30, Number(deviceSizeSlider.value) * 2 * scale));
        if (left >= margin && left <= width - margin && top >= margin && top <= height - margin) return;
        animatePlanCamera({ scale, offsetX: width / 2 - x * scale, offsetY: height / 2 - y * scale });
        triggerAutoSave();
    });
}

function resetDetectorSearchResults() {
    detectorSearchStatus.hidden = true;
    detectorSearchResults.hidden = true;
    detectorSearchResults.replaceChildren();
}

detectorSearchButton.addEventListener('click', () => {
    if (!window.hasProAccess?.() || !isSystemReady || isOverviewMode) return;
    resetDetectorSearchResults();
    detectorSearchBus.value = Number(loopSelect.value) || 1;
    detectorSearchNumber.value = '';
    detectorSearchModal.style.display = 'flex';
    detectorSearchNumber.focus();
});
document.getElementById('btnCloseDetectorSearch').addEventListener('click', closeDetectorSearch);
detectorSearchModal.addEventListener('click', event => {
    if (event.target === detectorSearchModal) closeDetectorSearch();
});
detectorSearchModal.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    closeDetectorSearch();
});
detectorSearchForm.addEventListener('input', resetDetectorSearchResults);
detectorSearchForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!window.hasProAccess?.() || !isSystemReady) return;
    resetDetectorSearchResults();
    clearDetectorSearchHighlight();
    const prefix = `${detectorSearchBus.valueAsNumber}/`;
    const number = String(detectorSearchNumber.valueAsNumber);
    const matches = floors.flatMap((floor, index) => floor.devices.filter(device => {
        const address = getDeviceAddressParts(device);
        return address.prefix === prefix && address.number === number;
    }).map(device => ({ floor, index, device })));
    if (matches.length === 1) {
        showDetectorSearchMatch(matches[0]);
        return;
    }
    detectorSearchStatus.textContent = tr(APP_PRODUCT === 'CCTV'
        ? (matches.length ? 'Vyberte kameru s adresou {0}.' : 'Kamera s adresou {0} nebyla nalezena.')
        : (matches.length ? 'Vyberte detektor s adresou {0}.' : 'Detektor s adresou {0} nebyl nalezen.'), prefix + number);
    detectorSearchStatus.hidden = false;
    if (!matches.length) return;
    for (const match of matches) {
        const row = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-cad';
        button.textContent = match.floor.name + ' · ' + deviceBriefName(match.device);
        button.dataset.userContent = '';
        button.addEventListener('click', () => showDetectorSearchMatch(match));
        row.append(button);
        detectorSearchResults.append(row);
    }
    detectorSearchResults.hidden = false;
});

function syncDetectorSearchAccess() {
    detectorSearchButton.hidden = !window.hasProAccess?.();
    if (detectorSearchButton.hidden) {
        closeDetectorSearch();
        clearDetectorSearchHighlight();
    }
}
document.addEventListener('goom-account-changed', syncDetectorSearchAccess);
syncDetectorSearchAccess();
