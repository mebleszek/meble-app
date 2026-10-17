// CLOUD-4 private handoff contract. Deliberately absent from startup/manifests.
// Loading this definition cannot initialize Firebase or start a pilot.
(function(){
 'use strict';
 const FC=window.FC=window.FC||{};
 const scope=Object.freeze({investorId:'cloud4-investor-v1',projectId:'cloud4-project-v1'});
 const payloadSha256='711f2fea49873bab0c4f76b5e8e0e666c4796190ed9fbfda71557d35890ba2e3';
 const rulesSha256='eaeb3e67417955bbd67d2881902d3827023502c2948ce0a19dc583c66b5a2e92';
 async function borrow({authSession,lease,assertLocalAccess,builder,approval,sdk}={}){
  const c=FC.cloudPilotContract;
  if(!c||!FC.projectCloudPilot||!FC.firebasePilotLiveTransport)throw Error('CLOUD_DEPENDENCY_UNAVAILABLE');
  const fail=code=>c.reject(code);
  if(typeof authSession?.identity!=='function'||typeof lease?.assert!=='function'||typeof lease?.isValid!=='function'
    ||typeof assertLocalAccess!=='function'||typeof builder?.build!=='function')fail('CLOUD_PRIVATE_SESSION_REQUIRED');
  const who=authSession.identity(),now=Date.now();
  const required=['version','ownerUid','investorId','projectId','payloadSha256','rulesSha256','expiresAt'];
  if(!approval||Object.keys(approval).length!==required.length||required.some(k=>!Object.hasOwn(approval,k))
    ||approval.version!==1||approval.ownerUid!==who.uid||approval.investorId!==scope.investorId||approval.projectId!==scope.projectId
    ||approval.payloadSha256!==payloadSha256||approval.rulesSha256!==rulesSha256
    ||!Number.isFinite(approval.expiresAt)||approval.expiresAt<=now||approval.expiresAt>now+900000)fail('CLOUD_APPROVAL_REQUIRED');
  // Detach approval from caller mutation. This operational fence is NOT a grant:
  // server Rules enforce the actual UID, appEnabled and separate pilot scope.
  const deadline=approval.expiresAt;
  let closed=false,prepared=false,written=false,confirmations=0,reads=0,handle;
  function check(){
   if(closed)fail('CLOUD_CLIENT_CLOSED');
   const access=lease.assert();if(access&&typeof access.then==='function')fail('CLOUD_ACCESS_UNCONFIRMED');
   if(lease.isValid()!==true||lease.uid!==who.uid)fail('CLOUD_ACCESS_UNCONFIRMED');
   const local=assertLocalAccess();if(local===false||(local&&typeof local.then==='function'))fail('CLOUD_ACCESS_UNCONFIRMED');
   const current=authSession.identity();
   if(current.uid!==who.uid||current.epoch!==who.epoch)fail('CLOUD_AUTH_CHANGED');
   if(Date.now()>=deadline)fail('CLOUD_APPROVAL_EXPIRED');
  }
  async function guarded(operation){check();try{return await operation();}finally{check();}}
  const isolated={async build(options){
   if(c.canonical(options)!==c.canonical({...scope,purpose:'pilot'}))fail('CLOUD_SCOPE_INVALID');
   const result=await guarded(()=>builder.build({...scope,purpose:'pilot'}));
   if(result?.ok!==true)fail(result?.code||'CLOUD_EXPORT_REFUSED');
   if(result.document?.integrity?.payloadSha256!==payloadSha256)fail('CLOUD_SOURCE_CHANGED');
   return result;
  }};
  const shared=await guarded(()=>FC.firebasePilotLiveTransport.create({authSession,assertAccess:check,sdk}));
  const pilot=FC.projectCloudPilot.create(shared.transport,{builder:isolated});
  const failure=e=>({ok:false,code:/^(CLOUD_|EXPORT_|AUTH_|LOCAL_)/.test(e?.code||e?.message||'')?(e.code||e.message):'CLOUD_REMOTE_UNCONFIRMED'});
  async function run(operation,publication=false){try{return await guarded(operation);}catch(e){return {...failure(e),...(publication&&written?{published:'unconfirmed',requiresIndependentRead:true}:{})};}}
  // No generic scope/handle/transport/Auth/token getters. One publication attempt,
  // at most one confirmation and two verified reads, even after failure.
  return Object.freeze({
   prepare(){return run(async()=>{
    if(prepared)fail('CLOUD_OPERATION_LIMIT');prepared=true;
    const result=await guarded(()=>pilot.prepare({...scope,expectedHead:null}));
    if(result.ok)handle=result.handle;
    const {handle:privateHandle,...safe}=result;return safe;
   });},
   write(){return run(async()=>{
    if(written)fail('CLOUD_OPERATION_LIMIT');if(!handle)fail('CLOUD_ATTEMPT_UNKNOWN');written=true;
    const result=await guarded(()=>pilot.publish(handle));
    return result.ok?result:{...result,requiresIndependentRead:result.published==='unconfirmed'};
   },true);},
   confirm(){return run(async()=>{
    if(confirmations++||!written)fail('CLOUD_OPERATION_LIMIT');
    return guarded(()=>pilot.confirm(handle));
   });},
   readVerify(){return run(async()=>{
    if(reads++>=2)fail('CLOUD_OPERATION_LIMIT');
    const expected=await isolated.build({...scope,purpose:'pilot'});
    const result=await guarded(()=>pilot.read(scope));
    if(!result.ok)return result;
    if(c.canonical(result.document)!==c.canonical(expected.document)
      ||new TextDecoder('utf-8',{fatal:true}).decode(result.bytes)!==c.canonical(expected.document))fail('CLOUD_SOURCE_CHANGED');
    return {...result,sourceMatches:true};
   });},
   async close(){closed=true;await pilot.close();}
  });
 }
 FC.controlledProjectPilot=Object.freeze({borrow,scope,payloadSha256,rulesSha256});
})();
