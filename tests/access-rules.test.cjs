const { before, after, beforeEach, test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, setLogLevel, writeBatch, query, limit } = require('firebase/firestore');
const { ref, uploadString, getBytes } = require('firebase/storage');
const cloudRequire = createRequire(resolve(__dirname, '../functions/package.json'));
const { initializeApp, deleteApp } = cloudRequire('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = cloudRequire('firebase-admin/firestore');
const { getStorage } = cloudRequire('firebase-admin/storage');
const { createCloudProjectService } = require('../cloud-functions/cloud-projects.cjs');
const { revokeCloudLinks } = require('../functions/revoke-cloud-links.cjs');
let environment;
function emulatorAddress(value, fallback) {
    const address = new URL(`http://${value || fallback}`);
    return { host: address.hostname, port: Number(address.port) };
}
const ico = '27082440';
const profile = (accountType = 'company', companyIco = ico) => ({
    displayName: 'Test company', email: 'owner@example.test', accountType, ico: accountType === 'company' ? companyIco : '',
    locale: 'cs', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
});
const license = (uid = 'owner', applications = ['PZTS']) => ({ uid, plan: 'pro', status: 'active', paymentStatus: 'paid', source: 'stripe', billingMode: 'monthly', applicationExpiresAt: Object.fromEntries(applications.map(app => [app, new Date(Date.now()+86400000)])), applications, licenseId: 'PZTS-PRO-TEST', keySuffix: 'TEST', expiresAt: null, issuedAt: serverTimestamp(), updatedAt: serverTimestamp() });
const signedIn = (uid = 'owner', verified = true) => environment.authenticatedContext(uid, { email: 'owner@example.test', email_verified: verified });
async function trustedLicense(data = license()) {
    await environment.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), `cloudLicenses/${data.uid}`), data);
    });
}
async function trustedProject(path, name = 'Stored project', fileName = 'project.json') {
    await environment.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), path), { name, storagePath: `${path}/${fileName}` });
        await uploadString(ref(context.storage(), `${path}/${fileName}`), '{}');
    });
}
before(async () => {
    setLogLevel('silent');
    environment = await initializeTestEnvironment({ projectId: process.env.GCLOUD_PROJECT || 'demo-goom',
        firestore: { ...emulatorAddress(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080'), rules: readFileSync(resolve(__dirname, '..', process.env.TEST_FIRESTORE_RULES_FILE || 'firestore.rules'), 'utf8') },
        storage: { ...emulatorAddress(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199'), rules: readFileSync(resolve(__dirname, '../storage.rules'), 'utf8') }
    });
});
beforeEach(async () => { await environment.clearFirestore(); await environment.clearStorage(); });
after(async () => { await environment?.cleanup(); });

test('clients cannot bypass the shared daily quota with direct feedback writes', async () => {
    const identity = { email: 'author@example.test', name: 'Author', email_verified: true };
    const author = environment.authenticatedContext('author', identity).firestore();
    const unverified = environment.authenticatedContext('author', { ...identity, email_verified: false }).firestore();
    const admin = signedIn('reviewer').firestore();
    const visitor = environment.unauthenticatedContext().firestore();
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'goomAdmins/reviewer'), { role: 'admin' }));

    function send(db, fields = {}) {
        const entry = doc(collection(db, 'goomFeedback'));
        const batch = writeBatch(db);
        batch.set(entry, { uid: 'author', email: identity.email, name: identity.name, application: 'PZTS',
            message: 'First line\nSecond line', sentAt: serverTimestamp(), ...fields });
        batch.set(doc(db, 'goomFeedbackSenders/author'), { messageId: entry.id, sentAt: serverTimestamp() });
        return { id: entry.id, result: batch.commit() };
    }

    await assertFails(send(unverified).result);
    await assertFails(send(author, { email: 'other@example.test' }).result);
    await assertFails(send(author, { name: 'Other' }).result);
    await assertFails(send(author, { message: ' \n ' }).result);
    const message = send(author);
    await assertFails(message.result);
    await environment.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'goomFeedback',message.id),{uid:'author',email:identity.email,name:identity.name,application:'PZTS',message:'First line\nSecond line',sentAt:new Date()}));
    await assertFails(send(author).result);
    await assertFails(getDoc(doc(author, 'goomFeedback', message.id)));
    await assertFails(getDocs(query(collection(visitor, 'goomFeedback'), limit(25))));
    await assertFails(updateDoc(doc(admin, 'goomFeedback', message.id), { message: 'Changed' }));
    const received = await assertSucceeds(getDocs(query(collection(admin, 'goomFeedback'), limit(25))));
    assert.deepEqual(received.docs.map(entry => entry.data().email), [identity.email]);
    assert.equal(received.docs[0].data().message, 'First line\nSecond line');
});

test('a personal account can save its profile but cannot create a key or cloud project', async () => {
    const db = signedIn().firestore();
    await assertSucceeds(setDoc(doc(db, 'users/owner'), profile('personal')));
    await assertFails(setDoc(doc(db, 'cloudLicenses/owner'), license()));
    await assertFails(setDoc(doc(db, 'users/owner/projects/test'), { name: 'Blocked' }));
});

