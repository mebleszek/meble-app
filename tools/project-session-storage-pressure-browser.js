'use strict';
// Full production app + main-login/local profile/gate. Synthetic Auth verifier;
// no Google SDK/login claim. All HTTP is fulfilled locally; no LIVE requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('./firebase-pilot/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),origin='https://mebleszek.github.io',prefix='/meble-app/',url=origin+prefix+'index.html';
const P='fc_projects_v1',E='fc_edit_session_v1';
const baseline=process.argv.includes('--baseline');const cp=require('node:child_process');const bytes=file=>baseline&&['js/app/investor/session.js','js/app/project/project-store.js'].includes(file)?cp.execFileSync('git',['show','0cb7044e5feec71d462354efc501dc9e4278cdb6:'+file],{cwd:root}):fs.readFileSync(path.join(root,file));
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
  // Independent empty synthetic origin: measure native quota, never touch app data.
  const quotaContext=await browser.newContext();await quotaContext.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated quota probe</title>'}));
  const qp=await quotaContext.newPage();await qp.goto(origin+'/__isolated-quota');
  const measured=await qp.evaluate(()=>{let lo=0,hi=10*1024*1024,name='';while(lo<hi){const mid=Math.ceil((lo+hi)/2);try{localStorage.setItem('probe','x'.repeat(mid));lo=mid;}catch(e){name=e.name;hi=mid-1;}}return {maxValueUnits:lo,totalKeyValueUnits:lo+5,failureName:name};});
  assert.equal(measured.failureName,'QuotaExceededError');console.log('NATIVE_QUOTA_LIMIT',JSON.stringify(measured));await quotaContext.close();passed++;console.log('PASS native quota measured in a separate empty synthetic origin');
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});const errors=[];
  await ctx.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin,'No external request');
   if(u.pathname===prefix+'__seed')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic seed</title>'});
   assert.ok(u.pathname.startsWith(prefix));const name=u.pathname.slice(prefix.length)||'index.html';const file=path.resolve(root,name);assert.ok(file.startsWith(root+path.sep));
   return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html',body:name==='js/app/cloud/cloud-auth.js'?auth:name==='js/app/cloud/cloud-access-verifier.js'?verifier:bytes(name)});
  });
  await ctx.addInitScript(()=>{const set=Storage.prototype.setItem;window.__sessionAttemptUnits=0;window.__sessionWriteFailureName=null;Storage.prototype.setItem=function(k,v){if(k==='fc_edit_session_v1')window.__sessionAttemptUnits=String(v).length;try{return set.call(this,k,v);}catch(e){if(k==='fc_edit_session_v1')window.__sessionWriteFailureName=e.name;throw e;}};});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+prefix+'__seed');
  const seed=require('./quote-performance-fixture').rows(9,true),rows=JSON.parse(seed[P]);
  for(let i=0;i<4;i++)rows.push({...rows[1],id:'bulk'+i,investorId:'bulk-owner'+i,projectData:{meta:{assignedInvestorId:'bulk-owner'+i,productionPcvMode:'project'},archive:'X'.repeat(900000)}});
  seed[P]=JSON.stringify(rows);seed.fc_quote_snapshots_v1='[]';seed.fc_private_preserved_test='synthetic-preserved';
  await p.evaluate(seed=>{for(const[k,v]of Object.entries(seed))localStorage.setItem(k,v);},seed);
  await p.goto(url);await p.waitForFunction(()=>['profile-pending','authorized','error'].includes(document.body.dataset.authState));await ready(p);
  const state=await p.evaluate(()=>({active:window.FC.session.active,durable:window.FC.session.durable,present:localStorage.getItem('fc_edit_session_v1')!==null,code:window.FC.session.lastError?.code||'NONE',failureName:window.__sessionWriteFailureName,attemptUnits:window.__sessionAttemptUnits,storageUnits:Object.entries(localStorage).reduce((n,[k,v])=>n+k.length+v.length,0),projectsUnits:localStorage.getItem('fc_projects_v1').length,payloadUnits:(localStorage.getItem('fc_edit_session_v1')||'').length}));
  console.log('NATIVE_QUOTA_BEGIN',JSON.stringify(state));
  assert.equal(state.active,true);assert.equal(state.durable,true,'Native quota must allow the owner-only snapshot');assert.equal(state.present,true);assert.ok(state.payloadUnits<state.projectsUnits/50);
  const protectedBefore=await p.evaluate(()=>({other:JSON.parse(localStorage.getItem('fc_projects_v1')).filter(r=>r.id!=='A'),investors:localStorage.getItem('fc_investors_v1'),prices:localStorage.getItem('fc_materials_v1'),hardware:localStorage.getItem('fc_accessories_v1'),history:localStorage.getItem('fc_quote_snapshots_v1'),extra:localStorage.getItem('fc_private_preserved_test')}));
  const check=async()=>assert.deepEqual(await p.evaluate(()=>({other:JSON.parse(localStorage.getItem('fc_projects_v1')).filter(r=>r.id!=='A'),investors:localStorage.getItem('fc_investors_v1'),prices:localStorage.getItem('fc_materials_v1'),hardware:localStorage.getItem('fc_accessories_v1'),history:localStorage.getItem('fc_quote_snapshots_v1'),extra:localStorage.getItem('fc_private_preserved_test')})),protectedBefore);
  passed++;console.log('PASS native Chromium quota, six projects, nine active cabinets, real Auth shell and confirmed baseline');
  // Cancel in RAM, then edit/save, all through existing handlers and touch.
  await p.evaluate(()=>{projectData.room_test_A.cabinets[0].width=63;window.FC.views.refreshSessionButtons();});await p.locator('#sessionCancel').tap();
  const confirm=p.locator('.confirm-box').getByRole('button',{name:/ANULUJ ZMIANY/});await confirm.tap();
  await p.waitForFunction(()=>projectData.room_test_A.cabinets[0].width!==63&&window.FC.session.durable);await check();
  await p.evaluate(()=>{projectData.room_test_A.cabinets[0].width=62;window.FC.views.refreshSessionButtons();});await p.locator('#sessionSave').tap();await p.getByRole('button',{name:'OK',exact:true}).tap();
  assert.equal(await p.evaluate(()=>window.FC.session.active),false);assert.equal(await p.evaluate(()=>window.FC.projectStore.getById('A').projectData.room_test_A.cabinets[0].width),62);await check();
  passed++;console.log('PASS real touch Cancel/Save under storage pressure preserve other projects and global RAW');
  await p.locator('[data-tab="inwestor"]').tap();await p.locator('[data-tab="wywiad"]').tap();
  await p.reload();await ready(p);assert.equal(await p.evaluate(()=>projectData.room_test_A.cabinets[0].width),62);await check();
  passed++;console.log('PASS investor and return, full document restart, all earlier projects intact');
  for(const room of ['room_test_B','room_test_A','room_test_C','room_test_A']){assert.equal(await p.evaluate(room=>window.FC.views.openRoom(room),room),true);assert.equal(await p.evaluate(()=>window.FC.session.durable),true);}await check();
  passed++;console.log('PASS repeated room changes have durable scopes under the native quota');
  await p.evaluate(()=>window.__revokeDiagnosticAccess());await p.waitForFunction(()=>document.body.dataset.authState==='revoked');
  const before=await raw(p);await p.evaluate(()=>window.FC.sessionDiagnostics.open());assert.match(await p.locator('.info-box__body').textContent(),/AUTH_DENIED/);assert.deepEqual(await raw(p),before);
  passed++;console.log('PASS revoked Auth remains fail-closed and preserves active session');
  assert.deepEqual(errors,[]);await ctx.close();console.log(`Storage pressure Chromium: ${passed}/${passed} PASS, 0 FAIL, 0 SKIP`);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
