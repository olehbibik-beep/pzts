const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp, AggregateField } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { createCloudProjectService } = require('./cloud-projects.cjs');
const { createProjectCounter, createPublicStats } = require('./public-stats.cjs');

initializeApp();
const storageBucket = defineString('GOOM_STORAGE_BUCKET', { default: '' });
const projectCounter=createProjectCounter({db:getFirestore(),serverTimestamp:()=>FieldValue.serverTimestamp()});
const publicStats=createPublicStats({db:getFirestore(),sum:field=>AggregateField.sum(field)});
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
