// Real headless Chromium + Firebase browser SDK/Auth emulator. No live login.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc} from 'firebase/firestore';
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080')throw Error('Demo loopback emulators required');
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),cache=path.join(os.tmpdir(),'meble-firebase-browser-sdk-12.19.0');
const hashes={'firebase-app.js':'39a50952b5def557337b2290069c7d7371f3515ad46c44a43b9c520f734d8d14','firebase-auth.js':'59f60ce3adcb4c85a5260e963fd14134eec088de5b18ddfb9e95771c72f65264','firebase-firestore.js':'86cfce95e3b598a2c0188a06b98fa1adc0cdb378bfc0a5ea207dd7627f7e7460'};
const options={target:'emulator',firebaseConfig:{apiKey:'demo-emulator-only',projectId:'demo-meble-app',appId:'demo-only',authDomain:'demo-meble-app.firebaseapp.com'},emulator:{host:'127.0.0.1',port:19099,firestorePort:18080}};
let browser,server,base,env;
before(async()=>{
 fs.mkdirSync(cache,{recursive:true});
 for(const [name,sha]of Object.entries(hashes)){
  const file=path.join(cache,name);if(!fs.existsSync(file))execFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','45','https://www.gstatic.com/firebasejs/12.19.0/'+name,'-o',file]);
  assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sha,'pinned official SDK: '+name);
 }
 server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+name);
  if(name==='/__synthetic_inspection'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Synthetic inspection</title>');return;}
  if(!file.startsWith(root+path.sep)||!/^\/(?:index\.html|auth-test\.html|dev_tests\.html|debug_price_materials\.html|autorun_cabinet_tests\.html|js\/|css\/|assets\/)/.test(name)){res.writeHead(404);res.end();return;}
  try{const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,ignoreDefaultArgs:['--disable-back-forward-cache'],args:['--disable-dev-shm-usage']});
 env=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:fs.readFileSync(new URL('./firestore.rules',import.meta.url),'utf8')}});
});
after(async()=>{await browser?.close();await env?.cleanup();if(server)await new Promise(resolve=>server.close(resolve));});
async function context({seed=true,configured=true,viewport={width:393,height:852},mobile=true,blockPopup=false,allowHelper=process.env.AUTH_POPUP_TEST==='1'}={}){
 const ctx=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});const requests=[],external=[];
 await ctx.route('**/*',async route=>{
  const url=new URL(route.request().url());requests.push(url.href);
  if(url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/12.19.0/')){
   const name=path.basename(url.pathname);if(!hashes[name]){external.push(url.href);await route.abort();return;}
   await route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(cache,name))});return;
  }
  if(allowHelper&&url.hostname==='apis.google.com'&&(url.pathname==='/js/api.js'||url.pathname.startsWith('/_/scs/'))&&route.request().method()==='GET'){
   try{const body=execFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','25',url.href]);await route.fulfill({contentType:'text/javascript',body});}catch(_){external.push(url.href);await route.abort();}return;
  }
  // Optional emulator widget styling is not part of the app or Auth proof.
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)||(url.hostname==='unpkg.com'&&url.pathname.startsWith('/material-components-web@10/'))){await route.abort();return;}
  if(!['localhost','127.0.0.1'].includes(url.hostname)){external.push(url.href);await route.abort();return;}
  if(url.pathname==='/js/auth-test-config.js'&&configured!=='live')await route.fulfill({contentType:'text/javascript',body:'window.FC_AUTH_TEST_OPTIONS='+JSON.stringify(configured?options:null)});
  else await route.continue();
 });
 await ctx.addInitScript(({blockPopup,seed})=>{
  if(seed){localStorage.setItem('fc_price_list_v1',JSON.stringify({sentinel:'synthetic-prices'}));localStorage.setItem('fc_projects_v1',JSON.stringify({sentinel:'synthetic-projects'}));localStorage.setItem('fc_material_part_options_v1',JSON.stringify({sentinel:'synthetic-grain'}));}
  if(blockPopup)window.open=()=>null;
 },{blockPopup,seed});
 const page=await ctx.newPage();return {ctx,page,requests,external};
}
async function state(page,wanted){await page.waitForFunction(value=>document.body.dataset.authState===value,wanted,{timeout:15000});}
async function businessAbsent(r){assert.equal(r.requests.some(x=>/\/(?:boot\.js|app\.js|project-store\.js|catalog-store\.js)(?:\?|$)/.test(x)),false);assert.deepEqual(r.external,[]);assert.equal(await r.page.evaluate(()=>window.projectData!==undefined),false);}
async function geometry(page){const box=await page.locator('.auth-card').boundingBox();assert.ok(box.width>0);assert.ok(box.x>=0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const buttons=await page.locator('button:visible').all();for(const button of buttons){const b=await button.boundingBox();assert.ok(b.height>=48);}}
test('Original supplied JPG, full proportions, stable loading and reachable controls at all target sizes',async()=>{
 const logoFile=path.join(root,'assets/branding/MebLeszek_logo_oryginal.jpg');
 const logoBytes=fs.readFileSync(logoFile);assert.equal(logoBytes.length,197205);
 assert.equal(createHash('sha256').update(logoBytes).digest('hex'),'10140e7c8652a54168f2ffbee619a1693a4c104b78ce67aff48d1d51bba7f51a','original ZIP attachment, no regenerated logo');
 for(const [width,height,mobile]of [[320,640,true],[393,852,true],[768,1024,true],[1440,900,false],[393,360,true],[1440,480,false]]){
  const r=await context({viewport:{width,height},mobile});let release=()=>{};
  try{
   if(width===320){
    const pending=new Promise(resolve=>{release=resolve;});
    await r.ctx.route('**/assets/branding/MebLeszek_logo_oryginal.jpg*',async route=>{await pending;await route.continue();});
   }
   await r.page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});await state(r.page,'unauthenticated');
   const logo=r.page.locator('.auth-logo'),reserved=await logo.boundingBox();release();await logo.evaluate(img=>img.decode());
   assert.deepEqual(await logo.boundingBox(),reserved,'image loading must not shift layout');
   const image=await logo.evaluate(img=>({src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight,fit:getComputedStyle(img).objectFit}));
   assert.deepEqual(image,{src:'assets/branding/MebLeszek_logo_oryginal.jpg?v=10140e7c',width:1536,height:1536,fit:'contain'});
   assert.ok(Math.abs(reserved.width-reserved.height)<1);assert.ok(reserved.x>=0);assert.ok(reserved.x+reserved.width<=width);
   assert.equal(await r.page.locator('.auth-brand-mark,.auth-eyebrow,.auth-intro,h1 span').count(),0);
   assert.equal(await r.page.locator('#auth-title').innerText(),'Logowanie MebLeszek');
   await geometry(r.page);await businessAbsent(r);
   for(const selector of ['#auth-google','#auth-status','.auth-test-note']){
    const el=r.page.locator(selector);await el.scrollIntoViewIfNeeded();assert.equal(await el.isVisible(),true);
    const b=await el.boundingBox();assert.ok(b.y>=0&&b.y+b.height<=height,'controls reachable on short screens');
   }
   if(height>560)await r.page.screenshot({path:'/tmp/cloud-2b1b-auth-'+width+'.png',fullPage:true});
   await r.page.locator('#auth-google').focus();assert.equal(await r.page.locator('#auth-google').evaluate(el=>el===document.activeElement),true);
  }finally{release();await r.ctx.close();}
 }
});
test('Committed live config initializes real Auth SDK without login, live API requests or Firestore',async()=>{
 const r=await context({configured:'live'});try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');
  assert.equal(await r.page.locator('#auth-google').isEnabled(),true);
  const info=await r.page.evaluate(async()=>{
   const {getApp}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
   const {getAuth}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
   const app=getApp('meble-auth-test'),auth=getAuth(app);
   return {target:window.FC_AUTH_TEST_OPTIONS.target,projectId:app.options.projectId,appId:app.options.appId,uid:auth.currentUser?.uid??null,emulator:auth.emulatorConfig};
  });
  assert.deepEqual(info,{target:'live-auth',projectId:'mebleszek-meble-app',appId:'1:447820686604:web:6bc0817aa365b1b613d529',uid:null,emulator:null});
  await r.page.reload();await state(r.page,'unauthenticated');await businessAbsent(r);
  assert.equal(r.requests.some(x=>x.includes('firebase-firestore.js')),false,'no Firestore even with live config before login');
 }finally{await r.ctx.close();}
});
test('Missing config loads no SDK/data; phone, tablet and desktop layouts fit and support keyboard focus',async()=>{
 for(const [width,height,mobile]of [[320,640,true],[768,1024,true],[1440,900,false]]){
  const r=await context({configured:false,viewport:{width,height},mobile});try{
   await r.page.goto(base+'/index.html');await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/AUTH_CONFIG_REQUIRED/);await geometry(r.page);
   assert.equal(r.requests.some(x=>x.includes('gstatic.com')),false);await businessAbsent(r);await r.page.locator('#auth-google').focus();assert.equal(await r.page.locator('#auth-google').evaluate(el=>el===document.activeElement),true);
  }finally{await r.ctx.close();}
 }
});
test('Actual Google popup, independent UID, SDK persistence across reload, logout and unchanged global bytes',{skip:process.env.AUTH_POPUP_TEST!=='1'?'Requires reachable apis.google.com; explicitly unverified in restricted Codex':false},async()=>{
 const r=await context();try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const before=await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_'))));
  const opened=r.page.waitForEvent('popup',{timeout:8000});await r.page.locator('#auth-google').click();const popup=await opened.catch(async e=>{throw Error(JSON.stringify({error:e.message,state:await r.page.locator('body').getAttribute('data-auth-state'),ui:await r.page.locator('#auth-error').textContent(),requests:r.requests.slice(-12),external:r.external}));});await popup.waitForLoadState('domcontentloaded');
  await popup.getByRole('button',{name:'Add new account'}).click();
  await popup.locator('#email-input').fill('browser-synthetic@example.invalid');
  await popup.locator('#sign-in').click();
  await state(r.page,'unapproved');await r.page.locator('#auth-uid-toggle').click();const uid=await r.page.locator('#auth-uid').innerText();assert.ok(uid.length>0);
  await r.page.reload();await state(r.page,'unapproved');await r.page.locator('#auth-uid-toggle').click();assert.equal(await r.page.locator('#auth-uid').innerText(),uid);
  await geometry(r.page);await businessAbsent(r);assert.deepEqual(await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')))),before);
  await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');assert.equal(await r.page.locator('#auth-uid').isVisible(),false);
  await r.page.reload();await state(r.page,'unauthenticated');
 }finally{await r.ctx.close();}
});
test('Closed popup and blocked popup show readable retry, without business initialization',{skip:process.env.AUTH_POPUP_TEST!=='1'?'Requires reachable Google iframe helper; unit failure paths tested separately':false},async()=>{
 for(const blockPopup of [false,true]){
  const r=await context({blockPopup});try{
   await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');
   if(blockPopup)await r.page.locator('#auth-google').click();else{const opened=r.page.waitForEvent('popup',{timeout:8000});await r.page.locator('#auth-google').click();const popup=await opened;await popup.close();}
   await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),blockPopup?/auth\/popup-blocked/:/auth\/popup-closed-by-user/);assert.equal(await r.page.locator('#auth-google').isEnabled(),true);await businessAbsent(r);
  }finally{await r.ctx.close();}
 }
});

