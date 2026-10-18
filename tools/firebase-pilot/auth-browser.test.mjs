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
import {doc,setDoc,updateDoc,getDoc,Bytes,deleteDoc} from 'firebase/firestore';
import {openPrivatePilot} from './private-pilot-runner.mjs';
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
  if(!file.startsWith(root+path.sep)||!/^\/(?:index\.html|auth-test\.html|dev_tests\.html|debug_price_materials\.html|autorun_cabinet_tests\.html|js\/|css\/|assets\/|tools\/firebase-pilot\/cloud4-(?:source-worker|synthetic-source)\.js$)/.test(name)){res.writeHead(404);res.end();return;}
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
  // Google's helper intermittently sends this numeric loader timing beacon.
  // Stub it locally: no telemetry is forwarded, and all other API traffic
  // remains an unexpected external request (including Auth/Firestore live).
  if(allowHelper&&url.hostname==='apis.google.com'&&url.pathname==='/js/gen_204'&&route.request().method()==='GET'
    &&Array.from(url.searchParams.keys()).every(key=>key==='c')&&/^\d+:\d+$/.test(url.searchParams.get('c')||'')){
   await route.fulfill({status:204,body:''});return;
  }
  // Optional emulator widget styling is not part of the app or Auth proof.
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)||(url.hostname==='unpkg.com'&&url.pathname.startsWith('/material-components-web@10/'))){await route.abort();return;}
  if(!['localhost','127.0.0.1'].includes(url.hostname)){external.push(url.href);await route.abort();return;}
  if(url.pathname==='/js/auth-test-config.js'&&configured!=='live')await route.fulfill({contentType:'text/javascript',body:'window.FC_AUTH_TEST_OPTIONS='+JSON.stringify(configured?options:null)});
  else await route.continue();
 });
 await ctx.addInitScript(({blockPopup,seed})=>{
  if(seed&&localStorage.getItem('fc_price_list_v1')===null){localStorage.setItem('fc_price_list_v1',JSON.stringify({sentinel:'synthetic-prices'}));localStorage.setItem('fc_projects_v1',JSON.stringify({sentinel:'synthetic-projects'}));localStorage.setItem('fc_material_part_options_v1',JSON.stringify({sentinel:'synthetic-grain'}));}
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
  await state(r.page,'unapproved');const uid=await currentUid(r.page);assert.ok(uid.length>0);
  await r.page.reload();await state(r.page,'unapproved');assert.equal(await currentUid(r.page),uid);assert.equal(await r.page.locator('#auth-uid-toggle, #auth-uid').count(),0);
  await geometry(r.page);await businessAbsent(r);assert.deepEqual(await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')))),before);
  await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');assert.equal(await r.page.locator('#auth-uid-toggle, #auth-uid').count(),0);
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
  await state(r.page,'unapproved');assert.equal(await currentUid(r.page),expected);assert.equal(await r.page.locator('#auth-uid-toggle, #auth-uid').count(),0);
  assert.ok((await r.page.evaluate(()=>indexedDB.databases())).some(x=>x.name==='firebaseLocalStorageDb'));
  await r.page.reload();await state(r.page,'unapproved');assert.equal(await currentUid(r.page),expected);assert.equal(await r.page.locator('#auth-uid-toggle, #auth-uid').count(),0);
  await r.page.close();r.page=await r.ctx.newPage();await r.page.goto(base+'/index.html');await state(r.page,'unapproved');
  await geometry(r.page);await businessAbsent(r);assert.deepEqual(await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')))),before);
  await r.page.locator('#auth-signout').tap();await state(r.page,'unauthenticated');assert.equal(await r.page.locator('#auth-uid-toggle, #auth-uid').count(),0);
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
  await r.page.reload();await state(r.page,'profile-pending');
  assert.equal(await r.page.locator('#auth-profile-admission').isVisible(),true);
  assert.equal(await r.page.locator('#auth-profile-confirm').isDisabled(),true);
  assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),null);
  assert.equal(await currentUid(r.page),uid);assert.equal(await r.page.locator('#auth-uid-toggle, #auth-uid').count(),0);
  assert.equal(await r.page.locator('.auth-logo').evaluate(img=>img.naturalWidth),1536);await geometry(r.page);await businessAbsent(r);
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'authorizedUsers',uid),{appEnabled:false}));
  try{await r.page.waitForFunction(()=>document.body.dataset.authState==='revoked',null,{timeout:40000});}catch(error){error.message+=' '+await r.page.locator('#auth-status').innerText()+' '+await r.page.locator('#auth-error').innerText();throw error;}
  assert.match(await r.page.locator('#auth-status').innerText(),/Uprawnienia zostały cofnięte/);
  assert.deepEqual(await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')))),before);
  await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');await businessAbsent(r);
 }finally{await r.ctx.close();}
});
async function currentUid(page){return page.evaluate(async()=>{const a=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');const f=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');return f.getAuth(a.getApp('meble-auth-test')).currentUser?.uid||null;});}
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
   const results=await Promise.all(['synthetic-first','synthetic-second'].map(uid=>navigator.locks.request('meble-main-access-profile-v1',async()=>{try{await profile.confirm(uid);return 'ok';}catch(e){return e.code;}})));
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

async function consentToProfile(page){
 await page.locator('#auth-profile-backup').check();
 await page.locator('label').filter({hasText:'Jestem jedynym użytkownikiem'}).click();
 assert.equal(await page.locator('#auth-profile-owner').isChecked(),true);
 await page.locator('#auth-profile-confirm').click();
}
test('Existing profile requires both confirmations; cancellation, offline and a revoked fresh proof never admit it',async()=>{
 const r=await context();try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'admission-refusal-owner');await state(r.page,'unapproved');await approve(uid);
  await r.page.reload();await state(r.page,'profile-pending');const before=await fcBytes(r.page);
  await r.page.locator('#auth-profile-owner').check();assert.equal(await r.page.locator('#auth-profile-confirm').isDisabled(),true,'a backup is mandatory');
  await r.page.locator('#auth-profile-cancel').click();await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/LOCAL_ACCESS_CANCELLED/);
  assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),null);await businessAbsent(r);assert.deepEqual(await fcBytes(r.page),before);
  await r.page.reload();await state(r.page,'profile-pending');assert.equal(await r.page.locator('#auth-profile-owner').isChecked(),false);
  await r.page.evaluate(()=>dispatchEvent(new Event('offline')));await state(r.page,'error');
  assert.equal(await r.page.locator('#auth-profile-admission').isVisible(),false);assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),null);
  await r.page.evaluate(()=>dispatchEvent(new Event('online')));await state(r.page,'profile-pending');
  await approve(uid,false);await consentToProfile(r.page);await state(r.page,'unapproved');
  assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),null);await businessAbsent(r);assert.deepEqual(await fcBytes(r.page),before);
 }finally{await r.ctx.close();}
});

