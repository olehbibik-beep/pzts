// ==========================================
// 6. UI A EVENTY (APP)
// ==========================================

document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('dragstart', event => {
    if (event.target instanceof Element && event.target.closest('img')) {
        event.preventDefault();
    }
});

const appTooltip = document.createElement('div');
appTooltip.className = 'app-tooltip';
appTooltip.setAttribute('role', 'tooltip');
document.body.appendChild(appTooltip);

let activeTooltipTarget = null;
let suppressedTooltipTarget = null;
let suppressedDeviceTooltipPoint = null;
function moveAppTooltip(target) {
    const rect = target.getBoundingClientRect();
    const left = Math.max(8, Math.min(
        rect.left + (rect.width - appTooltip.offsetWidth) / 2,
        window.innerWidth - appTooltip.offsetWidth - 8
    ));
    const top = rect.bottom + appTooltip.offsetHeight + 8 > window.innerHeight
        ? Math.max(8, rect.top - appTooltip.offsetHeight - 8)
        : rect.bottom + 8;
    appTooltip.style.left = `${left}px`;
    appTooltip.style.top = `${top}px`;
}

function showAppTooltip(target) {
    const text = target.getAttribute('data-tooltip');
    if (!text || activeTooltipTarget === target || suppressedTooltipTarget === target) return;
    if (document.querySelector('[data-modal-open="true"]') && !target.closest('[data-modal-open="true"]')) return;
    activeTooltipTarget = target;
    appTooltip.textContent = text;
    appTooltip.style.display = 'block';
    moveAppTooltip(target);
}

function hideAppTooltip(target) {
    if (activeTooltipTarget !== target) return;
    activeTooltipTarget = null;
    appTooltip.style.display = 'none';
}

window.clearGoomTooltips = event => {
    suppressedTooltipTarget = activeTooltipTarget || (event?.target instanceof Element ? event.target.closest('[data-tooltip]') : null) || suppressedTooltipTarget;
    activeTooltipTarget = null;
    appTooltip.style.display = 'none';
    const tooltip = document.getElementById('deviceTooltip');
    if (tooltip) tooltip.style.opacity = '0';
    const previouslyHovered = window.hoveredDeviceId;
    window.hoveredDeviceId = null;
    if (previouslyHovered != null) requestRedraw();
    if (Number.isFinite(event?.clientX)) suppressedDeviceTooltipPoint = { x: event.clientX, y: event.clientY };
};
document.addEventListener('pointerdown', window.clearGoomTooltips, true);
document.addEventListener('change', window.clearGoomTooltips, true);
document.addEventListener('click', window.clearGoomTooltips, true);
document.addEventListener('keydown', event => { if (['Enter', ' ', 'Escape'].includes(event.key)) window.clearGoomTooltips(event); }, true);
document.addEventListener('scroll', window.clearGoomTooltips, true);
window.addEventListener('blur', window.clearGoomTooltips);

function registerTooltips(root) {
    if (root.nodeType === Node.ELEMENT_NODE && root.hasAttribute('title')) {
        const title = root.getAttribute('title');
        root.setAttribute('data-tooltip', title);
        if (!root.hasAttribute('aria-label') && ['BUTTON', 'A'].includes(root.tagName)) {
            root.setAttribute('aria-label', title);
        }
        root.removeAttribute('title');
    }
    if (root.querySelectorAll) {
        root.querySelectorAll('[title]').forEach(registerTooltips);
    }
}

registerTooltips(document);
const tooltipObserver = new MutationObserver(records => {
    records.forEach(record => {
        if (record.type === 'attributes') registerTooltips(record.target);
        record.addedNodes.forEach(registerTooltips);
    });
});
tooltipObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });

document.addEventListener('pointerover', e => {
    if(e.pointerType==='touch')return;
    const target = e.target instanceof Element ? e.target.closest('[data-tooltip]') : null;
    if (!target) return;
    showAppTooltip(target);
});
document.addEventListener('pointerout', e => {
    if (suppressedTooltipTarget && e.target instanceof Element && suppressedTooltipTarget.contains(e.target) && !suppressedTooltipTarget.contains(e.relatedTarget)) suppressedTooltipTarget = null;
    if (!activeTooltipTarget || !(e.target instanceof Element) || !activeTooltipTarget.contains(e.target)) return;
    if (e.relatedTarget instanceof Node && activeTooltipTarget.contains(e.relatedTarget)) return;
    hideAppTooltip(activeTooltipTarget);
});
document.addEventListener('focusin', e => {
    const target = e.target instanceof Element ? e.target.closest('[data-tooltip]') : null;
    if (!target) return;
    showAppTooltip(target);
});
document.addEventListener('focusout', e => {
    if (activeTooltipTarget && e.target instanceof Element && activeTooltipTarget.contains(e.target)) {
        hideAppTooltip(activeTooltipTarget);
    }
});

function updateLoopSelect() {
    const currentVal = loopSelect.value; loopSelect.innerHTML = '';
    for(let i=1; i<=currentMaxLines; i++) {
        let opt = document.createElement('option'); opt.value = i;
        opt.textContent = tr(APP_PRODUCT === 'CCTV' ? 'Skupina {0}' : 'Sběrnice {0}', i);
        loopSelect.appendChild(opt);
    }
    const addOpt = document.createElement('option'); addOpt.value = 'add'; addOpt.textContent = tr('+ Přidat'); loopSelect.appendChild(addOpt);
    if (currentVal && currentVal !== 'add' && currentVal <= currentMaxLines) loopSelect.value = currentVal; else loopSelect.value = 1;
}

loopSelect.addEventListener('change', (e) => {
    if (e.target.value === 'add') { currentMaxLines++; updateLoopSelect(); loopSelect.value = currentMaxLines; triggerAutoSave(); }
});

const deviceSizeSlider = document.getElementById('deviceSizeSlider');
if (deviceSizeSlider) deviceSizeSlider.addEventListener('input', requestRedraw);

const pirToggle = document.getElementById('togglePirCoverage');
function isPirCoverageVisible() {
    return pirToggle?.getAttribute('aria-pressed') !== 'false';
}
function setPirCoverageVisible(visible) {
    if (!pirToggle) return;
    const label = tr(APP_PRODUCT === 'CCTV' ? (visible ? 'Skrýt zorná pole' : 'Zobrazit zorná pole')
        : (visible ? 'Скрыть зоны PIR' : 'Показать зоны PIR'));
    pirToggle.setAttribute('aria-pressed', String(visible));
    pirToggle.setAttribute('aria-label', label);
    pirToggle.title = label;
}
if (pirToggle) {
    pirToggle.addEventListener('click', () => {
        setPirCoverageVisible(!isPirCoverageVisible());
        requestRedraw();
        if (isSystemReady) triggerAutoSave();
    });
}

const planGridToggle = document.getElementById('togglePlanGrid');
if (planGridToggle) {
    planGridToggle.addEventListener('click', () => {
        const enabled = planGridToggle.getAttribute('aria-pressed') !== 'true';
        planGridToggle.setAttribute('aria-pressed', String(enabled));
        planGridToggle.setAttribute('aria-label', enabled ? tr('Выключить сетку') : tr('Включить сетку'));
        requestRedraw();
    });
}

const detectionSettingsModal = document.getElementById('detectionSettingsModal');

