// js/app/material/price-modal-hardware-replacements.js
// Podgląd listy zamienników okuć w modalu edycji pozycji katalogu — bez zapisu zmian.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};
  let currentItemId = '';
  let expanded = false;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function lower(value){ return text(value).toLowerCase(); }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function money(value){ return num(value).toFixed(2).replace('.', ',') + ' PLN'; }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=>{
      const value = attrs[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'style') el.setAttribute('style', value);
      else if(key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if(value !== false && value != null) el.setAttribute(key, value === true ? '' : String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function store(){ try{ return ctx.catalogStore && ctx.catalogStore(); }catch(_){ return null; } }
  function getAccessories(){
    const s = store();
    if(s && typeof s.getAccessories === 'function') return s.getAccessories();
    try{ return ctx.currentList && ctx.currentListKind && ctx.currentListKind() === 'accessories' ? ctx.currentList() : []; }catch(_){ return []; }
  }
  function getDefinitions(){
    const s = store();
    if(s && typeof s.getHardwareTechnicalParams === 'function') return s.getHardwareTechnicalParams();
    return (FC.hardwareTechnicalParams && FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS) || [];
  }
  function getSuppliers(){ const s = store(); return s && typeof s.getHardwareSuppliers === 'function' ? s.getHardwareSuppliers() : []; }
  function getSettings(){ const s = store(); return s && typeof s.getHardwareSettings === 'function' ? s.getHardwareSettings() : ((FC.hardwareCatalog && FC.hardwareCatalog.DEFAULT_SETTINGS) || {}); }
  function sameManufacturer(a, b){ return lower(a && a.manufacturer) === lower(b && b.manufacturer); }
  function sameCategory(a, b){ return lower(categoryOf(a)) === lower(categoryOf(b)); }
  function categoryOf(item){ return text(item && (item.hardwareCategory || item.category)); }
  function supplierName(id){
    const sid = text(id);
    if(!sid) return '';
    const found = getSuppliers().find((row)=> text(row && row.id) === sid);
    return text(found && found.name) || sid;
  }
  function passiveDraft(){
    try{
      if(ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.getCurrentAccessoryDraft === 'function'){
        return ctx.priceModalHardwareForm.getCurrentAccessoryDraft({ passive:true }) || {};
      }
    }catch(_){ }
    return {};
  }
  function hasMeaningfulValue(value){
    if(value == null) return false;
    if(typeof value === 'string') return value.trim() !== '';
    if(Array.isArray(value)) return value.length > 0;
    if(typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }
  function mergeDraftOverBase(base, draft){
    const merged = Object.assign({}, base || {});
    Object.keys(draft || {}).forEach((key)=>{
      if(hasMeaningfulValue(draft[key])) merged[key] = draft[key];
    });
    return merged;
  }
  function buildSourceItem(item, opts){
    const cfg = Object.assign({ useDraft:true }, opts || {});
    const base = item || (ctx.currentEditedItem && ctx.currentEditedItem()) || null;
    const draft = cfg.useDraft ? passiveDraft() : {};
    const merged = mergeDraftOverBase(base, draft);
    const id = text((base && base.id) || merged.id || (ctx.appUiState && ctx.appUiState() && ctx.appUiState().editingId));
    if(id) merged.id = id;
    const category = categoryOf(merged) || categoryOf(base) || categoryOf(draft);
    if(category){ merged.hardwareCategory = category; if(!merged.category) merged.category = category; }
    return merged;
  }
  function canCompareSource(source){ return !!(source && text(source.id) && categoryOf(source)); }

  function previewRows(sourceItem, candidates, options){
    const engine = FC.hardwareReplacementEngine || {};
    const source = buildSourceItem(sourceItem, { useDraft:!sourceItem });
    if(!(engine && typeof engine.previewCandidates === 'function') || !canCompareSource(source)) return [];
    const rows = Array.isArray(candidates) ? candidates : [];
    const filtered = rows.filter((row)=> row && text(row.id) !== text(source.id) && sameCategory(source, row) && !sameManufacturer(source, row));
    return engine.previewCandidates(source, filtered, Object.assign({
      definitions:getDefinitions(),
      hardwareTechnicalParams:getDefinitions(),
      suppliers:getSuppliers(),
      defaultVatRate:num(getSettings().defaultVatRate) || 23,
      excludeSameId:true,
      excludeSourceManufacturer:true,
      requireQuotePrice:false,
    }, options || {}));
  }

  function reasonLine(reason){
    const row = reason || {};
    if(row.code === 'no_quote_price') return 'brak ceny dostawcy do wyceny';
    if(row.code === 'target_manufacturer_mismatch') return 'inny producent niż wybrany';
    if(row.code === 'category_mismatch') return 'inna kategoria';
    if(row.code === 'inactive_candidate') return 'pozycja nieaktywna';
    if(row.code === 'param_mismatch' || row.code === 'candidate_param_missing' || row.code === 'source_param_missing'){
      const label = text(row.label) || 'parametr';
      const src = text(row.sourceValue);
      const cand = text(row.candidateValue);
      return label + ': ' + (src || 'brak') + ' → ' + (cand || 'brak');
    }
    return text(row.message);
  }

  function statusChip(row){
    if(row.compatible && Array.isArray(row.warnings) && row.warnings.length) return h('span', { class:'hardware-replacement-chip hardware-replacement-chip--warning', text:'Pasuje z ostrzeżeniem' });
    if(row.compatible) return h('span', { class:'hardware-replacement-chip hardware-replacement-chip--ok', text:'Pasuje' });
    return h('span', { class:'hardware-replacement-chip hardware-replacement-chip--danger', text:'Odpada' });
  }
  function priceLine(row){
    const quote = row && row.quote || {};
    const value = num(quote.quotePriceGross || quote.catalogPriceGross);
    if(value > 0) return 'Do wyceny: ' + money(value) + (text(quote.supplierId) ? ' • ' + supplierName(quote.supplierId) : '');
    return 'Brak ceny dostawcy do wyceny';
  }
  function metaLine(row){
    const item = row && row.candidate || {};
    return [text(item.manufacturer), categoryOf(item), text(item.hardwareType || item.type) ? 'Tech: ' + text(item.hardwareType || item.type) : ''].filter(Boolean).join(' • ');
  }
  function renderReasonList(row){
    const important = [];
    (Array.isArray(row.failures) ? row.failures : []).slice(0, 2).forEach((entry)=> important.push(reasonLine(entry)));
    (Array.isArray(row.warnings) ? row.warnings : []).slice(0, 1).forEach((entry)=> important.push(reasonLine(entry)));
    if(!important.length){
      (Array.isArray(row.checks) ? row.checks : []).filter((check)=> check && check.ok).slice(0, 2).forEach((check)=> important.push((text(check.label) || 'parametr') + ': OK'));
    }
    if(!important.length) important.push('zgodność według parametrów kluczowych');
    return h('div', { class:'hardware-replacement-card__reasons' }, important.map((line)=> h('div', { text:'• ' + line })));
  }
  function renderCandidate(row){
    const item = row && row.candidate || {};
    const card = h('div', { class:'hardware-replacement-card' });
    const top = h('div', { class:'hardware-replacement-card__top' }, [
      h('div', { class:'hardware-replacement-card__title', text:text(item.name) || text(row && row.candidateId) || 'Zamiennik' }),
      statusChip(row),
    ]);
    card.appendChild(top);
    card.appendChild(h('div', { class:'hardware-replacement-card__meta', text:metaLine(row) || '—' }));
    card.appendChild(h('div', { class:'hardware-replacement-card__price', text:priceLine(row) }));
    card.appendChild(renderReasonList(row));
    return card;
  }

  function ensureElements(){
    const exitBtn = ctx.byId && ctx.byId('priceItemExitBtn');
    const footer = ctx.byId && ctx.byId('priceItemFooter');
    if(!footer) return {};
    let stack = footer.querySelector && footer.querySelector('.price-item-footer__exit-stack');
    if(!stack){
      stack = document.createElement('div');
      stack.className = 'price-item-footer__exit-stack';
      const parent = exitBtn && exitBtn.parentNode;
      if(parent){ parent.insertBefore(stack, exitBtn); stack.appendChild(exitBtn); }
    }
    let btn = ctx.byId && ctx.byId('hardwareReplacementToggleBtn');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'hardwareReplacementToggleBtn';
      btn.type = 'button';
      btn.className = 'btn-primary hardware-replacement-toggle';
      btn.textContent = 'Zamienniki';
      stack.appendChild(btn);
    }
    let panel = ctx.byId && ctx.byId('hardwareReplacementPreview');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'hardwareReplacementPreview';
      panel.className = 'hardware-replacement-preview';
      panel.hidden = true;
      footer.appendChild(panel);
    }
    return { btn, panel };
  }

  function renderPreview(){
    const els = ensureElements();
    const panel = els.panel || (ctx.byId && ctx.byId('hardwareReplacementPreview'));
    if(!panel) return;
    panel.innerHTML = '';
    if(!expanded){ panel.hidden = true; return; }
    panel.hidden = false;
    const source = buildSourceItem();
    if(!canCompareSource(source)){
      panel.appendChild(h('div', { class:'hardware-replacement-empty', text:'Brak danych okucia do porównania.' }));
      return;
    }
    const rows = previewRows(source, getAccessories());
    const compatible = rows.filter((row)=> row.compatible).slice(0, 8);
    const rejected = rows.filter((row)=> !row.compatible).slice(0, 6);
    panel.appendChild(h('div', { class:'hardware-replacement-preview__head' }, [
      h('div', { class:'hardware-replacement-preview__title', text:'Lista zamienników' }),
      h('div', { class:'hardware-replacement-preview__meta', text:'Bez zapisu zmian • ' + text(source.manufacturer) + ' → inni producenci' }),
    ]));
    if(!rows.length){
      panel.appendChild(h('div', { class:'hardware-replacement-empty', text:'Brak kandydatów w tej samej kategorii od innych producentów.' }));
      return;
    }
    if(compatible.length){
      panel.appendChild(h('div', { class:'hardware-replacement-section-title', text:'Pasujące' }));
      const list = h('div', { class:'hardware-replacement-list' });
      compatible.forEach((row)=> list.appendChild(renderCandidate(row)));
      panel.appendChild(list);
    }else{
      panel.appendChild(h('div', { class:'hardware-replacement-empty', text:'Brak w pełni pasujących zamienników według cech kluczowych.' }));
    }
    if(rejected.length){
      panel.appendChild(h('div', { class:'hardware-replacement-section-title', text:'Najbliższe odrzucone' }));
      const list = h('div', { class:'hardware-replacement-list' });
      rejected.forEach((row)=> list.appendChild(renderCandidate(row)));
      panel.appendChild(list);
    }
  }

  function togglePreview(){
    expanded = !expanded;
    updateToggleLabel();
    renderPreview();
  }
  function closePreview(){ expanded = false; updateToggleLabel(); renderPreview(); }
  function updateToggleLabel(){
    const els = ensureElements();
    const btn = els.btn || (ctx.byId && ctx.byId('hardwareReplacementToggleBtn'));
    if(btn) btn.textContent = expanded ? 'Ukryj zamienniki' : 'Zamienniki';
  }
  function bind(){
    const els = ensureElements();
    const btn = els.btn || (ctx.byId && ctx.byId('hardwareReplacementToggleBtn'));
    if(btn && !btn.__fcHardwareReplacementBound){
      btn.__fcHardwareReplacementBound = true;
      btn.addEventListener('click', togglePreview);
    }
  }
  function setSourceItem(item){
    const source = buildSourceItem(item);
    const id = text(source && source.id);
    if(id !== currentItemId){
      currentItemId = id;
      expanded = false;
      updateToggleLabel();
      renderPreview();
    }
  }
  function updateActionState(state){
    bind();
    const cfg = state || {};
    const els = ensureElements();
    const btn = els.btn || (ctx.byId && ctx.byId('hardwareReplacementToggleBtn'));
    const source = buildSourceItem(cfg.item);
    const canShow = !!(cfg.isEdit && !cfg.dirty && cfg.formKind === 'accessory' && canCompareSource(source));
    if(btn) btn.style.display = canShow ? '' : 'none';
    if(!canShow) closePreview();
  }

  const api = { setSourceItem, updateActionState, closePreview, renderPreview, previewRows, buildSourceItem, _debug:{ reasonLine, canCompareSource, categoryOf, buildSourceItem } };
  FC.priceModalHardwareReplacements = api;
  ctx.priceModalHardwareReplacements = api;
})();
