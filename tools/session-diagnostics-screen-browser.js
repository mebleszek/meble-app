'use strict';
// Full production app + main-login/local profile/gate. Synthetic Auth verifier;
// no Google SDK/login claim. All HTTP is fulfilled locally; no LIVE requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('./firebase-pilot/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),origin='https://mebleszek.github.io',prefix='/meble-app/',url=origin+prefix+'index.html';
const P='fc_projects_v1',E='fc_edit_session_v1';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const auth=`(()=>{let emit;const identity={uid:'synthetic-diagnostic-owner',epoch:1};window.FC=window.FC||{};FC.cloudAuth={create:async()=>({identity:()=>identity,state:()=>({status:'authenticated',...identity}),subscribe(fn){emit=fn;queueMicrotask(()=>fn({status:'authenticated',...identity}));return()=>{};}})};})();`;
const verifier=`(()=>{let watch;window.__revokeDiagnosticAccess=()=>watch({ok:false,denied:true});FC.cloudAccessVerifier={create:()=>({verify:async()=>({ok:true,uid:'synthetic-diagnostic-owner',validUntil:Date.now()+45000}),watch(id,fn){watch=fn;return()=>{};}})};})();`;
const raw=p=>p.evaluate(()=>({local:Object.fromEntries(Object.entries(localStorage)),session:Object.fromEntries(Object.entries(sessionStorage))}));
const ram=p=>p.evaluate(()=>({session:JSON.stringify(window.FC.session),ui:JSON.stringify(uiState),project:JSON.stringify(projectData)}));
async function ready(p){
 if(await p.locator('#auth-profile-admission').isVisible()){
  await p.locator('#auth-profile-backup').check();await p.locator('#auth-profile-owner').check();await p.locator('#auth-profile-confirm').tap();
 }
 await p.waitForFunction(()=>document.body.dataset.businessState==='ready'&&window.__fcProjectAutosaveInstalled===true,null,{timeout:30000});
}
async function main(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});let passed=0;
 try{
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});const errors=[],requests=[];
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());requests.push(u.href);assert.equal(u.origin,origin,'No external request');
   if(u.pathname===prefix+'__seed')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic seed</title>'});
   assert.ok(u.pathname.startsWith(prefix));const name=u.pathname.slice(prefix.length)||'index.html';
   const file=path.resolve(root,name);assert.ok(file.startsWith(root+path.sep));
   const body=name==='js/app/cloud/cloud-auth.js'?auth:name==='js/app/cloud/cloud-access-verifier.js'?verifier:fs.readFileSync(file);
   return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html',body});
  });
  let p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+prefix+'__seed');
  await p.evaluate(seed=>{for(const[k,v]of Object.entries(seed))localStorage.setItem(k,v);},require('./quote-performance-fixture').rows(1,true));
  await p.goto(url);
  await p.waitForFunction(()=>['profile-pending','authorized','error'].includes(document.body.dataset.authState));await ready(p);
  // Create a genuine canonical partial write with a missing durable new E.
  await p.evaluate(()=>{
   if(!window.FC.session.active)throw Error('Expected real edit bootstrap');
   const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fc_edit_session_v1')throw Error('Synthetic session-write failure');return set.call(this,k,v);};
   projectData.room_test_A.cabinets[0].width=61;
   const result=window.FC.project.saveConfirmed(projectData);Storage.prototype.setItem=set;
   if(result.ok||!result.projectSaved||result.code!=='SESSION_UNCONFIRMED')throw Error('Expected genuine partial write');
  });
  await p.reload();await ready(p);
  assert.equal(await p.evaluate(()=>window.FC.session.active),true);
  // Existing real action refuses, with an actual active infoBox.
  await p.evaluate(()=>window.FC.actions.dispatch('session-save',{}));
  await p.getByRole('button',{name:'Diagnostyka sesji',exact:true}).waitFor({state:'visible'});
  assert.equal(await p.evaluate(()=>window.FC.session.lastError.code),'PROJECT_WRITE_CONFLICT');
  const allBefore=await raw(p),ramBefore=await ram(p),requestCount=requests.length;
  await p.evaluate(()=>{
   window.__diagSpy={writes:0,network:0,calls:0,reads:[],copies:[]};
   const get=Storage.prototype.getItem;
   Storage.prototype.getItem=function(k){window.__diagSpy.reads.push(String(k));return get.call(this,k);};
   for(const key of ['setItem','removeItem','clear'])Storage.prototype[key]=function(){window.__diagSpy.writes++;throw Error('Diagnostic must not write');};
   for(const key of ['fetch','XMLHttpRequest','WebSocket'])window[key]=function(){window.__diagSpy.network++;throw Error('No diagnostic network');};
   for(const key of ['begin','commit','cancel','canSaveProject','retryInitialBegin','inspectNavigationState'])window.FC.session[key]=function(){window.__diagSpy.calls++;throw Error('No domain method');};
   window.FC.projectDomainOperations.recoverProject=function(){window.__diagSpy.calls++;throw Error('No recovery');};
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});
  });
  const check=async()=>{
   assert.deepEqual(await raw(p),allBefore);assert.deepEqual(await ram(p),ramBefore);
   const spy=await p.evaluate(()=>window.__diagSpy);assert.equal(spy.writes,0);assert.equal(spy.network,0);assert.equal(spy.calls,0);assert.equal(requests.length,requestCount);
  };
  await p.getByRole('button',{name:'Diagnostyka sesji',exact:true}).tap();
  await p.getByRole('dialog').filter({hasText:'Diagnostyka sesji'}).waitFor();
  const body=p.locator('.info-box__body');const text=await body.innerText();
  assert.match(text,/Kod: PROJECT_WRITE_CONFLICT/);assert.match(text,/C = B \(baseline\): NIE/);assert.match(text,/C = E \(potwierdzona\): NIE/);assert.match(text,/RAM = payload: TAK/);assert.match(text,/Snapshot kompletny: TAK/);
  assert.doesNotMatch(text,/synthetic-diagnostic-owner|room_test|Syntetyczny|AIza|PRIVATE/i);await check();
  const box=await p.locator('.info-box').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=852,'Report fits mobile screenshot');
  assert.equal(await p.locator('.info-backdrop').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(248, 250, 252)','Opaque background hides all customer context in a screenshot');
  await p.screenshot({path:path.join(process.env.DIAG_ARTIFACT_DIR||'/tmp','session-diagnostic-synthetic.png')});
  passed++;console.log('PASS real blocked session after restart -> error dialog -> touch -> anonymous report, all RAW/RAM unchanged');
  await p.getByRole('button',{name:'Kopiuj raport',exact:true}).tap();await p.getByText('Schowek niedostępny — zrób zrzut ekranu.',{exact:false}).waitFor();await check();
  passed++;console.log('PASS clipboard unavailable: report remains visible, zero fallback writes');
  await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(text){window.__diagSpy.copies.push(text);}}});});
  await p.getByRole('button',{name:'Kopiuj raport',exact:true}).tap();await p.getByText('Skopiowano raport.',{exact:false}).waitFor();
  const copied=JSON.parse(await p.evaluate(()=>window.__diagSpy.copies[0]));assert.equal(copied.status,'READ_ONLY');assert.equal(copied.code,'PROJECT_WRITE_CONFLICT');assert.equal(copied.CB,false);assert.equal(copied.CE,false);assert.equal(copied.usage.status,'MEASURED');assert.equal(copied.usage.unit,'UTF16_CODE_UNITS');assert.deepEqual(Object.keys(copied.usage.categories).sort(),['backups','catalogs','history','investors','other','projects','session']);for(const group of Object.values(copied.usage.categories)){assert.ok(Number.isInteger(group.units)&&group.units>=0);assert.ok(Number.isInteger(group.keys)&&group.keys>=0);}assert.doesNotMatch(JSON.stringify(copied),/synthetic-diagnostic-owner|room_test|Syntetyczny|PRIVATE/i);assert.equal(copied.storageSizes.complete,true);assert.equal(copied.storageSizes.kind,'meble-app-storage-sizes');assert.equal(copied.storageSizes.totalUnits,copied.usage.totalUnits);assert.equal(copied.storageSizes.top.length,Math.min(10,Object.values(copied.usage.categories).reduce((n,g)=>n+g.keys,0)));assert.ok(copied.storageSizes.top.every(row=>Number.isInteger(row.valueUnits)&&row.valueUnits>=0));assert.ok(JSON.stringify(copied).length<6000);await check();
  passed++;console.log('PASS optional copy contains sanitized JSON only');
  await p.getByRole('button',{name:'OK',exact:true}).tap();assert.equal(await p.locator('.info-backdrop').count(),0);await check();
  // The original guard must still refuse: restore only the real functions in a fresh document.
  await p.reload();await ready(p);const nextBefore=await raw(p);
  // Bootstrap may already report the restored conflict. Acknowledge that real
  // modal before touching a tab; never force a click through its backdrop.
  if(await p.locator('.info-backdrop').count())await p.getByRole('button',{name:'OK',exact:true}).tap();
  await p.locator('[data-tab="wycena"]').tap();await p.getByRole('button',{name:'Diagnostyka sesji',exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>window.FC.session.active),true);assert.deepEqual(await raw(p),nextBefore);
  await p.getByRole('button',{name:'Diagnostyka sesji',exact:true}).tap();assert.match(await body.innerText(),/C = E \(potwierdzona\): NIE/);assert.deepEqual(await raw(p),nextBefore);
  passed++;console.log('PASS navigation refusal still exposes diagnosis after another full restart, no session cleanup');
  // Unrelated boxes retain their old button/dismiss behavior.
  await p.evaluate(()=>window.FC.infoBox.open({title:'Ordinary synthetic message',message:'Unchanged',okOnly:true}));
  assert.deepEqual(await p.locator('.info-box button').allTextContents(),['OK']);await p.getByRole('button',{name:'OK',exact:true}).tap();
  await p.evaluate(()=>window.FC.infoBox.open({title:'Ordinary synthetic message',message:'Unchanged'}));
  assert.equal(await p.locator('.info-box__close').count(),1);assert.equal(await p.getByRole('button',{name:'Diagnostyka sesji',exact:true}).count(),0);await p.locator('.info-box__close').tap();
  passed++;console.log('PASS ordinary info boxes retain existing controls');
  await p.evaluate(()=>window.__revokeDiagnosticAccess());await p.waitForFunction(()=>document.body.dataset.authState==='revoked');
  const deniedBefore=await raw(p),deniedRam=await ram(p);
  await p.evaluate(()=>{
   window.__deniedReads=[];const get=Storage.prototype.getItem;
   Storage.prototype.getItem=function(k){if(['fc_edit_session_v1','fc_projects_v1'].includes(k))window.__deniedReads.push(k);return get.call(this,k);};
   window.FC.sessionDiagnostics.open();
  });
  assert.match(await body.textContent(),/AUTH_DENIED/);assert.deepEqual(await p.evaluate(()=>window.__deniedReads),[]);assert.deepEqual(await raw(p),deniedBefore);assert.deepEqual(await ram(p),deniedRam);assert.equal(await p.getByRole('button',{name:'Kopiuj raport',exact:true}).count(),0);
  passed++;console.log('PASS revoked real main gate: direct API refuses with zero business reads and no data mutation');
  assert.deepEqual(errors,[]);await ctx.close();console.log(`Session diagnostic mobile Chromium: ${passed}/${passed} PASS, 0 FAIL, 0 SKIP`);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
