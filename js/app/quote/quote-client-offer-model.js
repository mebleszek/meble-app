// js/app/quote/quote-client-offer-model.js
// Zamrożony model oferty klienta: jedno źródło prawdy dla podglądu i przyszłego PDF.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const MODEL_VERSION = 1;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){ const n = Number(value); return Number.isFinite(n) ? n : (fallback || 0); }
  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ try{ return JSON.parse(JSON.stringify(value || null)); }catch(__){ return value == null ? null : value; } }
  }
  function normalizeKey(value){
    return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  }
  function addUnique(list, value){
    const v = text(value);
    if(!v) return;
    if(!Array.isArray(list)) return;
    if(!list.some((item)=> normalizeKey(item) === normalizeKey(v))) list.push(v);
  }
  function safeArray(value){ return Array.isArray(value) ? value : []; }
  function normalizeTextList(value){
    return safeArray(value).map(text).filter(Boolean).filter((item, index, arr)=> arr.findIndex((other)=> normalizeKey(other) === normalizeKey(item)) === index);
  }
  function currentProjectData(){
    try{ if(typeof projectData !== 'undefined' && projectData) return projectData; }catch(_){ }
    try{ if(window.projectData) return window.projectData; }catch(_){ }
    try{ const rec = FC.projectStore && typeof FC.projectStore.getCurrentRecord === 'function' ? FC.projectStore.getCurrentRecord() : null; if(rec && rec.projectData) return rec.projectData; }catch(_){ }
    return {};
  }
  function currentCompany(){
    try{ if(FC.companyProfile && typeof FC.companyProfile.read === 'function') return (FC.companyProfile.read() || {}).company || {}; }catch(_){ }
    return {};
  }
  function currentInvestorById(id){
    const key = text(id);
    try{ if(key && FC.investors && typeof FC.investors.getById === 'function') return FC.investors.getById(key) || null; }catch(_){ }
    try{ if(FC.investors && typeof FC.investors.getCurrent === 'function') return FC.investors.getCurrent() || null; }catch(_){ }
    try{ if(FC.investors && typeof FC.investors.getCurrentId === 'function' && typeof FC.investors.getById === 'function') return FC.investors.getById(FC.investors.getCurrentId()) || null; }catch(_){ }
    return null;
  }
  function roomLabel(roomId, index, snapshot){
    const scope = snapshot && snapshot.scope || {};
    const labels = safeArray(scope.roomLabels).map(text);
    const explicit = text(labels[index]);
    if(explicit) return explicit;
    const id = text(roomId);
    try{ if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function') return text(FC.roomRegistry.getRoomLabel(id)) || id; }catch(_){ }
    return id;
  }
  function scopeRoomLabels(snapshot){
    const scope = snapshot && snapshot.scope || {};
    const ids = safeArray(scope.selectedRooms).map(text).filter(Boolean);
    if(ids.length) return ids.map((roomId, index)=> roomLabel(roomId, index, snapshot)).filter(Boolean);
    return safeArray(scope.roomLabels).map(text).filter(Boolean);
  }
  function scopeModeLabel(snapshot){
    const mode = text(snapshot && snapshot.scope && snapshot.scope.materialScopeMode).toLowerCase();
    if(mode === 'fronts') return 'Same fronty';
    if(mode === 'corpus') return 'Same korpusy';
    return 'Korpusy + fronty';
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
    { key:'lower', title:'Strefa dolna / stojąca', empty:'Brak szafek stojących w zakresie tej oferty.' },
    { key:'middle', title:'Strefa środkowa', empty:'Brak modułów środkowych w zakresie tej oferty.' },
    { key:'upper', title:'Strefa górna / wisząca', empty:'Brak szafek wiszących w zakresie tej oferty.' },
  ];
  function makeZoneBucket(meta){
    return { key:meta.key, title:meta.title, empty:meta.empty, count:0, bodyColors:[], frontMaterials:[], frontColors:[], backMaterials:[], pcvModes:[], openingSystems:[], cabinetTypes:[] };
  }
  function cabinetName(cab, index){
    const numberLabel = Number(cab && cab.number) || Number(cab && cab.cabinetNumber) || (index + 1);
    const type = text(cab && cab.type) || 'szafka';
    const sub = text(cab && cab.subType || cab.variant || cab.subTypeOption);
    const dims = [num(cab && cab.width, 0), num(cab && cab.height, 0), num(cab && cab.depth, 0)].filter((v)=> v > 0).map((v)=> `${v}`).join('×');
    return [`#${numberLabel}`, type, sub, dims ? `${dims} cm` : ''].filter(Boolean).join(' • ');
  }
  function collectZoneData(snapshot, options){
    const opts = options && typeof options === 'object' ? options : {};
    const selected = safeArray(snapshot && snapshot.scope && snapshot.scope.selectedRooms).map(text).filter(Boolean);
    const data = opts.projectData || currentProjectData();
    const buckets = new Map(ZONES.map((meta)=> [meta.key, makeZoneBucket(meta)]));
    selected.forEach((roomId)=>{
      const room = data && data[roomId] || null;
      const cabinets = safeArray(room && room.cabinets);
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
  function aggregateLines(rows, fallbackUnit){
    const map = new Map();
    safeArray(rows).forEach((row)=>{
      const name = text(row && row.name);
      if(!name) return;
      const unit = text(row && row.unit) || fallbackUnit || 'szt.';
      const key = normalizeKey(name) + '|' + normalizeKey(unit);
      if(!map.has(key)) map.set(key, { name, unit, qty:0, note:text(row && row.note), subsection:text(row && (row.subsection || row.category)) });
      const out = map.get(key);
      out.qty += num(row && row.qty, 0);
      if(!out.note && text(row && row.note)) out.note = text(row.note);
      if(!out.subsection && text(row && (row.subsection || row.category))) out.subsection = text(row.subsection || row.category);
    });
    return Array.from(map.values()).sort((a,b)=> text(a.subsection).localeCompare(text(b.subsection), 'pl') || text(a.name).localeCompare(text(b.name), 'pl'));
  }
  function materialRowsForClient(snapshot){
    const rows = safeArray(snapshot && snapshot.lines && snapshot.lines.materials);
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
  function hasTransportLine(snapshot){
    return safeArray(snapshot && snapshot.lines && snapshot.lines.quoteRates).some((row)=>{
      return text(row && row.sourceRole) === 'transport-distance'
        || text(row && row.sourceType) === 'transport'
        || text(row && row.quantitySource) === 'transport.distance_km'
        || text(row && row.sourceId) === 'transport_distance_km';
    });
  }
  function formatAddress(entity){
    const src = entity && typeof entity === 'object' ? entity : {};
    const line = [text(src.address), text(src.postalCode || src.zip), text(src.city)].filter(Boolean).join(', ');
    return line || text(src.fullAddress || src.displayAddress || '');
  }
  function normalizeCompany(company){
    const src = company && typeof company === 'object' ? company : {};
    return {
      displayName:text(src.displayName || src.name || src.legalName),
      legalName:text(src.legalName || src.companyName || src.name),
      address:formatAddress(src),
      phone:text(src.phone),
      email:text(src.email),
      nip:text(src.nip || src.taxId),
    };
  }
  function normalizeClient(investor){
    const src = investor && typeof investor === 'object' ? investor : {};
    return {
      id:text(src.id),
      name:text(src.companyName || src.name) || '—',
      address:formatAddress(src),
      phone:text(src.phone),
      email:text(src.email),
      kind:text(src.kind),
    };
  }
  function normalizeCommercial(src){
    const value = src && typeof src === 'object' ? src : {};
    return {
      versionName:text(value.versionName),
      preliminary:!!value.preliminary,
      offerValidity:text(value.offerValidity),
      leadTime:text(value.leadTime),
      deliveryTerms:text(value.deliveryTerms),
      customerNote:text(value.customerNote),
    };
  }
  function defaultIncludes(snapshot, agdRows){
    const lines = snapshot && snapshot.lines || {};
    const out = [
      'wykonanie zabudowy meblowej według ustalonego projektu',
      'zastosowane materiały, kolory, okucia i akcesoria zgodnie ze specyfikacją oferty',
    ];
    if(hasTransportLine(snapshot)) out.push('transport i logistyka zgodnie z warunkami tej wyceny');
    if(safeArray(lines.labor).length || safeArray(lines.quoteRates).length) out.push('montaż i usługi ujęte w wycenie');
    if(safeArray(agdRows).length) out.push('montaż przewidzianych elementów AGD wskazanych w ofercie');
    return out;
  }
  function defaultHiddenDetails(){
    return [
      'szczegółowy kosztorys operacyjny',
      'stawki godzinowe, roboczogodziny i wewnętrzne narzuty',
      'kilometry, arkusze, metry PCV i ceny jednostkowe pozycji zakupowych',
    ];
  }
  function buildFromSnapshot(snapshot, options){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const opts = options && typeof options === 'object' ? options : {};
    const rawInvestor = opts.investor || currentInvestorById(snap.investor && snap.investor.id) || snap.investor || {};
    const company = normalizeCompany(opts.company || currentCompany());
    const client = normalizeClient(rawInvestor);
    const project = snap.project && typeof snap.project === 'object' ? snap.project : (opts.projectRecord || {});
    const commercial = normalizeCommercial(snap.commercial || {});
    const roomLabels = scopeRoomLabels(snap);
    const title = text(project && project.title) || text(commercial.versionName) || text(client.name) || 'Oferta meblowa';
    const agd = aggregateLines(snap.lines && snap.lines.agdServices, 'szt.');
    const includes = normalizeTextList((snap.clientOffer && snap.clientOffer.sections && snap.clientOffer.sections.includes) || (opts.sections && opts.sections.includes));
    const hiddenDetails = normalizeTextList((snap.clientOffer && snap.clientOffer.sections && snap.clientOffer.sections.hiddenDetails) || (opts.sections && opts.sections.hiddenDetails));
    return normalize({
      version:MODEL_VERSION,
      builtAt:Number(snap.generatedAt) > 0 ? Number(snap.generatedAt) : Date.now(),
      generatedAt:Number(snap.generatedAt) > 0 ? Number(snap.generatedAt) : 0,
      title,
      company,
      client,
      project:{ id:text(project && project.id), investorId:text(project && project.investorId), title:text(project && project.title), status:text(project && project.status) },
      scope:{
        roomLabels,
        scopeLabel:scopeModeLabel(snap),
        materialScopeMode:text(snap.scope && snap.scope.materialScopeMode) || 'both',
      },
      commercial,
      totals:{ grand:Math.max(0, num(snap.totals && snap.totals.grand, 0)) },
      zones:collectZoneData(snap, opts),
      materials:materialRowsForClient(snap),
      accessories:aggregateLines(snap.lines && snap.lines.accessories, 'szt.'),
      agd,
      sections:{
        includes: includes.length ? includes : defaultIncludes(snap, agd),
        terms: normalizeTextList([commercial.deliveryTerms, commercial.customerNote]),
        hiddenDetails: hiddenDetails.length ? hiddenDetails : defaultHiddenDetails(),
      },
      meta:{
        source:'snapshot.clientOffer',
        frozen:true,
        snapshotId:text(snap.id),
        projectId:text(project && project.id),
        investorId:text(client.id || snap.investor && snap.investor.id),
      },
    });
  }
  function normalizeZone(zone){
    const src = zone && typeof zone === 'object' ? zone : {};
    const key = text(src.key) || 'lower';
    const meta = ZONES.find((item)=> item.key === key) || ZONES[0];
    return {
      key,
      title:text(src.title) || meta.title,
      empty:text(src.empty) || meta.empty,
      count:Math.max(0, num(src.count, 0)),
      bodyColors:normalizeTextList(src.bodyColors),
      frontMaterials:normalizeTextList(src.frontMaterials),
      frontColors:normalizeTextList(src.frontColors),
      backMaterials:normalizeTextList(src.backMaterials),
      pcvModes:normalizeTextList(src.pcvModes),
      openingSystems:normalizeTextList(src.openingSystems),
      cabinetTypes:normalizeTextList(src.cabinetTypes),
    };
  }
  function normalizeLine(row){
    const src = row && typeof row === 'object' ? row : {};
    return { name:text(src.name), unit:text(src.unit), qty:Math.max(0, num(src.qty, 0)), subsection:text(src.subsection), note:text(src.note) };
  }
  function normalizeMaterials(rows){
    const seen = new Set();
    return safeArray(rows).map(normalizeLine).filter((row)=>{
      if(!row.name) return false;
      const key = normalizeKey(row.name);
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function normalize(model){
    const src = model && typeof model === 'object' ? model : null;
    if(!src) return null;
    const commercial = normalizeCommercial(src.commercial || {});
    const company = normalizeCompany(src.company || {});
    const client = normalizeClient(src.client || src.investor || {});
    const scope = src.scope && typeof src.scope === 'object' ? src.scope : {};
    const sections = src.sections && typeof src.sections === 'object' ? src.sections : {};
    const zones = safeArray(src.zones).map(normalizeZone);
    const zoneMap = new Map(zones.map((zone)=> [zone.key, zone]));
    return {
      version:Math.max(1, Math.round(num(src.version, MODEL_VERSION))),
      builtAt:Number(src.builtAt) > 0 ? Number(src.builtAt) : Date.now(),
      generatedAt:Number(src.generatedAt) > 0 ? Number(src.generatedAt) : 0,
      title:text(src.title) || text(src.project && src.project.title) || text(commercial.versionName) || 'Oferta meblowa',
      company,
      client,
      project:{
        id:text(src.project && src.project.id),
        investorId:text(src.project && src.project.investorId),
        title:text(src.project && src.project.title),
        status:text(src.project && src.project.status),
      },
      scope:{
        roomLabels:normalizeTextList(scope.roomLabels),
        scopeLabel:text(scope.scopeLabel) || 'Korpusy + fronty',
        materialScopeMode:text(scope.materialScopeMode) || 'both',
      },
      commercial,
      totals:{ grand:Math.max(0, num(src.totals && src.totals.grand, src.grand || 0)) },
      zones:ZONES.map((meta)=> zoneMap.get(meta.key) || makeZoneBucket(meta)),
      materials:normalizeMaterials(src.materials),
      accessories:safeArray(src.accessories).map(normalizeLine).filter((row)=> row.name),
      agd:safeArray(src.agd).map(normalizeLine).filter((row)=> row.name),
      sections:{
        includes:normalizeTextList(sections.includes),
        terms:normalizeTextList(sections.terms),
        hiddenDetails:normalizeTextList(sections.hiddenDetails),
      },
      meta:Object.assign({ source:'snapshot.clientOffer', frozen:true }, clone(src.meta || {}) || {}),
    };
  }
  function resolve(snapshot, options){
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    if(snap.clientOffer) return normalize(snap.clientOffer);
    return buildFromSnapshot(snap, options);
  }

  FC.quoteClientOfferModel = {
    MODEL_VERSION,
    normalize,
    resolve,
    buildFromSnapshot,
    collectZoneData,
    aggregateLines,
    materialRowsForClient,
  };
})();
