#!/usr/bin/env node
'use strict';
// Real Chromium + real IndexedDB, mobile viewport, disposable profile. Every
// application-origin request is intercepted locally before navigation, no LIVE.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),ORIGIN='https://mebleszek.github.io',PREFIX='/meble-app/';
const auth=`(()=>{const identity={uid:'synthetic-empty-owner',epoch:1};window.FC=window.FC||{};window.FC.cloudAuth={create:async()=>({identity:()=>identity,state:()=>({status:'authenticated',...identity}),subscribe(fn){queueMicrotask(()=>fn({status:'authenticated',...identity}));return()=>{};},signOut(){throw Error('No test logout');}})};})();`;
const verifier=`(()=>{window.FC.cloudAccessVerifier={create:()=>({verify:async()=>({ok:true,uid:'synthetic-empty-owner',validUntil:Date.now()+45000}),watch(){return()=>{};}})};})();`;
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
async function main(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-empty-installation-'));let browser;const clients=[];const errors=[],external=[];
  try{
    for(const name of ['profile','cache','config','downloads'])fs.mkdirSync(path.join(dir,name));
    const executable=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/usr/bin/google-chrome'].find(f=>fs.existsSync(f));assert.ok(executable,'Real Chromium is required');
    browser=spawn(executable,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(dir,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe'],env:{...process.env,XDG_CACHE_HOME:path.join(dir,'cache'),XDG_CONFIG_HOME:path.join(dir,'config')}});
    const endpoint=await require('./helpers/chromium-startup').waitForEndpoint(browser,{profileDir:path.join(dir,'profile')});
    const targets=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();
    async function client(url){
      const pending=new Map(),fulfilling=new Set(),requests=new Set();let nextId=0,lastActivity=Date.now();
      const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
      const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},120000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
      const respond=(method,params)=>{
        const task=send(method,params).catch(e=>errors.push(e.message)).finally(()=>{fulfilling.delete(task);lastActivity=Date.now();});
        fulfilling.add(task);
      };
      ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}
      else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
      else if(m.method==='Network.requestWillBeSent'){requests.add(m.params.requestId);lastActivity=Date.now();}
      else if(m.method==='Network.loadingFinished'||m.method==='Network.loadingFailed'){requests.delete(m.params.requestId);lastActivity=Date.now();}
      else if(m.method==='Fetch.requestPaused'){
        lastActivity=Date.now();
        const u=new URL(m.params.request.url);let body,type='text/javascript';
        try{
          assert.equal(u.origin,ORIGIN);
          if(u.pathname==='/favicon.ico'){respond('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:204});return;}
          assert.ok(u.pathname.startsWith(PREFIX));
          const name=u.pathname.slice(PREFIX.length);
          if(name==='index.html'){body=html;type='text/html';}
          else{
            const file=path.resolve(ROOT,name);assert.ok(file.startsWith(ROOT+path.sep)&&/^(js|css|assets|img)\//.test(name),'Only local app assets');
            type=name.endsWith('.css')?'text/css':'text/javascript';
            body=name==='js/app/cloud/cloud-auth.js'?auth:name==='js/app/cloud/cloud-access-verifier.js'?verifier:fs.readFileSync(file,'utf8');
          }
          respond('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(body).toString('base64')});
        }catch(_){external.push('BLOCKED_REQUEST');respond('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'});}
      }
    };
      const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
      // Reload invalidates paused Fetch IDs. Wait for both acknowledgements and
      // request completion; never discard Invalid InterceptionId or app errors.
      const settle=async()=>{const deadline=Date.now()+10000;
        while(fulfilling.size||requests.size||Date.now()-lastActivity<250){
          if(Date.now()>=deadline)throw Error('Requests did not settle before navigation/assertions');
          await new Promise(resolve=>setTimeout(resolve,25));
        }
      };
      const c={send,evaluate,settle,close(){for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'));}ws.close();}};clients.push(c);return c;
    }
    const {send,evaluate,settle}=await client(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.join(dir,'downloads')});
    await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
    const until=async(expression,label)=>{for(let n=0;n<400;n++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout '+label+' '+JSON.stringify(await evaluate('({auth:document.body.dataset.authState,business:document.body.dataset.businessState,text:document.body.innerText.slice(-2200)})')));};
    await send('Page.navigate',{url:ORIGIN+PREFIX+'index.html'});
    await until('document.body?.dataset.businessState==="ready"','fresh full app startup');
    const tap=async selector=>{
      await until(`!!document.querySelector(${JSON.stringify(selector)})`,'target '+selector);
      const point=await evaluate(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length&&!e.disabled);if(!el)throw Error('No visible target '+${JSON.stringify(selector)});el.scrollIntoView({block:'center',behavior:'instant'});const b=el.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2};})()`);
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:3,radiusY:3,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,160));
    };
    await send('Emulation.setTouchEmulationEnabled',{enabled:true});
    const fill=async(selector,value)=>{await until(`!!document.querySelector(${JSON.stringify(selector)})`,'field '+selector);await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
    assert.equal(await evaluate('window.FC.projectStore.readAll().length'),0);assert.equal(await evaluate('window.FC.investors.readAll().length'),0);
    assert.equal(await evaluate('window.FC.sessionNavigation.needsClosure()'),false);
    const emptyRaw=await evaluate('JSON.stringify([localStorage.getItem("fc_projects_v1"),localStorage.getItem("fc_investors_v1"),localStorage.getItem("fc_edit_session_v1")])');
    await tap('#openFurnitureProjectsBtn');await until('uiState.entry==="modeHub"','furniture hub');
    await tap('#modeHubRoot [data-action="open-sheet-materials"]');await until('getComputedStyle(document.getElementById("priceModal")).display!=="none"','material catalog');
    await tap('#closePriceModal');
    assert.equal(await evaluate('JSON.stringify([localStorage.getItem("fc_projects_v1"),localStorage.getItem("fc_investors_v1"),localStorage.getItem("fc_edit_session_v1")])'),emptyRaw,'Empty menu/catalog do not create owners or sessions');
    await tap('[data-action="close-mode-hub"]');await settle();const oldDocument=await evaluate('window.__emptyDocumentToken=crypto.randomUUID()');await send('Page.reload',{ignoreCache:true});await until(`window.__emptyDocumentToken!==${JSON.stringify(oldDocument)}&&document.body?.dataset.businessState==="ready"&&!!window.FC?.sessionNavigation`,'empty restart');
    assert.equal(await evaluate('window.FC.sessionNavigation.needsClosure()'),false);await tap('#openFurnitureProjectsBtn');await until('uiState.entry==="modeHub"','furniture hub after restart');
    console.log('PASS empty profile -> real Auth gate/business startup -> furniture hub/catalog -> restart, no fictitious owner');
    await tap('#modeHubRoot [data-action="new-investor"]');await until('!!document.getElementById("invName")','first investor draft');
    for(const[id,value]of Object.entries({invName:'Synthetic First Owner',invPhone:'123456789',invCity:'Test City',invEmail:'first@example.invalid',invAddress:'Synthetic address 1',invNotes:'Synthetic browser fixture'}))await fill('#'+id,value);
    await evaluate(`(()=>{const el=document.getElementById('invSource');el.value=[...el.options].find(o=>o.value)?.value;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await tap('[data-investor-action="save"]');await until('!!document.querySelector(".confirm-box")','investor save confirmation');await tap('.confirm-box .is-success');
    await until('window.FC.investors.readAll().length===1&&window.FC.projectStore.readAll().length===1','first investor and real project');
    assert.equal(await evaluate('projectData.meta.assignedInvestorId===window.FC.investors.getCurrentId()'),true,'Only the real saved investor owns the first project');
    await tap('[data-investor-action="add-room"]');await until('!!document.querySelector(".panel-box input[placeholder]")','new room form');
    await fill('.panel-box input[placeholder]','Synthetic Kitchen');await tap('.panel-box .btn-success');
    await until('window.FC.investors.readAll()[0].rooms.length===1','room committed');
    await tap('[data-action="open-room"][data-room^="room_"]');await until('window.FC.session.active&&window.FC.session.durable','first real edit session');
    assert.equal(await evaluate('window.FC.session.projectId===window.FC.projectStore.getCurrentProjectId()'),true,'Session belongs to actual first project');
    await evaluate('document.getElementById("roomParametersAccordion").open=true');await fill('#roomSettingInline_roomHeight','275');
    await tap('#roomSettingsSummary .wywiad-room-inline-form__save');
    await tap('#sessionSave');await until('!window.FC.session.active','confirmed save closes session');
    assert.equal(await evaluate('window.FC.projectStore.getCurrentRecord().projectData[uiState.roomType].settings.roomHeight'),275);assert.equal(await evaluate('localStorage.getItem("fc_edit_session_v1")'),null);
    console.log('PASS first investor/project -> room editor -> actual parameter change -> durable save without fake ownership');
    await settle();assert.deepEqual(errors,[]);assert.deepEqual(external,[]);

  }finally{for(const c of clients)c.close();browser?.kill('SIGKILL');await new Promise(r=>setTimeout(r,200));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
