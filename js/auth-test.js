// This dedicated entry point never loads boot.js/app.js or any business modules.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{},el=id=>document.getElementById(id);
  const google=el('auth-google'),account=el('auth-account'),uid=el('auth-uid'),toggle=el('auth-uid-toggle');
  let auth=null,gate=null,initializing=false,lastUid=null;
  function render(state){
    document.body.dataset.authState=state.status;
    const checking=state.status==='checking',signed=!!state.uid;
    google.disabled=checking;google.hidden=signed;account.hidden=!signed;
    if(state.uid!==lastUid||!signed){uid.hidden=true;uid.textContent='';toggle.setAttribute('aria-expanded','false');}lastUid=state.uid||null;
    const texts={checking:'Sprawdzanie sesji…',unauthenticated:'Zaloguj się, aby rozpocząć.',authenticated:'Zalogowano. Sprawdzanie uprawnień…',unapproved:'Zalogowano. Dostęp do aplikacji nie został jeszcze zatwierdzony.',authorized:'Dostęp potwierdzony w środowisku testowym.',error:'Logowanie lub weryfikacja nie zostały zakończone.'};
    el('auth-status').textContent=texts[state.status]||texts.error;
    const error=el('auth-error');error.hidden=state.status!=='error';error.textContent=state.status==='error'?(state.message||'Nie potwierdzono uprawnień. Dostęp pozostał zablokowany.')+' ('+(state.code||'AUTH_SESSION_UNCONFIRMED')+')':'';
  }
  async function initialize(){
    if(initializing)return;initializing=true;render({status:'checking'});
    try{
      if(!FC.cloudAuth||!FC.authAccessGate)throw Error('Auth unavailable');
      auth=await FC.cloudAuth.create(window.FC_AUTH_TEST_OPTIONS);
      // No server verifier/business loader in this stage: signed-in != approved.
      gate=FC.authAccessGate.create(auth,{onState:render});
    }catch(e){render(FC.cloudAuth?FC.cloudAuth.errorState(e):{status:'error',code:'AUTH_SESSION_UNCONFIRMED'});}
    finally{initializing=false;}
  }
  google.addEventListener('click',()=>{if(auth)auth.signInGoogle();else initialize();});
  el('auth-signout').addEventListener('click',()=>auth?.signOut());
  toggle.addEventListener('click',()=>{
    try{const current=auth.identity();uid.textContent=current.uid;uid.hidden=!uid.hidden;toggle.setAttribute('aria-expanded',String(!uid.hidden));}catch(_){uid.textContent='';uid.hidden=true;}
  });
  window.addEventListener('pagehide',()=>{gate?.close();});
  // bfcache restoration must re-observe identity; it must not retain stale access.
  window.addEventListener('pageshow',event=>{if(event.persisted&&auth){gate?.close();gate=FC.authAccessGate.create(auth,{onState:render});}});
  initialize();
})();
