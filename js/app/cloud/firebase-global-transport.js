// CLOUD-3 borrowed connection only. Intentionally absent from every production manifest.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  function fromConnection({firestore:f,db,session,assertAccess}={}){
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
    const error=e=>({ok:false,code:/^GLOBAL_/.test(e?.code)?e.code:e?.code==='permission-denied'?'GLOBAL_PERMISSION_DENIED':e?.code==='unavailable'?'GLOBAL_NETWORK_UNCONFIRMED':'GLOBAL_REMOTE_UNCONFIRMED'});
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
      // Immutable records can be fetched in bounded transactions without
      // mixing generations: the frozen directory and final head are verified.
      // Refuse total size while reading, before retaining an oversized bundle.
      const records=[];let total=0;
      for(let offset=0;offset<refs.length;offset+=32){
        const snaps=await f.runTransaction(db,async tx=>{check();const values=await Promise.all(refs.slice(offset,offset+32).map(r=>tx.get(r)));values.forEach(fresh);check();return values;},{maxAttempts:3});check();
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
    async function read(){
      try{
        const head=await remoteHead();if(!head)c.fail('GLOBAL_NOT_FOUND');
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
        const records=await fetchRecords(directory),result=await c.unpack(bound.uid,directory,records);c.validateBundle(result.model);check();
        if(!equal(await remoteHead(),head))c.fail('GLOBAL_READ_CONFLICT');return {ok:true,head,...result};
      }catch(e){return error(e);}
    }
    function validateDirectory(directory,count){
      if(!directory||Array.isArray(directory)||typeof directory!=='object')c.fail('GLOBAL_DIRECTORY_INVALID');let total=0;
      for(const [domain,entries]of Object.entries(directory)){
        if(!Object.hasOwn(c.schemas,domain)||!Array.isArray(entries))c.fail('GLOBAL_DIRECTORY_INVALID');
        const seen=new Set();for(const entry of entries){c.shape({id:c.id,hash:c.hashValue},['id','hash'])(entry,'directory');if(seen.has(entry.id))c.fail('GLOBAL_DUPLICATE_ID');seen.add(entry.id);total++;}
      }if(total!==count||total>c.MAX_RECORDS)c.fail('GLOBAL_DIRECTORY_INVALID');
    }
    async function prepare({model,expectedHead,assertSource=()=>{}}={}){
      try{
        check();if(expectedHead===undefined||typeof assertSource!=='function')c.fail('GLOBAL_BASE_REQUIRED');validateBase(expectedHead);c.validateBundle(model);source({assertSource});
        const packed=await c.pack(bound.uid,c.clone(model));check();source({assertSource});
        const current=await remoteHead();if(!equal(current,expectedHead))c.fail('GLOBAL_WRITE_CONFLICT');
        if(current?.directoryHash===packed.directoryHash)return {ok:true,unchanged:true,head:current};
        const handle=Object.freeze({revisionId:crypto.randomUUID().replace(/-/g,'')}),head={ownerUid:bound.uid,version:1,generation:(current?.generation||0)+1,revisionId:handle.revisionId,directoryHash:packed.directoryHash,recordCount:packed.records.length};
        attempts.set(handle,{packed,head,base:current,assertSource,state:'prepared'});return {ok:true,handle,records:head.recordCount};
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
        source(a);if(!equal(await remoteHead(),a.base)&&a.state!=='published')c.fail('GLOBAL_WRITE_CONFLICT');
        phase='staging';await remoteHead();check();
        for(const r of a.packed.records){
          // Server preflight also prevents disabled-network transactions from queuing.
          check();source(a);
          await f.runTransaction(db,async tx=>{check();const ref=recordRef(r.hash),snap=fresh(await tx.get(ref));check();source(a);
            if(snap.exists()){if(!equal(snap.data(),r))c.fail('GLOBAL_RECORD_CONFLICT');}
            else tx.set(ref,r);
          },{maxAttempts:3});check();
        }
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
