import {safeError} from './local-first-values.mjs';
export function installManualSync({window:w,getSync,boundary,assertAccess}){
 const button=w.document.getElementById('main-sync');if(!button)return {close(){}};
 let active=true,pending=null;
 const state=value=>{if(!active)return;button.dataset.syncState=value;button.setAttribute('aria-busy',String(value==='busy'));button.disabled=value==='busy';};
 state('idle');button.disabled=!getSync();
 const reset=()=>{if(!pending){state('idle');button.disabled=!getSync();}};
 async function run(){
  if(pending)return pending;
  pending=(async()=>{
   state('busy');
   try{
    await boundary.whenIdle();assertAccess();
    const sync=getSync();if(!sync)throw Error('LF_SYNC_NOT_READY');
    const result=await sync.flush();assertAccess();if(!active)return;
    if(result.ok!==true)throw Object.assign(Error(result.code||'LF_SYNC_UNCONFIRMED'),result);
    state('success');
   }catch(error){if(!active)return;state('error');w.FC.infoBox?.open({title:'Synchronizacja wstrzymana',message:'Zachowano dane. '+safeError(error).code,okOnly:true});}
  })().finally(()=>{pending=null;});return pending;
 }
 button.addEventListener('click',run);
 w.addEventListener('offline',reset);w.addEventListener('meble-sync-unconfirmed',reset);
 return {reset,close(){active=false;button.removeEventListener('click',run);w.removeEventListener('offline',reset);w.removeEventListener('meble-sync-unconfirmed',reset);button.disabled=true;button.dataset.syncState='idle';}};
}
