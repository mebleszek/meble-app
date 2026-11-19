// Recover a lost Web Storage hint from the same verified DEMO authority.
// This grants no cloud permission and never creates a database or source.
import {P0B_REGISTRY} from './application-p0b-domain.mjs';
import {digest,equal,fail,id} from './local-first-values.mjs';
export async function recoverP0BDemoBinding({window:w,name,ownerUid,source}){
 if(!['127.0.0.1','localhost'].includes(w.location.hostname)||!/^meble-lf-test-/.test(name)||w.FC?.applicationRegistry?.id!==P0B_REGISTRY)fail('LF_EMULATOR_REQUIRED');
 w.__FC_MAIN_ACCESS__.assert();id(ownerUid);
 if(!(await w.indexedDB.databases()).some(db=>db.name===name))return null;
 const db=await new Promise((resolve,reject)=>{const q=w.indexedDB.open(name,1);q.onupgradeneeded=()=>q.transaction.abort();q.onerror=q.onblocked=()=>reject(Error('LF_P0B_BINDING_UNCONFIRMED'));q.onsuccess=()=>resolve(q.result);});
 try{
  if(!equal([...db.objectStoreNames].sort(),['control','outbox','protected','replicas']))fail('LF_P0B_BINDING_UNCONFIRMED');
  const state=await new Promise((resolve,reject)=>{
   const tx=db.transaction(['control','protected'],'readonly'),c=tx.objectStore('control'),binding=c.get('binding'),image=c.get('application'),marker=c.get('p0b-registry'),archive=tx.objectStore('protected').get('p0b-previous-registry');
   tx.onabort=()=>reject(Error('LF_P0B_BINDING_UNCONFIRMED'));tx.oncomplete=()=>resolve({binding:binding.result,image:image.result,marker:marker.result,archive:archive.result});
  });
  const {binding,image,marker,archive}=state;
  if(binding?.ownerUid!==ownerUid||binding.version!==1||marker?.registry!==P0B_REGISTRY||!image||!archive||archive.scope!=='p0b-archives'||await digest(archive.json)!==archive.hash||await digest(image.rows)!==image.hash)fail('LF_P0B_BINDING_UNCONFIRMED');
  id(binding.deviceId);id(binding.instanceId);
  const preserved=JSON.parse(archive.json);
  if(preserved.kind!=='p0b-previous-registry'||!['p0b-v1',P0B_REGISTRY].includes(preserved.registry)||!preserved.sourceRows||!equal(source,Object.fromEntries(Object.keys(source).map(key=>[key,preserved.sourceRows[key]??null]))))fail('LF_P0B_BINDING_UNCONFIRMED');
  return {binding:{version:1,name,ownerUid,deviceId:binding.deviceId,instanceId:binding.instanceId,sourceHash:await digest(source),initialize:false},image};
 }finally{db.close();}
}
