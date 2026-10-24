(function(root){
  'use strict';
  const FC=root.FC=root.FC||{};
  let active=null;
  const F=()=>FC.backupArchiveFormat;
  function element(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
  function close(){if(active){active.remove();active=null;}}
  async function retrySession(){
    F().access();const archive=await FC.backupArchive.inspect();
    if(archive.phase!=='ACTIVE'||archive.sourcePresent)throw Error('RECOVERY_ARCHIVE_NOT_ACTIVE');
    // Only the existing protocol has the private initial-begin baseline witness.
    // No backup evidence or RAM snapshot grants the right to adopt a new project.
    const report=FC.sessionDiagnosticsReadonly(root,{storageUsage:true});F().access();
    if(report.status!=='READ_ONLY'||report.usage?.status!=='MEASURED')throw Error('RECOVERY_READ_INCOMPLETE');
    if(!FC.session?.active||typeof FC.session.retryInitialBegin!=='function')throw Error('RECOVERY_SESSION_NOT_RETRYABLE');
    const ok=FC.session.retryInitialBegin();
    if(ok!==true||FC.session.durable!==true)throw Error('RECOVERY_SESSION_STILL_BLOCKED');
    return {durable:true};
  }
  function open(){
    try{F().access();}catch(_){return false;}
    close();FC.infoBox.close();
    const overlay=element('div');overlay.setAttribute('data-storage-recovery','');
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box';
    const box=element('section');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Tryb ratunkowy');
    box.style.cssText='width:100%;max-width:620px;max-height:calc(100dvh - 24px);overflow:auto;background:white;border-radius:16px;padding:16px;box-sizing:border-box';
    box.appendChild(element('h2','Tryb ratunkowy'));
    box.appendChild(element('p','Nie zmienia projektu ani sesji. Kopiowanie archiwum zachowuje stary magazyn. Zwolnienie miejsca wymaga osobnej zgody.'));
    const status=element('p','Wybierz diagnostykę lub podgląd. Dane prywatne pozostają na urządzeniu.');status.setAttribute('role','status');status.style.overflowWrap='anywhere';box.appendChild(status);
    const actions=element('div');actions.style.cssText='display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))';box.appendChild(actions);
    let token=null,receipt=null,busy=false;
    const buttons=[];
    function action(text,run){
      const b=element('button',text);b.type='button';b.style.cssText='min-height:44px;white-space:normal';buttons.push(b);actions.appendChild(b);
      b.addEventListener('click',async()=>{
        if(busy)return;busy=true;buttons.forEach(x=>x.disabled=true);
        try{F().access();await run();F().access();}
        catch(error){status.textContent='BLOCKED: '+safeError(error);}
        finally{busy=false;let allowed=true;try{F().access();}catch(_){allowed=false;status.textContent='STOP — brak ważnego dostępu właściciela.';}buttons.forEach(x=>x.disabled=!allowed);}
      });return b;
    }
    action('Diagnostyka pamięci',()=>{
      const report=FC.sessionDiagnosticsReadonly(root,{storageUsage:true});
      if(report.status!=='READ_ONLY')throw Error('RECOVERY_AUTH_DENIED');
      const sizes=report.storageSizes;if(!sizes?.complete)throw Error('RECOVERY_READ_INCOMPLETE');
      status.textContent='Tylko odczyt. Łącznie '+((sizes.totalUnits*2)/1024).toFixed(1)+' KiB tekstu. '+sizes.top.slice(0,5).map(r=>r.key+': '+((r.valueUnits*2)/1024).toFixed(1)+' KiB').join('; ')+'. To nie jest pomiar limitu quota.';
    });
    action('Podgląd archiwum',async()=>{
      const s=await FC.backupArchive.inspect();
      status.textContent='Archiwum: '+s.phase+'. Kopie: '+s.count+' (program '+s.appCount+', testowe '+s.testCount+'). Przypięte / bezpieczne: '+s.pinned+'. Stary klucz: '+(s.sourcePresent?'obecny':'brak')+'. '+((s.valueUnits*2)/1024).toFixed(1)+' KiB tekstu. Niczego nie usunięto.';
    });
    const label=element('label','Hasło prywatnego pliku (minimum 12 znaków). Zachowaj je osobno; bez niego kopii nie da się odczytać.');
    const password=element('input');password.type='password';password.autocomplete='new-password';password.setAttribute('aria-label','Hasło pliku ratunkowego');password.style.cssText='width:100%;min-height:44px;box-sizing:border-box';label.appendChild(password);box.appendChild(label);
    action('Pobierz szyfrowaną kopię ratunkową',async()=>{
      receipt=null;token=await FC.storageRecoveryExport.prepare(password.value);FC.storageRecoveryExport.download(token);
      status.textContent='Przygotowano szyfrowany plik. Wybierz pobrany plik poniżej, aby zweryfikować go bez importu. Samo pobranie nie jest potwierdzeniem kopii.';
    });
    const file=element('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','Pobrany plik ratunkowy');file.style.cssText='width:100%;margin:12px 0';box.appendChild(file);
    action('Sprawdź pobrany plik bez importu',async()=>{
      const chosen=file.files?.[0];if(!chosen)throw Error('RECOVERY_SELECT_DOWNLOADED_FILE');
      if(chosen.size>90*1024*1024)throw Error('RECOVERY_EXPORT_TOO_LARGE');
      receipt=await FC.storageRecoveryExport.verify(await FC.storageRecoveryExport.readFile(chosen),password.value,token);
      status.textContent='Plik ponownie odczytany: SHA-256, odszyfrowanie i zakres zgodne. Chroni zapisane RAW i wskazany RAM tej karty, nie RAM innych kart ani uprawnienia Auth. Źródło pozostaje bez zmian.';
    });
    action('Skopiuj archiwum do IndexedDB',async()=>{
      const result=await FC.backupArchive.copy();
      status.textContent='COPIED: '+result.count+' kopii. Transakcja i ponowny odczyt po otwarciu bazy potwierdzone. Stary klucz zachowany. Nie zwolniono jeszcze miejsca.';
    });
    action('Sprawdź przygotowanie przełączenia',async()=>{
      const s=await FC.backupArchive.inspect();
      const verified=!!receipt&&FC.storageRecoveryExport.isReceipt(receipt,s.sourceHash);
      if(verified)FC.storageRecoveryExport.assertReceiptCurrent(receipt);
      status.textContent='IndexedDB: '+s.phase+'. Plik: '+(verified?'zweryfikowany dla aktualnego źródła':'BRAK AKTUALNEGO DOWODU')+'. Możliwe do zwolnienia: '+((s.valueUnits*2)/1024).toFixed(1)+' KiB tekstu. '+
        'PRZEŁĄCZENIE BLOCKED: wymaga osobnej decyzji dla fc_data_backups_v1 i potwierdzenia zamknięcia pozostałych kart aplikacji. Ten panel nie usuwa magazynu.';
    });
    action('Sprawdź sesję po zatwierdzonym przełączeniu',async()=>{
      await retrySession();status.textContent='Istniejący protokół sesji potwierdził trwały zapis. Nie wykonano Zapisz ani Anuluj.';
    });
    const finish=element('button','Zamknij');finish.type='button';finish.style.cssText='min-height:44px;margin-top:16px;width:100%';finish.addEventListener('click',()=>{if(!busy){password.value='';token=null;receipt=null;close();}});box.appendChild(finish);
    overlay.appendChild(box);document.body.appendChild(overlay);active=overlay;return true;
  }
  function safeError(error){
    const code=String(error?.message||'');
    return /^(ARCHIVE|RECOVERY)_[A-Z_]+$/.test(code)?code:'RECOVERY_OPERATION_FAILED';
  }
  FC.storageRecoveryPanel={open,close,retrySession};
})(typeof window!=='undefined'?window:globalThis);
