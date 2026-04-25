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

  function beforeRun(info){
    const mode = String(info && info.mode || 'tests');
    const run = FC.testDataManager && typeof FC.testDataManager.beginRun === 'function'
      ? FC.testDataManager.beginRun({ mode })
      : { runId:'' };
    const preCleanup = cleanupMarked({ all:true });
    let backup = null;
    try{
      if(FC.dataBackupStore && typeof FC.dataBackupStore.createBackup === 'function'){
        backup = FC.dataBackupStore.createBackup({ reason:'before-tests', label:'Przed testami: ' + mode, dedupe:true });
        try{ FC.dataBackupStore.pruneNow && FC.dataBackupStore.pruneNow(); }catch(_){ }
      }
    }catch(error){
      return { mode, runId:run && run.runId || '', preCleanup, backupError:String(error && error.message || error) };
    }
    return { mode, runId:run && run.runId || '', preCleanup, backup };
  }

  function afterRun(ctx, summary){
    const runId = String(ctx && ctx.runId || '');
    const cleanup = cleanupMarked(runId ? { runId } : { all:true });
    try{ if(FC.testDataManager && typeof FC.testDataManager.endRun === 'function') FC.testDataManager.endRun(); }catch(_){ }
    return { runId, cleanup, summary:summary || null };
  }

  FC.testDataSafety = { beforeRun, afterRun, cleanupMarked };
})(typeof window !== 'undefined' ? window : globalThis);
