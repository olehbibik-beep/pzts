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
    panel: "#0ea5e9",       
    keypad: "#3f3f46",      
    expander: "#0ea5e9",    
    abax: "#0ea5e9",        
    deactivated: "#8d8d99", 
    text: "#ffffff"         
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

const DB_NAME = 'ExirtaZS_DB_V5'; 
const STORE_NAME = 'autosave_store';
const MAX_HISTORY = 20;

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBf39BTvRIPejOCuP-OCGJk9uvvTwNM4zM",
    authDomain: "pztsepscctv.firebaseapp.com",
    projectId: "pztsepscctv",
    storageBucket: "pztsepscctv.firebasestorage.app",
    appId: "1:464125970985:web:3a705828fcabef7477ea38"
};