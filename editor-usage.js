// Approximate active time, shared across tabs by a server-checked per-account counter.
(() => {
    let uid = null, generation = 0, initialized = false, writing = false, pending = 0;
    let lastTick = performance.now(), lastInput = lastTick, lastFlush = lastTick;
    const products = ['PZTS', 'EPS', 'CCTV', 'SK'];
    function tick() {
        const now = performance.now(), elapsed = Math.max(0, Math.min(10, (Math.min(now, lastInput + 120000) - lastTick) / 1000));
        if (initialized && document.visibilityState === 'visible')
            pending = Math.min(300, pending + elapsed);
        lastTick = now;
    }
    async function flush() {
        tick();
        if (!uid || writing || initialized && pending < 1) return;
        const user = window.getFirebaseUser?.(), account = uid, revision = generation;
        if (user?.uid !== account || !user.emailVerified) return;
        writing = true;
        const seconds = initialized ? Math.min(60, Math.floor(pending)) : 0;
        let credited = seconds;
        try {
            const db = await window.getFirebaseDatabase();
            if (revision !== generation) return;
            const ref = db.collection('goomEditorUsage').doc(account);
            await db.runTransaction(async transaction => {
                const snapshot = await transaction.get(ref), previous = snapshot.data();
                const updatedAt = previous?.updatedAt?.toMillis?.();
                credited = Number.isFinite(updatedAt) ? Math.min(seconds, Math.max(0, Math.floor((Date.now() - updatedAt) / 1000) - 1)) : seconds;
                const applications = Object.fromEntries(products.map(app => [app, Number(previous?.applications?.[app]) || 0]));
                applications[APP_PRODUCT] += credited;
                transaction.set(ref, { application: APP_PRODUCT, applications,
                    activeSeconds: products.reduce((total, app) => total + applications[app], 0),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            });
            if (revision === generation) { initialized = true; pending = Math.max(0, pending - credited); }
        } catch {
            // Offline clients retry later. A competing tab cannot increase time faster than real time.
        } finally { if (revision === generation) writing = false; }
    }
    function interact() { tick(); lastInput = performance.now(); }
    for (const event of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'])
        document.addEventListener(event, interact, { passive: true });
    document.addEventListener('visibilitychange', () => { tick(); if (document.hidden) void flush(); else lastInput = performance.now(); });
    document.addEventListener('goom-account-changed', event => {
        const user = event.detail?.user, nextUid = user?.emailVerified && event.detail?.profile ? user.uid : null;
        if (nextUid === uid) return;
        generation++; uid = nextUid; initialized = writing = false; pending = 0;
        lastTick = lastInput = lastFlush = performance.now();
        if (uid) void flush();
    });
    setInterval(() => { tick(); if (performance.now() - lastFlush >= 60000) { lastFlush = performance.now(); void flush(); } }, 10000);
})();
