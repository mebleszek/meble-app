(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function fmt(value){
    try{ return FC.dataStorageAudit && FC.dataStorageAudit.formatBytes ? FC.dataStorageAudit.formatBytes(value) : String(value || 0); }
    catch(_){ return String(value || 0); }
  }

  function stats(analysis){
    const data = analysis || (FC.dataStorageOrphanCleanup && FC.dataStorageOrphanCleanup.analyzeCurrent ? FC.dataStorageOrphanCleanup.analyzeCurrent() : null) || {};
    return {
      count:Number(data.count || 0),
      bytes:Number(data.bytes || 0),
    };
  }

  function askForBackup(analysis){
    const s = stats(analysis);
    if(!(FC.choiceBox && typeof FC.choiceBox.ask === 'function')) return Promise.resolve('skip');
    return FC.choiceBox.ask({
      title:'WYKRYTO OSIEROCONE PROJEKTY',
      message:`Program wykrył ${s.count} osieroconych slotów projektów (${fmt(s.bytes)}). Możesz je wyczyścić przed utworzeniem backupu albo zrobić backup bez czyszczenia.`,
      dismissValue:'cancel',
      dismissOnOverlay:false,
      actions:[
        { value:'clean', text:'Wyczyść i zrób backup', tone:'success' },
        { value:'skip', text:'Zrób backup bez czyszczenia', tone:'neutral' },
        { value:'cancel', text:'Anuluj', tone:'danger' },
      ],
    });
  }

  function askForTests(analysis){
    const s = stats(analysis);
    if(!(FC.choiceBox && typeof FC.choiceBox.ask === 'function')) return Promise.resolve('skip');
    return FC.choiceBox.ask({
      title:'OSIEROCONE PROJEKTY PRZED TESTAMI',
      message:`Przed testami wykryto ${s.count} osieroconych slotów projektów (${fmt(s.bytes)}). Możesz je wyczyścić przed backupem testowym albo uruchomić testy bez czyszczenia.`,
      dismissValue:'cancel',
      dismissOnOverlay:false,
      actions:[
        { value:'clean', text:'Wyczyść i uruchom testy', tone:'success' },
        { value:'skip', text:'Uruchom bez czyszczenia', tone:'neutral' },
        { value:'cancel', text:'Anuluj', tone:'danger' },
      ],
    });
  }

  FC.storageOrphanCleanupModal = { askForBackup, askForTests };
})();
