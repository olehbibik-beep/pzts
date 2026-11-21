const { HttpsError }=require('firebase-functions/v2/https');
const APPLICATIONS=['PZTS','EPS','CCTV','SK'];
const PROJECTS_SINCE='2026-11-20';
function createProjectCounter({db,serverTimestamp,now=Date.now}){
    return async request=>{
        if(!request.auth?.uid||request.auth.token?.email_verified!==true)throw new HttpsError('unauthenticated','A verified account is required.');
        const{application,operationId}=request.data||{};
        if(!APPLICATIONS.includes(application)||typeof operationId!=='string'||!operationId.match(/^[a-zA-Z0-9-]{16,80}$/))throw new HttpsError('invalid-argument','Invalid project event.');
        const uid=request.auth.uid,profile=db.collection('users').doc(uid),counter=db.collection('goomProjectCounts').doc(uid),event=counter.collection('events').doc(operationId);
        return db.runTransaction(async tx=>{
            const [person,previousEvent,previousCount]=await Promise.all([tx.get(profile),tx.get(event),tx.get(counter)]);
            if(!person.exists)throw new HttpsError('failed-precondition','An account profile is required.');
            if(previousEvent.exists)return{counted:false};
            const previous=previousCount.data()||{},last=previous.updatedAt?.toMillis?.();
            if(Number.isFinite(last)&&now()-last<1000)throw new HttpsError('resource-exhausted','Please retry later.');
            const timestamp=serverTimestamp();
            tx.set(event,{application,createdAt:timestamp});
            tx.set(counter,{projectsCreated:(Number(previous.projectsCreated)||0)+1,updatedAt:timestamp});
            return{counted:true};
        });
    };
}
function createPublicStats({db,sum,now=Date.now,historical={projects:0,activeSeconds:0}}){
    let cached=null,expires=0,pending=null;
    return async()=>{
        if(cached&&now()<expires)return cached;
        if(!pending)pending=Promise.all([
            db.collection('goomProjectCounts').aggregate({total:sum('projectsCreated')}).get(),
            db.collection('goomEditorUsage').aggregate({total:sum('activeSeconds')}).get()
        ]).then(([projects,usage])=>{
            cached={historicalTotals:true,projectsCreated:Math.max(0,Number(projects.data().total)||0)+historical.projects,activeSeconds:Math.max(0,Number(usage.data().total)||0)+historical.activeSeconds,projectsSince:PROJECTS_SINCE,updatedAt:new Date(now()).toISOString()};expires=now()+60000;return cached;
        }).finally(()=>{pending=null;});
        return pending;
    };
}
module.exports={createProjectCounter,createPublicStats};
