(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderReport(rootEl, report){
    if(!rootEl || !report) return;
    const groupsHtml = report.groups.map((group)=>{
      const rows = group.results.map((row)=>`
        <div class="row ${row.ok ? 'ok' : 'fail'}">
          <div class="name">${row.ok ? 'OK' : 'BŁĄD'}: ${escapeHtml(row.name)}</div>
          ${row.explain ? `<div class="explain">Po co: ${escapeHtml(row.explain)}</div>` : ''}
          ${!row.ok && row.message ? `<div class="reason">Powód: ${escapeHtml(row.message)}</div>` : ''}
          ${!row.ok && row.details != null ? `<pre class="details">${escapeHtml(host.FC.testHarness.detailsToText(row.details))}</pre>` : ''}
        </div>`).join('');
      return `
        <section class="group">
          <h3>[${escapeHtml(group.name)}] ${group.passed}/${group.total} OK</h3>
          ${rows}
        </section>`;
    }).join('');
    rootEl.innerHTML = `
      <div class="summary">
        <div class="summary-main">${escapeHtml(report.label)}: ${report.passed}/${report.total} OK</div>
        <div class="summary-sub">Błędy: ${report.failed}</div>
        <div class="summary-sub">Czas: ${report.durationMs} ms</div>
      </div>
      ${groupsHtml}`;
  }

  host.FC.testBrowserPage = { renderReport };
})(typeof window !== 'undefined' ? window : globalThis);
