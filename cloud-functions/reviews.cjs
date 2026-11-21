const {createHash}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const APPS=['GOOM','PZTS','EPS','CCTV','SK'];
function createReviewService({db,getUser,serverTimestamp,timestamp,now=Date.now}){
 const ref=(name,id)=>db.collection(name).doc(id),ms=v=>v?.toMillis?.()??0;
 function cursor(value){if(value==null)return null;if(typeof value!=='object'||!Number.isSafeInteger(value.time)||value.time<1||typeof value.id!=='string'||!/^r_[a-f0-9]{40}$/.test(value.id))throw new HttpsError('invalid-argument','Invalid cursor.');return value;}
 function safeSeconds(value){return Number.isSafeInteger(value)&&value>=0?value:0;}
 function publicEntry(doc){const d=doc.data();return{id:doc.id,authorName:d.authorName,application:d.application,message:d.message,activeSeconds:safeSeconds(d.activeSeconds),submittedAt:ms(d.submittedAt),publishedAt:ms(d.publishedAt)};}
 async function listPublic(input={}){
  let q=db.collection('goomPublishedReviews').orderBy('publishedAt','desc').orderBy('__name__','desc');const c=cursor(input.cursor);if(c)q=q.startAfter(timestamp(c.time),c.id);
  const rows=(await q.limit(13).get()).docs,shown=rows.slice(0,12),last=shown.at(-1);return{reviews:shown.map(publicEntry),cursor:rows.length>12?{time:ms(last.data().publishedAt),id:last.id}:null};
 }
 async function handle(request){
  const uid=request.auth?.uid,data=request.data||{};
  if(!uid||request.auth.token?.email_verified!==true)throw new HttpsError('unauthenticated','A verified GooM account is required.');
  const user=await getUser(uid);if(!user||user.disabled||!user.emailVerified)throw new HttpsError('permission-denied','A verified account is required.');
  if(data.action==='submit'){
   if(typeof data.message!=='string'||data.message.trim().length<3||data.message.length>800||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(data.message)||!APPS.includes(data.application)||data.publishConsent!==true||typeof data.operationId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(data.operationId))throw new HttpsError('invalid-argument','Check the review.');
   const id='r_'+createHash('sha256').update(uid+':'+data.operationId).digest('hex').slice(0,40),review=ref('goomReviews',id),sender=ref('goomReviewSenders',uid);
   return db.runTransaction(async tx=>{
    const[old,person,usage,previous]=await Promise.all([tx.get(review),tx.get(ref('users',uid)),tx.get(ref('goomEditorUsage',uid)),tx.get(sender)]);
    if(old.exists)return{id,status:old.data().status};
    if(ms(previous.data()?.sentAt)>now()-60000)throw new HttpsError('resource-exhausted','Please wait a minute before sending another review.');
    const authorName=String(person.data()?.displayName||user.displayName||'GooM').trim().slice(0,120)||'GooM',activeSeconds=safeSeconds(usage.data()?.activeSeconds),sentAt=serverTimestamp();
    tx.set(review,{uid,authorName,application:data.application,message:data.message.trim().normalize('NFC'),activeSeconds,submittedAt:sentAt,status:'pending',consentVersion:1});
    tx.set(sender,{sentAt,reviewId:id});return{id,status:'pending'};
   });
  }
  // Moderator role is rechecked by the server on every action, including inside writes.
  async function role(tx){const snap=tx?await tx.get(ref('goomAdmins',uid)):await ref('goomAdmins',uid).get();if(!['owner','admin'].includes(snap.data()?.role))throw new HttpsError('permission-denied','Administrator access required.');}
  await role();
  if(data.action==='list'){
   if(!['all','pending','published','rejected'].includes(data.status))throw new HttpsError('invalid-argument','Invalid status.');
   let q=db.collection('goomReviews').orderBy('submittedAt','desc').orderBy('__name__','desc');const c=cursor(data.cursor);if(c)q=q.startAfter(timestamp(c.time),c.id);
   // Filter one bounded page in memory to avoid a composite index and unlimited scans.
   const docs=(await q.limit(26).get()).docs,shown=docs.slice(0,25),last=shown.at(-1);return{reviews:shown.map(doc=>({...publicEntry(doc),uid:doc.data().uid,status:doc.data().status})),cursor:docs.length>25?{time:ms(last.data().submittedAt),id:last.id}:null};
  }
  if(data.action==='moderate'){
   if(typeof data.id!=='string'||!/^r_[a-f0-9]{40}$/.test(data.id)||!['publish','reject','delete'].includes(data.decision))throw new HttpsError('invalid-argument','Invalid moderation action.');
   return db.runTransaction(async tx=>{
    await role(tx);const target=ref('goomReviews',data.id),published=ref('goomPublishedReviews',data.id),old=await tx.get(target);if(!old.exists){if(data.decision==='delete'){tx.delete(published);return{status:'deleted'};}throw new HttpsError('not-found','Review not found.');}
    const d=old.data();if(data.decision==='delete'){tx.delete(target);tx.delete(published);}
    else if(data.decision==='publish'){
     if(d.status==='published')return{status:'published'};
     // Publish the original experience snapshot, never a later activity total or private UID.
     const fields={authorName:d.authorName,application:d.application,message:d.message,activeSeconds:d.activeSeconds,submittedAt:d.submittedAt,publishedAt:serverTimestamp()};tx.set(published,fields);tx.set(target,{...d,status:'published',moderatedAt:serverTimestamp(),moderatedBy:uid});
    }else{tx.delete(published);tx.set(target,{...d,status:'rejected',moderatedAt:serverTimestamp(),moderatedBy:uid});}
    return{status:data.decision==='publish'?'published':data.decision==='delete'?'deleted':'rejected'};
   });
  }
  throw new HttpsError('invalid-argument','Unknown review action.');
 }
 return{handle,listPublic};
}
module.exports={createReviewService};
