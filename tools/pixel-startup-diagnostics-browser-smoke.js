'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
async function main(){
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;
  if(name==='/js/denied.js'){res.writeHead(423);res.end('APPLICATION_WRITE_LOCKED');return;}
  const body={'/js/first.js':'window.executed=["first"];','/js/second.js':'window.executed.push("second");','/js/broken.js':'throw new ReferenceError("PRIVATE_EXCEPTION_TOKEN");','/js/known.js':'window.known=Object.assign(new Error("AUTH_ACCESS_REVOKED"),{code:"AUTH_ACCESS_REVOKED"});throw window.known;'}[name];
  res.writeHead(200,{'content-type':body?'text/javascript':'text/html'});res.end(body||'<!doctype html><script>window.lfReady=true;</script>');
 });
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-pixel-diag-'));let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs');browser=await openBrowserDevice({base},dir);
  await browser.evaluate(`localStorage.setItem('synthetic-raw','KEEP_RAW');(async()=>{const q=indexedDB.open('synthetic-pixel-diag',1);q.onupgradeneeded=()=>q.result.createObjectStore('records');const db=await new Promise(r=>q.onsuccess=()=>r(q.result));await new Promise(r=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put('KEEP_IDB','sentinel');tx.oncomplete=r;});db.close();return true;})()`);
  async function setup(){await browser.evaluate(`window.FC={};${fs.readFileSync('js/app/cloud/application-bootstrap.js','utf8')}\n${fs.readFileSync('js/app/cloud/main-business-loader.js','utf8')}\ntrue`);}
  async function reload(){await browser.evaluate('window.previous=true');await browser.send('Page.reload');for(let i=0;i<100;i++){if(await browser.evaluate('window.lfReady===true&&window.previous!==true')){await setup();return;}await new Promise(r=>setTimeout(r,20));}throw Error('DIAG_RELOAD_TIMEOUT');}
  await setup();
  const execution=await browser.evaluate(`(async()=>{try{await FC.mainBusinessLoader.create(()=>{},e=>FC.applicationStartup.recordFailure(e,'loading-business-scripts')).start([{src:'js/first.js',group:'startup-foundation'},{src:'js/second.js',group:'app-runtime'},{src:'js/broken.js',group:'app-runtime'}]);}catch(e){}return {order:window.executed,first:FC.applicationStartup.diagnostics().firstError};})()`);
  assert.deepEqual(execution.order,['first','second']);assert.equal(execution.first.code,'AUTH_SCRIPT_EXECUTION');assert.equal(execution.first.script.index,3);assert.equal(execution.first.script.group,'app-runtime');assert.equal(execution.first.script.phase,'execution');assert.equal(execution.first.script.status,0);assert.equal(execution.first.script.name,'ReferenceError');assert.equal(JSON.stringify(execution).includes('PRIVATE_EXCEPTION_TOKEN'),false);
  await reload();
  const fetchFault=await browser.evaluate(`(async()=>{try{await FC.mainBusinessLoader.create(()=>{},()=>{}).start([{src:'js/denied.js',group:'business-domains'}]);}catch(e){FC.applicationStartup.recordFailure(e,'loading-business-scripts');}return FC.applicationStartup.diagnostics().firstError;})()`);
  assert.equal(fetchFault.code,'AUTH_SCRIPT_LOCKED');assert.equal(fetchFault.script.index,1);assert.equal(fetchFault.script.phase,'fetch');assert.equal(fetchFault.script.status,423);
  await reload();
  assert.equal(await browser.evaluate(`(async()=>{try{await FC.mainBusinessLoader.create(()=>{},()=>{}).start([{src:'js/known.js',group:'app-runtime'}]);}catch(e){return e===window.known&&e.code==='AUTH_ACCESS_REVOKED';}return false;})()`),true,'Known Auth/domain errors must retain their identity');
  assert.equal(await browser.evaluate('localStorage.getItem("synthetic-raw")'),'KEEP_RAW');assert.equal(await browser.evaluate(`(async()=>{const q=indexedDB.open('synthetic-pixel-diag',1),db=await new Promise(r=>q.onsuccess=()=>r(q.result));try{return await new Promise(r=>{const get=db.transaction('records','readonly').objectStore('records').get('sentinel');get.onsuccess=()=>r(get.result);});}finally{db.close();}})()`),'KEEP_IDB');
  console.log('pixel-startup-diagnostics-browser: 4/4 PASS (ordered execution/error metadata/privacy, HTTP423, known-error identity, RAW/IDB unchanged)');
 }finally{try{await browser?.close();}finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}}
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={main};
