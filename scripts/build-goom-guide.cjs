const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const topics = require('./goom-guide-content.cjs');
const root = path.resolve(__dirname, '..');
const guide = path.join(root, 'goom-site', 'guide');
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

// Small, schematic examples. Vector lines stay readable when zoomed on a phone.
const illustrations = {
    editors: '<path d="M14 17h22v17H14zM42 17h22v17H42zM70 17h22v17H70zM98 17h22v17H98z"/><path d="M25 23v5m25-3h6m22-3 6 6m22 0 6-6"/>',
    account: '<circle cx="66" cy="17" r="7"/><path d="M50 40c0-16 32-16 32 0"/>',
    project: '<path d="M45 9h27l13 13v22H45zM72 9v13h13M58 29h14m-7-7v14"/>',
    welcome: '<circle cx="66" cy="26" r="17"/><path d="M61 21a5 5 0 1 1 8 4l-3 4m0 5h.1"/>',
    device: '<rect x="27" y="10" width="52" height="29" rx="3"/><rect x="89" y="15" width="18" height="29" rx="3"/><path d="M48 47h10m40-9h.1"/>',
    tech: '<path d="M36 12h17l6 7h31v23H36z"/><text x="65" y="34">TECH</text>',
    dwg: '<path d="M13 41V10h33v29h24V15h20v26h30M17 30h29m45 2h20"/><circle cx="70" cy="39" r="3"/>',
    pdf: '<rect x="32" y="9" width="68" height="34" rx="4"/><circle cx="47" cy="19" r="4"/><path d="m35 40 22-17 14 10 11-8 16 15"/>',
    drop: '<path d="M40 15H27v27h78V15H92m-26-5v24m-8-8 8 8 8-8"/>',
    map: '<path d="m31 15 23-7 23 7 24-7v31l-24 7-23-7-23 7zM54 8v31m23-24v31"/>',
    photo: '<rect x="37" y="14" width="58" height="28" rx="4"/><path d="M53 14l4-6h18l4 6"/><circle cx="66" cy="27" r="9"/>',
    zoom: '<circle cx="60" cy="23" r="12"/><path d="m69 32 14 13M54 23h12m-6-6v12"/>',
    floors: '<path d="M40 42V15L66 6l26 9v27zM40 24h52M40 33h52"/>',
    theme: '<rect x="29" y="12" width="74" height="31" rx="4"/><path fill="currentColor" d="M66 12h34l3 3v25l-3 3H66z"/>',
    walls: '<path d="M33 43V10h64v33M45 43V21h40v22m-21-10h21"/>',
    grid: '<path d="M38 9v34m14-34v34m14-34v34m14-34v34m14-34v34M33 12h66M33 26h66M33 40h66"/><circle cx="66" cy="26" r="5" fill="#b7ec72"/>',
    size: '<path d="M24 26h84"/><circle cx="73" cy="26" r="7" fill="#b7ec72"/>',
    legend: '<rect x="29" y="8" width="74" height="36" rx="3"/><circle cx="42" cy="18" r="3"/><path d="M53 18h35M39 30h6v6h-6zM53 33h35"/>',
    history: '<path d="M41 24h33c16 0 15 17 2 17H55M41 24l9-9m-9 9 9 9"/>',
    palette: '<path d="M19 12h94v30H19zM33 22h11v10H33zm26 5 11-6v12zm26-5h13v10H85z"/>',
    cad: '<path d="M24 17h27l10 10-10 10H24zM79 16h26v22H79z"/><text x="40" y="30">PIR</text><text x="92" y="30">I/O</text>',
    pzts: '<path d="M28 14h32l12 13-12 13H28zM85 19h14v16H85zm19 0h6v16h-6z"/><text x="47" y="30">PIR</text>',
    eps: '<circle cx="47" cy="26" r="15"/><circle cx="84" cy="26" r="15"/><text x="47" y="29">S</text><text x="84" y="29">T</text>',
    cctv: '<rect x="35" y="15" width="39" height="23" rx="3"/><path d="m74 22 23-12v33L74 31"/><circle cx="54" cy="26" r="6"/>',
    sk: '<path d="M44 12h44v18H77v10H55V30H44zM52 17v7m7-7v7m7-7v7m7-7v7m7-7v7"/>',
    address: '<circle cx="39" cy="26" r="11"/><path d="M51 26h15v12h35"/><text x="39" y="29">1/3</text>',
    search: '<circle cx="58" cy="22" r="12"/><path d="m67 31 13 13"/><text x="58" y="25">1/3</text>',
    coverage: '<path fill="#b7ec7238" d="m29 28 64-20a64 64 0 0 1 0 39z"/><circle cx="29" cy="28" r="5"/>',
    icon: '<rect x="29" y="12" width="30" height="30" rx="3"/><circle cx="44" cy="27" r="8"/><path d="M71 18h30M71 27h30M71 36h30"/>',
    wire: '<path d="M25 20h43v15h39"/><circle cx="25" cy="20" r="5"/><circle cx="107" cy="35" r="5"/>',
    cross: '<path d="M26 26h30c0-14 20-14 20 0h30M66 7v8m0 17v13"/>',
    trunk: '<path stroke="#38bdf8" stroke-width="4" d="M18 36h45V16h50"/><path d="M85 16v24h16"/><circle cx="63" cy="16" r="3"/><circle cx="85" cy="16" r="3"/>',
    passage: '<circle cx="66" cy="26" r="17"/><path d="m58 34 16-16m-10 0h10v10"/>',
    notes: '<path d="M29 9h74v29H64l-11 8v-8H29z"/><text x="65" y="28">Abc</text>',
    mixed: '<path d="M43 9h35l13 13v20H43zM78 9v13h13"/><text x="66" y="33">TECH</text>',
    save: '<path d="M46 9h34l7 7v28H46zM53 9v13h24V9m-24 35V30h26v14"/>',
    cloud: '<path d="M39 36c-13 0-15-19 0-20 7-16 27-13 31-2 17-9 34 8 23 22z"/>',
    export: '<path d="M42 10H31v32h41v-9m-17-8h43m-9-8 9 8-9 8"/>',
    print: '<path d="M47 19V8h38v11M47 37H33V19h66v18H85M47 29h38v16H47z"/>',
    check: '<rect x="34" y="10" width="64" height="34" rx="4"/><path d="m44 20 4 4 8-9m-12 21 4 4 8-9m8-11h22M64 35h22"/>',
    plans: '<path d="M23 14h24v26H23zM54 14h24v26H54zM85 14h24v26H85z"/><text x="35" y="30">Free</text><text x="66" y="30">Pro</text><text x="97" y="30">Team</text>',
    team: '<circle cx="49" cy="16" r="6"/><circle cx="79" cy="16" r="6"/><path d="M36 40v-5c0-12 26-12 26 0v5m4 0v-5c0-12 26-12 26 0v5"/>',
    feedback: '<rect x="35" y="11" width="62" height="31" rx="4"/><path d="m37 14 29 16 29-16"/>',
    reviews: '<path d="M32 10h68v30H66l-12 8v-8H32zM45 20h41M45 30h25"/>',
    admin: '<path d="M66 7l22 7v15c0 7-15 15-22 18-7-3-22-11-22-18V14zM55 27l7 7 13-15"/>'
};