let wallSettingsSession=null,wallPreviewTimer;
function wallSliderThreshold(){return Math.max(0,Math.min(1000,Number(document.getElementById('wallThresholdInput').value)))*255/1000;}
function refreshWallSensitivityLabel(){document.getElementById('wallSensitivityValue').textContent=Math.round(Number(document.getElementById('wallThresholdInput').value)/10)+' %';}
function openDetectionSettings(){
    const floor=floors[currentFloorIndex];if(!floor)return;
    wallSettingsSession={floor,mask:floor.wallMask,theme:getPlanTheme(floor)};
    document.getElementById('wallThresholdInput').value=Math.round(floor.wallThreshold/255*1000);
    document.getElementById('planThemeInput').value=getPlanTheme(floor);
    document.getElementById('wallPreviewInput').checked=!!floor.previewWalls;
    refreshWallSensitivityLabel();window.refreshGoomSelects?.();detectionSettingsModal.style.display='flex';
}
function cancelWallSettings(){
    clearTimeout(wallPreviewTimer);
    if(wallSettingsSession){wallSettingsSession.floor.wallMask=wallSettingsSession.mask;wallSettingsSession.floor.planTheme=wallSettingsSession.theme;wallSettingsSession=null;requestRedraw();}
}
function applyWallPreview(){
    if(!wallSettingsSession||detectionSettingsModal.style.display!=='flex')return;
    try{wallSettingsSession.floor.wallMask=createWallMask(wallSettingsSession.floor,wallSliderThreshold());requestRedraw();}
    catch(error){console.warn('Wall preview:',error);}
}
document.getElementById('btnDetectionSettings').addEventListener('click',openDetectionSettings);
document.getElementById('wallThresholdInput').addEventListener('input',()=>{
    refreshWallSensitivityLabel();clearTimeout(wallPreviewTimer);wallPreviewTimer=setTimeout(applyWallPreview,80);
});
document.getElementById('planThemeInput').addEventListener('change',async event=>{
    const session=wallSettingsSession,theme=event.target.value;if(!session)return;
    const endTheme=window.startGoomBusy?.();
    try{await window.goomBusyPaint?.();if(wallSettingsSession!==session||document.getElementById('planThemeInput').value!==theme)return;
        const floor=session.floor;if(['light','cartoon'].includes(theme)&&floor.image){await ensureMapSceneForFloor(floor);if(wallSettingsSession!==session||document.getElementById('planThemeInput').value!==theme)return;getLightPlanImage(floor.image,floor.satellite||false,theme==='cartoon');}
        floor.planTheme=theme;requestRedraw();
    }finally{endTheme?.();}
});
document.getElementById('wallPreviewInput').addEventListener('change',event=>{if(floors[currentFloorIndex])floors[currentFloorIndex].previewWalls=event.target.checked;requestRedraw();});
document.getElementById('btnCloseDetectionSettings').addEventListener('click',()=>{cancelWallSettings();detectionSettingsModal.style.display='none';});
new MutationObserver(()=>{if(detectionSettingsModal.style.display==='none')cancelWallSettings();}).observe(detectionSettingsModal,{attributes:true,attributeFilter:['style']});
document.getElementById('btnSaveDetectionSettings').addEventListener('click',()=>{
    const floor=wallSettingsSession?.floor;if(!floor)return;
    clearTimeout(wallPreviewTimer);
    try{floor.wallMask=createWallMask(floor,wallSliderThreshold());}
    catch(error){showAppAlert(error.message,tr('Ошибка распознавания стен'));return;}
    floor.wallThreshold=wallSliderThreshold();floor.planTheme=document.getElementById('planThemeInput').value;floor.pirRangePixels=300;
    floor.devices.filter(d=>['pir','pir_wl','glassbreak'].includes(d.type)).forEach(d=>d.pirRangePixels=300);
    wallSettingsSession=null;detectionSettingsModal.style.display='none';saveStateToHistory();triggerAutoSave();requestRedraw();
});

let hBtn = document.getElementById('helpBtn');
if(hBtn) hBtn.addEventListener('click', () => { document.getElementById('helpPanel').classList.toggle('open'); });

document.getElementById('deviceSelector').addEventListener('click', (e) => {
    const btn = e.target.closest('.device-btn');
    if(!btn || btn.id === 'btnToggleConnections') return;
    
    document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active')); 
    btn.classList.add('active');
    selectedTool = btn.dataset.type;
    window.tabletPanMode = false;
    if (selectedTool === 'plainText') {
        stopDeviceRotation();
        activeDeviceIds.clear();
        requestRedraw();
        return;
    }

    stopDeviceRotation();
    activeDeviceIds.clear();
    requestRedraw();
});

let bToggleConnections = document.getElementById('btnToggleConnections');
if(bToggleConnections) {
    bToggleConnections.addEventListener('click', () => {
        if(isOverviewMode) return;
        floors[currentFloorIndex].showConnections = !floors[currentFloorIndex].showConnections; 
        updateConnectionButton();
        saveStateToHistory(); requestRedraw(); triggerAutoSave();
    });
}

const modals = document.querySelectorAll('.modal');
modals.forEach(modal => { modal.addEventListener('click', (e) => { if (e.target === modal) { if (modal.id === 'welcomeModal' && !isSystemReady) return; if (modal.id === 'textModal') closeTextModal(); else modal.style.display = 'none'; } }); });

document.getElementById('btnLogo').addEventListener('click', () => document.getElementById('mainMenuModal').style.display = 'flex');

window.openNewProjectNamingModal = function() {
    let npModal = document.getElementById('newProjectModal');
    let npInput = document.getElementById('newProjectNameInput');
    if (npModal && npInput) { npInput.value = tr("Nový projekt"); npModal.style.display = 'flex'; setTimeout(() => npInput.select(), 50); }
};

let btnMenuNew = document.getElementById('btnMenuNew');
if (btnMenuNew) {
    btnMenuNew.addEventListener('click', async () => {
        if (await showAppConfirm(tr("Opravdu chcete začít nový projekt? Neuložené změny budou ztraceny."))) {
            document.getElementById('mainMenuModal').style.display = 'none';
            showWelcomeScreen('projects');
        }
    });
}

let btnCancelNewProject = document.getElementById('btnCancelNewProject');
if (btnCancelNewProject) {
    btnCancelNewProject.addEventListener('click', () => {
        document.getElementById('newProjectModal').style.display = 'none';
        let totalDevs = 0;
        if (typeof floors !== 'undefined') floors.forEach(f => { if(f && f.devices) totalDevs += f.devices.length; });
        if (totalDevs === 0) showWelcomeScreen('projects');
    });
}

let btnConfirmNewProject = document.getElementById('btnConfirmNewProject');
if (btnConfirmNewProject) {
    btnConfirmNewProject.addEventListener('click', () => {
        let npInput = document.getElementById('newProjectNameInput');
        let finalName = npInput ? npInput.value.trim() : tr("Nový projekt");
        if (finalName === "") finalName = tr("Nový projekt");
        document.getElementById('newProjectModal').style.display = 'none';
        if (typeof loadDefaultFloors === 'function') loadDefaultFloors(false, finalName);
                window.recordGoomProjectCreated?.();
    });
}

let npInputKey = document.getElementById('newProjectNameInput');
if (npInputKey) {
    npInputKey.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); let confirmBtn = document.getElementById('btnConfirmNewProject'); if(confirmBtn) confirmBtn.click();
        }
    });
}

let btnMenuOpenBIPS = document.getElementById('btnMenuOpenBIPS');
if(btnMenuOpenBIPS) {
    btnMenuOpenBIPS.addEventListener('click', async () => { 
        document.getElementById('mainMenuModal').style.display = 'none'; 
        if (window.showOpenFilePicker) {
            try {
                const [handle] = await window.showOpenFilePicker({ types: [{ description: 'TECH Projekt', accept: {'application/json': ['.tech', '.cctv', '.bips']} }] });
                currentFileHandle = handle; const file = await handle.getFile(); importFileContent(file);
            } catch (e) {} 
        } else { document.getElementById('bipsLoader').click(); }
    });
}

document.getElementById('btnMenuLoadImg').addEventListener('click', () => { document.getElementById('imageLoader').click(); document.getElementById('mainMenuModal').style.display = 'none'; });
document.getElementById('btnMenuSave').addEventListener('click', () => {
    document.getElementById('mainMenuModal').style.display = 'none';
    openPlanOutput();
});

// Простые функции для предотвращения ошибок кнопок Экспорта
function exportToPNG() { return exportPlanFile('png'); }
function exportToPDF() { return exportPlanFile('pdf'); }
document.getElementById('btnMenuPrint').addEventListener('click', () => {
 document.getElementById('mainMenuModal').style.display = 'none'; void printPlanDirect();
});
document.getElementById('btnExportBIPS').addEventListener('click', () => { exportToTECH(); saveModal.style.display='none'; });
for (const [id,format] of [['btnExportPNG','png'],['btnExportPDF','pdf'],['btnExportSVG','svg'],['btnExportDXF','dxf'],['btnExportJPEG','jpeg']]) {
 document.getElementById(id).addEventListener('click', () => exportPlanFile(format));
}

document.getElementById('bipsLoader').addEventListener('change', (e) => { const f = e.target.files[0]; if(f) importFileContent(f); e.target.value = ''; });

let pendingTextFloor = null;
const planTextForm = document.getElementById('planTextForm');
const planTextSize = document.getElementById('devTextSize');

function openTextModal(device, placementFloor = null) {
    if(!isOwnPlanEntity(device))return;
    editingDevice = device;
    pendingTextFloor = placementFloor;
    const annotation = device.type === 'textNode';
    const plainText = annotation && device.plainText === true;
    document.getElementById('textModalTitle').textContent = tr(plainText ? 'Text na výkresu' : annotation ? 'Poznámka' : 'Poznámka / Text');
    devTextInput.required = plainText;
    devTextInput.value = device.manualName || '';
    planTextSize.disabled = !annotation;
    planTextSize.parentElement.hidden = !annotation;
    const labelScale = placementFloor ? 1 : 1 + (Number(deviceSizeSlider.value) / 14 - 1) * .5;
    planTextSize.defaultValue = Math.round(getPlanTextSize(device, labelScale));
    planTextSize.value = planTextSize.defaultValue;
    document.getElementById('textModal').style.display = 'flex';
    devTextInput.focus();
}

