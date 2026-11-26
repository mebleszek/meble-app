import {copy,digest,equal,fail,id,json} from './local-first-values.mjs';

const quoteKey = quoteId => 'offline-quote:' + id(quoteId);
const quoteScope = async investorId => 'p0b_offline_quotes_' + await digest(id(investorId));

function sourcesIn(image, investorId, roomIds){
  if (!image || image.rows.fc_current_investor_v1 !== investorId || image.rows.fc_edit_session_v1 != null)
    fail('LF_OFFLINE_QUOTE_CONTEXT_CHANGED');
  const projects = JSON.parse(image.rows.fc_projects_v1 || '[]');
  return roomIds.map(projectId => {
    const matches = projects.filter(row => row.id === projectId);
    const project = matches[0];
    if (matches.length !== 1 || project.investorId !== investorId || project.meta?.roomProject?.version !== 1
      || project.meta.roomProject.roomId !== projectId || project.meta.roomProject.removed || project.meta.pendingDomainOperation)
      fail('LF_OFFLINE_QUOTE_SOURCE_INVALID');
    return project;
  });
}

// Local drafts live only in the protected store. The quote ledger, its pins,
// project replicas and the synchronization outbox never reference these rows.
export function offlineQuoteStore({transaction,ownerUid,deviceId}){
  async function saveOfflineQuote({image,snapshot,assertCurrent,normalizeProject=project=>project}){
    const quote = copy(snapshot);
    const quoteId = id(quote.id), investorId = id(quote.investor?.id), projectId = id(quote.project?.id);
    const roomIds = quote.scope?.selectedRooms;
    const refs = quote.scope?.sourceProjects;
    if (!Array.isArray(roomIds) || !roomIds.length || new Set(roomIds).size !== roomIds.length
      || quote.project.investorId !== investorId || image?.rows.fc_current_project_id_v1 !== projectId
      || !Number.isFinite(quote.totals?.grand) || quote.error || quote.meta?.selectedByClient || quote.meta?.acceptedAt
      || !Array.isArray(refs) || refs.length !== roomIds.length) fail('LF_OFFLINE_QUOTE_INVALID');
    const projects = sourcesIn(image, investorId, roomIds.map(id));
    if (!roomIds.includes(projectId)) sourcesIn(image, investorId, [projectId]);
    for (const project of projects){
      const ref = refs.find(row => row.projectId === project.id);
      if (!ref || !equal(ref, {projectId:project.id,roomId:project.id,investorId,recordHash:await digest(normalizeProject(copy(project)))}))
        fail('LF_OFFLINE_QUOTE_SOURCE_INVALID');
    }
    if (image.hash !== await digest(json(image.rows))) fail('LF_APPLICATION_INTEGRITY');
    const record = {version:1,kind:'offline-quote',ownerUid,deviceId,investorId,snapshot:quote,applicationHash:image.hash};
    const encoded = json(record), hash = await digest(encoded), scope = await quoteScope(investorId), key = quoteKey(quoteId);
    assertCurrent();
    return transaction('readwrite',(stores,done,abort)=>{
      const application = stores.control.get('application');
      const fences = stores.control.getAll();
      const prior = stores.protected.get(key);
      let pending = 3;
      const finish = () => {
        if (--pending) return;
        try {
          assertCurrent();
          if (!equal(application.result,image) || !fences.result.some(row => row.key === 'p0b-registry' && row.registry === 'p0b-rooms-v1'))
            fail('LF_OFFLINE_QUOTE_CONTEXT_CHANGED');
          if (fences.result.some(row => row.key === 'retired:'+scope || roomIds.some(room =>
            ['retired:','projectRecovery:','quote-release:'].some(prefix => row.key === prefix+room))))
            fail('LF_OFFLINE_QUOTE_SOURCE_INVALID');
          const envelope = {key,scope,json:encoded,hash};
          if (prior.result && !equal(prior.result,envelope)) fail('LF_OPERATION_REUSED');
          if (!prior.result) stores.protected.add(envelope);
          done({id:quoteId,localConfirmed:true,cloudConfirmed:false});
        } catch (error) { abort(error); }
      };
      application.onsuccess = fences.onsuccess = prior.onsuccess = finish;
    },scope);
  }

  async function readOfflineQuotes(investorId){
    const scope = await quoteScope(investorId);
    const rows = await transaction('readonly',(stores,done,abort)=>{
      const cursor = stores.protected.openCursor(IDBKeyRange.bound('offline-quote:','offline-quote:\uffff'));
      const matches = [];
      cursor.onsuccess = () => {
        try {
          if (!cursor.result) { done(matches); return; }
          if (cursor.result.value.scope === scope) matches.push(cursor.result.value);
          cursor.result.continue();
        } catch (error) { abort(error); }
      };
    });
    const snapshots = [];
    for (const row of rows){
      if (await digest(row.json) !== row.hash) fail('LF_LOCAL_INTEGRITY');
      const record = JSON.parse(row.json);
      if (record.version !== 1 || record.kind !== 'offline-quote' || record.ownerUid !== ownerUid
        || record.deviceId !== deviceId || record.investorId !== investorId || record.snapshot?.investor?.id !== investorId
        || quoteKey(record.snapshot?.id) !== row.key) fail('LF_LOCAL_INTEGRITY');
      snapshots.push(record.snapshot);
    }
    return snapshots;
  }

  return {saveOfflineQuote,readOfflineQuotes};
}
