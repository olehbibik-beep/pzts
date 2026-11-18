(() => {
    if (window.isGoomReadOnly?.()) return;
    const provider = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
    const attribution = 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community';
    const modal=document.createElement('div');modal.id='satelliteMapModal';modal.className='modal';
    modal.innerHTML=`<section class="modal-content satellite-map-card" role="dialog" aria-modal="true" aria-labelledby="satelliteMapTitle">
        <div class="satellite-map-heading"><h2 id="satelliteMapTitle">${tr('Satelitní mapa')}</h2><button id="satelliteMapClose" type="button" class="btn-cad" aria-label="${tr('Zavřít')}">×</button></div>
        <form id="satelliteSearchForm" class="satellite-map-search"><input id="satelliteSearchInput" aria-label="${tr('Adresa nebo souřadnice')}" placeholder="${tr('Adresa nebo souřadnice')}" maxlength="180" required><button class="btn-cad" type="submit">${tr('Hledat')}</button></form>
        <ul id="satelliteSearchResults" hidden></ul><canvas id="satelliteCanvas" width="1280" height="768" aria-label="${tr('Vyberte oblast mapy')}" tabindex="0"></canvas>
        <div class="satellite-map-attribution"><a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener">${attribution}</a> · ${tr('Vyhledávání')}: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> / Photon</div>
        <p id="satelliteMapStatus" role="status"></p><div class="satellite-map-actions"><div class="satellite-map-zoom"><button type="button" class="btn-cad" id="satelliteZoomOut" aria-label="${tr('Oddálit')}">−</button><button type="button" class="btn-cad" id="satelliteZoomIn" aria-label="${tr('Přiblížit')}">+</button></div><button type="button" class="btn-cad" id="satelliteMapAdd">${tr('Přidat mapu do plánu')}</button></div></section>`;
    document.body.append(modal);
    const preview=document.getElementById('satelliteCanvas'),context=preview.getContext('2d');
    const status=document.getElementById('satelliteMapStatus'),add=document.getElementById('satelliteMapAdd');
    const tiles=new Map(),searchCache=new Map();let zoom=17,center={x:0,y:0},drag=null,raf=0,visible=[],targetFloor=null,targetUid=null,searchPending=false,lastSearch=0;
    function project(lat,lon,z=zoom) {const size=256*2**z,s=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return {x:(lon+180)/360*size,y:(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*size};}
    function unproject(point,z=zoom) {const size=256*2**z;return [Math.atan(Math.sinh(Math.PI*(1-2*point.y/size)))*180/Math.PI,((point.x/size*360-180+180)%360+360)%360-180];}
    function setCenter(lat,lon,z=17){zoom=Math.max(2,Math.min(20,z));center=project(lat,lon);draw();}
    function schedule(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(modal.style.display==='flex')draw();});}
    function tile(x,y){const count=2**zoom;if(y<0||y>=count)return null;x=((x%count)+count)%count;const key=`${zoom}/${y}/${x}`;
        if(!tiles.has(key)){
            const item={image:new Image(),loaded:false,error:false};tiles.set(key,item);item.image.crossOrigin='anonymous';
            item.image.onload=()=>{item.loaded=true;schedule();};item.image.onerror=()=>{item.error=true;schedule();};
            item.image.src=`${provider}/tile/${key}`;
            if(tiles.size>200){const first=tiles.keys().next().value;tiles.delete(first);}
        }return tiles.get(key);
    }
    function draw(){
        context.fillStyle='#20252c';context.fillRect(0,0,preview.width,preview.height);visible=[];
        const left=center.x-preview.width/2,top=center.y-preview.height/2;
        for(let y=Math.floor(top/256);y<Math.ceil((top+preview.height)/256);y++)for(let x=Math.floor(left/256);x<Math.ceil((left+preview.width)/256);x++){
            const item=tile(x,y);if(!item)continue;visible.push(item);if(item.loaded)context.drawImage(item.image,x*256-left,y*256-top);
        }
        const failed=visible.some(item=>item.error),loading=visible.some(item=>!item.loaded);
        add.disabled=failed||loading||!visible.length;
        const [lat,lon]=unproject(center);status.textContent=failed?tr('Mapu nelze načíst. Zkuste jinou oblast nebo mapu otevřete znovu.')
            :loading?tr('Načítání mapy…'):`${lat.toFixed(6)}, ${lon.toFixed(6)} · ${tr('Přiblížení')}: ${zoom}`;
    }
    function changeZoom(delta,anchor={x:preview.width/2,y:preview.height/2}){
        const next=Math.max(2,Math.min(20,zoom+delta));if(next===zoom)return;
        const point={x:center.x+anchor.x-preview.width/2,y:center.y+anchor.y-preview.height/2},factor=2**(next-zoom);
        center={x:point.x*factor-anchor.x+preview.width/2,y:point.y*factor-anchor.y+preview.height/2};zoom=next;draw();
    }
    function point(event){const rect=preview.getBoundingClientRect();return {x:(event.clientX-rect.left)*preview.width/rect.width,y:(event.clientY-rect.top)*preview.height/rect.height};}
    preview.addEventListener('pointerdown',event=>{if(!event.isPrimary)return;event.preventDefault();const p=point(event);drag={id:event.pointerId,...p,center:{...center}};preview.setPointerCapture(event.pointerId);});
    preview.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;const p=point(event);center={x:drag.center.x+drag.x-p.x,y:drag.center.y+drag.y-p.y};draw();});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])preview.addEventListener(name,()=>{drag=null;});
    preview.addEventListener('wheel',event=>{event.preventDefault();changeZoom(event.deltaY<0?1:-1,point(event));},{passive:false});
    preview.addEventListener('keydown',event=>{
        const moves={ArrowLeft:[-128,0],ArrowRight:[128,0],ArrowUp:[0,-128],ArrowDown:[0,128]};
        if(moves[event.key]){event.preventDefault();center.x+=moves[event.key][0];center.y+=moves[event.key][1];draw();}
        else if(['+','=','-'].includes(event.key)){event.preventDefault();changeZoom(event.key==='-'?-1:1);}
    });
    document.getElementById('satelliteZoomOut').onclick=()=>changeZoom(-1);
    document.getElementById('satelliteZoomIn').onclick=()=>changeZoom(1);
    const close=()=>{modal.style.display='none';drag=null;};document.getElementById('satelliteMapClose').onclick=close;
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
    document.getElementById('btnMenuSatellite').addEventListener('click',()=>{
        if(!isSystemReady||!floors[currentFloorIndex])return;
        targetFloor=floors[currentFloorIndex];targetUid=window.getFirebaseUser?.()?.uid;
        mainMenuModal.style.display='none';modal.style.display='flex';
        // Failed requests can be retried after the connection is restored.
        for(const [key,value] of tiles)if(value.error)tiles.delete(key);
        setCenter(...(targetFloor.satellite?.center||[50.087,14.421]),targetFloor.satellite?.zoom||17);
    });
    document.getElementById('satelliteSearchForm').addEventListener('submit',async event=>{
        event.preventDefault();const query=document.getElementById('satelliteSearchInput').value.trim();if(!query||searchPending)return;
        const coordinates=query.match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
        if(coordinates){const lat=Number(coordinates[1]),lon=Number(coordinates[2]);if(Math.abs(lat)<=85&&Math.abs(lon)<=180){setCenter(lat,lon);return;}}
        if(Date.now()-lastSearch<2000)return;lastSearch=Date.now();searchPending=true;
        const button=event.target.querySelector('button');button.disabled=true;
        const list=document.getElementById('satelliteSearchResults');list.replaceChildren();list.hidden=true;status.textContent=tr('Vyhledávání…');
        try{
            let data=searchCache.get(query);
            if(!data){const endpoint=new URL(window.GOOM_MAP_SEARCH_URL||'https://photon.komoot.io/api/');endpoint.searchParams.set('q',query);endpoint.searchParams.set('limit','5');
                const response=await fetch(endpoint,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Search unavailable');data=await response.json();searchCache.set(query,data);}
            const features=Array.isArray(data.features)?data.features.slice(0,5):[];
            for(const feature of features){const c=feature.geometry?.coordinates;if(!Array.isArray(c)||!c.slice(0,2).every(Number.isFinite))continue;
                const item=document.createElement('li'),result=document.createElement('button');result.type='button';
                result.textContent=[feature.properties?.name,feature.properties?.street,feature.properties?.city,feature.properties?.country].filter(Boolean).join(', ');
                result.onclick=()=>{setCenter(c[1],c[0]);list.hidden=true;};item.append(result);list.append(item);}
            list.hidden=!list.children.length;if(!list.children.length)status.textContent=tr('Místo nebylo nalezeno. Zadejte souřadnice nebo posuňte mapu.');
        }catch{status.textContent=tr('Vyhledávání není dostupné. Zadejte souřadnice nebo posuňte mapu.');}
        finally{searchPending=false;button.disabled=false;}
    });
    add.addEventListener('click',async()=>{
        const floor=targetFloor;
        if(add.disabled||!floor||floors[currentFloorIndex]!==floor||window.getFirebaseUser?.()?.uid!==targetUid)return;
        add.disabled=true;
        try{
            const snapshot=document.createElement('canvas');snapshot.width=preview.width;snapshot.height=preview.height+28;
            const target=snapshot.getContext('2d');target.drawImage(preview,0,0);target.fillStyle='#fff';target.fillRect(0,preview.height,snapshot.width,28);
            target.fillStyle='#111';target.font='13px sans-serif';target.fillText(attribution,10,preview.height+19);
            const imgData=snapshot.toDataURL('image/png'),image=await loadPlanImage(imgData);
            if(floors[currentFloorIndex]!==floor||window.getFirebaseUser?.()?.uid!==targetUid)return;
            planPdfCache.get(floor)?.loadingTask?.destroy();planPdfCache.delete(floor);planOriginalCache.delete(floor);planTileCache.delete(floor);
            Object.assign(floor,{image,imgData,pdfSource:null,rasterSource:null,vectorPlan:null,pdfPage:1,wallMask:null,planTheme:'original',
                sourceName:tr('Satelitní mapa'),satellite:{provider:'Esri World Imagery',center:unproject(center),zoom,attribution}});
            window.resetActiveCloudProject?.();close();changeFloor();saveStateToHistory();triggerAutoSave();requestRedraw();
        }catch{status.textContent=tr('Mapu nelze přidat. Zkontrolujte připojení a zkuste to znovu.');add.disabled=false;}
    });
})();