test('only administrators can mark feedback read or delete it without editing its contents', async () => {
    const admin = signedIn('reviewer').firestore(), author = signedIn('author').firestore();
    await environment.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await setDoc(doc(db, 'goomAdmins/reviewer'), { role: 'admin' });
        await setDoc(doc(db, 'goomFeedback/message'), { uid: 'author', email: 'owner@example.test', name: 'Author', message: 'Keep the content', application: 'PZTS', sentAt: new Date() });
    });
    const message = doc(admin, 'goomFeedback/message');
    await assertFails(updateDoc(doc(author, 'goomFeedback/message'), { readAt: serverTimestamp(), readBy: 'author' }));
    await assertFails(updateDoc(message, { readAt: serverTimestamp(), readBy: 'someone-else' }));
    await assertFails(updateDoc(message, { message: 'Changed', readAt: serverTimestamp(), readBy: 'reviewer' }));
    await assertSucceeds(updateDoc(message, { readAt: serverTimestamp(), readBy: 'reviewer' }));
    assert.equal((await getDoc(message)).data().message, 'Keep the content');
    await assertSucceeds(updateDoc(message, { readAt: null, readBy: null }));
    await assertFails(deleteDoc(doc(author, 'goomFeedback/message')));
    await assertSucceeds(deleteDoc(message));
});

