// Browser-only readiness probe for the isolated SDK fixture. No application writes.
// Additional fixture wait is earned only by completed data RPCs, never by an
// Auth renewal or a pending request. Preserve the original attempt budget;
// the progress allowance ends5 s after its last change and30 s after start.
export function replicationWaiting(state,now,signature){
 if(signature!==state.signature){state.signature=signature;state.lastProgressAt=now;}
 return now>=state.startedAt&&now-state.startedAt<30000&&now-state.lastProgressAt<5000;
}
export function startupReady({idleMs,stopOnAuthState=true}){
 const state=document.body.dataset;
 if(state.businessState==='ready')return true;
 if(stopOnAuthState&&['profile-pending','error'].includes(state.authState))return true;
 if(state.authState==='error')throw Error('NORMAL_STARTUP_REFUSED');
 const phase=window.FC.applicationStartup?.inspect()?.stage;
 const signature=JSON.stringify([phase,window.normalDataRpcProgress||0]);
 const now=performance.now(),previous=window.normalStartupWait;
 if(!previous||previous.signature!==signature)window.normalStartupWait={signature,since:now};
 else if(now-previous.since>=idleMs)throw Error('NORMAL_STARTUP_NO_PROGRESS');
 return false;
}
