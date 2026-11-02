'use strict';
const {runtime,model}=require('../cloud-global-data-smoke');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const r=runtime();r.load('js/app/cloud/global-data-diagnostics.js');const c=r.FC.globalDataContract,m=model();
 for(const [domain,keys]of Object.entries(c.sources))for(const key of keys)r.rows.set(key,JSON.stringify(domain==='stock'?{sheets:m.stock}:m[domain]));
 const data=r.FC.globalDataDiagnostics;
 return {...r,c,m,data,clone,report:()=>clone(data.inspect(key=>r.storage.getItem(key))),row:(report,domain)=>report.domains.find(r=>r.domain===domain)};
}
async function existingImage(){
 const r=fixture(),{digest,json}=await import('../../sync/local-first-values.mjs');
 const name='meble-lf-test-global-diagnostics',ownerUid='private-owner',deviceId='private-device',instanceId='private-instance';
 const sourceRows=Object.fromEntries(r.rows),imageRows=clone(sourceRows);
 const receipt={version:1,name,ownerUid,deviceId,instanceId,sourceHash:await digest(sourceRows)};
 const control={binding:{key:'binding',ownerUid,deviceId,instanceId,version:1},source:{key:'source',version:1,activationId:'private-activation',hash:receipt.sourceHash,rows:sourceRows},application:{key:'application',version:1,rows:imageRows,hash:await digest(json(imageRows))}};
 const trace=[],connections=[],queue=[{scope:'globals',phase:'uncertain',json:'PRIVATE_OUTBOX_PRICE',hash:'private-hash'}];let valid=true,options={};
 r.rows.set('meble_application_authority_v1',JSON.stringify(receipt));
 const w={FC:r.FC,location:{hostname:'localhost'},indexedDB:{
  async databases(){trace.push('databases');if(options.namesError)throw Error('PRIVATE_EXCEPTION');return options.absent?[]:[{name,version:options.version||1}];},
  open(actual,version){
   trace.push('open');if(actual!==name||version!==1)throw Error('Wrong target');
   const request={};if(options.hang)return request;
   const db={objectStoreNames:options.badSchema?['control']:['control','outbox','protected','replicas'],closed:false,close(){this.closed=true;},
    transaction(stores,mode){
     trace.push('transaction:'+mode);if(mode!=='readonly'||stores.join(',')!=='control')throw Error('Forbidden diagnostic transaction');
     if(options.txError)throw Error('PRIVATE_EXCEPTION');let pending=0,finished=false;
     const tx={abort(){if(!finished){finished=true;queueMicrotask(()=>tx.onabort?.());}},objectStore(store){if(store!=='control')throw Error('Forbidden queue read');return {get(key){
      trace.push('get:'+key);const q={};pending++;
      queueMicrotask(()=>{if(finished)return;q.result=clone(control[key]??null);try{q.onsuccess?.();}catch(_){tx.abort();}pending--;
       if(!pending)queueMicrotask(()=>{if(!pending&&!finished){finished=true;options.beforeComplete?.(control,trace);tx.oncomplete?.();}});
      });return q;
     }};}};
     return tx;
    }};connections.push(db);
   queueMicrotask(()=>{request.result=db;if(options.upgrade){request.transaction={abort(){trace.push('upgrade-aborted');queueMicrotask(()=>request.onerror?.());}};request.onupgradeneeded?.();}else request.onsuccess?.();});return request;
  }
 }};
 Object.defineProperty(w,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>valid,assert(){if(!valid)throw Error('PRIVATE_AUTH');}}),writable:false,configurable:false});
 const args={window:w,ownerUid,name,readNative:key=>r.storage.getItem(key),authorize(){if(!valid)throw Error('PRIVATE_OWNER');}};
 return {...r,w,args,trace,control,queue,receipt,connections,options,deny(){valid=false;},async rehash(){control.application.hash=await digest(json(control.application.rows));}};
}
module.exports={fixture,existingImage,clone};
