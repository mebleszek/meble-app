// Shared Google Auth. Never imports Firestore or business data.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const fail=code=>{const e=new Error(code);e.code=code;throw e;};
  const messages={
    'AUTH_CONFIG_REQUIRED':'Uzupełnij konfigurację Firebase aplikacji Web przed testem logowania.',
    'AUTH_CONFIG_INVALID':'Konfiguracja testu Firebase jest nieprawidłowa.',
    'AUTH_SDK_UNAVAILABLE':'Nie udało się wczytać logowania. Sprawdź połączenie i spróbuj ponownie.',
    'auth/invalid-api-key':'Sprawdź publiczną konfigurację aplikacji Web z konsoli Firebase.',
    'auth/operation-not-supported-in-this-environment':'Otwórz test logowania w pełnej przeglądarce Chrome.',
    'auth/too-many-requests':'Zbyt wiele prób logowania. Spróbuj ponownie później.',
    'AUTH_PERSISTENCE_UNAVAILABLE':'Przeglądarka nie pozwala zachować sesji. Sprawdź ustawienia pamięci witryny.',
    'auth/popup-closed-by-user':'Okno Google zostało zamknięte. Możesz spróbować ponownie.',
    'auth/cancelled-popup-request':'Poprzednia próba logowania została przerwana. Spróbuj ponownie.',
    'auth/internal-error':'Nie udało się uruchomić logowania Google. Sprawdź połączenie i dostęp do usług Google.',
    'auth/popup-blocked':'Przeglądarka zablokowała okno Google. Zezwól na wyskakujące okna dla tej witryny.',
    'auth/network-request-failed':'Nie udało się połączyć z Google. Sprawdź połączenie i spróbuj ponownie.',
    'auth/unauthorized-domain':'Ta domena nie została zatwierdzona w Firebase Authentication.',
    'auth/operation-not-allowed':'Logowanie Google nie jest dostępne w konfiguracji Firebase.',
    'auth/web-storage-unsupported':'Pamięć witryny jest niedostępna. Otwórz stronę w Chrome i sprawdź jego ustawienia.',
    'AUTH_GOOGLE_REQUIRED':'Użyj konta Google.',
    'AUTH_SESSION_UNCONFIRMED':'Nie potwierdzono sesji logowania. Dostęp pozostał zablokowany.'
  };
  function errorState(error){const code=Object.hasOwn(messages,error?.code)?error.code:'AUTH_SESSION_UNCONFIRMED';return {status:'error',code,message:messages[code],uid:null,epoch:null};}
  function configOf(options){
    if(!options?.firebaseConfig)fail('AUTH_CONFIG_REQUIRED');
    const c=options.firebaseConfig,keys=Object.keys(c);
    if(!keys.every(k=>['apiKey','authDomain','projectId','appId'].includes(k))||!['apiKey','authDomain','projectId','appId'].every(k=>typeof c[k]==='string'&&c[k].trim()&& !c[k].includes('COPY_')))fail('AUTH_CONFIG_INVALID');
    if(options.target==='emulator'){
      if(!/^demo-[a-z0-9-]+$/.test(c.projectId)||!options.emulator||!['localhost','127.0.0.1'].includes(options.emulator.host)
        ||!Number.isInteger(options.emulator.port)||options.emulator.port<1||options.emulator.port>65535)fail('AUTH_CONFIG_INVALID');
    }else if(options.target!=='live-auth'||c.projectId!=='mebleszek-meble-app'||c.authDomain!=='mebleszek-meble-app.firebaseapp.com')fail('AUTH_CONFIG_INVALID');
    return {...c};
  }
  async function create(options){
    const config=configOf(options),shared=FC.firebasePilotTransport;if(!shared)fail('AUTH_SESSION_UNCONFIRMED');
    const sdk=options.sdk||await shared.loadAuthSdk().catch(()=>fail('AUTH_SDK_UNAVAILABLE')),a=sdk.auth;
    const app=sdk.app.initializeApp(config,options.appName||'meble-auth-test');
    let auth;
    try{
      const persistences=options.sessionOnly===true?[a.inMemoryPersistence]:[a.indexedDBLocalPersistence,a.browserLocalPersistence];
      auth=a.initializeAuth(app,{persistence:persistences.filter(value=>typeof value==='function'),...(typeof a.browserPopupRedirectResolver==='function'?{popupRedirectResolver:a.browserPopupRedirectResolver}:{})});
      if(options.target==='emulator')a.connectAuthEmulator(auth,'http://'+options.emulator.host+':'+options.emulator.port,{disableWarnings:true});
      // SDK owns all tokens. No application token/localStorage implementation.
      let persistent=false;
      for(const persistence of persistences){
        if(typeof persistence!=='function')continue;
        try{await a.setPersistence(auth,persistence);persistent=true;break;}catch(_){ }
      }
      if(!persistent)fail('AUTH_PERSISTENCE_UNAVAILABLE');
    }catch(e){await sdk.app.deleteApp(app);throw e;}
    let state={status:'checking',uid:null,epoch:null},closed=false,busy=false,observer;
    const listeners=new Set();
    function emit(next){state=Object.freeze(next);for(const fn of listeners)fn(state);}
    observer=shared.observeIdentity(auth,a,result=>{
      if(closed)return;
      if(result.failed){emit(errorState({code:'AUTH_SESSION_UNCONFIRMED'}));return;}
      if(!result.uid){emit({status:'unauthenticated',uid:null,epoch:result.epoch});return;}
      try{emit({status:'authenticated',...observer.identity()});}catch(_){emit(errorState({code:'AUTH_GOOGLE_REQUIRED'}));}
    });
    await observer.ready();
    return {
      state:()=>state,
      subscribe(fn){listeners.add(fn);fn(state);return ()=>listeners.delete(fn);},
      identity:()=>observer.identity(),
      // Internal verifier uses this exact Auth/app instance, never a second login.
      verificationContext(){observer.identity();return {app,auth,target:options.target,emulator:options.emulator?{...options.emulator}:null};},
      signInGoogle(){
        if(closed||busy)return Promise.resolve({ok:false,code:'AUTH_SESSION_UNCONFIRMED'});
        busy=true;emit({status:'checking',uid:null,epoch:null});
        const provider=new a.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
        // Invoke in the click stack: no await/import/persistence before popup.
        let popup;try{popup=a.signInWithPopup(auth,provider);}catch(e){popup=Promise.reject(e);}
        return Promise.resolve(popup).then(()=>{
          if(closed)fail('AUTH_SESSION_UNCONFIRMED');
          const current=observer.identity();
          // Auth-state listeners need not fire when the UID remains unchanged.
          if(state.status!=='authenticated'||state.uid!==current.uid||state.epoch!==current.epoch)emit({status:'authenticated',...current});
          return {ok:true};
        }).catch(e=>{if(!closed)emit(errorState(e));return {ok:false,code:state.code||'AUTH_SESSION_UNCONFIRMED'};}).finally(()=>{busy=false;});
      },
      async signOut(){
        if(closed)return {ok:false,code:'AUTH_SESSION_UNCONFIRMED'};
        observer.invalidate();emit({status:'checking',uid:null,epoch:null});
        try{await a.signOut(auth);return {ok:true};}catch(e){emit(errorState(e));return {ok:false,code:state.code};}
      },
      async close(){closed=true;observer.close();listeners.clear();await sdk.app.deleteApp(app);}
    };
  }
  FC.cloudAuth={create,errorState,configOf};
})();
