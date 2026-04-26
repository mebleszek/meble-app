(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function asText(detailsToText, value){
    return typeof detailsToText === 'function' ? detailsToText(value) : String(value || '');
  }

  async function cleanupOrphanProjects(ctx){
    const results = ctx.results;
    try{
      if(!(FC.dataStorageOrphanCleanup && typeof FC.dataStorageOrphanCleanup.analyzeCurrent === 'function')) throw new Error('Brak modułu czyszczenia osieroconych projektów.');
      const analysis = FC.dataStorageOrphanCleanup.analyzeCurrent();
      if(!analysis.count){
        results.innerHTML = '<div class="overall ok"><div class="overall-title">Brak osieroconych projektów</div><div class="overall-sub">Nie ma czego czyścić.</div></div>';
        return;
      }
      const choice = FC.storageOrphanCleanupModal && typeof FC.storageOrphanCleanupModal.askForBackup === 'function'
        ? await FC.storageOrphanCleanupModal.askForBackup(analysis)
        : 'cancel';
      if(choice !== 'clean') return;
      const summary = FC.dataStorageOrphanCleanup.cleanupCurrent();
      const size = FC.dataStorageAudit && FC.dataStorageAudit.formatBytes ? FC.dataStorageAudit.formatBytes(summary.removedBytes || 0) : String(summary.removedBytes || 0);
      const report = FC.dataStorageAudit.buildReport(FC.dataStorageAudit.auditCurrent());
      ctx.setLastOverall({ failed:0, total:0, passed:0, durationMs:0, clipboardText:report });
      results.innerHTML = `
        <div class="overall ok">
          <div class="overall-title">Wyczyszczono osierocone projekty</div>
          <div class="overall-sub">Usunięto ${summary.removed || 0} slotów projektów (${size}). Poniżej aktualny raport.</div>
        </div>
        <section class="suite ok"><div class="rows"><div class="row ok"><div class="row-details">${asText(ctx.detailsToText, report)}</div></div></div></section>
      `;
      ctx.copyBtn.disabled = false;
      ctx.copyErrorsBtn.disabled = true;
    }catch(error){
      results.innerHTML = `
        <div class="overall bad">
          <div class="overall-title">Błąd czyszczenia osieroconych projektów</div>
          <div class="overall-sub">${error && error.message ? error.message : String(error)}</div>
        </div>
      `;
    }
  }

  async function runStorageAudit(ctx){
    const results = ctx.results;
    try{
      if(!(FC.dataStorageAudit && typeof FC.dataStorageAudit.auditCurrent === 'function')) throw new Error('Brak FC.dataStorageAudit.auditCurrent');
      const audit = FC.dataStorageAudit.auditCurrent();
      const report = FC.dataStorageAudit.buildReport(audit);
      ctx.setLastOverall({ failed:0, total:0, passed:0, durationMs:0, clipboardText:report });
      const orphanCount = Number(audit && audit.orphanProjectSlots && audit.orphanProjectSlots.keys || 0);
      const orphanBytes = Number(audit && audit.orphanProjectSlots && audit.orphanProjectSlots.bytes || 0);
      const orphanSize = FC.dataStorageAudit.formatBytes ? FC.dataStorageAudit.formatBytes(orphanBytes) : String(orphanBytes);
      results.innerHTML = `
        <div class="overall ok">
          <div class="overall-title">Analiza pamięci gotowa</div>
          <div class="overall-sub">Raport pokazuje największe klucze, backup store, cache i osierocone sloty projektów. Użyj przycisku Kopiuj raport.</div>
        </div>
        ${orphanCount ? `<div class="overall bad"><div class="overall-title">Osierocone projekty: ${orphanCount}</div><div class="overall-sub">Zajmują ${orphanSize}. Możesz je wyczyścić ręcznie po potwierdzeniu.</div><div class="toolbar"><button id="cleanupOrphanProjects" type="button" class="button-good">Wyczyść osierocone projekty</button></div></div>` : ''}
        <section class="suite ok"><div class="rows"><div class="row ok"><div class="row-details">${asText(ctx.detailsToText, report)}</div></div></div></section>
      `;
      const orphanBtn = document.getElementById('cleanupOrphanProjects');
      if(orphanBtn) orphanBtn.addEventListener('click', ()=> cleanupOrphanProjects(ctx));
      ctx.copyBtn.disabled = false;
      ctx.copyErrorsBtn.disabled = true;
    }catch(error){
      results.innerHTML = `
        <div class="overall bad">
          <div class="overall-title">Błąd analizy pamięci</div>
          <div class="overall-sub">${error && error.message ? error.message : String(error)}</div>
        </div>
      `;
    }
  }

  FC.devTestsStorageTools = { runStorageAudit, cleanupOrphanProjects };
})(typeof window !== 'undefined' ? window : globalThis);
