'use strict';
const fs=require('node:fs'),path=require('node:path');

// One bounded startup attempt. CI cold starts may exceed 15s; process failures
// are never retried or treated as readiness. Port-file fallback is Chromium's
// own endpoint announcement, not a mock or an assumption that it has started.
function waitForEndpoint(child,{profileDir,timeoutMs=60000,pollMs=100,readFile=fs.readFileSync,timers=globalThis}={}){
  return new Promise((resolve,reject)=>{
    let output='',deadline,poll,settled=false;
    function finish(error,endpoint){
      if(settled)return;settled=true;
      timers.clearTimeout(deadline);timers.clearInterval(poll);
      child.removeListener('error',onError);child.removeListener('exit',onExit);child.stderr.removeListener('data',onData);
      error?reject(error):resolve(endpoint);
    }
    function failed(reason){
      finish(Error('Chromium '+reason+' (pid='+child.pid+', exitCode='+child.exitCode+', signal='+child.signalCode+'); stderr: '+(output||'(none)')));
    }
    function onError(error){failed('spawn error: '+error.message);}
    function onExit(code,signal){failed('exited before readiness: code='+code+', signal='+signal);}
    function onData(data){
      output=(output+data.toString()).slice(-4096);
      const match=output.match(/DevTools listening on (ws:\/\/(?:127\.0\.0\.1|localhost):\d+\/devtools\/browser\/[^\s]+)/);
      if(match)finish(null,match[1]);
    }
    function portFile(){
      if(!profileDir||settled)return;
      try{
        const [port,browserPath]=readFile(path.join(profileDir,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);
        if(/^\d+$/.test(port)&&Number(port)>0&&Number(port)<=65535&&/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(browserPath||''))finish(null,'ws://127.0.0.1:'+port+browserPath);
      }catch(error){if(error.code!=='ENOENT')failed('port-file read error: '+error.message);}
    }
    child.once('error',onError);child.once('exit',onExit);child.stderr.on('data',onData);
    deadline=timers.setTimeout(()=>failed('startup timeout after '+timeoutMs+' ms'),timeoutMs);
    poll=timers.setInterval(portFile,pollMs);
    if(child.exitCode!==null||child.signalCode!==null)onExit(child.exitCode,child.signalCode);
    else portFile();
  });
}
module.exports={waitForEndpoint};
