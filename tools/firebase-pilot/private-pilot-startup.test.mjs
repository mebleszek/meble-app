// Real Chromium startup/refusal checks that need neither a Google connection nor
// running emulators. These do NOT substitute for the SDK/emulator roundtrip.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {openPrivatePilot} from './private-pilot-runner.mjs';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
let server,browser,base;
before(async()=>{
 server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+name);
  if(name==='/js/auth-test-config.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end('window.FC_AUTH_TEST_OPTIONS=null;');return;}
  if(!file.startsWith(root+path.sep)||!/^\/(?:index\.html|js\/|css\/|assets\/)/.test(name)){res.writeHead(404);res.end();return;}
  try{res.writeHead(200,{'content-type':{'.js':'text/javascript','.html':'text/html','.css':'text/css','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function page(){
 const context=await browser.newContext(),page=await context.newPage(),requests=[];
 await context.route('**/*',async route=>{
  const address=route.request().url();requests.push(address);
  // Official, locally installed distribution: no external network request.
  const pinned={'firebase-app.js':'39a50952b5def557337b2290069c7d7371f3515ad46c44a43b9c520f734d8d14','firebase-auth.js':'59f60ce3adcb4c85a5260e963fd14134eec088de5b18ddfb9e95771c72f65264'};
  const url=new URL(address),name=path.basename(url.pathname);
  if(url.origin==='https://www.gstatic.com'&&url.pathname==='/firebasejs/12.19.0/'+name&&pinned[name]){
   const body=fs.readFileSync(new URL('./node_modules/firebase/'+name,import.meta.url));
   assert.equal(createHash('sha256').update(body).digest('hex'),pinned[name]);
   await route.fulfill({contentType:'text/javascript',body});return;
  }
  if(url.origin!==base)throw Error('External access forbidden');await route.continue();
 });
 return {context,page,requests};
}
test('Unchanged normal startup and private copy both guard business scripts; real Auth SDK stays signed out',async()=>{
 for(const operator of [false,true]){
  const r=await page();let handle;
  try{
   if(operator){
    await r.page.route('**/js/auth-test-config.js*',route=>route.fulfill({contentType:'text/javascript',body:'window.FC_AUTH_TEST_OPTIONS='+JSON.stringify({target:'emulator',firebaseConfig:{apiKey:'demo-only',authDomain:'demo-meble-app.firebaseapp.com',projectId:'demo-meble-app',appId:'demo-only'},emulator:{host:'127.0.0.1',port:19099,firestorePort:18080}})}));
    handle=await openPrivatePilot(r.page,base+'/index.html');
    await r.page.waitForFunction(()=>document.body.dataset.authState==='unauthenticated');
   }else{
    await r.page.goto(base+'/index.html');await r.page.waitForFunction(()=>document.body.dataset.authState==='error');
    assert.match(await r.page.locator('#auth-error').textContent(),/AUTH_CONFIG_REQUIRED/);
    assert.equal(r.requests.some(url=>url.includes('firebasejs')),false);
   }
   assert.equal(r.requests.some(url=>/firebase-firestore|cloud4-source-worker|\/boot\.js|\/app\.js/.test(url)),false);
   assert.equal(await r.page.evaluate(()=>!!(FC.controlledProjectPilot||FC.firebasePilotLiveTransport||window.__syntheticSharedAuth||window.__syntheticLease)),false);
   if(handle){
    assert.deepEqual(await handle.execute({role:'write',approval:{}}),{ok:false,code:'AUTH_ACCESS_REVOKED'});
    assert.equal((await handle.execute({role:'read',approval:{}})).code,'CLOUD_OPERATION_LIMIT');
    await handle.close();assert.equal((await handle.execute({role:'write',approval:{}})).code,'CLOUD_CLIENT_CLOSED');
   }
  }finally{await handle?.close();await r.context.close();}
 }
});
test('Operator entry cannot attach to an already running page or a production address',async()=>{
 const r=await page();try{
  await assert.rejects(openPrivatePilot(r.page,'https://mebleszek.github.io/meble-app/index.html'),/CLOUD_LIVE_TRANSPORT_DISABLED/);
  assert.equal(r.requests.length,0);await r.page.goto(base+'/index.html');
  await assert.rejects(openPrivatePilot(r.page,base+'/index.html'),/CLOUD_OPERATOR_FRESH_CONTEXT_REQUIRED/);
 }finally{await r.context.close();}
});
test('Missing or live Auth configuration on loopback is refused BEFORE initializing Firebase',async()=>{
 for(const config of [null,{target:'live-auth',firebaseConfig:{projectId:'mebleszek-meble-app'}}]){
  const r=await page();try{
   await r.page.route('**/js/auth-test-config.js*',route=>route.fulfill({contentType:'text/javascript',body:'window.FC_AUTH_TEST_OPTIONS='+JSON.stringify(config)}));
   await assert.rejects(openPrivatePilot(r.page,base+'/index.html'),/CLOUD_LIVE_TRANSPORT_DISABLED/);
   assert.equal(r.requests.some(url=>url.includes('firebasejs')),false);
   assert.equal(await r.page.evaluate(()=>!!window.__FC_MAIN_ACCESS__),false);
  }finally{await r.context.close();}
 }
});
