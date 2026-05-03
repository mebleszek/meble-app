// js/tabs/czynnosci.js
// Zakładka CZYNNOŚCI — robocizna projektu: ręczne czynności, automatyczne czynności szafek i podgląd kosztów wewnętrznych.

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
    let price = 0;
    if(enabled){
      try{
        const svc = FC.wycenaCoreCatalog && typeof FC.wycenaCoreCatalog.servicePriceLookup === 'function' ? FC.wycenaCoreCatalog.servicePriceLookup(appliance.serviceName) : null;
        price = Math.max(0, Number(svc && svc.price) || 0);
      }catch(_){ price = 0; }
    }
    return {
      name: appliance.label || appliance.serviceName || 'Montaż sprzętu',
      enabled,
      price,
      meta: enabled ? `Montaż sprzętu • ${money(price)}` : 'Bez montażu sprzętu',
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
          total: appliance.enabled ? appliance.price : 0,
          note: appliance.enabled ? 'Automatycznie z typu szafki' : 'Wyłączone przy szafce',
          hours:0,
          hourlyRate:0,
        });
      }
      const laborTotal = labor ? Number(labor.total) || 0 : 0;
      const total = laborTotal + (appliance && appliance.enabled ? Number(appliance.price) || 0 : 0);
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
      getIsOpen(){ return manualOpen; },
      setIsOpen(next){ manualOpen = !!next; },
    });
  }

  function renderDetailMeta(part){
    const meta = [];
    if(Number(part && part.hours) > 0) meta.push(`${Number(part.hours).toFixed(2)} h`);
    if(Number(part && part.hourlyRate) > 0) meta.push(`${Number(part.hourlyRate).toFixed(2)} PLN/h`);
    if(Number(part && part.volumeM3) > 0 && Number(part && part.volumePrice) > 0) meta.push(`gabaryt ${Number(part.volumeM3).toFixed(3)} m³`);
    if(Number(part && part.volumeHours) > 0) meta.push(`gabarytoczas ${Number(part.volumeHours).toFixed(2)} h`);
    if(Number(part && part.multiplier) && Number(part.multiplier) !== 1) meta.push(`mnożnik ×${Number(part.multiplier).toFixed(2)}`);
    if(part && part.note) meta.push(String(part.note));
    return meta.join(' • ') || '—';
  }

  function renderCabinetRows(container, rows){
    if(!rows.length){
      container.appendChild(h('div', { class:'muted', text:'Brak szafek w tym pomieszczeniu.' }));
      return;
    }
    const total = rows.reduce((sum, row)=> sum + (Number(row.total) || 0), 0);
    const hours = rows.reduce((sum, row)=> sum + (Number(row.hours) || 0), 0);
    container.appendChild(h('div', { class:'czynnosci-summary-pill', text:`Suma czynności szafek: ${money(total)} • normoczas: ${hours.toFixed(2)} h` }));
    const list = h('div', { class:'quote-labor-list czynnosci-cabinet-list' });
    rows.forEach((row)=> {
      const details = h('details', { class:'quote-labor-cabinet czynnosci-cabinet' });
      const summary = h('summary', { class:'quote-labor-cabinet__summary' });
      const title = h('div', { class:'quote-labor-cabinet__title' });
      title.appendChild(h('div', { class:'quote-labor-cabinet__name', text:row.label }));
      title.appendChild(h('div', { class:'quote-labor-cabinet__meta', text:row.meta || '—' }));
      summary.appendChild(title);
      summary.appendChild(h('div', { class:'quote-labor-cabinet__amount', text:money(row.total) }));
      details.appendChild(summary);
      const body = h('div', { class:'quote-labor-cabinet__body' });
      (Array.isArray(row.details) ? row.details : []).forEach((part)=> {
        const item = h('div', { class:'quote-labor-detail' });
        item.appendChild(h('div', { class:'quote-labor-detail__main', text:part.name || 'Czynność' }));
        item.appendChild(h('div', { class:'quote-labor-detail__meta', text:renderDetailMeta(part) }));
        item.appendChild(h('div', { class:'quote-labor-detail__total', text:money(part.total) }));
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
