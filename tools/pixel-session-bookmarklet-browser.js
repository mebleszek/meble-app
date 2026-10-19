'use strict';
// Real javascript: URL execution and native clipboard; production main access gate.
// Auth identity/verifier are synthetic fixtures. This is NOT a Google login test.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('./firebase-pilot/node_modules/playwright-core');
const {fixture}=require('./project-navigation-blockers-smoke'),{build}=require('./build-pixel-session-bookmarklet');
const root=path.resolve(__dirname,'..'),url='https://mebleszek.github.io/meble-app/index.html';
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
const P='fc_projects_v1',E='fc_edit_session_v1';
async function data(){const r=fixture(undefined,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});await r.open();return r;}
function html(approved){
  const ids=['main-login','auth-status','auth-error','auth-google','auth-account','auth-profile-admission','auth-profile-backup','auth-profile-owner','auth-profile-confirm','auth-profile-cancel','main-auth-bar','main-signout','auth-signout'];
  const setup=`window.FC={};let identity={uid:'synthetic-browser-owner',epoch:1},watch,emit;window.__revoke=()=>watch({ok:false,denied:true});window.__APP_STARTED__=true;window.__nonce=crypto.randomUUID();
  window.FC.cloudAuth={create:async()=>({identity:()=>identity,subscribe(fn){emit=fn;queueMicrotask(()=>fn({status:'authenticated',...identity}));return()=>{};}})};
  window.FC.cloudAccessVerifier={create:()=>({verify:async()=>({ok:${approved},uid:identity.uid,validUntil:Date.now()+45000}),watch(_id,fn){watch=fn;return()=>{};}})};
  window.FC.mainBusinessLoader={create:()=>({start:async()=>{},abort(){}})};`;
  return '<!doctype html><meta charset="utf-8"><style id="auth-theme"></style>'+ids.map(id=>'<div id="'+id+'"></div>').join('')+'<template id="business-template"><section>Unchanged synthetic document</section></template><template id="business-styles"></template><script>'+setup+'</script>'+['js/app/cloud/local-access-profile.js','js/app/cloud/auth-access-gate.js','js/main-login.js'].map(file=>'<script>'+source(file)+'</script>').join('');
}
async function main(){
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  let passed=0;
  try{
    for(const mode of ['valid','lost-revision','missing-proof','denied','revoked','unreadable','clipboard-denied']){
      const r=await data();
      if(mode==='lost-revision'){r.storage.fail.set(E,true);r.s.projectData.room_k.cabinets[0].width=65;assert.equal(r.FC.project.saveConfirmed(r.s.projectData).projectSaved,true);}
      const seed=r.seed();
      if(mode==='missing-proof'){const p=JSON.parse(seed[E]);delete p.snapshot.fc_edge_v1;seed[E]=JSON.stringify(p);}
      const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
      const requests=[],errors=[];
      await ctx.route('**/*',async route=>{requests.push(route.request().url());assert.equal(route.request().url(),url);await route.fulfill({contentType:'text/html',body:html(mode!=='denied')});});
      const p=await ctx.newPage();p.on('pageerror',error=>errors.push(error.message));let dialogs=0;p.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});await p.goto(url);
      if(mode==='denied')await p.waitForFunction(()=>document.body.dataset.authState==='unapproved');
      else{
        await p.waitForFunction(()=>document.body.dataset.businessState==='ready');
        await p.evaluate(seed=>{for(const[k,v]of Object.entries(seed))localStorage.setItem(k,v);},seed);
        await p.addScriptTag({content:'let uiState='+seed.fc_ui_v1+';'});
        await p.addScriptTag({content:source('js/app/investor/session.js')});
        await p.evaluate(()=>{window.FC.session.lastError={code:'SESSION_UNCONFIRMED',message:'PRIVATE_MESSAGE_SENTINEL'};});
        if(mode==='revoked'){await p.evaluate(()=>window.__revoke());await p.waitForFunction(()=>document.body.dataset.authState==='revoked');}
      }
      await p.evaluate(mode=>{
        window.__spy={writes:0,reads:[],dom:[],forbidden:0,copies:[],copied:0,copyDone:0};
        const get=Storage.prototype.getItem;
        Storage.prototype.getItem=function(k){if(String(k).startsWith('fc_'))window.__spy.reads.push(k);if(mode==='unreadable'&&k==='fc_edit_session_v1')throw Error('PRIVATE_READ_ERROR');return get.call(this,k);};
        for(const name of ['setItem','removeItem','clear'])Storage.prototype[name]=function(){window.__spy.writes++;throw Error('Write forbidden');};
        for(const name of ['fetch','XMLHttpRequest','WebSocket','Image'])window[name]=function(){window.__spy.forbidden++;throw Error('Network forbidden');};
        const write=navigator.clipboard.writeText.bind(navigator.clipboard);
        Object.defineProperty(navigator,'clipboard',{value:{async writeText(text){window.__spy.copies.push(text);try{if(mode==='clipboard-denied')throw Error('Synthetic clipboard refusal');await write(text);window.__spy.copied++;}finally{window.__spy.copyDone++;}},readText(){window.__spy.forbidden++;throw Error('Reading previous clipboard forbidden');}}});
        if(window.FC.session)for(const name of ['begin','commit','cancel','canSaveProject','recoverProject','inspectNavigationState','retryInitialBegin'])window.FC.session[name]=function(){window.__spy.forbidden++;throw Error('Application call forbidden');};
        window.__observer=new MutationObserver(rows=>window.__spy.dom.push(...rows.map(row=>row.type)));window.__observer.observe(document,{subtree:true,attributes:true,childList:true,characterData:true});
      },mode);
      const state=()=>p.evaluate(()=>({local:Object.fromEntries(Object.entries(localStorage)),session:Object.fromEntries(Object.entries(sessionStorage)),editing:JSON.stringify(window.FC.session),html:document.documentElement.outerHTML,nonce:window.__nonce,url:location.href}));
      const before=await state();let navigations=0;p.on('framenavigated',()=>navigations++);
      const cdp=await ctx.newCDPSession(p);await p.bringToFront();
      const execution=await cdp.send('Runtime.evaluate',{expression:'location.href='+JSON.stringify(build())+';void 0;',userGesture:true});assert.equal(execution.exceptionDetails,undefined);
      await p.waitForFunction(()=>window.__spy.copyDone===1,null,{timeout:5000});
      assert.equal(JSON.stringify(await state()),JSON.stringify(before),'Any app/DOM/storage/navigation change');
      const spy=await p.evaluate(()=>window.__spy);assert.equal(spy.writes,0);assert.equal(spy.forbidden,0);assert.deepEqual(spy.dom,[]);assert.equal(navigations,0);
      assert.equal(dialogs,0);assert.equal(spy.copies.length,1);assert.equal(spy.copied,mode==='clipboard-denied'?0:1);
      const text=spy.copies[0],report=JSON.parse(text);assert.ok(text.length<800);assert.equal(text.includes('PRIVATE_'),false);
      assert.equal(requests.length,1,'No network beyond locally fulfilled fixture');assert.deepEqual(errors,[]);
      if(['denied','revoked'].includes(mode)){assert.equal(report.status,'AUTH_DENIED');assert.equal(spy.reads.length,0);}
      else if(mode==='unreadable')assert.equal(report.status,'STORAGE_UNREADABLE');
      else{assert.equal(report.status,'READ_ONLY');assert.equal(report.requiredKeys,mode!=='missing-proof');assert.equal(report.CB,mode!=='lost-revision');assert.equal(report.CE,mode!=='lost-revision');}
      passed++;console.log('PASS javascript URL / output-only clipboard / unchanged state: '+mode);await ctx.close();
    }
    console.log(`Bookmarklet Chromium: ${passed}/${passed} PASS, 0 FAIL, 0 SKIP`);
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
