'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{MessageChannel}=require('node:worker_threads'),crypto=require('node:crypto').webcrypto;
const source=fs.readFileSync('js/app/cloud/offline-update.js','utf8');
const root='https://synthetic.invalid/meble-app/',hash='a'.repeat(64);
async function fixture({complete=true,foreign=false,scope=false,offline=false,protocol=1,block='',confirmed=false}={}){
 const nodes=[];let registered=0,reloads=0,activation=0,frozen=false;
 const events=new EventTarget(),storage=new Map(confirmed?[['meble-pending-update-v1',hash]]:[]);
 const worker=Object.assign(new EventTarget(),{scriptURL:root+(foreign?'foreign.js':'offline-worker.js'),state:'installed',postMessage(message,[port]){
  if(message.type==='VERIFY_STATIC_SHELL'){
   port.postMessage({complete,version:hash,activationProtocol:protocol});port.close();return;
  }
  assert.equal(message.type,'ACTIVATE_STATIC_SHELL');assert.equal(message.version,hash);activation++;
  const proof={protocol:1,version:hash,nonce:message.nonce};
  port.onmessage=({data})=>{
   assert.equal(data.nonce,message.nonce);assert.equal(data.version,hash);assert.equal(data.confirm,true);
   assert.equal(frozen,true,'Old state stays paused until the measured activation');
   port.postMessage({...proof,status:'accepted'});port.close();
   reg.waiting=null;reg.active=navigator.serviceWorker.controller=worker;
   navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  };
  port.postMessage({...proof,status:'prepared'});
 }});
 const reg={waiting:confirmed?null:worker,scope:root+(scope?'foreign/':''),addEventListener(){},async update(){}};
 const navigator={onLine:!offline,serviceWorker:Object.assign(new EventTarget(),{controller:confirmed?worker:{scriptURL:worker.scriptURL},async register(){registered++;return reg;}})};
 const window={navigator,isSecureContext:true,addEventListener:(...args)=>events.addEventListener(...args),dispatchEvent:event=>events.dispatchEvent(event),
  sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},
  location:{reload(){reloads++;events.dispatchEvent(new Event('pagehide'));}},
  FC:{applicationStartup:{async prepareClientUpdate(fn){if(block)throw Error(block);frozen=true;try{return await fn(()=>assert.equal(frozen,true));}finally{frozen=false;}}}}};
 Object.defineProperty(window,'localStorage',{get(){throw Error('Updater must not read business storage');}});
 const document={baseURI:root+'index.html',readyState:'loading',addEventListener(){},
  body:{inert:false,appendChild:n=>nodes.push(n)},createElement:tag=>({tag,hidden:false,children:[],setAttribute(){},addEventListener(type,fn){this[type]=fn;},append(...args){this.children.push(...args);}})};
 vm.runInNewContext(source,{window,navigator,document,URL,MessageChannel,setTimeout,clearTimeout,crypto});
 await window.FC.offlineUpdate.start();
 return {nodes,document,window,navigator,storage,get registered(){return registered;},get activation(){return activation;},get reloads(){return reloads;}};
}
(async()=>{
 for(const failure of [{complete:false},{foreign:true},{scope:true},{offline:true}]){
  const f=await fixture(failure);assert.equal(f.nodes[0].hidden,true);assert.equal(f.registered,failure.offline?0:1);assert.equal(f.activation,0);
 }
 const postponed=await fixture(),notice=postponed.nodes[0];
 assert.equal(notice.hidden,false);notice.children[2].click();
 postponed.window.dispatchEvent(new Event('online'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(notice.hidden,true);assert.equal(postponed.activation,0);
 const f=await fixture();
 const [status,update]=f.nodes[0].children;
 await update.click();
 assert.equal(f.activation,1);assert.equal(f.reloads,1);
 assert.match(status.textContent,/Otwieranie/);assert.equal(f.storage.get('meble-pending-update-v1'),hash);
 const next=await fixture({confirmed:true});await new Promise(resolve=>setImmediate(resolve));
 assert.match(next.nodes[0].children[0].textContent,/zaktualizowana/);assert.equal(next.storage.size,0);
 for(const block of ['LF_ACTIVE_RAM_PROTECTED','LF_OTHER_APPLICATION_CLIENT','UPDATE_SAVE_PENDING']){
  const refused=await fixture({block});await refused.nodes[0].children[1].click();
  assert.equal(refused.activation,0);assert.equal(refused.reloads,0);assert.equal(refused.document.body.inert,false);
  assert.equal(refused.storage.size,0);
 }
 const legacy=await fixture({protocol:0});await legacy.nodes[0].children[1].click();
 assert.match(legacy.nodes[0].children[0].textContent,/zamknij karty/);assert.equal(legacy.activation,0);
 const offline=await fixture();offline.navigator.onLine=false;await offline.nodes[0].children[1].click();assert.equal(offline.activation,0);
 console.log('PASS offline update: exact candidate, opt-out, client guards, confirmed activation and reload, legacy/offline/incomplete refusal');
})().catch(error=>{console.error(error);process.exitCode=1;});
