const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');let browser;
before(async()=>browser=await chromium.launch({channel:'msedge',headless:true}));after(async()=>browser?.close());
async function openAdmin(viewport={width:1440,height:1000}){
 const context=await browser.newContext({viewport});
 await context.route('https://www.gstatic.com/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await context.addInitScript(()=>{
  const ts=n=>({toMillis:()=>n}),now=Date.now(),docs=new Map(),queries=[];window.testAdminQueries=queries;
  docs.set('goomAdmins/owner',{role:'owner'});
  for(let i=0;i<1051;i++){
   const id='u'+String(i).padStart(4,'0');docs.set('users/'+id,{displayName:'User '+String(i).padStart(4,'0'),email:'person'+String(i).padStart(4,'0')+'@example.test',accountType:i%3?'personal':'company'});
   docs.set('goomEditorActivity/'+id,{application:'PZTS',lastSeen:ts(now-i*10000)});
   docs.set('goomEditorUsage/'+id,{activeSeconds:i*60,applications:{PZTS:i*60,CCTV:0,EPS:0,SK:0},updatedAt:ts(now-5000)});
   if(i%5===0)docs.set('goomProgramGrants/'+id,{expiresAt:{PZTS:ts(now+86400000)}});
   if(i%7===0)docs.set('cloudLicenses/'+id,{uid:id,plan:'pro',status:'active',source:'stripe',paymentStatus:'paid',billingMode:'monthly',applications:['PZTS','CCTV'],applicationExpiresAt:{PZTS:ts(now+86400000),CCTV:ts(now+86400000)},applicationPlans:{PZTS:i%14?'pro':'company'}});
  }
  for(let i=0;i<26;i++)docs.set('goomFeedback/m'+String(i).padStart(3,'0'),{uid:'u0001',name:'Test sender',email:'test@example.test',message:i===0?'<script>alert(1)</script>\nSecond line':'Message '+i,application:i%2?'PZTS':'CCTV',sentAt:ts(now-i*10000)});
  const snapshot=path=>({id:path.split('/').at(-1),exists:docs.has(path),data:()=>docs.get(path)}),value=(data,field,id)=>field==='__name__'?id:field.split('.').reduce((d,key)=>d?.[key],data),scalar=x=>x?.toMillis?.()??x;
  const ref=(path,state={})=>({path,doc:id=>ref(path+'/'+id),
   orderBy:(field,direction='asc')=>ref(path,{...state,field,direction}),where:(field,operator,expected)=>ref(path,{...state,where:[field,operator,expected]}),
   startAt:prefix=>ref(path,{...state,prefix}),endAt:()=>ref(path,state),startAfter:cursor=>ref(path,{...state,cursor:cursor.id}),limit:limit=>ref(path,{...state,limit}),
   async get(){if(path.includes('/'))return snapshot(path);queries.push({path,...state});if(!state.limit||state.limit>25)throw Error('Unbounded query');
    let entries=[...docs].filter(([key])=>key.startsWith(path+'/')&&key.split('/').length===2);
    if(state.field)entries=entries.filter(([key,data])=>value(data,state.field,key.split('/').at(-1))!==undefined);
    if(state.where)entries=entries.filter(([key,data])=>scalar(value(data,state.where[0],key.split('/').at(-1)))>scalar(state.where[2]));
    if(state.prefix!==undefined)entries=entries.filter(([key,data])=>String(value(data,state.field,key.split('/').at(-1))).startsWith(state.prefix));
    entries.sort(([ak,a],[bk,b])=>{const aa=scalar(value(a,state.field||'__name__',ak.split('/').at(-1))),bb=scalar(value(b,state.field||'__name__',bk.split('/').at(-1)));return(aa<bb?-1:aa>bb?1:ak.localeCompare(bk))*(state.direction==='desc'?-1:1);});
    if(state.cursor)entries=entries.slice(entries.findIndex(([key])=>key.split('/').at(-1)===state.cursor)+1);entries=entries.slice(0,state.limit);
    return{docs:entries.map(([key])=>snapshot(key)),size:entries.length};}
  });
  const db={collection:name=>ref(name),batch(){const writes=[];return{update:(r,data)=>writes.push(['update',r.path,data]),delete:r=>writes.push(['delete',r.path]),async commit(){if(window.testAdminWriteDenied)throw Object.assign(Error('Denied'),{code:'permission-denied'});for(const[action,path,data]of writes){if(action==='delete')docs.delete(path);else docs.set(path,{...docs.get(path),...data});}window.testAdminWrites=(window.testAdminWrites||[]).concat(writes.map(([action,path])=>({action,path})));}};}};
  const auth={currentUser:{uid:'owner',email:'owner@example.test',getIdToken:async()=>'mock-admin-token'},onAuthStateChanged(callback){window.testAdminAuth=callback;setTimeout(()=>callback(auth.currentUser),0);},async signOut(){auth.currentUser=null;window.testAdminAuth(null);}};
  const firestore=()=>db;firestore.FieldPath={documentId:()=>'__name__'};firestore.Timestamp={fromMillis:ts};firestore.FieldValue={serverTimestamp:()=>ts(Date.now())};
  window.testAdminDocs=docs;window.firebase={apps:[{}],auth:()=>auth,firestore};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto((process.env.ADMIN_TEST_BASE||'http://127.0.0.1:4173')+'/pzts/admin.html');await page.waitForFunction(()=>document.querySelectorAll('#adminUsers tr').length===25);
 return{context,page,errors};
}
test('large user lists use bounded prefix search, cursors, filters and access indicators',async()=>{
 const{context,page,errors}=await openAdmin();try{
  await page.locator('[data-view=users]').click();assert.equal(await page.locator('#adminUsers tr').count(),25);
  assert.equal(await page.locator('#adminUsers .program-dot').count(),100);assert.match(await page.locator('#adminUsers tr').first().innerText(),/COMPANY PROJECT/);
  await page.locator('#adminNext').click();await page.waitForFunction(()=>document.getElementById('adminPage').textContent.includes('Страница 2'));assert.match(await page.locator('#adminUsers tr').first().innerText(),/User 0025/);
  await page.locator('#adminPrev').click();await page.waitForFunction(()=>document.getElementById('adminPage').textContent.includes('Страница 1'));
  await page.locator('#adminQuery').fill('person099');await page.locator('#adminSearch button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#adminUsers tr').length===10);assert.match(await page.locator('#adminUsers tr').last().innerText(),/person0999/);
  await page.locator('#adminSearchField').selectOption('displayName');await page.locator('#adminQuery').fill('User 104');await page.locator('#adminSearch button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#adminUsers').textContent.includes('User 1040'));assert.equal(await page.locator('#adminUsers tr').count(),10);
  await page.locator('#adminSearchField').selectOption('uid');await page.locator('#adminQuery').fill('u1000');await page.locator('#adminSearch button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#adminUsers tr').length===1);assert.match(await page.locator('#adminUsers').innerText(),/User 1000/);
  await page.locator('#adminUserFilter').selectOption('manual');await page.waitForFunction(()=>document.querySelectorAll('#adminUsers tr').length===25);assert.ok((await page.locator('#adminUsers tr').allTextContents()).every(text=>text.includes('PROJECT')));
  await page.locator('#adminUserFilter').selectOption('time');await page.waitForFunction(()=>document.querySelector('#adminUsers tr').textContent.includes('User 1050'));assert.match(await page.locator('#adminUsers tr').first().innerText(),/17 ч 30 мин/);
  await page.locator('#adminUserFilter').selectOption('paid');await page.waitForFunction(()=>document.querySelector('#adminUsers tr').textContent.includes('COMPANY PROJECT'));assert.ok((await page.locator('#adminUsers tr').allTextContents()).every(text=>text.includes('PROJECT')));
  await page.locator('#adminUsers button').first().click();assert.equal(await page.locator('#adminUserDialog').isVisible(),true);assert.match(await page.locator('#adminUserVisit').innerText(),/Активное время/);await page.locator('#adminCloseDialog').click();
  assert.ok(await page.evaluate(()=>testAdminQueries.every(query=>query.limit<=25)));assert.deepEqual(errors,[]);
  if(!process.env.ADMIN_TEST_BASE)await page.screenshot({path:'.qa-admin-users-compact.png'});
 }finally{await context.close();}
});
test('feedback supports read status, unread view, pagination, bulk actions and recoverable errors',async()=>{
 const{context,page,errors}=await openAdmin();try{
  await page.locator('[data-view=feedback]').click();await page.locator('.feedback-item').first().waitFor();assert.equal(await page.locator('.feedback-item').count(),25);
  assert.equal(await page.locator('.feedback-item script').count(),0);assert.match(await page.locator('.feedback-item-message').first().innerText(),/<script>/);
  await page.locator('.feedback-item button').first().click();await page.waitForFunction(()=>document.querySelectorAll('.feedback-item.unread').length===24);
  await page.locator('#adminUnreadOnly').check();assert.equal(await page.locator('.feedback-item').count(),24);
  await page.locator('#adminUnreadOnly').uncheck();await page.locator('#adminMoreFeedback').click();await page.waitForFunction(()=>document.querySelectorAll('.feedback-item').length===26);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('.feedback-item .danger').first().click();assert.equal(await page.locator('.feedback-item').count(),26);
  page.once('dialog',dialog=>dialog.accept());await page.locator('.feedback-item .danger').first().click();await page.waitForFunction(()=>document.querySelectorAll('.feedback-item').length===25);
  await page.locator('#adminSelectFeedback').check();assert.equal(await page.locator('.feedback-item>input:checked').count(),25);await page.locator('#adminReadFeedback').click();await page.waitForFunction(()=>!document.querySelector('.feedback-item.unread'));
  await page.locator('.feedback-item button').first().click();await page.waitForFunction(()=>document.querySelector('.feedback-item.unread'));
  await page.evaluate(()=>window.testAdminWriteDenied=true);await page.locator('.feedback-item button').first().click();await page.locator('#adminFeedbackStatus[data-error=true]').waitFor();assert.equal(await page.locator('.feedback-item.unread').count(),1);
  await page.evaluate(()=>window.testAdminWriteDenied=false);await page.locator('.feedback-item button').first().click();await page.waitForFunction(()=>!document.querySelector('.feedback-item.unread'));
  if(!process.env.ADMIN_TEST_BASE)await page.screenshot({path:'.qa-admin-feedback-compact.png'});
  await page.locator('#adminSelectFeedback').check();page.once('dialog',dialog=>dialog.accept());await page.locator('#adminDeleteFeedback').click();await page.waitForFunction(()=>!document.querySelector('.feedback-item'));
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('the compact administrator panel fits a phone without document overflow',async()=>{
 const{context,page,errors}=await openAdmin({width:390,height:844});try{
  await page.locator('[data-view=feedback]').click();await page.locator('.feedback-item').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
  if(!process.env.ADMIN_TEST_BASE)await page.screenshot({path:'.qa-admin-mobile-compact.png'});
 }finally{await context.close();}
});

test('review moderation has publish, withdraw, delete, filters and bounded pages',async()=>{const{context,page,errors}=await openAdmin({width:390,height:844});let denied=false;const requests=[],rows=Array.from({length:27},(_,i)=>({id:'r_'+i.toString(16).padStart(40,'0'),authorName:'Author '+i,application:'EPS',message:i===0?'<img src=x onerror=alert(1)> Review':'Review '+i,activeSeconds:18000,submittedAt:Date.now()-i*1000,status:'pending'}));try{await page.route('**/goomReviews',route=>{const data=JSON.parse(route.request().postData()).data;requests.push(data);let result;if(data.action==='list'){const start=data.cursor?25:0;result={reviews:rows.slice(start,start+25),cursor:start===0?{time:Date.now(),id:rows[24].id}:null};}else{if(denied)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{status:'PERMISSION_DENIED'}})});const index=rows.findIndex(r=>r.id===data.id);if(data.decision==='delete')rows.splice(index,1);else rows[index].status=data.decision==='publish'?'published':'rejected';result={status:data.decision==='delete'?'deleted':rows[index].status};}return route.fulfill({contentType:'application/json',body:JSON.stringify({data:result})});});await page.locator('[data-view=reviews]').click();await page.waitForFunction(()=>document.querySelectorAll('.admin-review').length===25);assert.equal(await page.locator('.admin-review img').count(),0);assert.match(await page.locator('.admin-review').first().innerText(),/<img/);assert.equal(await page.locator('#adminUserList').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.locator('.admin-review').first().getByRole('button',{name:'Опубликовать',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.admin-review').textContent.includes('Опубликован'));await page.selectOption('#adminReviewFilter','published');assert.equal(await page.locator('.admin-review').count(),1);await page.locator('.admin-review').first().getByRole('button',{name:'Снять публикацию',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.admin-review'));await page.selectOption('#adminReviewFilter','all');await page.locator('#adminMoreReviews').click();await page.waitForFunction(()=>document.querySelectorAll('.admin-review').length===27);page.once('dialog',d=>d.accept());await page.locator('.admin-review').last().getByRole('button',{name:'Удалить',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.admin-review').length===26);denied=true;await page.locator('.admin-review').last().getByRole('button',{name:'Опубликовать',exact:true}).click();await page.locator('#adminReviewStatus[data-error=true]').waitFor();assert.equal(await page.locator('.admin-review').count(),26);assert.ok(requests.filter(r=>r.action==='list').every(r=>r.status==='all'));assert.deepEqual(errors,[]);if(!process.env.ADMIN_TEST_BASE)await page.screenshot({path:'.qa-reviews-admin-mobile.png'});}finally{await context.close();}});
