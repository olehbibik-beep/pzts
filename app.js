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
    suppressedTooltipTarget = activeTooltipTarget || (event?.target instanceof Element ? event.target.closest('[data-tooltip]') : null);
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
        let opt = document.createElement('option'); opt.value = i; opt.textContent = tr`Sběrnice ${i}`; loopSelect.appendChild(opt);
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
if (pirToggle) {
    pirToggle.addEventListener('click', () => {
        const enabled = pirToggle.getAttribute('aria-pressed') !== 'true';
        pirToggle.setAttribute('aria-pressed', String(enabled));
        pirToggle.setAttribute('aria-label', enabled ? tr('Скрыть зоны PIR') : tr('Показать зоны PIR'));
        pirToggle.title = enabled ? tr('Скрыть зоны PIR') : tr('Показать зоны PIR');
        requestRedraw();
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

function openDetectionSettings() {
    const floor = floors[currentFloorIndex];
    if (!floor) return;
    document.getElementById('wallThresholdInput').value = floor.wallThreshold;
    document.getElementById('planThemeInput').value = getPlanTheme(floor);
    document.getElementById('wallPreviewInput').checked = !!floor.previewWalls;
    window.refreshGoomSelects?.();
    const selectedPIR = floor.devices.find(device => activeDeviceIds.has(device.id) && ['pir', 'pir_wl', 'glassbreak'].includes(device.type));
    document.getElementById('pirRangeInput').value = selectedPIR?.pirRangePixels || floor.pirRangePixels;
    detectionSettingsModal.style.display = 'flex';
}

document.getElementById('btnDetectionSettings').addEventListener('click', openDetectionSettings);
document.getElementById('wallPreviewInput').addEventListener('change',event=>{
    if(floors[currentFloorIndex])floors[currentFloorIndex].previewWalls=event.target.checked;
    requestRedraw();
});
document.getElementById('btnCloseDetectionSettings').addEventListener('click', () => {
    detectionSettingsModal.style.display = 'none';
});

document.getElementById('btnSaveDetectionSettings').addEventListener('click', () => {
    const floor = floors[currentFloorIndex];
    if (!floor) return;
    const wallThreshold = Number(document.getElementById('wallThresholdInput').value);
    const pirRangePixels = Number(document.getElementById('pirRangeInput').value);
    if (!Number.isInteger(wallThreshold) || wallThreshold < 0 || wallThreshold > 255 ||
        !Number.isFinite(pirRangePixels) || pirRangePixels < 10 || pirRangePixels > 2000) {
        showAppAlert(tr('Укажите порог яркости от 0 до 255 и радиус PIR от 10 до 2000 пикселей.'), tr('Некорректные настройки'));
        return;
    }

    let wallMask;
    try {
        wallMask = createWallMask(floor, wallThreshold);
    } catch (error) {
        console.error('Ошибка распознавания стен:', error);
        showAppAlert(tr`Не удалось распознать стены: ${error.message}`, tr('Ошибка распознавания стен'));
        return;
    }

    floor.planTheme = document.getElementById('planThemeInput').value;
    floor.wallThreshold = wallThreshold;
    floor.wallMask = wallMask;
    const selectedPIRs = floor.devices.filter(device => activeDeviceIds.has(device.id) && ['pir', 'pir_wl', 'glassbreak'].includes(device.type));
    if (selectedPIRs.length > 0) {
        selectedPIRs.forEach(device => {
            device.pirRangePixels = pirRangePixels;
        });
    } else {
        floor.pirRangePixels = pirRangePixels;
    }
    detectionSettingsModal.style.display = 'none';
    saveStateToHistory();
    triggerAutoSave();
    requestRedraw();
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

    if (currentFloorIndex !== -1 && activeDeviceIds.size > 0 && !isOverviewMode) {
        let changed = false;
        const floor = floors[currentFloorIndex];
        activeDeviceIds.forEach(id => {
            let dev = floor.devices.find(d => d.id === id);
            if (dev) { dev.type = selectedTool; if (dev.type !== 'deactivated') dev.oldType = null; changed = true; }
        });
        if (changed) { saveStateToHistory(); triggerAutoSave(); requestRedraw(); }
    } else { activeDeviceIds.clear(); requestRedraw(); }
});

let bToggleConnections = document.getElementById('btnToggleConnections');
if(bToggleConnections) {
    bToggleConnections.addEventListener('click', () => {
        if(isOverviewMode) return;
        floors[currentFloorIndex].showConnections = !floors[currentFloorIndex].showConnections; 
        bToggleConnections.innerHTML = floors[currentFloorIndex].showConnections ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Skrýt kabely` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg> Zobrazit kabely`; 
        saveStateToHistory(); requestRedraw(); triggerAutoSave();
    });
}

const modals = document.querySelectorAll('.modal');
modals.forEach(modal => { modal.addEventListener('click', (e) => { if (e.target === modal) { if (modal.id === 'welcomeModal' && !isSystemReady) return; modal.style.display = 'none'; if(modal.id === 'textModal') editingDevice = null; } }); });

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
                const [handle] = await window.showOpenFilePicker({ types: [{ description: 'BIPS Projekt', accept: {'application/json': ['.bips']} }] });
                currentFileHandle = handle; const file = await handle.getFile(); importFileContent(file);
            } catch (e) {} 
        } else { document.getElementById('bipsLoader').click(); }
    });
}

