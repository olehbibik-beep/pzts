const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp, AggregateField } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { createReviewService } = require('./reviews.cjs');
const { getStorage } = require('firebase-admin/storage');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { createCloudProjectService } = require('./cloud-projects.cjs');
const { createProjectCounter, createPublicStats } = require('./public-stats.cjs');
const historical=require('./community-history.cjs');

initializeApp();
const storageBucket = defineString('GOOM_STORAGE_BUCKET', { default: '' });
const projectCounter=createProjectCounter({db:getFirestore(),serverTimestamp:()=>FieldValue.serverTimestamp()});
const publicStats=createPublicStats({db:getFirestore(),sum:field=>AggregateField.sum(field),historical});
exports.goomProjectCreated=onCall({region:'europe-west1',memory:'256MiB',timeoutSeconds:30,maxInstances:3},projectCounter);
exports.goomPublicStats=onRequest({region:'europe-west1',memory:'256MiB',timeoutSeconds:30,maxInstances:2,cors:true,invoker:'public'},async(req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.set('Allow','GET, HEAD').status(405).end();return;}
    try{const data=await publicStats();res.set('Cache-Control','public, max-age=60, s-maxage=60').status(200).json(data);}
    catch(error){logger.warn('Public statistics unavailable',{code:error.code||'unknown'});res.set('Cache-Control','no-store').status(503).json({error:'Statistics temporarily unavailable'});}
});

exports.goomCloudProjects = onCall({ region: 'europe-west1', timeoutSeconds: 120, memory: '512MiB', concurrency: 2, maxInstances: 10 }, async request => {
    try {
        const handle = createCloudProjectService({ db: getFirestore(), bucket: getStorage().bucket(storageBucket.value() || undefined),
            timestamp: millis => Timestamp.fromMillis(millis), serverTimestamp: () => FieldValue.serverTimestamp(),
            logError: error => logger.warn('Cloud upload cleanup failed', { code: error.code || 'unknown' }) });
        return await handle(request);
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('Cloud project request failed', { code: error.code || 'unknown' });
        throw new HttpsError('internal', 'The cloud project operation could not finish.');
    }
});

const reviews=createReviewService({db:getFirestore(),getUser:uid=>getAuth().getUser(uid),serverTimestamp:()=>FieldValue.serverTimestamp(),timestamp:ms=>Timestamp.fromMillis(ms)});
exports.goomReviews=onCall({region:'europe-west1',memory:'256MiB',timeoutSeconds:30,maxInstances:3},async request=>{try{return await reviews.handle(request);}catch(error){if(error instanceof HttpsError)throw error;logger.warn('Review operation failed',{code:error.code||'unknown'});throw new HttpsError('unavailable','Reviews temporarily unavailable.');}});
exports.goomPublicReviews=onRequest({region:'europe-west1',memory:'256MiB',timeoutSeconds:30,maxInstances:2,cors:true,invoker:'public'},async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.set('Allow','GET, HEAD').status(405).end();return;}
 try{let input={};if(req.query.cursor){if(typeof req.query.cursor!=='string'||req.query.cursor.length>300)throw Error();try{input.cursor=JSON.parse(req.query.cursor);}catch{res.status(400).json({error:'Invalid cursor'});return;}}const result=await reviews.listPublic(input);res.set('Cache-Control','public, max-age=30, s-maxage=30').json(result);}
 catch(error){res.set('Cache-Control','no-store').status(error.code==='invalid-argument'?400:503).json({error:'Reviews temporarily unavailable'});}
});

// Account services have no payment-secret dependency.
const {createAdminService}=require('./account-admin.cjs');
const {createAccountDeletion}=require('./account-deletion.cjs');
const {createCompanySeatService,CompanySeatError}=require('./company-seats.cjs');
exports.goomAdmin=onCall({region:'europe-west1',cors:true,invoker:'public',maxInstances:3,timeoutSeconds:180},async request=>{
 try{return await createAdminService({auth:getAuth(),db:getFirestore(),timestamp:ms=>Timestamp.fromMillis(ms),serverTimestamp:()=>FieldValue.serverTimestamp(),deleteAccount:createAccountDeletion({auth:getAuth(),db:getFirestore(),bucket:getStorage().bucket(storageBucket.value()||undefined),serverTimestamp:()=>FieldValue.serverTimestamp()})})(request);}
 catch(error){if(error instanceof HttpsError)throw error;logger.error('Admin request failed',{code:error.code||'unknown'});throw new HttpsError('unavailable','Administration is temporarily unavailable.');}
});
exports.goomCompanySeats=onCall({region:'europe-west1',cors:true,invoker:'public',maxInstances:3},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in first.');
 try{const seats=createCompanySeatService({db:getFirestore(),getUser:uid=>getAuth().getUser(uid)});if(request.data?.action==='claim')return await seats.claim(request.auth.uid);if(request.data?.action==='save')return await seats.save(request.auth.uid,request.data.emails);throw new HttpsError('invalid-argument','Invalid action.');}
 catch(error){if(error instanceof HttpsError)throw error;if(error instanceof CompanySeatError)throw new HttpsError(error.code,error.message);logger.warn('Company seat request failed',{code:error.code||'unknown'});throw new HttpsError('unavailable','Team service is temporarily unavailable.');}
});
