// Synthetic disposable Chromium profile only; never loaded by the application.
(function(root){
  'use strict';
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const eq=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
  const rejects=async(fn,code)=>{try{await fn();}catch(e){assert(code.test(e.message),e.message+' expected '+code);return;}throw Error('Missing refusal '+code);};
  const local=()=>Object.fromEntries(Object.entries(localStorage));
  const ram=()=>JSON.stringify([FC.session,projectData,uiState]);
  const row=(id,extra={})=>({id,pinned:true,snapshot:{keys:{fc_projects_v1:' \n["\ud800"] '}},...extra});
  async function removeDatabase(){
    await new Promise((yes,no)=>{const q=indexedDB.deleteDatabase(FC.backupArchiveFormat.DB);q.onsuccess=yes;q.onerror=()=>no(q.error);q.onblocked=()=>no(Error('Test DB blocked'));});
  }
  async function waitFor(fn){for(let n=0;n<200;n++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('UI timeout');}
  async function run(stage){
    const {backupArchive:B,backupArchiveFormat:F,dataBackupStore:S,storageRecoveryExport:X}=FC,passed=[];
    const test=async(name,fn)=>{await fn();passed.push(name);};
    const password='synthetic lifecycle strong passphrase';
    const decision=async()=>{const {state}=await B.read();return {sourceHash:state.sourceHash,revision:state.revision};};
    if(stage===1){
      const original=local(),beforeRam=ram();
      await test('Fresh initialization refuses access and atomically aborts IDB quota before creating a routing marker',async()=>{
        root.__testAccess=false;await rejects(()=>S.createBackup(),/AUTH_DENIED/);root.__testAccess=true;
        const put=IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put=function(...args){if(this.name==='control')throw new DOMException('synthetic quota','QuotaExceededError');return put.apply(this,args);};
        try{await rejects(()=>S.createBackup(),/ARCHIVE_IDB_QUOTA/);}finally{IDBObjectStore.prototype.put=put;}
        const state=await B.read();assert(state.state===null&&state.records.length===0&&state.source===null,'No partial initialization');eq(local(),original,'No legacy/marker or business writes');eq(ram(),beforeRam,'RAM unchanged');
      });
      await test('Full localStorage, no-op marker and failed read-back keep an empty retryable journal without a backup',async()=>{
        for(const fault of ['quota','noop','readback']){
          const set=Storage.prototype.setItem,get=Storage.prototype.getItem;let wrote=false,legacyWrites=0;
          Storage.prototype.setItem=function(k,v){if(k===F.KEY){legacyWrites++;throw Error('Forbidden legacy fallback');}if(k===F.ROUTE){if(fault==='quota')throw new DOMException('full localStorage','QuotaExceededError');if(fault==='noop')return;wrote=true;}return set.call(this,k,v);};
          Storage.prototype.getItem=function(k){if(k===F.ROUTE&&wrote&&fault==='readback')throw Error('Synthetic read failure');return get.call(this,k);};
          try{await rejects(()=>S.createBackup(),fault==='quota'?/ARCHIVE_ROUTE_QUOTA/:/ARCHIVE_ROUTE_UNCONFIRMED/);}
          finally{Storage.prototype.setItem=set;Storage.prototype.getItem=get;}
          const state=await B.read();assert(state.state.phase==='INITIALIZING'&&state.records.length===0,'No unconfirmed backup');assert(legacyWrites===0&&localStorage.getItem(F.KEY)===null,'Never fall back');
          eq(await S.listBackups(),[],'Read-only listing of a validated empty journal');
          eq((await B.read()).state,state.state,'Listing never auto-resumes initialization');
        }
        const token=await X.prepare(password);assert((await X.verify(token.text,password,token)).verified,'Partial initialization can still be exported privately');
        eq(ram(),beforeRam,'Quota refusal preserves RAM');
      });
      return {passed,restart:true};
    }
    if(stage===2){
      await test('Restart resumes the journal but quota during the first actual record transaction never acknowledges a backup',async()=>{
        assert((await B.read()).state.phase==='INITIALIZING','Pending survives restart');
        const put=IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put=function(...args){if(this.name==='records')throw new DOMException('first record quota','QuotaExceededError');return put.apply(this,args);};
        try{await rejects(()=>S.ensureCurrentStateBackup({dedupe:false}),/ARCHIVE_IDB_QUOTA/);}finally{IDBObjectStore.prototype.put=put;}
        const state=await B.read();assert(state.state.phase==='ACTIVE'&&state.records.length===0,'Initialization committed, no partial first backup');assert(localStorage.getItem(F.KEY)===null,'No fallback after quota');
      });
      await test('First and later backups are verified IDB records only',async()=>{
        const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;let legacyWrites=0,removals=0,recordPuts=0;
        const put=IDBObjectStore.prototype.put;
        Storage.prototype.setItem=function(k,v){if(k===F.KEY){legacyWrites++;throw Error('No legacy fallback');}return set.call(this,k,v);};
        Storage.prototype.removeItem=function(...args){removals++;return remove.apply(this,args);};
        IDBObjectStore.prototype.put=function(...args){if(this.name==='records')recordPuts++;return put.apply(this,args);};
        try{
          const first=await S.createBackup({dedupe:false,pinned:true}),state=await B.read();
          assert(first.created&&state.state.phase==='ACTIVE'&&state.state.origin==='fresh','Actual first record commit');assert(state.records.length===1,'One record');const old=state.records[0];
          await S.createBackup({dedupe:false});const next=await B.read();
          assert(next.records.length===2&&recordPuts===2,'Each new backup writes only one record');eq(next.records.find(r=>r.id===old.id),old,'Previous exact RAW unchanged');await F.decode(next.records);
          const token=await X.prepare(password);assert((await X.verify(token.text,password,token)).verified,'ACTIVE encrypted export is complete');
        }finally{Storage.prototype.setItem=set;Storage.prototype.removeItem=remove;IDBObjectStore.prototype.put=put;}
        assert(legacyWrites===0&&removals===0&&localStorage.getItem(F.KEY)===null,'No growing archive and no automatic deletion');
      });
      await test('IDB quota and revoked access during a new backup preserve all earlier committed records',async()=>{
        for(const fault of ['quota','revoke']){
          const before=await B.read(),prior=local(),beforeRam=ram(),put=IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put=function(...args){if(this.name==='records'){if(fault==='quota')throw new DOMException('IDB full','QuotaExceededError');const q=put.apply(this,args);root.__testAccess=false;return q;}return put.apply(this,args);};
          try{await rejects(()=>S.createBackup({dedupe:false}),fault==='quota'?/ARCHIVE_IDB_QUOTA/:/AUTH_DENIED/);}
          finally{IDBObjectStore.prototype.put=put;root.__testAccess=true;}
          eq(await B.read(),before,'Earlier IDB records and revision unchanged');eq(local(),prior,'No fallback/write');eq(ram(),beforeRam,'Session untouched');
        }
      });
      return {passed,restart:true};
    }
    if(stage===3){
      await test('Restart uses existing ACTIVE IDB; an old writer and a missing database never trigger legacy fallback',async()=>{
        assert((await S.listBackups()).length===2,'Records survive full restart');await S.createBackup({dedupe:false});
        localStorage.setItem(F.KEY,'[ ]');const conflict=local();await rejects(()=>S.createBackup(),/LEGACY_WRITER_CONFLICT/);eq(local(),conflict,'Foreign legacy RAW preserved');localStorage.removeItem(F.KEY);
        await removeDatabase();const prior=local();await rejects(()=>S.createBackup(),/ARCHIVE_IDB_MISSING/);eq(local(),prior,'Missing DB cannot initialize over an existing marker');
        // Only the disposable test fixture resets its routing marker.
        localStorage.removeItem(F.ROUTE);
      });
      const source=' \n[ '+JSON.stringify(row('original',{reason:'safe-state',safeState:true,unknown:{raw:'\ud800'}}))+' ,\n'+JSON.stringify(row('test-copy',{reason:'before-tests'}))+' ] ';
      localStorage.setItem(F.KEY,source);await B.copy();
      await test('COPIED stays frozen until explicit cancellation; stale decision, malformed/missing source and IDB abort refuse without loss',async()=>{
        await rejects(()=>S.createBackup(),/MIGRATION_FROZEN/);const current=await decision(),before=await B.read(),prior=local(),beforeRam=ram();
        await rejects(()=>B.cancelCopy({...current,revision:current.revision+1}),/REVISION_CONFLICT/);
        for(const raw of [null,'{"unknown":true}']){
          if(raw===null)localStorage.removeItem(F.KEY);else localStorage.setItem(F.KEY,raw);
          await rejects(()=>B.cancelCopy(current),raw===null?/SOURCE_MISSING/:/FORMAT_UNKNOWN/);localStorage.setItem(F.KEY,source);
        }
        for(const fault of ['quota','revoke']){
          const put=IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put=function(...args){if(this.name==='control'){if(fault==='quota')throw new DOMException('IDB full','QuotaExceededError');const q=put.apply(this,args);root.__testAccess=false;return q;}return put.apply(this,args);};
          try{await rejects(()=>B.cancelCopy(current),fault==='quota'?/ARCHIVE_IDB_QUOTA/:/AUTH_DENIED/);}finally{IDBObjectStore.prototype.put=put;root.__testAccess=true;}
          eq(await B.read(),before,'Interrupted cancellation leaves COPIED');
        }
        const get=IDBObjectStore.prototype.get;
        IDBObjectStore.prototype.get=function(...args){if(this.name==='control')localStorage.setItem(F.KEY,source+' ');return get.apply(this,args);};
        try{await rejects(()=>B.cancelCopy(current),/SOURCE_CHANGED/);}finally{IDBObjectStore.prototype.get=get;}
        assert(localStorage.getItem(F.KEY)===source+' ','Racing legacy writer is never overwritten');eq(await B.read(),before,'Cancellation CAS did not change state');localStorage.setItem(F.KEY,source);
        eq(local(),prior,'Exact source unchanged by every refusal');eq(ram(),beforeRam,'No session operations');
      });
      return {passed,restart:true};
    }
    if(stage===4){
      await test('Restarted COPIED can be cancelled in the owner panel; newer legacy source and exact historical IDB RAW both survive',async()=>{
        assert((await B.read()).state.phase==='COPIED','Copy survived real restart');
        const before=await B.read(),source=before.source.raw,newer=' \n'+JSON.stringify([...F.parse(source),row('newer-writer')])+' ';
        localStorage.setItem(F.KEY,newer);const prior=local(),beforeRam=ram(),remove=Storage.prototype.removeItem;let deletions=0;
        Storage.prototype.removeItem=function(...args){deletions++;return remove.apply(this,args);};
        try{
          FC.storageRecoveryPanel.open();const panel=document.querySelector('[data-storage-recovery]');
          [...panel.querySelectorAll('button')].find(b=>b.textContent==='Anuluj przygotowanie migracji — zachowaj obie kopie').click();
          await waitFor(()=>panel.querySelector('[role=status]').textContent.startsWith('CANCELLED:'));FC.storageRecoveryPanel.close();
        }finally{Storage.prototype.removeItem=remove;}
        assert(deletions===0,'Nothing removed');eq(local(),prior,'Both exact source and all other RAW unchanged');eq(ram(),beforeRam,'Owner/project session unchanged');
        const after=await B.read();assert(after.state.phase==='CANCELLED'&&after.state.revision===before.state.revision+1,'Explicit durable cancel');eq(after.records,before.records,'Every original record RAW/metadata retained');eq(after.source,before.source,'Whole original UTF-16 source retained');
        assert((await S.listBackups()).length===3,'Newer legacy rows remain authoritative');const made=await S.createBackup({dedupe:false});assert(made.created,'Ordinary backup is no longer frozen');
        assert((await B.read()).state.phase==='CANCELLED','Ordinary writer must not activate IDB');eq((await B.read()).source,before.source,'Historical source never overwritten');
        const token=await X.prepare(password);assert((await X.verify(token.text,password,token)).verified,'Private file covers current legacy and retained original IDB');
        await rejects(()=>B.copy(),/SOURCE_CHANGED/);await rejects(()=>B.activate({},{}),/ARCHIVE_NOT_COPIED/);await rejects(()=>FC.storageRecoveryPanel.writerReadiness(),/WRITER_EXCLUSIVITY_UNPROVEN/);
      });
      return {passed,restart:true};
    }
    if(stage===5){
      await test('CANCELLED restart keeps ordinary backup writes live and protects all historical preparation RAW',async()=>{
        const before=await B.read(),prior=local();assert(before.state.phase==='CANCELLED','Cancellation survived full document restart');
        const made=await S.createBackup({dedupe:false});assert(made.created,'Writer remains unfrozen');
        const after=await B.read();eq(after.records,before.records,'Prepared records never rewritten');eq(after.source,before.source,'Prepared source never replaced');
        assert(localStorage.getItem(F.KEY)!==null&&localStorage.getItem(F.ROUTE)===null,'Single live legacy authority');
        for(const key of Object.keys(prior))if(key!==F.KEY)assert(localStorage.getItem(key)===prior[key],'Other business RAW unchanged');
        root.__testAccess=false;await rejects(()=>B.cancelCopy({}),/AUTH_DENIED/);root.__testAccess=true;
      });
      return {passed};
    }
    throw Error('Unknown lifecycle stage');
  }
  root.runStorageRecoveryBrowserSuite=run;
})(globalThis);