test('active time is private, monotonic, bounded by elapsed time and isolated to its application', async () => {
    const user = signedIn().firestore(), stranger = signedIn('stranger').firestore(), admin = signedIn('reviewer').firestore();
    await assertSucceeds(setDoc(doc(user, 'users/owner'), profile('personal')));
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'goomAdmins/reviewer'), { role: 'admin' }));
    const path = 'goomEditorUsage/owner', ref = doc(user, path);
    const usage = (seconds, apps = {}) => ({ application: 'PZTS', activeSeconds: seconds, applications: { PZTS: seconds, EPS: 0, CCTV: 0, SK: 0, ...apps }, updatedAt: serverTimestamp() });
    await assertFails(setDoc(ref, usage(60)));
    await assertSucceeds(setDoc(ref, usage(0)));
    await assertFails(getDoc(doc(stranger, path)));
    await assertSucceeds(getDoc(doc(admin, path)));
    await assertFails(setDoc(ref, usage(60)));
    await environment.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), path), { updatedAt: new Date(Date.now() - 65000) }));
    await assertFails(setDoc(ref, usage(120)));
    await assertFails(setDoc(ref, usage(30, { PZTS: 20, CCTV: 10 })));
    await assertFails(setDoc(doc(stranger, path), usage(30)));
    await assertSucceeds(setDoc(ref, usage(60)));
    await assertFails(setDoc(ref, usage(0)));
    await assertFails(setDoc(ref, usage(120)));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(getDocs(query(collection(admin, 'goomEditorUsage'), limit(25))));
    await assertFails(getDocs(collection(admin, 'goomEditorUsage')));
    await assertFails(getDocs(query(collection(user, 'goomEditorUsage'), limit(25))));
});
test('shared toolbar presets can only be published by admins and PROJECT requires access', async () => {
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'goomAdmins/publisher'), { role: 'admin' }));
    await trustedLicense(license('customer'));
    const admin = signedIn('publisher').firestore();
    const free = signedIn('basic').firestore();
    const paid = signedIn('customer').firestore();
    const unverified = signedIn('publisher', false).firestore();
    const path = preset => `goomToolbarPresets/PZTS/sets/${preset}`;
    const data = { name: 'Published menu', deviceTypes: ['panel', 'expander', 'abax', 'keypad', 'pir', 'pir_wl', 'magnet', 'magnet_wl', 'glassbreak', 'panic', 'siren', 'acs_module', 'acs_reader', 'smoke', 'textNode'], iconsJson: '{}' };
    await assertSucceeds(setDoc(doc(admin, path('default')), data));
    await assertSucceeds(setDoc(doc(admin, path('pro')), data));
    await assertSucceeds(getDoc(doc(free, path('default'))));
    await assertSucceeds(getDoc(doc(paid, path('pro'))));
    await assertFails(getDoc(doc(free, path('pro'))));
    await assertFails(setDoc(doc(paid, path('pro')), data));
    await assertFails(setDoc(doc(free, path('default')), data));
    await assertFails(setDoc(doc(unverified, path('default')), data));
    await assertFails(setDoc(doc(admin, path('personal')), data));
    await assertFails(setDoc(doc(admin, path('default')), { ...data, deviceTypes: ['invalid'] }));
});
test('EPS publishes its complete catalog without granting access to intrusion or camera presets',async()=>{
    const code=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../EPS/eps-catalog.js'),'utf8');
    const catalog=JSON.parse(code.match(/const EPS_CATALOG=([\s\S]*?);\nconst/)[1]);
    await environment.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'goomAdmins/publisher'),{role:'admin'}));
    await trustedLicense(license('customer',['EPS']));
    const admin=signedIn('publisher').firestore(),basic=signedIn('basic').firestore(),customer=signedIn('customer').firestore();
    const data={name:'EPS',deviceTypes:[...catalog.map(d=>d.type),'textNode'],iconsJson:'{}'},preset='goomToolbarPresets/EPS/sets/';
    await assertSucceeds(setDoc(doc(admin,preset+'default'),data));await assertSucceeds(setDoc(doc(admin,preset+'pro'),data));
    await assertSucceeds(getDoc(doc(basic,preset+'default')));await assertSucceeds(getDoc(doc(customer,preset+'pro')));await assertFails(getDoc(doc(basic,preset+'pro')));
    await assertFails(setDoc(doc(basic,preset+'default'),data));await assertFails(setDoc(doc(customer,preset+'default'),data));
    for(const type of ['pir','acs_reader','cctv_bullet'])await assertFails(setDoc(doc(admin,preset+'default'),{...data,deviceTypes:[type]}));
    await assertFails(setDoc(doc(admin,'goomToolbarPresets/PZTS/sets/default'),data));await assertFails(setDoc(doc(admin,'goomToolbarPresets/CCTV/sets/default'),data));
    await assertFails(setDoc(doc(admin,preset+'default'),{...data,deviceTypes:[...data.deviceTypes,'panel']}));
});
test('SK menus accept networking devices while keeping fire, camera and intrusion catalogs separate',async()=>{
    const code=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../SK/sk-catalog.js'),'utf8');
    const catalog=JSON.parse(code.match(/const SK_CATALOG=([\s\S]*?);\nconst/)[1]);
    await environment.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'goomAdmins/publisher'),{role:'admin'}));
    await trustedLicense(license('customer',['SK']));
    const admin=signedIn('publisher').firestore(),basic=signedIn('basic').firestore(),customer=signedIn('customer').firestore();
    const data={name:'SK',deviceTypes:[...catalog.map(d=>d.type),'textNode'],iconsJson:'{}'},preset='goomToolbarPresets/SK/sets/';
    await assertSucceeds(setDoc(doc(admin,preset+'default'),data));await assertSucceeds(setDoc(doc(admin,preset+'pro'),data));
    await assertSucceeds(getDoc(doc(basic,preset+'default')));await assertSucceeds(getDoc(doc(customer,preset+'pro')));await assertFails(getDoc(doc(basic,preset+'pro')));
    await assertFails(setDoc(doc(basic,preset+'default'),data));await assertFails(setDoc(doc(customer,preset+'default'),data));
    for(const type of ['pir','eps_smoke','cctv_bullet'])await assertFails(setDoc(doc(admin,preset+'default'),{...data,deviceTypes:[type]}));
    for(const product of ['PZTS','EPS','CCTV'])await assertFails(setDoc(doc(admin,`goomToolbarPresets/${product}/sets/default`),data));
});
test('CCTV publishes its own device presets and does not mix them with PZTS', async () => {
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'goomAdmins/publisher'), { role: 'admin' }));
    const admin = signedIn('publisher').firestore();
    const basic = signedIn('basic').firestore();
    const cameras = { name: 'Default', deviceTypes: ['cctv_bullet', 'cctv_dome', 'cctv_ptz', 'cctv_nvr', 'cctv_poe', 'textNode'], iconsJson: '{}' };
    await assertSucceeds(setDoc(doc(admin, 'goomToolbarPresets/CCTV/sets/default'), cameras));
    await assertSucceeds(setDoc(doc(admin, 'goomToolbarPresets/CCTV/sets/pro'), cameras));
    const premium = 'goomToolbarPresets/CCTV/premiumSets/shared-12345678-abcd-1234-abcd-123456789012';
    await assertSucceeds(setDoc(doc(admin, premium), cameras));
    await assertSucceeds(updateDoc(doc(admin, premium), { name: 'Updated cameras' }));
    await assertSucceeds(getDoc(doc(basic, 'goomToolbarPresets/CCTV/sets/default')));
    await assertFails(setDoc(doc(basic, 'goomToolbarPresets/CCTV/sets/default'), cameras));
    await assertFails(setDoc(doc(basic, premium), cameras));
    await assertFails(setDoc(doc(admin, 'goomToolbarPresets/PZTS/sets/default'), cameras));
    await assertFails(setDoc(doc(admin, 'goomToolbarPresets/CCTV/sets/default'), { ...cameras, deviceTypes: ['pir'] }));
});