test('Real browser SDK persistence: synthetic Google credential, reload, new tab, logout, unchanged global bytes',async()=>{
 const r=await context();try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');
  await r.page.screenshot({path:'/tmp/cloud-2b1-phone.png'});
  const before=await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_'))));
  const expected=await r.page.evaluate(async()=>{
   const {getApp}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
   const {getAuth,GoogleAuthProvider,signInWithCredential}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
   const payload=btoa(JSON.stringify({sub:'browser-persistence',email:'browser-persistence@example.invalid',email_verified:true})).replaceAll('=','');
   return (await signInWithCredential(getAuth(getApp('meble-auth-test')),GoogleAuthProvider.credential('e30.'+payload+'.'))).user.uid;
  });
  await state(r.page,'unapproved');await r.page.locator('#auth-uid-toggle').click();assert.equal(await r.page.locator('#auth-uid').innerText(),expected);
  assert.ok((await r.page.evaluate(()=>indexedDB.databases())).some(x=>x.name==='firebaseLocalStorageDb'));
  await r.page.reload();await state(r.page,'unapproved');await r.page.locator('#auth-uid-toggle').click();assert.equal(await r.page.locator('#auth-uid').innerText(),expected);
  await r.page.close();r.page=await r.ctx.newPage();await r.page.goto(base+'/index.html');await state(r.page,'unapproved');
  await geometry(r.page);await businessAbsent(r);assert.deepEqual(await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')))),before);
  await r.page.locator('#auth-signout').tap();await state(r.page,'unauthenticated');assert.equal(await r.page.locator('#auth-uid').isVisible(),false);
  await r.page.reload();await state(r.page,'unauthenticated');
 }finally{await r.ctx.close();}
});
test('Unavailable Google helper is a safe retryable error, not an opened business UI',async()=>{
 const r=await context({allowHelper:false});try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');
  await r.page.locator('#auth-google').tap();await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/auth\/internal-error/);assert.equal(await r.page.locator('#auth-google').isEnabled(),true);
  assert.ok(r.external.every(x=>x.startsWith('https://apis.google.com/')));r.external.length=0;await businessAbsent(r);
 }finally{await r.ctx.close();}
});
test('Main entry and old login URL use one gate and do not execute business scripts before approval',async()=>{
 const r=await context();try{
  await r.page.goto(base+'/auth-test.html');await state(r.page,'unauthenticated');
  assert.equal(new URL(r.page.url()).pathname,'/index.html');await businessAbsent(r);
  assert.equal(r.requests.filter(x=>new URL(x).pathname==='/js/app/cloud/cloud-auth.js').length,1);
 }finally{await r.ctx.close();}
});
test('Server-approved UID cannot silently adopt existing local data; revocation and logout preserve bytes',async()=>{
 const r=await context();try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');
  const before=await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_'))));
  const uid=await r.page.evaluate(async()=>{
   const {getApp}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
   const {getAuth,GoogleAuthProvider,signInWithCredential}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
   const payload=btoa(JSON.stringify({sub:'browser-approved-owner',email:'browser-approved@example.invalid',email_verified:true})).replaceAll('=','');
   return (await signInWithCredential(getAuth(getApp('meble-auth-test')),GoogleAuthProvider.credential('e30.'+payload+'.'))).user.uid;
  });
  await state(r.page,'unapproved');assert.match(await r.page.locator('#auth-status').innerText(),/nie został zatwierdzony/);
  await env.withSecurityRulesDisabled(async ctx=>{
   await setDoc(doc(ctx.firestore(),'authorizedUsers',uid),{appEnabled:true,enabled:false});
   await setDoc(doc(ctx.firestore(),'appAccess',uid),{schemaVersion:1});
  });
  await r.page.reload();await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/LOCAL_DATA_UNCLAIMED/);
  await r.page.locator('#auth-uid-toggle').click();assert.equal(await r.page.locator('#auth-uid').innerText(),uid);
  assert.equal(await r.page.locator('.auth-logo').evaluate(img=>img.naturalWidth),1536);await geometry(r.page);await businessAbsent(r);
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'authorizedUsers',uid),{appEnabled:false}));
  try{await r.page.waitForFunction(()=>document.body.dataset.authState==='revoked',null,{timeout:40000});}catch(error){error.message+=' '+await r.page.locator('#auth-status').innerText()+' '+await r.page.locator('#auth-error').innerText();throw error;}
  assert.match(await r.page.locator('#auth-status').innerText(),/Uprawnienia zostały cofnięte/);
  assert.deepEqual(await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')))),before);
  await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');await businessAbsent(r);
 }finally{await r.ctx.close();}
});
async function syntheticLogin(page,sub){
 return page.evaluate(async sub=>{
  const {getApp}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
  const {getAuth,GoogleAuthProvider,signInWithCredential}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
  const payload=btoa(JSON.stringify({sub,email:sub+'@example.invalid',email_verified:true})).replaceAll('=','');
  return (await signInWithCredential(getAuth(getApp('meble-auth-test')),GoogleAuthProvider.credential('e30.'+payload+'.'))).user.uid;
 },sub);
}
async function approve(uid,appEnabled=true){await env.withSecurityRulesDisabled(async ctx=>{
 await setDoc(doc(ctx.firestore(),'authorizedUsers',uid),{appEnabled,enabled:false});
 await setDoc(doc(ctx.firestore(),'appAccess',uid),{schemaVersion:1});
});}
async function businessReady(page){await page.waitForFunction(()=>document.body.dataset.businessState==='ready'&&document.body.classList.contains('app-authorized'),null,{timeout:45000});}
async function fcBytes(page){return page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('fc_'))));}
async function inspectBytes(ctx){const page=await ctx.newPage();try{await page.goto(base+'/__synthetic_inspection');return await fcBytes(page);}finally{await page.close();}}
test('Main approved login boots the real ordered app once; reload, bfcache and draft survive blocking',async()=>{
 const r=await context({seed:false});const errors=[];r.page.on('pageerror',e=>errors.push(e.message));
 try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');await businessAbsent(r);
  const uid=await syntheticLogin(r.page,'main-new-profile-owner');await state(r.page,'unapproved');await approve(uid);
  await r.page.reload();await businessReady(r.page);
  assert.equal(await r.page.locator('#homeView h2').innerText(),'Start');assert.equal(await r.page.locator('#main-login').isVisible(),false);
  assert.equal(await r.page.evaluate(()=>window.__APP_STARTED__),true);assert.deepEqual(errors,[]);
  const order=await r.page.evaluate(()=>Array.from(document.scripts).map(s=>s.getAttribute('data-loaded-src')).filter(Boolean));
  const expected=fs.readFileSync(path.join(root,'index.html'),'utf8').split('<template id="business-template">')[1].match(/src="[^"]+"/g).map(x=>x.slice(5,-1));
  assert.deepEqual(order.slice(0,323),expected,'native startup order, no duplicate evaluation');
  await r.page.goto(base+'/__synthetic_inspection');await r.page.goBack();await businessReady(r.page);
  assert.equal(await r.page.locator('#homeView h2').innerText(),'Start');
  const editing=await r.page.evaluate(async()=>{
   const api=window.FC,inv=api.investors.create({name:'Syntetyczny właściciel projektu'});
   const cab={id:'main-cabinet',type:'stojąca',subType:'standardowa',width:60,height:80,depth:50,bodyColor:'laminat White',frontMaterial:'laminat',frontColor:'White',backMaterial:'HDF',frontCount:2,details:{shelves:2}};
   const record=api.projectStore.ensureForInvestor(inv.id,{projectData:{kuchnia:{settings:{legHeight:10},cabinets:[cab],fronts:[],sets:[]}}});
   const candidate=structuredClone(record);candidate.projectData.kuchnia.cabinets=[cab];
   const saved=api.projectStore.updateRecordConfirmed(candidate,record);if(!saved)throw Error('Synthetic fixture save refused');
   projectData=structuredClone(saved.projectData);
   uiState=api.uiState.set({currentInvestorId:inv.id,roomType:'kuchnia',entry:'app',activeTab:'wywiad'});
   const opened=await api.openRoom('kuchnia');
   if(!opened||!api.session.active||!api.session.durable)throw Error('Real room session did not open');
   projectData.kuchnia.cabinets[0].width=77;api.views.applyFromState(uiState);
   return {snapshot:localStorage.getItem('fc_edit_session_v1'),roomId:api.session.roomId,projectId:api.session.projectId};
  });
  assert.equal(editing.roomId,'kuchnia');assert.ok(editing.projectId);assert.ok(editing.snapshot);
  assert.equal(await r.page.locator('#sessionCancel').innerText(),'Anuluj');

  const before=await fcBytes(r.page);
  await r.page.evaluate(()=>dispatchEvent(new Event('offline')));await state(r.page,'error');
  assert.equal(await r.page.locator('#homeView').isVisible(),false);
  await r.page.evaluate(()=>dispatchEvent(new ErrorEvent('error',{message:'synthetic private error'})));
  assert.equal(await r.page.locator('#app-error-banner').isVisible(),false,'boot error banner outside body must not leak locked content');
  assert.equal(await r.page.evaluate(()=>{try{localStorage.setItem('fc_main_auth_synthetic_draft','unsafe');return true;}catch(_){return false;}}),false);
  assert.deepEqual(await inspectBytes(r.ctx),before);assert.equal(await r.page.evaluate(()=>projectData.kuchnia.cabinets[0].width),77);assert.equal((await inspectBytes(r.ctx)).fc_edit_session_v1,editing.snapshot);
  await r.page.evaluate(()=>dispatchEvent(new Event('online')));await businessReady(r.page);assert.deepEqual(await fcBytes(r.page),before);
  if(await r.page.locator('#app-error-banner').isVisible())await r.page.locator('#app-error-banner button').filter({hasText:'X'}).click();
  assert.equal(await r.page.evaluate(()=>Array.from(document.scripts).filter(s=>s.getAttribute('data-loaded-src')?.startsWith('js/app.js?')).length),1);
  await r.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));assert.equal(await r.page.evaluate(()=>window.__FC_MAIN_ACCESS__.isValid()),false);
  await r.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await businessReady(r.page);
  assert.equal(await r.page.evaluate(()=>projectData.kuchnia.cabinets[0].width),77);assert.equal((await inspectBytes(r.ctx)).fc_edit_session_v1,editing.snapshot);
  // Real Save still works after same-account reauthorization; no automatic commit occurred.
  await r.page.locator('#sessionSave').click();await r.page.waitForFunction(()=>!window.FC.session.active);
  const saved=await r.page.evaluate(()=>JSON.parse(localStorage.getItem('fc_projects_v1')).find(x=>x.id===window.FC.projectStore.getCurrentProjectId()).projectData.kuchnia.cabinets[0].width);assert.equal(saved,77);
  await r.page.reload();await businessReady(r.page);assert.equal(await r.page.evaluate(()=>projectData.kuchnia.cabinets[0].width),77);
  await r.page.locator('#main-signout').click();await state(r.page,'unauthenticated');assert.equal(await r.page.locator('#homeView').isVisible(),false);
  const other=await syntheticLogin(r.page,'main-other-approved-owner');await state(r.page,'unapproved');await approve(other);
  await r.page.reload();await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/LOCAL_ACCESS_OTHER_ACCOUNT/);
  await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');
 }catch(error){error.message+='\nBrowser errors: '+errors.join('\n');throw error;}finally{await r.ctx.close();}
});
test('Revoking the actual main grant blocks the running app and subsequent storage writes',async()=>{
 const r=await context({seed:false});try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'main-revoked-owner');await state(r.page,'unapproved');await approve(uid);
  await r.page.reload();await businessReady(r.page);
  await r.page.evaluate(()=>{window.__unsavedForm={width:81};localStorage.setItem('fc_main_retained','retained');});const before=await fcBytes(r.page);
  await approve(uid,false);try{await r.page.waitForFunction(()=>document.body.dataset.authState==='revoked',null,{timeout:40000});}catch(error){error.message+=' '+await r.page.locator('#auth-status').innerText()+' '+await r.page.locator('#auth-error').innerText();throw error;}
  assert.equal(await r.page.evaluate(()=>window.__unsavedForm.width),81);assert.equal(await r.page.locator('#homeView').isVisible(),false);
  assert.equal(await r.page.evaluate(()=>{try{localStorage.removeItem('fc_main_retained');return true;}catch(_){return false;}}),false);
  assert.deepEqual(await inspectBytes(r.ctx),before);
 }finally{await r.ctx.close();}
});
test('Server verification timeout never loads business data or creates a local access receipt',async()=>{
 const r=await context({seed:false});let release=()=>{};
 try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'main-timeout-owner');await state(r.page,'unapproved');await approve(uid);
  const pending=new Promise(resolve=>{release=resolve;});
  await r.ctx.route('http://127.0.0.1:18080/**',async route=>{await pending;try{await route.abort();}catch(_){}});
  await r.page.reload();await state(r.page,'error');await businessAbsent(r);
  assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),null);assert.deepEqual(await inspectBytes(r.ctx),{});
 }finally{release();await r.ctx.close();}
});
test('Loss of access during startup fetch prevents all delayed evaluation, including boot and recovery',async()=>{
 const r=await context({seed:false});let release=()=>{},heldResolve;const held=new Promise(resolve=>{heldResolve=resolve;});
 try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'main-interrupted-owner');await state(r.page,'unapproved');await approve(uid);
  const pending=new Promise(resolve=>{release=resolve;});
  await r.ctx.route('**/js/app/shared/constants.js*',async route=>{heldResolve();await pending;try{await route.continue();}catch(_){}});
  await r.page.reload();await held;await r.page.evaluate(()=>dispatchEvent(new Event('offline')));release();
  await state(r.page,'error');assert.equal(await r.page.evaluate(()=>window.__APP_STARTED__),undefined);
  assert.equal(await r.page.evaluate(()=>Array.from(document.scripts).filter(s=>s.hasAttribute('data-loaded-src')).length),0);
  assert.deepEqual(await inspectBytes(r.ctx),{});
 }finally{release();await r.ctx.close();}
});
test('A late dynamically loaded business/recovery script cannot execute after authorization is lost',async()=>{
 const r=await context({seed:false});let release=()=>{},heldResolve;const held=new Promise(resolve=>{heldResolve=resolve;});
 try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'main-late-module-owner');await state(r.page,'unapproved');await approve(uid);
  await r.page.reload();await businessReady(r.page);const before=await fcBytes(r.page),pending=new Promise(resolve=>{release=resolve;});
  await r.ctx.route('**/js/main-synthetic-delayed.js',async route=>{heldResolve();await pending;try{await route.fulfill({contentType:'text/javascript',body:'window.__unsafeLateModule=true;localStorage.setItem("fc_unsafe_late","bad");'});}catch(_){}});
  await r.page.evaluate(()=>{const script=document.createElement('script');script.src='js/main-synthetic-delayed.js';document.head.appendChild(script);});await held;
  await r.page.evaluate(()=>dispatchEvent(new Event('offline')));release();await state(r.page,'error');
  assert.equal(await r.page.evaluate(()=>window.__unsafeLateModule),undefined);assert.deepEqual(await inspectBytes(r.ctx),before);
 }finally{release();await r.ctx.close();}
});

