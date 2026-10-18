// Operator-only expression, evaluated in the lexical main-login owner. No globals,
// startup registration, storage access, login, or operation at definition time.
(function(withSession,sources){
 'use strict';
 let used=false,closed=false;
 const fail=code=>{throw Object.assign(Error(code),{code});};
 const safe=e=>({ok:false,code:/^(CLOUD_|AUTH_|LOCAL_|EXPORT_)[A-Z0-9_]+$/.test(e?.code||e?.message||'')?(e.code||e.message):'CLOUD_OPERATOR_UNCONFIRMED'});
 function builder(check){
  const worker=new Worker(new URL('tools/firebase-pilot/cloud4-source-worker.js',location.href));
  const pending=new Map();let serial=0,stopped=false;
  function stop(){stopped=true;worker.terminate();for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(Error('CLOUD_SOURCE_UNCONFIRMED'));}pending.clear();}
  worker.onerror=stop;
  worker.onmessage=event=>{
   const entry=pending.get(event.data?.id);if(!entry)return;
   pending.delete(event.data.id);clearTimeout(entry.timer);entry.resolve(event.data.result);
  };
  return {close:stop,async build(options){
   check();if(stopped)fail('CLOUD_SOURCE_UNCONFIRMED');
   const id=++serial;
   try{return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CLOUD_SOURCE_UNCONFIRMED'));stop();},20000);
    pending.set(id,{resolve,reject,timer});worker.postMessage({id,options});
   });}finally{check();}
  }};
 }
 return Object.freeze({
  async execute(request){
   if(closed)return {ok:false,code:'CLOUD_CLIENT_CLOSED'};
   if(used)return {ok:false,code:'CLOUD_OPERATION_LIMIT'};
   used=true; // Failure consumes this client; never retry a possibly committed write.
   let publicationStarted=false,controller,source;
   try{
    if(!request||Object.keys(request).sort().join(',')!=='approval,role'||!['write','read'].includes(request.role))fail('CLOUD_SCOPE_INVALID');
    return await withSession(async({authSession,lease,assertLocalAccess})=>{
     const check=()=>{assertLocalAccess();if(closed)fail('CLOUD_CLIENT_CLOSED');};
     check();
     // This delivery is emulator-only. A future LIVE operator must be separately
     // reviewed/authorized; there is no flag that enables production execution.
     const context=authSession.verificationContext();
     if(context.target!=='emulator'||!/^demo-[a-z0-9-]+$/.test(context.app.options.projectId)
       ||!['127.0.0.1','localhost'].includes(location.hostname))fail('CLOUD_LIVE_TRANSPORT_DISABLED');
     // Reuse only pure geometry/options dependencies, never the page's project,
     // repositories, exporter or Storage. Candidate factories stay in this realm.
     const realm={FC:{cabinetCutlist:{resolveDrawerFrontGeometry:window.FC.cabinetCutlist.resolveDrawerFrontGeometry},
       roomPreferences:{DRAWER_SYSTEM_OPTIONS:window.FC.roomPreferences.DRAWER_SYSTEM_OPTIONS}},crypto:window.crypto,TextEncoder,TextDecoder};
     for(const code of sources)new Function('window',code)(realm);
     source=builder(check);
     controller=await realm.FC.controlledProjectPilot.borrow({authSession,lease,assertLocalAccess:check,builder:source,approval:request.approval});
     check();
     if(closed)fail('CLOUD_CLIENT_CLOSED');
     if(request.role==='read'){
      const result=await controller.readVerify();check();
      if(!result.ok)return result;
      // No Auth, SDK, tokens, owner UID or generic remote handle escapes.
      return {ok:true,sourceMatches:result.sourceMatches,utf8Bytes:result.utf8Bytes,document:result.document,
       revisionId:result.head.currentRevisionId,documentSha256:result.document.integrity.documentSha256};
     }
     const prepared=await controller.prepare();check();
     if(!prepared.ok)return prepared;
     if(closed)fail('CLOUD_CLIENT_CLOSED');
     publicationStarted=true;
     const result=await controller.write();check();
     if(!result.ok)return {ok:false,code:result.code,published:result.published,
       requiresIndependentRead:result.requiresIndependentRead===true};
     return {ok:true,published:true,revisionId:result.head.currentRevisionId};
    });
   }catch(error){return {...safe(error),...(publicationStarted?{published:'unconfirmed',requiresIndependentRead:true}:{})};}
   finally{source?.close();await controller?.close();}
  },
  close(){closed=true;}
 });
})