function closeTextModal() {
    document.getElementById('textModal').style.display = 'none';
    editingDevice = null;
    pendingTextFloor = null;
}

let deviceRotationAnimation = null;

function stopDeviceRotation() {
    const rotation = deviceRotationAnimation;
    if (!rotation) return;
    deviceRotationAnimation = null;
    if (rotation.rotated) {
        saveStateToHistory();
        triggerAutoSave();
    }
}

function startDeviceRotation(direction=1,initialStep=0) {
    if (deviceRotationAnimation || currentFloorIndex === -1 || isOverviewMode || activeDeviceIds.size === 0) return;
    const floor = floors[currentFloorIndex];
    if (!floor) return;
    const devices = Array.from(activeDeviceIds)
        .map(id => floor.devices.find(device => device.id === id))
        .filter(device=>device&&isOwnPlanEntity(device))
        .map(device => ({ device, start: device.rotation || 0 }));
    if (devices.length === 0) return;

    direction=direction<0?-1:1;
    if(initialStep)devices.forEach(({device})=>device.rotation=(((device.rotation||0)+direction*initialStep)%360+360)%360);
    const normalizedAngle = (((devices[0].device.rotation||0) % 90) + 90) % 90;
    deviceRotationAnimation = {
        devices, direction,
        lastFrame: performance.now(),
        angleToStop: normalizedAngle < 0.001 ? 90 : direction>0?90-normalizedAngle:normalizedAngle,
        pauseUntil: 0,
        rotated: initialStep
    };
    const ownAnimation=deviceRotationAnimation;
    if(initialStep)requestRedraw();

    const rotateFrame = (now) => {
        const animation = deviceRotationAnimation;
        if (animation!==ownAnimation) return;
        if(!isSystemReady||isOverviewMode||document.querySelector('.modal[data-modal-open="true"],.app-dialog-backdrop:not([hidden])')){stopDeviceRotation();return;}
        if (animation.pauseUntil && now < animation.pauseUntil) {
            animation.lastFrame = now;
        } else {
            if (animation.pauseUntil) {
                animation.pauseUntil = 0;
                animation.angleToStop = 90;
                animation.lastFrame = now;
            } else {
                const elapsed = Math.min(now - animation.lastFrame, 50);
                animation.lastFrame = now;
                const step = Math.min(180 * elapsed / 1000, animation.angleToStop);
                animation.devices.forEach(({ device }) => {
                    device.rotation = (((device.rotation || 0) + animation.direction*step)%360+360)%360;
                });
                animation.rotated += step;
                animation.angleToStop -= step;
                if (animation.angleToStop < 0.001) {
                    animation.angleToStop = 0;
                    animation.pauseUntil = now + 450;
                }
            }
        }
        requestRedraw();
        requestAnimationFrame(rotateFrame);
    };

    requestAnimationFrame(rotateFrame);
}

planTextForm.addEventListener('submit', event => {
    event.preventDefault();
    const floor = floors[currentFloorIndex];
    if (!editingDevice || !isOwnPlanEntity(editingDevice) || !floor || (pendingTextFloor ? pendingTextFloor !== floor : !floor.devices.includes(editingDevice))) {
        closeTextModal();
        return;
    }
    devTextInput.value = devTextInput.value.trim();
    if (!devTextInput.reportValidity()) return;
    editingDevice.manualName = devTextInput.value;
    if (editingDevice.type === 'textNode' && (pendingTextFloor || planTextSize.value !== planTextSize.defaultValue)) {
        editingDevice.textSize = planTextSize.valueAsNumber;
    }
    if (pendingTextFloor) {
        placePlanDevice(floor, editingDevice);
    }
    closeTextModal();
    saveStateToHistory();
    requestRedraw();
    triggerAutoSave();
});
document.getElementById('btnCancelText').addEventListener('click', closeTextModal);
planTextForm.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
        event.stopPropagation();
        closeTextModal();
    }
});

function placePlanDevice(floor, device) {
    const firstId = activeDeviceIds.size === 1 ? activeDeviceIds.values().next().value : null;
    const previous = firstId ? floor.devices.find(item => item.id === firstId) : null;
    device.ownerApplication=APP_PRODUCT;
    floor.devices.push(device);
    if (!device.plainText) includeNewDeviceInLegend(floor, device.type);
    if (previous && !previous.plainText && !device.plainText) {
        const cable = { id: genId(), fromId: previous.id, toId: device.id, isCustom: false };
        recalcCableHandles(cable, previous, device);
        floor.cables.push(cable);
    }
    activeDeviceIds.clear();
    activeDeviceIds.add(device.id);
}

const emptyProjectKey=document.getElementById('emptyProjectKey');
for(const name of ['pointerdown','pointerup','pointermove'])emptyProjectKey.addEventListener(name,event=>event.stopPropagation());
emptyProjectKey.onclick=event=>{event.stopPropagation();document.getElementById('btnLogo').click();};
window.addEventListener('keydown', (e) => {
    if (window.isGoomReadOnly?.()) return;
    if (e.target.closest('input,textarea,select,[contenteditable="true"]') || e.isComposing) return;
    if ((e.code==='KeyF'||e.key.toLowerCase()==='f')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&isSystemReady&&!isOverviewMode&&!Array.from(document.querySelectorAll('.modal')).some(m=>['flex','block'].includes(m.style.display))) {
        e.preventDefault();document.getElementById('btnLogo').click();return;
    }
    if (isOverviewMode) {
        if (e.key === 'Escape') closeBuildingOverview();
        return;
    }
    if (!isSystemReady) {
        if (e.key === 'Escape') document.getElementById('cloudProjectsModal').style.display = 'none';
        return;
    }

    if (e.key === 'Escape') { 
        let modalClosed = false;
        document.querySelectorAll('.modal').forEach(m => { if (m.style.display === 'flex' || m.style.display === 'block') { m.style.display = 'none'; modalClosed = true; } });
        let hPanel = document.getElementById('helpPanel');
        if (hPanel && hPanel.classList.contains('open')) { hPanel.classList.remove('open'); modalClosed = true; }
        if (modalClosed) { editingDevice = null; pendingTextFloor = null; return; }
        clearDetectorSearchHighlight();
        selectedTool = 'select';
        document.querySelectorAll('#deviceSelector .device-btn[data-type]').forEach(b => b.classList.remove('active'));
        activeDeviceIds.clear();
        clearCanvasDrag();
        requestRedraw(); return; 
    }

    if(document.querySelector('.modal[data-modal-open="true"],.app-dialog-backdrop:not([hidden])'))return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { undo(); return; }

    if (currentFloorIndex === -1 || isOverviewMode) return;
    const floor = floors[currentFloorIndex];

    const rotationKey=e.code==='KeyS'?'s':e.code==='KeyD'?'d':e.key.toLowerCase();
    if (rotationKey === 'd' && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (activeDeviceIds.size > 0) {
            let changed = false;
            activeDeviceIds.forEach(id => {
                let dev = floor.devices.find(d => d.id === id);
                if (dev && isOwnPlanEntity(dev) && !isInfrastructureDevice(dev) && !independentDeviceNumberTypes.has(dev.type) && !['panel', 'textNode'].includes(dev.type)) {
                    if (dev.type === 'deactivated') { dev.type = dev.oldType || 'pir'; } else { dev.oldType = dev.type; dev.type = 'deactivated'; }
                    changed = true;
                }
            });
            if (changed) { saveStateToHistory(); requestRedraw(); triggerAutoSave(); }
        }
        return;
    }

    if (['s','d'].includes(rotationKey) && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (!e.repeat) {stopDeviceRotation();startDeviceRotation(rotationKey==='s'?1:-1);}
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeDeviceIds.size > 0) { e.preventDefault(); if (!e.repeat) void deleteSelectedDevices(); }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (activeDeviceIds.size > 0) clipboardDevices = floor.devices.filter(d => activeDeviceIds.has(d.id)&&isOwnPlanEntity(d)).map(d => JSON.parse(JSON.stringify(d)));
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboardDevices.length > 0) {
            activeDeviceIds.clear();
            let minX = Math.min(...clipboardDevices.map(d => d.x)), maxX = Math.max(...clipboardDevices.map(d => d.x));
            let minY = Math.min(...clipboardDevices.map(d => d.y)), maxY = Math.max(...clipboardDevices.map(d => d.y));
            let centerX = minX + (maxX - minX) / 2, centerY = minY + (maxY - minY) / 2;

            clipboardDevices.filter(isOwnPlanEntity).forEach(d => {
                const newId = genId();
                const pastedDev = { ...d, id: newId, x: lastMouseX + (d.x - centerX), y: lastMouseY + (d.y - centerY), h1x: 0, h1y: 0, h2x: 0, h2y: 0, h3x: 0, h3y: 0, hasCustomRoute: false };
                floor.devices.push(pastedDev); activeDeviceIds.add(newId);
                includeNewDeviceInLegend(floor, pastedDev.type);
            });
            saveStateToHistory(); requestRedraw(); triggerAutoSave();
        }
        return;
    }
});

