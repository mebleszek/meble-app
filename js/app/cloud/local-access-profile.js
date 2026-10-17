// Local access receipt. Existing data requires a separate, explicit admission.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{},KEY='meble_access_profile_v1';
  const legacy=new Set(['hardwareCategories','hardwareSettings','hardwareSuppliers','hardwareTechnicalParams','hardwareTypes']);
  const businessKey=key=>String(key).startsWith('fc_')||legacy.has(String(key));
  const fail=code=>{const e=Error(code);e.code=code;throw e;};
  function create(local,session){
    const proto=Storage.prototype,get=proto.getItem,set=proto.setItem,key=proto.key;
    const admissions=new WeakMap();
    const read=()=>get.call(local,KEY);
    function receipt(uid){
      const raw=read();if(raw===null)return false;
      let value;try{value=JSON.parse(raw);}catch(_){fail('LOCAL_ACCESS_INVALID');}
      if(!value||Object.keys(value).sort().join(',')!=='uid,version'||value.version!==1||typeof value.uid!=='string'||!value.uid)fail('LOCAL_ACCESS_INVALID');
      if(value.uid!==uid)fail('LOCAL_ACCESS_OTHER_ACCOUNT');return true;
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
    return {
      confirm(uid){
        if(typeof uid!=='string'||!uid)fail('LOCAL_ACCESS_UNCONFIRMED');
        if(receipt(uid))return;
        if(!empty())fail('LOCAL_DATA_UNCLAIMED');
        // Synchronous, read-back confirmed. No business values are read or changed.
        const raw=JSON.stringify({version:1,uid});set.call(local,KEY,raw);
        if(read()!==raw||!empty())fail('LOCAL_ACCESS_UNCONFIRMED');
      },
      prepareAdmission(uid){
        if(typeof uid!=='string'||!uid||receipt(uid)||empty())fail('LOCAL_ACCESS_UNCONFIRMED');
        const ticket=Object.freeze({});admissions.set(ticket,{uid,evidence:evidence()});return ticket;
      },
      admitExisting(uid,ticket,{backupConfirmed,ownerConfirmed}={}){
        if(backupConfirmed!==true||ownerConfirmed!==true)fail('LOCAL_ACCESS_CONSENT_REQUIRED');
        const pending=ticket&&admissions.get(ticket);
        if(!pending||pending.uid!==uid)fail('LOCAL_ACCESS_UNCONFIRMED');
        const exists=receipt(uid); // A corrupt receipt or another UID is never repaired.
        if(evidence()!==pending.evidence)fail('LOCAL_ACCESS_DATA_CHANGED');
        if(!exists){
          const raw=JSON.stringify({version:1,uid});
          try{set.call(local,KEY,raw);if(read()!==raw)fail('LOCAL_ACCESS_UNCONFIRMED');}
          catch(_){fail('LOCAL_ACCESS_UNCONFIRMED');}
        }
        if(evidence()!==pending.evidence)fail('LOCAL_ACCESS_DATA_CHANGED');
        admissions.delete(ticket);
      },
      assert(uid){if(!receipt(uid))fail('LOCAL_ACCESS_UNCONFIRMED');},
      key:KEY,businessKey
    };
  }
  FC.localAccessProfile={create};
})();
