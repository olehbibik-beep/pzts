// Run with Node's test runner and Playwright available: node --test tests/startup-flow.test.cjs
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname, basename, sep } = require('node:path');
const { chromium, devices } = require('playwright');
const {tile:buildingTileFixture}=require('./mvt-fixture.cjs');

let server, browser, origin;
const root = resolve(process.env.TEST_SITE_ROOT || resolve(__dirname, '..'));
const renderLibraryDir = process.env.TEST_RENDER_LIBRARY_DIR || resolve(__dirname,'../.qa-render-libs');
const haveRenderLibraries = ['jspdf.umd.min.js','dxf-parser.min.js'].every(file=>require('node:fs').existsSync(resolve(renderLibraryDir,file)));
before(async () => {
    server = createServer(async (request, response) => {
        const file = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
        if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
        try {
            const body = await readFile(file);
            response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4' })[extname(file)] || 'application/octet-stream');
            response.end(body);
        } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
});
after(async () => {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
});

async function openApp(options = {}) {
    options.liveSite ||= process.env.TEST_LIVE_SITE;
    const context = await browser.newContext(options.contextOptions || {});
    const fixtureProduct = options.product || process.env.TEST_PRODUCT || (new URL(options.path || '/', 'http://localhost').searchParams.get('app') === 'CCTV' ? 'CCTV' : 'PZTS');
    let pdfModuleFailures = options.pdfModuleFailures || 0;
    const appRequests = [];
    context.on('request', request => {
        if (/\/(?:app|firebase-auth|firebase-sync|bootstrap|device-support)\.js/.test(request.url())) appRequests.push(request.url());
    });
    await context.route('**/*', route => {
        const url = route.request().url();
        if(options.dwgConverter&&url.startsWith('https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.9.3/wasm/'))return route.fulfill({path:resolve('.qa-dwg-research',url.endsWith('.wasm')?'libredwg-web.wasm':'libredwg-web.mjs'),contentType:url.endsWith('.wasm')?'application/wasm':'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
        if(options.epsSymbolOverride&&url.endsWith('/assets/devices/eps_smoke.svg'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="5" fill="white"/><text x="24" y="25" font-size="11" fill="#dc2626">FIRE</text></svg>'});
        if(options.missingNativeTiles && (url.includes('services.arcgisonline.com/')||url.includes('clarity.maptiles.arcgis.com/')||url.includes('ags.cuzk.gov.cz/')) && /\/tile\/(?:18|19)\//.test(url))return route.fulfill({status:404,headers:{'Access-Control-Allow-Origin':'*'},body:''});
        if (options.satelliteFixtures && (url.includes('services.arcgisonline.com/')||url.includes('clarity.maptiles.arcgis.com/')||url.includes('ags.cuzk.gov.cz/')) && url.includes('/tile/'))
            return route.fulfill({ contentType:'image/svg+xml', headers:{'Access-Control-Allow-Origin':'*'}, body:url.includes('/Reference/')?'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path d="M10 20h200" stroke="white" stroke-width="2"/><text x="20" y="18" font-size="11" fill="white">Field street</text></svg>':'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#54754a"/><path d="M40 40h160v160H40Z" fill="#b3b6ba" stroke="#262c31" stroke-width="5"/></svg>' });
        if(options.satelliteFixtures&&url==='https://tiles.openfreemap.org/planet')return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({maxzoom:14,tiles:['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf']})});
        if(options.satelliteFixtures&&url.startsWith('https://tiles.openfreemap.org/planet/test/')){const[z,x,y]=new URL(url).pathname.split('/').slice(-3).map(parseFloat);return route.fulfill({contentType:'application/x-protobuf',headers:{'Access-Control-Allow-Origin':'*'},body:options.buildingFixtures?buildingTileFixture(x,y,z):Buffer.alloc(0)});}
        if (options.satelliteFixtures && url.startsWith('https://photon.komoot.io/'))
            return route.fulfill({ contentType:'application/json', headers:{'Access-Control-Allow-Origin':'*'}, body:JSON.stringify({features:[{geometry:{coordinates:[14.421,50.087]},properties:{name:'Praha',country:'Česko'}}]}) });
        if (options.liveSatellite && ((url.includes('services.arcgisonline.com/')||url.includes('clarity.maptiles.arcgis.com/')||url.includes('ags.cuzk.gov.cz/')) || url.startsWith('https://photon.komoot.io/'))) return route.continue();
        if ((url.startsWith(origin) || options.liveSite && url.startsWith(options.liveSite + '/')) && /\/legacy\/build\/pdf\.min\.(?:m?js)\?/.test(url) && pdfModuleFailures-- > 0)
            return route.fulfill({ status: 404, body: 'PDF assets not uploaded yet' });
        if (options.renderLibraries && /(?:cdnjs.cloudflare.com|cdn.jsdelivr.net)/.test(url)) {
            const file = basename(new URL(url).pathname);
            if (['jspdf.umd.min.js','dxf-parser.min.js'].includes(file))
                return route.fulfill({ contentType: 'text/javascript', path: resolve(renderLibraryDir,file) });
        }
        if (options.sdkDirectory && url.startsWith('https://www.gstatic.com/firebasejs/10.14.1/')) {
            return route.fulfill({ contentType: 'text/javascript', path: resolve(options.sdkDirectory, basename(new URL(url).pathname)) });
        }
        return url.startsWith(origin) || options.liveSite && url.startsWith(options.liveSite + '/')
            ? route.continue() : route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    await context.addInitScript(({ initialSession, sessionError, authDelay, realFirebase, company, product }) => {
        window.pdfjsLib = { GlobalWorkerOptions: {} };
        window.showOpenFilePicker = undefined;
        if (realFirebase) return;
        const listeners = [];
        if (initialSession) localStorage.setItem('test.signedIn', 'true');
        window.testSessionError = sessionError || localStorage.getItem('test.forceSessionError');
        window.testAuthDelay = authDelay || Number(localStorage.getItem('test.forceAuthDelay')) || 0;
        window.testTokenChecks = 0;
        const savedUser = JSON.parse(localStorage.getItem('test.user') || 'null');
        const user = {
            uid: 'test-user', displayName: savedUser?.displayName || 'Test User', email: savedUser?.email || 'test@example.test', emailVerified: savedUser?.emailVerified ?? true,
            async reload() {
                if (window.testAuthDelay) await new Promise(resolve => setTimeout(resolve, window.testAuthDelay));
                if (window.testSessionError) throw Object.assign(new Error('Invalid test session'), { code: window.testSessionError });
                if (window.testConfirmEmail) this.emailVerified = true;
                localStorage.setItem('test.user', JSON.stringify({ displayName: this.displayName, email: this.email, emailVerified: this.emailVerified }));
            },
            async updateProfile(values) { Object.assign(this, values); },
            async sendEmailVerification() { window.testVerificationSent = (window.testVerificationSent || 0) + 1; },
            async getIdToken(forceRefresh) {
                if (forceRefresh) window.testTokenChecks++;
                return 'test-token';
            }
        };
        const auth = {
            currentUser: localStorage.getItem('test.signedIn') ? user : null,
            setPersistence: async value => {window.testAuthPersistence=value;},
            onAuthStateChanged(callback) { listeners.push(callback); setTimeout(() => callback(this.currentUser), 0); },
            async signInWithPopup() {
                if (window.testAuthError) throw Object.assign(new Error('Test sign-in error'), { code: window.testAuthError });
                window.testSessionError = null;
                user.uid = window.testSignInUid || 'test-user';
                this.currentUser = user;
                localStorage.setItem('test.signedIn', 'true');
                listeners.forEach(callback => callback(user));
            },
            async createUserWithEmailAndPassword(email) {
                user.email = email; user.emailVerified = false;
                this.currentUser = user;
                localStorage.setItem('test.signedIn', 'true');
                listeners.forEach(callback => callback(user));
                return { user };
            },
            async signInWithEmailAndPassword(email) {
                user.email = email;
                await this.signInWithPopup();
                return { user };
            },
            async sendPasswordResetEmail() { window.testPasswordResetSent = true; },
            async signOut() {
                this.currentUser = null;
                localStorage.removeItem('test.signedIn');
                listeners.forEach(callback => callback(null));
            }
        };
        const authFactory = () => auth;
        authFactory.Auth = { Persistence: { LOCAL: 'local', SESSION:'session' } };
        authFactory.GoogleAuthProvider = function () { this.setCustomParameters = () => {}; };
        const documents = new Map(JSON.parse(localStorage.getItem('test.documents') || '[]'));
        if (company && !documents.has('users/test-user')) documents.set('users/test-user', { displayName: 'Test User', email: user.email, accountType: 'company', ico: '27082440', locale: 'cs', createdAt: 'test-created-at' });
        if (company && !documents.has('cloudLicenses/test-user')) documents.set('cloudLicenses/test-user', { uid: 'test-user', plan: 'pro', status: 'active', paymentStatus: 'paid', source: 'stripe', billingMode: 'monthly', applicationExpiresAt: { [product]: { seconds: Math.floor(Date.now()/1000) + 86400 } }, billingCustomerId: 'cus_test', applications: [product], licenseId: 'PZTS-PRO-TESTLICENSE', keySuffix: 'TLICENSE', expiresAt: null });
        const watchers = new Map();
        const snapshot = path => path.endsWith('/premiumSets') ? {
            docs: [...documents].filter(([key]) => key.startsWith(`${path}/`))
                .map(([key, value]) => ({ id: key.split('/').at(-1), data: () => value }))
        } : { exists: documents.has(path), data: () => documents.get(path) };
        const update = (path, data) => {
            if (data === null) documents.delete(path); else documents.set(path, data);
            if (path.includes('/projects/') && data?.storagePath) window.testCloudSaved = data;
            localStorage.setItem('test.documents', JSON.stringify([...documents]));
            for (const callback of watchers.get(path) || []) callback(snapshot(path));
            if (path.includes('/premiumSets/')) {
                const parent = path.slice(0, path.lastIndexOf('/'));
                for (const callback of watchers.get(parent) || []) callback(snapshot(parent));
            }
        };
        const reference = path => ({
            path,
            collection(name) { return reference(`${path}/${name}`); },
            doc(id) { return reference(`${path}/${id}`); },
            orderBy() { return this; },
            limit() { return this; },
            onSnapshot(callbackOrOptions, handler) {
                const callback = typeof callbackOrOptions === 'function' ? callbackOrOptions : handler;
                const list = watchers.get(path) || []; list.push(callback); watchers.set(path, list);
                setTimeout(() => callback(snapshot(path)), 0);
                return () => watchers.set(path, (watchers.get(path) || []).filter(item => item !== callback));
            },
            async get() {
                if (!path.endsWith('/projects')) return snapshot(path);
                window.testProjectReads = (window.testProjectReads || 0) + 1;
                const rows = [...documents].filter(([key]) => key.startsWith(path + '/'));
                return { forEach(callback) { rows.forEach(([key, data]) => callback({ id:key.split('/').at(-1), data:() => data })); } };
            },
            async set(data) { if (window.testPresetWriteDenied && path.includes('/premiumSets/')) throw Object.assign(new Error('Preset write denied'),{code:'permission-denied'}); update(path, data); },
            async delete() { update(path, null); }
        });
        const query = {
            collection(name) { return reference(name); },
            async runTransaction(callback) {
                const writes = [];
                const result = await callback({ get: async ref => snapshot(ref.path), set(ref, data) { writes.push([ref.path, data]); }, delete(ref) { writes.push([ref.path, null]); } });
                for (const [path, data] of writes) update(path, data);
                return result;
            }
        };
        const firestoreFactory = () => query;
        firestoreFactory.FieldValue = { serverTimestamp: () => 'test-timestamp' };
        const projectPrefix = product === 'PZTS' ? 'users/test-user/projects' : `users/test-user/apps/${product}/projects`;
        if (company && !documents.has(`${projectPrefix}/test-cloud-project`)) {
            documents.set(`${projectPrefix}/test-cloud-project`, { name: 'Cloud example', storagePath: `${projectPrefix}/test-cloud-project/test.json`, revision: 1 });
        }
        window.firebase = {
            apps: [{}], initializeApp() {}, app: () => window.firebase, auth: authFactory,
            firestore: firestoreFactory,
            functions: () => ({ httpsCallable: name => async data => {
                if(name==='goomReviews'){window.testFeedbackCalls=[...(window.testFeedbackCalls||[]),data];if(data.action==='feedback')window.testFeedbackState={id:'feedback-test',status:'sent-today',submittedToday:true,canSubmit:false};return{data:window.testFeedbackState||{status:'none',canSubmit:true}};}
                if(name==='goomProjectCreated'){window.testProjectStarts=[...(window.testProjectStarts||[]),data];return{data:{counted:true}};}
                if (name === 'goomCloudProjects') {
                    window.testCloudOperations = [...(window.testCloudOperations || []), data.action];
                    if (data.action === 'download') {
                        const payload = JSON.stringify(window.testCloudDownloadPayload || { application:product, projectName: 'Cloud example', floors: [{ name: '1NP', devices: [], cables: [] }] });
                        return { data: { data: btoa(payload), size: payload.length, generation: '1' } };
                    }
                    if (data.action === 'delete') {
                        update(`${data.application === 'PZTS' ? `users/${user.uid}/projects` : `users/${user.uid}/apps/${data.application}/projects`}/${data.id}`, null);
                        return { data: { deleted: true } };
                    }
                    if (window.testCloudUploadDenied) throw Object.assign(new Error('Upload denied'), { code: 'storage/unauthorized' });
                    window.testCloudPayload = data.payload;
                    const id = crypto.randomUUID();
                    const path = `${data.application === 'PZTS' ? `users/${user.uid}/projects` : `users/${user.uid}/apps/${data.application}/projects`}/${id}`;
                    update(path, { name: data.payload.projectName, storagePath: `${path}/project.json`, revision: 1, state: 'ready' });
                    return { data: { id } };
                }
                if (name === 'goomCompanySeats' && data.action === 'claim') return { data: { linked: false } };
                window.testBillingCalls = [...(window.testBillingCalls || []), { name, data }];
                if (name === 'goomCompanySeats' && data.action === 'save') {
                    const members = data.emails.map(email => ({ email }));
                    update('proCompanyTeams/test-user', { members });
                    return { data: { members } };
                }
                throw Object.assign(new Error('Test checkout unavailable'), { code: 'unavailable' });
            } })
        };
    }, { initialSession: options.initialSession, sessionError: options.sessionError, authDelay: options.authDelay, realFirebase: Boolean(options.sdkDirectory), company: options.company, product: fixtureProduct });
    const page = await context.newPage();
    if(options.clock)await page.clock.install();
    page.setDefaultTimeout(options.liveSite ? 20000 : 7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL(options.path || './', options.liveSite ? options.liveSite.replace(/\/$/,'')+'/' : origin+'/').href,
        {waitUntil:options.liveSite?'domcontentloaded':'load',timeout:options.liveSite?30000:7000});
    if (!options.blocked) {
        await page.waitForFunction(() => typeof getSavedProjectData === 'function' && !!db && typeof window.updateTabletTools === 'function');
        if (!options.checkLoading) await page.waitForFunction(() => !document.getElementById('btnGoogleSignIn').disabled);
    }
    return { context, page, errors, appRequests };
}

async function dismissOnboarding(page) {
    const skip = page.locator('#onboardingSkip');
    if (await skip.isVisible()) await skip.click();
}

for (const deviceName of ['iPhone 13', 'Pixel 7', 'iPhone 13 landscape']) test(`${deviceName} opens cloud plans with pan, zoom and search but cannot edit or save`, async () => {
    const {context,page,errors}=await openApp({contextOptions:devices[deviceName],initialSession:true,company:true});
    try {
        await page.waitForFunction(()=>window.hasCloudAccess?.());
        assert.equal(await page.locator('#deviceSupportNotice').isVisible(),false);
        await page.evaluate(()=>{
            const raster=document.createElement('canvas');raster.width=900;raster.height=600;
            const c=raster.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,900,600);c.strokeRect(40,40,800,500);
            const imgData=raster.toDataURL();
            window.testCloudDownloadPayload={projectName:'Cloud inspection',application:APP_PRODUCT,currentFloorIndex:0,
                floors:[{name:'1NP',imgData,devices:[{id:'a',type:APP_PRODUCT==='CCTV'?'cctv_bullet':'magnet',x:100,y:100,loopId:1,manualNumber:1}],cables:[]},
                    {name:'2NP',imgData,devices:[{id:'b',type:APP_PRODUCT==='CCTV'?'cctv_dome':'pir',x:400,y:300,loopId:2,manualNumber:9}],cables:[]}]};
        });
        await page.locator('#btnWelcomeContinue').click();
        assert.equal(await page.locator('#btnWelcomeNew').isVisible(),false);
        await page.locator('#mobileWelcomeCloud').click();
        await page.locator('#cloudProjectsList .cloud-project-actions button').first().click();
        await page.waitForFunction(()=>isSystemReady&&projectName==='Cloud inspection');
        await page.locator('#welcomeModal').waitFor({state:'hidden'});
        assert.equal(await page.locator('#welcomeModal').isVisible(),false);
        assert.equal(await page.locator('.toolbar').isVisible(),false);
        assert.equal(await page.locator('#tabletDeviceTools').isVisible(),false);
        const before=await page.evaluate(()=>JSON.stringify(floors.map(f=>({devices:f.devices,cables:f.cables}))));
        const box=await page.locator('#canvasContainer').boundingBox();
        const camera=await page.evaluate(()=>({scale,offsetX,offsetY}));
        await page.evaluate(()=>{selectedTool='pir';activeDeviceIds.add('a');});
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
        await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+20);await page.mouse.up();
        await page.keyboard.press('Delete');await page.keyboard.press('Alt+r');await page.keyboard.press('Control+v');
        await page.touchscreen.tap(box.x+70,box.y+70);
        assert.notDeepEqual(await page.evaluate(()=>({scale,offsetX,offsetY})),camera);
        await page.locator('[data-view-zoom="1.25"]').click();
        const pinchScale=await page.evaluate(()=>scale),touchY=box.y+box.height/2,touchX=box.x+box.width/2;
        const session=await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchX-30,y:touchY},{x:touchX+30,y:touchY}]});
        await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX-60,y:touchY},{x:touchX+60,y:touchY}]});
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.ok(await page.evaluate(()=>scale)>pinchScale*1.5);
        await page.locator('#mobileViewerSearch').click();
        await page.locator('#detectorSearchBus').fill('2');await page.locator('#detectorSearchNumber').fill('9');
        await page.locator('#detectorSearchForm button[type="submit"]').click();
        await page.waitForFunction(()=>floors[currentFloorIndex].name==='2NP'&&detectorSearchMatch?.device.id==='b');
        assert.match(await page.locator('#mobileViewerFloor').evaluate(select=>select.parentElement.textContent),/2NP/);
        const floorPicker=page.locator('#mobileViewerFloor').locator('..').getByRole('combobox');
        await floorPicker.click();await page.getByRole('option',{name:'1NP',exact:true}).click();
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].name),'1NP');
        await floorPicker.click();await page.getByRole('option',{name:'2NP',exact:true}).click();
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].name),'2NP');
        assert.equal(await page.evaluate(()=>JSON.stringify(floors.map(f=>({devices:f.devices,cables:f.cables})))),before);
        await page.evaluate(async()=>{
            triggerAutoSave();saveToDB();await saveCloudProject(window.getFirebaseUser().uid);
            await deleteCloudProject(window.getFirebaseUser().uid,{id:'test-cloud-project'});
        });
        assert.deepEqual(await page.evaluate(()=>window.testCloudOperations),['download']);
        assert.equal(await page.evaluate(()=>getSavedProjectData()),null);
        assert.equal(await page.evaluate(()=>historyStack.length),0);
        await page.locator('#mobileViewerCloud').click();
        assert.equal(await page.locator('#cloudProjectsList .cloud-project-delete').count(),0);
        assert.equal(await page.locator('#btnCloudSaveCurrent').isVisible(),false);
        if(process.env.TEST_SCREENSHOT_DIR){await page.locator('#btnCloudProjectsClose').click();await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,`viewer-${deviceName.replaceAll(' ','-')}.png`)});}
        await page.evaluate(()=>firebase.firestore().collection('cloudLicenses').doc('test-user').set({}));
        await page.waitForFunction(()=>!isSystemReady&&floors.length===0);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('new administrator menus publish to all PROJECT subscribers on save',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true});
    try{
        await startRenderProject(page);
        await page.evaluate(()=>firebase.firestore().collection('goomAdmins').doc('test-user').set({role:'admin'}));
        await page.waitForFunction(()=>window.hasAdminAccess());
        await page.locator('#btnOpenToolbarMenuEditor').click();await page.locator('#btnToolbarMenuNew').click();
        assert.equal(await page.locator('#toolbarMenuShare').isChecked(),true);
        await page.locator('.toolbar-menu-preset.selected .toolbar-menu-preset-name').fill('Shared field menu');
        await page.locator('#btnToolbarMenuSave').click();
        await page.waitForFunction(()=>editingToolbarMenu?.id.startsWith('shared-')&&editingToolbarMenu.name==='Shared field menu'&&!toolbarSavePending);
        const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('test.documents')).filter(([p])=>p.includes('/premiumSets/')));
        assert.equal(records.length,1);assert.equal(records[0][1].name,'Shared field menu');
        const subscriber=await openApp({initialSession:true,company:true});
        try{
            await subscriber.page.waitForFunction(()=>window.hasProAccess());
            await subscriber.page.evaluate(async ([path,data])=>firebase.firestore().collection(path.split('/')[0]).doc(path.split('/')[1]).collection('premiumSets').doc(path.split('/')[3]).set(data),records[0]);
            await subscriber.page.waitForFunction(()=>toolbarMenus.some(m=>m.name==='Shared field menu'));
            assert.equal(await subscriber.page.evaluate(()=>canEditToolbarPreset(toolbarMenus.find(m=>m.name==='Shared field menu'))),false);
        }finally{await subscriber.context.close();}
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('satellite selection saves a self-contained map and black lines survive project round trips',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,satelliteFixtures:true});
    try{
        await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();
        const mapBox=await page.locator('#satelliteCanvas').boundingBox(),frameBox=await page.locator('.satellite-capture-frame').boundingBox();assert.ok(Math.abs(frameBox.width/frameBox.height-297/210)<.01);const raster=await page.locator('#satelliteCanvas').evaluate(c=>c.width/c.height);assert.ok(Math.abs(raster-mapBox.width/mapBox.height)<.01);
        const addBox=await page.locator('#satelliteMapAdd').boundingBox(),cardBox=await page.locator('.satellite-map-card').boundingBox();
        assert.ok(addBox.y+addBox.height<=cardBox.y+cardBox.height-10,JSON.stringify({addBox,cardBox,mapBox,style:await page.locator('#satelliteMapAdd').evaluate(el=>({position:getComputedStyle(el).position,top:getComputedStyle(el).top,parent:el.parentElement.className}))}));
        await page.locator('#satelliteSearchInput').fill('Praha');await page.locator('#satelliteSearchSubmit').click();
        await page.locator('#satelliteSearchResults button').click();await page.locator('#satelliteZoomIn').click();
        await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);
        await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>!!floors[currentFloorIndex].satellite,null,{timeout:45000});
        const result=await page.evaluate(async()=>{
            const floor=floors[currentFloorIndex];floor.planTheme='light';saveStateToHistory();
            const light=getLightPlanImage(floor.image,true),rgba=light.getContext('2d').getImageData(0,0,light.width,light.height).data;
            let black=0,white=0;for(let i=0;i<rgba.length;i+=4){if(rgba[i]<230)black++;if(rgba[i]===255)white++;}
            const payload=getProjectDataPayload(),loaded=await loadFloorsImages(payload.floors),restored=loaded[currentFloorIndex];
            return {black,white,provider:restored.satellite.provider,zoom:restored.satellite.zoom,theme:restored.planTheme,mask:restored.wallMask,
                data:restored.imgData.startsWith('data:image/png;base64,'),attribution:restored.satellite.attribution};
        });
        assert.ok(result.black>100);assert.ok(result.white>1000);assert.equal(result.provider,'ČÚZK Orthophoto / Esri World Imagery');
        assert.equal(result.zoom,19);assert.equal(result.theme,'light');assert.equal(result.mask,null);assert.equal(result.data,true);assert.match(result.attribution,/Esri/);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'satellite-light.png')});
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('map stays overhead with bounded zoom and reopens without mode switches',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,satelliteFixtures:true,missingNativeTiles:true});
    const requests=[];page.on('request',request=>{if(request.url().includes('/MapServer/tile/'))requests.push(request.url());});
    try{
        await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();
        await page.locator('#satelliteSearchInput').fill('50.087, 14.421');await page.locator('#satelliteSearchSubmit').click();
        for(let i=0;i<2;i++)await page.locator('#satelliteZoomIn').click();
        await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);
        assert.equal(await page.locator('#satelliteCanvas').getAttribute('data-zoom'),'21');
        assert.ok(requests.some(url=>url.includes('/tile/17/')));assert.ok(requests.every(url=>url.includes('blankTile=false')));
        assert.equal(await page.locator('[data-map-layer]').count(),0);assert.equal(await page.locator('.satellite-map-attribution summary').count(),0);
        const map=await page.locator('#satelliteCanvas').boundingBox(),send=await page.locator('#satelliteMapAdd').boundingBox();
        assert.ok(send.x>map.x+map.width*.75);assert.ok(send.y>map.y+map.height*.7);
        assert.equal(await page.locator('#satelliteMapStatus').isVisible(),false);
        await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>!!floors[currentFloorIndex].satellite,null,{timeout:45000});
        const saved=await page.evaluate(async()=>{const payload=getProjectDataPayload(),loaded=await loadFloorsImages(payload.floors);return loaded[currentFloorIndex].satellite;});
        assert.equal(saved.provider,'ČÚZK Orthophoto / Esri World Imagery');assert.equal(saved.layer,'satellite');assert.equal(saved.zoom,21);assert.match(saved.attribution,/ČÚZK/);
        await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();assert.equal(await page.locator('[data-map-layer]').count(),0);
        assert.equal(await page.locator('#satelliteCanvas').getAttribute('data-zoom'),'21');
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('map geolocation is requested only by its button and permission failures leave search usable',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,satelliteFixtures:true});
    try{
        await page.evaluate(()=>{window.geoCalls=0;Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){window.geoCalls++;success({coords:{latitude:49.2,longitude:16.6}});}}});});
        await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();
        assert.equal(await page.evaluate(()=>window.geoCalls),0);await page.locator('#satelliteLocate').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);
        assert.equal(await page.locator('#satelliteCanvas').getAttribute('data-zoom'),'19');
        await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>!!floors[currentFloorIndex].satellite,null,{timeout:45000});const center=await page.evaluate(()=>floors[currentFloorIndex].satellite.center);
        assert.ok(Math.abs(center[0]-49.2)<.00001);assert.ok(Math.abs(center[1]-16.6)<.00001);
        await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);
        await page.evaluate(()=>navigator.geolocation.getCurrentPosition=(success,error)=>error({code:1}));await page.locator('#satelliteLocate').click();
        assert.match(await page.locator('#satelliteMapStatus').textContent(),/Polohu/);assert.equal(await page.locator('#satelliteLocate').isEnabled(),true);
        await page.locator('#satelliteSearchInput').fill('50, 15');await page.locator('#satelliteSearchSubmit').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('free features offer the bottom upgrade prompt and F opens the project menu without intercepting typing',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.locator('#emptyProjectShortcut').waitFor({state:'visible'});
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'empty-project-F.png')});
        await page.keyboard.press('f');await page.locator('#mainMenuModal').waitFor({state:'visible'});
        assert.equal(await page.locator('#btnMenuSatellite').getAttribute('data-project-locked'),'true');await page.locator('#btnMenuSatellite').click();
        assert.equal(await page.locator('#satelliteMapModal').isVisible(),false);await page.locator('#projectUpgradeHint').waitFor({state:'visible'});
        assert.equal(await page.locator('#proUpgradeModal').isVisible(),false);await page.locator('#projectUpgradeDismiss').click();await page.keyboard.press('Escape');
        await chooseDetector(page);
        for(const selector of ['#btnCycleToolbarMenu','#btnDetectorSearch','#btnOpenToolbarMenuEditor']){
            await page.locator(selector).click();assert.equal(await page.locator('#projectUpgradeHint').isVisible(),true);await page.locator('#projectUpgradeDismiss').click();
        }
        assert.equal(await page.locator('#emptyProjectShortcut').evaluate(el=>el.tagName),'DIV');assert.equal(await page.locator('#emptyProjectKey').count(),1);await page.keyboard.press('f');await page.locator('#mainMenuModal').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.locator('#mainMenuModal').waitFor({state:'hidden'});
        await page.keyboard.press('Control+f');assert.equal(await page.locator('#mainMenuModal').isVisible(),false);await page.keyboard.press('Escape');
        await page.evaluate(()=>{const input=document.createElement('input');input.id='shortcutTypingTest';input.style.cssText='position:fixed;top:1px;left:1px;z-index:100';document.body.append(input);input.focus();});
        await page.keyboard.type('f');assert.equal(await page.locator('#shortcutTypingTest').inputValue(),'f');assert.equal(await page.locator('#mainMenuModal').isVisible(),false);
        await page.locator('#shortcutTypingTest').evaluate(el=>el.remove());await chooseDetector(page);const box=await page.locator('#canvasContainer').boundingBox();await page.mouse.click(box.x+180,box.y+180);
        await page.locator('#emptyProjectShortcut').waitFor({state:'hidden'});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('upgrade prompt dismisses automatically even after hover or keyboard focus',async()=>{
    const{context,page,errors}=await openApp({initialSession:true,clock:true});try{await startRenderProject(page);await dismissOnboarding(page);
        await page.evaluate(()=>window.requestProUpgrade());await page.locator('#projectUpgradeHint').waitFor({state:'visible'});await page.locator('#projectUpgradeAction').focus();await page.locator('#projectUpgradeHint').hover();await page.clock.runFor(5200);assert.equal(await page.locator('#projectUpgradeHint').isVisible(),false);
        await page.evaluate(()=>window.requestProUpgrade());await page.locator('#projectUpgradeHint').waitFor({state:'visible'});await page.keyboard.press('Escape');assert.equal(await page.locator('#projectUpgradeHint').isVisible(),false);
        await page.evaluate(()=>window.requestProUpgrade());await page.locator('#projectUpgradeDismiss').click();assert.equal(await page.locator('#projectUpgradeHint').isVisible(),false);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('product heading is localized, bubble artwork is retained and administrators get full feature access',async()=>{
    const{context,page,errors}=await openApp({initialSession:true});try{const product=await page.evaluate(()=>APP_PRODUCT),names={PZTS:{cs:'PZTS',en:'I&HAS',de:'GMA',ru:'СОТС'},EPS:{cs:'EPS',en:'FDAS',de:'BMA',ru:'АПС'},CCTV:{cs:'CCTV',en:'CCTV',de:'VÜA',ru:'СВН'},SK:{cs:'SK',en:'SCS',de:'IT-Netz',ru:'СКС'}};
        for(const locale of ['cs','en','de','ru']){await page.selectOption('[data-language-select]',locale);assert.equal(await page.locator('.app-brand-name').innerText(),names[product][locale]);}await page.selectOption('[data-language-select]','cs');assert.match(await page.locator('#btnLogo .menu-logo-default').getAttribute('src'),/^Link\.png/);assert.match(await page.locator('#btnLogo .menu-logo-hover').getAttribute('src'),/^Link2\.png/);
        await startRenderProject(page);await dismissOnboarding(page);assert.equal(await page.evaluate(()=>hasProAccess()),false);
        await page.evaluate(()=>firebase.firestore().collection('goomAdmins').doc('test-user').set({role:'admin'}));await page.waitForFunction(()=>hasAdminAccess()&&hasProAccess()&&hasCloudAccess());assert.equal(await page.evaluate(()=>hasProjectEntitlement()),false);assert.equal(await page.evaluate(()=>hasOwnPaidPro()),false);assert.equal(await page.locator('#accountProBadge').textContent(),'ADMIN');assert.equal(await page.locator('#btnMenuSatellite').getAttribute('data-project-locked'),'false');
        await page.locator('#btnOpenToolbarMenuEditor').click();await page.locator('#iconEditorModal').waitFor({state:'visible'});
        const strip=page.locator('.toolbar-menu-preset-icons').first();await strip.evaluate(el=>{el.style.maxWidth='140px';el.style.width='140px';el.scrollLeft=0;});await strip.hover();await page.mouse.wheel(0,230);await page.waitForFunction(()=>document.querySelector('.toolbar-menu-preset-icons').scrollLeft>0);const style=await strip.evaluate(el=>({track:getComputedStyle(el,'::-webkit-scrollbar-track').backgroundColor,thumb:getComputedStyle(el,'::-webkit-scrollbar-thumb').backgroundColor,radius:getComputedStyle(el,'::-webkit-scrollbar-thumb').borderRadius}));assert.equal(style.track,'rgba(0, 0, 0, 0)');assert.ok(['rgb(69, 73, 77)'].includes(style.thumb));assert.equal(style.radius,'999px');
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'editor-polished-scroll.png')});await page.locator('#btnIconEditorClose').click();await page.evaluate(()=>firebase.firestore().collection('goomAdmins').doc('test-user').set({role:'reviewer'}));await page.waitForFunction(()=>!hasAdminAccess()&&!hasProAccess());assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('an open map closes on loss of PROJECT and cannot insert into the old account project',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,satelliteFixtures:true});
    try{
        await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);
        await page.evaluate(()=>firebase.auth().signOut());await page.locator('#satelliteMapModal').waitFor({state:'hidden'});
        assert.equal(await page.locator('#btnMenuSatellite').getAttribute('data-project-locked'),'true');assert.equal(await page.evaluate(()=>floors.some(f=>f.satellite)),false);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('administrator PROJECT access hides purchase offers and expires back to the free plan',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await page.evaluate(()=>firebase.firestore().collection('goomProgramGrants').doc('test-user').set({uid:'test-user',expiresAt:{[APP_PRODUCT]:{seconds:Date.now()/1000+600}}}));await page.waitForFunction(()=>hasProAccess());
        await page.evaluate(()=>window.openProjectUpgrade());await page.locator('#proUpgradeModal').waitFor({state:'visible'});
        assert.equal(await page.locator('#btnProPurchase').isVisible(),false);assert.equal(await page.locator('#btnCompanyProPurchase').isVisible(),false);assert.equal(await page.locator('.pro-plan-standard .pro-entitlement-active').isVisible(),true);assert.doesNotMatch(await page.locator('.pro-plan-basic .pro-plan-action').textContent(),/Aktivní/);
        assert.match(await page.locator('#btnUpdatePro').textContent(),/aktivní/);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'admin-project-active.png')});
        await page.evaluate(()=>firebase.firestore().collection('goomProgramGrants').doc('test-user').set({uid:'test-user',expiresAt:{[APP_PRODUCT]:{seconds:Date.now()/1000-1}}}));await page.waitForFunction(()=>!hasProAccess());
        if(await page.evaluate(()=>APP_PRODUCT==='PZTS'))assert.equal(await page.locator('#btnProPurchase').isVisible(),true);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('A4 hybrid import fetches detail tiles and preserves a 3508 by 2480 source on reopening',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,satelliteFixtures:true});const requests=[];page.on('request',r=>{if(r.url().includes('/tile/'))requests.push(r.url());});
    try{
        await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);
        assert.equal(await page.locator('#satelliteCanvas').getAttribute('data-layer'),'satellite');assert.ok(requests.some(url=>url.includes('ORTOFOTO_WM')));assert.ok(!requests.some(url=>url.includes('/Reference/')));
        await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>!!floors[currentFloorIndex].satellite,null,{timeout:45000});assert.ok(requests.some(url=>url.includes('/tile/18/')));
        const result=await page.evaluate(async()=>{const f=floors[currentFloorIndex],loaded=await loadFloorsImages(getProjectDataPayload().floors),r=loaded[currentFloorIndex],full=await getPlanFullImage(r);return {page:r.satellite.page,layer:r.satellite.layer,width:full.width,height:full.height,preview:[r.image.width,r.image.height],source:r.rasterSource?.slice(0,23)};});assert.equal(result.width,3508);assert.equal(result.height,2480);assert.deepEqual(result.preview,[1684,1191]);assert.equal(result.layer,'satellite');assert.deepEqual(result.page,{widthMM:297,heightMM:210,dpi:300,width:3508,height:2480});assert.match(result.source,/data:image\/jpeg/);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('the F link, compact menu, rounded footer and quiet upgrade hint follow the new layout',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.locator('#emptyProjectKey').click();await page.locator('#mainMenuModal').waitFor({state:'visible'});
        const boxes=await page.locator('.plan-source-actions button').evaluateAll(items=>items.map(b=>{const r=b.getBoundingClientRect();return {height:r.height,label:b.textContent.trim(),wrap:b.querySelector('span').getBoundingClientRect().height};}));assert.ok(boxes.every(b=>b.height<45&&b.wrap<20));
        await page.locator('#btnMenuSatellite').click();const toast=await page.locator('#projectUpgradeHint').evaluate(el=>{const css=getComputedStyle(el);return {border:css.borderWidth,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,text:el.textContent,projectColor:getComputedStyle(el.querySelector('strong')).color,projectSize:getComputedStyle(el.querySelector('strong')).fontSize,size:getComputedStyle(el.querySelector('span')).fontSize};});assert.equal(toast.border,'0px');assert.ok(toast.width>330&&toast.height<=44);assert.doesNotMatch(toast.text,/↗/);assert.equal(toast.projectSize,toast.size);assert.equal(toast.projectColor,'rgb(185, 237, 114)');
        await page.locator('#projectUpgradeDismiss').click();await page.keyboard.press('Escape');await page.locator('#mainMenuModal').waitFor({state:'hidden'});
        await page.waitForFunction(()=>document.getElementById('footerCurrentFloor').textContent===floors[currentFloorIndex].name);
        const footer=await page.locator('#appFooter').boundingBox();assert.ok(Math.abs(footer.y+footer.height-(await page.evaluate(()=>document.body.getBoundingClientRect().bottom)))<1);assert.equal(await page.locator('#btnOverview').count(),1);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'footer-f-key.png')});
        await page.evaluate(()=>{currentFloorIndex=(currentFloorIndex+1)%floors.length;changeFloor();});await page.waitForFunction(()=>document.getElementById('footerCurrentFloor').textContent===floors[currentFloorIndex].name);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('photo capture requires PROJECT on a tablet and busy whales persist until the last operation ends',async()=>{
    for(const [tablet,paid] of [[false,true],[true,false],[true,true]]){
        const {context,page,errors}=await openApp({initialSession:true,company:paid,...(tablet?{contextOptions:devices['iPad Mini']}:{})});
        try{
            await startRenderProject(page);await page.locator('#btnLogo').click();
            if(tablet&&paid){const picker=page.waitForEvent('filechooser');await page.locator('#btnMenuPhoto').click();await picker;assert.equal(await page.locator('#btnMenuPhoto').getAttribute('data-project-locked'),'false');}
            else {await page.locator('#btnMenuPhoto').click();assert.equal(await page.locator('#photoPlanModal').isVisible(),false);assert.equal(await page.locator('#projectUpgradeHint').isVisible(),!paid);if(paid)await page.locator('#appDialogConfirm').click();}
            await page.evaluate(()=>{window.finishBusyOne=startGoomBusy();window.finishBusyTwo=startGoomBusy();});assert.equal(await page.locator('body>.goom-busy-whale').count(),1);assert.equal(await page.locator('.goom-busy-whale img').evaluate(el=>getComputedStyle(el).animationName),'plan-whale-spin');
            await page.evaluate(()=>finishBusyOne());assert.equal(await page.locator('body>.goom-busy-whale').count(),1);await page.evaluate(()=>finishBusyTwo());assert.equal(await page.locator('body>.goom-busy-whale').count(),0);assert.deepEqual(errors,[]);
        }finally{await context.close();}
    }
});