test('admins publish premium menus and only entitled accounts can list and read them', async () => {
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'goomAdmins/publisher'), { role: 'admin' }));
    await trustedLicense(license('customer'));
    await trustedLicense(license('other-program', ['EPS']));
    const admin = signedIn('publisher').firestore();
    const paid = signedIn('customer').firestore();
    const path = 'goomToolbarPresets/PZTS/premiumSets';
    const id = 'shared-12345678-abcd-1234-abcd-123456789012';
    const preset = db => doc(db, path, id);
    const data = { name: 'Dark Style', deviceTypes: ['panel', 'pir', 'smoke'], iconsJson: '{}' };
    await assertSucceeds(setDoc(preset(admin), data));
    await assertSucceeds(getDocs(collection(admin, path)));
    await assertSucceeds(getDocs(collection(paid, path)));
    await assertSucceeds(getDoc(preset(paid)));
    for (const context of [signedIn('free'), signedIn('customer', false), environment.unauthenticatedContext()]) {
        const db = context.firestore();
        await assertFails(getDocs(collection(db, path)));
        await assertFails(getDoc(preset(db)));
    }
    await assertFails(setDoc(preset(paid), data));
    await assertFails(deleteDoc(preset(paid)));
    await assertFails(setDoc(doc(admin, path, 'pro'), data));
    await assertFails(updateDoc(preset(admin), { deviceTypes: ['invalid'] }));
    await assertSucceeds(updateDoc(preset(admin), { name: 'Dark Style 2' }));
    await assertSucceeds(deleteDoc(preset(admin)));
});
test('company registration validates the IČO checksum on the server', async () => {
    const db = signedIn().firestore();
    await assertFails(setDoc(doc(db, 'users/owner'), profile('company', '27082441')));
    await assertFails(setDoc(doc(db, 'users/owner'), profile('company', '123')));
    await assertSucceeds(setDoc(doc(db, 'users/owner'), profile()));
});
test('account profiles accept both newly supported languages', async () => {
    const db = signedIn().firestore();
    const user = doc(db, 'users/owner');
    await assertSucceeds(setDoc(user, { ...profile('personal'), locale: 'de' }));
    await assertSucceeds(updateDoc(user, { locale: 'ru', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(user, { locale: 'unknown', updatedAt: serverTimestamp() }));
});
test('a company without a confirmed email cannot issue a key or upload a file', async () => {
    const context = signedIn('owner', false);
    const db = context.firestore();
    await assertSucceeds(setDoc(doc(db, 'users/owner'), profile()));
    await assertFails(setDoc(doc(db, 'cloudLicenses/owner'), license()));
    await assertFails(uploadString(ref(context.storage(), 'users/owner/projects/test/test.json'), '{}'));
});
test('a verified company still cannot issue its own paid license', async () => {
    const db = signedIn().firestore();
    await setDoc(doc(db, 'users/owner'), profile());
    await assertFails(setDoc(doc(db, 'cloudLicenses/owner'), license()));
    await assertFails(setDoc(doc(db, 'users/owner/projects/test'), { name: 'Blocked' }));
});
test('a trusted paid license enables cloud storage for a verified personal account', async () => {
    const db = signedIn().firestore();
    await setDoc(doc(db, 'users/owner'), profile('personal'));
    await trustedLicense();
    await trustedProject('users/owner/projects/test');
    await assertSucceeds(getDoc(doc(db, 'users/owner/projects/test')));
    await assertFails(setDoc(doc(db, 'users/owner/projects/unauthorized-write'), { name: 'Blocked' }));
});
test('annual licenses and current company seats authorize only the holder’s cloud data', async () => {
    const owner = signedIn();
    const employee = environment.authenticatedContext('employee', { email: 'EMPLOYEE@example.test', email_verified: true });
    const wrongEmail = environment.authenticatedContext('employee', { email: 'other@example.test', email_verified: true });
    const employeeDb = employee.firestore();
    const ownerStorage = owner.storage(), employeeStorage = employee.storage();
    const employeeProject = 'users/employee/projects/work';
    const employeeFile = employeeProject + '/work.json';
    const grantSeat = expiry => trustedLicense({ uid: 'employee', companySeat: { ownerUid: 'owner', email: 'employee@example.test',
        applicationExpiresAt: { PZTS: new Date(expiry) } } });
    await trustedLicense({ ...license(), billingMode: 'annual' });
    await trustedProject('users/owner/projects/team', 'Owner', 'owner.json');
    await assertFails(getBytes(ref(ownerStorage, 'users/owner/projects/team/owner.json')));
    await grantSeat(Date.now() + 86400000);
    await trustedProject(employeeProject, 'Work', 'work.json');
    await assertSucceeds(getDoc(doc(employeeDb, employeeProject)));
    await assertFails(getBytes(ref(employeeStorage, employeeFile)));
    await assertFails(getDoc(doc(wrongEmail.firestore(), employeeProject)));
    await assertFails(getBytes(ref(wrongEmail.storage(), employeeFile)));
    await assertFails(getBytes(ref(ownerStorage, employeeFile)));
    await assertFails(setDoc(doc(employeeDb, 'proCompanyTeams/employee'), { members: [] }));
    await assertFails(getDoc(doc(employeeDb, 'proCompanyTeams/owner')));
    await grantSeat(Date.now() - 1000);
    await assertFails(getDoc(doc(employeeDb, employeeProject)));
    await assertFails(getBytes(ref(employeeStorage, employeeFile)));
});
test('an IČO alone does not grant access before a key is issued', async () => {
    const db = signedIn().firestore();
    await assertSucceeds(setDoc(doc(db, 'users/owner'), profile()));
    await assertFails(getDoc(doc(db, 'users/owner/projects/test')));
});
test('file uploads and downloads require the backend even for the licensed owner', async () => {
    const owner = signedIn();
    const db = owner.firestore();
    await setDoc(doc(db, 'users/owner'), profile());
    await trustedLicense();
    await trustedProject('users/owner/projects/test', 'Allowed', 'test.json');
    await assertFails(uploadString(ref(owner.storage(), 'users/owner/projects/other/test.json'), '{}', 'raw', { contentType: 'application/json' }));
    await assertFails(getBytes(ref(owner.storage(), 'users/owner/projects/test/test.json')));
    const other = signedIn('other');
    const otherDb = other.firestore();
    await assertFails(getDoc(doc(otherDb, 'users/owner')));
    await assertFails(getDoc(doc(otherDb, 'cloudLicenses/owner')));
    await assertFails(getDoc(doc(otherDb, 'users/owner/projects/test')));
    await assertFails(getBytes(ref(other.storage(), 'users/owner/projects/test/test.json')));
});
test('cloud access cannot be granted by adding fields to a personal profile', async () => {
    const db = signedIn().firestore();
    await assertFails(setDoc(doc(db, 'users/owner'), { ...profile('personal'), cloudEnabled: true, keyHash: 'a'.repeat(64) }));
});
test('clients cannot change or delete a server-issued paid license', async () => {
    const db = signedIn().firestore();
    await setDoc(doc(db, 'users/owner'), profile());
    await trustedLicense();
    await assertFails(updateDoc(doc(db, 'cloudLicenses/owner'), { applications: ['PZTS', 'EPS', 'CCTV', 'SK'] }));
    await assertFails(updateDoc(doc(db, 'cloudLicenses/owner'), { uid: 'other', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'cloudLicenses/owner'), { issuedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, 'cloudLicenses/owner')));
});
test('changing company details cannot grant or remove a paid account entitlement', async () => {
    const context = signedIn();
    const db = context.firestore();
    await setDoc(doc(db, 'users/owner'), profile());
    await trustedLicense();
    await trustedProject('users/owner/projects/test', 'Allowed', 'test.json');
    await updateDoc(doc(db, 'users/owner'), { accountType: 'personal', ico: '', updatedAt: serverTimestamp() });
    await assertSucceeds(getDoc(doc(db, 'users/owner/projects/test')));
    await assertFails(getBytes(ref(context.storage(), 'users/owner/projects/test/test.json')));
});
test('legacy free keys and refunded or expired licenses do not enable PRO', async () => {
    const db = signedIn().firestore();
    await trustedLicense({ uid: 'owner', ico, status: 'active', keyHash: 'a'.repeat(64) });
    await assertFails(getDoc(doc(db, 'users/owner/projects/test')));
    await trustedLicense({ ...license(), paymentStatus: 'refunded', status: 'inactive' });
    await assertFails(getDoc(doc(db, 'users/owner/projects/test')));
    await trustedLicense({ ...license(), applicationExpiresAt: { PZTS: new Date(0) } });
    await assertFails(getDoc(doc(db, 'users/owner/projects/test')));
    await assertFails(uploadString(ref(signedIn().storage(), 'users/owner/projects/test/file.json'), '{}'));
    await trustedLicense({ ...license('owner', ['PZTS', 'CCTV']), applicationExpiresAt: { PZTS: new Date(0), CCTV: new Date(Date.now()+86400000) } });
    await assertSucceeds(getDoc(doc(db, 'users/owner/projects/test')));
    await trustedProject('users/owner/apps/CCTV/projects/test');
    await assertSucceeds(getDoc(doc(db, 'users/owner/apps/CCTV/projects/test')));
});
test('legacy paid rights now cover the complete suite, keeping project ownership', async () => {
    const db = signedIn().firestore();
    await trustedLicense(license('owner', ['EPS']));
    await assertSucceeds(getDoc(doc(db, 'users/owner/projects/test')));
    await assertSucceeds(getDoc(doc(db, 'users/owner/apps/EPS/projects/test')));
    await assertSucceeds(getDoc(doc(db, 'users/owner/apps/CCTV/projects/test')));
    await trustedLicense(license('owner', ['PZTS', 'EPS', 'CCTV', 'SK']));
    for (const application of ['PZTS', 'EPS', 'CCTV', 'SK']) await assertSucceeds(getDoc(doc(db, `users/owner/apps/${application}/projects/test`)));
});

test('manual grants unlock only their program and users cannot edit grants, roles or audit', async () => {
    const db = signedIn().firestore();
    const storage = signedIn().storage();
    const grant = { expiresAt: { EPS: new Date(Date.now()+86400000), CCTV: new Date(Date.now()-86400000) } };
    await assertFails(setDoc(doc(db, 'goomProgramGrants/owner'), grant));
    await assertFails(setDoc(doc(db, 'goomAdmins/owner'), { role:'owner' }));
    await assertFails(setDoc(doc(db, 'goomAdminAudit/test'), { actorUid:'owner' }));
    await environment.withSecurityRulesDisabled(async context => {
        const trusted = context.firestore();
        await setDoc(doc(trusted, 'goomProgramGrants/owner'), grant);
        await setDoc(doc(trusted, 'goomAdmins/owner'), { role:'owner' });
    });
    await assertSucceeds(getDoc(doc(db, 'goomProgramGrants/owner')));
    await assertFails(getDoc(doc(signedIn('other').firestore(), 'goomProgramGrants/owner')));
    await assertSucceeds(getDoc(doc(db, 'goomAdmins/owner')));
    await trustedProject('users/owner/apps/EPS/projects/test', 'Granted');
    await assertSucceeds(getDoc(doc(db, 'users/owner/apps/EPS/projects/test')));
    await assertFails(getBytes(ref(storage, 'users/owner/apps/EPS/projects/test/project.json')));
    await assertFails(setDoc(doc(db, 'users/owner/apps/CCTV/projects/test'), { name:'Expired' }));
    await assertFails(uploadString(ref(storage, 'users/owner/apps/CCTV/projects/test/project.json'), '{}'));
    await assertFails(setDoc(doc(signedIn('owner', false).firestore(), 'users/owner/apps/EPS/projects/test'), { name:'Unverified' }));
    await trustedLicense(license('owner', ['PZTS']));
    await assertSucceeds(getDoc(doc(db, 'users/owner/projects/test')));
    await assertFails(getBytes(ref(storage, 'users/owner/apps/EPS/projects/test/project.json')));
});

test('verified administrators have cloud features in every app without a paid license, with ownership and revocation enforced',async()=>{
    const projectId=process.env.GCLOUD_PROJECT||'demo-goom',app=initializeApp({projectId,storageBucket:projectId},'cloud-admin-features');
    try{
        await environment.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'goomAdmins/administrator'),{role:'admin'});});
        const handle=createCloudProjectService({db:getFirestore(app),bucket:getStorage(app).bucket(),timestamp:Timestamp.fromMillis,serverTimestamp:FieldValue.serverTimestamp});
        const auth={uid:'administrator',token:{email_verified:true,email:'admin@example.test'}},saved=[];
        for(const application of ['PZTS','EPS','CCTV','SK']){const result=await handle({auth,data:{action:'save',application,payload:{application,projectName:'Administrator '+application,floors:[{name:'1NP',devices:[],cables:[]}]}}});const downloaded=await handle({auth,data:{action:'download',application,id:result.id,offset:0}});assert.equal(JSON.parse(Buffer.from(downloaded.data,'base64')).application,application);const prefix=application==='PZTS'?'users/administrator/projects':`users/administrator/apps/${application}/projects`;await assertSucceeds(getDoc(doc(environment.authenticatedContext('administrator',auth.token).firestore(),`${prefix}/${result.id}`)));saved.push({application,id:result.id});}
        await trustedLicense(license('owner',['EPS']));await trustedProject('users/owner/apps/EPS/projects/private','Private');await assertFails(getDoc(doc(environment.authenticatedContext('administrator',auth.token).firestore(),'users/owner/apps/EPS/projects/private')));
        await assert.rejects(handle({auth:{...auth,token:{...auth.token,email_verified:false}},data:{action:'download',...saved[0],offset:0}}),{code:'permission-denied'});
        await environment.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),'goomAdmins/administrator'),{role:'reviewer'}));await assert.rejects(handle({auth,data:{action:'download',...saved[0],offset:0}}),{code:'permission-denied'});
    }finally{await deleteApp(app);}
});
test('the trusted backend limits concurrent saves, counts legacy copies and checks size and ownership', async () => {
    const projectId = process.env.GCLOUD_PROJECT || 'demo-goom';
    const app = initializeApp({ projectId, storageBucket: projectId }, 'cloud-quota');
    try {
        await trustedLicense();
        const oldPath = 'users/owner/projects/legacy';
        await trustedProject(oldPath, 'Legacy');
        const bucket = getStorage(app).bucket();
        const handle = createCloudProjectService({ db: getFirestore(app), bucket, timestamp: Timestamp.fromMillis,
            serverTimestamp: FieldValue.serverTimestamp });
        const auth = { uid: 'owner', token: { email_verified: true, email: 'owner@example.test' } };
        const download = (id, options = {}, actor = auth) => handle({ auth: actor, data: { action: 'download', application: 'PZTS', id, offset: 0, ...options } });
        assert.equal(Buffer.from((await download('legacy')).data, 'base64').toString(), '{}');
        const save = (name, extra = {}) => handle({ auth, data: { action: 'save', application: 'PZTS',
            payload: { projectName: name, floors: [{ name: '1NP' }], ...extra } } });
        await assert.rejects(handle({ auth: { ...auth, uid: 'free' }, data: { action: 'save', application: 'PZTS',
            payload: { projectName: 'Blocked', floors: [{}] } } }), { code: 'permission-denied' });
        const results = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => save(`Project ${i + 1}`)));
        const allowed = results.filter(result => result.status === 'fulfilled');
        const blocked = results.filter(result => result.status === 'rejected');
        if (blocked.some(result => result.reason.details?.reason !== 'project-limit')) throw blocked.find(result => result.reason.details?.reason !== 'project-limit').reason;
        if (allowed.length !== 4 || blocked.length !== 2) throw new Error('The server must honor the five-project limit across concurrent saves.');
        const path = `users/owner/projects/${allowed[0].value.id}/project.json`;
        const result = await download(allowed[0].value.id);
        const stored = JSON.parse(Buffer.from(result.data, 'base64').toString());
        assert.equal(stored.floors[0].name, '1NP');
        await assertFails(getBytes(ref(signedIn().storage(), path)));
        await assertFails(getBytes(ref(signedIn('stranger').storage(), path)));
        await assertFails(uploadString(ref(signedIn().storage(), path), '{}'));
        const [metadata] = await bucket.file(path).getMetadata();
        if (metadata.metadata?.firebaseStorageDownloadTokens) throw new Error('The server must not create a bearer download token.');
        await assert.rejects(download(allowed[0].value.id, {}, { ...auth, uid: 'stranger' }), { code: 'permission-denied' });
        await assert.rejects(save('Too big', { extra: 'x'.repeat(24 * 1024 * 1024) }),
            error => error.details?.reason === 'project-size');
        await handle({ auth, data: { action: 'delete', application: 'PZTS', id: 'legacy' } });
        const extra = 'x'.repeat(8 * 1024 * 1024);
        const large = await assertSucceeds(save('Room after delete', { extra }));
        const first = await download(large.id);
        const firstBytes = Buffer.from(first.data, 'base64');
        const remaining = await download(large.id, { offset: firstBytes.length, generation: first.generation });
        assert.equal(firstBytes.length, 8 * 1024 * 1024);
        assert.equal(JSON.parse(Buffer.concat([firstBytes, Buffer.from(remaining.data, 'base64')])).extra, extra);
    } finally { await deleteApp(app); }
});

