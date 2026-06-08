// js/app/cabinet/cabinet-work-facts-preview.js
// Read-only preview of named work/quote data sources for the cabinet modal.
// It does not write a second copy of cabinet data; all values are read/calculated from the current draft.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : (fallback || 0);
  }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }
  function cm(value){
    const n = Math.max(0, num(value, 0));
    // Aktualny WYWIAD trzyma wymiary w cm. Zabezpieczenie zostaje na wypadek przyszłych mm.
    return n > 1000 ? n / 10 : n;
  }
  function mmFromCmLike(value){ return Math.round(cm(value) * 10); }
  function round(value, decimals){
    const d = Math.max(0, Number(decimals) || 0);
    const factor = Math.pow(10, d);
    return Math.round((Number(value) || 0) * factor) / factor;
  }
  function formatNumber(value, decimals){
    const n = Number(value);
    if(!Number.isFinite(n)) return '';
    const fixed = (decimals != null) ? n.toFixed(decimals) : String(round(n, 2));
    return fixed.replace('.', ',').replace(/,0+$/, '').replace(/,(\d*[1-9])0+$/, ',$1');
  }
  function sourceMeta(code){
    try{
      const api = FC.workQuantitySources || null;
      return api && typeof api.find === 'function' ? api.find(code) : null;
    }catch(_){ return null; }
  }
  function makeFact(code, value, options){
    const opts = options && typeof options === 'object' ? options : {};
    const meta = sourceMeta(code) || {};
    const isEmpty = value == null || value === '';
    return {
      code,
      label:text(opts.label || meta.label || code),
      value:isEmpty ? '' : value,
      displayValue:text(opts.displayValue || (isEmpty ? '—' : String(value))),
      unit:text(opts.unit || meta.unit || ''),
      group:text(opts.group || meta.group || 'Inne'),
      status:text(opts.status || meta.status || 'system'),
      calculation:text(opts.calculation || meta.calculation || ''),
      source:text(opts.source || ''),
      available:opts.available === false ? false : !isEmpty,
      note:text(opts.note || '')
    };
  }
  function formatQty(value, unit){
    const n = Math.max(0, num(value, 0));
    return formatNumber(n, Number.isInteger(n) ? 0 : 2) + (unit ? ' ' + unit : '');
  }
  function cabinetKind(cab){
    const type = text(cab && cab.type);
    const sub = text(cab && cab.subType);
    return [type, sub].filter(Boolean).join(' / ') || '—';
  }
  function cabinetZone(cab){
    const type = text(cab && cab.type);
    const sub = text(cab && cab.subType);
    if(type === 'stojąca' && sub === 'lodowkowa') return 'wysoka / stojąca';
    if(type === 'stojąca') return 'dolna / stojąca';
    if(type === 'wisząca') return 'górna / wisząca';
    if(type === 'moduł') return 'moduł';
    return type || '—';
  }
  function cabinetCount(cab){
    const type = text(cab && cab.type);
    return (type === 'stojąca' || type === 'wisząca' || type === 'moduł') ? 1 : 0;
  }
  function cabinetVolumeM3(cab){
    const w = cm(cab && cab.width);
    const h = cm(cab && cab.height);
    const d = cm(cab && cab.depth);
    return Math.max(0, (w / 100) * (h / 100) * (d / 100));
  }
  function getFrontParts(room, cab){
    // Safety fix: the modal preview must never call heavy material/front generators while
    // the user is opening or editing a cabinet. It is a read-only diagnostic view, not
    // the source of truth for MATERIAL/WYCENA. Use the current draft fields only.
    try{
      const fc = Math.max(0, Math.round(num(cab && cab.frontCount, 0)));
      if(!(fc > 0)) return [];
      const width = cm(cab && cab.width);
      const height = cm(cab && cab.height);
      const singleWidth = fc > 0 ? round(width / fc, 2) : width;
      return [{ name:'front', qty:fc, a:singleWidth, b:height, dims:formatNumber(singleWidth, 1) + ' × ' + formatNumber(height, 1) }];
    }catch(_){ }
    return [];
  }
  function frontQty(parts){
    return (Array.isArray(parts) ? parts : []).reduce((sum, part)=> sum + Math.max(0, Math.round(num(part && part.qty, 0))), 0);
  }
  function frontDimensions(parts){
    const rows = (Array.isArray(parts) ? parts : []).map((part)=> {
      const qty = Math.max(0, Math.round(num(part && part.qty, 0)));
      if(!(qty > 0)) return '';
      const dims = text(part && part.dims) || [part && part.a, part && part.b].map((v)=> formatNumber(num(v, 0), 1)).join(' × ');
      return qty + '× ' + dims + ' cm';
    }).filter(Boolean);
    return rows.join(', ');
  }
  function frontAreaM2(parts){
    return (Array.isArray(parts) ? parts : []).reduce((sum, part)=> {
      const qty = Math.max(0, Math.round(num(part && part.qty, 0)));
      const a = Math.max(0, num(part && part.a, 0));
      const b = Math.max(0, num(part && part.b, 0));
      return sum + (qty * a * b / 10000);
    }, 0);
  }
  function getHingeRequirements(room, cab){
    // Safety fix: do not call the full hardware-requirements engine from the preview
    // during modal open. The exact editable hinge requirements are already rendered in
    // their own panel above. This preview only mirrors lightweight facts from the draft.
    try{
      const direct = Math.max(0, Math.round(num(cab && (cab.hingeCount || cab.hingesCount), 0)));
      if(direct > 0) return [{ kind:'hinge', label:'Zawiasy z danych szafki', qty:direct }];
      const fc = Math.max(0, Math.round(num(cab && cab.frontCount, 0)));
      if(!(fc > 0)) return [];
      // Safe estimate for the preview only. WYCENA and the requirements panel keep using
      // the central hinge logic; this value is not stored and is not used for pricing.
      const estimated = fc * 2;
      return [{ kind:'hinge', label:'Podgląd szybki — dokładne wymaganie sprawdź w panelu zawiasów', qty:estimated }];
    }catch(_){ }
    return [];
  }
  function hingeQty(reqs){
    return (Array.isArray(reqs) ? reqs : []).reduce((sum, req)=> sum + Math.max(0, Math.round(num(req && req.qty, 0))), 0);
  }
  function hingeRequirementLabel(reqs){
    const rows = (Array.isArray(reqs) ? reqs : []).map((req)=> {
      const qty = Math.max(0, Math.round(num(req && req.qty, 0)));
      const label = text(req && (req.doorLabel ? req.doorLabel + ': ' : '')) + (text(req && req.label) || 'zawias');
      return qty > 0 ? label + ' — ' + qty + ' szt.' : label;
    }).filter(Boolean);
    return rows.join(', ');
  }
  function shelfCount(cab){
    const d = cab && cab.details && typeof cab.details === 'object' ? cab.details : {};
    const candidates = [d.shelves, d.shelfCount, cab && cab.shelves, cab && cab.shelfCount];
    for(let i=0; i<candidates.length; i += 1){
      const n = Math.max(0, Math.floor(num(candidates[i], 0)));
      if(n > 0) return n;
    }
    return 0;
  }
  function drawerLayoutCount(layout, legacy){
    const raw = text(layout);
    if(raw === '1_big') return 1;
    if(raw === '2_equal') return 2;
    if(raw === '5_equal') return 5;
    if(raw === '3_equal' || raw === '3_1_2_2') return 3;
    const n = Math.max(0, Math.floor(num(legacy, 0)));
    return n > 0 ? n : 0;
  }
  function drawerCount(cab){
    const d = cab && cab.details && typeof cab.details === 'object' ? cab.details : {};
    let total = 0;
    const type = text(cab && cab.type);
    const sub = text(cab && cab.subType);
    if((type === 'stojąca' || type === 'moduł') && sub === 'szuflady'){
      total += drawerLayoutCount(d.drawerLayout, d.drawerCount || d.drawers);
    }
    if(type === 'stojąca' && sub === 'zlewowa' && text(d.sinkFront || d.sinkOption) === 'szuflada') total += 1;
    if(type === 'stojąca' && sub === 'piekarnikowa' && text(d.ovenOption || 'szuflada_dol').indexOf('szuflada') !== -1) total += 1;
    const innerType = text(d.innerDrawerType || d.sinkInnerDrawerType || d.podInsideMode);
    const innerCount = Math.max(0, Math.floor(num(d.innerDrawerCount || d.sinkInnerDrawerCount || d.podInnerDrawerCount, 0)));
    if(innerType && innerType !== 'brak' && innerType !== 'polki' && innerCount > 0) total += innerCount;
    return total;
  }
  function applianceInfo(cab){
    try{
      const api = FC.laborApplianceRules || {};
      if(api && typeof api.getApplianceForCabinet === 'function'){
        const found = api.getApplianceForCabinet(clone(cab));
        if(found) return { count:1, type:text(found.label || found.type || found.code) };
      }
    }catch(_){ }
    const sub = text(cab && cab.subType);
    const map = {
      zmywarkowa:'Zmywarka',
      lodowkowa:'Lodówka do zabudowy',
      piekarnikowa:'Piekarnik',
      okap:'Okap'
    };
    return map[sub] ? { count:1, type:map[sub] } : { count:0, type:'' };
  }

  function buildFacts(room, cabinet){
    const cab = cabinet && typeof cabinet === 'object' ? cabinet : {};
    const fronts = getFrontParts(room, cab);
    const hinges = getHingeRequirements(room, cab);
    const appliance = applianceInfo(cab);
    const volume = cabinetVolumeM3(cab);
    const area = frontAreaM2(fronts);
    const cabinetQty = cabinetCount(cab);
    const frontCountValue = frontQty(fronts);
    const frontDimensionsValue = frontDimensions(fronts);
    const hingeCountValue = hingeQty(hinges);
    const hingeRequirementValue = hingeRequirementLabel(hinges);
    const shelfCountValue = shelfCount(cab);
    const drawerCountValue = drawerCount(cab);
    const facts = [];

    facts.push(makeFact('cabinet.count', cabinetQty, { displayValue:formatQty(cabinetQty, 'szt.'), source:'typ pozycji szafki' }));
    facts.push(makeFact('cabinet.width_mm', mmFromCmLike(cab.width), { displayValue:formatQty(mmFromCmLike(cab.width), 'mm'), source:'pole Szerokość' }));
    facts.push(makeFact('cabinet.height_mm', mmFromCmLike(cab.height), { displayValue:formatQty(mmFromCmLike(cab.height), 'mm'), source:'pole Wysokość' }));
    facts.push(makeFact('cabinet.depth_mm', mmFromCmLike(cab.depth), { displayValue:formatQty(mmFromCmLike(cab.depth), 'mm'), source:'pole Głębokość' }));
    facts.push(makeFact('cabinet.volume_m3', volume, { displayValue:volume > 0 ? formatNumber(volume, 3) + ' m³' : '—', source:'szerokość × wysokość × głębokość', available:volume > 0 }));
    facts.push(makeFact('cabinet.zone', cabinetZone(cab), { source:'typ szafki w WYWIADZIE' }));
    facts.push(makeFact('cabinet.kind', cabinetKind(cab), { source:'wybrany wariant szafki' }));

    facts.push(makeFact('front.count', frontCountValue, { displayValue:formatQty(frontCountValue, 'szt.'), source:'centralne obliczenia frontów' }));
    facts.push(makeFact('front.dimensions', frontDimensionsValue, { displayValue:frontDimensionsValue || 'brak frontów', source:'centralne obliczenia frontów', available:!!frontDimensionsValue }));
    facts.push(makeFact('front.area_m2', area, { displayValue:area > 0 ? formatNumber(area, 3) + ' m²' : '—', source:'wymiary frontów × ilość', available:area > 0 }));
    facts.push(makeFact('hinge.count', hingeCountValue, { displayValue:formatQty(hingeCountValue, 'szt.'), source:'centralne wymagania zawiasów' }));
    facts.push(makeFact('hinge.requirement', hingeRequirementValue, { displayValue:hingeRequirementValue || 'brak zawiasów', source:'panel wymagań technicznych', available:!!hingeRequirementValue }));

    facts.push(makeFact('shelf.count', shelfCountValue, { displayValue:formatQty(shelfCountValue, 'szt.'), source:'pole Półki w szafce' }));
    facts.push(makeFact('drawer.count', drawerCountValue, { displayValue:formatQty(drawerCountValue, 'szt.'), source:'dane szuflad w wariancie szafki' }));
    facts.push(makeFact('appliance.count', appliance.count, { displayValue:formatQty(appliance.count, 'szt.'), source:'wariant AGD / montaż sprzętu' }));
    facts.push(makeFact('appliance.type', appliance.type, { displayValue:appliance.type || 'brak AGD', source:'wariant szafki AGD', available:!!appliance.type }));

    return facts;
  }

  function groupFacts(facts){
    return (Array.isArray(facts) ? facts : []).reduce((acc, fact)=> {
      const group = text(fact && fact.group) || 'Inne';
      if(!acc[group]) acc[group] = [];
      acc[group].push(fact);
      return acc;
    }, {});
  }
  function esc(value){
    return text(value).replace(/[&<>"]/g, (ch)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  }
  function rowHtml(fact){
    const calc = text(fact && fact.source) || text(fact && fact.calculation);
    return '<div class="cabinet-work-facts-row" data-work-fact-code="' + esc(fact && fact.code) + '">' +
      '<div class="cabinet-work-facts-row__main">' +
        '<div class="cabinet-work-facts-row__label">' + esc(fact && fact.label) + '</div>' +
        '<div class="cabinet-work-facts-row__value">' + esc(fact && fact.displayValue) + '</div>' +
      '</div>' +
      '<div class="cabinet-work-facts-row__tech"><code>' + esc(fact && fact.code) + '</code>' + (calc ? '<span>Jak liczone: ' + esc(calc) + '</span>' : '') + '</div>' +
    '</div>';
  }
  function renderPanel(container, room, cabinet){
    if(!container) return [];
    const facts = buildFacts(room, cabinet);
    const groups = groupFacts(facts);
    const groupHtml = Object.keys(groups).map((group)=> {
      const rows = (groups[group] || []).map(rowHtml).join('');
      return '<section class="cabinet-work-facts-group">' +
        '<h4 class="cabinet-work-facts-group__title">' + esc(group) + '</h4>' +
        '<div class="cabinet-work-facts-group__rows">' + rows + '</div>' +
      '</section>';
    }).join('');

    const help = (FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function') ? '<span class="cabinet-work-facts-help-slot"></span>' : '';
    container.innerHTML = '<div class="cabinet-work-facts-panel">' +
      '<div class="cabinet-work-facts-panel__head">' +
        '<div>' +
          '<h3 class="section-title cabinet-work-facts-panel__title">Co program odczyta z tej szafki</h3>' +
          '<div class="cabinet-work-facts-panel__hint">Podgląd tylko do odczytu. Program bierze te wartości z aktualnych pól szafki i obliczeń, bez zapisywania drugiej kopii danych.</div>' +
        '</div>' + help +
      '</div>' +
      '<div class="cabinet-work-facts-panel__groups">' + groupHtml + '</div>' +
    '</div>';
    try{
      const slot = container.querySelector('.cabinet-work-facts-help-slot');
      if(slot && FC.helpRegistry && typeof FC.helpRegistry.createTrigger === 'function'){
        const trigger = FC.helpRegistry.createTrigger({
          key:'cabinet.workFacts.preview',
          title:'Co program odczyta z tej szafki',
          message:'To jest podgląd wartości używanych później przez czynności i WYCENĘ. Nie edytuj ich tutaj: jeśli coś się nie zgadza, popraw właściwe pole wyżej w szafce. Panel nie zapisuje drugiego zestawu danych.',
          scope:'cabinet',
          className:'info-trigger cabinet-work-facts-info',
          stop:false
        });
        if(trigger) slot.replaceWith(trigger);
        else slot.remove();
      }
    }catch(_){ }
    return facts;
  }

  FC.cabinetWorkFactsPreview = {
    buildFacts,
    listFacts:buildFacts,
    groupFacts,
    renderPanel,
    _debug:{ cabinetVolumeM3, frontQty, frontAreaM2, hingeQty, shelfCount, drawerCount }
  };
})();
