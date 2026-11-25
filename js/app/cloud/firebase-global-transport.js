// CLOUD-3 borrowed connection only. Intentionally absent from every production manifest.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  function fromConnection({firestore:f,db,session,assertAccess,createGlobalStagingConnection}={}){
    const c=FC.globalDataContract;
    if(!c||!f||!db||typeof session?.identity!=='function'||typeof assertAccess!=='function')throw Error('GLOBAL_DEPENDENCY_UNAVAILABLE');
    let closed=false;const attempts=new WeakMap();
    function identity(expected){
      if(closed)c.fail('GLOBAL_CLIENT_CLOSED');
      try{const result=assertAccess();if(result?.then)c.fail('GLOBAL_ACCESS_UNCONFIRMED');}catch(_){c.fail('GLOBAL_ACCESS_UNCONFIRMED');}
      const who=session.identity();c.id(who.uid);
      if(!Number.isSafeInteger(who.epoch)||(expected&&(who.uid!==expected.uid||who.epoch!==expected.epoch)))c.fail('GLOBAL_AUTH_CHANGED');return who;
    }
    const bound=identity();
    const check=()=>identity(bound);
    const base=f.doc(db,'users',bound.uid,'globalData','current');
    const recordRef=hash=>f.doc(db,'users',bound.uid,'globalRecords',hash);
    const revisionRef=id=>f.doc(db,'users',bound.uid,'globalRevisions',id);
    const equal=(a,b)=>c.canonical(a)===c.canonical(b);
    const fresh=s=>{if(s.metadata.fromCache||s.metadata.hasPendingWrites)c.fail('GLOBAL_REMOTE_UNCONFIRMED');return s;};
    const error=e=>({ok:false,code:/^GLOBAL_/.test(e?.code)||e?.code==='resource-exhausted'?e.code:e?.code==='permission-denied'?'GLOBAL_PERMISSION_DENIED':e?.code==='unavailable'?'GLOBAL_NETWORK_UNCONFIRMED':'GLOBAL_REMOTE_UNCONFIRMED'});
    function headOf(data){
      c.shape({ownerUid:c.id,version:v=>{if(v!==1)c.fail('GLOBAL_HEAD_INVALID');},generation:c.integer,revisionId:v=>{if(typeof v!=='string'||! /^[a-f0-9]{32}$/.test(v))c.fail('GLOBAL_HEAD_INVALID');},directoryHash:c.hashValue,recordCount:c.integer,updatedAt:v=>{if(typeof v?.toMillis!=='function'||!Number.isFinite(v.toMillis()))c.fail('GLOBAL_HEAD_INVALID');}},['ownerUid','version','generation','revisionId','directoryHash','recordCount','updatedAt'])(data,'head');
      if(data.ownerUid!==bound.uid||data.generation<1||data.recordCount>c.MAX_RECORDS)c.fail('GLOBAL_HEAD_INVALID');
      const {updatedAt,...head}=data;return head;
    }
    async function remoteHead(){
      check();fresh(await f.getDocFromServer(base));check();
      const snap=await f.runTransaction(db,async tx=>{check();const s=fresh(await tx.get(base));check();return s;},{maxAttempts:3});check();
      return snap.exists()?headOf(snap.data()):null;
    }
    function validateBase(head){if(head===null)return;headOf({...head,updatedAt:{toMillis:()=>1}});}
    async function fetchRecords(directory){
      const refs=Object.values(directory).flat().map(r=>recordRef(r.hash));
      // Immutable records need server reads, not mutable-data transactions:
      // each hash, the frozen directory and the final head are verified.
      // Refuse total size while reading, before retaining an oversized bundle.
      const records=[];let total=0;
      for(let offset=0;offset<refs.length;offset+=32){
        check();
        const batch=await Promise.allSettled(refs.slice(offset,offset+32).map(async ref=>{
          check();const snap=fresh(await f.getDocFromServer(ref));check();return snap;
        }));
        const refused=batch.find(result=>result.status==='rejected');if(refused)throw refused.reason;
        const snaps=batch.map(result=>result.value);check();
        if(snaps.some(s=>!s.exists()))c.fail('GLOBAL_RECORD_MISSING');
        for(const snap of snaps){const r=snap.data();
          if(typeof r.json!=='string'||!Number.isSafeInteger(r.byteLength)||r.byteLength<1||r.byteLength>c.MAX_RECORD_BYTES)c.fail('GLOBAL_RECORD_INVALID');
          const bytes=new TextEncoder().encode(r.json).length;
          if(bytes!==r.byteLength)c.fail('GLOBAL_INTEGRITY_INVALID');total+=bytes;
          if(total>c.MAX_TOTAL_BYTES)c.fail('GLOBAL_SIZE_LIMIT');records.push(r);
        }
      }
      return records;
    }
    async function readRevision(head){
        const snap=await f.runTransaction(db,async tx=>{check();const s=fresh(await tx.get(revisionRef(head.revisionId)));check();return s;},{maxAttempts:3});check();
        if(!snap.exists())c.fail('GLOBAL_REVISION_MISSING');const rev=snap.data();
        c.shape({ownerUid:c.id,version:v=>{if(v!==1)c.fail('GLOBAL_REVISION_INVALID');},generation:c.integer,revisionId:c.id,directoryHash:c.hashValue,recordCount:c.integer,directory:v=>{if(typeof v!=='string'||new TextEncoder().encode(v).length>c.MAX_DIRECTORY_BYTES)c.fail('GLOBAL_SIZE_LIMIT');},baseGeneration:c.integer,baseRevisionId:v=>{if(typeof v!=='string')c.fail('GLOBAL_REVISION_INVALID');},baseDirectoryHash:v=>{if(typeof v!=='string')c.fail('GLOBAL_REVISION_INVALID');},createdAt:v=>{if(typeof v?.toMillis!=='function'||!Number.isFinite(v.toMillis()))c.fail('GLOBAL_REVISION_INVALID');}},['ownerUid','version','generation','revisionId','directoryHash','recordCount','directory','baseGeneration','baseRevisionId','baseDirectoryHash','createdAt'])(rev,'revision');
        for(const key of Object.keys(head))if(rev[key]!==head[key])c.fail('GLOBAL_REVISION_INVALID');
        if(rev.baseGeneration!==head.generation-1||!(rev.baseGeneration===0?rev.baseRevisionId===''&&rev.baseDirectoryHash==='':/^[a-f0-9]{32}$/.test(rev.baseRevisionId)&&/^[a-f0-9]{64}$/.test(rev.baseDirectoryHash)))c.fail('GLOBAL_REVISION_INVALID');
        if(await c.sha(new TextEncoder().encode(rev.directory))!==head.directoryHash)c.fail('GLOBAL_INTEGRITY_INVALID');check();
        let directory;try{directory=JSON.parse(rev.directory);}catch(_){c.fail('GLOBAL_DIRECTORY_INVALID');}
        if(c.canonical(directory)!==rev.directory)c.fail('GLOBAL_DIRECTORY_INVALID');
        // Validate/bound directory before using it to allocate or issue reads.
        validateDirectory(directory,head.recordCount);
        return {rev,directory};
    }
    async function read(){
      try{
        const head=await remoteHead();if(!head)c.fail('GLOBAL_NOT_FOUND');
        const {rev,directory}=await readRevision(head);
        const records=await fetchRecords(directory),result=await c.unpack(bound.uid,directory,records);c.validateBundle(result.model);check();
        if(!equal(await remoteHead(),head))c.fail('GLOBAL_READ_CONFLICT');
        return {ok:true,head,...result,parent:{generation:rev.baseGeneration,revisionId:rev.baseRevisionId,directoryHash:rev.baseDirectoryHash}};
      }catch(e){return error(e);}
    }
    function validateDirectory(directory,count){
      if(!directory||Array.isArray(directory)||typeof directory!=='object')c.fail('GLOBAL_DIRECTORY_INVALID');let total=0;
      for(const [domain,entries]of Object.entries(directory)){
        if(!Object.hasOwn(c.schemas,domain)||!Array.isArray(entries))c.fail('GLOBAL_DIRECTORY_INVALID');
        const seen=new Set();for(const entry of entries){c.shape({id:c.id,hash:c.hashValue},['id','hash'])(entry,'directory');if(seen.has(entry.id))c.fail('GLOBAL_DUPLICATE_ID');seen.add(entry.id);total++;}
      }if(total!==count||total>c.MAX_RECORDS)c.fail('GLOBAL_DIRECTORY_INVALID');
    }
    async function prepare({model,expectedHead,assertSource=()=>{},idempotentPublication=false}={}){
      try{
        check();if(expectedHead===undefined||typeof assertSource!=='function')c.fail('GLOBAL_BASE_REQUIRED');validateBase(expectedHead);c.validateBundle(model);source({assertSource});
        const packed=await c.pack(bound.uid,c.clone(model));check();source({assertSource});
        const current=await remoteHead();check();source({assertSource});
        if(!equal(current,expectedHead)){
          // Exact same confirmed content is a no-op, never a rebase/write of
          // different data. Used by LOCAL-FIRST's additive factory upgrades.
          if(idempotentPublication&&current?.directoryHash===packed.directoryHash)return {ok:true,unchanged:true,head:current};
          c.fail('GLOBAL_WRITE_CONFLICT');
        }
        if(current?.directoryHash===packed.directoryHash)return {ok:true,unchanged:true,head:current};
        const revisionId=idempotentPublication?(await c.sha(c.encode({kind:'global-publication-v1',ownerUid:bound.uid,base:current,directoryHash:packed.directoryHash}))).slice(0,32):crypto.randomUUID().replace(/-/g,'');
        check();source({assertSource});
        const handle=Object.freeze({revisionId}),head={ownerUid:bound.uid,version:1,generation:(current?.generation||0)+1,revisionId:handle.revisionId,directoryHash:packed.directoryHash,recordCount:packed.records.length};
        // A verified base manifest proves which content-addressed records were
        // already published. Stage only new hashes; fetch/unpack EVERY record
        // again before the head CAS, including reused base records.
        const existing=current?new Set(Object.values((await readRevision(current)).directory).flat().map(row=>row.hash)):new Set();
        check();source({assertSource});
        const stagingRecords=packed.records.filter(record=>!existing.has(record.hash));
        attempts.set(handle,{packed,stagingRecords,head,base:current,assertSource,state:'prepared'});return {ok:true,handle,records:head.recordCount};
      }catch(e){return error(e);}
    }
    function source(a){const result=a.assertSource();if(result?.then)c.fail('GLOBAL_SOURCE_UNCONFIRMED');}
    const lookup=handle=>{check();const a=attempts.get(handle);if(!a)c.fail('GLOBAL_ATTEMPT_UNKNOWN');return a;};
    async function confirm(handle){
      try{const a=lookup(handle),head=await remoteHead();check();
        if(equal(head,a.head)){a.state='published';return {ok:true,published:true,head};}
        if(equal(head,a.base)){a.state='retry_allowed';return {ok:false,code:'GLOBAL_PUBLICATION_NOT_OBSERVED',published:'unconfirmed'};}
        a.state='conflict';return {ok:false,code:'GLOBAL_WRITE_CONFLICT',published:'unconfirmed'};
      }catch(e){return {...error(e),published:'unconfirmed'};}
    }
    async function publish(handle){
      let a,phase='validation';
      try{
        a=lookup(handle);if(a.state==='unconfirmed')c.fail('GLOBAL_CONFIRMATION_REQUIRED');if(a.state==='conflict')c.fail('GLOBAL_WRITE_CONFLICT');
        source(a);const current=await remoteHead();check();source(a);if(equal(current,a.head))return await confirm(handle);
        if(!equal(current,a.base)&&a.state!=='published')c.fail('GLOBAL_WRITE_CONFLICT');
        phase='staging';await remoteHead();check();
        // Existing Rules use at most five access calls per record (including
        // syncOwner); four writes fit20 even without cached grant reads.
        // Preserve the first three-record checkpoint used by durable recovery.
        const main={firestore:f,db,assertAccess:check};
        async function stageBatch(batch,connection){
          check();source(a);connection.assertAccess();
          const sdk=connection.firestore;
          await sdk.runTransaction(connection.db,async tx=>{
            check();connection.assertAccess();
            const refs=batch.map(r=>sdk.doc(connection.db,'users',bound.uid,'globalRecords',r.hash));
            const snaps=await Promise.all(refs.map(async ref=>fresh(await tx.get(ref))));
            check();source(a);connection.assertAccess();
            for(let i=0;i<batch.length;i++){
              if(snaps[i].exists()){if(!equal(snaps[i].data(),batch[i]))c.fail('GLOBAL_RECORD_CONFLICT');}
              else tx.set(refs[i],batch[i]);
            }
          },{maxAttempts:3});check();connection.assertAccess();
        }
        if(a.stagingRecords.length)await stageBatch(a.stagingRecords.slice(0,3),main);
        let offset=3;
        const lanes=[main];
        if(offset<a.stagingRecords.length&&createGlobalStagingConnection){
          check();source(a);const staging=await createGlobalStagingConnection();check();source(a);staging.assertAccess();
          if(staging.session?.identity()?.uid!==bound.uid||staging.db===db)c.fail('GLOBAL_AUTH_CHANGED');
          lanes.push(staging);
        }
        // Separate SDK queues overlap latency; never borrow the independent
        // reader or increase the four-record / twenty-access-call Rules bound.
        // Drain every started transaction before reporting a failed wave.
        let failure=null;
        await Promise.all(lanes.map(async connection=>{
          while(!failure&&offset<a.stagingRecords.length){
            const next=offset;offset+=4;
            try{await stageBatch(a.stagingRecords.slice(next,next+4),connection);}
            catch(error){if(!failure)failure={error};}
          }
        }));
        if(failure)throw failure.error;
        const records=await fetchRecords(a.packed.directory);await c.unpack(bound.uid,a.packed.directory,records);check();source(a);
        phase='publication';a.state='unconfirmed';
        await remoteHead();check();
        await f.runTransaction(db,async tx=>{
          check();const snap=fresh(await tx.get(base)),old=snap.exists()?headOf(snap.data()):null;
          if(equal(old,a.head))return;
          if(!equal(old,a.base))c.fail('GLOBAL_WRITE_CONFLICT');
          const rev=fresh(await tx.get(revisionRef(a.head.revisionId)));check();source(a);
          if(rev.exists())c.fail('GLOBAL_REVISION_CONFLICT');
          tx.set(revisionRef(a.head.revisionId),{...a.head,directory:a.packed.directoryJson,baseGeneration:a.base?.generation||0,baseRevisionId:a.base?.revisionId||'',baseDirectoryHash:a.base?.directoryHash||'',createdAt:f.serverTimestamp()});
          tx.set(base,{...a.head,updatedAt:f.serverTimestamp()});check();
        },{maxAttempts:3});check();phase='confirmation';
        return await confirm(handle);
      }catch(e){
        // Rules may reject a stale CAS before the SDK reports contention as
        // aborted. Classify only after a fresh, independently authorized read;
        // do not retry the write or reinterpret a revoked grant as a conflict.
        if(a&&phase==='publication'&&e?.code==='permission-denied'){
          try{const head=await remoteHead();if(!equal(head,a.base)&&!equal(head,a.head))e={code:'GLOBAL_WRITE_CONFLICT'};}catch(_){ }
        }
        const uncertain=phase==='publication'||phase==='confirmation'||a?.state==='unconfirmed';if(a&&uncertain)a.state=e?.code==='GLOBAL_WRITE_CONFLICT'?'conflict':'unconfirmed';
        return {...error(e),phase,published:a?.state==='published'?true:uncertain?'unconfirmed':false};
      }
    }
    return {read,prepare,publish,confirm,readHead:async()=>{try{return {ok:true,head:await remoteHead()};}catch(e){return error(e);}},identity:check,async close(){closed=true;}};
  }
  FC.firebaseGlobalTransport={fromConnection};
})();
