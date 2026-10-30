'use strict';
// Targeted scheduler and owned-process/profile lifecycle checks. No Firebase,
// real browser, network, business data or modification of runtime safeguards.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
async function schedulerCheck(){
  const {createDurableSynchronizer}=await import('../sync/local-first-sync.mjs');
  const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
  function fixture({beforeRead=async()=>{},onState=()=>{}}={}){
    let online=false,operation=null,publications=0,prepares=0,reads=0,remote=null;
    const model={synthetic:'exact'},events=new EventTarget(),head={generation:1,revisionId:'synthetic'};
    const store={exclusive:fn=>fn(),snapshot:async()=>({
      replica:operation?{dirty:operation.phase!=='verified',base:operation.phase==='verified'?head:null}:null,
      operations:operation?[structuredClone(operation)]:[]}),
      commit:async()=>{assert.equal(operation,null);operation={key:'one',scope:'globals',localVersion:1,json:JSON.stringify(model),phase:'queued',base:null};return {localConfirmed:true};},
      transition:async(_key,from,to,patch)=>{assert.equal(operation.phase,from);Object.assign(operation,patch,{phase:to});return structuredClone(operation);}};
    const channel={kind:'globals',scope:'globals',contract:{schemas:{synthetic:{}},capture:()=>({model,assertUnchanged(){}}),validateBundle(){}},
      prepare:async()=>{prepares++;return {expected:head,publish:async()=>{
        publications++;remote={head, value:model};
        throw Object.assign(Error('Injected post-publication failure'),{code:'GLOBAL_NETWORK_UNCONFIRMED'});
      }};},
      read:async()=>{reads++;await beforeRead();if(!remote)throw Object.assign(Error('No remote revision'),{code:'GLOBAL_NOT_FOUND'});return structuredClone(remote);}};
    const sync=createDurableSynchronizer({store,channels:[channel],eventTarget:events,online:()=>online,onState});
    return {sync,events,model,head,setOnline(value){online=value;},
      inspect:()=>structuredClone({operation,publications,prepares,reads}),
      submit:()=>sync.submitGlobals({source:{},operationId:'one',expectedVersion:0})};
  }
  async function recover(f,result){
    assert.deepEqual(result,{ok:false,code:'GLOBAL_NETWORK_UNCONFIRMED'});
    const uncertain=f.inspect();
    assert.equal(uncertain.publications,1);assert.equal(uncertain.prepares,1);
    assert.equal(uncertain.operation.phase,'uncertain');assert.equal(uncertain.operation.code,'GLOBAL_NETWORK_UNCONFIRMED');
    assert.deepEqual(uncertain.operation.expected,f.head);assert.deepEqual(JSON.parse(uncertain.operation.json),f.model);
    // Another wake resolves the exact durable revision by independent READ,
    // never by preparing/publishing again after a lost ACK.
    assert.deepEqual(await f.sync.flush(),{ok:true});
    const verified=f.inspect();
    assert.equal(verified.publications,1);assert.equal(verified.prepares,1);assert.ok(verified.reads>uncertain.reads);
    assert.equal(verified.operation.phase,'verified');assert.deepEqual(verified.operation.receipt,f.head);
    assert.equal(verified.operation.json,uncertain.operation.json);
  }
  const offline=fixture();
  try{
    await offline.sync.flush();assert.deepEqual(await offline.submit(),{localConfirmed:true});
    assert.deepEqual(await offline.sync.flush(),{ok:false,code:'LF_OFFLINE'});
    const queued=offline.inspect();
    assert.equal(queued.publications,0);assert.equal(queued.prepares,0);assert.equal(queued.reads,0);
    assert.equal(queued.operation.phase,'queued');assert.deepEqual(JSON.parse(queued.operation.json),offline.model);
  }finally{offline.sync.close();}
  // A manual flush is itself a wake-up request. It must not return a stale
  // offline result after online() becomes true, even without an online event.
  for(const signalOnline of [false,true]){
    const f=fixture();
    try{
      await f.sync.flush();await f.submit();f.setOnline(true);
      if(signalOnline)f.events.dispatchEvent(new Event('online'));
      await recover(f,await f.sync.flush());
    }finally{f.sync.close();}
  }
  console.log('PASS scheduler: genuine offline preserves queued bytes with zero network work; manual/online wake publishes once and lost ACK resolves by READ');
  // Deterministic race: pause an empty receive cycle AFTER its outbox snapshot,
  // then commit while it is still running. Only submit's schedule() can request
  // the next scan: no manual flush/online/listener signal follows the commit.
  const entered=deferred(),release=deferred();let first=true;
  const busy=fixture({beforeRead:async()=>{if(first){first=false;entered.resolve();await release.promise;}}});
  let draining;
  try{
    await busy.sync.flush();busy.setOnline(true);draining=busy.sync.flush();await entered.promise;
    assert.deepEqual(await busy.submit(),{localConfirmed:true});
    const pending=busy.inspect();assert.equal(pending.operation.phase,'queued');assert.equal(pending.publications,0);
    release.resolve();const result=await draining;
    // Assert before recovery/another flush so a missed wake cannot be hidden.
    assert.equal(busy.inspect().publications,1);await recover(busy,result);
  }finally{release.resolve();await draining;busy.sync.close();}
  console.log('PASS scheduler race: a commit during an empty running cycle wakes another scan without manual flush; exactly one WRITE');
  // Hold an already evaluated offline result in flight. The real online event
  // arrives from its state observer; the running cycle must consume that wake.
  const states=[];let armed=false,active;
  active=fixture({onState:result=>{states.push(result.code||'OK');if(armed&&result.code==='LF_OFFLINE'){
    armed=false;active.setOnline(true);active.events.dispatchEvent(new Event('online'));
  }}});
  try{
    await active.sync.flush();await active.submit();armed=true;
    const result=await active.sync.flush();
    assert.deepEqual(states.slice(-2),['LF_OFFLINE','GLOBAL_NETWORK_UNCONFIRMED']);
    await recover(active,result);
  }finally{active.sync.close();}
  console.log('PASS scheduler race: online during a running offline cycle consumes the wake and resolves an uncertain ACK without a second WRITE');
}
async function profileCheck(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meble-crash-profile-')),profile=path.join(directory,'profile');
  fs.mkdirSync(profile);fs.writeFileSync(path.join(profile,'SingletonLock'),'SYNTHETIC-DO-NOT-REMOVE');
  fs.writeFileSync(path.join(profile,'IndexedDB-SENTINEL'),'SYNTHETIC-KEEP');
  const readyFile=path.join(directory,'ready'),termFile=path.join(directory,'term');
  let owned,signals=[],launches=0;
  // Execute the actual runtime/supervisor/receipt/profile guard. Only the
  // browser/DBus command and CDP boundary are replaced by an owned test process.
  // No production injection switch is added to the runtime.
  const dependency=name=>name==='node:child_process'?{spawn(command,args,options){
    launches++;assert.equal(command,'/usr/bin/python3');assert.match(args[1],/^--receipt=/);
    fs.rmSync(readyFile,{force:true});
    const script='import os,signal,time\nfrom pathlib import Path\nsignal.signal(signal.SIGTERM,lambda *_: Path('+JSON.stringify(termFile)+').write_text("TERM"))\nPath('+JSON.stringify(readyFile)+').write_text(str(os.getpid()))\nwhile True: time.sleep(1)\n';
    return spawn(command,[args[0],args[1],'/usr/bin/python3','-u','-c',script],options);
  }}:name==='./chromium-startup'?{waitForEndpoint:async()=>{
    const deadline=Date.now()+5000;while(!fs.existsSync(readyFile)){if(Date.now()>deadline)throw Error('Controlled process readiness timeout');await new Promise(r=>setTimeout(r,10));}
    return 'ws://127.0.0.1:23456/devtools/browser/synthetic';
  }}:require(name);
  const processBoundary={platform:process.platform,env:{...process.env,CHROMIUM_PATH:'/usr/bin/python3'},kill(pid,signal){signals.push(signal);return process.kill(pid,signal);}};
  const module={exports:{}};
  new Function('require','module','process','fetch','__dirname',fs.readFileSync(path.join(__dirname,'helpers/chromium-runtime.js'),'utf8'))(
    dependency,module,processBoundary,async()=>({status:200,json:async()=>({webSocketDebuggerUrl:'ws://127.0.0.1:23456/devtools/browser/synthetic'})}),path.join(__dirname,'helpers'));
  const runtime=module.exports;let clean=false;
  try{
    owned=await runtime.startBrowser({profileDir:profile});const pid=Number(fs.readFileSync(readyFile,'utf8'));
    await assert.rejects(runtime.startBrowser({profileDir:profile}),/profile is still owned/);
    assert.equal(launches,1,'Concurrent profile reuse must refuse before spawning');
    await owned.crash();
    assert.equal(fs.existsSync('/proc/'+pid),false,'Controlled process must be dead and reaped');
    assert.equal(fs.existsSync('/proc/'+owned.child.pid),false,'Supervisor must have exited');
    assert.deepEqual(signals,['SIGUSR2']);assert.equal(fs.existsSync(termFile),false,'Hard crash cannot be replaced by graceful TERM');
    assert.equal(fs.readFileSync(path.join(profile,'SingletonLock'),'utf8'),'SYNTHETIC-DO-NOT-REMOVE');
    assert.equal(fs.readFileSync(path.join(profile,'IndexedDB-SENTINEL'),'utf8'),'SYNTHETIC-KEEP');
    owned=await runtime.startBrowser({profileDir:profile});assert.equal(launches,2);
    const reopenedPid=Number(fs.readFileSync(readyFile,'utf8'));await owned.crash();
    assert.equal(fs.existsSync('/proc/'+reopenedPid),false);assert.equal(fs.existsSync('/proc/'+owned.child.pid),false);
    assert.equal(fs.readFileSync(path.join(profile,'IndexedDB-SENTINEL'),'utf8'),'SYNTHETIC-KEEP');
    clean=true;console.log('PASS real controlled process: hard termination/reaping, cleanup receipt, profile release/reopen; lock and retained bytes preserved');
  }finally{
    await owned?.crash();if(clean)fs.rmSync(directory,{recursive:true,force:true});
  }
}
async function main(){await schedulerCheck();await profileCheck();}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,schedulerCheck,profileCheck};