test('a photographed plan corrects perspective, cleans shadows and round trips with existing devices',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,contextOptions:devices['iPad Mini']});
    try{
        await startRenderProject(page);
        const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const t=c.getContext('2d');t.fillStyle='#343238';t.fillRect(0,0,640,480);t.fillStyle='#ece8e3';t.beginPath();t.moveTo(90,50);t.lineTo(570,85);t.lineTo(530,420);t.lineTo(60,390);t.closePath();t.fill();t.strokeStyle='#222';t.lineWidth=5;t.strokeRect(160,140,280,180);return c.toDataURL();});
        await page.evaluate(()=>{floors[currentFloorIndex].devices=[{id:'keep-photo-device',type:APP_PRODUCT==='CCTV'?'cctv_bullet':'pir',x:20,y:20,loopId:1}];});
        await page.locator('#btnLogo').click();assert.equal(await page.locator('.plan-source-actions button').count(),3);
        const picker=page.waitForEvent('filechooser');await page.locator('#btnMenuPhoto').click();await picker;
        await page.locator('#photoPlanInput').setInputFiles({name:'Survey.jpg',mimeType:'image/png',buffer:Buffer.from(photo.split(',')[1],'base64')});await page.locator('#photoPlanModal').waitFor({state:'visible'});
        const title=await page.locator('#photoPlanTitle').boundingBox(),close=await page.locator('#photoPlanClose').boundingBox();assert.ok(close.x<title.x);assert.equal(await page.locator('#photoPlanInput').getAttribute('capture'),'environment');
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'photo-perspective.png')});
        await page.locator('#photoPlanAdd').click();await page.locator('#photoPlanModal').waitFor({state:'hidden'});
        const result=await page.evaluate(async()=>{const f=floors[currentFloorIndex],payload=getProjectDataPayload(),loaded=await loadFloorsImages(payload.floors),r=loaded[currentFloorIndex];const c=document.createElement('canvas');c.width=r.image.width;c.height=r.image.height;const t=c.getContext('2d');t.drawImage(r.image,0,0);const data=t.getImageData(0,0,c.width,c.height).data;let ink=0,white=0;for(let i=0;i<data.length;i+=4){if(data[i]<100)ink++;if(data[i]>245)white++;}return {source:r.sourceName,theme:r.planTheme,width:r.image.width,height:r.image.height,devices:r.devices.map(d=>d.id),ink,white,satellite:r.satellite};});
        assert.match(result.source,/Fotografie/);assert.equal(result.theme,'light');assert.equal(result.satellite,null);assert.deepEqual(result.devices,['keep-photo-device']);assert.ok(result.ink>500);assert.ok(result.white>result.ink*4);assert.ok(result.width>400&&result.width<550);assert.ok(result.height>300&&result.height<400);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('photo geometry rejects crossed corners and maps a trapezoid to a rectangle without changing the source',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        const result=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=160;const t=c.getContext('2d');t.fillStyle='#eee';t.fillRect(0,0,200,160);t.fillStyle='#111';t.fillRect(70,40,60,80);const before=c.toDataURL();const out=rectifyPhotoPlan(c,[[.1,.1],[.9,.2],[.8,.9],[.2,.8]],false);let rejected=false;try{rectifyPhotoPlan(c,[[0,0],[1,1],[1,0],[0,1]]);}catch{rejected=true;}return {same:c.toDataURL()===before,rejected,width:out.width,height:out.height};});assert.equal(result.same,true);assert.equal(result.rejected,true);assert.ok(result.width>100&&result.height>80);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('tablet photo corners follow touch dragging and cancel leaves the existing plan unchanged',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,contextOptions:devices['iPad Mini']});
    try{
        await startRenderProject(page);const before=await page.evaluate(()=>getProjectDataPayload());
        const photo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const t=c.getContext('2d');t.fillStyle='#eee';t.fillRect(0,0,640,480);t.strokeRect(100,100,400,280);return c.toDataURL();});
        await page.locator('#photoPlanInput').setInputFiles({name:'Tablet.png',mimeType:'image/png',buffer:Buffer.from(photo.split(',')[1],'base64')});
        // A capture starts from the menu so its destination floor is fixed before the file picker opens.
        if(!await page.locator('#photoPlanModal').isVisible()){
            await page.locator('#btnLogo').click();const chooser=page.waitForEvent('filechooser');await page.locator('#btnMenuPhoto').click();await chooser;await page.locator('#photoPlanInput').setInputFiles({name:'Tablet.png',mimeType:'image/png',buffer:Buffer.from(photo.split(',')[1],'base64')});
        }
        await page.locator('#photoPlanModal').waitFor({state:'visible'});const box=await page.locator('#photoPlanPreview').boundingBox();const session=await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+20,y:box.y+20}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+60,y:box.y+55}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.locator('#photoPlanClose').click();await page.locator('#photoPlanModal').waitFor({state:'hidden'});assert.deepEqual(await page.evaluate(()=>getProjectDataPayload()),before);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('sensor, module and ACS routes use slimmer lines on screen and use matching colors in vector export',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);const result=await page.evaluate(()=>{const f=floors[currentFloorIndex],d=(id,type,x)=>({id,type,x,y:50,loopId:1});f.image=null;f.devices=[d('a','panel',30),d('b','expander',170),d('c','pir',300),d('d','acs_module',440),d('e','acs_reader',580)];f.cables=[['a','b'],['b','c'],['d','e']].map(([fromId,toId])=>({id:fromId+toId,fromId,toId}));f.showConnections=true;const out=new SVGPlanContext(800,600);drawFloorData(out,f,true,'light');return {svg:out.toSVG(),colors:[cableRouteColor(f.devices[0],f.devices[1]),cableRouteColor(f.devices[1],f.devices[2]),cableRouteColor(f.devices[3],f.devices[4])]};});
        assert.deepEqual(result.colors,['#38bdf8','#22c55e','#a78bfa']);for(const color of result.colors)assert.match(result.svg,new RegExp('stroke="'+color+'" stroke-width="4"'));assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('phone welcome fits narrow and landscape screens without controls overlapping the content',async()=>{
    for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
        const {context,page,errors}=await openApp({contextOptions:{...devices['iPhone 13'],viewport}});
        try{
            const result=await page.locator('#welcomeModal').evaluate(root=>{const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return {card:box(root.querySelector('.welcome-card')),panel:box(root.querySelector('.welcome-panel')),controls:box(root.querySelector('.welcome-controls')),brand:box(root.querySelector('.welcome-identity')),content:box(root.querySelector('.welcome-step-content')),viewport:{width:innerWidth,height:innerHeight},photo:!!document.getElementById('photoPlanInput')};});
            assert.ok(result.card.x>=0&&result.card.right<=result.viewport.width+1);assert.ok(result.card.y>=0&&result.card.bottom<=result.viewport.height+1);assert.ok(result.panel.width<=result.card.width+1);assert.ok(result.content.y>=result.brand.bottom-1);assert.ok(result.brand.y>=result.controls.bottom-1);assert.equal(result.photo,false);
            await page.locator('#btnEmailSignIn').click();assert.ok(await page.locator('#welcomeEmailBlock').isVisible());
            if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,`welcome-phone-${viewport.width}.png`)});
            assert.deepEqual(errors,[]);
        }finally{await context.close();}
    }
});

