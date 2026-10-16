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
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080')throw Error('Demo loopback emulators required');
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),cache=path.join(os.tmpdir(),'meble-firebase-browser-sdk-12.19.0');
const hashes={'firebase-app.js':'39a50952b5def557337b2290069c7d7371f3515ad46c44a43b9c520f734d8d14','firebase-auth.js':'59f60ce3adcb4c85a5260e963fd14134eec088de5b18ddfb9e95771c72f65264'};
const options={target:'emulator',firebaseConfig:{apiKey:'demo-emulator-only',projectId:'demo-meble-app',appId:'demo-only',authDomain:'demo-meble-app.firebaseapp.com'},emulator:{host:'127.0.0.1',port:19099}};
let browser,server,base;
before(async()=>{
 fs.mkdirSync(cache,{recursive:true});
 for(const [name,sha]of Object.entries(hashes)){
  const file=path.join(cache,name);if(!fs.existsSync(file))execFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','45','https://www.gstatic.com/firebasejs/12.19.0/'+name,'-o',file]);
  assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sha,'pinned official SDK: '+name);
 }
 server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)||!/^\/(?:index\.html|auth-test\.html|js\/|css\/|assets\/)/.test(name)){res.writeHead(404);res.end();return;}
  try{const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function context({configured=true,viewport={width:393,height:852},mobile=true,blockPopup=false}={}){
 const ctx=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});const requests=[],external=[];
 await ctx.route('**/*',async route=>{
  const url=new URL(route.request().url());requests.push(url.href);
  if(url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/12.19.0/')){
   const name=path.basename(url.pathname);if(!hashes[name]){external.push(url.href);await route.abort();return;}
   await route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(cache,name))});return;
  }
  if(process.env.AUTH_POPUP_TEST==='1'&&url.hostname==='apis.google.com'&&(url.pathname==='/js/api.js'||url.pathname.startsWith('/_/scs/'))&&route.request().method()==='GET'){
   try{const body=execFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','25',url.href]);await route.fulfill({contentType:'text/javascript',body});}catch(_){external.push(url.href);await route.abort();}return;
  }
  // Optional emulator widget styling is not part of the app or Auth proof.
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)||(url.hostname==='unpkg.com'&&url.pathname.startsWith('/material-components-web@10/'))){await route.abort();return;}
  if(!['localhost','127.0.0.1'].includes(url.hostname)){external.push(url.href);await route.abort();return;}
  if(url.pathname==='/js/auth-test-config.js')await route.fulfill({contentType:'text/javascript',body:'window.FC_AUTH_TEST_OPTIONS='+JSON.stringify(configured?options:null)});
  else await route.continue();
 });
 await ctx.addInitScript(({blockPopup})=>{
  localStorage.setItem('fc_price_list_v1',JSON.stringify({sentinel:'synthetic-prices'}));localStorage.setItem('fc_projects_v1',JSON.stringify({sentinel:'synthetic-projects'}));localStorage.setItem('fc_material_part_options_v1',JSON.stringify({sentinel:'synthetic-grain'}));
  if(blockPopup)window.open=()=>null;
 },{blockPopup});
 const page=await ctx.newPage();return {ctx,page,requests,external};
}
async function state(page,wanted){await page.waitForFunction(value=>document.body.dataset.authState===value,wanted,{timeout:15000});}
async function businessAbsent(r){assert.equal(r.requests.some(x=>/\/(?:boot\.js|app\.js|project-store\.js|catalog-store\.js|firebase-firestore\.js)(?:\?|$)/.test(x)),false);assert.deepEqual(r.external,[]);assert.equal(await r.page.evaluate(()=>window.projectData!==undefined),false);}
async function geometry(page){const box=await page.locator('.auth-card').boundingBox();assert.ok(box.width>0);assert.ok(box.x>=0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const buttons=await page.locator('button:visible').all();for(const button of buttons){const b=await button.boundingBox();assert.ok(b.height>=48);}}
test('Missing config loads no SDK/data; phone, tablet and desktop layouts fit and support keyboard focus',async()=>{
 for(const [width,height,mobile]of [[320,640,true],[768,1024,true],[1440,900,false]]){
  const r=await context({configured:false,viewport:{width,height},mobile});try{
   await r.page.goto(base+'/auth-test.html');await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/AUTH_CONFIG_REQUIRED/);await geometry(r.page);
   assert.equal(r.requests.some(x=>x.includes('gstatic.com')),false);await businessAbsent(r);await r.page.locator('#auth-google').focus();assert.equal(await r.page.locator('#auth-google').evaluate(el=>el===document.activeElement),true);
  }finally{await r.ctx.close();}
 }
});
test('Actual Google popup, independent UID, SDK persistence across reload, logout and unchanged global bytes',{skip:process.env.AUTH_POPUP_TEST!=='1'?'Requires reachable apis.google.com; explicitly unverified in restricted Codex':false},async()=>{
 const r=await context();try{
  await r.page.goto(base+'/auth-test.html');await state(r.page,'unauthenticated');const before=await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_'))));
  const opened=r.page.waitForEvent('popup',{timeout:8000});await r.page.locator('#auth-google').click();const popup=await opened.catch(async e=>{throw Error(JSON.stringify({error:e.message,state:await r.page.locator('body').getAttribute('data-auth-state'),ui:await r.page.locator('#auth-error').textContent(),requests:r.requests.slice(-12),external:r.external}));});await popup.waitForLoadState('domcontentloaded');
  await popup.getByRole('button',{name:'Add new account'}).click();
  await popup.locator('#email-input').fill('browser-synthetic@example.invalid');
  await popup.locator('#sign-in').click();
  await state(r.page,'unapproved');await r.page.locator('#auth-uid-toggle').click();const uid=await r.page.locator('#auth-uid').innerText();assert.ok(uid.length>0);
  await r.page.reload();await state(r.page,'unapproved');await r.page.locator('#auth-uid-toggle').click();assert.equal(await r.page.locator('#auth-uid').innerText(),uid);
  await geometry(r.page);await businessAbsent(r);assert.deepEqual(await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')))),before);
  await r.page.locator('#auth-signout').click();await state(r.page,'unauthenticated');assert.equal(await r.page.locator('#auth-uid').isVisible(),false);
  await r.page.reload();await state(r.page,'unauthenticated');
 }finally{await r.ctx.close();}
});
test('Closed popup and blocked popup show readable retry, without business initialization',{skip:process.env.AUTH_POPUP_TEST!=='1'?'Requires reachable Google iframe helper; unit failure paths tested separately':false},async()=>{
 for(const blockPopup of [false,true]){
  const r=await context({blockPopup});try{
   await r.page.goto(base+'/auth-test.html');await state(r.page,'unauthenticated');
   if(blockPopup)await r.page.locator('#auth-google').click();else{const opened=r.page.waitForEvent('popup',{timeout:8000});await r.page.locator('#auth-google').click();const popup=await opened;await popup.close();}
   await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),blockPopup?/auth\/popup-blocked/:/auth\/popup-closed-by-user/);assert.equal(await r.page.locator('#auth-google').isEnabled(),true);await businessAbsent(r);
  }finally{await r.ctx.close();}
 }
});