window.addEventListener('keyup', (e) => {
    const key=e.code==='KeyS'?'s':e.code==='KeyD'?'d':e.key.toLowerCase();
    if((key==='s'&&deviceRotationAnimation?.direction===1)||(key==='d'&&deviceRotationAnimation?.direction===-1))stopDeviceRotation();
});
window.addEventListener('blur', stopDeviceRotation);

window.addEventListener('resize', () => { 
    if (!isExporting) { resizePlanCanvas(); requestRedraw(); } 
    if (isOverviewMode && document.getElementById('overviewScreen').style.display === 'flex') { if(typeof drawBuildingOverview === 'function') drawBuildingOverview(); }
});

container.addEventListener('wheel', e => {
    e.preventDefault();
    const rect=container.getBoundingClientRect();
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?container.clientHeight:1);
    zoomPlanAt(e.clientX-rect.left,e.clientY-rect.top,delta);
},{passive:false});

const canvasTouchPoints = new Map();
let canvasTouchGesture = null;
let canvasDragPointer = null;
let deviceGroupDrag = null;
let selectionPointer = null;
let selectionPanFrame = 0;

function updateSelectionCorner(rect) {
    const x = Math.max(0, Math.min(rect.width, selectionPointer.x - rect.left));
    const y = Math.max(0, Math.min(rect.height, selectionPointer.y - rect.top));
    selEndX = (x - offsetX) / scale;
    selEndY = (y - offsetY) / scale;
    requestRedraw();
}

function continueSelectionAtEdge(now) {
    selectionPanFrame = 0;
    if (!isSelecting || !selectionPointer?.moved) return;
    const rect = container.getBoundingClientRect();
    const edge = Math.min(48, rect.width / 4, rect.height / 4);
    if (edge <= 0) return;
    const speed = (position, length) => {
        const proximity = Math.max(0, 1 - position / edge) - Math.max(0, 1 - (length - position) / edge);
        return 820 * Math.max(-1, Math.min(1, proximity));
    };
    const velocityX = speed(selectionPointer.x - rect.left, rect.width);
    const velocityY = speed(selectionPointer.y - rect.top, rect.height);
    if (!velocityX && !velocityY) {
        selectionPointer.lastFrame = 0;
        return;
    }
    const elapsed = Math.min(32, selectionPointer.lastFrame ? now - selectionPointer.lastFrame : 16) / 1000;
    selectionPointer.lastFrame = now;
    offsetX += velocityX * elapsed;
    offsetY += velocityY * elapsed;
    updateSelectionCorner(rect);
    selectionPanFrame = requestAnimationFrame(continueSelectionAtEdge);
}

function stopSelectionPan() {
    cancelAnimationFrame(selectionPanFrame);
    selectionPanFrame = 0;
    selectionPointer = null;
}

function moveDraggedDevices(floor, x, y, freeMove) {
    const drag = deviceGroupDrag;
    if (!drag.devices) {
        drag.ids = activeDeviceIds.has(draggedDevice.id) ? new Set(activeDeviceIds) : new Set([draggedDevice.id]);
        const devicesById = new Map(floor.devices.map(device => [device.id, device]));
        drag.devices = floor.devices.filter(device => drag.ids.has(device.id)&&isOwnPlanEntity(device));
        drag.cables = floor.cables.flatMap(cable => {
            if(!isOwnPlanEntity(cable))return[];
            if (!drag.ids.has(cable.fromId) && !drag.ids.has(cable.toId)) return [];
            const from = devicesById.get(cable.fromId), to = devicesById.get(cable.toId);
            if (!from || !to || from.type === 'textNode' || to.type === 'textNode') return [];
            return [{ cable, from, to, movesTogether: drag.ids.has(from.id) && drag.ids.has(to.id) }];
        });
    }
    x += drag.grabX;
    y += drag.grabY;
    const snap = freeMove ? { x, y, guideX: null, guideY: null }
        : getSnappedCoords(x, y, floor, scale, draggedDevice.id, null, null, showDeactivatedDevices, drag.ids);
    snapGuideX = snap.guideX;
    snapGuideY = snap.guideY;
    const deltaX = snap.x - draggedDevice.x;
    const deltaY = snap.y - draggedDevice.y;
    if (!deltaX && !deltaY) return;
    drag.changed = true;
    for (const device of drag.devices) {
        device.x += deltaX;
        device.y += deltaY;
        if(device.attachedCableId){const route=floor.cables.find(c=>c.id===device.attachedCableId),a=floor.devices.find(d=>d.id===route?.fromId),b=floor.devices.find(d=>d.id===route?.toId);if(a&&b){const dx=b.x-a.x,dy=b.y-a.y;device.attachedT=Math.max(0,Math.min(1,((device.x-a.x)*dx+(device.y-a.y)*dy)/(dx*dx+dy*dy||1)));}}
    }
    for (const { cable, from, to, movesTogether } of drag.cables) {
        if (!Number.isFinite(cable.h1x) || !cable.isCustom) {
            recalcCableHandles(cable, from, to);
        } else if (movesTogether) {
            for (let index = 1; index <= 3; index++) {
                cable[`h${index}x`] += deltaX;
                cable[`h${index}y`] += deltaY;
            }
        } else {
            refreshAutomaticCableEnds(cable, from, to);
        }
    }
}

function clearCanvasDrag() {
    finishProjectLegendDrag();
    if (deviceGroupDrag?.changed || draggedHandle?.changed) { saveStateToHistory(); triggerAutoSave(); }
    stopSelectionPan();
    canvasDragPointer = null;
    deviceGroupDrag = null;
    isSelecting = false; isDragging = false; isPanning = false;
    draggedDevice = null; draggedHandle = null; clickedCableId = null; isClickingText = false;
    snapGuideX = null; snapGuideY = null;
}