test('monochrome map contours close gaps, retain straight corners and curves and export as vector paths',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        const result=await page.evaluate(()=>{
            const source=document.createElement('canvas');source.width=640;source.height=398;const ctx=source.getContext('2d');ctx.fillStyle='#658358';ctx.fillRect(0,0,640,398);
            ctx.fillStyle='#c6c8c9';ctx.fillRect(45,45,190,220);ctx.beginPath();ctx.arc(440,170,95,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#222';ctx.fillRect(4,4,1,1);ctx.fillStyle='#658358';ctx.fillRect(43,149,5,1);
            const before=source.toDataURL(),vector=getMapLinework(source);const target=new SVGPlanContext(640,398);drawMapLinework(target,source,'Test map credit');
            const raster=getLightPlanImage(source,true),pixels=raster.getContext('2d').getImageData(0,0,640,398).data;
            return {paths:vector.paths,svg:target.toSVG(),same:source.toDataURL()===before,speck:pixels[(4*640+4)*4],cached:getMapLinework(source)===vector};
        });
        assert.ok(result.paths.length>=4);assert.ok(result.paths.every(p=>p.startsWith('M')&&p.endsWith('Z')&&!/NaN|Infinity/.test(p)));assert.match(result.paths.join(' '),/Q/);assert.match(result.paths.join(' '),/L/);
        assert.equal(result.same,true);assert.equal(result.speck,255);assert.equal(result.cached,true);assert.match(result.svg,/<path/);assert.doesNotMatch(result.svg,/<image/);assert.doesNotMatch(result.svg,/Test map credit/);assert.match(result.svg,/#777d82/);assert.match(result.svg,/stroke-width="0.65"/);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('a failed shared menu save keeps the draft and can be retried without duplicate publication',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true});
    try{
        await startRenderProject(page);await page.evaluate(()=>firebase.firestore().collection('goomAdmins').doc('test-user').set({role:'admin'}));
        await page.waitForFunction(()=>window.hasAdminAccess());await page.locator('#btnOpenToolbarMenuEditor').click();await page.locator('#btnToolbarMenuNew').click();
        await page.locator('.toolbar-menu-preset.selected .toolbar-menu-preset-name').fill('Retry shared menu');
        await page.evaluate(()=>window.testPresetWriteDenied=true);await page.locator('#btnToolbarMenuSave').click();
        await page.locator('#appDialogConfirm').click();
        assert.equal(await page.evaluate(()=>editingToolbarMenuIsNew),true);assert.equal(await page.locator('#toolbarMenuShare').isChecked(),true);
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test.documents')).filter(([p])=>p.includes('/premiumSets/')).length),0);
        await page.evaluate(()=>window.testPresetWriteDenied=false);await page.locator('#btnToolbarMenuSave').click();
        await page.waitForFunction(()=>editingToolbarMenu?.id.startsWith('shared-')&&!toolbarSavePending);
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test.documents')).filter(([p])=>p.includes('/premiumSets/')).length),1);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('removed hidden tool cannot be activated and old objects are discarded with their cables',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.keyboard.press('Alt+r');
        assert.notEqual(await page.evaluate(()=>selectedTool),'ramen');assert.equal(await page.locator('#ramenModal').count(),0);
        const result=await page.evaluate(()=>sanitizeFloors([{name:'1NP',devices:[{id:'secret',type:'ramen'},{id:'a',type:'magnet'}],cables:[{fromId:'secret',toId:'a'}]}])[0]);
        assert.deepEqual(result.devices.map(d=>d.id),['a']);assert.equal(result.cables.length,0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('live satellite tiles render and can be saved without a cross-origin canvas error',{skip:!process.env.TEST_LIVE_MAP},async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,liveSatellite:true});
    try{
        await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();
        await page.locator('#satelliteSearchInput').fill('Praha');await page.locator('#satelliteSearchSubmit').click();
        await page.locator('#satelliteSearchResults button').first().waitFor({state:'visible',timeout:20000});
        await page.locator('#satelliteSearchResults button').first().click();
        await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled,null,{timeout:45000});
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'satellite-live-selection.png')});
        await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>floors[currentFloorIndex].satellite?.provider==='Esri World Imagery Hybrid',null,{timeout:45000});
        await page.evaluate(()=>{floors[currentFloorIndex].planTheme='light';changeFloor();requestRedraw();});
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'satellite-live-light.png')});
        assert.ok(await page.evaluate(()=>floors[currentFloorIndex].imgData.length)>10000);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('live topographic map includes provider labels and supports close zoom',{skip:!process.env.TEST_LIVE_MAP},async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,liveSatellite:true});
    try{
        await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();
        await page.locator('[data-map-layer=topo]').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled,null,{timeout:45000});
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'topographic-live-selection.png')});
        for(let i=0;i<5;i++)await page.locator('#satelliteZoomIn').click();
        await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled,null,{timeout:45000});assert.equal(await page.locator('#satelliteCanvas').getAttribute('data-zoom'),'22');
        await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>!!floors[currentFloorIndex].satellite,null,{timeout:45000});assert.equal(await page.evaluate(()=>floors[currentFloorIndex].satellite.layer),'topo');
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('alternative aerial imagery covers multiple countries and saves no visible attribution strip',{skip:!process.env.TEST_LIVE_MAP},async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,liveSatellite:true});
    try{
        await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();
        const title=await page.locator('#satelliteMapTitle').boundingBox(),close=await page.locator('#satelliteMapClose').boundingBox();assert.ok(close.x<title.x);assert.equal(await page.locator('#satelliteSearchInput').evaluate(el=>getComputedStyle(el).borderWidth),'0px');
        for(const coordinates of ['50.087, 14.421','52.52, 13.405','52.2297, 21.0122']){
            await page.locator('#satelliteSearchInput').fill(coordinates);await page.locator('#satelliteSearchSubmit').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled,null,{timeout:45000});
            const pixels=await page.locator('#satelliteCanvas').evaluate(el=>{const p=el.getContext('2d').getImageData(0,0,el.width,el.height).data;let variance=0;for(let i=4;i<p.length;i+=4096)variance+=Math.abs(p[i]-p[i-4]);return variance;});assert.ok(pixels>500);
        }
        assert.equal(await page.locator('#satelliteProviderCredit').isVisible(),false);await page.locator('.satellite-map-attribution summary').click();assert.equal(await page.locator('#satelliteProviderCredit').isVisible(),true);await page.locator('.satellite-map-attribution summary').click();
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'map-clarity-warsaw.png')});
        await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>!!floors[currentFloorIndex].satellite,null,{timeout:45000});const source=await page.evaluate(()=>({height:floors[currentFloorIndex].image.height,footer:floors[currentFloorIndex].satellite.footerHeight,provider:floors[currentFloorIndex].satellite.provider}));assert.equal(source.height,1191);assert.equal(source.footer,0);assert.equal(source.provider,'Esri World Imagery Hybrid');
        await page.locator('#planSourceInfo').click();assert.match(await page.locator('#appDialogMessage').textContent(),/Esri/);await page.locator('#appDialogConfirm').click();assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('black lines use a white page for dark drawings and gray scans while preserving source pixels',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        const samples=await page.evaluate(()=>['#151515','#c5c5c5'].map(background=>{
            const source=document.createElement('canvas');source.width=160;source.height=120;
            const c=source.getContext('2d');c.fillStyle=background;c.fillRect(0,0,160,120);
            c.strokeStyle=background==='#151515'?'#fff':'#111';c.lineWidth=4;c.strokeRect(30,30,100,60);
            const before=source.toDataURL(),result=getLightPlanImage(source).getContext('2d');
            return {paper:[...result.getImageData(2,2,1,1).data],line:[...result.getImageData(30,60,1,1).data],same:before===source.toDataURL()};
        }));
        for(const s of samples){assert.deepEqual(s.paper,[255,255,255,255]);assert.deepEqual(s.line,[0,0,0,255]);assert.equal(s.same,true);}assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('a phone without PROJECT cannot open a local plan or enter a trapped purchase dialog',async()=>{
    const {context,page,errors}=await openApp({contextOptions:devices['iPhone 13'],initialSession:true});
    try{
        await page.locator('#btnWelcomeContinue').click();await page.locator('#mobileWelcomeCloud').click();
        await page.locator('#appDialogConfirm').click();assert.equal(await page.locator('#proUpgradeModal').isVisible(),false);
        assert.equal(await page.evaluate(()=>isSystemReady),false);
        assert.equal(await page.evaluate(()=>importFileContent(new File(['{}'],'local.TECH',{type:'application/json'}))),false);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('a phone ignores an existing local draft on reload even with PROJECT access',async()=>{
    const {context,page,errors}=await openApp({contextOptions:devices['Pixel 7'],initialSession:true,company:true});
    try{
        await page.evaluate(()=>new Promise((resolve,reject)=>{
            const tx=db.transaction(STORE_NAME,'readwrite');
            tx.objectStore(STORE_NAME).put({ownerUid:'test-user',projectName:'Local only',floors:[{name:'1NP',devices:[],cables:[]}]},'latest_save');
            tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
        }));
        await page.reload();await page.waitForFunction(()=>window.hasCloudAccess?.());
        assert.equal(await page.evaluate(()=>isSystemReady),false);assert.equal(await page.evaluate(()=>floors.length),0);
        await page.locator('#btnWelcomeContinue').click();assert.equal(await page.locator('#btnWelcomeResume').isVisible(),false);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('the standalone CCTV keeps its extra devices, camera settings and native project extension',{skip:process.env.TEST_PRODUCT!=='CCTV'},async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true});
    try{
        await startRenderProject(page);
        assert.equal(await page.evaluate(()=>APP_PRODUCT),'CCTV');
        for(const type of ['cctv_bullet','cctv_doorbell','cctv_antenna','cctv_receiver'])assert.equal(await page.locator(`#deviceSelector [data-type="${type}"]`).count(),1);
        await page.evaluate(()=>document.querySelector('#deviceSelector [data-type="cctv_bullet"]').click());
        const box=await page.locator('#canvasContainer').boundingBox();await page.mouse.click(box.x+180,box.y+180);
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].type),'cctv_bullet');
        assert.ok(await page.evaluate(()=>CCTV_CAMERA_LENSES.length)>3);
        const before=await page.evaluate(()=>JSON.stringify(floors[currentFloorIndex].devices));
        const pending=page.waitForEvent('download');await page.evaluate(()=>downloadProjectFile());const download=await pending;
        assert.match(download.suggestedFilename(),/\.cctv$/i);
        const bytes=await readFile(await download.path());const data=JSON.parse(bytes.toString('utf8'));assert.equal(data.application,'CCTV');assert.equal(data.format,'CCTV');
        await page.evaluate(()=>{loadDefaultFloors(false,'Cleared');});
        await page.locator('#bipsLoader').setInputFiles({name:'Saved.cctv',mimeType:'application/json',buffer:bytes});
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].devices.length===1);
        assert.equal(await page.evaluate(()=>JSON.stringify(floors[currentFloorIndex].devices)),before);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('welcome plays the intro behind its controls and restores the illustration when it ends', async () => {
    const { page, context } = await openApp();
    try {
        const video = page.locator('#welcomeIntroVideo');
        const play = page.locator('#btnIntroPlay');
        assert.equal(await video.getAttribute('src'), null);
        assert.equal(await video.isHidden(), true);
        await play.click();
        await page.waitForFunction(() => {
            const video = document.getElementById('welcomeIntroVideo');
            return !video.paused && video.currentTime > 0 && video.videoWidth > 0 && getComputedStyle(video).opacity === '1';
        });
        assert.deepEqual(await video.evaluate(element=>({muted:element.muted,defaultMuted:element.defaultMuted,volume:element.volume})),{muted:true,defaultMuted:true,volume:0});
        await video.evaluate(element=>{element.muted=false;element.volume=1;});
        await page.waitForFunction(()=>{const v=document.getElementById('welcomeIntroVideo');return v.muted&&v.defaultMuted&&v.volume===0;});
        assert.equal(await video.evaluate(element => element.controls), false);
        assert.equal(await page.locator('#btnIntroClose').count(), 0);
        assert.equal(await play.isHidden(), true);
        assert.deepEqual(await video.boundingBox(), await page.locator('.welcome-art-space img').boundingBox());
        assert.equal(await video.evaluate(element => getComputedStyle(element).objectFit), process.env.TEST_PRODUCT==='CCTV'?'contain':'cover');
        await page.setViewportSize({ width: 820, height: 1180 });
        assert.deepEqual(await video.boundingBox(), await page.locator('.welcome-art-space img').boundingBox());
        await video.evaluate(element => { element.playbackRate = 8; });
        await video.waitFor({ state: 'hidden' });
        assert.equal(await video.isHidden(), true);
        assert.equal(await video.getAttribute('src'), null);
        assert.equal(await page.locator('.welcome-art-space img').isVisible(), true);
        assert.equal(await play.isVisible(), true);
        await play.click();
        await page.waitForFunction(() => document.getElementById('welcomeModal').classList.contains('is-intro-playing'));
        assert.deepEqual(await video.evaluate(element=>({muted:element.muted,volume:element.volume})),{muted:true,volume:0});
        await page.locator('#btnEmailSignIn').click();
        await video.waitFor({ state: 'hidden' });
        assert.equal(await video.getAttribute('src'), null);
        assert.equal(await page.locator('#emailAuthEmail').isVisible(), true);
    } finally { await context.close(); }
});

test('welcome precedes sign-in and creation, while a verified reload resumes even an empty project', async () => {
    const { context, page, errors } = await openApp();
    try {
        assert.equal(await page.locator('#welcomeAuthBlock').isVisible(), true);
        assert.equal(await page.locator('#welcomeButtonsBlock').isVisible(), false);
        await page.keyboard.press('Escape');
        await page.locator('#welcomeModal').click({ position: { x: 5, y: 5 } });
        assert.equal(await page.locator('#welcomeAuthBlock').isVisible(), true);
        assert.deepEqual(await page.evaluate(() => ({ ready: isSystemReady, floors: floors.length })), { ready: false, floors: 0 });
        assert.equal(await page.evaluate(() => getSavedProjectData()), null);

        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#btnWelcomeCancelNaming').click();
        assert.equal(await page.locator('#welcomeButtonsBlock').isVisible(), true);
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#welcomeProjectNameInput').fill('Named empty project');
        await page.locator('#welcomeProjectNameInput').press('Enter');
        await page.waitForFunction(() => isSystemReady && projectName === 'Named empty project');
        await page.locator('#welcomeModal').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#welcomeModal').isVisible(), false);
        await page.evaluate(() => new Promise((resolve, reject) => {
            const deadline = Date.now() + 7000;
            const poll = async () => {
                if ((await getSavedProjectData())?.projectName === 'Named empty project') resolve();
                else if (Date.now() > deadline) reject(new Error('Project was not autosaved'));
                else setTimeout(poll, 50);
            };
            poll();
        }));

        await page.reload();
        await page.waitForFunction(() => !!window.getFirebaseUser?.() && isSystemReady && projectName==='Named empty project');
        await page.locator('#welcomeModal').waitFor({state:'hidden'});
        assert.equal(await page.locator('#welcomeModal').isVisible(),false);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('cancelled and failed sign-in keep the welcome step available for retry', async () => {
    const { context, page, errors } = await openApp();
    try {
        await page.evaluate(() => { window.testAuthError = 'auth/popup-closed-by-user'; });
        await page.locator('#btnGoogleSignIn').click();
        assert.equal(await page.locator('#welcomeAuthBlock').isVisible(), true);
        assert.equal(await page.locator('#btnGoogleSignIn').isEnabled(), true);
        await page.evaluate(() => { window.testAuthError = 'auth/network-request-failed'; });
        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#appDialogConfirm').click();
        assert.equal(await page.locator('#welcomeAuthBlock').isVisible(), true);
        await page.evaluate(() => { window.testAuthError = null; });
        await page.locator('#btnGoogleSignIn').click();
        assert.equal(await page.locator('#welcomeButtonsBlock').isVisible(), true);
        await page.locator('#btnWelcomeAccount').click();
        await page.locator('#btnGoogleSignOut').click();
        assert.equal(await page.locator('#btnGoogleSignIn').isVisible(), true);
        assert.equal(await page.locator('#welcomeButtonsBlock').isVisible(), false);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('cancelled or invalid files keep project selection; a valid file opens the editor', async () => {
    const { context, page, errors } = await openApp();
    try {
        await page.locator('#btnGoogleSignIn').click();
        await page.evaluate(() => { window.showOpenFilePicker = async () => { throw new DOMException('Cancelled', 'AbortError'); }; });
        await page.locator('#btnWelcomeOpenBIPS').click();
        assert.equal(await page.locator('#welcomeButtonsBlock').isVisible(), true);
        await page.evaluate(() => { window.showOpenFilePicker = undefined; });
        await page.locator('#bipsLoader').setInputFiles({ name: 'invalid.bips', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
        await page.locator('#appDialogConfirm').click();
        assert.equal(await page.locator('#welcomeButtonsBlock').isVisible(), true);
        assert.equal(await page.evaluate(() => isSystemReady), false);
        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#btnWelcomeOpenBIPS').click();
        await (await chooserPromise).setFiles({ name: 'example.bips', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
            application:process.env.TEST_PRODUCT||'PZTS',projectName: 'File example', floors: [{ name: '1NP', devices: [], cables: [] }]
        })) });
        await page.waitForFunction(() => isSystemReady && projectName === 'File example');
        await page.locator('#welcomeModal').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#welcomeModal').isVisible(), false);
        await chooseDetector(page);
        const canvas = await page.locator('#canvasContainer').boundingBox();
        await page.mouse.click(canvas.x + 200, canvas.y + 200);
        const beforeDrag = await page.evaluate(() => ({ ...floors[currentFloorIndex].devices[0] }));
        await page.mouse.move(canvas.x + beforeDrag.x, canvas.y + beforeDrag.y);
        await page.mouse.down();
        await page.mouse.move(canvas.x + beforeDrag.x + 60, canvas.y + beforeDrag.y + 40, { steps: 5 });
        await page.mouse.up();
        const afterDrag = await page.evaluate(() => floors[currentFloorIndex].devices[0]);
        assert.ok(afterDrag.x > beforeDrag.x + 40 && afterDrag.y > beforeDrag.y + 20);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 1);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('a licensed company can open a cloud project from the editor', async () => {
    const { context, page, errors } = await openApp({ company: true });
    try {
        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#btnWelcomeConfirmNaming').click();
        await dismissOnboarding(page);
        await page.locator('#btnOpenCloudProjectsToolbar').click();
        await page.locator('#btnAccountCloudProjects').click();
        await page.locator('.cloud-project-actions').getByRole('button', { name: 'Otevřít', exact: true }).click();
        await page.locator('#appDialogConfirm').click();
        await page.waitForFunction(() => isSystemReady && projectName === 'Cloud example');
        await page.locator('#welcomeModal').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#welcomeModal').isVisible(), false);
        await page.locator('#cloudProjectsModal').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#cloudProjectsModal').isVisible(), false);
        assert.equal(await page.locator('#projectLocationCloud').isVisible(), true);
        const image = await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 150;
            const context = canvas.getContext('2d');
            context.fillStyle = '#fff';
            context.fillRect(0, 0, 150, 150);
            context.fillStyle = '#000';
            context.fillRect(30, 30, 90, 10);
            return canvas.toDataURL().split(',')[1];
        });
        await page.locator('#imageLoader').setInputFiles({ name:'replacement.png', mimeType:'image/png', buffer:Buffer.from(image,'base64') });
        await page.waitForFunction(() => floors[currentFloorIndex]?.sourceName === 'replacement.png');
        await page.waitForFunction(async () => (await getSavedProjectData())?.floors.some(floor => floor.sourceName === 'replacement.png'));
        assert.equal(await page.locator('#projectLocationLocal').isVisible(), true);
        assert.equal(await page.evaluate(() => window.testCloudPayload), undefined);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('tablet layout supports sign-in, creation and touch input', async () => {
    const { context, page, errors } = await openApp({ contextOptions: devices['iPad Mini'] });
    try {
        const buttonBounds = await page.locator('#btnGoogleSignIn').boundingBox();
        assert.ok(buttonBounds.y >= 0 && buttonBounds.y + buttonBounds.height <= 1024);
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'tablet-welcome.png') });
        await page.locator('#btnGoogleSignIn').click();
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'tablet-projects.png') });
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#welcomeProjectNameInput').fill('Tablet example');
        await page.locator('#btnWelcomeConfirmNaming').click();
        await dismissOnboarding(page);
        await page.waitForFunction(() => isSystemReady && projectName === 'Tablet example');
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'tablet-first-project-guide.png') });
        await dismissOnboarding(page);
        await chooseDetector(page);
        const canvas = await page.locator('#canvasContainer').boundingBox();
        await page.touchscreen.tap(canvas.x + 200, canvas.y + 200);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 1);
        const session = await context.newCDPSession(page);
        const beforeDrag = await page.evaluate(() => ({ ...floors[currentFloorIndex].devices[0] }));
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: canvas.x + beforeDrag.x, y: canvas.y + beforeDrag.y, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: canvas.x + beforeDrag.x + 60, y: canvas.y + beforeDrag.y + 40, id: 1 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const afterDrag = await page.evaluate(() => floors[currentFloorIndex].devices[0]);
        assert.ok(afterDrag.x > beforeDrag.x + 40 && afterDrag.y > beforeDrag.y + 20);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: canvas.x + 300, y: canvas.y + 350, id: 1 }, { x: canvas.x + 400, y: canvas.y + 350, id: 2 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: canvas.x + 250, y: canvas.y + 350, id: 1 }, { x: canvas.x + 450, y: canvas.y + 350, id: 2 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.ok(Math.abs(await page.evaluate(() => scale) - 2) < 0.05);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'tablet-editor.png') });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('an expired saved session returns to sign-in and can be replaced', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, sessionError: 'auth/user-token-expired' });
    try {
        assert.equal(await page.evaluate(() => window.getFirebaseUser()), null);
        assert.equal(await page.locator('#btnGoogleSignIn').isVisible(), true);
        assert.equal(await page.locator('#btnWelcomeContinue').isVisible(), false);
        assert.match(await page.locator('#googleAuthMessage').textContent(), /Platnost přihlášení vypršela/);
        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#btnWelcomeNew').waitFor({ state: 'visible' });
        assert.ok(await page.evaluate(() => window.testTokenChecks) > 0);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('an unverified stored user stays on the checking screen', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, authDelay: 700, checkLoading: true });
    try {
        assert.equal(await page.evaluate(() => window.getFirebaseUser()), null);
        assert.equal(await page.locator('#btnWelcomeContinue').isVisible(), false);
        await page.locator('#btnWelcomeContinue').waitFor({ state: 'visible' });
        await page.locator('#btnWelcomeContinue').click();
        await page.locator('#btnWelcomeNew').waitFor({ state: 'visible' });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('network failure during session verification allows a fresh sign-in', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, sessionError: 'auth/network-request-failed' });
    try {
        assert.equal(await page.evaluate(() => window.getFirebaseUser()), null);
        assert.equal(await page.locator('#btnGoogleSignIn').isVisible(), true);
        assert.match(await page.locator('#googleAuthMessage').textContent(), /Přihlášení nelze ověřit/);
        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#btnWelcomeNew').waitFor({ state: 'visible' });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('a compact desktop window starts the application once it is widened', async () => {
    const { context, page, errors, appRequests } = await openApp({ contextOptions: { viewport: { width: 420, height: 800 } }, blocked: true });
    try {
        assert.equal(await page.locator('#deviceSupportNotice').isVisible(), true);
        assert.match(await page.locator('#deviceSupportTitle').textContent(), /šířku okna/);
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.locator('#btnGoogleSignIn').waitFor({ state: 'visible' });
        await page.waitForFunction(() => typeof window.ensureFirebaseSession === 'function');
        assert.equal(await page.locator('#deviceSupportNotice').isVisible(), false);
        assert.ok(appRequests.filter(url => /\/(?:app|firebase-auth|firebase-sync)\.js/.test(url)).every(url => url.includes('?v=')));
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('the real Firebase SDK initializes with a signed-out user', { skip: !process.env.TEST_FIREBASE_SDK_DIR }, async () => {
    const { context, page, errors } = await openApp({ sdkDirectory: process.env.TEST_FIREBASE_SDK_DIR });
    try {
        assert.equal(await page.evaluate(() => window.firebase.SDK_VERSION), '10.14.1');
        assert.equal(await page.evaluate(() => window.getFirebaseUser()), null);
        assert.equal(await page.locator('#btnGoogleSignIn').isVisible(), true);
        assert.equal(await page.locator('#btnWelcomeContinue').isVisible(), false);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('manual cloud saving names the project and uploads the matching metadata and file', async () => {
    const { context, page, errors } = await openApp({ company: true });
    try {
        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#btnWelcomeConfirmNaming').click();
        await dismissOnboarding(page);
        await page.locator('#btnOpenCloudProjectsToolbar').click();
        await page.locator('#btnAccountCloudProjects').click();
        await page.locator('#btnCloudSaveCurrent').click();
        await page.locator('#appDialogInput').fill('Saved cloud example');
        await page.locator('#appDialogInput').press('Enter');
        await page.waitForFunction(() => window.testCloudSaved?.name === 'Saved cloud example');
        assert.equal(await page.evaluate(() => window.testCloudPayload.projectName), 'Saved cloud example');
        assert.equal(await page.evaluate(() => window.testCloudPayload.floors.length), 9);
        await page.waitForFunction(() => document.getElementById('cloudSyncIndicator').dataset.state === 'saved');
        await page.evaluate(() => { window.testCloudUploadDenied = true; });
        await page.locator('#btnCloudSaveCurrent').click();
        await page.locator('#appDialogMessage').getByText(/Firebase Storage nepovolil/).waitFor();
        assert.equal(await page.evaluate(() => window.testCloudCleanupAttempts || 0), 0);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('Android tablets fit portrait and landscape viewports', async () => {
    const { context, page, errors } = await openApp({ contextOptions: {
        viewport: { width: 800, height: 1280 }, screen: { width: 800, height: 1280 }, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    } });
    try {
        await fillRegistration(page, { company: true });
        for (const viewport of [{ width: 600, height: 960 }, { width: 800, height: 1280 }, { width: 1280, height: 800 }]) {
            await page.setViewportSize(viewport);
            assert.equal(await page.locator('#deviceSupportNotice').isVisible(), false);
            const bounds = await page.locator('#welcomeModal .welcome-card').boundingBox();
            assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height);
            const subtitle = await page.locator('.welcome-system-name').boundingBox();
            const step = await page.locator('.welcome-step-content').boundingBox();
            assert.ok(subtitle.y + subtitle.height <= step.y && subtitle.x + subtitle.width <= step.x + step.width);
            const footer = await page.locator('.welcome-copyright').boundingBox();
            assert.ok(step.y + step.height < footer.y);
            assert.equal(await page.locator('.welcome-step-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
            const form = await page.locator('#emailAuthForm').boundingBox();
            for (const id of ['emailDisplayName', 'emailAuthEmail', 'emailAuthPassword', 'emailAuthConfirm', 'emailCompanyIco']) {
                const field = await page.locator(`#${id}`).boundingBox();
                assert.ok(field.x >= form.x - 1 && field.x + field.width <= form.x + form.width + 1, `${id} fits at ${viewport.width}px`);
            }
            await page.locator('#btnEmailAuthSubmit').scrollIntoViewIfNeeded();
            if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, `registration-${viewport.width}.png`) });
        }
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

async function fillRegistration(page, { company = false, ico = '27082440' } = {}) {
    await page.locator('#btnEmailRegister').click();
    await page.locator('#emailDisplayName').fill('Firma Test');
    await page.locator('#emailAuthEmail').fill('firma@other-mail.test');
    await page.locator('#emailAuthPassword').fill('test-password-123');
    await page.locator('#emailAuthConfirm').fill('test-password-123');
    if (company) {
        await page.locator('#emailAccountType').selectOption('company');
        await page.locator('#emailCompanyIco').fill(ico);
    }
}

test('Czech is the default and English persists across the entire startup flow', async () => {
    const { context, page, errors } = await openApp();
    try {
        assert.equal(await page.locator('#welcomeAuthBlock h1').textContent(), 'Vítejte!');
        assert.equal(await page.locator('#btnWelcomeCloudProjects').count(), 0);
        await page.locator('.welcome-controls [data-language-select]').selectOption('en');
        await page.waitForFunction(() => document.documentElement.lang === 'en');
        assert.equal(await page.locator('#welcomeAuthBlock h1').textContent(), 'Welcome!');
        await page.locator('#btnEmailSignIn').click();
        assert.equal(await page.locator('#emailAuthTitle').textContent(), 'Sign in');
        const card = await page.locator('.welcome-card').boundingBox();
        const back = await page.locator('#btnWelcomeAccount').boundingBox();
        assert.ok(back.x < card.x + 60 && back.y < card.y + 60);
        const brightness = await page.locator('.welcome-card').evaluate(element => Number(getComputedStyle(element).backgroundColor.match(/\d+/)[0]));
        assert.ok(brightness < 30);
        await page.locator('#btnWelcomeAccount').click();
        await page.locator('#btnGoogleSignIn').click();
        assert.match(await page.locator('#btnWelcomeNew').textContent(), /New project/);
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#welcomeProjectNameInput').fill('My project');
        await page.locator('#btnWelcomeConfirmNaming').click();
        await dismissOnboarding(page);
        await page.locator('#btnLogo').click();
        assert.match(await page.locator('#btnMenuPrint').textContent(), /Print/);
        assert.equal(await page.locator('#btnMenuCloudProjects').count(), 0);
        assert.equal(/[А-Яа-яЁё]/.test(await page.locator('body').innerText()), false);
        await page.reload();
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        await page.locator('#btnWelcomeContinue').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#welcomeAuthBlock h1').textContent(), 'Welcome!');
        assert.equal(await page.locator('.welcome-brand').textContent(), ['CCTV','EPS'].includes(process.env.TEST_PRODUCT)?process.env.TEST_PRODUCT:'I&HAS');
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'welcome-english.png') });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('personal email registration exposes user information and never queries cloud projects', async () => {
    const { context, page, errors } = await openApp();
    try {
        await fillRegistration(page);
        await page.locator('#btnEmailAuthSubmit').click();
        await page.locator('#userAccountModal').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#accountEmail').textContent(), 'firma@other-mail.test');
        assert.equal(await page.locator('#accountTypeLabel').textContent(), 'Osobní účet');
        const cloudButton = page.locator('#btnAccountCloudProjects');
        assert.equal(await cloudButton.isVisible(), true);
        assert.equal(await cloudButton.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(65, 69, 75)');
        await cloudButton.click();
        await page.locator('#projectUpgradeHint').waitFor({ state: 'visible' });
        await page.locator('#projectUpgradeAction').click();
        await page.locator('#proUpgradeModal').waitFor({ state: 'visible' });
        await page.locator('#btnProClose').click();
        assert.equal(await page.evaluate(() => window.hasCloudAccess()), false);
        assert.equal(await page.evaluate(() => window.testVerificationSent), 1);
        await page.locator('#btnAccountClose').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#btnWelcomeConfirmNaming').click();
        await page.locator('#onboardingBackdrop').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#onboardingStep').textContent(), 'Krok 1 z 16');
        assert.equal(await page.locator('#mainMenuModal').isVisible(),false);
        await page.mouse.click(12, 12);
        assert.ok(await page.locator('#onboardingBackdrop').isVisible());
        await page.locator('#onboardingDots button').nth(7).click();
        assert.match(await page.locator('#onboardingTitle').textContent(), /Stěny a detekce/);
        await page.locator('#mainMenuModal').waitFor({ state: 'hidden' });
        await dismissOnboarding(page);
        await page.evaluate(() => window.startGoomOnboarding());
        assert.equal(await page.locator('#onboardingBackdrop').isVisible(), false);
        await page.locator('#btnOpenCloudProjectsToolbar').click();
        await page.locator('#userAccountModal').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => window.testProjectReads || 0), 0);
        await page.evaluate(() => window.openCloudProjects());
        assert.equal(await page.locator('#cloudProjectsModal').isVisible(), false);
        assert.equal(await page.evaluate(() => window.testProjectReads || 0), 0);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('registration and email confirmation remain free until a trusted paid entitlement arrives', async () => {
    const { context, page, errors } = await openApp();
    try {
        await fillRegistration(page, { company: true, ico: '27082441' });
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'company-registration-czech.png') });
        await page.locator('#btnEmailAuthSubmit').click();
        assert.match(await page.locator('#emailAuthFeedback').textContent(), /platné osmimístné IČO/);
        assert.equal(await page.evaluate(() => window.getFirebaseUser()), null);
        await page.locator('#emailCompanyIco').fill('27082440');
        await page.locator('#btnEmailAuthSubmit').click();
        await page.locator('#userAccountModal').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#accountTypeLabel').textContent(), 'Firma');
        assert.equal(await page.locator('#btnAccountCloudProjects.cloud-upgrade').isVisible(), true);
        await page.evaluate(() => { window.testConfirmEmail = true; });
        await page.locator('#btnAccountRefresh').click();
        assert.equal(await page.evaluate(() => window.hasCloudAccess()), false);
        await page.locator('#btnUpdatePro').click();
        const price = (plan, period) => page.locator(`.pro-plan-${plan} [data-period="${period}"]`);
        assert.match(await price('standard', 'monthly').innerText(), /6,90\s€.*169\sKč/s);
        assert.match(await price('company', 'monthly').innerText(), /8,90\s€/);
        assert.equal(await price('standard', 'annual').isVisible(), false);
        await page.locator('input[name="proPeriod"][value="annual"]').check();
        assert.match(await price('standard', 'annual').innerText(), /72,86\s€.*1\s780\sKč/s);
        assert.match(await price('company', 'annual').innerText(), /93,98\s€/);
        assert.equal(await price('company', 'monthly').isVisible(), false);
        await page.locator('#btnProPurchase').click();
        await page.waitForFunction(() => window.testBillingCalls?.length > 0);
        assert.equal(await page.evaluate(() => window.testBillingCalls.at(-1).data.offer), 'annual');
        await page.locator('#btnCompanyProPurchase').click();
        await page.waitForFunction(() => window.testBillingCalls?.at(-1).data.offer === 'companyAnnual');
        assert.equal(await page.evaluate(() => window.hasProAccess()), false);
        await page.locator('#btnProClose').click();
        await page.evaluate(async () => {
            const db = firebase.firestore();
            await db.runTransaction(transaction => transaction.set(db.collection('cloudLicenses').doc('test-user'), {
                uid: 'test-user', plan: 'pro', status: 'active', paymentStatus: 'paid', source: 'stripe',
                billingMode: 'monthly', applicationExpiresAt: Object.fromEntries(['PZTS','EPS','CCTV','SK'].map(app => [app, { seconds: Math.floor(Date.now()/1000) + 86400 }])), billingCustomerId: 'cus_test', applications: ['PZTS', 'EPS', 'CCTV', 'SK'], licenseId: 'PZTS-PRO-TRUSTEDPAYMENT', keySuffix: 'DPAYMENT', expiresAt: null
            }));
        });
        await page.waitForFunction(() => window.hasProAccess());
        assert.equal(await page.getByRole('button', { name: 'Otevřít cloudové projekty' }).isVisible(), true);
        assert.equal(await page.locator('#accountCloudKey, #btnAccountCopyKey').count(), 0);
        assert.equal(await page.locator('#btnUpdatePro').isVisible(), true);
        assert.equal(await page.locator('#accountProBadge').isVisible(), true);
        const email = page.locator('#companySeatForm input').first();
        await email.fill('colleague@example.test');
        await page.locator('#btnSaveCompanySeats').click();
        await page.locator('#companySeatStatus').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#companySeatStatus').textContent(), 'Firemní přístupy byly uloženy.');
        await page.locator('#btnUpdatePro').click();
        assert.equal(await page.locator('#btnProPurchase').isVisible(), false);
        await page.locator('#btnProClose').click();
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'pro-account-czech.png') });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('email sign-in and password reset work independently of Google', async () => {
    const { context, page, errors } = await openApp();
    try {
        await page.locator('#btnEmailSignIn').click();
        await page.locator('#emailAuthEmail').fill('person@other-mail.test');
        await page.locator('#btnEmailResetPassword').click();
        assert.equal(await page.evaluate(() => window.testPasswordResetSent), true);
        await page.locator('#emailAuthPassword').fill('test-password-123');
        await page.evaluate(() => { window.testAuthError = 'auth/invalid-credential'; });
        await page.locator('#btnEmailAuthSubmit').click();
        assert.match(await page.locator('#emailAuthFeedback').textContent(), /Nesprávný e-mail nebo heslo/);
        await page.evaluate(() => { window.testAuthError = null; });
        await page.locator('#btnEmailAuthSubmit').click();
        await page.locator('#btnWelcomeNew').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => window.getFirebaseUser().email), 'person@other-mail.test');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('welcome composition stays fixed across steps and language lists use the shared control', async () => {
    const { context, page, errors } = await openApp();
    try {
        const brand = page.locator('.welcome-brand');
        const systemName = page.locator('.welcome-system-name');
        const footer = page.locator('.welcome-copyright');
        const initial = { brand: await brand.boundingBox(), footer: await footer.boundingBox() };
        assert.equal((await brand.textContent()).trim(), 'PZTS');
        assert.equal(await systemName.textContent(), 'Poplachový zabezpečovací a tísňový systém');
        assert.match(await footer.textContent(), /GooM[\s\S]*Special Edition/);
        const language = page.locator('.welcome-controls .ui-select-trigger');
        const card = await page.locator('.welcome-card').boundingBox();
        const languageBox = await language.boundingBox();
        assert.ok(Math.abs(languageBox.x + languageBox.width / 2 - card.x - card.width / 2) < 1);
        assert.ok(Math.abs(languageBox.y - card.y) < 1);
        assert.equal(await page.locator('.welcome-controls .ui-select').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(41, 43, 46)');
        assert.ok((await page.locator('#btnGoogleSignIn').boundingBox()).width <= 300);
        await language.click();
        const list = page.getByRole('listbox');
        const listBox = await list.boundingBox();
        assert.ok(Math.abs(listBox.x + listBox.width / 2 - card.x - card.width / 2) < 1);
        assert.equal(listBox.width, languageBox.width);
        assert.ok(Math.abs(listBox.y - languageBox.y) < 1);
        assert.equal(await list.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(41, 43, 46)');
        assert.equal(await list.getByRole('option', { selected: true }).evaluate(el => getComputedStyle(el).color), 'rgb(130, 211, 34)');
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'welcome-language-open.png') });
        await list.getByRole('option', { name: 'English', exact: true }).click();
        assert.equal(await list.count(), 0);
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        assert.equal(await systemName.textContent(), 'Intruder and hold-up alarm system');
        assert.equal(await brand.textContent(), 'I&HAS');
        for (const [option, acronym, name] of [
            ['Deutsch', 'GMA', 'Einbruch- und Überfallmeldeanlage'],
            ['Русский', 'СОТС', 'Система охранной и тревожной сигнализации']
        ]) {
            await language.click();
            await list.getByRole('option', { name: option, exact: true }).click();
            assert.equal(await systemName.textContent(), name);
            assert.equal(await brand.textContent(), acronym);
        }
        await language.press('Enter');
        await language.press('Home');
        await language.press('Enter');
        assert.equal(await page.locator('html').getAttribute('lang'), 'cs');
        assert.equal(await brand.textContent(), 'PZTS');
        assert.equal(await page.evaluate(() => APP_PRODUCT), 'PZTS');
        for (const next of ['#btnEmailSignIn', '#btnWelcomeAccount', '#btnGoogleSignIn', '#btnWelcomeNew']) {
            await page.locator(next).click();
            assert.deepEqual(await brand.boundingBox(), initial.brand);
            assert.deepEqual(await footer.boundingBox(), initial.footer);
            assert.equal(await systemName.isVisible(), true);
        }
        assert.equal(await page.locator('#btnWelcomeAccount').evaluate(el => getComputedStyle(el).borderRadius), '0px');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.locator('.welcome-blueprint path').first().evaluate(el => getComputedStyle(el).animationName), 'none');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('PROJECT gates the icon editor while the starter guide is available to everyone and tooltips clear', async () => {
    for (const paid of [false, true]) {
        const { context, page, errors } = await openApp({ company: paid });
        try {
            await page.locator('#btnGoogleSignIn').click();
            await page.locator('#btnWelcomeNew').click();
            await page.locator('#btnWelcomeConfirmNaming').click();
            await page.locator('#onboardingBackdrop').waitFor({ state: 'visible' });
            await dismissOnboarding(page);
            await chooseDetector(page);
        const canvas = await page.locator('#canvasContainer').boundingBox();
            await page.mouse.click(canvas.x + 200, canvas.y + 200);
            await page.mouse.move(canvas.x + 350, canvas.y + 260);
            await page.mouse.move(canvas.x + 200, canvas.y + 200);
            assert.equal(await page.locator('#deviceTooltip').evaluate(el => el.style.opacity), '1');
            await page.mouse.click(canvas.x + 200, canvas.y + 200);
            assert.equal(await page.locator('#deviceTooltip').evaluate(el => el.style.opacity), '0');
            assert.equal(await page.evaluate(() => window.hoveredDeviceId), null);
            const accountButton = page.locator('#btnOpenCloudProjectsToolbar');
            await accountButton.hover();
            await page.locator('.app-tooltip').waitFor({ state: 'visible' });
            await accountButton.click();
            await page.locator('.app-tooltip').waitFor({ state: 'hidden' });
            await accountButton.dispatchEvent('focusin');
            assert.equal(await page.locator('.app-tooltip').isVisible(), false);
            assert.equal(await page.locator('#btnAccountCloudProjects').isVisible(), true);
            assert.equal(await page.locator('#btnAccountCloudProjects.cloud-upgrade').count(), paid ? 0 : 1);
            assert.equal(await page.locator('#mainMenuModal [data-open-cloud-projects], #saveModal [data-save-cloud-project]').count(), 0);
            const accountLanguage = page.locator('.account-language-controls [data-language-select]');
            await accountLanguage.selectOption('en');
            assert.equal(await page.locator('#userAccountTitle').textContent(), 'User account');
            await page.locator('#btnAccountClose').click();
            assert.equal(await page.locator('#cloudSyncIndicator').textContent(), 'Local saving');
            const editor = page.locator('#btnOpenToolbarMenuEditor');
            await editor.hover();
            assert.equal(await page.locator('.app-tooltip').isVisible(), true);
            await editor.click();
            assert.equal(await page.locator('.app-tooltip').isVisible(), false);
            assert.equal(await page.locator('#projectUpgradeHint').isVisible(), !paid);
            assert.equal(await page.locator('#proUpgradeModal').isVisible(), false);
            if(!paid)await page.locator('#projectUpgradeAction').click();
            assert.equal(await page.locator('#proUpgradeModal').isVisible(), !paid);
            assert.equal(await page.locator('#iconEditorModal').isVisible(), paid);
            if (!paid && process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'pro-purchase-english.png') });
            assert.equal(await page.locator('.toolbar [data-language-select]').count(), 0);
            assert.deepEqual(errors, []);
        } finally { await context.close(); }
    }
});

test('tablet action bar rotates, duplicates, deletes and restores a selected detector', async () => {
    const { context, page, errors } = await openApp({ contextOptions: devices['iPad Mini'] });
    try {
        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#btnWelcomeConfirmNaming').click();
        await dismissOnboarding(page);
        await chooseDetector(page);
        const canvas = await page.locator('#canvasContainer').boundingBox();
        await page.touchscreen.tap(canvas.x + 220, canvas.y + 220);
        await page.touchscreen.tap(canvas.x + 220, canvas.y + 220);
        await page.locator('#tabletDeviceTools').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#tabletDeviceTools').evaluate(el => el.scrollWidth <= el.clientWidth), true);
        assert.equal(await page.locator('#tabletDeviceTools button svg').count(), 7);
        assert.ok((await page.locator('#tabletDeviceTools').boundingBox()).width <= 300);
        const fitDeviceTools = () => page.locator('#deviceSetTools').evaluate(el => el.scrollWidth <= el.clientWidth);
        assert.equal(await fitDeviceTools(), true);
        await page.setViewportSize({ width: 600, height: 960 });
        assert.equal(await fitDeviceTools(), true);
        await page.setViewportSize({ width: 768, height: 1024 });
        const action = name => page.locator(`[data-tablet-action="${name}"]`);
        assert.equal(await action('rotate').count(),0);
        await page.locator('[data-rotate-direction="1"]').tap();
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices[0].rotation), 15);
        await action('duplicate').tap();
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 2);
        await action('delete').tap();
        await page.locator('#appDialogAlternate').tap();
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 1);
        await action('undo').tap();
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 2);
        await action('pan').tap();
        await page.touchscreen.tap(canvas.x + 360, canvas.y + 300);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 2);
        assert.equal(await action('pan').getAttribute('aria-pressed'), 'true');
        await action('select').tap();
        const session = await context.newCDPSession(page);
        const pen = async (type, x, y, buttons) => session.send('Input.dispatchMouseEvent', {
            type, x, y, pointerType: 'pen', button: type === 'mouseMoved' ? 'none' : 'left', buttons
        });
        const position = await page.evaluate(() => ({ ...floors[currentFloorIndex].devices[0] }));
        await pen('mousePressed', canvas.x + position.x, canvas.y + position.y, 1);
        await pen('mouseMoved', canvas.x + position.x + 55, canvas.y + position.y + 40, 1);
        await pen('mouseReleased', canvas.x + position.x + 55, canvas.y + position.y + 40, 0);
        const moved = await page.evaluate(() => floors[currentFloorIndex].devices[0]);
        assert.ok(moved.x >= position.x + 40 && moved.y >= position.y + 25);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 2);
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'tablet-action-bar.png') });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

async function chooseDetector(page, type = 'pir') {
    await dismissOnboarding(page);
    if(type==='pir'){const product=await page.evaluate(()=>APP_PRODUCT);if(product==='CCTV')type='cctv_bullet';else if(product==='EPS')type='eps_smoke';else if(product==='SK')type='sk_outlet';}
    const button = page.locator('#deviceSelector [data-type="' + type + '"]');
    if (!await page.locator('.sliding-row-container').evaluate(el => el.classList.contains('open'))) await page.locator('#arrowTabBtn').click();
    await page.locator('.sliding-row-container').evaluate(async element=>{
        await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{})));
        await new Promise(requestAnimationFrame);
    });
    if(type==='cctv_bullet'&&await page.locator('#btnCameraPicker').count()){
        await page.locator('#btnCameraPicker').click();await page.locator('[data-camera-type=cctv_bullet]').click();await page.locator('#cameraPickerForm button[type=submit]').click();await page.locator('#cameraSettingsModal').waitFor({state:'hidden'});return;
    }
    await button.click();
}

test('building overview fits tablet orientations and opens floors with touch or keyboard', async () => {
    const { context, page, errors } = await openApp({ contextOptions: devices['iPad Mini'] });
    try {
        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#btnWelcomeConfirmNaming').click();
        await dismissOnboarding(page);
        const labels = ['6NP','5NP','4NP','3NP','2NP','1NP','1PP','2PP','3PP'];
        for (const viewport of [{width:600,height:960},{width:1024,height:600},{width:1280,height:800}]) {
            await page.setViewportSize(viewport);
            await page.locator('#btnOverview').tap();
            await page.locator('.overview-floor').first().waitFor();
            assert.deepEqual(await page.locator('.overview-floor-label').allTextContents(), labels);
            const container = await page.locator('#overviewCanvasContainer').boundingBox();
            const details = await page.locator('#overviewFloorDetails').boundingBox();
            const active = await page.locator('.overview-floor[aria-current="true"]').boundingBox();
            assert.ok(details.x + details.width <= active.x);
            assert.ok(Math.abs(details.y + details.height / 2 - (active.y + active.height / 2)) < 2, JSON.stringify({ viewport, details, active, selection: await page.locator('#overviewDetailFloor').textContent() }));
            for (const label of labels) {
                const bounds = await page.locator(`[data-overview-floor="${label}"]`).boundingBox();
                assert.ok(bounds.height >= 44);
                assert.ok(bounds.x >= container.x && bounds.x + bounds.width <= container.x + container.width + 1);
                assert.ok(bounds.y >= container.y && bounds.y + bounds.height <= container.y + container.height + 1);
            }
            assert.equal(await page.locator('.overview-footer button').count(),1);
            const back = await page.locator('#btnCloseOverviewScreen').boundingBox();
            assert.ok(Math.abs(back.x + back.width / 2 - viewport.width / 2) < 2);
            const footer = await page.locator('.overview-footer').boundingBox();
            assert.equal(Math.round(footer.height), 24);
            assert.equal(await page.locator('#btnCloseOverviewScreen').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
            const pixels = await page.locator('#overviewCanvas').evaluate(canvas => {
                const ratio = canvas.width / canvas.getBoundingClientRect().width;
                const context = canvas.getContext('2d');
                const pixel = (x,y) => [...context.getImageData(Math.round(x * ratio),Math.round(y * ratio),1,1).data].slice(0,3);
                return { background: pixel(20,20), dot: pixel(14,14) };
            });
            assert.deepEqual(pixels.background,[37,37,41]);
            assert.deepEqual(pixels.dot,[17,17,21]);
            if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, `overview-${viewport.width}.png`) });
            await page.locator('[data-overview-floor="1PP"]').tap();
            await page.waitForFunction(() => !isOverviewMode && floors[currentFloorIndex].name === '1PP');
        }
        await page.locator('#btnOverview').click();
        await page.locator('[data-overview-floor="3NP"]').focus();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => !isOverviewMode && floors[currentFloorIndex].name === '2NP');
        await page.locator('#btnOverview').click();
        await page.locator('#btnCloseOverviewScreen').click();
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].name),'2NP');
        await page.locator('#btnOverview').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => isOverviewMode),false);
        assert.deepEqual(errors,[]);
    } finally { await context.close(); }
});