const programs = [
    ['pzts', 'PZTS', 'Zabezpečení', 'Охранные системы'], ['eps', 'EPS', 'Požární signalizace', 'Пожарная сигнализация'],
    ['cctv', 'CCTV', 'Kamerové systémy', 'Видеонаблюдение'], ['sk', 'SK', 'Datové sítě', 'Кабельные сети']
];

function catalog(app, name) {
    const dir = app === 'cctv' ? '.qa-cctv-feature-20261118' : app === 'pzts' ? '' : name;
    if (app === 'cctv') return [
        ['C', 'Válcová kamera', 'Цилиндрическая камера'], ['D', 'Kopulová kamera', 'Купольная камера'],
        ['PTZ', 'PTZ kamera', 'Поворотная PTZ-камера'], ['NVR', 'Síťový videorekordér', 'Сетевой видеорегистратор'],
        ['PoE', 'PoE přepínač', 'Коммутатор PoE'], ['ACS', 'Videozvonek', 'Видеозвонок'],
        ['ACS', 'Čtečka přístupových karet', 'Считыватель карт'], ['ANT', 'Anténa', 'Антенна'],
        ['RX', 'Přijímač signálu', 'Приёмник сигнала']
    ];
    if (app === 'eps' || app === 'sk') {
        const source = fs.readFileSync(path.join(root, dir, app + '-catalog.js'), 'utf8');
        const list = vm.runInNewContext(source.match(new RegExp(`const ${name}_CATALOG\\s*=\\s*(\\[[\\s\\S]+?\\n\\]);`))[1]);
        return list.map(row => [row.code, row.labels[0], row.labels[3] || row.labels[0]]);
    }
    const source = fs.readFileSync(path.join(root, dir, 'index.html'), 'utf8');
    const strip = source.split('id="deviceSetTools"')[1]?.split('id="textTools"')[0] || '';
    const russian = {panel:'Охранная централь', expander:'Расширитель зон и выходов', abax:'Беспроводной модуль ABAX2',
        keypad:'Клавиатура', pir:'Датчик движения PIR', pir_wl:'Беспроводной датчик движения PIR',
        magnet:'Магнитный контакт', magnet_wl:'Беспроводной магнитный контакт', glassbreak:'Датчик разбития стекла',
        panic:'Тревожная кнопка', siren:'Сирена', acs_module:'Модуль контроля доступа', acs_reader:'Считыватель', smoke:'Дымовой извещатель'};
    return [...strip.matchAll(/data-type="([\w]+)"[^>]*title="([^"]+)"/g)]
        .map(([, type, title]) => [type.replaceAll('_', ' ').toUpperCase(), title, russian[type] || title]);
}

