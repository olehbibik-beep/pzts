// One product heading and predictable scrolling across all four editors.
(() => {
    const names={PZTS:{cs:'PZTS',en:'I&HAS',de:'GMA',ru:'СОТС'},EPS:{cs:'EPS',en:'FDAS',de:'BMA',ru:'АПС'},CCTV:{cs:'CCTV',en:'CCTV',de:'VÜA',ru:'СВН'},SK:{cs:'SK',en:'SCS',de:'IT-Netz',ru:'СКС'}};
    function brand(){
        const node=document.querySelector('.app-brand-name');if(!node)return;
        node.setAttribute('data-user-content','');node.setAttribute('translate','no');
        node.textContent=(names[APP_PRODUCT]||names.PZTS)[document.documentElement.lang]||APP_PRODUCT;
    }
    brand();window.addEventListener('goom-language-changed',brand);
    new MutationObserver(brand).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
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
