const overviewFloorLabels=['6NP','5NP','4NP','3NP','2NP','1NP','1PP','2PP','3PP'];
const overviewAuxiliaryTypes=new Set(['panel','keypad','expander','abax','siren','acs_module','acs_reader','textNode','ramen','deactivated','cableTool']);
let overviewStats=[];
let overviewMainPanelFloor=-1;
const overviewIsCctv = APP_PRODUCT === 'CCTV';
const overviewEmptyAddresses = overviewIsCctv ? 'Bez adres kamer' : 'Bez zón';
const overviewDetectorCount = count => tr(overviewIsCctv ? 'Kamery: {0}' : 'Detektory: {0}', count);
const overviewPanelCount = count => tr(overviewIsCctv ? 'NVR: {0}' : 'Ústředny: {0}', count);
function overviewDetectorWord(count){
    if (overviewIsCctv) return tr(count === 1 ? 'kamera' : count >= 2 && count <= 4 ? 'kamery' : 'kamer');
    return tr(count===1?'detektor':count>=2&&count<=4?'detektory':'detektorů');
}
function getOverviewFloorIndex(label){
    return floors.findIndex(floor=>String(floor.name).replace(/\s/g,'').toUpperCase()===label);
}
function getFloorOverviewStats(floor){
    const active=floor.devices.filter(device=>!['deactivated','textNode','ramen','cableTool'].includes(device.type));
    const detectors=active.filter(device=>overviewIsCctv ? Object.hasOwn(CCTV_CAMERAS, device.type) : !overviewAuxiliaryTypes.has(device.type));
    const buses=new Map();
    for(const device of detectors){
        const address=Number(device.number),bus=Number(device.loopId)||1;
        if(!Number.isInteger(address)||address<1)continue;
        if(!buses.has(bus))buses.set(bus,new Set());buses.get(bus).add(address);
    }
    const ranges=[];
    for(const [bus,addresses] of [...buses].sort((a,b)=>a[0]-b[0])){
        const numbers=[...addresses].sort((a,b)=>a-b);let start=numbers[0],end=start;
        for(let i=1;i<=numbers.length;i++){
            if(i<numbers.length&&numbers[i]===end+1){end=numbers[i];continue;}
            ranges.push({bus,start,end});start=numbers[i];end=start;
        }
    }
    return {name:floor.name,detectors:detectors.length,elements:active.length,zones:[...buses.values()].reduce((count,addresses)=>count+addresses.size,0),
        panels:active.filter(device=>device.type === (overviewIsCctv ? 'cctv_nvr' : 'panel')),addresses:[...buses].flatMap(([bus,addresses])=>[...addresses].map(number=>`${bus}/${number}`)),ranges};
}
function overviewRangeText(ranges){return ranges.map(range=>`${range.bus}/${range.start}`+(range.end===range.start?'':`–${range.bus}/${range.end}`)).join(', ');}
function appendOverviewRanges(container,ranges){
    container.replaceChildren();
    if(!ranges.length){container.textContent=tr(overviewEmptyAddresses);return;}
    for(const range of ranges){
        const item=document.createElement('span');item.className='overview-zone-range';
        const number=document.createElement('strong');number.textContent=String(range.start);
        item.append(`${range.bus}/`,number);
        if(range.start!==range.end){const end=document.createElement('strong');end.textContent=String(range.end);item.append(`–${range.bus}/`,end);}
        if(container.children.length)container.append(', ');container.appendChild(item);
    }
}
function showOverviewFloorDetails(index){
    const stats=overviewStats[index];if(!stats)return;
    const label = String(stats.name).replace(/\s/g, '').toUpperCase();
    const row = Math.max(0, overviewFloorLabels.indexOf(label));
    document.getElementById('overviewFloorDetails').style.setProperty('--overview-detail-row', row);
    document.getElementById('overviewDetailFloor').textContent=stats.name;
    document.getElementById('overviewDetailCounts').textContent=overviewDetectorCount(stats.detectors)+(overviewIsCctv ? '' : ' · '+tr`Zóny: ${stats.zones}`);
    document.getElementById('overviewDetailPanel').hidden=!stats.panels.length;
    document.getElementById('overviewDetailPanel').textContent=overviewIsCctv ? overviewPanelCount(stats.panels.length)
        : index===overviewMainPanelFloor?tr('Hlavní ústředna'):stats.panels.length?overviewPanelCount(stats.panels.length):tr('Bez ústředny');
    appendOverviewRanges(document.getElementById('overviewDetailZones'),stats.ranges);
}
function updateOverviewFloorButtons(){
    const group=document.getElementById('overviewFloors');
    if(!group.children.length){
        for(const label of overviewFloorLabels){
            const button=document.createElement('button');button.type='button';button.className='overview-floor';button.dataset.overviewFloor=label;
            button.innerHTML='<span class="overview-floor-label"></span><span class="overview-floor-body"><span class="overview-floor-metrics"><strong class="overview-floor-count"></strong><span class="overview-detector-label"></span><span class="overview-zone-count"></span></span><span class="overview-floor-zones"></span></span><span class="overview-panel-badge" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><rect x="10" y="10" width="4" height="4"/></svg><span>Ústředna</span></span>';
            button.querySelector('.overview-floor-label').textContent=label;
            const details=()=>showOverviewFloorDetails(getOverviewFloorIndex(label));
            const pointerCanHover = event => event.pointerType === 'pen' || (event.pointerType === 'mouse' && matchMedia('(any-hover: hover)').matches);
            button.addEventListener('pointerenter',event=>{if(pointerCanHover(event))details();});
            button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))details();});
            button.addEventListener('pointerleave',event=>{
                if(!pointerCanHover(event))return;
                const focused=group.querySelector(':focus-visible');
                showOverviewFloorDetails(focused?getOverviewFloorIndex(focused.dataset.overviewFloor):currentFloorIndex);
            });
            button.addEventListener('blur',()=>{
                if(!group.matches(':hover'))showOverviewFloorDetails(currentFloorIndex);
            });
            group.appendChild(button);
        }
    }
    for(const button of group.children){
        const index=getOverviewFloorIndex(button.dataset.overviewFloor),stats=overviewStats[index];
        button.disabled=!stats;button.setAttribute('aria-current',String(index===currentFloorIndex));if(!stats)continue;
        button.querySelector('.overview-floor-count').textContent=String(stats.detectors);
        button.querySelector('.overview-floor-body').hidden=stats.detectors===0;
        button.querySelector('.overview-detector-label').textContent=overviewDetectorWord(stats.detectors);
        button.querySelector('.overview-zone-count').textContent=overviewIsCctv ? '' : tr`Zóny: ${stats.zones}`;
        button.querySelector('.overview-floor-zones').textContent=overviewRangeText(stats.ranges)||tr(overviewEmptyAddresses);
        const badge=button.querySelector('.overview-panel-badge');badge.hidden=!stats.panels.length;
        button.classList.toggle('overview-main-panel',index===overviewMainPanelFloor);
        badge.querySelector('span').textContent=overviewIsCctv ? 'NVR' : stats.panels.length>1?overviewPanelCount(stats.panels.length):tr('Ústředna');
        const details = [button.dataset.overviewFloor, overviewDetectorCount(stats.detectors)];
        if (!overviewIsCctv) details.push(tr`Zóny: ${stats.zones}`);
        details.push(overviewRangeText(stats.ranges)||tr(overviewEmptyAddresses));
        if (stats.panels.length) details.push(overviewPanelCount(stats.panels.length));
        button.setAttribute('aria-label',details.join(' · '));
    }
}
function alignOverviewArtwork(){
    const image=document.getElementById('overviewArtwork'),panel=document.querySelector('.overview-floor-panel');
    if(!image.naturalWidth||!panel.clientWidth||!panel.clientHeight)return;
    const ground=.676,scale=Math.min(panel.clientWidth/image.naturalWidth,panel.clientHeight*(2/3)/ground/image.naturalHeight);
    const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
    const styles={width:width+'px',height:height+'px',left:(panel.clientWidth-width)/2+'px',top:(panel.clientHeight*2/3-height*ground)+'px'};
    for(const [key,value] of Object.entries(styles))if(image.style[key]!==value)image.style[key]=value;
}
function drawBuildingOverview(){
    if(!isOverviewMode)return;
    const canvas=document.getElementById('overviewCanvas'),stage=document.getElementById('overviewStage');
    const {width,height}=stage.getBoundingClientRect();if(!width||!height)return;
    const ratio=Math.min(window.devicePixelRatio||1,3);
    const pixelWidth=Math.round(width*ratio),pixelHeight=Math.round(height*ratio);
    if(canvas.width!==pixelWidth)canvas.width=pixelWidth;if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
    const context=canvas.getContext('2d');context.setTransform(ratio,0,0,ratio,0,0);
    context.fillStyle='#252529';context.fillRect(0,0,width,height);context.fillStyle='#111115';context.beginPath();
    for(let x=14;x<width;x+=28)for(let y=14;y<height;y+=28){context.moveTo(x+1.7,y);context.arc(x,y,1.7,0,Math.PI*2);}context.fill();
    overviewStats=floors.map(getFloorOverviewStats);
    const panels=overviewStats.flatMap((stats,index)=>stats.panels.map(device=>({device,index})));
    const explicitlyMain=panels.filter(panel=>panel.device.isMainPanel===true);
    overviewMainPanelFloor=explicitlyMain.length===1?explicitlyMain[0].index:panels.length===1?panels[0].index:-1;
    updateOverviewFloorButtons();
    document.getElementById('overviewProjectTitle').textContent=projectName;
    const count=overviewStats.reduce((n,stats)=>n+stats.detectors,0),zones=new Set(overviewStats.flatMap(stats=>stats.addresses)).size;
    const panelFloors=overviewStats.filter(stats=>stats.panels.length).map(stats=>stats.name);
    const summary=document.getElementById('overviewProjectStats');summary.replaceChildren();
    const panelSummary=overviewIsCctv ? (panelFloors.length ? overviewPanelCount(panelFloors.join(', ')) : tr('NVR není umístěn'))
        : overviewMainPanelFloor>=0?tr`Hlavní ústředna: ${overviewStats[overviewMainPanelFloor].name}`:panelFloors.length?overviewPanelCount(panelFloors.join(', ')):tr('Ústředna není umístěna');
    summary.setAttribute('aria-label',overviewDetectorCount(count)+(overviewIsCctv ? '' : ' · '+tr`Zóny: ${zones}`)+' · '+panelSummary);
    for(const text of [panelSummary]){
        const badge=document.createElement('span');badge.textContent=text;summary.appendChild(badge);
    }
    showOverviewFloorDetails(currentFloorIndex);alignOverviewArtwork();
}
window.addEventListener('goom-language-changed',()=>{if(isOverviewMode)drawBuildingOverview();});
const overviewArtwork=document.getElementById('overviewArtwork');
function revealOverviewArtwork(){if(overviewArtwork.naturalWidth){overviewArtwork.classList.add('is-ready');if(isOverviewMode)alignOverviewArtwork();}}
overviewArtwork.addEventListener('load',revealOverviewArtwork);if(overviewArtwork.complete)revealOverviewArtwork();

