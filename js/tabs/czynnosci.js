// js/tabs/czynnosci.js
// Zakładka CZYNNOŚCI — techniczny widok pracy: czynności, ilości, normoczas i źródła bez finalnej wyceny złotówkowej.

(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  let manualOpen = true;
  let cabinetOpen = true;

  function h(tag, attrs, children){
    const api = FC.wycenaTabDom;
    if(api && typeof api.h === 'function') return api.h(tag, attrs || {}, children || []);
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=> {
      if(key === 'class') el.className = attrs[key];
      else if(key === 'text') el.textContent = attrs[key];
      else if(key === 'html') el.innerHTML = attrs[key];
      else el.setAttribute(key, attrs[key]);
    });
    (children || []).forEach((child)=> el.appendChild(child));
    return el;
  }

  function money(value){
    try{ return FC.wycenaTabHelpers && typeof FC.wycenaTabHelpers.money === 'function' ? FC.wycenaTabHelpers.money(value) : `${(Number(value)||0).toFixed(2)} PLN`; }
    catch(_){ return `${(Number(value)||0).toFixed(2)} PLN`; }
  }

  function getOfferDraft(){
    try{ return FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function' ? FC.quoteOfferStore.getCurrentDraft() : { rateSelections:[], commercial:{} }; }
    catch(_){ return { rateSelections:[], commercial:{} }; }
  }

  function patchOfferDraft(patch){
    try{ return FC.quoteOfferStore && typeof FC.quoteOfferStore.patchCurrentDraft === 'function' ? FC.quoteOfferStore.patchCurrentDraft(patch) : null; }
    catch(_){ return null; }
  }

  function roomLabel(roomId){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function' ? FC.roomRegistry.getRoomLabel(roomId) : String(roomId || ''); }
    catch(_){ return String(roomId || ''); }
  }

  function getCabinets(roomId){
    try{
      const project = typeof projectData !== 'undefined' && projectData ? projectData : {};
      const room = project && project[roomId];
      return room && Array.isArray(room.cabinets) ? room.cabinets : [];
    }catch(_){ return []; }
  }

  function describeAppliance(cabinet){
    const api = FC.laborApplianceRules;
    if(!(api && typeof api.getApplianceForCabinet === 'function')) return null;
    const appliance = api.getApplianceForCabinet(cabinet);
    if(!appliance) return null;
    const enabled = typeof api.isMountingEnabled === 'function' ? api.isMountingEnabled(cabinet) : true;
    return {
      name: appliance.label || appliance.serviceName || 'Montaż sprzętu',
      enabled,
      price:0,
      meta: enabled ? 'Montaż sprzętu' : 'Bez montażu sprzętu',
    };
  }

  function buildCabinetRows(roomId){
    let laborLines = [];
    try{
      laborLines = FC.wycenaCoreLabor && typeof FC.wycenaCoreLabor.collectCabinetLabor === 'function'
        ? FC.wycenaCoreLabor.collectCabinetLabor([roomId])
        : [];
    }catch(_){ laborLines = []; }
    const laborByIndex = new Map();
    (Array.isArray(laborLines) ? laborLines : []).forEach((row)=> laborByIndex.set(Number(row && row.cabinetNumber) || 0, row));
    const cabinets = getCabinets(roomId);
    return cabinets.map((cabinet, index)=> {
      const number = index + 1;
      const labor = laborByIndex.get(number) || null;
      const appliance = describeAppliance(cabinet);
      const details = [];
      if(labor && Array.isArray(labor.details)) labor.details.forEach((item)=> details.push(item));
      if(appliance){
        details.push({
          name: appliance.name,
          total:0,
          note: appliance.enabled ? 'Automatycznie z typu szafki' : 'Wyłączone przy szafce',
          hours:0,
          hourlyRate:0,
        });
      }
      const laborTotal = labor ? Number(labor.total) || 0 : 0;
      const total = laborTotal;
      const volume = labor ? Number(labor.volumeM3) || 0 : (FC.wycenaCoreLabor && typeof FC.wycenaCoreLabor.cabinetVolumeM3 === 'function' ? FC.wycenaCoreLabor.cabinetVolumeM3(cabinet) : 0);
      return {
        cabinet,
        number,
        label: `#${number} • ${cabinet.type || 'szafka'}${cabinet.subType ? ' • ' + cabinet.subType : ''}`,
        meta: [cabinet.width && cabinet.height && cabinet.depth ? `${cabinet.width} × ${cabinet.height} × ${cabinet.depth}` : '', volume > 0 ? `${volume.toFixed(3)} m³` : '', appliance ? appliance.meta : ''].filter(Boolean).join(' • '),
        total,
        hours: labor ? Number(labor.hours) || 0 : 0,
        details,
      };
    });
  }

  function renderManualLabor(card, ctx){
    if(!(FC.wycenaTabManualLabor && typeof FC.wycenaTabManualLabor.renderManualLaborEditor === 'function')) return;
    FC.wycenaTabManualLabor.renderManualLaborEditor(card, ctx, {
      h,
      money,
      num(value, fallback){ const parsed = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(parsed) ? parsed : fallback; },
      render,
      getOfferDraft,
      patchOfferDraft,
      hideMoney:true,
      getIsOpen(){ return manualOpen; },
      setIsOpen(next){ manualOpen = !!next; },
    });
  }

  function fmtHours(value){
    const raw = Number(value);
    if(!Number.isFinite(raw) || raw <= 0) return '0:00';
    const totalMinutes = Math.max(0, Math.round(raw * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  }
  function fmtMultiplier(value){ return `×${(Number(value) || 1).toFixed(2)}`; }
  function fmtM3(value){ return `${(Number(value) || 0).toFixed(3)} m³`; }
  function fmtQty(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '0';
    return Math.abs(n - Math.round(n)) < 0.000001 ? String(Math.round(n)) : n.toFixed(2).replace(/\.?0+$/, '');
  }
  function catalogRows(){
    try{ return FC.catalogSelectors && typeof FC.catalogSelectors.getQuoteRates === 'function' ? FC.catalogSelectors.getQuoteRates() : []; }
    catch(_){ return []; }
  }
  function rateDisplay(value){
    const raw = String(value || '').trim();
    if(!raw) return '—';
    try{
      const labor = FC.laborCatalog || {};
      const code = typeof labor.normalizeRateCode === 'function' ? labor.normalizeRateCode(raw) : raw;
      if(typeof labor.findRateProfile === 'function'){
        const profile = labor.findRateProfile(catalogRows(), code);
        const label = String(profile && (profile.label || profile.name) || '').trim();
        if(label){
          const defaultCodes = new Set(['workshop','assembly','specialist','helper']);
          return defaultCodes.has(code) && !/^stawka\b/i.test(label) ? `Stawka ${label.toLowerCase()}` : label;
        }
      }
      if(typeof labor.getRateLabel === 'function'){
        const label = String(labor.getRateLabel(code) || '').trim();
        if(label) return /^stawka\b/i.test(label) ? label : `Stawka ${label.toLowerCase()}`;
      }
    }catch(_){ }
    const map = { workshop:'Stawka warsztatowa', assembly:'Stawka montażowa', specialist:'Stawka specjalistyczna', helper:'Stawka pomocnika' };
    return map[raw] || raw;
  }
  function pricingModeLabel(part){
    const mode = String(part && part.pricingMode || '').trim();
    const qMode = String(part && part.quantityMode || '').trim();
    const labor = FC.laborCatalog || {};
    try{
      if(mode && typeof labor.getPricingModeLabel === 'function') return labor.getPricingModeLabel(mode);
      if(qMode && typeof labor.getQuantityModeLabel === 'function') return labor.getQuantityModeLabel(qMode);
    }catch(_){ }
    const map = {
      fixed:'Kwota stała',
      perUnit:'Cena za ilość',
      startPlusUnit:'Kwota startowa + cena za ilość',
      time:'Czas × stawka godzinowa',
      timeTiers:'Progi czasu',
      timeStartStep:'Czas startowy + kolejne sztuki',
      advanced:'Zaawansowane',
      linear:'Liniowo: czas × ilość',
      tiers:'Pakiety/progi ilościowe',
      startStep:'Start + kolejne sztuki',
      none:'Bez ilości'
    };
    return map[mode] || map[qMode] || 'Czynność';
  }
  function unitName(unit){ return String(unit || '').trim() || 'szt.'; }
  function pluralStep(count){ return Number(count) === 1 ? 'krok' : (Number(count) >= 2 && Number(count) <= 4 ? 'kroki' : 'kroków'); }
  function breakdownRow(label, value){
    const row = h('div', { class:'quote-labor-breakdown__row' });
    row.appendChild(h('span', { class:'quote-labor-breakdown__label', text:label }));
    row.appendChild(h('span', { class:'quote-labor-breakdown__value', text:value }));
    return row;
  }
  function findTier(rows, quantity){
    const qty = Math.max(0, Number(quantity) || 0);
    const tiers = (Array.isArray(rows) ? rows : [])
      .map((row)=> ({ min:Number(row && row.min) || 0, max:Number(row && row.max) || 0, hours:Number(row && row.hours) || 0 }))
      .filter((row)=> row.min > 0 && row.hours > 0)
      .sort((a,b)=> a.min - b.min);
    if(!(qty > 0) || !tiers.length) return null;
    return tiers.find((row)=> qty >= row.min && (row.max <= 0 || qty <= row.max)) || tiers[tiers.length - 1] || null;
  }
  function tierLabel(row){
    if(!row) return '';
    if(Number(row.max) > 0 && Number(row.max) !== Number(row.min)) return `${fmtQty(row.min)}–${fmtQty(row.max)} szt.`;
    if(Number(row.max) <= 0) return `od ${fmtQty(row.min)} szt.`;
    return `${fmtQty(row.min)} szt.`;
  }
  function addQuantityTimeRows(box, part){
    const quantity = Math.max(0, Number(part && part.quantity) || 0);
    const unit = unitName(part && part.unit);
    const mode = String(part && part.quantityMode || '').trim();
    const pricing = String(part && part.pricingMode || '').trim();
    const unitHours = Math.max(0, Number(part && part.timeBlockHours) || 0);
    const baseHours = Math.max(0, Number(part && part.baseHours) || 0);

    if(quantity > 0 && unit && unit !== 'x') box.appendChild(breakdownRow('Ilość', `${fmtQty(quantity)} ${unit}`));
    if(pricing) box.appendChild(breakdownRow('Tryb', pricingModeLabel(part)));

    if(mode === 'linear'){
      if(unitHours > 0){
        box.appendChild(breakdownRow('Czas jednostkowy', fmtHours(unitHours)));
        if(quantity > 0) box.appendChild(breakdownRow('Wyliczenie czasu', `${fmtQty(quantity)} × ${fmtHours(unitHours)} = ${fmtHours(baseHours || quantity * unitHours)}`));
      }else if(!(Number(part && part.hours) > 0)){
        box.appendChild(breakdownRow('Czas', 'Brak informacji o czasie'));
      }
      return;
    }

    if(mode === 'tiers'){
      const tier = findTier(part && part.quantityTiers, quantity);
      if(tier){
        box.appendChild(breakdownRow('Wybrany próg', `${tierLabel(tier)} = ${fmtHours(tier.hours)}`));
      }else if(baseHours > 0){
        box.appendChild(breakdownRow('Wybrany próg', fmtHours(baseHours)));
      }else if(!(Number(part && part.hours) > 0)){
        box.appendChild(breakdownRow('Czas', 'Brak informacji o czasie'));
      }
      return;
    }

    if(mode === 'startStep'){
      const startQty = Math.max(1, Math.floor(Number(part && part.startQty) || 1));
      const startHours = Math.max(0, Number(part && part.startHours) || 0);
      const stepEvery = Math.max(1, Math.floor(Number(part && part.stepEveryQty) || 1));
      const stepHours = Math.max(0, Number(part && part.stepHours) || 0);
      if(startHours > 0) box.appendChild(breakdownRow(`Pierwsze ${fmtQty(Math.min(quantity || startQty, startQty))} ${unit}`, fmtHours(startHours)));
      const extraQty = Math.max(0, quantity - startQty);
      const steps = stepHours > 0 && extraQty > 0 ? Math.ceil(extraQty / stepEvery) : 0;
      if(steps > 0){
        const label = `Kolejne ${fmtQty(extraQty)} ${unit}`;
        box.appendChild(breakdownRow(label, `${fmtQty(steps)} ${pluralStep(steps)} × ${fmtHours(stepHours)} = ${fmtHours(steps * stepHours)}`));
      }
      if(!(startHours > 0 || steps > 0) && !(Number(part && part.hours) > 0)) box.appendChild(breakdownRow('Czas', 'Brak informacji o czasie'));
      return;
    }

    if(baseHours > 0){
      box.appendChild(breakdownRow('Czas', fmtHours(baseHours)));
    }else if(['fixed','perUnit','startPlusUnit'].includes(pricing) || !(Number(part && part.hours) > 0)){
      box.appendChild(breakdownRow('Czas', 'Brak informacji o czasie'));
      if(pricing === 'fixed') box.appendChild(breakdownRow('Rozliczenie', 'kwota widoczna tylko w WYCENIE'));
      if(pricing === 'perUnit') box.appendChild(breakdownRow('Rozliczenie', 'ilość × cena jednostkowa w WYCENIE'));
      if(pricing === 'startPlusUnit'){
        const included = Math.max(0, Number(part && part.includedQty) || 0);
        const billable = Math.max(0, Number(part && part.billableQty) || 0);
        box.appendChild(breakdownRow('Do naliczenia', `${fmtQty(quantity)} - ${fmtQty(included)} w cenie startowej = ${fmtQty(billable)} ${unit}`));
        box.appendChild(breakdownRow('Rozliczenie', 'kwota startowa + jednostki tylko w WYCENIE'));
      }
    }
  }
  function addVolumeTimeRows(box, part){
    const volumeHours = Math.max(0, Number(part && part.volumeHours) || 0);
    if(!(volumeHours > 0)) return;
    const volumeM3 = Math.max(0, Number(part && part.volumeM3) || 0);
    const mode = String(part && part.volumeTimeMode || 'none');
    const perM3 = Math.max(0, Number(part && part.volumeTimePerM3) || 0);
    if(mode === 'perM3' && perM3 > 0 && volumeM3 > 0){
      box.appendChild(breakdownRow('Gabarytoczas', `${fmtM3(volumeM3)} × ${fmtHours(perM3)}/m³ = ${fmtHours(volumeHours)}`));
      return;
    }
    if(mode === 'tiers'){
      const tier = findTier(part && part.volumeTimeTiers, volumeM3);
      box.appendChild(breakdownRow('Gabarytoczas', tier ? `${fmtM3(volumeM3)} • próg ${tier.min}–${tier.max || '…'} m³ = ${fmtHours(volumeHours)}` : `${fmtHours(volumeHours)} z progu objętości`));
      return;
    }
    box.appendChild(breakdownRow('Gabarytoczas', fmtHours(volumeHours)));
  }

  function renderDetailBreakdown(part){
    const box = h('div', { class:'quote-labor-breakdown' });
    const baseHours = Math.max(0, Number(part && part.baseHours) || 0);
    const volumeHours = Math.max(0, Number(part && part.volumeHours) || 0);
    const multiplier = Math.max(0, Number(part && part.multiplier) || 1) || 1;
    const rawHours = baseHours + volumeHours;

    addQuantityTimeRows(box, part || {});
    addVolumeTimeRows(box, part || {});
    if(multiplier !== 1) box.appendChild(breakdownRow('Mnożnik', fmtMultiplier(multiplier)));
    if(multiplier !== 1 && rawHours > 0) box.appendChild(breakdownRow('Normoczas przed mnożnikiem', fmtHours(rawHours)));
    if(multiplier !== 1 && Number(part && part.hours) > 0) box.appendChild(breakdownRow('Po mnożniku', `${fmtHours(rawHours)} × ${fmtMultiplier(multiplier)} = ${fmtHours(part.hours)}`));
    const rateName = String(part && (part.rateType || part.rateName || '') || '').trim();
    if(rateName) box.appendChild(breakdownRow('Stawka', rateDisplay(rateName)));
    const source = String(part && part.quantitySource || '').trim();
    const sourceLabel = String(part && part.quantitySourceLabel || '').trim();
    const sourceDisplay = String(part && part.quantitySourceDisplay || '').trim();
    if(source || sourceLabel || sourceDisplay){
      box.appendChild(breakdownRow('Źródło ilości', [sourceLabel || source, sourceDisplay].filter(Boolean).join(' = ') || source));
    }
    if(part && part.note) box.appendChild(breakdownRow('Z czego wynika', String(part.note)));
    const warning = String(part && (part.quantitySourceWarning || part.skippedReason) || '').trim();
    if(warning) box.appendChild(breakdownRow('Uwaga', warning));
    return box;
  }

  function renderCabinetRows(container, rows){
    if(!rows.length){
      container.appendChild(h('div', { class:'muted', text:'Brak szafek w tym pomieszczeniu.' }));
      return;
    }
    const hours = rows.reduce((sum, row)=> sum + (Number(row.hours) || 0), 0);
    container.appendChild(h('div', { class:'czynnosci-summary-pill', text:`Czynności szafek: ${rows.length} • normoczas: ${fmtHours(hours)}` }));
    const list = h('div', { class:'quote-labor-list czynnosci-cabinet-list' });
    rows.forEach((row)=> {
      const details = h('details', { class:'quote-labor-cabinet czynnosci-cabinet wywiad-room-accordion' });
      const summary = h('summary', { class:'quote-labor-cabinet__summary wywiad-room-accordion__summary' });
      const title = h('div', { class:'quote-labor-cabinet__title' });
      title.appendChild(h('div', { class:'quote-labor-cabinet__name', text:row.label }));
      title.appendChild(h('div', { class:'quote-labor-cabinet__meta', text:row.meta || '—' }));
      summary.appendChild(title);
      summary.appendChild(h('div', { class:'quote-labor-cabinet__amount', text:fmtHours(row.hours) }));
      summary.appendChild(h('span', { class:'wywiad-room-accordion__chevron', 'aria-hidden':'true' }));
      details.appendChild(summary);
      const body = h('div', { class:'quote-labor-cabinet__body wywiad-room-accordion__body' });
      (Array.isArray(row.details) ? row.details : []).forEach((part)=> {
        const item = h('div', { class:'quote-labor-detail' });
        item.appendChild(h('div', { class:'quote-labor-detail__main', text:part.name || 'Czynność' }));
        item.appendChild(renderDetailBreakdown(part));
        if(Number(part && part.hours) > 0) item.appendChild(h('div', { class:'quote-labor-detail__total', text:fmtHours(part.hours) }));
        else item.appendChild(h('div', { class:'quote-labor-detail__total quote-labor-detail__total--missing', text:'Brak informacji o czasie' }));
        body.appendChild(item);
      });
      if(!body.childNodes.length) body.appendChild(h('div', { class:'muted', text:'Brak szczegółów czynności dla tej szafki.' }));
      details.appendChild(body);
      list.appendChild(details);
    });
    container.appendChild(list);
  }

  function renderCabinetLabor(card, roomId){
    const rows = buildCabinetRows(roomId);
    const section = h('section', { class:`quote-offer-accordion czynnosci-cabinet-accordion rozrys-material-accordion${cabinetOpen ? ' is-open' : ''}`, style:'margin-top:12px;' });
    const head = h('div', { class:'quote-offer-accordion__head' });
    const trigger = h('button', { class:'rozrys-material-accordion__trigger quote-offer-accordion__trigger', type:'button' });
    const titleBox = h('div', { class:'rozrys-material-accordion__title quote-offer-accordion__titlebox' });
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line1', text:'Czynności szafek' }));
    titleBox.appendChild(h('div', { class:'rozrys-material-accordion__title-line2 quote-offer-accordion__summary-line', text:`Pomieszczenie: ${roomLabel(roomId)} • szafki: ${rows.length}` }));
    trigger.appendChild(titleBox);
    trigger.appendChild(h('span', { class:`rozrys-material-accordion__chevron${cabinetOpen ? ' is-open' : ''}`, html:'&#9662;', 'aria-hidden':'true' }));
    trigger.addEventListener('click', (event)=>{ event.preventDefault(); cabinetOpen = !cabinetOpen; render({ listEl:card.parentNode, room:roomId }); });
    head.appendChild(trigger);
    section.appendChild(head);
    if(cabinetOpen){
      const body = h('div', { class:'quote-offer-accordion__body rozrys-material-accordion__body' });
      renderCabinetRows(body, rows);
      section.appendChild(body);
    }
    card.appendChild(section);
  }

  function render(ctx){
    const list = ctx && ctx.listEl;
    const roomId = String(ctx && ctx.room || '').trim();
    if(!list) return;
    list.innerHTML = '';
    const card = h('div', { class:'build-card czynnosci-root' });
    card.appendChild(h('h3', { text:'Czynności' }));
    card.appendChild(h('p', { class:'muted', text:'Tu zarządzasz robocizną: ręczne czynności do oferty oraz automatyczne czynności szafek z WYWIADU. Szczegóły są wewnętrzne — nie dla klienta.' }));
    renderManualLabor(card, ctx || {});
    if(roomId) renderCabinetLabor(card, roomId);
    else card.appendChild(h('div', { class:'card quote-section', style:'margin-top:12px;padding:14px;', text:'Wybierz pomieszczenie, żeby zobaczyć czynności szafek.' }));
    list.appendChild(card);
  }

  FC.tabsCzynnosci = {
    render,
    buildCabinetRows,
  };

  (FC.tabsRouter || FC.tabs || {}).register?.('czynnosci', { mount(){}, render, unmount(){} });
})();
