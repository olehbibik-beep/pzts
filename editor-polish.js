// One product heading and predictable scrolling across all four editors.
(() => {
    const names={PZTS:{cs:'PZTS',en:'I&HAS',de:'GMA',ru:'СОТС',pl:'SSWiN'},EPS:{cs:'EPS',en:'FDAS',de:'BMA',ru:'АПС',pl:'SSP'},CCTV:{cs:'CCTV',en:'CCTV',de:'VÜA',ru:'СВН',pl:'CCTV'},SK:{cs:'SK',en:'SCS',de:'IT-Netz',ru:'СКС',pl:'OS'}};
    function brand(){
        const lang=document.documentElement.lang;const settings=({cs:'Nastavení plánu a vrstev',en:'Plan and layer settings',de:'Plan- und Ebeneneinstellungen',ru:'Настройки плана и слоёв',pl:'Ustawienia planu i warstw'})[lang]||'Plan and layer settings';
        const button=document.getElementById('btnDetectionSettings');if(button){button.title=settings;button.setAttribute('aria-label',settings);}const heading=document.getElementById('planSettingsTitle');if(heading)heading.textContent=settings;
        const map=document.querySelector('#planThemeInput option[value=cartoon]');if(map)map.textContent=({cs:'Ilustrovaná mapa',en:'Illustrated map',de:'Illustrierte Karte',ru:'Рисованная карта',pl:'Mapa ilustracyjna'})[document.documentElement.lang]||'Illustrated map';
        const node=document.querySelector('.app-brand-name');if(!node)return;
        node.setAttribute('data-user-content','');node.setAttribute('translate','no');
        node.textContent=(names[APP_PRODUCT]||names.PZTS)[document.documentElement.lang]||APP_PRODUCT;
    }
    document.documentElement.dataset.goomProduct=APP_PRODUCT;
    const title=document.querySelector('#mainMenuModal .main-menu-brand');if(title&&!title.querySelector('.goom-site-link')){const link=document.createElement('a');link.className='goom-site-link';link.href='https://goom.cz/';link.target='_blank';link.rel='noopener';link.textContent='GooM';link.setAttribute('data-user-content','');title.prepend(link);}
    brand();window.addEventListener('goom-language-changed',brand);
    new MutationObserver(brand).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    const strip=document.getElementById('deviceSetTools');
    if(strip){const track=document.createElement('div'),thumb=document.createElement('span');track.className='device-strip-progress';track.setAttribute('aria-hidden','true');track.append(thumb);strip.parentElement.append(track);let frame=0;const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const max=strip.scrollWidth-strip.clientWidth;track.hidden=max<2;const width=track.clientWidth,handle=Math.max(18,width*strip.clientWidth/Math.max(strip.clientWidth,strip.scrollWidth));thumb.style.width=handle+'px';thumb.style.transform='translateX('+(max>0?strip.scrollLeft/max*(width-handle):0)+'px)';});};strip.addEventListener('scroll',refresh,{passive:true});new ResizeObserver(refresh).observe(strip);new MutationObserver(refresh).observe(strip,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class']});window.goomRefreshDeviceStrip=refresh;refresh();}
    document.addEventListener('wheel',event=>{
        if(event.ctrlKey||event.metaKey||!(event.target instanceof Element))return;
        const horizontal=event.target.closest('.toolbar-menu-preset-icons,.device-set-tools');
        if(!horizontal||horizontal.scrollWidth<=horizontal.clientWidth+1)return;
        // Trackpads already provide horizontal deltas. A normal mouse wheel scrolls the device strip.
        if(Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
        const unit=event.deltaMode===1?24:event.deltaMode===2?horizontal.clientWidth:1;
        const before=horizontal.scrollLeft;horizontal.scrollLeft+=event.deltaY*unit;
        if(Math.abs(horizontal.scrollLeft-before)>.1)event.preventDefault();
    },{passive:false});
})();
