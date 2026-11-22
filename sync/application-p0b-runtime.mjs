import {applicationPresence} from './application-presence.mjs';
import {closeIdleApplicationVisits} from './application-visit-recovery.mjs';
// DEMO-only composition. All remote mutations still use the existing P0-B protocol.
import {createP0BProtocol,encodeP0BContact,createP0BDeletionIntent} from '../tools/firebase-pilot/p0b-protocol.mjs';
import {createP0BProjectRecovery} from '../tools/firebase-pilot/p0b-project-recovery.mjs';
import {openP0BDeletionJournal} from '../tools/firebase-pilot/p0b-deletion-journal.mjs';
import {createApplicationQuoteLedger} from './application-quote-ledger.mjs';
import {commitApplicationRooms} from './application-room-commit.mjs';
import {p0bConnection,p0bContact} from './application-p0b-domain.mjs';
import {createProjectChannel,validateProjectDependencies} from './local-first-project.mjs';
import {projectApplicationRows} from './application-replication.mjs';
import {openProjectRecovery} from './local-first-recovery-view.mjs';
import {copy,equal,fail,digest,id} from './local-first-values.mjs';
export async function createP0BRuntime({window:w,writer,reader,store,getAuthority,getSync,getGlobals,backupKeys,onError}){
 let closed=false;
 const fc=w.FC,presence=applicationPresence(fc),protocol=writer?createP0BProtocol(p0bConnection(writer),store.deviceId,()=>{if(closed)fail('LF_CLOSED');}):null,remoteReader=reader?p0bConnection(reader):null,remoteWriter=writer?p0bConnection(writer):null;
 const lostEditors=new Map();
 const preferredRooms=new Map();const remembered=await store.readApplication();if(remembered){const ui=JSON.parse(remembered.rows.fc_ui_v1||'{}');if(remembered.rows.fc_current_project_id_v1&&(ui.roomType||ui.lastRoomType))preferredRooms.set(remembered.rows.fc_current_project_id_v1,ui.roomType||ui.lastRoomType);}
 const contactScopes=new Map(),projectOwners=new Map(),heartbeats=new Map();let working=null,deletionJournal=null,deletionAdapter=null,deletionPending=false,deletionGeneration=0,recoveryOffered=false;
 const online=()=>!!protocol&&!closed&&w.navigator.onLine!==false;
 const assertAccess=()=>{w.__FC_MAIN_ACCESS__.assert();writer?.assertAccess();reader?.assertAccess();if(closed)fail('LF_CLOSED');};
 const label=()=>fc.localDeviceLabel?.display?.()||fc.localDeviceLabel?.read()||'';
 const contactScope=async iid=>{const scope='p0b_contact_'+await digest(id(iid));contactScopes.set(scope,iid);return scope;};
 function project(record){
  if(record.projectData)fc.roomProjectModel.validate(record);
  projectOwners.set(record.id,record.investorId);
  return createProjectChannel({writer:remoteWriter,reader:remoteReader,ownerUid:store.ownerUid,deviceId:store.deviceId,projectId:record.id,investorId:record.investorId,
   pilotContract:fc.cloudPilotContract,pilotFactory:fc.firebasePilotTransport,globalContract:fc.globalDataContract,projectContract:fc.businessProjectContract,
   globals:getGlobals(),editorProtocol:protocol,deviceLabel:label,projectCollection:'p0bRoomProjects',roomProtocol:true});
 }
 const quotes=writer?createApplicationQuoteLedger({fc,store,writer,reader,getSync,sourceChannel:(pid,iid)=>getSync()?.channel(pid)||project({id:pid,investorId:iid})}):null;
 async function contactChannel(iid){
  const scope=await contactScope(iid);
  const head=async record=>({generation:record.contactRevision,investorId:iid,hash:await digest(record.contact)});
  async function read(){
   assertAccess();const record=await protocol.investor(iid);
   if(!record)fail('LF_P0B_CONTACT_NOT_FOUND');if(record.deletionId)fail('LF_P0B_INVESTOR_DELETED');
   return {head:await head(record),value:{kind:'p0b-contact',investorId:iid,contact:record.contact}};
  }
  return {scope,kind:'contact',guard:assertAccess,read,
   watch:notify=>reader.firestore.onSnapshot(reader.firestore.doc(reader.db,'users',store.ownerUid,'p0bRoomInvestors',iid),notify,notify),
   async prepare(value,base){
    if(value.kind!=='p0b-contact'||value.investorId!==iid)fail('LF_APPLICATION_SCOPE_REFUSED');
    encodeP0BContact(value.contact,iid);
    const current=await protocol.investor(iid);
    if(current?.deletionId)fail('LF_P0B_INVESTOR_DELETED');
    if(current?!equal(await head(current),base):!!base)fail('LF_P0B_CONTACT_CONFLICT');
    const expected={generation:(base?.generation||0)+1,investorId:iid,hash:await digest(value.contact)};
    return {expected,publish:()=>current?protocol.updateContact(iid,base.generation,value.contact):protocol.createInvestor(iid,value.contact)};
   }
  };
 }
 async function list(known){
  assertAccess();const records=await protocol.listInvestors(),found=[];
  for(const record of records){
   if(record.deletionId){await receiveDeleted([record]);continue;}
   const scope=await contactScope(record.investorId);
   if(!known(scope))found.push(await contactChannel(record.investorId));
   const quote=await quotes.channel(record.investorId);if(!known(quote.scope))found.push(quote);
   for(const pid of Object.keys(record.projects))if(!known(pid))found.push(project({id:pid,investorId:record.investorId}));
  }
  return found;
 }
 const discovery={list,watch:notify=>reader.firestore.onSnapshot(reader.firestore.query(reader.firestore.collection(reader.db,'users',store.ownerUid,'p0bRoomInvestors'),reader.firestore.limit(100)),notify,notify)};
 async function projectRows(rows,ch,remote){
  if(ch.kind==='quote')return quotes.projectRows(rows,ch,remote);
  if(ch.kind==='contact'){
   const iid=contactScopes.get(ch.scope);if(remote.value.investorId!==iid)fail('LF_APPLICATION_SCOPE_REFUSED');
   const next=copy(rows),all=JSON.parse(rows.fc_investors_v1||'[]'),old=all.find(row=>row.id===iid);
   const contact={...copy(remote.value.contact),id:iid,rooms:old?.rooms||[]};
   next.fc_investors_v1=JSON.stringify(old?all.map(row=>row.id===iid?contact:row):[...all,contact]);return next;
  }
  if(ch.scope==='globals')return projectApplicationRows(rows,ch,remote,fc.globalDataContract,fc.businessProjectContract);
  const iid=projectOwners.get(ch.scope);
  if(!JSON.parse(rows.fc_investors_v1||'[]').some(row=>row.id===iid))fail('LF_P0B_REGISTRY_REQUIRED');
  const next=projectApplicationRows(rows,ch,remote,fc.globalDataContract,fc.businessProjectContract,{preserveInvestor:true,noAutoSelect:true,preserveOffers:true});
  const definitions=JSON.parse(next.fc_projects_v1||'[]').filter(row=>row.investorId===iid&&row.meta?.roomProject?.removed!==true).flatMap(row=>Object.values(row.projectData.meta.roomDefs));
  const all=JSON.parse(next.fc_investors_v1||'[]');next.fc_investors_v1=JSON.stringify(all.map(row=>row.id===iid?{...row,rooms:copy(definitions)}:row));
  return next;
 }
 async function commit(application,declaredScopes,{batchable=false}={}){
  const before=await store.readApplication(),old=JSON.parse(before.rows.fc_investors_v1||'[]'),next=JSON.parse(application.rows.fc_investors_v1||'[]');
  if(before.rows.fc_quote_snapshots_v1!==application.rows.fc_quote_snapshots_v1)return quotes.commit(application,declaredScopes);
  const priorProjects=JSON.parse(before.rows.fc_projects_v1||'[]'),nextProjects=JSON.parse(application.rows.fc_projects_v1||'[]');
  const added=nextProjects.filter(row=>!priorProjects.some(prior=>prior.id===row.id));
  if(!fc.investorEditorState?.state?.isEditing){
   for(const row of next){const prior=old.find(value=>value.id===row.id);if(!prior)continue;const a=p0bContact(row),b=p0bContact(prior);delete a.updatedAt;delete b.updatedAt;if(equal(a,b))row.updatedAt=prior.updatedAt;}
   application.rows.fc_investors_v1=JSON.stringify(next);
  }
  let changed=next.filter(row=>!equal(p0bContact(row),old.find(prior=>prior.id===row.id)&&p0bContact(old.find(prior=>prior.id===row.id))));
  if(changed.length&&nextProjects.some(row=>priorProjects.some(prior=>prior.id===row.id&&!equal(prior,row)))){
   // Project room mirrors may update their technical timestamp, not shared contact data.
   for(const row of changed){
    const prior=old.find(prior=>prior.id===row.id),a=p0bContact(row),b=prior&&p0bContact(prior);
    delete a.updatedAt;if(b)delete b.updatedAt;
    if(!prior||!equal(a,b))fail('LF_P0B_CONTACT_PROJECT_SCOPE_REFUSED');
    row.updatedAt=prior.updatedAt;
   }
   application.rows.fc_investors_v1=JSON.stringify(next);changed=[];
  }
  const modified=nextProjects.filter(row=>priorProjects.some(prior=>prior.id===row.id&&!equal(prior,row)));
  if(modified.length){
   if(changed.length||added.length||priorProjects.some(row=>!nextProjects.some(next=>next.id===row.id)))fail('LF_APPLICATION_SCOPE_REFUSED');
   return commitApplicationRooms({fc,store,getSync,application,records:modified,declaredScopes,batchable});
  }
  if(!changed.length&&!added.length)return null;
  if(changed.length>1||old.some(row=>!next.some(value=>value.id===row.id)))fail('LF_APPLICATION_SCOPE_REFUSED');
  const allowed=new Set(['fc_investors_v1','fc_projects_v1','fc_current_investor_v1','fc_current_project_id_v1','fc_ui_v1','fc_edit_session_v1']);
  for(const key of new Set([...Object.keys(before.rows),...Object.keys(application.rows)]))if(before.rows[key]!==application.rows[key]&&!allowed.has(key))fail('LF_APPLICATION_SCOPE_REFUSED');
  if(!equal(priorProjects,nextProjects.filter(row=>!added.some(value=>value.id===row.id))))fail('LF_APPLICATION_SCOPE_REFUSED');
  for(const row of added){const investor=next.find(value=>value.id===row.investorId);if(!investor)fail('LF_APPLICATION_SCOPE_REFUSED');fc.roomProjectModel.validate(row);fc.businessProjectContract.validate({project:row,investor:{...investor,rooms:[row.projectData.meta.roomDefs[row.id]]},offers:[]},{local:true});}
  if(changed.length){
   const investor=changed[0],iid=investor.id;if(await store.legacyInvestor(iid))fail('LF_P0B_LEGACY_SCOPE_REFUSED');const scope=await contactScope(iid),contact=p0bContact(investor);
   if(!equal(old.filter(row=>row.id!==iid),next.filter(row=>row.id!==iid)))fail('LF_APPLICATION_SCOPE_REFUSED');
   encodeP0BContact(contact,iid);
   const sync=getSync();if(sync&&!sync.channel(scope))sync.register(await contactChannel(iid));
   const snap=await store.snapshot(scope);
   return store.commitContact({scope,operationId:crypto.randomUUID(),value:{kind:'p0b-contact',investorId:iid,contact},
    expectedVersion:snap.replica?.version||0,application,protectedRows:application.rows,newProjects:added});
  }
  return store.checkpointP0BProjects(application,added);
 }
 async function preflightAcceptance(scopes){
  assertAccess();getAuthority().assertIdle({allowForm:true});
  const image=await store.readApplication(),records=JSON.parse(image.rows.fc_projects_v1||'[]');
  for(const pid of scopes){
   const record=records.find(row=>row.id===pid),snap=await store.snapshot(pid);
   if(!record||record.investorId!==image.rows.fc_current_investor_v1||record.meta?.roomProject?.removed||record.meta?.pendingDomainOperation)fail('LF_APPLICATION_SCOPE_REFUSED');
   if(!snap.replica||snap.replica.dirty||snap.operations.some(op=>op.phase!=='verified')||await store.retired(pid)||await store.pendingProjectRecovery(pid))fail('LF_LOCAL_PROJECT_NOT_READY');
   if(!online()){if(!snap.replica.editor?.active||snap.replica.editor.deviceId!==store.deviceId||lostEditors.has(pid))fail('LF_OFFLINE_EDITOR_REQUIRED');continue;}
   const remote=await protocol.projectStatus(record.investorId,pid);
   if(remote.editor?.active&&remote.editor.deviceId!==store.deviceId)fail('LF_QUOTE_EDITOR_BUSY');
  }
 }
 async function ensureNewProject(pid){
  const marker=(await store.pendingNewProjects()).find(row=>row.project.id===pid);if(!marker)return;
  if(!online())fail('LF_ONLINE_NEW_PROJECT_REQUIRED');
  const sync=getSync(),image=await store.readApplication(),record=JSON.parse(image.rows.fc_projects_v1||'[]').find(row=>row.id===pid);
  if(!equal(record,marker.project))fail('LF_P0B_NEW_PROJECT_SOURCE_CHANGED');
  const iid=record.investorId,card=await store.snapshot(await contactScope(iid));
  if(card.replica?.dirty||card.operations.some(row=>row.phase!=='verified')){const result=await sync.flush();if(!result.ok)fail(result.code);}
  const investor=await protocol.investor(iid);if(!investor||investor.deletionId)fail('LF_P0B_REGISTRY_REQUIRED');
  const ch=sync.channel(pid)||project(record);if(!sync.channel(pid))sync.register(ch);
  const catalogs=await store.snapshot('globals');if(!catalogs.replica?.base||catalogs.replica.dirty)fail('LF_GLOBAL_DEPENDENCIES_UNCONFIRMED');
  const built=await fc.businessProjectContract.build({getItem:key=>image.rows[key]??null},pid);
  const value={document:built.document,globals:{head:catalogs.replica.base,model:JSON.parse(catalogs.replica.json)},requirements:fc.businessProjectContract.dependencies(built.document.payload)};
  let snap=await store.snapshot(pid);
  if(!snap.replica){
   let editor=await ch.editor();
   if(editor?.active){if(editor.deviceId!==store.deviceId||editor.investorId!==iid||editor.headRevision!=='')fail('LF_P0B_EDITOR_CONFLICT');}
   else editor=await ch.acquire(null);
   assertAccess();await store.apply({scope:pid,value,head:null,expectedVersion:0,editor});snap=await store.snapshot(pid);
  }
  const operationId=marker.operationId||'initial-'+pid;
  const existing=snap.operations.find(row=>row.key===operationId);
  if(existing){const prior=JSON.parse(existing.json);if(!equal(prior.document?.payload?.project,record)||existing.editor?.deviceId!==store.deviceId)fail('LF_P0B_NEW_PROJECT_SOURCE_CHANGED');}
  else await store.commit({scope:pid,operationId,value,expectedVersion:snap.replica.version,editor:snap.replica.editor,protectedRows:image.rows,releaseAfterSync:marker.releaseAfterSync===true});
  await store.finishNewProject(pid,marker,operationId);sync.notify(pid);
 }
 function watchEditor(pid,editor){
  if(!protocol||closed)return;
  if(heartbeats.get(pid)?.epoch===editor.epoch)return;
  heartbeats.get(pid)?.stop();
  heartbeats.set(pid,{epoch:editor.epoch,stop:protocol.watchEditorContact(pid,editor,w,onError)});
 }
 let visitWork=Promise.resolve(),visitCleanupPending=true;
 function syncVisit(next,previous){
  const result=visitWork.then(()=>changeVisit(next,previous));visitWork=result.then(()=>undefined,()=>undefined);return result;
 }
 async function changeVisit(next,previous){
  if(!online())return;
  if(next)await protocol.ensureInvestorVisit(next,label());
  if(previous&&previous!==next){const record=await protocol.investor(previous);if(record?.deletionId)return;const visit=await protocol.recoverOwnVisit(previous);if(visit)await protocol.closeInvestor(previous,visit.token);}
 }
 async function checkpoint(application,perform){
  const before=await store.readApplication(),next=application.rows.fc_current_investor_v1,previous=before.rows.fc_current_investor_v1;
  if(next!==previous&&next&&online())await syncVisit(next,null);
  const result=await perform();
  if(next!==previous)getAuthority().afterCommit(()=>{visitCleanupPending=true;void syncVisit(null,previous).catch(onError);});
  return result;
 }
 function recovery(pid){
  const iid=projectOwners.get(pid);if(!iid)fail('LF_P0B_REGISTRY_REQUIRED');
  return createP0BProjectRecovery({store,protocol,channel:getSync().channel(pid),investorId:iid,assertAccess,
   roomContract:{validateRoom:value=>fc.projectExportContract.validateOwnedRoom(value),
    createRoomProject:(iid,plan)=>fc.roomProjectModel.create(iid,{...plan.definition,projectStatus:'nowy'},plan.room),
    async validateRoomProject(record,plan,remote){fc.roomProjectModel.validate(record);if(record.id!==plan.id||!equal(record.projectData[record.id],plan.room))fail('LF_ROOM_COPY_SCOPE_UNCONFIRMED');const card=remote.value.document.payload.investor;const document={payload:{project:record,investor:{...card,rooms:[record.projectData.meta.roomDefs[record.id]]},offers:[]}};fc.businessProjectContract.validate(document.payload);validateProjectDependencies(fc.businessProjectContract,fc.globalDataContract,document,remote.value.globals.model);},
    summarize:data=>fc.projectModel.summarizeProjectData(data),
    async build(rows,remote){const built=await fc.businessProjectContract.build({getItem:key=>rows[key]??null},pid);return {document:built.document,globals:copy(remote.value.globals),requirements:fc.businessProjectContract.dependencies(built.document.payload)};}}});
 }
 async function openRecovery({projectId,roomId=w.uiState?.roomType}={}){
  if(w.document.getElementById('cabinetModal')?.style.display==='block'||fc.investorEditorState?.hasUiLock?.())fail('LF_ACTIVE_FORM_PROTECTED');
  const pid=projectId||w.localStorage.getItem('fc_current_project_id_v1');roomId=roomId||preferredRooms.get(pid)||pid;
  await openProjectRecovery({window:w,service:recovery(pid),roomId,deviceLabel:label(),onConfirmed(){w.location.reload();}});
 }
 async function receiveDeleted(records){
  return store.exclusive(async()=>{
  await store.fenceP0BTombstones(records,{projectData:copy(w.projectData||{}),ui:copy(w.uiState||{}),session:fc.session?.exportDraft?.()||null});
  const authority=getAuthority();if(!authority)return;
  const before=await store.readApplication(),present=JSON.parse(before.rows.fc_investors_v1||'[]'),ids=records.filter(record=>present.some(row=>row.id===record.investorId)).map(row=>row.investorId);
  if(!ids.length)return;
  try{authority.assertIdle({allowForm:false});}catch(_){fail('LF_P0B_DELETION_RECOVERY_REQUIRED');}
  const source={...before.rows};for(const key of ['fc_investors_v1','fc_projects_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_investor_removed_ids_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1','fc_project_v1'])source[key]??=null;
  const plan=fc.investorDeletion.planLocal(source,ids);
   const application=await authority.incoming(plan.after);
   await store.checkpointP0BTombstones({application,records,assertAccess,context:{registry:'p0b-rooms-v1'}});
   await authority.refresh();
  });
 }
 async function reconcileDeletes(){
  if(!deletionJournal||!online())return;
  const observed=deletionGeneration;
  for(const operation of await deletionJournal.all()){
   const current=await deletionJournal.reconcile(operation.operationId,protocol,online);
   if(current.phase==='verified'){
    const ids=current.receipt.investorIds||[current.receipt.investorId];
    const records=await Promise.all(ids.map(iid=>protocol.investor(iid)));
    if(records.some(record=>record.deletionId!==current.receipt.operationId))fail('LF_P0B_ACK_UNCONFIRMED');
    await receiveDeleted(records);
   }else fail(current.code||'LF_P0B_ACK_UNCONFIRMED');
  }
  if(observed===deletionGeneration)deletionPending=false;
 }
 async function installDeletion(){
  if(!deletionJournal)deletionJournal=await openP0BDeletionJournal({indexedDB:w.indexedDB,locks:w.navigator.locks,ownerUid:store.ownerUid,deviceId:store.deviceId,registry:'p0b-rooms-v1'});
  const localIds=JSON.parse((await store.readApplication()).rows.fc_investors_v1||'[]').map(row=>row.id);
  deletionPending=(await deletionJournal.all()).some(op=>op.phase!=='verified'||(op.receipt?.investorIds||[op.receipt?.investorId]).some(iid=>localIds.includes(iid)));
  const tokens=new WeakMap();
  const idle=()=>{assertAccess();getAuthority().assertIdle({allowForm:true});if(w.uiState?.entry!=='investorsList'||w.uiState?.currentInvestorId||fc.investorEditorState?.hasUiLock?.())fail('DELETE_CONTEXT_PROTECTED');};
  deletionAdapter={
   pending:()=>deletionPending,
   async resumePending(){if(!online())fail('DELETE_CONNECTION_UNCONFIRMED');await reconcileDeletes();return !deletionPending;},
   canPrepare(){try{idle();return online();}catch(_){return false;}},
   async prepare(ids){
    idle();if(!online())fail('DELETE_CONNECTION_UNCONFIRMED');
    const image=await store.readApplication(),source={...image.rows};for(const key of ['fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_investor_removed_ids_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1','fc_project_v1'])source[key]??=null;
    const plan=fc.investorDeletion.planLocal(source,ids),records=await Promise.all(ids.map(iid=>protocol.investor(iid)));
    const intent=createP0BDeletionIntent(records,crypto.randomUUID());
    const token=Object.freeze({...plan.count,names:plan.names,backups:backupKeys().length,archiveRecords:(await store.snapshot('p0b-archives')).protected.length,deletionReceipts:(await deletionJournal.all()).filter(row=>row.phase==='verified').length});
    tokens.set(token,{ids,records,intent,image});return token;
   },
   async commit(token){
    idle();const proof=tokens.get(token);if(!proof)fail('DELETE_CONFIRMATION_REQUIRED');tokens.delete(token);
    if((await store.readApplication()).version!==proof.image.version)fail('DELETE_SOURCE_CHANGED');
    const fresh=await Promise.all(proof.ids.map(iid=>protocol.investor(iid)));
    if(!equal(fresh,proof.records))fail('DELETE_SELECTION_CHANGED');
    createP0BDeletionIntent(fresh,proof.intent.operationId);
    await deletionJournal.enqueue(proof.intent);deletionGeneration++;deletionPending=true;
    const result=await deletionJournal.reconcile(proof.intent.operationId,protocol,online);
    if(result.phase!=='verified')fail(result.code||'LF_P0B_ACK_UNCONFIRMED');
    const records=await Promise.all(proof.ids.map(iid=>protocol.investor(iid)));
    await receiveDeleted(records);deletionPending=false;
    return {ok:true,localConfirmed:true,cloudConfirmed:true};
   }
  };fc.localInvestorDeletion=deletionAdapter;
 }
 async function canRecover(result){
  if(!online()||!['LF_EDITOR_CONFLICT','LF_EDITOR_RECOVERY_BLOCKED','LF_P0B_EDITOR_CONFLICT','LF_ACK_UNRESOLVED'].includes(result?.code))return false;
  const image=await store.readApplication(),scopes=result.blockedScopes||[image.rows.fc_current_project_id_v1];
  if(!scopes.length||scopes.some(scope=>!scope||scope==='globals'||scope.startsWith('p0b_contact_')))return false;
  for(const scope of scopes){
   const snap=await store.snapshot(scope),record=JSON.parse(image.rows.fc_projects_v1||'[]').find(row=>row.id===scope);
   if(!record||!snap.replica?.editor?.active)return false;
   const status=await protocol.projectStatus(record.investorId,scope);
   if(equal(status.editor,snap.replica.editor))return false;
   lostEditors.set(scope,status.editor);heartbeats.get(scope)?.stop();heartbeats.delete(scope);
  }
  return true;
 }
 async function offerRecovery(){
  const pid=getAuthority().rows().fc_current_project_id_v1;
  if(!lostEditors.has(pid)||recoveryOffered)return;
  recoveryOffered=true;
  try{await openRecovery();}catch(error){onError(error);}
 }
 async function resume(){
  if(working)return working;
  working=(async()=>{
   for(const [pid,heartbeat]of heartbeats){
    const snap=await store.snapshot(pid);
    if(!snap.replica?.editor?.active||snap.replica.editor.deviceId!==store.deviceId||snap.replica.editor.epoch!==heartbeat.epoch||await store.retired(pid)){
     heartbeat.stop();heartbeats.delete(pid);
    }
   }
   await reconcileDeletes();for(const marker of await store.pendingNewProjects())await ensureNewProject(marker.project.id);
   // A visit can outlive an offline Exit. Only a verified, durably idle local
   // UI may close this installation's own visit token; never another device
   // or a project lock, and never merely because its heartbeat is old.
   if(visitCleanupPending&&online()){
    const cleanup=visitWork.then(async()=>{if(await closeIdleApplicationVisits({authority:getAuthority(),protocol,deviceId:store.deviceId,assertAccess,sessionActive:()=>!!fc.session?.active}))visitCleanupPending=false;});
    visitWork=cleanup.then(()=>undefined,()=>undefined);await cleanup;
   }
   const current=!['home','modeHub','investorsList'].includes(w.uiState?.entry)?w.uiState?.currentInvestorId:null;
   if(current&&online()){
    await syncVisit(current,null);
    const pid=w.localStorage.getItem('fc_current_project_id_v1');
    if(pid&&!lostEditors.has(pid)&&!heartbeats.has(pid)){
     const snap=await store.snapshot(pid),editor=snap.replica?.editor;
     if(editor?.active&&editor.deviceId===store.deviceId){const status=await protocol.projectStatus(current,pid);if(equal(status.editor,editor))watchEditor(pid,editor);else lostEditors.set(pid,status.editor);}
    }
   }
  })().finally(()=>{working=null;});return working;
 }
 async function bind(){
  if(quotes)fc.roomQuoteProof=quotes.proof;
  if(protocol)await installDeletion();
  presence.bind(protocol);fc.investorPresence=presence;if(protocol)fc.projectTakeoverPin=protocol.pin;fc.projectRecovery={open:openRecovery};
 }
 function close(){closed=true;if(quotes&&fc.roomQuoteProof===quotes.proof)delete fc.roomQuoteProof;for(const value of heartbeats.values())value.stop();heartbeats.clear();presence.detach(protocol);if(protocol&&fc.projectTakeoverPin===protocol.pin)delete fc.projectTakeoverPin;delete fc.projectRecovery;if(fc.localInvestorDeletion===deletionAdapter)delete fc.localInvestorDeletion;deletionJournal?.close();}
 return {protocol,discovery,project,projectRows,commit,checkpoint,preflightAcceptance,ensureNewProject,watchEditor,recovery,isLost:scope=>lostEditors.has(scope),canRecover,offerRecovery,resume,bind,close,
  suspendPresence(){presence.detach(protocol);},refreshPresence(){if(!closed&&!presence.bind(protocol))presence.refresh();}};
}
