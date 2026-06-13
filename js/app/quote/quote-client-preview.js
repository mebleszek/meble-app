// js/app/quote/quote-client-preview.js
// Podgląd handlowej oferty dla klienta: zakres, materiały, okucia i cena końcowa bez kosztorysu operacyjnego.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function money(value){ return `${(Number(value)||0).toFixed(2)} PLN`; }
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch)=> ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch] || ch));
  }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=>{
      const value = attrs[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(value !== false && value != null) el.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : []).forEach((child)=> child && el.appendChild(child));
    return el;
  }
  function normalizeSnapshot(snapshot){
    if(snapshot && snapshot.lines && snapshot.totals) return snapshot;
    try{ if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(snapshot || {}); }catch(_){ }
    return snapshot || null;
  }
  function formatDate(value){
    const ts = Number(value) > 0 ? Number(value) : Date.parse(String(value || ''));
    if(!Number.isFinite(ts) || ts <= 0) return '—';
    try{
      const d = new Date(ts);
      const pad = (n)=> String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
    }catch(_){ return '—'; }
  }
  function getCompany(){
    try{ if(FC.companyProfile && typeof FC.companyProfile.read === 'function') return FC.companyProfile.read().company || {}; }catch(_){ }
    return {};
  }
  function getCurrentInvestor(snapshot){
    const snap = snapshot || {};
    const snapInv = snap.investor || null;
    const id = text(snapInv && snapInv.id);
    try{ if(id && FC.investors && typeof FC.investors.getById === 'function') return FC.investors.getById(id) || snapInv || {}; }catch(_){ }
    try{ if(FC.investors && typeof FC.investors.getCurrent === 'function') return FC.investors.getCurrent() || snapInv || {}; }catch(_){ }
    try{ if(FC.investors && typeof FC.investors.getCurrentId === 'function' && typeof FC.investors.getById === 'function') return FC.investors.getById(FC.investors.getCurrentId()) || snapInv || {}; }catch(_){ }
    return snapInv || {};
  }
  function getProjectData(){
    try{ if(typeof projectData !== 'undefined' && projectData) return projectData; }catch(_){ }
    try{ if(window.projectData) return window.projectData; }catch(_){ }
    try{ const rec = FC.projectStore && typeof FC.projectStore.getCurrentRecord === 'function' ? FC.projectStore.getCurrentRecord() : null; if(rec && rec.projectData) return rec.projectData; }catch(_){ }
    return {};
  }
  function roomLabel(roomId){
    const id = text(roomId);
    try{ if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function') return text(FC.roomRegistry.getRoomLabel(id)) || id; }catch(_){ }
    return id;
  }
  function scopeRoomLabels(snapshot){
    try{ if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.getScopeRoomLabels === 'function') return FC.quoteSnapshotStore.getScopeRoomLabels(snapshot) || []; }catch(_){ }
    const scope = snapshot && snapshot.scope || {};
    if(Array.isArray(scope.roomLabels) && scope.roomLabels.length) return scope.roomLabels.map(text).filter(Boolean);
    return (Array.isArray(scope.selectedRooms) ? scope.selectedRooms : []).map(roomLabel).filter(Boolean);
  }
  function scopeModeLabel(snapshot){
    const mode = text(snapshot && snapshot.scope && snapshot.scope.materialScopeMode).toLowerCase();
    if(mode === 'fronts') return 'Same fronty';
    if(mode === 'corpus') return 'Same korpusy';
    return 'Korpusy + fronty';
  }
  function normalizeKey(value){
    return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  }
  function addUnique(list, value){
    const v = text(value);
    if(!v) return;
    if(!list.some((item)=> normalizeKey(item) === normalizeKey(v))) list.push(v);
  }
  function pcvModeLabel(mode){
    try{ if(FC.materialEdgeStore && typeof FC.materialEdgeStore.pcvModeLabel === 'function') return FC.materialEdgeStore.pcvModeLabel(mode); }catch(_){ }
    return text(mode).toLowerCase().indexOf('front') !== -1 ? 'pod kolor frontów' : 'pod kolor płyty';
  }
  function cabinetZone(cab){
    const type = normalizeKey(cab && cab.type);
    const role = normalizeKey(cab && cab.setRole);
    if(type.indexOf('wis') !== -1 || role.indexOf('gorn') !== -1 || role.indexOf('górn') !== -1 || role.indexOf('upper') !== -1) return 'upper';
    if(type.indexOf('modul') !== -1 || type.indexOf('moduł') !== -1 || type.indexOf('modu') !== -1 || role.indexOf('srodk') !== -1 || role.indexOf('środk') !== -1 || role.indexOf('middle') !== -1) return 'middle';
    return 'lower';
  }
  const ZONES = [
    { key:'lower', title:'Strefa dolna / stojąca', empty:'Brak szafek stojących w aktualnym zakresie.' },
    { key:'middle', title:'Strefa środkowa', empty:'Brak modułów środkowych w aktualnym zakresie.' },
    { key:'upper', title:'Strefa górna / wisząca', empty:'Brak szafek wiszących w aktualnym zakresie.' },
  ];
  function makeZoneBucket(meta){
    return { key:meta.key, title:meta.title, empty:meta.empty, count:0, bodyColors:[], frontMaterials:[], frontColors:[], backMaterials:[], pcvModes:[], openingSystems:[], cabinetTypes:[] };
  }
  function cabinetName(cab, index){
    const num = Number(cab && cab.number) || Number(cab && cab.cabinetNumber) || (index + 1);
    const type = text(cab && cab.type) || 'szafka';
    const sub = text(cab && cab.subType || cab.variant || cab.subTypeOption);
    const dims = [Number(cab && cab.width)||0, Number(cab && cab.height)||0, Number(cab && cab.depth)||0].filter((v)=> v > 0).map((v)=> `${v}`).join('×');
    return [`#${num}`, type, sub, dims ? `${dims} cm` : ''].filter(Boolean).join(' • ');
  }
  function collectZoneData(snapshot){
    const selected = snapshot && snapshot.scope && Array.isArray(snapshot.scope.selectedRooms) ? snapshot.scope.selectedRooms.map(text).filter(Boolean) : [];
    const data = getProjectData();
    const buckets = new Map(ZONES.map((meta)=> [meta.key, makeZoneBucket(meta)]));
    selected.forEach((roomId)=>{
      const room = data && data[roomId] || null;
      const cabinets = Array.isArray(room && room.cabinets) ? room.cabinets : [];
      cabinets.forEach((cab, index)=>{
        const key = cabinetZone(cab);
        const b = buckets.get(key) || buckets.get('lower');
        b.count += 1;
        addUnique(b.bodyColors, cab && cab.bodyColor);
        addUnique(b.frontMaterials, cab && cab.frontMaterial);
        addUnique(b.frontColors, cab && cab.frontColor);
        addUnique(b.backMaterials, cab && cab.backMaterial);
        addUnique(b.pcvModes, pcvModeLabel(cab && (cab.bodyPcvMode || cab.pcvMode || cab.edgeColorMode)));
        addUnique(b.openingSystems, cab && cab.openingSystem);
        addUnique(b.cabinetTypes, cabinetName(cab, index));
      });
    });
    return ZONES.map((meta)=> buckets.get(meta.key) || makeZoneBucket(meta));
  }
  function formatQty(row, fallbackUnit){
    const qty = Number(row && row.qty) || 0;
    const rounded = Math.round(qty * 1000) / 1000;
    const unit = text(row && row.unit) || fallbackUnit || 'szt.';
    return `${rounded}${unit ? ' ' + unit : ''}`;
  }
  function aggregateLines(rows, fallbackUnit){
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row)=>{
      const name = text(row && row.name);
      if(!name) return;
      const unit = text(row && row.unit) || fallbackUnit || 'szt.';
      const key = normalizeKey(name) + '|' + normalizeKey(unit);
      if(!map.has(key)) map.set(key, { name, unit, qty:0, note:text(row && row.note), subsection:text(row && row.subsection || row.category) });
      const out = map.get(key);
      out.qty += Number(row && row.qty) || 0;
      if(!out.note && text(row && row.note)) out.note = text(row.note);
      if(!out.subsection && text(row && row.subsection || row.category)) out.subsection = text(row.subsection || row.category);
    });
    return Array.from(map.values()).sort((a,b)=> text(a.subsection).localeCompare(text(b.subsection), 'pl') || text(a.name).localeCompare(text(b.name), 'pl'));
  }
  function materialRowsForClient(snapshot){
    const rows = Array.isArray(snapshot && snapshot.lines && snapshot.lines.materials) ? snapshot.lines.materials : [];
    const seen = new Set();
    return rows.filter((row)=>{
      const name = text(row && row.name);
      if(!name) return false;
      const key = normalizeKey(name);
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((row)=> ({ name:text(row.name), subsection:text(row.subsection), note:text(row.note) }));
  }
  function buildSummaryData(snapshot){
    const snap = normalizeSnapshot(snapshot);
    const company = getCompany();
    const investor = getCurrentInvestor(snap);
    const project = snap && snap.project || {};
    const commercial = snap && snap.commercial || {};
    const roomLabels = scopeRoomLabels(snap);
    const title = text(project && project.title) || text(commercial && commercial.versionName) || text(investor && (investor.companyName || investor.name)) || 'Oferta meblowa';
    const clientName = text(investor && (investor.companyName || investor.name)) || text(snap && snap.investor && (snap.investor.companyName || snap.investor.name)) || '—';
    const clientAddress = [text(investor && investor.address), text(investor && investor.city)].filter(Boolean).join(', ');
    return {
      snapshot:snap,
      company,
      investor,
      project,
      commercial,
      title,
      clientName,
      clientAddress,
      roomLabels,
      scopeLabel:scopeModeLabel(snap),
      generatedAt:snap && snap.generatedAt,
      grand:Number(snap && snap.totals && snap.totals.grand) || 0,
      zones:collectZoneData(snap),
      materials:materialRowsForClient(snap),
      accessories:aggregateLines(snap && snap.lines && snap.lines.accessories, 'szt.'),
      agd:aggregateLines(snap && snap.lines && snap.lines.agdServices, 'szt.'),
    };
  }
  function appendInfoGrid(parent, rows){
    const grid = h('div', { class:'client-offer-info-grid' });
    rows.forEach((row)=>{
      const value = text(row && row.value);
      if(!value) return;
      const item = h('div', { class:'client-offer-info' });
      item.appendChild(h('div', { class:'client-offer-info__label', text:row.label }));
      item.appendChild(h('div', { class:'client-offer-info__value', text:value }));
      grid.appendChild(item);
    });
    if(grid.childNodes.length) parent.appendChild(grid);
  }
  function appendScopeList(parent, data){
    const section = h('section', { class:'client-offer-section' });
    section.appendChild(h('h4', { text:'Zakres oferty' }));
    const list = h('ul', { class:'client-offer-bullets' });
    [
      'wykonanie zabudowy meblowej według ustalonego projektu',
      'zastosowane materiały, kolory, okucia i akcesoria zgodnie z poniższą specyfikacją',
      'standardowy transport pod wskazany adres',
      'standardowe wniesienie i montaż mebli',
      data.agd.length ? 'montaż przewidzianych elementów AGD wskazanych w ofercie' : '',
    ].filter(Boolean).forEach((item)=> list.appendChild(h('li', { text:item })));
    section.appendChild(list);
    section.appendChild(h('p', { class:'client-offer-note', text:'Szczegółowy kosztorys operacyjny, stawki, kilometry, arkusze i metry PCV pozostają w wewnętrznej WYCENIE programu.' }));
    parent.appendChild(section);
  }
  function lineText(label, values, fallback){
    const list = Array.isArray(values) ? values.map(text).filter(Boolean) : [];
    return `${label}: ${list.length ? list.join(', ') : (fallback || '—')}`;
  }
  function appendZones(parent, zones){
    const section = h('section', { class:'client-offer-section' });
    section.appendChild(h('h4', { text:'Strefy zabudowy / materiały' }));
    const wrap = h('div', { class:'client-offer-zones' });
    zones.forEach((zone)=>{
      const card = h('article', { class:'client-offer-zone' });
      card.appendChild(h('div', { class:'client-offer-zone__title', text:zone.title }));
      if(!zone.count){
        card.appendChild(h('div', { class:'client-offer-empty', text:zone.empty }));
      }else{
        card.appendChild(h('div', { class:'client-offer-zone__count', text:`Liczba szafek/modułów: ${zone.count}` }));
        const facts = h('div', { class:'client-offer-zone__facts' });
        [
          lineText('Korpusy', zone.bodyColors),
          lineText('Fronty — materiał', zone.frontMaterials),
          lineText('Fronty — kolor', zone.frontColors),
          lineText('PCV korpusu', zone.pcvModes),
          lineText('Plecy', zone.backMaterials),
          lineText('Otwieranie', zone.openingSystems),
        ].forEach((txt)=> facts.appendChild(h('div', { class:'client-offer-zone__fact', text:txt })));
        card.appendChild(facts);
      }
      wrap.appendChild(card);
    });
    section.appendChild(wrap);
    parent.appendChild(section);
  }
  function appendSimpleRows(parent, title, rows, emptyText, options){
    const opts = options || {};
    const section = h('section', { class:'client-offer-section' });
    section.appendChild(h('h4', { text:title }));
    if(!Array.isArray(rows) || !rows.length){
      section.appendChild(h('div', { class:'client-offer-empty', text:emptyText || 'Brak pozycji.' }));
      parent.appendChild(section);
      return;
    }
    const list = h('div', { class:'client-offer-lines' });
    rows.forEach((row)=>{
      const item = h('div', { class:'client-offer-line' });
      item.appendChild(h('div', { class:'client-offer-line__name', text:text(row && row.name) || 'Pozycja' }));
      if(opts.showQty !== false) item.appendChild(h('div', { class:'client-offer-line__qty', text:formatQty(row, opts.unit || 'szt.') }));
      const meta = text(row && (row.subsection || row.note));
      if(meta) item.appendChild(h('div', { class:'client-offer-line__meta', text:meta }));
      list.appendChild(item);
    });
    section.appendChild(list);
    parent.appendChild(section);
  }
  function renderBody(data){
    const body = h('div', { class:'client-offer-preview' });
    const hero = h('section', { class:'client-offer-hero' });
    const main = h('div', { class:'client-offer-hero__main' });
    main.appendChild(h('div', { class:'client-offer-eyebrow', text:'Podgląd oferty dla klienta' }));
    main.appendChild(h('h3', { text:data.title }));
    main.appendChild(h('p', { text:'Klient widzi zakres, materiały, okucia i jedną cenę końcową. Kosztorys operacyjny zostaje tylko w WYCENIE.' }));
    const total = h('div', { class:'client-offer-hero__total' });
    total.appendChild(h('div', { class:'client-offer-total__label', text:'Cena końcowa' }));
    total.appendChild(h('div', { class:'client-offer-total__value', text:money(data.grand) }));
    total.appendChild(h('div', { class:'client-offer-total__meta', text:`Data: ${formatDate(data.generatedAt)} • Zakres: ${data.scopeLabel}` }));
    hero.appendChild(main);
    hero.appendChild(total);
    body.appendChild(hero);
    const companyName = text(data.company.displayName || data.company.legalName);
    const companyContact = [text(data.company.phone), text(data.company.email)].filter(Boolean).join(' • ');
    appendInfoGrid(body, [
      { label:'Klient', value:data.clientName },
      { label:'Adres', value:data.clientAddress },
      { label:'Pomieszczenia', value:data.roomLabels.join(', ') },
      { label:'Firma', value:companyName },
      { label:'Kontakt', value:companyContact },
      { label:'Wersja', value:text(data.commercial.versionName) },
      { label:'Ważność', value:text(data.commercial.offerValidity) },
      { label:'Termin', value:text(data.commercial.leadTime) },
    ]);
    appendScopeList(body, data);
    appendZones(body, data.zones);
    appendSimpleRows(body, 'Materiały / kolory z WYCENY', data.materials, 'Brak linii materiałowych w aktualnej wycenie.', { showQty:false });
    appendSimpleRows(body, 'Okucia i akcesoria', data.accessories, 'Brak akcesoriów w aktualnej wycenie.', { unit:'szt.' });
    appendSimpleRows(body, 'Montaż AGD w zakresie', data.agd, 'Brak montażu AGD w aktualnej wycenie.', { unit:'szt.' });
    const final = h('section', { class:'client-offer-section client-offer-final' });
    final.appendChild(h('div', { class:'client-offer-final__label', text:'Razem do przedstawienia klientowi' }));
    final.appendChild(h('div', { class:'client-offer-final__value', text:money(data.grand) }));
    final.appendChild(h('p', { text:'Bez rozbijania kwotowego transportu, wniesienia, robocizny, arkuszy, PCV i cen jednostkowych okuć.' }));
    body.appendChild(final);
    return body;
  }
  let overlay = null;
  function close(){
    if(!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    try{ document.removeEventListener('keydown', onKeydown, true); }catch(_){ }
  }
  function onKeydown(event){
    if(event && event.key === 'Escape') close();
  }
  function ensureModal(){
    if(overlay) return overlay;
    overlay = h('div', { id:'quoteClientOfferPreviewModal', class:'modal-back client-offer-modal-back', role:'dialog', 'aria-modal':'true', 'aria-hidden':'true', style:'display:none' });
    const modal = h('div', { class:'modal client-offer-modal' });
    const head = h('div', { class:'header client-offer-modal__header' });
    const titleWrap = h('div', { class:'client-offer-modal__titleWrap' });
    titleWrap.appendChild(h('h3', { id:'quoteClientOfferPreviewTitle', text:'Oferta dla klienta' }));
    titleWrap.appendChild(h('p', { class:'muted', text:'Podgląd handlowy bez kosztorysu operacyjnego. PDF zostaje do dopracowania na końcu programu.' }));
    const closeWrap = h('div', { class:'client-offer-modal__closeWrap' });
    const closeBtn = h('button', { class:'btn-primary', type:'button', text:'Zamknij' });
    closeBtn.addEventListener('click', close);
    closeWrap.appendChild(closeBtn);
    head.appendChild(titleWrap);
    head.appendChild(closeWrap);
    const body = h('div', { id:'quoteClientOfferPreviewBody', class:'body client-offer-modal__body' });
    const foot = h('div', { class:'client-offer-modal__footer' });
    foot.appendChild(h('span', { class:'muted', text:'Ten widok pokazuje klientowi zakres i cenę, a nie Twoją wewnętrzną matematykę.' }));
    modal.appendChild(head);
    modal.appendChild(body);
    modal.appendChild(foot);
    overlay.appendChild(modal);
    overlay.addEventListener('click', (event)=>{ if(event && event.target === overlay) close(); });
    document.body.appendChild(overlay);
    return overlay;
  }
  function open(snapshot){
    const snap = normalizeSnapshot(snapshot);
    if(!snap || !snap.lines || !snap.totals){
      try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak wyceny', message:'Najpierw wygeneruj WYCENĘ, żeby pokazać ofertę dla klienta.', okOnly:true }); }catch(_){ }
      return false;
    }
    const modal = ensureModal();
    const body = document.getElementById('quoteClientOfferPreviewBody');
    if(body){
      body.innerHTML = '';
      body.appendChild(renderBody(buildSummaryData(snap)));
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    try{ document.addEventListener('keydown', onKeydown, true); }catch(_){ }
    try{ modal.querySelector('button') && modal.querySelector('button').focus(); }catch(_){ }
    return true;
  }

  FC.quoteClientPreview = {
    open,
    close,
    buildSummaryData,
    collectZoneData,
    aggregateLines,
  };
})();
