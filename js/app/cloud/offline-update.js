// Public update metadata and conservative navigation gate; never saves/discards business data.
(function(){
 'use strict';const FC=window.FC=window.FC||{};let started=false;
 function canLeave(){
  try{
   const access=window.__FC_MAIN_ACCESS__,session=FC.session,runtime=FC.applicationStartup?.inspect?.();
   if(navigator.onLine===false||access?.isValid()!==true||access.isLoading()!==false||!session||typeof session.isDirty!=='function'||session.isDirty()!==false)return false;
   if(session.active||session.snapshot||session.durable||FC.investorEditorState?.hasUiLock?.()!==false||FC.investorDeletion?.pending?.()!==false)return false;
   if(!runtime||!['local-only','active','offline','not-activated'].includes(runtime.state)||runtime.state!=='not-activated'&&(runtime.stage!=='ready'||runtime.transactionPending!==false))return false;
   if(window.localStorage.getItem('fc_edit_session_v1')!==null)return false;
   const ui=window.uiState;if(!ui||!['home','modeHub','investorsList'].includes(ui.entry)||ui.currentInvestorId||ui.roomType)return false;
   if([...document.querySelectorAll('.modal-back,.panel-box-backdrop,.confirm-backdrop')].some(node=>node.getClientRects().length))return false;
   return true;
  }catch(_){return false;}
 }
 async function start(){
  if(started||!window.navigator?.serviceWorker||!window.isSecureContext)return;started=true;
  const root=new URL('./',document.baseURI),script=new URL('offline-worker.js',root);
  let registration,checking=false;
  const notice=document.createElement('aside');notice.id='offline-update-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.hidden=true;
  const button=document.createElement('button');button.id='offline-update-open';button.type='button';button.className='btn';button.textContent='Dostępna nowa wersja — odśwież';
  const help=document.createElement('p');help.textContent='Zapisz lub świadomie anuluj edycję i wróć do listy inwestorów lub ekranu głównego. Przy niepewnym zapisie zachowaj kartę. Aktualizator otworzy się w tym samym oknie, wyłącznie po potwierdzeniu bezczynności i wyłączności.';help.hidden=true;
  button.addEventListener('click',async()=>{
   help.hidden=false;if(!canLeave())return;button.disabled=true;
   try{
    const worker=navigator.serviceWorker.controller;
    if(!worker||worker.scriptURL!==script.href||registration?.scope!==root.href)return;
    const nonce=window.crypto.randomUUID();
    const result=await new Promise(resolve=>{const c=new MessageChannel(),timer=setTimeout(()=>{c.port1.close();resolve(null);},5000);
     c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(e.data);};
     try{worker.postMessage({type:'VERIFY_APPLICATION_AUTHORITY',protocol:1,nonce},[c.port2]);}catch(_){clearTimeout(timer);c.port1.close();resolve(null);}});
    if(result?.protocol!==1||result.nonce!==nonce||result.exclusive!==true||navigator.serviceWorker.controller!==worker||!canLeave())return;
    window.location.assign(new URL('sw-update.html',root).href);
   }finally{button.disabled=false;}
  });notice.append(button,help);document.body.appendChild(notice);
  // A waiting worker has already passed atomic manifest installation. Require
  // its explicit complete acknowledgement, including exact scope/script.
  async function inspect(){
   const worker=registration?.waiting;if(!worker)return;
   if(worker.scriptURL!==script.href||registration.scope!==root.href)return;
   const result=await new Promise(resolve=>{const c=new MessageChannel(),timer=setTimeout(()=>{c.port1.close();resolve(null);},90000);
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
 FC.offlineUpdate={start,canLeave};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void start(),{once:true});else void start();
})();
