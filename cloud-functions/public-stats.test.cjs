const{test}=require('node:test'),assert=require('node:assert/strict');
const{createProjectCounter,createPublicStats}=require('./public-stats.cjs');
function fixture(){let clock=10000;const docs=new Map([['users/alice',{displayName:'Private Person'}]]),aggregates=[];
    const ref=path=>({path,doc:id=>ref(path+'/'+id),collection:name=>ref(path+'/'+name),aggregate:fields=>({get:async()=>{aggregates.push({path,fields});return{data:()=>({total:path==='goomEditorUsage'?7200:12})};}})});
    const db={collection:ref,runTransaction:async action=>{const writes=[];const result=await action({get:async r=>({exists:docs.has(r.path),data:()=>docs.get(r.path)}),set:(r,d)=>writes.push([r.path,d])});writes.forEach(([p,d])=>docs.set(p,d));return result;}};
    return{db,docs,aggregates,now:()=>clock,advance:n=>clock+=n,serverTimestamp:()=>{const time=clock;return{toMillis:()=>time};}};
}
test('only verified profiled accounts can record valid project starts; retries count once',async()=>{
    const f=fixture(),record=createProjectCounter(f),request={auth:{uid:'alice',token:{email_verified:true}},data:{application:'PZTS',operationId:'11111111-2222-3333-4444-555555555555'}};
    await assert.rejects(record({...request,auth:null}),{code:'unauthenticated'});await assert.rejects(record({...request,auth:{uid:'alice',token:{email_verified:false}}}),{code:'unauthenticated'});
    await assert.rejects(record({...request,data:{...request.data,application:'OTHER'}}),{code:'invalid-argument'});await assert.rejects(record({...request,auth:{uid:'missing',token:{email_verified:true}}}),{code:'failed-precondition'});
    assert.deepEqual(await record(request),{counted:true});assert.deepEqual(await record(request),{counted:false});assert.equal(f.docs.get('goomProjectCounts/alice').projectsCreated,1);
    const second={...request,data:{application:'CCTV',operationId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'}};await assert.rejects(record(second),{code:'resource-exhausted'});f.advance(1500);await record(second);assert.equal(f.docs.get('goomProjectCounts/alice').projectsCreated,2);
});
test('public statistics return only aggregate totals and coalesce and cache reads',async()=>{
    const f=fixture(),stats=createPublicStats({...f,sum:field=>field});const[a,b]=await Promise.all([stats(),stats()]);assert.deepEqual(a,b);assert.equal(a.projectsCreated,12);assert.equal(a.activeSeconds,7200);assert.equal(a.projectsSince,'2026-11-20');assert.equal(f.aggregates.length,2);assert.equal(JSON.stringify(a).includes('Private Person'),false);await stats();assert.equal(f.aggregates.length,2);f.advance(60001);await stats();assert.equal(f.aggregates.length,4);
});