container.addEventListener('pointerdown', (e) => {
    if (!isSystemReady) return;
    cancelWheelCamera();
    if (e.pointerType === 'touch') {
        container.setPointerCapture(e.pointerId);
        canvasTouchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (canvasTouchPoints.size === 2) {
            clearCanvasDrag();
            const [a, b] = [...canvasTouchPoints.values()];
            const rect = container.getBoundingClientRect();
            const x = (a.x + b.x) / 2 - rect.left;
            const y = (a.y + b.y) / 2 - rect.top;
            canvasTouchGesture = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale, x: (x - offsetX) / scale, y: (y - offsetY) / scale };
        }
        if (canvasTouchGesture) return;
    }
    if (!e.isPrimary) return;
    let rect = container.getBoundingClientRect();
    let mX = e.clientX - rect.left; let mY = e.clientY - rect.top;

    if (isOverviewMode) return;
    if (![0, 1, 2].includes(e.button)) return;
    clearDetectorSearchHighlight();
    canvasDragPointer = e.pointerId;
    container.setPointerCapture(e.pointerId);

    const canvasX = (mX - offsetX) / scale; const canvasY = (mY - offsetY) / scale;
    clickStartX = e.clientX; clickStartY = e.clientY;

    if (window.tabletPanMode && ['touch', 'pen'].includes(e.pointerType)) {
        isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY;
        return;
    }

    if (e.button === 1 || e.button === 2) { 
        isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY;
    } else if (e.button === 0) { 
        const floor = floors[currentFloorIndex];
        if (beginProjectLegendDrag(e, canvasX, canvasY)) return;
        let foundHandle = null;
        if (floor.showConnections) {
            const devicesById = new Map(floor.devices.map(device => [device.id, device]));
            let nearest = Infinity;
            for (const c of floor.cables) {
                if(!isOwnPlanEntity(c)||c.kind==='trunk')continue;
                if (!activeDeviceIds.has(c.fromId) && !activeDeviceIds.has(c.toId) && selectedTool !== 'cableTool') continue;
                const from = devicesById.get(c.fromId), to = devicesById.get(c.toId);
                if (!from || !to || from.type === 'textNode' || to.type === 'textNode') continue;
                if (!showDeactivatedDevices && (from.type === 'deactivated' || to.type === 'deactivated')) continue;
                for (let i = 1; i <= 3; i++) {
                    const hitRadius = (i === 2) ? 14 : 10;
                    const grabX = c[`h${i}x`] - canvasX, grabY = c[`h${i}y`] - canvasY;
                    const distance = grabX ** 2 + grabY ** 2;
                    if (!(distance < hitRadius ** 2 && distance <= nearest)) continue;
                    nearest = distance;
                    foundHandle = { cable: c, from, to, hIndex: i, grabX, grabY, changed: false };
                }
            }
        }
        if (selectedTool === 'cableTool' && floor.showConnections && !foundHandle) {
            const hitCableId = hitTestCables(canvasX, canvasY, floor, showDeactivatedDevices);
            if (hitCableId) { floor.cables = floor.cables.filter(c => c.id !== hitCableId); saveStateToHistory(); requestRedraw(); triggerAutoSave(); return; }
        }

        let foundDevice = null; isClickingText = false;
        let slider = document.getElementById('deviceSizeSlider');
        let sMult = (slider && slider.value) ? (parseInt(slider.value) / 14) : (16 / 14);
        let labelScale = 1 + (sMult - 1) * 0.5;

        for (let i = floor.devices.length - 1; i >= 0; i--) {
            let dev = floor.devices[i]; let inBody = false; let inText = false;
            if(!isOwnPlanEntity(dev))continue;
            if (!showDeactivatedDevices && dev.type === 'deactivated') continue;

            if (dev.type === 'textNode') {
                inBody = hitTestPlanTextNode(dev, canvasX, canvasY, labelScale);
            } else {
                inBody = Math.abs(dev.x - canvasX) < 22*sMult && Math.abs(dev.y - canvasY) < 22*sMult;
                let textX = dev.x + 20*sMult; let textY = dev.y + 20*sMult;
                inText = canvasX >= textX - 10*labelScale && canvasX <= textX + 50*labelScale && canvasY >= textY - 10*labelScale && canvasY <= textY + 20*labelScale;
            }
            if (inBody || inText) { foundDevice = dev; if (inText && !inBody) isClickingText = true; break; }
        }

        let foundCableId = null;
        if (!foundHandle && !foundDevice && floor.showConnections) { foundCableId = hitTestCables(canvasX, canvasY, floor, showDeactivatedDevices); }

        const grabbingGroup = foundDevice && activeDeviceIds.size > 1 && activeDeviceIds.has(foundDevice.id);
        if (foundHandle && !grabbingGroup) { draggedHandle = foundHandle; isDragging = true; }
        else if (foundDevice) {
            draggedDevice = foundDevice;
            deviceGroupDrag = { grabX: foundDevice.x - canvasX, grabY: foundDevice.y - canvasY, canMove: !isClickingText || grabbingGroup };
            isDragging = true;
        }
        else if (foundCableId) { clickedCableId = foundCableId; } 
        else {
            isSelecting = true;
            selStartX = selEndX = canvasX; selStartY = selEndY = canvasY;
            selectionPointer = { x: e.clientX, y: e.clientY, moved: false, lastFrame: 0 };
        }
    }
});

container.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && canvasTouchPoints.has(e.pointerId)) {
        canvasTouchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (canvasTouchGesture) {
            if (canvasTouchPoints.size === 2) {
                const [a, b] = [...canvasTouchPoints.values()];
                const rect = container.getBoundingClientRect();
                scale = Math.max(0.005, Math.min(128, canvasTouchGesture.scale * Math.hypot(a.x - b.x, a.y - b.y) / canvasTouchGesture.distance));
                offsetX = (a.x + b.x) / 2 - rect.left - canvasTouchGesture.x * scale;
                offsetY = (a.y + b.y) / 2 - rect.top - canvasTouchGesture.y * scale;
                requestRedraw();
            }
            return;
        }
    }
    if (!e.isPrimary || !isSystemReady) return;
    if (canvasDragPointer !== null && e.pointerId !== canvasDragPointer) return;
    let rect = container.getBoundingClientRect();
    let mX = e.clientX - rect.left; let mY = e.clientY - rect.top;

    if (isOverviewMode) return;

    const canvasX = (mX - offsetX) / scale; const canvasY = (mY - offsetY) / scale;
    lastMouseX = canvasX; lastMouseY = canvasY;
    pointerCanvasX = mX; pointerCanvasY = mY;
    if (moveProjectLegend(e, canvasX, canvasY)) return;
    const pointerFloor = floors[currentFloorIndex];
    if (!pointerFloor || !pointerFloor.image) requestRedraw();

    if (isPanning) { 
        offsetX = e.clientX - startPanX; offsetY = e.clientY - startPanY; 
        requestRedraw();
    } else if (isSelecting) {
        selectionPointer.x = e.clientX;
        selectionPointer.y = e.clientY;
        selectionPointer.moved ||= Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY) >= 5;
        updateSelectionCorner(rect);
        if (selectionPointer.moved && !selectionPanFrame) selectionPanFrame = requestAnimationFrame(continueSelectionAtEdge);
    } else if (isDragging) {
        if (deviceGroupDrag?.canMove && (deviceGroupDrag.devices || Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY) >= 5)) {
            moveDraggedDevices(floors[currentFloorIndex], canvasX, canvasY, e.altKey);
            requestRedraw();
        } else if (draggedHandle && (draggedHandle.changed || Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY) >= 5)) {
            const { cable, from, to, hIndex, grabX, grabY } = draggedHandle;
            const x = canvasX + grabX, y = canvasY + grabY;
            const snap = e.altKey ? { x, y, guideX: null, guideY: null }
                : getSnappedCoords(x, y, pointerFloor, scale, null, from, to, showDeactivatedDevices);
            snapGuideX = snap.guideX;
            snapGuideY = snap.guideY;
            if (cable[`h${hIndex}x`] !== snap.x || cable[`h${hIndex}y`] !== snap.y) {
                cable.fixedEnds = fixedCableEnds(cable) | (hIndex === 1 ? 1 : hIndex === 3 ? 2 : 0);
                cable[`h${hIndex}x`] = snap.x;
                cable[`h${hIndex}y`] = snap.y;
                cable.isCustom = true;
                if (hIndex === 2) refreshAutomaticCableEnds(cable, from, to);
                draggedHandle.changed = true;
            }
            requestRedraw();
        }
    }

    if (!isDragging && !isPanning && !isSelecting && hoverProjectLegend(canvasX,canvasY)) return;
    updateDeviceHover(e,canvasX,canvasY);
});

// Страховка при уходе мыши с холста
container.addEventListener('pointerleave', () => {
    container.style.cursor = 'default';
    pointerCanvasX = null; pointerCanvasY = null;
    requestRedraw();
    if (window.hoveredDeviceId !== null) { window.hoveredDeviceId = null; requestRedraw(); }
    const tooltip = document.getElementById('deviceTooltip');
    if (tooltip) { tooltip.style.opacity = "0"; }
});

