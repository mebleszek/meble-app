// Recover only this owner's committed image/source or an empty interrupted
// initialization. Never delete/recreate a database or infer missing source proof.
import {assertApplicationRelease} from './application-release.mjs';
import {digest,equal,fail,id} from './local-first-values.mjs';
export async function recoverApplicationBinding({window:w,name,release,sourceHash}){
 const d=assertApplicationRelease(release,{name,window:w});w.__FC_MAIN_ACCESS__.assert();
 if(!(await w.indexedDB.databases()).some(db=>db.name===name))return null;
 const db=await new Promise((resolve,reject)=>{const q=w.indexedDB.open(name,1);q.onupgradeneeded=()=>q.transaction.abort();q.onblocked=q.onerror=()=>reject(Error('LF_MIGRATION_RECOVERY_UNCONFIRMED'));q.onsuccess=()=>resolve(q.result);});
 try{
  if(!equal([...db.objectStoreNames].sort(),['control','outbox','protected','replicas']))fail('LF_MIGRATION_RECOVERY_UNCONFIRMED');
  const state=await new Promise((resolve,reject)=>{const tx=db.transaction(['control','outbox','protected','replicas'],'readonly'),s=tx.objectStore('control'),q=s.get('binding');let value;
   tx.onabort=()=>reject(Error('LF_MIGRATION_RECOVERY_UNCONFIRMED'));tx.oncomplete=()=>resolve(value);
   q.onsuccess=()=>{const binding=q.result;if(binding?.ownerUid!==d.ownerUid||binding.version!==1){tx.abort();return;}
    const source=s.get('source'),app=s.get('application'),counts=['outbox','protected','replicas'].map(k=>tx.objectStore(k).count());
    app.onsuccess=()=>{value={binding,source:source.result,image:app.result,counts};};
   };
  });
  const {binding,source,image}=state;id(binding.deviceId);id(binding.instanceId);
  if(!!source!==!!image)fail('LF_MIGRATION_RECOVERY_UNCONFIRMED');
  if(source){if(source.activationId!==d.activationId||source.hash!==sourceHash||await digest(source.rows)!==source.hash||await digest(image.rows)!==image.hash)fail('LF_MIGRATION_RECOVERY_UNCONFIRMED');}
  else if(state.counts.some(q=>q.result!==0))fail('LF_MIGRATION_RECOVERY_UNCONFIRMED');
  return {binding:{version:1,name,ownerUid:d.ownerUid,deviceId:binding.deviceId,instanceId:binding.instanceId,sourceHash,activationId:d.activationId,initialize:false},image:source?image:null};
 }finally{db.close();}
}
