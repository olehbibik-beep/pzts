// Uses real Firebase 10.14.1 SDKs against local Authentication, Firestore and Storage emulators.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, basename, extname, sep } = require('node:path');
const { chromium } = require('playwright');
const { createRequire } = require('node:module');
const billingRequire = createRequire(resolve(__dirname, '../functions/package.json'));
const { initializeApp } = billingRequire('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = billingRequire('firebase-admin/firestore');
const { getAuth } = billingRequire('firebase-admin/auth');
const { getStorage } = billingRequire('firebase-admin/storage');
const { fixture } = require('../functions/billing-fixture.cjs');
const { createCloudProjectService } = require('../cloud-functions/cloud-projects.cjs');
const root = resolve(__dirname, '..');
const projectId = process.env.GCLOUD_PROJECT || 'demo-goom';
const bucket = `${projectId}.appspot.com`;
const authOrigin = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`;
const storageOrigin = `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199'}`;
const firestore = new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}`);
let browser, server, origin, adminAuth, adminDb;
before(async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run this test through npm run test:firebase');
    const app = initializeApp({ projectId, storageBucket: bucket }, 'admin-integration');
    adminAuth = getAuth(app);
    adminDb = getFirestore(app);
    const reviews=require('../cloud-functions/reviews.cjs').createReviewService({db:adminDb,getUser:uid=>adminAuth.getUser(uid),timestamp:Timestamp.fromMillis,serverTimestamp:FieldValue.serverTimestamp});
    const cloud = createCloudProjectService({ db: adminDb, bucket: getStorage(app).bucket(),
        timestamp: Timestamp.fromMillis, serverTimestamp: FieldValue.serverTimestamp });
    server = createServer(async (request, response) => {
        if ([`/${projectId}/europe-west1/goomCloudProjects`,`/${projectId}/europe-west1/goomReviews`].includes(request.url) && request.method === 'POST') {
            response.setHeader('Content-Type', 'application/json');
            try {
                const chunks = [];
                for await (const chunk of request) chunks.push(chunk);
                const { data } = JSON.parse(Buffer.concat(chunks));
                const token = await adminAuth.verifyIdToken(request.headers.authorization?.replace(/^Bearer /, ''));
                const result = request.url.endsWith('/goomReviews')?await reviews.handle({auth:{uid:token.uid,token},data}):await cloud({ auth: { uid: token.uid, token }, data });
                response.end(JSON.stringify({ result }));
            } catch (error) {
                response.writeHead(error.httpErrorCode?.status || 500).end(JSON.stringify({ error: error.toJSON?.() || { status: 'INTERNAL', message: error.message } }));
            }
            return;
        }
        const file = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
        if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
        try {
            const data = await readFile(file);
            response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png' })[extname(file)] || 'application/octet-stream');
            response.end(data);
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

async function openApp(path = '/') {
    const context = await browser.newContext();
    await context.route('**/*', async route => {
        const url = route.request().url();
        if (url.startsWith('https://www.gstatic.com/firebasejs/10.14.1/')) {
            const name = basename(new URL(url).pathname);
            let body = await readFile(resolve(root, 'node_modules/firebase', name), 'utf8');
            if (name === 'firebase-auth-compat.js') body += `\nObject.assign(FIREBASE_CONFIG, {projectId:${JSON.stringify(projectId)},storageBucket:${JSON.stringify(bucket)},apiKey:'demo-goom-key',authDomain:'demo-goom.firebaseapp.com'});firebase.initializeApp(FIREBASE_CONFIG);firebase.auth().useEmulator(${JSON.stringify(authOrigin)},{disableWarnings:true});`;
            if (name === 'firebase-firestore-compat.js') body += `\nfirebase.firestore().useEmulator(${JSON.stringify(firestore.hostname)},${Number(firestore.port)});`;
            if (name === 'firebase-functions-compat.js') body += `\nfirebase.app().functions('europe-west1').useEmulator('127.0.0.1',${server.address().port});`;
            return route.fulfill({ contentType: 'text/javascript', body });
        }
        const local = [origin, authOrigin, firestore.origin, storageOrigin].some(prefix => url.startsWith(prefix));
        return local ? route.continue() : route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + path);
    if (path === '/') await page.waitForFunction(() => typeof window.ensureFirebaseSession === 'function' && !document.getElementById('btnGoogleSignIn').disabled);
    return { context, page, errors };
}

test('tab-session login survives reload and switching editors but not closing the last tab',async()=>{
    const email=`session-${Date.now()}@example.test`,password='temporary-session-test-123';
    const user=await adminAuth.createUser({email,password,emailVerified:true,displayName:'Session test'});
    const{context,page,errors}=await openApp();
    try{
        await page.evaluate(async credentials=>{await(await getFirebaseAuth()).signInWithEmailAndPassword(credentials.email,credentials.password);},{email,password});
        await page.waitForFunction(uid=>window.getFirebaseUser()?.uid===uid,user.uid);
        await page.reload();await page.waitForFunction(uid=>window.getFirebaseUser()?.uid===uid,user.uid);
        await page.goto(origin+'/EPS/');await page.waitForFunction(uid=>window.getFirebaseUser()?.uid===uid,user.uid);
        await page.close();const reopened=await context.newPage();await reopened.goto(origin+'/');
        await reopened.waitForFunction(()=>typeof window.ensureFirebaseSession==='function'&&!document.getElementById('btnGoogleSignIn').disabled);
        assert.equal(await reopened.evaluate(()=>window.getFirebaseUser()),null);
        assert.deepEqual(errors,[]);
    }finally{await context.close();await adminAuth.deleteUser(user.uid);}
});

test('real email registration, paid server fulfillment, cloud save/open, and email sign-in', async () => {
    const { context, page, errors } = await openApp();
    const email = `company-${Date.now()}@example.test`;
    try {
        await page.locator('#btnEmailRegister').click();
        await page.locator('#emailDisplayName').fill('Integration Company');
        await page.locator('#emailAuthEmail').fill(email);
        await page.locator('#emailAuthPassword').fill('integration-password-123');
        await page.locator('#emailAuthConfirm').fill('integration-password-123');
        await page.locator('#emailAccountType').selectOption('company');
        await page.locator('#emailCompanyIco').fill('27082440');
        await page.locator('#btnEmailAuthSubmit').click();
        await page.locator('#userAccountModal').waitFor({ state: 'visible' });
        await page.waitForFunction(()=>document.getElementById('accountTypeLabel').textContent==='Firma');
        assert.equal(await page.locator('#accountTypeLabel').textContent(), 'Firma');
        assert.equal(await page.evaluate(() => window.hasCloudAccess()), false);
        const codes = await (await fetch(`${authOrigin}/emulator/v1/projects/${projectId}/oobCodes`)).json();
        const verification = codes.oobCodes.find(code => code.email === email && code.requestType === 'VERIFY_EMAIL');
        assert.ok(verification, 'The Authentication emulator should receive a verification email');
        await page.evaluate(code => firebase.auth().applyActionCode(code), verification.oobCode);
        await page.locator('#btnAccountRefresh').click();
        assert.equal(await page.evaluate(() => window.hasProAccess()), false);
        const uid = await page.evaluate(() => firebase.auth().currentUser.uid);
        const adminApp = initializeApp({ projectId }, `billing-${Date.now()}`);
        const billing = fixture({ db: getFirestore(adminApp), getUser: userId => getAuth(adminApp).getUser(userId), serverTimestamp: () => FieldValue.serverTimestamp() });
        const checkout = await billing.legacyCheckout(uid, 'single', 'PZTS');
        billing.pay(checkout.id);
        await billing.service.processEvent({ type: 'checkout.session.completed', data: { object: { id: checkout.id } } });
        await page.waitForFunction(() => window.hasCloudAccess());
        await page.locator('#btnAccountCloudProjects').waitFor();
        const license = await page.evaluate(async () => (await firebase.firestore().collection('cloudLicenses').doc(firebase.auth().currentUser.uid).get()).data());
        assert.match(license.licenseId, /^PZTS-PRO-[A-F0-9]{24}$/);
        assert.equal(license.keySuffix, license.licenseId.slice(-8));
        assert.equal(await page.locator('#accountCloudKey, #btnAccountCopyKey').count(), 0);
        assert.equal(license.paymentStatus, 'paid');
        await page.locator('#btnAccountClose').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#welcomeProjectNameInput').fill('Firebase integration');
        await page.locator('#btnWelcomeConfirmNaming').click();
        await page.locator('#onboardingSkip').click();
        await page.locator('#btnLogo').click();
        await page.locator('#btnOpenFeedback').click();
        assert.equal(await page.locator('#feedbackEmail').textContent(), 'support@goom.cz');
        await page.waitForFunction(()=>!document.getElementById('btnFeedbackSend').disabled);
        await page.locator('#feedbackMessage').fill('Feedback from the editor');
        await page.locator('#btnFeedbackSend').click();
        await page.locator('#feedbackStatus').getByText('Komentář za dnešek už byl odeslán. Další můžete odeslat zítra.', { exact: true }).waitFor();
        const feedback = await adminDb.collection('goomFeedback').where('uid', '==', uid).get();
        assert.deepEqual(feedback.docs.map(entry => entry.data().message), ['Feedback from the editor']);
        await page.locator('#btnFeedbackClose').click();
        await page.locator('#mainMenuModal').click({ position: { x: 10, y: 10 } });
        await page.locator('#btnOpenCloudProjectsToolbar').click();
        await page.locator('#btnAccountCloudProjects').click();
        await page.locator('#btnCloudSaveCurrent').click();
        await page.locator('.cloud-project-details strong').getByText('Firebase integration', { exact: true }).waitFor();
        assert.equal(await page.locator('.cloud-project-actions').getByRole('button', { name: 'Otevřeno', exact: true }).isDisabled(), true);
        await page.locator('#btnCloudProjectsClose').click();
        await page.evaluate(() => loadDefaultFloors(false, 'Local replacement'));
        await page.evaluate(() => window.openCloudProjects());
        await page.locator('.cloud-project-actions').getByRole('button', { name: 'Otevřít', exact: true }).click();
        await page.locator('#appDialogConfirm').click();
        await page.waitForFunction(() => projectName === 'Firebase integration' && document.getElementById('cloudProjectsModal').style.display === 'none');
        await page.locator('#btnOpenCloudProjectsToolbar').click();
        await page.locator('#btnAccountSignOut').click();
        await page.locator('#btnEmailSignIn').click();
        await page.locator('#emailAuthEmail').fill(email);
        await page.locator('#emailAuthPassword').fill('integration-password-123');
        await page.locator('#btnEmailAuthSubmit').click();
        await page.locator('#btnWelcomeNew').waitFor({ state: 'visible' });
        await page.waitForFunction(() => window.hasCloudAccess());
        const restored = await page.evaluate(async () => (await firebase.firestore().collection('cloudLicenses').doc(firebase.auth().currentUser.uid).get()).data());
        assert.equal(restored.licenseId, license.licenseId);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('central admin panel assigns roles and app-specific access while the server rejects escalation', async () => {
    const password = 'test-admin-passphrase-123';
    const create = name => adminAuth.createUser({ email: `${name}@example.test`, password, emailVerified: true, displayName: name });
    const [owner, operator, customer] = await Promise.all(['Owner', 'Operator', 'Customer'].map(create));
    await adminDb.collection('goomAdmins').doc(owner.uid).set({ role:'owner' });
    await Promise.all([owner, operator, customer].map(user => adminDb.collection('users').doc(user.uid).set({
        displayName: user.displayName, email: user.email, accountType: 'personal', ico: '', locale: 'cs',
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    })));
    await adminDb.collection('cloudLicenses').doc(operator.uid).set({
        uid: operator.uid, plan: 'pro', status: 'active', source: 'stripe', paymentStatus: 'paid', billingMode: 'monthly',
        applications: ['EPS'], applicationExpiresAt: { EPS: new Date(Date.now() + 86_400_000) }
    });
    await adminDb.collection('goomEditorActivity').doc(operator.uid).set({ lastSeen: FieldValue.serverTimestamp(), application: 'EPS' });
    await adminDb.collection('goomFeedback').add({ uid: customer.uid, email: customer.email,
        name: customer.displayName, application: 'PZTS', message: '<b>Feedback</b>', sentAt: FieldValue.serverTimestamp() });
    const {context,page,errors}=await openApp('/admin.html');
    const signIn = async user => {
        await page.locator('#adminLoginForm [name=email]').fill(user.email);
        await page.locator('#adminLoginForm [name=password]').fill(password);
        await page.locator('#adminLoginForm button').click();
    };
    const search = async user => {
        await page.locator('#adminQuery').fill(user.email);
        await page.locator('#adminSearch button[type=submit]').click();
        await page.getByRole('button', { name:`Открыть ${user.email}` }).click();
    };
    const checkRules = (operation, uid) => page.evaluate(async ({ operation, uid }) => {
        const db = firebase.firestore();
        try {
            if (operation === 'list') await db.collection('users').limit(25).get({ source: 'server' });
            if (operation === 'promote') await db.runTransaction(async transaction => {
                transaction.set(db.collection('goomAdmins').doc(uid), { role: 'admin' });
            });
            if (operation === 'purchase') await db.collection('cloudLicenses').doc(uid).get({ source: 'server' });
            if (operation === 'visit') await db.collection('goomEditorActivity').doc(uid).set({
                application: 'PZTS', lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (operation === 'unaudited') await db.runTransaction(async transaction => transaction.set(db.collection('goomProgramGrants').doc(uid), {
                application: 'PZTS', expiresAt: { PZTS: new Date(Date.now() + 86400000) },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(), auditId: 'missing'
            }));
            return 'allowed';
        } catch (error) { return error.code; }
    }, { operation, uid });
    try {
        page.on('dialog', modal => modal.accept());
        await page.waitForFunction(() => !document.getElementById('adminLogin').hidden || document.querySelector('#adminStatus[data-error="true"]'));
        assert.equal(await page.locator('#adminLogin').isVisible(),true,await page.locator('#adminStatus').textContent());
        await signIn(owner);
        await page.locator('#adminWorkspace').waitFor({ state:'visible' });
        assert.deepEqual(await page.locator('#adminPrograms strong').allTextContents(), ['PZTS','EPS','CCTV','SK']);
        await page.getByRole('button', { name: 'Обратная связь', exact: true }).click();
        const feedback = page.locator('#adminFeedback li').filter({ hasText: '<b>Feedback</b>' });
        await feedback.waitFor();
        assert.equal(await feedback.locator('a').getAttribute('href'), `mailto:${customer.email}`);
        assert.equal(await feedback.locator('b').count(), 0);
        await page.getByRole('button', { name: 'Обзор', exact: true }).click();
        await page.locator('#adminPrograms button').filter({ hasText:'EPS' }).click();
        const operatorRow = page.locator('#adminUsers tr').filter({ hasText: operator.email });
        await operatorRow.locator('.subline').filter({hasText:/^До /}).waitFor();
        assert.match(await operatorRow.locator('.activity-column').textContent(), /EPS/);
        assert.equal(await checkRules('purchase', operator.uid), 'allowed');
        assert.equal(await checkRules('visit', operator.uid), 'permission-denied');
        if (process.env.TEST_SCREENSHOT_DIR) {
            await page.screenshot({ path: resolve(process.env.TEST_SCREENSHOT_DIR, 'goom-admin-panel.png') });
            await page.setViewportSize({ width: 820, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: resolve(process.env.TEST_SCREENSHOT_DIR, 'goom-admin-tablet.png') });
            await page.setViewportSize({ width: 1280, height: 720 });
        }
        await page.getByRole('button', { name:'Активность', exact:true }).click();
        await page.locator('#adminVisits li').filter({ hasText: /Operator.*EPS/s }).waitFor();
        await page.getByRole('button', { name:'Pro и доступ', exact:true }).click();
        await operatorRow.locator('.subline').filter({hasText:/^До /}).waitFor();
        const pzts = page.locator('.grant').filter({ has: page.getByRole('heading', { name:'PZTS', exact:true }) });
        await search(owner);
        await pzts.getByRole('button',{name:'Выдать Pro'}).click();
        await page.locator('#adminUserStatus').getByText('Изменения сохранены.').waitFor();
        await pzts.getByRole('button',{name:'Отозвать'}).click();
        await page.locator('#adminEvents li').filter({ hasText: /PZTS — ручной доступ отозван/ }).filter({ hasText: owner.uid }).waitFor({ state: 'attached' });
        assert.equal((await adminDb.collection('goomProgramGrants').doc(owner.uid).get()).data().expiresAt.PZTS, undefined);
        await page.locator('#adminCloseDialog').click();
        await search(operator);
        await page.locator('#adminRole').selectOption('admin');
        await page.locator('#adminRoleForm button').click();
        await page.locator('#adminUserStatus').getByText('Изменения сохранены.').waitFor();
        assert.equal((await adminDb.collection('goomAdmins').doc(operator.uid).get()).data().role, 'admin');
        await page.locator('#adminCloseDialog').click();
        await page.locator('#adminSignOut').click();
        await signIn(operator);
        await page.locator('#adminWorkspace').waitFor({ state:'visible' });
        assert.equal(await checkRules('promote', customer.uid), 'permission-denied');
        assert.equal(await checkRules('unaudited', customer.uid), 'permission-denied');
        assert.equal(await checkRules('purchase', owner.uid), 'permission-denied');
        await search(customer);
        assert.equal(await page.locator('#adminRoleForm').isVisible(),false);
        assert.match(await page.locator('#adminIdentity').textContent(), /Администратор/);
        assert.match(await page.locator('#adminUserUid').textContent(), /Пользователь/);
        assert.equal(await page.getByRole('button',{name:'Выдать Pro'}).count(),4,await page.locator('#adminUserPrograms').textContent());
        await pzts.getByRole('button',{name:'Выдать Pro'}).click();
        await page.locator('#adminUserStatus').getByText('Изменения сохранены.').waitFor();
        assert.ok((await adminDb.collection('goomProgramGrants').doc(customer.uid).get()).data().expiresAt.PZTS.toMillis()>Date.now());
        assert.equal((await adminDb.collection('cloudLicenses').doc(customer.uid).get()).exists,false);
        await page.locator('#adminCloseDialog').click();
        await page.getByRole('button', { name:'Активность', exact:true }).click();
        await page.locator('#adminEvents li').filter({ hasText: /PZTS — доступ до/ }).filter({ hasText: customer.uid }).waitFor();
        await page.locator('#adminSignOut').click();
        await signIn(customer);
        await page.locator('#adminStatus').getByText(/нужны права/).waitFor();
        assert.equal(await page.locator('#adminWorkspace').isVisible(),false);
        assert.equal(await page.locator('#adminUsers tr').count(),0);
        assert.equal(await checkRules('list'), 'permission-denied');
        await page.goto(origin);
        await page.waitForFunction(()=>window.hasProAccess?.());
        await page.waitForFunction(async () => {
            const name = firebase.auth().currentUser?.uid;
            return name && (await firebase.firestore().collection('goomEditorActivity').doc(name).set({
                application: 'PZTS', lastSeen: new Date(0)
            }).then(() => false, error => error.code === 'permission-denied'));
        });
        for (let attempt = 0; attempt < 20; attempt++) {
            if ((await adminDb.collection('goomEditorActivity').doc(customer.uid).get()).exists) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const visit = (await adminDb.collection('goomEditorActivity').doc(customer.uid).get()).data();
        assert.equal(visit?.application, 'PZTS');
        assert.ok(visit.lastSeen.toMillis() > Date.now() - 60_000);
        await page.locator('#btnWelcomeProfile').click();
        await page.locator('#btnAccountCloudProjects').waitFor();
        assert.equal(await page.locator('#btnAccountAdmin').isVisible(), false);
        assert.equal(await page.locator('#accountTypeSelect').count(), 0);
        await adminDb.collection('goomAdmins').doc(customer.uid).set({ role: 'admin' });
        await page.locator('#btnAccountAdmin').waitFor();
        await adminDb.collection('goomAdmins').doc(customer.uid).delete();
        await page.locator('#btnAccountAdmin').waitFor({ state: 'hidden' });
        await page.locator('#btnAccountClose').click();
        await page.locator('#btnWelcomeContinue').click();
        await page.locator('#btnWelcomeNew').click();
        await page.locator('#welcomeProjectNameInput').fill('Manual PRO cloud test');
        await page.locator('#btnWelcomeConfirmNaming').click();
        await page.locator('#onboardingSkip').click();
        await page.locator('#btnOpenCloudProjectsToolbar').click();
        await page.locator('#btnAccountCloudProjects').click();
        await page.locator('#btnCloudSaveCurrent').click();
        await page.locator('#cloudProjectsStatus').getByText('Uloženo v cloudu').waitFor();
        await page.locator('.cloud-project-details strong').getByText('Manual PRO cloud test', { exact: true }).waitFor();
        const collection = adminDb.collection('users').doc(customer.uid).collection('projects');
        const first = (await collection.where('name', '==', 'Manual PRO cloud test').get()).docs[0];
        for (let index = 2; index <= 5; index++) {
            await page.evaluate(name => { projectName = name; }, `Cloud copy ${index}`);
            await page.locator('#btnCloudSaveCurrent').click();
            await page.locator('.cloud-project-details strong').getByText(`Cloud copy ${index}`, { exact: true }).waitFor();
        }
        assert.equal(await page.locator('#cloudProjectCount').textContent(), '5 / 5');
        assert.equal((await first.ref.get()).data().storagePath, first.data().storagePath);
        await page.locator('#btnCloudSaveCurrent').click();
        await page.locator('#appDialogMessage').getByText(/5 projektů/).waitFor();
        await page.locator('#appDialogConfirm').click();
        await page.locator('.cloud-project-row').filter({ hasText: 'Cloud copy 2' }).getByRole('button', { name: 'Odstranit' }).click();
        await page.locator('#appDialogConfirm').click();
        await page.locator('.cloud-project-row').filter({ hasText: 'Cloud copy 2' }).waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#cloudProjectCount').textContent(), '4 / 5');
        await adminDb.collection('goomProgramGrants').doc(customer.uid).delete();
        await page.waitForFunction(()=>!window.hasProAccess());
        assert.deepEqual(errors,[]);
    } finally { await context.close(); }
});


test('EPS and SK open administration in the same signed-in session without editor catalogs',async()=>{
 const app=initializeApp({projectId},'admin-navigation-'+Date.now()),adminDb=getFirestore(app),adminAuth=getAuth(app),email='admin-nav-'+Date.now()+'@example.test',password='integration-password-123';const user=await adminAuth.createUser({email,password,emailVerified:true,displayName:'Admin Navigation'});
 await adminDb.collection('users').doc(user.uid).set({displayName:'Admin Navigation',email,accountType:'personal',ico:'',locale:'cs',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});await adminDb.collection('goomAdmins').doc(user.uid).set({role:'owner'});
 for(const product of ['EPS','SK']){const{context,page,errors}=await openApp('/'+product+'/');try{await page.evaluate(async({email,password})=>{const auth=await getFirebaseAuth();await auth.signInWithEmailAndPassword(email,password);},{email,password});await page.waitForFunction(()=>window.hasAdminAccess?.());await page.goto(origin+'/'+product+'/admin.html');await page.locator('#adminWorkspace').waitFor({state:'visible'});assert.match(await page.locator('#adminIdentity').textContent(),/Владелец/);assert.equal(await page.locator('#adminLogin').isVisible(),false);assert.deepEqual(errors,[]);}finally{await context.close();}}
});