for (const lang of ['cs', 'ru']) {
    const ru = lang === 'ru', url = ru ? '/guide/ru/' : '/guide/';
    const t = (cs, russian) => ru ? russian : cs;
    const title = t('Příručka GooM', 'Справочник GooM');
    const description = t('Ilustrovaná příručka pro editory PZTS, EPS, CCTV a SK. Import DWG, DXF a PDF, značky CAD, kabely, podlaží a export.', 'Иллюстрированное руководство по PZTS, EPS, CCTV и SK. Импорт DWG, DXF и PDF, обозначения CAD, кабели, этажи и экспорт.');
    const sections = topics.map(([id, cs, russian, entries]) => `<section id="${id}"><h2>${t(cs,russian)}</h2><div class="topics">${entries.map(([key, csTitle, ruTitle, csText, ruText]) => `<article id="${key}"><svg viewBox="0 0 132 52" aria-hidden="true">${illustrations[key]}</svg><div><h3>${t(csTitle,ruTitle)}</h3><p>${t(csText,ruText)}</p></div></article>`).join('\n')}</div></section>`).join('\n');
    const catalogs = programs.map(([app, name, cs, russian]) => `<details><summary>${name} · ${t(cs,russian)}</summary><ul>${catalog(app,name).map(([code, czech, rus]) => `<li><b>${escape(code)}</b> ${escape(t(czech,rus))}</li>`).join('')}</ul></details>`).join('\n');
    const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | PZTS, EPS, CCTV, SK</title><meta name="description" content="${escape(description)}">
<meta property="og:title" content="${ title }"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="https://goom.cz${url}">
<link rel="canonical" href="https://goom.cz${url}"><link rel="alternate" hreflang="cs" href="https://goom.cz/guide/"><link rel="alternate" hreflang="ru" href="https://goom.cz/guide/ru/">
<meta name="theme-color" content="#171a1c"><link rel="icon" href="/Logosite.png"><link rel="stylesheet" href="/guide/guide.css?v=20261125-guide-13"><script src="/guide/search.js?v=20261125-guide-13" defer></script>
</head><body><header><a class="brand" href="/">GooM<span>.</span></a><nav aria-label="${t('Aplikace','Редакторы')}">${programs.map(([app,name])=>`<a href="/${app}/">${name}</a>`).join('')}<a href="/${ru?'?lang=ru':''}#pricing">${t('Tarify','Тарифы')}</a><a lang="${t('ru','cs')}" href="${t('/guide/ru/','/guide/')}">${t('RU','CZ')}</a></nav></header>
<main><div class="intro"><h1>${title}</h1><p>${description}</p><label>${t('Hledat v příručce','Поиск по справочнику')}<input id="guideSearch" type="search" placeholder="DWG, CAD, PDF…"></label><p id="guideEmpty" hidden role="status">${t('Nebylo nic nalezeno.','Ничего не найдено.')}</p></div>
<nav class="contents" aria-label="${t('Obsah','Оглавление')}">${topics.map(([id, cs, russian])=>`<a href="#${id}">${t(cs,russian)}</a>`).join('')}<a href="#catalog">${t('Katalog zařízení','Каталог устройств')}</a></nav>
${sections}<section id="catalog"><h2>${t('Katalog zařízení','Каталог устройств')}</h2>${catalogs}</section></main>
<footer><a href="/">GooM</a><a href="mailto:support@goom.cz">support@goom.cz</a></footer></body></html>\n`;
    const out = ru ? path.join(guide, 'ru') : guide;
    fs.mkdirSync(out, {recursive:true});
    fs.writeFileSync(path.join(out, 'index.html'), html);
}
