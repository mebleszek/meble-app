import {copy,digest,equal,fail,id,json} from './local-first-values.mjs';

function checkHead(head,projectId){
  if (head?.projectId !== projectId || !Number.isSafeInteger(head.generation) || head.generation < 1
    || !/^[a-f0-9]{32}$/.test(head.currentRevisionId || '')) fail('LF_ROOM_CONFLICT_WITNESS_REQUIRED');
}

// The caller supplies a freshly read, validated project head and durable local
// state. Uncertain commits must be reconciled before replacing the local side.
export function compareRoomRevisions({projectId,replica,operations,remote}){
  id(projectId);
  if (replica?.key !== projectId || !Array.isArray(operations)
    || operations.some(op => op.scope !== projectId)) fail('LF_ROOM_CONFLICT_WITNESS_REQUIRED');
  checkHead(replica.base,projectId);
  checkHead(remote,projectId);
  const pending = operations.filter(op => op.phase !== 'verified');
  if (pending.some(op => !['queued','inflight','uncertain','conflict','blocked'].includes(op.phase)))
    fail('LF_ROOM_CONFLICT_WITNESS_REQUIRED');
  if (remote.generation < replica.base.generation
    || remote.generation === replica.base.generation && !equal(remote,replica.base))
    fail('LF_STALE_REMOTE');
  const uncertain = pending.filter(op => op.phase === 'inflight' || op.phase === 'uncertain');
  for (const op of uncertain){
    checkHead(op.expected,projectId);
    if (equal(remote,op.expected) || remote.generation !== op.expected.generation)
      return {state:'awaiting-ack'};
  }
  if (equal(remote,replica.base)) return {state:'unchanged'};
  if (replica.dirty || pending.length) return {state:'conflict'};
  return {state:'receive'};
}

export function assertRoomConflictIndependent(operations,scope){
  if(operations.some(row=>row.scope!==scope&&row.phase!=='verified'
    && row.dependencies?.some(dependency=>dependency.scope===scope)))
    fail('LF_QUOTE_STATUS_PENDING');
}

export async function checkpointRoomConflictRemote({transaction,prepareApplication,applicationChange,ownerUid,deviceId,args}){
  const {scope,before,remote,expectedEditor,assertAccess} = args;
  if (compareRoomRevisions({projectId:scope,...before,remote:remote.head}).state !== 'conflict')
    fail('LF_ROOM_CONFLICT_WITNESS_REQUIRED');
  const remoteProject = remote.value?.document?.payload?.project;
  const oldProject = JSON.parse(before.image.rows.fc_projects_v1 || '[]').find(project => project.id === scope);
  const investorId = oldProject?.investorId;
  if (!investorId || remote.head.ownerUid !== ownerUid || remote.head.investorId !== investorId
    || remoteProject?.id !== scope || remoteProject.investorId !== investorId
    || remoteProject.meta?.roomProject?.version !== 1 || remoteProject.meta.roomProject.roomId !== scope
    || remoteProject.meta.roomProject.removed || remote.head.roomDeleted
    || expectedEditor?.ownerUid !== ownerUid || expectedEditor.projectId !== scope
    || expectedEditor.investorId !== investorId || expectedEditor.deviceId === deviceId && expectedEditor.active
    || oldProject.meta?.pendingDomainOperation || remoteProject.meta?.pendingDomainOperation)
    fail('LF_ROOM_CONFLICT_WITNESS_REQUIRED');
  if (before.image.rows.fc_edit_session_v1 != null) fail('LF_ACTIVE_RAM_PROTECTED');
  const oldProjects = JSON.parse(before.image.rows.fc_projects_v1);
  const projects = oldProjects.map(project => project.id===scope ? remoteProject : project);
  if (oldProjects.filter(project=>project.id===scope).length!==1) fail('LF_APPLICATION_SCOPE_REFUSED');
  const investors = JSON.parse(before.image.rows.fc_investors_v1 || '[]');
  if (investors.filter(investor=>investor.id===investorId).length!==1) fail('LF_APPLICATION_SCOPE_REFUSED');
  const rooms = projects.filter(project=>project.investorId===investorId&&!project.meta?.roomProject?.removed)
    .map(project=>project.projectData?.meta?.roomDefs?.[project.id]);
  if (rooms.some(room=>!room)) fail('LF_ROOM_CONFLICT_WITNESS_REQUIRED');
  const rows = {...before.image.rows,fc_projects_v1:JSON.stringify(projects),
    fc_investors_v1:JSON.stringify(investors.map(investor=>investor.id===investorId ? {...investor,rooms} : investor))};
  const application = await prepareApplication({expectedVersion:before.image.version,rows});
  const archiveId = 'room-conflict-' + crypto.randomUUID();
  const archived = json({kind:'room-conflict-remote',scope,image:before.image,replica:before.replica,operations:before.operations,
    received:remote.head});
  const encoded = json(remote.value), hash = await digest(encoded), archiveHash = await digest(archived);
  return transaction('readwrite',(stores,done,abort)=>{
    const replica = stores.replicas.get(scope), operations = stores.outbox.getAll();
    const guards = ['p0b-registry','projectRecovery:'+scope,'quote-release:'+scope,'quote-reservation:'+scope,'quote-grant:'+scope,'handover:'+scope,'p0b-new:'+scope]
      .map(key => stores.control.get(key));
    let remaining = 2 + guards.length;
    const finish = () => {
      if (--remaining) return;
      try {
        assertAccess();
        assertRoomConflictIndependent(operations.result,scope);
        const pending = operations.result.filter(row => row.scope === scope);
        if (!equal(replica.result,before.replica) || !equal(pending,before.operations)
          || guards[0].result?.registry !== 'p0b-rooms-v1' || guards.slice(1).some(request => request.result)
          || replica.result.editor?.handoverPending)
          fail('LF_ROOM_CONFLICT_CHANGED');
        applicationChange(stores,application,old=>{
          assertAccess();
          if (!equal(old,before.image)) fail('LF_ROOM_CONFLICT_CHANGED');
          stores.protected.add({key:archiveId,scope,json:archived,hash:archiveHash});
          for (const row of pending) stores.outbox.delete(row.key);
          stores.replicas.put({key:scope,version:replica.result.version+1,json:encoded,hash,base:copy(remote.head),editor:null,dirty:false});
          done({archiveId,localConfirmed:true,cloudConfirmed:true,remoteRevision:remote.head.currentRevisionId});
        },abort);
      } catch (error) { abort(error); }
    };
    for (const request of [replica,operations,...guards]) request.onsuccess = finish;
  },scope);
}
