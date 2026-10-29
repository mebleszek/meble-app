'use strict';
// Injected only by disposable browser tests. No UID, token, receipt or business
// value is exposed. Original API results/promises and event behavior are kept.
function installAuthInputDiagnostics(){
 const fc=window.FC=window.FC||{},events=[],owned=new Set(['auth-google','auth-signout','main-signout','auth-profile-confirm','auth-profile-cancel','main-trust-phone','closePriceModal']);
 let auth,session,lastLock=null,profilePhase='unopened',profileTurn=0,profileError=null,trustRestore='not-started',trustError=null,authCreations=0;
 for(const type of ['pointerdown','pointerup','click'])window.addEventListener(type,event=>{
  const id=event.target.closest?.('button,input')?.id;
  events.push({type,trusted:event.isTrusted,id:owned.has(id)?id:'business',detail:event.detail});if(events.length>24)events.shift();
 },true);
 function factory(key,methods){
  let api;const wrap=value=>{api={...value};for(const [method,invoke]of Object.entries(methods))api[method]=(...args)=>invoke(value[method],args);};
  const previous=fc[key];Object.defineProperty(fc,key,{configurable:true,get:()=>api,set:wrap});if(previous)wrap(previous);
 }
 factory('cloudAuth',{create:(create,args)=>{authCreations++;const result=create(...args);result.then(value=>{auth=value;},()=>{});return result;}});
 factory('localDeviceAccess',{createSession:(create,args)=>{
  const options=args[0]||{};
  session=create({...options,onLock(code){lastLock=code;options.onLock?.(code);}});return session;
 },createTrust:(create,args)=>{
  const trust=create(...args);return Object.freeze({...trust,restore(){
   trustRestore='pending';trustError=null;const result=trust.restore();
   result.then(value=>{trustRestore=value?'valid':'absent';},error=>{
    trustRestore='refused';const code=error?.code||error?.message;
    trustError=/^DEVICE_TRUST_[A-Z_]+$/.test(code)?code:'CRYPTO_OR_STORAGE_ERROR';
   });return result;
  }});
 }});
 factory('localAccessProfile',{create:(create,args)=>{
  const profile=create(...args);
  for(const method of ['confirm','resume','admitExisting']){
   const operation=profile[method];profile[method]=(...values)=>{
    const turn=++profileTurn;profilePhase=method+':pending';profileError=null;const result=operation(...values);
    result.then(()=>{if(turn===profileTurn)profilePhase=method+':confirmed';},error=>{if(turn===profileTurn){profilePhase=method+':refused';const code=error?.code||error?.message;profileError=/^LOCAL_(?:ACCESS|DATA)_[A-Z_]+$/.test(code)?code:'STORAGE_ERROR';}});return result;
   };
  }
  const revoke=profile.revoke;profile.revoke=()=>{profileTurn++;profilePhase='revoked';return revoke();};return profile;
 }});
 window.__AUTH_INPUT_DIAGNOSTICS__=()=>({events:[...events],lastLock,mode:session?.mode(),profilePhase,profileError,authCreations,
  authStatus:auth?.state().status,authEpoch:auth?.state().epoch,popups:window.popupCalls,
  reads:window.probeReads,transactions:window.probeTransactions,trustRestore,trustError,
  offline:{networkOffline:window.navigator?.onLine===false,controlled:!!window.navigator?.serviceWorker?.controller,
   workerExpected:!!window.navigator?.serviceWorker?.controller&&window.navigator.serviceWorker.controller.scriptURL===new URL('offline-worker.js',window.document.baseURI).href}});
}
module.exports={installAuthInputDiagnostics};
