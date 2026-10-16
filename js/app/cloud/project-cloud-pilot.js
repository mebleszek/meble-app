// CLOUD-2B coordinator. Local data stays authoritative; only CLOUD-1B can supply bytes.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const failure=(e,extra={})=>({ok:false,code:typeof e?.code==='string'&&/^(CLOUD_|EXPORT_)/.test(e.code)?e.code
    :e?.code==='permission-denied'?'CLOUD_PERMISSION_DENIED':e?.code==='unavailable'?'CLOUD_NETWORK_UNCONFIRMED':'CLOUD_REMOTE_UNCONFIRMED',...extra});
  function create(transport){
    const c=FC.cloudPilotContract,builder=FC.projectSelectiveExport;
    if(!c||!builder||!transport)throw Error('CLOUD_DEPENDENCY_UNAVAILABLE');
    const attempts=new WeakMap();let closed=false;
    function check(attempt){
      if(closed)c.reject('CLOUD_CLIENT_CLOSED');
      const current=transport.identity();
      if(current.uid!==attempt.scope.ownerUid||current.epoch!==attempt.epoch)c.reject('CLOUD_AUTH_CHANGED');
    }
    async function source(attempt){
      check(attempt);
      const result=await builder.build({investorId:attempt.scope.investorId,projectId:attempt.scope.projectId,purpose:'pilot'});
      if(!result||result.ok!==true)c.reject(result?.code||'CLOUD_EXPORT_REFUSED');
      check(attempt);
      if(result.document.integrity.payloadSha256!==attempt.packed.revision.payloadSha256)c.reject('CLOUD_SOURCE_CHANGED');
    }
    function lookup(handle){const attempt=attempts.get(handle);if(!attempt)c.reject('CLOUD_ATTEMPT_UNKNOWN');check(attempt);return attempt;}
    async function readHead({investorId,projectId}){
      try{await transport.ready();const user=transport.identity(),scope={ownerUid:user.uid,investorId,projectId};
        if(!c.id(investorId)||!c.id(projectId))c.reject('CLOUD_SCOPE_INVALID');
        return {ok:true,head:await transport.readHead(scope)};
      }catch(e){return failure(e);}
    }
    async function prepare({investorId,projectId,expectedHead}){
      try{
        if(closed)c.reject('CLOUD_CLIENT_CLOSED');await transport.ready();const user=transport.identity(),scope={ownerUid:user.uid,investorId,projectId};
        if(!c.id(investorId)||!c.id(projectId)||expectedHead===undefined)c.reject('CLOUD_SCOPE_INVALID');c.validHead(expectedHead,scope);
        const result=await builder.build({investorId,projectId,purpose:'pilot'});
        if(!result||result.ok!==true)c.reject(result?.code||'CLOUD_EXPORT_REFUSED');
        const packed=await c.pack(result,scope,expectedHead,window.crypto.randomUUID().replace(/-/g,''));
        const attempt={scope,epoch:user.epoch,packed,state:'prepared',staged:false};check(attempt);
        const current=await transport.readHead(scope);check(attempt);
        if(!c.equal(current,expectedHead))c.reject('CLOUD_WRITE_CONFLICT');
        await source(attempt);
        if(current?.payloadSha256===packed.revision.payloadSha256)return {ok:true,unchanged:true,head:current};
        const handle=Object.freeze({revisionId:packed.revision.revisionId});attempts.set(handle,attempt);
        return {ok:true,handle,revisionId:handle.revisionId,byteLength:packed.revision.byteLength,chunkCount:packed.revision.chunkCount};
      }catch(e){return failure(e);}
    }
    async function confirm(handle){
      try{
        const attempt=lookup(handle),head=await transport.readHead(attempt.scope);check(attempt);
        if(c.equal(head,c.candidateHead(attempt.packed))){attempt.state='published';return {ok:true,published:true,head};}
        if(c.equal(head,attempt.packed.base)){attempt.state='retry_allowed';return {ok:false,code:'CLOUD_PUBLICATION_NOT_OBSERVED',published:'unconfirmed'};}
        attempt.state='conflict';return {ok:false,code:'CLOUD_WRITE_CONFLICT',published:'unconfirmed'};
      }catch(e){return failure(e,{published:'unconfirmed'});}
    }
    async function publish(handle){
      let attempt,phase='validation';
      try{
        attempt=lookup(handle);
        if(attempt.state==='publication_unconfirmed')c.reject('CLOUD_CONFIRMATION_REQUIRED');
        if(attempt.state==='conflict')c.reject('CLOUD_WRITE_CONFLICT');
        await source(attempt);phase='staging';await transport.stage(attempt.packed);attempt.staged=true;attempt.state='staged';
        await source(attempt);phase='publication';
        await transport.publish(attempt.packed,()=>source(attempt));
        phase='confirmation';attempt.state='publication_unconfirmed';return await confirm(handle);
      }catch(e){
        const uncertain=phase==='publication'||phase==='confirmation';
        if(attempt&&uncertain)attempt.state=e?.code==='CLOUD_WRITE_CONFLICT'?'conflict':'publication_unconfirmed';
        const unconfirmed=attempt?.state==='publication_unconfirmed'||(phase==='validation'&&attempt?.state==='conflict')||(uncertain&&e?.code!=='CLOUD_WRITE_CONFLICT');
        return failure(e,{phase,published:attempt?.state==='published'?true:unconfirmed?'unconfirmed':false,staging:attempt?.staged?'confirmed':phase==='staging'?'unconfirmed':'not_confirmed'});
      }
    }
    return {readHead,prepare,publish,confirm,async close(){closed=true;await transport.close();}};
  }
  FC.projectCloudPilot={create};
})();
