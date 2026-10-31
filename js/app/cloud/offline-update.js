// Public update metadata only. Never reads business storage or changes clients.
(function(){
 'use strict';const FC=window.FC=window.FC||{};let started=false;
 async function start(){
  if(started||!window.navigator?.serviceWorker||!window.isSecureContext)return;started=true;
  const root=new URL('./',document.baseURI),script=new URL('offline-worker.js',root);
  let registration,checking=false;
  const notice=document.createElement('aside');notice.id='offline-update-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Dostępna nowa wersja — odśwież';
  const help=document.createElement('p');help.textContent='Najpierw zapisz lub świadomie anuluj edycję. Zamknij wszystkie karty Meble-App w tej przeglądarce, także tę, i otwórz aplikację ponownie. Nie usuwaj danych przeglądarki. Przy niepewnym zapisie zachowaj otwartą kartę i użyj diagnostyki sesji.';help.hidden=true;
  button.addEventListener('click',()=>{help.hidden=false;});notice.append(button,help);document.body.appendChild(notice);
  // A waiting worker has already passed atomic manifest installation. Require
  // its explicit complete acknowledgement, including exact scope/script.
  async function inspect(){
   const worker=registration?.waiting;if(!worker)return;
   if(worker.scriptURL!==script.href||registration.scope!==root.href)return;
   const result=await new Promise(resolve=>{const c=new MessageChannel(),timer=setTimeout(()=>{c.port1.close();resolve(null);},5000);
    c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(e.data);};worker.postMessage({type:'VERIFY_STATIC_SHELL'},[c.port2]);});
   if(result?.complete===true&&/^[a-f0-9]{64}$/.test(result.version||'')&&registration.waiting===worker)notice.hidden=false;
  }
  async function check(){if(checking||navigator.onLine===false)return;checking=true;
   try{registration=await navigator.serviceWorker.register(script,{scope:root.pathname,updateViaCache:'none'});
    const watch=()=>{const w=registration.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed')void inspect();});};
    registration.addEventListener('updatefound',watch);watch();
    await registration.update();await inspect();
   }catch(_){/* Offline/failed install preserves current shell and data. */}finally{checking=false;}
  }
  window.addEventListener('online',check);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void check();});
  await check();
 }
 FC.offlineUpdate={start};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void start(),{once:true});else void start();
})();
