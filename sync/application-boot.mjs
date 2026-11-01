// Before business scripts: restore the authority image; never let legacy boot
// normalization rewrite a preserved source or silently choose conflicting RAW.
import {applicationKeys} from './application-authority.mjs';
import {openLocalFirstStore} from './local-first-idb.mjs';
import {INSTALL_KEY,exclusiveApplication,verifyExclusiveClient} from './application-installation.mjs';
import {digest,fail} from './local-first-values.mjs';
export async function prepareEmulatorApplicationBoot({window:w,name,ownerUid}){
 if(!['127.0.0.1','localhost'].includes(w.location.hostname)||!/^meble-lf-test-/.test(name))fail('LF_PRODUCTION_MIGRATION_NOT_APPROVED');
 const release=await exclusiveApplication(w);let store;
 try{
  await verifyExclusiveClient(w);w.__FC_MAIN_ACCESS__.assert();
  const keys=applicationKeys(w.FC),managed=new Set(keys),proto=w.Storage.prototype,ls=w.localStorage;
  const original={get:proto.getItem,set:proto.setItem,remove:proto.removeItem};
  const readNative=key=>original.get.call(ls,key),source=Object.fromEntries(keys.map(k=>[k,readNative(k)]));
  const receipt=readNative(INSTALL_KEY);let rows=structuredClone(source);
  if(receipt){
   let binding;try{binding=JSON.parse(receipt);}catch(_){fail('LF_INSTALLATION_RECEIPT_INVALID');}
   if(binding.ownerUid!==ownerUid||binding.name!==name||binding.sourceHash!==await digest(source))fail('LF_OLD_WRITER_OR_OWNER_CONFLICT');
   store=await openLocalFirstStore({...binding,initialize:false,indexedDB:w.indexedDB,locks:w.navigator.locks});
   const image=await store.readApplication();if(!image)fail('LF_APPLICATION_IMAGE_LOST');rows=structuredClone(image.rows);store.close();
  }
  // Native source stays read-only, including the first boot. New factory keys
  // are staged only when absent; existing values may not be normalized away.
  proto.getItem=function(key){return this===ls&&managed.has(String(key))?(rows[String(key)]??null):original.get.call(this,key);};
  proto.setItem=function(key,value){
   key=String(key);value=String(value);
   if(this!==ls||!managed.has(key))return original.set.call(this,key,value);
   w.__FC_MAIN_ACCESS__.assert();
   const technical=['fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1'];
   if(rows[key]!==null&&rows[key]!==undefined&&rows[key]!==value&&!technical.includes(key))fail('LF_LEGACY_BOOT_WRITE_REFUSED');
   rows[key]=value;
  };
  proto.removeItem=function(key){if(this===ls&&managed.has(String(key)))fail('LF_LEGACY_BOOT_WRITE_REFUSED');return original.remove.call(this,key);};
  return {readNative,release,restored:!!receipt,rows:()=>structuredClone(rows)};
 }catch(error){store?.close();await release();throw error;}
}