window.addEventListener('pointerup', (e) => {
    if (finishProjectLegendDrag(e)) {
        canvasTouchPoints.delete(e.pointerId);
        canvasDragPointer = null;
        return;
    }
    if (e.pointerType === 'touch') {
        canvasTouchPoints.delete(e.pointerId);
        if (canvasTouchGesture) {
            if (!canvasTouchPoints.size) canvasTouchGesture = null;
            return;
        }
    }
    if (!e.isPrimary || e.pointerId !== canvasDragPointer) return;
    canvasDragPointer = null;
    if (!isSystemReady || isOverviewMode) { clearCanvasDrag(); return; }
    const dist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);

    const canvasX = (e.clientX - container.getBoundingClientRect().left - offsetX) / scale; 
    const canvasY = (e.clientY - container.getBoundingClientRect().top - offsetY) / scale;
    
    const floor = floors[currentFloorIndex];
    if (isPanning) { isPanning = false; return; }

    if (isSelecting) {
        selectionPointer.x = e.clientX;
        selectionPointer.y = e.clientY;
        updateSelectionCorner(container.getBoundingClientRect());
        const selectedByArea = selectionPointer.moved || dist >= 5;
        stopSelectionPan();
        isSelecting = false;
        if (selectedByArea) {
            let minX = Math.min(selStartX, selEndX); let maxX = Math.max(selStartX, selEndX);
            let minY = Math.min(selStartY, selEndY); let maxY = Math.max(selStartY, selEndY);
            if (!e.shiftKey) activeDeviceIds.clear(); 
            floor.devices.forEach(d => { 
                if (!showDeactivatedDevices && d.type === 'deactivated') return;
                if (isOwnPlanEntity(d) && d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY) { activeDeviceIds.add(d.id); }
            });
        } else {
            if (selectedTool !== 'cableTool' && selectedTool !== 'select') {
                let snap = getSnappedCoords(canvasX, canvasY, floor, scale, null, null, null, showDeactivatedDevices);
                if (e.altKey) { snap.x = canvasX; snap.y = canvasY; }
                const newId = genId(); const loopId = parseInt(loopSelect.value);
                
                let tempDev = { id: newId, x: snap.x, y: snap.y, type: selectedTool, manualName: "", loopId: loopId, rotation: 0, manualNumber: null };
                if (selectedTool === 'plainText' || selectedTool === 'textNode') {
                    tempDev.type = 'textNode';
                    if (selectedTool === 'plainText') tempDev.plainText = true;
                    openTextModal(tempDev, floor);
                    requestRedraw();
                    return;
                }
                if (['pir', 'pir_wl'].includes(selectedTool)) {
                    tempDev.pirRangePixels = floor.pirRangePixels;
                }
                placePlanDevice(floor, tempDev);
                saveStateToHistory();
            } else { activeDeviceIds.clear(); }
        }
        snapGuideX = null; snapGuideY = null; requestRedraw(); triggerAutoSave();
    } 
    else if (dist < 5 && !deviceGroupDrag?.devices) {
        if (draggedDevice) {
            const dev = draggedDevice;
            if (clickTimer && lastClickedDevice === dev.id) {
                clearTimeout(clickTimer); clickTimer = null; lastClickedDevice = null;
                if (dev.type === 'textNode') { 
                    openTextModal(dev); 
                } else if (!['panel', 'deactivated', 'cableTool'].includes(dev.type)) {
                    openNumberModal(dev);
                }
            } else {
                if (clickTimer) clearTimeout(clickTimer);
                lastClickedDevice = dev.id;
                const clickedText = isClickingText; 
                
                clickTimer = setTimeout(() => {
                    clickTimer = null; lastClickedDevice = null;
                    if (clickedText && dev.type !== 'textNode') { openTextModal(dev); } 
                    else {
                        if (activeDeviceIds.size === 1 && !e.shiftKey) {
                            let firstId = Array.from(activeDeviceIds)[0];
                            if (firstId !== dev.id) { 
                                const firstDevice = floor.devices.find(d => d.id === firstId);
                                let existingIdx = floor.cables.findIndex(c => (c.fromId === firstId && c.toId === dev.id) || (c.fromId === dev.id && c.toId === firstId));
                                if (existingIdx === -1 && firstDevice && firstDevice.plainText !== true && dev.plainText !== true) {
                                    let cObj = { id: genId(), fromId: firstId, toId: dev.id, isCustom: false };
                                    recalcCableHandles(cObj, firstDevice, dev);
                                    floor.cables.push(cObj);
                                    saveStateToHistory();
                                }
                                activeDeviceIds.clear(); activeDeviceIds.add(dev.id); 
                            }
                        } else {
                            if (!e.shiftKey) activeDeviceIds.clear(); activeDeviceIds.add(dev.id);
                        }
                    }
                    snapGuideX = null; snapGuideY = null; requestRedraw(); triggerAutoSave();
                }, 250); 
            }
        } else if (draggedHandle) {
            if (!draggedHandle.changed && draggedHandle.hIndex === 2) {
                floor.cables = floor.cables.filter(c => c !== draggedHandle.cable);
                draggedHandle.changed = true;
            }
        } else if (clickedCableId) {
            const cId = clickedCableId;
            if (clickTimer && lastClickedDevice === cId) {
                clearTimeout(clickTimer); clickTimer = null; lastClickedDevice = null;
                floor.cables = floor.cables.filter(c => c.id !== cId); snapGuideX = null; snapGuideY = null; 
                saveStateToHistory(); requestRedraw(); triggerAutoSave();
            } else {
                if (clickTimer) clearTimeout(clickTimer); lastClickedDevice = cId;
                clickTimer = setTimeout(() => { clickTimer = null; lastClickedDevice = null; }, 250);
            }
        }
    }
    
    clearCanvasDrag();
    requestRedraw();
});

container.addEventListener('pointercancel', () => {
    canvasTouchPoints.clear();
    canvasTouchGesture = null;
    clearCanvasDrag();
    requestRedraw();
});
container.addEventListener('lostpointercapture', event => {
    if (event.pointerId === canvasDragPointer) { clearCanvasDrag(); requestRedraw(); }
});
window.addEventListener('blur', () => {
    canvasTouchPoints.clear();
    canvasTouchGesture = null;
    clearCanvasDrag();
    requestRedraw();
});

function loadDefaultFloors(showWelcome = false, newProjectName = tr("Nový projekt")) {
    if (window.isGoomReadOnly?.()) return;
    window.projectOwnerUid=window.getFirebaseUser?.()?.uid||null;
    resetPlacementTool();
    window.resetActiveCloudProject?.();
    customDeviceIcons = {};
    if (typeof applyToolbarMenuIcons === 'function') applyToolbarMenuIcons();
    projectApplicationIcons={};projectApplicationSettings={};
    floors = STANDARD_FLOOR_NAMES.map(createEmptyProjectFloor);
    setPirCoverageVisible(true);
    let np1Index = floors.findIndex(f => f.name === "1NP");
    currentFloorIndex = np1Index !== -1 ? np1Index : 0;
    
    currentMaxLines = 10;
    updateLoopSelect();
    activeDeviceIds.clear();
    historyStack = []; historyIndex = -1;
    offsetX = 0; offsetY = 0; scale = 1;
    isSystemReady = true; 

    projectName = newProjectName;
    let pInput = document.getElementById('projectNameInput');
    if (pInput) pInput.value = projectName;

    if(showWelcome) {
        showWelcomeScreen();
    }
    
    changeFloor(); saveStateToHistory(); requestRedraw(); triggerAutoSave();
}
    
function showWelcomeScreen(step = 'auth') {
    if (window.isGoomReadOnly?.() && !['auth','email'].includes(step)) step = 'projects';
    resetPlacementTool();
    if (!['auth', 'email'].includes(step) && !window.getFirebaseUser?.()) step = 'auth';
    const modal = document.getElementById('welcomeModal');
    modal.dataset.step = step;
    window.refreshMobileViewer?.();
    modal.style.display = 'flex';
    document.getElementById('welcomeAuthBlock').hidden = step !== 'auth';
    document.getElementById('welcomeEmailBlock').hidden = step !== 'email';
    document.getElementById('welcomeButtonsBlock').hidden = step !== 'projects';
    if (step === 'projects') {
        const uid = window.getFirebaseUser?.()?.uid;
        const resume = document.getElementById('btnWelcomeResume');
        resume.hidden = true;
        void getSavedProjectData().then(saved => {
            if (modal.dataset.step === 'projects' && window.getFirebaseUser?.()?.uid === uid) {
                resume.hidden = !saved?.floors?.length || Boolean(saved.ownerUid && saved.ownerUid !== uid);
            }
        }).catch(() => {});
    }
    document.getElementById('btnWelcomeAccount').hidden = step === 'auth';
    const naming = document.getElementById('welcomeNamingBlock');
    naming.hidden = step !== 'naming';
    naming.style.display = step === 'naming' ? 'flex' : 'none';
}

let deviceDeletionPending = false;
async function deleteSelectedDevices() {
    if (window.isGoomReadOnly?.()) return;
    const projectFloors = floors;
    const floor = projectFloors[currentFloorIndex];
    if (!floor || !isSystemReady || isOverviewMode || deviceDeletionPending) return;
    const deletedIds = new Set(floor.devices.filter(d=>activeDeviceIds.has(d.id)&&isOwnPlanEntity(d)&&!floor.cables.some(c=>!isOwnPlanEntity(c)&&(c.fromId===d.id||c.toId===d.id))).map(d=>d.id));
    const devices = floor.devices.filter(device => deletedIds.has(device.id));
    if (!devices.length) return;
    const uid = window.getFirebaseUser?.()?.uid;
    deviceDeletionPending = true;
    try {
        if (devices.some(getDeviceNumberGroup)) {
            const shift = await showAppDialog({
                type: 'choice',
                title: tr('Odstranit vybrané prvky?'),
                message: tr('Ponechte mezeru v adresách, nebo posuňte další automaticky číslované prvky.'),
                alternateLabel: tr('Odstranit a ponechat mezeru'),
                primaryLabel: tr('Odstranit a přečíslovat')
            });
            if (shift === null || floors !== projectFloors || floors[currentFloorIndex] !== floor
                || !isSystemReady || window.getFirebaseUser?.()?.uid !== uid) return;
            if (!shift) reserveDeletedAddresses(projectFloors, floor, deletedIds);
        }
        floor.devices = floor.devices.filter(device => !deletedIds.has(device.id));
        floor.cables = floor.cables.filter(cable => !deletedIds.has(cable.fromId) && !deletedIds.has(cable.toId));
        activeDeviceIds.clear();
        saveStateToHistory();
        requestRedraw();
        triggerAutoSave();
    } finally {
        deviceDeletionPending = false;
        window.updateTabletTools?.();
    }
}

