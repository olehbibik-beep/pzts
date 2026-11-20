const{test,before,after}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');let browser;const base=process.env.GOOM_TEST_URL||'http://127.0.0.1:4173';
before(async()=>browser=await chromium.launch({channel:'msedge',headless:true}));after(async()=>browser?.close());
test('homepage replaces the manual with a compact timeline and real aggregate counters',async()=>{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{await page.route('**/goomPublicStats',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({projectsCreated:1234,activeSeconds:5400,projectsSince:'2026-11-20'})}));await page.goto(base);await page.waitForFunction(()=>document.getElementById('communityStats').dataset.state==='ready');
        assert.equal(await page.locator('#workflow .feature-timeline li').count(),6);assert.equal(await page.locator('a[href="/guide/"]').count(),0);
        for(const lang of ['cs','en','de','ru']){await page.selectOption('#language',lang);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.match(await page.locator('[data-stat=hours]').innerText(),/1[,.]5/);assert.equal(await page.locator('[data-stat=projects]').innerText().then(t=>t.replace(/\D/g,'')),'1234');}
        await page.goto(base+'/guide/');await page.waitForURL(url=>url.pathname==='/'&&url.hash==='#workflow');assert.deepEqual(errors,[]);
    }finally{await page.close();}
});
test('statistics failure shows no invented totals',async()=>{const page=await browser.newPage();try{await page.route('**/goomPublicStats',route=>route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'Unavailable'}));await page.goto(base);await page.waitForFunction(()=>document.getElementById('communityStats').dataset.state==='unavailable');assert.equal(await page.locator('[data-stat=projects]').textContent(),'—');assert.equal(await page.locator('[data-stat=hours]').textContent(),'—');}finally{await page.close();}});
