// Local access receipt. Existing data requires a separate, explicit admission.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{},KEY='meble_access_profile_v1',PENDING='meble_access_profile_pending_v1';
  const legacy=new Set(['hardwareCategories','hardwareSettings','hardwareSuppliers','hardwareTechnicalParams','hardwareTypes']);
  const businessKey=key=>String(key).startsWith('fc_')||legacy.has(String(key));
  const attemptPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const fail=code=>{const e=Error(code);e.code=code;throw e;};
  function create(local,session){
    const proto=Storage.prototype,get=proto.getItem,set=proto.setItem,remove=proto.removeItem,key=proto.key;
    const admissions=new WeakMap();
    const read=()=>get.call(local,KEY);
    function parse(raw,uid,pending=false){
      if(raw===null)return null;
      let value;try{value=JSON.parse(raw);}catch(_){fail('LOCAL_ACCESS_INVALID');}
      if(!value||typeof value.uid!=='string'||!value.uid)fail('LOCAL_ACCESS_INVALID');
      const fields=Object.keys(value).sort().join(',');
      const old=!pending&&value.version===1&&fields==='uid,version';
      if(!old&&(!(pending?value.version===1:value.version===2)||fields!=='attemptId,uid,version'
        ||typeof value.attemptId!=='string'||!attemptPattern.test(value.attemptId)))fail('LOCAL_ACCESS_INVALID');
      if(value.uid!==uid)fail('LOCAL_ACCESS_OTHER_ACCOUNT');return value;
    }
    function receipt(uid){
      const pending=parse(get.call(local,PENDING),uid,true),value=parse(read(),uid);
      // Version 1 cannot distinguish an acknowledged admission from the old
      // failed attempt. It is never silently upgraded or trusted on restart.
      return {trusted:!pending&&value?.version===2,unconfirmed:!!pending||value?.version===1};
    }
    function empty(){
      for(const store of [local,session])for(let i=0;i<store.length;i++)if(businessKey(key.call(store,i)))return false;
      return true;
    }
    // Ephemeral evidence only: never persists or exposes the business values.
    function evidence(){
      return JSON.stringify([local,session].map(store=>{
        const names=[];for(let i=0;i<store.length;i++){const name=key.call(store,i);if(businessKey(name))names.push(name);}
        return names.sort().map(name=>[name,get.call(store,name)]);
      }));
    }
    function bind(uid,verify){
      const attemptId=window.crypto?.randomUUID?.();
      if(typeof attemptId!=='string'||!attemptPattern.test(attemptId))fail('LOCAL_ACCESS_UNCONFIRMED');
      const previous=read(),pending=JSON.stringify({version:1,uid,attemptId}),active=JSON.stringify({version:2,uid,attemptId});
      try{
        // A durable veto precedes every candidate write. Failed attempts never
        // clear it; reload therefore requires fresh authorization AND consent.
        set.call(local,PENDING,pending);
        if(get.call(local,PENDING)!==pending||read()!==previous)fail('LOCAL_ACCESS_UNCONFIRMED');
        verify();
        set.call(local,KEY,active);
        if(read()!==active||get.call(local,PENDING)!==pending)fail('LOCAL_ACCESS_UNCONFIRMED');
        verify();
        // COMMIT POINT: native Storage.removeItem is synchronous and atomic on
        // failure. All reads/validation occur while the veto still exists. No
        // fallible work follows this acknowledged removal (no post-commit read
        // that could incorrectly turn a completed admission into a refusal).
        remove.call(local,PENDING);
      }catch(error){fail(error?.code==='LOCAL_ACCESS_DATA_CHANGED'?error.code:'LOCAL_ACCESS_UNCONFIRMED');}
    }
    return {
      confirm(uid){
        if(typeof uid!=='string'||!uid)fail('LOCAL_ACCESS_UNCONFIRMED');
        const state=receipt(uid);if(state.trusted)return;
        if(state.unconfirmed||!empty())fail('LOCAL_DATA_UNCLAIMED');
        bind(uid,()=>{if(!empty())fail('LOCAL_ACCESS_DATA_CHANGED');});
      },
      prepareAdmission(uid){
        if(typeof uid!=='string'||!uid)fail('LOCAL_ACCESS_UNCONFIRMED');
        const state=receipt(uid);if(state.trusted||(!state.unconfirmed&&empty()))fail('LOCAL_ACCESS_UNCONFIRMED');
        const ticket=Object.freeze({});admissions.set(ticket,{uid,evidence:evidence()});return ticket;
      },
      admitExisting(uid,ticket,{backupConfirmed,ownerConfirmed}={}){
        if(backupConfirmed!==true||ownerConfirmed!==true)fail('LOCAL_ACCESS_CONSENT_REQUIRED');
        const pending=ticket&&admissions.get(ticket);
        if(!pending||pending.uid!==uid)fail('LOCAL_ACCESS_UNCONFIRMED');
        admissions.delete(ticket); // Each full attempt needs fresh consent.
        const state=receipt(uid); // A corrupt receipt or another UID is never repaired.
        if(evidence()!==pending.evidence)fail('LOCAL_ACCESS_DATA_CHANGED');
        if(state.trusted)return;
        bind(uid,()=>{if(evidence()!==pending.evidence)fail('LOCAL_ACCESS_DATA_CHANGED');});
      },
      assert(uid){if(!receipt(uid).trusted)fail('LOCAL_ACCESS_UNCONFIRMED');},
      key:KEY,pendingKey:PENDING,isAccessKey:key=>key===KEY||key===PENDING,businessKey
    };
  }
  FC.localAccessProfile={create};
})();
