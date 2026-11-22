// New registry protocol; LIVE requires a verified room deployment permit.
import {assertP0BConnection} from '../../sync/firebase-activation.mjs';
import {equal, fail, id, json} from '../../sync/local-first-values.mjs';
import {createP0BPin} from './p0b-pin.mjs';
import {p0bDeletionGroup} from './p0b-deletion-group.mjs';

function checkContact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.hasOwn(value,'rooms'))
    fail('LF_P0B_CONTACT_INVALID');
  checkContactFields(value);
}

function checkContactFields(value) {
  for(const [key,field] of Object.entries(value)){
    if(['apiKey','accessToken','refreshToken','privateKey','password'].includes(key))
      fail('LF_P0B_CONTACT_INVALID');
    if(Number.isInteger(field) && !Number.isSafeInteger(field)) fail('LF_P0B_CONTACT_INVALID');
    if(field && typeof field==='object') checkContactFields(field);
  }
}

export function encodeP0BContact(value, iid) {
  const serialized = json(value);
  checkContact(value);
  if (Object.hasOwn(value,'id') && value.id !== iid || serialized.length <= 2 || serialized.length > 100000)
    fail('LF_P0B_CONTACT_INVALID');
  return serialized;
}

export function splitP0BLegacyContact(raw, verifiedProjectRooms) {
  const {rooms,...contact}=raw;
  // Moving the mirror requires a proof of its entire contents, including unknown fields.
  if(!Array.isArray(rooms) || !Array.isArray(verifiedProjectRooms) || !equal(rooms,verifiedProjectRooms))
    fail('LF_P0B_ROOM_OWNERSHIP_UNCONFIRMED');
  return {contact:JSON.parse(encodeP0BContact(contact,raw.id)),rooms:structuredClone(verifiedProjectRooms)};
}

function isIdle(record) {
  return !Object.values(record.projects).some(Boolean) && !Object.keys(record.visits).length;
}

export function validateP0BDeletionIntent(intent) {
  id(intent.operationId);
  if(intent.targets){
    const targets = Object.entries(intent.targets);
    if(targets.length < 2 || targets.length > 512) fail('LF_P0B_DELETE_INTENT_INVALID');
    for(const [iid,generation] of targets) {
      id(iid);
      if(!Number.isSafeInteger(generation) || generation < 1) fail('LF_P0B_DELETE_INTENT_INVALID');
    }
    json(intent.targets);
    return {operationId:intent.operationId,targets:Object.fromEntries(targets.sort(([a],[b])=>a.localeCompare(b)))};
  }
  id(intent.investorId);
  if(!Number.isSafeInteger(intent.expectedGeneration) || intent.expectedGeneration < 1) fail('LF_P0B_DELETE_INTENT_INVALID');
  return {operationId:intent.operationId,investorId:intent.investorId,expectedGeneration:intent.expectedGeneration};
}

export const P0B_HEARTBEAT_MS=5*60*1000;

function lastEditorContact(editor, presence, head) {
  return Math.max(0,
    presence?.deviceId===editor.deviceId&&presence.epoch===editor.epoch ? presence.lastContactAt.toMillis() : 0,
    head?.deviceId===editor.deviceId&&head.editorEpoch===editor.epoch ? head.updatedAt.toMillis() : 0);
}

export function watchP0BEditorContact({send,window:w,onError=()=>{}}) {
  let stopped=false, pending=false, timer;
  async function contact(){
    if(stopped||pending||w.navigator.onLine===false)return;
    w.clearTimeout(timer);
    pending=true;
    try{await send();}catch(error){if(!stopped)onError(error);}
    finally{
      pending=false;
      if(!stopped)timer=w.setTimeout(contact,P0B_HEARTBEAT_MS);
    }
  }
  const wake=()=>{if(w.document.visibilityState!=='hidden')void contact();};
  w.addEventListener('online',wake);
  w.addEventListener('pageshow',wake);
  w.document.addEventListener('visibilitychange',wake);
  void contact();
  return ()=>{
    stopped=true;
    w.clearTimeout(timer);
    w.removeEventListener('online',wake);
    w.removeEventListener('pageshow',wake);
    w.document.removeEventListener('visibilitychange',wake);
  };
}

