// Real Chromium/IndexedDB fixture shared by Preflight and SDK regressions.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{waitForEndpoint}=require('./chromium-startup.js');
const root=path.resolve(new URL('../..',import.meta.url).pathname);
export async function startLocalFirstServer(){
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Isolated LOCAL-FIRST fixture</title><script type="module">import {openLocalFirstStore} from "/sync/local-first-idb.mjs";window.openLF=(binding)=>openLocalFirstStore({...binding,indexedDB,locks:navigator.locks}).then(s=>{window.lf=s;return true;});window.lfReady=true;</script>');return;}
    if(!/^\/sync\/local-first-[a-z-]+\.mjs$/.test(url.pathname)){res.writeHead(404);res.end();return;}
    try{res.writeHead(200,{'content-type':'text/javascript'});res.end(fs.readFileSync(path.join(root,url.pathname)));}catch(_){res.writeHead(404);res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {base:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
export async function openBrowserDevice(server,profileDirectory){
  fs.mkdirSync(profileDirectory,{recursive:true});
  const executable=process.env.CHROMIUM_PATH||['/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
  if(!executable)throw Error('Real Chromium is required');
  const child=spawn(executable,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking',
    '--disable-component-update','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profileDirectory,'about:blank'],{stdio:['ignore','ignore','pipe']});
  const endpoint=await waitForEndpoint(child,{profileDir:profileDirectory});
  const targets=await(await fetch('http://127.0.0.1:'+new URL(endpoint).port+'/json/list')).json();
  const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl),pending=new Map();let counter=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter,timer=setTimeout(()=>{pending.delete(id);reject(Error('LF_CDP_TIMEOUT'));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error('LF_CDP_FAILED')):p.resolve(m.result);}};
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||'LF_BROWSER_EXCEPTION');return r.result.value;};
  await send('Page.enable');await send('Page.navigate',{url:server.base});
  for(let i=0;i<100;i++){if(await evaluate('window.lfReady===true'))break;if(i===99)throw Error('LF_FIXTURE_NOT_READY');await new Promise(resolve=>setTimeout(resolve,20));}
  let closed=false;
  return {evaluate,
    async open(binding){await evaluate('window.openLF('+JSON.stringify(binding)+')');return proxyStore(evaluate,binding);},
    async close(){if(closed)return;closed=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('LF_BROWSER_CLOSED'));}pending.clear();ws.close();
      if(child.exitCode===null&&child.signalCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await ended;}},
    kill(){child.kill('SIGKILL');}
  };
}
function proxyStore(evaluate,binding){
  const call=(method,...args)=>evaluate('window.lf['+JSON.stringify(method)+'](...'+JSON.stringify(args)+')');
  const store={...binding};
  for(const name of ['snapshot','commit','transition','apply','setEditor'])store[name]=(...args)=>call(name,...args);
  store.exclusive=async operation=>{
    const held=await evaluate('new Promise(resolve=>{navigator.locks.request('+JSON.stringify(binding.name+':'+binding.instanceId)+',{mode:"exclusive"},async lock=>{resolve(!!lock);if(lock)await new Promise(release=>window.__releaseLF=release);});})');
    if(!held)throw Error('LF_LOCAL_BUSY');try{return await operation();}finally{await evaluate('window.__releaseLF();true');}
  };
  store.close=()=>evaluate('window.lf.close();true');return store;
}
