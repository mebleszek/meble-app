'use strict';
// Linux CI ownership only. No global pkill, application data or browser retry.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const {waitForEndpoint}=require('./chromium-startup');
const profiles=new Set(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function members(group){
  if(!Number.isSafeInteger(group)||group<=1)throw Error('Invalid owned process group');
  const rows=[];
  for(const pid of fs.readdirSync('/proc').filter(name=>/^\d+$/.test(name))){
    try{const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8'),fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');
      if(Number(fields[2])===group&&fields[0]!=='Z'&&fields[0]!=='X')rows.push(Number(pid));
    }catch(error){if(!['ENOENT','ESRCH'].includes(error.code))throw error;}
  }
  return rows;
}
function ownedProcess(executable,args,{subreaper=false,...options}={}){
  if(process.platform!=='linux')throw Error('Chromium CI supervision requires Linux process groups');
  const child=spawn(executable,args,{...options,detached:true});
  // Observe exit even when cleanup is called after the leader has already died.
  const exited=new Promise(resolve=>{child.once('exit',(code,signal)=>resolve({code,signal}));child.once('error',error=>resolve({error}));});
  let stopping;
  const stop=(crash=false)=>stopping||=(async()=>{
    if(!child.pid){await exited;return;}
    const signal=(name,group=!subreaper)=>{try{process.kill(group?-child.pid:child.pid,name);}catch(error){if(error.code!=='ESRCH')throw error;}};
    const wait=async ms=>{const deadline=Date.now()+ms;while(members(child.pid).length&&Date.now()<deadline)await pause(25);return members(child.pid).length===0;};
    if(members(child.pid).length)signal(crash?(subreaper?'SIGUSR2':'SIGKILL'):'SIGTERM');
    if(!await wait(crash&&!subreaper?1000:2000)){
      signal('SIGKILL',true);await wait(1000);
      throw Error('Chromium descendant cleanup unconfirmed: '+child.pid);
    }
    await exited;
  })();
  return {child,exited,stop};
}
function resources(){
  const read=file=>{try{return fs.readFileSync(file,'utf8').trim();}catch(_){return 'unavailable';}};
  const memory=read('/proc/meminfo').match(/MemAvailable:\s+\d+ kB/)?.[0]||'unavailable';
  const limits=read('/proc/self/limits').split('\n').filter(line=>/^Max (processes|open files)\s/.test(line));
  const result={load:read('/proc/loadavg').split(' ').slice(0,3).join(' '),memory,limits};
  for(const name of ['memory.current','memory.max','pids.current','pids.max'])result[name]=read('/sys/fs/cgroup/'+name);
  for(const dir of ['/tmp','/dev/shm'])try{const s=fs.statfsSync(dir);result[dir+' availableBytes']=s.bavail*s.bsize;}catch(_){result[dir]='unavailable';}
  return result;
}
function executable(){const file=process.env.CHROMIUM_PATH||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
  if(!file||!fs.existsSync(file))throw Error('Real Chromium/Chrome is required');return file;}
