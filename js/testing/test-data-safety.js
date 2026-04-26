(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function cleanupMarked(options){
    try{
      if(FC.testDataManager && typeof FC.testDataManager.cleanup === 'function') return FC.testDataManager.cleanup(options || {});
    }catch(error){ return { error:String(error && error.message || error) }; }
    return null;
  }

  function buildManualBackup(mode){
    if(!(FC.dataBackupSnapshot && typeof FC.dataBackupSnapshot.collectSnapshot === 'function')) throw new Error('Brak modułu eksportu backupu.');
    const snapshot = FC.dataBackupSnapshot.collectSnapshot({ reason:'before-tests-file', label:'Przed testami: ' + mode });
    const payload = FC.dataBackupSnapshot.makeExportPayload(snapshot, { reason:'before-tests-file' });
    const stamp = FC.dataBackupSnapshot.safeFilenamePart(new Date().toISOString().slice(0, 19));
    FC.dataBackupSnapshot.downloadJson('meble-app-before-tests-' + stamp + '.json', payload);
    return { filename:'meble-app-before-tests-' + stamp + '.json', snapshotKeys:Object.keys(snapshot.keys || {}).length };
  }

  async function maybeCleanOrphansBeforeTests(){
    if(!(FC.dataStorageOrphanCleanup && typeof FC.dataStorageOrphanCleanup.analyzeCurrent === 'function')) return { action:'none' };
    const analysis = FC.dataStorageOrphanCleanup.analyzeCurrent();
    if(!analysis.count) return { action:'none', analysis };
    const choice = FC.storageOrphanCleanupModal && typeof FC.storageOrphanCleanupModal.askForTests === 'function'
      ? await FC.storageOrphanCleanupModal.askForTests(analysis)
      : 'skip';
    if(choice === 'cancel' || !choice) return { action:'cancel', analysis };
    if(choice === 'clean'){
      const cleanup = FC.dataStorageOrphanCleanup.cleanupCurrent();
      return { action:'clean', analysis, cleanup };
    }
    return { action:'skip', analysis };
  }

  function createStoredBackup(mode){
    if(!(FC.dataBackupStore && typeof FC.dataBackupStore.createBackup === 'function')) return null;
    const backup = FC.dataBackupStore.createBackup({ reason:'before-tests', label:'Przed testami: ' + mode, dedupe:true });
    try{ FC.dataBackupStore.pruneNow && FC.dataBackupStore.pruneNow(); }catch(_){ }
    return backup;
  }

  async function handleBackupFailure(error, mode){
    const analysis = FC.dataStorageOrphanCleanup && typeof FC.dataStorageOrphanCleanup.analyzeCurrent === 'function'
      ? FC.dataStorageOrphanCleanup.analyzeCurrent()
      : null;
    const action = FC.testBackupFallbackModal && typeof FC.testBackupFallbackModal.ask === 'function'
      ? await FC.testBackupFallbackModal.ask({ error, analysis })
      : 'cancel';
    if(action === 'download') return { manualFileBackup:buildManualBackup(mode), backupError:String(error && error.message || error) };
    if(action === 'clean-retry'){
      const cleanup = FC.dataStorageOrphanCleanup && typeof FC.dataStorageOrphanCleanup.cleanupCurrent === 'function'
        ? FC.dataStorageOrphanCleanup.cleanupCurrent()
        : null;
      try{
        const retryBackup = createStoredBackup(mode);
        return { backup:retryBackup, orphanCleanup:cleanup, retriedAfterCleanup:true };
      }catch(retryError){
        return { cancelled:true, orphanCleanup:cleanup, backupError:String(retryError && retryError.message || retryError) };
      }
    }
    return { cancelled:true, backupError:String(error && error.message || error) };
  }

  async function beforeRun(info){
    const mode = String(info && info.mode || 'tests');
    const run = FC.testDataManager && typeof FC.testDataManager.beginRun === 'function'
      ? FC.testDataManager.beginRun({ mode })
      : { runId:'' };
    const preCleanup = cleanupMarked({ all:true });
    const orphanGuard = await maybeCleanOrphansBeforeTests();
    if(orphanGuard.action === 'cancel'){
      return { mode, runId:run && run.runId || '', preCleanup, orphanGuard, cancelled:true };
    }
    try{
      const backup = createStoredBackup(mode);
      return { mode, runId:run && run.runId || '', preCleanup, orphanGuard, backup };
    }catch(error){
      const fallback = await handleBackupFailure(error, mode);
      return Object.assign({ mode, runId:run && run.runId || '', preCleanup, orphanGuard }, fallback);
    }
  }

  function afterRun(ctx, summary){
    const runId = String(ctx && ctx.runId || '');
    const cleanup = cleanupMarked(runId ? { runId } : { all:true });
    try{ if(FC.testDataManager && typeof FC.testDataManager.endRun === 'function') FC.testDataManager.endRun(); }catch(_){ }
    return { runId, cleanup, summary:summary || null };
  }

  FC.testDataSafety = { beforeRun, afterRun, cleanupMarked, buildManualBackup };
})(typeof window !== 'undefined' ? window : globalThis);
