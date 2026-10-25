'use strict';
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {waitForEndpoint}=require('./helpers/chromium-startup');

// Virtual time only for startup supervision, never for business/browser tests.
function fixture(){
  const child=new EventEmitter();Object.assign(child,{pid:123,exitCode:null,signalCode:null,stderr:new EventEmitter()});
  let now=0,id=0;const jobs=new Map();
  const timers={setTimeout(fn,ms){const n=++id;jobs.set(n,{fn,at:now+ms});return n;},clearTimeout(n){jobs.delete(n);},
    setInterval(fn,ms){const n=++id;jobs.set(n,{fn,at:now+ms,ms});return n;},clearInterval(n){jobs.delete(n);}};
  function advance(ms){const end=now+ms;while(true){const next=[...jobs.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;const [n,j]=next;now=j.at;if(j.ms)j.at+=j.ms;else jobs.delete(n);j.fn();}now=end;}
  const clean=()=>{assert.equal(jobs.size,0);assert.equal(child.listenerCount('error')+child.listenerCount('exit')+child.stderr.listenerCount('data'),0);};
  return {child,timers,advance,clean};
}
async function main(){
  const endpoint='ws://127.0.0.1:12345/devtools/browser/synthetic-123';
  let r=fixture(),p=waitForEndpoint(r.child,{timers:r.timers});
  r.advance(16000);r.child.stderr.emit('data','DevTools listening ');r.child.stderr.emit('data','on '+endpoint+'\n');assert.equal(await p,endpoint);r.clean();
  console.log('PASS readiness beyond the former 15s deadline, split stderr announcement and cleanup');
  r=fixture();let portFile='';p=waitForEndpoint(r.child,{profileDir:'/synthetic',timers:r.timers,readFile(){return portFile;}});
  portFile='12345\n/devtools/browser/';r.advance(100);portFile='12345\n/devtools/browser/synthetic-123\n';r.advance(100);assert.equal(await p,endpoint);r.clean();
  console.log('PASS real-protocol port file fallback tolerates partial writes without assuming readiness');
  for(const kind of ['spawn','exit','timeout','port-read']){
    r=fixture();p=waitForEndpoint(r.child,{profileDir:kind==='port-read'?'/synthetic':undefined,timers:r.timers,readFile(){throw Object.assign(Error('denied'),{code:'EACCES'});}});
    const expected=kind==='spawn'?/spawn error: ENOENT/:kind==='exit'?/exited before readiness: code=2/:kind==='timeout'?/startup timeout after 60000 ms[\s\S]*bounded diagnostic tail/:/port-file read error: denied/;
    const failed=assert.rejects(p,error=>{assert.match(error.message,expected);assert.ok(error.message.length<4500,'Diagnostic buffer must stay bounded');return true;});
    if(kind==='spawn')r.child.emit('error',Error('ENOENT'));
    if(kind==='exit')r.child.emit('exit',2,null);
    if(kind==='timeout'){r.child.stderr.emit('data','X'.repeat(10000)+'bounded diagnostic tail');r.advance(60000);}
    await failed;r.clean();
  }
  console.log('PASS spawn/crash/read/timeout failures stay FAIL, bounded stderr and no dangling timers/listeners');
  r=fixture();r.child.exitCode=0;await assert.rejects(waitForEndpoint(r.child,{timers:r.timers}),/exited before readiness/);r.clean();
  console.log('Chromium startup supervision: 4/4 groups PASS');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