function resetPlacementTool() {
    clearDetectorSearchHighlight();
    stopDeviceRotation();
    selectedTool = 'select';
    window.tabletPanMode = false;
    document.querySelectorAll('#deviceSelector .device-btn').forEach(button => button.classList.remove('active'));
    activeDeviceIds.clear();
    clearCanvasDrag();
    window.clearGoomTooltips?.();
}

async function initProject() {
    try {
        resizePlanCanvas();
        updateLoopSelect();

        const welcomeLogoEl = document.getElementById('welcomeLogoContainer');
        if(welcomeLogoEl && typeof LOGO_LARGE !== 'undefined') { welcomeLogoEl.innerHTML = LOGO_LARGE; }

        const btnWelcomeNew = document.getElementById('btnWelcomeNew');
        if(btnWelcomeNew) {
            btnWelcomeNew.onclick = () => {
                showWelcomeScreen('naming');
                let inp = document.getElementById('welcomeProjectNameInput');
                if (inp) {
                    inp.value = tr("Nový projekt");
                    setTimeout(() => inp.select(), 50);
                }
            };
        }

        const btnWelcomeCancelNaming = document.getElementById('btnWelcomeCancelNaming');
        if(btnWelcomeCancelNaming) {
            btnWelcomeCancelNaming.onclick = () => {
                showWelcomeScreen('projects');
            };
        }

        const btnWelcomeConfirmNaming = document.getElementById('btnWelcomeConfirmNaming');
        if(btnWelcomeConfirmNaming) {
            btnWelcomeConfirmNaming.onclick = () => {
                if (!window.getFirebaseUser?.()) { showWelcomeScreen(); return; }
                let inp = document.getElementById('welcomeProjectNameInput');
                let finalName = inp ? inp.value.trim() : tr("Nový projekt");
                if (finalName === "") finalName = tr("Nový projekt");
                
                document.getElementById('welcomeModal').style.display = 'none';
                
                loadDefaultFloors(false, finalName);
                window.recordGoomProjectCreated?.();
                window.startGoomOnboarding?.();
            };
        }

        const welcomeProjectNameInput = document.getElementById('welcomeProjectNameInput');
        if(welcomeProjectNameInput) {
            welcomeProjectNameInput.onkeydown = (e) => {
                if(e.key === 'Enter') {
                    e.preventDefault();
                    let confirmBtn = document.getElementById('btnWelcomeConfirmNaming');
                    if(confirmBtn) confirmBtn.click();
                }
            };
        }

        const btnWelcomeOpenBIPS = document.getElementById('btnWelcomeOpenBIPS');
        if(btnWelcomeOpenBIPS) {
            btnWelcomeOpenBIPS.onclick = async () => {
                if (!window.getFirebaseUser?.()) { showWelcomeScreen(); return; }
                if (window.showOpenFilePicker) {
                    try {
                        const [handle] = await window.showOpenFilePicker({ types: [{ description: 'TECH Projekt', accept: {'application/json': ['.tech', '.cctv', '.bips']} }] });
                        const file = await handle.getFile();
                        if (await importFileContent(file)) currentFileHandle = handle;
                    } catch (error) {
                        if (error.name !== 'AbortError') showAppAlert(error.message, tr('Ошибка открытия проекта'));
                    }
                } else { 
                    document.getElementById('bipsLoader').click(); 
                }
            };
        }

        document.getElementById('btnWelcomeContinue').onclick = async () => {
            if (await window.ensureFirebaseSession()) showWelcomeScreen('projects');
        };
        document.getElementById('btnWelcomeAccount').onclick = () => {
            const step = document.getElementById('welcomeModal').dataset.step;
            showWelcomeScreen(step === 'naming' ? 'projects' : 'auth');
        };
        const resumeButton = document.getElementById('btnWelcomeResume');
        resumeButton.onclick = async () => {
            const uid = window.getFirebaseUser?.()?.uid;
            if (!uid) { showWelcomeScreen(); return; }
            resumeButton.disabled = true;
            try {
                if (!await loadFromDB({ requireUid: uid })) throw new Error(tr('Локальное сохранение недоступно. Создайте или откройте другой проект.'));
                isSystemReady = true;
                changeFloor(); applySavedPlanViewport(window.restoredPlanViewport); saveStateToHistory(); requestRedraw();
                document.getElementById('welcomeModal').style.display = 'none';
                window.startGoomOnboarding?.();
            } catch (error) {
                showAppAlert(error.message, tr('Не удалось продолжить проект'));
            } finally {
                resumeButton.disabled = false;
            }
        };

        isSystemReady = false; requestRedraw();
        showWelcomeScreen();
        await initDB();

    } catch(e) {
        console.error("Critical error during init:", e);
        showWelcomeScreen();
    }
}

function closeBuildingOverview(index = currentFloorIndex) {
    const changed = index !== currentFloorIndex;
    currentFloorIndex = index;
    document.getElementById('overviewScreen').style.display = 'none';
    isOverviewMode = false;
    window.clearGoomTooltips?.();
    window.dispatchEvent(new Event('resize'));
    if (changed) changeFloor();
    else requestRedraw();
    document.getElementById('btnOverview').focus({ preventScroll: true });
}

document.getElementById('btnOverview').addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    if (!isSystemReady || !floors.length) return;
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    editingDevice = null; pendingTextFloor = null; clearCanvasDrag(); window.clearGoomTooltips?.();
    isOverviewMode = true;
    document.getElementById('overviewScreen').style.display = 'flex';
    requestRedraw();
    drawBuildingOverview();
    document.querySelector('.overview-floor[aria-current="true"]')?.focus({ preventScroll: true });
});
document.getElementById('btnCloseOverviewScreen').addEventListener('click', () => closeBuildingOverview());
document.getElementById('overviewFloors').addEventListener('click', event => {
    const button = event.target.closest('[data-overview-floor]');
    if (!button || button.disabled || !isOverviewMode) return;
    const index = getOverviewFloorIndex(button.dataset.overviewFloor);
    if (index >= 0) closeBuildingOverview(index);
});
document.getElementById('overviewFloors').addEventListener('keydown', event => {
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const buttons = [...document.querySelectorAll('.overview-floor:not(:disabled)')];
    if (!buttons.length) return;
    let next = buttons.indexOf(document.activeElement);
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else next = (next + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true });
});
new ResizeObserver(() => { if (isOverviewMode) drawBuildingOverview(); }).observe(document.getElementById('overviewStage'));
window.addEventListener('goom-language-changed', () => { if (isOverviewMode) drawBuildingOverview(); });

 function centerCurrentFloor() {
    cancelWheelCamera();
    const floor = floors[currentFloorIndex];
    if (!floor || !floor.image) { scale = 1; offsetX = 0; offsetY = 0; return; }
    const bounds=getPlanSourceBounds(floor);
    let bw = bounds.width; let bh = bounds.height;
    let scaleX = planCanvasWidth() / bw; let scaleY = planCanvasHeight() / bh;
    scale = Math.min(scaleX, scaleY) * 0.95; 
    if (scale > 1) scale = 1; 
    offsetX = (planCanvasWidth() - bw * scale) / 2 - bounds.minX*scale; offsetY = (planCanvasHeight() - bh * scale) / 2 - bounds.minY*scale;
}

function changeFloor() {
    clearDetectorSearchHighlight();
    finishProjectLegendDrag(); selectedProjectLegend = null; updateProjectLegendButton();
    if(!floors[currentFloorIndex]) return;
    window.refreshMobileViewer?.();
    
    updateConnectionButton();

    centerCurrentFloor(); activeDeviceIds.clear(); requestRedraw(); triggerAutoSave();
}

document.getElementById('imageLoader').addEventListener('change', async function(e) {
 const floor=floors[currentFloorIndex],file=e.target.files[0];e.target.value='';
 if(!floor||!file||!isSystemReady||window.isGoomReadOnly?.())return;
 isSystemReady=false;container.setAttribute('aria-busy','true');requestRedraw();
 const endImport=window.startGoomBusy?.();
 try {
  await window.goomBusyPaint?.();
  await new Promise(requestAnimationFrame);
  const imported=await importPlanSource(file,floor);
  if(imported){window.resetActiveCloudProject?.();Object.assign(floor,imported);isSystemReady=true;changeFloor();saveStateToHistory();triggerAutoSave();
   if(imported.vectorPlan?.unsupported.length)showAppAlert(tr`Nepodporované prvky DXF: ${imported.vectorPlan.unsupported.join(', ')}`,tr('Import DXF'));
  }
 } catch(error){console.error(error);showAppAlert(error.message,tr('Chyba načítání výkresu'));}
 finally{endImport?.();isSystemReady=true;container.removeAttribute('aria-busy');requestRedraw();}
});

