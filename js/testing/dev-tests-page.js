(function(root){
  'use strict';

  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function ensureButton(id){
    const el = document.getElementById(id);
    if(!el) throw new Error(`Brak elementu #${id}`);
    return el;
  }

  function detailsToText(details){
    if(details == null) return '';
    if(typeof details === 'string') return details;
    try{ return JSON.stringify(details, null, 2); }
    catch(_error){ return String(details); }
  }

  function getSuiteRegistry(){
    return [
      { key:'rozrys', name:'ROZRYS', inApp:false, run: FC.rozrysDevTests && typeof FC.rozrysDevTests.runAll === 'function' ? ()=> FC.rozrysDevTests.runAll() : null },
      { key:'project', name:'PROJEKT', inApp:true, run: FC.projectDevTests && typeof FC.projectDevTests.runAll === 'function' ? ()=> FC.projectDevTests.runAll() : null },
      { key:'investor', name:'INWESTOR', inApp:true, run: FC.investorDevTests && typeof FC.investorDevTests.runAll === 'function' ? ()=> FC.investorDevTests.runAll() : null },
      { key:'material', name:'MATERIAŁY', inApp:true, run: FC.materialDevTests && typeof FC.materialDevTests.runAll === 'function' ? ()=> FC.materialDevTests.runAll() : null },
      { key:'data', name:'DANE', inApp:true, run: FC.dataSafetyDevTests && typeof FC.dataSafetyDevTests.runAll === 'function' ? ()=> FC.dataSafetyDevTests.runAll() : null },
      { key:'rysunek', name:'RYSUNEK', inApp:true, run: FC.rysunekDevTests && typeof FC.rysunekDevTests.runAll === 'function' ? ()=> FC.rysunekDevTests.runAll() : null },
      { key:'wycena', name:'WYCENA', inApp:true, run: FC.wycenaDevTests && typeof FC.wycenaDevTests.runAll === 'function' ? ()=> FC.wycenaDevTests.runAll() : null },
      { key:'cabinet', name:'SZAFKI', inApp:true, run: FC.cabinetDevTests && typeof FC.cabinetDevTests.runAll === 'function' ? ()=> FC.cabinetDevTests.runAll() : null },
      { key:'service', name:'USŁUGI', inApp:true, run: FC.serviceDevTests && typeof FC.serviceDevTests.runAll === 'function' ? ()=> FC.serviceDevTests.runAll() : null },
    ].filter((entry)=> typeof entry.run === 'function');
  }

  async function mergeAppReports(){
    const reports = [];
    const registry = getSuiteRegistry().filter((entry)=> entry.inApp);
    for(const entry of registry){
      const report = await entry.run();
      if(report) reports.push(report);
    }
    const merged = {
      label:'APP smoke testy',
      total:0,
      passed:0,
      failed:0,
      durationMs:0,
      groups:[],
    };
    reports.forEach((report)=>{
      merged.total += report.total || 0;
      merged.passed += report.passed || 0;
      merged.failed += report.failed || 0;
      merged.durationMs += report.durationMs || 0;
      (report.groups || []).forEach((group)=> merged.groups.push(group));
    });
    merged.ok = merged.failed === 0;
    merged.summaryText = `${merged.passed}/${merged.total} OK`;
    merged.clipboardText = FC.testHarness && typeof FC.testHarness.makeClipboardReport === 'function'
      ? FC.testHarness.makeClipboardReport(merged)
      : '';
    return merged;
  }

  function buildSuiteRows(suites){
    return suites.map((suite)=>{
      const report = suite.report;
      return `
        <section class="suite ${report.ok ? 'ok' : 'bad'}">
          <div class="suite-head">
            <div>
              <h2>${suite.name}</h2>
              <div class="suite-meta">${report.passed}/${report.total} OK • błędy: ${report.failed} • czas: ${report.durationMs} ms</div>
            </div>
            <div class="suite-badge">${report.ok ? 'OK' : 'BŁĘDY'}</div>
          </div>
          <div class="groups">
            ${(report.groups || []).map((group)=> `
              <section class="group">
                <div class="group-head">
                  <strong>${group.name}</strong>
                  <span>${group.passed}/${group.total} OK</span>
                </div>
                <div class="rows">
                  ${(group.results || []).map((row)=> `
                    <div class="row ${row.ok ? 'ok' : 'bad'}">
                      <div class="row-title">${row.ok ? 'OK' : 'BŁĄD'} — ${row.name}</div>
                      ${row.explain ? `<div class="row-explain">Po co: ${row.explain}</div>` : ''}
                      ${!row.ok && row.message ? `<div class="row-msg">${row.message}</div>` : ''}
                      ${!row.ok && row.details != null ? `<div class="row-details">${detailsToText(row.details)}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </section>
            `).join('')}
          </div>
        </section>
      `;
    }).join('');
  }

  function buildClipboardText(suites, overall){
    const lines = [];
    lines.push(`Testy aplikacji: ${overall.passed}/${overall.total} OK`);
    lines.push(`Błędy: ${overall.failed}`);
    lines.push(`Czas: ${overall.durationMs} ms`);
    suites.forEach((suite)=>{
      lines.push('');
      lines.push(`=== ${suite.name} ===`);
      lines.push(suite.report.clipboardText || `${suite.name}: ${suite.report.passed}/${suite.report.total} OK`);
    });
    return lines.join('\n');
  }

  function buildErrorsOnlyClipboardText(suites, overall){
    const lines = [];
    lines.push(`Testy aplikacji — tylko błędy: ${overall.failed}`);
    if(!overall.failed){
      lines.push('Brak błędów.');
      return lines.join('\n');
    }
    suites.forEach((suite)=>{
      const failedGroups = (suite.report.groups || []).map((group)=>({
        name:group.name,
        results:(group.results || []).filter((row)=> !row.ok)
      })).filter((group)=> group.results.length);
      if(!failedGroups.length) return;
      lines.push('');
      lines.push(`=== ${suite.name} ===`);
      failedGroups.forEach((group)=>{
        lines.push(`[${group.name}] ${group.results.length} bł.`);
        group.results.forEach((row)=>{
          lines.push(`- BŁĄD: ${row.name}`);
          if(row.explain) lines.push(`  Po co: ${row.explain}`);
          if(row.message) lines.push(`  Powód: ${row.message}`);
          if(row.details != null) lines.push(`  Szczegóły: ${detailsToText(row.details)}`);
        });
      });
    });
    return lines.join('\n');
  }

  function renderResult(target, suites){
    const overall = suites.reduce((acc, suite)=>{
      const report = suite.report;
      acc.total += report.total || 0;
      acc.passed += report.passed || 0;
      acc.failed += report.failed || 0;
      acc.durationMs += report.durationMs || 0;
      return acc;
    }, { total:0, passed:0, failed:0, durationMs:0 });
    const summaryText = `${overall.passed}/${overall.total} OK`;
    target.innerHTML = `
      <div class="overall ${overall.failed === 0 ? 'ok' : 'bad'}">
        <div class="overall-title">Wynik łączny: ${summaryText}</div>
        <div class="overall-sub">Błędy: ${overall.failed} • czas: ${overall.durationMs} ms • uruchomione sekcje: ${suites.map((suite)=> suite.name).join(', ')}</div>
      </div>
      <div class="suite-list">${buildSuiteRows(suites)}</div>
    `;
    return { ...overall, summaryText, clipboardText: buildClipboardText(suites, overall) };
  }

  function createController(){
    const runAllBtn = ensureButton('runAllTests');
    const runRozrysBtn = ensureButton('runRozrysTests');
    const runAppBtn = ensureButton('runAppTests');
    const runButtons = Array.from(document.querySelectorAll('[data-run-mode]'));
    const copyBtn = ensureButton('copyReport');
    const copyErrorsBtn = ensureButton('copyErrorsOnly');
    const cleanupBtn = ensureButton('cleanupTestData');
    const auditBtn = ensureButton('auditStorage');
    const results = ensureButton('results');
    let lastOverall = null;
    let lastSuites = [];

    function setRunning(isRunning, sourceBtn){
      runButtons.forEach((btn)=>{
        btn.disabled = isRunning;
        if(!isRunning){
          btn.textContent = btn.dataset.label;
        }
      });
      if(isRunning && sourceBtn){
        sourceBtn.textContent = 'Uruchamiam...';
      }
      copyBtn.disabled = isRunning || !lastOverall;
      copyErrorsBtn.disabled = isRunning || !lastOverall;
      cleanupBtn.disabled = isRunning;
      auditBtn.disabled = isRunning;
    }

    async function collectSuites(mode){
      const suites = [];
      const registry = getSuiteRegistry();
      if(mode === 'all'){
        const rozrys = registry.find((entry)=> entry.key === 'rozrys');
        if(rozrys) suites.push({ name:rozrys.name, report: await rozrys.run() });
        suites.push({ name:'APP', report: await mergeAppReports() });
        return suites;
      }
      if(mode === 'app'){
        suites.push({ name:'APP', report: await mergeAppReports() });
        return suites;
      }
      const single = registry.find((entry)=> entry.key === mode);
      if(single) suites.push({ name:single.name, report: await single.run() });
      return suites;
    }

    function cleanupTestData(silent){
      try{
        if(!(FC.testDataManager && typeof FC.testDataManager.cleanup === 'function')) return { investors:0, projects:0, serviceOrders:0 };
        const summary = FC.testDataManager.cleanup() || { investors:0, projects:0, serviceOrders:0 };
        if(!silent){
          results.innerHTML = `
            <div class="overall ok">
              <div class="overall-title">Usunięto dane testowe</div>
              <div class="overall-sub">Inwestorzy: ${summary.investors || 0} • projekty: ${summary.projects || 0} • zlecenia usługowe: ${summary.serviceOrders || 0}</div>
            </div>
          `;
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
      setRunning(true, sourceBtn);
      results.innerHTML = '';
      let safetyContext = null;
      try{
        if(FC.testDataSafety && typeof FC.testDataSafety.beforeRun === 'function'){
          safetyContext = FC.testDataSafety.beforeRun({ mode });
        }
        cleanupTestData(true);
        const suites = await collectSuites(mode);
        lastSuites = suites.slice();
        lastOverall = renderResult(results, suites);
        copyBtn.disabled = false;
        copyErrorsBtn.disabled = false;
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
        copyBtn.disabled = false;
        copyErrorsBtn.disabled = false;
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
      await copyText(buildErrorsOnlyClipboardText(lastSuites, lastOverall), copyErrorsBtn, 'Błędy skopiowane');
    }

    async function runStorageAudit(){
      try{
        if(!(FC.dataStorageAudit && typeof FC.dataStorageAudit.auditCurrent === 'function')) throw new Error('Brak FC.dataStorageAudit.auditCurrent');
        const report = FC.dataStorageAudit.buildReport(FC.dataStorageAudit.auditCurrent());
        lastSuites = [];
        lastOverall = { failed:0, total:0, passed:0, durationMs:0, clipboardText:report };
        results.innerHTML = `
          <div class="overall ok">
            <div class="overall-title">Analiza pamięci gotowa</div>
            <div class="overall-sub">Raport pokazuje największe klucze, backup store, cache i osierocone sloty projektów. Użyj przycisku Kopiuj raport.</div>
          </div>
          <section class="suite ok"><div class="rows"><div class="row ok"><div class="row-details">${detailsToText(report)}</div></div></div></section>
        `;
        copyBtn.disabled = false;
        copyErrorsBtn.disabled = true;
      }catch(error){
        results.innerHTML = `
          <div class="overall bad">
            <div class="overall-title">Błąd analizy pamięci</div>
            <div class="overall-sub">${error && error.message ? error.message : String(error)}</div>
          </div>
        `;
      }
    }

    runButtons.forEach((btn)=>{
      btn.addEventListener('click', ()=> run(String(btn.dataset.runMode || ''), btn));
    });
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
    const modeFromHash = hashModeMap[hash] || '';
    if(modeFromHash){
      const sourceBtn = runButtons.find((btn)=> String(btn.dataset.runMode || '') === modeFromHash) || runAllBtn;
      run(modeFromHash, sourceBtn);
    }
  }

  FC.devTestsPage = { createController };
})(typeof window !== 'undefined' ? window : globalThis);
