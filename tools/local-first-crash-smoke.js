'use strict';
// Targeted scheduler and owned-process/profile lifecycle checks. No Firebase,
// real browser, network, business data or modification of runtime safeguards.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
async function schedulerCheck(){
  const {createDurableSynchronizer}=await import('../sync/local-first-sync.mjs');
  async function run(signalOnline){
    let online=false,operation=null,publications=0,injectionReached=false;
    const model={synthetic:'exact'},events=new EventTarget(),head={generation:1,revisionId:'synthetic'};
    const store={exclusive:fn=>fn(),snapshot:async()=>({replica:operation?{dirty:true}:null,operations:operation?[structuredClone(operation)]:[]}),
      commit:async()=>{operation={key:'one',scope:'globals',localVersion:1,json:JSON.stringify(model),phase:'queued',base:null};return {localConfirmed:true};},
      transition:async(_key,from,to,patch)=>{assert.equal(operation.phase,from);Object.assign(operation,patch,{phase:to});return structuredClone(operation);}};
    const channel={kind:'globals',scope:'globals',contract:{schemas:{synthetic:{}},capture:()=>({model,assertUnchanged(){}}),validateBundle(){}},
      prepare:async()=>({expected:head,publish:async()=>{publications++;injectionReached=true;throw Object.assign(Error('Injected post-publication failure'),{code:'GLOBAL_NETWORK_UNCONFIRMED'});}})};
    const sync=createDurableSynchronizer({store,channels:[channel],eventTarget:events,online:()=>online});
    await sync.flush();await sync.submitGlobals({source:{},operationId:'one',expectedVersion:0});online=true;
    if(signalOnline)events.dispatchEvent(new Event('online'));
    const result=await sync.flush();sync.close();return {result,publications,injectionReached,operation};
  }
  const premature=await run(false);
  assert.equal(premature.result.code,'LF_OFFLINE');assert.equal(premature.publications,0);assert.equal(premature.injectionReached,false);
  const signalled=await run(true);
  assert.equal(signalled.result.code,'GLOBAL_NETWORK_UNCONFIRMED');assert.equal(signalled.publications,1);assert.equal(signalled.injectionReached,true);
  assert.equal(signalled.operation.phase,'uncertain');
  console.log('PASS actual scheduler: immediate false can be offline; online event reaches exactly one injected publication failure');
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
