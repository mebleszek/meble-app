'use strict';
// Actual main/loader with deterministic clocks; no Firebase/network/user stores.
const assert=require('node:assert/strict'),fs=require('node:fs'),{world}=require('./trusted-main-login-smoke');
const flush=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
function fixture(fetcher){
 let now=0,serial=0,allowed=true;const timers=new Map(),errors=[],events=[];
 const set=(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clear=id=>timers.delete(id);
 const w={FC:{},evalLog:[],addEventListener(){},removeEventListener(){}};
 class Node{
  constructor(){this.tagName='SCRIPT';this.src='';this.attrs={};}
  appendChild(node){new Function('window',node.textContent)(w);return node;}
  insertBefore(node){return this.appendChild(node);}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return k==='src'?this.src||null:this.attrs[k]||null;}
  removeAttribute(k){delete this.attrs[k];if(k==='src')this.src='';}
  dispatchEvent(event){events.push(event.type);}
 }
 const document={baseURI:'https://fixture.invalid/index.html',head:new Node(),createElement:()=>new Node()};
 new Function('window','document','Node','location','fetch','AbortController','TextDecoder','setTimeout','clearTimeout','URL','Event',fs.readFileSync('js/app/cloud/main-business-loader.js','utf8'))(w,document,Node,{origin:'https://fixture.invalid'},fetcher,AbortController,TextDecoder,set,clear,URL,Event);
 const loader=w.FC.mainBusinessLoader.create(()=>{if(!allowed)throw Error('AUTH_ACCESS_REVOKED');},error=>errors.push(error));
 return {w,loader,errors,timers,events,revoke(){allowed=false;},async advance(ms){now+=ms;for(const[id,t]of [...timers])if(t.at<=now&&timers.has(id)){timers.delete(id);t.fn();}await flush();}};
}
const manifest=[{src:'js/held.js',group:'startup-foundation'}];
async function scriptCases(){
 for(const body of [false,true]){
  let release,signal,stream;
  const r=fixture((_url,options)=>{signal=options.signal;return body?Promise.resolve(new Response(new ReadableStream({start(c){stream=c;}}))):new Promise(resolve=>{release=resolve;});});
  const pending=r.loader.start(manifest);const rejected=assert.rejects(pending,error=>error.code==='AUTH_SCRIPT_TIMEOUT');await flush();
  await r.advance(29999);assert.equal(signal.aborted,false);
  if(body){stream.enqueue(new Uint8Array());await flush();}
  await r.advance(1);assert.equal(signal.aborted,true,'A silent script stall must be cancelled');await rejected;assert.equal(r.timers.size,0);
  if(body)stream.close();else release(new Response('window.evalLog.push("late")'));
  await flush();assert.deepEqual(r.w.evalLog,[],'Late headers/body cannot evaluate a script');assert.deepEqual(r.events,[]);
 }
 const simultaneous=fixture(()=>new Promise(()=>{})),batch=simultaneous.loader.start([{src:'js/first.js',group:'startup-foundation'},{src:'js/second.js',group:'startup-foundation'}]);
 const firstRefusal=assert.rejects(batch,error=>error.code==='AUTH_SCRIPT_TIMEOUT');await flush();await simultaneous.advance(30000);await firstRefusal;assert.deepEqual(simultaneous.w.evalLog,[]);assert.equal(simultaneous.timers.size,0,'Cancelling siblings retains the original timeout and clears their observers');
 console.log('PASS script headers/body inactivity, empty chunks, cancellation and late response refuse without execution');
 let chunks;
 const r=fixture(()=>Promise.resolve(new Response(new ReadableStream({start(c){chunks=c;}}))));
 const pending=r.loader.start(manifest);await flush();const bytes=new TextEncoder().encode('window.evalLog.push("Łódź")');
 for(const part of [bytes.slice(0,22),bytes.slice(22,24),bytes.slice(24)]){await r.advance(20000);chunks.enqueue(part);await flush();}
 chunks.close();await pending;assert.deepEqual(r.w.evalLog,['Łódź']);assert.equal(r.timers.size,0);
 console.log('PASS real byte progress may exceed the 30-second total; streaming UTF-8 remains exact');
 let release;const cancelled=fixture(()=>new Promise(resolve=>{release=resolve;})),late=cancelled.loader.start(manifest);
 const refused=assert.rejects(late,/AUTH_SCRIPT_ABORTED/);cancelled.loader.abort();await refused;release(new Response('window.evalLog.push("late")'));await flush();assert.deepEqual(cancelled.w.evalLog,[]);assert.equal(cancelled.timers.size,0);
 let finish;const revoked=fixture(()=>new Promise(resolve=>{finish=resolve;})),work=revoked.loader.start(manifest),denied=assert.rejects(work,/AUTH_ACCESS_REVOKED/);revoked.revoke();finish(new Response('window.evalLog.push("forbidden")'));await denied;assert.deepEqual(revoked.w.evalLog,[]);
 console.log('PASS explicit abort and revoked access keep delayed scripts inert');
 let active=0,peak=0;const waiting=[];
 const ordered=fixture(url=>{active++;peak=Math.max(peak,active);return new Promise(resolve=>waiting.push(()=>{active--;resolve(new Response('window.evalLog.push('+Number(/(\d+)\.js/.exec(url)[1])+')'));}));});
 const many=ordered.loader.start(Array.from({length:11},(_,i)=>({src:'js/file'+i+'.js',group:'startup-foundation'})));await flush();assert.equal(waiting.length,8);
 waiting.splice(0).reverse().forEach(fn=>fn());await flush();waiting.splice(0).reverse().forEach(fn=>fn());await many;
 assert.equal(peak,8);assert.deepEqual(ordered.w.evalLog,Array.from({length:11},(_,i)=>i));
 console.log('PASS eight fetches maximum and exact manifest execution order');
}
async function styleCases(){
 for(const succeeds of [false,true]){
  let link,starts=0;
  const r=world({},null,{beforeMain(w){link={};w.document.head={appendChild(){}};w.document.getElementById('business-styles').content.cloneNode=()=>({querySelectorAll:()=>[link]});w.FC.applicationStartup={beforeBusiness:async()=>{},start:async()=>{starts++;}};}});
  try{
   await flush();r.input('click','auth-google');await flush();assert.equal(typeof link.onload,'function');
   r.shared.rows.set('fc_synthetic_unsent','PRESERVED');r.w.projectData={unsent:'PRESERVED_RAM'};
   const before=JSON.stringify([...r.shared.rows]),late=link.onload;r.advance(29999);await flush();
   assert.notEqual(r.w.document.body.dataset.authState,'error');
   if(succeeds){link.onload();await flush();assert.equal(starts,1);assert.equal(r.ready(),true);}
   else{r.advance(1);await flush();assert.equal(r.w.document.body.dataset.authState,'error');assert.match(r.nodes['auth-error'].textContent,/AUTH_STYLE_TIMEOUT/);assert.equal(starts,0);late();await flush();r.advance(1000);await flush();assert.equal(starts,0);assert.equal(link.disabled,true);assert.match(r.nodes['auth-error'].textContent,/AUTH_STYLE_TIMEOUT/);}
   assert.equal(JSON.stringify([...r.shared.rows]),before);assert.deepEqual(r.w.projectData,{unsent:'PRESERVED_RAM'});
  }finally{r.close();}
 }
 console.log('PASS actual main styles: pending request refuses, late load stays blocked, slow completion succeeds, RAW/RAM exact');
}
async function diagnosticCases(){
 let release,phase='initial-project-revisions',reads=0;
 const r=world({},null,{beforeMain(w){w.document.getElementById('main-login').hidden=false;w.FC.applicationStartup={beforeBusiness:async()=>{},start:()=>new Promise(resolve=>{release=resolve;}),diagnostics:()=>{reads++;return {stage:phase,ownerUid:'PRIVATE_OWNER_MUST_NOT_APPEAR'};}};}});
 try{
  await flush();r.input('click','auth-google');await flush();assert.equal(typeof release,'function');
  r.shared.rows.set('fc_synthetic_unsent','PRESERVED');r.w.projectData={unsent:'PRESERVED_RAM'};
  const before=JSON.stringify([...r.shared.rows]),initialReads=reads;
  assert.equal(r.nodes['auth-status'].textContent,'Uruchamianie Meble-App…');
  r.advance(29999);await flush();assert.equal(reads,initialReads);assert.ok(!r.nodes['auth-status'].textContent.includes('Etap:'));
  r.advance(1);await flush();assert.equal(r.nodes['auth-status'].textContent,'Uruchamianie Meble-App… Etap: initial-project-revisions.');
  assert.equal(r.ready(),false);phase='PRIVATE_OWNER_MUST_NOT_APPEAR';r.advance(1000);await flush();assert.equal(r.nodes['auth-status'].textContent,'Uruchamianie Meble-App… Etap: unknown.');
  phase='opening-idb';r.advance(1000);await flush();assert.match(r.nodes['auth-status'].textContent,/Etap: opening-idb/);
  assert.equal(JSON.stringify([...r.shared.rows]),before);assert.deepEqual(r.w.projectData,{unsent:'PRESERVED_RAM'});
  release();await flush();assert.equal(r.ready(),true);const doneReads=reads;phase='initial-project-revisions';r.advance(1000);await flush();assert.equal(reads,doneReads,'The observer stops once business opens');
  assert.equal(JSON.stringify([...r.shared.rows]),before);
 }finally{r.close();}
 console.log('PASS approved delayed stage: exactly 30 seconds, closed anonymous codes, backend remains pending, no writes/grants, stop on ready');
}
(async()=>{await scriptCases();await styleCases();await diagnosticCases();console.log('PASS startup asset safety');})().catch(e=>{console.error(e.stack);process.exitCode=1;});
