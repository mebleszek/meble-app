// Emulator candidate for new, explicitly seeded investor records.
import {assertEmulator, equal, fail, id} from '../../sync/local-first-values.mjs';

export function createP0BProtocol(connection, deviceId) {
  id(deviceId);
  const identity = assertEmulator(connection), {uid} = identity, {db, firestore:f} = connection;
  const guard = () => {
    if (!equal(assertEmulator(connection), identity)) fail('LF_AUTH_CHANGED');
    connection.assertAccess();
  };
  const ref = (collection, key) => f.doc(db, 'users', uid, collection, id(key));
  const investorRef = iid => ref('localFirstInvestors', iid);
  const editorRef = pid => ref('localFirstEditors', pid);
  const headRef = pid => ref('localFirstProjects', pid);
  const read = snapshot => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) fail('LF_SERVER_UNCONFIRMED');
    return snapshot.exists() ? snapshot.data() : null;
  };
  function active(record) {
    if (!record || record.schemaVersion !== 1) fail('LF_P0B_REGISTRY_REQUIRED');
    if (record.deletionId) fail('LF_P0B_INVESTOR_DELETED');
    return record;
  }
  const transaction = work => {
    guard();
    return f.runTransaction(db, async tx => {
      guard();
      const result = await work(tx);
      guard();
      return result;
    }, {maxAttempts:1});
  };

  async function investor(iid) {
    guard();
    const result = read(await f.getDocFromServer(investorRef(iid)));
    guard();
    return result;
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

  function verifyDelete(record, intent) {
    if (record?.deletionId !== intent.operationId || record?.generation !== intent.expectedGeneration + 1)
      fail('LF_P0B_ACK_UNCONFIRMED');
    return {investorId:intent.investorId, operationId:intent.operationId, generation:record.generation};
  }

  return Object.freeze({
    investor,
    createInvestor(iid, contact) {
      return transaction(async tx => {
        const ref = investorRef(iid);
        if (read(await tx.get(ref))) fail('LF_P0B_INVESTOR_CONFLICT');
        tx.set(ref, {ownerUid:uid, investorId:iid, schemaVersion:1, generation:1, contactRevision:1, contact,
          projects:{}, lastProject:'', deletionId:''});
      });
    },
    updateContact(iid, expectedRevision, contact) {
      return transaction(async tx => {
        const ref = investorRef(iid), existing = active(read(await tx.get(ref)));
        if (existing.contactRevision !== expectedRevision) fail('LF_P0B_CONTACT_CONFLICT');
        tx.set(ref, {...existing, contact, contactRevision:expectedRevision+1, generation:existing.generation+1});
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
      id(intent.operationId);
      return transaction(async tx => {
        const ref = investorRef(intent.investorId), record = read(await tx.get(ref));
        if (record?.deletionId === intent.operationId) { verifyDelete(record,intent); return; }
        const existing = active(record);
        if (existing.generation !== intent.expectedGeneration) fail('LF_P0B_DELETE_CONFLICT');
        if (Object.values(existing.projects).some(Boolean)) fail('LF_P0B_EDITOR_CONFLICT');
        const next = {...existing, generation:existing.generation+1, contact:{}, lastProject:'', deletionId:intent.operationId};
        tx.set(ref,next);
        // A caller still needs a fresh read to acknowledge the write.
      });
    },
    async confirmDeletion(intent) { return verifyDelete(await investor(intent.investorId),intent); }
  });
}

export function createP0BDeletionIntent(selection, operationId) {
  // A batch must be defined and verified as one protocol before any constituent write.
  if (selection.length !== 1) fail('LF_P0B_BULK_ATOMICITY_REQUIRED');
  const [record] = selection;
  id(operationId); id(record?.investorId);
  if (record.schemaVersion !== 1 || record.deletionId || !Number.isSafeInteger(record.generation)) fail('LF_P0B_REGISTRY_REQUIRED');
  if (Object.values(record.projects).some(Boolean)) fail('LF_P0B_EDITOR_CONFLICT');
  return {operationId, investorId:record.investorId, expectedGeneration:record.generation};
}

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
