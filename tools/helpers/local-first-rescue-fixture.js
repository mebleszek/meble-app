'use strict';
const {fixture}=require('./global-diagnostics-fixture'),{MessageChannel}=require('node:worker_threads');
const clone=value=>structuredClone(value);
async function rescueFixture(){
 const r=fixture(),{digest,json}=await import('../../sync/local-first-values.mjs'),{applicationKeys}=await import('../../sync/application-authority.mjs');
 const name='meble-lf-test-private-rescue',ownerUid='synthetic-owner',deviceId='synthetic-device',instanceId='synthetic-installation';
 for(const [key,value]of Object.entries({fc_projects_v1:'[{"id":"P","price":12.125}]',fc_investors_v1:'[{"id":"I"}]',fc_data_backups_v1:' [] ',fc_quote_offer_drafts_v1:'PRIVATE_DRAFT',fc_hardware_replacement_rules_v1:'PRIVATE_REPLACEMENT',fc_lone_surrogate_v1:'A\ud800B'}))r.rows.set(key,value);
 const source=Object.fromEntries(applicationKeys(r.FC).map(k=>[k,r.rows.get(k)??null])),receipt={version:1,name,ownerUid,deviceId,instanceId,sourceHash:await digest(source)};
 r.rows.set('meble_application_authority_v1',JSON.stringify(receipt));r.rows.set('firebase:authUser:synthetic','AUTH_TOKEN_MUST_NOT_ENTER_BACKUP');
 const encoded=json(r.m),protection=json(source),expected={generation:1,revisionId:'synthetic-revision'};
 const tables={control:[{key:'binding',version:1,ownerUid,deviceId,instanceId},{key:'source',version:1,activationId:'synthetic-activation',rows:clone(source),hash:receipt.sourceHash},{key:'application',version:1,rows:clone(source),hash:await digest(json(source))}],
  replicas:[{key:'globals',version:1,json:encoded,hash:await digest(encoded),base:null,dirty:true}],
  protected:[{key:'synthetic-operation',scope:'globals',json:protection,hash:await digest(protection)}],
  outbox:[{key:'synthetic-operation',scope:'globals',json:encoded,hash:await digest(encoded),phase:'uncertain',expected,receipt:null}]};
 const session=new Map([['fc_reload_restore_v1','PRIVATE_SESSION']]),trace=[],downloads=[],options={},connections=[];let valid=true,ram={available:true,scope:'CURRENT_DOCUMENT_KNOWN_BUSINESS_RAM',data:{project:{unsaved:'PRIVATE_UNSAVED_RAM'},ui:{},session:{active:true}}};
 const storage=(map,virtual=false)=>({get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:key=>virtual?'VIRTUAL_VALUE_MUST_NOT_BE_BACKED_UP':map.get(key)??null,setItem(){throw Error('Forbidden WRITE');},removeItem(){throw Error('Forbidden remove');},clear(){throw Error('Forbidden clear');}});
 const w=r.s;Object.assign(w,{JSON,MessageChannel,btoa,atob,location:{hostname:'localhost'},navigator:{serviceWorker:{controller:{postMessage(m,ports){trace.push('exclusive');ports[0].postMessage({protocol:1,nonce:m.nonce,exclusive:!options.otherClient});ports[0].close();}}},locks:{}},localStorage:storage(r.rows,true),sessionStorage:storage(session),crypto:require('node:crypto').webcrypto,Blob,File,URL:{},setTimeout:(fn,ms)=>ms===60000?(queueMicrotask(fn),0):setTimeout(fn,ms),clearTimeout});
 const blobs=new Map();let sequence=0;w.URL.createObjectURL=blob=>{const url='blob:synthetic-'+(++sequence);blobs.set(url,blob);return url;};w.URL.revokeObjectURL=url=>blobs.delete(url);
 w.document={createElement(){return {click(){if(options.downloadFailure)throw Error('Synthetic disk full');downloads.push(blobs.get(this.href));}};}};
 class Input{constructor(file){this._files=[file];this.type='file';this.isConnected=true;}get files(){return this._files;}}
 class SelectionEvent{constructor(target,trusted=true){this.target=target;this.type='change';this.isTrusted=trusted;}}
 w.HTMLInputElement=Input;w.Event=SelectionEvent;
 Object.defineProperty(w,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>valid,assert(){if(!valid)throw Error('Private Auth error');}}),writable:false,configurable:false});
 w.indexedDB={databases:async()=>options.inventory||[{name,version:1},...(options.archive?[{name:'meble-business-backups-v1',version:1}]:[])],open(actual,version){
  trace.push('open:'+actual);const selected=actual===name?tables:actual==='meble-business-backups-v1'?options.archive:null;if(!selected||version!==1)throw Error('Wrong target');const request={};
  const db={objectStoreNames:options.badSchema?['control']:Object.keys(selected),close(){this.closed=true;},transaction(names,mode){
   trace.push('tx:'+mode);if(mode!=='readonly')throw Error('Forbidden WRITE');let pending=0,done=false;
   const tx={abort(){if(!done){done=true;queueMicrotask(()=>tx.onabort?.());}},objectStore(store){
    const read=(kind,key)=>{trace.push(kind+':'+store);pending++;const q={};queueMicrotask(()=>{if(done)return;
     q.result=clone(kind==='get'?selected[store].find(r=>r.key===key):selected[store]);q.onsuccess?.();pending--;
     if(!pending)queueMicrotask(()=>{if(!pending&&!done){done=true;options.onComplete?.(tables);tx.oncomplete?.();}});
    });return q;};return {get:key=>read('get',key),getAll:()=>read('all')};
   }};return tx;
  }};connections.push(db);queueMicrotask(()=>{request.result=db;if(options.upgrade){request.transaction={abort(){trace.push('upgrade-abort');request.onerror?.();}};request.onupgradeneeded?.();}else request.onsuccess?.();});return request;
 }};
 for(const file of ['js/app/shared/backup-archive-format.js','js/app/shared/storage-recovery-export.js'])r.load(file);
 const context={window:w,name,ownerUid,readNative:key=>{if(options.readError===key)throw Error('PRIVATE_READ_ERROR');return r.rows.get(key)??null;},authorize(){if(!valid)throw Error('PRIVATE_OWNER');},assertQuiescent(){if(options.busy)throw Error('PRIVATE_BUSY');},readRam(){return clone(ram);}};
 return {...r,w,context,tables,session,receipt,trace,downloads,options,connections,deny(){valid=false;},setRam(value){ram=value;},
  async file(text){const blob=text===undefined?downloads.at(-1):new Blob([text]);return new File([await blob.arrayBuffer()],'meble-app-local-first-rescue.encrypted.json');},
  selection(file,trusted=true){const input=new Input(file);return {input,event:new SelectionEvent(input,trusted)};}};
}
module.exports={rescueFixture};
