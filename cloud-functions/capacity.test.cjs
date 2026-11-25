const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCapacityService } = require('./capacity.cjs');
const { createAdminService } = require('./account-admin.cjs');

const row = (id, data) => ({id, data: () => data});
const data = new Map([
    ['users/owner/projects', [row('a', {sizeBytes:1800}), row('!goom-cloud-list', {}), row('old', {})]],
    ['users/owner/apps/EPS/projects', [row('b', {state:'uploading', sizeBytes:1200})]]
]);
const collection = path => ({get: async () => ({docs: data.get(path) || []}), doc: id => ({
    collection: name => collection(`${path}/${id}/${name}`),
    get: async () => row(id, {role: id === 'owner' ? 'owner' : 'admin'})
})});
const db = {collection};

test('capacity counts reservations, skips the lock, and reads only server-side storage metrics', async () => {
    const now = Date.UTC(2026, 10, 25, 12);
    const service = createCapacityService({db, projectId:'demo-goom', bucketName:'demo-goom.firebasestorage.app', now:()=>now,
        credential:{getAccessToken:async () => ({access_token:'test'})}, fetchMetric:async (url, options) => {
            assert.equal(url.hostname, 'monitoring.googleapis.com');
            assert.match(url.searchParams.get('filter'), /demo-goom\.firebasestorage\.app/);
            assert.equal(options.headers.Authorization, 'Bearer test');
            const point = value => ({points:[{interval:{endTime:new Date(now).toISOString()},value:{int64Value:String(value)}}]});
            return {ok:true,json:async()=>({timeSeries:[point(11_000),point(20_000)]})};
        }});
    const result = await service('owner',['PZTS','EPS','SK']);
    assert.deepEqual(result.usage,{bytes:31000,reportedAt:now});
    assert.deepEqual(result.editors,[{application:'PZTS',used:2,available:3,bytes:1800,unmeasured:1},
        {application:'EPS',used:1,available:4,bytes:1200,unmeasured:0},{application:'SK',used:0,available:5,bytes:0,unmeasured:0}]);
});

test('only a verified owner can call capacity and the authenticated UID cannot be overridden', async () => {
    const admin = createAdminService({db, auth:{verifyIdToken:async token=>({uid:token,email_verified:true})},
        capacity:async (uid, editors) => ({uid, editors})});
    const request = uid => ({auth:{uid},rawRequest:{get:()=>`Bearer ${uid}`},data:{action:'capacity',uid:'other'}});
    await assert.rejects(admin(request('admin')), error => error.code === 'permission-denied');
    assert.deepEqual(await admin(request('owner')), {uid:'owner',editors:['PZTS','EPS','CCTV','SK']});
});
