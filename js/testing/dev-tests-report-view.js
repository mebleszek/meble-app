(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function detailsToText(details){
    if(details == null) return '';
    if(typeof details === 'string') return details;
    try{ return JSON.stringify(details, null, 2); }
    catch(_error){ return String(details); }
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

  FC.devTestsReportView = {
    detailsToText,
    renderResult,
    buildErrorsOnlyClipboardText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