document.getElementById('btnMenuLoadImg').addEventListener('click', () => { document.getElementById('imageLoader').click(); document.getElementById('mainMenuModal').style.display = 'none'; });
document.getElementById('btnMenuSave').addEventListener('click', () => { document.getElementById('saveModal').style.display = 'flex'; document.getElementById('mainMenuModal').style.display = 'none'; });

// Простые функции для предотвращения ошибок кнопок Экспорта
function exportToPNG() { return exportPlanFile('png'); }
function exportToPDF() { return exportPlanFile('pdf'); }
function printCurrentFloor() { openPlanOutput(true); }
document.getElementById('btnMenuPrint').addEventListener('click', () => {
 document.getElementById('mainMenuModal').style.display = 'none'; printCurrentFloor();
});
window.addEventListener('afterprint', () => document.getElementById('printPage').replaceChildren());
document.getElementById('btnExportBIPS').addEventListener('click', () => { exportToBIPS(); saveModal.style.display='none'; });
for (const [id,format] of [['btnExportPNG','png'],['btnExportPDF','pdf'],['btnExportSVG','svg'],['btnExportJPEG','jpeg']]) {
 document.getElementById(id).addEventListener('click', () => exportPlanFile(format));
}
document.getElementById('btnPrintPlan').addEventListener('click', () => exportPlanFile('print'));

document.getElementById('bipsLoader').addEventListener('change', (e) => { const f = e.target.files[0]; if(f) importFileContent(f); e.target.value = ''; });

function openTextModal(dev) { editingDevice = dev; devTextInput.value = dev.manualName || ""; document.getElementById('textModal').style.display = 'flex'; devTextInput.focus(); }

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