test('startup leaves placement inactive and detector addresses include the selected bus with a bold address', async () => {
    const { context, page, errors } = await openApp();
    try {
        await page.locator('#btnGoogleSignIn').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#btnWelcomeConfirmNaming').click();
        await dismissOnboarding(page);
        const canvas = await page.locator('#canvasContainer').boundingBox();
        assert.equal(await page.evaluate(() => selectedTool), 'select');
        assert.equal(await page.locator('#deviceSelector .device-btn.active').count(), 0);
        await page.mouse.click(canvas.x + 200, canvas.y + 250);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices.length), 0);
        await chooseDetector(page);
        assert.ok((await page.locator('.sliding-row-container').boundingBox()).height <= 48);
        await page.mouse.click(canvas.x + 200, canvas.y + 250);
        await page.locator('#loopSelect').selectOption('2');
        for (const x of [400, 600, 800]) await page.mouse.click(canvas.x + x, canvas.y + 250);
        const labels = await page.evaluate(() => floors[currentFloorIndex].devices.map(device => { const p = getDeviceAddressParts(device); return p.prefix + p.number; }));
        assert.deepEqual(labels, ['1/1','2/1','2/2','2/3']);
        const drawn = await page.evaluate(() => {
            const calls = [], original = ctx.fillText;
            ctx.fillText = function(text, ...args) { calls.push({ text, font: this.font }); return original.call(this, text, ...args); };
            try { drawDevice(ctx, floors[currentFloorIndex].devices[1]); } finally { ctx.fillText = original; }
            return calls;
        });
        assert.ok(drawn.some(call => call.text === '2/' && !call.font.includes('bold')));
        assert.ok(drawn.some(call => call.text === '1' && call.font.includes('bold')));
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'bus-two-addresses.png') });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('account and subscription dialogs use compact columns and abbreviated language control', async () => {
    const { context, page, errors } = await openApp({ initialSession: true });
    try {
        const language = page.locator('.welcome-controls .ui-select-trigger');
        assert.equal(await language.innerText(), 'Cz');
        await language.hover();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.welcome-controls .ui-select-trigger')).color === 'rgb(195, 246, 101)');
        assert.equal(await language.evaluate(el => getComputedStyle(el).color), 'rgb(195, 246, 101)');
        assert.equal(await language.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        await page.locator('#btnWelcomeProfile').click();
        const left = await page.locator('.account-personal').boundingBox(), right = await page.locator('.account-subscription').boundingBox();
        assert.equal(Math.round(left.y), Math.round(right.y)); assert.ok(right.x > left.x + left.width);
        const card = page.locator('#userAccountModal .account-card');
        const close = page.getByRole('button', { name: 'Zavřít' }).and(page.locator('#btnAccountClose'));
        assert.equal(await close.innerText(), '×');
        const cardBounds = await card.boundingBox();
        const closeBounds = await close.boundingBox();
        assert.ok(closeBounds.x < cardBounds.x + cardBounds.width / 4);
        assert.ok(closeBounds.y < cardBounds.y + cardBounds.height / 4);
        assert.equal(await card.evaluate(el => el.scrollHeight <= el.clientHeight + 1), true);
        assert.equal(await card.evaluate(el => getComputedStyle(el).scrollbarColor), 'rgb(115, 117, 121) rgb(16, 17, 18)');
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'compact-account-czech.png') });
        await page.locator('#btnUpdatePro').click();
        const price = page.locator('.pro-plan-standard [data-period="monthly"]');
        assert.match(await price.innerText(), /6,90\s€/);
        const headings = await page.locator('.pro-plan-header').all();
        const positions = await Promise.all(headings.map(heading => heading.boundingBox()));
        assert.equal(positions.length, 3);
        assert.ok((await price.boundingBox()).y >= positions[1].y + positions[1].height);
        assert.ok(positions.every(position => position.y === positions[0].y));
        assert.ok(positions[1].x > positions[0].x + positions[0].width);
        assert.ok(positions[2].x > positions[1].x + positions[1].width);
        const colors = await page.locator('.pro-plan-header').evaluateAll(headers => headers.map(header => getComputedStyle(header).backgroundColor));
        assert.deepEqual(colors, ['rgb(220, 224, 229)', 'rgb(246, 213, 138)', 'rgb(190, 231, 246)']);
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'compact-subscriptions-czech.png') });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('an open account retains suite access until the final paid program period expires', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, company: true });
    try {
        await page.locator('#btnWelcomeProfile').click();
        await page.waitForFunction(() => window.hasProAccess());
        await page.evaluate(async () => {
            const db = firebase.firestore(), reference = db.collection('cloudLicenses').doc('test-user');
            const value = (await reference.get()).data();
            value.applications = ['PZTS','EPS'];
            value.applicationExpiresAt = { PZTS: { seconds: (Date.now() + 200) / 1000 }, EPS: { seconds: (Date.now()+900)/1000 } };
            await db.runTransaction(transaction => transaction.set(reference, value));
        });
        await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.hasProAccess()),true);
        await page.waitForFunction(() => !window.hasProAccess() && document.getElementById('accountProBadge').hidden);
        assert.equal(await page.locator('#btnAccountCloudProjects.cloud-upgrade').isVisible(), true);
        await page.locator('#btnManageSubscription').click();
        await page.waitForFunction(() => window.testBillingCalls?.some(call => call.name === 'createProPortal'));
        assert.equal(await page.locator('#btnManageSubscription').isDisabled(), false);
        assert.equal(await page.evaluate(() => window.hasCloudAccess()), false);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('German and Russian localize the account, pricing and detector search and persist on reload', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, company: true,
        contextOptions: { viewport: { width: 768, height: 900 }, hasTouch: true } });
    try {
        await page.locator('#btnWelcomeProfile').click();
        await page.locator('.account-language-controls .ui-select-trigger').click();
        await page.getByRole('option', { name: 'Deutsch', exact: true }).click();
        assert.equal(await page.locator('#userAccountTitle').textContent(), 'Benutzerkonto');
        await page.locator('#btnUpdatePro').click();
        assert.equal(await page.locator('#proUpgradeTitle').textContent(), 'Tarife und Abos');
        assert.match(await page.locator('.pro-period').innerText(), /−12 %/);
        const features = tier => page.locator(`.pro-plan-${tier} .pro-plan-features`);
        assert.match(await features('standard').innerText(), /bis zu 5 Projekte je Editor/);
        assert.doesNotMatch(await features('basic').innerText(), /Cloud/);
        assert.match(await features('basic').innerText(), /Einführung ins erste Projekt/);
        assert.match(await features('company').innerText(), /Alles aus Pro/);
        const card = page.locator('.pro-pricing');
        assert.ok(await card.evaluate(el => el.scrollWidth <= el.clientWidth));
        const headerHeights = await page.locator('.pro-plan-header').evaluateAll(headers => headers.map(header => header.offsetHeight));
        assert.ok(headerHeights.every(height => height === headerHeights[0]));
        assert.equal(await page.locator('#btnProClose').getAttribute('aria-label'), 'Schließen');
        assert.ok(await page.locator('.pro-plan-basic button').isDisabled());
        assert.equal(await page.locator('.pro-plan-basic button').textContent(), 'Free');
        assert.equal(await page.locator('.pro-price-option').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert.equal(await page.locator('.pro-period b').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(217, 244, 187)');
        assert.equal(await page.locator('.pro-plan-standard').evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'pzts-pro-pricing-de.png') });
        await page.locator('#btnProClose').click();
        await page.locator('.account-language-controls .ui-select-trigger').click();
        await page.getByRole('option', { name: 'Русский', exact: true }).click();
        assert.equal(await page.locator('#userAccountTitle').textContent(), 'Аккаунт');
        await page.locator('#btnUpdatePro').click();
        assert.equal(await page.locator('#proUpgradeTitle').textContent(), 'Тарифы и подписки');
        assert.equal(await page.locator('#proStandardTitle').textContent(), 'Pro');
        assert.equal(await page.locator('.pro-plan-basic button').textContent(), 'Free');
        assert.deepEqual(await page.locator('.pro-price-separator').allTextContents(), ['/', '/', '/', '/']);
        assert.match(await features('standard').innerText(), /без водяного знака/);
        await page.setViewportSize({ width: 600, height: 900 });
        assert.ok(await card.evaluate(el => el.scrollWidth <= el.clientWidth));
        await page.setViewportSize({ width: 768, height: 900 });
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'pzts-pro-pricing-ru.png') });
        await page.reload();
        await page.waitForFunction(() => window.hasProAccess?.());
        assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
        await startRenderProject(page);
        await page.locator('#btnLogo').click();
        assert.match(await page.locator('link[rel="icon"]').getAttribute('href'), /Logosite\.png/);
        assert.ok(await page.locator('#mainMenuModal .main-menu-brand-logo').evaluate(el => el.complete && el.naturalWidth > 0));
        await page.keyboard.press('Escape');
        await page.locator('#btnDetectorSearch').click();
        assert.equal(await page.locator('#detectorSearchTitle').textContent(), 'Найти датчик');
        assert.equal(await page.locator('#btnDetectorSearch').getAttribute('aria-label'), 'Найти датчик');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

async function smoothScreenshot(page, options) {
    await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        await Promise.all(document.getAnimations().filter(animation => animation.effect.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    await page.screenshot(options);
}

test('modal decoration stays on the left and rapid account transitions do not leave an overlay stuck', async () => {
    const { context, page, errors } = await openApp({ initialSession: true });
    try {
        const card = page.locator('.welcome-card');
        const accent = await card.evaluate(el => getComputedStyle(el,'::before').backgroundColor);
        assert.equal(accent,'rgb(130, 211, 34)');
        assert.equal(await page.locator('#welcomeModal').evaluate(el => getComputedStyle(el).backgroundColor),'rgba(35, 37, 41, 0.64)');
        const artwork = await page.locator('#welcomeModal .modal-blueprint').boundingBox();
        const bounds = await card.boundingBox();
        assert.ok(artwork.x + artwork.width <= bounds.x + bounds.width * .53);
        assert.equal(await page.locator('#welcomeModal .blueprint-circle').count(),1);
        await page.locator('#btnWelcomeProfile').click();
        await page.locator('#userAccountModal').waitFor({state:'visible'});
        await page.evaluate(() => {
            const account = document.querySelector('#userAccountModal .account-card');
            window.attachModalBlueprint(account); window.attachModalBlueprint(account);
            document.getElementById('btnAccountClose').click();
            return window.openAccountPanel();
        });
        await page.waitForFunction(() => document.getElementById('userAccountModal').dataset.modalOpen === 'true');
        assert.equal(await page.locator('#userAccountModal .modal-blueprint-host').count(),1);
        await page.locator('#accountDisplayName').fill('Smooth account');
        assert.equal(await page.locator('#accountDisplayName').inputValue(),'Smooth account');
        await page.locator('#btnAccountClose').click();
        await page.locator('#userAccountModal').waitFor({state:'hidden'});
        await page.locator('#btnWelcomeProfile').click();
        await page.locator('#userAccountModal').waitFor({state:'visible'});
        await page.emulateMedia({ reducedMotion:'reduce' });
        assert.equal(await page.locator('#userAccountModal .blueprint-circle').first().evaluate(el => getComputedStyle(el).animationName),'none');
        assert.deepEqual(errors,[]);
    } finally { await context.close(); }
});

test('spotlight tour can jump to every step and preserves the project and open dialogs',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true});
    try{
        await startRenderProject(page);await page.evaluate(()=>setGoomLanguage('ru'));
        const original=await page.evaluate(()=>JSON.stringify(getProjectDataPayload()));
        await page.locator('#helpBtn').click();assert.equal(await page.locator('#btnOpenManual').count(),0);assert.equal(await page.locator('#helpPanel .help-shortcuts .help-item').count(),4);
        await page.locator('#btnStartGuide').click();await page.locator('#onboardingBackdrop').waitFor({state:'visible'});
        const dots=page.locator('#onboardingDots button');assert.equal(await dots.count(),16);
        for(let i=0;i<16;i++){await dots.nth(i).click();await page.waitForFunction(()=>document.getElementById('onboardingBackdrop').dataset.targetVisible==='true');const alignment=await page.evaluate(()=>{const panel=document.getElementById('onboardingBackdrop'),target=document.querySelector(panel.dataset.target),r=target.getBoundingClientRect(),hole=document.getElementById('tourHole');const m=hole.getScreenCTM(),p=new DOMPoint(Number(hole.getAttribute('cx')),Number(hole.getAttribute('cy'))).matrixTransform(m);return{dx:Math.abs(p.x-(r.x+r.width/2)),dy:Math.abs(p.y-(r.y+r.height/2)),radius:Number(hole.getAttribute('r'))*Math.hypot(m.a,m.b),needed:Math.hypot(r.width,r.height)/2};});assert.ok(alignment.dx<2&&alignment.dy<2&&alignment.radius>=alignment.needed,JSON.stringify(alignment));assert.match(await page.locator('#onboardingStep').textContent(),new RegExp(`Шаг ${i+1} из 16`));assert.equal(await dots.nth(i).getAttribute('aria-current'),'step');}
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'spotlight-save.png')});
        await page.keyboard.press('Escape');await page.locator('#onboardingBackdrop').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>JSON.stringify(getProjectDataPayload())),original);
        await page.locator('#btnLogo').click();await page.locator('#btnMenuSave').click();await page.locator('#saveModal').waitFor({state:'visible'});
        await page.evaluate(()=>startGoomOnboarding({force:true}));await page.locator('#onboardingSkip').click();await page.locator('#saveModal').waitFor({state:'visible'});
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('account initials and practice aggregate all applications and update live',async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true});
    try{await page.evaluate(async()=>{await firebase.firestore().collection('goomEditorUsage').doc('test-user').set({activeSeconds:19800,applications:{PZTS:7200,CCTV:12600}});});await page.locator('#btnWelcomeProfile').click();await page.locator('#userAccountModal').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('accountPracticeTime').textContent.includes('5 h 30'));
        assert.equal(await page.locator('#accountInitials').textContent(),'TU');assert.match(await page.locator('#accountPracticeCaption').textContent(),/Úroveň 3/);assert.equal(await page.locator('#accountPracticeProgress').getAttribute('aria-valuenow'),'5');
        await page.evaluate(async()=>firebase.firestore().collection('goomEditorUsage').doc('test-user').set({activeSeconds:21600,applications:{PZTS:7200,CCTV:14400}}));await page.waitForFunction(()=>document.getElementById('accountPracticeTime').textContent.includes('6 h 0'));assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('spotlight guidance fits tablet orientations and new welcome artwork keeps its product tint',async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true,contextOptions:{viewport:{width:768,height:1024},hasTouch:true,isMobile:true}});
    try{assert.equal(await page.locator('#welcomeModal .welcome-card').evaluate(el=>getComputedStyle(el,'::before').display),'none');assert.match(await page.locator('link[rel=icon]').getAttribute('href'),/Logosite/);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,`welcome-tint-${process.env.TEST_PRODUCT||'PZTS'}.png`)});
        assert.equal(await page.locator('#btnWelcomeGuide').count(),0);await startRenderProject(page);await page.locator('#helpBtn').click();await page.locator('#btnStartGuide').click();assert.ok(await page.locator('#onboardingBackdrop').isVisible());
        for(const viewport of [{width:768,height:1024},{width:1024,height:600},{width:600,height:960}]){await page.setViewportSize(viewport);for(const index of [0,3,9,11,15]){await page.locator('#onboardingDots button').nth(index).click();await page.waitForTimeout(280);const dock=await page.locator('.tour-dock').boundingBox();assert.ok(dock.x>=0&&dock.y>=0&&dock.x+dock.width<=viewport.width+1&&dock.y+dock.height<=viewport.height+1,JSON.stringify({viewport,dock}));assert.equal(await page.locator('.tour-dock').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);}}
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'tour-tablet-portrait.png')});await page.locator('#onboardingSkip').click();assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('ten minute idle lock intercepts accidental edits and resumes only explicitly',async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true,clock:true});
    try{await startRenderProject(page);await page.evaluate(()=>{window.testAccidentalClicks=0;document.getElementById('blueprintCanvas').addEventListener('click',()=>window.testAccidentalClicks++);});const original=await page.evaluate(()=>JSON.stringify(getProjectDataPayload()));
        await page.clock.fastForward(601000);await page.locator('#idleBreakOverlay').waitFor({state:'visible'});await page.mouse.click(40,160);await page.keyboard.press('f');assert.equal(await page.evaluate(()=>testAccidentalClicks),0);assert.equal(await page.evaluate(()=>JSON.stringify(getProjectDataPayload())),original);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'idle-break.png')});
        await page.locator('#btnResumeEditor').click();await page.locator('#idleBreakOverlay').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.goomIdleLocked),false);await page.locator('#btnLogo').click();await page.locator('#mainMenuModal').waitFor({state:'visible'});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('project completion requires real routes labels and legend coverage',async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true});
    try{await startRenderProject(page);const result=await page.evaluate(()=>{
        const main=APP_PRODUCT==='CCTV'?'cctv_nvr':'panel',sensor=APP_PRODUCT==='CCTV'?'cctv_bullet':'pir';const f={name:'1NP',imgData:'test',devices:[{id:'m',type:main,manualName:'Main'},{id:'s',type:sensor,manualName:'Hall'}],cables:[{fromId:'m',toId:'s'}],legend:{visible:true,entries:[{type:main},{type:sensor}]}};
        const complete=evaluateProjectReadiness({name:'Office',floors:[f]});const missing=evaluateProjectReadiness({name:'Office',floors:[{...f,cables:[{fromId:'m',toId:'deleted'}],legend:{...f.legend,visible:false}}]});const empty=evaluateProjectReadiness({name:'',floors:[]});return{complete,missing,empty};
    });assert.equal(result.complete.score,100);assert.equal(result.complete.grade,2);assert.equal(result.missing.checks.find(c=>c.id==='cables').complete,false);assert.equal(result.missing.checks.find(c=>c.id==='legend').complete,false);assert.notEqual(result.missing.grade,2);assert.equal(result.empty.score,0);
        await page.locator('#btnLogo').click();await page.locator('#btnMenuSave').click();await page.locator('#projectReadiness .readiness-steps li').first().waitFor({state:'visible'});assert.equal(await page.locator('#projectReadiness .readiness-steps li').count(),7);assert.equal(await page.locator('#projectReadiness .readiness-title').count(),0);assert.equal(await page.locator('.readiness-steps li').first().textContent(),'');assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('new project metrics count confirmation but never import reopening or tutorial',async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true});
    try{
        await page.locator('#btnWelcomeContinue').click();await page.locator('#btnWelcomeNew').click();await page.locator('#btnWelcomeConfirmNaming').click();await dismissOnboarding(page);
        await page.waitForFunction(()=>window.testProjectStarts?.length===1);const first=await page.evaluate(()=>testProjectStarts[0]);assert.match(first.operationId,/^[a-z0-9-]{36}$/);assert.equal(first.application,process.env.TEST_PRODUCT||'PZTS');
        await page.evaluate(()=>startGoomOnboarding({force:true}));await dismissOnboarding(page);assert.equal(await page.evaluate(()=>testProjectStarts.length),1);
        const payload=await page.evaluate(()=>JSON.stringify(getProjectDataPayload()));await page.locator('#bipsLoader').setInputFiles({name:'Reopen.TECH',mimeType:'application/json',buffer:Buffer.from(payload)});await page.waitForFunction(()=>isSystemReady);await dismissOnboarding(page);assert.equal(await page.evaluate(()=>testProjectStarts.length),1);
        await page.reload();await page.waitForFunction(()=>typeof recordGoomProjectCreated==='function'&&!!db);assert.equal(await page.evaluate(()=>window.testProjectStarts?.length||0),0);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('overhead imagery saves straight building vectors and preserves them through reopening and SVG',async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true,satelliteFixtures:true,buildingFixtures:true});
    try{await startRenderProject(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);
        const map=await page.locator('#satelliteCanvas').boundingBox(),send=await page.locator('#satelliteMapAdd').boundingBox(),locate=await page.locator('#satelliteLocate').boundingBox(),search=await page.locator('#satelliteSearchInput').boundingBox();assert.ok(send.x>map.x+map.width*.75&&send.y>map.y+map.height*.7);assert.ok(locate.x>search.x+search.width);assert.equal(await page.locator('[data-map-layer],.satellite-map-attribution summary').count(),0);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'wide-overhead-map.png')});
        await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>!!floors[currentFloorIndex].satellite?.buildingOutlines,null,{timeout:20000});const result=await page.evaluate(async()=>{const floor=floors[currentFloorIndex],restored=(await loadFloorsImages(getProjectDataPayload().floors))[currentFloorIndex];const vector=new SVGPlanContext(1684,1191);drawMapLinework(vector,restored.image,restored.satellite);return{rings:restored.satellite.buildingOutlines.rings,original:floor.satellite.buildingOutlines.rings,svg:vector.toSVG(),provider:restored.satellite.provider};});assert.deepEqual(result.rings,result.original);assert.equal(result.rings.length,1);assert.match(result.svg,/#737b82/);assert.match(result.svg,/Z/);assert.doesNotMatch(result.svg,/<image/);assert.match(result.provider,/ČÚZK/);
        await page.evaluate(()=>{floors[currentFloorIndex].planTheme='light';requestRedraw();});if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'straight-building-plan.png')});assert.equal(await page.locator('#planSourceInfo').evaluate(el=>el.tagName),'A');assert.notEqual(await page.locator('#planSourceInfo').textContent(),'i');assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('free guide highlights real toolbar controls and compact help and readiness keep their layout',async()=>{
    const{context,page,errors}=await openApp({initialSession:true});
    try{await startRenderProject(page);await page.locator('#helpBtn').click();const play=await page.locator('#btnStartGuide').boundingBox(),shortcuts=await page.locator('.help-shortcuts').boundingBox();assert.ok(play.y+play.height<=shortcuts.y+1);assert.equal(await page.locator('#btnOpenManual').count(),0);
        await page.locator('#btnStartGuide').click();const steps=await page.evaluate(()=>goomGuideSteps.map(s=>s[0]));assert.ok(steps.includes('#btnDetectorSearch'));assert.ok(!steps.some(s=>['#deviceSelector','#deviceSetTools','#textTools','#canvasContainer'].includes(s)));
        await page.locator('#onboardingDots button').nth(9).click();await page.waitForFunction(()=>document.getElementById('onboardingBackdrop').dataset.target==='#btnDetectorSearch'&&document.getElementById('onboardingBackdrop').dataset.targetVisible==='true');assert.equal(await page.locator('#btnDetectorSearch').isVisible(),true);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'tour-search.png')});await dismissOnboarding(page);
        await page.locator('#btnLogo').click();await page.locator('#btnMenuSave').click();await page.locator('#projectReadiness').waitFor();const copy=await page.locator('#saveModal').innerText();assert.doesNotMatch(copy,/SVG zachová|DXF: editovatelné|Kontrola vyplnění/);assert.equal(await page.locator('.readiness-dot').first().textContent(),'');assert.ok((await page.locator('.readiness-dot').first().boundingBox()).width<=10);assert.ok((await page.locator('#projectReadiness').boundingBox()).height<90);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'compact-readiness.png')});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('confirmation close buttons show no white focus frame',async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true});
    try{await startRenderProject(page);await page.evaluate(()=>{void showAppConfirm('Remove selected devices?');});await page.locator('#appDialog').waitFor({state:'visible'});const close=page.locator('#appDialog .goom-dialog-close');await close.focus();const style=await close.evaluate(el=>({outline:getComputedStyle(el).outlineStyle,shadow:getComputedStyle(el).boxShadow}));assert.equal(style.outline,'none');assert.equal(style.shadow,'none');if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'dialog-no-focus-frame.png')});await page.keyboard.press('Escape');await page.locator('#appDialog').waitFor({state:'hidden'});assert.deepEqual(errors,[]);}finally{await context.close();}
});

async function startRenderProject(page) {
    await page.evaluate(() => {
        document.getElementById('welcomeModal').style.display='none';
        loadDefaultFloors(false,'Render QA');resizePlanCanvas();
    });
    await page.locator('#welcomeModal').waitFor({state:'hidden'});
}

