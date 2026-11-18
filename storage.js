// ==========================================
// 4. STORAGE: DATABÁZE A HISTORIE
// ==========================================

function sanitizeProjectIcons(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([type]) => type !== 'ramen'));
}

function sanitizeFloors(floorDataArray) {
    if (!Array.isArray(floorDataArray)) return []; 
    
    const existing=[...floorDataArray];
    const names=new Set(existing.map(f=>String(f.name||'').replace(/\s/g,'').toUpperCase()));
    for(const name of STANDARD_FLOOR_NAMES)if(!names.has(name))existing.push(createEmptyProjectFloor(name));
    return existing.map(f => {
        const devices = Array.isArray(f.devices) ? f.devices.filter(device => device && device.type !== 'ramen') : [];
        const ids = new Set(devices.map(device => device.id));
        const newFloor = { 
            name: f.name || "NP", 
            image: null, 
            imgData: f.imgData || null, 
            devices,
            cables: Array.isArray(f.cables) ? f.cables.filter(cable => cable && ids.has(cable.fromId) && ids.has(cable.toId)) : [],
            addressReservations: mergeAddressReservations(Array.isArray(f.addressReservations) ? f.addressReservations : []),
            showConnections: f.showConnections !== false,
            wallThreshold: Number.isFinite(f.wallThreshold) ? Math.min(255, Math.max(0, f.wallThreshold)) : 100,
            pirRangePixels: 300,
            planTheme: ['original','light'].includes(f.planTheme) ? f.planTheme : 'dark',
            satellite: ['Esri World Imagery','Esri World Imagery Clarity','Esri World Imagery Hybrid','Esri World Topographic Map'].includes(f.satellite?.provider) && Array.isArray(f.satellite.center) && f.satellite.center.length === 2 && f.satellite.center.every(Number.isFinite)
                ? {provider:f.satellite.provider,footerHeight:f.satellite.footerHeight===0?0:28,page:f.satellite.page?.dpi===300?{widthMM:297,heightMM:210,dpi:300,width:3508,height:2480}:null,layer:f.satellite.provider==='Esri World Topographic Map'?'topo':f.satellite.provider==='Esri World Imagery Hybrid'?'hybrid':'satellite',center:[Math.max(-85,Math.min(85,f.satellite.center[0])),((f.satellite.center[1]+180)%360+360)%360-180],zoom:Math.max(2,Math.min(24,Math.round(Number(f.satellite.zoom)||17))),attribution:String(f.satellite.attribution||'').slice(0,300)} : null,
            vectorPlan: sanitizeVectorPlan(f.vectorPlan),
            pdfSource: typeof f.pdfSource === 'string' && /^data:application\/pdf(?:;[^,]*)?;base64,/.test(f.pdfSource) ? f.pdfSource : null,
            pdfPage: Number.isInteger(f.pdfPage) && f.pdfPage > 0 ? f.pdfPage : 1,
            rasterSource: typeof f.rasterSource==='string' && /^data:image\//.test(f.rasterSource) ? f.rasterSource : null,
            sourceName: typeof f.sourceName === 'string' ? f.sourceName : '',
            legend: sanitizeProjectLegend(f.legend),
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
                        f.wallMask = f.satellite ? null : createWallMask(f, f.wallThreshold);
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
    const loaded=await Promise.all(promises);calculateDynamicNumbersGlobal(loaded);return loaded;
}

function saveStateToHistory() {
    if (window.isGoomReadOnly?.()) return;
    if (!isSystemReady) return;
    calculateDynamicNumbersGlobal(floors);
    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }
    const state = {
        customDeviceIcons: JSON.parse(JSON.stringify(sanitizeProjectIcons(customDeviceIcons))),
        fData: floors.map(f => ({
            name: f.name, imgData: f.imgData, legend: f.legend ? JSON.parse(JSON.stringify(f.legend)) : null,
            addressReservations: f.addressReservations,
            devices: JSON.parse(JSON.stringify(f.devices)), cables: JSON.parse(JSON.stringify(f.cables)), showConnections: f.showConnections,
            wallThreshold: f.wallThreshold, pirRangePixels: f.pirRangePixels,
            planTheme: f.planTheme, satellite: f.satellite, vectorPlan: f.vectorPlan, pdfSource: f.pdfSource, rasterSource: f.rasterSource, pdfPage: f.pdfPage, sourceName: f.sourceName
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
    customDeviceIcons = sanitizeProjectIcons(state.customDeviceIcons);
    updateLoopSelect();
    floors = await loadFloorsImages(state.fData);
    currentFloorIndex = state.currentFloorIndex;
    if (typeof refreshCustomDeviceIcons === 'function') refreshCustomDeviceIcons();
    isSystemReady = true; updateProjectLegendButton(); requestRedraw(); triggerAutoSave();
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

function triggerAutoSave() {
    if (window.isGoomReadOnly?.()) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveToDB();
    }, 1500);
}

function getProjectDataPayload() {
    let slider = document.getElementById('deviceSizeSlider');
    let dSize = (slider && slider.value) ? parseInt(slider.value) : 16;
    return { 
        version: "1.0",
        format: "TECH",
        application: APP_PRODUCT,
        ownerUid:window.projectOwnerUid||window.getFirebaseUser?.()?.uid||null,
        viewport:{scale,offsetX,offsetY,width:planCanvasWidth(),height:planCanvasHeight()}, 
        projectName: projectName,
        currentFloorIndex: currentFloorIndex, 
        currentMaxLines: currentMaxLines,
        deviceSize: dSize,
        customDeviceIcons: sanitizeProjectIcons(customDeviceIcons),
        pirCoverageVisible: isPirCoverageVisible(),
        floors: floors.map(f => ({
            name: f.name, imgData: f.imgData, devices: f.devices, cables: f.cables, legend: f.legend,
            addressReservations: f.addressReservations,
            showConnections: f.showConnections, wallThreshold: f.wallThreshold, pirRangePixels: f.pirRangePixels,
            planTheme: f.planTheme, satellite: f.satellite, vectorPlan: f.vectorPlan, pdfSource: f.pdfSource, rasterSource: f.rasterSource, pdfPage: f.pdfPage, sourceName: f.sourceName
        }))
    };
}

function saveToDB() {
    if (window.isGoomReadOnly?.()) return;
    if(!isSystemReady || isExporting || !db) return;
    try {
        const projectData = getProjectDataPayload();
        let tx = db.transaction(STORE_NAME, 'readwrite');
        let store = tx.objectStore(STORE_NAME);
        store.put(projectData, 'latest_save');
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
    if (window.isGoomReadOnly?.()) return Promise.resolve(null);
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

async function loadFromDB(options={}) {
    const data = await getSavedProjectData();
    if (!Array.isArray(data?.floors) || !data.floors.length) return false;
    if(options.requireUid&&data.ownerUid&&data.ownerUid!==options.requireUid)return false;
    const loadedFloors = await loadFloorsImages(data.floors);
    if(options.requireUid&&window.getFirebaseUser?.()?.uid!==options.requireUid)return false;
    window.projectOwnerUid=data.ownerUid||window.getFirebaseUser?.()?.uid||null;
    window.restoredPlanViewport=data.viewport;
    if (data.currentMaxLines) currentMaxLines = data.currentMaxLines;
    customDeviceIcons = sanitizeProjectIcons(data.customDeviceIcons);
    const slider = document.getElementById('deviceSizeSlider');
    if (data.deviceSize && slider) slider.value = data.deviceSize;
    updateLoopSelect();
    floors = loadedFloors;
    setPirCoverageVisible(data.pirCoverageVisible !== false);
    currentFloorIndex = Number.isInteger(data.currentFloorIndex) && data.currentFloorIndex >= 0 && data.currentFloorIndex < floors.length
        ? data.currentFloorIndex : 0;
    projectName = data.projectName || tr('Nový projekt');
    const pInput = document.getElementById('projectNameInput');
    if (pInput) pInput.value = projectName;
    if (typeof refreshCustomDeviceIcons === 'function') refreshCustomDeviceIcons();
    return true;
}

function exportToTECH() {
    if(!floors.length){showAppAlert(tr('Žádná data k exportu.'),tr('Экспорт проекта'));return;}
    try{
        const blob=new Blob([JSON.stringify(getProjectDataPayload())],{type:'application/json;charset=utf-8'});
        const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
        link.download=(projectName||'projekt')+'.TECH';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(error){console.error(error);showAppAlert(tr('Chyba při generování exportu.'),tr('Ошибка экспорта'));}
}
