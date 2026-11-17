// The candidate uses the existing project channel for independently verified
// chunks, project ownership, hashes and pinned global dependencies.
import {prepareRoomCopy,appendRoomCopy} from '../../sync/local-first-room-copy.mjs';
import {copy,equal,fail,id,digest,json} from '../../sync/local-first-values.mjs';

const unownedKeys=['fc_edge_v1','fc_material_part_options_v1','fc_rozrys_grain_state_v1','fc_rozrys_overrides_v1'];
const nonEmpty=raw=>raw!=null&&!['[]','{}'].includes(raw.trim());

function replacement(image,scope,iid,remote){
  const rows=image.rows;
  if(unownedKeys.some(key=>nonEmpty(rows[key])))fail('LF_PROJECT_OWNERSHIP_PENDING');
  const projects=JSON.parse(rows.fc_projects_v1||'[]');
  const target=projects.filter(project=>project.id===scope);
  const project=remote.value.document.payload.project;
  if(target.length!==1||target[0].investorId!==iid||project.id!==scope||project.investorId!==iid
    ||remote.value.document.payload.investor.id!==iid||target[0].meta?.pendingDomainOperation)fail('LF_PROJECT_RECOVERY_SCOPE');
  // Preserve prior accepted snapshots and add independently verified history.
  // Reusing the same ID for different content is an explicit conflict.
  const offers=JSON.parse(rows.fc_quote_snapshots_v1||'[]'),received=remote.value.document.payload.offers;
  const byId=new Map(offers.map(offer=>[offer.id,offer]));
  if(byId.size!==offers.length||new Set(received.map(offer=>offer.id)).size!==received.length)fail('LF_PROJECT_RECOVERY_HISTORY');
  const additions=received.filter(offer=>{
    const prior=byId.get(offer.id);
    if(prior&&!equal(prior,offer))fail('LF_PROJECT_RECOVERY_HISTORY');
    return !prior;
  });
  const drafts=JSON.parse(rows.fc_quote_offer_drafts_v1||'[]');
  if(drafts.some(draft=>!draft.projectId||!draft.investorId||draft.projectId===scope&&draft.investorId!==iid))
    fail('LF_PROJECT_RECOVERY_SCOPE');
  const draft=JSON.parse(rows.fc_edit_session_v1||'null');
  if(draft&&(draft.projectId!==scope||rows.fc_current_project_id_v1!==scope||rows.fc_current_investor_v1!==iid
    ||draft.schemaVersion!==4||draft.active!==true||draft.expectedOwnerKnown!==true))fail('LF_PROJECT_RECOVERY_SCOPE');
  return {expectedVersion:image.version,rows:{
    ...rows,
    fc_projects_v1:JSON.stringify(projects.map(row=>row.id===scope?project:row)),
    ...(additions.length?{fc_quote_snapshots_v1:JSON.stringify(offers.concat(additions))}:{}),
    ...(draft?{fc_edit_session_v1:null}:{}),
    ...(drafts.some(entry=>entry.projectId===scope)?{
      fc_quote_offer_drafts_v1:JSON.stringify(drafts.filter(entry=>entry.projectId!==scope))
    }:{}),
  }};
}

