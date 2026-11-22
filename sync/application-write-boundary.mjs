// Integrates existing action callbacks; no synthetic clicks or implicit Save.
import {fail,safeError} from './local-first-values.mjs';
export function installApplicationWriteBoundary({window:w,authority,ensureEditor,localOnly=false,registry,onExit=async()=>{},preflightAcceptance}){
 const fc=w.FC,pass=new Set(['session-save','session-cancel']);
 // Navigation writes its technical state, room-open also creates a durable draft.
 const globalActions=new Set(['price-item-save','price-item-delete','save-material','save-service']);
 const navigation=new Set(['tab','open-investor','open-room','open-investors','open-investors-list','back-investors',
  'price-item-exit','price-item-cancel','close-price-item','close-price','back-rooms','open-home','close-investors-list','new-investor','create-investor','open-furniture-hub']);
 let running=false,idle=Promise.resolve();const completions=[];
 async function reserve(operation){
  if(running)fail('LF_APPLICATION_BUSY');running=true;let confirmed=false,release;
  idle=new Promise(resolve=>{release=resolve;});
  try{const value=await operation();confirmed=value!==false&&value?.ok!==false;return value;}
  finally{running=false;release();const ready=completions.splice(0);if(confirmed)for(const fn of ready)fn();}
 }
 const run=(operation,kind='auto')=>reserve(async()=>{if(kind==='project'||kind==='offer-draft')await ensureEditor();return authority.transaction(kind,operation);});
 const refused=error=>{if(fc.projectRecovery&&['LF_EDITOR_BUSY_OR_HEAD_CHANGED','LF_EDITOR_RECOVERY_BLOCKED','LF_P0B_EDITOR_CONFLICT','LF_LOCAL_PROJECT_NOT_READY'].includes(error?.code)){void fc.projectRecovery.open({projectId:error.recoveryScope,roomId:error.recoveryRoomId||w.uiState?.roomType}).catch(cause=>fc.infoBox?.open({title:'Odzyskiwanie wstrzymane',message:cause?.code||'LF_PROJECT_RECOVERY_UNCONFIRMED',okOnly:true}));return false;}fc.infoBox?.open({title:'Operacja wstrzymana',message:'Zachowano dane. '+(error?.code || (/^(LF_|SESSION_|GLOBAL_|CLOUD_)[A-Z0-9_]+$/.test(error?.message) ? error.message : 'LF_APPLICATION_UNCONFIRMED')),okOnly:true});return false;};
 const lifecycle={run,
  dispatch(action,operation,context={}){
   if(pass.has(action))return reserve(operation).catch(refused);
   // Non-writing modals/confirmations must remain usable while a navigation
   // promise awaits the owner's decision. Covered writes outside run refuse.
   if(globalActions.has(action))return run(operation,'globals').catch(refused);
   if(!navigation.has(action))return operation();
   return reserve(async()=>{
    const scope=w.localStorage.getItem('fc_current_project_id_v1');
    if(action==='open-room'){const target=registry==='p0b-rooms-v1'?context.element?.getAttribute?.('data-room'):undefined;try{await ensureEditor(target,{reopen:true});}catch(error){error.recoveryScope=target;error.recoveryRoomId=context.element?.getAttribute?.('data-room');throw error;}}
    const exit=action==='back-investors'||action==='open-investors-list';
    const result=await authority.transaction('auto',operation,exit?{exitScope:scope}:undefined);
    if(exit)await onExit(scope);
    return result;
   }).catch(refused);
  }};
 // Whole-store restore has no scoped cloud tombstone/CAS contract yet.
 // Refuse before touching any key, journal or archive; export stays available.
 for(const [api,names]of [[fc.dataBackupStore,['restoreBackup','importSnapshot']],[fc.dataBackupSnapshot,['applySnapshot']],[fc.dataBackupSnapshotApply,['applySnapshot']]])for(const name of names)if(api?.[name])api[name]=()=>fail('LF_ARCHIVE_RESTORE_PROTOCOL_REQUIRED');
 const directOpen=registry==='p0b-rooms-v1'?fc.views?.openRoom:null;
 const guardedOpen=room=>running?directOpen(room):lifecycle.dispatch('open-room',()=>{if(fc.roomProjectModel?.enabled())fc.roomProjectStore.select(room);return directOpen(room);},{element:{getAttribute:()=>room}});
 if(directOpen)fc.views.openRoom=guardedOpen;
 fc.applicationLifecycle=lifecycle;
 // Explicit application API for existing nondelegated form handlers.
 const handler=(fn,kind='globals')=>function(...args){return run(()=>fn.apply(this,args),kind).catch(refused);};
 fc.applicationWrite={localOnly,registry,handler,whenIdle:()=>idle,roomCreateHandler:fn=>handler(fn,'auto'),
  quoteAcceptance:(scopes,fn)=>reserve(async()=>{
   if(registry!=='p0b-rooms-v1'||typeof preflightAcceptance!=='function')fail('LF_QUOTE_ACCEPTANCE_UNCONFIRMED');
   const ids=[...new Set(scopes)];await preflightAcceptance(ids);
   for(const scope of ids)await ensureEditor(scope);
   return authority.transaction('room-records',fn,{writeScopes:ids});
  }).catch(error=>{const result=safeError(error);fc.infoBox?.open({title:'Operacja wstrzymana',message:'Zachowano dane. '+result.code,okOnly:true});return result;}),
  quoteRemoval:(scopes,changed,fn)=>reserve(async()=>{
   if(registry!=='p0b-rooms-v1'||typeof preflightAcceptance!=='function')fail('LF_QUOTE_ACCEPTANCE_UNCONFIRMED');
   const ids=[...new Set(scopes)],writes=[...new Set(changed)];
   if(!ids.length||writes.some(scope=>!ids.includes(scope)))fail('LF_APPLICATION_SCOPE_REFUSED');
   await preflightAcceptance(ids);
   for(const scope of writes)await ensureEditor(scope);
   return authority.transaction('room-records',fn,{writeScopes:writes});
  }),
  roomRecords:(scopes,fn)=>reserve(async()=>{for(const scope of [...new Set(scopes)])await ensureEditor(scope);return authority.transaction('room-records',fn,{writeScopes:[...new Set(scopes)]});}).catch(refused),afterCommit:fn=>{if(running)completions.push(fn);else fn();},projectHandler:fn=>handler(fn,'project'),draftHandler:fn=>handler(fn,'cabinet-draft'),globals:fn=>run(fn,'globals'),project:fn=>run(fn,'project'),offerDraft:fn=>run(fn,'offer-draft'),auto:fn=>run(fn,'auto'),checkpoint:fn=>run(fn,'checkpoint')};
 return {run,busy:()=>running,close(){if(directOpen&&fc.views.openRoom===guardedOpen)fc.views.openRoom=directOpen;if(fc.applicationLifecycle===lifecycle)delete fc.applicationLifecycle;delete fc.applicationWrite;}};
}