test('legacy URL revocation is dry-run by default and only removes the link metadata', async () => {
    let metadata = { generation: '4', metageneration: '1', metadata: { firebaseStorageDownloadTokens: 'legacy-test-token', retained: 'yes' } };
    const file = {
        name: 'users/owner/projects/legacy/project.json',
        async getMetadata() { return [metadata]; },
        async setMetadata(patch, preconditions) {
            assert.deepEqual(preconditions, { ifGenerationMatch: '4', ifMetagenerationMatch: '1' });
            assert.deepEqual(patch, { metadata: { firebaseStorageDownloadTokens: null }, cacheControl: 'private, no-store' });
            delete metadata.metadata.firebaseStorageDownloadTokens;
            metadata = { ...metadata, cacheControl: patch.cacheControl };
            return [metadata];
        }
    };
    const bucket = { async getFiles() { return [[file, { ...file, name: 'unrelated/public.json' }], null]; } };
    assert.deepEqual(await revokeCloudLinks(bucket, false), { cloudFiles: 1, oldLinks: 1, revoked: 0, failed: 0 });
    assert.deepEqual(await revokeCloudLinks(bucket, true), { cloudFiles: 1, oldLinks: 1, revoked: 1, failed: 0 });
    assert.equal(metadata.metadata.retained, 'yes');
    assert.equal((await revokeCloudLinks(bucket, false)).oldLinks, 0);
});