test('EPS has an independent fire catalog, vector exports, native round trip and rejects other applications',{skip:process.env.TEST_PRODUCT!=='EPS'},async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true});
    try{
        await page.evaluate(()=>window.epsAssetsReady);
        assert.equal(await page.locator('.welcome-brand').innerText(),'EPS');
        assert.equal(await page.locator('#deviceSetTools [data-type^="eps_"]').count(),30);
        assert.equal(await page.locator('#deviceSetTools [data-type="pir"]').count(),0);
        assert.equal(await page.locator('#togglePirCoverage').isVisible(),false);
        await startRenderProject(page);
        const result=await page.evaluate(async()=>{
            const floor=floors[currentFloorIndex];floor.devices=EPS_CATALOG.map((d,i)=>({id:`fire-${i}`,type:d.type,x:120+(i%8)*100,y:120+Math.floor(i/8)*100,number:i+1,loopId:1,rotation:0,manualName:d.code,isMainPanel:i===0}));
            floor.cables=floor.devices.slice(1).map((d,i)=>{const cable={id:`wire-${i}`,fromId:'fire-0',toId:d.id};recalcCableHandles(cable,floor.devices[0],d);return cable;});
            floor.legend={visible:true,x:1050,y:120,scale:1,entries:EPS_CATALOG.map(d=>({type:d.type,label:d.labels[0],shapes:[]}))};
            const svg=new SVGPlanContext(1500,900),dxf=new DXFPlanContext(1500,900);for(const d of floor.devices){drawDevice(svg,d,true,'light');drawDevice(dxf,d,true,'light');}
            const payload=getProjectDataPayload(),restored=await loadFloorsImages(payload.floors);await saveToDB({skipCloudSync:true});
            const state={product:APP_PRODUCT,database:db.name,key:productStorageKey('test'),types:restored[currentFloorIndex].devices.map(d=>d.type),assets:epsSymbolAssets.size,svg:svg.toSVG(),dxf:dxf.toDXF(),checks:evaluateProjectReadiness({name:'Fire test',floors}).checks,tag:payload.application};
            state.fullSvg=(await makePlanOutput(floor,{paper:'a4',orientation:'auto',dpi:96,theme:'light',coverage:false},true)).svg;state.fullDxf=makePlanDXF(floor,{paper:'a4',orientation:'auto',dpi:96,theme:'light',coverage:false}).dxf;
            state.roundtrip=await importFileContent(new File([JSON.stringify(payload)],'fire.TECH',{type:'application/json'}));
            setTimeout(()=>document.querySelector('#appDialog .goom-dialog-close')?.click(),200);
            state.wrong=await importFileContent(new File([JSON.stringify({...payload,application:'PZTS'})],'intrusion.TECH',{type:'application/json'}));return state;
        });
        assert.equal(result.product,'EPS');assert.equal(result.database,'GooM_EPS_V1');assert.equal(result.key,'test:EPS');assert.equal(result.tag,'EPS');assert.equal(result.assets,31);assert.equal(new Set(result.types).size,31);assert.equal(result.roundtrip,true);assert.equal(result.wrong,false);assert.ok(result.checks.find(c=>c.id==='devices').complete);assert.ok(result.checks.find(c=>c.id==='cables').complete);assert.match(result.svg,/EPS/);assert.match(result.svg,/ASD/);assert.match(result.svg,/ST/);assert.doesNotMatch(result.svg,/NaN|Infinity|<image/);assert.doesNotMatch(result.fullSvg,/NaN|Infinity/);assert.doesNotMatch(result.fullDxf,/NaN|Infinity/);assert.match(result.fullSvg,/EPS/);assert.match(result.dxf,/ENTITIES/);assert.match(result.dxf,/EPS/);assert.doesNotMatch(result.dxf,/NaN|Infinity/);
        await dismissOnboarding(page);if(await page.locator('#appDialog').isVisible())await page.locator('#appDialogConfirm').click();await page.locator('#btnLogo').click();await page.locator('#btnMenuSave').click();await page.locator('#saveModal').waitFor({state:'visible'});assert.equal(await page.locator('#projectReadiness [data-check="devices"]').getAttribute('class'),'complete');
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'.qa-eps-editor.png')});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('SK uses networking labels in four languages and requires its own PROJECT grant',{skip:process.env.TEST_PRODUCT!=='SK'},async()=>{
    const{context,page,errors}=await openApp({initialSession:true});try{
        for(const[locale,name,search]of [['cs','Strukturovaná kabeláž a internet','Najít síťový bod'],['en','Structured cabling and internet','Find network point'],['de','Strukturierte Verkabelung und Internet','Netzwerkpunkt suchen'],['ru','Структурированные кабельные сети и интернет','Найти сетевую точку']]){await page.selectOption('[data-language-select]',locale);assert.equal(await page.locator('.welcome-brand').innerText(),'SK');assert.equal(await page.locator('.welcome-system-name').innerText(),name);assert.equal(await page.locator('#btnDetectorSearch').getAttribute('aria-label'),search);assert.ok(await page.locator('#deviceSetTools [data-type=sk_router]').getAttribute('aria-label'));}
        await page.evaluate(()=>firebase.firestore().collection('goomProgramGrants').doc('test-user').set({uid:'test-user',expiresAt:{EPS:{seconds:Date.now()/1000+600}}}));assert.equal(await page.evaluate(()=>hasProAccess()),false);
        await page.evaluate(()=>firebase.firestore().collection('goomProgramGrants').doc('test-user').set({uid:'test-user',expiresAt:{SK:{seconds:Date.now()/1000+600}}}));await page.waitForFunction(()=>hasProAccess());
        assert.equal(await page.evaluate(()=>goomGuideSteps.length),14);await page.selectOption('[data-language-select]','cs');
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'.qa-sk-welcome.png')});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});
test('EPS replacement assets remain visible in the drawing and vector exports',{skip:process.env.TEST_PRODUCT!=='EPS'},async()=>{
    const{context,page,errors}=await openApp({initialSession:true,epsSymbolOverride:true});try{
        const result=await page.evaluate(async()=>{await epsAssetsReady;const svg=new SVGPlanContext(80,80),dxf=new DXFPlanContext(80,80);drawDevice(svg,{type:'eps_smoke',x:40,y:40},true,'light');drawDevice(dxf,{type:'eps_smoke',x:40,y:40},true,'light');return{svg:svg.toSVG(),dxf:dxf.toDXF()};});assert.match(result.svg,/FIRE/);assert.match(result.dxf,/FIRE/);assert.doesNotMatch(result.svg,/<image|NaN/);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});
test('EPS labels, billing scope and guide stay specific to fire alarms in four languages',{skip:process.env.TEST_PRODUCT!=='EPS'},async()=>{
    const{context,page,errors}=await openApp({initialSession:true});try{
        for(const[locale,expected]of [['cs','Elektrická požární signalizace'],['en','Fire detection and alarm system'],['de','Brandmeldeanlage'],['ru','Пожарная сигнализация']]){await page.selectOption('[data-language-select]',locale);assert.equal(await page.locator('.welcome-system-name').innerText(),expected);assert.equal(await page.locator('.welcome-brand').innerText(),'EPS');assert.ok(await page.locator('#deviceSetTools [data-type="eps_smoke"]').getAttribute('aria-label'));}
        const guide=await page.evaluate(()=>goomGuideSteps.map(s=>s[0]));assert.equal(guide.length,14);assert.ok(guide.includes('#btnDetectorSearch'));assert.ok(!guide.includes('#togglePirCoverage'));
        await page.evaluate(()=>firebase.firestore().collection('goomProgramGrants').doc('test-user').set({uid:'test-user',expiresAt:{PZTS:{seconds:Date.now()/1000+600}}}));assert.equal(await page.evaluate(()=>hasProAccess()),false);
        await page.evaluate(()=>firebase.firestore().collection('goomProgramGrants').doc('test-user').set({uid:'test-user',expiresAt:{EPS:{seconds:Date.now()/1000+600}}}));await page.waitForFunction(()=>hasProAccess());
        if(process.env.TEST_SCREENSHOT_DIR){await page.selectOption('[data-language-select]','cs');await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'.qa-eps-welcome.png')});}assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('PZTS and CCTV on one domain keep local drafts in separate databases', { skip: !process.env.TEST_MIGRATION_BASE }, async () => {
    const base = process.env.TEST_MIGRATION_BASE.replace(/\/$/, '');
    const { context, page, errors } = await openApp({ initialSession: true, liveSite: base, path: './pzts/' });
    try {
        await startRenderProject(page);
        const pzts = await page.evaluate(async () => {
            projectName = 'PZTS isolated draft';
            await saveToDB({ skipCloudSync: true });
            return { database: db.name, application: APP_PRODUCT, name: (await getSavedProjectData()).projectName };
        });
        const cctvPage = await context.newPage();
        await cctvPage.goto(base + '/cctv/');
        await cctvPage.waitForFunction(() => typeof db !== 'undefined' && !!db && typeof getSavedProjectData === 'function');
        assert.equal(await cctvPage.evaluate(() => getSavedProjectData()), null);
        await startRenderProject(cctvPage);
        const cctv = await cctvPage.evaluate(async () => {
            projectName = 'CCTV isolated draft';
            await saveToDB({ skipCloudSync: true });
            return { database: db.name, application: APP_PRODUCT, name: (await getSavedProjectData()).projectName };
        });
        assert.equal(pzts.application, 'PZTS');
        assert.equal(cctv.application, 'CCTV');
        assert.notEqual(pzts.database, cctv.database);
        assert.equal(cctv.name, 'CCTV isolated draft');
        assert.equal(await page.evaluate(async () => (await getSavedProjectData()).projectName), 'PZTS isolated draft');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('deleting detectors can preserve or close address gaps across floors and supports undo', async () => {
    const { context, page, errors } = await openApp({ initialSession: true });
    try {
        await startRenderProject(page);
        const arrange = async manual => page.evaluate(manual => {
            loadDefaultFloors(false, 'Address test');
            const device = (id, loopId = 1, manualNumber = null) => ({ id, loopId, manualNumber, type: 'magnet', x: 90, y: 100 });
            const floor = floors[currentFloorIndex];
            floor.devices = [device('a'), device('b', 1, manual), device('c'), device('other-bus', 2)];
            const cable = { id: 'ab', fromId: 'a', toId: 'b' };
            recalcCableHandles(cable, floor.devices[0], floor.devices[1]);
            floor.cables = [cable];
            floors.find(item => item.name === '2NP').devices = [device('next-floor')];
            saveStateToHistory();
        }, manual);
        const select = () => page.evaluate(() => activeDeviceIds.add('b'));
        const addresses = () => page.evaluate(() => Object.fromEntries(floors.flatMap(floor => floor.devices.map(device => [device.id, getDeviceAddressParts(device).prefix + device.number]))));
        await arrange(null);
        const original = { a: '1/1', b: '1/2', c: '1/3', 'other-bus': '2/1', 'next-floor': '1/4' };
        assert.deepEqual(await addresses(), original);
        await select();
        await page.keyboard.press('Delete');
        await page.locator('#appDialogAlternate').waitFor();
        await page.keyboard.press('Escape');
        assert.deepEqual(await addresses(), original);
        await page.keyboard.press('Delete');
        await page.locator('#appDialogAlternate').click();
        const kept = { a: '1/1', c: '1/3', 'other-bus': '2/1', 'next-floor': '1/4' };
        assert.deepEqual(await addresses(), kept);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].cables.length), 0);
        const restored = await page.evaluate(async () => {
            const payload = JSON.parse(JSON.stringify(getProjectDataPayload()));
            const loaded = await loadFloorsImages(payload.floors);
            return { gaps: loaded[payload.currentFloorIndex].addressReservations, numbers: loaded.flatMap(floor => floor.devices.map(device => device.number)) };
        });
        assert.deepEqual(restored, { gaps: [{ group: 'bus:1', start: 2, end: 2 }], numbers: [1, 3, 1, 4] });
        await page.keyboard.press('Control+z');
        await page.waitForFunction(() => isSystemReady && floors[currentFloorIndex].devices.some(device => device.id === 'b'));
        assert.deepEqual(await addresses(), original);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].cables.length), 1);
        await select();
        await page.keyboard.press('Delete');
        await page.locator('#appDialogConfirm').click();
        assert.deepEqual(await addresses(), { a: '1/1', c: '1/2', 'other-bus': '2/1', 'next-floor': '1/3' });
        await arrange(25);
        await select();
        await page.keyboard.press('Delete');
        await page.locator('#appDialogAlternate').click();
        assert.deepEqual(await addresses(), { a: '1/1', c: '1/26', 'other-bus': '2/1', 'next-floor': '1/27' });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('marquee extends across the viewport edge and moves the whole group with one undo', async () => {
    const { context, page, errors } = await openApp({ initialSession: true });
    try {
        await startRenderProject(page);
        await page.evaluate(() => {
            const floor = floors[currentFloorIndex];
            floor.devices = [
                { id: 'a', type: 'pir', x: 200, y: 260, loopId: 1 },
                { id: 'b', type: 'magnet', x: 340, y: 340, loopId: 1 },
                { id: 'below', type: 'magnet', x: 245, y: planCanvasHeight() + 105, loopId: 1 },
                { id: 'outside', type: 'pir', x: 560, y: 350, loopId: 1 }
            ];
            floor.cables = [{ id: 'internal', fromId: 'a', toId: 'b', isCustom: true,
                h1x: 235, h1y: 280, h2x: 270, h2y: 300, h3x: 305, h3y: 320 }];
            saveStateToHistory();
            requestRedraw();
        });
        const box = await page.locator('#canvasContainer').boundingBox();
        await page.mouse.move(box.x + 145, box.y + 222);
        await page.mouse.down();
        await page.mouse.move(box.x + 400, box.y + box.height + 5);
        await page.waitForFunction(() => offsetY < -125 && isSelecting);
        await page.mouse.up();
        assert.deepEqual(await page.evaluate(() => [...activeDeviceIds]), ['a', 'b', 'below']);
        const center = await page.evaluate(() => ({x: 200 + offsetX, y: 260 + offsetY}));
        await page.keyboard.down('Alt');
        await page.mouse.move(box.x + center.x, box.y + center.y);
        await page.mouse.down();
        await page.mouse.move(box.x + center.x + 65, box.y + center.y + 28, { steps: 4 });
        await page.mouse.up();
        await page.keyboard.up('Alt');
        const positions = () => page.evaluate(() => {
            const floor = floors[currentFloorIndex];
            return { devices: floor.devices.map(({x,y}) => [x,y]), cable: [floor.cables[0].h2x, floor.cables[0].h2y] };
        });
        assert.deepEqual(await positions(), { devices: [[265,288],[405,368],[310,box.height+133],[560,350]], cable: [335,328] });
        await page.keyboard.press('Control+z');
        await page.waitForFunction(() => isSystemReady && floors[currentFloorIndex].devices[0].x === 200);
        assert.deepEqual(await positions(), { devices: [[200,260],[340,340],[245,box.height+105],[560,350]], cable: [270,300] });
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('manual cable bends stay fixed when the center or one device moves and survive TECH reopening', async () => {
    const { context, page, errors } = await openApp({ initialSession: true });
    try {
        await startRenderProject(page);
        await page.evaluate(() => {
            const floor = floors[currentFloorIndex];
            floor.devices = [
                { id: 'a', type: 'magnet', x: 140, y: 200 },
                { id: 'b', type: 'magnet', x: 660, y: 360 },
                { id: 'c', type: 'magnet', x: 680, y: 460 }
            ];
            const cable = { id: 'route', fromId: 'a', toId: 'b', isCustom: false };
            recalcCableHandles(cable, floor.devices[0], floor.devices[1]);
            floor.cables = [
                { id: 'nearby', fromId: 'a', toId: 'c', isCustom: true, h1x: 275, h1y: 244, h2x: 410, h2y: 330, h3x: 550, h3y: 398 },
                cable
            ];
            activeDeviceIds.add('a');
            saveStateToHistory();
            requestRedraw();
        });
        const box = await page.locator('#canvasContainer').boundingBox();
        const drag = async ([x, y], [nextX, nextY]) => {
            await page.keyboard.down('Alt');
            await page.mouse.move(box.x + x, box.y + y);
            await page.mouse.down();
            await page.mouse.move(box.x + nextX, box.y + nextY, { steps: 4 });
            await page.mouse.up();
            await page.keyboard.up('Alt');
        };
        const readCables = () => page.evaluate(() => floors[currentFloorIndex].cables);
        const [nearby] = await readCables();
        await drag([270, 240], [265, 315]);
        await drag([400, 280], [425, 160]);
        let [, route] = await readCables();
        assert.deepEqual([route.h1x, route.h1y, route.h2x, route.h2y, route.h3x, route.h3y], [265, 315, 425, 160, 542.5, 260]);
        await drag([542.5, 260], [580, 220]);
        await drag([425, 160], [410, 180]);
        await drag([140, 200], [160, 210]);
        const expected = await readCables();
        [, route] = expected;
        assert.deepEqual(expected[0], nearby);
        assert.deepEqual([route.h1x, route.h1y, route.h2x, route.h2y, route.h3x, route.h3y, route.fixedEnds], [265, 315, 410, 180, 580, 220, 3]);
        assert.equal(await page.evaluate(() => hitTestCables(265, 270, floors[currentFloorIndex], true)), 'route');

        await page.evaluate(() => openPlanOutput());
        const download = page.waitForEvent('download');
        await page.locator('#btnExportBIPS').click();
        const exported = await readFile(await (await download).path());
        await page.evaluate(() => loadDefaultFloors(false, 'Cleared'));
        await page.locator('#bipsLoader').setInputFiles({ name: 'Routes.TECH', mimeType: 'application/json', buffer: exported });
        await page.waitForFunction(() => isSystemReady && floors[currentFloorIndex].cables.length === 2);
        assert.deepEqual(await readCables(), expected.map(c=>({...c,ownerApplication:process.env.TEST_PRODUCT||'PZTS',routeColor:'#22c55e'})));
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('PRO detector search finds an address across floors, highlights it and centers an offscreen result', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, company: true });
    try {
        await page.waitForFunction(() => window.hasProAccess());
        await startRenderProject(page);
        await page.evaluate(() => {
            const floor = floors.find(floor => floor.name === '3NP');
            floor.devices.push({ id: 'target', type: 'magnet', x: 1800, y: 1300, loopId: 2, manualNumber: 29 });
            saveStateToHistory();
            const stroke = ctx.stroke;
            ctx.stroke = function (...args) {
                if (this.strokeStyle === '#82d322') window.testSearchStroke = true;
                return stroke.apply(this, args);
            };
        });
        await page.locator('#btnDetectorSearch').click();
        await page.locator('#detectorSearchBus').fill('2');
        await page.locator('#detectorSearchNumber').fill('30');
        await page.locator('#detectorSearchNumber').press('Enter');
        assert.match(await page.locator('#detectorSearchStatus').innerText(), /2\/30/);
        await page.locator('#detectorSearchNumber').fill('29');
        await page.locator('#detectorSearchNumber').press('Enter');
        await page.locator('#detectorSearchModal').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => floors[currentFloorIndex].name === '3NP' && detectorSearchMatch?.device.id === 'target'
            && Math.abs(1800 * scale + offsetX - planCanvasWidth() / 2) < 1
            && Math.abs(1300 * scale + offsetY - planCanvasHeight() / 2) < 1 && window.testSearchStroke);
        assert.equal(await page.evaluate(() => activeDeviceIds.size), 0);
        await page.evaluate(async () => {
            const db = firebase.firestore(), reference = db.collection('cloudLicenses').doc('test-user');
            const license = (await reference.get()).data();
            license.applicationExpiresAt.PZTS.seconds = Date.now()/1000 - 1;
            await db.runTransaction(transaction => transaction.set(reference, license));
        });
        await page.waitForFunction(()=>document.getElementById('btnDetectorSearch').dataset.projectLocked==='true');
        assert.equal(await page.evaluate(() => detectorSearchMatch), null);
        assert.match(await page.locator('link[rel=icon]').getAttribute('href'), /^Logosite\.png\?/);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('borderless legend takes every device from the active menu and moves and resizes without placing sensors', async () => {
    const {context,page,errors}=await openApp({initialSession:true});
    try {
        await startRenderProject(page);
        const toggle=page.locator('.toolbar-section #btnToggleLegend');
        assert.equal(await toggle.textContent().then(text=>text.trim()),'');
        assert.equal(await page.locator('#mainMenuModal #btnMenuLegend').count(),0);
        await toggle.click();
        const initial=await page.evaluate(()=>{const f=floors[currentFloorIndex];return {legend:f.legend,bounds:getProjectLegendBounds(f),expected:getActiveToolbarMenu().deviceTypes.filter(t=>legendDeviceTypes.has(t)),scale,offsetX,offsetY};});
        assert.deepEqual(initial.legend.entries.map(e=>e.type),initial.expected);assert.equal(initial.legend.entries.length,14);
        const box=await page.locator('#canvasContainer').boundingBox();
        const x=box.x+initial.offsetX+(initial.legend.x+20*initial.legend.scale)*initial.scale;
        const y=box.y+initial.offsetY+(initial.legend.y+12*initial.legend.scale)*initial.scale;
        await page.evaluate(()=>selectedTool='pir');
        await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-160,y+65,{steps:8});await page.mouse.up();
        const moved=await page.evaluate(()=>({legend:floors[currentFloorIndex].legend,count:floors[currentFloorIndex].devices.length}));
        assert.ok(Math.abs(moved.legend.x-initial.legend.x+160/initial.scale)<.1);assert.equal(moved.count,0);
        const corner=await page.evaluate(()=>{const b=getProjectLegendBounds(floors[currentFloorIndex]);return {x:offsetX+(b.minX+b.width)*scale,y:offsetY+(b.minY+b.height)*scale};});
        await page.mouse.move(box.x+corner.x-2,box.y+corner.y-2);await page.mouse.down();await page.mouse.move(box.x+corner.x-75,box.y+corner.y-90,{steps:8});await page.mouse.up();
        const resized=await page.evaluate(()=>floors[currentFloorIndex].legend.scale);assert.ok(resized<moved.legend.scale);
        await page.evaluate(()=>undo());await page.waitForFunction(value=>floors[currentFloorIndex].legend.scale===value,moved.legend.scale);
        await page.keyboard.press('-');assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices.length),0);
        await page.evaluate(()=>setGoomLanguage('en'));
        assert.equal(await toggle.getAttribute('aria-label'),'Hide legend');
        await toggle.click();assert.equal(await page.evaluate(()=>floors[currentFloorIndex].legend.visible),false);
        assert.equal(await toggle.getAttribute('aria-pressed'),'false');
        await toggle.click();
        assert.deepEqual(await page.evaluate(()=>floors[currentFloorIndex].legend.entries),initial.legend.entries);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'project-legend-desktop.png')});
        assert.deepEqual(errors,[]);
    } finally {await context.close();}
});
test('CCTV places cameras and recording equipment, edits coverage and keeps its own TECH projects', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, path: '/cctv.html' });
    try {
        assert.equal(await page.title(), 'GooM CCTV');
        assert.equal(await page.locator('.welcome-brand').textContent(), 'CCTV');
        await startRenderProject(page);
        assert.equal(await page.locator('#loopSelect option').first().textContent(), 'Skupina 1');
        assert.equal(await page.locator('#deviceSetTools [data-type="pir"]').count(), 0);
        const cameraTool = page.locator('#deviceSetTools [data-type="cctv_bullet"]');
        assert.ok(await cameraTool.locator('img').evaluate(image => image.complete && image.naturalWidth > 0));
        await chooseDetector(page, 'cctv_bullet');
        const canvas = await page.locator('#canvasContainer').boundingBox();
        const cameraPoint = { x: canvas.x + 220, y: canvas.y + 190 };
        await page.mouse.click(cameraPoint.x, cameraPoint.y);
        await page.keyboard.press('Escape');
        await chooseDetector(page, 'cctv_nvr');
        await page.mouse.click(canvas.x + 480, canvas.y + 270);
        await page.keyboard.press('Escape');
        await page.mouse.dblclick(cameraPoint.x, cameraPoint.y);
        await page.locator('#cameraAngle').fill('110');
        await page.locator('#cameraRange').fill('420');
        await page.locator('#btnSaveNumber').click();
        await page.locator('#btnToggleLegend').click();
        const result = await page.evaluate(() => {
            const data = getProjectDataPayload();
            const floor = floors[currentFloorIndex];
            const [camera, recorder] = floor.devices;
            const points = getPIRCoveragePoints(floor, camera);
            const middle = points[1 + Math.floor((points.length - 1) / 2)];
            const target = new SVGPlanContext(1200, 900);
            drawPIRCoverage(target, floor, true);
            drawFloorData(target, floor, true, 'original');
            return { application: data.application, dbName: DB_NAME, optics: getCameraOptics(camera), manual: camera.manualNumber,
                forward: middle.x - camera.x, address: getDeviceAddressParts(camera), recorderType: recorder.type,
                devices: getFloorOverviewStats(floor), svg: target.toSVG() };
        });
        assert.equal(result.application, 'CCTV');
        assert.equal(result.dbName, 'GooM_CCTV_V1');
        assert.deepEqual(result.optics, { angle: 110, range: 420 });
        assert.equal(result.manual, null);
        assert.ok(result.forward > 419);
        assert.deepEqual(result.address, { prefix: '1/', number: '1' });
        assert.equal(result.recorderType, 'cctv_nvr');
        assert.equal(result.devices.detectors, 1);
        assert.equal(result.devices.panels.length, 1);
        assert.match(result.svg, /Válcová kamera/);
        assert.match(result.svg, /#0284c7/);
        await page.evaluate(async () => {
            const deadline = performance.now() + 5000;
            while (performance.now() < deadline) {
                const data = await getSavedProjectData();
                if (data?.application === 'CCTV' && data.floors[data.currentFloorIndex].devices[0]?.cameraRange === 420) return;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            throw new Error('CCTV project was not autosaved');
        });
        await page.reload();
        await page.waitForFunction(() => isSystemReady && floors[currentFloorIndex].devices.length === 2);
        assert.equal(await page.evaluate(() => floors[currentFloorIndex].devices[0].cameraRange), 420);
        await page.goto(origin);
        await page.waitForFunction(() => typeof getSavedProjectData === 'function' && !!db && typeof window.updateTabletTools === 'function');
        assert.equal(await page.evaluate(() => getSavedProjectData()), null);
        assert.equal(await page.locator('#deviceSetTools [data-type="pir"]').count(), 1);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('ACS devices and smoke detectors can be placed, numbered, saved and rendered in the legend', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, company: true });
    try {
        await startRenderProject(page);
        await page.waitForFunction(() => window.hasProAccess());
        await page.locator('#arrowTabBtn').click();
        const devices = [
            ['acs_module', 'Modul přístupového systému (ACS)'],
            ['acs_reader', 'Čtečka přístupového systému (ACS)'],
            ['smoke', 'Kouřový hlásič']
        ];
        await page.locator('#btnToggleLegend').click();
        await page.evaluate(() => {
            const legend = floors[currentFloorIndex].legend;
            legend.entries = legend.entries.filter(entry => !NEW_TOOLBAR_DEVICE_TYPES.includes(entry.type));
        });
        const canvas = await page.locator('#canvasContainer').boundingBox();
        for (const [index, [type, label]] of devices.entries()) {
            await page.keyboard.press('Escape');
            const tool = page.locator(`#deviceSelector button[data-type="${type}"]`);
            assert.equal(await tool.getAttribute('aria-label'), label);
            assert.ok(await tool.locator('img').evaluate(image => image.complete && image.naturalWidth > 0));
            await tool.click();
            await page.mouse.click(canvas.x + 200 + index * 120, canvas.y + 190);
        }
        const exported = await page.evaluate(async () => {
            const payload = JSON.parse(JSON.stringify(getProjectDataPayload()));
            const loaded = await loadFloorsImages(payload.floors);
            const floor = loaded[payload.currentFloorIndex];
            const target = new SVGPlanContext(1200, 900);
            drawFloorData(target, floor, true, 'original');
            const placed = floor.devices.map(device => {
                const address = getDeviceAddressParts(device);
                return [device.type, address.prefix + address.number];
            });
            return { placed, entries: floor.legend.entries.map(entry => entry.type), svg: target.toSVG(), overview: getFloorOverviewStats(floor) };
        });
        assert.deepEqual(exported.placed, [['acs_module', '1'], ['acs_reader', '1'], ['smoke', '1/1']]);
        for (const [type, label] of devices) {
            assert.ok(exported.entries.includes(type));
            assert.ok(exported.svg.includes(label));
        }
        assert.match(exported.svg, /#6d28d9/);
        assert.match(exported.svg, /#dc2626/);
        assert.equal(exported.overview.detectors, 1);
        if (process.env.TEST_SCREENSHOT_DIR) await smoothScreenshot(page, { path: resolve(process.env.TEST_SCREENSHOT_DIR, 'acs-smoke-plan.png') });
        await page.locator('#btnOpenToolbarMenuEditor').click();
        for (const [type] of devices) assert.equal(await page.locator(`#toolbarMenuPresets [data-type="${type}"]`).count(), 2);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('cycling toolbar menus updates existing legends and their export while preserving placement and visibility', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, company: true });
    try {
        await startRenderProject(page);
        await page.waitForFunction(() => window.hasProAccess());
        await page.locator('#arrowTabBtn').click();
        await page.locator('#btnToggleLegend').click();
        const initial = await page.evaluate(() => {
            const floor = floors[currentFloorIndex];
            Object.assign(floor.legend, { x: 90, y: 145, scale: 0.45 });
            floors.find(other => other !== floor).legend = { ...floor.legend, visible: false };
            toolbarMenus.push({ id: 'custom-legend', name: 'Custom', deviceTypes: ['pir', 'textNode'], icons: {
                pir: [{ kind: 'circle', x: 200, y: 200, size: 180, rotation: 0, color: '#ab23cd', fill: false, stroke: 10 }]
            } });
            toolbarMenus.push({ id: 'text-legend', name: 'Text only', deviceTypes: ['textNode'] });
            return floor.legend;
        });
        const cycle = async id => {
            await page.locator('#btnCycleToolbarMenu').click();
            await page.waitForFunction(id => document.getElementById('btnCycleToolbarMenu').dataset.menuId === id && !isToolbarMenuCycling, id);
        };
        await cycle('pro');
        assert.ok(await page.evaluate(() => floors[currentFloorIndex].legend.entries[0].shapes.some(shape => shape.text === 'EZS')));
        await cycle('custom-legend');
        const result = await page.evaluate(() => {
            const floor = floors[currentFloorIndex];
            const target = new SVGPlanContext(1200, 900);
            drawProjectLegend(target, floor, false, 'original');
            return { legend: floor.legend, hidden: floors.find(other => other !== floor).legend, svg: target.toSVG() };
        });
        assert.deepEqual(result.legend.entries.map(entry => entry.type), ['pir']);
        assert.deepEqual(result.hidden, { ...result.legend, visible: false });
        assert.deepEqual({ ...result.legend, entries: initial.entries }, initial);
        assert.match(result.svg, /#ab23cd/);
        assert.doesNotMatch(result.svg, /Magnetický kontakt/);
        await cycle('text-legend');
        assert.equal(await page.evaluate(() => getProjectLegendBounds(floors[currentFloorIndex])), null);
        await cycle('default');
        assert.deepEqual(await page.evaluate(() => floors[currentFloorIndex].legend), initial);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('PRO icon editor copies templates and retains detector addresses across toolbar sets', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, company: true });
    try {
        await startRenderProject(page);
        const menu = page.locator('#btnCycleToolbarMenu');
        const menuName = page.locator('#activeToolbarMenuName');
        await page.waitForFunction(() => window.hasProAccess());
        await page.locator('#arrowTabBtn').click();
        assert.equal(await menuName.innerText(), 'Default');
        const toolbarPosition = await menuName.evaluate(node => node.getBoundingClientRect().left);
        await menu.click();
        await page.waitForFunction(() => document.getElementById('activeToolbarMenuName').textContent === 'PROJECT');
        await page.locator('#btnOpenToolbarMenuEditor').click();
        assert.equal(await page.locator('[data-icon-shape="ellipse"]').isDisabled(), true);
        await page.locator('#btnToolbarMenuNew').click();
        const row = page.locator('.toolbar-menu-preset.selected');
        await row.locator('input').fill('Studio');
        await row.locator('[data-type="magnet"]').click();
        const templatePreview = page.locator('#iconTemplateImage');
        assert.equal(await templatePreview.isVisible(), false);
        await page.locator('#btnSaveIconTemplate').click();
        assert.equal(await templatePreview.isVisible(), true);
        const originalTemplate = await templatePreview.getAttribute('src');
        await row.locator('[data-type="pir"]').click();
        assert.equal(await templatePreview.getAttribute('src'), originalTemplate);
        await page.locator('#btnIconEditorTemplate').click();
        await page.locator('#appDialogConfirm').click();
        const canvas = page.locator('#iconEditorCanvas');
        const bounds = await canvas.boundingBox();
        await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
        await page.locator('#iconEditorWeight').fill('400');
        await page.locator('[data-icon-turn="15"]').click();
        await page.locator('#btnIconEditorDuplicate').click();
        await page.locator('[data-icon-shape="ellipse"]').click();
        await canvas.click({ position: { x: bounds.width * .25, y: bounds.height * .28 } });
        await page.locator('#iconEditorFillColor').fill('#ffcc44');
        await page.locator('[data-shape-scroll="1"]').click();
        await page.waitForFunction(() => document.getElementById('iconEditorShapeList').scrollTop > 0);
        await page.locator('[data-icon-shape="rectangle"]').click();
        const startX = bounds.x + bounds.width * .13, startY = bounds.y + bounds.height * .69;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + bounds.width * .54, startY + bounds.height * .15, { steps: 5 });
        await page.mouse.up();
        assert.equal(await templatePreview.getAttribute('src'), originalTemplate);
        await page.locator('#btnSaveIconTemplate').click();
        const savedTemplate = await templatePreview.getAttribute('src');
        assert.notEqual(savedTemplate, originalTemplate);
        await page.locator('#btnToolbarMenuSave').click();
        await page.locator('#btnIconEditorClose').click();
        assert.equal(await menuName.innerText(), 'Studio');
        assert.equal(await menuName.evaluate(node => node.getBoundingClientRect().left), toolbarPosition);
        const result = await page.evaluate(() => {
            const device = { type: 'pir', x: 80, y: 80, loopId: 2, number: 25, manualName: 'Hall' };
            const context = new SVGPlanContext(160, 160);
            drawDevice(context, device, true, 'dark');
            return { shapes: customDeviceIcons.pir, svg: context.toSVG() };
        });
        assert.ok(result.shapes.some(shape => shape.kind === 'ellipse' && shape.fillColor === '#ffcc44'));
        assert.ok(result.shapes.some(shape => shape.kind === 'rectangle' && shape.size > shape.height * 2));
        assert.equal(result.shapes.filter(shape => shape.kind === 'text' && shape.fontWeight === 400 && shape.rotation === 15).length, 2);
        assert.match(result.svg, />2\/<\/text>/);
        assert.match(result.svg, />25<\/text>/);
        assert.match(result.svg, />Hall<\/text>/);
        await menu.click();
        await page.waitForFunction(() => document.getElementById('activeToolbarMenuName').textContent === 'Default');
        await page.reload();
        await page.waitForFunction(() => window.hasProAccess?.() && typeof openToolbarMenuEditor === 'function');
        await startRenderProject(page);
        await page.locator('#btnOpenToolbarMenuEditor').click();
        assert.equal(await templatePreview.getAttribute('src'), savedTemplate);
        await page.locator('#btnSaveIconTemplate').click();
        const stockTemplate = await page.evaluate(() => JSON.parse(localStorage.getItem('goom-icon-editor-template-v1')));
        assert.equal(stockTemplate[0].stockType, 'panel');
        assert.notEqual(await templatePreview.getAttribute('src'), savedTemplate);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('an administrator can edit the two built-in menus without a PRO subscription', async () => {
    const { context, page, errors } = await openApp({ initialSession: true });
    try {
        await startRenderProject(page);
        const changeRole = role => page.evaluate(async role => {
            const firestore = firebase.firestore();
            const ref = firestore.collection('goomAdmins').doc('test-user');
            await firestore.runTransaction(transaction => transaction.set(ref, { role }));
        }, role);
        await changeRole('admin');
        await page.waitForFunction(() => window.hasAdminAccess());
        assert.equal(await page.evaluate(() => window.hasCloudAccess()), false);
        await page.evaluate(() => localStorage.setItem('goom-toolbar-menus-v1', JSON.stringify({
            version: 3, presets: { default: { ...defaultToolbarMenu, name: 'Older Default' } },
            menus: [{ id: 'older-private', name: 'Older private', deviceTypes: ['pir'] }]
        })));
        await page.locator('#btnOpenToolbarMenuEditor').click();
        await page.locator('#btnToolbarImportMenus').click();
        await page.locator('#appDialogConfirm').click();
        await page.locator('[data-menu-id="older-private"]').waitFor();
        await page.locator('#btnToolbarLegacyPreset').click();
        let name = page.locator('[data-menu-id="default"] .toolbar-menu-preset-name');
        assert.equal(await name.inputValue(), 'Older Default');
        assert.equal(await page.locator('#activeToolbarMenuName').textContent(), 'Default');
        await name.fill('Default Studio');
        await page.locator('#btnToolbarMenuSave').click();
        assert.equal(await page.locator('#activeToolbarMenuName').textContent(), 'Default Studio');
        name = page.locator('[data-menu-id="pro"] .toolbar-menu-preset-name');
        await name.focus();
        await page.waitForFunction(() => editingToolbarMenu?.id === 'pro');
        await page.locator('[data-menu-id="pro"] .toolbar-menu-preset-name').fill('PRO Studio');
        await page.locator('#btnToolbarMenuSave').click();
        await page.waitForFunction(() => document.getElementById('activeToolbarMenuName').textContent === 'PRO Studio');
        const shared = await page.evaluate(() => JSON.parse(localStorage.getItem('test.documents')).filter(([path]) => path.startsWith('goomToolbarPresets/')));
        assert.deepEqual(shared.map(([path, preset]) => [path, preset.name]), [
            ['goomToolbarPresets/PZTS/sets/default', 'Default Studio'], ['goomToolbarPresets/PZTS/sets/pro', 'PRO Studio']
        ]);
        await changeRole('user');
        await page.locator('#iconEditorModal').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#btnCycleToolbarMenu').getAttribute('data-project-locked'), 'true');
        assert.equal(await page.locator('#activeToolbarMenuName').textContent(), 'Default Studio');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('admins publish, edit and withdraw an extra PROJECT menu that subscribers can select', async () => {
    const admin = await openApp({ initialSession: true });
    try {
        const { page } = admin;
        await startRenderProject(page);
        await page.evaluate(() => firebase.firestore().collection('goomAdmins').doc('test-user').set({ role: 'admin' }));
        await page.waitForFunction(() => window.hasAdminAccess());
        await page.locator('#btnOpenToolbarMenuEditor').click();
        await page.locator('#btnToolbarMenuNew').click();
        await page.locator('#toolbarMenuShare').uncheck();
        const publish = page.locator('#btnToolbarMenuPublish');
        assert.equal(await publish.isDisabled(), true);
        const personalName = page.locator('.toolbar-menu-preset[data-menu-id^="menu-"] .toolbar-menu-preset-name');
        await personalName.fill('Dark Style');
        await page.locator('#btnToolbarMenuSave').click();
        const publishedRecords = () => page.evaluate(() => JSON.parse(localStorage.getItem('test.documents'))
            .filter(([path]) => path.includes('/premiumSets/')));
        assert.deepEqual(await publishedRecords(), []);
        await publish.click();
        await page.locator('.toolbar-menu-preset[data-menu-id^="shared-"]').waitFor();
        const sharedName = page.locator('.toolbar-menu-preset[data-menu-id^="shared-"] .toolbar-menu-preset-name');
        await page.waitForFunction(() => editingToolbarMenu?.id.startsWith('shared-'));
        await sharedName.fill('Dark Style 2');
        await page.locator('#btnToolbarMenuSave').click();
        await page.waitForFunction(() => getActiveToolbarMenu().name === 'Dark Style 2');
        const [[path, preset]] = await publishedRecords();
        const id = path.split('/').at(-1);
        assert.equal(preset.name, 'Dark Style 2');
        assert.equal(await personalName.inputValue(), 'Dark Style');

        const subscriber = await openApp({ initialSession: true, company: true });
        try {
            const otherPage = subscriber.page;
            await startRenderProject(otherPage);
            await otherPage.evaluate(([id, data]) => firebase.firestore().collection('goomToolbarPresets')
                .doc('PZTS').collection('premiumSets').doc(id).set(data), [id, preset]);
            await otherPage.waitForFunction(id => toolbarMenus.some(menu => menu.id === id), id);
            assert.equal(await otherPage.locator('#activeToolbarMenuName').textContent(), 'Default');
            await otherPage.locator('#arrowTabBtn').click();
            await otherPage.locator('#btnCycleToolbarMenu').click();
            await otherPage.waitForFunction(() => getActiveToolbarMenu().id === 'pro' && !isToolbarMenuCycling);
            await otherPage.locator('#btnCycleToolbarMenu').click();
            await otherPage.waitForFunction(id => getActiveToolbarMenu().id === id, id);
            await otherPage.reload();
            await otherPage.waitForFunction(id => typeof getActiveToolbarMenu === 'function' && getActiveToolbarMenu().id === id, id);
            await startRenderProject(otherPage);
            await otherPage.locator('#btnOpenToolbarMenuEditor').click();
            const sharedRow = otherPage.locator(`.toolbar-menu-preset[data-menu-id="${id}"]`);
            assert.equal(await sharedRow.locator('input').getAttribute('readonly'), '');
            assert.equal(await sharedRow.locator('.toolbar-menu-remove').isDisabled(), true);
            assert.equal(await otherPage.locator('#btnToolbarMenuPublish').isVisible(), false);
            await otherPage.evaluate(async () => {
                await firebase.auth().signOut();
                window.testSignInUid = 'free-user';
                await firebase.auth().signInWithPopup();
            });
            await otherPage.waitForFunction(() => window.getFirebaseUser()?.uid === 'free-user' && toolbarMenus.length === 1);
            assert.equal(await otherPage.locator('#activeToolbarMenuName').textContent(), 'Default');
            assert.deepEqual(subscriber.errors, []);
        } finally { await subscriber.context.close(); }

        const remove = page.locator('.toolbar-menu-preset[data-menu-id^="shared-"] .toolbar-menu-remove');
        await remove.click();
        await page.locator('#appDialogConfirm').click();
        await remove.waitFor({ state: 'detached' });
        assert.deepEqual(await publishedRecords(), []);
        assert.equal(await personalName.inputValue(), 'Dark Style');
        assert.deepEqual(admin.errors, []);
    } finally { await admin.context.close(); }
});

test('a second account and device get the shared Default without inheriting paid menus or project icons', async () => {
    const { context, page, errors } = await openApp({ initialSession: true, company: true });
    try {
        await startRenderProject(page);
        await page.waitForFunction(() => window.hasProAccess());
        await page.evaluate(async () => {
            const ref = firebase.firestore().collection('goomToolbarPresets').doc('PZTS').collection('sets');
            await ref.doc('default').set({ name: 'Default shared', deviceTypes: ['panel', 'pir'], iconsJson: '{}' });
            await ref.doc('pro').set({ name: 'PROJECT shared', deviceTypes: ['panel', 'pir'], iconsJson: JSON.stringify(proToolbarMenu.icons) });
            toolbarMenus.push({ id: 'private', name: 'Private', deviceTypes: ['panel'], icons: proToolbarMenu.icons });
            applyToolbarMenu(toolbarMenus.at(-1));
        });
        assert.equal(await page.locator('#activeToolbarMenuName').textContent(), 'Private');
        await page.evaluate(async () => {
            await firebase.auth().signOut();
            window.testSignInUid = 'second-user';
            await firebase.auth().signInWithPopup();
        });
        await page.waitForFunction(() => window.getFirebaseUser()?.uid === 'second-user' && getActiveToolbarMenu().name === 'Default shared');
        assert.equal(await page.locator('#btnCycleToolbarMenu').getAttribute('data-project-locked'), 'true');
        assert.equal(await page.locator('#deviceSelector [data-type="panel"] img').count(), 0);
        assert.deepEqual(await page.evaluate(() => toolbarMenus.map(menu => menu.id)), ['default']);
        const shared = await page.evaluate(() => JSON.parse(localStorage.getItem('test.documents')).filter(([path]) => path.startsWith('goomToolbarPresets/')));
        const device = await openApp({ initialSession: true });
        try {
            await device.page.evaluate(async presets => {
                await firebase.firestore().runTransaction(transaction => {
                    for (const [path, preset] of presets) transaction.set(firebase.firestore().collection(path.split('/')[0]).doc(path.split('/')[1]).collection('sets').doc(path.split('/')[3]), preset);
                });
                customDeviceIcons = cloneIconShapes(proToolbarMenu.icons);
                refreshCustomDeviceIcons();
            }, shared);
            await device.page.waitForFunction(() => getActiveToolbarMenu().name === 'Default shared');
            assert.equal(await device.page.locator('#deviceSelector [data-type="panel"] img').count(), 0);
            assert.equal(await device.page.locator('#btnCycleToolbarMenu').getAttribute('data-project-locked'), 'true');
            assert.deepEqual(device.errors, []);
        } finally { await device.context.close(); }
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('legend snapshots custom symbols, survives TECH reopening, and prints in full outside plan bounds',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try {
        await startRenderProject(page);
        await page.evaluate(()=>{
            const shapes=[{kind:'circle',x:200,y:200,size:180,rotation:0,color:'#ab23cd',fill:false,stroke:10}];
            toolbarMenus.push({id:'legend-test',name:'Legend test',deviceTypes:['pir','magnet','textNode'],icons:{pir:shapes}});
            applyToolbarMenu(toolbarMenus.at(-1));toggleProjectLegend();
            const legend=floors[currentFloorIndex].legend;legend.x=-700;legend.y=-450;saveStateToHistory();openPlanOutput();
        });
        const pending=page.waitForEvent('download');await page.locator('#btnExportBIPS').click();const download=await pending;
        const data=await readFile(await download.path()),saved=JSON.parse(data),snapshot=saved.floors[saved.currentFloorIndex].legend;
        assert.deepEqual(snapshot.entries.map(e=>e.type),['pir','magnet']);assert.equal(snapshot.entries[0].shapes[0].color,'#ab23cd');
        await page.evaluate(()=>{saveModal.style.display='none';loadDefaultFloors(false,'Cleared');applyToolbarMenu(toolbarMenus[0]);});
        await page.locator('#bipsLoader').setInputFiles({name:'Legend.TECH',mimeType:'application/json',buffer:data});
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex]?.legend?.x===-700);
        const result=await page.evaluate(()=>{
            const f=floors[currentFloorIndex],before=JSON.parse(JSON.stringify(f.legend));
            const b=getPlanOutputBounds(f,false),target=new SVGPlanContext(1200,900);
            drawPlanOutput(target,f,{bounds:b,widthMM:297,heightMM:210,margin:10,options:{theme:'original',coverage:false}});
            const svg=target.toSVG();f.legend.visible=false;const hidden=new SVGPlanContext(1200,900);drawFloorData(hidden,f,true,'original');f.legend.visible=true;
            return {legend:before,b,svg,hidden:hidden.toSVG()};
        });
        assert.deepEqual(result.legend,snapshot);assert.ok(result.b.minX<=-700&&result.b.minY<=-450);
        assert.match(result.svg,/>Legenda:</);assert.match(result.svg,/>— Magnetický kontakt</);
        assert.match(result.svg,/#ab23cd/);assert.doesNotMatch(result.hidden,/Legenda:|#ab23cd/);
        // An empty floor with only a legend has no rect, frame or background in its annotation.
        const annotation=await page.evaluate(()=>{const t=new SVGPlanContext(1200,900);drawProjectLegend(t,floors[currentFloorIndex],false,'original');return t.toSVG();});
        assert.doesNotMatch(annotation,/<image|#a1a1aa/);
        for (const rect of annotation.matchAll(/<rect\b[^>]*>/g)) assert.ok(Number(rect[0].match(/width="([\d.]+)"/)[1])<=40);
        const printed=await page.evaluate(async()=>{window.print=()=>{};await printPlanDirect();return fetch(document.querySelector('#printPage img').src).then(r=>r.text());});
        assert.match(printed,/>Legenda:</);assert.match(printed,/#ab23cd/);
        // Reload may restore the floor before the icon editor script has finished downloading.
        await page.evaluate(async()=>{saveToDB({skipCloudSync:true});await getSavedProjectData();});
        await context.route('**/icon-editor.js*',async route=>{await new Promise(resolve=>setTimeout(resolve,400));await route.continue();});
        await page.reload();await page.waitForFunction(()=>isSystemReady&&typeof window.updateTabletTools==='function');
        assert.deepEqual(await page.evaluate(()=>floors[currentFloorIndex].legend),snapshot);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});
test('tablet can move and shrink the legend by touch while sensors stay untouched',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,contextOptions:devices['iPad Mini']});
    try{
        await startRenderProject(page);await page.locator('#btnToggleLegend').tap();
        const box=await page.locator('#canvasContainer').boundingBox(),session=await context.newCDPSession(page);
        const coordinates=()=>page.evaluate(()=>{const f=floors[currentFloorIndex],b=getProjectLegendBounds(f);return {x:offsetX+b.minX*scale,y:offsetY+b.minY*scale,w:b.width*scale,h:b.height*scale,s:f.legend.scale};});
        const before=await coordinates();
        const drag=async(x,y,dx,dy)=>{
            await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+x,y:box.y+y,id:1}]});
            await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+x+dx,y:box.y+y+dy,id:1}]});
            await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        };
        await drag(before.x+20,before.y+12,-90,45);const moved=await coordinates();assert.ok(Math.abs(moved.x-before.x+90)<1);
        await drag(moved.x+moved.w-2,moved.y+moved.h-2,-45,-60);const after=await coordinates();assert.ok(after.s<moved.s);
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices.length),0);
        await page.evaluate(async()=>{saveToDB({skipCloudSync:true});await getSavedProjectData();});await page.reload();await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex]?.legend?.visible);
        assert.ok(Math.abs((await coordinates()).s-after.s)<.0001);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'project-legend-tablet.png')});
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});
test('split text tool places a plain label, leaves notes boxed and saves both in TECH',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try {
        await startRenderProject(page);
        await chooseDetector(page);
        await page.locator('#canvasContainer').click({position:{x:140,y:180}});
        await chooseDetector(page,'plainText');
        await page.locator('#canvasContainer').click({position:{x:350,y:180}});
        await page.locator('#btnCancelText').click();
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices.length),1);
        await page.locator('#canvasContainer').click({position:{x:350,y:180}});
        await page.locator('#devTextInput').fill('Vstupní hala');
        await page.locator('#devTextSize').fill('26');
        await page.locator('#devTextInput').press('Enter');
        await page.locator('#textModal').waitFor({state:'hidden'});
        await page.locator('#canvasContainer').dblclick({position:{x:350,y:180}});
        assert.equal(await page.locator('#devTextInput').inputValue(),'Vstupní hala');
        assert.equal(await page.locator('#devTextSize').inputValue(),'26');
        await page.locator('#devTextInput').fill('Hlavní vstup');
        await page.locator('#btnSaveText').click();
        await page.locator('#arrowTabBtn').focus();
        await page.keyboard.press('Escape');
        await chooseDetector(page,'textNode');
        await page.locator('#canvasContainer').click({position:{x:560,y:180}});
        await page.locator('#devTextInput').fill('Kontrola');
        await page.locator('#devTextSize').fill('19');
        await page.locator('#btnSaveText').click();

        const {annotations,cables,svg}=await page.evaluate(()=>{
            const floor=floors[currentFloorIndex];
            const target=new SVGPlanContext(800,500);
            const labels=floor.devices.filter(device=>device.type==='textNode');
            for (const label of labels) drawDevice(target,label,true,'original');
            return {annotations:labels,cables:floor.cables,svg:target.toSVG()};
        });
        assert.equal(annotations.length,2);
        assert.equal(annotations[0].plainText,true);
        assert.equal(annotations[0].manualName,'Hlavní vstup');
        assert.equal(annotations[0].textSize,26);
        assert.equal(annotations[1].plainText,undefined);
        assert.equal(annotations[1].textSize,19);
        assert.deepEqual(cables,[]);
        assert.match(svg,/fill="#171719"[^>]*>Hlavní vstup</);
        assert.match(svg,/<path d="[^"]+Q[^"]+"[^>]+fill="#2d2e32"/);
        assert.equal((svg.match(/<path\b/g)||[]).length,1);

        await page.evaluate(()=>openPlanOutput());
        const pending=page.waitForEvent('download');
        await page.locator('#btnExportBIPS').click();
        const file=await pending;
        const data=await readFile(await file.path());
        await page.evaluate(()=>loadDefaultFloors(false,'Cleared'));
        await page.locator('#bipsLoader').setInputFiles({name:'Labels.TECH',mimeType:'application/json',buffer:data});
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex]?.devices.some(device=>device.manualName==='Hlavní vstup'));
        assert.deepEqual(await page.evaluate(()=>floors[currentFloorIndex].devices.filter(device=>device.type==='textNode')),annotations);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'project-text-tools.png')});
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});
async function roomImage(page,gap=false) {
    const data=await page.evaluate(gap=>{
        const c=document.createElement('canvas');c.width=1000;c.height=600;
        const p=c.getContext('2d');p.fillStyle='#fff';p.fillRect(0,0,c.width,c.height);
        p.fillStyle='#000';p.fillRect(496,0,8,600);
        if(gap){p.fillStyle='#fff';p.fillRect(490,250,20,100);}
        return c.toDataURL('image/png').split(',')[1];
    },gap);
    return {name:'room.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')};
}