function startDeviceRotation() {
    if (deviceRotationAnimation || currentFloorIndex === -1 || isOverviewMode || activeDeviceIds.size === 0) return;
    const floor = floors[currentFloorIndex];
    if (!floor) return;
    const devices = Array.from(activeDeviceIds)
        .map(id => floor.devices.find(device => device.id === id))
        .filter(Boolean)
        .map(device => ({ device, start: device.rotation || 0 }));
    if (devices.length === 0) return;

    const normalizedAngle = ((devices[0].start % 90) + 90) % 90;
    deviceRotationAnimation = {
        devices,
        lastFrame: performance.now(),
        angleToStop: normalizedAngle < 0.001 ? 90 : 90 - normalizedAngle,
        pauseUntil: 0,
        rotated: 0
    };

    const rotateFrame = (now) => {
        const animation = deviceRotationAnimation;
        if (!animation) return;
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
                    device.rotation = (device.rotation || 0) + step;
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

document.getElementById('btnSaveText').addEventListener('click', () => {
    if (editingDevice) { editingDevice.manualName = devTextInput.value.trim(); saveStateToHistory(); requestRedraw(); triggerAutoSave(); }
    document.getElementById('textModal').style.display = 'none'; editingDevice = null;
});
devTextInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') document.getElementById('btnSaveText').click(); });

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
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
        if (modalClosed) { editingDevice = null; return; }
        selectedTool = 'select';
        document.querySelectorAll('#deviceSelector .device-btn[data-type]').forEach(b => b.classList.remove('active'));
        activeDeviceIds.clear();
        isSelecting = false; isPanning = false; isDragging = false;
        draggedDevice = null; draggedHandle = null; clickedCableId = null; isClickingText = false;
        snapGuideX = null; snapGuideY = null;
        requestRedraw(); return; 
    }

    if (e.altKey && e.key.toLowerCase() === 'r') {
        selectedTool = 'ramen'; document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('ramenModal').style.display = 'flex'; e.preventDefault(); return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { undo(); return; }

    if (currentFloorIndex === -1 || isOverviewMode) return;
    const floor = floors[currentFloorIndex];

    if (e.key.toLowerCase() === 'd') {
        if (activeDeviceIds.size > 0) {
            let changed = false;
            activeDeviceIds.forEach(id => {
                let dev = floor.devices.find(d => d.id === id);
                if (dev && !['panel', 'keypad', 'expander', 'abax', 'siren', 'textNode', 'ramen'].includes(dev.type)) {
                    if (dev.type === 'deactivated') { dev.type = dev.oldType || 'pir'; } else { dev.oldType = dev.type; dev.type = 'deactivated'; }
                    changed = true;
                }
            });
            if (changed) { saveStateToHistory(); requestRedraw(); triggerAutoSave(); }
        }
        return;
    }

    if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!e.repeat) startDeviceRotation();
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeDeviceIds.size > 0) {
            floor.devices = floor.devices.filter(d => !activeDeviceIds.has(d.id));
            floor.cables = floor.cables.filter(c => !activeDeviceIds.has(c.fromId) && !activeDeviceIds.has(c.toId));
            activeDeviceIds.clear(); saveStateToHistory(); requestRedraw(); triggerAutoSave();
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (activeDeviceIds.size > 0) clipboardDevices = floor.devices.filter(d => activeDeviceIds.has(d.id)).map(d => JSON.parse(JSON.stringify(d)));
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboardDevices.length > 0) {
            activeDeviceIds.clear();
            let minX = Math.min(...clipboardDevices.map(d => d.x)), maxX = Math.max(...clipboardDevices.map(d => d.x));
            let minY = Math.min(...clipboardDevices.map(d => d.y)), maxY = Math.max(...clipboardDevices.map(d => d.y));
            let centerX = minX + (maxX - minX) / 2, centerY = minY + (maxY - minY) / 2;

            clipboardDevices.forEach(d => {
                const newId = genId();
                const pastedDev = { ...d, id: newId, x: lastMouseX + (d.x - centerX), y: lastMouseY + (d.y - centerY), h1x: 0, h1y: 0, h2x: 0, h2y: 0, h3x: 0, h3y: 0, hasCustomRoute: false };
                floor.devices.push(pastedDev); activeDeviceIds.add(newId);
            });
            saveStateToHistory(); requestRedraw(); triggerAutoSave();
        }
        return;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 's') stopDeviceRotation();
});
window.addEventListener('blur', stopDeviceRotation);

window.addEventListener('resize', () => { 
    if (!isExporting) { resizePlanCanvas(); requestRedraw(); } 
    if (isOverviewMode && document.getElementById('overviewScreen').style.display === 'flex') { if(typeof drawBuildingOverview === 'function') drawBuildingOverview(); }
});

container.addEventListener('wheel', (e) => {
    e.preventDefault(); 
    if (isOverviewMode) return;
    const nextScale = Math.max(0.005, Math.min(128, scale * Math.exp(-e.deltaY * 0.0015)));
    const zoom = nextScale / scale;
    const rect = container.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    offsetX = mouseX - (mouseX - offsetX) * zoom; offsetY = mouseY - (mouseY - offsetY) * zoom; scale *= zoom; 
    requestRedraw();
});

const canvasTouchPoints = new Map();
let canvasTouchGesture = null;

function clearCanvasDrag() {
    if (isDragging) { saveStateToHistory(); triggerAutoSave(); }
    isSelecting = false; isDragging = false; isPanning = false;
    draggedDevice = null; draggedHandle = null; clickedCableId = null; isClickingText = false;
    snapGuideX = null; snapGuideY = null;
}