const xml=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function launch({profileDir,args,env={},capture=false}){
  fs.mkdirSync(profileDir,{recursive:true});const profile=fs.realpathSync(profileDir);
  if(profiles.has(profile))throw Error('Chromium profile is still owned by another launch');
  const binary=executable(),bus='/usr/bin/dbus-run-session';
  if(!fs.existsSync(bus)||!fs.existsSync('/usr/bin/python3'))throw Error('dbus-run-session and Python 3 are required for isolated headless CI');
  profiles.add(profile);let runtime,owned;
  try{
    // The discovery file is not business storage. Never remove SingletonLock,
    // IndexedDB, recovery markers or any other profile file to force a start.
    fs.rmSync(path.join(profile,'DevToolsActivePort'),{force:true});
    runtime=fs.mkdtempSync(path.join(os.tmpdir(),'meble-chromium-runtime-'));
    for(const name of ['cache','config'])fs.mkdirSync(path.join(runtime,name));
    // No service directories/activation: headless tests must not start desktop
    // portals or wait on the runner's inherited desktop session.
    fs.writeFileSync(path.join(runtime,'bus.conf'),'<busconfig><type>session</type><listen>unix:tmpdir='+xml(runtime)+'</listen><auth>EXTERNAL</auth><policy context="default"><allow send_destination="*"/><allow receive_sender="*"/><allow own="*"/></policy></busconfig>');
    const environment={...process.env,...env,XDG_CACHE_HOME:path.join(runtime,'cache'),XDG_CONFIG_HOME:path.join(runtime,'config')};
    for(const key of ['DBUS_SESSION_BUS_ADDRESS','DBUS_SYSTEM_BUS_ADDRESS','DBUS_STARTER_ADDRESS','DBUS_STARTER_BUS_TYPE'])delete environment[key];
    owned=ownedProcess('/usr/bin/python3',[path.join(__dirname,'chromium-process.py'),'--receipt='+path.join(runtime,'descendants-reaped'),bus,'--config-file='+path.join(runtime,'bus.conf'),'--',binary,
      '--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run',
      '--user-data-dir='+profile,...args],{subreaper:true,stdio:['ignore',capture?'pipe':'ignore','pipe'],env:environment});
  }catch(error){profiles.delete(profile);if(runtime)fs.rmSync(runtime,{recursive:true,force:true});throw error;}
  let tail='',closing;
  owned.child.stderr.setEncoding('utf8');owned.child.stderr.on('data',data=>{tail=(tail+data).slice(-4096);});
  const stop=crash=>closing||=(async()=>{await owned.stop(crash);
    if(!fs.existsSync(path.join(runtime,'descendants-reaped'))||fs.readFileSync(path.join(runtime,'descendants-reaped'),'ascii')!=='reaped\n')throw Error('Chromium subreaper cleanup unconfirmed');
    fs.rmSync(runtime,{recursive:true,force:true});profiles.delete(profile);
  })();
  return {...owned,close:()=>stop(false),crash:()=>stop(true),describe:()=>JSON.stringify({binary,pid:owned.child.pid,resources:resources(),stderr:tail})};
}
async function startBrowser({profileDir,timeoutMs=60000,env={}}){
  const browser=launch({profileDir,env,args:['--remote-debugging-port=0','about:blank']});
  try{
    const endpoint=await waitForEndpoint(browser.child,{profileDir,timeoutMs});
    const url=new URL(endpoint);
    if(!['127.0.0.1','localhost'].includes(url.hostname)||url.protocol!=='ws:')throw Error('Non-loopback DevTools endpoint');
    const response=await fetch('http://127.0.0.1:'+url.port+'/json/version',{redirect:'error',signal:AbortSignal.timeout(5000)});
    if(response.status!==200)throw Error('DevTools version endpoint unavailable');
    const version=await response.json(),actual=new URL(version.webSocketDebuggerUrl);
    if(actual.pathname!==url.pathname||actual.port!==url.port||!['127.0.0.1','localhost'].includes(actual.hostname)||actual.protocol!=='ws:')throw Error('DevTools process identity mismatch');
    return {...browser,endpoint};
  }catch(error){const details=browser.describe();await browser.crash();throw Error(error.message+'; '+details,{cause:error});}
}
async function dumpDom({profileDir,args,timeoutMs=30000,maxBuffer=8*1024*1024,env={}}){
  const browser=launch({profileDir,args,env,capture:true});let output='',failure;
  const fail=error=>{failure||=error;void browser.crash().catch(()=>{});};
  browser.child.stdout.setEncoding('utf8');browser.child.stdout.on('data',chunk=>{if(Buffer.byteLength(output)+Buffer.byteLength(chunk)>maxBuffer)fail(Error('Chromium DOM output exceeded maxBuffer'));else output+=chunk;});
  const drained=new Promise(resolve=>browser.child.stdout.once('end',resolve));
  const timer=setTimeout(()=>fail(Error('Chromium DOM deadline exceeded after '+timeoutMs+' ms')),timeoutMs);
  try{const result=await browser.exited;await browser.close();if(failure)throw failure;if(result.error)throw result.error;await drained;if(result.code!==0)throw Error('Chromium DOM exit '+result.code+' signal '+result.signal);return output;}
  catch(error){throw Error(error.message+'; '+browser.describe(),{cause:error});}
  finally{clearTimeout(timer);await browser.close();}
}
module.exports={ownedProcess,members,resources,startBrowser,dumpDom};