test('Native existing profile: one explicit admission preserves bytes and an active room session, then real startup and Auth restore work',async()=>{
 const r=await context({seed:false});let release=()=>{};
 r.page.on('dialog',dialog=>dialog.accept()); // Deliberate reload of a persisted, clean durable session.
 await r.ctx.addInitScript(()=>{
  const set=Storage.prototype.setItem,get=Storage.prototype.getItem;let failedWrite=false;
  Storage.prototype.setItem=function(k,v){if(window.__syntheticAdmissionFail&&k==='meble_access_profile_v1')failedWrite=true;return set.call(this,k,v);};
  Storage.prototype.getItem=function(k){if(failedWrite&&k==='meble_access_profile_v1'){failedWrite=false;throw Error('synthetic one-time admission readback failure');}return get.call(this,k);};
 });
 try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'admission-native-owner');await state(r.page,'unapproved');await approve(uid);
  await r.page.reload();await businessReady(r.page);
  const saved=await r.page.evaluate(async()=>{
   const api=window.FC,inv=api.investors.create({name:'Syntetyczny właściciel zastanego profilu'});
   const cab={id:'admission-cabinet',type:'stojąca',subType:'standardowa',width:60,height:80,depth:50,bodyColor:'laminat White',frontMaterial:'laminat',frontColor:'White',backMaterial:'HDF',frontCount:2,details:{shelves:2}};
   const record=api.projectStore.ensureForInvestor(inv.id,{projectData:{kuchnia:{settings:{legHeight:10},cabinets:[cab],fronts:[],sets:[]}}});
   const candidate=structuredClone(record);candidate.projectData.kuchnia.cabinets=[cab];
   const central=api.projectStore.updateRecordConfirmed(candidate,record);if(!central)throw Error('Synthetic confirmed save refused');
   projectData=structuredClone(central.projectData);uiState=api.uiState.set({currentInvestorId:inv.id,roomType:'kuchnia',entry:'app',activeTab:'wywiad'});
   const confirmed=api.project.saveConfirmed(projectData);if(!confirmed.ok)throw Error('Synthetic final scoped data/summary save refused');projectData=confirmed.project;
   if(!await api.openRoom('kuchnia'))throw Error('Synthetic durable session refused');
   return {projectId:api.session.projectId,roomId:api.session.roomId,snapshot:localStorage.getItem('fc_edit_session_v1')};
  });
  assert.ok(saved.snapshot);
  // Validate the pre-release backup procedure through the CURRENT existing
  // exporter, without introducing another backup path or restoring anything.
  const backupBefore=await fcBytes(r.page),downloaded=r.page.waitForEvent('download');
  await r.page.evaluate(()=>window.FC.dataBackupStore.exportCurrent());
  const download=await downloaded;assert.match(download.suggestedFilename(),/^meble-app-export-.*\.json$/);
  const copy=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(copy.kind,'meble-app-data-export');assert.equal(copy.version,1);
  for(const key of ['fc_projects_v1','fc_investors_v1','fc_quote_rates_v1','fc_sheet_materials_v1','fc_accessories_v1'])if(key in backupBefore)assert.equal(copy.snapshot.keys[key],backupBefore[key],key+' in retained backup');
  assert.equal('fc_edit_session_v1' in copy.snapshot.keys,false,'existing backup deliberately excludes active session');
  assert.deepEqual(await fcBytes(r.page),backupBefore,'existing export procedure does not rewrite the source');
  // Fixture preparation only: emulate the pre-deployment profile, without its
  // future receipt. Never run this operation against an owner's browser data.
  const inspection=await r.ctx.newPage();await inspection.goto(base+'/__synthetic_inspection');
  await inspection.evaluate(async()=>{
   localStorage.removeItem('meble_access_profile_v1');
   // Synthetic pre-upgrade fixture only: the old release had no coordinator DB.
   await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase('meble-access-profile-v1');request.onsuccess=()=>resolve();request.onerror=request.onblocked=()=>reject(Error('synthetic database fixture cleanup blocked'));});
  });await inspection.close();
  await r.page.reload();await state(r.page,'profile-pending');const before=await fcBytes(r.page);
  assert.equal(before.fc_edit_session_v1,saved.snapshot);
  await r.page.evaluate(()=>{window.__syntheticAdmissionFail=true;});await consentToProfile(r.page);await state(r.page,'error');
  assert.match(await r.page.locator('#auth-error').innerText(),/LOCAL_ACCESS_UNCONFIRMED/);assert.deepEqual(await fcBytes(r.page),before);
  await r.page.reload();await state(r.page,'profile-pending');assert.equal(await r.page.locator('#auth-profile-confirm').isDisabled(),true);
  assert.deepEqual(await fcBytes(r.page),before,'restart after a failed admission cannot run business startup or discard its session');
  for(const [width,height]of [[320,640],[393,360],[768,1024],[1440,900]]){
   await r.page.setViewportSize({width,height});await geometry(r.page);
   await r.page.locator('#auth-profile-cancel').scrollIntoViewIfNeeded();assert.equal(await r.page.locator('#auth-profile-cancel').isVisible(),true);
  }
  await r.page.setViewportSize({width:393,height:852});await r.page.screenshot({path:'/tmp/cloud-2b3-profile-admission-phone.png',fullPage:true});
  let heldResolve;const held=new Promise(resolve=>{heldResolve=resolve;}),pending=new Promise(resolve=>{release=resolve;});
  await r.ctx.route('**/js/app/shared/constants.js*',async route=>{heldResolve();await pending;try{await route.continue();}catch(_){}});
  await consentToProfile(r.page);await held;
  assert.equal(await r.page.evaluate(()=>window.__APP_STARTED__),undefined);
  assert.deepEqual(await fcBytes(r.page),before,'admission itself changes zero fc_* bytes, before any business module executes');
  const receipt=await r.page.evaluate(()=>JSON.parse(localStorage.getItem('meble_access_profile_v1')));
  assert.equal(receipt.version,3);assert.equal(receipt.uid,uid);assert.match(receipt.attemptId,/^[0-9a-f-]{36}$/);
  assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_pending_v1')),null);
  release();await businessReady(r.page);await r.ctx.unroute('**/js/app/shared/constants.js*');
  const after=await fcBytes(r.page);assert.equal(after.fc_edit_session_v1,saved.snapshot,'startup must not cancel or replace the durable snapshot');
  for(const key of ['fc_investors_v1','fc_quote_rates_v1','fc_sheet_materials_v1','fc_accessories_v1','fc_quote_snapshots_v1','fc_data_backups_v1'])assert.equal(after[key],before[key],key+' unchanged after normal startup');
  const oldProjects=JSON.parse(before.fc_projects_v1),newProjects=JSON.parse(after.fc_projects_v1);
  // Ordinary, unchanged startup autosave updates only the central timestamp.
  // The stronger byte-for-byte assertion above applies before any business JS.
  assert.equal(newProjects.length,oldProjects.length);
  newProjects.forEach((project,i)=>{assert.ok(Number.isFinite(project.updatedAt)&&project.updatedAt>=oldProjects[i].updatedAt);assert.deepEqual({...project,updatedAt:oldProjects[i].updatedAt},oldProjects[i]);});
  assert.deepEqual(await r.page.evaluate(()=>({active:window.FC.session.active,projectId:window.FC.session.projectId,roomId:window.FC.session.roomId})),{active:true,projectId:saved.projectId,roomId:saved.roomId});
  await r.page.reload();await businessReady(r.page);assert.equal(await r.page.locator('#auth-profile-admission').isVisible(),false);assert.equal((await fcBytes(r.page)).fc_edit_session_v1,saved.snapshot);
  await r.page.locator('#main-signout').click();await state(r.page,'unauthenticated');
  const other=await syntheticLogin(r.page,'admission-other-owner');await state(r.page,'unapproved');await approve(other);await r.page.reload();await state(r.page,'error');
  assert.match(await r.page.locator('#auth-error').innerText(),/LOCAL_ACCESS_OTHER_ACCOUNT/);assert.equal(await r.page.locator('#auth-profile-admission').isVisible(),false);
  assert.equal((await fcBytes(r.page)).fc_edit_session_v1,saved.snapshot);
 }finally{release();await r.ctx.close();}
});

