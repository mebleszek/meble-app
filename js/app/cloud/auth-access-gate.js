// Prepared boundary for a FUTURE business-script loader, not an activated main gate.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  function create(auth,{verifyAccess,watchAccess,onAuthorized=()=>{},onBlocked=()=>{},onState=()=>{}}={}){
    let generation=0,closed=false,state={status:'checking',uid:null},stopWatch=()=>{},expiry=null;
    function stop(){stopWatch();stopWatch=()=>{};clearTimeout(expiry);expiry=null;}
    function emit(value){state=Object.freeze(value);onState(state);}
    const unsubscribe=auth.subscribe(async value=>{
      const turn=++generation;
      stop();
      // Revoke a previous lease synchronously, before any async verification.
      onBlocked();
      if(value.status!=='authenticated'){emit({...value,uid:null});return;}
      const identity={uid:value.uid,epoch:value.epoch};
      function current(){
        if(closed||turn!==generation)return false;
        try{const now=auth.identity();return now.uid===identity.uid&&now.epoch===identity.epoch;}catch(_){return false;}
      }
      let granted=false,validUntil=Infinity;
      const valid=()=>current()&&granted&&Date.now()<validUntil;
      const lease=Object.freeze({uid:identity.uid,isValid:valid,assert(){if(!valid())throw Error('AUTH_ACCESS_REVOKED');}});
      function revoke(code,status='error'){
        if(!current())return;granted=false;generation++;stop();onBlocked();emit({status,uid:identity.uid,code});
      }
      function renew(result){
        if(result?.ok!==true||result.uid!==identity.uid)return false;
        validUntil=result.validUntil===undefined?Infinity:result.validUntil;
        if(!(validUntil===Infinity||(Number.isFinite(validUntil)&&validUntil>Date.now())))return false;
        clearTimeout(expiry);
        if(Number.isFinite(validUntil))expiry=setTimeout(()=>revoke('AUTH_ACCESS_EXPIRED'),Math.max(0,validUntil-Date.now()));
        return true;
      }
      emit({status:'authenticated',uid:identity.uid,code:'AUTH_ACCESS_PENDING'});
      if(typeof verifyAccess!=='function'){emit({status:'unapproved',uid:identity.uid,code:'AUTH_AUTHORIZATION_NOT_CONFIGURED'});return;}
      try{
        // A server-backed verifier is REQUIRED. Google login alone never opens UI.
        const result=await verifyAccess(identity);
        if(!current())return;
        if(!renew(result)){emit({status:'unapproved',uid:identity.uid,code:'AUTH_ACCESS_DENIED'});return;}
        granted=true;
        emit({status:'authorized',uid:identity.uid});
        if(typeof watchAccess==='function'){
          const unsubscribeWatch=watchAccess(identity,reply=>{
            if(!current())return;
            if(!renew(reply))revoke(reply?.denied?'AUTH_ACCESS_REVOKED':'AUTH_ACCESS_UNCONFIRMED',reply?.denied?'revoked':'error');
          });
          if(typeof unsubscribeWatch!=='function')throw Error('AUTH_ACCESS_UNCONFIRMED');
          if(current())stopWatch=unsubscribeWatch;else unsubscribeWatch();
        }
        if(!valid())return;
        await onAuthorized(lease);
      }catch(_){revoke('AUTH_ACCESS_UNCONFIRMED');}
    });
    return {state:()=>state,close(){closed=true;generation++;stop();unsubscribe();onBlocked();}};
  }
  FC.authAccessGate={create};
})();