test('Public diagnostics cannot bypass main authorization or overwrite local catalogs',async()=>{
 for(const path of ['dev_tests.html','debug_price_materials.html','autorun_cabinet_tests.html']){
  const r=await context();try{
   await r.page.goto(base+'/'+path);await state(r.page,'unauthenticated');await businessAbsent(r);
   assert.equal(new URL(r.page.url()).pathname,'/index.html');
   assert.deepEqual(await inspectBytes(r.ctx),{fc_price_list_v1:JSON.stringify({sentinel:'synthetic-prices'}),fc_projects_v1:JSON.stringify({sentinel:'synthetic-projects'}),fc_material_part_options_v1:JSON.stringify({sentinel:'synthetic-grain'})});
  }finally{await r.ctx.close();}
 }
});

test('Concurrent first-use profiles serialize their receipts; only one UID can be selected',async()=>{
 const r=await context({seed:false});try{
  await r.page.goto(base+'/__synthetic_inspection');await r.page.addScriptTag({url:base+'/js/app/cloud/local-access-profile.js'});
  const result=await r.page.evaluate(async()=>{
   const profile=window.FC.localAccessProfile.create(localStorage,sessionStorage);
   const results=await Promise.all(['synthetic-first','synthetic-second'].map(uid=>navigator.locks.request('meble-main-access-profile-v1',()=>{try{profile.confirm(uid);return 'ok';}catch(e){return e.code;}})));
   return {results,receipt:JSON.parse(localStorage.getItem(profile.key)),business:Object.keys(localStorage).filter(k=>k.startsWith('fc_'))};
  });
  assert.equal(result.results.filter(x=>x==='ok').length,1);assert.equal(result.results.filter(x=>x==='LOCAL_ACCESS_OTHER_ACCOUNT').length,1);assert.deepEqual(result.business,[]);assert.equal(result.receipt.uid,'synthetic-first');
 }finally{await r.ctx.close();}
});

test('Logout during a pending local-profile lock cannot create a receipt or overwrite signed-out state',async()=>{
 const r=await context({seed:false}),locker=await r.ctx.newPage();
 try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'main-pending-lock-owner');await state(r.page,'unapproved');await approve(uid);
  await locker.goto(base+'/__synthetic_inspection');
  await locker.evaluate(()=>{window.__held=false;navigator.locks.request('meble-main-access-profile-v1',()=>new Promise(resolve=>{window.__release=resolve;window.__held=true;}));});
  await locker.waitForFunction(()=>window.__held);await r.page.reload();await state(r.page,'authorized');
  assert.equal(await r.page.evaluate(()=>window.__APP_STARTED__),undefined);
  await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');
  await locker.evaluate(()=>window.__release());
  await r.page.waitForFunction(()=>navigator.locks.query().then(info=>info.held.every(x=>x.name!=='meble-main-access-profile-v1')&&info.pending.every(x=>x.name!=='meble-main-access-profile-v1')));
  assert.equal(await r.page.evaluate(()=>document.body.dataset.authState),'unauthenticated');
  assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),null);await businessAbsent(r);
 }finally{await locker.close();await r.ctx.close();}
});
