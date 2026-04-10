(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const STATUS_LABELS = {
    nowy:'Nowy',
    wstepna_wycena:'Wstępna wycena',
    pomiar:'Pomiar',
    po_pomiarze:'Po pomiarze',
    wycena:'Wycena',
    zaakceptowany:'Zaakceptowany',
    umowa:'Umowa',
    produkcja:'Produkcja',
    montaz:'Montaż',
    zakonczone:'Zakończone',
    odrzucone:'Odrzucone',
    'wycena wstępna':'Wycena wstępna',
    'po pomiarze':'Po pomiarze',
    'wycena ostateczna':'Wycena ostateczna',
    'do poprawki':'Do poprawki',
    'w produkcji':'W produkcji',
    montaż:'Montaż',
    zakończony:'Zakończony'
  };

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char)=> ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function normalizeText(value){
    return String(value == null ? '' : value).trim();
  }

  function formatDate(value){
    const raw = normalizeText(value);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : (raw || '—');
  }

  function investorTitle(investor){
    const inv = investor || {};
    return String(inv.kind || 'person') === 'company'
      ? normalizeText(inv.companyName) || 'Firma bez nazwy'
      : normalizeText(inv.name) || 'Inwestor bez nazwy';
  }

  function investorKindLabel(investor){
    return String(investor && investor.kind || 'person') === 'company' ? 'Firma' : 'Osoba prywatna';
  }

  function row(label, value){
    return `<div class="investor-pdf-row"><div class="investor-pdf-row__label">${escapeHtml(label)}</div><div class="investor-pdf-row__value">${escapeHtml(normalizeText(value) || '—')}</div></div>`;
  }

  function roomRows(investor){
    const rooms = Array.isArray(investor && investor.rooms) ? investor.rooms : [];
    if(!rooms.length){
      return '<tr><td colspan="3" class="investor-pdf-empty">Brak dodanych pomieszczeń.</td></tr>';
    }
    return rooms.map((room)=>{
      const base = normalizeText(room && room.baseType);
      const label = normalizeText(room && (room.label || room.name || room.id)) || '—';
      const statusKey = normalizeText(room && (room.projectStatus || room.status)).toLowerCase();
      const status = STATUS_LABELS[statusKey] || normalizeText(room && (room.projectStatus || room.status)) || 'Nowy';
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(base || '—')}</td><td>${escapeHtml(status)}</td></tr>`;
    }).join('');
  }

  function buildPrintHtml(investor){
    const inv = investor || {};
    const title = investorTitle(inv);
    const kind = investorKindLabel(inv);
    const addedDate = formatDate(inv.addedDate || inv.createdAt || '');
    const source = normalizeText(inv.source) || '—';
    const notes = normalizeText(inv.notes) || 'Brak dodatkowych informacji.';
    const ownerBlock = String(inv.kind || 'person') === 'company'
      ? row('Właściciel', inv.ownerName) + row('NIP', inv.nip)
      : '';
    const companyExtra = String(inv.kind || 'person') === 'company' ? '' : '';

    return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<title>Karta inwestora - ${escapeHtml(title)}</title>
<style>
  @page { size:A4; margin:12mm; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:Arial, Helvetica, sans-serif; color:#0f172a; background:#eef3f8; }
  .sheet{ background:#fff; border:1px solid #dbe5ef; border-radius:16px; padding:14mm 13mm 12mm; min-height:calc(297mm - 24mm); box-shadow:0 10px 30px rgba(15,23,42,.08); }
  .topbar{ display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .eyebrow{ font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#64748b; }
  .title{ margin:6px 0 0; font-size:28px; line-height:1.08; font-weight:900; }
  .subtitle{ margin:8px 0 0; font-size:13px; color:#475569; }
  .meta{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:16px; }
  .meta-card,.section{ border:1px solid #dbe5ef; border-radius:14px; padding:12px 14px; background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%); }
  .meta-card__label{ font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#64748b; }
  .meta-card__value{ margin-top:5px; font-size:16px; font-weight:800; }
  .grid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
  .section-title{ margin:0 0 10px; font-size:16px; font-weight:900; }
  .investor-pdf-row{ display:grid; grid-template-columns:138px minmax(0,1fr); gap:10px; padding:6px 0; border-bottom:1px solid rgba(219,229,239,.9); }
  .investor-pdf-row:last-child{ border-bottom:none; padding-bottom:0; }
  .investor-pdf-row__label{ font-size:12px; font-weight:800; color:#64748b; }
  .investor-pdf-row__value{ font-size:14px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
  .full{ margin-top:12px; }
  .notes{ white-space:pre-wrap; line-height:1.45; font-size:14px; }
  table{ width:100%; border-collapse:collapse; margin-top:6px; }
  th,td{ padding:10px 8px; border-bottom:1px solid #dbe5ef; text-align:left; vertical-align:top; font-size:13px; }
  th{ font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; }
  .investor-pdf-empty{ color:#64748b; font-style:italic; }
  .footer{ margin-top:12px; font-size:11px; color:#64748b; text-align:right; }
  @media print{
    body{ background:#fff; }
    .sheet{ border:none; border-radius:0; box-shadow:none; min-height:auto; padding:0; }
  }
</style>
</head>
<body>
  <main class="sheet">
    <div class="topbar">
      <div>
        <div class="eyebrow">Karta inwestora</div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="subtitle">Pierwsza strona do segregatora - dane organizacyjne projektu.</p>
      </div>
    </div>

    <section class="meta">
      <div class="meta-card">
        <div class="meta-card__label">Typ</div>
        <div class="meta-card__value">${escapeHtml(kind)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card__label">Data dodania</div>
        <div class="meta-card__value">${escapeHtml(addedDate)}</div>
      </div>
    </section>

    <section class="grid">
      <div class="section">
        <h2 class="section-title">Dane podstawowe</h2>
        ${row(String(inv.kind || 'person') === 'company' ? 'Nazwa firmy' : 'Imię i nazwisko', String(inv.kind || 'person') === 'company' ? inv.companyName : inv.name)}
        ${ownerBlock}
        ${row('Telefon', inv.phone)}
        ${row('Email', inv.email)}
      </div>
      <div class="section">
        <h2 class="section-title">Adres i źródło</h2>
        ${row('Miejscowość', inv.city)}
        ${row('Adres', inv.address)}
        ${row('Źródło', source)}
      </div>
    </section>

    <section class="section full">
      <h2 class="section-title">Pomieszczenia</h2>
      <table>
        <thead>
          <tr>
            <th>Pomieszczenie</th>
            <th>Typ bazowy</th>
            <th>Status projektu</th>
          </tr>
        </thead>
        <tbody>${roomRows(inv)}</tbody>
      </table>
    </section>

    <section class="section full">
      <h2 class="section-title">Dodatkowe informacje</h2>
      <div class="notes">${escapeHtml(notes)}</div>
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

  function openInvestorCardPdf(investor){
    const inv = investor || {};
    if(!inv || !investorTitle(inv)){
      try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak danych inwestora', message:'Najpierw otwórz inwestora, którego chcesz wydrukować.' }); }catch(_){ }
      return false;
    }
    return openPrintView(buildPrintHtml(inv));
  }

  FC.investorPdf = {
    buildPrintHtml,
    openInvestorCardPdf,
  };
})();