export function createP0BProtocol(connection, deviceId) {
  id(deviceId);
  const identity = assertP0BConnection(connection), {uid} = identity, {db, firestore:f} = connection;
  const guard = () => {
    if (!equal(assertP0BConnection(connection), identity)) fail('LF_AUTH_CHANGED');
    connection.assertAccess();
  };
  const ref = (collection, key) => f.doc(db, 'users', uid, collection, id(key));
  const investorRef = iid => ref('localFirstInvestors', iid);
  const editorRef = pid => ref('localFirstEditors', pid);
  const presenceRef = pid => f.doc(editorRef(pid),'presence','current');
  const headRef = pid => ref('localFirstProjects', pid);
  const pinRef = ref('p0bSettings','projectPin');
  const read = snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) fail('LF_SERVER_UNCONFIRMED');
    return snapshot.exists() ? snapshot.data() : null;
  };
  function active(record) {
    if (!record || record.schemaVersion !== 1) fail('LF_P0B_REGISTRY_REQUIRED');
    if (record.deletionId) fail('LF_P0B_INVESTOR_DELETED');
    if (record.bulkId) fail('LF_P0B_DELETE_CONFLICT');
    return record;
  }
  // Registry writes from this installation share one ordering lane. This is
  // not a retry: each caller still receives its one transaction's real result.
  let transactionWork=Promise.resolve();
  const transaction = (work,confirmLostResult) => {
    guard();
    const result=transactionWork.then(()=>{
      guard();
      return f.runTransaction(db,async tx=>{
        guard();const value=await work(tx);guard();return value;
      },{maxAttempts:1}).catch(async error=>{
        // Never replay a write. A visit can recover its lost result only from
        // an authorized server read of the exact complete post-transaction image.
        if(confirmLostResult)try{if(await confirmLostResult())return;}catch(_){}
        throw error;
      });
    });
    transactionWork=result.then(()=>undefined,()=>undefined);
    return result;
  };

  async function readServer(ref) {
    guard();
    const record=read(await f.getDocFromServer(ref));
    guard();
    return record;
  }
  const groups=p0bDeletionGroup({uid,ref,investorRef,transaction,read,readServer,isIdle});
  async function projectInvestor(record) {
    if(!record) return null;
    const group=record.bulkId ? await groups.state(record.bulkId) : null;
    if(record.bulkId && (!group || group.prepared[record.investorId] !== true)) fail('LF_P0B_ACK_UNCONFIRMED');
    if(record.deletionId || group?.phase==='committed')
      return {...record,deletionId:record.deletionId||group.operationId,contact:null};
    const contact=JSON.parse(record.contact);
    if(encodeP0BContact(contact,record.investorId)!==record.contact) fail('LF_P0B_CONTACT_INVALID');
    return {...record,contact};
  }
  async function investor(iid) {
    // An ACK must be ordered after this protocol's writes, independently of
    // any still-overlapping document-listener snapshot. Never retry a write.
    return projectInvestor(await transaction(async tx=>read(await tx.get(investorRef(iid)))));
  }

  function changeVisit(iid, token, label, open) {
    id(token);
    let expected;
    return transaction(async tx=>{
      const r=investorRef(iid), current=active(read(await tx.get(r)));
      const visits={...current.visits}, previous=visits[deviceId];
      if(open){
        if(previous?.token===token && previous.label===label) return;
        if(previous) fail('LF_P0B_VISIT_CONFLICT');
        if(typeof label!=='string'||label.length>64) fail('LF_P0B_DEVICE_LABEL_INVALID');
        visits[deviceId]={token,label};
      }else{
        if(previous?.token!==token) fail('LF_P0B_VISIT_CONFLICT');
        delete visits[deviceId];
      }
      expected={...current,generation:current.generation+1,lastVisit:deviceId,visits};
      tx.set(r,expected);
    },async()=>!!expected&&equal(await readServer(investorRef(iid)),expected));
  }

  async function changeLock({iid, pid, expectedHead, expectedEditor, deviceLabel = ''}, acquire) {
    return transaction(async tx => {
      const inv = investorRef(iid), editor = editorRef(pid);
      const current = active(read(await tx.get(inv)));
      const prior = read(await tx.get(editor));
      const head = read(await tx.get(headRef(pid)));
      if (Object.hasOwn(current.projects,pid) !== !!prior
        || prior && (prior.investorId !== iid || current.projects[pid] !== prior.active)
        || head && (!prior || head.investorId !== iid)) fail('LF_P0B_REGISTRY_REQUIRED');
      if ((head?.currentRevisionId || '') !== expectedHead) fail('LF_P0B_PROJECT_CONFLICT');
      let next;
      if (acquire) {
        if(head?.roomDeleted===true)fail('LF_ROOM_PROJECT_REMOVED');
        if (prior?.active) fail('LF_P0B_EDITOR_CONFLICT');
        if (typeof deviceLabel !== 'string' || deviceLabel.length > 64) fail('LF_P0B_DEVICE_LABEL_INVALID');
        next = {ownerUid:uid, investorId:iid, projectId:pid, deviceId, deviceLabel, active:true,
          epoch:(prior?.epoch || 0) + 1, headRevision:expectedHead};
      } else {
        if (!prior?.active || prior.deviceId !== deviceId || !equal(prior,expectedEditor)) fail('LF_P0B_EDITOR_CONFLICT');
        next = {...prior, active:false, headRevision:expectedHead};
      }
      guard();
      tx.set(inv, {...current, generation:current.generation + 1, lastProject:pid,
        projects:{...current.projects, [pid]:next.active}});
      tx.set(editor, next);
      return next;
    });
  }

  async function lockWitness(tx,iid,pid){
    const inv=active(read(await tx.get(investorRef(iid))));
    const editor=read(await tx.get(editorRef(pid)));
    const head=read(await tx.get(headRef(pid)));
    if(head?.roomDeleted===true)fail('LF_ROOM_PROJECT_REMOVED');
    if(!editor||editor.investorId!==iid||inv.projects[pid]!==editor.active
      ||!head||head.investorId!==iid||head.projectId!==pid)fail('LF_P0B_REGISTRY_REQUIRED');
    return {editor,revision:head.currentRevisionId};
  }
  function verifyDelete(record, intent) {
    if (record?.deletionId !== intent.operationId || record?.generation !== intent.expectedGeneration + 1)
      fail('LF_P0B_ACK_UNCONFIRMED');
    return {investorId:intent.investorId, operationId:intent.operationId, generation:record.generation};
  }

  const pin=createP0BPin({ref:pinRef,readServer,read,transaction});
  const api=Object.freeze({
    investor,pin,
    projectStatus(iid,pid){return transaction(tx=>lockWitness(tx,iid,pid));},
    async advanceEditor({iid,pid,expected,deviceLabel='',pinRevision=null}){
      if(typeof deviceLabel!=='string'||deviceLabel.length>64)fail('LF_P0B_DEVICE_LABEL_INVALID');
      return transaction(async tx=>{
        const current=await lockWitness(tx,iid,pid);
        if(!equal(current,expected))fail('LF_P0B_EDITOR_CONFLICT');
        const previous=current.editor;
        if(previous.active){
          if(previous.deviceId===deviceId)fail('LF_P0B_EDITOR_CONFLICT');
          if(!pinRevision||read(await tx.get(pinRef))?.revision!==pinRevision)fail('LF_P0B_PIN_CONFLICT');
        }else{
          const r=investorRef(iid), inv=active(read(await tx.get(r)));
          tx.set(r,{...inv,generation:inv.generation+1,lastProject:pid,projects:{...inv.projects,[pid]:true}});
        }
        const next={...previous,deviceId,deviceLabel,epoch:previous.epoch+1,active:true,headRevision:current.revision};
        tx.set(editorRef(pid),next);
        return next;
      });
    },
    async recoverOwnVisit(iid){
      const record=active(await readServer(investorRef(iid)));
      const visit=record.visits[deviceId];
      return visit ? {token:visit.token,label:visit.label} : null;
    },
    async heartbeat(pid, expectedEditor){
      const target=presenceRef(pid);
      const touch=await transaction(async tx=>{
        const editor=read(await tx.get(editorRef(pid)));
        if(!editor?.active||editor.deviceId!==deviceId||!equal(editor,expectedEditor))fail('LF_P0B_EDITOR_CONFLICT');
        const prior=read(await tx.get(target)), head=read(await tx.get(headRef(pid)));
        const last=lastEditorContact(editor,prior,head);
        const elapsed=Date.now()-last;
        if(last&&elapsed>=0&&elapsed<P0B_HEARTBEAT_MS)return {written:false,lastContactAt:last};
        tx.set(target,{deviceId,epoch:editor.epoch,lastContactAt:f.serverTimestamp()});
        return {written:true};
      });
      if(!touch.written)return touch;
      const confirmed=await readServer(target);
      if(confirmed?.epoch!==expectedEditor.epoch||confirmed.deviceId!==deviceId)fail('LF_P0B_ACK_UNCONFIRMED');
      return {...touch,lastContactAt:confirmed.lastContactAt.toMillis()};
    },
    watchEditorContact(pid, expectedEditor, window, onError){
      return watchP0BEditorContact({window,onError,send:()=>api.heartbeat(pid,expectedEditor)});
    },
    openInvestor(iid, token, label='') { return changeVisit(iid,token,label,true); },
    closeInvestor(iid,token) { return changeVisit(iid,token,'',false); },
    async listInvestors(){
      guard();
      const collection=f.collection(db,'users',uid,'localFirstInvestors'), records=[];
      let cursor;
      do{
        const query=f.query(collection,f.orderBy(f.documentId()),...(cursor?[f.startAfter(cursor)]:[]),f.limit(100));
        const page=await f.getDocsFromServer(query);
        guard();
        for(const doc of page.docs) records.push(await projectInvestor(read(doc)));
        cursor=page.size===100?page.docs.at(-1):null;
      }while(cursor);
      return records;
    },
    async listProjectHeads(){
      const records=await api.listInvestors(), projects=[];
      for(const record of records){
        if(record.deletionId) continue;
        for(const pid of Object.keys(record.projects)){
          const head=await readServer(headRef(pid));
          if(head&&(head.investorId!==record.investorId||head.projectId!==pid))
            fail('LF_P0B_REGISTRY_REQUIRED');
          projects.push({investorId:record.investorId,projectId:pid,head});
        }
      }
      return projects;
    },
    async presence(iid, online){
      if(!online()) return {state:'unconfirmed'};
      const inv=await investor(iid);
      if(!online() || !inv) return {state:'unconfirmed'};
      if(inv.deletionId) return {state:'deleted'};
      const projects=[];
      for(const [pid,held] of Object.entries(inv.projects)){
        if(!held) continue;
        const editor=await readServer(editorRef(pid));
        if(!editor?.active || editor.investorId!==iid) return {state:'unconfirmed'};
        const contact=lastEditorContact(editor,await readServer(presenceRef(pid)),await readServer(headRef(pid)));
        const elapsed=Date.now()-contact;
        projects.push({projectId:pid,deviceId:editor.deviceId,label:editor.deviceLabel,lastContactAt:contact||null,
          activity: contact&&elapsed>=0&&elapsed<=P0B_HEARTBEAT_MS?'recent':'unconfirmed'});
      }
      if(!online() || (await investor(iid))?.generation!==inv.generation || !online()) return {state:'unconfirmed'};
      const visits=Object.entries(inv.visits).map(([deviceId,visit])=>({deviceId,label:visit.label}));
      return {state:projects.length||visits.length||inv.bulkId?'held':'released',projects,visits,registry:{...inv.projects}};
    },
    watchPresence(iid, online, receive){
      let closed=false, request=0;
      const refresh=()=>{
        if(closed)return;
        const version=++request;
        if(!online()){receive({state:'unconfirmed'});return;}
        void api.presence(iid,online).then(value=>{
          if(!closed&&version===request) receive(value);
        },()=>{if(!closed&&version===request) receive({state:'unconfirmed'});});
      };
      guard();
      const stop=f.onSnapshot(investorRef(iid),refresh,()=>{
        if(!closed){request++;receive({state:'unconfirmed'});}
      });
      refresh();
      return {refresh,close(){closed=true;stop();}};
    },
    createInvestor(iid, contact) {
      return transaction(async tx => {
        const ref = investorRef(iid);
        if (read(await tx.get(ref))) fail('LF_P0B_INVESTOR_CONFLICT');
        tx.set(ref, {ownerUid:uid, investorId:iid, schemaVersion:1, generation:1, contactRevision:1, contact:encodeP0BContact(contact,iid),
          projects:{}, lastProject:'', visits:{}, lastVisit:'', bulkId:'', deletionId:''});
      });
    },
    updateContact(iid, expectedRevision, contact) {
      return transaction(async tx => {
        const ref = investorRef(iid), existing = active(read(await tx.get(ref)));
        if (existing.contactRevision !== expectedRevision) fail('LF_P0B_CONTACT_CONFLICT');
        tx.set(ref, {...existing, contact:encodeP0BContact(contact,iid), contactRevision:expectedRevision+1, generation:existing.generation+1});
      });
    },
    async lockStatus(iid, pid, online) {
      if (!online()) return {state:'unconfirmed'};
      return transaction(async tx => {
        const record = active(read(await tx.get(investorRef(iid))));
        const editor = read(await tx.get(editorRef(pid)));
        if (!Object.hasOwn(record.projects,pid) || editor?.investorId !== iid
          || record.projects[pid] !== editor.active) fail('LF_P0B_REGISTRY_REQUIRED');
        if (!online()) return {state:'unconfirmed'};
        return editor.active
          ? {state:'held',deviceId:editor.deviceId,deviceLabel:editor.deviceLabel}
          : {state:'released'};
      });
    },
    acquire(args) { return changeLock(args,true); },
    release(args) { return changeLock(args,false); },
    publishDeletion(intent) {
      intent=validateP0BDeletionIntent(intent);
      if(intent.targets) return groups.publish(intent);
      return transaction(async tx => {
        const ref = investorRef(intent.investorId), record = read(await tx.get(ref));
        if (record?.deletionId === intent.operationId) { verifyDelete(record,intent); return; }
        const existing = active(record);
        if (existing.generation !== intent.expectedGeneration) fail('LF_P0B_DELETE_CONFLICT');
        if (!isIdle(existing)) fail('LF_P0B_EDITOR_CONFLICT');
        const next = {...existing, generation:existing.generation+1, contact:'', lastProject:'', deletionId:intent.operationId};
        tx.set(ref,next);
        // A caller still needs a fresh read to acknowledge the write.
      });
    },
    async confirmDeletion(intent) {
      intent=validateP0BDeletionIntent(intent);
      return intent.targets?groups.confirm(intent):verifyDelete(await investor(intent.investorId),intent);
    }
  });
  return api;
}

