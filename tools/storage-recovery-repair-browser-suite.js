// Synthetic disposable profile only. Does not certify legacy-writer exclusion.
(function(root){
  'use strict';
  const assert=(v,message)=>{if(!v)throw Error(message);};
  const eq=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
  const rejects=async(fn,code)=>{try{await fn();}catch(e){assert(code.test(e.message),e.message+' expected '+code);return;}throw Error('Missing refusal '+code);};
  const local=()=>Object.fromEntries(Object.entries(localStorage));
  const ram=()=>JSON.stringify([FC.session,projectData,uiState]);
  async function waitFor(fn){for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('UI completion timeout');}
  async function run(stage){
    const {backupArchive:B,backupArchiveFormat:F,storageRecoveryExport:X}=FC,passed=[],password='synthetic repair strong passphrase';
    const test=async(name,fn)=>{await fn();passed.push(name);};
    async function receipt(){const t=await X.prepare(password);return X.verify(t.text,password,t);}
    if(stage===1){
      await test('Diagnostics keeps Copy and adds authorized Recovery entry with zero RAW/RAM mutations',async()=>{
        const copies=[],prior=local(),before=ram();Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>copies.push(text)}});
        FC.sessionDiagnostics.open();let buttons=[...document.querySelectorAll('.info-box button')];
        assert(buttons.some(b=>b.textContent==='Kopiuj raport')&&buttons.some(b=>b.textContent==='Tryb ratunkowy'),'Both diagnostic actions exist');
        buttons.find(b=>b.textContent==='Kopiuj raport').click();await waitFor(()=>copies.length===1);
        assert(JSON.parse(copies[0]).status==='READ_ONLY','Original anonymous JSON contract retained');
        buttons.find(b=>b.textContent==='Tryb ratunkowy').click();assert(document.querySelector('[data-storage-recovery]'),'Same-document panel opens');FC.storageRecoveryPanel.close();
        root.__testAccess=false;FC.sessionDiagnostics.open();buttons=[...document.querySelectorAll('.info-box button')];assert(!buttons.some(b=>b.textContent==='Tryb ratunkowy'||b.textContent==='Kopiuj raport'),'Denied diagnostics cannot offer data actions');root.__testAccess=true;FC.infoBox.close();
        eq(local(),prior,'Diagnostic and entry RAW unchanged');eq(ram(),before,'Diagnostic and entry RAM unchanged');
      });
      const rows=[{id:'old',pinned:true,snapshot:{kind:'meble-app-storage-snapshot',version:1,keys:{fc_projects_v1:' [] '}}}];
      localStorage.setItem(F.KEY,' '+JSON.stringify(rows)+' ');localStorage.setItem('fc_projects_v1','[]');await B.copy();
      await test('Complete E preparation in UI still STOPs with consent when legacy-writer exclusion is unproven',async()=>{
        FC.storageRecoveryPanel.open();const panel=document.querySelector('[data-storage-recovery]');
        const click=name=>[...panel.querySelectorAll('button')].find(b=>b.textContent===name).click();
        const status=()=>panel.querySelector('[role=status]').textContent;
        panel.querySelector('input[type=password]').value=password;
        const download=X.download;let token;X.download=t=>{token=t;return download(t);};
        try{click('Pobierz szyfrowaną kopię ratunkową');await waitFor(()=>status().startsWith('Przygotowano szyfrowany plik'));}finally{X.download=download;}
        const input=panel.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:[new File([token.text],'repair.encrypted.json')],configurable:true});
        click('Sprawdź pobrany plik bez importu');await waitFor(()=>status().startsWith('Plik ponownie odczytany'));
        click('Sprawdź przygotowanie przełączenia');await waitFor(()=>!panel.querySelector('button').disabled);
        assert(panel.querySelector('[aria-label="SHA-256 źródła do przełączenia"]').value===(await B.inspect()).sourceHash,'Exact source hash displayed');
        panel.querySelector('input[type=checkbox]').checked=true;panel.querySelector('[aria-label="Potwierdzenie usunięcia starego archiwum"]').value='USUŃ STARE ARCHIWUM';
        const prior=local(),before=ram(),database=await B.read();
        click('Etap E — aktywuj IndexedDB i zwolnij stary klucz');await waitFor(()=>status().includes('RECOVERY_WRITER_EXCLUSIVITY_UNPROVEN'));
        eq(local(),prior,'Full owner declaration must not remove source');eq(await B.read(),database,'No switch journal write without writer proof');eq(ram(),before,'No session operation');
        await rejects(()=>FC.storageRecoveryPanel.retrySession(),/ARCHIVE_NOT_ACTIVE/);FC.storageRecoveryPanel.close();
      });
      await test('Routing marker quota, false acknowledgement and unreadable acknowledgement preserve exact source',async()=>{
        for(const fault of ['quota','noop','readback']){
          const s=await B.inspect(),r=await receipt(),prior=local(),set=Storage.prototype.setItem,get=Storage.prototype.getItem,remove=Storage.prototype.removeItem;let removals=0,wrote=false;
          Storage.prototype.setItem=function(k,v){if(k===F.ROUTE){if(fault==='quota')throw new DOMException('synthetic full origin','QuotaExceededError');if(fault==='noop')return;wrote=true;}return set.call(this,k,v);};
          Storage.prototype.getItem=function(k){if(k===F.ROUTE&&wrote&&fault==='readback')throw Error('Synthetic readback failure');return get.call(this,k);};
          Storage.prototype.removeItem=function(...args){removals++;return remove.apply(this,args);};
          try{await rejects(()=>B.activate({approved:true,key:F.KEY,sourceHash:s.sourceHash,otherWritersClosed:true},r),fault==='quota'?/ARCHIVE_ROUTE_QUOTA/:/ARCHIVE_ROUTE_UNCONFIRMED/);}
          finally{Storage.prototype.setItem=set;Storage.prototype.getItem=get;Storage.prototype.removeItem=remove;}
          const after=local();if(fault==='readback'){delete prior[F.ROUTE];delete after[F.ROUTE];}
          eq(after,prior,'Marker failure must preserve ALL business RAW');assert(removals===0,'No source deletion attempted');assert((await B.inspect()).phase==='SWITCH_PENDING','Durable fence retained');
        }
      });
      // Low-level handler tests use a fully controlled disposable test profile.
      // They are NOT proof that the production UI can exclude unknown old tabs.
      const s=await B.inspect();await B.activate({approved:true,key:F.KEY,sourceHash:s.sourceHash,otherWritersClosed:true},await receipt());
      await test('ACTIVE full export includes new current IDB records, metadata and SHA, without recreating legacy',async()=>{
        const made=await FC.dataBackupStore.createBackup({reason:'safe-state',pinned:true,safeState:true,dedupe:false});
        const state=await B.read(),token=await X.prepare(password),verified=await X.verify(token.text,password,token);
        assert(verified.verified,'Full file can be verified after ACTIVE');assert(state.records.some(row=>row.id===made.backup.id),'New record actually present');
        assert(localStorage.getItem(F.KEY)===null,'No legacy workaround');
        const e=JSON.parse(token.text),decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
        const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
        const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:decode(e.salt),iterations:e.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
        const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(e.iv),additionalData:F.utf16('meble-app-private-recovery-v1'),tagLength:128},key,decode(e.ciphertext));
        const view=new DataView(plain),units=[];for(let i=0;i<view.byteLength;i+=2)units.push(view.getUint16(i,true));const body=JSON.parse(String.fromCharCode(...units));
        eq(body.data.idb.archive.records,state.records,'File contains every current RAW record, not just original migration source');
        eq(await F.decode(body.data.idb.archive.records),await F.decode(state.records),'Every record SHA/metadata validates');
      });
      await test('ACTIVE export rejects corrupt record hashes and a file superseded by a new IDB revision',async()=>{
        const state=await B.read(),old=state.records[0];
        const write=async row=>{const db=await new Promise((yes,no)=>{const q=indexedDB.open(F.DB,1);q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});try{await new Promise((yes,no)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(row);tx.oncomplete=yes;tx.onabort=()=>no(tx.error);});}finally{db.close();}};
        await write({...old,sha256:'0'.repeat(64)});await rejects(()=>X.prepare(password),/ARCHIVE_RECORD_HASH/);await write(old);
        const token=await X.prepare(password);await FC.dataBackupStore.createBackup({reason:'manual',dedupe:false});
        await rejects(()=>X.verify(token.text,password,token),/RECOVERY_SOURCE_CHANGED/);
        const fresh=await X.prepare(password);assert((await X.verify(fresh.text,password,fresh)).verified,'Fresh complete export verifies');assert(localStorage.getItem(F.KEY)===null,'No legacy writes during any export');
      });
      return {passed,restart:true};
    }
    if(stage===2){
      await test('New document can export ACTIVE archive and retains read-only session controls',async()=>{
        const prior=local(),before=ram();assert((await B.inspect()).phase==='ACTIVE','Fixture really restarted ACTIVE');
        const token=await X.prepare(password);assert((await X.verify(token.text,password,token)).verified,'Export works after document restart');
        eq(local(),prior,'Export must not write localStorage');eq(ram(),before,'Export preserves all known session RAM');
        await rejects(()=>FC.storageRecoveryPanel.writerReadiness(),/WRITER_EXCLUSIVITY_UNPROVEN/);
        root.__testAccess=false;await rejects(()=>FC.storageRecoveryPanel.writerReadiness(),/AUTH_DENIED/);root.__testAccess=true;
      });
      return {passed};
    }
    throw Error('Unknown repair stage');
  }
  root.runStorageRecoveryBrowserSuite=run;
})(globalThis);
