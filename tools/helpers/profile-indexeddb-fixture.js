'use strict';
// Unit-only transactional model. Native cross-tab atomicity is tested in Chromium.
module.exports=function indexedDBFixture(){
 const rows=new Map(),queue=[];let running=false;
 const factory={rows,fail:null,afterPut:null,open(){
  const request={};setImmediate(()=>{
   if(factory.fail==='open'){request.onerror?.();return;}
   request.result={objectStoreNames:{contains:()=>true},close(){},transaction(_store,mode){
    if(factory.fail==='transaction')throw Error('synthetic transaction failure');
    const tx={oncomplete:null,onabort:null,onerror:null,aborted:false,jobs:[],pending:0,active:false,copy:null,
     abort(){if(tx.aborted||tx.finished)throw Error('TransactionInactiveError');tx.aborted=true;if(tx.active)setImmediate(finishAbort);},
     objectStore(){return {get(key){return job('get',key);},put(value,key){return job('put',key,value);}}}};
    let gets=0;
    function job(kind,key,value){const r={};tx.pending++;tx.jobs.push(()=>{
     if(tx.aborted)return;
     const phase=kind==='put'?'put':++gets>1?'readback':'get';
     if(factory.fail===phase){r.onerror?.();if(!tx.aborted)tx.abort();return;}
     if(kind==='put'){tx.copy.set(key,structuredClone(value));factory.afterPut?.(value,tx);r.result=key;}
     else r.result=structuredClone(tx.copy.get(key));
     r.onsuccess?.();tx.pending--;pump();
    });if(tx.active)pump();return r;}
    let scheduled=false;
    function pump(){if(scheduled||tx.aborted||tx.finished)return;scheduled=true;setImmediate(()=>{
     scheduled=false;if(tx.aborted||tx.finished)return;
     const next=tx.jobs.shift();if(next){next();return;}
     if(tx.pending===0){if(factory.fail==='commit'){tx.abort();return;}
      if(mode==='readwrite'){rows.clear();for(const [k,v]of tx.copy)rows.set(k,v);}
      tx.finished=true;tx.oncomplete?.();running=false;start();
     }
    });}
    function finishAbort(){if(tx.finished)return;tx.finished=true;tx.onabort?.();running=false;start();}
    tx.start=()=>{tx.active=true;tx.copy=new Map([...rows].map(([k,v])=>[k,structuredClone(v)]));if(tx.aborted)finishAbort();else pump();};
    queue.push(tx);start();return tx;
   }};request.onsuccess?.();
  });return request;
 }};
 function start(){if(running||!queue.length)return;running=true;setImmediate(()=>queue.shift().start());}
 return factory;
};
