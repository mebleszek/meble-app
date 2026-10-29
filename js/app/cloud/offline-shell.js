// Public static resources only. No token, Auth state, business data or RPC cache.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  FC.offlineShell={async prepare(){
    if(!navigator.serviceWorker||!window.isSecureContext)throw Error('OFFLINE_SHELL_UNAVAILABLE');
    const script=new URL('offline-worker.js',document.baseURI),scope=new URL('./',document.baseURI);
    await navigator.serviceWorker.register(script,{scope:scope.pathname,updateViaCache:'none'});
    let deadline;const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('OFFLINE_SHELL_UNCONFIRMED')),30000);})]).finally(()=>clearTimeout(deadline)),worker=registration.active;
    if(!worker||registration.scope!==scope.href||worker.scriptURL!==script.href)throw Error('OFFLINE_SHELL_UNCONFIRMED');
    return new Promise((resolve,reject)=>{
      const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('OFFLINE_SHELL_UNCONFIRMED'));},30000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.complete===true&&/^[a-f0-9]{64}$/.test(event.data.version||'')?resolve(event.data):reject(Error('OFFLINE_SHELL_INCOMPLETE'));};
      worker.postMessage({type:'VERIFY_STATIC_SHELL'},[channel.port2]);
    });
  }};
})();
