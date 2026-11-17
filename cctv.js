(() => {
    document.title = 'GooM CCTV';
    document.documentElement.dataset.goomProduct = 'CCTV';
    document.querySelector('.welcome-system-name').textContent = 'Kamerový systém';
    document.querySelector('#detectionSettingsModal .modal-title').textContent = 'Rozpoznání stěn a zorná pole';
    const coverage = document.getElementById('togglePirCoverage');
    coverage.title = 'Skrýt zorná pole';
    coverage.setAttribute('aria-label', coverage.title);
    const settings = document.getElementById('btnDetectionSettings');
    settings.title = 'Rozpoznání stěn a zorná pole';
    settings.setAttribute('aria-label', settings.title);
    document.getElementById('loopSelect').title = 'Vyberte skupinu kamer';
    const search = document.getElementById('btnDetectorSearch');
    search.title = 'Najít kameru';
    search.setAttribute('aria-label', search.title);
    document.getElementById('detectorSearchTitle').textContent = 'Najít kameru';
    document.querySelector('[for="detectorSearchBus"]').firstChild.nodeValue = 'Skupina';
    document.querySelector('[for="detectorSearchNumber"]').firstChild.nodeValue = 'Číslo kamery';
    document.getElementById('overviewZonesLabel').textContent = 'Adresy kamer';

    const tools = document.getElementById('deviceSetTools');
    const textTools = document.getElementById('textTools');
    const divider = textTools.previousElementSibling;
    for (const child of [...tools.children]) {
        if (child === divider) break;
        child.remove();
    }
    for (const [type, label] of Object.entries(CCTV_DEVICE_LABELS)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'device-btn';
        button.dataset.type = type;
        button.title = label;
        button.setAttribute('aria-label', label);
        tools.insertBefore(button, divider);
    }
    window.localizeGoom();
})();

function drawCctvDevice(ctx, type, sMult) {
    ctx.save();
    ctx.scale(sMult, sMult);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS[type];
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (type === 'cctv_bullet') {
        ctx.roundRect(-17, -8, 24, 16, 3);
        ctx.moveTo(7, -4); ctx.lineTo(15, -9); ctx.lineTo(15, 9); ctx.lineTo(7, 4); ctx.closePath();
    } else if (Object.hasOwn(CCTV_CAMERAS, type)) {
        ctx.arc(-2, 0, 11, 0, Math.PI * 2);
        ctx.moveTo(9, -5); ctx.lineTo(16, 0); ctx.lineTo(9, 5);
    } else {
        ctx.roundRect(-19, -9, 38, 18, 3);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS[type];
    if (type === 'cctv_nvr' || type === 'cctv_poe') {
        ctx.font = 'bold 10px monospace';
        ctx.fillText(type === 'cctv_nvr' ? 'NVR' : 'PoE', 0, 0);
    } else if (type !== 'cctv_bullet') {
        ctx.beginPath();
        ctx.arc(-2, 0, type === 'cctv_ptz' ? 5.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (type === 'cctv_ptz') {
            ctx.beginPath();
            ctx.arc(-2, 0, 15, Math.PI * .55, Math.PI * 1.45);
            ctx.stroke();
        }
    }
    ctx.restore();
}
