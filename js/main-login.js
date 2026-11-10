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
  let interaction=null,startupStage='login-startup',startupCloudReady=false;
  const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
  let recoveryBinding=null,recoveryGate=null,recoveryGrant=null,recoverySurface=null;
  function closeRecovery(){recoveryGate?.close();recoveryGate=null;recoveryGrant=null;recoveryBinding=null;recoverySurface?.dispatchEvent(new Event('meble-rescue-revoke'));recoverySurface?.remove();recoverySurface=null;}
  const trust=FC.localDeviceAccess.createTrust();
  const localSession=FC.localDeviceAccess.createSession({onLock(code){
    closeRecovery();
    FC.applicationSyncActions?.close();FC.applicationStartup?.revokeCloud();
    gate?.close();gate=null;interaction=null;block();render({status:'unauthenticated',code});
  }});
  const businessNodes=new Set(),styles=[];
  function trustControls(){
    el('main-trust-phone').checked=localSession.mode()==='trusted';
    el('main-trust-phone').disabled=localSession.mode()!=='trusted'&&!lease?.isValid();
  }
  async function logout(){
    closeRecovery();
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
  function recoveryAssert(ownerUid=recoveryBinding?.uid){
    const b=recoveryBinding;if(!fatal||!blocked||started||starting||!b||b.uid!==ownerUid)throw Error('RESCUE_AUTH_OR_BUSY');
    localSession.assert(b.uid);const identity=localSession.identity();
    if(identity.epoch!==b.epoch||nativeGet.call(localStorage,profile.key)!==b.receipt||nativeGet.call(localStorage,profile.pendingKey)!==null)throw Error('RESCUE_AUTH_OR_BUSY');
    if(localSession.mode()!=='trusted'){
      recoveryGrant?.assert();if(!recoveryGrant?.isValid()||recoveryGrant.uid!==b.uid)throw Error('RESCUE_AUTH_OR_BUSY');
      if(auth.identity().uid!==b.uid)throw Error('RESCUE_AUTH_OR_BUSY');
    }
  }
  const recoveryAccess=Object.freeze({scope:'LOCAL_FIRST_RESCUE_READ_ONLY_V1',assert:recoveryAssert,
    isValid(){try{recoveryAssert();return true;}catch(_){return false;}},
    async verify(){recoveryAssert();const b=recoveryBinding;await profile.verifyExistingReadOnly(b.uid,b.attemptId);recoveryAssert();},
    readNative(key){recoveryAssert();if(!profile.businessKey(key)&&!['meble_application_authority_v1','meble_backup_archive_backend_v1','meble_local_reset_v1'].includes(key))throw Error('RESCUE_READ_SCOPE');return nativeGet.call(localStorage,key);},
    readSession(key){recoveryAssert();if(!profile.businessKey(key))throw Error('RESCUE_READ_SCOPE');return nativeGet.call(sessionStorage,key);}
  });
  Object.defineProperty(window,'__FC_RECOVERY_ACCESS__',{value:recoveryAccess,writable:false,configurable:false});
  async function openRecovery(){
    if(!recoveryBinding)throw Error('RESCUE_AUTH_OR_BUSY');
    if(localSession.mode()!=='trusted'){
      recoveryGate?.close();recoveryGrant=null;
      await new Promise((resolve,reject)=>{
        let expired=false;const timer=setTimeout(()=>{expired=true;recoveryGate?.close();recoveryGrant=null;reject(Error('RESCUE_AUTH_OR_BUSY'));},10000);
        recoveryGate=FC.authAccessGate.create(auth,{verifyAccess:access.verify,watchAccess:access.watch,onBlocked(){recoveryGrant=null;recoverySurface?.dispatchEvent(new Event('meble-rescue-revoke'));recoverySurface?.remove();recoverySurface=null;},
          onAuthorized(grant){if(expired)return;recoveryGrant=grant;clearTimeout(timer);resolve();},
          onState(state){if(state.denied===true||state.status==='revoked'){localSession.lock('AUTH_ACCESS_REVOKED');void trust.revoke().catch(()=>{});}
            if(['error','unapproved','unauthenticated','revoked'].includes(state.status)){expired=true;clearTimeout(timer);reject(Error('RESCUE_AUTH_OR_BUSY'));}}
        });
        if(expired)recoveryGate.close();
      });
    }
    await recoveryAccess.verify();
    recoverySurface=await FC.applicationStartup.openLocalFirstRecovery({parent:shell,resetStorage:{read:(storage,key)=>nativeGet.call(storage,key),get:key=>nativeGet.call(localStorage,key),set:(key,value)=>nativeSet.call(localStorage,key,value),remove:(storage,key)=>nativeRemove.call(storage,key)},onClose(){recoverySurface=null;}});
  }
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
    if(state.status==='error')FC.applicationStartup?.recordFailure?.({code:state.code||'AUTH_ACCESS_UNCONFIRMED'},startupStage);
    const diagnostic=FC.applicationStartup?.diagnostics?.(),first=diagnostic?.firstError,conflict=diagnostic?.aliasConflict;
    const code=FC.applicationStartup?.errorCode?.(state.code||'AUTH_ACCESS_UNCONFIRMED')||state.code||'AUTH_ACCESS_UNCONFIRMED';
    const aliasDetail=conflict?'; domena konfliktu: '+conflict.domain+'; klucze: '+(conflict.keys.length===2?conflict.keys.join(' / '):'UNKNOWN'):'';
    const scriptDetail=first?.script?'; skrypt #'+first.script.index+' / '+first.script.group+' / '+first.script.phase+' / HTTP '+first.script.status+' / '+first.script.name+' / wiersz '+first.script.line:'';
    const detail=(first?'Pierwszy błąd: '+first.stage+' / '+first.code+(code!==first.code?'; '+code:''):code)+aliasDetail+scriptDetail;
    const globals=FC.globalDataDiagnostics?.format?.(diagnostic?.globalConsistency)||(diagnostic?.globalConsistency?'DANE GLOBALNE: BLOCKED / DIAG_READ_BLOCKED':'');
    el('auth-error').hidden=state.status!=='error';el('auth-error').textContent=state.status==='error'?'Nie zmieniono danych. ('+detail+')'+(globals?'\n'+globals:''):'';
    if(el('auth-recovery'))el('auth-recovery').hidden=!recoveryBinding||state.status!=='error';
  }
  function failure(error){
    // A delayed business script may resume after the access gate has expired.
    // Keep that gate's refusal and retry path; this is not a second startup.
    if(started && (error?.code||error?.message)==='AUTH_ACCESS_REVOKED' && !isValid()){block();return;}
    FC.applicationStartup?.recordFailure?.(error,startupStage);
    // Eligibility comes from the startup's confirmed cleanup and closed stage
    // vocabulary; it grants no Auth/profile permission by itself.
    if(!started&&!recoveryBinding&&FC.applicationStartup?.canRecoverGlobals?.()){
      try{assert();const b=profile.binding(),id=localSession.identity();recoveryBinding={...b,epoch:id.epoch,receipt:nativeGet.call(localStorage,profile.key)};}catch(_){closeRecovery();}
    }
    fatal=!started&&!String(error?.code||'').startsWith('LOCAL_');block();if(fatal)gate?.close();render({status:'error',uid:auth?.state().uid,code:error?.code||'AUTH_STARTUP_FAILED',message:error?.code==='LOCAL_ACCESS_DATA_CHANGED'
      ?'Dane profilu zmieniły się podczas potwierdzania. Nie dopuszczono dostępu. Zamknij pozostałe karty i ponownie sprawdź profil oraz kopię bezpieczeństwa.'
      :error?.code==='LOCAL_ACCESS_UNCONFIRMED'?'Nie potwierdzono lokalnego dowodu dostępu. Mógł zostać zapisany, ale praca pozostaje zablokowana. Nie zmieniono danych biznesowych ani sesji edycji.'
      :error?.code==='LOCAL_ACCESS_OTHER_ACCOUNT'?'Dane tej przeglądarki są dostępne dla innego konta. Użyj właściwego konta lub osobnego profilu przeglądarki.'
      :'Nie udało się bezpiecznie uruchomić aplikacji. Zachowano dane i niezakończoną edycję. Nie odświeżaj strony z niezapisanym formularzem.'});
  }
  function syncContext(renewLease){
    const ownerUid=localSession.identity().uid;
    const context={ownerUid,authSession:auth,lease,localAccess:{ownerUid,mode:localSession.mode(),
      firebaseConfig:window.FC_AUTH_TEST_OPTIONS?.firebaseConfig,target:window.FC_AUTH_TEST_OPTIONS?.target,
      emulator:window.FC_AUTH_TEST_OPTIONS?.emulator,
      deny(){void trust.revoke();localSession.lock('AUTH_ACCESS_REVOKED');},
      assert(){localSession.assert(ownerUid);profile.assert(ownerUid);assert();}}};
    if(renewLease){let pending;context.renewLease=()=>pending||=(async()=>{
      const grant=await renewLease();context.lease=grant;delete context.renewLease;return grant;
    })();}
    return context;
  }
  async function loadBusiness(grant,intent,restoring=false){
    if(fatal)throw Object.assign(Error(),{code:'AUTH_RELOAD_REQUIRED'});
    if(starting)return;
    const initialIdentity=restoring?null:auth.identity();
    startupStage='checking-local-access';
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
    if(starting)return;
    const localEpoch=localSession.identity().epoch;
    if(!started){starting=true;startupCloudReady=false;}
    try{
      startupStage='preparing-source';
      await FC.applicationStartup?.beforeBusiness(syncContext());
      if(started){await FC.applicationStartup?.start(syncContext());showBusiness(true);return;}
      const template=el('business-template'),fragment=template.content.cloneNode(true);
      const manifest=Array.from(fragment.querySelectorAll('script[src]'),node=>({src:node.getAttribute('src'),group:node.getAttribute('data-load-group')}));
      fragment.querySelectorAll('script').forEach(node=>node.remove());
      const links=Array.from(el('business-styles').content.cloneNode(true).querySelectorAll('link'));
      startupStage='loading-business-styles';
      await Promise.all(links.map(link=>new Promise((resolve,reject)=>{
        styles.push(link);link.onload=resolve;link.onerror=()=>reject(Error('AUTH_STYLE_NETWORK'));document.head.appendChild(link);
      })));
      assert();
      for(const node of [...fragment.children]){businessNodes.add(node);node.inert=true;}
      document.body.appendChild(fragment);
      startupStage='loading-business-scripts';
      loader=FC.mainBusinessLoader.create(assert,failure);await loader.start(manifest);assert();
      // All former deferred scripts are now registered. Replay their startup
      // barrier once; no script was present for the browser's initial DOM event.
      el('auth-theme').disabled=true;for(const style of styles)style.disabled=false;
      startupStage='starting-business';
      document.dispatchEvent(new Event('DOMContentLoaded'));
      assert();if(window.__APP_STARTED__!==true)throw Error('AUTH_STARTUP_UNCONFIRMED');
      startupStage='starting-local-first';
      await FC.applicationStartup?.start(syncContext(initialIdentity?()=>renewStartupLease(initialIdentity,localEpoch):null));
      assert();started=true;starting=false;document.body.dataset.businessState='ready';showBusiness(true);
    }catch(error){starting=false;throw error;}
  }
  function cloudBlocked(){lease=null;trustControls();}
  function cloudState(state){
        if(state.status==='revoked'||state.denied===true){localSession.lock('AUTH_ACCESS_REVOKED');void trust.revoke().catch(()=>{});}
        if(!started&&localSession.mode()==='desktop'&&isValid()&&state.status==='error'){
          // An expired initial proof is refreshed after all SDK imports. A
          // failed proof, or expiry after that boundary, still stops startup.
          if(starting&&!startupCloudReady&&state.code==='AUTH_ACCESS_EXPIRED'){trustControls();return;}
          failure(Object.assign(Error(),{code:state.code||'AUTH_ACCESS_UNCONFIRMED'}));return;
        }
        const previousMode=localSession.mode();
        if(!fatal&&!isValid()){
          // isValid can expire the desktop session synchronously. onLock has
          // already rendered the login screen; this older cloud callback must
          // not overwrite it with a signed-in state that hides Google login.
          if(previousMode!=='locked'&&localSession.mode()==='locked')return;
          render(state);
        }else trustControls();
  }
  async function renewStartupLease(identity,localEpoch){
    const check=()=>{assert();const current=auth.identity(),local=localSession.identity();
      if(fatal||!starting||started||localSession.mode()!=='desktop'||current.uid!==identity.uid||current.epoch!==identity.epoch||local.uid!==identity.uid||local.epoch!==localEpoch)throw Object.assign(Error(),{code:'AUTH_ACCOUNT_CHANGED'});};
    check();gate?.close();
    return new Promise((resolve,reject)=>{
      let next,settled=false,creating=true;
      const finish=(error,grant)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){next?.close();reject(error);}else resolve(grant);};
      const timer=setTimeout(()=>finish(Object.assign(Error(),{code:'AUTH_ACCESS_TIMEOUT'})),10000);
      try{
        next=FC.authAccessGate.create(auth,{verifyAccess:access.verify,watchAccess:access.watch,
          onBlocked(){cloudBlocked();if(!creating&&!settled)finish(Object.assign(Error(),{code:'AUTH_ACCESS_REVOKED'}));},
          onState(state){
            if(['error','revoked','unapproved','unauthenticated'].includes(state.status))finish(Object.assign(Error(),{code:state.code||'AUTH_ACCESS_UNCONFIRMED'}));
            cloudState(state);
          },
          onAuthorized(grant){if(settled)return;try{check();grant.assert();lease=grant;startupCloudReady=true;trustControls();finish(null,grant);}catch(error){finish(error);}}
        });
        creating=false;if(settled&&!lease?.isValid())next.close();else gate=next;
      }catch(error){creating=false;finish(error);}
    });
  }
  function observe(intent=null){
    gate?.close();
    gate=FC.authAccessGate.create(auth,{verifyAccess:access.verify,watchAccess:access.watch,onBlocked:cloudBlocked,
      onState:cloudState,onAuthorized:async grant=>{
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
  // Auth actions run in bubbling, AFTER the business pointerup/click guard can
  // consume a compatibility click retargeted under a closed modal.
  window.addEventListener('click',event=>{
    const action=event.target.closest?.('button')?.id;
    if(['auth-google','auth-signout','main-signout','auth-profile-confirm','auth-profile-cancel','auth-recovery'].includes(action))return;
    if(recoverySurface?.contains(event.target)&&recoveryAccess.isValid())return;
    if(admission&&el('auth-profile-admission').contains(event.target))return;
    if(!isValid()){event.stopImmediatePropagation();event.preventDefault();block();}
  },true);
  window.addEventListener('click',event=>{
    const button=event.target.closest?.('button');
    const action=button?.id;
    if(['auth-google','auth-signout','main-signout','auth-profile-confirm','auth-profile-cancel','auth-recovery'].includes(action)){
      event.stopImmediatePropagation();event.preventDefault();
      if(button.disabled)return;
      if(action==='auth-recovery'){
        if(!event.isTrusted)return;button.disabled=true;
        void openRecovery().catch(()=>{el('auth-error').textContent+='\nSTOP — nie potwierdzono dostępu ratunkowego właściciela.';}).finally(()=>{button.disabled=false;});
      }
      else if(action==='auth-profile-confirm'){
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
  });
  for(const type of ['keydown','input','change','submit','pointerdown'])window.addEventListener(type,event=>{
    if(recoverySurface?.contains(event.target)&&recoveryAccess.isValid())return;
    if(type==='change'&&admission&&['auth-profile-backup','auth-profile-owner'].includes(event.target.id)){
      el('auth-profile-confirm').disabled=!(el('auth-profile-backup').checked&&el('auth-profile-owner').checked);
    }
    if(!isValid()){
      // A fresh physical gesture on the login shell must reach the document's
      // click-guard reset. This does not authorize any business event or data.
      if(type==='pointerdown'&&shell.contains(event.target))return;
      event.stopImmediatePropagation();if(!shell.contains(event.target))event.preventDefault();
    }
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
      void FC.applicationStartup?.refresh(syncContext()).catch(()=>{});
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
    }catch(error){if(FC.applicationStartup?.canRecoverGlobals?.()){failure(error);return;}localSession.lock('DEVICE_TRUST_UNCONFIRMED');}
    await initialize();
  })();
})();
