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

  function mergeAppReports(){
    const reports = [
      FC.projectDevTests && typeof FC.projectDevTests.runAll === 'function' ? FC.projectDevTests.runAll() : null,
      FC.investorDevTests && typeof FC.investorDevTests.runAll === 'function' ? FC.investorDevTests.runAll() : null,
      FC.materialDevTests && typeof FC.materialDevTests.runAll === 'function' ? FC.materialDevTests.runAll() : null,
      FC.wycenaDevTests && typeof FC.wycenaDevTests.runAll === 'function' ? FC.wycenaDevTests.runAll() : null,
      FC.cabinetDevTests && typeof FC.cabinetDevTests.runAll === 'function' ? FC.cabinetDevTests.runAll() : null,
    ].filter(Boolean);
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
    const copyBtn = ensureButton('copyReport');
    const results = ensureButton('results');
    let lastOverall = null;

    function setRunning(isRunning, sourceBtn){
      [runAllBtn, runRozrysBtn, runAppBtn].forEach((btn)=>{
        btn.disabled = isRunning;
        if(!isRunning){
          btn.textContent = btn.dataset.label;
        }
      });
      if(isRunning && sourceBtn){
        sourceBtn.textContent = 'Uruchamiam...';
      }
      copyBtn.disabled = isRunning || !lastOverall;
    }

    function collectSuites(mode){
      const suites = [];
      if((mode === 'all' || mode === 'rozrys') && FC.rozrysDevTests && typeof FC.rozrysDevTests.runAll === 'function'){
        suites.push({ name:'ROZRYS', report: FC.rozrysDevTests.runAll() });
      }
      if((mode === 'all' || mode === 'app')){
        suites.push({ name:'APP', report: mergeAppReports() });
      }
      return suites;
    }

    function run(mode, sourceBtn){
      setRunning(true, sourceBtn);
      results.innerHTML = '';
      try{
        const suites = collectSuites(mode);
        lastOverall = renderResult(results, suites);
        copyBtn.disabled = false;
      } catch(error){
        lastOverall = {
          clipboardText: `Testy aplikacji: BŁĄD\n${error && error.message ? error.message : String(error)}`,
        };
        results.innerHTML = `
          <div class="overall bad">
            <div class="overall-title">Błąd uruchomienia testów</div>
            <div class="overall-sub">${error && error.message ? error.message : String(error)}</div>
          </div>
        `;
        copyBtn.disabled = false;
      } finally {
        setRunning(false);
      }
    }

    async function copyReport(){
      if(!lastOverall || !lastOverall.clipboardText) return;
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(lastOverall.clipboardText);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = lastOverall.clipboardText;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          textarea.remove();
        }
        copyBtn.textContent = 'Raport skopiowany';
        setTimeout(()=>{ copyBtn.textContent = copyBtn.dataset.label; }, 1500);
      } catch(_error){
        copyBtn.textContent = 'Nie udało się skopiować';
        setTimeout(()=>{ copyBtn.textContent = copyBtn.dataset.label; }, 1800);
      }
    }

    runAllBtn.addEventListener('click', ()=> run('all', runAllBtn));
    runRozrysBtn.addEventListener('click', ()=> run('rozrys', runRozrysBtn));
    runAppBtn.addEventListener('click', ()=> run('app', runAppBtn));
    copyBtn.addEventListener('click', copyReport);

    const hash = String((host.location && host.location.hash) || '').toLowerCase();
    if(hash === '#rozrys') run('rozrys', runRozrysBtn);
    else if(hash === '#app') run('app', runAppBtn);
    else if(hash === '#all') run('all', runAllBtn);
  }

  FC.devTestsPage = { createController };
})(typeof window !== 'undefined' ? window : globalThis);
