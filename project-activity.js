// Only explicit new-project confirmations enqueue an event; opening/importing never does.
(() => {
    let flushing=false;
    const key=uid=>`goom.project-starts.${uid}.${APP_PRODUCT}`;
    function read(uid){try{const value=JSON.parse(localStorage.getItem(key(uid))||'[]');return Array.isArray(value)?value.filter(id=>typeof id==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(id)).slice(-100):[];}catch{return[];}}
    function write(uid,ids){try{localStorage.setItem(key(uid),JSON.stringify(ids));}catch{}}
    async function flush(){
        const user=window.getFirebaseUser?.();if(flushing||!user?.emailVerified||typeof callAccountFunction!=='function')return;
        const uid=user.uid;flushing=true;
        try{for(const operationId of read(uid)){if(window.getFirebaseUser?.()?.uid!==uid)break;await callAccountFunction('goomProjectCreated',{application:APP_PRODUCT,operationId},uid);write(uid,read(uid).filter(id=>id!==operationId));}}
        catch{/* Retry the same event ID after reconnecting, without counting it twice. */}
        finally{flushing=false;}
    }
    window.recordGoomProjectCreated=()=>{const user=window.getFirebaseUser?.();if(!user?.emailVerified||window.isGoomReadOnly?.())return;const operationId=crypto.randomUUID();write(user.uid,[...read(user.uid),operationId]);void flush();};
    document.addEventListener('goom-auth-state-changed',()=>void flush());window.addEventListener('online',()=>void flush());setInterval(()=>void flush(),60000);
})();
