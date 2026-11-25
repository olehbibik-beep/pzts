// Alternate drawing symbols keep the device type used for addressing and coverage.
const cadCatalog = {
    PZTS: { panel: ['EZS', 'box'], pir: ['PIR', 'direction'], magnet: ['MK', 'contact'],
        glassbreak: ['GB', 'circle'], siren: ['SIR', 'horn'], acs_reader: ['ACS', 'box'] },
    EPS: { panel: ['EPS', 'box'], eps_smoke: ['S', 'circle'], eps_heat: ['T', 'circle'],
        eps_manual: ['M', 'box'], eps_sounder: ['SIR', 'horn'], eps_io: ['I/O', 'box'] },
    CCTV: { cctv_bullet: ['C', 'camera'], cctv_dome: ['D', 'circle'], cctv_ptz: ['PTZ', 'direction'],
        cctv_nvr: ['NVR', 'box'], cctv_poe: ['PoE', 'box'] },
    SK: { panel: ['RACK', 'box'], sk_switch: ['SW', 'box'], sk_patch_panel: ['PP', 'box'],
        sk_access_point: ['AP', 'circle'], sk_outlet: ['RJ45', 'outlet'], sk_fiber_outlet: ['FO', 'outlet'] }
};

let selectedCadType = null;

function drawCadSymbol(ctx, type, scale, theme) {
    const symbol = cadCatalog[APP_PRODUCT]?.[type];
    if (!symbol) return false;
    const [label, shape] = symbol;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.strokeStyle = ctx.fillStyle = theme === 'dark' ? '#f1f5f9' : '#171e25';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    const polygon = points => {
        ctx.moveTo(...points[0]);
        for (const point of points.slice(1)) ctx.lineTo(...point);
        ctx.closePath();
    };
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(0, 0, 13, 0, 2 * Math.PI);
    else if (shape === 'direction') polygon([[-16, -11], [8, -11], [17, 0], [8, 11], [-16, 11]]);
    else if (shape === 'horn') polygon([[-15, -9], [4, -9], [16, -14], [16, 14], [4, 9], [-15, 9]]);
    else if (shape === 'contact') { ctx.rect(-16, -8, 21, 16); ctx.rect(9, -8, 6, 16); }
    else if (shape === 'camera') { ctx.rect(-16, -9, 22, 18); polygon([[6, -4], [16, -10], [16, 10], [6, 4]]); }
    else if (shape === 'outlet') polygon([[-16,-10], [16,-10], [16,4], [7,4], [7,11], [-7,11], [-7,4], [-16,4]]);
    else ctx.rect(-16, -10, 32, 20);
    ctx.stroke();
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, ['contact', 'camera'].includes(shape) ? -5 : 0, shape === 'outlet' ? -2 : 0);
    ctx.restore();
    return true;
}

(() => {
    const trigger = document.getElementById('btnCadSymbols');
    const dialog = document.getElementById('cadSymbolsDialog');
    const options = document.getElementById('cadSymbolOptions');
    const regularSelector = document.getElementById('deviceSelector');
    if (!trigger || !dialog || !options || !regularSelector) return;

    function refresh() {
        trigger.setAttribute('aria-pressed', String(Boolean(selectedCadType && selectedTool === selectedCadType)));
    }
    function localize() {
        document.getElementById('cadSymbolsTitle').textContent = window.goomUI('Značky CAD', 'CAD symbols', 'CAD-Symbole', 'Обозначения CAD', 'Symbole CAD');
        trigger.title = document.getElementById('cadSymbolsTitle').textContent;
        trigger.setAttribute('aria-label', trigger.title);
        for (const option of options.children) {
            const native = document.querySelector(`#deviceSetTools [data-type="${option.dataset.cadType}"]`);
            option.lastElementChild.textContent = native?.getAttribute('aria-label') || native?.title || deviceBriefName({type: option.dataset.cadType});
        }
    }

    for (const type of Object.keys(cadCatalog[APP_PRODUCT] || {})) {
        const option = document.createElement('button');
        option.type = 'button';
        option.dataset.cadType = type;
        const sample = document.createElement('canvas');
        sample.width = 74; sample.height = 48;
        const context = sample.getContext('2d');
        context.translate(37, 24);
        drawCadSymbol(context, type, 1.55, 'original');
        option.append(sample, document.createElement('span'));
        option.onclick = () => {
            if (window.isGoomReadOnly?.() || !isSystemReady) return;
            stopDeviceRotation();
            activeDeviceIds.clear();
            document.querySelectorAll('.device-btn.active').forEach(button => button.classList.remove('active'));
            selectedCadType = selectedTool = type;
            window.tabletPanMode = false;
            dialog.close();
            refresh();
            requestRedraw();
        };
        options.append(option);
    }
    trigger.onclick = () => { if (!dialog.open) dialog.showModal(); };
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    regularSelector.addEventListener('click', () => queueMicrotask(refresh));
    window.addEventListener('keydown', () => queueMicrotask(refresh));
    window.addEventListener('goom-language-changed', localize);
    localize();
})();
