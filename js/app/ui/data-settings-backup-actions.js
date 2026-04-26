(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  function build(ctx){
    const store = ctx.store;
    const render = ctx.render;
    const actionsWrap = h('div', { class:'data-settings-actions' });
    const makeBackupBtn = h('button', { type:'button', class:'btn btn-success', text:'Utwórz zwykły backup' });
    const safeStateBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz jako bezpieczny stan' });
    const exportBtn = h('button', { type:'button', class:'btn', text:'Eksportuj wszystkie dane' });
    const importBtn = h('button', { type:'button', class:'btn', text:'Importuj dane z pliku' });
    const fileInput = h('input', { type:'file', accept:'application/json,.json', style:'display:none' });

    makeBackupBtn.addEventListener('click', async ()=>{
      const ready = await prepareBackupWithOrphanGuard();
      if(!ready) return;
      try{
        const result = store.createBackup({ reason:'manual', label:'Ręczny backup' });
        dom.info(result.duplicate ? 'Backup już istnieje' : 'Backup utworzony', result.duplicate ? 'Dane są identyczne jak w ostatnim backupie, więc program nie utworzył duplikatu.' : 'Aktualny stan programu został zapisany w backupie.');
        render();
      }catch(error){
        dom.info('Nie udało się zapisać backupu', String(error && error.message || error || 'Backup nie został zapisany.'));
      }
    });

    safeStateBtn.addEventListener('click', async ()=>{
      const ready = await prepareBackupWithOrphanGuard();
      if(!ready) return;
      try{
        store.createBackup({ reason:'safe-state', label:'Ostatni dobry stan', safeState:true, pinned:true, dedupe:false });
        dom.info('Bezpieczny stan zapisany', 'Ten backup jest przypięty i automatyczne sprzątanie go nie usunie.');
        render();
      }catch(error){
        dom.info('Nie udało się zapisać bezpiecznego stanu', String(error && error.message || error || 'Backup nie został zapisany.'));
      }
    });

    exportBtn.addEventListener('click', ()=> store.exportCurrent());
    importBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', async ()=> importSelectedFile({ fileInput, store, snapshot }));
    [makeBackupBtn, safeStateBtn, exportBtn, importBtn, fileInput].forEach((node)=> actionsWrap.appendChild(node));
    return actionsWrap;
  }

  async function prepareBackupWithOrphanGuard(){
    const cleanupApi = FC.dataStorageOrphanCleanup;
    if(!(cleanupApi && typeof cleanupApi.analyzeCurrent === 'function')) return true;
    const analysis = cleanupApi.analyzeCurrent();
    if(!analysis.count) return true;
    const choice = FC.storageOrphanCleanupModal && typeof FC.storageOrphanCleanupModal.askForBackup === 'function'
      ? await FC.storageOrphanCleanupModal.askForBackup(analysis)
      : 'skip';
    if(choice === 'cancel' || !choice) return false;
    if(choice === 'clean'){
      const summary = cleanupApi.cleanupCurrent();
      const size = FC.dataStorageAudit && FC.dataStorageAudit.formatBytes ? FC.dataStorageAudit.formatBytes(summary.removedBytes || 0) : String(summary.removedBytes || 0);
      dom.info('Osierocone projekty wyczyszczone', `Usunięto ${summary.removed || 0} slotów projektów (${size}).`);
    }
    return true;
  }

  async function importSelectedFile(ctx){
    const file = ctx.fileInput.files && ctx.fileInput.files[0];
    ctx.fileInput.value = '';
    if(!file) return;
    const text = await file.text();
    const snap = ctx.snapshot.parseImportPayload(text);
    if(!snap){ dom.info('Nieprawidłowy plik', 'Ten plik nie wygląda jak eksport danych programu.'); return; }
    const ok = await dom.ask({
      title:'IMPORTOWAĆ DANE?',
      message:'Import nadpisze aktualne dane programu. Przed importem program automatycznie utworzy backup obecnego stanu.',
      confirmText:'Importuj',
      cancelText:'Wróć',
      confirmTone:'success',
      cancelTone:'neutral',
      dismissOnOverlay:false,
    });
    if(!ok) return;
    try{
      const result = ctx.store.importSnapshot(snap);
      dom.info('Dane zaimportowane', `Przywrócono ${result.restoredKeys || 0} kluczy danych. Strona zostanie odświeżona.`);
      setTimeout(()=>{ try{ location.reload(); }catch(_){ } }, 700);
    }catch(err){ dom.info('Błąd importu', String(err && err.message || err || 'Nie udało się zaimportować danych.')); }
  }

  FC.dataSettingsBackupActions = { build };
})();
