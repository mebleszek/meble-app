#!/usr/bin/env node
'use strict';
// Full Chromium documents, native localStorage, isolated synthetic origin.
// No login substitute is used to claim Auth coverage: this tests business boot.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('./firebase-pilot/node_modules/playwright-core');
const root=path.resolve(__dirname,'..'),P='fc_projects_v1',E='fc_edit_session_v1';
const rows=require('./quote-performance-fixture').rows(1,true),index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const fragment=id=>index.match(new RegExp('<template id="'+id+'">([\\s\\S]*?)</template>'))[1];
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+fragment('business-styles')+'</head><body>'+fragment('business-template')+'</body></html>';
let browser,server,base,passed=0;
const pageErrors=[],external=[];
async function context(seed){
  const c=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  await c.route('**/*',route=>{const origin=new URL(route.request().url()).origin;if(origin!==base){external.push(origin);return route.abort();}return route.continue();});
  await c.addInitScript(seed=>{
    window.__documentNonce=crypto.randomUUID();
    if(localStorage.getItem('fc_projects_v1')===null)for(const[k,v]of Object.entries(seed))localStorage.setItem(k,v);
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(String(key)==='fc_edit_session_v1'&&this.getItem('__synthetic_session_failure')==='1')throw new DOMException('Synthetic write failure','QuotaExceededError');
      return set.call(this,key,value);
    };
  },seed);
  return c;
}
async function page(c){
  const p=await c.newPage();p.on('pageerror',error=>pageErrors.push(error.message));await p.goto(base+'/__business');
  await ready(p);
  return p;
}
const ready=p=>p.waitForFunction(()=>window.__APP_STARTED__&&window.__fcProjectAutosaveInstalled===true&&window.FC?.session);
const protectedBytes=p=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>[
  'fc_projects_v1','fc_edit_session_v1','fc_investors_v1','fc_quote_snapshots_v1'
].includes(k)||/catalog|materials|accessories|rates|suppliers|manufacturers|categories|types|settings|company|business|sheets|program_defaults|fc_edge|grain/.test(k)).sort().map(k=>[k,localStorage.getItem(k)])));
async function frozen(p,before,confirmedBoot=false){
  const after=await protectedBytes(p),changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>after[key]!==before[key]);
  if(confirmedBoot&&changed.includes(P)){
    // Existing admitted bootstrap repeats a save of the same project and may
    // update the record timestamp. Check EVERY other byte/field, including the
    // room revision and persisted session proof. Refusal cases get no exception.
    const a=JSON.parse(before[P]),b=JSON.parse(after[P]);
    assert.equal(b.find(row=>row.id==='A').updatedAt>=a.find(row=>row.id==='A').updatedAt,true);
    for(const rows of [a,b])delete rows.find(row=>row.id==='A').updatedAt;
    assert.equal(JSON.stringify(a),JSON.stringify(b),'Admitted boot changed project content');
    changed.splice(changed.indexOf(P),1);
  }
  assert.deepEqual(changed,[],'Protected RAW keys changed');
}
async function main(){
  server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname;
    if(name==='/__business'){res.setHeader('Content-Type','text/html');return res.end(html);}
    if(name==='/__external_document'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Synthetic external writer</title>');}
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const seedContext=await context(rows);let p=await page(seedContext);
  await p.evaluate(()=>{window.FC.actions.dispatch('session-save',{});window.FC.infoBox.close();document.querySelector('[data-tab="wycena"]').click();});
  await p.waitForSelector('[data-action="wycena-generate"]');
  await p.evaluate(()=>{window.FC.quoteOfferStore.patchCurrentDraft({commercial:{versionName:'Synthetic restart proof'}});renderCabinets();});
  await p.locator('[data-action="wycena-generate"]').tap();
  await p.waitForFunction(()=>!window.FC.wycenaTabShell._generateRuntime.inFlight||document.querySelector('.quote-scope-entry-name__input'),null,{timeout:45000});
  if(await p.locator('.quote-scope-entry-name__input').count()){
    await p.locator('.quote-scope-entry-name__input').fill('Synthetic restart proof');await p.locator('.quote-scope-entry-name__footer .btn-success').tap();
  }
  await p.waitForFunction(()=>!window.FC.wycenaTabShell._generateRuntime.inFlight&&window.FC.quoteSnapshotStore.readAll().length===1,null,{timeout:45000});
  const saved=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  await seedContext.close();console.log('PASS actual quote calculated, saved and rendered before restart cases');passed++;
  for(const mode of ['matching-proof','lost-session-revision','external-owner-revision']){
    const c=await context(saved);p=await page(c);
    assert.equal(await p.evaluate(()=>window.FC.views.openRoom('room_test_A')),true);
    if(mode==='external-owner-revision'){
      // Independent document/native Storage: this is not the edited document's
      // session tracker. It models an external/legacy writer, not an allowed UI action.
      const writer=await c.newPage();await writer.goto(base+'/__external_document');
      await writer.evaluate(()=>{const rows=JSON.parse(localStorage.getItem('fc_projects_v1'));rows.find(r=>r.id==='A').projectData.room_test_A.cabinets[0].width=88;localStorage.setItem('fc_projects_v1',JSON.stringify(rows));});
      await writer.close();
    }else{
      const result=await p.evaluate(mode=>{
        if(mode==='lost-session-revision')localStorage.setItem('__synthetic_session_failure','1');
        projectData.room_test_A.cabinets[0].width=61;const result=window.FC.project.saveConfirmed(projectData);
        localStorage.removeItem('__synthetic_session_failure');return {ok:result.ok,projectSaved:result.projectSaved,code:result.code};
      },mode);
      assert.equal(result.ok,mode==='matching-proof');if(mode==='lost-session-revision'){assert.equal(result.projectSaved,true);assert.equal(result.code,'SESSION_UNCONFIRMED');}
    }
    const before=await protectedBytes(p);let previous=await p.evaluate(()=>window.__documentNonce);await p.close();
    for(let restart=0;restart<2;restart++){
      if(restart===0){p=await page(c);await p.evaluate(()=>sessionStorage.setItem('__synthetic_reload_sentinel','retained'));}
      else{await p.reload();await ready(p);assert.equal(await p.evaluate(()=>sessionStorage.getItem('__synthetic_reload_sentinel')),'retained');}
      const nonce=await p.evaluate(()=>window.__documentNonce);assert.notEqual(nonce,previous);previous=nonce;
      await frozen(p,before,mode==='matching-proof');assert.equal(await p.evaluate(()=>window.FC.session.active&&window.FC.session.durable),true);
      if(mode==='matching-proof'){
        assert.equal(await p.evaluate(()=>window.FC.session.canSaveProject()),true);
        assert.equal(await p.evaluate(()=>projectData.room_test_A.cabinets[0].width),61);
      }else{
        for(const action of ['save','cancel','navigation']){
          await p.evaluate(()=>window.FC.infoBox.close());
          if(action==='cancel'){
            await p.evaluate(()=>{window.__cancelAttempt=window.FC.actions.dispatch('session-cancel',{});});
            if(await p.locator('.confirm-box').count())await p.locator('.confirm-btn.is-danger').tap();
            await p.evaluate(()=>window.__cancelAttempt);
          }else if(action==='save')await p.evaluate(()=>window.FC.actions.dispatch('session-save',{}));
          else assert.equal(await p.evaluate(()=>window.FC.tabNavigation.setActiveTab('wycena')),false);
          assert.equal(await p.evaluate(()=>window.FC.session.lastError.code),'PROJECT_WRITE_CONFLICT');
          await frozen(p,before);assert.equal(await p.evaluate(()=>window.FC.session.active),true);
        }
      }
    }
    await p.close();
    await c.close();console.log('PASS '+mode+': two full document restarts, native storage and expected proof decision');passed++;
  }
  assert.deepEqual(pageErrors,[]);assert.deepEqual(external,[]);
  console.log(`Restored-session Chromium: ${passed}/${passed} PASS, 0 FAIL, 0 SKIP`);
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