test('dark plan preserves the source, PIR stops at walls and passes through a doorway',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);
        await page.locator('#imageLoader').setInputFiles(await roomImage(page));
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].image?.width===1000);
        const result=await page.evaluate(()=>{
            const f=floors[currentFloorIndex];
            f.devices=[{id:'wall-pir',type:'pir',x:250,y:300,rotation:180,loopId:1,pirRangePixels:600}];
            const dark=getDarkPlanImage(f.image).getContext('2d');
            const original=document.createElement('canvas');original.width=1000;original.height=600;const p=original.getContext('2d');p.drawImage(f.image,0,0);
            const points=getPIRCoveragePoints(f,f.devices[0]);
            const before=[...f.wallMask.data];f.planTheme='original';redraw();f.planTheme='dark';redraw();
            return {background:[...dark.getImageData(100,100,1,1).data].slice(0,3),wall:[...dark.getImageData(500,300,1,1).data].slice(0,3),source:[...p.getImageData(100,100,1,1).data].slice(0,3),hit:points[Math.floor(points.length/2)].x,unchanged:before.every((n,i)=>f.wallMask.data[i]===n),mask:f.wallMask.data[300*1000+500]};
        });
        assert.deepEqual(result.background,[24,26,29]);assert.deepEqual(result.wall,[255,255,255]);assert.deepEqual(result.source,[255,255,255]);
        assert.equal(result.mask,1);assert.equal(result.unchanged,true);assert.ok(result.hit>490&&result.hit<500);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'dark-plan-walls.png')});
        await page.evaluate(()=>openDetectionSettings());await page.locator('#wallPreviewInput').check();await page.locator('#btnCloseDetectionSettings').click();
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].previewWalls),true);
        await page.locator('#imageLoader').setInputFiles(await roomImage(page,true));
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].wallMask?.data[300*1000+500]===0);
        assert.ok(await page.evaluate(()=>{const f=floors[currentFloorIndex],p=getPIRCoveragePoints(f,f.devices[0]);return p[Math.floor(p.length/2)].x>540;}));
        const saved=await page.evaluate(async()=>{
            const payload=getProjectDataPayload(),loaded=await loadFloorsImages(payload.floors);return {theme:loaded[currentFloorIndex].planTheme,door:loaded[currentFloorIndex].wallMask.data[300*1000+500]};
        });assert.deepEqual(saved,{theme:'dark',door:0});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('HiDPI canvas preserves pointer coordinates and full A3 output is independent of viewport zoom',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,contextOptions:{viewport:{width:1280,height:800},deviceScaleFactor:2}});
    try{
        await startRenderProject(page);
        const sizing=await page.evaluate(()=>({pixel:canvas.width,css:canvas.getBoundingClientRect().width,ratio:canvasPixelRatio}));
        assert.equal(sizing.ratio,2);assert.ok(Math.abs(sizing.pixel/sizing.css-2)<.01);
        await chooseDetector(page,'pir');const box=await page.locator('#canvasContainer').boundingBox();await page.mouse.click(box.x+200,box.y+170);
        assert.ok(await page.evaluate(()=>Math.abs(planCanvasHeight()-container.clientHeight)<1));
        assert.deepEqual(await page.evaluate(()=>({x:floors[currentFloorIndex].devices[0].x,y:floors[currentFloorIndex].devices[0].y})),{x:200,y:170});
        await page.locator('#imageLoader').setInputFiles(await roomImage(page));await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].image);
        const output=await page.evaluate(async()=>{
            const f=floors[currentFloorIndex];f.devices.push({id:'off-screen',type:'magnet',x:3000,y:900,loopId:1});
            scale=6;offsetX=-2500;offsetY=-1000;
            const before={scale,offsetX,offsetY,width:canvas.width,height:canvas.height};
            const options={paper:'a3',orientation:'landscape',dpi:300,theme:'original',coverage:false};
            const a=await makePlanOutput(f,options,true), b=await makePlanOutput(f,options);
            const svg=new DOMParser().parseFromString(a.svg,'image/svg+xml');
            return {before,after:{scale,offsetX,offsetY,width:canvas.width,height:canvas.height},width:b.raster.width,height:b.raster.height,bounds:a.layout.bounds,paths:svg.querySelectorAll('path').length,error:!!svg.querySelector('parsererror'),size:[a.layout.widthMM,a.layout.heightMM]};
        });
        assert.deepEqual(output.before,output.after);assert.deepEqual(output.size,[420,297]);assert.equal(output.width,4961);assert.equal(output.height,3508);assert.ok(output.bounds.minX+output.bounds.width>3000);assert.ok(output.paths>0);assert.equal(output.error,false);
        await page.evaluate(()=>openPlanOutput());
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'a3-export-preview.png')});
        assert.equal(await page.locator('#saveModal select,#saveModal input[type=checkbox]').count(),0);
        for(const format of ['png','jpeg']){
            const pending=page.waitForEvent('download');await page.evaluate(format=>exportPlanFile(format),format);const download=await pending;
            const data=await readFile(await download.path());
            assert.equal(data[0],format==='png'?137:255);assert.equal(data[1],format==='png'?80:216);
        }
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('DXF geometry stays vector through save and SVG export, including bulges and arcs',{skip:!haveRenderLibraries},async()=>{
    const {context,page,errors}=await openApp({initialSession:true,company:true,renderLibraries:true});
    try{
        await startRenderProject(page);
        await page.waitForFunction(()=>window.hasProAccess());
        const dxf=['0','SECTION','2','ENTITIES','0','LINE','8','0','10','0','20','0','11','100','21','0','0','CIRCLE','8','0','10','50','20','30','40','15','0','ARC','8','0','10','50','20','30','40','20','50','0','51','180','0','LWPOLYLINE','8','0','90','2','70','0','10','0','20','40','42','1','10','40','20','40','0','ENDSEC','0','EOF'].join('\n');
        await page.locator('#imageLoader').setInputFiles({name:'vector.dxf',mimeType:'application/dxf',buffer:Buffer.from(dxf)});
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].vectorPlan?.paths.length===4);
        const result=await page.evaluate(async()=>{
            const f=floors[currentFloorIndex];f.devices.push({id:'text',type:'textNode',x:200,y:200,manualName:'Přízemí <A&B>',rotation:20});
            const output=await makePlanOutput(f,{paper:'a4',orientation:'portrait',dpi:150,theme:'dark',coverage:false},true);
            const xml=new DOMParser().parseFromString(output.svg,'image/svg+xml');
            const saved=getProjectDataPayload(),restored=await loadFloorsImages(saved.floors);
            return {images:xml.querySelectorAll('image').length,paths:xml.querySelectorAll('path').length,texts:[...xml.querySelectorAll('text')].map(node=>node.textContent),error:!!xml.querySelector('parsererror'),restored:restored[currentFloorIndex].vectorPlan.paths.length,arcs:f.vectorPlan.paths.filter(p=>p.includes('A')).length};
        });
        assert.equal(result.images,0);assert.ok(result.paths>=4);assert.ok(result.texts.includes('Přízemí <A&B>'));assert.equal(result.error,false);assert.equal(result.restored,4);assert.equal(result.arcs,3);
        const download=page.waitForEvent('download');await page.evaluate(()=>exportPlanFile('svg'));const svgDownload=await download;
        assert.match(svgDownload.suggestedFilename(),/\.svg$/);
        assert.match(await readFile(await svgDownload.path(),'utf8'),/^<svg /);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

for (const product of ['PZTS', 'CCTV']) test(`${product} retries PDF loading after missing assets are restored`, { skip: !haveRenderLibraries || process.env.TEST_PRODUCT && process.env.TEST_PRODUCT !== product }, async () => {
    const { context, page, errors } = await openApp({ initialSession: true, renderLibraries: true,
        path: `./?app=${product}`, pdfModuleFailures: 2 });
    try {
        await startRenderProject(page);
        await page.evaluate(() => window.planLibrariesReady);
        const failed = await page.evaluate(async () => {
            const doc = new jspdf.jsPDF();
            doc.text('Restored PDF', 20, 20);
            window.testPdfFloor = { pdfSource: doc.output('datauristring'), pdfPage: 1 };
            try { await getPlanPdfPage(window.testPdfFloor); return false; }
            catch { return !planPdfCache.has(window.testPdfFloor); }
        });
        assert.equal(failed, true);
        const restored = await page.evaluate(async () => {
            const pdfPage = await getPlanPdfPage(window.testPdfFloor);
            const text = await pdfPage.getTextContent();
            const raster = await rasterizePlanPdf(window.testPdfFloor, 600);
            return { text: text.items.map(item => item.str).join(' '), width: raster.width, height: raster.height,
                worker: pdfjsLib.GlobalWorkerOptions.workerSrc };
        });
        assert.match(restored.text, /Restored PDF/);
        assert.equal(restored.width, 600);
        assert.ok(restored.height > 600);
        assert.match(restored.worker, /pdf\.worker\.min\.(?:m?js)\?/);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('real PDF page selection, dark PDF export and native A4/A3 printing preserve the plan',{skip:!haveRenderLibraries},async()=>{
    const {context,page,errors}=await openApp({initialSession:true,renderLibraries:true});
    try{
        await startRenderProject(page);await page.waitForFunction(()=>!!window.jspdf?.jsPDF&&!!window.pdfjsLib?.getDocument);
        const base64=await page.evaluate(()=>{
            const doc=new jspdf.jsPDF({unit:'mm',format:'a4'});doc.text('Page 1',20,20);doc.addPage();doc.setLineWidth(.8);doc.line(105,0,105,297);doc.text('Page 2',20,20);return doc.output('datauristring').split(',')[1];
        });
        await page.locator('#imageLoader').setInputFiles({name:'two-pages.pdf',mimeType:'application/pdf',buffer:Buffer.from(base64,'base64')});
        await page.locator('#appDialogInput').fill('2');await page.locator('#appDialogConfirm').click();
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].pdfPage===2&&floors[currentFloorIndex].image);
        const result=await page.evaluate(async()=>{
            const f=floors[currentFloorIndex];const sourceWidth=f.image.width;scale=4;redraw();
            while(planCameraBusy()||planPdfCache.get(f).pending||!planPdfCache.get(f).raster)await new Promise(r=>setTimeout(r,20));
            const payload=getProjectDataPayload(),loaded=await loadFloorsImages(payload.floors);
            return {sourceWidth,detailWidth:planPdfCache.get(f).raster?.width||0,page:loaded[currentFloorIndex].pdfPage,source:loaded[currentFloorIndex].pdfSource.startsWith('data:application/pdf;base64,')};
        });
        assert.equal(result.page,2);assert.equal(result.source,true);assert.ok(result.detailWidth>result.sourceWidth);
        await page.evaluate(()=>openPlanOutput());
        await page.locator('#outputPreview').waitFor({state:'visible'});
        const previewColor=await page.locator('#outputPreview').evaluate(canvas => Array.from(canvas.getContext('2d').getImageData(0,0,1,1).data));
        assert.deepEqual(previewColor,[24,26,29,255]);
        assert.deepEqual(await page.evaluate(() => {
            const floor = floors[currentFloorIndex];
            const toggle = document.getElementById('togglePirCoverage');
            const original = toggle.getAttribute('aria-pressed');
            toggle.setAttribute('aria-pressed', 'false');
            const hidden = planOutputOptions(floor).coverage;
            toggle.setAttribute('aria-pressed', 'true');
            const visible = planOutputOptions(floor).coverage;
            toggle.setAttribute('aria-pressed', original);
            return [hidden, visible];
        }),[false,true]);
        const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>exportPlanFile('pdf'));const download=await downloadPromise;
        const saved=await readFile(await download.path());assert.match(saved.toString('ascii',0,8),/^%PDF-/);
        const size=await page.evaluate(async data=>{const task=pdfjsLib.getDocument({data:Uint8Array.from(data)});const pdf=await task.promise;const page=await pdf.getPage(1);const box=page.getViewport({scale:1});await task.destroy();return {width:box.width,height:box.height};},[...saved]);
        assert.ok(Math.abs(size.width*25.4/72-210)<.1);assert.ok(Math.abs(size.height*25.4/72-297)<.1);
        await page.evaluate(()=>{saveModal.style.display='none';window.print=()=>{window.testPrintCalled=true;};});await page.evaluate(()=>printPlanDirect());
        assert.equal(await page.evaluate(()=>window.testPrintCalled),true);assert.equal(await page.locator('#saveModal').evaluate(el=>el.style.display),'none');
        assert.ok(await page.locator('#printPage img').evaluate(image=>Math.max(image.naturalWidth,image.naturalHeight)>2000));assert.deepEqual(errors,[]);
        const printSvg=await page.locator('#printPage img').evaluate(image => fetch(image.src).then(response=>response.text()));
        assert.match(printSvg,/fill="#181a1d"/);
        for(const [format,landscape,widthMM,heightMM] of [['A4',false,210,297],['A3',true,420,297]]){
            await page.evaluate(()=>printPlanDirect());
            const printed=await page.pdf({format,landscape,preferCSSPageSize:false,printBackground:true});
            const printedSize=await page.evaluate(async data=>{
                const task=pdfjsLib.getDocument({data:Uint8Array.from(data)});
                const pdf=await task.promise,page=await pdf.getPage(1),v=page.getViewport({scale:1});
                const result={pages:pdf.numPages,width:v.width,height:v.height};await task.destroy();return result;
            },[...printed]);
            assert.equal(printedSize.pages,1);assert.ok(Math.abs(printedSize.width*25.4/72-widthMM)<1);assert.ok(Math.abs(printedSize.height*25.4/72-heightMM)<1);
        }
    }finally{await context.close();}
});

test('DXF export downloads editable vector plans, devices and cables with the correct free watermark',{skip:!haveRenderLibraries},async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true,renderLibraries:true});
    try{
        await startRenderProject(page);await page.waitForFunction(()=>window.hasProAccess()&&typeof DxfParser==='function');
        const source=['0','SECTION','2','ENTITIES','0','LINE','8','0','10','0','20','0','11','100','21','0','0','CIRCLE','8','0','10','50','20','30','40','15','0','ENDSEC','0','EOF'].join('\n');
        await page.locator('#imageLoader').setInputFiles({name:'cad-source.dxf',mimeType:'application/dxf',buffer:Buffer.from(source)});
        await page.waitForFunction(()=>floors[currentFloorIndex].vectorPlan?.paths.length===2);
        const stable=await page.evaluate(()=>{
            const f=floors[currentFloorIndex],type=APP_PRODUCT==='CCTV'?'cctv_dome':'pir';
            f.devices=[{id:'cad-a',type,x:100,y:100,rotation:20,loopId:1,manualName:'Přízemí · Этаж'},{id:'cad-b',type,x:250,y:170,rotation:0,loopId:1}];
            const cable={id:'cad-cable',fromId:'cad-a',toId:'cad-b'};recalcCableHandles(cable,f.devices[0],f.devices[1]);f.cables=[cable];
            const first=makePlanDXF(f).dxf;scale=7;offsetX=-120;offsetY=75;const second=makePlanDXF(f).dxf;
            return{same:first===second,entities:new DxfParser().parseSync(first).entities.length,text:first};
        });
        assert.equal(stable.same,true);assert.ok(stable.entities>8);assert.match(stable.text,/Přízemí · Этаж/);assert.doesNotMatch(stable.text,/GooM · Free/);
        await page.evaluate(()=>openPlanOutput());assert.equal(await page.locator('#btnExportDXF').count(),1);
        const download=page.waitForEvent('download');await page.locator('#btnExportDXF').click();const file=await download;assert.match(file.suggestedFilename(),/\.dxf$/);
        const raw=await readFile(await file.path(),'utf8');assert.match(raw,/AC1021/);assert.match(raw,/GOOM_GEOMETRY/);
        await page.evaluate(async()=>{const db=await getFirebaseDatabase();await db.collection('cloudLicenses').doc('test-user').set({});});
        await page.waitForFunction(()=>!window.hasProAccess());
        assert.ok(await page.evaluate(()=>makePlanDXF(floors[currentFloorIndex]).dxf.includes('GooM · Free')));assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('native printing puts each working floor on a separate page and skips empty floors',{skip:!haveRenderLibraries},async()=>{
    const {context,page,errors}=await openApp({initialSession:true,renderLibraries:true});
    try {
        await startRenderProject(page);
        await page.waitForFunction(()=>!!window.pdfjsLib?.getDocument);
        const favicon = page.locator('link[rel="icon"]');
        assert.equal(await favicon.count(), 1);
        assert.equal(await favicon.getAttribute('media'), null);
        assert.equal(new URL(await favicon.getAttribute('href'), origin).pathname, '/Logosite.png');
        assert.match(await page.locator('#btnLogo img').first().getAttribute('src'),/^Link\.png\?v=20261120-experience$/);
        await page.evaluate(()=>{
            const names=['2PP','1NP','5NP'];
            names.forEach((name,index)=>{
                const floor=floors.find(item=>item.name===name);
                floor.devices.push({id:`print-${index}`,type:'magnet',x:75+index*20,y:70,loopId:2,manualName:`Detector ${index+1}`});
            });
            currentFloorIndex=floors.findIndex(floor=>floor.name==='2NP');
            window.print=()=>{window.printCalls=(window.printCalls||0)+1;};
        });
        await page.locator('#btnLogo').click();
        await page.locator('#btnMenuPrint').click();
        await page.waitForFunction(()=>window.printCalls===1);
        assert.deepEqual(await page.locator('.plan-print-header span').allTextContents(),['2PP','1NP','5NP']);
        for(const [format,landscape] of [['A4',false],['A3',true]]) {
            const generated=await page.pdf({format,landscape,printBackground:true});
            const pages=await page.evaluate(async bytes=>{
                const task=pdfjsLib.getDocument({data:Uint8Array.from(bytes)});
                const pdf=await task.promise;
                try {
                    const labels=[];
                    for(let number=1;number<=pdf.numPages;number++) {
                        const sheet=await pdf.getPage(number),text=await sheet.getTextContent();
                        labels.push(text.items.map(item=>item.str).join(' '));
                    }
                    return labels;
                } finally { await task.destroy(); }
            },[...generated]);
            assert.equal(pages.length,3,JSON.stringify(pages));
            ['2PP','1NP','5NP'].forEach((label,index)=>assert.match(pages[index],new RegExp(label)));
            await page.evaluate(()=>printPlanDirect());
        }
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].name),'2NP');
        assert.deepEqual(errors,[]);
    } finally { await context.close(); }
});

test('a tall tablet plan prints on a single sheet in portrait and landscape', { skip: !haveRenderLibraries }, async () => {
    const { context, page, errors } = await openApp({ initialSession: true, renderLibraries: true, contextOptions: devices['iPad Mini'] });
    try {
        await startRenderProject(page);
        await page.waitForFunction(() => !!window.pdfjsLib?.getDocument);
        await page.evaluate(() => {
            floors[currentFloorIndex].devices.push({ id: 'print-top', type: 'magnet', x: 80, y: 20 },
                { id: 'print-bottom', type: 'magnet', x: 80, y: 1640 });
            window.print = () => {};
        });
        for (const [format, landscape] of [['A4', false], ['A4', true], ['A3', true]]) {
            await page.evaluate(() => printPlanDirect());
            assert.equal(await page.locator('#printPage[data-tablet-print] .plan-print-sheet').count(), 1);
            const printed = await page.pdf({ format, landscape, printBackground: true });
            const count = await page.evaluate(async bytes => {
                const task = pdfjsLib.getDocument({ data: Uint8Array.from(bytes) });
                const pdf = await task.promise;
                try { return pdf.numPages; } finally { await task.destroy(); }
            }, [...printed]);
            assert.equal(count, 1, `${format} ${landscape ? 'landscape' : 'portrait'}`);
        }
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('oversized raster imports automatically and preserves its original for detail and project saving',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);
        const encoded=await page.evaluate(()=>{
            const source=document.createElement('canvas');source.width=6000;source.height=4100;
            const p=source.getContext('2d');p.fillStyle='#fff';p.fillRect(0,0,6000,4100);p.lineWidth=4;p.strokeStyle='#000';p.strokeRect(1000,900,3600,2200);p.fillRect(3000,900,4,2200);
            return source.toDataURL('image/png').split(',')[1];
        });
        await page.requestGC();
        await page.locator('#imageLoader').setInputFiles({name:'large-plan.png',mimeType:'image/png',buffer:Buffer.from(encoded,'base64')});
        await page.waitForFunction(()=>isSystemReady&&!!floors[currentFloorIndex].rasterSource);
        const result=await page.evaluate(async()=>{
            const floor=floors[currentFloorIndex],image=await getPlanFullImage(floor);scale=3;redraw();
            while(planCameraBusy())await new Promise(r=>setTimeout(r,20));
            const tile=getScreenPlanImage(floor),payload=getProjectDataPayload();
            return {original:[image.width,image.height],preview:floor.image.width*floor.image.height,tile:tile.planTile,source:payload.floors[currentFloorIndex].rasterSource===floor.rasterSource};
        });
        assert.deepEqual(result.original,[6000,4100]);assert.ok(result.preview<24600000);assert.equal(result.tile,true);assert.equal(result.source,true);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('scan paper and paired frame disappear while content bounds fit the actual drawing',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);
        const result=await page.evaluate(async()=>{
            const source=document.createElement('canvas');source.width=1000;source.height=600;const p=source.getContext('2d');
            p.fillStyle='#f6f6f6';p.fillRect(0,0,1000,600);p.strokeStyle='#555';p.lineWidth=2;p.strokeRect(6,6,988,588);p.strokeStyle='#000';p.lineWidth=3;p.strokeRect(350,200,300,200);
            const floor=floors[currentFloorIndex];floor.image=await loadPlanImage(source.toDataURL());floor.imgData=floor.image.src;floor.wallMask=createWallMask(floor,100);
            const target=document.createElement('canvas');target.width=1100;target.height=650;const context=target.getContext('2d');context.fillStyle=PLAN_DARK;context.fillRect(0,0,1100,650);drawPlanSource(context,floor,'dark');
            const pixel=(x,y)=>[...context.getImageData(x,y,1,1).data].slice(0,3);
            return {bounds:getPlanSourceBounds(floor),paper:pixel(345,198),outside:pixel(1005,198),frame:pixel(6,300),frames:floor.wallMask.frameColumns.length,output:getPlanOutputBounds(floor,false)};
        });
        assert.deepEqual(result.paper,result.outside);assert.deepEqual(result.frame,[24,26,29]);assert.ok(result.frames>0);assert.ok(result.bounds.width<350);assert.ok(result.output.width<500);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('wall sensitivity previews none through faint strokes, cancels cleanly and fixes PIR range at 300',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);
        await page.evaluate(async()=>{
            const source=document.createElement('canvas');source.width=800;source.height=500;const p=source.getContext('2d');p.fillStyle='#fff';p.fillRect(0,0,800,500);p.fillStyle='#000';p.fillRect(350,50,4,400);p.fillStyle='#fafafa';p.fillRect(500,50,4,400);
            const floor=floors[currentFloorIndex];floor.image=await loadPlanImage(source.toDataURL());floor.imgData=floor.image.src;floor.wallMask=createWallMask(floor,100);floor.devices=[{id:'fixed',type:'pir',x:100,y:200,rotation:180,pirRangePixels:2000}];window.initialWallMask=floor.wallMask;openDetectionSettings();
        });
        assert.equal(await page.locator('#pirRangeInput').count(),0);assert.equal(await page.locator('#wallThresholdInput').getAttribute('type'),'range');
        await page.locator('#wallThresholdInput').fill('0');await page.locator('#wallThresholdInput').dispatchEvent('input');
        await page.waitForFunction(()=>floors[currentFloorIndex].wallMask.data.every(n=>n===0));
        const range=await page.evaluate(()=>{const f=floors[currentFloorIndex],p=getPIRCoveragePoints(f,f.devices[0]);return Math.max(...p.map(p=>Math.hypot(p.x-100,p.y-200)));});assert.ok(Math.abs(range-300)<1.1);
        await page.locator('#wallThresholdInput').fill('1000');await page.locator('#wallThresholdInput').dispatchEvent('input');
        await page.waitForFunction(()=>floors[currentFloorIndex].wallMask.data[200*800+501]===1);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'wall-sensitivity-refined.png')});
        await page.locator('#btnCloseDetectionSettings').click();assert.equal(await page.evaluate(()=>floors[currentFloorIndex].wallMask===window.initialWallMask),true);
        await page.evaluate(()=>openDetectionSettings());await page.locator('#wallThresholdInput').fill('1000');await page.locator('#btnSaveDetectionSettings').click();
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].wallThreshold),255);assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].pirRangePixels),300);
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('modal animation keeps circles round in short dialogs and changes geometry after a cycle',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.evaluate(()=>mainMenuModal.style.display='flex');
        await page.waitForFunction(()=>{const svg=document.querySelector('#mainMenuModal .modal-blueprint'),r=svg.getBoundingClientRect();return Math.abs(svg.viewBox.baseVal.width-r.width)<1;});
        const result=await page.evaluate(()=>{
            const svg=document.querySelector('#mainMenuModal .modal-blueprint'),circle=svg.querySelector('circle'),box=circle.getBoundingClientRect(),path=svg.querySelector('path'),before=path.getAttribute('d');
            path.dispatchEvent(new Event('animationiteration'));
            return {width:box.width,height:box.height,before,after:path.getAttribute('d'),shapes:new Set([...svg.children].map(e=>e.dataset.shape)).size};
        });
        assert.ok(Math.abs(result.width-result.height)<1);assert.notEqual(result.before,result.after);assert.ok(result.shapes>=2);assert.deepEqual(errors,[]);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'random-modal-blueprint.png')});
    }finally{await context.close();}
});

