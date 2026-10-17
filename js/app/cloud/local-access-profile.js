// Access receipt for a NEW, empty browser profile. Never adopts existing data.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{},KEY='meble_access_profile_v1';
  const legacy=new Set(['hardwareCategories','hardwareSettings','hardwareSuppliers','hardwareTechnicalParams','hardwareTypes']);
  const businessKey=key=>String(key).startsWith('fc_')||legacy.has(String(key));
  const fail=code=>{const e=Error(code);e.code=code;throw e;};
  function create(local,session){
    const proto=Storage.prototype,get=proto.getItem,set=proto.setItem,key=proto.key;
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
    return {
      confirm(uid){
        if(typeof uid!=='string'||!uid)fail('LOCAL_ACCESS_UNCONFIRMED');
        if(receipt(uid))return;
        if(!empty())fail('LOCAL_DATA_UNCLAIMED');
        // Synchronous, read-back confirmed. No business values are read or changed.
        const raw=JSON.stringify({version:1,uid});set.call(local,KEY,raw);
        if(read()!==raw||!empty())fail('LOCAL_ACCESS_UNCONFIRMED');
      },
      assert(uid){if(!receipt(uid))fail('LOCAL_ACCESS_UNCONFIRMED');},
      key:KEY,businessKey
    };
  }
  FC.localAccessProfile={create};
})();
