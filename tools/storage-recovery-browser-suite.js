// Synthetic disposable browser profile only. Never loaded by the application.
(function(root){
  'use strict';
  const A=(value,message)=>{if(!value)throw Error(message);};
  const eq=(a,b,message)=>A(JSON.stringify(a)===JSON.stringify(b),message);
  const rejects=async(fn,code)=>{try{await fn();}catch(e){A(code.test(String(e.message)),String(e.message)+' expected '+code);return;}throw Error('Expected refusal '+code);};
  const raw=()=>Object.fromEntries(Object.entries(localStorage));
  const ram=()=>JSON.stringify([root.FC.session,root.projectData,root.uiState]);
  const row=(id,extra={})=>({id,createdAtMs:1,reason:'manual',snapshot:{kind:'meble-app-storage-snapshot',version:1,keys:{fc_projects_v1:' \n["\ud800"] '}},...extra});
  async function removeDatabase(){
    await new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase('meble-business-backups-v1');q.onsuccess=resolve;q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('test database blocked'));});
  }
  async function run(stage){
    const FC=root.FC,F=FC.backupArchiveFormat,B=FC.backupArchive,X=FC.storageRecoveryExport,passed=[];
    const test=async(name,fn)=>{await fn();passed.push(name);};
    const password='synthetic PRIVATE secret passphrase';
    async function fileReceipt(){const token=await X.prepare(password);return X.verify(token.text,password,token);}
    if(stage===1){
      await test('Legacy asynchronous backup/export/restore/import retain their historical payload contracts',async()=>{
        localStorage.setItem(F.KEY,'[]'); // Explicit legacy archive; an absent archive now initializes IDB.
        localStorage.setItem('fc_investors_v1','[{"id":"synthetic-original"}]');localStorage.setItem('fc_projects_v1','[]');
        const made=await FC.dataBackupStore.createBackup({dedupe:false});A(made.created,'Legacy async create acknowledged');
        const pack=await FC.dataBackupStore.exportBackupPayload(made.backup.id);A(pack.payload.kind==='meble-app-data-backup','Historical single backup export');
        localStorage.setItem('fc_investors_v1','[{"id":"synthetic-newer"}]');
        await FC.dataBackupStore.restoreBackup(made.backup.id);A(localStorage.getItem('fc_investors_v1')==='[{"id":"synthetic-original"}]','Restore waits for before-restore backup');
        A((await FC.dataBackupStore.listBackups()).length===2,'Before-restore retained newer original');
        const legacy=FC.dataBackupSnapshot.parseImportPayload('{"keys":{"fc_projects_v1":" [] "}}');A(legacy,'Historical bare keys format recognized');
        await FC.dataBackupStore.importSnapshot(legacy);A(localStorage.getItem('fc_projects_v1')===' [] ','Legacy import preserves RAW');
        localStorage.clear();
      });
      await test('Real IDB: quota abort during copy is atomic and leaves all legacy RAW untouched',async()=>{
        const rows=Array.from({length:14},(_,i)=>row('backup_'+i,{pinned:i===0,safeState:i===1,reason:i%2?'before-tests':'manual',padding:'X'.repeat(220000)}));
        localStorage.setItem(F.KEY,' \n'+JSON.stringify(rows)+'\n ');localStorage.setItem('fc_projects_v1','SYNTHETIC_PROJECTS');localStorage.setItem('fc_quote_snapshots_v1','H'.repeat(1328058));
        const original=raw(),put=IDBObjectStore.prototype.put;let writes=0;
        IDBObjectStore.prototype.put=function(...args){if(this.name==='records'&&++writes===4)throw new DOMException('synthetic IDB quota','QuotaExceededError');return put.apply(this,args);};
        try{await rejects(()=>B.copy(),/ARCHIVE_IDB_QUOTA/);}finally{IDBObjectStore.prototype.put=put;}
        eq(raw(),original,'quota preserved every source');const state=await B.read();A(state.state===null&&state.records.length===0,'No partially copied records');
      });
      await test('Copy confirms complete transaction, exact whole-source UTF-16 and every protected/test record after reopen',async()=>{
        const source=localStorage.getItem(F.KEY),prior=raw(),beforeRam=ram();const result=await B.copy();
        A(result.count===14&&result.sourcePreserved,'complete copied count');eq(raw(),prior,'no local writes by copy');eq(ram(),beforeRam,'RAM unchanged');
        const snapshot=await B.read();A(snapshot.source.raw===source,'Exact whitespace and surrogate RAW');A(snapshot.records.length===14,'all records');
        eq(await F.decode(snapshot.records),F.parse(source).sort((a,b)=>a.id<b.id?-1:1),'All metadata and original snapshots unchanged');
        await rejects(()=>FC.dataBackupStore.createBackup(),/ARCHIVE_MIGRATION_FROZEN/);
        await rejects(()=>B.activate({approved:true,key:F.KEY,sourceHash:result.sourceHash,otherWritersClosed:true},{}),/FILE_NOT_VERIFIED/);
      });
      await test('Downloaded file actual bytes verify with AES-GCM and SHA-256; wrong password/tamper rejected without import',async()=>{
        const token=await X.prepare(password),downloaded=new File([token.text],'rescue.json',{type:'application/json'});
        root.__testFile=downloaded;root.__downloadToken=token;const receipt=await X.verify(await X.readFile(downloaded),password,token);
        A(X.isReceipt(receipt,token.sourceHash),'independent File read verified');
        await rejects(()=>X.verify((awaitable=>awaitable)(token.text)+' ',password,token),/FILE_MISMATCH/);
        await rejects(()=>X.verify(token.text,'wrong long passphrase',token),/RECOVERY_DECRYPT_FAILED/);
        A(!token.text.includes('SYNTHETIC_PROJECTS')&&!token.text.includes('PRIVATE'),'No plaintext envelope');
        root.__receipt=receipt;
      });
      await test('Stage E is never automatic; missing explicit decision and unresolved writers both refuse',async()=>{
        const s=await B.inspect(),r=root.__receipt,prior=raw();
        await rejects(()=>B.activate(null,r),/SEPARATE_DECISION_REQUIRED/);
        await rejects(()=>B.activate({approved:true,key:F.KEY,sourceHash:s.sourceHash},r),/SEPARATE_DECISION_REQUIRED/);
        eq(raw(),prior,'No deletion from incomplete consent');
      });
      await test('Owner access refusal precedes all storage; revocation during a transaction aborts without source mutations',async()=>{
        root.__testAccess=false;await rejects(()=>B.copy(),/AUTH_DENIED/);await rejects(()=>X.prepare(password),/AUTH_DENIED/);root.__testAccess=true;
        const put=IDBObjectStore.prototype.put,prior=raw();IDBObjectStore.prototype.put=function(...args){const request=put.apply(this,args);if(this.name==='records')root.__testAccess=false;return request;};
        try{await rejects(()=>B.copy(),/AUTH_DENIED/);}finally{IDBObjectStore.prototype.put=put;root.__testAccess=true;}
        eq(raw(),prior,'Revocation kept local RAW');
      });
      await test('Emergency dialog entry, mobile layout, diagnostics and close perform zero storage/domain mutations',async()=>{
        const prior=raw(),beforeRam=ram(),set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;let writes=0,domain=0;
        for(const method of ['setItem','removeItem','clear'])Storage.prototype[method]=()=>{writes++;throw Error('No diagnostic mutation');};
        const methods={};for(const m of ['begin','commit','cancel','retryInitialBegin']){methods[m]=FC.session[m];FC.session[m]=()=>{domain++;throw Error('No session call');};}
        const sessionWithSpies=ram();
        try{
          FC.infoBox.open({title:'Blokada sesji',message:'SESSION_QUOTA_EXCEEDED',okOnly:true,sessionDiagnostic:true});
          const button=[...document.querySelectorAll('button')].find(e=>e.textContent==='Tryb ratunkowy');A(button,'Existing session error has recovery button');button.click();
          const panel=document.querySelector('[data-storage-recovery]');A(panel,'Same document panel');
          const box=panel.querySelector('[role=dialog]').getBoundingClientRect();A(box.x>=0&&box.right<=innerWidth&&box.bottom<=innerHeight,'Mobile panel fits');
          [...panel.querySelectorAll('button')].find(e=>e.textContent==='Diagnostyka pamięci').click();await new Promise(resolve=>setTimeout(resolve,50));
          A(/fc_data_backups_v1/.test(panel.textContent),'Actual session diagnostic collector identifies archive');
          A(writes===0&&domain===0,'zero mutation calls');eq(raw(),prior,'all RAW unchanged');eq(ram(),sessionWithSpies,'all RAM unchanged');
          [...panel.querySelectorAll('button')].find(e=>e.textContent==='Zamknij').click();A(!document.querySelector('[data-storage-recovery]'),'panel closes');
        }finally{Storage.prototype.setItem=set;Storage.prototype.removeItem=remove;Storage.prototype.clear=clear;for(const m in methods)FC.session[m]=methods[m];}
        eq(ram(),beforeRam,'Methods and RAM preserved');
      });
      await test('Corrupted/unknown archive refuses migration and remains available to lossless encrypted RAW export',async()=>{
        const source=localStorage.getItem(F.KEY);localStorage.setItem(F.KEY,'{"unknown-format":true}');
        const prior=raw();await rejects(()=>B.copy(),/FORMAT_UNKNOWN/);const token=await X.prepare(password);await X.verify(token.text,password,token);eq(raw(),prior,'Unknown RAW retained');localStorage.setItem(F.KEY,source);
      });
      await test('Changed source is never silently remigrated or overwritten',async()=>{
        const source=localStorage.getItem(F.KEY);localStorage.setItem(F.KEY,source+' ');await rejects(()=>B.copy(),/SOURCE_CHANGED/);A(localStorage.getItem(F.KEY)===source+' ','changed source preserved');localStorage.setItem(F.KEY,source);
      });
      return {passed,restart:true};
    }
    if(stage===2){
      await test('Full document restart recovers COPIED state and original source, without deletion or auto-activation',async()=>{
        A((await B.inspect()).phase==='COPIED','Durable copied state survived restart');A(localStorage.getItem(F.KEY)!==null,'source retained after restart');
      });
      await test('Interrupted explicit switch fences all writers; no automatic completion after removal failure',async()=>{
        const r=await fileReceipt(),s=await B.inspect(),remove=Storage.prototype.removeItem;
        Storage.prototype.removeItem=function(k){if(k===F.KEY)throw Error('Synthetic interruption before deletion');return remove.call(this,k);};
        try{await rejects(()=>B.activate({approved:true,key:F.KEY,sourceHash:s.sourceHash,otherWritersClosed:true},r),/Synthetic interruption/);}finally{Storage.prototype.removeItem=remove;}
        A(localStorage.getItem(F.KEY)!==null,'Source retained on failure');A((await B.inspect()).phase==='SWITCH_PENDING','durable fence');
        await rejects(()=>FC.dataBackupStore.createBackup(),/MIGRATION_FROZEN/);
      });
      return {passed,restart:true};
    }
    if(stage===3){
      await test('Restart after interrupted switch remains blocked and needs fresh independent file and explicit consent',async()=>{
        A((await B.inspect()).phase==='SWITCH_PENDING','pending survived restart');A(localStorage.getItem(F.KEY)!==null,'no startup cleanup');
        const s=await B.inspect();await rejects(()=>B.activate({approved:true,key:F.KEY,sourceHash:s.sourceHash,otherWritersClosed:true},{}),/FILE_NOT_VERIFIED/);
      });
      await test('Interruption after exact deletion but before ACTIVE leaves durable pending evidence, never automatic fallback',async()=>{
        const s=await B.inspect(),r=await fileReceipt(),put=IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='control'&&value.phase==='ACTIVE')throw Error('synthetic interrupted activation');return put.call(this,value,...rest);};
        try{await rejects(()=>B.activate({approved:true,key:F.KEY,sourceHash:s.sourceHash,otherWritersClosed:true},r),/TRANSACTION_ABORTED/);}finally{IDBObjectStore.prototype.put=put;}
        A(localStorage.getItem(F.KEY)===null,'Deletion was exact but activation not acknowledged');A((await B.inspect()).phase==='SWITCH_PENDING','Recoverable pending with original RAW retained in IDB');
        await rejects(()=>FC.storageRecoveryPanel.retrySession(),/ARCHIVE_NOT_ACTIVE/);
      });
      return {passed,restart:true};
    }
    if(stage===4){
      await test('Restart after deletion requires fresh complete export, independent file verification and explicit resume',async()=>{
        A((await B.inspect()).phase==='SWITCH_PENDING','Pending survived full restart');A(localStorage.getItem(F.KEY)===null,'No legacy recreation');
      });
      await test('Synthetic separately-approved switch removes only exact old key; active IDB receives and verifies new backups',async()=>{
        const before=raw(),s=await B.inspect(),r=await fileReceipt();await B.activate({approved:true,key:F.KEY,sourceHash:s.sourceHash,otherWritersClosed:true},r);
        A(localStorage.getItem(F.KEY)===null,'approved exact removal');for(const k in before)if(k!==F.KEY)A(localStorage.getItem(k)===before[k],'Other RAW intact '+k);
        const put=IDBObjectStore.prototype.put,writes=[];IDBObjectStore.prototype.put=function(...args){writes.push(this.name);return put.apply(this,args);};
        try{const created=await FC.dataBackupStore.createBackup({reason:'safe-state',pinned:true,safeState:true,dedupe:false});A(created.created,'actual async new backup');A((await FC.dataBackupStore.listBackups()).some(b=>b.id===created.backup.id),'read after actual commit');}
        finally{IDBObjectStore.prototype.put=put;}
        A(writes.filter(x=>x==='records').length===1,'One new record, not full rewritten archive');A(localStorage.getItem(F.KEY)===null,'Never recreated legacy');
        const pack=await FC.dataBackupStore.exportBackupPayload((await FC.dataBackupStore.listBackups())[0].id);A(pack.payload.kind==='meble-app-data-backup','existing export format');
      });
      return {passed,restart:true};
    }
    if(stage===5){

      await test('ACTIVE survives restart, refuses legacy-writer conflict and never falls back after database loss',async()=>{
        A((await B.inspect()).phase==='ACTIVE','active durable');A((await FC.dataBackupStore.listBackups()).some(r=>r.safeState),'safe state persisted');
        localStorage.setItem(F.KEY,'[]');await rejects(()=>FC.dataBackupStore.createBackup(),/LEGACY_WRITER_CONFLICT/);A(localStorage.getItem(F.KEY)==='[]','foreign raw kept');localStorage.removeItem(F.KEY);
        await removeDatabase();await rejects(()=>FC.dataBackupStore.listBackups(),/IDB_MISSING/);await rejects(()=>FC.dataBackupStore.createBackup(),/IDB_MISSING/);A(localStorage.getItem(F.KEY)===null,'No silent legacy recreation');
      });
      return {passed};
    }
    throw Error('Unknown test stage');
  }
  root.runStorageRecoveryBrowserSuite=run;
})(globalThis);
