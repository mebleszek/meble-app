// Installs a verified static release after the application yields its writer.
(function(){
 'use strict';
 const FC=window.FC=window.FC||{},marker='meble-pending-update-v1',protocol=1;
 const validVersion=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 let started=false;
 const rpc=(worker,message)=>new Promise(resolve=>{
  const c=new MessageChannel();
  const finish=value=>{clearTimeout(timer);c.port1.close();resolve(value);};
  const timer=setTimeout(()=>finish(null),5000);
  c.port1.onmessage=e=>finish(e.data);
  try{worker.postMessage(message,[c.port2]);}catch(_){finish(null);}
 });
 function activate({worker,version,registration,service},assertReady,onSlow){
  return new Promise((resolve,reject)=>{
   const channel=new MessageChannel(),nonce=crypto.randomUUID(),previous=service.controller;
   let committed=false,timer;
   const clear=()=>{
    clearTimeout(timer);channel.port1.close();
    service.removeEventListener('controllerchange',changed);worker.removeEventListener('statechange',changed);
   };
   const stop=reason=>{clear();reject(Error(reason));};
   function changed(){
    if(committed&&service.controller===worker&&registration.active===worker){clear();resolve();return;}
    if(worker.state==='redundant'&&service.controller===previous)stop('CANDIDATE_CHANGED');
   }
   service.addEventListener('controllerchange',changed);worker.addEventListener('statechange',changed);
   timer=setTimeout(()=>stop('INSTALL_UNCONFIRMED'),30000);
   channel.port1.onmessage=({data})=>{
    if(data?.nonce!==nonce||data.protocol!==protocol||data.version!==version)return;
    if(data.status==='refused'&&service.controller===previous){
     stop(['OTHER_TAB','CANDIDATE_CHANGED','APP_BUSY'].includes(data.reason)?data.reason:'INSTALL_UNCONFIRMED');return;
    }
    if(data.status==='prepared'&&!committed){
     try{
      if(registration.waiting!==worker||service.controller!==previous)throw Error('CANDIDATE_CHANGED');
      if(navigator.onLine===false)throw Error('OFFLINE');
      assertReady();
      committed=true;
      clearTimeout(timer);
      // After authorizing the switch, an absent reply is no proof of refusal.
      // Keep the application paused and observe the actual controller.
      timer=setTimeout(onSlow,12000);
      channel.port1.postMessage({nonce,version,confirm:true});
     }catch(error){stop(error.code||error.message);}
    }
    changed();
   };
   try{worker.postMessage({type:'ACTIVATE_STATIC_SHELL',protocol,version,nonce},[channel.port2]);}catch(_){stop('INSTALL_UNCONFIRMED');}
  });
 }
 async function start(){
  const service=window.navigator?.serviceWorker;
  if(started||!service||!window.isSecureContext)return;
  started=true;
  const root=new URL('./',document.baseURI),script=new URL('offline-worker.js',root);
  let registration,checking=false,installing=false,candidate=null,dismissed=null,confirmed=false;
  const notice=document.createElement('aside');notice.id='offline-update-notice';notice.hidden=true;
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const update=document.createElement('button');update.type='button';update.className='btn';update.textContent='Aktualizuj';
  const later=document.createElement('button');later.type='button';later.className='btn';later.textContent='Później';
  notice.append(status,update,later);document.body.appendChild(notice);
  const show=(message,actions=true)=>{
   status.textContent=message;notice.hidden=false;update.hidden=later.hidden=!actions;
  };
  const busyMessage='Zakończ edycję i wybierz „Wyjdź”, a potem spróbuj ponownie.';
  const messages={
   OTHER_TAB:'Zamknij pozostałe karty Meble-App w tym profilu i spróbuj ponownie.',
   LF_OTHER_APPLICATION_CLIENT:'Zamknij pozostałe karty Meble-App w tym profilu i spróbuj ponownie.',
   UPDATE_SAVE_PENDING:'Synchronizacja jeszcze trwa. Poczekaj na potwierdzenie zapisu i spróbuj ponownie.',
   OFFLINE:'Połącz się z internetem i spróbuj ponownie.',
   CANDIDATE_CHANGED:'Wydanie się zmieniło. Sprawdź ponownie po pobraniu plików.',
   INSTALL_UNCONFIRMED:'Instalator nie potwierdził aktualizacji. Spróbuj ponownie.',
   UPDATE_APP_BUSY:busyMessage,UPDATE_LOGIN_REQUIRED:'Otwórz aplikację i zaloguj się, aby bezpiecznie zainstalować aktualizację.',APP_BUSY:busyMessage,LF_ACTIVE_RAM_PROTECTED:busyMessage,LF_ACTIVE_FORM_PROTECTED:busyMessage
  };
  later.addEventListener('click',()=>{dismissed=candidate?.version;notice.hidden=true;});
  update.addEventListener('click',async()=>{
   if(installing||!candidate)return;
   if(navigator.onLine===false){show(messages.OFFLINE);return;}
   const target=candidate;
   if(target.protocol!==protocol||typeof FC.applicationStartup?.prepareClientUpdate!=='function'){
    show('Zakończ pracę, zamknij karty Meble-App i ponownie otwórz aplikację.',false);
    return;
   }
   installing=true;
   const body=document.body,wasInert=body.inert;
   body.inert=true;
   show('Instalowanie aktualizacji…',false);
   let reloading=false,marked=false;
   try{
    await FC.applicationStartup.prepareClientUpdate(async assertReady=>{
     assertReady();
     if(target.worker!==registration.waiting||service.controller?.scriptURL!==script.href)throw Error('CANDIDATE_CHANGED');
     window.sessionStorage.setItem(marker,target.version);marked=true;
     await activate({...target,registration,service},assertReady,()=>show('Oczekiwanie na uruchomienie nowej wersji…',false));
     show('Otwieranie nowej wersji…',false);
     const leaving=new Promise(resolve=>window.addEventListener('pagehide',resolve,{once:true}));
     reloading=true;
     try{window.location.reload();}
     catch(_){show('Nowa wersja jest gotowa. Odśwież tę kartę Meble-App, aby ją otworzyć.',false);}
     await leaving;
    });
   }catch(error){
    if(marked&&!reloading)try{window.sessionStorage.removeItem(marker);}catch(_){}
    show(messages[error?.code||error?.message]||'Nie udało się przełączyć wersji. Sprawdź aktualizację ponownie.');
   }finally{
    if(!reloading){installing=false;body.inert=wasInert;}
   }
  });
  async function inspect(){
   const worker=registration?.waiting;
   if(installing||!worker||worker.scriptURL!==script.href||registration.scope!==root.href)return;
   const result=await rpc(worker,{type:'VERIFY_STATIC_SHELL',activation:true});
   if(installing||result?.complete!==true||!validVersion(result.version)||registration.waiting!==worker)return;
   const previous=candidate?.version;
   candidate={worker,version:result.version,protocol:result.activationProtocol};
   if(previous!==result.version&&dismissed!==result.version){
    show('Nowa wersja gotowa.');
   }
  }
  async function confirmInstalled(){
   if(confirmed)return;
   try{
    const expected=window.sessionStorage.getItem(marker),active=service.controller;
    if(!validVersion(expected)||active?.scriptURL!==script.href)return;
    const result=await rpc(active,{type:'VERIFY_STATIC_SHELL'});
    if(result?.complete!==true||result.version!==expected||active!==service.controller)return;
    window.sessionStorage.removeItem(marker);confirmed=true;
    if(!candidate)show('Aplikacja zaktualizowana.',false);
   }catch(_){}
  }
  function watch(){
   const worker=registration.installing;
   worker?.addEventListener('statechange',()=>{if(worker.state==='installed')void inspect();});
  }
  async function check(){
   if(checking||installing||navigator.onLine===false)return;
   checking=true;
   try{
    if(!registration){
     registration=await service.register(script,{scope:root.pathname,updateViaCache:'none'});
     registration.addEventListener('updatefound',watch);watch();
    }
    await registration.update();await inspect();
   }catch(_){/* Offline/failed install keeps the previous verified shell. */}
   finally{checking=false;}
  }
  window.addEventListener('online',check);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void check();});
  await Promise.all([confirmInstalled(),check()]);
 }
 FC.offlineUpdate={start};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void start(),{once:true});else void start();
})();
