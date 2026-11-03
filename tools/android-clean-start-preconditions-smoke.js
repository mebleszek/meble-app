'use strict';
// Evidence for RESET_BLOCKED, not a reset implementation or a production probe.
// Actual Chromium/IDB and shipped modules; all data and cloud values are synthetic.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {androidGlobalsFixture}=require('./helpers/android-globals-browser-fixture');
const {buildCodeCatalogs}=require('./helpers/code-global-catalogs');
async function main(){
 const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs');
 const {codeGlobalRows}=await import('../sync/global-code-rebuild-plan.mjs');
 const {applicationKeys}=await import('../sync/application-authority.mjs');
 const factory=buildCodeCatalogs(),rows=Object.fromEntries(applicationKeys(factory.context.FC).map(k=>[k,null]));
 Object.assign(rows,codeGlobalRows(factory.model,factory.context.FC.globalDataContract),{fc_projects_v1:'[]',fc_investors_v1:'[]',fc_quote_snapshots_v1:'[]'});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-clean-start-preconditions-')),server=await androidGlobalsFixture();let browser;
 try{
  browser=await openBrowserDevice(server,path.join(dir,'profile'));await server.setup(browser,{seed:true});
  const before=await browser.evaluate('fixtureSnapshot()');
  assert.equal(await browser.evaluate('document.body.dataset.authState'),'error');
  assert.equal(await browser.evaluate('document.getElementById("auth-recovery").hidden'),false);
  const refused=await browser.evaluate(`(async()=>{
   const {startApplicationRuntime}=await import('/sync/application-runtime.mjs');
   try{await startApplicationRuntime({window,ownerUid:${JSON.stringify(server.uid)},name:${JSON.stringify(server.name)},boot:{restored:false}});return 'UNEXPECTED_START';}
   catch(error){return error.code||error.message;}
  })()`);
  assert.equal(refused,'LF_ONLINE_INSTALLATION_REQUIRED');
  assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before,'Refusal must preserve native RAW, four stores and uncertain outbox');
  console.log('PASS real Chromium: existing fatal globals and rescue entry; genuine runtime refuses an unrestored installation without a cloud writer; RAW/IDB/outbox unchanged');

  const remoteResult=await browser.evaluate(`(async()=>{
   const {projectApplicationRows}=await import('/sync/application-replication.mjs'),c=FC.globalDataContract;
   const model=${JSON.stringify(factory.model)},rows=${JSON.stringify(rows)};
   c.validateBundle(model);const remote=structuredClone(model);remote.labor[0].price+=12.125;c.validateBundle(remote);
   const projected=projectApplicationRows(rows,{scope:'globals'},{value:remote},c);
   const result=c.capture({getItem:k=>projected[k]??null},Object.keys(c.schemas)).model;c.validateBundle(result);
   const bad=structuredClone(remote);delete bad.materials[0].priceUnit;
   let invalid='UNEXPECTED_ACCEPT';try{projectApplicationRows(rows,{scope:'globals'},{value:bad},c);}catch(error){invalid=error.code;}
   return {domains:Object.keys(result).length,remoteSelected:result.labor[0].price===remote.labor[0].price,factorySelected:result.labor[0].price===model.labor[0].price,invalid};
  })()`);
  assert.deepEqual(remoteResult,{domains:14,remoteSelected:true,factorySelected:false,invalid:'GLOBAL_REQUIRED_FIELD'});
  assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);
  console.log('PASS real Chromium: actual remote projection selects valid differing server prices; malformed remote materials refuse; neither observation writes the original image');

  const queued=await browser.evaluate(`(async()=>{
   const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs'),{createApplicationCommitter}=await import('/sync/application-replication.mjs');
   const store=await openLocalFirstStore({indexedDB,locks:navigator.locks,name:'meble-lf-test-clean-start-proof',ownerUid:'synthetic-owner',deviceId:'synthetic-device',instanceId:'synthetic-instance',initialize:true});
   try{
    const rows=${JSON.stringify(rows)};await store.initializeApplication(rows);
    const c=FC.globalDataContract,local=createApplicationCommitter({store,globalContract:c,projectContract:{},channel:()=>null});
    const result=await local.commit('globals',{expectedVersion:1,rows}),snapshot=await store.snapshot('globals');
    let project='UNEXPECTED_ACCEPT';try{await local.commit('project',{expectedVersion:2,rows},'synthetic-project');}catch(error){project=error.code||error.message;}
    return {localConfirmed:result.localConfirmed,cloudConfirmed:result.cloudConfirmed,phase:snapshot.operations[0].phase,base:snapshot.replica.base,dirty:snapshot.replica.dirty,project};
   }finally{store.close();}
  })()`);
  assert.deepEqual(queued,{localConfirmed:true,cloudConfirmed:false,phase:'queued',base:null,dirty:true,project:'LF_PROJECT_CHANNEL_REQUIRED'});
  assert.deepEqual(await browser.evaluate('fixtureSnapshot()'),before);
  console.log('PASS real Chromium: actual empty-scope commit creates a queued factory revision, no confirmed cloud base; no offline first-project channel; original uncertain queue unchanged');
 }finally{try{await browser?.close();}finally{await server.close();fs.rmSync(dir,{recursive:true,force:true});}}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
