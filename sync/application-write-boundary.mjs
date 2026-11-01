// Integrates existing action callbacks; no synthetic clicks or implicit Save.
import {fail} from './local-first-values.mjs';
export function installApplicationWriteBoundary({window:w,authority,ensureEditor,onExit=async()=>{}}){
 const fc=w.FC,pass=new Set(['session-save','session-cancel']);
 // Navigation writes its technical state, room-open also creates a durable draft.
 const globalActions=new Set(['price-item-save','price-item-delete','save-material','save-service']);
 const navigation=new Set(['tab','open-investor','open-room','open-investors','open-investors-list','back-investors',
  'price-item-exit','price-item-cancel','close-price-item','close-price','back-rooms','open-home','close-investors-list','new-investor','create-investor','open-furniture-hub']);
 let running=false;const completions=[];
 async function reserve(operation){
  if(running)fail('LF_APPLICATION_BUSY');running=true;let confirmed=false;
  try{const value=await operation();confirmed=value!==false&&value?.ok!==false;return value;}
  finally{running=false;const ready=completions.splice(0);if(confirmed)for(const fn of ready)fn();}
 }
 const run=(operation,kind='auto')=>reserve(async()=>{if(kind==='project')await ensureEditor();return authority.transaction(kind,operation);});
 const refused=error=>{fc.infoBox?.open({title:'Operacja wstrzymana',message:'Zachowano dane. '+(error.code||'LF_APPLICATION_UNCONFIRMED'),okOnly:true});return false;};
 const lifecycle={run,
  dispatch(action,operation){
   if(pass.has(action))return reserve(operation).catch(refused);
   // Non-writing modals/confirmations must remain usable while a navigation
   // promise awaits the owner's decision. Covered writes outside run refuse.
   if(globalActions.has(action))return run(operation,'globals').catch(refused);
   if(!navigation.has(action))return operation();
   return reserve(async()=>{
    const scope=w.localStorage.getItem('fc_current_project_id_v1');
    if(action==='open-room')await ensureEditor();
    const result=await authority.transaction('auto',operation);
    if(action==='back-investors'||action==='open-investors-list')await onExit(scope);
    return result;
   }).catch(refused);
  }};
 // Whole-store restore has no scoped cloud tombstone/CAS contract yet.
 // Refuse before touching any key, journal or archive; export stays available.
 for(const [api,names]of [[fc.dataBackupStore,['restoreBackup','importSnapshot']],[fc.dataBackupSnapshot,['applySnapshot']],[fc.dataBackupSnapshotApply,['applySnapshot']]])for(const name of names)if(api?.[name])api[name]=()=>fail('LF_ARCHIVE_RESTORE_PROTOCOL_REQUIRED');
 fc.applicationLifecycle=lifecycle;
 // Explicit application API for existing nondelegated form handlers.
 const handler=(fn,kind='globals')=>function(...args){return run(()=>fn.apply(this,args),kind).catch(()=>{fc.infoBox?.open({title:'Zapis niepotwierdzony',message:'Zachowano poprzednie dane i formularz. Nie potwierdzono trwałego zapisu.',okOnly:true});return false;});};
 fc.applicationWrite={handler,afterCommit:fn=>{if(running)completions.push(fn);else fn();},projectHandler:fn=>handler(fn,'project'),globals:fn=>run(fn,'globals'),project:fn=>run(fn,'project'),auto:fn=>run(fn,'auto'),checkpoint:fn=>run(fn,'checkpoint')};
 return {run,busy:()=>running,close(){if(fc.applicationLifecycle===lifecycle)delete fc.applicationLifecycle;delete fc.applicationWrite;}};
}
