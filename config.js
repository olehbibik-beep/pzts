// ==========================================
// 1. CONFIG: NASTAVENÍ BAREV A PROMĚNNÝCH
// ==========================================
const COLORS = {
    pir: "#22c55e",         
    pir_wl: "#22c55e",      
    magnet: "#ef4444",      
    magnet_wl: "#ef4444",   
    glassbreak: "#22c55e",  
    panic: "#ef4444",       
    siren: "#ef4444",       
    acs_module: "#6d28d9",
    acs_reader: "#6d28d9",
    smoke: "#dc2626",
    cctv_bullet: "#0284c7",
    cctv_dome: "#0284c7",
    cctv_ptz: "#7c3aed",
    cctv_nvr: "#2563eb",
    cctv_poe: "#0f766e",
    panel: "#0ea5e9",       
    keypad: "#3f3f46",      
    expander: "#0ea5e9",    
    abax: "#0ea5e9",        
    deactivated: "#8d8d99", 
    text: "#ffffff"         
};

const NEW_TOOLBAR_DEVICE_TYPES = window.goomProduct === 'CCTV' ? [] : ['acs_module', 'acs_reader', 'smoke'];
const CCTV_CAMERAS = {
    cctv_bullet: { label: 'Válcová kamera', angle: 65, range: 300 },
    cctv_dome: { label: 'Kopulová kamera', angle: 100, range: 220 },
    cctv_ptz: { label: 'PTZ kamera', angle: 45, range: 450 }
};
const CCTV_DEVICE_LABELS = {
    ...Object.fromEntries(Object.entries(CCTV_CAMERAS).map(([type, camera]) => [type, camera.label])),
    cctv_nvr: 'Síťový videorekordér (NVR)',
    cctv_poe: 'PoE přepínač'
};
const ADDITIONAL_DEVICE_LABELS = window.goomProduct === 'CCTV' ? CCTV_DEVICE_LABELS : {
    acs_module: 'Modul přístupového systému (ACS)',
    acs_reader: 'Čtečka přístupového systému (ACS)',
    smoke: 'Kouřový hlásič'
};

// --- ИКОНКИ И ЛОГОТИПЫ ---
const LOGO_SMALL = '<img src="Logo.png" style="width: 26px; height: 26px; margin-right: 8px; vertical-align: middle; object-fit: contain;">';
const LOGO_LARGE = '<img src="Logo.png" style="width: 120px; height: 120px; margin: 0 auto; display: block; object-fit: contain;">';

const ICONS = {
    eyeOpen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    eyeClosed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
    showDeac: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`,
    hideDeac: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px; opacity:0.3;"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`
};

const DB_NAME = window.goomProduct === 'CCTV' ? 'GooM_CCTV_V1' : 'ExirtaZS_DB_V5';
const STORE_NAME = 'autosave_store';
const MAX_HISTORY = 20;
const APP_PRODUCT = window.goomProduct || 'PZTS';
function productStorageKey(key) {
    return APP_PRODUCT === 'CCTV' ? `${key}:CCTV` : key;
}
function getCameraOptics(device) {
    if (!Object.hasOwn(CCTV_CAMERAS, device.type)) return null;
    const defaults = CCTV_CAMERAS[device.type];
    return {
        angle: Number.isFinite(device.cameraAngle) ? Math.min(180, Math.max(10, Math.round(device.cameraAngle))) : defaults.angle,
        range: Number.isFinite(device.cameraRange) ? Math.min(1000, Math.max(10, Math.round(device.cameraRange))) : defaults.range
    };
}
function hasDeviceCoverage(device) {
    if(!isOwnPlanEntity(device))return false;
    return APP_PRODUCT === 'CCTV' ? Object.hasOwn(CCTV_CAMERAS, device.type) : ['pir', 'pir_wl', 'glassbreak'].includes(device.type);
}
const STANDARD_FLOOR_NAMES=['3PP','2PP','1PP','1NP','2NP','3NP','4NP','5NP','6NP'];
function createEmptyProjectFloor(name){
    return {name,image:null,imgData:null,devices:[],cables:[],legend:null,showConnections:true,wallThreshold:100,pirRangePixels:300,wallMask:null};
}

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBf39BTvRIPejOCuP-OCGJk9uvvTwNM4zM",
    authDomain: "pztsepscctv.firebaseapp.com",
    projectId: "pztsepscctv",
    storageBucket: "pztsepscctv.firebasestorage.app",
    appId: "1:464125970985:web:3a705828fcabef7477ea38"
};
