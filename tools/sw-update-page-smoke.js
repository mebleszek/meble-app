'use strict';
// Execute the exact network-page inline bootstrap with isolated SW boundaries.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('sw-update.html','utf8'),source=html.match(/<script id="sw-update-bootstrap">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+stylesheet/);
const root='https://synthetic.invalid/meble-app/',activeHash='a'.repeat(64),waitingHash='b'.repeat(64),secret='PRIVATE_UID_TOKEN_RAW_PRICE';
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setImmediate(r));}assert.fail('Update page did not settle');}
function fixture(options={}){
 const nodes={},ports=[],jobs=new Map(),calls={get:0,update:0,verify:0};let serial=0,now=0;
 const node=id=>nodes[id]||={dataset:{},textContent:'',hidden:id==='sw-update-help',disabled:false,addEventListener(type,fn){this[type]=fn;}};
 class Channel{constructor(){const a={close(){this.closed=true;}},b={close(){this.closed=true;}};
  a.postMessage=data=>queueMicrotask(()=>{if(!b.closed)b.onmessage?.({data});});b.postMessage=data=>queueMicrotask(()=>{if(!a.closed)a.onmessage?.({data});});this.port1=a;this.port2=b;ports.push(a,b);
 }}
 const worker=(hash,reply={complete:true,version:hash})=>({scriptURL:root+'offline-worker.js',state:'installed',listeners:new Set(),
  addEventListener(type,fn){assert.equal(type,'statechange');this.listeners.add(fn);},removeEventListener(type,fn){this.listeners.delete(fn);},
  postMessage(message,channels){calls.verify++;assert.deepEqual(JSON.parse(JSON.stringify(message)),{type:'VERIFY_STATIC_SHELL'});
   if(this.noAck){this.late=()=>channels[0].postMessage(reply);return;}
   if(this.postError)throw Error(secret);channels[0].postMessage(reply);
  }});
 const events=()=>({listeners:new Map(),addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);},removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);},emit(type){for(const fn of this.listeners.get(type)||[])fn();}});
 const active=worker(activeHash,options.activeReply),waiting=options.noWaiting?null:worker(waitingHash,options.reply);active.state='activated';
 const reg={...events(),scope:root,active,waiting,installing:null,async update(){calls.update++;if(options.updateError)throw Error(secret);if(options.updateHang)await new Promise(resolve=>{calls.finishUpdate=resolve;});await options.onUpdate?.(reg,worker);}};
 if(options.foreignScope)reg.scope=root+'foreign/';if(options.foreignActive)active.scriptURL=root+'foreign.js';if(options.foreignWaiting&&waiting)waiting.scriptURL=root+'foreign.js';
 if(options.noAck&&waiting)waiting.noAck=true;if(options.activeNoAck)active.noAck=true;if(options.postError&&waiting)waiting.postError=true;
 const navigator={onLine:!options.offline,serviceWorker:{...events(),controller:options.foreignController?{scriptURL:root+'foreign.js'}:active,
  async getRegistration(url){calls.get++;assert.equal(url,root);if(options.getError)throw Error(secret);if(options.getHang)await new Promise(resolve=>{calls.finishGet=resolve;});return options.onGet?options.onGet(reg,calls.get):options.absent?undefined:reg;},
  register(){throw Error('Forbidden new registration');}}};
 if(options.unsupported)delete navigator.serviceWorker;
 const denied=()=>{throw Error('Forbidden data or activation access');};
 const window={location:{href:root+'sw-update.html',reload:denied},isSecureContext:options.insecure!==true,close:denied};
 for(const k of ['localStorage','sessionStorage','indexedDB','caches'])Object.defineProperty(window,k,{get:denied});
 const timers={setTimeout(fn,ms){const id=++serial;jobs.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>jobs.delete(id)};
 const context={window,navigator,document:{getElementById:node},URL,MessageChannel:Channel,Date:class extends Date{static now(){return now;}},...timers,fetch:denied};
 vm.runInNewContext(source,context,{filename:'sw-update.html:inline'});
 const state=()=>node('sw-update-status').dataset.state;
 const done=()=>until(()=>state()!=='checking'&&!node('sw-update-check').disabled);
 const verifyNoWrites=()=>{assert.equal(jobs.size,0);assert.ok(ports.every(p=>p.closed),'All verification ports must close');assert.equal(JSON.stringify(Object.values(nodes).map(n=>({text:n.textContent,data:n.dataset}))).includes(secret),false);for(const target of [reg,navigator.serviceWorker])if(target)assert.ok([...target.listeners.values()].every(set=>set.size===0),'No leaked registration/controller listener');};
 return {nodes,calls,reg,worker,active,waiting,navigator,state,done,verifyNoWrites,options,
  async advance(ms){now+=ms;for(const [id,j]of [...jobs])if(j.at<=now){jobs.delete(id);j.fn();}await new Promise(r=>setImmediate(r));},
  async retry(){await node('sw-update-check').click();await done();}};
}
(async()=>{
 let groups=0;
 let r=fixture();await r.done();assert.equal(r.state(),'ready');assert.equal(r.nodes['sw-update-active-version'].textContent,activeHash);assert.equal(r.nodes['sw-update-waiting-version'].textContent,waitingHash);
 assert.equal(r.nodes['sw-update-help'].hidden,false);assert.equal(r.calls.update,1);assert.equal(r.calls.verify,2);r.verifyNoWrites();groups++;
 for(const option of [{noWaiting:true},{absent:true},{offline:true},{unsupported:true},{insecure:true},{foreignScope:true},{foreignActive:true},{foreignWaiting:true},{foreignController:true}]){
  r=fixture(option);await r.done();assert.equal(r.state(),option.noWaiting?'no-waiting':option.offline?'offline':option.unsupported||option.insecure?'unsupported':'incompatible');
  assert.equal(r.calls.update,option.noWaiting?1:0);assert.equal(r.nodes['sw-update-help'].hidden,true);r.verifyNoWrites();
 }groups++;
 for(const option of [{reply:{complete:false}},{reply:{complete:true,version:secret}},{reply:{complete:true,version:'B'.repeat(64)}},{reply:{complete:'true',version:waitingHash}},
  {activeReply:{complete:false}},{postError:true},{updateError:true},{getError:true}]){
  r=fixture(option);await r.done();assert.equal(r.state(),'unconfirmed');assert.equal(r.nodes['sw-update-help'].hidden,true);r.verifyNoWrites();
 }groups++;
 r=fixture({noAck:true});await until(()=>r.calls.verify===2);assert.equal(r.state(),'checking');await r.nodes['sw-update-check'].click();assert.equal(r.calls.update,1,'A busy check must not create another update attempt');await r.advance(90001);await r.done();assert.equal(r.state(),'unconfirmed');
 assert.equal(r.nodes['sw-update-status'].dataset.reason,'WAITING_ACK_TIMEOUT');assert.equal(r.nodes['sw-update-active-version'].textContent,activeHash);
 r.waiting.late();await new Promise(resolve=>setImmediate(resolve));assert.equal(r.state(),'unconfirmed');assert.equal(r.calls.update,1);r.verifyNoWrites();groups++;
 r=fixture({noWaiting:true,onUpdate(reg,worker){reg.installing=worker(waitingHash);reg.installing.state='installing';}});
 await until(()=>r.reg.installing?.listeners.size>0);assert.equal(r.state(),'checking');const installer=r.reg.installing;r.reg.waiting=installer;r.reg.installing=null;installer.state='installed';for(const fn of installer.listeners)fn();
 await r.done();assert.equal(r.state(),'ready');assert.equal(installer.listeners.size,0);r.verifyNoWrites();groups++;
 r=fixture({noWaiting:true,onUpdate(reg,worker){reg.installing=worker(waitingHash);reg.installing.state='redundant';}});await r.done();assert.equal(r.state(),'unconfirmed');assert.equal(r.reg.installing.listeners.size,0);r.verifyNoWrites();groups++;
 r=fixture({updateHang:true});await until(()=>r.calls.update===1);await r.advance(30001);await r.done();assert.equal(r.state(),'unconfirmed');r.verifyNoWrites();groups++;
 r=fixture({noWaiting:true,onUpdate(reg,worker){reg.installing=worker(waitingHash);reg.installing.state='installing';}});await until(()=>r.reg.installing?.listeners.size>0);
 await r.advance(180001);await r.done();assert.equal(r.state(),'unconfirmed');assert.equal(r.nodes['sw-update-status'].dataset.reason,'INSTALL_TIMEOUT');assert.equal(r.reg.installing.listeners.size,0);r.verifyNoWrites();groups++;
 r=fixture({noAck:true});await until(()=>r.calls.verify===2);const old=r.waiting;r.reg.waiting=r.worker('c'.repeat(64));old.late();await r.done();assert.equal(r.state(),'unconfirmed');r.verifyNoWrites();groups++;
 r=fixture({noWaiting:true});await r.done();assert.equal(r.state(),'no-waiting');assert.match(r.nodes['sw-update-status'].textContent,/nie jest potwierdzenie najnowszej/);
 r.reg.waiting=r.worker(waitingHash);await r.retry();assert.equal(r.state(),'ready');assert.equal(r.calls.update,2);r.verifyNoWrites();groups++;
 // Distinct closed reasons and the first failed stage, never exception text.
 for(const [option,stage,code]of [
  [{getError:true},'registration','REGISTRATION_READ_FAILED'],[{absent:true},'registration','REGISTRATION_MISSING'],
  [{foreignScope:true},'compatibility','SCOPE_MISMATCH'],[{foreignController:true},'compatibility','CONTROLLER_SCRIPT_MISMATCH'],
  [{updateError:true},'update','UPDATE_FAILED'],[{postError:true},'verify-waiting','WAITING_ACK_SEND_FAILED'],
  [{activeReply:{complete:false}},'verify-active','ACTIVE_ACK_INCOMPLETE'],[{reply:{complete:true,version:secret}},'verify-waiting','WAITING_ACK_INVALID_HASH']]){
  r=fixture(option);await r.done();assert.equal(r.nodes['sw-update-status'].dataset.stage,stage);assert.equal(r.nodes['sw-update-status'].dataset.reason,code);assert.match(r.nodes['sw-update-status'].textContent,/Pierwszy nieudany etap:/);r.verifyNoWrites();
 }groups++;
 // Every hanging operation is bounded, including initial/final registration.
 r=fixture({getHang:true});await until(()=>r.calls.get===1);await r.advance(10001);await r.done();assert.equal(r.nodes['sw-update-status'].dataset.reason,'REGISTRATION_TIMEOUT');r.verifyNoWrites();
 r=fixture({activeNoAck:true});await until(()=>r.calls.verify===2);await r.advance(90001);await r.done();assert.equal(r.nodes['sw-update-status'].dataset.reason,'ACTIVE_ACK_TIMEOUT');assert.equal(r.nodes['sw-update-waiting-version'].textContent,waitingHash);r.verifyNoWrites();
 r=fixture({activeReply:{complete:false},noAck:true});await until(()=>r.calls.verify===2);await r.advance(90001);await r.done();assert.equal(r.nodes['sw-update-status'].dataset.reason,'ACTIVE_ACK_INCOMPLETE','A later timeout must not replace the first failure');r.verifyNoWrites();groups++;
 r=fixture({onGet:(reg,count)=>count===1?reg:new Promise(()=>{})});await until(()=>r.calls.get===2);await r.advance(10001);await r.done();
 assert.equal(r.nodes['sw-update-status'].dataset.stage,'verification');assert.equal(r.nodes['sw-update-status'].dataset.reason,'REGISTRATION_TIMEOUT');r.verifyNoWrites();groups++;
 // Slow update, installation and BOTH complete() replies get independent time.
 r=fixture({noWaiting:true,activeNoAck:true,updateHang:true,onUpdate(reg,worker){reg.installing=worker(waitingHash);reg.installing.state='installing';reg.installing.noAck=true;}});
 await until(()=>r.calls.update===1);await r.advance(29000);r.calls.finishUpdate();await until(()=>r.reg.installing?.listeners.size>0);
 await r.advance(179000);assert.equal(r.state(),'checking','Installation must not inherit the spent update budget');
 const slow=r.reg.installing;r.reg.waiting=slow;r.reg.installing=null;slow.state='installed';for(const fn of slow.listeners)fn();
 await until(()=>r.calls.verify===2);await r.advance(89000);assert.equal(r.state(),'checking','Full manifest ACK must have its own budget');r.active.late();slow.late();
 await r.done();assert.equal(r.state(),'ready');r.verifyNoWrites();groups++;
 // Losing/changing either worker or controller invalidates every old ACK.
 for(const change of [
  f=>{f.reg.active=f.worker('c'.repeat(64));f.reg.active.state='activated';},f=>{f.reg.installing=f.worker('c'.repeat(64));},
  f=>{f.navigator.serviceWorker.controller=f.worker('c'.repeat(64));},f=>{f.reg.emit('updatefound');},f=>{f.navigator.serviceWorker.emit('controllerchange');},
  f=>{f.reg.scope=root+'foreign/';},f=>{f.waiting.scriptURL=root+'foreign.js';},f=>{f.active.state='redundant';}
 ]){
  r=fixture({noAck:true});await until(()=>r.calls.verify===2);change(r);r.waiting.late();await r.done();assert.equal(r.state(),'unconfirmed');assert.equal(r.nodes['sw-update-status'].dataset.reason,'WORKER_CHANGED');
  assert.equal(r.nodes['sw-update-active-version'].textContent,'Niepotwierdzony');assert.equal(r.nodes['sw-update-waiting-version'].textContent,'Niepotwierdzony');r.verifyNoWrites();
 }
 r=fixture({onGet:(reg,count)=>count===1?reg:{...reg}});await r.done();assert.equal(r.nodes['sw-update-status'].dataset.reason,'REGISTRATION_CHANGED');r.verifyNoWrites();groups++;
 // Expiry is final even when the browser operation or old ACK finishes later;
 // an explicit new attempt cannot be overwritten by the expired one.
 r=fixture({updateHang:true});await until(()=>r.calls.update===1);await r.advance(30001);await r.done();assert.equal(r.nodes['sw-update-status'].dataset.reason,'UPDATE_TIMEOUT');
 r.options.updateHang=false;await r.retry();assert.equal(r.state(),'ready');r.calls.finishUpdate();await new Promise(resolve=>setImmediate(resolve));assert.equal(r.state(),'ready');assert.equal(r.calls.verify,2);r.verifyNoWrites();groups++;
 r=fixture({noAck:true});await until(()=>r.calls.verify===2);const late=r.waiting.late;await r.advance(90001);await r.done();r.waiting.noAck=false;await r.retry();late();await new Promise(resolve=>setImmediate(resolve));assert.equal(r.state(),'ready');assert.equal(r.calls.update,2);r.verifyNoWrites();groups++;
 // A suspended tab must never accept overdue results when it resumes.
 r=fixture({noAck:true});await until(()=>r.calls.verify===2);await r.advance(330001);r.waiting.late();await r.done();assert.equal(r.state(),'unconfirmed');assert.equal(r.nodes['sw-update-status'].dataset.timeout,'true');assert.equal(r.nodes['sw-update-status'].dataset.reason,'WAITING_ACK_TIMEOUT');r.verifyNoWrites();groups++;
 const inventory=require('./ci-smoke-shards'),historical=require('./cloud-ci-context').historicalSmoke;
 assert.equal(inventory.plan(inventory.inventory('tools',historical)).flat().filter(n=>n==='sw-update-page-smoke.js').length,1);
 assert.equal(inventory.plan(inventory.inventory('tools',historical)).flat().filter(n=>n==='android-safe-sw-update-smoke.js').length,1);
 assert.equal(require('./offline-assets').manifest().files.some(f=>f.path==='sw-update.html'),false);
 assert.doesNotMatch(source,/skipWaiting|clients\.claim|location\.reload|\.register\(|indexedDB|localStorage|caches\./);groups++;
 console.log(`Network-only update page: ${groups}/${groups} groups PASS (ready, absent, foreign, offline, invalid ACK, timeout, installing, stale worker, retry, privacy and CI)`);
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