container.addEventListener('pointerdown', (e) => {
    if (!isSystemReady) return;
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
    if (e.pointerType === 'pen') container.setPointerCapture(e.pointerId);
    let rect = container.getBoundingClientRect();
    let mX = e.clientX - rect.left; let mY = e.clientY - rect.top;

    if (isOverviewMode) return;

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
        if (selectedTool === 'cableTool') {
            const hitCableId = hitTestCables(canvasX, canvasY, floor, showDeactivatedDevices);
            if (hitCableId) { floor.cables = floor.cables.filter(c => c.id !== hitCableId); saveStateToHistory(); requestRedraw(); triggerAutoSave(); return; }
        }

        let foundHandle = null;
        if (floor.showConnections) {
            for (let c of floor.cables) {
                let d1 = floor.devices.find(d => d.id === c.fromId); let d2 = floor.devices.find(d => d.id === c.toId);
                if (d1 && d2 && (d1.type === 'textNode' || d2.type === 'textNode')) continue;
                if (!showDeactivatedDevices && (d1 && d1.type === 'deactivated' || d2 && d2.type === 'deactivated')) continue;
                if (!activeDeviceIds.has(c.fromId) && !activeDeviceIds.has(c.toId) && selectedTool !== 'cableTool') continue;
                for (let i = 1; i <= 3; i++) {
                    const hitRadius = (i === 2) ? 14 : 10;
                    if (Math.abs(c['h' + i + 'x'] - canvasX) < hitRadius && Math.abs(c['h' + i + 'y'] - canvasY) < hitRadius) { foundHandle = { cable: c, hIndex: i }; break; }
                }
                if (foundHandle) break;
            }
        }

        let foundDevice = null; isClickingText = false;
        let slider = document.getElementById('deviceSizeSlider');
        let sMult = (slider && slider.value) ? (parseInt(slider.value) / 14) : (16 / 14);
        let labelScale = 1 + (sMult - 1) * 0.5;

        for (let i = floor.devices.length - 1; i >= 0; i--) {
            let dev = floor.devices[i]; let inBody = false; let inText = false;
            if (!showDeactivatedDevices && dev.type === 'deactivated') continue;

            if (dev.type === 'textNode') {
                ctx.font = "bold " + (13 * labelScale) + "px sans-serif"; let w = ctx.measureText(dev.manualName || tr("Poznámka")).width;
                inBody = canvasX >= dev.x - w/2 - 6*labelScale && canvasX <= dev.x + w/2 + 6*labelScale && canvasY >= dev.y - 11*labelScale && canvasY <= dev.y + 11*labelScale;
            } else {
                inBody = Math.abs(dev.x - canvasX) < 22*sMult && Math.abs(dev.y - canvasY) < 22*sMult;
                let textX = dev.x + 20*sMult; let textY = dev.y + 20*sMult;
                inText = canvasX >= textX - 10*labelScale && canvasX <= textX + 50*labelScale && canvasY >= textY - 10*labelScale && canvasY <= textY + 20*labelScale;
            }
            if (inBody || inText) { foundDevice = dev; if (inText && !inBody) isClickingText = true; break; }
        }

        let foundCableId = null;
        if (!foundHandle && !foundDevice && floor.showConnections) { foundCableId = hitTestCables(canvasX, canvasY, floor, showDeactivatedDevices); }

        if (foundHandle) { draggedHandle = foundHandle; isDragging = true; } 
        else if (foundDevice) { draggedDevice = foundDevice; isDragging = true; } 
        else if (foundCableId) { clickedCableId = foundCableId; } 
        else { isSelecting = true; selStartX = canvasX; selStartY = canvasY; selEndX = canvasX; selEndY = canvasY; }
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
    let rect = container.getBoundingClientRect();
    let mX = e.clientX - rect.left; let mY = e.clientY - rect.top;

    if (isOverviewMode) return;

    const canvasX = (mX - offsetX) / scale; const canvasY = (mY - offsetY) / scale;
    lastMouseX = canvasX; lastMouseY = canvasY;
    pointerCanvasX = mX; pointerCanvasY = mY;
    const pointerFloor = floors[currentFloorIndex];
    if (!pointerFloor || !pointerFloor.image) requestRedraw();

    if (isPanning) { 
        offsetX = e.clientX - startPanX; offsetY = e.clientY - startPanY; 
        requestRedraw();
    } else if (isSelecting) { selEndX = canvasX; selEndY = canvasY; requestRedraw(); 
    } else if (isDragging) {
        if (draggedDevice && !isClickingText) { 
            let snap = getSnappedCoords(canvasX, canvasY, floors[currentFloorIndex], scale, draggedDevice.id, null, null, showDeactivatedDevices);
            if (e.altKey) { snap.x = canvasX; snap.y = canvasY; snapGuideX = null; snapGuideY = null; }
            else { snapGuideX = snap.guideX; snapGuideY = snap.guideY; }

            const deltaX = snap.x - draggedDevice.x;
            const deltaY = snap.y - draggedDevice.y;
            draggedDevice.x = snap.x; draggedDevice.y = snap.y;
            floors[currentFloorIndex].cables.forEach(c => {
                if (c.fromId === draggedDevice.id || c.toId === draggedDevice.id) {
                    let d1 = floors[currentFloorIndex].devices.find(d => d.id === c.fromId);
                    let d2 = floors[currentFloorIndex].devices.find(d => d.id === c.toId);
                    if (!d1 || !d2 || d1.type === 'textNode' || d2.type === 'textNode') return;
                    if (c.h1x === undefined || !Number.isFinite(c.h1x)) {
                        recalcCableHandles(c, d1, d2);
                    }
                    for (let handleIndex = 1; handleIndex <= 3; handleIndex++) {
                        c[`h${handleIndex}x`] += deltaX;
                        c[`h${handleIndex}y`] += deltaY;
                    }
                    c.isCustom = true;
                }
            });
            requestRedraw();
        } else if (draggedHandle) {
            const targetObj = draggedHandle.cable;
            let d1 = floors[currentFloorIndex].devices.find(d => d.id === targetObj.fromId);
            let d2 = floors[currentFloorIndex].devices.find(d => d.id === targetObj.toId);
            let snap = getSnappedCoords(canvasX, canvasY, floors[currentFloorIndex], scale, null, d1, d2, showDeactivatedDevices);
            if (e.altKey) { snap.x = canvasX; snap.y = canvasY; snapGuideX = null; snapGuideY = null; }
            else { snapGuideX = snap.guideX; snapGuideY = snap.guideY; }

            targetObj['h' + draggedHandle.hIndex + 'x'] = snap.x; targetObj['h' + draggedHandle.hIndex + 'y'] = snap.y;
            targetObj.isCustom = true;
            if (draggedHandle.hIndex === 2 && d1 && d2) {
                targetObj.h1x = d1.x + (snap.x - d1.x) / 2; targetObj.h1y = d1.y + (snap.y - d1.y) / 2;
                targetObj.h3x = snap.x + (d2.x - snap.x) / 2; targetObj.h3y = snap.y + (d2.y - snap.y) / 2;
            }
            requestRedraw();
        }
    }

    // ===============================================
    // ЛОГИКА ТУЛТИПА И ПОДСВЕТКИ (КРУЖОЧЕК + РУЧКА)
    // ===============================================
    const tooltip = document.getElementById('deviceTooltip');
    if (tooltip) {
        if (suppressedDeviceTooltipPoint && Math.hypot(e.clientX - suppressedDeviceTooltipPoint.x, e.clientY - suppressedDeviceTooltipPoint.y) > 4) suppressedDeviceTooltipPoint = null;
        if (isPanning || isDragging || isSelecting || e.pointerType !== 'mouse' || suppressedDeviceTooltipPoint || !window.hasProAccess?.()) {
            tooltip.style.opacity = "0";
            container.style.cursor = isPanning ? 'grabbing' : 'crosshair';
            if (window.hoveredDeviceId !== null) { window.hoveredDeviceId = null; requestRedraw(); }
            return;
        }

        let foundHoverDevice = null;
        let slider = document.getElementById('deviceSizeSlider');
        let sMult = (slider && slider.value) ? (parseInt(slider.value) / 14) : (16 / 14);
        let labelScale = 1 + (sMult - 1) * 0.5;

        for (let i = floors[currentFloorIndex].devices.length - 1; i >= 0; i--) {
            let dev = floors[currentFloorIndex].devices[i];
            if (!showDeactivatedDevices && dev.type === 'deactivated') continue;

            let inBody = false;
            if (dev.type === 'textNode') {
                ctx.font = "bold " + (13 * labelScale) + "px sans-serif";
                let w = ctx.measureText(dev.manualName || tr("Poznámka")).width;
                inBody = canvasX >= dev.x - w/2 - 6*labelScale && canvasX <= dev.x + w/2 + 6*labelScale && canvasY >= dev.y - 11*labelScale && canvasY <= dev.y + 11*labelScale;
            } else {
                inBody = Math.abs(dev.x - canvasX) < 22*sMult && Math.abs(dev.y - canvasY) < 22*sMult;
            }

            if (inBody) { foundHoverDevice = dev; break; }
        }

        // ЕСЛИ МЫШКА НАД ДАТЧИКОМ
        if (foundHoverDevice) {
            // 1. Меняем курсор на ручку
            container.style.cursor = 'pointer';
            
            // 2. Зажигаем кружок подсветки (вызываем перерисовку)
            if (window.hoveredDeviceId !== foundHoverDevice.id) {
                window.hoveredDeviceId = foundHoverDevice.id;
                requestRedraw();
            }

            // 3. Заполняем и показываем подсказку
            const names = {
                pir: "PIR Detektor", pir_wl: tr("Bezdrátový PIR"), magnet: tr("Magnetický kontakt"), magnet_wl: tr("Bezdrátový Magnet"), 
                glassbreak: tr("Tříštění skla"), panic: tr("Tísňové tlačítko"), siren: tr("Siréna"), panel: tr("Ústředna EZS"), 
                expander: tr("Expandér (EXP)"), abax: "Modul ABAX2", keypad: tr("Klávesnice"), deactivated: tr("Deaktivováno"), 
                textNode: tr("Textová poznámka"), ramen: tr("Tajný Ramen"), cableTool: tr("Nástroj kabelu")
            };

            document.getElementById('ttType').textContent = names[foundHoverDevice.type] || foundHoverDevice.type.toUpperCase();

            if (['textNode', 'panel', 'ramen', 'deactivated'].includes(foundHoverDevice.type)) {
                document.getElementById('ttNumber').style.display = 'none';
                document.getElementById('ttLoop').style.display = 'none';
            } else {
                document.getElementById('ttNumber').style.display = 'block';
                document.getElementById('ttLoop').style.display = 'block';
                
                let isManual = foundHoverDevice.manualNumber ? tr(" (Ručně)") : "";
                const address = getDeviceAddressParts(foundHoverDevice);
                document.getElementById('ttNumber').innerHTML = `${tr('Adresa')}: ${address.prefix}<strong>${address.number || 'Auto'}</strong><span>${isManual}</span>`;
                document.getElementById('ttLoop').textContent = tr`Sběrnice: ${foundHoverDevice.loopId || 1}`;
            }

            if (foundHoverDevice.manualName && foundHoverDevice.type !== 'textNode') {
                document.getElementById('ttName').style.display = 'block';
                document.getElementById('ttName').textContent = `📝 ${foundHoverDevice.manualName}`;
            } else {
                document.getElementById('ttName').style.display = 'none';
            }

            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
            tooltip.style.opacity = "1";
            
        // ЕСЛИ МЫШКА В ПУСТОМ МЕСТЕ
        } else {
            // Возвращаем обычный прицел и прячем подсветку/тултип
            container.style.cursor = 'crosshair';
            if (window.hoveredDeviceId !== null) {
                window.hoveredDeviceId = null;
                requestRedraw();
            }
            tooltip.style.opacity = "0";
        }
    }
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
    if (e.pointerType === 'touch') {
        canvasTouchPoints.delete(e.pointerId);
        if (canvasTouchGesture) {
            if (!canvasTouchPoints.size) canvasTouchGesture = null;
            return;
        }
    }
    if (!e.isPrimary || !isSystemReady) return;
    const dist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
    if (isOverviewMode) return;

    const canvasX = (e.clientX - container.getBoundingClientRect().left - offsetX) / scale; 
    const canvasY = (e.clientY - container.getBoundingClientRect().top - offsetY) / scale;
    
    const floor = floors[currentFloorIndex];
    if (isPanning) { isPanning = false; return; }

    if (isSelecting) {
        isSelecting = false;
        if (dist > 5) { 
            let minX = Math.min(selStartX, selEndX); let maxX = Math.max(selStartX, selEndX);
            let minY = Math.min(selStartY, selEndY); let maxY = Math.max(selStartY, selEndY);
            if (!e.shiftKey) activeDeviceIds.clear(); 
            floor.devices.forEach(d => { 
                if (!showDeactivatedDevices && d.type === 'deactivated') return;
                if (d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY) { activeDeviceIds.add(d.id); }
            });
        } else {
            if (selectedTool !== 'cableTool' && selectedTool !== 'select') {
                let snap = getSnappedCoords(canvasX, canvasY, floor, scale, null, null, null, showDeactivatedDevices);
                if (e.altKey) { snap.x = canvasX; snap.y = canvasY; }
                const newId = genId(); const loopId = parseInt(loopSelect.value);
                
                let tempDev = { id: newId, x: snap.x, y: snap.y, type: selectedTool, manualName: "", loopId: loopId, rotation: 0, manualNumber: null };
                if (['pir', 'pir_wl'].includes(selectedTool)) {
                    tempDev.pirRangePixels = floor.pirRangePixels;
                }
                floor.devices.push(tempDev);
                calculateDynamicNumbersGlobal(floors);

                if (activeDeviceIds.size === 1) {
                    let firstId = Array.from(activeDeviceIds)[0];
                    let existingIdx = floor.cables.findIndex(c => (c.fromId === firstId && c.toId === newId) || (c.fromId === newId && c.toId === firstId));
                    if (existingIdx === -1) {
                        let cObj = { id: genId(), fromId: firstId, toId: newId, isCustom: false };
                        let d1 = floor.devices.find(d => d.id === firstId);
                        if (d1) recalcCableHandles(cObj, d1, {x: snap.x, y: snap.y});
                        floor.cables.push(cObj);
                    }
                }
                activeDeviceIds.clear(); activeDeviceIds.add(newId); 
                saveStateToHistory();
            } else { activeDeviceIds.clear(); }
        }
        snapGuideX = null; snapGuideY = null; requestRedraw(); triggerAutoSave();
    } 
    else if (dist < 5) { 
        if (draggedDevice) {
            const dev = draggedDevice;
            if (clickTimer && lastClickedDevice === dev.id) {
                clearTimeout(clickTimer); clickTimer = null; lastClickedDevice = null;
                if (dev.type === 'textNode') { 
                    openTextModal(dev); 
                } else if (!['panel', 'deactivated', 'ramen', 'cableTool'].includes(dev.type)) {
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
                                let existingIdx = floor.cables.findIndex(c => (c.fromId === firstId && c.toId === dev.id) || (c.fromId === dev.id && c.toId === firstId));
                                if (existingIdx === -1) {
                                    let cObj = { id: genId(), fromId: firstId, toId: dev.id, isCustom: false };
                                    let d1 = floor.devices.find(d => d.id === firstId);
                                    if(d1) recalcCableHandles(cObj, d1, dev);
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
            if (draggedHandle.hIndex === 2) { floor.cables = floor.cables.filter(c => c.id !== draggedHandle.cable.id); }
            snapGuideX = null; snapGuideY = null; saveStateToHistory(); requestRedraw(); triggerAutoSave();
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
    
    if (isDragging) { saveStateToHistory(); triggerAutoSave(); }

    isDragging = false; draggedDevice = null; draggedHandle = null; isClickingText = false; clickedCableId = null; snapGuideX = null; snapGuideY = null;
});

container.addEventListener('pointercancel', () => {
    canvasTouchPoints.clear();
    canvasTouchGesture = null;
    clearCanvasDrag();
    requestRedraw();
});

function loadDefaultFloors(showWelcome = false, newProjectName = tr("Nový projekt")) {
    resetPlacementTool();
    window.resetActiveCloudProject?.();
    customDeviceIcons = {};
    if (typeof refreshCustomDeviceIcons === 'function') refreshCustomDeviceIcons();
    floors = [
        { name: "2PP", image: null, imgData: null, devices: [], cables: [], showConnections: true, wallThreshold: 100, pirRangePixels: 300, wallMask: null },
        { name: "1PP", image: null, imgData: null, devices: [], cables: [], showConnections: true, wallThreshold: 100, pirRangePixels: 300, wallMask: null },
        { name: "1NP", image: null, imgData: null, devices: [], cables: [], showConnections: true, wallThreshold: 100, pirRangePixels: 300, wallMask: null },
        { name: "2NP", image: null, imgData: null, devices: [], cables: [], showConnections: true, wallThreshold: 100, pirRangePixels: 300, wallMask: null },
        { name: "3NP", image: null, imgData: null, devices: [], cables: [], showConnections: true, wallThreshold: 100, pirRangePixels: 300, wallMask: null }
    ];
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
    resetPlacementTool();
    if (!['auth', 'email'].includes(step) && !window.getFirebaseUser?.()) step = 'auth';
    const modal = document.getElementById('welcomeModal');
    modal.dataset.step = step;
    modal.style.display = 'flex';
    document.getElementById('welcomeAuthBlock').hidden = step !== 'auth';
    document.getElementById('welcomeEmailBlock').hidden = step !== 'email';
    document.getElementById('welcomeButtonsBlock').hidden = step !== 'projects';
    document.getElementById('btnWelcomeAccount').hidden = step === 'auth';
    const naming = document.getElementById('welcomeNamingBlock');
    naming.hidden = step !== 'naming';
    naming.style.display = step === 'naming' ? 'flex' : 'none';
}

function resetPlacementTool() {
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

        const menuTitleEl = document.getElementById('menuTitleContainer');
        if(menuTitleEl) { menuTitleEl.textContent = 'GooM'; }
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
                setTimeout(() => window.startGoomOnboarding?.(), 350);
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
                        const [handle] = await window.showOpenFilePicker({ types: [{ description: 'BIPS Projekt', accept: {'application/json': ['.bips']} }] });
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
            if (!window.getFirebaseUser?.()) { showWelcomeScreen(); return; }
            resumeButton.disabled = true;
            try {
                if (!await loadFromDB()) throw new Error(tr('Локальное сохранение недоступно. Создайте или откройте другой проект.'));
                isSystemReady = true;
                changeFloor(); saveStateToHistory(); requestRedraw();
                document.getElementById('welcomeModal').style.display = 'none';
            } catch (error) {
                showAppAlert(error.message, tr('Не удалось продолжить проект'));
            } finally {
                resumeButton.disabled = false;
            }
        };

        isSystemReady = false; requestRedraw();
        showWelcomeScreen();
        await initDB();
        const savedProject = await getSavedProjectData();
        resumeButton.hidden = !savedProject?.floors?.length;

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
    editingDevice = null; clearCanvasDrag(); window.clearGoomTooltips?.();
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
    const floor = floors[currentFloorIndex];
    if (!floor || !floor.image) { scale = 1; offsetX = 0; offsetY = 0; return; }
    let bw = floor.image.width; let bh = floor.image.height;
    let scaleX = planCanvasWidth() / bw; let scaleY = planCanvasHeight() / bh;
    scale = Math.min(scaleX, scaleY) * 0.95; 
    if (scale > 1) scale = 1; 
    offsetX = (planCanvasWidth() - bw * scale) / 2; offsetY = (planCanvasHeight() - bh * scale) / 2;
}

function changeFloor() {
    if(!floors[currentFloorIndex]) return;
    
    let btnConn = document.getElementById('btnToggleConnections');
    if (btnConn) {
        btnConn.innerHTML = floors[currentFloorIndex].showConnections ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Skrýt kabely` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg> Zobrazit kabely`;
    }
    
    centerCurrentFloor(); activeDeviceIds.clear(); requestRedraw(); triggerAutoSave();
}

document.getElementById('imageLoader').addEventListener('change', async function(e) {
 const floor=floors[currentFloorIndex],file=e.target.files[0];e.target.value='';
 if(!floor||!file||!isSystemReady)return;
 isSystemReady=false;container.setAttribute('aria-busy','true');requestRedraw();
 try {
  await new Promise(requestAnimationFrame);
  const imported=await importPlanSource(file,floor);
  if(imported){Object.assign(floor,imported);isSystemReady=true;changeFloor();saveStateToHistory();triggerAutoSave();
   if(imported.vectorPlan?.unsupported.length)showAppAlert(tr`Nepodporované prvky DXF: ${imported.vectorPlan.unsupported.join(', ')}`,tr('Import DXF'));
  }
 } catch(error){console.error(error);showAppAlert(error.message,tr('Chyba načítání výkresu'));}
 finally{isSystemReady=true;container.removeAttribute('aria-busy');requestRedraw();}
});

function importFileContent(file, options = {}) {
    const wasSystemReady = isSystemReady;
    return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            if (!text || text.trim() === "") throw new Error(tr("Soubor je prázdný."));

            const data = JSON.parse(text);
            window.resetActiveCloudProject?.();
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
            
            if (data && data.currentMaxLines) currentMaxLines = data.currentMaxLines;
            customDeviceIcons = data && data.customDeviceIcons && typeof data.customDeviceIcons === 'object' ? data.customDeviceIcons : {};
            let slider = document.getElementById('deviceSizeSlider');
            if (data && data.deviceSize && slider) slider.value = data.deviceSize;
            
            if (data && data.projectName) {
                projectName = data.projectName;
            } else {
                projectName = (file && file.name) ? file.name.replace(/\.bips$/i, '') : tr("Obnovený projekt");
            }
            
            let pInput = document.getElementById('projectNameInput');
            if (pInput) pInput.value = projectName;

            updateLoopSelect();
            isSystemReady = false; requestRedraw(); 

            floors = await loadFloorsImages(loadedFloors);
            if (typeof refreshCustomDeviceIcons === 'function') refreshCustomDeviceIcons();
            
            currentFloorIndex = (data && data.currentFloorIndex !== undefined) ? data.currentFloorIndex : 0;
            if (currentFloorIndex >= floors.length || currentFloorIndex < 0) currentFloorIndex = 0; 
            resetPlacementTool();
            isSystemReady = true; 
            changeFloor(); 
            saveStateToHistory(); 
            triggerAutoSave(options);
            document.getElementById('welcomeModal').style.display = 'none';
            resolve(true);

        } catch (err) { 
            console.error("Chyba importu:", err);
            showAppAlert(tr("Chyba při načítání souboru .BIPS!\n\nDetail chyby: ") + err.message, tr('Ошибка открытия проекта')); 
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
    editingDevice = dev; 
    let inp = document.getElementById('devNumberInput');
    inp.value = dev.manualNumber || dev.number || ""; 
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
        let category = ['expander', 'keypad', 'abax', 'siren'].includes(editingDevice.type) ? editingDevice.type : editingDevice.loopId;
        
        for (let f of floors) {
            if (!f.devices) continue;
            for (let d of f.devices) {
                if (d.id !== editingDevice.id && (d.manualNumber === newNum || d.number === newNum)) {
                    let dCat = ['expander', 'keypad', 'abax', 'siren'].includes(d.type) ? d.type : d.loopId;
                    if (dCat === category) { isTaken = true; break; }
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
        if (editingDevice) {
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
initProject();
