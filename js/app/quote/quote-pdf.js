(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char)=> ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function normalizeText(value){
    return String(value == null ? '' : value).trim();
  }

  function money(value){
    return `${(Number(value) || 0).toFixed(2)} PLN`;
  }

  function formatDateTime(value){
    const ts = Number(value) > 0 ? Number(value) : Date.parse(String(value || ''));
    if(!Number.isFinite(ts) || ts <= 0) return '—';
    try{
      const date = new Date(ts);
      const pad = (n)=> String(n).padStart(2, '0');
      return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }catch(_){
      return '—';
    }
  }

  function row(label, value){
    return `<div class="quote-pdf-row"><div class="quote-pdf-row__label">${escapeHtml(label)}</div><div class="quote-pdf-row__value">${escapeHtml(normalizeText(value) || '—')}</div></div>`;
  }

  function normalizeSnapshot(snapshot){
    const src = snapshot && typeof snapshot === 'object' ? snapshot : {};
    if(src.lines && src.totals) return src;
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(src);
    }catch(_){ }
    return src;
  }

  function tableRows(lines, emptyText){
    const rows = Array.isArray(lines) ? lines : [];
    if(!rows.length) return `<tr><td colspan="5" class="quote-pdf-empty">${escapeHtml(emptyText || 'Brak pozycji.')}</td></tr>`;
    return rows.map((line)=>{
      const noteParts = [];
      const note = normalizeText(line && line.note);
      const rooms = normalizeText(line && line.rooms);
      if(note) noteParts.push(note);
      if(rooms && (!note || rooms !== note)) noteParts.push(`Pomieszczenia: ${rooms}`);
      return `<tr>
        <td>${escapeHtml(normalizeText(line && line.name) || 'Pozycja')}</td>
        <td>${escapeHtml(`${Number(line && line.qty) || 0}${line && line.unit ? ` ${line.unit}` : ''}`)}</td>
        <td>${escapeHtml(money(line && line.unitPrice))}</td>
        <td>${escapeHtml(money(line && line.total))}</td>
        <td>${escapeHtml(noteParts.join(' • ') || '—')}</td>
      </tr>`;
    }).join('');
  }

  function buildPrintHtml(snapshot){
    const snap = normalizeSnapshot(snapshot);
    const investor = snap && snap.investor || null;
    const project = snap && snap.project || null;
    const roomLabels = Array.isArray(snap && snap.scope && snap.scope.roomLabels) ? snap.scope.roomLabels : [];
    const lines = snap && snap.lines || {};
    const totals = snap && snap.totals || {};
    const title = normalizeText(project && project.title) || normalizeText(investor && (investor.companyName || investor.name)) || 'Wycena projektu';
    const investorLabel = normalizeText(investor && (investor.companyName || investor.name));
    return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<title>Wycena - ${escapeHtml(title)}</title>
<style>
  @page { size:A4; margin:12mm; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:Arial, Helvetica, sans-serif; color:#0f172a; background:#eef3f8; }
  .sheet{ background:#fff; border:1px solid #dbe5ef; border-radius:16px; padding:14mm 13mm 12mm; box-shadow:0 10px 30px rgba(15,23,42,.08); }
  .topbar{ display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .eyebrow{ font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#64748b; }
  .title{ margin:6px 0 0; font-size:28px; line-height:1.08; font-weight:900; }
  .subtitle{ margin:8px 0 0; font-size:13px; color:#475569; }
  .meta{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:16px; }
  .meta-card,.section{ border:1px solid #dbe5ef; border-radius:14px; padding:12px 14px; background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%); }
  .meta-card__label{ font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#64748b; }
  .meta-card__value{ margin-top:5px; font-size:16px; font-weight:800; overflow-wrap:anywhere; }
  .grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
  .section-title{ margin:0 0 10px; font-size:16px; font-weight:900; }
  .quote-pdf-row{ display:grid; grid-template-columns:138px minmax(0,1fr); gap:10px; padding:6px 0; border-bottom:1px solid rgba(219,229,239,.9); }
  .quote-pdf-row:last-child{ border-bottom:none; padding-bottom:0; }
  .quote-pdf-row__label{ font-size:12px; font-weight:800; color:#64748b; }
  .quote-pdf-row__value{ font-size:14px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
  .full{ margin-top:12px; }
  table{ width:100%; border-collapse:collapse; margin-top:6px; }
  th,td{ padding:10px 8px; border-bottom:1px solid #dbe5ef; text-align:left; vertical-align:top; font-size:13px; }
  th{ font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }
  .quote-pdf-empty{ color:#64748b; font-style:italic; }
  .totals{ margin-top:6px; }
  .totals__row{ display:flex; justify-content:space-between; gap:10px; padding:6px 0; font-weight:700; }
  .footer{ margin-top:12px; font-size:11px; color:#64748b; text-align:right; }
  @media print{
    body{ background:#fff; }
    .sheet{ border:none; border-radius:0; box-shadow:none; padding:0; }
  }
</style>
</head>
<body>
  <main class="sheet">
    <div class="topbar">
      <div>
        <div class="eyebrow">Wycena dla klienta</div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="subtitle">Dokument handlowy wygenerowany z zapisanego snapshotu wyceny.</p>
      </div>
    </div>

    <section class="meta">
      <div class="meta-card">
        <div class="meta-card__label">Data wyceny</div>
        <div class="meta-card__value">${escapeHtml(formatDateTime(snap && snap.generatedAt))}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card__label">Zakres pomieszczeń</div>
        <div class="meta-card__value">${escapeHtml(roomLabels.join(', ') || '—')}</div>
      </div>
    </section>

    <section class="grid">
      <div class="section">
        <h2 class="section-title">Dane klienta / projektu</h2>
        ${row('Klient', investorLabel || '—')}
        ${row('Projekt', title)}
        ${row('Status projektu', project && project.status)}
      </div>
      <div class="section">
        <h2 class="section-title">Podsumowanie</h2>
        <div class="totals">
          <div class="totals__row"><span>Materiały</span><span>${escapeHtml(money(totals && totals.materials))}</span></div>
          <div class="totals__row"><span>Akcesoria</span><span>${escapeHtml(money(totals && totals.accessories))}</span></div>
          <div class="totals__row"><span>Montaż AGD</span><span>${escapeHtml(money(totals && totals.services))}</span></div>
          <div class="totals__row"><span>Razem</span><span>${escapeHtml(money(totals && totals.grand))}</span></div>
        </div>
      </div>
    </section>

    <section class="section full">
      <h2 class="section-title">Materiały</h2>
      <table>
        <thead><tr><th>Pozycja</th><th>Ilość</th><th>Cena</th><th>Wartość</th><th>Uwagi</th></tr></thead>
        <tbody>${tableRows(lines && lines.materials, 'Brak pozycji materiałowych.')}</tbody>
      </table>
    </section>

    <section class="section full">
      <h2 class="section-title">Akcesoria</h2>
      <table>
        <thead><tr><th>Pozycja</th><th>Ilość</th><th>Cena</th><th>Wartość</th><th>Uwagi</th></tr></thead>
        <tbody>${tableRows(lines && lines.accessories, 'Brak pozycji akcesoriów.')}</tbody>
      </table>
    </section>

    <section class="section full">
      <h2 class="section-title">Sprzęty do zabudowy / montaż AGD</h2>
      <table>
        <thead><tr><th>Pozycja</th><th>Ilość</th><th>Cena</th><th>Wartość</th><th>Uwagi</th></tr></thead>
        <tbody>${tableRows(lines && lines.agdServices, 'Brak pozycji AGD.')}</tbody>
      </table>
    </section>

    <div class="footer">Wygenerowano z meble-app</div>
  </main>
</body>
</html>`;
  }

  function openPrintView(html){
    if(FC.rozrysPrint && typeof FC.rozrysPrint.openPrintView === 'function'){
      FC.rozrysPrint.openPrintView(html);
      return true;
    }
    try{
      const win = window.open('', '_blank');
      if(!win) return false;
      win.document.open();
      win.document.write(String(html || ''));
      win.document.close();
      win.focus();
      setTimeout(()=>{ try{ win.print(); }catch(_){ } }, 120);
      return true;
    }catch(_){
      return false;
    }
  }

  function openQuotePdf(snapshot){
    const snap = normalizeSnapshot(snapshot);
    const hasLines = !!(snap && snap.lines && (Array.isArray(snap.lines.materials) || Array.isArray(snap.lines.accessories) || Array.isArray(snap.lines.agdServices)));
    if(!hasLines){
      try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak snapshotu wyceny', message:'Najpierw wygeneruj wycenę, aby przygotować PDF dla klienta.' }); }catch(_){ }
      return false;
    }
    return openPrintView(buildPrintHtml(snap));
  }

  FC.quotePdf = {
    buildPrintHtml,
    openQuotePdf,
  };
})();
