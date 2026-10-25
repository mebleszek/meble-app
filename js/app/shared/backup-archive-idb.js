(function(root){
  'use strict';
  const FC=root.FC=root.FC||{},F=FC.backupArchiveFormat;
  const {access,fail,hash}=F;
  const MARKER='{"v":1,"backend":"indexeddb"}';
  function open(create){
    access();
    return new Promise((resolve,reject)=>{
      if(!root.indexedDB)return reject(Error('ARCHIVE_IDB_UNAVAILABLE'));
      let abandoned=false;
      const request=root.indexedDB.open(F.DB,1);
      request.onupgradeneeded=()=>{
        if(!create){request.transaction.abort();return;}
        try{access();}catch(e){request.transaction.abort();reject(e);return;}
        request.result.createObjectStore('control',{keyPath:'key'});
        request.result.createObjectStore('records',{keyPath:'id'});
        request.result.createObjectStore('sources',{keyPath:'sha256'});
      };
      request.onerror=()=>reject(Error('ARCHIVE_IDB_OPEN_FAILED'));
      request.onblocked=()=>{abandoned=true;reject(Error('ARCHIVE_IDB_BLOCKED'));};
      request.onsuccess=()=>{
        const db=request.result;db.onversionchange=()=>db.close();
        if(abandoned){db.close();return;}
        try{
          access();
          if(JSON.stringify(Array.from(db.objectStoreNames).sort())!==JSON.stringify(['control','records','sources']))fail('ARCHIVE_SCHEMA_UNKNOWN');
          resolve(db);
        }catch(e){db.close();reject(e);}
      };
    });
  }
  async function exists(){
    access();
    if(!root.indexedDB?.databases)fail('ARCHIVE_IDB_INVENTORY_UNAVAILABLE');
    const databases=await root.indexedDB.databases();access();
    return databases.some(d=>d.name===F.DB);
  }
  async function transaction(mode,run,create=false){
    const db=await open(create);
    try{return await new Promise((resolve,reject)=>{
      let result,tx;
      try{access();tx=db.transaction(['control','records','sources'],mode,mode==='readwrite'?{durability:'strict'}:undefined);}
      catch(_){reject(Error('ARCHIVE_TRANSACTION_UNAVAILABLE'));return;}
      const stores=Object.fromEntries(['control','records','sources'].map(n=>[n,tx.objectStore(n)]));
      tx.oncomplete=()=>{try{access();resolve(result);}catch(e){reject(e);}};
      tx.onabort=()=>{const e=tx.archiveFailure||tx.error;reject(e?.name==='QuotaExceededError'?Error('ARCHIVE_IDB_QUOTA'):/^(ARCHIVE|RECOVERY)_[A-Z_]+$/.test(e?.message||'')?e:Error('ARCHIVE_TRANSACTION_ABORTED'));};
      tx.onerror=()=>{};
      try{run(stores,value=>{result=value;},tx);}catch(e){tx.abort();reject(e);}
    });}finally{db.close();}
  }
  async function read(){
    if(!await exists()){
      if(root.localStorage.getItem(F.ROUTE)!==null)fail('ARCHIVE_IDB_MISSING');
      return {state:null,records:[],source:null};
    }
    const result=await transaction('readonly',(s,done)=>{
      const q=s.control.getAll(),rows=s.records.getAll(),sources=s.sources.getAll();let states,records,rawSources,received=0;
      function end(){if(++received===3)done({states,records,rawSources});}
      q.onsuccess=()=>{states=q.result;end();};
      rows.onsuccess=()=>{records=rows.result;end();};
      sources.onsuccess=()=>{rawSources=sources.result;end();};
    });
    if(result.states.length>1||result.rawSources.length>1||result.states.length!==result.rawSources.length)fail('ARCHIVE_STATE_INVALID');
    result.state=result.states[0]||null;result.source=result.rawSources[0]||null;
    delete result.states;delete result.rawSources;
    if(result.state&&result.state.key!=='archive')fail('ARCHIVE_STATE_INVALID');
    if(result.state&&(!['INITIALIZING','COPIED','CANCELLED','SWITCH_PENDING','ACTIVE'].includes(result.state.phase)||result.state.schema!==1
      ||!Number.isSafeInteger(result.state.revision)||result.state.revision<0||!Number.isSafeInteger(result.state.count)||result.state.count<0
      ||!result.source||typeof result.source.raw!=='string'||result.source.sha256!==result.state.sourceHash
      ||await hash(result.source.raw)!==result.state.sourceHash))fail('ARCHIVE_STATE_INVALID');
    if(result.state&&(result.state.count!==result.records.length||result.state.phase==='ACTIVE'&&root.localStorage.getItem(F.ROUTE)!=='{"v":1,"backend":"indexeddb"}'))fail('ARCHIVE_STATE_INVALID');
    if(!result.state&&(result.records.length||root.localStorage.getItem(F.ROUTE)!==null))fail('ARCHIVE_STATE_INVALID');
    if(result.state?.phase==='INITIALIZING'&&(result.state.origin!=='fresh'||result.source.raw!=='[]'||result.records.length))fail('ARCHIVE_STATE_INVALID');
    const route=root.localStorage.getItem(F.ROUTE);
    if(route!==null&&route!==MARKER||['COPIED','CANCELLED'].includes(result.state?.phase)&&route!==null)fail('ARCHIVE_STATE_INVALID');
    access();return result;
  }
  async function checkCopy(result,raw){
    const {state,source,records}=result;
    if(!state||!source||source.raw!==raw||state.sourceHash!==await hash(raw))fail('ARCHIVE_SOURCE_CHANGED');
    const original=F.parse(raw),rows=await F.decode(records);
    const canonical=list=>JSON.stringify(list.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
    if(state.phase!=='ACTIVE'){
      if(canonical(rows)!==canonical(original))fail('ARCHIVE_COPY_MISMATCH');
      const fragments=F.rawRecords(raw),byId=new Map(records.map(r=>[r.id,r.raw]));
      if(original.some((row,i)=>byId.get(row.id)!==fragments[i]))fail('ARCHIVE_COPY_RAW_MISMATCH');
    }
    return rows;
  }
  async function copy(){
    return F.exclusive(async()=>{
      const raw=root.localStorage.getItem(F.KEY),rows=F.parse(raw),sourceHash=await hash(raw);
      const before=await read();
      if(['INITIALIZING','ACTIVE','SWITCH_PENDING'].includes(before.state?.phase))fail('ARCHIVE_ALREADY_SWITCHED');
      if(before.state&&before.state.sourceHash!==sourceHash)fail('ARCHIVE_SOURCE_CHANGED');
      const records=[],fragments=F.rawRecords(raw);
      for(let i=0;i<rows.length;i++)records.push(await F.encode(rows[i],fragments[i]));
      access();if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
      await transaction('readwrite',(s,done,tx)=>{
        const q=s.control.get('archive');q.onsuccess=()=>{
          try{
            access();if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
            if(JSON.stringify(q.result||null)!==JSON.stringify(before.state))fail('ARCHIVE_REVISION_CONFLICT');
            for(const record of records){access();s.records.put(record);}
            s.sources.put({sha256:sourceHash,raw});
            s.control.put({key:'archive',schema:1,phase:'COPIED',sourceHash,count:rows.length,revision:(before.state?.revision??-1)+1});done(true);
          }catch(error){tx.archiveFailure=error;tx.abort();}
        };
      },true);
      // A new connection, not just request success inside the write transaction.
      const after=await read();await checkCopy(after,raw);
      access();if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
      return {phase:'COPIED',count:rows.length,sourceHash,valueUnits:raw.length,sourcePreserved:true};
    });
  }
  // Cancel preparation, not the project session. Keep the exact old copy and
  // source in IDB as evidence; localStorage remains the sole live archive.
  async function cancelCopy(decision){
    return F.exclusive(async()=>{
      const before=await read(),state=before.state,raw=root.localStorage.getItem(F.KEY);
      if(state?.phase!=='COPIED')fail('ARCHIVE_NOT_COPIED');
      if(!decision||decision.sourceHash!==state.sourceHash||decision.revision!==state.revision)fail('ARCHIVE_REVISION_CONFLICT');
      await checkCopy(before,before.source.raw);F.parse(raw);
      access();if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
      const next={...state,phase:'CANCELLED',revision:state.revision+1};
      await changeState(state,next,()=>{
        if(root.localStorage.getItem(F.KEY)!==raw||root.localStorage.getItem(F.ROUTE)!==null)fail('ARCHIVE_SOURCE_CHANGED');
      });
      const after=await read();await checkCopy(after,before.source.raw);
      if(JSON.stringify(after.state)!==JSON.stringify(next))fail('ARCHIVE_WRITE_UNCONFIRMED');
      access();if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
      return {phase:'CANCELLED',sourcePreserved:true,copyPreserved:true};
    });
  }
  function writeMarker(){
    try{root.localStorage.setItem(F.ROUTE,MARKER);}
    catch(error){fail(error?.name==='QuotaExceededError'?'ARCHIVE_ROUTE_QUOTA':'ARCHIVE_ROUTE_WRITE_FAILED');}
    let confirmed=false;
    try{confirmed=root.localStorage.getItem(F.ROUTE)===MARKER;}catch(_){fail('ARCHIVE_ROUTE_UNCONFIRMED');}
    if(!confirmed)fail('ARCHIVE_ROUTE_UNCONFIRMED');
  }
  // Called only under the archive lock by an explicit backup write. No legacy
  // data is removed: absent source -> atomic empty journal -> marker -> ACTIVE.
  // A crash at any boundary leaves an empty retryable journal or an ACTIVE IDB;
  // the actual first backup still needs its own confirmed records transaction.
  async function initializeFresh(before){
    if(root.localStorage.getItem(F.KEY)!==null)fail('ARCHIVE_LEGACY_WRITER_CONFLICT');
    if(!before.state){
      const raw='[]',sourceHash=await hash(raw);
      await transaction('readwrite',(s,done,tx)=>{
        const q=s.control.get('archive');q.onsuccess=()=>{
          try{
            access();if(q.result||root.localStorage.getItem(F.KEY)!==null||root.localStorage.getItem(F.ROUTE)!==null)fail('ARCHIVE_REVISION_CONFLICT');
            s.sources.put({sha256:sourceHash,raw});
            s.control.put({key:'archive',schema:1,phase:'INITIALIZING',origin:'fresh',sourceHash,count:0,revision:0});access();done(true);
          }catch(error){tx.archiveFailure=error;tx.abort();}
        };
      },true);
      before=await read();
    }
    if(before.state?.phase!=='INITIALIZING')fail('ARCHIVE_STATE_INVALID');
    await checkCopy(before,'[]');access();
    if(root.localStorage.getItem(F.KEY)!==null)fail('ARCHIVE_LEGACY_WRITER_CONFLICT');
    if(root.localStorage.getItem(F.ROUTE)!==MARKER)writeMarker();
    const next={...before.state,phase:'ACTIVE',revision:before.state.revision+1};
    await changeState(before.state,next,()=>{
      if(root.localStorage.getItem(F.KEY)!==null||root.localStorage.getItem(F.ROUTE)!==MARKER)fail('ARCHIVE_REVISION_CONFLICT');
    });
    const after=await read();
    if(JSON.stringify(after.state)!==JSON.stringify(next)||root.localStorage.getItem(F.KEY)!==null)fail('ARCHIVE_WRITE_UNCONFIRMED');
    await checkCopy(after,'[]');access();return after;
  }
  async function inspect(){
    access();const raw=root.localStorage.getItem(F.KEY),result=await read();
    if(result.state?.phase==='CANCELLED'&&raw===null)fail('ARCHIVE_SOURCE_MISSING');
    let rows=raw===null?null:F.parse(raw);
    if(result.state?.phase==='CANCELLED')await checkCopy(result,result.source.raw);
    else if(result.state&&result.state.phase!=='ACTIVE')rows=await checkCopy(result,raw===null?result.source.raw:raw);
    else if(result.state)rows=await F.decode(result.records);
    const sourceHash=raw===null?result.state?.sourceHash:await hash(raw);
    access();if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
    return {phase:result.state?.phase||'LEGACY',count:result.state&&result.state.phase!=='CANCELLED'?result.records.length:(rows?.length??0),
      valueUnits:raw?.length??0,sourceHash,
      pinned:(rows||[]).filter(r=>r.pinned||r.safeState||r.reason==='safe-state').length,
      appCount:(rows||[]).filter(r=>r.reason!=='before-tests').length,testCount:(rows||[]).filter(r=>r.reason==='before-tests').length,sourcePresent:raw!==null};
  }
  // State lives only in business IndexedDB. LocalStorage never receives a manifest.
  async function changeState(expected,next,guard=()=>{}){
    await transaction('readwrite',(s,done,tx)=>{
      const q=s.control.get('archive');q.onsuccess=()=>{
        try{access();if(JSON.stringify(q.result)!==JSON.stringify(expected))fail('ARCHIVE_REVISION_CONFLICT');guard();s.control.put(next);access();done(true);}
        catch(error){tx.archiveFailure=error;tx.abort();}
      };
    });
  }
  async function activate(decision,receipt){
    return F.exclusive(async()=>{
      access();const current=await read(),s=current.state;
      if(!s||!['COPIED','SWITCH_PENDING'].includes(s.phase))fail('ARCHIVE_NOT_COPIED');
      const raw=root.localStorage.getItem(F.KEY);
      await checkCopy(current,raw===null?current.source.raw:raw);
      if(!decision||decision.approved!==true||decision.key!==F.KEY||decision.sourceHash!==s.sourceHash
        ||decision.otherWritersClosed!==true)fail('ARCHIVE_SEPARATE_DECISION_REQUIRED');
      // Receipt is a private capability minted only by re-reading the downloaded file.
      if(!FC.storageRecoveryExport?.isReceipt(receipt,s.sourceHash))fail('ARCHIVE_FILE_NOT_VERIFIED');
      if(raw===null&&s.phase!=='SWITCH_PENDING')fail('ARCHIVE_SOURCE_CHANGED');
      const pending={...s,phase:'SWITCH_PENDING',revision:s.revision+1,fileHash:receipt.fileHash};
      await changeState(s,pending);
      // No new writer may use legacy after this durable fence. A crash here blocks writes.
      const proof=await read();await checkCopy(proof,current.source.raw);access();
      FC.storageRecoveryExport.assertReceiptCurrent(receipt);
      if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
      // Small, read-back checked routing fence MUST fit before removing anything.
      // It detects later loss/eviction of business IndexedDB; never fall back silently.
      writeMarker();
      access();if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
      if(raw!==null)root.localStorage.removeItem(F.KEY); // ONLY explicit separately approved stage E.
      if(root.localStorage.getItem(F.KEY)!==null)fail('ARCHIVE_LEGACY_REMOVE_FAILED');
      access();await changeState(pending,{...pending,phase:'ACTIVE',revision:pending.revision+1});
      const after=await read();if(after.state.phase!=='ACTIVE')fail('ARCHIVE_SWITCH_UNCONFIRMED');
      return {phase:'ACTIVE',freedValueUnits:raw?.length??0};
    });
  }
  async function list(){
    access();const current=await read();
    if(current.state?.phase==='INITIALIZING'){
      // This journal is strictly validated as empty. Listing must stay read-only
      // and must let ensureCurrentStateBackup reach its explicit retrying write.
      if(root.localStorage.getItem(F.KEY)!==null)fail('ARCHIVE_LEGACY_WRITER_CONFLICT');
      return [];
    }
    if(current.state?.phase==='SWITCH_PENDING')fail('ARCHIVE_SWITCH_PENDING');
    if(current.state?.phase==='ACTIVE'){
      if(root.localStorage.getItem(F.KEY)!==null)fail('ARCHIVE_LEGACY_WRITER_CONFLICT');
      const rows=await F.decode(current.records);access();return rows;
    }
    const raw=root.localStorage.getItem(F.KEY);
    if(current.state?.phase==='CANCELLED'&&raw===null)fail('ARCHIVE_SOURCE_MISSING');
    const rows=raw===null?[]:F.parse(raw);access();return rows;
  }
  async function mutate(run){
    return F.exclusive(async()=>{
      let before=await read(),phase=before.state?.phase;
      if(phase==='COPIED'||phase==='SWITCH_PENDING')fail('ARCHIVE_MIGRATION_FROZEN');
      if(phase==='INITIALIZING'||!phase&&root.localStorage.getItem(F.KEY)===null){before=await initializeFresh(before);phase=before.state.phase;}
      const raw=root.localStorage.getItem(F.KEY);
      if(phase==='CANCELLED'&&raw===null)fail('ARCHIVE_SOURCE_MISSING');
      if(phase==='ACTIVE'&&raw!==null)fail('ARCHIVE_LEGACY_WRITER_CONFLICT');
      const rows=phase==='ACTIVE'?await F.decode(before.records):(raw===null?[]:F.parse(raw));
      access();const outcome=await run(rows),next=outcome.rows;
      F.parse(JSON.stringify(next));access();
      if(root.localStorage.getItem(F.KEY)!==raw)fail('ARCHIVE_SOURCE_CHANGED');
      if(phase!=='ACTIVE'){
        root.localStorage.setItem(F.KEY,JSON.stringify(next));
        if(root.localStorage.getItem(F.KEY)!==JSON.stringify(next))fail('ARCHIVE_WRITE_UNCONFIRMED');
        access();return outcome.value;
      }
      const encoded=[],originals=new Map(before.records.map(r=>[r.id,r]));
      for(const row of next){
        const old=originals.get(row.id);
        encoded.push(old&&JSON.stringify(JSON.parse(old.raw))===JSON.stringify(row)?old:await F.encode(row));
      }
      const nextState={...before.state,revision:before.state.revision+1,count:next.length};
      await transaction('readwrite',(s,done,tx)=>{
        const q=s.control.get('archive');q.onsuccess=()=>{
          try{
            access();if(root.localStorage.getItem(F.KEY)!==null||JSON.stringify(q.result)!==JSON.stringify(before.state))fail('ARCHIVE_REVISION_CONFLICT');
            const old=new Map(before.records.map(r=>[r.id,r]));
            for(const row of encoded){access();if(row.raw!==old.get(row.id)?.raw)s.records.put(row);old.delete(row.id);}
            for(const id of old.keys())s.records.delete(id);
            access();s.control.put(nextState);access();done(true);
          }catch(error){tx.archiveFailure=error;tx.abort();}
        };
      });
      const after=await read();
      if(after.state.revision!==nextState.revision||JSON.stringify(await F.decode(after.records))!==JSON.stringify(await F.decode(encoded.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0))))fail('ARCHIVE_WRITE_UNCONFIRMED');
      access();return outcome.value;
    });
  }
  FC.backupArchive={inspect,copy,cancelCopy,activate,list,mutate,read};
})(typeof window!=='undefined'?window:globalThis);
