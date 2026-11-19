import {copy, fail, equal, id, assertEmulator} from './local-first-values.mjs';
import {assertApplicationConnection} from './firebase-activation.mjs';
const EXTRA = ['editorEpoch', 'deviceId', 'globalRevisionId', 'globalDirectoryHash', 'roomDeleted'];
const bare = value => value === null ? null : Object.fromEntries(Object.entries(value).filter(([key]) => !EXTRA.includes(key)));
export const unresolvedProjectKeys = Object.freeze(['fc_edge_v1', 'fc_material_part_options_v1', 'fc_rozrys_grain_state_v1',
  'fc_rozrys_overrides_v1', 'fc_quote_snapshots_v1', 'fc_quote_offer_drafts_v1']);
export function protectProjectRows(storage) {
  const rows = {};let unresolved=false;
  for (const key of ['fc_projects_v1','fc_investors_v1',...unresolvedProjectKeys]) {
    const raw = storage.getItem(key); if (raw !== null) {rows[key] = raw;if(unresolvedProjectKeys.includes(key))unresolved=true;}
  }
  return {protectedRows: rows, blockers: unresolved ? ['LF_PROJECT_OWNERSHIP_PENDING'] : []};
}
// Reuse CLOUD-1B's dependency list; no guessed legacy/grain/history mapping.
// Unrecognized selectors refuse. Full global bundle is retained on the device.
export function validateProjectDependencies(projectContract, globalContract, document, globals) {
  globalContract.validateBundle(globals);
  const requirements = projectContract.dependencies(document.payload);
  for (const {domain, reference} of requirements) {
    if (domain === 'inherited-defaults') continue; // Entire validated defaults domain is pinned, never merged here.
    let found = false;
    if (domain === 'material') found = globals.materials.some(r => [r.id,r.name,r.materialType].includes(reference));
    if (domain === 'rate') found = [...globals.labor,...globals.workshopServices].some(r => r.id === reference);
    if (domain === 'hardware') found = globals.manufacturers.includes(reference) || globals.hardware.some(r =>
      ['id','name','manufacturer','hardwareType','hardwareSystem','series','drawerProfile'].some(k => r[k] === reference));
    if (!found) fail('LF_PROJECT_DEPENDENCY_MISSING');
  }
  return requirements;
}

