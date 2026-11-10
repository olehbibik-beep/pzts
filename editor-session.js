const editorReload=performance.getEntriesByType('navigation')[0]?.type==='reload';
let reloadResumeAttempted=false;
function applySavedPlanViewport(view){
    if(!view||![view.scale,view.offsetX,view.offsetY].every(Number.isFinite)||view.scale<.005||view.scale>128)return;
    scale=view.scale;offsetX=view.offsetX;offsetY=view.offsetY;
    if(Number.isFinite(view.width)&&Number.isFinite(view.height)){offsetX+=(planCanvasWidth()-view.width)/2;offsetY+=(planCanvasHeight()-view.height)/2;}
    requestRedraw();
}
async function restoreEditorAfterReload(user) {
    if (!user) return;
    try{
        await window.localProjectStartup;
        if(isSystemReady||window.getFirebaseUser?.()?.uid!==user.uid)return;
        const saved=await getSavedProjectData();
        if(!saved?.floors?.length||(saved.ownerUid&&saved.ownerUid!==user.uid))return;
        if(!await loadFromDB({requireUid:user.uid}))return;
        if(window.getFirebaseUser?.()?.uid!==user.uid)return;
        isSystemReady=true;changeFloor();applySavedPlanViewport(saved.viewport);saveStateToHistory();
        document.getElementById('welcomeModal').style.display='none';triggerAutoSave({skipCloudSync:true});requestRedraw();
    }catch(error){console.warn('Resume after reload:',error);showWelcomeScreen();}
}
document.addEventListener('goom-auth-state-changed', event => {
    if (!editorReload || reloadResumeAttempted) return;
    reloadResumeAttempted = true;
    window.initialEditorResume = restoreEditorAfterReload(event.detail.user);
});
window.addEventListener('pagehide',()=>{if(typeof stopDeviceRotation==='function')stopDeviceRotation();if(isSystemReady)saveToDB({skipCloudSync:true});});
