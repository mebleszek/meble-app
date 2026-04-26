(function(root){
  'use strict';

  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function byId(id){
    const el = document.getElementById(id);
    if(!el) throw new Error(`Brak elementu #${id}`);
    return el;
  }

  function createController(){
    const registry = FC.devTestsRegistry;
    const reportView = FC.devTestsReportView;
    if(!(registry && typeof registry.collectSuites === 'function')) throw new Error('Brak FC.devTestsRegistry.collectSuites');
    if(!(reportView && typeof reportView.renderResult === 'function')) throw new Error('Brak FC.devTestsReportView.renderResult');

    const home = byId('devTestsHome');
    const memorySection = byId('memoryToolsSection');
    const testsSection = byId('regressionTestsSection');
    const reportToolbar = byId('reportToolbar');
    const results = byId('results');
    const openMemoryBtn = byId('openMemoryTools');
    const openTestsBtn = byId('openRegressionTests');
    const backMemoryBtn = byId('backFromMemoryTools');
    const backTestsBtn = byId('backFromRegressionTests');
    const runAllBtn = byId('runAllTests');
    const runButtons = Array.from(document.querySelectorAll('[data-run-mode]'));
    const copyBtn = byId('copyReport');
    const copyErrorsBtn = byId('copyErrorsOnly');
    const cleanupBtn = byId('cleanupTestData');
    const auditBtn = byId('auditStorage');
    let lastOverall = null;
    let lastSuites = [];

    function showPanel(name, keepResults){
      home.hidden = name !== 'home';
      memorySection.hidden = name !== 'memory';
      testsSection.hidden = name !== 'tests';
      if(!keepResults){
        results.innerHTML = '';
        lastOverall = null;
        lastSuites = [];
      }
      updateReportButtons(false);
    }

    function updateReportButtons(isRunning){
      const hasReport = !!(lastOverall && lastOverall.clipboardText);
      reportToolbar.hidden = !hasReport;
      copyBtn.disabled = isRunning || !hasReport;
      copyErrorsBtn.disabled = isRunning || !lastOverall;
    }

    function setRunning(isRunning, sourceBtn){
      runButtons.forEach((btn)=>{
        btn.disabled = isRunning;
        if(!isRunning) btn.textContent = btn.dataset.label;
      });
      if(isRunning && sourceBtn) sourceBtn.textContent = 'Uruchamiam...';
      cleanupBtn.disabled = isRunning;
      auditBtn.disabled = isRunning;
      openMemoryBtn.disabled = isRunning;
      openTestsBtn.disabled = isRunning;
      backMemoryBtn.disabled = isRunning;
      backTestsBtn.disabled = isRunning;
      updateReportButtons(isRunning);
    }

    function finishRunStartCancelled(message){
      lastSuites = [];
      lastOverall = { failed:0, total:0, passed:0, durationMs:0, clipboardText:message || 'Testy anulowane.' };
      results.innerHTML = `
        <div class="overall bad">
          <div class="overall-title">Testy anulowane</div>
          <div class="overall-sub">${message || 'Uruchomienie testów zostało przerwane przed startem.'}</div>
        </div>
      `;
      updateReportButtons(false);
      copyErrorsBtn.disabled = true;
    }

    function appendSafetyNote(ctx){
      if(!(ctx && ctx.manualFileBackup && lastOverall)) return;
      const note = `Backup przed testami pobrano do pliku: ${ctx.manualFileBackup.filename || 'plik JSON'}. Nie został zapisany w pamięci programu.`;
      lastOverall.clipboardText = String(lastOverall.clipboardText || '') + '\n\nUWAGA: ' + note;
      const box = document.createElement('div');
      box.className = 'overall ok';
      box.innerHTML = `<div class="overall-title">Backup testów zapisany do pliku</div><div class="overall-sub">${note}</div>`;
      results.insertBefore(box, results.firstChild);
    }

    function cleanupTestData(silent){
      try{
        if(!(FC.testDataManager && typeof FC.testDataManager.cleanup === 'function')) return { investors:0, projects:0, serviceOrders:0 };
        const summary = FC.testDataManager.cleanup() || { investors:0, projects:0, serviceOrders:0 };
        if(!silent){
          lastOverall = { failed:0, total:0, passed:0, durationMs:0, clipboardText:`Usunięto dane testowe\nInwestorzy: ${summary.investors || 0}\nProjekty: ${summary.projects || 0}\nZlecenia usługowe: ${summary.serviceOrders || 0}` };
          lastSuites = [];
          results.innerHTML = `
            <div class="overall ok">
              <div class="overall-title">Usunięto dane testowe</div>
              <div class="overall-sub">Inwestorzy: ${summary.investors || 0} • projekty: ${summary.projects || 0} • zlecenia usługowe: ${summary.serviceOrders || 0}</div>
            </div>
          `;
          updateReportButtons(false);
          copyErrorsBtn.disabled = true;
        }
        return summary;
      }catch(error){
        if(!silent){
          results.innerHTML = `
            <div class="overall bad">
              <div class="overall-title">Błąd czyszczenia danych testowych</div>
              <div class="overall-sub">${error && error.message ? error.message : String(error)}</div>
            </div>
          `;
        }
        return { investors:0, projects:0, serviceOrders:0 };
      }
    }

    async function run(mode, sourceBtn){
      showPanel('tests', true);
      setRunning(true, sourceBtn);
      results.innerHTML = '';
      let safetyContext = null;
      try{
        if(FC.testDataSafety && typeof FC.testDataSafety.beforeRun === 'function'){
          safetyContext = await FC.testDataSafety.beforeRun({ mode });
          if(safetyContext && safetyContext.cancelled){
            finishRunStartCancelled('Testy nie zostały uruchomione, bo backup przed testami został anulowany.');
            return;
          }
        }
        cleanupTestData(true);
        const suites = await registry.collectSuites(mode);
        lastSuites = suites.slice();
        lastOverall = reportView.renderResult(results, suites);
        appendSafetyNote(safetyContext);
        updateReportButtons(false);
      } catch(error){
        lastSuites = [];
        lastOverall = {
          failed:1,
          clipboardText: `Testy aplikacji: BŁĄD\n${error && error.message ? error.message : String(error)}`,
        };
        results.innerHTML = `
          <div class="overall bad">
            <div class="overall-title">Błąd uruchomienia testów</div>
            <div class="overall-sub">${error && error.message ? error.message : String(error)}</div>
          </div>
        `;
        updateReportButtons(false);
      } finally {
        try{ cleanupTestData(true); }catch(_){ }
        try{ if(FC.testDataSafety && typeof FC.testDataSafety.afterRun === 'function') FC.testDataSafety.afterRun(safetyContext, { mode, failed:lastOverall && lastOverall.failed }); }catch(_){ }
        setRunning(false);
      }
    }

    async function copyText(text, button, successText){
      if(!text) return;
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          textarea.remove();
        }
        button.textContent = successText;
        setTimeout(()=>{ button.textContent = button.dataset.label; }, 1500);
      } catch(_error){
        button.textContent = 'Nie udało się skopiować';
        setTimeout(()=>{ button.textContent = button.dataset.label; }, 1800);
      }
    }

    async function copyReport(){
      if(!lastOverall || !lastOverall.clipboardText) return;
      await copyText(lastOverall.clipboardText, copyBtn, 'Raport skopiowany');
    }

    async function copyErrorsOnly(){
      if(!lastOverall) return;
      await copyText(reportView.buildErrorsOnlyClipboardText(lastSuites, lastOverall), copyErrorsBtn, 'Błędy skopiowane');
    }

    async function runStorageAudit(){
      showPanel('memory', true);
      if(FC.devTestsStorageTools && typeof FC.devTestsStorageTools.runStorageAudit === 'function'){
        await FC.devTestsStorageTools.runStorageAudit({
          results,
          copyBtn,
          copyErrorsBtn,
          detailsToText:reportView.detailsToText,
          setLastOverall(value){
            lastSuites = [];
            lastOverall = value;
            updateReportButtons(false);
            copyErrorsBtn.disabled = true;
          },
        });
        updateReportButtons(false);
        copyErrorsBtn.disabled = true;
        return;
      }
      results.innerHTML = '<div class="overall bad"><div class="overall-title">Błąd analizy pamięci</div><div class="overall-sub">Brak modułu devTestsStorageTools.</div></div>';
    }

    openMemoryBtn.addEventListener('click', ()=> showPanel('memory'));
    openTestsBtn.addEventListener('click', ()=> showPanel('tests'));
    backMemoryBtn.addEventListener('click', ()=> showPanel('home'));
    backTestsBtn.addEventListener('click', ()=> showPanel('home'));
    runButtons.forEach((btn)=> btn.addEventListener('click', ()=> run(String(btn.dataset.runMode || ''), btn)));
    copyBtn.addEventListener('click', copyReport);
    copyErrorsBtn.addEventListener('click', copyErrorsOnly);
    cleanupBtn.addEventListener('click', ()=> cleanupTestData(false));
    auditBtn.addEventListener('click', runStorageAudit);

    const hash = String((host.location && host.location.hash) || '').toLowerCase();
    const hashModeMap = {
      '#all':'all',
      '#app':'app',
      '#rozrys':'rozrys',
      '#project':'project',
      '#investor':'investor',
      '#material':'material',
      '#data':'data',
      '#rysunek':'rysunek',
      '#wycena':'wycena',
      '#cabinet':'cabinet',
      '#service':'service',
    };
    if(hash === '#memory' || hash === '#tools' || hash === '#storage'){
      showPanel('memory');
      return;
    }
    if(hash === '#tests'){
      showPanel('tests');
      return;
    }
    const modeFromHash = hashModeMap[hash] || '';
    if(modeFromHash){
      const sourceBtn = runButtons.find((btn)=> String(btn.dataset.runMode || '') === modeFromHash) || runAllBtn;
      run(modeFromHash, sourceBtn);
      return;
    }
    showPanel('home');
  }

  FC.devTestsPage = { createController };
})(typeof window !== 'undefined' ? window : globalThis);
