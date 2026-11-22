'use strict';
// Real Chromium/Auth/main/asset loader; SDK replies and one business script are synthetic.
// No production Firebase, application authority or synchronization writes are performed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {androidGlobalsFixture}=require('./helpers/android-globals-browser-fixture'),{injection}=require('./trusted-session-browser-smoke');
const {waitForGesturePoint}=require('./helpers/browser-test-readiness');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs'),server=await androidGlobalsFixture();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-startup-assets-'));
 async function scenario(kind){
  let device,requestId;const profile=path.join(dir,kind);
  async function until(test,limit=35000){const end=Date.now()+limit;while(Date.now()<end){if(await test())return;await pause(25);}throw Error('STARTUP_ASSET_FIXTURE_TIMEOUT '+kind);}
  try{
   device=await openBrowserDevice(server,profile);
   await device.send('Fetch.enable',{patterns:[{urlPattern:'*/startup-held.*'}]});
   device.onEvent(event=>{if(event.method==='Fetch.requestPaused')requestId=event.params.requestId;});
   await device.evaluate(`(async()=>{
    const data=${JSON.stringify(server.data)},owner=${JSON.stringify(server.uid)},attempt='12345678-1234-4123-8123-123456789abc';
    for(const row of data.local.rows)localStorage.setItem(row.key,row.raw);
    localStorage.setItem('meble_access_profile_v1',JSON.stringify({version:3,uid:owner,attemptId:attempt}));
    const create=(name,stores,write)=>new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>{for(const[name,keyPath]of stores)q.result.createObjectStore(name,keyPath?{keyPath}:undefined);};q.onerror=reject;q.onsuccess=()=>{const db=q.result,tx=db.transaction(stores.map(s=>s[0]),'readwrite',{durability:'strict'});write(tx);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=reject;};});
    await create(${JSON.stringify(server.name)},['control','replicas','protected','outbox'].map(name=>[name,'key']),tx=>{for(const[name,rows]of Object.entries(data.databases.authority))for(const row of rows)tx.objectStore(name).put(row);});
    await create('meble-access-profile-v1',[['ownership',null]],tx=>tx.objectStore('ownership').put({version:1,state:'active',uid:owner,attemptId:attempt},'owner'));
    const get=Storage.prototype.getItem;
    window.assetSnapshot=async()=>{const q=indexedDB.open(${JSON.stringify(server.name)},1),db=await new Promise(resolve=>q.onsuccess=()=>resolve(q.result));try{const data=await new Promise(resolve=>{const data={},tx=db.transaction(['control','replicas','protected','outbox'],'readonly');for(const name of ['control','replicas','protected','outbox']){const q=tx.objectStore(name).getAll();q.onsuccess=()=>data[name]=q.result;}tx.oncomplete=()=>resolve(data);});return {data,raw:Object.keys(localStorage).filter(k=>k.startsWith('fc_')||k.startsWith('hardware')||k==='meble_application_authority_v1').sort().map(k=>[k,get.call(localStorage,k)])};}finally{db.close();}};
    window.projectData={unsent:'SYNTHETIC_UNSENT_RAM',price:12.125};window.assetStarts=0;window.assetExecuted=0;window.assetUnhandled=[];
    addEventListener('unhandledrejection',e=>assetUnhandled.push(e.reason?.code||e.reason?.message||'unknown'));
    const input=document.createElement('input');input.id='asset-form';input.value='SYNTHETIC_UNSENT_FORM';document.getElementById('main-login').append(input);
    document.getElementById('business-styles').innerHTML=${JSON.stringify(kind==='style'?'<link id="held-style" href="/startup-held.css" rel="stylesheet">':'')};
    document.getElementById('business-template').innerHTML='<script src="/js/startup-held.js" data-load-group="startup-foundation"></script>';
    return true;
   })()`);
   for(const name of ['firebase-pilot-transport','cloud-auth','auth-access-gate','cloud-access-verifier','local-access-profile','local-device-access','main-business-loader'])await device.evaluate(fs.readFileSync('js/app/cloud/'+name+'.js','utf8')+'\ntrue');
   await device.evaluate(injection+'\nFC_AUTH_TEST_OPTIONS={};window.testAccount='+JSON.stringify(server.uid)+';FC.applicationStartup={beforeBusiness:async()=>{},start:async()=>{assetStarts++;if(window.assetRuntimeHeld)await new Promise(resolve=>window.assetRuntimeRelease=resolve);},revokeCloud(){},recordFailure(error,stage){window.assetFailure||={code:error.code||error.message,stage};},diagnostics:()=>({firstError:window.assetFailure,stage:window.assetRuntimeHeld?"initial-project-revisions":"idle"}),errorCode:code=>code};true');
   if(kind==='runtime')await device.evaluate('window.assetRuntimeHeld=true;true');
   const before=await device.evaluate('assetSnapshot()');
   await device.evaluate(fs.readFileSync('js/main-login.js','utf8')+'\ntrue');
   await until(()=>device.evaluate('document.getElementById("auth-google").disabled===false'));
   const point=await waitForGesturePoint(device.evaluate,'#auth-google',{stable:true});
   await device.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
   await device.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
   await until(()=>!!requestId);
   assert.equal(await device.evaluate('document.getElementById("auth-status").textContent'),'Uruchamianie Meble-App…');
   if(kind==='runtime'){
    await device.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'}],body:Buffer.from('window.__APP_STARTED__=true;window.assetExecuted++;').toString('base64')});
    await until(()=>device.evaluate('typeof assetRuntimeRelease==="function"'));
    await until(()=>device.evaluate('document.getElementById("auth-status").textContent==="Uruchamianie Meble-App… Etap: initial-project-revisions."'));
    assert.equal(await device.evaluate('assetStarts===1&&assetExecuted===1&&document.body.dataset.authState==="authorized"&&document.body.dataset.businessState!=="ready"'),true,'Observation never aborts or confirms a pending backend');
    assert.deepEqual(await device.evaluate('assetSnapshot()'),before);
    assert.deepEqual(await device.evaluate('projectData'),{unsent:'SYNTHETIC_UNSENT_RAM',price:12.125});assert.equal(await device.evaluate('document.getElementById("asset-form").value'),'SYNTHETIC_UNSENT_FORM');
    await device.evaluate('assetRuntimeRelease();true');await until(()=>device.evaluate('document.body.dataset.businessState==="ready"'));
    assert.equal(await device.evaluate('document.getElementById("main-login").hidden&&assetStarts===1&&popupCalls===1'),true);
    assert.deepEqual(await device.evaluate('assetSnapshot()'),before);assert.deepEqual(await device.evaluate('assetUnhandled'),[]);
    console.log('PASS Chromium pending runtime: approved stage after real 30 seconds, no abort/retry/grant/write, one normal completion and intact data');return;
   }
   await until(()=>device.evaluate('document.body.dataset.authState==="error"'));
   const evidence=await device.evaluate('({failure:assetFailure,starts:assetStarts,executed:assetExecuted,ready:document.body.dataset.businessState,ram:projectData,form:document.getElementById("asset-form").value,error:document.getElementById("auth-error").textContent})');
   const code=kind==='style'?'AUTH_STYLE_TIMEOUT':'AUTH_SCRIPT_TIMEOUT';
   assert.equal(evidence.failure.code,code);assert.equal(evidence.failure.stage,kind==='style'?'loading-business-styles':'loading-business-scripts');
   assert.match(evidence.error,new RegExp(code));assert.equal(evidence.starts,0);assert.equal(evidence.executed,0);assert.notEqual(evidence.ready,'ready');
   assert.deepEqual(evidence.ram,{unsent:'SYNTHETIC_UNSENT_RAM',price:12.125});assert.equal(evidence.form,'SYNTHETIC_UNSENT_FORM');
   assert.deepEqual(await device.evaluate('assetSnapshot()'),before);
   const body=kind==='style'?'body{color:red}':'window.__APP_STARTED__=true;window.assetExecuted++;';
   try{await device.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:kind==='style'?'text/css':'text/javascript'}],body:Buffer.from(body).toString('base64')});}catch(error){if(kind!=='script')throw error;}
   await pause(200);assert.equal(await device.evaluate('assetStarts===0&&assetExecuted===0'),true);
   assert.deepEqual(await device.evaluate('assetSnapshot()'),before);assert.deepEqual(await device.evaluate('assetUnhandled'),[]);
   if(kind==='style')assert.equal(await device.evaluate('document.getElementById("held-style").disabled'),true);
   console.log('PASS Chromium '+kind+': real 30-second stalled request, exact error stage, late response inert, RAM/form/RAW/four IndexedDB stores/outbox preserved');
  }catch(error){
   if(device){fs.writeFileSync(path.join(dir,kind+'-failure.json'),JSON.stringify({message:error.message,state:await device.evaluate('({auth:document.body.dataset.authState,error:document.getElementById("auth-error")?.textContent,failure:window.assetFailure})').catch(()=>null)},null,2));const shot=await device.send('Page.captureScreenshot',{format:'png'}).catch(()=>null);if(shot)fs.writeFileSync(path.join(dir,kind+'-failure.png'),Buffer.from(shot.data,'base64'));}
   console.error('Artifacts retained: '+dir);throw error;
  }finally{await device?.close();}
 }
 try{await Promise.all([scenario('style'),scenario('script'),scenario('runtime')]);console.log('3/3 PASS startup asset Chromium');}
 finally{await server.close();}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={main};
