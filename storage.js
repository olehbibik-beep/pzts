// ==========================================
// 4. STORAGE: DATABÁZE A HISTORIE
// ==========================================

function sanitizeFloors(floorDataArray) {
    if (!Array.isArray(floorDataArray)) return []; 
    
    return floorDataArray.map(f => {
        const newFloor = { 
            name: f.name || "NP", 
            image: null, 
            imgData: f.imgData || null, 
            devices: Array.isArray(f.devices) ? f.devices : [], 
            cables: Array.isArray(f.cables) ? f.cables : [],    
            showConnections: f.showConnections !== false,
            wallThreshold: Number.isFinite(f.wallThreshold) ? Math.min(255, Math.max(0, f.wallThreshold)) : 100,
            pirRangePixels: 300,
            planTheme: f.planTheme === 'original' ? 'original' : 'dark',
            vectorPlan: sanitizeVectorPlan(f.vectorPlan),
            pdfSource: typeof f.pdfSource === 'string' && /^data:application\/pdf(?:;[^,]*)?;base64,/.test(f.pdfSource) ? f.pdfSource : null,
            pdfPage: Number.isInteger(f.pdfPage) && f.pdfPage > 0 ? f.pdfPage : 1,
            rasterSource: typeof f.rasterSource==='string' && /^data:image\//.test(f.rasterSource) ? f.rasterSource : null,
            sourceName: typeof f.sourceName === 'string' ? f.sourceName : '',
            wallMask: null
        };

        newFloor.devices.forEach(device => {
            if (['pir', 'pir_wl', 'glassbreak'].includes(device.type)) {
                device.pirRangePixels = 300;
            }
        });
        
        newFloor.cables.forEach(c => {
            if (c.h1x === undefined) {
                let d1 = newFloor.devices.find(d => d.id === c.fromId);
                let d2 = newFloor.devices.find(d => d.id === c.toId);
                if (d1 && d2) {
                    c.h1x = d1.x + (d2.x - d1.x)*0.25; c.h1y = d1.y + (d2.y - d1.y)*0.25;
                    c.h2x = d1.x + (d2.x - d1.x)*0.50; c.h2y = d1.y + (d2.y - d1.y)*0.50;
                    c.h3x = d1.x + (d2.x - d1.x)*0.75; c.h3y = d1.y + (d2.y - d1.y)*0.75;
                    c.isCustom = false;
                } else {
                    c.h1x = 0; c.h1y = 0; c.h2x = 0; c.h2y = 0; c.h3x = 0; c.h3y = 0;
                }
            }
        });
        return newFloor;
    });
}

// --- ВОТ ТА САМАЯ ПОТЕРЯННАЯ ФУНКЦИЯ ---
async function loadFloorsImages(floorDataArray) {
    const sanitized = sanitizeFloors(floorDataArray);
    const promises = sanitized.map(f => {
        return new Promise((resolve, reject) => {
            if (f.imgData) {
                const img = new Image();
                img.onload = () => {
                    f.image = img;
                    try {
                        f.wallMask = createWallMask(f, f.wallThreshold);
                        resolve(f);
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = () => { resolve(f); }; 
                img.src = f.imgData;
            } else { resolve(f); }
        });
    });
    return Promise.all(promises);
}

function saveStateToHistory() {
    if (!isSystemReady) return;
    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }
    const state = {
        customDeviceIcons: JSON.parse(JSON.stringify(customDeviceIcons)),
        fData: floors.map(f => ({
            name: f.name, imgData: f.imgData,
            devices: JSON.parse(JSON.stringify(f.devices)), cables: JSON.parse(JSON.stringify(f.cables)), showConnections: f.showConnections,
            wallThreshold: f.wallThreshold, pirRangePixels: f.pirRangePixels,
            planTheme: f.planTheme, vectorPlan: f.vectorPlan, pdfSource: f.pdfSource, rasterSource: f.rasterSource, pdfPage: f.pdfPage, sourceName: f.sourceName
        })),
        currentFloorIndex: currentFloorIndex, currentMaxLines: currentMaxLines
    };
    historyStack.push(state);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    else historyIndex++;
}

async function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        isSystemReady = false; requestRedraw(); 
        await restoreState(historyStack[historyIndex]);
    }
}