export function createP0BProjectRecovery({store,protocol,channel,investorId,assertAccess,roomContract}){
  const scope=id(channel.scope), iid=id(investorId);
  const observe=()=>protocol.projectStatus(iid,scope);
  async function source(){
    assertAccess();
    const image=await store.readApplication(),local=await store.snapshot(scope);
    if(!image||!local.replica)fail('LF_PROJECT_RECOVERY_SOURCE_REQUIRED');
    return {image,...local};
  }
  function roomCopyStatus(image){
    const unresolved=unownedKeys.filter(key=>nonEmpty(image.rows[key]));
    if(!roomContract)unresolved.push('room-contract');
    return {available:unresolved.length===0,unresolved,code:unresolved.length?'LF_PROJECT_OWNERSHIP_PENDING':null};
  }
  async function readCurrent(revision){
    const remote=await channel.read();
    if(remote.head?.currentRevisionId!==revision)fail('LF_PROJECT_RECOVERY_CONFLICT');
    return remote;
  }
  async function finish(marker){
    if(!['latest','room-copy'].includes(marker.variant))fail('LF_P0B_RECOVERY_VARIANT_REQUIRED');
    if(marker.variant==='room-copy'&&(!marker.roomCopy
      ||await digest(json(marker.roomCopy))!==marker.roomCopyHash))fail('LF_LOCAL_INTEGRITY');
    const before=await source();
    if(before.image.version!==marker.applicationVersion||before.image.hash!==marker.applicationHash
      ||before.replica.version!==marker.replicaVersion)fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');
    const {expected,deviceLabel,pinRevision}=marker;
    const next={...expected.editor,deviceId:store.deviceId,deviceLabel,active:true,
      epoch:expected.editor.epoch+1,headRevision:expected.revision};
    const confirmed={editor:next,revision:expected.revision};
    const witness=await observe();
    if(equal(witness,expected)){
      const updated=await protocol.advanceEditor({iid,pid:scope,expected,deviceLabel,pinRevision});
      if(!equal(updated,next))fail('LF_P0B_ACK_UNCONFIRMED');
    }else if(!equal(witness,confirmed))fail('LF_PROJECT_RECOVERY_CONFLICT');
    const remote=await readCurrent(expected.revision);
    const application=replacement(before.image,scope,iid,remote);
    let queuedValue;
    if(marker.variant==='room-copy'){
      if(!roomContract||!marker.roomCopy)fail('LF_ROOM_COPY_VALIDATOR_REQUIRED');
      const payload=remote.value.document.payload;
      const project=appendRoomCopy(payload.project,marker.roomCopy,roomContract);
      application.rows.fc_projects_v1=JSON.stringify(JSON.parse(application.rows.fc_projects_v1).map(row=>row.id===scope?project:row));
      queuedValue=await roomContract.build(application.rows,remote);
      // The normal channel validates geometry, dependency closure and the editor.
      await channel.prepare(queuedValue,remote.head,next);
    }
    if(!equal(await observe(),confirmed))fail('LF_PROJECT_RECOVERY_CONFLICT');
    assertAccess();
    return store.checkpointProjectRecovery({scope,marker,application,before,head:remote.head,value:remote.value,editor:next,queuedValue});
  }
  return Object.freeze({
    async inspect(){
      assertAccess();
      const status=await observe(), editor=status.editor;
      const before=await source(),local=before.replica.editor;
      return {status,deviceLabel:editor.deviceLabel||editor.deviceId,
        ownershipLost:local?.active===true&&local.deviceId===store.deviceId
          &&(local.epoch!==editor.epoch||editor.deviceId!==store.deviceId||!editor.active),
        requiresPin:editor.active&&editor.deviceId!==store.deviceId,roomCopy:roomCopyStatus(before.image)};
    },
    start({variant,expected,pin,confirmed,deviceLabel='',roomId,roomName}){
      return store.exclusive(async()=>{
        assertAccess();
        if(!['latest','room-copy'].includes(variant))fail('LF_P0B_RECOVERY_VARIANT_REQUIRED');
        if(confirmed!==true)fail('LF_PROJECT_RECOVERY_CONFIRMATION_REQUIRED');
        if(typeof deviceLabel!=='string'||deviceLabel.length>64)fail('LF_P0B_DEVICE_LABEL_INVALID');
        if(await store.pendingProjectRecovery(scope))fail('LF_PROJECT_RECOVERY_PENDING');
        if(!equal(await observe(),expected))fail('LF_PROJECT_RECOVERY_CONFLICT');
        if(expected.editor.active&&expected.editor.deviceId===store.deviceId)fail('LF_PROJECT_EDITOR_ALREADY_OWNED');
        const pinRevision=expected.editor.active?await protocol.pin.verify(pin):null;
        const before=await source(),remote=await readCurrent(expected.revision);
        const application=replacement(before.image,scope,iid,remote);
        let roomCopy;
        if(variant==='room-copy'){
          const eligibility=roomCopyStatus(before.image);
          if(!eligibility.available)fail(eligibility.code);
          if(before.replica.dirty||before.operations.some(op=>op.phase!=='verified'))fail('LF_ROOM_COPY_BASE_UNCONFIRMED');
          roomCopy=prepareRoomCopy({rows:before.image.rows,baseline:JSON.parse(before.replica.json),scope,roomId,name:roomName,
            validateRoom:roomContract.validateRoom});
          const project=appendRoomCopy(remote.value.document.payload.project,roomCopy,roomContract);
          application.rows.fc_projects_v1=JSON.stringify(JSON.parse(application.rows.fc_projects_v1).map(row=>row.id===scope?project:row));
          await roomContract.build(application.rows,remote);
        }
        const marker=await store.stageProjectRecovery(scope,{variant,...(roomCopy?{roomCopy,roomCopyHash:await digest(json(roomCopy))}:{}),operationId:crypto.randomUUID(),expected:copy(expected),deviceLabel,pinRevision,
          applicationVersion:before.image.version,applicationHash:before.image.hash,replicaVersion:before.replica.version});
        return finish(marker);
      });
    },
    resume(){
      return store.exclusive(async()=>{
        assertAccess();
        const marker=await store.pendingProjectRecovery(scope);
        if(marker)return finish(marker);
        const {protected:records}=await store.snapshot(scope);
        const receipts=records.filter(row=>row.key.startsWith('recovery-'))
          .map(row=>JSON.parse(row.json)).filter(row=>row.kind==='project-recovery'&&row.sourceScope===scope);
        const latest=receipts.sort((a,b)=>b.receipt.editor.epoch-a.receipt.editor.epoch)[0]?.receipt;
        if(!latest||latest.editor.ownerUid!==store.ownerUid||latest.editor.deviceId!==store.deviceId
          ||latest.editor.projectId!==scope)fail('LF_PROJECT_RECOVERY_INTENT_REQUIRED');
        return latest;
      });
    },
  });
}
