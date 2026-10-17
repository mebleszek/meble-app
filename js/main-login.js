// Main entry: one Auth instance, one authorization gate, one business startup.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{},el=id=>document.getElementById(id),shell=el('main-login');
  let profile;
  try{profile=FC.localAccessProfile.create(localStorage,sessionStorage);}
  catch(_){el('auth-status').textContent='Pamięć przeglądarki jest niedostępna. Nie uruchomiono aplikacji.';el('auth-error').hidden=false;el('auth-error').textContent='LOCAL_ACCESS_UNCONFIRMED';document.body.dataset.authState='error';return;}
  let auth=null,access=null,gate=null,lease=null,blocked=true,started=false,starting=false,fatal=false,loader=null,lastUid=null;
  let displayed={status:'checking'},initializing=false;
  const businessNodes=new Set(),styles=[];
  function isValid(){
    if(blocked||!lease?.isValid())return false;
    try{profile.assert(lease.uid);return true;}catch(_){return false;}
  }
  function assert(){if(!isValid())throw Error('AUTH_ACCESS_REVOKED');}
  Object.defineProperty(window,'__FC_MAIN_ACCESS__',{value:Object.freeze({assert,isValid,isLoading:()=>starting&&!started}),writable:false,configurable:false});
  // Covers actual application storage calls, including direct stores and the
  // existing session prototype tracker. Auth's own persistence is independent.
  for(const name of ['getItem','setItem','removeItem']){
    const original=Storage.prototype[name];
    Storage.prototype[name]=function(key,...args){
      if(String(key)===profile.key&&name!=='getItem')throw Error('LOCAL_ACCESS_PROTECTED');
      if(profile.businessKey(key))assert();
      return original.call(this,key,...args);
    };
  }
  Storage.prototype.clear=function(){throw Error('LOCAL_ACCESS_PROTECTED');};
  function showBusiness(visible){
    document.body.classList.toggle('app-authorized',visible);
    document.documentElement.classList.toggle('auth-blocked',!visible);
    shell.hidden=visible;el('main-auth-bar').hidden=!visible;
    el('auth-theme').disabled=visible;
    for(const style of styles)style.disabled=!visible;
    for(const node of businessNodes)node.inert=!visible;
  }
  function block(){
    blocked=true;lease=null;showBusiness(false);
    if(starting){fatal=true;loader?.abort();}
  }
  function render(state){
    displayed=state;document.body.dataset.authState=state.status;
    const signed=!!state.uid;el('auth-google').disabled=state.status==='checking';el('auth-google').hidden=signed;
    el('auth-account').hidden=!signed;
    if(lastUid!==state.uid||!signed){el('auth-uid').hidden=true;el('auth-uid').textContent='';el('auth-uid-toggle').setAttribute('aria-expanded','false');}lastUid=state.uid||null;
    const texts={checking:'Sprawdzanie sesji…',unauthenticated:'Zaloguj się, aby rozpocząć.',authenticated:'Zalogowano. Sprawdzanie uprawnień…',unapproved:'Dostęp do aplikacji nie został zatwierdzony.',authorized:'Uruchamianie Meble-App…',revoked:'Uprawnienia zostały cofnięte. Praca została wstrzymana. Niezakończonej edycji nie zapisano ani nie anulowano.',error:'Nie potwierdzono dostępu. Praca pozostała zablokowana.'};
    el('auth-status').textContent=state.message||texts[state.status]||texts.error;
    el('auth-error').hidden=state.status!=='error';el('auth-error').textContent=state.status==='error'?'Nie zmieniono danych. ('+(state.code||'AUTH_ACCESS_UNCONFIRMED')+')':'';
  }
  function failure(error){
    fatal=!started&&!String(error?.code||'').startsWith('LOCAL_');block();if(fatal)gate?.close();render({status:'error',uid:auth?.state().uid,code:error?.code||'AUTH_STARTUP_FAILED',message:error?.code==='LOCAL_DATA_UNCLAIMED'
      ?'Ta przeglądarka zawiera dane bez potwierdzonego powiązania z kontem. Uruchomienie wstrzymano, aby ich nie przypisać ani nie nadpisać. Potrzebna jest decyzja administratora.'
      :error?.code==='LOCAL_ACCESS_OTHER_ACCOUNT'?'Dane tej przeglądarki są dostępne dla innego konta. Użyj właściwego konta lub osobnego profilu przeglądarki.'
      :'Nie udało się bezpiecznie uruchomić aplikacji. Zachowano dane i niezakończoną edycję. Nie odświeżaj strony z niezapisanym formularzem.'});
  }
  async function loadBusiness(grant){
    if(fatal)throw Object.assign(Error(),{code:'AUTH_RELOAD_REQUIRED'});
    lease=grant;blocked=false;
    try{
      // Serialize first-use receipts across cooperating tabs. localStorage alone
      // is not compare-and-swap; never let two first logins claim an empty origin.
      if(!navigator.locks?.request)throw Object.assign(Error(),{code:'LOCAL_ACCESS_LOCK_REQUIRED'});
      const pending=new AbortController(),timer=setTimeout(()=>pending.abort(),8000);
      try{await navigator.locks.request('meble-main-access-profile-v1',{signal:pending.signal},()=>{grant.assert();profile.confirm(grant.uid);});}
      finally{clearTimeout(timer);}
      if(lease!==grant)return;assert();
    }catch(error){if(lease!==grant)return;blocked=true;throw error;}
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
  function observe(){
    gate?.close();
    gate=FC.authAccessGate.create(auth,{verifyAccess:access.verify,watchAccess:access.watch,onBlocked:block,
      onState:state=>{if(!fatal)render(state);},onAuthorized:async grant=>{try{await loadBusiness(grant);}catch(error){failure(error);}}});
  }
  async function initialize(){
    if(initializing||auth)return;initializing=true;render({status:'checking'});
    try{auth=await FC.cloudAuth.create(window.FC_AUTH_TEST_OPTIONS);access=FC.cloudAccessVerifier.create(auth);observe();}
    catch(error){render(FC.cloudAuth?.errorState(error)||{status:'error',code:'AUTH_SDK_UNAVAILABLE'});}finally{initializing=false;}
  }
  // Capture precedes business listeners; locked UI cannot dispatch business actions.
  window.addEventListener('click',event=>{
    const button=event.target.closest?.('button');
    const action=button?.id;
    if(['auth-google','auth-signout','main-signout','auth-uid-toggle'].includes(action)){
      event.stopImmediatePropagation();event.preventDefault();
      if(button.disabled)return;
      if(action==='auth-google'){if(auth)auth.signInGoogle();else initialize();}
      else if(action==='auth-signout'||action==='main-signout')auth?.signOut();
      else{try{el('auth-uid').textContent=auth.identity().uid;el('auth-uid').hidden=!el('auth-uid').hidden;button.setAttribute('aria-expanded',String(!el('auth-uid').hidden));}catch(_){}}
      return;
    }
    if(!isValid()){event.stopImmediatePropagation();event.preventDefault();block();}
  },true);
  for(const type of ['keydown','input','change','submit','pointerdown'])window.addEventListener(type,event=>{
    if(!isValid()){event.stopImmediatePropagation();if(!shell.contains(event.target))event.preventDefault();}
  },true);
  window.addEventListener('storage',event=>{if(event.key===profile.key&&!isValid())block();});
  window.addEventListener('beforeunload',event=>{if(blocked&&window.FC?.session?.active){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{gate?.close();});
  window.addEventListener('pageshow',event=>{if(event.persisted&&auth&&!fatal)observe();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&auth&&!fatal&&displayed.status!=='authorized')observe();});
  window.addEventListener('online',()=>{if(auth&&!fatal&&displayed.status!=='authorized')observe();});
  initialize();
})();