function importFileContent(file, options = {}) {
    if (window.isGoomReadOnly?.() && options.source !== 'cloud') return Promise.resolve(false);
    const wasSystemReady = isSystemReady;
    return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            if (!text || text.trim() === "") throw new Error(tr("Soubor je prázdný."));

            const data = JSON.parse(text);

            let loadedFloors = [];
            
            if (Array.isArray(data)) {
                loadedFloors = data; 
            } else if (data && typeof data === 'object') {
                if (data.floors && Array.isArray(data.floors)) {
                    loadedFloors = data.floors; 
                } else if (data.fData && Array.isArray(data.fData)) {
                    loadedFloors = data.fData; 
                } else {
                    loadedFloors = [data]; 
                }
            } else {
                throw new Error(tr("Neznámá struktura dat v souboru."));
            }
            
            const preparedFloors = await loadFloorsImages(await prepareSharedProject(data));
            if (options.canApply && !options.canApply()) { resolve(false); return; }
            window.resetActiveCloudProject?.();
            if (data && data.currentMaxLines) currentMaxLines = data.currentMaxLines;
            customDeviceIcons = projectIconsFromData(data);
            let slider = document.getElementById('deviceSizeSlider');
            if (slider) slider.value = projectDeviceSizeFromData(data);
            
            if (data && data.projectName) {
                projectName = data.projectName;
            } else {
                projectName = (file && file.name) ? file.name.replace(/\.(tech|cctv|bips)$/i, '') : tr("Obnovený projekt");
            }
            
            let pInput = document.getElementById('projectNameInput');
            if (pInput) pInput.value = projectName;

            updateLoopSelect();
            floors = preparedFloors;
            setPirCoverageVisible(data?.pirCoverageVisible !== false);
            window.projectOwnerUid=window.getFirebaseUser?.()?.uid||null;
            if (typeof refreshCustomDeviceIcons === 'function') refreshCustomDeviceIcons();
            
            currentFloorIndex = (data && data.currentFloorIndex !== undefined) ? data.currentFloorIndex : 0;
            if (currentFloorIndex >= floors.length || currentFloorIndex < 0) currentFloorIndex = 0; 
            resetPlacementTool();
            isSystemReady = true; 
            changeFloor(); 
            saveStateToHistory(); 
            triggerAutoSave();
            document.getElementById('welcomeModal').style.display = 'none';
            window.startGoomOnboarding?.();
            resolve(true);

        } catch (err) { 
            console.error("Chyba importu:", err);
            showAppAlert(tr("Chyba při načítání souboru .TECH!\n\nDetail chyby: ") + err.message, tr('Ошибка открытия проекта')); 
            isSystemReady = wasSystemReady;
            requestRedraw(); 
            resolve(false);
        }
    };
    reader.onerror = () => {
        const error = reader.error || new Error(tr('Не удалось прочитать файл проекта.'));
        console.error('Ошибка чтения файла проекта:', error);
        showAppAlert(error.message, tr('Ошибка открытия проекта'));
        resolve(false);
    };
    reader.readAsText(file);
    });
}

let pInput = document.getElementById('projectNameInput');
if (pInput) {
    pInput.addEventListener('input', (e) => {
        projectName = e.target.value;
        triggerAutoSave(); 
    });
}

const arrowTabBtn = document.getElementById('arrowTabBtn');
const slidingMenu = document.querySelector('.sliding-row-container');

if (arrowTabBtn && slidingMenu) {
    let newArrowBtn = arrowTabBtn.cloneNode(true);
    arrowTabBtn.parentNode.replaceChild(newArrowBtn, arrowTabBtn);
    
    newArrowBtn.addEventListener('click', () => {
        slidingMenu.classList.toggle('open');
        newArrowBtn.classList.toggle('open');
    });
}

// ===============================================
// УМНОЕ ОКНО ВВОДА АДРЕСА (С ПРОВЕРКОЙ ДУБЛИКАТОВ)
// ===============================================

function openNumberModal(dev) {
    if(!isOwnPlanEntity(dev)||isInfrastructureDevice(dev))return; 
    editingDevice = dev; 
    let inp = document.getElementById('devNumberInput');
    const optics = APP_PRODUCT === 'CCTV' ? getCameraOptics(dev) : null;
    inp.value = (optics ? dev.manualNumber : dev.manualNumber || dev.number) || '';
    document.getElementById('cameraOptics').hidden = !optics;
    if (optics) {
        document.getElementById('cameraAngle').value = optics.angle;
        document.getElementById('cameraRange').value = optics.range;
    }
    document.getElementById('numberModal').style.display = 'flex'; 
    setTimeout(() => inp.select(), 50);

    // Сбрасываем внешний вид окна при открытии
    let btnSave = document.getElementById('btnSaveNumber');
    if (btnSave) {
        btnSave.innerHTML = '✅';
        btnSave.style.pointerEvents = 'auto';
    }
    let warn = document.getElementById('duplicateWarning');
    if (warn) warn.style.display = 'none';
    if (inp) inp.style.borderColor = '#313135';
}

// Проверка дубликатов "на лету" при каждом вводе цифры
const devNumberInput = document.getElementById('devNumberInput');
if (devNumberInput) {
    devNumberInput.addEventListener('input', (e) => {
        let newNum = parseInt(e.target.value);
        let btnSave = document.getElementById('btnSaveNumber');
        let warn = document.getElementById('duplicateWarning');

        // Если поле пустое (будет сброс на Auto) - всё ок
        if (isNaN(newNum) || !editingDevice) {
            if (btnSave) { btnSave.innerHTML = '✅'; btnSave.style.pointerEvents = 'auto'; }
            if (warn) warn.style.display = 'none';
            e.target.style.borderColor = '#0ea5e9';
            return;
        }

        let isTaken = false;
        const category = getDeviceNumberGroup(editingDevice);
        
        for (let f of floors) {
            if (!f.devices) continue;
            for (let d of f.devices) {
                if (d.id !== editingDevice.id && (d.manualNumber === newNum || d.number === newNum)) {
                    if (getDeviceNumberGroup(d) === category) { isTaken = true; break; }
                }
            }
            if (isTaken) break;
        }

        if (isTaken) {
            if (btnSave) { btnSave.innerHTML = '⛔'; btnSave.style.pointerEvents = 'none'; }
            if (warn) warn.style.display = 'block';
            e.target.style.borderColor = '#ef4444'; // Красная рамка (занято)
        } else {
            if (btnSave) { btnSave.innerHTML = '✅'; btnSave.style.pointerEvents = 'auto'; }
            if (warn) warn.style.display = 'none';
            e.target.style.borderColor = '#22c55e'; // Зеленая рамка (свободно)
        }
    });

    // Сохранение по кнопке Enter (только если нет ошибки)
    devNumberInput.addEventListener('keypress', function (e) { 
        if (e.key === 'Enter') {
            e.preventDefault();
            let btnSave = document.getElementById('btnSaveNumber');
            if (btnSave && btnSave.style.pointerEvents !== 'none') {
                btnSave.click(); 
            }
        }
    });
}

// Сохранение адреса (нажатие на галочку)
const btnSaveNumber = document.getElementById('btnSaveNumber');
if (btnSaveNumber) {
    btnSaveNumber.addEventListener('click', () => {
        if (btnSaveNumber.style.pointerEvents === 'none') return;
        if (editingDevice && isOwnPlanEntity(editingDevice)) {
            if (APP_PRODUCT === 'CCTV' && getCameraOptics(editingDevice)) {
                const angle = document.getElementById('cameraAngle');
                const range = document.getElementById('cameraRange');
                if (!angle.reportValidity() || !range.reportValidity()) return;
                editingDevice.cameraAngle = angle.valueAsNumber;
                editingDevice.cameraRange = range.valueAsNumber;
            }
            let valStr = document.getElementById('devNumberInput').value;
            let newNum = parseInt(valStr);
            
            // Если пользователь стер цифру - сбрасываем на Auto
            if (isNaN(newNum) || valStr.trim() === "") {
                editingDevice.manualNumber = null;
            } else if (newNum > 0) {
                editingDevice.manualNumber = newNum;
            }
            
            calculateDynamicNumbersGlobal(floors);
            saveStateToHistory(); 
            requestRedraw(); 
            triggerAutoSave();
        }
        document.getElementById('numberModal').style.display = 'none';
        editingDevice = null;
    });
}
window.localProjectStartup=initProject();
