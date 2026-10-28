'use strict';
// Targeted supervision regressions. No app, Firebase, network or real user data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {ownedProcess,members}=require('./helpers/chromium-runtime');
async function ready(owner){
  return new Promise((resolve,reject)=>{let text='',tail='',done=false;const timer=setTimeout(()=>reject(Error('Process fixture did not start: '+tail)),5000);
    owner.child.stderr.on('data',chunk=>{tail=(tail+chunk).slice(-1000);});
    owner.child.stdout.on('data',chunk=>{text+=chunk;if(text.includes('\n')){done=true;clearTimeout(timer);resolve(text.trim());}});
    // A descendant may announce readiness after its intentionally exited leader.
    owner.exited.then(result=>{if(!done&&(result.error||result.code!==0)){clearTimeout(timer);reject(result.error||Error('Fixture exited '+result.code+': '+tail));}});
  });
}
function isolatedRuntime(profile){
  // Execute the actual runtime with synthetic OS/CDP boundaries. Business/DOM
  // suites still run real Chromium in CI, with no injection parameter added.
  const state={mode:'ready',active:false,fetches:0,signals:[],child:null,launches:0};
  const fakeFs={...fs,readdirSync:dir=>dir==='/proc'?(state.active?['400000']:[]):fs.readdirSync(dir),
    readFileSync:(file,...args)=>file==='/proc/400000/stat'?'400000 (fixture) S 1 400000 400000 0':fs.readFileSync(file,...args)};
  const fakeProcess={platform:'linux',env:{...process.env,DBUS_SESSION_BUS_ADDRESS:'invalid-inherited-address',DBUS_SYSTEM_BUS_ADDRESS:'invalid-system-address'},
    kill(group,signal){assert.equal(group,400000);state.signals.push(signal);state.active=false;clearTimeout(state.timer);
      const c=state.child;c.signalCode=signal;if(!state.omitReceipt)fs.writeFileSync(state.receipt,'reaped\n');c.stdout.end();queueMicrotask(()=>c.emit('exit',null,signal));}};
  const spawn=(command,args,options)=>{
    assert.equal(command,'/usr/bin/python3');assert.equal(args[2],'/usr/bin/dbus-run-session');assert.equal(options.detached,true);state.receipt=args[1].slice('--receipt='.length);
    assert.equal(options.env.DBUS_SESSION_BUS_ADDRESS,undefined);assert.equal(options.env.DBUS_SYSTEM_BUS_ADDRESS,undefined);
    assert.equal(fs.existsSync(path.join(profile,'DevToolsActivePort')),false);
    const config=fs.readFileSync(args[3].slice('--config-file='.length),'utf8');assert.match(config,/<type>session<\/type>/);assert.doesNotMatch(config,/<(?:service|standard_session_service)dir/);
    state.launches++;state.active=true;
    const c=Object.assign(new EventEmitter(),{pid:400000,exitCode:null,signalCode:null,stderr:new PassThrough(),stdout:new PassThrough()});state.child=c;
    state.timer=setTimeout(()=>{
      if(state.mode==='timeout'||state.mode==='dom-timeout')return;
      if(state.mode==='exit'){state.active=false;fs.writeFileSync(state.receipt,'reaped\n');c.exitCode=2;c.stdout.end();c.emit('exit',2,null);return;}
      if(state.mode.startsWith('dom-')){fs.writeFileSync(state.receipt,'reaped\n');c.stdout.end(state.mode==='dom-fail'?'<pre>FAIL real assertion</pre>':'<pre>PASS</pre>');state.active=false;c.exitCode=0;c.emit('exit',0,null);return;}
      fs.writeFileSync(path.join(profile,'DevToolsActivePort'),'23456\n/devtools/browser/fresh\n');
      c.stderr.write('DevTools listening on ws://127.0.0.1:23456/devtools/browser/fresh\n');
    },5);return c;
  };
  const fetch=async url=>{state.fetches++;assert.equal(url,'http://127.0.0.1:23456/json/version');
    if(state.mode==='http-error')throw Error('synthetic CDP connection failure');
    return{status:200,json:async()=>({webSocketDebuggerUrl:'ws://127.0.0.1:23456/devtools/browser/'+(state.mode==='wrong-process'?'foreign':'fresh')})};};
  const module={exports:{}};
  const dependency=name=>name==='node:fs'?fakeFs:name==='node:child_process'?{spawn}:name==='./chromium-startup'?require('./helpers/chromium-startup'):require(name);
  new Function('require','module','process','fetch','__dirname',fs.readFileSync(path.join(__dirname,'helpers/chromium-runtime.js'),'utf8'))(dependency,module,fakeProcess,fetch,path.join(__dirname,'helpers'));
  return {state,runtime:module.exports};
}
async function main(){
  const controls=[];const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meble-browser-supervision-'));let primary;
  try{
    const fixture=script=>ownedProcess('/usr/bin/python3',[path.join(__dirname,'helpers/chromium-process.py'),'/bin/sh','-c',script],{subreaper:true,stdio:['ignore','pipe','pipe']});
    const untouched=fixture('printf "ready\\n"; while :; do sleep 1; done');controls.push(untouched);await ready(untouched);
    const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
    const descendant='trap "" TERM; printf "%s\\n" "$$"; while :; do sleep 1; done';
    const script='trap "exit 0" TERM; /bin/sh -c '+quote(descendant)+' & wait';
    const tree=fixture(script);controls.push(tree);const pid=Number(await ready(tree));assert.ok(members(tree.child.pid).includes(pid));
    await tree.stop();assert.deepEqual(members(tree.child.pid),[]);assert.ok(members(untouched.child.pid).includes(untouched.child.pid));
    assert.strictEqual(tree.stop(),tree.stop());
    console.log('PASS supervision: real descendant ignores TERM; owned group terminated, unrelated group untouched');
    const announced=path.join(directory,'orphan-ready'),orphanChild='trap "" TERM; printf "%s\\n" "$$"; : > '+quote(announced)+'; while :; do sleep 1; done';
    const orphanScript='setsid /bin/sh -c '+quote(orphanChild)+' & while [ ! -f '+quote(announced)+' ]; do sleep 0.01; done; exit 0';
    const orphan=fixture(orphanScript);controls.push(orphan);const escapedPid=Number(await ready(orphan));assert.notEqual(escapedPid,orphan.child.pid);await orphan.exited;
    assert.deepEqual(members(orphan.child.pid),[]);assert.equal(fs.existsSync('/proc/'+escapedPid),false);await orphan.stop(true);
    console.log('PASS supervision: exited leader and setsid descendant are cleaned and reaped by the subreaper');
    const mark=path.join(directory,'graceful');
    const normalScript='trap '+quote('printf closed > '+quote(mark)+'; exit 0')+' TERM; printf "ready\\n"; while :; do sleep 1; done';
    const normal=fixture(normalScript);controls.push(normal);await ready(normal);await normal.stop();assert.equal(fs.readFileSync(mark,'utf8'),'closed');
    fs.unlinkSync(mark);
    const crashScript='trap '+quote('printf wrong > '+quote(mark))+' TERM; printf "ready\\n"; while :; do sleep 1; done';
    const crash=fixture(crashScript);controls.push(crash);await ready(crash);await crash.stop(true);assert.equal(fs.existsSync(mark),false);
    console.log('PASS supervision: normal shutdown and intentional hard crash remain distinct');
    const missing=ownedProcess(path.join(directory,'missing-executable'),[],{stdio:'ignore'});controls.push(missing);assert.equal((await missing.exited).error.code,'ENOENT');await missing.stop();
    console.log('PASS supervision: spawn error stays a failure and cleanup does not hang');
    const profile=path.join(directory,'profile');fs.mkdirSync(profile);fs.writeFileSync(path.join(profile,'IndexedDB-SENTINEL'),'SYNTHETIC-KEEP');
    const {state,runtime}=isolatedRuntime(profile);
    fs.writeFileSync(path.join(profile,'DevToolsActivePort'),'1\n/devtools/browser/dead\n');
    const first=await runtime.startBrowser({profileDir:profile});assert.match(first.endpoint,/fresh$/);assert.equal(state.fetches,1);
    await assert.rejects(runtime.startBrowser({profileDir:profile}),/profile is still owned/);await first.close();assert.equal(state.active,false);
    console.log('PASS supervision protocol: stale port removed, fresh CDP verified once, concurrent profile reuse refused');
    for(const mode of ['timeout','exit','http-error','wrong-process']){
      state.mode=mode;state.signals=[];const before=state.fetches;
      await assert.rejects(runtime.startBrowser({profileDir:profile,timeoutMs:30}),/timeout|exited before readiness|CDP connection failure|identity mismatch/);
      assert.equal(state.active,false);assert.ok(state.fetches-before<=1,'No HTTP or browser restart retry');
      state.mode='ready';const next=await runtime.startBrowser({profileDir:profile});await next.close();assert.equal(state.active,false);
    }
    assert.equal(fs.readFileSync(path.join(profile,'IndexedDB-SENTINEL'),'utf8'),'SYNTHETIC-KEEP');
    console.log('PASS supervision protocol: timeout/crash/HTTP/foreign endpoint fail, clean up and preserve profile bytes');
    state.mode='dom-pass';assert.equal(await runtime.dumpDom({profileDir:profile,args:[]}),'<pre>PASS</pre>');
    state.mode='dom-fail';assert.equal(await runtime.dumpDom({profileDir:profile,args:[]}),'<pre>FAIL real assertion</pre>');
    state.mode='dom-timeout';await assert.rejects(runtime.dumpDom({profileDir:profile,args:[],timeoutMs:30}),/deadline exceeded/);assert.equal(state.active,false);
    console.log('PASS supervision protocol: DOM output unchanged, domain FAIL not converted to PASS, deadline cleanup required');
    const failedProfile=path.join(directory,'failed-cleanup');fs.mkdirSync(failedProfile);
    const broken=isolatedRuntime(failedProfile);broken.state.omitReceipt=true;
    const incomplete=await broken.runtime.startBrowser({profileDir:failedProfile});
    await assert.rejects(incomplete.close(),/subreaper cleanup unconfirmed/);
    await assert.rejects(broken.runtime.startBrowser({profileDir:failedProfile}),/profile is still owned/);
    fs.rmSync(path.dirname(broken.state.receipt),{recursive:true,force:true}); // Synthetic failed-supervisor fixture only.
    console.log('PASS supervision protocol: missing cleanup receipt refuses success and profile reuse');
  }catch(error){primary=error;}
  finally{const settled=await Promise.allSettled(controls.map(control=>control.stop(true)));fs.rmSync(directory,{recursive:true,force:true});
    const failures=settled.filter(result=>result.status==='rejected').map(result=>result.reason);
    if(failures.length)throw new AggregateError(primary?[primary,...failures]:failures,'Supervision diagnostic/cleanup failed');
    if(primary)throw primary;
  }
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};
