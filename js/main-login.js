// Main entry: one Auth instance, one authorization gate, one business startup.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{},el=id=>document.getElementById(id),shell=el('main-login');
  let profile;
  try{profile=FC.localAccessProfile.create(localStorage,sessionStorage,{authorize(uid){
    localSession.assert(uid);return localSession.identity().epoch;
  }});}
  catch(_){el('auth-status').textContent='Pamięć przeglądarki jest niedostępna. Nie uruchomiono aplikacji.';el('auth-error').hidden=false;el('auth-error').textContent='LOCAL_ACCESS_UNCONFIRMED';document.body.dataset.authState='error';return;}
  let auth=null,access=null,gate=null,lease=null,blocked=true,started=false,starting=false,fatal=false,loader=null;
  let displayed={status:'checking'},initializing=false,admission=null;
  let interaction=null;
  const trust=FC.localDeviceAccess.createTrust();
  const localSession=FC.localDeviceAccess.createSession({onLock(code){
    gate?.close();gate=null;interaction=null;block();render({status:'unauthenticated',code});
  }});
  const businessNodes=new Set(),styles=[];
  function trustControls(){
    el('main-trust-phone').checked=localSession.mode()==='trusted';
    el('main-trust-phone').disabled=localSession.mode()!=='trusted'&&!lease?.isValid();
  }
  async function logout(){
    gate?.close();gate=null;interaction=null;localSession.lock('LOCAL_MANUAL_LOGOUT');
    const revoked=trust.revoke();
    void auth?.signOut();
    try{await revoked;}catch(_){render({status:'error',code:'DEVICE_TRUST_LOGOUT_UNCONFIRMED',message:'Praca zablokowana. Nie potwierdzono trwałego wylogowania w pamięci przeglądarki. Nie zamykaj tej karty.'});}
  }

  function isValid(){
    if(blocked||!localSession.isValid())return false;
    try{profile.assert(localSession.identity().uid);return true;}catch(_){return false;}
  }
  function assert(){if(!isValid())throw Error('AUTH_ACCESS_REVOKED');}
  Object.defineProperty(window,'__FC_MAIN_ACCESS__',{value:Object.freeze({assert,isValid,isLoading:()=>starting&&!started}),writable:false,configurable:false});
  // Covers actual application storage calls, including direct stores and the
  // existing session prototype tracker. Auth's own persistence is independent.
  for(const name of ['getItem','setItem','removeItem']){
    const original=Storage.prototype[name];
    Storage.prototype[name]=function(key,...args){
      if((profile.isAccessKey(String(key))||String(key)===trust.key)&&name!=='getItem')throw Error('LOCAL_ACCESS_PROTECTED');
      if(profile.businessKey(key))assert();
      return original.call(this,key,...args);
    };
  }
  Storage.prototype.clear=function(){throw Error('LOCAL_ACCESS_PROTECTED');};
  function showBusiness(visible){
    document.body.classList.toggle('app-authorized',visible);
    document.documentElement.classList.toggle('auth-blocked',!visible);
    shell.hidden=visible;el('main-auth-bar').hidden=!visible;trustControls();
    el('auth-theme').disabled=visible;
    for(const style of styles)style.disabled=!visible;
    for(const node of businessNodes)node.inert=!visible;
  }
  function block(){
    admission=null;el('auth-profile-admission').hidden=true;
    el('auth-profile-backup').checked=false;el('auth-profile-owner').checked=false;el('auth-profile-confirm').disabled=true;
    profile.revoke();blocked=true;lease=null;showBusiness(false);
    if(starting){fatal=true;loader?.abort();}
  }
  function render(state){
    displayed=state;document.body.dataset.authState=state.status;
    const signed=!!state.uid;trustControls();el('auth-google').disabled=state.status==='checking';el('auth-google').hidden=signed;
    el('auth-account').hidden=!signed;
    const texts={checking:'Sprawdzanie sesji…',unauthenticated:'Zaloguj się, aby rozpocząć.',authenticated:'Zalogowano. Sprawdzanie uprawnień…',unapproved:'Dostęp do aplikacji nie został zatwierdzony.',authorized:'Uruchamianie Meble-App…','profile-pending':'Konto zostało zatwierdzone. Potwierdź dostęp do istniejącego profilu przeglądarki.',revoked:'Uprawnienia zostały cofnięte. Praca została wstrzymana. Niezakończonej edycji nie zapisano ani nie anulowano.',error:'Nie potwierdzono dostępu. Praca pozostała zablokowana.'};
    el('auth-status').textContent=state.message||texts[state.status]||texts.error;
    el('auth-error').hidden=state.status!=='error';el('auth-error').textContent=state.status==='error'?'Nie zmieniono danych. ('+(state.code||'AUTH_ACCESS_UNCONFIRMED')+')':'';
  }
  function failure(error){
    // A delayed business script may resume after the access gate has expired.
    // Keep that gate's refusal and retry path; this is not a second startup.
    if(started && (error?.code||error?.message)==='AUTH_ACCESS_REVOKED' && !isValid()){block();return;}
    fatal=!started&&!String(error?.code||'').startsWith('LOCAL_');block();if(fatal)gate?.close();render({status:'error',uid:auth?.state().uid,code:error?.code||'AUTH_STARTUP_FAILED',message:error?.code==='LOCAL_ACCESS_DATA_CHANGED'
      ?'Dane profilu zmieniły się podczas potwierdzania. Nie dopuszczono dostępu. Zamknij pozostałe karty i ponownie sprawdź profil oraz kopię bezpieczeństwa.'
      :error?.code==='LOCAL_ACCESS_UNCONFIRMED'?'Nie potwierdzono lokalnego dowodu dostępu. Mógł zostać zapisany, ale praca pozostaje zablokowana. Nie zmieniono danych biznesowych ani sesji edycji.'
      :error?.code==='LOCAL_ACCESS_OTHER_ACCOUNT'?'Dane tej przeglądarki są dostępne dla innego konta. Użyj właściwego konta lub osobnego profilu przeglądarki.'
      :'Nie udało się bezpiecznie uruchomić aplikacji. Zachowano dane i niezakończoną edycję. Nie odświeżaj strony z niezapisanym formularzem.'});
  }
  async function loadBusiness(grant,intent,restoring=false){
    if(fatal)throw Object.assign(Error(),{code:'AUTH_RELOAD_REQUIRED'});
    if(!restoring){
      const identity=auth.identity();
      if(!interaction||interaction.uid!==identity.uid||interaction.epoch!==identity.epoch||grant.uid!==identity.uid)throw Error('AUTH_INTERACTION_REQUIRED');
      if(!localSession.isValid())localSession.desktop(grant.uid);
    }
    blocked=false;
    try{
      // Serialize first-use receipts across cooperating tabs. localStorage alone
      // is not compare-and-swap; never let two first logins claim an empty origin.
      if(!navigator.locks?.request)throw Object.assign(Error(),{code:'LOCAL_ACCESS_LOCK_REQUIRED'});
      const pending=new AbortController(),timer=setTimeout(()=>pending.abort(),8000);
      try{await navigator.locks.request('meble-main-access-profile-v1',{signal:pending.signal},async()=>{
        grant.assert();
        localSession.assert(grant.uid);
        if(intent){
          const identity=auth.identity();
          if(identity.uid!==intent.uid||identity.epoch!==intent.epoch)throw Object.assign(Error(),{code:'LOCAL_ACCESS_UNCONFIRMED'});
          await profile.admitExisting(grant.uid,intent.ticket,intent);
        }else if(restoring)await profile.resume(grant.uid,grant.profileAttemptId);
        else await profile.confirm(grant.uid);
      });}
      finally{clearTimeout(timer);}
      localSession.assert(grant.uid);assert();
    }catch(error){
      if(!localSession.isValid())return;blocked=true;
      if(error.code==='LOCAL_DATA_UNCLAIMED'&&!intent&&!restoring){
        grant.assert();const identity=auth.identity();
        const ticket=await profile.prepareAdmission(grant.uid);
        grant.assert();localSession.assert(grant.uid);
        admission={...identity,ticket};
        render({status:'profile-pending',uid:grant.uid});el('auth-profile-admission').hidden=false;return;
      }
      throw error;
    }
    if(started){showBusiness(true);return;}
    if(starting)return;starting=true;
    try{
      const template=el('business-template'),fragment=template.content.cloneNode(true);
      const manifest=Array.from(fragment.querySelectorAll('script[src]'),node=>({src:node.getAttribute('src'),group:node.getAttribute('data-load-group')}));
      fragment.querySelectorAll('script').forEach(node=>node.remove());
      const links=Array.from(el('business-styles').content.cloneNode(true).querySelectorAll('link'));
      await Promise.all(links.map(link=>new Promise((resolve,reject)=>{
        styles.push(link);link.onload=resolve;link.onerror=()=>reject(Error('AUTH_STYLE_NETWORK'));document.head.appendChild(link);
      })));
      assert();
      for(const node of [...fragment.children]){businessNodes.add(node);node.inert=true;}
      document.body.appendChild(fragment);
      loader=FC.mainBusinessLoader.create(assert,failure);await loader.start(manifest);assert();
      // All former deferred scripts are now registered. Replay their startup
      // barrier once; no script was present for the browser's initial DOM event.
      el('auth-theme').disabled=true;for(const style of styles)style.disabled=false;
      document.dispatchEvent(new Event('DOMContentLoaded'));
      assert();if(window.__APP_STARTED__!==true)throw Error('AUTH_STARTUP_UNCONFIRMED');
      started=true;starting=false;document.body.dataset.businessState='ready';showBusiness(true);
    }catch(error){starting=false;throw error;}
  }
  function observe(intent=null){
    gate?.close();
    gate=FC.authAccessGate.create(auth,{verifyAccess:access.verify,watchAccess:access.watch,onBlocked:()=>{lease=null;trustControls();},
      onState:state=>{
        if(state.status==='revoked'||state.denied===true){localSession.lock('AUTH_ACCESS_REVOKED');void trust.revoke().catch(()=>{});}
        if(!fatal&&!isValid())render(state);else trustControls();
      },onAuthorized:async grant=>{
        lease=grant;trustControls();
        // A consent is single-use and bound to the exact Auth identity/epoch.
        // This new gate obtains a fresh server proof through the common verifier.
        const once=intent;intent=null;
        try{await loadBusiness(grant,once);}catch(error){failure(error);}
      }});
  }
  async function initialize(){
    if(initializing||auth)return;if(navigator.onLine===false){render({status:'unauthenticated'});return;}initializing=true;render({status:'checking'});
    try{
      auth=await FC.cloudAuth.create({...window.FC_AUTH_TEST_OPTIONS,sessionOnly:true});
      access=FC.cloudAccessVerifier.create(auth,{sdk:window.FC_AUTH_TEST_OPTIONS?.sdk?.firestore});
      auth.subscribe(value=>{if(value.status==='authenticated'&&localSession.isValid()&&value.uid!==localSession.identity().uid){
        localSession.lock('AUTH_ACCOUNT_CHANGED');void trust.revoke().catch(()=>{});
      }});
      render({status:'unauthenticated'});
    }
    catch(error){render(FC.cloudAuth?.errorState(error)||{status:'error',code:'AUTH_SDK_UNAVAILABLE'});}finally{initializing=false;}
  }
  // Capture precedes business listeners; locked UI cannot dispatch business actions.
  window.addEventListener('click',event=>{
    const button=event.target.closest?.('button');
    const action=button?.id;
    if(['auth-google','auth-signout','main-signout','auth-profile-confirm','auth-profile-cancel'].includes(action)){
      event.stopImmediatePropagation();event.preventDefault();
      if(button.disabled)return;
      if(action==='auth-profile-confirm'){
        if(!admission||!el('auth-profile-backup').checked||!el('auth-profile-owner').checked)return;
        const intent={...admission,backupConfirmed:true,ownerConfirmed:true};
        observe(intent);
      }
      else if(action==='auth-profile-cancel'){
        block();render({status:'error',uid:auth?.state().uid,code:'LOCAL_ACCESS_CANCELLED',message:'Nie dopuszczono profilu. Dane pozostały bez zmian. Wróć po wykonaniu i zachowaniu kopii bezpieczeństwa.'});
      }
      else if(action==='auth-google'){
        if(!event.isTrusted)return;
        if(auth)void auth.signInGoogle().then(result=>{if(result.ok){interaction=auth.identity();observe();}});
        else initialize();
      }
      else if(action==='auth-signout'||action==='main-signout')void logout();
      return;
    }
    if(admission&&el('auth-profile-admission').contains(event.target))return;
    if(!isValid()){event.stopImmediatePropagation();event.preventDefault();block();}
  },true);
  for(const type of ['keydown','input','change','submit','pointerdown'])window.addEventListener(type,event=>{
    if(type==='change'&&admission&&['auth-profile-backup','auth-profile-owner'].includes(event.target.id)){
      el('auth-profile-confirm').disabled=!(el('auth-profile-backup').checked&&el('auth-profile-owner').checked);
    }
    if(!isValid()){event.stopImmediatePropagation();if(!shell.contains(event.target))event.preventDefault();}
  },true);
  el('main-trust-phone').addEventListener('change',async event=>{
    if(!event.isTrusted){trustControls();return;}
    if(!event.target.checked){await logout();return;}
    event.target.disabled=true;
    try{
      if(!isValid()||!lease?.isValid()||!interaction)throw Error('DEVICE_TRUST_ONLINE_APPROVAL_REQUIRED');
      const bound=profile.binding(),identity=auth.identity(),proof=lease;
      const check=()=>{proof.assert();localSession.assert(bound.uid);const current=auth.identity();
        if(current.uid!==bound.uid||current.uid!==identity.uid||current.epoch!==identity.epoch||interaction?.epoch!==identity.epoch)throw Error('DEVICE_TRUST_AUTH_CHANGED');profile.assert(bound.uid);};
      await FC.offlineShell.prepare();check();
      const capability=await navigator.locks.request('meble-device-trust-v1',()=>trust.enroll({uid:bound.uid,profileAttemptId:bound.attemptId,check,consent:true}));
      check();localSession.trusted(capability);await profile.resume(capability.uid,capability.profileAttemptId);
      el('main-trust-status').textContent='Zaufano tej instalacji. Dostęp lokalny działa offline do wylogowania.';
    }catch(_){el('main-trust-status').textContent='Nie potwierdzono zaufania lub kompletnej wersji offline. Zaloguj się ponownie online i spróbuj jeszcze raz.';}
    trustControls();
  });
  window.addEventListener('storage',event=>{if(event.key===trust.key&&event.newValue==='revoked')localSession.lock('LOCAL_MANUAL_LOGOUT');
    else if(event.key===null||event.key===trust.key||profile.isAccessKey(event.key)){if(!isValid())localSession.lock('LOCAL_ACCESS_CHANGED');}});
  window.addEventListener('beforeunload',event=>{if(blocked&&window.FC?.session?.active){event.preventDefault();event.returnValue='';}});
  // Backgrounding is not logout. In-memory desktop sessions fail closed when
  // restored from bfcache; all ordinary activity first checks the 5-minute bound.
  window.addEventListener('pageshow',event=>{if(event.persisted&&localSession.mode()==='desktop')localSession.lock('LOCAL_SESSION_RESTORED');else localSession.isValid();});
  document.addEventListener('visibilitychange',()=>localSession.isValid());
  window.addEventListener('online',()=>{if(!localSession.isValid()&&!auth&&!fatal)void initialize();});
  for(const type of ['pointerdown','pointermove','keydown','input','wheel','touchstart'])window.addEventListener(type,event=>localSession.activity(event),{capture:true,passive:true});
  (async()=>{
    try{
      const capability=await trust.restore();
      if(capability){localSession.trusted(capability);await loadBusiness(capability,null,true);return;}
    }catch(_){localSession.lock('DEVICE_TRUST_UNCONFIRMED');}
    await initialize();
  })();
})();
