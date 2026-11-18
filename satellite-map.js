(() => {
    if (window.isGoomReadOnly?.()) return;
    const layers = {
        satellite: {url:'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer',provider:'Esri World Imagery Clarity',title:'Satelitní mapa',credit:'Source: Esri, Vantor, Earthstar Geographics, IGN, and the GIS User Community'},
        topo: {url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',provider:'Esri World Topographic Map',title:'Topografická mapa',credit:'Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), (c) OpenStreetMap contributors, and the GIS User Community'}
    };
    const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
    const modal=document.createElement('div');modal.id='satelliteMapModal';modal.className='modal';
    modal.innerHTML=`<section class="modal-content satellite-map-card" role="dialog" aria-modal="true" aria-labelledby="satelliteMapTitle">
        <div class="satellite-map-heading"><h2 id="satelliteMapTitle">${tr('Mapa')}</h2><button id="satelliteMapClose" type="button" class="btn-cad" aria-label="${tr('Zavřít')}">×</button></div>
        <form id="satelliteSearchForm" class="satellite-map-search"><button id="satelliteLocate" class="btn-cad map-icon-button" type="button" aria-label="${tr('Moje poloha')}" title="${tr('Moje poloha')}">${icon('<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>')}</button><input id="satelliteSearchInput" aria-label="${tr('Adresa nebo souřadnice')}" placeholder="${tr('Adresa nebo souřadnice')}" maxlength="180" required><button id="satelliteSearchSubmit" class="btn-cad map-icon-button" type="submit" aria-label="${tr('Hledat')}" title="${tr('Hledat')}">${icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>')}</button></form>
        <ul id="satelliteSearchResults" hidden></ul>
        <div class="satellite-map-viewport"><canvas id="satelliteCanvas" width="1280" height="768" aria-label="${tr('Vyberte oblast mapy')}" tabindex="0"></canvas>
        <div class="satellite-map-layers" role="group" aria-label="${tr('Typ mapy')}"><button class="btn-cad" type="button" data-map-layer="satellite">${tr('Satelitní mapa')}</button><button class="btn-cad" type="button" data-map-layer="topo">${tr('Topografická mapa')}</button></div>
        <div class="satellite-map-zoom"><button type="button" class="btn-cad" id="satelliteZoomIn" aria-label="${tr('Přiblížit')}">+</button><button type="button" class="btn-cad" id="satelliteZoomOut" aria-label="${tr('Oddálit')}">−</button></div>
        <button type="button" class="btn-cad map-icon-button" id="satelliteMapAdd" aria-label="${tr('Přidat mapu do plánu')}" title="${tr('Přidat mapu do plánu')}">${icon('<path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/>')}</button>
        <p id="satelliteMapStatus" role="status" hidden></p>
        <details class="satellite-map-attribution"><summary aria-label="${tr('Informace o mapě')}" title="${tr('Informace o mapě')}">i</summary><div><a id="satelliteProviderCredit" target="_blank" rel="noopener"></a><span> · ${tr('Vyhledávání')}: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> / Photon</span></div></details></div></section>`;
    document.body.append(modal);
    const preview=document.getElementById('satelliteCanvas'),context=preview.getContext('2d');
    const status=document.getElementById('satelliteMapStatus'),add=document.getElementById('satelliteMapAdd'),menuButton=document.getElementById('btnMenuSatellite');
    const list=document.getElementById('satelliteSearchResults'),input=document.getElementById('satelliteSearchInput');
    const tiles=new Map(),searchCache=new Map();
    let zoom=17,layer='satellite',center={x:0,y:0},drag=null,raf=0,targetFloor=null,targetUid=null,searchPending=false,lastSearch=0,searchController=null,saving=false,openSequence=0;
    function message(text=''){status.textContent=text;status.hidden=!text;}
    function project(lat,lon,z=zoom){const size=256*2**z,s=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return {x:(lon+180)/360*size,y:(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*size};}
    function unproject(point,z=zoom){const size=256*2**z;return [Math.atan(Math.sinh(Math.PI*(1-2*point.y/size)))*180/Math.PI,((point.x/size*360)%360+360)%360-180];}
    function setCenter(lat,lon,z=17){zoom=Math.max(2,Math.min(24,z));center=project(lat,lon);draw();}
    function schedule(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(modal.style.display==='flex')draw();});}
    function tile(x,y,z){const count=2**z;if(y<0||y>=count)return null;x=((x%count)+count)%count;const key=`${layer}/${z}/${y}/${x}`;
        if(!tiles.has(key)){
            const item={image:new Image(),loaded:false,error:false};tiles.set(key,item);item.image.crossOrigin='anonymous';
            item.image.onload=()=>{item.loaded=true;schedule();};item.image.onerror=()=>{item.error=true;schedule();};
            // Missing imagery must return 404, never the provider's gray placeholder image.
            item.image.src=`${layers[layer].url}/tile/${z}/${y}/${x}?blankTile=false`;
            if(tiles.size>400)tiles.delete(tiles.keys().next().value);
        }
        const item=tiles.get(key);
        if(item.loaded)return {image:item.image,x:0,y:0,size:256};
        if(!item.error)return {pending:true};
        if(z<=2)return {error:true};
        const parent=tile(Math.floor(x/2),Math.floor(y/2),z-1);
        if(!parent||!parent.image)return parent;
        return {image:parent.image,x:parent.x+(x%2)*parent.size/2,y:parent.y+(y%2)*parent.size/2,size:parent.size/2};
    }
    function draw(){
        const size=256*2**zoom;center.x=((center.x%size)+size)%size;center.y=Math.max(0,Math.min(size,center.y));
        context.fillStyle='#20252c';context.fillRect(0,0,preview.width,preview.height);
        const nativeZoom=Math.min(19,zoom),factor=2**(zoom-nativeZoom),span=256*factor;
        const left=center.x-preview.width/2,top=center.y-preview.height/2;
        let loading=false,failed=false,count=0;
        for(let y=Math.floor(top/span);y<Math.ceil((top+preview.height)/span);y++)for(let x=Math.floor(left/span);x<Math.ceil((left+preview.width)/span);x++){
            const item=tile(x,y,nativeZoom);if(!item)continue;count++;loading ||= !!item.pending;failed ||= !!item.error;
            if(item.image)context.drawImage(item.image,item.x,item.y,item.size,item.size,x*span-left,y*span-top,span,span);
        }
        add.disabled=saving||loading||failed||!count;
        preview.dataset.zoom=String(zoom);preview.dataset.layer=layer;
        message(failed?tr('Mapu nelze načíst. Zkuste jinou oblast nebo mapu otevřete znovu.'):loading?tr('Načítání mapy…'):'');
        document.getElementById('satelliteZoomIn').disabled=zoom>=24;document.getElementById('satelliteZoomOut').disabled=zoom<=2;
    }
    function changeZoom(delta,anchor={x:preview.width/2,y:preview.height/2}){
        const next=Math.max(2,Math.min(24,zoom+delta));if(next===zoom)return;
        const point={x:center.x+anchor.x-preview.width/2,y:center.y+anchor.y-preview.height/2},factor=2**(next-zoom);
        center={x:point.x*factor-anchor.x+preview.width/2,y:point.y*factor-anchor.y+preview.height/2};zoom=next;draw();
    }
    function selectLayer(value){layer=layers[value]?value:'satellite';
        modal.querySelectorAll('[data-map-layer]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mapLayer===layer)));
        const credit=document.getElementById('satelliteProviderCredit');credit.textContent=layers[layer].credit;
        credit.href=layers[layer].url;draw();
    }
    modal.querySelectorAll('[data-map-layer]').forEach(button=>button.onclick=()=>selectLayer(button.dataset.mapLayer));
    function point(event){const rect=preview.getBoundingClientRect();return {x:(event.clientX-rect.left)*preview.width/rect.width,y:(event.clientY-rect.top)*preview.height/rect.height};}
    preview.addEventListener('pointerdown',event=>{if(!event.isPrimary)return;event.preventDefault();const p=point(event);drag={id:event.pointerId,...p,center:{...center}};preview.setPointerCapture(event.pointerId);});
    preview.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;const p=point(event);center={x:drag.center.x+drag.x-p.x,y:drag.center.y+drag.y-p.y};draw();});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])preview.addEventListener(name,()=>{drag=null;});
    preview.addEventListener('wheel',event=>{event.preventDefault();changeZoom(event.deltaY<0?1:-1,point(event));},{passive:false});
    preview.addEventListener('keydown',event=>{const moves={ArrowLeft:[-128,0],ArrowRight:[128,0],ArrowUp:[0,-128],ArrowDown:[0,128]};
        if(moves[event.key]){event.preventDefault();center.x+=moves[event.key][0];center.y+=moves[event.key][1];draw();}
        else if(['+','=','-'].includes(event.key)){event.preventDefault();changeZoom(event.key==='-'?-1:1);}
    });
    document.getElementById('satelliteZoomOut').onclick=()=>changeZoom(-1);document.getElementById('satelliteZoomIn').onclick=()=>changeZoom(1);
    function close(){modal.style.display='none';drag=null;openSequence++;searchController?.abort();}
    document.getElementById('satelliteMapClose').onclick=close;modal.addEventListener('click',event=>{if(event.target===modal)close();});
    function syncAccess(){const locked=!window.hasProAccess?.();menuButton.classList.toggle('pro-lock',locked);menuButton.setAttribute('data-project-locked',String(locked));if(locked||targetUid&&targetUid!==window.getFirebaseUser?.()?.uid)close();}
    document.addEventListener('goom-account-changed',syncAccess);syncAccess();
    menuButton.addEventListener('click',()=>{
        if(!window.hasProAccess?.()){window.requestProUpgrade?.();return;}
        if(!isSystemReady||!floors[currentFloorIndex])return;
        targetFloor=floors[currentFloorIndex];targetUid=window.getFirebaseUser?.()?.uid;openSequence++;
        mainMenuModal.style.display='none';modal.style.display='flex';list.hidden=true;input.value='';
        for(const [key,value] of tiles)if(value.error)tiles.delete(key);
        const saved=targetFloor.satellite;zoom=saved?.zoom||17;center=project(...(saved?.center||[50.087,14.421]));selectLayer(saved?.layer||'satellite');
    });
    document.getElementById('satelliteLocate').onclick=()=>{
        const sequence=openSequence,button=document.getElementById('satelliteLocate');
        if(!navigator.geolocation){message(tr('Polohu nelze zjistit. Zadejte adresu nebo souřadnice.'));return;}
        button.disabled=true;message(tr('Zjišťování polohy…'));
        navigator.geolocation.getCurrentPosition(position=>{button.disabled=false;if(sequence!==openSequence||modal.style.display!=='flex')return;list.hidden=true;setCenter(position.coords.latitude,position.coords.longitude,19);},()=>{button.disabled=false;if(sequence===openSequence)message(tr('Polohu nelze zjistit. Povolte přístup k poloze nebo zadejte adresu.'));},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
    };
    document.getElementById('satelliteSearchForm').addEventListener('submit',async event=>{
        event.preventDefault();const query=input.value.trim();if(!query||searchPending)return;list.hidden=true;
        const coordinates=query.match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
        if(coordinates){const lat=Number(coordinates[1]),lon=Number(coordinates[2]);if(Math.abs(lat)<=85&&Math.abs(lon)<=180){setCenter(lat,lon,19);return;}}
        if(Date.now()-lastSearch<2000){message(tr('Za chvíli zkuste hledat znovu.'));return;}
        lastSearch=Date.now();searchPending=true;const sequence=openSequence;
        const button=document.getElementById('satelliteSearchSubmit');button.disabled=true;list.replaceChildren();message(tr('Vyhledávání…'));
        searchController=new AbortController();const timeout=setTimeout(()=>searchController.abort(),12000);
        try{
            let data=searchCache.get(query);
            if(!data){const endpoint=new URL(window.GOOM_MAP_SEARCH_URL||'https://photon.komoot.io/api/');endpoint.searchParams.set('q',query);endpoint.searchParams.set('limit','5');
                const response=await fetch(endpoint,{signal:searchController.signal});if(!response.ok)throw Error('Search unavailable');data=await response.json();searchCache.set(query,data);if(searchCache.size>40)searchCache.delete(searchCache.keys().next().value);}
            if(sequence!==openSequence||modal.style.display!=='flex')return;
            for(const feature of Array.isArray(data.features)?data.features.slice(0,5):[]){const c=feature.geometry?.coordinates;if(!Array.isArray(c)||!c.slice(0,2).every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>85)continue;
                const item=document.createElement('li'),result=document.createElement('button');result.type='button';result.dataset.userContent='';
                result.textContent=[...new Set([feature.properties?.name,[feature.properties?.street,feature.properties?.housenumber].filter(Boolean).join(' '),feature.properties?.city,feature.properties?.country].filter(Boolean))].join(', ');
                result.onclick=()=>{input.value=result.textContent;setCenter(c[1],c[0],18);list.hidden=true;};item.append(result);list.append(item);}
            list.hidden=!list.children.length;message(list.hidden?tr('Místo nebylo nalezeno. Zadejte souřadnice nebo posuňte mapu.'):'');
        }catch{if(sequence===openSequence)message(tr('Vyhledávání není dostupné. Zadejte souřadnice nebo posuňte mapu.'));}
        finally{clearTimeout(timeout);searchPending=false;button.disabled=false;}
    });
    add.addEventListener('click',async()=>{
        const floor=targetFloor,sequence=openSequence;
        if(add.disabled||saving||!window.hasProAccess?.()||!floor||floors[currentFloorIndex]!==floor||window.getFirebaseUser?.()?.uid!==targetUid)return;
        saving=true;add.disabled=true;
        try{
            const selected={provider:layers[layer].provider,layer,center:unproject(center),zoom,attribution:layers[layer].credit,footerHeight:0};
            const snapshot=document.createElement('canvas');snapshot.width=preview.width;snapshot.height=preview.height;
            const target=snapshot.getContext('2d');target.drawImage(preview,0,0);
            const imgData=snapshot.toDataURL('image/png'),image=await loadPlanImage(imgData);
            if(sequence!==openSequence||modal.style.display!=='flex'||!window.hasProAccess?.()||floors[currentFloorIndex]!==floor||window.getFirebaseUser?.()?.uid!==targetUid)return;
            planPdfCache.get(floor)?.loadingTask?.destroy();planPdfCache.delete(floor);planOriginalCache.delete(floor);planTileCache.delete(floor);
            Object.assign(floor,{image,imgData,pdfSource:null,rasterSource:null,vectorPlan:null,pdfPage:1,wallMask:null,planTheme:'original',sourceName:tr(layers[selected.layer].title),satellite:selected});
            window.resetActiveCloudProject?.();close();changeFloor();saveStateToHistory();triggerAutoSave();requestRedraw();
        }catch{message(tr('Mapu nelze přidat. Zkontrolujte připojení a zkuste to znovu.'));}
        finally{saving=false;add.disabled=false;}
    });
})();