test('Profile admission detects concurrent business changes, receipt corruption and failed/partial writes without starting business',async()=>{
 for(const kind of ['changed-data','corrupt-receipt','swallowed-write','partial-write','changed-during-write','commit-removal']){
  const r=await context();try{
   if(['swallowed-write','partial-write','changed-during-write','commit-removal'].includes(kind))await r.ctx.addInitScript(kind=>{
    const set=Storage.prototype.setItem,get=Storage.prototype.getItem,remove=Storage.prototype.removeItem;let written=false;
    Storage.prototype.setItem=function(k,v){if(k==='meble_access_profile_v1'){if(kind==='swallowed-write')return;written=true;}const result=set.call(this,k,v);if(kind==='changed-during-write'&&k==='meble_access_profile_v1')set.call(this,'fc_price_list_v1','{"sentinel":"concurrent-during-admission"}');return result;};
    Storage.prototype.getItem=function(k){if(kind==='partial-write'&&k==='meble_access_profile_v1'&&written)throw Error('synthetic readback failure');return get.call(this,k);};
    Storage.prototype.removeItem=function(k){if(kind==='commit-removal'&&k==='meble_access_profile_pending_v1')throw Error('synthetic atomic removal failure');return remove.call(this,k);};
   },kind);
   await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'admission-fault-'+kind);await state(r.page,'unapproved');await approve(uid);
   await r.page.reload();await state(r.page,'profile-pending');
   const inspector=await r.ctx.newPage();await inspector.goto(base+'/__synthetic_inspection');
   if(kind==='changed-data')await inspector.evaluate(()=>localStorage.setItem('fc_price_list_v1','{"sentinel":"newer-synthetic-price"}'));
   if(kind==='corrupt-receipt')await inspector.evaluate(()=>localStorage.setItem('meble_access_profile_v1','broken'));
   // Returning focus can legitimately start a fresh proof/confirmation; use the
   // original visible page without bringing another page to the foreground.
   const before=await fcBytes(r.page);
   if(kind==='corrupt-receipt'){
    await r.page.reload();await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/LOCAL_ACCESS_INVALID/);
   }else{
    await consentToProfile(r.page);await state(r.page,'error');
    assert.match(await r.page.locator('#auth-error').innerText(),['changed-data','changed-during-write'].includes(kind)?/LOCAL_ACCESS_DATA_CHANGED/:/LOCAL_ACCESS_UNCONFIRMED/);
   }
   const expected={...before,...(kind==='changed-during-write'?{fc_price_list_v1:'{"sentinel":"concurrent-during-admission"}'}:{})};
   await businessAbsent(r);assert.deepEqual(await fcBytes(r.page),expected);
   const raw=await inspector.evaluate(()=>Object.fromEntries(Object.entries(localStorage)).meble_access_profile_v1??null);
   if(kind==='corrupt-receipt')assert.equal(raw,'broken');
   else if(['partial-write','changed-during-write','commit-removal'].includes(kind)){assert.equal(JSON.parse(raw).version,3);assert.equal(JSON.parse(raw).uid,uid);}
   else assert.equal(raw,null);
   if(kind!=='corrupt-receipt'){
    // A NEW document forgets all in-memory fault flags. A persisted candidate
    // must still be vetoed, not silently accepted as in a3e1bedf.
    await r.page.reload();await state(r.page,'profile-pending');
    assert.equal(await r.page.locator('#auth-profile-backup').isChecked(),false);assert.equal(await r.page.locator('#auth-profile-owner').isChecked(),false);
    assert.equal(await r.page.locator('#auth-profile-confirm').isDisabled(),true);await businessAbsent(r);assert.deepEqual(await fcBytes(r.page),expected);
    if(['partial-write','changed-during-write'].includes(kind)){
     const barrier=await inspector.evaluate(()=>JSON.parse(localStorage.getItem('meble_access_profile_pending_v1')));assert.equal(barrier.uid,uid);assert.equal(barrier.attemptId,JSON.parse(raw).attemptId);
     await approve(uid,false);await r.page.reload();await state(r.page,'unapproved');
     assert.equal(await r.page.locator('#auth-profile-admission').isVisible(),false);await businessAbsent(r);
     await approve(uid);await r.page.reload();await state(r.page,'profile-pending');assert.equal(await r.page.locator('#auth-profile-confirm').isDisabled(),true);await businessAbsent(r);
     if(kind==='partial-write'){
      await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');
      const other=await syntheticLogin(r.page,'failed-admission-other-approved');await state(r.page,'unapproved');await approve(other);
      await r.page.reload();await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/LOCAL_ACCESS_OTHER_ACCOUNT/);
      assert.equal(await r.page.locator('#auth-profile-admission').isVisible(),false);await businessAbsent(r);
      assert.deepEqual(await fcBytes(r.page),expected);
      assert.equal(await inspector.evaluate(()=>JSON.parse(localStorage.getItem('meble_access_profile_pending_v1')).uid),uid,'even an approved second UID cannot replace the pending owner');
     }
    }
   }
   await inspector.close();
  }finally{await r.ctx.close();}
 }
});