// Namespace adapter around the existing CLOUD-2B chunk/manifest transport.
// New metadata is checked before stripping it for the existing closed contract.
export function createProjectChannel({writer, reader, ownerUid, deviceId, projectId, investorId,
  pilotContract: c, pilotFactory, globalContract, projectContract, globals,editorProtocol,deviceLabel=()=>'',projectCollection='localFirstProjects',roomProtocol=false}) {
  id(ownerUid); id(deviceId); id(projectId); id(investorId);
  const wi = assertApplicationConnection(writer), ri = assertApplicationConnection(reader);
  if (wi.uid !== ownerUid || ri.uid !== ownerUid || writer.db.app === reader.db.app) fail('LF_INDEPENDENT_OWNER_REQUIRED');
  const guard = () => { if (!equal(assertApplicationConnection(writer),wi) || !equal(assertApplicationConnection(reader),ri)) fail('LF_AUTH_CHANGED'); };
  const scope = {ownerUid,projectId,investorId}, f = writer.firestore;
  const editorRef = db => f.doc(db,'users',ownerUid,'localFirstEditors',projectId);
  const projectRef = db => f.doc(db,'users',ownerUid,'localFirstProjects',projectId);
  const publicationGlobalRef = (db,revisionId) => revisionId ? f.doc(db,'users',ownerUid,'globalRevisions',revisionId) : f.doc(db,'users',ownerUid,'globalData','current');
  const fresh = snap => { if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) fail('LF_SERVER_UNCONFIRMED'); return snap; };
  const value = snap => snap.exists() ? snap.data() : null;
  const metadata = data => {
    if (!data || !Number.isSafeInteger(data.editorEpoch) || data.editorEpoch < 1 || !/^[a-f0-9]{64}$/.test(data.globalDirectoryHash)
      || !c.revisionId(data.globalRevisionId)) fail('LF_PROJECT_METADATA_INVALID');
    if(roomProtocol&&typeof data.roomDeleted!=='boolean')fail('LF_ROOM_PROJECT_METADATA_INVALID');
    id(data.deviceId); return Object.fromEntries(EXTRA.filter(k=>k!=='roomDeleted'||roomProtocol).map(k=>[k,data[k]]));
  };
  function roomHead(document,head){
    if(!roomProtocol)return;
    const record=document?.payload?.project,own=record?.meta?.roomProject;
    if(own?.version!==1||own.roomId!==projectId||record.id!==projectId
      ||(own.removed===true)!==head.roomDeleted)fail('LF_ROOM_PROJECT_METADATA_INVALID');
  }
  function transport(connection, publication = null) {
    const sdk = connection.firestore;
    const isHead = ref => ref.path === `users/${ownerUid}/${projectCollection}/${projectId}`;
    const wrap = (snap,ref) => isHead(ref) && snap.exists() ? {
      metadata:snap.metadata,exists:()=>true,data:()=>{ metadata(snap.data()); return bare(snap.data()); }
    } : snap;
    const adapted = {...sdk,
      doc(db,...path) {
        const parts = [...path]; if (parts[0] === 'users' && parts[2] === 'pilotProjects') parts[2] = 'localFirstProjects';
        return sdk.doc(db,...parts);
      },
      async getDocFromServer(ref) { guard(); return wrap(await sdk.getDocFromServer(ref),ref); },
      runTransaction(db, callback, options) {
        guard();
        return sdk.runTransaction(db, async tx => {
          const e = value(fresh(await tx.get(editorRef(db)))), g = value(fresh(await tx.get(publicationGlobalRef(db,publication?.global.revisionId)))); guard();
          return callback({
            async get(ref) { return wrap(fresh(await tx.get(ref)),ref); },
            set(ref,data) {
              guard();
              if (!publication || !e?.active || e.deviceId !== deviceId || e.epoch !== publication.editor.epoch
                || !equal(e,publication.editor) || g?.revisionId !== publication.global.revisionId
                || g?.directoryHash !== publication.global.directoryHash) fail('LF_EDITOR_OR_DEPENDENCY_CONFLICT');
              return tx.set(ref,isHead(ref) ? {...data,editorEpoch:e.epoch,deviceId,
                globalRevisionId:g.revisionId,globalDirectoryHash:g.directoryHash,...(roomProtocol?{roomDeleted:publication.roomDeleted}:{} )} : data);
            }
          });
        },options);
      }
    };
    return pilotFactory.fromConnection({...connection,firestore:adapted});
  }
  const inbound = transport(reader);
  async function readHead(){
    guard();
    const raw=value(fresh(await reader.firestore.getDocFromServer(projectRef(reader.db))));
    guard();
    return raw?{...c.headOf(bare(raw),scope),...metadata(raw)}:null;
  }
  async function editor() {
    guard(); const out = await f.runTransaction(reader.db,async tx => value(fresh(await tx.get(editorRef(reader.db)))),{maxAttempts:1});guard();return out;
  }
  async function loadPinnedGlobals(pin) {
      // A project pins its immutable catalog revision; newer prices must not
      // silently rebase a saved project or make its older dependencies disappear.
      const sdk=reader.firestore;
      const rev=value(fresh(await sdk.getDocFromServer(sdk.doc(reader.db,'users',ownerUid,'globalRevisions',pin.revisionId))));guard();
      if(!rev||rev.ownerUid!==ownerUid||rev.revisionId!==pin.revisionId||rev.directoryHash!==pin.directoryHash
        ||typeof rev.directory!=='string'||new TextEncoder().encode(rev.directory).length>globalContract.MAX_DIRECTORY_BYTES
        ||await globalContract.sha(new TextEncoder().encode(rev.directory))!==pin.directoryHash)fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');
      let directory;try{directory=JSON.parse(rev.directory);}catch(_){fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');}
      if(globalContract.canonical(directory)!==rev.directory)fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');
      if(!directory||Array.isArray(directory)||typeof directory!=='object'||rev.version!==1
        ||!Number.isSafeInteger(rev.generation)||rev.generation<1)fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');
      for(const [domain,rows]of Object.entries(directory)){
        if(!Object.hasOwn(globalContract.schemas,domain)||!Array.isArray(rows))fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');
        const seen=new Set();for(const row of rows){globalContract.shape({id:globalContract.id,hash:globalContract.hashValue},['id','hash'])(row,'directory');
          if(seen.has(row.id))fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');seen.add(row.id);}
      }
      const entries=Object.values(directory).flat();
      if(entries.length!==rev.recordCount||entries.length>globalContract.MAX_RECORDS)fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');
      const records=[];let total=0;
      for(let offset=0;offset<entries.length;offset+=32){
        const part=await sdk.runTransaction(reader.db,async tx=>Promise.all(entries.slice(offset,offset+32).map(async e=>{
          globalContract.hashValue(e.hash);const snap=fresh(await tx.get(sdk.doc(reader.db,'users',ownerUid,'globalRecords',e.hash)));
          if(!snap.exists())fail('LF_GLOBAL_DEPENDENCY_INCOMPLETE');return snap.data();})),{maxAttempts:1});guard();
        for(const record of part){if(typeof record.json!=='string'||record.byteLength<1||record.byteLength>globalContract.MAX_RECORD_BYTES
          ||new TextEncoder().encode(record.json).length!==record.byteLength)fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');
          total+=record.byteLength;if(total>globalContract.MAX_TOTAL_BYTES)fail('LF_GLOBAL_DEPENDENCY_INTEGRITY');records.push(record);}
      }
      const decoded=await globalContract.unpack(ownerUid,directory,records);globalContract.validateBundle(decoded.model);guard();
      return {head:Object.fromEntries(['ownerUid','version','generation','revisionId','directoryHash','recordCount'].map(k=>[k,rev[k]])),value:decoded.model};
  }
  async function readGlobals(pin) {
    guard();
    return globals.readPinned?globals.readPinned(pin,()=>loadPinnedGlobals(pin)):loadPinnedGlobals(pin);
  }
  async function readPinned(pin) {
    guard();
    pin=copy(pin);
    c.validHead(bare(pin),scope);
    if(!pin)fail('LF_ROOM_COPY_BASE_UNCONFIRMED');
    metadata(pin);
    const sdk=reader.firestore;
    const revision=sdk.doc(projectRef(reader.db),'revisions',pin.currentRevisionId);
    // A server-only request also rejects an explicitly disabled SDK network.
    if(!fresh(await sdk.getDocFromServer(revision)).exists())fail('LF_PROJECT_BASE_INCOMPLETE');
    guard();
    const stored=await sdk.runTransaction(reader.db,async tx=>{
      guard();
      const header=value(fresh(await tx.get(revision)));
      if(!header||!Number.isSafeInteger(header.chunkCount)||header.chunkCount<1||header.chunkCount>c.MAX_CHUNKS
        ||!Number.isSafeInteger(header.byteLength)||header.byteLength<1||header.byteLength>c.MAX_BYTES)fail('LF_PROJECT_BASE_INCOMPLETE');
      const chunks=await Promise.all(Array.from({length:header.chunkCount},(_,index)=>
        tx.get(sdk.doc(revision,'chunks',String(index)))));
      if(chunks.some(snapshot=>!fresh(snapshot).exists()))fail('LF_PROJECT_BASE_INCOMPLETE');
      guard();
      return {header,chunks:chunks.map(snapshot=>snapshot.data())};
    },{maxAttempts:1});
    guard();
    // The durable pin supplies the published generation and content hashes.
    // Immutable revision metadata supplies bounded geometry and its timestamp.
    const manifest={...bare(pin),formatVersion:1,chunkCount:stored.header.chunkCount,
      byteLength:stored.header.byteLength,updatedAt:stored.header.createdAt};
    const result=await c.unpack(manifest,stored.header,stored.chunks,scope);roomHead(result.document,pin);
    const global=await readGlobals({revisionId:pin.globalRevisionId,directoryHash:pin.globalDirectoryHash});
    const requirements=validateProjectDependencies(projectContract,globalContract,result.document,global.value);
    guard();
    return {head:pin,value:{document:result.document,globals:{head:global.head,model:global.value},requirements}};
  }
  async function read() {
    guard(); const result = await inbound.readProject(scope); guard();
    const raw = value(fresh(await reader.firestore.getDocFromServer(projectRef(reader.db)))); guard();
    if (!raw || !equal(c.headOf(bare(raw),scope),result.head)) fail('LF_PROJECT_READ_CONFLICT');
    metadata(raw);roomHead(result.document,raw);
    const global=await readGlobals({revisionId:raw.globalRevisionId,directoryHash:raw.globalDirectoryHash});
    const final=value(fresh(await reader.firestore.getDocFromServer(projectRef(reader.db))));guard();
    if(!final||!equal({...c.headOf(bare(final),scope),...metadata(final)},{...result.head,...metadata(raw)}))fail('LF_PROJECT_READ_CONFLICT');
    const requirements = validateProjectDependencies(projectContract,globalContract,result.document,global.value);
    return {head:{...result.head,...metadata(raw)},
      value:{document:result.document,globals:{head:global.head,model:global.value},requirements}};
  }
  async function prepare(bundle, base, expectedEditor) {
    guard();
    const current = await editor();
    if (!current?.active || current.deviceId !== deviceId || !equal(current,expectedEditor)) fail('LF_EDITOR_CONFLICT');
    validateProjectDependencies(projectContract,globalContract,bundle.document,bundle.globals.model);
    const global = await readGlobals(bundle.globals.head);
    if (!equal(global.head,bundle.globals.head) || !equal(global.value,bundle.globals.model)) fail('LF_GLOBAL_DEPENDENCIES_STALE');
    const bytes = new TextEncoder().encode(c.canonical(bundle.document)).length;
    const packed = await c.pack({ok:true,document:bundle.document,utf8Bytes:bytes},scope,bare(base),crypto.randomUUID().replaceAll('-',''));
    if(roomProtocol&&base?.roomDeleted===true)fail('LF_ROOM_PROJECT_REMOVED');
    const roomDeleted=roomProtocol&&bundle.document.payload.project.meta?.roomProject?.removed===true;
    const outbound = transport(writer,{editor:current,global:global.head,roomDeleted});
    const expected = {...c.candidateHead(packed),editorEpoch:current.epoch,deviceId,
      globalRevisionId:global.head.revisionId,globalDirectoryHash:global.head.directoryHash,...(roomProtocol?{roomDeleted}:{} )};
    return {expected,async publish() { await outbound.stage(packed); await outbound.publish(packed,async()=>guard()); }};
  }
  async function acquire(expectedHead) {
    guard();if(roomProtocol&&expectedHead?.roomDeleted===true)fail('LF_ROOM_PROJECT_REMOVED');
    if(editorProtocol)return editorProtocol.acquire({iid:investorId,pid:projectId,expectedHead:expectedHead?.currentRevisionId||'',deviceLabel:deviceLabel()});
    return f.runTransaction(writer.db, async tx => {
      const old = value(fresh(await tx.get(editorRef(writer.db)))), head = value(fresh(await tx.get(projectRef(writer.db))));
      if (old?.active || !equal(head ? {...c.headOf(bare(head),scope),...metadata(head)} : null,expectedHead)) fail('LF_EDITOR_BUSY_OR_HEAD_CHANGED');
      const next = {ownerUid,projectId,deviceId,epoch:(old?.epoch || 0)+1,active:true,headRevision:head?.currentRevisionId || ''};
      guard(); tx.set(editorRef(writer.db),next); return next;
    },{maxAttempts:1});
  }
  async function release(expectedEditor, expectedHead) {
    guard();
    if(editorProtocol)return editorProtocol.release({iid:investorId,pid:projectId,expectedHead:expectedHead?.currentRevisionId||'',expectedEditor});
    return f.runTransaction(writer.db,async tx => {
      const e = value(fresh(await tx.get(editorRef(writer.db)))), head = value(fresh(await tx.get(projectRef(writer.db))));
      if (!equal(e,expectedEditor) || !e?.active || e.deviceId !== deviceId || !head
        || !equal({...c.headOf(bare(head),scope),...metadata(head)},expectedHead)) fail('LF_HANDOVER_CONFLICT');
      const next = {...e,active:false,headRevision:head.currentRevisionId}; guard(); tx.set(editorRef(writer.db),next); return next;
    },{maxAttempts:1});
  }
  return Object.freeze({kind:'project',scope:projectId,prepare,read,readPinned,readHead,editor,acquire,release,guard,
    watch(notify){guard();return reader.firestore.onSnapshot(projectRef(reader.db),()=>notify(),()=>notify());},
    async close(){await inbound.close();}});
}