test('reviews stay private until moderation and publish only the server experience snapshot',async()=>{
 const {createReviewService}=require('../cloud-functions/reviews.cjs'),projectId=process.env.GCLOUD_PROJECT||'demo-goom',app=initializeApp({projectId},'review-moderation');
 try{const db=getFirestore(app);let now=Date.now();const service=createReviewService({db,getUser:async uid=>({uid,emailVerified:true,displayName:'Account name',email:uid+'@example.test'}),serverTimestamp:FieldValue.serverTimestamp,timestamp:Timestamp.fromMillis,now:()=>now});
 const auth=uid=>({uid,token:{email_verified:true,email:uid+'@example.test'}}),call=(uid,data)=>service.handle({auth:auth(uid),data});
 await db.doc('users/author').set({displayName:'Plan author'});await db.doc('goomEditorUsage/author').set({activeSeconds:18000});await db.doc('goomAdmins/moderator').set({role:'admin'});
 const body={action:'submit',application:'EPS',message:'<script>ignore()</script> A useful tool.',operationId:'operation-review-0001',publishConsent:true,activeSeconds:999999999,uid:'someone-else'};
 const result=await call('author',body);assert.equal(result.status,'sent-today');assert.deepEqual(await call('author',body),result);assert.equal((await service.listPublic()).reviews.length,0);
 assert.equal((await db.doc('goomReviews/'+result.id).get()).data().activeSeconds,18000);
 await assertFails(getDoc(doc(environment.authenticatedContext('author',auth('author').token).firestore(),'goomReviews/'+result.id)));
 for(const uid of ['author','moderator'])await assertFails(setDoc(doc(environment.authenticatedContext(uid,auth(uid).token).firestore(),'goomPublishedReviews/'+result.id),{message:'Bypass moderation',activeSeconds:999999}));
 await assert.rejects(call('outsider',{action:'moderate',id:result.id,decision:'publish'}),{code:'permission-denied'});assert.equal((await call('author',{...body,operationId:'operation-review-0002'})).id,result.id);assert.equal((await call('author',{action:'mine'})).canSubmit,false);
 await assert.rejects(call('author',{...body,publishConsent:false}),{code:'invalid-argument'});await assert.rejects(service.handle({auth:{uid:'author',token:{email_verified:false}},data:body}),{code:'unauthenticated'});
 await db.doc('goomEditorUsage/author').set({activeSeconds:50400});await call('moderator',{action:'moderate',id:result.id,decision:'publish'});
 const published=(await service.listPublic()).reviews[0];assert.equal(published.authorName,'Plan author');assert.equal(published.activeSeconds,18000);assert.equal(published.uid,undefined);assert.equal(published.email,undefined);assert.match(published.message,/<script>/);
 await call('moderator',{action:'moderate',id:result.id,decision:'reject'});assert.equal((await service.listPublic()).reviews.length,0);
 now=Math.max(now+86401000,Date.now()+86401000);const later=await call('author',{...body,operationId:'operation-review-0002'});assert.equal((await db.doc('goomReviews/'+later.id).get()).data().activeSeconds,50400);
 await call('moderator',{action:'moderate',id:later.id,decision:'publish'});await call('moderator',{action:'moderate',id:later.id,decision:'delete'});assert.deepEqual(await call('moderator',{action:'moderate',id:later.id,decision:'delete'}),{status:'deleted'});assert.equal((await db.doc('goomReviews/'+later.id).get()).exists,false);assert.equal((await service.listPublic()).reviews.length,0);
 const batch=db.batch();for(let i=0;i<28;i++){const id='r_'+i.toString(16).padStart(40,'0'),data={authorName:'Author '+i,application:'PZTS',message:'Published text '+i,activeSeconds:i*3600,submittedAt:Timestamp.fromMillis(now),publishedAt:Timestamp.fromMillis(now),uid:'private',email:'private@example.test'};batch.set(db.doc('goomPublishedReviews/'+id),data);batch.set(db.doc('goomReviews/'+id),{...data,status:'published'});}await batch.commit();
 const first=await service.listPublic(),second=await service.listPublic({cursor:first.cursor}),third=await service.listPublic({cursor:second.cursor});assert.equal(first.reviews.length,12);assert.equal(second.reviews.length,12);assert.equal(third.reviews.length,4);assert.equal(new Set([...first.reviews,...second.reviews,...third.reviews].map(r=>r.id)).size,28);assert.equal(first.reviews[0].uid,undefined);assert.equal(first.reviews[0].email,undefined);
 const privatePage=await call('moderator',{action:'list',status:'all'});assert.equal(privatePage.reviews.length,25);assert.ok(privatePage.cursor);await assert.rejects(service.listPublic({cursor:{id:'invalid',time:now}}),{code:'invalid-argument'});
 await db.doc('goomAdmins/moderator').delete();await assert.rejects(call('moderator',{action:'moderate',id:result.id,decision:'publish'}),{code:'permission-denied'});
 }finally{await deleteApp(app);}
});