test('Two existing-profile admissions use the real cross-tab Web Lock and never overwrite a foreign UID',async()=>{
 const r=await context(),other=await r.ctx.newPage();try{
  for(const page of [r.page,other]){await page.goto(base+'/__synthetic_inspection');await page.addScriptTag({url:base+'/js/app/cloud/local-access-profile.js'});}
  const before=await fcBytes(r.page);
  const prepare=async(page,uid)=>page.evaluate(async uid=>{window.__profile=window.FC.localAccessProfile.create(localStorage,sessionStorage);window.__ticket=await window.__profile.prepareAdmission(uid);},uid);
  await prepare(r.page,'synthetic-existing-owner');await prepare(other,'synthetic-foreign-owner');
  await r.page.evaluate(()=>{window.__held=false;navigator.locks.request('meble-main-access-profile-v1',()=>new Promise(resolve=>{window.__release=resolve;window.__held=true;}));});await r.page.waitForFunction(()=>window.__held);
  const submit=async(page,uid)=>page.evaluate(uid=>navigator.locks.request('meble-main-access-profile-v1',async()=>{
   try{await window.__profile.admitExisting(uid,window.__ticket,{backupConfirmed:true,ownerConfirmed:true});return 'ok';}catch(e){return e.code;}
  }),uid);
  const first=submit(r.page,'synthetic-existing-owner');
  await r.page.waitForFunction(()=>navigator.locks.query().then(x=>x.pending.length===1));
  const second=submit(other,'synthetic-foreign-owner');
  await r.page.waitForFunction(()=>navigator.locks.query().then(x=>x.pending.length===2));
  await r.page.evaluate(()=>window.__release());assert.equal(await first,'ok');assert.equal(await second,'LOCAL_ACCESS_OTHER_ACCOUNT');
  assert.deepEqual(await fcBytes(r.page),before);assert.equal(await r.page.evaluate(()=>JSON.parse(localStorage.getItem('meble_access_profile_v1')).uid),'synthetic-existing-owner');
 }finally{await other.close();await r.ctx.close();}
});

test('Logout while explicit admission waits for the profile lock invalidates consent and cannot write the receipt',async()=>{
 const r=await context(),locker=await r.ctx.newPage();try{
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');const uid=await syntheticLogin(r.page,'admission-waiting-owner');await state(r.page,'unapproved');await approve(uid);
  await r.page.reload();await state(r.page,'profile-pending');const before=await fcBytes(r.page);
  await locker.goto(base+'/__synthetic_inspection');
  await locker.evaluate(()=>{window.__held=false;navigator.locks.request('meble-main-access-profile-v1',()=>new Promise(resolve=>{window.__release=resolve;window.__held=true;}));});await locker.waitForFunction(()=>window.__held);
  await consentToProfile(r.page);await r.page.waitForFunction(()=>navigator.locks.query().then(x=>x.pending.some(lock=>lock.name==='meble-main-access-profile-v1')));
  await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');await locker.evaluate(()=>window.__release());
  await r.page.waitForFunction(()=>navigator.locks.query().then(x=>!x.pending.length&&!x.held.length));
  assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),null);assert.equal(await r.page.locator('#auth-profile-admission').isVisible(),false);
  assert.deepEqual(await fcBytes(r.page),before);await businessAbsent(r);
 }finally{await locker.close();await r.ctx.close();}
});

test('Prepared pilot borrows actual main Google session; close preserves Auth, server verifier and business access',async()=>{
 const r=await context({seed:false});
 try{
  // Test-only observation of the real factory result: production main keeps it private.
  await r.ctx.route('**/js/app/cloud/cloud-auth.js*',async route=>{
   const body=fs.readFileSync(path.join(root,'js/app/cloud/cloud-auth.js'),'utf8');
   await route.fulfill({contentType:'text/javascript',body:body+'\n{const original=FC.cloudAuth.create;FC.cloudAuth.create=async function(...args){const session=await original(...args);window.__syntheticSharedAuth=session;return session;};}'});
  });
  await r.ctx.route('**/js/app/cloud/cloud-access-verifier.js*',async route=>{
   const body=fs.readFileSync(path.join(root,'js/app/cloud/cloud-access-verifier.js'),'utf8');
   await route.fulfill({contentType:'text/javascript',body:body+'\n{const original=window.FC.cloudAccessVerifier.create;window.FC.cloudAccessVerifier.create=function(...args){const verifier=original(...args);window.__syntheticSharedVerifier=verifier;return verifier;};}'});
  });
  await r.ctx.route('**/js/app/cloud/auth-access-gate.js*',async route=>{
   const body=fs.readFileSync(path.join(root,'js/app/cloud/auth-access-gate.js'),'utf8');
   await route.fulfill({contentType:'text/javascript',body:body+'\n{const original=window.FC.authAccessGate.create;window.FC.authAccessGate.create=function(session,options){return original(session,{...options,onAuthorized(lease){window.__syntheticLease=lease;return options.onAuthorized(lease);}});};}'});
  });
  await r.page.goto(base+'/index.html');await state(r.page,'unauthenticated');
  assert.equal(r.requests.some(url=>url.includes('firebase-pilot-live-transport')),false,'normal login does not load LIVE adapter');
  const uid=await syntheticLogin(r.page,'main-shared-pilot-owner');await state(r.page,'unapproved');await approve(uid);
  await r.page.reload();await businessReady(r.page);const before=await fcBytes(r.page);
  assert.equal(r.requests.some(url=>url.includes('firebase-pilot-live-transport')),false,'normal business startup does not load LIVE adapter');
  assert.equal(r.requests.some(url=>url.includes('controlled-project-pilot')||url.includes('cloud4-source-worker')),false,'normal startup cannot launch CLOUD-4');
  for(const name of ['global-data-contract','firebase-global-transport','cloud-data-session'])assert.equal(r.requests.some(url=>url.includes(name)),false,'normal startup does not load CLOUD-3');
  // Only this isolated emulator test loads the otherwise unregistered candidates.
  for(const name of ['global-data-contract','firebase-global-transport','cloud-data-session'])await r.page.addScriptTag({url:base+'/js/app/cloud/'+name+'.js'});
  await r.page.addScriptTag({url:base+'/js/app/cloud/firebase-pilot-live-transport.js'});
  await r.page.addScriptTag({url:base+'/js/app/cloud/controlled-project-pilot.js'});
  const result=await r.page.evaluate(async()=>{
   const session=window.__syntheticSharedAuth,who=session.identity(),ctx=session.verificationContext();
   const f=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
   const original=f.getFirestore(ctx.app);
   // Actual worker imports native project/session/export modules into an isolated
   // MemoryStorage realm, never the real page localStorage or active project.
   const worker=new Worker('tools/firebase-pilot/cloud4-source-worker.js');
   let serial=0;
   const builder={build:options=>new Promise((resolve,reject)=>{
    const id=++serial,timer=setTimeout(()=>reject(Error('Synthetic source worker timeout')),15000);
    worker.onmessage=event=>{if(event.data.id===id){clearTimeout(timer);resolve(event.data.result);}};
    worker.onerror=()=>{clearTimeout(timer);reject(Error('Synthetic source worker failed'));};
    worker.postMessage({id,options});
   })};
   const contract=window.FC.controlledProjectPilot,source=await builder.build({...contract.scope,purpose:'pilot'});
   if(!source.ok||source.utf8Bytes!==6797||source.document.integrity.payloadSha256!==contract.payloadSha256)throw Error('Native source mismatch');
   const controlled=await contract.borrow({authSession:session,lease:window.__syntheticLease,assertLocalAccess:()=>window.__FC_MAIN_ACCESS__.assert(),builder,
    approval:{version:1,ownerUid:who.uid,...contract.scope,payloadSha256:contract.payloadSha256,rulesSha256:contract.rulesSha256,expiresAt:Date.now()+600000}});
   const refusal=await controlled.prepare();
   if(refusal.code!=='CLOUD_PERMISSION_DENIED')throw Error('CLOUD-4 must require separate project grant');
   await controlled.close();worker.terminate();
   const handles=await window.FC.firebasePilotLiveTransport.create({authSession:session,assertAccess:()=>window.__FC_MAIN_ACCESS__.assert()});
   if(handles.app!==ctx.app||handles.auth!==ctx.auth||handles.db!==original)throw Error('Shared instance mismatch');
   const pilot=window.FC.projectCloudPilot.create(handles.transport);
   const denied=await pilot.readHead({investorId:'synthetic-investor',projectId:'synthetic-project'});
   if(denied.code!=='CLOUD_PERMISSION_DENIED')throw Error('App approval must not authorize business pilot');
   const boundary=await window.FC.cloudDataSession.borrow({authSession:session,assertAccess:()=>window.__FC_MAIN_ACCESS__.assert()});
   const globalDenied=await boundary.globals.readHead();
   if(globalDenied.code!=='GLOBAL_PERMISSION_DENIED')throw Error('App approval must not authorize global data');
   await boundary.close();
   if(session.verificationContext().auth!==ctx.auth||f.getFirestore(ctx.app)!==original)throw Error('Global close replaced shared instance');
   await pilot.close();
   window.__FC_MAIN_ACCESS__.assert();
   const proof=await window.__syntheticSharedVerifier.verify(who);
   return {sameIdentity:JSON.stringify(session.identity())===JSON.stringify(who),approved:proof.ok,closed:(await pilot.readHead({investorId:'I',projectId:'P'})).ok};
  });
  assert.equal(result.sameIdentity,true);assert.equal(result.approved,true);assert.equal(result.closed,false);
  assert.deepEqual(await fcBytes(r.page),before);assert.deepEqual(r.external,[]);
  await r.page.locator('#main-signout').click();await state(r.page,'unauthenticated');
  assert.deepEqual(await inspectBytes(r.ctx),before);
 }finally{await r.ctx.close();}
});

