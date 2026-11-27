'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {waitForGesturePoint}=require('./browser-test-readiness');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const updateScript='js/app/cloud/offline-update.js',fenceWorker='js/app/cloud/offline-writer-fence.js';
const fenceClient='sync/application-writer-fence.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

async function oneClickUpdate(){
 const {openBrowserDevice}=await import('./local-first-browser.mjs');
 const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-one-click-update-'));
 let browser,build='old-one-click';
 const index=()=>`<!doctype html><meta charset="utf-8"><body data-build="${build}">
 <link rel="stylesheet" href="./css/app-runtime.css">
 <p>Real updater test</p>
 <script>
 sessionStorage.setItem('fixture-load-count',String(Number(sessionStorage.getItem('fixture-load-count'))+1));
 window.FC={applicationStartup:{async prepareClientUpdate(activate){
  function idle(){if(window.testEditing)throw Error('LF_ACTIVE_RAM_PROTECTED');if(window.testQueue)throw Error('UPDATE_SAVE_PENDING');}
  idle();
  const {applicationWriterFence}=await import('./${fenceClient}');
  await applicationWriterFence(window);
  return activate(idle);
 }}};</script>
 <script src="./${updateScript}" defer></script></body>`;
 const read=file=>file==='index.html'?Buffer.from(index()):fs.readFileSync(path.join(root,file));
 const files=['index.html',updateScript,fenceClient,'sync/local-first-values.mjs','css/app-runtime.css'];
 const manifest=()=>{
  const fields=files.map(file=>{const bytes=read(file);return {path:file,bytes:bytes.length,sha256:hash(bytes)};});
  return {version:hash(JSON.stringify(fields)),files:fields};
 };
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const send=(type,raw)=>{res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(raw);};
  if(url.pathname==='/start')return send('text/html','<!doctype html><title>Fixture host</title><script>window.lfReady=true</script>');
  if(url.pathname==='/app/offline-assets.js')return send('text/javascript','self.MEBLE_OFFLINE_ASSETS='+JSON.stringify(manifest()));
  const file=url.pathname.slice('/app/'.length)||'index.html';
  if(url.pathname.startsWith('/app/')&&[...files,'offline-worker.js',fenceWorker].includes(file))return send(file==='index.html'?'text/html':file.endsWith('.css')?'text/css':'text/javascript',read(file));
  res.writeHead(404);res.end();
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const base='http://127.0.0.1:'+server.address().port;
 try{
  browser=await openBrowserDevice({base:base+'/start'},path.join(dir,'profile'));
  const {evaluate,send}=browser,status='document.querySelector("#offline-update-notice p")';
  const until=async expression=>{
   const end=Date.now()+20000;
   while(Date.now()<end){if(await evaluate(expression))return;await pause(50);}
   throw Error('ONE_CLICK_BROWSER_TIMEOUT '+expression+' '+JSON.stringify(await evaluate(`({build:document.body?.dataset.build,text:${status}?.textContent})`)));
  };
  const click=async selector=>{
   await send('Page.bringToFront');
   const point=await waitForGesturePoint(evaluate,selector,{stable:true});
   await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  };
  const verify=slot=>evaluate(`navigator.serviceWorker.getRegistration().then(reg=>new Promise(resolve=>{
   const c=new MessageChannel();c.port1.onmessage=e=>{c.port1.close();resolve(e.data);};reg.${slot}.postMessage({type:'VERIFY_STATIC_SHELL'},[c.port2]);
  }))`);
  await evaluate('navigator.serviceWorker.register("/app/offline-worker.js").then(reg=>new Promise((resolve,reject)=>{const w=reg.installing||reg.waiting||reg.active;if(!w)throw Error("Missing fixture worker");const check=()=>{if(w.state==="activated")resolve(true);if(w.state==="redundant")reject(Error("Initial worker refused"));};w.addEventListener("statechange",check);check();}))');
  await send('Page.enable');await send('Page.navigate',{url:base+'/app/index.html'});
  await until('document.body?.dataset.build==="old-one-click"&&!!navigator.serviceWorker.controller');
  const older=await verify('active');
  await evaluate(`new Promise((resolve,reject)=>{const q=indexedDB.open('one-click-data',1);q.onupgradeneeded=()=>q.result.createObjectStore('rows');q.onerror=reject;q.onsuccess=()=>{const db=q.result,tx=db.transaction('rows','readwrite');tx.objectStore('rows').put({id:'cabinet',width:61,raw:' preserved '},'project');tx.oncomplete=()=>{db.close();resolve(true);};};})`);
  await evaluate('localStorage.setItem("one-click-source","EXACT SOURCE");window.testEditing=true;window.oldDocument=crypto.randomUUID();true');
  const documentId=await evaluate('oldDocument');
  build='new-one-click';const newer=manifest().version;
  await evaluate('dispatchEvent(new Event("online"));true');
  const button='#offline-update-notice button:first-of-type';
  await until('document.querySelector("#offline-update-notice")?.hidden===false&&!!document.querySelector("#offline-update-notice button")');
  await click(button);await until(status+'.textContent.includes("Zakończ edycję")');
  assert.equal(await evaluate('oldDocument'),documentId);assert.equal((await verify('active')).version,older.version);
  await evaluate('window.testEditing=false;window.testQueue=true;true');
  await click(button);await until(status+'.textContent.includes("potwierdzenie zapisu")');
  assert.equal(await evaluate('oldDocument'),documentId);
  await evaluate('window.testQueue=false;true');
  const exclusive=`new Promise(resolve=>{
   const c=new MessageChannel();c.port1.onmessage=e=>{c.port1.close();resolve(e.data.exclusive);};
   navigator.serviceWorker.controller.postMessage({type:'VERIFY_APPLICATION_AUTHORITY',protocol:1,nonce:'fixture-window-count'},[c.port2]);
  })`;
  const extra=await send('Target.createTarget',{url:base+'/app/index.html'});
  await until('('+exclusive+').then(value=>value===false)');
  await click(button);await until(status+'.textContent.includes("pozostałe karty")');
  assert.equal(await evaluate('oldDocument'),documentId);
  assert.equal((await verify('waiting')).version,newer);
  assert.equal((await verify('active')).version,older.version);
  await send('Target.closeTarget',{targetId:extra.targetId});await until(exclusive);
  await click(button);
  await until('document.body?.dataset.build==="new-one-click"');
  await until(status+'?.textContent==="Aplikacja zaktualizowana."');
  assert.deepEqual(await verify('active'),{complete:true,version:newer});
  assert.equal(await evaluate("sessionStorage.getItem('fixture-load-count')"),'2','The browser reloads the application exactly once');
  assert.equal(await evaluate('localStorage.getItem("one-click-source")'),'EXACT SOURCE');
  assert.deepEqual(await evaluate(`new Promise(resolve=>{const q=indexedDB.open('one-click-data',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('rows'),req=tx.objectStore('rows').get('project');tx.oncomplete=()=>{db.close();resolve(req.result);};};})`),{id:'cabinet',width:61,raw:' preserved '});
  console.log('PASS real Chromium one-click update: blocked by dirty form, pending save and another tab, then verified new shell reloads once and preserves RAW/IndexedDB');
 }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
}
module.exports={oneClickUpdate};