test('adaptive grid stays sparse and uses subtle minor and major strokes',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);
        const result=await page.evaluate(()=>{
            document.getElementById('togglePlanGrid').setAttribute('aria-pressed','true');scale=1;offsetX=0;offsetY=0;
            const target=document.createElement('canvas');target.width=1000;target.height=600;const p=target.getContext('2d');p.fillStyle=PLAN_DARK;p.fillRect(0,0,1000,600);drawPlanGrid(p,floors[currentFloorIndex]);
            const pixel=x=>p.getImageData(x,123,1,1).data[0];
            return {background:pixel(250),minor:pixel(200),major:pixel(500),styles:[.005,.1,1,8,128].map(zoom=>({zoom,...getPlanGridStyle(zoom)}))};
        });
        assert.ok(result.minor>result.background);assert.ok(result.major>result.minor);assert.ok(result.major-result.background<30);
        for(const style of result.styles){assert.ok(style.spacing*style.zoom>=55&&style.spacing*style.zoom<=140);assert.ok(style.majorWidth>style.minorWidth);}
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('static plan is reused during selected-device frames and updates correctly after camera and theme changes',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.locator('#imageLoader').setInputFiles(await roomImage(page));
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].image&&!planCameraBusy());
        const result=await page.evaluate(()=>{
            const original=window.drawPlanSource;let sourceCalls=0;window.drawPlanSource=(...args)=>{sourceCalls++;return original(...args);};
            try{
                const floor=floors[currentFloorIndex];floor.devices=[{id:'animated',type:'pir',x:250,y:300,rotation:180}];activeDeviceIds.add('animated');
                const before=performance.now();for(let i=0;i<30;i++){globalTime+=.08;redraw();}
                const staticCalls=sourceCalls,staticMs=performance.now()-before;
                offsetX+=50;redraw();const panCalls=sourceCalls-staticCalls;
                floor.planTheme='original';redraw();const lightPixel=[...ctx.getImageData(Math.round((500*scale+offsetX)*canvasPixelRatio),Math.round((100*scale+offsetY)*canvasPixelRatio),1,1).data].slice(0,3);
                return {staticCalls,panCalls,lightPixel,staticMs};
            }finally{window.drawPlanSource=original;}
        });
        assert.ok(result.staticCalls<=1);assert.equal(result.panCalls,1);assert.ok(result.lightPixel.every(n=>n<30));
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('wheel zoom eases to its target around the pointer and direct touch cancels pending motion',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);const box=await page.locator('#canvasContainer').boundingBox();
        await page.mouse.move(box.x+350,box.y+250);await page.mouse.wheel(0,-200);
        await page.waitForFunction(()=>wheelCamera!==null);
        const interim=await page.evaluate(()=>({scale,anchor:[(350-offsetX)/scale,(250-offsetY)/scale]}));
        assert.ok(interim.scale>=1&&interim.scale<Math.exp(.3));
        await page.waitForFunction(()=>wheelCamera===null&&!planCameraBusy());
        const final=await page.evaluate(()=>({scale,anchor:[(350-offsetX)/scale,(250-offsetY)/scale]}));
        assert.ok(Math.abs(final.scale-Math.exp(.3))<.00001);assert.ok(Math.abs(final.anchor[0]-350)<.001);assert.ok(Math.abs(final.anchor[1]-250)<.001);
        await page.mouse.wheel(0,-250);await page.waitForFunction(()=>wheelCamera!==null);await page.mouse.click(box.x+150,box.y+150);
        assert.equal(await page.evaluate(()=>wheelCamera),null);
        await page.emulateMedia({reducedMotion:'reduce'});
        const reduced=await page.evaluate(()=>{const old=scale;zoomPlanAt(200,200,-100);return {scale,old,pending:wheelCamera};});
        assert.equal(reduced.pending,null);assert.ok(Math.abs(reduced.scale-reduced.old*Math.exp(.15))<.0001);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('loading uses the whale compositor animation and an empty idle editor does not redraw continuously',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.waitForFunction(()=>!planCameraBusy());
        await page.evaluate(()=>{window.idlePaintCount=0;window.originalRedraw=redraw;window.redraw=(...args)=>{window.idlePaintCount++;return window.originalRedraw(...args);};});
        await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.idlePaintCount),0);
        await page.evaluate(()=>{window.redraw=window.originalRedraw;isSystemReady=false;requestRedraw();});
        await page.locator('#planLoading').waitFor({state:'visible'});
        assert.match(await page.locator('#planLoading img').getAttribute('src'),/Logo\.png$/);
        assert.equal(await page.locator('#planLoading img').evaluate(el=>getComputedStyle(el).animationName),'plan-whale-spin');
        const spinner = await page.locator('#planLoading img').evaluate(img => {
            const animation = img.getAnimations()[0];
            animation.pause();
            animation.currentTime = 600;
            const disc = getComputedStyle(img.parentElement);
            return { rotation: new DOMMatrix(getComputedStyle(img).transform).b, radius: disc.borderRadius, color: disc.backgroundColor };
        });
        assert.ok(spinner.rotation < -.99);
        assert.equal(spinner.radius, '50%');
        assert.equal(spinner.color, 'rgba(255, 255, 255, 0.24)');
        assert.equal(await page.locator('#planLoading').innerText(),'');
        await page.evaluate(()=>{isSystemReady=true;requestRedraw();});await page.locator('#planLoading').waitFor({state:'hidden'});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('the free watermark follows the account in the editor, preview, export and print', async () => {
    const {context,page,errors}=await openApp({initialSession:true,company:true});
    try {
        await page.waitForFunction(()=>window.hasProAccess());
        await startRenderProject(page);
        await page.locator('#imageLoader').setInputFiles(await roomImage(page));
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex]?.image);
        const capture=()=>page.evaluate(async()=>{
            const floor=floors[currentFloorIndex];
            const options={paper:'a4',orientation:'landscape',dpi:150,theme:'original',coverage:false};
            const vector=await makePlanOutput(floor,options,true);
            const raster=await makePlanOutput(floor,options);
            const xml = new DOMParser().parseFromString(vector.svg, 'image/svg+xml');
            const images = [...xml.querySelectorAll('image')];
            const logo = images.find(image => image.getAttribute('opacity') === '0.14');
            const mark = logo && Object.fromEntries(['href','x','y','width','height'].map(name => [name, logo.getAttribute(name)]));
            return {mark, width:raster.raster.width, height:raster.raster.height, png:raster.raster.toDataURL()};
        });
        const pro=await capture();
        assert.equal(pro.mark,undefined);
        await page.evaluate(()=>openPlanOutput());
        const preview=page.locator('#outputPreview');
        const proPreview=await preview.evaluate(canvas=>canvas.toDataURL());
        await page.evaluate(async()=>{
            const db=firebase.firestore(), reference=db.collection('cloudLicenses').doc('test-user');
            const license=(await reference.get()).data();
            license.applicationExpiresAt.PZTS.seconds=Date.now()/1000-1;
            await db.runTransaction(transaction=>transaction.set(reference,license));
        });
        await page.waitForFunction(()=>!window.hasProAccess());
        await page.waitForFunction(previous=>document.getElementById('outputPreview').toDataURL()!==previous,proPreview);
        const free=await capture();
        assert.match(free.mark.href,/^data:image\/png;base64,/);
        assert.ok(Number(free.mark.width) < free.width * .08);
        assert.ok(Number(free.mark.x) > free.width * .9 && Number(free.mark.y) > free.height * .85);
        assert.notEqual(free.png,pro.png);
        await page.locator('#btnOutputClose').click();
        const editor=await page.evaluate(()=>{
            const original=ctx.drawImage;
            const marks=[];
            ctx.drawImage=function(image,...args){
                if (image === planWatermarkImages.get(true)) marks.push(args);
                return original.call(this,image,...args);
            };
            try {redraw();} finally {ctx.drawImage=original;}
            return marks;
        });
        assert.equal(editor.length,1);
        assert.ok(editor[0][0] > 1000 && editor[0][1] > 500);
        const printed=await page.evaluate(async()=>{
            window.print=()=>{};
            await printPlanDirect();
            const svg=await fetch(document.querySelector('#printPage img').src).then(response=>response.text());
            const mark=new DOMParser().parseFromString(svg,'image/svg+xml').querySelector('image[opacity="0.16"]');
            return mark?.getAttribute('href');
        });
        assert.match(printed,/^data:image\/png;base64,/);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'free-plan-watermark.png')});
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('TECH downloads and reopens the editable project while legacy BIPS remains accepted',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.evaluate(()=>{
            projectName='TECH example';const f=floors[currentFloorIndex];f.devices=[{id:'tech-device',type:'pir',x:100,y:200,rotation:90,loopId:2}];setPirCoverageVisible(false);saveStateToHistory();openPlanOutput();
        });
        assert.match(await page.locator('#btnExportBIPS').textContent(),/\.TECH/);
        assert.equal(await page.locator('#bipsLoader').getAttribute('accept'),'.tech,.bips');
        const pending=page.waitForEvent('download');await page.locator('#btnExportBIPS').click();const download=await pending;
        assert.equal(download.suggestedFilename(),'TECH example.TECH');const data=await readFile(await download.path()),payload=JSON.parse(data);
        assert.equal(payload.format,'TECH');assert.equal(payload.floors[payload.currentFloorIndex].devices[0].loopId,2);
        assert.equal(payload.pirCoverageVisible,false);
        await page.evaluate(()=>loadDefaultFloors(false,'Cleared'));
        await page.locator('#bipsLoader').setInputFiles({name:'TECH example.TECH',mimeType:'application/json',buffer:data});
        await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].devices[0]?.id==='tech-device');
        assert.equal(await page.locator('#togglePirCoverage').getAttribute('aria-pressed'),'false');
        const legacy={floors:[{name:'1NP',devices:[{id:'old-device',type:'magnet',x:300,y:200}],cables:[]}]};
        await page.locator('#bipsLoader').setInputFiles({name:'Legacy.bips',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
        await page.waitForFunction(()=>isSystemReady&&projectName==='Legacy'&&floors[currentFloorIndex].devices[0]?.id==='old-device');assert.deepEqual(errors,[]);
        assert.equal(await page.locator('#togglePirCoverage').getAttribute('aria-pressed'),'true');
    }finally{await context.close();}
});

test('nine-floor overview shows 200-zone ranges, gaps, control-panel location and real detector counts',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);
        await page.evaluate(()=>{
            projectName='Rodinný dům · PZTS';
            const first=floors.find(f=>f.name==='1NP'),second=floors.find(f=>f.name==='2NP');
            first.devices=Array.from({length:200},(_,i)=>({id:'zone-'+i,type:'pir',x:100+i%20*20,y:100+Math.floor(i/20)*20,loopId:1,manualNumber:i+1}));
            first.devices.push(...['keypad','expander','siren','abax','deactivated','textNode'].map((type,i)=>({id:'aux-'+i,type,x:20,y:20})));
            second.devices=[1,2,4,7].map(number=>({id:'bus2-'+number,type:'magnet',x:100+number*20,y:100,loopId:2,manualNumber:number}));
            second.devices.push({id:'brain',type:'panel',x:100,y:250});saveStateToHistory();
        });
        await page.locator('#btnOverview').click();
        await page.waitForFunction(()=>document.getElementById('overviewArtwork').naturalWidth===2752);
        const first=page.locator('[data-overview-floor="1NP"]'),second=page.locator('[data-overview-floor="2NP"]');
        assert.equal(await first.locator('.overview-floor-count').textContent(),'200');
        assert.equal(await first.locator('.overview-floor-zones').textContent(),'1/1–1/200');
        assert.equal(await second.locator('.overview-floor-zones').textContent(),'2/1–2/2, 2/4, 2/7');
        assert.equal(await second.locator('.overview-panel-badge').isVisible(),true);assert.equal(await first.locator('.overview-panel-badge').isVisible(),false);
        assert.match(await page.locator('#overviewProjectStats').textContent(),/Hlavní ústředna: 2NP/);
        assert.match(await page.locator('#overviewProjectStats').getAttribute('aria-label'),/Detektory: 204/);assert.match(await page.locator('#overviewProjectStats').getAttribute('aria-label'),/Zóny: 204/);
        await first.hover();assert.equal(await page.locator('#overviewDetailZones').textContent(),'1/1–1/200');
        assert.deepEqual(await page.locator('#overviewDetailZones strong').allTextContents(),['1','200']);
        assert.match(await page.locator('#overviewDetailCounts').textContent(),/Detektory: 200/);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'overview-nine-floors-zones.png')});
        await page.evaluate(()=>setGoomLanguage('en'));assert.match(await page.locator('#overviewProjectStats').textContent(),/Main control panel: 2NP/);
        assert.match(await first.locator('.overview-detector-label').textContent(),/detectors/);
        await page.locator('[data-overview-floor="6NP"]').click();assert.equal(await page.evaluate(()=>floors[currentFloorIndex].name),'6NP');
        await page.locator('#btnOverview').click();await page.locator('[data-overview-floor="3PP"]').click();assert.equal(await page.evaluate(()=>floors[currentFloorIndex].name),'3PP');
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('legacy projects gain missing floors without moving old indexes or losing plans and custom floors',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);const picture=await roomImage(page);
        const names=['2PP','1PP','1NP','2NP','3NP','Střecha'];
        const legacy={projectName:'Legacy floor migration',currentFloorIndex:2,floors:names.map(name=>({name,devices:[],cables:[]}))};
        legacy.floors[2].imgData='data:image/png;base64,'+picture.buffer.toString('base64');
        legacy.floors[0].devices=[{id:'old-basement',type:'magnet',x:100,y:100,loopId:1}];
        legacy.floors[2].devices=[{id:'old-plan-device',type:'pir',x:250,y:300,loopId:1}];
        legacy.floors[5].devices=[{id:'roof-note',type:'textNode',manualName:'Střecha',x:20,y:20}];
        await page.locator('#bipsLoader').setInputFiles({name:'Legacy.TECH',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
        await page.waitForFunction(()=>isSystemReady&&projectName==='Legacy floor migration');
        const saved=await page.evaluate(()=>getProjectDataPayload());
        assert.equal(saved.currentFloorIndex,2);assert.deepEqual(saved.floors.slice(0,6).map(f=>f.name),names);assert.equal(saved.floors.length,10);
        for(const name of ['1NP','2NP','3NP','4NP','5NP','6NP','1PP','2PP','3PP'])assert.equal(saved.floors.filter(f=>f.name===name).length,1);
        assert.equal(saved.floors[2].imgData,legacy.floors[2].imgData);assert.equal(saved.floors[2].devices[0].number,2);assert.equal(saved.floors[5].devices[0].id,'roof-note');
        const roundtrip=await page.evaluate(async()=>{const payload=getProjectDataPayload(),loaded=await loadFloorsImages(payload.floors);return {count:loaded.length,name:loaded[payload.currentFloorIndex].name,image:loaded[payload.currentFloorIndex].image.width};});
        assert.deepEqual(roundtrip,{count:10,name:'1NP',image:1000});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('overview zone summaries preserve shared addresses and do not invent ranges across gaps',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        const stats=await page.evaluate(()=>getFloorOverviewStats({name:'1NP',devices:[
            {type:'pir',number:1,loopId:1},{type:'magnet',number:1,loopId:1},{type:'pir',number:3,loopId:1},{type:'pir',number:4,loopId:1},
            {type:'pir_wl',number:10,loopId:2},{type:'panel'},{type:'keypad',number:1},{type:'deactivated',number:9},{type:'textNode'}
        ]}));
        assert.equal(stats.detectors,5);assert.equal(stats.zones,4);assert.equal(stats.panels.length,1);assert.equal(stats.elements,7);
        assert.deepEqual(stats.ranges,[{bus:1,start:1,end:1},{bus:1,start:3,end:4},{bus:2,start:10,end:10}]);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('device hover uses an unoutlined white disk and selection uses only the rotating arcs',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.evaluate(()=>{const f=floors[currentFloorIndex];f.devices=[{id:'hover-basic',type:'pir',x:240,y:240,loopId:1}];saveStateToHistory();resetPlacementTool();requestRedraw();});
        const box=await page.locator('#canvasContainer').boundingBox();await page.mouse.move(box.x+330,box.y+280);await page.mouse.move(box.x+240,box.y+240);
        assert.equal(await page.evaluate(()=>window.hasProAccess()),false);assert.equal(await page.evaluate(()=>window.hoveredDeviceId),'hover-basic');
        assert.equal(await page.locator('#deviceTooltip').evaluate(el=>el.style.opacity),'1');assert.equal(await page.locator('#deviceTooltip').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
        assert.ok((await page.locator('#deviceTooltip').innerText()).length<45);assert.equal(await page.locator('#ttNumber').textContent(),'1/1');
        const drawing=await page.evaluate(()=>{
            const device=floors[currentFloorIndex].devices[0];
            const capture=skip=>{
                const calls={arcs:[],fills:[],strokes:0};
                const {arc,fill,stroke}=ctx;
                ctx.arc=function(...args){calls.arcs.push(args);return arc.apply(this,args);};
                ctx.fill=function(...args){calls.fills.push(this.fillStyle);return fill.apply(this,args);};
                ctx.stroke=function(...args){calls.strokes++;return stroke.apply(this,args);};
                ctx.save();
                try{drawDevice(ctx,device,skip,'dark');}
                finally{ctx.restore();Object.assign(ctx,{arc,fill,stroke});}
                return calls;
            };
            const hovered=capture(false);
            activeDeviceIds.add(device.id);
            return {hovered,selected:capture(false),exported:capture(true)};
        });
        const circles=arcs=>arcs.filter(a=>Math.abs(a[4]-a[3]-2*Math.PI)<1e-6);
        assert.equal(circles(drawing.hovered.arcs).length,1);
        assert.deepEqual(drawing.hovered.fills,['#ffffff',...drawing.exported.fills]);
        assert.equal(drawing.hovered.strokes,drawing.exported.strokes);
        assert.equal(circles(drawing.selected.arcs).length,0);
        assert.equal(drawing.selected.arcs.filter(a=>Math.abs(a[4]-a[3]-Math.PI*.38)<1e-6).length,2);
        assert.deepEqual(drawing.selected.fills,drawing.exported.fills);
        assert.equal(circles(drawing.exported.arcs).length,0);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'compact-device-hover.png')});
        await page.mouse.click(box.x+240,box.y+240);assert.equal(await page.locator('#deviceTooltip').evaluate(el=>el.style.opacity),'0');assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('S and D rotate in opposite directions while Alt D retains deactivation',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.evaluate(()=>{const f=floors[currentFloorIndex];f.devices=[{id:'keys',type:'pir',x:300,y:200,rotation:0}];activeDeviceIds.add('keys');saveStateToHistory();});
        await page.keyboard.down('s');await page.waitForFunction(()=>floors[currentFloorIndex].devices[0].rotation>25);await page.keyboard.up('s');
        const clockwise=await page.evaluate(()=>floors[currentFloorIndex].devices[0].rotation);
        await page.keyboard.down('d');await page.waitForFunction(start=>floors[currentFloorIndex].devices[0].rotation<start-8,clockwise);await page.keyboard.up('d');
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].type),'pir');assert.equal(await page.evaluate(()=>deviceRotationAnimation),null);
        await page.keyboard.press('Alt+d');assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].type),'deactivated');
        await page.keyboard.press('Alt+d');assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].type),'pir');
        const angle=await page.evaluate(()=>floors[currentFloorIndex].devices[0].rotation);
        await page.locator('#projectNameInput').fill('D and S in a name');await page.locator('#projectNameInput').press('d');
        assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].rotation),angle);assert.deepEqual(errors,[]);
        await page.locator('#projectNameInput').blur();await page.keyboard.down('s');await page.waitForFunction(()=>deviceRotationAnimation!==null);
        await page.locator('#btnOverview').click();await page.waitForFunction(()=>deviceRotationAnimation===null);await page.keyboard.up('s');await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('white cable visibility button keeps its geometry and neighboring tools stable in both languages',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await chooseDetector(page);
        const button=page.locator('#btnToggleConnections');const initial=await button.boundingBox();
        const positions=()=>page.locator('#deviceSelector .device-btn').evaluateAll(elements=>elements.map(e=>({x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width})));
        const neighbors=await positions();
        for(const language of ['cs','en']){
            await page.evaluate(value=>setGoomLanguage(value),language);
            for(let i=0;i<2;i++){
                await button.click();const current=await button.boundingBox();assert.equal(current.width,initial.width);assert.equal(current.height,initial.height);assert.equal(current.x,initial.x);
                assert.match(await button.locator('.connection-button-label').textContent(),/kabely|cables/);
            }
        }
        assert.deepEqual(await positions(),neighbors);await page.mouse.move(5,5);
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('btnToggleConnections')).backgroundColor==='rgb(255, 255, 255)');
        const bus = page.locator('#loopSelect + .ui-select-trigger');
        assert.equal(await bus.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(244, 245, 247)');
        assert.equal(await page.locator('#activeToolbarMenuName').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(227, 230, 236)');
        await bus.click();
        const busList = page.locator('.bus-select-popup');
        assert.equal(await busList.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(244, 245, 247)');
        await busList.getByRole('option', { name: 'Bus 2', exact: true }).click();
        assert.equal(await page.locator('#loopSelect').inputValue(), '2');
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('tablet rotation arrows sit around the selected device and support tap hold and undo',async()=>{
    const {context,page,errors}=await openApp({initialSession:true,contextOptions:devices['iPad Mini']});
    try{
        await startRenderProject(page);await chooseDetector(page);const box=await page.locator('#canvasContainer').boundingBox();await page.touchscreen.tap(box.x+280,box.y+240);
        await page.locator('#tabletRotationHandles').waitFor({state:'visible'});assert.equal(await page.locator('[data-tablet-action="rotate"]').count(),0);
        const left=page.locator('[data-rotate-direction="-1"]'),right=page.locator('[data-rotate-direction="1"]');
        for(const arrow of [left,right]){const r=await arrow.boundingBox();assert.ok(r.width>=44&&r.height>=44);}
        await right.tap();assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].rotation),15);await left.tap();assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].rotation),0);
        const r=await right.boundingBox(),session=await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2,id:1}]});
        await page.waitForFunction(()=>floors[currentFloorIndex].devices[0].rotation>35);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await page.evaluate(()=>deviceRotationAnimation),null);await page.locator('[data-tablet-action="undo"]').tap();assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].rotation),0);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'tablet-curved-rotation.png')});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('reload waits for verified auth then restores floor devices and camera, while an expired session stays at sign-in',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.evaluate(async()=>{
            const index=floors.findIndex(f=>f.name==='2NP');currentFloorIndex=index;projectName='Resume camera';floors[index].devices=[{id:'resume-device',type:'pir',x:300,y:200,rotation:45}];
            scale=2.25;offsetX=-120;offsetY=-80;saveStateToHistory();saveToDB({skipCloudSync:true});await getSavedProjectData();localStorage.setItem('test.forceAuthDelay','900');
        });
        await page.reload();await page.waitForFunction(()=>typeof isSystemReady!=='undefined'&&typeof window.getFirebaseUser==='function');
        assert.equal(await page.locator('#startupLoading').isVisible(),true);
        assert.equal(await page.locator('#startupLoading img').evaluate(img=>getComputedStyle(img).animationName),'plan-whale-spin');
        assert.equal(await page.evaluate(()=>window.getFirebaseUser()),null);assert.equal(await page.evaluate(()=>isSystemReady),false);
        await page.waitForFunction(()=>isSystemReady&&projectName==='Resume camera');await page.locator('#welcomeModal').waitFor({state:'hidden'});
        await page.locator('#startupLoading').waitFor({state:'hidden'});
        const state=await page.evaluate(()=>({name:floors[currentFloorIndex].name,id:floors[currentFloorIndex].devices[0].id,rotation:floors[currentFloorIndex].devices[0].rotation,scale,offsetX,offsetY}));
        assert.deepEqual(state,{name:'2NP',id:'resume-device',rotation:45,scale:2.25,offsetX:-120,offsetY:-80});
        await page.evaluate(()=>{localStorage.setItem('test.forceSessionError','auth/user-token-expired');});await page.reload();
        await page.waitForFunction(()=>!!document.getElementById('btnGoogleSignIn')&&!document.getElementById('btnGoogleSignIn').disabled&&!!window.ensureFirebaseSession);
        assert.equal(await page.evaluate(()=>window.getFirebaseUser()),null);assert.equal(await page.evaluate(()=>isSystemReady),false);assert.equal(await page.locator('#welcomeAuthBlock').isVisible(),true);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('reload never automatically adopts a saved project owned by another signed-in account',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.evaluate(async()=>{
            const saved=getProjectDataPayload();saved.ownerUid='another-user';saved.projectName='Other owner';
            await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_NAME,'readwrite');tx.objectStore(STORE_NAME).put(saved,'latest_save');tx.oncomplete=resolve;tx.onerror=reject;});isSystemReady=false;
        });await page.reload();await page.waitForFunction(()=>!!window.getFirebaseUser?.()&&reloadResumeAttempted);
        assert.equal(await page.evaluate(()=>isSystemReady),false);assert.equal(await page.locator('#welcomeAuthBlock').isVisible(),true);assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('floor sections overlay the illustration with aligned ground and compact information on the left',async()=>{
    const {context,page,errors}=await openApp({initialSession:true});
    try{
        await startRenderProject(page);await page.locator('#btnOverview').click();await page.waitForFunction(()=>document.getElementById('overviewArtwork').naturalWidth>0);
        const scene=await page.locator('.overview-scene').boundingBox(),panel=await page.locator('.overview-floor-panel').boundingBox(),art=await page.locator('#overviewArtwork').boundingBox(),ground=await page.locator('[data-overview-floor="1PP"]').boundingBox();
        assert.ok(scene.x+scene.width<=panel.x);assert.ok(art.x>=panel.x&&art.x+art.width<=panel.x+panel.width+1);assert.ok(Math.abs(art.y+art.height*.676-ground.y)<1);
        assert.equal(await page.locator('#overviewStage .modal-blueprint-host').count(),0);
        const first=page.locator('[data-overview-floor="6NP"]');
        const selected=page.locator('.overview-floor[aria-current="true"]');
        const background=locator=>locator.evaluate(el=>getComputedStyle(el).backgroundColor);
        const transparent='rgba(0, 0, 0, 0)';
        await page.locator('#overviewProjectTitle').hover();
        assert.equal(await background(first),transparent);
        assert.equal(await background(page.locator('[data-overview-floor="1PP"]')),transparent);
        assert.notEqual(await background(selected),transparent);
        assert.ok(await page.locator('.overview-floor').evaluateAll(buttons=>buttons.every(button=>{
            const style=getComputedStyle(button);
            return style.borderRadius==='0px'&&style.borderWidth==='0px'&&style.boxShadow==='none';
        })));
        await first.hover();
        assert.notEqual(await background(first),transparent);
        assert.equal(await page.locator('#overviewDetailFloor').textContent(),'6NP');
        for (const label of ['6NP', '3PP']) {
            const floor = page.locator(`[data-overview-floor="${label}"]`);
            await floor.hover();
            const row = await floor.boundingBox();
            const details = await page.locator('#overviewFloorDetails').boundingBox();
            assert.ok(Math.abs(details.y + details.height / 2 - (row.y + row.height / 2)) < 2);
        }
        await page.locator('#overviewProjectTitle').hover();
        assert.equal(await background(first),transparent);
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'transparent-floor-sections.png')});
        assert.deepEqual(errors,[]);
    }finally{await context.close();}
});

test('SK has an independent networking catalog, vector exports, native round trip and rejects other applications',{skip:process.env.TEST_PRODUCT!=='SK'},async()=>{
    const{context,page,errors}=await openApp({initialSession:true,company:true});
    try{
        await page.evaluate(()=>window.skAssetsReady);
        assert.equal(await page.locator('.welcome-brand').innerText(),'SK');
        assert.equal(await page.locator('#deviceSetTools [data-type^="sk_"]').count(),30);
        assert.equal(await page.locator('#deviceSetTools [data-type="pir"]').count(),0);
        assert.equal(await page.locator('#togglePirCoverage').isVisible(),false);
        await startRenderProject(page);
        const result=await page.evaluate(async()=>{
            const floor=floors[currentFloorIndex];floor.devices=SK_CATALOG.map((d,i)=>({id:`fire-${i}`,type:d.type,x:120+(i%8)*100,y:120+Math.floor(i/8)*100,number:i+1,loopId:1,rotation:0,manualName:d.code,isMainPanel:i===0}));
            floor.cables=floor.devices.slice(1).map((d,i)=>{const cable={id:`wire-${i}`,fromId:'fire-0',toId:d.id};recalcCableHandles(cable,floor.devices[0],d);return cable;});
            floor.legend={visible:true,x:1050,y:120,scale:1,entries:SK_CATALOG.map(d=>({type:d.type,label:d.labels[0],shapes:[]}))};
            const svg=new SVGPlanContext(1500,900),dxf=new DXFPlanContext(1500,900);for(const d of floor.devices){drawDevice(svg,d,true,'light');drawDevice(dxf,d,true,'light');}
            const payload=getProjectDataPayload(),restored=await loadFloorsImages(payload.floors);await saveToDB({skipCloudSync:true});
            const state={product:APP_PRODUCT,database:db.name,key:productStorageKey('test'),types:restored[currentFloorIndex].devices.map(d=>d.type),assets:skSymbolAssets.size,svg:svg.toSVG(),dxf:dxf.toDXF(),checks:evaluateProjectReadiness({name:'Fire test',floors}).checks,tag:payload.application};
            state.fullSvg=(await makePlanOutput(floor,{paper:'a4',orientation:'auto',dpi:96,theme:'light',coverage:false},true)).svg;state.fullDxf=makePlanDXF(floor,{paper:'a4',orientation:'auto',dpi:96,theme:'light',coverage:false}).dxf;
            state.roundtrip=await importFileContent(new File([JSON.stringify(payload)],'fire.TECH',{type:'application/json'}));
            setTimeout(()=>document.querySelector('#appDialog .goom-dialog-close')?.click(),200);
            state.wrong=await importFileContent(new File([JSON.stringify({...payload,application:'PZTS'})],'intrusion.TECH',{type:'application/json'}));return state;
        });
        assert.equal(result.product,'SK');assert.equal(result.database,'GooM_SK_V1');assert.equal(result.key,'test:SK');assert.equal(result.tag,'SK');assert.equal(result.assets,31);assert.equal(new Set(result.types).size,31);assert.equal(result.roundtrip,true);assert.equal(result.wrong,false);assert.ok(result.checks.find(c=>c.id==='devices').complete);assert.ok(result.checks.find(c=>c.id==='cables').complete);assert.match(result.svg,/RACK/);assert.match(result.svg,/RJ45/);assert.match(result.svg,/PoE/);assert.doesNotMatch(result.svg,/NaN|Infinity|<image/);assert.doesNotMatch(result.fullSvg,/NaN|Infinity/);assert.doesNotMatch(result.fullDxf,/NaN|Infinity/);assert.match(result.fullSvg,/RACK/);assert.match(result.dxf,/ENTITIES/);assert.match(result.dxf,/RACK/);assert.doesNotMatch(result.dxf,/NaN|Infinity/);
        await dismissOnboarding(page);if(await page.locator('#appDialog').isVisible())await page.locator('#appDialogConfirm').click();await page.locator('#btnLogo').click();await page.locator('#btnMenuSave').click();await page.locator('#saveModal').waitFor({state:'visible'});assert.equal(await page.locator('#projectReadiness [data-check="devices"]').getAttribute('class'),'complete');
        if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'.qa-sk-editor.png')});assert.deepEqual(errors,[]);
    }finally{await context.close();}
});


test('palette selection preserves placed devices and breaks the placement chain',async()=>{
 const{context,page,errors}=await openApp({initialSession:true});try{await startRenderProject(page);await dismissOnboarding(page);await chooseDetector(page);
 const before=await page.evaluate(()=>{const floor=floors[currentFloorIndex];const buttons=[...document.querySelectorAll('#deviceSetTools .device-btn[data-type]')].filter(b=>b.dataset.type!=='plainText'&&b.dataset.type!=='textNode'&&!/^cctv_(bullet|dome|ptz)$/.test(b.dataset.type));const a=buttons[0].dataset.type,b=buttons[1].dataset.type;floor.devices=[{id:'placed',type:a,x:170,y:180,loopId:1,customIcon:[{type:'circle',x:0,y:0,radius:4}]}];floor.cables=[];activeDeviceIds=new Set(['placed']);return {a,b,data:JSON.stringify(floor.devices)};});
 await page.locator('#deviceSetTools [data-type="'+before.b+'"]').click();assert.equal(await page.evaluate(()=>JSON.stringify(floors[currentFloorIndex].devices)),before.data);assert.equal(await page.evaluate(()=>activeDeviceIds.size),0);assert.equal(await page.evaluate(()=>selectedTool),before.b);
 const box=await page.locator('#canvasContainer').boundingBox();await page.mouse.click(box.x+400,box.y+300);const after=await page.evaluate(()=>({devices:floors[currentFloorIndex].devices,cables:floors[currentFloorIndex].cables}));assert.equal(after.devices[0].type,before.a);assert.equal(after.devices[1].type,before.b);assert.equal(after.cables.length,0);assert.equal(await page.locator('.app-title .goom-site-link').count(),0);assert.equal(await page.locator('#mainMenuModal .goom-site-link').getAttribute('href'),'https://goom.cz/');
 const strip=page.locator('#deviceSetTools');await strip.evaluate(el=>{el.style.maxWidth='180px';el.style.width='180px';el.scrollLeft=0;});await strip.hover();await page.mouse.wheel(0,200);await page.waitForFunction(()=>document.getElementById('deviceSetTools').scrollLeft>0);assert.equal(await page.locator('.device-strip-progress').isVisible(),true);const bar=await page.locator('.device-strip-progress span').evaluate(el=>({height:el.offsetHeight,color:getComputedStyle(el).backgroundColor,transform:getComputedStyle(el).transform}));assert.equal(bar.height,3);assert.equal(bar.color,'rgb(52, 56, 61)');assert.notEqual(bar.transform,'none');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('detailed mapped scene renders roads, green areas and water in line and illustrated modes and survives save',async()=>{
 const{context,page,errors}=await openApp({initialSession:true,company:true,satelliteFixtures:true,buildingFixtures:true});try{await startRenderProject(page);await dismissOnboarding(page);await page.locator('#btnLogo').click();await page.locator('#btnMenuSatellite').click();await page.locator('#satelliteSearchInput').fill('50.087, 14.421');await page.locator('#satelliteSearchSubmit').click();await page.waitForFunction(()=>!document.getElementById('satelliteMapAdd').disabled);await page.locator('#satelliteMapAdd').click();await page.waitForFunction(()=>!!floors[currentFloorIndex].satellite?.mapScene);
 const result=await page.evaluate(()=>{const f=floors[currentFloorIndex],before=f.imgData,scene=f.satellite.mapScene,mono=new SVGPlanContext(f.image.width,f.image.height),cartoon=new SVGPlanContext(f.image.width,f.image.height);drawPlanSource(mono,f,'light');f.planTheme='cartoon';drawPlanSource(cartoon,f);const loaded=sanitizeFloors(getProjectDataPayload().floors)[currentFloorIndex];return {roads:scene.roads.length,green:scene.green.length,water:scene.water.length,buildings:f.satellite.buildingOutlines.rings.length,mono:mono.toSVG(),cartoon:cartoon.toSVG(),loaded:loaded.satellite.mapScene,theme:loaded.planTheme,same:f.imgData===before,cacheDifferent:getLightPlanImage(f.image,f.satellite)!==getLightPlanImage(f.image,f.satellite,true)};});assert.ok(result.roads&&result.green&&result.water&&result.buildings);assert.match(result.mono,/#9da3a6/);assert.match(result.cartoon,/#dce8c9/);assert.match(result.cartoon,/#e4e0d6/);assert.doesNotMatch(result.cartoon,/<image/);assert.equal(result.theme,'cartoon');assert.equal(result.loaded.roads.length,result.roads);assert.equal(result.same,true);assert.equal(result.cacheDifferent,true);
 if(process.env.TEST_SCREENSHOT_DIR){const realPath=resolve(__dirname,'../.qa-real-map-scene.json');if(require('node:fs').existsSync(realPath)){const real=JSON.parse(await readFile(realPath,'utf8'));await page.evaluate(real=>{const f=floors[currentFloorIndex];Object.assign(f.satellite,real);f.planTheme='cartoon';changeFloor();requestRedraw();},real);}await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'map-illustrated.png')});await page.locator('#btnLogo').click();assert.notEqual(await page.locator('#mainMenuModal .main-menu-content').evaluate(el=>getComputedStyle(el).backgroundImage),'none');await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'shared-gradient-menu.png')});}assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('a trusted paid license for another editor opens the whole suite without an administrator role',async()=>{const{context,page,errors}=await openApp({initialSession:true});try{await page.evaluate(()=>firebase.firestore().collection('cloudLicenses').doc('test-user').set({uid:'test-user',plan:'pro',source:'stripe',status:'active',paymentStatus:'paid',billingMode:'annual',applications:['EPS'],applicationExpiresAt:{EPS:{seconds:Date.now()/1000+900}},applicationPlans:{EPS:'pro'}}));await page.waitForFunction(()=>hasProAccess());assert.equal(await page.evaluate(()=>hasOwnPaidPro()),true);assert.equal(await page.evaluate(()=>hasAdminAccess()),false);assert.equal(await page.evaluate(()=>getOwnProTier()),'pro');assert.deepEqual(errors,[]);}finally{await context.close();}});

test('tablet palette swipes horizontally while retaining a thin progress indicator',async()=>{const{context,page,errors}=await openApp({initialSession:true,contextOptions:{viewport:{width:1024,height:768},hasTouch:true,isMobile:false}});try{await startRenderProject(page);await dismissOnboarding(page);await chooseDetector(page);const strip=page.locator('#deviceSetTools');await strip.evaluate(el=>{el.style.width='180px';el.style.maxWidth='180px';el.scrollLeft=0;});const box=await strip.boundingBox(),cdp=await context.newCDPSession(page),y=box.y+box.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+160,y}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+160-i*16,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>document.getElementById('deviceSetTools').scrollLeft>20);assert.equal(await page.locator('.device-strip-progress').isVisible(),true);assert.equal(await page.locator('.device-strip-progress').evaluate(el=>el.offsetHeight),1);await cdp.detach();assert.deepEqual(errors,[]);}finally{await context.close();}});