// Real native IndexedDB, independent tab storage views; no Firebase or business startup.
async function isolatedProfiles({stale=false}={}){
 const r=await context({seed:false}),other=await r.ctx.newPage();
 for(const page of [r.page,other]){
  await page.goto(base+'/__synthetic_inspection');
  await page.evaluate(stale=>{
   for(const key of ['fc_quote_rates_v1','fc_accessories_v1','fc_projects_v1','fc_edit_session_v1','fc_data_backups_v1','fc_quote_snapshots_v1','hardwareSettings','hardwareCategories','hardwareSuppliers','hardwareTechnicalParams','hardwareTypes'])if(localStorage.getItem(key)===null)localStorage.setItem(key,'synthetic unchanged '+key);
   sessionStorage.setItem('fc_reload_restore_v1','synthetic unchanged session');
   if(stale){
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,cache=new Map();
    const protectedKey=k=>String(k).startsWith('meble_access_profile_');
    // Force the exact original defect: each tab reads only its own access writes.
    Storage.prototype.getItem=function(k){return this===localStorage&&protectedKey(k)?cache.get(k)??null:get.call(this,k);};
    Storage.prototype.setItem=function(k,v){if(this===localStorage&&protectedKey(k))cache.set(k,String(v));return set.call(this,k,v);};
    Storage.prototype.removeItem=function(k){if(this===localStorage&&protectedKey(k))cache.delete(k);return remove.call(this,k);};
   }
  },stale);
  await page.addScriptTag({url:base+'/js/app/cloud/local-access-profile.js'});
  await page.evaluate(()=>{window.__profile=window.FC.localAccessProfile.create(localStorage,sessionStorage);});
 }
 return {...r,other};
}
async function profileBusiness(page){return page.evaluate(()=>({local:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')||k.startsWith('hardware'))),session:Object.fromEntries(Object.entries(sessionStorage))}));}
async function ticket(page,uid){await page.evaluate(async uid=>{window.__ticket=await window.__profile.prepareAdmission(uid);},uid);}
async function admit(page,uid){return page.evaluate(async uid=>{try{await window.__profile.admitExisting(uid,window.__ticket,{backupConfirmed:true,ownerConfirmed:true});window.__profile.assert(uid);return 'ok';}catch(e){return e.code;}},uid);}
async function storedOwner(page){return page.evaluate(()=>new Promise((resolve,reject)=>{
 const req=indexedDB.open('meble-access-profile-v1',1);req.onerror=()=>reject(Error('read coordinator'));
 req.onsuccess=()=>{const db=req.result,tx=db.transaction('ownership','readonly'),get=tx.objectStore('ownership').get('owner');let value;
 get.onsuccess=()=>{value=get.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=()=>{db.close();reject(Error('unconfirmed coordinator read'));};};
}));}
test('Deterministic stale localStorage after the winning admission cannot accept a second UID',async()=>{
 const r=await isolatedProfiles({stale:true});try{
  const a=await profileBusiness(r.page),b=await profileBusiness(r.other);
  await ticket(r.page,'deterministic-owner');await ticket(r.other,'deterministic-other');
  assert.equal(await admit(r.page,'deterministic-owner'),'ok');
  assert.equal(await r.other.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),null,'the losing tab still sees exactly the stale null');
  assert.equal(await admit(r.other,'deterministic-other'),'LOCAL_ACCESS_OTHER_ACCOUNT');
  assert.equal((await storedOwner(r.other)).uid,'deterministic-owner');
  for(const page of [r.page,r.other]){
   await page.reload();await page.addScriptTag({url:base+'/js/app/cloud/local-access-profile.js'});
   const result=await page.evaluate(async()=>{const p=window.FC.localAccessProfile.create(localStorage,sessionStorage);await p.confirm('deterministic-owner');p.assert('deterministic-owner');try{await p.confirm('deterministic-other');return 'wrong';}catch(e){return e.code;}});
   assert.equal(result,'LOCAL_ACCESS_OTHER_ACCOUNT');
  }
  assert.deepEqual(await profileBusiness(r.page),a);assert.deepEqual(await profileBusiness(r.other),b);
 }finally{await r.other.close();await r.ctx.close();}
});
test('Native Chromium: 100 simultaneous different-UID admissions never produce two successful owners',async()=>{
 let winners=0;
 for(let iteration=0;iteration<100;iteration++){
  const r=await isolatedProfiles();try{
   const a=await profileBusiness(r.page),b=await profileBusiness(r.other),uids=['native-owner-'+iteration,'native-other-'+iteration];
   await ticket(r.page,uids[0]);await ticket(r.other,uids[1]);
   // Both attempts are submitted together; no sleeps, ordering preference or retry.
   const results=await Promise.all([admit(r.page,uids[0]),admit(r.other,uids[1])]);
   assert.equal(results.filter(x=>x==='ok').length,1,'exactly one confirmed owner at iteration '+iteration+': '+JSON.stringify(results));
   assert.equal(results.filter(x=>x==='LOCAL_ACCESS_OTHER_ACCOUNT').length,1);
   const winning=uids[results.indexOf('ok')],record=await storedOwner(r.page);assert.equal(record.uid,winning);assert.equal(record.state,'active');winners++;
   assert.deepEqual(await profileBusiness(r.page),a);assert.deepEqual(await profileBusiness(r.other),b);
  }finally{await r.other.close();await r.ctx.close();}
 }
 assert.equal(winners,100);
});
test('Native same UID in two stale views shares one owner; restart uses the committed owner',async()=>{
 const r=await isolatedProfiles({stale:true});try{
  await ticket(r.page,'same-owner');await ticket(r.other,'same-owner');
  assert.deepEqual(await Promise.all([admit(r.page,'same-owner'),admit(r.other,'same-owner')]),['ok','ok']);
  assert.equal((await storedOwner(r.page)).uid,'same-owner');
  for(const page of [r.page,r.other]){await page.reload();await page.addScriptTag({url:base+'/js/app/cloud/local-access-profile.js'});assert.equal(await page.evaluate(async()=>{const p=window.FC.localAccessProfile.create(localStorage,sessionStorage);await p.confirm('same-owner');p.assert('same-owner');return 'ok';}),'ok');}
 }finally{await r.other.close();await r.ctx.close();}
});
test('Native IndexedDB activation failure/readback failure/abort leaves a pending owner, never a trusted candidate after restart',async()=>{
 for(const fault of ['activation-put','activation-readback','activation-abort','after-reservation']){
  const r=await isolatedProfiles();try{
   const before=await profileBusiness(r.page);await ticket(r.page,'fault-owner');
   await r.page.evaluate(fault=>{
    const put=IDBObjectStore.prototype.put,get=IDBObjectStore.prototype.get;let activated=false;
    IDBObjectStore.prototype.put=function(value,...args){
     if(this.name==='ownership'&&value.state==='active'){
      if(fault==='activation-put')throw Error('synthetic activation failure');
      activated=true;
     }
     const request=put.call(this,value,...args);
     if(this.name==='ownership'&&value.state==='active'&&fault==='activation-abort')request.addEventListener('success',()=>this.transaction.abort());
     if(this.name==='ownership'&&value.state==='pending'&&fault==='after-reservation')this.transaction.addEventListener('complete',()=>window.__profile.revoke());
     return request;
    };
    IDBObjectStore.prototype.get=function(...args){const request=get.apply(this,args);if(this.name==='ownership'&&activated&&fault==='activation-readback')Object.defineProperty(request,'result',{get(){throw Error('synthetic readback failure');}});return request;};
   },fault);
   assert.equal(await admit(r.page,'fault-owner'),'LOCAL_ACCESS_UNCONFIRMED',fault);
   assert.equal((await storedOwner(r.other)).state,'pending',fault+' leaves only a reservation');
   assert.deepEqual(await profileBusiness(r.page),before);
   await r.page.reload();await r.page.addScriptTag({url:base+'/js/app/cloud/local-access-profile.js'});
   const denied=await r.page.evaluate(async()=>{window.__profile=window.FC.localAccessProfile.create(localStorage,sessionStorage);try{await window.__profile.confirm('fault-owner');return 'wrong';}catch(e){return e.code;}});
   assert.equal(denied,'LOCAL_DATA_UNCLAIMED');await ticket(r.page,'fault-owner');assert.equal(await admit(r.page,'fault-owner'),'ok');
   assert.equal((await storedOwner(r.other)).state,'active');assert.deepEqual(await profileBusiness(r.page),before);
  }finally{await r.other.close();await r.ctx.close();}
 }
});
test('Native acknowledged v2 migration preserves exact legacy bytes and survives restart; unavailable IDB never trusts it',async()=>{
 const r=await context({seed:false});try{
  await r.page.goto(base+'/__synthetic_inspection');
  const raw='{ "version":2,"uid":"native-v2-owner","attemptId":"00000000-0000-4000-8000-000000000001" }';
  await r.page.evaluate(raw=>{localStorage.setItem('fc_quote_rates_v1','preserve-native-v2-price');localStorage.setItem('meble_access_profile_v1',raw);},raw);
  await r.page.addScriptTag({url:base+'/js/app/cloud/local-access-profile.js'});
  const before=await profileBusiness(r.page);
  await r.page.evaluate(async()=>{const p=window.FC.localAccessProfile.create(localStorage,sessionStorage);await p.confirm('native-v2-owner');p.assert('native-v2-owner');});
  assert.equal(await r.page.evaluate(()=>localStorage.getItem('meble_access_profile_v1')),raw);assert.deepEqual(await profileBusiness(r.page),before);
  await r.page.reload();await r.page.addScriptTag({url:base+'/js/app/cloud/local-access-profile.js'});
  assert.equal(await r.page.evaluate(async()=>{const p=window.FC.localAccessProfile.create(localStorage,sessionStorage);await p.confirm('native-v2-owner');p.assert('native-v2-owner');try{await p.confirm('foreign');return 'wrong';}catch(e){return e.code;}}),'LOCAL_ACCESS_OTHER_ACCOUNT');
  const unavailable=await r.page.evaluate(async()=>{const p=window.FC.localAccessProfile.create(localStorage,sessionStorage,{indexedDB:null});try{await p.confirm('native-v2-owner');return 'wrong';}catch(e){return e.code;}});
  assert.equal(unavailable,'LOCAL_ACCESS_COORDINATION_UNAVAILABLE');assert.deepEqual(await profileBusiness(r.page),before);
 }finally{await r.ctx.close();}
});

// End-to-end operator path: no factory interception, no public Auth/lease handles.
// Run last: this group tests the EXACT minimal prospective deployment profile.
test('CLOUD-4.1 private execution through real main owner and independent browser SDK clients',async t=>{
 const minimal=await initializeTestEnvironment({projectId:'demo-meble-app',firestore:{host:'127.0.0.1',port:18080,rules:fs.readFileSync(new URL('./firestore-live-pilot.rules',import.meta.url),'utf8')}});
 const scope={investorId:'cloud4-investor-v1',projectId:'cloud4-project-v1'};
 const approval=uid=>({version:1,ownerUid:uid,...scope,payloadSha256:'711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3',rulesSha256:'eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92',expiresAt:Date.now()+600000});
 // rules-unit-testing 5.0.0 returns Promise<void>; preserve the callback value
 // explicitly, while every read/write still runs inside the emulator context.
 async function admin(fn){
  let result;
  await minimal.withSecurityRulesDisabled(async ctx=>{result=await fn(ctx.firestore());});
  return result;
 }
 const head=(db,uid)=>doc(db,'users',uid,'pilotProjects',scope.projectId);
 const clients=[];
 async function grant(uid,enabled=true){await admin(async db=>{
  await setDoc(doc(db,'authorizedUsers',uid),{appEnabled:true,enabled,pilotProjectId:scope.projectId,pilotInvestorId:scope.investorId});
  await setDoc(doc(db,'appAccess',uid),{schemaVersion:1});
  await setDoc(doc(db,'pilotControl','cloud4'),{schemaVersion:1,ownerUid:uid,enabled:true,...scope});
 });}
 async function client(sub,{enabled=true,configure=true}={}){
  const r=await context({seed:false});clients.push(r);
  r.operator=await openPrivatePilot(r.page,base+'/index.html');await state(r.page,'unauthenticated');
  r.uid=await syntheticLogin(r.page,sub);await state(r.page,'unapproved');
  if(configure){await grant(r.uid,enabled);await r.page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await businessReady(r.page);}
  r.before=configure?await r.page.evaluate(()=>JSON.stringify({ram:projectData,local:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_'))),session:Object.fromEntries(Object.entries(sessionStorage).filter(([k])=>k.startsWith('fc_')))})):null;
  return r;
 }
 async function fresh(sub,uid){
  const r=await context({seed:false});clients.push(r);r.uid=uid;
  r.operator=await openPrivatePilot(r.page,base+'/index.html');await state(r.page,'unauthenticated');
  assert.equal(await syntheticLogin(r.page,sub),uid);await businessReady(r.page);
  r.before=await r.page.evaluate(()=>JSON.stringify({ram:projectData,local:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_'))),session:Object.fromEntries(Object.entries(sessionStorage).filter(([k])=>k.startsWith('fc_')))}));
  return r;
 }
 async function execute(r,role='write',patch={}){return r.operator.execute({role,approval:{...approval(r.uid),...patch}});}
 async function unchanged(r){if(r.before!==null)assert.equal(await r.page.evaluate(()=>JSON.stringify({ram:projectData,local:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_'))),session:Object.fromEntries(Object.entries(sessionStorage).filter(([k])=>k.startsWith('fc_')))})),r.before);}
 try{
  await t.test('No work on login; private single publication, exact independent model/bytes, close preserves shared Auth',async()=>{
   const a=await client('private-native-owner');
   assert.equal(await admin(async db=>(await getDoc(head(db,a.uid))).exists()),false,'login/startup cannot publish');
   assert.equal(a.requests.some(url=>/cloud4-source-worker|firebase-pilot-live-transport/.test(url)),false);
   assert.equal(await a.page.evaluate(()=>!!(window.__syntheticSharedAuth||window.__syntheticLease||window.FC.controlledProjectPilot||window.FC.firebasePilotLiveTransport)),false);
   const written=await execute(a);assert.equal(written.ok,true,JSON.stringify(written));
   assert.equal((await execute(a)).code,'CLOUD_OPERATION_LIMIT');
   const b=await fresh('private-native-owner',a.uid);assert.notEqual(a.ctx,b.ctx);
   const read=await execute(b,'read');assert.equal(read.ok,true,JSON.stringify(read));assert.equal(read.sourceMatches,true);assert.equal(read.utf8Bytes,6797);
   assert.equal(read.revisionId,written.revisionId);assert.equal(read.documentSha256,'5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1');
   assert.equal(read.document.payload.project.projectData.kuchnia.production.partOverrides.one['body.side.left'].edges.w2,true);
   assert.equal(read.document.payload.project.projectData.kuchnia.production.partOverrides.one['body.side.right'].edges.w2,false);
   await unchanged(a);await unchanged(b);await a.operator.close();
   assert.equal(await currentUid(a.page),a.uid);assert.equal(await a.page.evaluate(()=>window.__FC_MAIN_ACCESS__.isValid()),true);
   assert.equal((await execute(a)).code,'CLOUD_CLIENT_CLOSED');
   const original=await admin(async db=>(await getDoc(head(db,a.uid))).data());
   const c=await fresh('private-native-owner',a.uid);assert.equal((await execute(c)).code,'CLOUD_WRITE_CONFLICT');
   const after=await admin(async db=>(await getDoc(head(db,a.uid))).data());assert.deepEqual(after,original,'new client must not replace immutable first manifest');await unchanged(c);
  });
  await t.test('App authorization alone never grants pilot writes; foreign UID and approval scope denied',async()=>{
   const a=await client('private-no-pilot',{enabled:false});assert.equal((await execute(a)).code,'CLOUD_PERMISSION_DENIED');await unchanged(a);
   assert.equal(await admin(async db=>(await getDoc(head(db,a.uid))).exists()),false);
   const b=await client('private-wrong-approval');assert.equal((await execute(b,'write',{ownerUid:'foreign-synthetic'})).code,'CLOUD_APPROVAL_REQUIRED');await unchanged(b);
   const c=await client('private-unapproved',{configure:false});assert.equal((await execute(c)).ok,false);assert.equal(c.requests.some(url=>url.includes('cloud4-source-worker')),false);await businessAbsent(c);
  });
  await t.test('Concurrent fresh writers have one immutable winner and an explicitly refused loser',async()=>{
   const a=await client('private-race-owner'),b=await fresh('private-race-owner',a.uid);
   const results=await Promise.all([execute(a),execute(b)]);
   assert.equal(results.filter(x=>x.ok).length,1,JSON.stringify(results));
   assert.equal(results.filter(x=>x.ok===false).length,1);
   const winner=results.find(x=>x.ok),stored=await admin(async db=>(await getDoc(head(db,a.uid))).data());
   assert.equal(stored.currentRevisionId,winner.revisionId);assert.equal(stored.generation,1);
   await unchanged(a);await unchanged(b);
  });
  await t.test('Logout while waiting for isolated source invalidates the private operation before staging',async()=>{
   const a=await client('private-await-owner');let release,requested;
   const held=new Promise(resolve=>{release=resolve;}),reached=new Promise(resolve=>{requested=resolve;});
   await a.page.route('**/tools/firebase-pilot/cloud4-source-worker.js',async route=>{requested();await held;await route.continue();});
   const operation=execute(a);
   try{await reached;await a.page.locator('#main-signout').click();await state(a.page,'unauthenticated');}
   finally{release();}
   const out=await operation;assert.equal(out.ok,false);
   assert.equal(await admin(async db=>(await getDoc(head(db,a.uid))).exists()),false);
   assert.deepEqual(await inspectBytes(a.ctx),JSON.parse(a.before).local);
  });
  await t.test('Real durable room session denies the pilot without committing or cancelling the draft',async()=>{
   const a=await client('private-editing-owner');
   await a.page.evaluate(async()=>{
    const api=window.FC,inv=api.investors.create({name:'Syntetyczny projekt lokalny'});
    const record=api.projectStore.ensureForInvestor(inv.id,{projectData:{kuchnia:{settings:{legHeight:10},cabinets:[],fronts:[],sets:[]}}});
    projectData=structuredClone(record.projectData);
    uiState=api.uiState.set({currentInvestorId:inv.id,roomType:'kuchnia',entry:'app',activeTab:'wywiad'});
    if(!await api.openRoom('kuchnia')||!api.session.active||!api.session.durable)throw Error('Durable session required');
   });
   const sessionState=()=>a.page.evaluate(()=>{
    const session=window.FC.session;
    return {active:session.active,durable:session.durable,projectId:session.projectId,roomId:session.roomId,
     startedAt:session.startedAt,snapshot:session.snapshot,inspection:session.inspectExportState(),
     persisted:localStorage.getItem('fc_edit_session_v1'),ram:JSON.stringify(projectData)};
   });
   const editing=await sessionState();assert.equal(editing.active,true);assert.equal(editing.durable,true);
   assert.equal(editing.roomId,'kuchnia');assert.ok(editing.projectId);assert.ok(editing.persisted);
   assert.equal(editing.inspection.code,'EXPORT_ACTIVE_SESSION');
   const before=await fcBytes(a.page),out=await execute(a);assert.equal(out.code,'CLOUD_PRIVATE_SESSION_REQUIRED');
   assert.deepEqual(await fcBytes(a.page),before);assert.equal(await a.page.evaluate(()=>window.FC.session.active),true);
   assert.deepEqual(await sessionState(),editing,'pilot refusal must neither save nor cancel the real durable session');
   assert.equal(a.requests.some(url=>url.includes('cloud4-source-worker')),false);
   assert.equal(await admin(async db=>(await getDoc(head(db,a.uid))).exists()),false);
  });
  await t.test('Inactive RAM with an unconfirmed durable session remainder also denies the pilot',async()=>{
   const a=await client('private-unconfirmed-session');
   await a.page.evaluate(()=>{if(window.FC.session.active)throw Error('Expected inactive RAM');localStorage.setItem('fc_edit_session_v1','{"syntheticUnconfirmed":true}');});
   assert.equal(await a.page.evaluate(()=>window.FC.session.inspectExportState().code),'EXPORT_SESSION_UNCONFIRMED');
   const before=await fcBytes(a.page);assert.equal((await execute(a)).code,'CLOUD_PRIVATE_SESSION_REQUIRED');
   assert.deepEqual(await fcBytes(a.page),before);assert.equal(a.requests.some(url=>url.includes('cloud4-source-worker')),false);
  });
  await t.test('Lost acknowledgement after actual manifest commit stays uncertain; independent read resolves without retry',async()=>{
   const a=await client('private-lost-ack');let dropped=0,committed,accepted;
   const manifestName='projects/demo-meble-app/databases/(default)/documents/users/'+a.uid+'/pilotProjects/'+scope.projectId;
   // Web SDK 12.19.0 transactions use unary REST documents:commit, not the
   // google.firestore.v1.Firestore/Write WebChannel. Match parsed writes exactly.
   await a.page.route(url=>url.origin==='http://127.0.0.1:18080',async route=>{
    if(dropped){await route.abort('failed');return;} // Writer cannot recover the lost acknowledgement via a retry or readback.
    const request=route.request(),url=new URL(request.url());
    const body=request.method()==='POST'&&url.pathname.endsWith('/documents:commit')?request.postDataJSON():null;
    const manifest=body?.writes?.find(write=>write.update?.name===manifestName&&write.update.fields?.currentRevisionId);
    if(manifest){
     const response=await route.fetch();assert.equal(response.ok(),true);
     accepted=await response.json();assert.ok(accepted.commitTime);assert.ok(accepted.writeResults?.some(write=>write.updateTime));
     committed=await admin(async db=>(await getDoc(head(db,a.uid))).data());
     assert.ok(committed,'real server read must observe the committed manifest before dropping its response');
     assert.equal(committed.currentRevisionId,manifest.update.fields.currentRevisionId.stringValue);assert.equal(committed.generation,1);
     dropped++;await route.abort('failed');
    }else await route.continue();
   });
   const out=await execute(a);assert.equal(dropped,1,'fault must follow the real Web SDK manifest commit');
   assert.equal(out.ok,false);assert.equal(out.published,'unconfirmed');assert.equal(out.requiresIndependentRead,true);
   assert.equal((await execute(a)).code,'CLOUD_OPERATION_LIMIT');await unchanged(a);
   const b=await fresh('private-lost-ack',a.uid);assert.notEqual(a.ctx,b.ctx);
   const read=await execute(b,'read');assert.equal(read.ok,true,JSON.stringify(read));assert.equal(read.sourceMatches,true);
   assert.equal(read.revisionId,committed.currentRevisionId);assert.equal(read.utf8Bytes,6797);
   assert.equal(read.documentSha256,'5c9bc70f8fc1d7a15cef742150636e41ebacde404e57bd6109213f82d28d81a1');await unchanged(b);
  });
  await t.test('Corrupted SHA and missing fragment deny the independent reader, preserving local model',async()=>{
   for(const mode of ['sha','missing']){
    const a=await client('private-corrupt-'+mode);const out=await execute(a);assert.equal(out.ok,true,JSON.stringify(out));
    await admin(async db=>{const ref=doc(head(db,a.uid),'revisions',out.revisionId,'chunks','0');
     if(mode==='missing')await deleteDoc(ref);else{const old=(await getDoc(ref)).data(),bytes=old.bytes.toUint8Array();bytes[0]^=1;await updateDoc(ref,{bytes:Bytes.fromUint8Array(bytes)});}
    });
    const b=await fresh('private-corrupt-'+mode,a.uid);const read=await execute(b,'read');assert.equal(read.ok,false);assert.match(read.code,/CLOUD_(?:INTEGRITY|REVISION|FRAGMENT|CHUNK)/);await unchanged(a);await unchanged(b);
   }
  });
  await t.test('Logout, changed UID, revoked pilot grant and offline deny before publication',async()=>{
   for(const mode of ['logout','uid','app','grant','offline']){
    const a=await client('private-revoked-'+mode);
    if(mode==='logout'){
     await a.page.locator('#main-signout').click();await state(a.page,'unauthenticated');
    }else if(mode==='uid'){
     await syntheticLogin(a.page,'private-foreign-account');await a.page.waitForFunction(()=>!window.__FC_MAIN_ACCESS__.isValid());
    }else if(mode==='app'||mode==='grant')await admin(db=>updateDoc(doc(db,'authorizedUsers',a.uid),mode==='app'?{appEnabled:false}:{enabled:false}));
    else await a.ctx.setOffline(true);
    const out=await execute(a);assert.equal(out.ok,false,mode);if(mode==='offline')await a.ctx.setOffline(false);
    assert.equal(await admin(async db=>(await getDoc(head(db,a.uid))).exists()),false,mode+' must not publish');
    assert.deepEqual(await inspectBytes(a.ctx),JSON.parse(a.before).local,mode+' preserves stored business data');
   }
  });
 }finally{
  for(const r of clients){await r.operator?.close().catch(()=>{});await r.ctx.close();}
  await minimal.cleanup();
 }
});
