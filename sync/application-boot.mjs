// Before business scripts: restore the authority image; never let legacy boot
// normalization rewrite a preserved source or silently choose conflicting RAW.
import {localResetState,RESET_KEY} from './application-local-reset.mjs';
import {recoverApplicationBinding} from './application-migration-recovery.mjs';
import {applicationKeys} from './application-authority.mjs';
import {openLocalFirstStore} from './local-first-idb.mjs';
import {INSTALL_KEY,exclusiveApplication,verifyExclusiveClient} from './application-installation.mjs';
import {assertApplicationRelease,prepareApplicationMigration} from './application-release.mjs';
import {applicationWriterFence} from './application-writer-fence.mjs';
import {digest,equal,fail} from './local-first-values.mjs';
export function prepareEmulatorApplicationBoot(options){return prepareApplicationBoot(options);}
export async function prepareApplicationBoot({window:w,name,ownerUid,release:deployment,localOnly=false,firstCatalogSync=false}){
 if(deployment)assertApplicationRelease(deployment,{ownerUid,name,window:w});
 else if(!['127.0.0.1','localhost'].includes(w.location.hostname)||!/^meble-lf-test-/.test(name))fail('LF_PRODUCTION_MIGRATION_NOT_APPROVED');
 const release=await exclusiveApplication(w);let store;
 try{
  const verifyFence=()=>deployment?applicationWriterFence(w):verifyExclusiveClient(w);
  if(deployment){await w.FC.offlineShell.prepare();await applicationWriterFence(w,{claim:true});}else await verifyFence();w.__FC_MAIN_ACCESS__.assert();
  const keys=applicationKeys(w.FC),managed=new Set(keys),proto=w.Storage.prototype,ls=w.localStorage;
  const original={get:proto.getItem,set:proto.setItem,remove:proto.removeItem};
  const readNative=key=>original.get.call(ls,key),source=Object.fromEntries(keys.map(k=>[k,readNative(k)]));
  const migration=deployment?await prepareApplicationMigration({release:deployment,window:w,name,source,readNative,verifyFence}):null;
  let reset=localOnly||firstCatalogSync?localResetState(w,ownerUid,name):null;
  if(firstCatalogSync&&reset&&reset.state!=='used')fail('LF_LOCAL_RESET_INTERRUPTED');
  const fresh=Object.values(source).every(v=>v===null),receipt=readNative(INSTALL_KEY);let rows=structuredClone(source),restored=!!receipt;
  if(reset?.state==='pending'&&!receipt)fail('LF_LOCAL_RESET_INTERRUPTED');
  if(!receipt&&deployment){const recovered=await recoverApplicationBinding({window:w,name,release:deployment,sourceHash:await digest(source)});if(recovered?.image){rows=structuredClone(recovered.image.rows);restored=true;}}
  if(receipt){
   let binding;try{binding=JSON.parse(receipt);}catch(_){fail(reset?.state==='pending'?'LF_LOCAL_RESET_INTERRUPTED':'LF_INSTALLATION_RECEIPT_INVALID');}
   if(reset?.state==='pending'&&(binding.deviceId!==reset.next.deviceId||binding.instanceId!==reset.next.instanceId||binding.sourceHash!==await digest(source)))fail('LF_LOCAL_RESET_INTERRUPTED');
   if(deployment&&binding.activationId!==assertApplicationRelease(deployment).activationId)fail('LF_ACTIVATION_RECEIPT_CHANGED');
   if(binding.ownerUid!==ownerUid||binding.name!==name||binding.sourceHash!==await digest(source))fail('LF_OLD_WRITER_OR_OWNER_CONFLICT');
   store=await openLocalFirstStore({...binding,initialize:false,indexedDB:w.indexedDB,locks:w.navigator.locks});
   const image=await store.readApplication();
   if(reset?.state==='pending'){
    // An application image can only exist after this reset's clear completed.
    // Reconcile a stale Web Storage journal from its independently verified
    // receipt/binding/source/image; never clear a newer local project again.
    const preserved=await store.readPreservedSource();if(!deployment||!image||!preserved||preserved.version!==1||preserved.activationId!==binding.activationId||preserved.hash!==binding.sourceHash||!equal(preserved.rows,source))fail('LF_LOCAL_RESET_INTERRUPTED');
    w.__FC_MAIN_ACCESS__.assert();reset={...reset,state:'used'};w.localStorage.setItem(RESET_KEY,JSON.stringify(reset));if(w.localStorage.getItem(RESET_KEY)!==JSON.stringify(reset))fail('LF_LOCAL_RESET_UNCONFIRMED');
   }
   if(!image&&!(reset?.state==='cleared'&&fresh&&binding.instanceId===reset.next.instanceId))fail('LF_APPLICATION_IMAGE_LOST');if(image)rows=structuredClone(image.rows);store.close();
  }
  if(localOnly&&fresh&&(!restored||reset?.state==='cleared')){
   const [{codeCandidate},{codeGlobalRows}]=await Promise.all([import('./code-global-catalogs.generated.mjs'),import('./global-code-rebuild-plan.mjs')]);
   rows={...rows,...codeGlobalRows(codeCandidate.model,w.FC.globalDataContract),fc_projects_v1:'[]',fc_investors_v1:'[]',fc_quote_snapshots_v1:'[]'};
  }
  if(localOnly&&rows.fc_edit_session_v1==null){let ui;try{ui=JSON.parse(rows.fc_ui_v1||'{}');}catch(_){ui={};}rows.fc_ui_v1=JSON.stringify({...ui,entry:rows.fc_current_investor_v1?'rooms':'home',activeTab:rows.fc_current_investor_v1?'inwestor':null,roomType:null,lastRoomType:null,selectedCabinetId:null});}
  const aliases=new Map(localOnly?Object.values(w.FC.globalDataContract.sources).flatMap(([primary,...rest])=>rest.map(k=>[k,primary])):[]);
  const readRow=key=>rows[key]??(aliases.has(key)?rows[aliases.get(key)]??null:null);
  // Native source stays read-only, including the first boot. New factory keys
  // are staged only when absent; existing values may not be normalized away.
  proto.getItem=function(key){return this===ls&&managed.has(String(key))?readRow(String(key)):original.get.call(this,key);};
  proto.setItem=function(key,value){
   key=String(key);value=String(value);
   if(this!==ls||!managed.has(key))return original.set.call(this,key,value);
   w.__FC_MAIN_ACCESS__.assert();
   if(aliases.has(key)&&rows[key]==null){let valueMatches=false;try{valueMatches=equal(JSON.parse(value),JSON.parse(rows[aliases.get(key)]));}catch(_){}if(!valueMatches)fail('LF_LEGACY_BOOT_WRITE_REFUSED');return;}
   const technical=['fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1'];
   if(rows[key]!==null&&rows[key]!==undefined&&rows[key]!==value&&!technical.includes(key))fail('LF_LEGACY_BOOT_WRITE_REFUSED');
   rows[key]=value;
  };
  proto.removeItem=function(key){if(this===ls&&managed.has(String(key)))fail('LF_LEGACY_BOOT_WRITE_REFUSED');return original.remove.call(this,key);};
  return {confirmLocalReset(){if(reset?.state==='cleared'){w.localStorage.setItem(RESET_KEY,JSON.stringify({...reset,state:'used'}));if(JSON.parse(w.localStorage.getItem(RESET_KEY))?.state!=='used')fail('LF_LOCAL_RESET_UNCONFIRMED');}},readNative,release,migration,fresh,verifyFence,restored,localOnly,rows:()=>structuredClone(rows)};
 }catch(error){store?.close();await release();throw error;}
}
