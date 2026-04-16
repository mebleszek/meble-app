(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch)=> ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch] || ch));
  }

  function money(v){ return `${(Number(v)||0).toFixed(2)} PLN`; }

  function normalizeText(v){ return String(v == null ? '' : v).trim(); }

  function formatDateTime(value){
    const ts = Number(value) > 0 ? Number(value) : Date.parse(String(value || ''));
    if(!Number.isFinite(ts) || ts <= 0) return '—';
    try{
      const d = new Date(ts);
      const pad = (n)=> String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }catch(_){ return '—'; }
  }

  function normalizeSnapshot(snapshot){
    if(snapshot && snapshot.lines && snapshot.totals) return snapshot;
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(snapshot);
    }catch(_){ }
    return snapshot || null;
  }

  function row(label, value){
    return `<div class="quote-pdf-row"><div class="quote-pdf-row__label">${escapeHtml(label)}</div><div class="quote-pdf-row__value">${escapeHtml(value || '—')}</div></div>`;
  }

  function scopeModeLabel(mode){
    const key = String(mode || '').trim().toLowerCase();
    if(key === 'corpus') return 'Same korpusy';
    if(key === 'fronts') return 'Same fronty';
    return 'Korpusy + fronty';
  }

  function uniqueRowsByName(rows){
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter((row)=>{
      const key = normalizeText(row && row.name).toLowerCase();
      if(!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function formatQty(row, unitFallback){
    const qty = Number(row && row.qty) || 0;
    const unit = normalizeText(row && row.unit) || unitFallback || 'szt.';
    return `${qty} ${unit}`.trim();
  }

  function formatElementLine(row){
    const parts = [];
    const width = Math.max(0, Number(row && row.width) || 0);
    const height = Math.max(0, Number(row && row.height) || 0);
    const material = normalizeText(row && row.materialLabel);
    if(width > 0 && height > 0) parts.push(`${width} × ${height} mm`);
    if(material) parts.push(material);
    return `<li><span class="quote-pdf-list__name">${escapeHtml(normalizeText(row && row.name) || 'Element')}</span><span class="quote-pdf-list__meta">${escapeHtml(formatQty(row, 'szt.'))}${parts.length ? ` • ${escapeHtml(parts.join(' • '))}` : ''}</span></li>`;
  }

  function formatSimpleLine(row, unitFallback){
    return `<li><span class="quote-pdf-list__name">${escapeHtml(normalizeText(row && row.name) || 'Pozycja')}</span><span class="quote-pdf-list__meta">${escapeHtml(formatQty(row, unitFallback))}</span></li>`;
  }

  function formatMaterialLine(row){
    return `<li><span class="quote-pdf-list__name">${escapeHtml(normalizeText(row && row.name) || 'Materiał')}</span></li>`;
  }

  function buildListSection(title, itemsHtml, emptyText){
    const content = String(itemsHtml || '').trim();
    return `<section class="section full"><h2 class="section-title">${escapeHtml(title)}</h2>${content ? `<ul class="quote-pdf-list">${content}</ul>` : `<div class="quote-pdf-empty">${escapeHtml(emptyText || 'Brak pozycji.')}</div>`}</section>`;
  }

  function getClientPdfData(snapshot){
    const snap = normalizeSnapshot(snapshot);
    const lines = snap && snap.lines || {};
    const scope = snap && snap.scope || {};
    const fallbackSelection = {
      selectedRooms: Array.isArray(scope && scope.selectedRooms) ? scope.selectedRooms.slice() : [],
      materialScope: scope && scope.materialScope ? scope.materialScope : null,
    };
    let fallback = null;
    try{
      if(FC.wycenaCore && typeof FC.wycenaCore.collectClientPdfDetails === 'function') fallback = FC.wycenaCore.collectClientPdfDetails(fallbackSelection);
    }catch(_){ fallback = null; }
    const elements = Array.isArray(lines && lines.elements) && lines.elements.length ? lines.elements : (fallback && Array.isArray(fallback.elements) ? fallback.elements : []);
    const materials = uniqueRowsByName(Array.isArray(lines && lines.materials) && lines.materials.length ? lines.materials : (fallback && Array.isArray(fallback.materials) ? fallback.materials : []));
    const accessories = Array.isArray(lines && lines.accessories) && lines.accessories.length ? lines.accessories : (fallback && Array.isArray(fallback.accessories) ? fallback.accessories : []);
    const services = Array.isArray(lines && lines.quoteRates) && lines.quoteRates.length ? lines.quoteRates : (fallback && Array.isArray(fallback.services) ? fallback.services : []);
    const agd = Array.isArray(lines && lines.agdServices) && lines.agdServices.length ? lines.agdServices : (fallback && Array.isArray(fallback.agd) ? fallback.agd : []);
    return { elements, materials, accessories, services, agd };
  }

  function buildCommercialRows(commercial, preliminary, selectedByClient, versionName){
    const rows = [];
    if(versionName) rows.push(row('Wersja oferty', versionName));
    rows.push(row('Typ oferty', preliminary ? 'Wstępna wycena (bez pomiaru)' : 'Wycena'));
    rows.push(row('Status oferty', selectedByClient ? 'Zaakceptowana' : 'Wersja przygotowana do prezentacji'));
    if(normalizeText(commercial.offerValidity)) rows.push(row('Ważność oferty', commercial.offerValidity));
    if(normalizeText(commercial.leadTime)) rows.push(row('Termin realizacji', commercial.leadTime));
    if(normalizeText(commercial.deliveryTerms)) rows.push(row('Warunki montażu / transportu', commercial.deliveryTerms));
    if(normalizeText(commercial.customerNote)) rows.push(row('Dodatkowe ustalenia', commercial.customerNote));
    return rows.join('') || '<div class="quote-pdf-empty">Brak dodatkowych warunków oferty.</div>';
  }

  function buildPrintHtml(snapshot){
    const snap = normalizeSnapshot(snapshot);
    const investor = snap && snap.investor || null;
    const project = snap && snap.project || null;
    const scope = snap && snap.scope || {};
    const roomLabels = Array.isArray(scope && scope.roomLabels) ? scope.roomLabels : [];
    const totals = snap && snap.totals || {};
    const commercial = snap && snap.commercial || {};
    const selectedByClient = !!(snap && snap.meta && snap.meta.selectedByClient);
    const preliminary = !!(snap && ((snap.meta && snap.meta.preliminary) || (snap.commercial && snap.commercial.preliminary)));
    let versionName = '';
    try{
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getEffectiveVersionName === 'function') versionName = normalizeText(FC.quoteSnapshotStore.getEffectiveVersionName(snap));
    }catch(_){ }
    if(!versionName) versionName = normalizeText(commercial && commercial.versionName) || normalizeText(snap && snap.meta && snap.meta.versionName);
    const title = normalizeText(project && project.title) || normalizeText(investor && (investor.companyName || investor.name)) || 'Wycena projektu';
    const investorLabel = normalizeText(investor && (investor.companyName || investor.name));
    const grand = Number(totals && totals.grand) || 0;
    const scopeLabel = scopeModeLabel(scope && scope.materialScopeMode);
    const badge = preliminary ? 'Wstępna wycena' : 'Wycena końcowa';
    const clientPdf = getClientPdfData(snap);
    const materialsHtml = (clientPdf.materials || []).map(formatMaterialLine).join('');
    const accessoriesHtml = (clientPdf.accessories || []).map((row)=> formatSimpleLine(row, 'szt.')).join('');
    const servicesHtml = (clientPdf.services || []).map((row)=> formatSimpleLine(row, 'x')).join('');
    const agdHtml = (clientPdf.agd || []).map((row)=> formatSimpleLine(row, 'szt.')).join('');
    return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<title>Oferta - ${escapeHtml(title)}</title>
<style>
  @page { size:A4; margin:11mm; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:Arial, Helvetica, sans-serif; color:#0f172a; background:#eef3f8; }
  .sheet{ background:#fff; border:1px solid #dbe5ef; border-radius:18px; padding:13mm 12mm 11mm; box-shadow:0 10px 30px rgba(15,23,42,.08); }
  .hero{ display:grid; grid-template-columns:minmax(0,1.25fr) minmax(220px,.75fr); gap:12px; align-items:stretch; }
  .hero-main,.hero-total{ border:1px solid #dbe5ef; border-radius:16px; padding:14px 16px; background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%); }
  .eyebrow{ font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#64748b; }
  .hero-badges{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .hero-badge{ display:inline-flex; align-items:center; min-height:28px; padding:4px 10px; border-radius:999px; border:1px solid rgba(59,130,246,.24); background:rgba(59,130,246,.12); color:#1d4ed8; font-size:11px; font-weight:900; letter-spacing:.04em; text-transform:uppercase; }
  .hero-badge.is-warm{ border-color:rgba(234,88,12,.24); background:rgba(234,88,12,.10); color:#c2410c; }
  .hero-badge.is-green{ border-color:rgba(34,197,94,.28); background:rgba(34,197,94,.12); color:#166534; }
  .title{ margin:8px 0 0; font-size:28px; line-height:1.08; font-weight:900; }
  .subtitle{ margin:8px 0 0; font-size:13px; line-height:1.45; color:#475569; }
  .hero-total__label{ font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#64748b; }
  .hero-total__value{ margin-top:8px; font-size:32px; line-height:1; font-weight:900; color:#166534; }
  .hero-total__meta{ margin-top:10px; font-size:12px; line-height:1.45; color:#475569; }
  .meta{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:12px; }
  .meta-card,.section{ border:1px solid #dbe5ef; border-radius:14px; padding:12px 14px; background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%); }
  .meta-card__label{ font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#64748b; }
  .meta-card__value{ margin-top:5px; font-size:16px; font-weight:800; overflow-wrap:anywhere; }
  .grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
  .section-title{ margin:0 0 10px; font-size:16px; font-weight:900; }
  .quote-pdf-row{ display:grid; grid-template-columns:150px minmax(0,1fr); gap:10px; padding:6px 0; border-bottom:1px solid rgba(219,229,239,.9); }
  .quote-pdf-row:last-child{ border-bottom:none; padding-bottom:0; }
  .quote-pdf-row__label{ font-size:12px; font-weight:800; color:#64748b; }
  .quote-pdf-row__value{ font-size:14px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
  .full{ margin-top:12px; }
  .quote-pdf-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
  .quote-pdf-list li{ padding:10px 0; border-bottom:1px solid #dbe5ef; }
  .quote-pdf-list li:last-child{ border-bottom:none; padding-bottom:0; }
  .quote-pdf-list__name{ display:block; font-size:14px; line-height:1.35; font-weight:800; color:#0f172a; }
  .quote-pdf-list__meta{ display:block; margin-top:4px; font-size:12px; line-height:1.4; color:#475569; }
  .quote-pdf-empty{ color:#64748b; font-style:italic; }
  .footer{ margin-top:12px; font-size:11px; color:#64748b; text-align:right; }
  @media print{
    body{ background:#fff; }
    .sheet{ border:none; border-radius:0; box-shadow:none; padding:0; }
  }
</style>
</head>
<body>
  <main class="sheet">
    <section class="hero">
      <div class="hero-main">
        <div class="eyebrow">Oferta dla klienta</div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="subtitle">Dokument handlowy przygotowany dla klienta. Szczegółowy rozkład kosztów pozostaje w podglądzie programu i nie jest pokazywany w tym PDF.</p>
        <div class="hero-badges">
          <span class="hero-badge is-warm">${escapeHtml(badge)}</span>
          <span class="hero-badge ${selectedByClient ? 'is-green' : ''}">${escapeHtml(selectedByClient ? 'Zaakceptowana' : 'Przygotowana do prezentacji')}</span>
          ${versionName ? `<span class="hero-badge">${escapeHtml(versionName)}</span>` : ''}
        </div>
      </div>
      <div class="hero-total">
        <div class="hero-total__label">Cena końcowa oferty</div>
        <div class="hero-total__value">${escapeHtml(money(grand))}</div>
        <div class="hero-total__meta">Data wyceny: ${escapeHtml(formatDateTime(snap && snap.generatedAt))}<br/>Pomieszczenia: ${escapeHtml(roomLabels.join(', ') || '—')}<br/>Zakres: ${escapeHtml(scopeLabel)}</div>
      </div>
    </section>

    <section class="meta">
      <div class="meta-card">
        <div class="meta-card__label">Klient</div>
        <div class="meta-card__value">${escapeHtml(investorLabel || '—')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card__label">Projekt</div>
        <div class="meta-card__value">${escapeHtml(title)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card__label">Zakres elementów</div>
        <div class="meta-card__value">${escapeHtml(scopeLabel)}</div>
      </div>
    </section>

    <section class="grid">
      <div class="section">
        <h2 class="section-title">Warunki oferty</h2>
        ${buildCommercialRows(commercial, preliminary, selectedByClient, versionName)}
      </div>
      <div class="section">
        <h2 class="section-title">Podsumowanie handlowe</h2>
        ${row('Cena końcowa oferty', money(grand))}
        ${row('Pomieszczenia', roomLabels.join(', ') || '—')}
        ${row('Zakres', scopeLabel)}
      </div>
    </section>

    ${buildListSection('Materiały / kolory', materialsHtml, 'Brak materiałów w tej ofercie.')}
    ${buildListSection('Akcesoria', accessoriesHtml, 'Brak akcesoriów w tej ofercie.')}
    ${buildListSection('Usługi / zakres prac', servicesHtml, 'Brak dodatkowych usług w tej ofercie.')}
    ${buildListSection('Sprzęty / AGD do montażu', agdHtml, 'Brak sprzętów do montażu w tej ofercie.')}

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
    const hasLines = !!(snap && snap.lines && (Array.isArray(snap.lines.materials) || Array.isArray(snap.lines.accessories) || Array.isArray(snap.lines.agdServices) || Array.isArray(snap.lines.quoteRates) || Array.isArray(snap.lines.elements)));
    if(!hasLines){
      try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak wyceny', message:'Najpierw wygeneruj wycenę, aby przygotować PDF dla klienta.' }); }catch(_){ }
      return false;
    }
    return openPrintView(buildPrintHtml(snap));
  }

  FC.quotePdf = {
    buildPrintHtml,
    openQuotePdf,
  };
})();
