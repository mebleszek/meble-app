(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function ask(ctx){
    const opts = ctx || {};
    const errorText = String(opts.error && opts.error.message || opts.error || 'Nie udało się zapisać backupu przed testami.');
    const analysis = opts.analysis || null;
    const hasOrphans = Number(analysis && analysis.count || 0) > 0;
    if(!(FC.choiceBox && typeof FC.choiceBox.ask === 'function')) return Promise.resolve('cancel');
    const actions = [
      { value:'download', text:'Pobierz backup i uruchom testy', tone:'success' },
    ];
    if(hasOrphans) actions.push({ value:'clean-retry', text:'Wyczyść sieroty i spróbuj ponownie', tone:'neutral' });
    actions.push({ value:'cancel', text:'Anuluj', tone:'danger' });
    return FC.choiceBox.ask({
      title:'BACKUP PRZED TESTAMI NIE ZOSTAŁ ZAPISANY',
      message:`${errorText} Możesz pobrać backup do pliku i kontynuować testy albo anulować uruchomienie testów.`,
      dismissValue:'cancel',
      dismissOnOverlay:false,
      actions,
    });
  }

  FC.testBackupFallbackModal = { ask };
})();