export function createP0BDeletionIntent(selection, operationId) {
  for(const record of selection){
    if (record.schemaVersion !== 1 || record.deletionId || record.bulkId) fail('LF_P0B_REGISTRY_REQUIRED');
    if (!isIdle(record)) fail('LF_P0B_EDITOR_CONFLICT');
  }
  if(new Set(selection.map(record=>record.investorId)).size!==selection.length) fail('LF_P0B_DELETE_INTENT_INVALID');
  if(selection.length===1){
    const [record]=selection;
    return validateP0BDeletionIntent({operationId,investorId:record.investorId,expectedGeneration:record.generation});
  }
  return validateP0BDeletionIntent({operationId,targets:Object.fromEntries(selection.map(record=>[record.investorId,record.generation]))});
}

// Checks only the supplied subset. An empty result is not a proof that the
// registry enumerates all legacy projects; the startup audit reports coverage.
export function inspectP0BCompatibility({records, projectHeads, snapshots}) {
  const byId = new Map(records.map(record => [record.investorId, record]));
  const seen = new Map(), issues = [];
  for (const {investorId, contact} of snapshots) {
    if (!byId.has(investorId)) issues.push({code:'LF_P0B_LEGACY_CONTACT', investorId});
    if (seen.has(investorId) && !equal(seen.get(investorId),contact))
      issues.push({code:'LF_P0B_AMBIGUOUS_CONTACT', investorId});
    seen.set(investorId,contact);
  }
  for (const {projectId, investorId} of projectHeads) {
    const owner = byId.get(investorId);
    if (!owner || owner.schemaVersion !== 1 || !Object.hasOwn(owner.projects,projectId))
      issues.push({code:'LF_P0B_UNREGISTERED_PROJECT', investorId, projectId});
  }
  return issues;
}

export function projectP0BContact(record, project, offers) {
  if (record?.schemaVersion !== 1 || record.investorId !== project.investorId || !Object.hasOwn(record.projects,project.id))
    fail('LF_P0B_REGISTRY_REQUIRED');
  if (record.deletionId) fail('LF_P0B_INVESTOR_DELETED');
  // Read views assemble contact and project data; an archived payload's contact is never projected.
  return {contact:record.contact, project, offers};
}