test('one calendar-day quota is shared by public reviews and feedback across all programs',async()=>{const{createReviewService}=require('../cloud-functions/reviews.cjs'),projectId=process.env.GCLOUD_PROJECT||'demo-goom',app=initializeApp({projectId},'daily-feedback');try{const db=getFirestore(app);let now=Date.parse('2026-11-22T22:59:58Z');const service=createReviewService({db,getUser:async uid=>({uid,emailVerified:true,email:uid+'@example.test',displayName:'Author'}),serverTimestamp:FieldValue.serverTimestamp,timestamp:Timestamp.fromMillis,now:()=>now}),auth={uid:'daily-user',token:{email_verified:true}},call=data=>service.handle({auth,data});const first=await call({action:'submit',message:'Public review',operationId:'operation-daily-0001',publishConsent:true,application:'EPS'});assert.equal(first.submittedToday,true);assert.equal((await db.doc('goomReviews/'+first.id).get()).data().application,'GOOM');for(const application of ['PZTS','EPS','CCTV','SK']){const result=await call({action:'feedback',message:'Another message',application,operationId:'operation-'+application+'-0002'});assert.equal(result.id,first.id);}assert.equal((await db.collection('goomFeedback').get()).size,0);assert.equal((await call({action:'mine'})).canSubmit,false);await assertFails(setDoc(doc(signedIn('daily-user').firestore(),'goomDailySubmissions/daily-user'),{dayKey:'tomorrow'}));now=Date.parse('2026-11-22T23:00:01Z');assert.equal((await call({action:'mine'})).canSubmit,true);const results=await Promise.all(['PZTS','EPS','CCTV','SK'].map(application=>call({action:'feedback',message:'Feedback from '+application,application,operationId:'operation-next-'+application})));assert.equal(new Set(results.map(r=>r.id)).size,1);assert.equal((await db.collection('goomFeedback').get()).size,1);assert.equal((await call({action:'submit',message:'Duplicate public review',publishConsent:true,operationId:'operation-next-public'})).canSubmit,false);assert.equal((await db.collection('goomReviews').get()).size,1);}finally{await deleteApp(app);}});
