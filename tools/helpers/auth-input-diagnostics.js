'use strict';
// Injected only by disposable browser tests. No UID, token, receipt or business
// value is exposed. Original API results/promises and event behavior are kept.
function installAuthInputDiagnostics(){
 const fc=window.FC=window.FC||{},events=[],owned=new Set(['auth-google','auth-signout','main-signout','auth-profile-confirm','auth-profile-cancel','main-trust-phone','closePriceModal']);
 let auth,session,lastLock=null,profilePhase='unopened',profileTurn=0;
 for(const type of ['pointerdown','pointerup','click'])window.addEventListener(type,event=>{
  const id=event.target.closest?.('button,input')?.id;
  events.push({type,trusted:event.isTrusted,id:owned.has(id)?id:'business',detail:event.detail});if(events.length>24)events.shift();
 },true);
 function factory(key,method,invoke){
  let api;const wrap=value=>{api={...value,[method](...args){return invoke(value[method],args);}};};
  const previous=fc[key];Object.defineProperty(fc,key,{configurable:true,get:()=>api,set:wrap});if(previous)wrap(previous);
 }
 factory('cloudAuth','create',(create,args)=>{const result=create(...args);result.then(value=>{auth=value;},()=>{});return result;});
 factory('localDeviceAccess','createSession',(create,args)=>{
  const options=args[0]||{};
  session=create({...options,onLock(code){lastLock=code;options.onLock?.(code);}});return session;
 });
 factory('localAccessProfile','create',(create,args)=>{
  const profile=create(...args);
  for(const method of ['confirm','resume','admitExisting']){
   const operation=profile[method];profile[method]=(...values)=>{
    const turn=++profileTurn;profilePhase=method+':pending';const result=operation(...values);
    result.then(()=>{if(turn===profileTurn)profilePhase=method+':confirmed';},()=>{if(turn===profileTurn)profilePhase=method+':refused';});return result;
   };
  }
  const revoke=profile.revoke;profile.revoke=()=>{profileTurn++;profilePhase='revoked';return revoke();};return profile;
 });
 window.__AUTH_INPUT_DIAGNOSTICS__=()=>({events:[...events],lastLock,mode:session?.mode(),profilePhase,
  authStatus:auth?.state().status,authEpoch:auth?.state().epoch,popups:window.popupCalls,
  reads:window.probeReads,transactions:window.probeTransactions});
}
module.exports={installAuthInputDiagnostics};
