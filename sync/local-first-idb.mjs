import {commitQuoteLedger as writeQuoteLedger} from './local-first-quote-store.mjs';
import {commitRoomBatch as writeRoomBatch} from './local-first-room-batch.mjs';
import {emptyP0BBusiness,P0B_REGISTRY} from './application-p0b-domain.mjs';
import {assertApplicationMigration} from './application-release.mjs';
import {copy, fail, equal, id, json, digest} from './local-first-values.mjs';
import {archivedProjectOperation} from './local-first-project-batching.mjs';
import {quoteReleaseStore} from './local-first-quote-release.mjs';
import {offlineQuoteStore} from './local-first-offline-quote.mjs';
import {assertRoomConflictIndependent,checkpointRoomConflictRemote} from './local-first-room-conflict.mjs';
import {quoteReservationJournal} from './local-first-quote-reservations.mjs';
const TABLES = ['control', 'replicas', 'outbox', 'protected'];
// Explicit separate database. No localStorage, backup archive or startup.
export async function openLocalFirstStore({indexedDB, locks, name, ownerUid, deviceId, instanceId, initialize = false, migration} = {}) {
  id(ownerUid); id(deviceId); id(instanceId);
  if (!(name === 'meble-local-first-v1' || /^meble-lf-test-[a-zA-Z0-9_-]{1,100}$/.test(name || '')) || !indexedDB || typeof locks?.request !== 'function') fail('LF_ISOLATED_STORAGE_REQUIRED');
  let closed = false;
  function open() {
    if (closed) fail('LF_STORE_CLOSED');
    return new Promise((resolve, reject) => {
      let abandoned = false;
      const q = indexedDB.open(name, 1);
      q.onupgradeneeded = () => {
        if (!initialize) { q.transaction.abort(); return; }
        for (const table of TABLES) q.result.createObjectStore(table, {keyPath: 'key'});
        q.transaction.objectStore('control').add({key: 'binding', ownerUid, deviceId, instanceId, version: 1});
      };
      q.onerror = () => reject(Error('LF_IDB_MISSING_OR_UNAVAILABLE'));
      q.onblocked = () => { abandoned = true; reject(Error('LF_IDB_BLOCKED')); };
      q.onsuccess = () => {
        const db = q.result; db.onversionchange = () => db.close();
        if (abandoned || closed || !equal(Array.from(db.objectStoreNames).sort(), [...TABLES].sort())) {
          db.close(); reject(Error('LF_IDB_SCHEMA_OR_CLOSED')); return;
        }
        resolve(db);
      };
    });
  }
  async function transaction(mode, action,scope) {
    const db = await open();
    try { return await new Promise((resolve, reject) => {
      let tx, output, failure;
      try { tx = db.transaction(TABLES, mode, mode === 'readwrite' ? {durability: 'strict'} : undefined); }
      catch (_) { reject(Error('LF_IDB_TRANSACTION_UNAVAILABLE')); return; }
      const s = Object.fromEntries(TABLES.map(t => [t, tx.objectStore(t)]));
      const abort = e => { failure = e; try { tx.abort(); } catch (_) {} };
      tx.onabort = () => reject(failure || Error(tx.error?.name === 'QuotaExceededError' ? 'LF_IDB_QUOTA' : 'LF_IDB_ABORTED'));
      tx.onerror = () => {};
      tx.oncomplete = () => closed ? reject(Error('LF_LOCAL_ACK_UNCONFIRMED')) : resolve(copy(output));
      const binding = s.control.get('binding');
      binding.onsuccess = () => {
        try {
          if (!equal(binding.result, {key: 'binding', ownerUid, deviceId, instanceId, version: 1})) fail('LF_IDB_IDENTITY_OR_LOSS');
          const perform=()=>action(s, value => { output = value; }, abort);
          if(mode==='readwrite'&&scope&&scope!=='globals'){
           const retired=s.control.get('retired:'+scope);
           retired.onsuccess=()=>{if(retired.result)abort(Error('LF_P0B_SCOPE_RETIRED'));else perform();};
          }else perform();
        } catch (e) { abort(e); }
      };
    }); } finally { db.close(); }
  }
  // After first successful open, deletion must never recreate an empty database.
  await transaction('readonly', (_s, done) => done(true)); initialize = false;
  async function snapshot(scope) {
    id(scope);
    const value = await transaction('readonly', (s, done) => {
      const a = s.replicas.get(scope), b = s.outbox.getAll(), c = s.protected.getAll(); let pending = 3;
      const finish = () => { if (!--pending) done({replica: a.result || null, operations: b.result.filter(row => row.scope === scope), protected: c.result.filter(row=>row.scope===scope)}); };
      a.onsuccess = b.onsuccess = c.onsuccess = finish;
    });
    if (value.replica && await digest(value.replica.json) !== value.replica.hash) fail('LF_LOCAL_INTEGRITY');
    for (const op of value.operations) if (await digest(op.json) !== op.hash) fail('LF_LOCAL_INTEGRITY');
    for (const row of value.protected) if(await digest(row.json)!==row.hash)fail('LF_LOCAL_INTEGRITY');
    return value;
  }
  async function readCatalogReplica(pin) {
    return transaction('readonly',(s,done,abort)=>{
      const cursor=s.replicas.openCursor();
      cursor.onsuccess=()=>{
        try{
          const row=cursor.result;
          if(!row){done(null);return;}
          const replica=row.value;
          if(!replica.dirty&&replica.base){
            const value=JSON.parse(replica.json);
            const catalog=replica.key==='globals'?{head:replica.base,model:value}:value?.globals;
            if(catalog?.head?.ownerUid===ownerUid&&catalog.head.revisionId===pin.revisionId&&
             catalog.head.directoryHash===pin.directoryHash){done({replica,catalog});return;}
          }
          row.continue();
        }catch(error){abort(error);}
      };
    });
  }
  async function hasPendingUpdateWork(){
    return transaction('readonly',(s,done)=>{
      const activeKey=/^(?:handover:|projectRecovery:|p0b-new:|quote-grant:|quote-release:|quote-reservation:|quote-request:)/;
      const keys=s.control.getAllKeys();
      let pending=3,busy=false;
      const observe=found=>{busy||=found;if(!--pending)done(busy);};
      const find=(table,match)=>{const q=table.openCursor();q.onsuccess=()=>{
        const cursor=q.result;
        if(!cursor)observe(false);
        else if(match(cursor.value))observe(true);
        else cursor.continue();
      };};
      keys.onsuccess=()=>observe(keys.result.some(key=>activeKey.test(key)));
      find(s.outbox,row=>row.phase!=='verified');
      find(s.replicas,row=>row.dirty===true);
    });
  }
  async function readApplication(){const value=await transaction('readonly',(s,done)=>{const q=s.control.get('application');q.onsuccess=()=>done(q.result||null);});if(value && await digest(json(value.rows))!==value.hash)fail('LF_APPLICATION_INTEGRITY');return value;}
  async function readPreservedSource(){const value=await transaction('readonly',(s,done)=>{const q=s.control.get('source');q.onsuccess=()=>done(q.result||null);});if(value&&await digest(value.rows)!==value.hash)fail('LF_SOURCE_INTEGRITY');return value;}
  async function prepareApplication(application){if(!application)return null;application=copy(application);if(!Number.isSafeInteger(application.expectedVersion)||application.expectedVersion<1||!application.rows||Object.values(application.rows).some(v=>v!==null&&typeof v!=='string'))fail('LF_APPLICATION_INVALID');application.hash=await digest(json(application.rows));return application;}
  const handoverKey=scope=>'handover:'+id(scope);
  function rememberHandover(control, scope, editor) {
    if(editor?.active===true && editor.deviceId===deviceId)
      control.put({key:handoverKey(scope),deviceId,epoch:editor.epoch});
  }
  async function pendingHandover(scope){
    const key=handoverKey(scope);
    return transaction('readonly',(s,done)=>{
      const q=s.control.get(key);
      q.onsuccess=()=>done(q.result||null);
    });
  }
  async function withdrawHandover(scope, expected){
    const key=handoverKey(scope);
    return transaction('readwrite',(s,done,abort)=>{
      const request=s.control.get(key),replica=s.replicas.get(scope);let pending=2;
      const finish=()=>{if(--pending)return;try{
        const editor=replica.result?.editor;
        if(!expected||!equal(request.result,expected)||!editor?.active||editor.handoverPending
          ||editor.deviceId!==deviceId||editor.deviceId!==expected.deviceId||editor.epoch!==expected.epoch)fail('LF_HANDOVER_UNCERTAIN');
        s.control.delete(key);done(true);
      }catch(e){abort(e);}};
      request.onsuccess=replica.onsuccess=finish;
    });
  }
  function checkpointRoomExit(s,scope,done,abort){
    if(!scope){done();return;}
    const recovery=s.control.get(recoveryKey(scope)),replica=s.replicas.get(id(scope)),pending=s.control.get('p0b-new:'+scope);
    let remaining=3;
    const finish=()=>{
      if(--remaining)return;
      try{
        if(recovery.result)fail('LF_PROJECT_RECOVERY_PENDING');
        rememberHandover(s.control,scope,replica.result?.editor);
        // Room creation may not have finished acquiring a server epoch yet.
        if(pending.result&&!pending.result.releaseAfterSync)s.control.put({...pending.result,releaseAfterSync:true});
        done();
      }catch(e){abort(e);}
    };
    recovery.onsuccess=replica.onsuccess=pending.onsuccess=finish;
  }
  async function checkpointApplication(application,{exitScope}={}){
    application=await prepareApplication(application);
    return transaction('readwrite',(s,done,abort)=>applicationChange(s,application,()=>{
      checkpointRoomExit(s,exitScope,()=>done(true),abort);
    },abort));
  }
  const recoveryKey=scope=>'projectRecovery:'+id(scope);
  async function pendingProjectRecovery(scope){
    const key=recoveryKey(scope);
    return transaction('readonly',(s,done)=>{
      const request=s.control.get(key);
      request.onsuccess=()=>done(request.result||null);
    });
  }
  async function stageProjectRecovery(scope,intent){
    const key=recoveryKey(scope);
    intent=copy(intent);
    id(intent.operationId);
    return transaction('readwrite',(s,done,abort)=>{
      const application=s.control.get('application'),replica=s.replicas.get(scope);
      const exit=s.control.get(handoverKey(scope)),existing=s.control.get(key);
      const choosingLocal=intent.variant==='local-wins';
      const grant=s.control.get('quote-grant:'+scope);
      const requests=[application,replica,exit,existing,grant];
      const outbox=choosingLocal?s.outbox.getAll():null,release=choosingLocal?s.control.get('quote-release:'+scope):null;
      const reservation=choosingLocal?s.control.get('quote-reservation:'+scope):null;
      if(choosingLocal)requests.push(outbox,release,reservation);
      let waiting=requests.length;
      const finish=()=>{if(--waiting)return;try{
        if(existing.result||exit.result||grant.result||replica.result?.editor?.handoverPending)fail('LF_PROJECT_RECOVERY_PENDING');
        if(choosingLocal){
          if(release.result||reservation.result)fail('LF_PROJECT_RECOVERY_PENDING');
          assertRoomConflictIndependent(outbox.result,scope);
        }
        if(!replica.result||!application.result||replica.result.version!==intent.replicaVersion
          ||application.result.version!==intent.applicationVersion||application.result.hash!==intent.applicationHash)fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');
        const marker={...intent,key};
        s.control.add(marker);done(marker);
      }catch(e){abort(e);}};
      for(const request of requests)request.onsuccess=finish;
    },scope);
  }
  async function checkpointProjectRecovery({scope,marker,application,before,head,value,editor,queuedValue,newProject,assertAccess=()=>{}}){
    const key=recoveryKey(scope),archiveId='recovery-'+id(marker.operationId);
    if(!head||head.currentRevisionId!==marker.expected.revision||editor?.deviceId!==deviceId
      ||editor.ownerUid!==ownerUid||editor.projectId!==scope||editor.active!==true
      ||editor.epoch!==marker.expected.editor.epoch+1||editor.headRevision!==head.currentRevisionId)fail('LF_PROJECT_RECOVERY_CONFLICT');
    application=await prepareApplication(application);
    if(!application||application.expectedVersion!==marker.applicationVersion||before.image.hash!==marker.applicationHash
      ||before.replica?.version!==marker.replicaVersion)fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');
    const copying=marker.variant==='room-copy',choosingLocal=marker.variant==='local-wins';
    if((copying||choosingLocal)!==!!(queuedValue||newProject)||newProject&&(queuedValue||choosingLocal))fail('LF_PROJECT_RECOVERY_CONFLICT');
    if(newProject&&(!equal(newProject,marker.newRoomProject)||newProject.id!==marker.roomCopy?.id||newProject.meta?.roomProject?.roomId!==newProject.id||newProject.investorId!==value.document.payload.project.investorId||!equal(newProject.projectData[newProject.id],marker.roomCopy.room)))fail('LF_PROJECT_RECOVERY_CONFLICT');
    const operationId=copying?'room-copy-'+marker.operationId:choosingLocal?'room-conflict-'+marker.operationId:null;
    const encoded=json(queuedValue||value),hash=await digest(encoded);
    const receipt={archiveId,editor,...(copying?{operationId,roomId:marker.roomCopy.id}:choosingLocal?{operationId}: {})};
    const protectedJson=queuedValue?json(application.rows):null;
    const protectedHash=queuedValue?await digest(protectedJson):null;
    const archive=json({kind:'project-recovery',sourceScope:scope,image:before.image,replica:before.replica,operations:before.operations,receipt,
      ...(choosingLocal?{replacedRemote:{head,document:value.document}}:{})});
    const archiveHash=await digest(archive);
    return transaction('readwrite',(s,done,abort)=>{
      const pending=s.control.get(key),replica=s.replicas.get(scope),outbox=s.outbox.getAll();
      let waiting=3;
      const finish=()=>{if(--waiting)return;try{
        assertAccess();
        if(choosingLocal)assertRoomConflictIndependent(outbox.result,scope);
        const operations=outbox.result.filter(op=>op.scope===scope);
        if(!equal(pending.result,marker)||!equal(replica.result,before.replica)||!equal(operations,before.operations))fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');
        applicationChange(s,application,previousImage=>{
          assertAccess();
          if(choosingLocal&&!equal(previousImage,before.image))fail('LF_PROJECT_RECOVERY_SOURCE_CHANGED');
          if(newProject)stageNewProjects(s,previousImage,application,[newProject],abort,{[newProject.id]:{operationId,releaseAfterSync:true}});
          s.protected.add({key:archiveId,scope,json:archive,hash:archiveHash});
          for(const op of operations)s.outbox.delete(op.key);
          const version=replica.result.version+1;
          s.replicas.put({key:scope,version,json:encoded,hash,base:head,editor,dirty:!!queuedValue});
          if(queuedValue){
            s.outbox.add({key:operationId,scope,localVersion:version,json:encoded,hash,base:head,previousOperation:null,
              applicationHash:application.hash,editor,phase:'queued',blockers:[],expected:null});
            s.protected.add({key:operationId,scope,json:protectedJson,hash:protectedHash});
            if(choosingLocal)rememberHandover(s.control,scope,editor);
          }
          s.control.delete(key);
          done(receipt);
        },abort);
      }catch(e){abort(e);}};
      pending.onsuccess=replica.onsuccess=outbox.onsuccess=finish;
    },scope);
  }
  async function checkpointDeletion({application,before,scopes,investorIds,assertAccess}){
    application=await prepareApplication(application);
    const beforeHash=await digest(json(before)),encoded=json({version:1,kind:'local-investor-deletion',before,after:application.rows}),hash=await digest(encoded),key='deletion-'+crypto.randomUUID();
    return transaction('readwrite',(s,done,abort)=>{
      const a=s.control.get('application'),r=s.replicas.getAll(),q=s.outbox.getAll();let pending=3;
      const finish=()=>{if(--pending)return;try{
        assertAccess();
        if(a.result?.hash!==beforeHash||!equal(a.result?.rows,before)||a.result?.version!==application.expectedVersion)fail('DELETE_SOURCE_CHANGED');
        const belongs=row=>{if(scopes.includes(row.scope||row.key))return true;const value=JSON.parse(row.json),payload=value?.document?.payload;return investorIds.includes(payload?.investor?.id)||investorIds.includes(payload?.project?.investorId);};
        if(r.result.some(belongs)||q.result.some(belongs))fail('DELETE_SYNCED_PROJECT_PROTECTED');
        applicationChange(s,application,()=>{assertAccess();s.protected.add({key,scope:'investor-deletions',json:encoded,hash});done(true);},abort);
      }catch(e){abort(e);}};
      a.onsuccess=r.onsuccess=q.onsuccess=finish;
    });
  }
  function stageNewProjects(s,before,application,projects,abort,extras={}){
   if(!application||!before)fail('LF_P0B_NEW_PROJECT_REQUIRED');
   const old=JSON.parse(before.rows.fc_projects_v1||'[]'),next=JSON.parse(application.rows.fc_projects_v1||'[]');
   for(const project of projects){
    id(project.id);id(project.investorId);
    if(old.some(row=>row.id===project.id)||!equal(next.find(row=>row.id===project.id),project))fail('LF_APPLICATION_SCOPE_REFUSED');
    const retired=s.control.get('retired:'+project.id);retired.onsuccess=()=>{if(retired.result){abort(Error('LF_P0B_SCOPE_RETIRED'));return;}s.control.add({key:'p0b-new:'+project.id,project:copy(project),...(extras[project.id]||{})});};
   }
  }
  async function checkpointP0BProjects(application,projects,{exitScope}={}){
   if(!(await p0bRegistry()))fail('LF_P0B_REGISTRY_REQUIRED');
   application=await prepareApplication(application);
   return transaction('readwrite',(s,done,abort)=>applicationChange(s,application,before=>{
    stageNewProjects(s,before,application,projects,abort);
    checkpointRoomExit(s,exitScope,()=>done({localConfirmed:true,cloudConfirmed:false}),abort);
   },abort));
  }
  async function pendingNewProjects(){
   return transaction('readonly',(s,done)=>{const q=s.control.getAll();q.onsuccess=()=>done(q.result.filter(row=>row.key.startsWith('p0b-new:')&&!q.result.some(marker=>marker.key==='retired:'+row.project.id)));});
  }
  async function finishNewProject(scope,marker,operationId){
   return transaction('readwrite',(s,done,abort)=>{
    const m=s.control.get('p0b-new:'+id(scope)),q=s.outbox.get(id(operationId)),r=s.replicas.get(scope);
    let pending=3;
    const finish=()=>{if(--pending)return;try{
     const requestedExit=m.result?.releaseAfterSync===true;
     const expected=requestedExit?{...marker,releaseAfterSync:true}:marker;
     if(!equal(m.result,expected)||q.result?.scope!==scope||q.result?.editor?.deviceId!==deviceId)fail('LF_P0B_NEW_PROJECT_REQUIRED');
     const editor=r.result?.editor;
     if(requestedExit&&editor?.epoch===q.result.editor.epoch)rememberHandover(s.control,scope,editor);
     s.control.delete(marker.key);done(true);
    }catch(e){abort(e);}};
    m.onsuccess=q.onsuccess=r.onsuccess=finish;
   },scope);
  }
  async function legacyInvestor(iid){return transaction('readonly',(s,done)=>{const q=s.control.get('legacy-investor:'+id(iid));q.onsuccess=()=>done(!!q.result);});}
  async function fenceP0BTombstones(records,context=null){
   const image=await readApplication(),localProjects=JSON.parse(image?.rows.fc_projects_v1||'[]'),scopes=[];
   for(const record of records){
    if(record.ownerUid!==ownerUid||record.schemaVersion!==1||!record.deletionId||!Number.isSafeInteger(record.generation))fail('LF_P0B_ACK_UNCONFIRMED');
    const iid=id(record.investorId),owned=[...new Set([...Object.keys(record.projects),...localProjects.filter(row=>row.investorId===iid).map(row=>row.id)]),'p0b_contact_'+await digest(iid),'p0b_quotes_'+await digest(iid)];
    for(const scope of owned)scopes.push({key:'retired:'+id(scope),registry:P0B_REGISTRY,investorId:iid,deletionId:id(record.deletionId)});
   }
   const affected=new Set(scopes.map(row=>row.key.slice('retired:'.length))),key='p0b-quarantine-'+await digest(records.map(r=>[r.investorId,r.deletionId]));
   const before=await transaction('readonly',(s,done)=>{const a=s.control.get('application'),r=s.replicas.getAll(),q=s.outbox.getAll(),p=s.protected.get(key);let n=4;const finish=()=>{if(!--n)done({image:a.result||null,replicas:r.result.filter(row=>affected.has(row.key)),operations:q.result.filter(row=>affected.has(row.scope)),archive:p.result||null});};a.onsuccess=r.onsuccess=q.onsuccess=p.onsuccess=finish;});
   if(!equal(before.image,image))fail('LF_APPLICATION_CONFLICT');
   const archive=json({kind:'p0b-deletion-quarantine',records,image:before.image,replicas:before.replicas,operations:before.operations,context}),hash=await digest(archive);
   return transaction('readwrite',(s,done,abort)=>{
    const boundary=s.control.get('p0b-registry'),a=s.control.get('application'),r=s.replicas.getAll(),q=s.outbox.getAll(),p=s.protected.get(key),c=s.control.getAll();let n=6;
    const finish=()=>{if(--n)return;try{
     if(boundary.result?.registry!==P0B_REGISTRY)fail('LF_P0B_REGISTRY_REQUIRED');
     if(!equal(a.result||null,before.image)||!equal(r.result.filter(row=>affected.has(row.key)),before.replicas)||!equal(q.result.filter(row=>affected.has(row.scope)),before.operations)||!equal(p.result||null,before.archive))fail('LF_APPLICATION_CONFLICT');
     for(const row of scopes){const prior=c.result.find(item=>item.key===row.key);if(prior&&!equal(prior,row))fail('LF_P0B_ACK_UNCONFIRMED');s.control.put(row);}
     if(!p.result)s.protected.add({key,scope:'p0b-archives',json:archive,hash});done(true);
    }catch(e){abort(e);}};boundary.onsuccess=a.onsuccess=r.onsuccess=q.onsuccess=p.onsuccess=c.onsuccess=finish;
   });
  }
  async function checkpointP0BTombstones({application,records,assertAccess,context}){
   application=await prepareApplication(application);
   const before=await readApplication(),scopes=new Set();
   for(const r of records){for(const pid of Object.keys(r.projects))scopes.add(pid);for(const row of JSON.parse(before.rows.fc_projects_v1||'[]'))if(row.investorId===r.investorId)scopes.add(row.id);scopes.add('p0b_contact_'+await digest(r.investorId));scopes.add('p0b_quotes_'+await digest(r.investorId));}
   const ids=records.map(r=>r.investorId),allowed=new Set(['fc_investors_v1','fc_projects_v1','fc_quote_snapshots_v1','fc_quote_offer_drafts_v1','fc_investor_removed_ids_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_ui_v1','fc_project_v1']);
   for(const key of new Set([...Object.keys(before.rows),...Object.keys(application.rows)]))if(before.rows[key]!==application.rows[key]&&!allowed.has(key)&&!/^fc_project_inv_.+_v1$/.test(key))fail('LF_APPLICATION_SCOPE_REFUSED');
   const state=await transaction('readonly',(s,done)=>{const r=s.replicas.getAll(),q=s.outbox.getAll(),c=s.control.getAll();let n=3;const finish=()=>{if(!--n)done({replicas:r.result.filter(row=>scopes.has(row.key)),operations:q.result.filter(row=>scopes.has(row.scope)),control:c.result.filter(row=>[...scopes].some(scope=>row.key.endsWith(':'+scope)))});};r.onsuccess=q.onsuccess=c.onsuccess=finish;});
   for(const scope of scopes)if(!state.control.some(row=>row.key==='retired:'+scope&&row.registry===P0B_REGISTRY&&records.some(record=>record.investorId===row.investorId&&record.deletionId===row.deletionId)))fail('LF_P0B_ACK_UNCONFIRMED');
   const archive=json({kind:'p0b-terminal-deletion',before,records,...state,context}),hash=await digest(archive),key='p0b-deleted-'+await digest(records.map(r=>[r.investorId,r.deletionId]));
   return transaction('readwrite',(s,done,abort)=>{
    const r=s.replicas.getAll(),q=s.outbox.getAll(),a=s.control.get('application');let n=3;
    const finish=()=>{if(--n)return;try{
     assertAccess();
     if(!equal(a.result,before)||!equal(r.result.filter(row=>scopes.has(row.key)),state.replicas)||!equal(q.result.filter(row=>scopes.has(row.scope)),state.operations))fail('LF_APPLICATION_CONFLICT');
     for(const iid of ids)if(JSON.parse(application.rows.fc_investors_v1||'[]').some(row=>row.id===iid)||JSON.parse(application.rows.fc_projects_v1||'[]').some(row=>row.investorId===iid))fail('LF_P0B_LOCAL_INVENTORY_REQUIRED');
     applicationChange(s,application,()=>{s.protected.put({key,scope:'p0b-archives',json:archive,hash});done({localConfirmed:true,cloudConfirmed:true});},abort);
    }catch(e){abort(e);}};r.onsuccess=q.onsuccess=a.onsuccess=finish;
   });
  }
  async function p0bRegistry(){return transaction('readonly',(s,done)=>{const q=s.control.get('p0b-registry');q.onsuccess=()=>done(q.result||null);});}
  async function retired(scope){return transaction('readonly',(s,done)=>{const q=s.control.get('retired:'+id(scope));q.onsuccess=()=>done(!!q.result);});}
  async function enterP0BRegistry(sourceRows){
    sourceRows=copy(sourceRows);
    return transaction('readonly',(s,done)=>{const a=s.control.get('application'),r=s.replicas.getAll(),q=s.outbox.getAll(),m=s.control.get('p0b-registry'),c=s.control.getAll();let pending=5;const finish=()=>{if(!--pending)done({image:a.result||null,replicas:r.result,operations:q.result,marker:m.result||null,control:c.result});};a.onsuccess=r.onsuccess=q.onsuccess=m.onsuccess=c.onsuccess=finish;}).then(async before=>{
      if(before.marker?.registry===P0B_REGISTRY)return before.image;
      if(before.marker&&before.marker.registry!=='p0b-v1')fail('LF_P0B_REGISTRY_REQUIRED');
      if(before.image&&await digest(before.image.rows)!==before.image.hash)fail('LF_LOCAL_INTEGRITY');
      const archiveKey=before.marker?'p0b-previous-'+before.marker.registry:'p0b-previous-registry';
      const original=before.image?.rows||sourceRows;
      const archive=json({kind:'p0b-previous-registry',registry:P0B_REGISTRY,...before,sourceRows});
      const hash=await digest(archive),rows=emptyP0BBusiness(original),imageHash=await digest(json(rows));
      const legacyInvestors=JSON.parse(original.fc_investors_v1||'[]').map(row=>id(row.id));
      const legacyProjects=JSON.parse(original.fc_projects_v1||'[]').map(row=>id(row.id));
      return transaction('readwrite',(s,done,abort)=>{
       const a=s.control.get('application'),m=s.control.get('p0b-registry'),r=s.replicas.getAll(),q=s.outbox.getAll();let pending=4;
       const finish=()=>{if(--pending)return;try{
        if(!equal(m.result||null,before.marker)||!equal(a.result||null,before.image)||!equal(r.result,before.replicas)||!equal(q.result,before.operations))fail('LF_APPLICATION_CONFLICT');
        s.protected.add({key:archiveKey,scope:'p0b-archives',json:archive,hash});
        for(const scope of new Set([...legacyProjects,...before.replicas.map(row=>row.key),...before.operations.map(row=>row.scope)]))if(scope!=='globals'&&!before.control.some(row=>row.key==='retired:'+scope))s.control.add({key:'retired:'+scope,registry:'legacy'});
        for(const iid of legacyInvestors)s.control.put({key:'legacy-investor:'+iid});
        s.control.put({key:'p0b-registry',registry:P0B_REGISTRY});
        const image=before.image?{...before.image,version:before.image.version+1,rows,hash:imageHash}:null;
        if(image)s.control.put(image);done(image);
       }catch(e){abort(e);}};a.onsuccess=m.onsuccess=r.onsuccess=q.onsuccess=finish;
      });
    });
  }
  async function initializeApplication(rows){
    let preserved=null;if(migration||!/^meble-lf-test-/.test(name))preserved=await assertApplicationMigration(migration,{name,ownerUid,rows});
    rows=copy(rows);const hash=await digest(json(rows));
    return transaction('readwrite',(s,done,abort)=>{const q=s.control.get('application');q.onsuccess=()=>{
      if(q.result){abort(Error('LF_APPLICATION_ALREADY_INITIALIZED'));return;}
      const next={key:'application',version:1,rows,hash};s.control.add(next);if(preserved)s.control.add(preserved);done(next);
    };});
  }
  function applicationChange(s,application,continueWrite,abort){
    if(!application){continueWrite();return;}
    const q=s.control.get('application');q.onsuccess=()=>{
      const old=q.result;if(!old||old.version!==application.expectedVersion){abort(Error('LF_APPLICATION_CONFLICT'));return;}
      const next={key:'application',version:old.version+1,rows:copy(application.rows),hash:application.hash};
      try{s.control.put(next);continueWrite(old);}catch(e){abort(e);}
    };
  }
  async function commitInternal({scope, operationId, value, expectedVersion, base = null, editor = null, blockers = [], protectedRows = {}, application = null, releaseAfterSync = false,newProjects=[],exitScope},contact=false) {
    if(contact&&!(await p0bRegistry()))fail('LF_P0B_REGISTRY_REQUIRED');
    if(contact&&(scope!=='p0b_contact_'+await digest(id(value?.investorId))||value.kind!=='p0b-contact'||!value.contact||value.contact.rooms!==undefined))fail('LF_P0B_CONTACT_INVALID');
    application=await prepareApplication(application);
    id(scope); id(operationId); editor=copy(editor);base=copy(base);blockers=copy(blockers);
    const encoded = json(value), protection = json(protectedRows), hash = await digest(encoded), protectedHash=await digest(protection);
    if (!Array.isArray(blockers) || blockers.some(v => !/^LF_[A-Z_]+$/.test(v))) fail('LF_BLOCKER_INVALID');
    return transaction('readwrite', (s, done, abort) => {
      const a = s.replicas.get(scope), b = s.outbox.get(operationId), all = s.outbox.getAll(), archived=s.control.get('p1-coalesced:'+operationId), grant=s.control.get('quote-grant:'+scope); let pending = 5;
      const finish = () => { if (--pending) return;
        try {
          if (b.result||archived.result) {
            const prior=b.result||archived.result.operation;
            if (!prior||prior.scope !== scope || prior.hash !== hash || !equal(prior.editor, editor)|| (prior.applicationHash||null)!==(application?.hash||null)) fail('LF_OPERATION_REUSED');
            done({ok: true, duplicate: true, version: prior.localVersion, operationId}); return;
          }
          if(grant.result)fail('LF_QUOTE_ROOM_RESERVED');
          const old = a.result, version = old?.version || 0;
          if (version !== expectedVersion) fail('LF_LOCAL_CONFLICT');
          if (!contact && scope !== 'globals' && (!old?.editor || !old.editor.active || !equal(old.editor, editor)
            || editor.deviceId !== deviceId)) fail('LF_EDITOR_REQUIRED');
          const previous = all.result.filter(row => row.scope === scope).sort((x,y) => y.localVersion - x.localVersion)[0];
          const nextVersion = version + 1;
          applicationChange(s,application,(previousImage)=>{
          if(newProjects.length)stageNewProjects(s,previousImage,application,newProjects,abort);
          s.replicas.put({key: scope, version: nextVersion, json: encoded, hash, base: old?.base || base, editor: copy(editor), dirty: true});
          s.outbox.add({key: operationId, scope, localVersion: nextVersion, json: encoded, hash, base: old?.base || base,
            previousOperation: previous?.key || null, applicationHash:application?.hash||null, editor: copy(editor), phase: blockers.length ? 'blocked' : 'queued', blockers: copy(blockers), expected: null});
          // Retain every protected RAW version; later edits cannot erase its only copy.
          s.protected.add({key: operationId, scope, json: protection,hash:protectedHash});
          if(releaseAfterSync)rememberHandover(s.control,scope,editor);
          checkpointRoomExit(s,exitScope,()=>done({ok:true,operationId,version:nextVersion,localConfirmed:true,cloudConfirmed:false}),abort);
          },abort);
        } catch(e) { abort(e); }
      }; a.onsuccess = b.onsuccess = all.onsuccess = archived.onsuccess = grant.onsuccess = finish;
    },scope);
  }
  const commit=args=>commitInternal(args);
  const commitContact=args=>commitInternal(args,true);
  async function wasProjectCoalesced(operation){
    operation=copy(operation);id(operation.key);id(operation.scope);
    const state=await transaction('readonly',(s,done)=>{
      const a=s.control.get('p1-coalesced:'+operation.key),q=s.outbox.get(operation.key),p=s.protected.get(operation.key);let pending=3;
      const finish=()=>{if(!--pending)done({archive:a.result||null,active:q.result||null,raw:p.result||null});};a.onsuccess=q.onsuccess=p.onsuccess=finish;
    });
    if(state.active||!state.archive||!state.raw||state.archive.replacedBy===operation.key)return false;
    id(state.archive.replacedBy);
    const previous=archivedProjectOperation([state.archive],operation.key);
    return equal(previous,operation)&&state.raw.scope===operation.scope&&state.raw.hash===operation.applicationHash&&await digest(state.raw.json)===state.raw.hash;
  }
  async function transition(operationId, expectedPhase, phase, patch = {}) {
    id(operationId);patch=copy(patch);
    const allowed = {queued: ['inflight','blocked','conflict'], inflight: ['verified','uncertain','conflict'], uncertain: ['verified','conflict']};
    if (!allowed[expectedPhase]?.includes(phase) || Object.keys(patch).some(k => !['expected','receipt','code'].includes(k))) fail('LF_TRANSITION_INVALID');
    return transaction('readwrite', (s, done, abort) => {
      const q = s.outbox.get(operationId);
      q.onsuccess = () => { try {
        const op = q.result; if (!op || op.phase !== expectedPhase) fail('LF_QUEUE_CONFLICT');
        const retired=s.control.get('retired:'+op.scope);retired.onsuccess=()=>{try{
        if(retired.result)fail('LF_P0B_SCOPE_RETIRED');
        const next = {...op, ...copy(patch), phase};
        if (phase === 'inflight' && !next.expected) fail('LF_EXPECTED_REVISION_REQUIRED');
        if(phase==='verified'&&(!next.receipt||!equal(next.receipt,op.expected)))fail('LF_RECEIPT_INVALID');
        s.outbox.put(next);
        if (phase !== 'verified') { done(next); return; }
        const r = s.replicas.get(op.scope); r.onsuccess = () => {
          const current = r.result;
          if (!current) { abort(Error('LF_LOCAL_INTEGRITY')); return; }
          current.base = copy(next.receipt);
          if (current.version === op.localVersion && current.hash === op.hash) current.dirty = false;
          s.replicas.put(current); done(next);
        };
        }catch(e){abort(e);}};
      } catch(e) { abort(e); } };
    });
  }
  async function apply({scope, value, head, expectedVersion, editor = null, application = null}) {
    application=await prepareApplication(application);
    id(scope);head=copy(head);editor=copy(editor);const encoded = json(value), hash = await digest(encoded);
    return transaction('readwrite', (s, done, abort) => {
      const r = s.replicas.get(scope), q = s.outbox.getAll(); let pending = 2;
      const finish = () => { if (--pending) return; try {
        const old = r.result;
        if ((old?.version || 0) !== expectedVersion || old?.dirty || q.result.some(op => op.scope === scope && op.phase !== 'verified')) fail('LF_LOCAL_CONFLICT');
        if (old?.base && (head.generation < old.base.generation || head.generation === old.base.generation && !equal(head,old.base))) fail('LF_STALE_REMOTE');
        if (old && equal(old.base, head)) { if(old.hash!==hash)fail('LF_REMOTE_CONTENT_MISMATCH');done(old); return; }
        const next = {key: scope, version: (old?.version || 0) + 1, json: encoded, hash, base: copy(head), editor: copy(editor), dirty: false};
        applicationChange(s,application,()=>{s.replicas.put(next); done(next);},abort);
      } catch(e) { abort(e); } }; r.onsuccess = q.onsuccess = finish;
    },scope);
  }
  async function setEditor(scope, expectedVersion, expectedEditor, nextEditor, {completeHandover=false}={}) {
    id(scope);
    return transaction('readwrite', (s, done, abort) => {
      const q = s.replicas.get(scope), ops = s.outbox.getAll(), grant=s.control.get('quote-grant:'+scope); let pending = 3;
      const finish = () => { if (--pending) return; try {
        if(grant.result)fail('LF_QUOTE_ROOM_RESERVED');
        const old = q.result;
        if ((old?.version || 0) !== expectedVersion || old?.dirty || !equal(old?.editor || null, expectedEditor)
          || ops.result.some(op => op.scope === scope && op.phase !== 'verified')) fail('LF_LOCAL_CONFLICT');
        const row = old || {key: scope, version: 0, json: 'null', hash: null, base: null, dirty: false};
        row.editor = copy(nextEditor); row.version++;
        if (row.hash === null) { abort(Error('LF_PROJECT_MUST_BE_RECEIVED')); return; }
        s.replicas.put(row);
        if(completeHandover)s.control.delete(handoverKey(scope));
        done(row);
      } catch(e) { abort(e); } }; q.onsuccess = ops.onsuccess = grant.onsuccess = finish;
    },scope);
  }
  const receiveConflictRemote=args=>checkpointRoomConflictRemote({transaction,prepareApplication,applicationChange,ownerUid,deviceId,args});
  return Object.freeze({receiveConflictRemote,...quoteReleaseStore({transaction,ownerUid,deviceId}),...offlineQuoteStore({transaction,ownerUid,deviceId}),
    ...quoteReservationJournal({transaction,ownerUid,deviceId}),ownerUid, deviceId, instanceId, name, snapshot, wasProjectCoalesced, commitQuoteLedger:args=>writeQuoteLedger({transaction,prepareApplication,applicationChange,rememberHandover,deviceId,args}), commitRoomBatch:args=>writeRoomBatch({transaction,prepareApplication,applicationChange,rememberHandover,deviceId,args}), checkpointP0BProjects, pendingNewProjects, finishNewProject, legacyInvestor, fenceP0BTombstones, checkpointP0BTombstones, p0bRegistry, enterP0BRegistry, retired, readCatalogReplica,readApplication,hasPendingUpdateWork,readPreservedSource, initializeApplication, checkpointApplication, pendingHandover, withdrawHandover, pendingProjectRecovery, stageProjectRecovery, checkpointProjectRecovery, checkpointDeletion, commit, commitContact, transition, apply, setEditor,
    exclusive: callback => locks.request(name + ':' + instanceId, {mode: 'exclusive'}, () => {if(closed)fail('LF_STORE_CLOSED');return callback();}),
    close() { closed = true; }});
}
