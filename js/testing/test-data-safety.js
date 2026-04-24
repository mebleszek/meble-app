(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function beforeRun(info){
    const mode = String(info && info.mode || 'tests');
    let backup = null;
    try{
      if(FC.dataBackupStore && typeof FC.dataBackupStore.createBackup === 'function'){
        backup = FC.dataBackupStore.createBackup({ reason:'before-tests', label:'Przed testami: ' + mode, dedupe:true });
        try{ FC.dataBackupStore.pruneNow && FC.dataBackupStore.pruneNow(); }catch(_){ }
      }
    }catch(error){
      return { mode, backupError:String(error && error.message || error) };
    }
    return { mode, backup };
  }

  function afterRun(_ctx, _summary){
    let cleanup = null;
    try{
      if(FC.testDataManager && typeof FC.testDataManager.cleanup === 'function') cleanup = FC.testDataManager.cleanup();
    }catch(error){ cleanup = { error:String(error && error.message || error) }; }
    return { cleanup };
  }

  FC.testDataSafety = { beforeRun, afterRun };
})(typeof window !== 'undefined' ? window : globalThis);
