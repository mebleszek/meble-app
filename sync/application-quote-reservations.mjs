import {copy,equal,fail} from './local-first-values.mjs';
import {quoteReservationRequest,releasedQuoteReservation,verifyQuoteReservation} from './quote-reservation-contract.mjs';

// One lane per installation. The durable journal is written before a request
// or grant is sent. A reopened document reconciles the same token and epoch.
export function installQuoteReservations({window:w,store,protocol,getSync,getAuthority,label,assertAccess,onError,onGranted}){
 const fc=w.FC,remote=protocol.reservations;
 let closed=false,tail=Promise.resolve(),selection=null,preview=null,scheduled=false,publishing=false;
 let waitingForPublication=false,waitingForSave=false,prompted=null;
 const listeners=new Map(),editors=new Map(),deferredPrompts=new Map();
 const online=()=>!closed&&w.navigator.onLine!==false;
 const access=()=>{if(!online())fail('LF_OFFLINE');assertAccess();};
 const idle=()=>{access();getAuthority().assertIdle({allowForm:true});};
 const enqueue=fn=>{const step=tail.then(()=>{access();return fn();});tail=step.catch(()=>{});return step;};
 const includes=(target,iid,pid)=>target?.investorId===iid&&target.projectIds.includes(pid);
 const target=()=>preview||selection;
 const valid=iid=>fc.investors.getCurrentId()===iid&&w.uiState?.entry==='app'&&w.uiState.activeTab==='wycena';

 function schedule(){
  if(scheduled||!online()||publishing)return;
  scheduled=true;
  queueMicrotask(()=>{scheduled=false;if(online()&&!publishing)void enqueue(async()=>{
   await recoverGrants();
   if(await haveWork())await reconcile(target());
   else trimWatches([]);
  }).then(showRequest,error=>{if(error.code!=='LF_QUOTE_RESERVATION_SOURCE_CHANGED')onError(error);});});
 }
 async function haveWork(){
  return !!target()||(await store.pendingQuoteReservations()).length>0;
 }
 function watch(iid,pid){
  if(listeners.has(pid))return;
  listeners.set(pid,remote.watch(iid,pid,()=>{
   if(editors.has(pid))deferredPrompts.set(pid,iid);
   schedule();
  },error=>{listeners.get(pid)?.();listeners.delete(pid);onError(error);}));
 }
 function trimWatches(rows){
  for(const [pid,stop] of listeners){
   if(editors.has(pid)||target()?.projectIds.includes(pid)||rows.some(row=>row.intent.projectId===pid))continue;
   stop();listeners.delete(pid);
  }
 }
 function navigate(){
  const iid=fc.investors.getCurrentId();
  const picked=iid&&valid(iid)&&fc.wycenaTabSelectionModel?.normalizeDraftSelection(fc.quoteOfferStore?.getCurrentDraft());
  const next=picked?{investorId:iid,projectIds:picked.selectedRooms.slice()}:null;
  if(!equal(next,selection)){selection=next;preview=null;schedule();}
  else showRequest();
 }
 function previewSelection(iid,projectIds){
  if(!valid(iid))return;
  const next=projectIds===null?null:{investorId:iid,projectIds:[...new Set(projectIds)]};
  if(!equal(preview,next)){preview=next;schedule();}
 }
 const sameRequest=(intent,row)=>!!row&&equal({...row,state:'pending',revision:''},quoteReservationRequest(intent));
 function obsolete(expected,current){
  return current.editor.epoch>expected.editor.epoch||current.editor.epoch===expected.editor.epoch
   &&(current.revision!==expected.revision||expected.editor.active&&!current.editor.active);
 }
 async function settle(row,selected,{retry,pin,check=access}={}){
  const {intent}=row,{investorId:iid,projectId:pid,mode}=intent;
  if(!selected&&row.phase==='prepared'&&row.sent===false){
   await store.cancelUnsentQuoteReservation(row,check);return null;
  }
  let observed=await remote.inspect(iid,pid);
  if(!equal(row.receipt?.marker,observed.marker)
    &&await store.acknowledgeQuoteReservationLoss({expected:row,observed,assertAccess:access}))return null;
  if(row.phase==='prepared'){
   if(observed.marker?.token===intent.token&&observed.marker.active){
    row=await store.confirmQuoteReservation({expected:row,observed,assertAccess:access});
   }else if(mode==='request'&&sameRequest(intent,observed.request)){
    const request=observed.request,terminal=['declined','cancelled'].includes(request.state);
    if(terminal){
     if(selected&&!retry&&!pin)return {state:'declined',observed};
     await store.finishQuoteReservation({expected:row,observed,assertAccess:access});return null;
    }
    if(request.state!=='pending')fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    const editor=observed.status.editor;
    if(selected&&!pin&&editor.active&&editor.epoch===request.editorEpoch&&editor.deviceId===request.editorDeviceId)
     return {state:'waiting',observed};
    check();
    await remote.decide(request,'cancel');
    observed=await remote.inspect(iid,pid);
    await store.finishQuoteReservation({expected:row,observed,assertAccess:access});return null;
   }else if(obsolete(intent.expected,observed.status)&&observed.marker?.token!==intent.token){
    await store.abandonQuoteReservation({expected:row,observed,assertAccess:access});return null;
   }else if(!selected)return {state:'unconfirmed',observed};
   else if(mode==='request'){
    row=await store.markQuoteReservationSent(row,check);
    await remote.request(intent);
    return {state:'waiting',observed};
   }else if(mode==='free'||pin){
    row=await store.markQuoteReservationSent(row,check);
    await remote.reserve(intent,pin);
    observed=await remote.inspect(iid,pid);
    row=await store.confirmQuoteReservation({expected:row,observed,assertAccess:access});
   }else return {state:'unconfirmed',observed};
  }
  if(row.phase==='held'&&selected){
   verifyQuoteReservation(intent,observed.status,observed.marker,mode==='request'?observed.request:undefined);
   return {state:'reserved',observed};
  }
  if(row.phase==='held'){
   check();
   try{row=await store.beginQuoteReservationRelease(row,access);}
   catch(error){if(error.code!=='LF_QUOTE_RESERVATION_PUBLICATION_PENDING')throw error;waitingForPublication=true;return {state:'reserved',observed};}
  }
  const expectedRelease=releasedQuoteReservation(row.receipt.status,row.receipt.marker);
  if(!equal(observed.marker,expectedRelease.marker)){
   await remote.release(row.receipt);
   observed=await remote.inspect(iid,pid);
  }
  // The unchanged inactive marker proves the release even if an ordinary
  // editor subsequently took the room at a new epoch.
  if(equal(observed.marker,expectedRelease.marker)&&observed.status.editor.epoch>=expectedRelease.status.editor.epoch)
   observed={...observed,status:expectedRelease.status};
  await store.finishQuoteReservation({expected:row,observed,assertAccess:access});
  return null;
 }
 async function create(targetScope,pid,pin,check,expectedReservation){
  const iid=targetScope.investorId;
  let observed;
  if(expectedReservation){
   idle();check();
   const marker=expectedReservation.marker;
   if(marker.projectId!==pid||marker.investorId!==iid)fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
   observed=await remote.recover(expectedReservation,pin,()=>{idle();check();});
  }else observed=await remote.inspect(iid,pid);
  let editor=observed.status.editor;
  if(observed.marker?.active)return {state:'occupied',observed};
  if(editor.active&&editor.deviceId===store.deviceId){
   idle();check();
   await getSync().releaseEditor(pid);
   observed=await remote.inspect(iid,pid);editor=observed.status.editor;
   if(observed.marker?.active)return {state:'occupied',observed};
  }
  const mode=editor.active?(pin?'pin':'request'):'free';
  const pinRevision=mode==='pin'?await protocol.pin.verify(pin):null;
  const intent={key:'quote-reservation:'+pid,version:1,operationId:crypto.randomUUID(),token:crypto.randomUUID(),
   ownerUid:store.ownerUid,deviceId:store.deviceId,deviceLabel:label(),investorId:iid,projectId:pid,mode,pinRevision,expected:copy(observed.status)};
  const image=await store.readApplication();
  const row=await store.stageQuoteReservation({intent,image,assertAccess:()=>{idle();check();}});
  return settle(row,true,{pin,check});
 }
 async function reconcile(desired,{retry=false,pin,recoveries=[]}={}){
  const recoveryByRoom=new Map(recoveries);
  waitingForPublication=false;
  waitingForSave=false;
  const journal=await store.pendingQuoteReservations(),results=new Map();
  const check=()=>{access();if(!equal(desired,target())||desired&&!valid(desired.investorId))fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');};
  // An out-of-date callback must not cancel the selection of a newer picker.
  check();
  for(const row of journal){
   const {projectId:pid,investorId:iid}=row.intent;
   if(await store.retired(pid))continue;
   watch(iid,pid);
   const selected=includes(desired,iid,pid);check();
   try{
    const status=await settle(row,selected,{retry,pin:selected?pin:undefined,check});
    if(selected&&status)results.set(pid,status);
   }catch(error){if(selected)results.set(pid,{state:'unconfirmed',error});else onError(error);}
  }
  for(const pid of desired?.projectIds||[]){
   check();watch(desired.investorId,pid);
   if(results.has(pid)&&recoveryByRoom.has(pid))fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
   if(!results.has(pid))try{results.set(pid,await create(desired,pid,pin,check,recoveryByRoom.get(pid)));}
   catch(error){
    if(error.code==='LF_P0B_PIN_INCORRECT'||recoveryByRoom.has(pid))throw error;
    if(['LF_HANDOVER_PENDING_LOCAL_WORK','LF_QUOTE_RESERVATION_SOURCE_CHANGED'].includes(error.code))waitingForSave=true;
    results.set(pid,{state:'unconfirmed',error});
   }
  }
  trimWatches(await store.pendingQuoteReservations());
  return [...results].map(([projectId,item])=>({
   projectId,state:item?.state||'unconfirmed',name:fc.roomRegistry?.getRoomLabel?.(projectId)||projectId,
   deviceLabel:item?.observed?.status.editor.deviceLabel||'Nieznane urządzenie',
   ...(item?.state==='occupied'?{expectedReservation:copy(item.observed)}:{}),
  }));
 }

 async function recoverGrants(onlyScope){
  for(const record of await store.pendingQuoteGrants()){
   const {request,editor,revision}=record,pid=request.projectId;
   if(onlyScope&&onlyScope!==pid)continue;
   if(await store.retired(pid))continue;
   try{
    const inspect=()=>remote.inspect(request.investorId,pid);
    let observed=await inspect();
    if(equal(observed.request,request)){
     if(!equal(observed.status.editor,editor)||observed.status.revision!==revision)fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
     await remote.decide(request,'grant',revision);
     observed=await inspect();
    }
    const result=await store.finishQuoteGrant({expected:record,observed,assertAccess:access});
    if(result.granted){stopEditor(pid);onGranted(pid);}
    else if(onlyScope)fail('LF_QUOTE_RESERVATION_CANCELLED');
   }catch(error){if(onlyScope)throw error;onError(error);}
  }
 }
 async function respond(request,allowed){
  access();
  if(!allowed){await remote.decide(request,'decline');return;}
  const pid=request.projectId;
  const saved=await fc.applicationLifecycle.run(async()=>{
   access();
   if(fc.projectStore.getCurrentProjectId()!==pid||fc.investors.getCurrentId()!==request.investorId
    ||fc.investorEditorState?.hasUiLock()||(fc.session.active&&fc.session.projectId!==pid))
    fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
   if(fc.sessionNavigation.needsClosure()){
    if(!fc.session.active||!fc.sessionNavigation.confirmedFinish('save'))fail('LF_QUOTE_RESERVATION_SAVE_UNCONFIRMED');
   }
   await fc.tabNavigation.setActiveTab('inwestor');
   if(w.uiState.activeTab!=='inwestor')fail('LF_QUOTE_RESERVATION_SAVE_UNCONFIRMED');
   return true;
  },'project');
  if(saved===false||saved?.ok===false)fail('LF_QUOTE_RESERVATION_SAVE_UNCONFIRMED');
  const sync=getSync(),result=await sync.flush();
  if(!result.ok)fail(result.code);
  await enqueue(async()=>{
   idle();
   const image=await store.readApplication(),snap=await store.snapshot(pid),observed=await remote.inspect(request.investorId,pid);
   if(!equal(observed.request,request)||!equal(snap.replica?.editor,observed.status.editor)
    ||snap.replica?.base?.currentRevisionId!==observed.status.revision)fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
   await store.stageQuoteGrant({request,image,replica:snap.replica,assertAccess:idle});
   await recoverGrants(pid);
  });
 }
 function showRequest(){
  if(!online()||prompted||!deferredPrompts.size||fc.applicationStartup?.inspect()?.transactionPending
   ||w.document.querySelector('.panel-box-backdrop, .choice-box, .confirm-box, .info-box, #cabinetModal[style*="block"]'))return;
  const pid=fc.projectStore.getCurrentProjectId(),iid=deferredPrompts.get(pid);
  if(!iid||!editors.has(pid))return;
  deferredPrompts.delete(pid);
  prompted=pid;
  void (async()=>{
   const {request}=await remote.inspect(iid,pid);
   access();
   if(!request||request.state!=='pending'||request.editorDeviceId!==store.deviceId||request.editorEpoch!==editors.get(pid))return;
   if(!online()||fc.projectStore.getCurrentProjectId()!==pid||fc.applicationStartup?.inspect()?.transactionPending
    ||w.document.querySelector('.panel-box-backdrop, .choice-box, .confirm-box, .info-box, #cabinetModal[style*="block"]')){
    deferredPrompts.set(pid,iid);return;
   }
   const room=fc.roomRegistry?.getRoomLabel?.(pid)||pid,device=request.requesterDeviceLabel||'Drugie urządzenie';
   const answer=await fc.choiceBox.ask({title:'Prośba o pomieszczenie do wyceny',
    message:device+' prosi o pomieszczenie „'+room+'”. Po zatwierdzeniu aplikacja zapisze i zsynchronizuje projekt, a potem odda pomieszczenie do wyceny.',
    dismissValue:'dismiss',dismissOnOverlay:false,actions:[
     {value:'decline',text:'Nie',tone:'danger'},{value:'grant',text:'OK',tone:'success'},
    ]});
   if(answer==='grant'||answer==='decline')await respond(request,answer==='grant');
  })().then(()=>{prompted=null;showRequest();},error=>{prompted=null;deferredPrompts.set(pid,iid);onError(error);if(online())fc.infoBox?.open({
   title:'Przekazanie wstrzymane',message:'Nie potwierdzono przekazania pomieszczenia. '+(error.code||'LF_QUOTE_RESERVATION_UNCONFIRMED'),okOnly:true,
  });});
 }
 function stopEditor(pid){if(editors.delete(pid)){deferredPrompts.delete(pid);schedule();}}
 const wake=()=>{navigate();schedule();};
 w.addEventListener('online',wake);
 w.addEventListener('meble-sync-authorized',wake);
 w.document.addEventListener('visibilitychange',showRequest);
 w.document.addEventListener('click',showRequest);
 return {
  navigate,previewSelection,wake,
  trackEditor(pid,editor){editors.set(pid,editor.epoch);deferredPrompts.set(pid,editor.investorId);watch(editor.investorId,pid);showRequest();},
  stopEditor,
  async assertEditable(iid,pid,{reopen}={}){
   if(reopen&&online()&&(await store.pendingQuoteReservations()).some(row=>row.intent.projectId===pid&&row.phase!=='prepared'))
    await releaseForEditing([pid]);
   if(await store.pendingQuoteGrant(pid)
    ||(await store.pendingQuoteReservations()).some(row=>row.intent.projectId===pid))fail('LF_QUOTE_ROOM_RESERVED');
   if(online()&&(await store.snapshot(pid)).replica?.base&&(await remote.inspect(iid,pid)).marker?.active)fail('LF_QUOTE_ROOM_RESERVED');
  },
  syncCompleted(){if((waitingForPublication||waitingForSave)&&!publishing)schedule();else showRequest();},
  async ready(iid,projectIds,options){
   if(!valid(iid)||!projectIds.length||new Set(projectIds).size!==projectIds.length)fail('LF_QUOTE_RESERVATION_SOURCE_CHANGED');
   preview=null;selection={investorId:iid,projectIds:projectIds.slice()};
   return enqueue(async()=>{
    if(options&&Object.hasOwn(options,'pin'))await protocol.pin.verify(options.pin);
    return reconcile(selection,options);
   });
  },
  publication(active){publishing=active;if(!active)schedule();},
  releaseForEditing,
  close(){
   closed=true;for(const stop of listeners.values())stop();listeners.clear();
   w.removeEventListener('online',wake);w.removeEventListener('meble-sync-authorized',wake);
   w.document.removeEventListener('visibilitychange',showRequest);w.document.removeEventListener('click',showRequest);
  },
 };
 function releaseForEditing(scopes){
  return enqueue(async()=>{
   if(publishing)fail('LF_QUOTE_ROOM_RESERVED');
   if(selection)selection={...selection,projectIds:selection.projectIds.filter(pid=>!scopes.includes(pid))};
   preview=null;
   for(const row of await store.pendingQuoteReservations()){
    if(scopes.includes(row.intent.projectId)&&await settle(row,false))fail('LF_QUOTE_ROOM_RESERVED');
   }
  });
 }
}