test('Real browser SDK persistence: synthetic Google credential, reload, new tab, logout, unchanged global bytes',async()=>{
 const r=await context();try{
  await r.page.goto(base+'/auth-test.html');await state(r.page,'unauthenticated');
  await r.page.screenshot({path:'/tmp/cloud-2b1-phone.png'});
  const before=await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_'))));
  const expected=await r.page.evaluate(async()=>{
   const {getApp}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
   const {getAuth,GoogleAuthProvider,signInWithCredential}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
   const payload=btoa(JSON.stringify({sub:'browser-persistence',email:'browser-persistence@example.invalid',email_verified:true})).replaceAll('=','');
   return (await signInWithCredential(getAuth(getApp('meble-auth-test')),GoogleAuthProvider.credential('e30.'+payload+'.'))).user.uid;
  });
  await state(r.page,'unapproved');await r.page.locator('#auth-uid-toggle').click();assert.equal(await r.page.locator('#auth-uid').innerText(),expected);
  assert.ok((await r.page.evaluate(()=>indexedDB.databases())).some(x=>x.name==='firebaseLocalStorageDb'));
  await r.page.reload();await state(r.page,'unapproved');await r.page.locator('#auth-uid-toggle').click();assert.equal(await r.page.locator('#auth-uid').innerText(),expected);
  await r.page.close();r.page=await r.ctx.newPage();await r.page.goto(base+'/auth-test.html');await state(r.page,'unapproved');
  await geometry(r.page);await businessAbsent(r);assert.deepEqual(await r.page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('fc_')))),before);
  await r.page.locator('#auth-signout').tap();await state(r.page,'unauthenticated');assert.equal(await r.page.locator('#auth-uid').isVisible(),false);
  await r.page.reload();await state(r.page,'unauthenticated');
 }finally{await r.ctx.close();}
});
test('Unavailable Google helper is a safe retryable error, not an opened business UI',async()=>{
 const r=await context();try{
  await r.page.goto(base+'/auth-test.html');await state(r.page,'unauthenticated');
  await r.page.locator('#auth-google').tap();await state(r.page,'error');assert.match(await r.page.locator('#auth-error').innerText(),/auth\/internal-error/);assert.equal(await r.page.locator('#auth-google').isEnabled(),true);
  assert.ok(r.external.every(x=>x.startsWith('https://apis.google.com/')));r.external.length=0;await businessAbsent(r);
 }finally{await r.ctx.close();}
});
test('Normal main entry still boots without importing Auth or Firebase SDK',async()=>{
 const ctx=await browser.newContext(),page=await ctx.newPage(),requests=[];
 await ctx.route('**/*',async route=>{const url=new URL(route.request().url());requests.push(url.href);if(!['localhost','127.0.0.1'].includes(url.hostname)){await route.abort();return;}await route.continue();});
 try{await page.goto(base+'/index.html');await page.locator('#homeView h2').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>typeof window.FC.cloudAuth),'undefined');assert.equal(requests.some(x=>/firebasejs|googleapis|cloud-auth\.js|auth-test/.test(x)),false);assert.equal(await page.locator('#homeView h2').innerText(),'Start');}finally{await ctx.close();}
});
