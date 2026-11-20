// Before business scripts: restore the authority image; never let legacy boot
// normalization rewrite a preserved source or silently choose conflicting RAW.
import {recoverP0BDemoBinding} from './application-p0b-binding.mjs';
import {emptyP0BBusiness,P0B_REGISTRY} from './application-p0b-domain.mjs';
import {localResetState,RESET_KEY} from './application-local-reset.mjs';
import {recoverApplicationBinding} from './application-migration-recovery.mjs';
import {applicationKeys} from './application-authority.mjs';
import {openLocalFirstStore} from './local-first-idb.mjs';
import {INSTALL_KEY,exclusiveApplication,verifyExclusiveClient} from './application-installation.mjs';
import {assertApplicationRelease,applicationP0BMode,prepareApplicationMigration} from './application-release.mjs';
import {applicationWriterFence} from './application-writer-fence.mjs';
import {digest,equal,fail} from './local-first-values.mjs';
export function prepareEmulatorApplicationBoot(options){return prepareApplicationBoot(options);}
export async function prepareApplicationBoot({window:w,name,ownerUid,release:deployment,localOnly=false,firstCatalogSync=false,p0bDemo=false}){
 if(deployment)assertApplicationRelease(deployment,{ownerUid,name,window:w});
 else if(!['127.0.0.1','localhost'].includes(w.location.hostname)||!/^meble-lf-test-/.test(name))fail('LF_PRODUCTION_MIGRATION_NOT_APPROVED');
 const p0bEnabled=applicationP0BMode({release:deployment,window:w,name,ownerUid,p0bDemo,localOnly});
 if(p0bEnabled)w.FC.applicationRegistry=Object.freeze({id:P0B_REGISTRY});
 const release=await exclusiveApplication(w);let store;
 try{
  const verifyFence=()=>deployment?applicationWriterFence(w):verifyExclusiveClient(w);
  if(deployment){await w.FC.offlineShell.prepare();await applicationWriterFence(w,{claim:true});}else await verifyFence();w.__FC_MAIN_ACCESS__.assert();
  const keys=applicationKeys(w.FC),managed=new Set(keys),proto=w.Storage.prototype,ls=w.localStorage;
  const original={get:proto.getItem,set:proto.setItem,remove:proto.removeItem,key:proto.key,length:Object.getOwnPropertyDescriptor(proto,'length')};
  const readNative=key=>original.get.call(ls,key),source=Object.fromEntries(keys.map(k=>[k,readNative(k)]));
  const hidden=new Set(),p0bSource={...source};
  if(p0bEnabled)for(let n=0;n<original.length.get.call(ls);n++){const key=original.key.call(ls,n);if(/^fc_project_inv_.+_v1$/.test(key||'')&&!managed.has(key)){hidden.add(key);p0bSource[key]=readNative(key);}}
  const migration=deployment?await prepareApplicationMigration({release:deployment,window:w,name,source,readNative,verifyFence}):null;
  let reset=localOnly||firstCatalogSync?localResetState(w,ownerUid,name):null;
  if(firstCatalogSync&&reset&&reset.state!=='used')fail('LF_LOCAL_RESET_INTERRUPTED');
  const fresh=Object.values(source).every(v=>v===null),receipt=readNative(INSTALL_KEY);let rows=structuredClone(source),restored=!!receipt;
  if(reset?.state==='pending'&&!receipt)fail('LF_LOCAL_RESET_INTERRUPTED');
  if(!receipt&&deployment){const recovered=await recoverApplicationBinding({window:w,name,release:deployment,sourceHash:await digest(source)});if(recovered?.image){if(p0bEnabled){store=await openLocalFirstStore({...recovered.binding,initialize:false,indexedDB:w.indexedDB,locks:w.navigator.locks});rows=structuredClone((await store.exclusive(()=>store.enterP0BRegistry(p0bSource))).rows);store.close();store=null;}else rows=structuredClone(recovered.image.rows);restored=true;}}
  if(!receipt&&p0bDemo&&!deployment){const recovered=await recoverP0BDemoBinding({window:w,name,ownerUid,source});if(recovered){rows=structuredClone(recovered.image.rows);restored=true;}}
  if(receipt){
   let binding;try{binding=JSON.parse(receipt);}catch(_){fail(reset?.state==='pending'?'LF_LOCAL_RESET_INTERRUPTED':'LF_INSTALLATION_RECEIPT_INVALID');}
   if(reset?.state==='pending'&&(binding.deviceId!==reset.next.deviceId||binding.instanceId!==reset.next.instanceId||binding.sourceHash!==await digest(source)))fail('LF_LOCAL_RESET_INTERRUPTED');
   if(deployment&&binding.activationId!==assertApplicationRelease(deployment).activationId)fail('LF_ACTIVATION_RECEIPT_CHANGED');
   if(binding.ownerUid!==ownerUid||binding.name!==name||binding.sourceHash!==await digest(source))fail('LF_OLD_WRITER_OR_OWNER_CONFLICT');
   store=await openLocalFirstStore({...binding,initialize:false,indexedDB:w.indexedDB,locks:w.navigator.locks});
   if(!p0bEnabled&&await store.p0bRegistry())fail('LF_P0B_REGISTRY_REQUIRED');
   let image=await store.readApplication();
   if(p0bEnabled)image=await store.exclusive(()=>store.enterP0BRegistry(p0bSource));
   if(reset?.state==='pending'){
    // An application image can only exist after this reset's clear completed.
    // Reconcile a stale Web Storage journal from its independently verified
    // receipt/binding/source/image; never clear a newer local project again.
    const preserved=await store.readPreservedSource();if(!deployment||!image||!preserved||preserved.version!==1||preserved.activationId!==binding.activationId||preserved.hash!==binding.sourceHash||!equal(preserved.rows,source))fail('LF_LOCAL_RESET_INTERRUPTED');
    w.__FC_MAIN_ACCESS__.assert();reset={...reset,state:'used'};w.localStorage.setItem(RESET_KEY,JSON.stringify(reset));if(w.localStorage.getItem(RESET_KEY)!==JSON.stringify(reset))fail('LF_LOCAL_RESET_UNCONFIRMED');
   }
   if(!image&&!(reset?.state==='cleared'&&fresh&&binding.instanceId===reset.next.instanceId))fail('LF_APPLICATION_IMAGE_LOST');if(image)rows=structuredClone(image.rows);store.close();
  }
  if(p0bEnabled&&!receipt&&!restored)rows=emptyP0BBusiness(rows);
  if(localOnly&&fresh&&(!restored||reset?.state==='cleared')){
   const [{codeCandidate},{codeGlobalRows}]=await Promise.all([import('./code-global-catalogs.generated.mjs'),import('./global-code-rebuild-plan.mjs')]);
   rows={...rows,...codeGlobalRows(codeCandidate.model,w.FC.globalDataContract),fc_projects_v1:'[]',fc_investors_v1:'[]',fc_quote_snapshots_v1:'[]'};
  }
  // A restored view is not permission to begin editing before the authority exists.
  // A durable draft keeps its existing recovery path in either runtime mode.
  if(rows.fc_edit_session_v1==null){let ui;try{ui=JSON.parse(rows.fc_ui_v1||'{}');}catch(_){ui={};}rows.fc_ui_v1=JSON.stringify({...ui,entry:rows.fc_current_investor_v1?'rooms':'home',activeTab:rows.fc_current_investor_v1?'inwestor':null,roomType:null,lastRoomType:null,selectedCabinetId:null});}
  const aliases=new Map(localOnly?Object.values(w.FC.globalDataContract.sources).flatMap(([primary,...rest])=>rest.map(k=>[k,primary])):[]);
  const readRow=key=>rows[key]??(aliases.has(key)?rows[aliases.get(key)]??null:null);
  // Native source stays read-only, including the first boot. New factory keys
  // are staged only when absent; existing values may not be normalized away.
  proto.getItem=function(key){return this===ls&&managed.has(String(key))?readRow(String(key)):this===ls&&hidden.has(String(key))?null:original.get.call(this,key);};
  proto.setItem=function(key,value){
   key=String(key);value=String(value);
   if(this===ls&&hidden.has(key))fail('LF_P0B_LEGACY_SCOPE_REFUSED');
   if(this!==ls||!managed.has(key))return original.set.call(this,key,value);
   w.__FC_MAIN_ACCESS__.assert();
   if(aliases.has(key)&&rows[key]==null){let valueMatches=false;try{valueMatches=equal(JSON.parse(value),JSON.parse(rows[aliases.get(key)]));}catch(_){}if(!valueMatches)fail('LF_LEGACY_BOOT_WRITE_REFUSED');return;}
   const technical=['fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1'];
   if(rows[key]!==null&&rows[key]!==undefined&&rows[key]!==value&&!technical.includes(key))fail('LF_LEGACY_BOOT_WRITE_REFUSED');
   rows[key]=value;
  };
  proto.removeItem=function(key){if(this===ls&&managed.has(String(key)))fail('LF_LEGACY_BOOT_WRITE_REFUSED');return original.remove.call(this,key);};
  if(p0bEnabled){
   const legacySlot=key=>key==='fc_project_v1'||/^fc_project_inv_.+_v1$/.test(key)||/^fc_(?:project|investors)_backup(?:_meta)?_v1$/.test(key);
   const visible=()=>{const names=[];for(let n=0;n<original.length.get.call(ls);n++){const key=original.key.call(ls,n);if(!legacySlot(key)&&!hidden.has(key)&&(!managed.has(key)||proto.getItem.call(ls,key)!==null))names.push(key);}for(const key of managed)if(!legacySlot(key)&&proto.getItem.call(ls,key)!==null&&!names.includes(key))names.push(key);return names;};
   proto.key=function(n){return this===ls?visible()[n]??null:original.key.call(this,n);};
   Object.defineProperty(proto,'length',{...original.length,get(){return this===ls?visible().length:original.length.get.call(this);}});
  }
  const backupKeys=()=>{const found=[];for(let n=0;n<original.length.get.call(ls);n++){const key=original.key.call(ls,n);if(key==='fc_data_backups_v1'||/^fc_(?:project|investors)_backup(?:_meta)?_v1$/.test(key)||/^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(key))found.push(key);}return found;};
  async function replaceRecoveryImage(expected,image){
   if(!w.__FC_MAIN_ACCESS__.isLoading?.()||!p0bEnabled||image.version<=expected.version||await digest(image.rows)!==image.hash)fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');
   await verifyFence();w.__FC_MAIN_ACCESS__.assert();
   for(const key of keys){if(readNative(key)!==source[key])fail('LF_OLD_WRITER_DETECTED');if(key!=='fc_ui_v1'&&(rows[key]??null)!==(expected.rows[key]??null))fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');}
   rows=structuredClone(image.rows);
  }
  return {backupKeys,replaceRecoveryImage,confirmLocalReset(){if(reset?.state==='cleared'){w.localStorage.setItem(RESET_KEY,JSON.stringify({...reset,state:'used'}));if(JSON.parse(w.localStorage.getItem(RESET_KEY))?.state!=='used')fail('LF_LOCAL_RESET_UNCONFIRMED');}},p0bDemo:p0bEnabled,p0bSource,readNative,release,migration,fresh,verifyFence,restored,localOnly,rows:()=>structuredClone(rows)};
 }catch(error){store?.close();await release();throw error;}
}
