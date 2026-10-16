// Prepared boundary for a FUTURE business-script loader, not an activated main gate.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  function create(auth,{verifyAccess,onAuthorized=()=>{},onBlocked=()=>{},onState=()=>{}}={}){
    let generation=0,closed=false,state={status:'checking',uid:null};
    function emit(value){state=Object.freeze(value);onState(state);}
    const unsubscribe=auth.subscribe(async value=>{
      const turn=++generation;
      // Revoke a previous lease synchronously, before any async verification.
      onBlocked();
      if(value.status!=='authenticated'){emit({...value,uid:null});return;}
      const identity={uid:value.uid,epoch:value.epoch};
      function current(){
        if(closed||turn!==generation)return false;
        try{const now=auth.identity();return now.uid===identity.uid&&now.epoch===identity.epoch;}catch(_){return false;}
      }
      const lease=Object.freeze({uid:identity.uid,isValid:current,assert(){if(!current())throw Error('AUTH_ACCESS_REVOKED');}});
      emit({status:'authenticated',uid:identity.uid,code:'AUTH_ACCESS_PENDING'});
      if(typeof verifyAccess!=='function'){emit({status:'unapproved',uid:identity.uid,code:'AUTH_AUTHORIZATION_NOT_CONFIGURED'});return;}
      try{
        // A server-backed verifier is REQUIRED. Google login alone never opens UI.
        const result=await verifyAccess(identity);
        if(!current())return;
        if(result?.ok!==true||result.uid!==identity.uid){emit({status:'unapproved',uid:identity.uid,code:'AUTH_ACCESS_DENIED'});return;}
        emit({status:'authorized',uid:identity.uid});
        await onAuthorized(lease);
      }catch(_){if(current()){onBlocked();generation++;emit({status:'error',uid:null,code:'AUTH_ACCESS_UNCONFIRMED'});}}
    });
    return {state:()=>state,close(){closed=true;generation++;unsubscribe();onBlocked();}};
  }
  FC.authAccessGate={create};
})();