async function restoreState(state) {
    currentMaxLines = state.currentMaxLines;
    customDeviceIcons = state.customDeviceIcons && typeof state.customDeviceIcons === 'object' ? state.customDeviceIcons : {};
    updateLoopSelect();
    floors = await loadFloorsImages(state.fData);
    currentFloorIndex = state.currentFloorIndex;
    if (typeof saveCustomIconsToActiveMenu === 'function') saveCustomIconsToActiveMenu();
    if (typeof refreshCustomDeviceIcons === 'function') refreshCustomDeviceIcons();
    isSystemReady = true; requestRedraw(); triggerAutoSave();
}

function initDB() {
    return new Promise((resolve) => {
        let request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = e => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = e => { db = e.target.result; resolve(true); };
        request.onerror = e => { console.warn("DB Disabled"); resolve(false); };
    });
}

function triggerAutoSave(options = {}) {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveToDB(options);
        if (!options.skipCloudSync) window.scheduleCloudSync?.();
    }, 1500);
}

function getProjectDataPayload() {
    let slider = document.getElementById('deviceSizeSlider');
    let dSize = (slider && slider.value) ? parseInt(slider.value) : 16;
    return { 
        version: "1.0", 
        projectName: projectName,
        currentFloorIndex: currentFloorIndex, 
        currentMaxLines: currentMaxLines,
        deviceSize: dSize,
        customDeviceIcons,
        floors: floors.map(f => ({
            name: f.name, imgData: f.imgData, devices: f.devices, cables: f.cables,
            showConnections: f.showConnections, wallThreshold: f.wallThreshold, pirRangePixels: f.pirRangePixels,
            planTheme: f.planTheme, vectorPlan: f.vectorPlan, pdfSource: f.pdfSource, rasterSource: f.rasterSource, pdfPage: f.pdfPage, sourceName: f.sourceName
        }))
    };
}

function saveToDB(options = {}) {
    if(!isSystemReady || isExporting || !db) return;
    try {
        const projectData = getProjectDataPayload();
        let tx = db.transaction(STORE_NAME, 'readwrite');
        let store = tx.objectStore(STORE_NAME);
        store.put(projectData, 'latest_save');
        tx.oncomplete = () => {
            if (!options.skipCloudSync) window.scheduleCloudSync?.();
        };
        tx.onerror = () => {
            console.error('Ошибка локального автосохранения:', tx.error);
            window.setCloudSyncStatus?.(tr('Ошибка локального сохранения'), 'error');
        };
    } catch (error) {
        console.error('Ошибка локального автосохранения:', error);
        window.setCloudSyncStatus?.(tr('Ошибка локального сохранения'), 'error');
    }
}

function getSavedProjectData() {
    if (!db) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        let tx = db.transaction(STORE_NAME, 'readonly');
        let store = tx.objectStore(STORE_NAME);
        let req = store.get('latest_save');
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror = () => reject(req.error);
        tx.onabort = () => reject(tx.error || new Error(tr('Не удалось прочитать локальное сохранение.')));
    });
}

async function loadFromDB() {
    const data = await getSavedProjectData();
    if (!Array.isArray(data?.floors) || !data.floors.length) return false;
    const loadedFloors = await loadFloorsImages(data.floors);
    if (data.currentMaxLines) currentMaxLines = data.currentMaxLines;
    customDeviceIcons = data.customDeviceIcons && typeof data.customDeviceIcons === 'object' ? data.customDeviceIcons : {};
    const slider = document.getElementById('deviceSizeSlider');
    if (data.deviceSize && slider) slider.value = data.deviceSize;
    updateLoopSelect();
    floors = loadedFloors;
    currentFloorIndex = Number.isInteger(data.currentFloorIndex) && data.currentFloorIndex >= 0 && data.currentFloorIndex < floors.length
        ? data.currentFloorIndex : 0;
    projectName = data.projectName || tr('Nový projekt');
    const pInput = document.getElementById('projectNameInput');
    if (pInput) pInput.value = projectName;
    if (typeof refreshCustomDeviceIcons === 'function') refreshCustomDeviceIcons();
    return true;
}

function exportToBIPS() {
    if (floors.length === 0) { showAppAlert(tr("Žádná data k exportu."), tr('Экспорт проекта')); return; }
    try {
        const payload = getProjectDataPayload();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", (projectName || "projekt") + ".bips");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    } catch (err) {
        showAppAlert(tr("Chyba při generování exportu."), tr('Ошибка экспорта'));
        console.error(err);
    }
}
