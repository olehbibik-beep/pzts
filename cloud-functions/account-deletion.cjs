const {HttpsError}=require('firebase-functions/v2/https');
function createAccountDeletion({auth,db,bucket,serverTimestamp,now=Date.now}){
 const role=s=>['owner','admin'].includes(s.data()?.role)?s.data().role:'user';
 return async(actor,data)=>{
  const uid=data.uid;if(typeof uid!=='string'||!uid||uid.length>128||/[\/\x00-\x1f]/.test(uid)||['.','..'].includes(uid))throw new HttpsError('invalid-argument','Invalid user ID.');
  if(uid===actor.uid)throw new HttpsError('permission-denied','You cannot delete your own account.');
  const marker=db.collection('goomDeletedAccounts').doc(uid),profile=db.collection('users').doc(uid),audit=db.collection('goomAdminAudit').doc('delete_'+uid);let target;
  try{target=await auth.getUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  const state=await db.runTransaction(async transaction=>{
   const [a,t,old,license]=await Promise.all([transaction.get(db.collection('goomAdmins').doc(actor.uid)),transaction.get(db.collection('goomAdmins').doc(uid)),transaction.get(marker),transaction.get(db.collection('cloudLicenses').doc(uid))]);
   const actorRole=role(a),targetRole=old.data()?.targetRole||role(t);if(!['owner','admin'].includes(actorRole)||targetRole==='owner'||actorRole!=='owner'&&targetRole==='admin')throw new HttpsError('permission-denied','You cannot delete this account.');
   const email=target?.email||old.data()?.targetEmail||'';if(!target&&!old.exists)throw new HttpsError('not-found','User not found.');if(String(data.confirmation||'').trim().toLowerCase()!==(email||uid).toLowerCase())throw new HttpsError('invalid-argument','Type the account email to confirm.');
   const paid=license.data();if(paid?.source==='stripe'&&paid.status==='active'&&paid.paymentStatus==='paid'&&Object.values(paid.applicationExpiresAt||{}).some(t=>(t?.toMillis?.()||0)>now()))throw new HttpsError('failed-precondition','Active paid subscription must be resolved before deletion.',{reason:'active-subscription'});
   if(old.data()?.state==='complete')return{complete:true,email};
   transaction.set(marker,{state:'pending',targetRole,targetEmail:email,actorUid:actor.uid,createdAt:old.data()?.createdAt||serverTimestamp(),updatedAt:serverTimestamp()});transaction.delete(db.collection('goomAdmins').doc(uid));transaction.delete(db.collection('goomProgramGrants').doc(uid));return{complete:false,email,targetRole};
  });
  if(state.complete)return{deleted:true,uid};
  if(target){try{await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);await auth.deleteUser(uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}}
  // One validated UID prefix contains this account's projects in all four applications.
  await bucket.deleteFiles({prefix:'users/'+uid+'/'});await db.recursiveDelete(profile);
  const batch=db.batch();for(const name of ['goomEditorUsage','goomEditorActivity','goomFeedbackSenders','goomAdmins','goomProgramGrants'])batch.delete(db.collection(name).doc(uid));batch.set(marker,{state:'complete',updatedAt:serverTimestamp()},{merge:true});batch.set(audit,{action:'delete',actorUid:actor.uid,actorEmail:actor.email||'',targetUid:uid,targetEmail:state.email,before:state.targetRole,after:'deleted',application:null,createdAt:serverTimestamp()});await batch.commit();return{deleted:true,uid};
 };
}
module.exports={createAccountDeletion};