test('short desktop welcome keeps usable controls and scrollbars have no arrows',async()=>{const{context,page,errors}=await openApp({contextOptions:{viewport:{width:960,height:400}}});try{const body=page.locator('#welcomeModal .welcome-step-content');const style=await body.evaluate(el=>({width:getComputedStyle(el,'::-webkit-scrollbar').width,arrow:getComputedStyle(el,'::-webkit-scrollbar-button').display,thumb:getComputedStyle(el,'::-webkit-scrollbar-thumb').backgroundColor,height:el.clientHeight}));assert.equal(style.width,'3px');assert.equal(style.arrow,'none');assert.equal(style.thumb,'rgb(69, 73, 77)');assert.ok(style.height>=150,JSON.stringify(style));await page.locator('#btnGoogleSignIn').scrollIntoViewIfNeeded();assert.equal(await page.locator('#btnGoogleSignIn').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'welcome-short.png')});assert.deepEqual(errors,[]);}finally{await context.close();}});

test('common menu link and drawing settings work in Basic and Polish without changing project content',{timeout:25000},async()=>{const{context,page,errors}=await openApp({initialSession:true});try{await page.locator('[data-language-select]').first().evaluate(select=>{if(![...select.options].some(x=>x.value==='pl'))throw Error('Missing Polish option');select.value='pl';select.dispatchEvent(new Event('change',{bubbles:true}));});await startRenderProject(page);await dismissOnboarding(page);assert.equal(await page.locator('.app-title .goom-site-link').count(),0);await page.locator('#btnLogo').click();const site=page.locator('#mainMenuModal .goom-site-link'),feedback=page.locator('#btnOpenFeedback');assert.equal(await site.getAttribute('target'),'_blank');assert.ok((await site.boundingBox()).y<(await feedback.boundingBox()).y);if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'common6-menu.png')});await page.keyboard.press('Escape');await page.locator('#btnDetectionSettings').click();assert.equal(await page.locator('#detectionSettingsModal').isVisible(),true);assert.equal(await page.locator('#planSettingsTitle').innerText(),'USTAWIENIA PLANU I WARSTW');assert.equal(await page.evaluate(()=>hasProAccess()),false);const sensitive=await page.locator('label[for=wallThresholdInput]').textContent();assert.equal(sensitive,'Czułość rozpoznawania ścian');if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'common6-settings.png')});await page.selectOption('#planThemeInput','original');await page.locator('#wallThresholdInput').fill('550');await page.locator('#btnSaveDetectionSettings').click();assert.equal(await page.evaluate(()=>getPlanTheme(floors[currentFloorIndex])),'original');assert.ok(await page.evaluate(()=>Math.abs(floors[currentFloorIndex].wallThreshold-140.25)<.001));await page.locator('#btnLogo').click();assert.match(await page.locator('#btnMenuNew').textContent(),/Nowy projekt/);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>getGoomLocale()),'pl-PL');assert.match(await page.evaluate(()=>tr('Sběrnice {0}',12)),/12/);await page.evaluate(()=>{projectName='Nazwa użytkownika';});await page.reload();await page.waitForFunction(()=>document.documentElement.lang==='pl');assert.deepEqual(errors,[]);}finally{await context.close();}});

test('program feedback hides after daily submission and stays hidden when reopened',async()=>{const{context,page,errors}=await openApp({initialSession:true});try{await page.selectOption('[data-language-select]','ru',{force:true});await startRenderProject(page);await dismissOnboarding(page);await page.locator('#btnLogo').click();await page.locator('#btnOpenFeedback').click();await page.waitForFunction(()=>!document.getElementById('feedbackMessage').hidden&&!document.getElementById('btnFeedbackSend').disabled);await page.locator('#feedbackMessage').fill('Нужна дополнительная функция в программе.');await page.locator('#btnFeedbackSend').click();await page.waitForFunction(()=>document.getElementById('feedbackStatus').textContent.includes('за сегодня'));assert.equal(await page.locator('#feedbackMessage').isVisible(),false);assert.equal(await page.locator('#btnFeedbackSend').isVisible(),false);assert.equal(await page.evaluate(()=>testFeedbackCalls.filter(x=>x.action==='feedback').length),1);await page.locator('#btnFeedbackClose').click();await page.locator('#btnOpenFeedback').click();await page.waitForFunction(()=>document.getElementById('feedbackStatus').textContent.includes('за сегодня'));assert.equal(await page.locator('#feedbackMessage').isVisible(),false);assert.deepEqual(errors,[]);}finally{await context.close();}});

test('compact account shows Polish, support address and live Cloud quota with new plan names',async()=>{const{context,page,errors}=await openApp({initialSession:true,company:true});try{await startRenderProject(page);await dismissOnboarding(page);await page.locator('#arrowTabBtn').click();await page.locator('.sliding-row-container').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));});const oldStripStyle=await page.locator('#deviceSetTools').evaluate(el=>{const old=el.style.cssText;el.style.maxWidth='200px';el.style.width='200px';el.scrollLeft=0;return old;});await page.locator('.device-strip-progress').waitFor({state:'visible'});const handle=await page.locator('.device-strip-progress span').boundingBox();assert.ok(handle.width>=22&&handle.width<=36);assert.equal(handle.height,3);await page.locator('#deviceSetTools').hover();await page.mouse.wheel(0,220);await page.waitForFunction(()=>document.getElementById('deviceSetTools').scrollLeft>0);assert.notEqual(await page.locator('.device-strip-progress span').evaluate(el=>el.style.transform),'translateX(0px)');await page.locator('#deviceSetTools').evaluate((el,old)=>el.style.cssText=old,oldStripStyle);await page.locator('#btnOpenCloudProjectsToolbar').click();await page.waitForFunction(()=>document.getElementById('cloudCapacity').dataset.state==='ready');assert.equal(await page.locator('#cloudCapacity').getAttribute('data-free'),'4');assert.ok(await page.locator('#cloudCapacity path').evaluateAll(paths=>paths.every(p=>p.getAttribute('d')==='M8 112 A52 52 0 0 0 8 8')));assert.equal(await page.locator('#cloudCapacity').getAttribute('data-used'),'1');assert.equal(await page.locator('#cloudCapacity .capacity-fill:visible').count(),1);assert.equal(await page.locator('#accountCloudTitle').textContent(),'Cloud');await page.locator('.account-language-controls .ui-select-trigger').click();const polish=page.getByRole('option',{name:'Polski',exact:true});assert.equal(await polish.isVisible(),true);const pos=await polish.boundingBox();assert.ok(pos.y+pos.height<=await page.evaluate(()=>innerHeight));await polish.click();await page.waitForFunction(()=>document.documentElement.lang==='pl');assert.match(await page.locator('#accountCloudInfo').textContent(),/Wolne miejsca/);if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'compact7-account.png')});await page.locator('#btnUpdatePro').click();assert.deepEqual(await page.locator('#proBasicTitle,#proStandardTitle,#proCompanyTitle').allTextContents(),['Free','Pro','Team']);assert.match(await page.locator('.pro-plan-standard').textContent(),/profesjonalny/);await page.locator('#btnProClose').click();await page.locator('#btnAccountCloudProjects').click();await page.locator('.cloud-project-delete').first().click();await page.locator('#appDialogConfirm').click();await page.waitForFunction(()=>document.getElementById('cloudCapacity').getAttribute('data-free')==='5');assert.equal(await page.locator('#cloudCapacity .capacity-fill:visible').count(),0);await page.locator('#btnCloudProjectsClose').click();await page.locator('#btnLogo').click();await page.locator('#btnOpenFeedback').click();await page.waitForFunction(()=>!document.getElementById('btnFeedbackSend').disabled);assert.equal(await page.locator('#feedbackEmail').textContent(),'support@goom.cz');assert.equal(await page.locator('#feedbackEmail').getAttribute('href'),'mailto:support@goom.cz');assert.equal(await page.locator('#feedbackReply').textContent().then(t=>t.includes('test@example')),false);assert.deepEqual(errors,[]);}finally{await context.close();}});


test('shared format: Free previews do not alter the plan and pricing stays centred',async()=>{
 const{context,page,errors}=await openApp({initialSession:true});try{
  await startRenderProject(page);await dismissOnboarding(page);await chooseDetector(page);const before=await page.evaluate(()=>JSON.stringify({icons:customDeviceIcons,floors:getProjectDataPayload().floors}));
  await page.locator('#btnCycleToolbarMenu').click();await page.waitForFunction(()=>displayedToolbarMenu.id==='pro');assert.equal(await page.evaluate(()=>displayedToolbarMenu.id),'pro');assert.equal(await page.locator('#deviceSetTools').getAttribute('data-preview-locked'),'true');
  await page.locator('#deviceSetTools .device-btn:visible').first().click();assert.equal(await page.evaluate(()=>selectedTool),'select');assert.equal(await page.locator('#projectUpgradeHint').isVisible(),true);assert.equal(await page.evaluate(()=>JSON.stringify({icons:customDeviceIcons,floors:getProjectDataPayload().floors})),before);
  await page.locator('#btnCycleToolbarMenu').click();await page.waitForFunction(()=>displayedToolbarMenu.id==='default');assert.equal(await page.evaluate(()=>displayedToolbarMenu.id),'default');assert.equal(await page.locator('#deviceSetTools').getAttribute('data-preview-locked'),'false');
  await page.evaluate(()=>window.openProjectUpgrade());for(const viewport of [{width:1900,height:900},{width:768,height:900},{width:390,height:844}]){await page.setViewportSize(viewport);const card=await page.locator('#proUpgradeModal .pro-pricing').boundingBox(),note=await page.locator('#proSuiteNote').boundingBox();assert.ok(Math.abs(card.x+card.width/2-viewport.width/2)<2,JSON.stringify(card));assert.ok(note.x>=card.x&&note.x+note.width<=card.x+card.width+1);assert.ok(await page.locator('#proUpgradeModal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
  if(process.env.TEST_SCREENSHOT_DIR){await page.setViewportSize({width:1900,height:900});await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'shared8-pricing.png')});}assert.equal(await page.evaluate(()=>testAuthPersistence),'session');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('shared infrastructure: main route accepts a branch and floor passages retain destinations',async()=>{
 const{context,page,errors}=await openApp({initialSession:true});try{
  await startRenderProject(page);await dismissOnboarding(page);await chooseDetector(page);const box=await page.locator('#canvasContainer').boundingBox();
  await page.locator('#deviceSelector [data-type=trunkTool]').click();await page.mouse.click(box.x+170,box.y+160);await page.mouse.click(box.x+460,box.y+160);assert.equal(await page.evaluate(()=>floors[currentFloorIndex].cables.filter(c=>c.kind==='trunk').length),1);
  await page.locator('#deviceSelector [data-type=floorPassage]').click();await page.mouse.click(box.x+330,box.y+340);const passage=await page.evaluate(()=>({...floors[currentFloorIndex].devices.find(d=>d.type==='floorPassage')}));assert.equal(passage.ownerApplication,await page.evaluate(()=>APP_PRODUCT));
  await page.evaluate(()=>{selectedTool='select';activeDeviceIds.clear();});await page.mouse.click(box.x+330,box.y+340);await page.waitForFunction(()=>activeDeviceIds.size===1);await page.mouse.click(box.x+310,box.y+160);assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices.filter(d=>d.attachedCableId).length),1);assert.equal(await page.evaluate(()=>floors[currentFloorIndex].cables.length),2);
  await page.evaluate(()=>{selectedTool='select';activeDeviceIds.clear();});await page.mouse.dblclick(box.x+330,box.y+340);await page.locator('#passageSettingsModal').waitFor({state:'visible'});await page.locator('#passageTargetFloor').evaluate(select=>select.value='2NP');await page.locator('#passageName').fill('Riser A');await page.locator('#passageSettingsModal button[type=submit]').click();
  assert.equal(await page.evaluate(()=>getProjectDataPayload().floors[currentFloorIndex].devices.find(d=>d.type==='floorPassage').targetFloorName),'2NP');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('export stock symbol library',{skip:!process.env.TEST_EXPORT_SYMBOLS},async()=>{const{context,page,errors}=await openApp({initialSession:true});try{await startRenderProject(page);await page.evaluate(()=>window.epsAssetsReady||window.skAssetsReady||Promise.resolve());const symbols=await page.evaluate(()=>Object.fromEntries([...new Set([...toolbarMenuTypes.map(t=>t.type),'trunkJunction'])].filter(type=>!['textNode','plainText','cableTool','trunkTool'].includes(type)).map(type=>[type,{...recordSharedSymbol({id:'stock',type,ownerApplication:APP_PRODUCT,x:0,y:0,rotation:0},14),stock:true}])));await require('node:fs/promises').writeFile(resolve('.qa-stock-'+(process.env.TEST_PRODUCT||'PZTS')+'.json'),JSON.stringify(symbols));assert.deepEqual(errors,[]);}finally{await context.close();}});

test('shared project: EPS and CCTV exchange protected vectors and restore their own editable devices',{skip:!['PZTS',undefined].includes(process.env.TEST_PRODUCT)},async()=>{
 const source=await openApp({initialSession:true,product:'EPS',path:'EPS/'}),target=await openApp({initialSession:true,product:'CCTV',path:'.qa-cctv-feature-20261118/'});try{
  for(const app of [source,target]){await startRenderProject(app.page);await dismissOnboarding(app.page);}
  const payload=await source.page.evaluate(async()=>{await window.epsAssetsReady;const f=floors[currentFloorIndex];f.devices=[{id:'eps-owned',type:'eps_smoke',x:100,y:120,rotation:23,loopId:1,manualName:'EPS detector'}];calculateDynamicNumbersGlobal(floors);return getProjectDataPayload();});assert.ok(payload.floors[payload.currentFloorIndex].devices[0].portableSymbol.ops.length>10);
  assert.equal(await target.page.evaluate(async data=>importFileContent(new File([JSON.stringify(data)],'example.TECH',{type:'application/json'})),payload),true);
  const original=await target.page.evaluate(()=>JSON.stringify(floors[currentFloorIndex].devices[0]));
  const position=await target.page.evaluate(()=>{const d=floors[currentFloorIndex].devices[0];return{x:d.x*scale+offsetX,y:d.y*scale+offsetY};}),box=await target.page.locator('#canvasContainer').boundingBox();await target.page.mouse.move(box.x+position.x,box.y+position.y);await target.page.mouse.down();await target.page.mouse.move(box.x+position.x+65,box.y+position.y+35,{steps:5});await target.page.mouse.up();assert.equal(await target.page.evaluate(()=>JSON.stringify(floors[currentFloorIndex].devices[0])),original);
  await target.page.evaluate(()=>{const d=floors[currentFloorIndex].devices[0];activeDeviceIds.add(d.id);openNumberModal(d);startDeviceRotation(1,15);});assert.equal(await target.page.evaluate(()=>editingDevice===null),true);await target.page.keyboard.press('Delete');assert.equal(await target.page.evaluate(()=>floors[currentFloorIndex].devices.length),1);
  const stable=await target.page.evaluate(()=>{const d=floors[currentFloorIndex].devices[0],paint=theme=>{const c=document.createElement('canvas');c.width=c.height=140;drawDevice(c.getContext('2d'),{...d,x:60,y:60},true,theme);return c.toDataURL();};document.getElementById('deviceSizeSlider').value='32';return paint('dark')===paint('original');});assert.equal(stable,true);assert.equal(await target.page.evaluate(()=>JSON.stringify(floors[currentFloorIndex].devices[0])),original);
  const mixed=await target.page.evaluate(()=>{const f=floors[currentFloorIndex];activeDeviceIds.clear();placePlanDevice(f,{id:'cctv-owned',type:'cctv_bullet',x:260,y:220,rotation:0,loopId:1});calculateDynamicNumbersGlobal(floors);return getProjectDataPayload();});assert.equal(mixed.format,'TECH');assert.deepEqual(mixed.floors[mixed.currentFloorIndex].devices.map(d=>d.ownerApplication),['EPS','CCTV']);
  assert.equal(await source.page.evaluate(async data=>importFileContent(new File([JSON.stringify(data)],'mixed.TECH',{type:'application/json'})),mixed),true);assert.equal(await source.page.evaluate(()=>document.getElementById('deviceSizeSlider').value),'16');assert.equal(await source.page.evaluate(()=>isOwnPlanEntity(floors[currentFloorIndex].devices[0])),true);assert.equal(await source.page.evaluate(()=>isOwnPlanEntity(floors[currentFloorIndex].devices[1])),false);
  assert.deepEqual(source.errors,[]);assert.deepEqual(target.errors,[]);
 }finally{await source.context.close();await target.context.close();}
});

test('coverage radius follows symbol size and legacy foreign symbols remain visible',async()=>{const{context,page,errors}=await openApp({initialSession:true});try{await startRenderProject(page);const product=await page.evaluate(()=>APP_PRODUCT);if(['PZTS','CCTV'].includes(product)){const result=await page.evaluate(()=>{const f=floors[currentFloorIndex];f.wallMask=null;const d={id:'range',ownerApplication:APP_PRODUCT,type:APP_PRODUCT==='CCTV'?'cctv_bullet':'pir',x:100,y:100,rotation:0};const radius=()=>Math.max(...getPIRCoveragePoints(f,d).map(p=>Math.hypot(p.x-d.x,p.y-d.y)));document.getElementById('deviceSizeSlider').value='16';const large=radius();document.getElementById('deviceSizeSlider').value='8';return{large,small:radius()};});assert.ok(Math.abs(result.small/result.large-.5)<.001);}const legacy={application:product==='EPS'?'PZTS':'EPS',deviceSize:16,projectName:'Legacy',currentFloorIndex:0,floors:[{name:'1NP',devices:[{id:'legacy',type:product==='EPS'?'pir':'eps_smoke',x:100,y:100,rotation:0,number:3,loopId:1}],cables:[]}]};assert.equal(await page.evaluate(async data=>importFileContent(new File([JSON.stringify(data)],'legacy.cctv',{type:'application/json'})),legacy),true);const symbol=await page.evaluate(()=>floors[currentFloorIndex].devices[0].portableSymbol);assert.ok(symbol.ops.length>10);assert.equal(symbol.address.number,'3');assert.deepEqual(errors,[]);}finally{await context.close();}});


test('large desktop uses palette width and larger dialogs while cloud fills occupied slots',async()=>{
 const{context,page,errors}=await openApp({initialSession:true,company:true,contextOptions:{viewport:{width:3840,height:2160}}});try{
 await startRenderProject(page);await dismissOnboarding(page);await page.locator('#arrowTabBtn').click();await page.locator('.sliding-row-container').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));});
 const strip=await page.locator('#deviceSetTools').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(strip.width>1300,JSON.stringify(strip));assert.ok(strip.scroll<=strip.width+1,JSON.stringify(strip));assert.equal(await page.locator('.device-strip-progress').isVisible(),false);
 assert.equal(await page.locator('#btnAccountAdmin').getAttribute('target'),null);await page.locator('#btnOpenToolbarMenuEditor').click();const box=await page.locator('#iconEditorModal .modal-content').boundingBox();assert.ok(box.width>1800,JSON.stringify(box));assert.ok(box.y>=0&&box.y+box.height<=2160);
 if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'workspace9-editor-4k.png')});
 await page.locator('#btnIconEditorClose').click();await page.locator('#btnOpenCloudProjectsToolbar').click();await page.waitForFunction(()=>document.getElementById('cloudCapacity').dataset.state==='ready');assert.equal(await page.locator('#cloudCapacity').getAttribute('data-used'),'1');assert.equal(await page.locator('#cloudCapacity .capacity-fill:visible').count(),1);
 await page.locator('#userAccountModal').evaluate(el=>el.style.display='none');await page.locator('#btnOverview').click();assert.match(await page.locator('#overviewArtwork').getAttribute('src'),/^NP\.png/);await page.waitForFunction(()=>document.getElementById('overviewArtwork').naturalWidth>0);if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'workspace9-building-'+(process.env.TEST_PRODUCT||'PZTS')+'.png')});assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('drag and drop imports DXF and TECH, preserves devices and rejects unknown XCX without changes',async()=>{
 const{context,page,errors}=await openApp({initialSession:true,renderLibraries:true});try{await startRenderProject(page);await dismissOnboarding(page);
 const dxf=['0','SECTION','2','ENTITIES','0','LINE','8','0','10','0','20','0','11','100','21','80','0','ENDSEC','0','EOF'].join('\n');
 await page.evaluate(text=>{const f=floors[currentFloorIndex];f.devices=[{id:'kept',ownerApplication:APP_PRODUCT,type:APP_PRODUCT==='CCTV'?'cctv_nvr':'panel',x:60,y:60,loopId:1}];const transfer=new DataTransfer();transfer.items.add(new File([text],'drop.dxf'));document.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));},dxf);
 await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].sourceName==='drop.dxf');assert.ok(await page.evaluate(()=>floors[currentFloorIndex].vectorPlan.paths.length>0));assert.equal(await page.evaluate(()=>floors[currentFloorIndex].devices[0].id),'kept');
 const before=await page.evaluate(()=>JSON.stringify(getProjectDataPayload()));await page.evaluate(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['unknown binary'],'unknown.xcx'));document.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));});await page.locator('#appDialogConfirm').click();assert.equal(await page.evaluate(()=>JSON.stringify(getProjectDataPayload())),before);
 await page.evaluate(()=>{const payload=getProjectDataPayload();payload.projectName='Dropped TECH';const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(payload)],'drop.TECH'));document.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));});await page.waitForFunction(()=>projectName==='Dropped TECH');assert.equal(await page.locator('#fileDropOverlay').isVisible(),false);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('real DWG imports locally as vectors through picker and an invalid drawing preserves the plan',{skip:!require('node:fs').existsSync(resolve('.qa-dwg-research/entities-2d.dwg'))},async()=>{
 const{context,page,errors}=await openApp({initialSession:true,renderLibraries:true,dwgConverter:true});try{await startRenderProject(page);await dismissOnboarding(page);await page.locator('#imageLoader').setInputFiles(resolve('.qa-dwg-research/entities-2d.dwg'));await page.waitForFunction(()=>isSystemReady&&floors[currentFloorIndex].sourceName==='entities-2d.dwg',null,{timeout:45000});const result=await page.evaluate(()=>{const f=floors[currentFloorIndex],out=new SVGPlanContext(f.vectorPlan.width,f.vectorPlan.height);drawVectorPlan(out,f.vectorPlan,'light');return{paths:f.vectorPlan.paths.length,svg:out.toSVG()};});assert.ok(result.paths>0);assert.doesNotMatch(result.svg,/NaN|Infinity/);if(await page.locator('#appDialogConfirm').isVisible())await page.locator('#appDialogConfirm').click();const before=await page.evaluate(()=>JSON.stringify(getProjectDataPayload()));await page.locator('#imageLoader').setInputFiles({name:'invalid.dwg',mimeType:'application/octet-stream',buffer:Buffer.from('broken DWG')});await page.locator('#appDialogConfirm').click();assert.equal(await page.evaluate(()=>JSON.stringify(getProjectDataPayload())),before);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});


test('wire crossings use bridges without connecting unrelated devices and remain editable and exportable',async()=>{
 const{context,page,errors}=await openApp({initialSession:true});try{await startRenderProject(page);await dismissOnboarding(page);const result=await page.evaluate(()=>{const f=floors[currentFloorIndex];f.image=null;f.devices=[['a',80,160],['b',520,160],['c',280,70],['d',280,450]].map(([id,x,y])=>({id,x,y,type:'floorPassage',ownerApplication:APP_PRODUCT,rotation:0}));f.cables=[{id:'horizontal',fromId:'a',toId:'b',h1x:150,h1y:160,h2x:360,h2y:160,h3x:440,h3y:160},{id:'vertical',fromId:'c',toId:'d',h1x:280,h1y:100,h2x:280,h2y:250,h3x:280,h3y:350}];f.showConnections=true;const before=JSON.stringify({devices:f.devices,cables:f.cables}),plan=getCablePaintPlan(f),out=new SVGPlanContext(640,520);drawFloorData(out,f,true,'dark');const bridge=plan.get('horizontal').flat().find(p=>p.kind==='bridge');return{count:plan.crossings,bridge,svg:out.toSVG(),same:before===JSON.stringify({devices:f.devices,cables:f.cables}),hit:hitTestCables(280,153,f,true),cached:getCablePaintPlan(f)===plan};});assert.equal(result.count,1);assert.ok(result.bridge);assert.match(result.svg,/[Cc][\d .,-]+/);assert.doesNotMatch(result.svg,/NaN|Infinity/);assert.equal(result.same,true);assert.equal(result.cached,true);assert.equal(result.hit,'horizontal');const corner=await page.evaluate(()=>{const f=floors[currentFloorIndex];f.cables[0].h2x=280;const plan=getCablePaintPlan(f);const gaps=plan.get('horizontal').flat().filter(e=>e.kind==='gap');f.cables[0].h2x=360;return{crossings:plan.crossings,gaps:gaps.length};});assert.equal(corner.crossings,1);assert.equal(corner.gaps,2);await page.evaluate(()=>{offsetX=60;offsetY=20;scale=1;requestRedraw();});if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'clarity10-crossings-'+(process.env.TEST_PRODUCT||'PZTS')+'.png')});assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('loading whale stays still, Cloud grows upward and the closed toolbar has no seam',async()=>{
 const{context,page,errors}=await openApp({initialSession:true,company:true});try{await startRenderProject(page);await dismissOnboarding(page);const busy=await page.evaluate(()=>{window.testBusyEnd=startGoomBusy();return getComputedStyle(document.querySelector('.goom-busy-whale img')).animationName;});assert.equal(busy,'none');const shine=await page.locator('.busy-whale-mark').evaluate(el=>getComputedStyle(el,'::after').animationName);assert.equal(shine,'whale-light-sweep');await page.evaluate(()=>testBusyEnd());const border=await page.locator('.sliding-row-container').evaluate(el=>{el.classList.remove('open');return getComputedStyle(el).borderBottomWidth;});assert.equal(border,'0px');await page.locator('#btnOpenCloudProjectsToolbar').click();await page.waitForFunction(()=>document.getElementById('cloudCapacity').dataset.state==='ready');assert.equal(await page.locator('#cloudCapacity .capacity-value').evaluate(el=>getComputedStyle(el).fontSize),'16px');assert.equal(await page.locator('#cloudCapacity .capacity-fill').first().getAttribute('d'),'M8 112 A52 52 0 0 0 8 8');assert.equal(await page.locator('#cloudCapacity .capacity-fill').first().getAttribute('stroke'),'#0284c7');if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'clarity10-cloud-'+(process.env.TEST_PRODUCT||'PZTS')+'.png')});assert.deepEqual(errors,[]);
 }finally{await context.close();}
});


test('centred detector palette keeps native passage and main-route icons in every preview and fits narrow screens',async()=>{
 const{context,page,errors}=await openApp({initialSession:true,contextOptions:{viewport:{width:1920,height:1080}}});try{await startRenderProject(page);await dismissOnboarding(page);await page.locator('#arrowTabBtn').click();await page.locator('.sliding-row-container').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));});
 const textButtons=await page.locator('#textTools .device-btn').allTextContents();const panel=await page.locator('#deviceSelector').boundingBox();assert.ok(panel.width>1700&&panel.width<=1800);assert.ok(Math.abs(panel.x+panel.width/2-960)<2);
 const layout=await page.locator('#deviceSetTools').evaluate(el=>{const box=el.getBoundingClientRect(),children=[...el.children].filter(c=>!c.hidden&&c.getBoundingClientRect().width>0).map(c=>c.getBoundingClientRect());return{left:Math.min(...children.map(b=>b.left)),right:Math.max(...children.map(b=>b.right)),center:box.x+box.width/2,scroll:el.scrollWidth,width:el.clientWidth};});assert.ok(layout.scroll<=layout.width+1);assert.ok(Math.abs((layout.left+layout.right)/2-layout.center)<2,JSON.stringify(layout));
 for(const type of ['floorPassage','trunkTool'])assert.equal(await page.locator('#deviceSetTools [data-type='+type+'] svg').count(),1);
 assert.equal(await page.locator('[data-type=floorPassage] svg path').first().getAttribute('d'),'M7 17 17 7M10 7h7v7');
 await page.locator('#btnCycleToolbarMenu').click();await page.waitForFunction(()=>displayedToolbarMenu.id==='pro');for(const type of ['floorPassage','trunkTool'])assert.equal(await page.locator('#deviceSetTools [data-type='+type+'] svg').count(),1);await page.locator('#deviceSetTools [data-type=floorPassage]').click();assert.equal(await page.evaluate(()=>selectedTool),'floorPassage');await page.locator('#btnCycleToolbarMenu').click();await page.waitForFunction(()=>displayedToolbarMenu.id==='default');for(const type of ['floorPassage','trunkTool'])assert.equal(await page.locator('#deviceSetTools [data-type='+type+'] svg').count(),1);
 assert.deepEqual(await page.locator('#textTools .device-btn').allTextContents(),textButtons);const symbol=await page.evaluate(()=>recordSharedSymbol({id:'arrow',ownerApplication:APP_PRODUCT,type:'floorPassage',x:0,y:0,rotation:0},14));assert.ok(symbol.ops.some(op=>op[0]==='moveTo'&&op[1]===-6&&op[2]===6));assert.ok(symbol.ops.some(op=>op[0]==='lineTo'&&op[1]===6&&op[2]===-6));
 if(process.env.TEST_SCREENSHOT_DIR)await smoothScreenshot(page,{path:resolve(process.env.TEST_SCREENSHOT_DIR,'centred11-palette-'+(process.env.TEST_PRODUCT||'PZTS')+'.png')});
 await page.setViewportSize({width:768,height:900});const start=await page.locator('#deviceSetTools').evaluate(el=>{el.scrollLeft=0;const first=[...el.children].find(c=>!c.hidden&&c.getBoundingClientRect().width>0);return{first:first.getBoundingClientRect().left,left:el.getBoundingClientRect().left};});assert.ok(start.first>=start.left-1,JSON.stringify(start));await page.locator('#deviceSetTools').evaluate(el=>el.scrollLeft=el.scrollWidth);const end=await page.locator('#deviceSetTools').evaluate(el=>{const children=[...el.children].filter(c=>!c.hidden&&c.getBoundingClientRect().width>0);return{last:children.at(-1).getBoundingClientRect().right,right:el.getBoundingClientRect().right};});assert.ok(end.last<=end.right+1,JSON.stringify(end));assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
