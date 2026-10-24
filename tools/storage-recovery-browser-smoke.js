#!/usr/bin/env node
'use strict';
// Real Chromium + real IndexedDB, mobile viewport, disposable profile. Every
// application-origin request is intercepted locally before navigation, no LIVE.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),ORIGIN='https://mebleszek.github.io',PREFIX='/meble-app/';
const scripts=['shared/data-storage-keys','shared/data-backup-hash','shared/data-backup-snapshot-normalizer','shared/data-backup-snapshot-apply','shared/data-backup-export','shared/data-backup-snapshot','shared/data-backup-policy','shared/backup-archive-format','shared/backup-archive-idb','shared/storage-recovery-export','shared/data-backup-storage','shared/data-backup-records','shared/data-backup-store','ui/info-box','ui/session-diagnostics-readonly','ui/session-diagnostics','ui/storage-recovery-panel'];
const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="appView"></div><script>window.__testAccess=true;Object.defineProperty(window,"__FC_MAIN_ACCESS__",{value:{isValid:()=>window.__testAccess},writable:false,configurable:false});window.FC={session:{active:true,durable:false,snapshot:null,expectedOwnerKnown:false,lastError:{code:"SESSION_QUOTA_EXCEEDED"},begin(){throw Error("No begin")},commit(){throw Error("No commit")},cancel(){throw Error("No cancel")},retryInitialBegin(){throw Error("No retry")}}};window.projectData={private:"SYNTHETIC_UNSAVED"};window.uiState={};</script>'+scripts.map(f=>'<script src="js/app/'+f+'.js"></script>').join('')+'<script src="tools/storage-recovery-browser-suite.js"></script>';
async function main(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-storage-recovery-'));let browser;const clients=[];const errors=[],external=[];
  try{
    for(const name of ['profile','cache','config','downloads'])fs.mkdirSync(path.join(dir,name));
    const executable=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/usr/bin/google-chrome'].find(f=>fs.existsSync(f));assert.ok(executable,'Real Chromium is required');
    browser=spawn(executable,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(dir,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe'],env:{...process.env,XDG_CACHE_HOME:path.join(dir,'cache'),XDG_CONFIG_HOME:path.join(dir,'config')}});
    const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chromium startup timeout')),15000);browser.on('error',e=>{clearTimeout(timer);reject(e);});browser.once('exit',code=>{clearTimeout(timer);reject(Error('Chromium failed ('+code+'): '+output.slice(-1200)));});browser.stderr.on('data',data=>{output+=data;const m=output.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
    const targets=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();
    async function client(url){
      const pending=new Map();let nextId=0;
      const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
      const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},120000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
      ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}
      else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
      else if(m.method==='Fetch.requestPaused'){
        const u=new URL(m.params.request.url);let body,type='text/javascript';
        try{
          assert.equal(u.origin,ORIGIN);
          if(u.pathname==='/favicon.ico'){void send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:204});return;}
          assert.ok(u.pathname.startsWith(PREFIX));
          const name=u.pathname.slice(PREFIX.length);
          if(name==='index.html'){body=html;type='text/html';}
          else{assert.ok(scripts.map(f=>'js/app/'+f+'.js').concat('tools/storage-recovery-browser-suite.js').includes(name));body=fs.readFileSync(path.join(ROOT,name));}
          void send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(body).toString('base64')}).catch(e=>errors.push(e.message));
        }catch(_){external.push('BLOCKED_REQUEST');void send('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{});}
      }
    };
      const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
      const c={send,evaluate,close(){for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'));}ws.close();}};clients.push(c);return c;
    }
    const {send,evaluate}=await client(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.join(dir,'downloads')});
    await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true});await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
    async function ready(evaluatePage=evaluate){for(let n=0;n<100;n++){if(await evaluatePage('typeof runStorageRecoveryBrowserSuite === "function"'))return;await new Promise(r=>setTimeout(r,50));}throw Error('Fixture load timeout');}
    await send('Page.navigate',{url:ORIGIN+PREFIX+'index.html'});await ready();let passed=0;
    for(let stage=1;stage<=5;stage++){
      const result=await evaluate('runStorageRecoveryBrowserSuite('+stage+')');for(const name of result.passed){console.log('PASS real Chromium/IndexedDB: '+name);passed++;}
      if(stage===1){
        await evaluate('FC.storageRecoveryExport.download(window.__downloadToken);true');
        const file=path.join(dir,'downloads','meble-app-private-recovery.encrypted.json');
        for(let n=0;n<100&&!fs.existsSync(file);n++)await new Promise(r=>setTimeout(r,50));
        assert.ok(fs.existsSync(file),'Browser downloaded actual private file');
        const text=fs.readFileSync(file,'utf8');
        assert.equal(await evaluate('FC.storageRecoveryExport.verify('+JSON.stringify(text)+',"synthetic PRIVATE secret passphrase",window.__downloadToken).then(r=>r.verified)'),true);
        console.log('PASS real Chromium: downloaded file read from disk, decrypted and verified without import');passed++;

        // A genuinely different tab uses the same origin lock and IDB profile.
        const created=await send('Target.createTarget',{url:'about:blank'});
        const list=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();
        const second=await client(list.find(t=>t.id===created.targetId).webSocketDebuggerUrl);
        await second.send('Runtime.enable');await second.send('Page.enable');await second.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
        await second.send('Page.navigate',{url:ORIGIN+PREFIX+'index.html'});await ready(second.evaluate);
        await evaluate('new Promise(resolve=>{navigator.locks.request(FC.backupArchiveFormat.LOCK,async()=>{resolve(true);await new Promise(release=>window.__releaseArchiveLock=release);});})');
        assert.equal(await second.evaluate('FC.backupArchive.copy().then(()=>"WRONG_SUCCESS",e=>e.message)'),'ARCHIVE_BUSY');
        await evaluate('window.__releaseArchiveLock();true');await send('Target.closeTarget',{targetId:created.targetId});second.close();
        console.log('PASS real Chromium/IndexedDB: two real tabs cannot migrate concurrently');passed++;
      }
      if(result.restart){await send('Page.reload',{ignoreCache:true});await ready();}
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('Storage recovery real Chromium: '+passed+' groups PASS; five document lifetimes, mobile 393×852, zero LIVE requests');
  }finally{for(const c of clients)c.close();browser?.kill('SIGKILL');await new Promise(r=>setTimeout(r,200));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
