// Public static resources only. No token, Auth state, business data or RPC cache.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  function firstActivation(registration,script){
    return new Promise((resolve,reject)=>{
      let installing;
      const timeout=setTimeout(()=>finish('OFFLINE_SHELL_UNCONFIRMED'),180000);
      function finish(code){
        clearTimeout(timeout);
        registration.removeEventListener('updatefound',inspect);
        installing?.removeEventListener('statechange',inspect);
        if(code)reject(Error(code));else resolve();
      }
      function inspect(){
        const candidate=registration.installing||registration.waiting||registration.active;
        if(candidate&&candidate!==installing){
          installing?.removeEventListener('statechange',inspect);
          installing=candidate;
          installing.addEventListener('statechange',inspect);
        }
        if(installing&&installing.scriptURL!==script.href)return finish('OFFLINE_SHELL_UNCONFIRMED');
        if(installing?.state==='redundant')return finish('OFFLINE_SHELL_INSTALL_FAILED');
        if(registration.active?.state==='activated')finish();
      }
      registration.addEventListener('updatefound',inspect);
      inspect();
    });
  }
  FC.offlineShell={async prepare(){
    if(!navigator.serviceWorker||!window.isSecureContext)throw Error('OFFLINE_SHELL_UNAVAILABLE');
    const script=new URL('offline-worker.js',document.baseURI),scope=new URL('./',document.baseURI);
    let existing=null;
    if(navigator.onLine===false){existing=await navigator.serviceWorker.getRegistration(scope.href);if(!existing?.active)throw Error('OFFLINE_SHELL_UNCONFIRMED');}
    else{
      const registered=await navigator.serviceWorker.register(script,{scope:scope.pathname,updateViaCache:'none'});
      if(registered&&registered.scope!==scope.href)throw Error('OFFLINE_SHELL_UNCONFIRMED');
      if(registered&&!registered.active){
        await firstActivation(registered,script);
        existing=registered;
      }
    }
    let deadline;const registration=existing||await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('OFFLINE_SHELL_UNCONFIRMED')),30000);})]).finally(()=>clearTimeout(deadline)),worker=registration.active;
    if(!worker||registration.scope!==scope.href||worker.scriptURL!==script.href)throw Error('OFFLINE_SHELL_UNCONFIRMED');
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('OFFLINE_SHELL_UNCONFIRMED'));},30000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.complete===true&&/^[a-f0-9]{64}$/.test(event.data.version||'')?resolve(event.data):reject(Error('OFFLINE_SHELL_INCOMPLETE'));};
      worker.postMessage({type:'VERIFY_STATIC_SHELL'},[channel.port2]);
    });
  }};
})();
