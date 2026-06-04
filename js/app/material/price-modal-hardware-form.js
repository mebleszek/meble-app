// js/app/material/price-modal-hardware-form.js
// Pola formularza katalogu okuć/akcesoriów: dostawcy, ceny netto/brutto, rabaty i cena do wyceny.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function normalizePriceValue(value){
    const raw = String(value == null ? '' : value).trim();
    if(!raw) return '';
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : raw;
  }
  function num(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function round2(value){ const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function fmt(value){ const n = Number(value); return Number.isFinite(n) && n !== 0 ? String(Math.round(n * 100) / 100) : ''; }
  function readString(id){ return String((ctx.byId(id) && ctx.byId(id).value) || '').trim(); }
  function readNumber(id){ return normalizePriceValue(ctx.byId(id) && ctx.byId(id).value); }
  function setValue(id, value){ const el = ctx.byId(id); if(el) el.value = value == null ? '' : String(value); }
  function setText(id, value){ const el = ctx.byId(id); if(el) el.textContent = String(value == null ? '' : value); }
  function todayIso(){ try{ const d = new Date(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${d.getFullYear()}-${m}-${day}`; }catch(_){ return ''; } }
  function disableField(id, disabled, reason){
    const el = ctx.byId(id); if(!el) return;
    el.disabled = !!disabled;
    if(disabled){ el.setAttribute('aria-disabled', 'true'); if(reason) el.title = reason; }
    else { el.removeAttribute('aria-disabled'); el.removeAttribute('title'); }
  }
  function getStore(){ return ctx.catalogStore && ctx.catalogStore(); }
  function getSettings(){
    const store = getStore();
    return store && typeof store.getHardwareSettings === 'function' ? store.getHardwareSettings() : ((FC.hardwareCatalog && FC.hardwareCatalog.DEFAULT_SETTINGS) || {});
  }
  function getSuppliers(){
    const store = getStore();
    return store && typeof store.getHardwareSuppliers === 'function' ? store.getHardwareSuppliers() : [];
  }

  function techApi(){ return FC.hardwareTechnicalParams || {}; }
  function getTechnicalDefinitions(){
    const store = getStore();
    if(store && typeof store.getHardwareTechnicalParams === 'function') return store.getHardwareTechnicalParams();
    const api = techApi();
    return Array.isArray(api.DEFAULT_DEFINITIONS) ? api.DEFAULT_DEFINITIONS.slice() : [];
  }
  function currentTechnicalFields(category){
    const api = techApi();
    const cat = category || readString('hardwareCategory') || 'Inne';
    return api && typeof api.fieldsForCategory === 'function' ? api.fieldsForCategory(getTechnicalDefinitions(), cat) : [];
  }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    Object.keys(attrs || {}).forEach((key)=>{
      const value = attrs[key];
      if(key === 'class') el.className = value;
      else if(key === 'text') el.textContent = value;
      else if(key === 'html') el.innerHTML = value;
      else if(key === 'checked') el.checked = !!value;
      else if(key === 'value') el.value = value == null ? '' : String(value);
      else if(value !== false && value != null) el.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : (children ? [children] : [])).forEach((child)=> el.appendChild(child));
    return el;
  }
  function resolveTechHelp(label, helpKey, opts){
    const options = opts || {};
    const key = String(helpKey || '').trim();
    const api = techApi();
    const fallbackKeys = [];
    if(key) fallbackKeys.push('hardwareTechnical.' + key, key);
    if(options.field && options.field.fieldType === 'numberRange') fallbackKeys.push('hardwareTechnical.valueFrom', 'valueFrom');
    if(options.field && options.field.fieldType === 'boolean') fallbackKeys.push('hardwareTechnical.booleanValue', 'booleanValue');
    if(options.fallbackKey) fallbackKeys.push('hardwareTechnical.' + options.fallbackKey, options.fallbackKey);
    let cfg = null;
    try{ if(FC.helpRegistry && typeof FC.helpRegistry.lookup === 'function') cfg = FC.helpRegistry.lookup(key ? 'hardwareTechnical.' + key : '', { fallbackKeys, title:label }); }catch(_){ }
    if(!(cfg && cfg.message) && api.FIELD_HELP){
      const foundKey = fallbackKeys.map((item)=> String(item || '').replace(/^hardwareTechnical\./, '')).find((item)=> api.FIELD_HELP[item]);
      if(foundKey) cfg = { title:label || foundKey, message:api.FIELD_HELP[foundKey] };
    }
    return cfg;
  }
  function openTechHelp(label, helpKey, opts){
    const cfg = resolveTechHelp(label, helpKey, opts);
    if(!cfg) return false;
    try{
      if(FC.helpRegistry && typeof FC.helpRegistry.open === 'function') return FC.helpRegistry.open(cfg, { title:label || cfg.title });
      if(FC.infoBox && typeof FC.infoBox.open === 'function') return FC.infoBox.open({ title:label || cfg.title || 'Informacja', message:cfg.message || '' });
      if(FC.panelBox && typeof FC.panelBox.open === 'function') return FC.panelBox.open({ title:label || cfg.title || 'Informacja', message:cfg.message || '', width:'560px', boxClass:'panel-box--rozrys' });
    }catch(_){ }
    return false;
  }
  function labelWithHelp(label, helpKey, opts){
    const cfg = resolveTechHelp(label, helpKey, opts);
    const row = h('div', { class:'label-help price-field-help hardware-tech-label-help' }, [h('span', { class:'label-help__text', text:label || '' })]);
    if(cfg && cfg.message){
      const btn = h('button', { type:'button', class:'info-trigger', 'aria-label':'Pokaż informację: ' + (label || '') });
      btn.addEventListener('click', ()=> openTechHelp(label, helpKey, opts));
      row.appendChild(btn);
    }
    return row;
  }
  function formatTechnicalValue(field, value){
    const api = techApi();
    if(api && typeof api.paramValueText === 'function') return api.paramValueText(field, value, { withUnit:true });
    return '';
  }
  function updateChoiceLauncherLabel(selectEl, mountId, placeholder){
    try{
      const mount = mountId ? ctx.byId(mountId) : null;
      const btn = mount && mount.querySelector ? mount.querySelector('button') : null;
      const choiceApi = FC && FC.rozrysChoice;
      if(!(btn && selectEl && choiceApi && typeof choiceApi.setChoiceLaunchValue === 'function' && typeof choiceApi.getSelectOptionLabel === 'function')) return;
      choiceApi.setChoiceLaunchValue(btn, choiceApi.getSelectOptionLabel(selectEl) || String(placeholder || ''), '');
    }catch(_){ }
  }
  function techInputSelector(key, extra){
    const safeKey = (window.CSS && typeof window.CSS.escape === 'function') ? window.CSS.escape(String(key || '')) : String(key || '').replace(/"/g, '\"');
    return '[data-tech-key="' + safeKey + '"]' + String(extra || '');
  }
  function readDynamicTechnicalParams(rootNode){
    const api = techApi();
    const fields = currentTechnicalFields();
    const root = rootNode || ctx.byId('hardwareDynamicTechnicalFields') || document;
    const out = {};
    fields.forEach((field)=>{
      const key = String(field.key || '');
      if(!key) return;
      if(field.fieldType === 'boolean'){
        const el = root.querySelector(techInputSelector(key, '[data-tech-type="boolean"]'));
        const raw = el ? String(el.value || '').trim() : '';
        out[key] = { value:raw === '' ? '' : raw === 'true' };
      }else if(field.fieldType === 'numberRange'){
        const from = root.querySelector(techInputSelector(key, '[data-tech-part="from"]'));
        const to = root.querySelector(techInputSelector(key, '[data-tech-part="to"]'));
        out[key] = { from:from ? from.value : '', to:to ? to.value : '' };
      }else{
        const el = root.querySelector(techInputSelector(key, '[data-tech-type="text"]'));
        out[key] = { value:el ? el.value : '' };
      }
    });
    return api && typeof api.normalizeParamValues === 'function' ? api.normalizeParamValues(out, getTechnicalDefinitions(), readString('hardwareCategory') || 'Inne') : out;
  }
  function setHardwareTypeValue(value, opts){
    const cfg = Object.assign({ remount:false }, opts || {});
    const raw = String(value == null ? '' : value).trim();
    const select = ctx.byId('hardwareType');
    if(!select) return;
    let found = false;
    try{ Array.from(select.options || []).forEach((opt)=>{ if(String(opt.value || '') === raw) found = true; }); }catch(_){ }
    if(raw && !found){
      try{ const option = document.createElement('option'); option.value = raw; option.textContent = raw; select.appendChild(option); }catch(_){ }
    }
    select.value = raw;
    if(cfg.remount){
      try{ if(ctx.mountChoice) ctx.mountChoice({ selectEl:select, mountId:'hardwareTypeLaunch', title:'Wybierz typ / cechę', buttonClass:'investor-choice-launch', placeholder:'Typ / cecha', onChange:()=>{ try{ ctx.updateItemActionState && ctx.updateItemActionState(); }catch(_){} } }); }catch(_){ }
    }else{
      updateChoiceLauncherLabel(select, 'hardwareTypeLaunch', 'Typ / cecha');
    }
  }
  function syncLegacyHiddenFromParams(params){
    const data = { hardwareCategory:readString('hardwareCategory') || 'Inne', technicalParams:params || readDynamicTechnicalParams() };
    const api = techApi();
    try{ if(api && typeof api.applyLegacyFieldsFromParams === 'function') api.applyLegacyFieldsFromParams(data, getTechnicalDefinitions()); }catch(_){ }
    setValue('hardwareDrawerProfile', data.drawerProfile || '');
    setValue('hardwareDrawerLengthMm', data.drawerLengthMm != null ? data.drawerLengthMm : '');
    setValue('hardwareDrawerLoadKg', data.drawerLoadKg != null ? data.drawerLoadKg : '');
    const reinf = ctx.byId('hardwareDrawerReinforced'); if(reinf) reinf.checked = !!data.drawerReinforced;
    setValue('hardwareColor', data.hardwareColor || '');
    setValue('hardwareUsage', data.hardwareUsage || '');
    setValue('hardwareTechnicalNote', data.technicalNote || '');
  }
  function syncHardwareTypeFromTechnicalParams(opts){
    const cfg = Object.assign({ updateLegacy:true, updateSelect:true, updateAction:false, remountChoice:false, root:null }, opts || {});
    const api = techApi();
    const category = readString('hardwareCategory') || 'Inne';
    const params = readDynamicTechnicalParams(cfg.root || null);
    if(cfg.updateLegacy !== false) syncLegacyHiddenFromParams(params);
    const generated = api && typeof api.buildTypeLabel === 'function' ? api.buildTypeLabel(getTechnicalDefinitions(), category, params) : '';
    if(generated && cfg.updateSelect !== false) setHardwareTypeValue(generated, { remount:!!cfg.remountChoice });
    try{ refreshTechnicalStatusNotice(cfg.root || ctx.byId('hardwareDynamicTechnicalFields') || null); }catch(_){ }
    if(cfg.updateAction){ try{ ctx.updateItemActionState && ctx.updateItemActionState(); }catch(_){ } }
    return generated;
  }
  function allowedTextOptions(field){
    const api = techApi();
    if(api && typeof api.choiceOptionsForField === 'function') return api.choiceOptionsForField(field);
    return Array.isArray(field && field.options) ? field.options.map((entry)=> String(entry == null ? '' : entry).trim()).filter(Boolean) : [];
  }
  function selectOptionLabel(selectEl, placeholder){
    try{
      const choiceApi = FC && FC.rozrysChoice;
      if(choiceApi && typeof choiceApi.getSelectOptionLabel === 'function'){
        return choiceApi.getSelectOptionLabel(selectEl) || String(placeholder || '');
      }
      const selected = selectEl && selectEl.options ? Array.from(selectEl.options).find((opt)=> opt.selected) : null;
      return selected ? String(selected.textContent || selected.label || selected.value || '') : String(placeholder || '');
    }catch(_){
      return String(placeholder || '');
    }
  }
  function runTechChoiceChange(select, field, wrap, cfg){
    const options = Object.assign({ updateAction:true }, cfg || {});
    if(options.updateAction) syncHardwareTypeFromTechnicalParams({ updateAction:true });
    try{
      const normalized = techApi().normalizeParamValue ? techApi().normalizeParamValue(field, { value:select.value }) : { value:select.value };
      const previewText = formatTechnicalValue(field, normalized);
      const preview = wrap && wrap.querySelector ? wrap.querySelector('.hardware-tech-preview') : null;
      if(preview) preview.textContent = previewText ? 'Wartość: ' + previewText : '';
    }catch(_){ }
  }
  function mountDirectTechChoice(select, mount, title, placeholder, onChange){
    const choiceApi = FC && FC.rozrysChoice;
    if(!(mount && select && choiceApi && typeof choiceApi.createChoiceLauncher === 'function' && typeof choiceApi.openRozrysChoiceOverlay === 'function')) return null;
    const label = selectOptionLabel(select, placeholder);
    const btn = choiceApi.createChoiceLauncher(label, '');
    ['investor-choice-launch','price-labor-choice-launch','hardware-tech-choice-launch'].forEach((cls)=> btn.classList.add(cls));
    const arrow = btn.querySelector && btn.querySelector('.rozrys-choice-launch__arrow');
    if(arrow) arrow.remove();
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-tech-choice-launcher', '1');
    btn.addEventListener('click', async ()=>{
      if(btn.disabled) return;
      const picked = await choiceApi.openRozrysChoiceOverlay({
        title:title || 'Wybierz wartość',
        value:String(select.value || ''),
        options:Array.from(select.options || []).map((opt)=>({
          value:String(opt.value || ''),
          label:String(opt.textContent || opt.label || opt.value || ''),
          disabled:!!opt.disabled,
          description:String(opt.getAttribute('data-description') || '').trim()
        }))
      });
      if(picked == null || String(picked) === String(select.value || '')) return;
      select.value = String(picked || '');
      if(typeof choiceApi.setChoiceLaunchValue === 'function') choiceApi.setChoiceLaunchValue(btn, selectOptionLabel(select, placeholder), '');
      if(typeof onChange === 'function') onChange(String(select.value || ''), btn);
      select.dispatchEvent(new Event('change', { bubbles:true }));
    });
    mount.innerHTML = '';
    mount.appendChild(btn);
    return btn;
  }
  function mountTechChoiceLauncher(select, mountId, field, wrap){
    const title = 'Wybierz: ' + String(field && field.label || 'wartość');
    const placeholder = 'Wybierz wartość';
    let btn = null;
    try{
      if(ctx.mountChoice){
        btn = ctx.mountChoice({ selectEl:select, mountId, title, buttonClass:'investor-choice-launch price-labor-choice-launch hardware-tech-choice-launch', placeholder, onChange:()=> runTechChoiceChange(select, field, wrap, { updateAction:true }) });
        if(btn) btn.setAttribute('data-tech-choice-launcher', '1');
      }
    }catch(_){ btn = null; }
    if(btn) return btn;
    const mount = mountId ? ctx.byId(mountId) : null;
    btn = mountDirectTechChoice(select, mount, title, placeholder, ()=> runTechChoiceChange(select, field, wrap, { updateAction:true }));
    if(btn) return btn;
    try{
      setTimeout(()=>{
        const laterMount = mountId ? ctx.byId(mountId) : null;
        if(laterMount && !laterMount.querySelector('[data-tech-choice-launcher]')){
          mountDirectTechChoice(select, laterMount, title, placeholder, ()=> runTechChoiceChange(select, field, wrap, { updateAction:true }));
        }
      }, 0);
    }catch(_){ }
    return null;
  }
  function createTextChoiceField(field, value, wrap){
    const options = allowedTextOptions(field);
    const current = value && value.value != null ? String(value.value || '').trim() : '';
    const fieldKey = String(field && field.key || '');
    const select = h('select', { class:'investor-form-input hardware-tech-choice-select', 'data-tech-key':fieldKey, 'data-tech-type':'text', 'aria-label':String(field && field.label || 'Wartość') });
    select.hidden = true;
    select.appendChild(h('option', { value:'', text:'Wybierz ' + String(field && field.label || 'wartość').toLowerCase() }));
    options.forEach((option)=> select.appendChild(h('option', { value:option, text:option })));
    select.value = options.some((option)=> option === current) ? current : '';
    const mountId = 'hardwareTechChoice_' + fieldKey.replace(/[^a-zA-Z0-9_-]+/g, '_');
    const mount = h('div', { id:mountId, class:'hardware-tech-choice-launch-slot' });
    select.addEventListener('change', ()=> runTechChoiceChange(select, field, wrap, { updateAction:true }));
    wrap.appendChild(select);
    wrap.appendChild(mount);
    mountTechChoiceLauncher(select, mountId, field, wrap);
    return select;
  }
  function technicalMissingKeySet(category, params){
    const api = techApi();
    if(!(api && typeof api.evaluateItemTechnicalStatus === 'function')) return new Set();
    const status = api.evaluateItemTechnicalStatus({ hardwareCategory:category, technicalParams:params || {} }, getTechnicalDefinitions());
    const keys = new Set();
    (Array.isArray(status && status.missing) ? status.missing : []).forEach((row)=>{
      const key = String(row && row.key || '').trim();
      if(key) keys.add(key);
    });
    return keys;
  }
  function markTechnicalFieldMissing(wrap, field, missing){
    if(!wrap || !field) return;
    wrap.classList.toggle('is-tech-required-missing', !!missing);
    let note = wrap.querySelector('.hardware-tech-required-note');
    if(missing && !note){
      note = h('div', { class:'hardware-tech-required-note', text:'Wymagane do wyceny' });
      wrap.appendChild(note);
    }else if(!missing && note){
      note.remove();
    }
  }
  function refreshTechnicalMissingHighlights(rootNode){
    const root = rootNode || ctx.byId('hardwareDynamicTechnicalFields');
    if(!root) return;
    const category = readString('hardwareCategory') || 'Inne';
    const params = readDynamicTechnicalParams(root);
    const missing = technicalMissingKeySet(category, params);
    root.querySelectorAll('[data-tech-field-wrap]').forEach((wrap)=>{
      const key = String(wrap.getAttribute('data-tech-field-key') || '').trim();
      markTechnicalFieldMissing(wrap, { key }, missing.has(key));
    });
  }

  function buildTechnicalStatusNotice(category, params){
    const api = techApi();
    if(!(api && typeof api.evaluateItemTechnicalStatus === 'function')) return null;
    const status = api.evaluateItemTechnicalStatus({ hardwareCategory:category, technicalParams:params || {} }, getTechnicalDefinitions());
    if(!(status && status.needsAttention)) return null;
    const box = h('div', { class:'hardware-tech-status-alert', 'data-tech-status-notice':'1' });
    box.appendChild(h('div', { class:'hardware-tech-status-alert__title', text:'Do uzupełnienia tech.' }));
    box.appendChild(h('div', { class:'hardware-tech-status-alert__text', text:'Pozycja nie będzie używana w automatycznej wycenie, dopóki czerwone pola nie zostaną uzupełnione.' }));
    return box;
  }
  function refreshTechnicalStatusNotice(rootNode){
    const root = rootNode || ctx.byId('hardwareDynamicTechnicalFields');
    if(!root) return;
    const old = root.querySelector('[data-tech-status-notice]');
    if(old) old.remove();
    const category = readString('hardwareCategory') || 'Inne';
    const params = readDynamicTechnicalParams(root);
    const notice = buildTechnicalStatusNotice(category, params);
    if(notice) root.insertBefore(notice, root.firstChild || null);
    refreshTechnicalMissingHighlights(root);
  }

  function renderDynamicTechnicalFields(data){
    const host = ctx.byId('hardwareDynamicTechnicalFields');
    if(!host) return;
    const src = data && typeof data === 'object' ? data : {};
    const category = readString('hardwareCategory') || src.hardwareCategory || 'Inne';
    const api = techApi();
    const defs = getTechnicalDefinitions();
    const fields = currentTechnicalFields(category);
    const values = api && typeof api.mergeLegacyValues === 'function'
      ? api.mergeLegacyValues(Object.assign({}, src, { hardwareCategory:category }), defs, category)
      : (src.technicalParams || {});
    host.innerHTML = '';
    if(!fields.length){
      host.appendChild(h('div', { class:'muted xs', text:'Brak parametrów technicznych dla tej kategorii. Dodaj je w Słownikach okuć.' }));
      return;
    }
    const grid = h('div', { class:'hardware-dynamic-tech-grid' });
    const initialMissing = technicalMissingKeySet(category, values);
    fields.forEach((field)=>{
      const value = values[field.key] || {};
      const wrap = h('div', { class:'hardware-dynamic-tech-field', 'data-tech-field-wrap':'1', 'data-tech-field-key':field.key });
      wrap.appendChild(labelWithHelp(field.label + (field.unit ? ' (' + field.unit + ')' : ''), field.key, { field, fallbackKey:field.fieldType === 'numberRange' ? 'valueFrom' : (field.fieldType === 'boolean' ? 'booleanValue' : 'name') }));
      if(field.fieldType === 'boolean'){
        const fieldKey = String(field && field.key || '');
        const raw = value && value.value;
        const select = h('select', { class:'investor-form-input hardware-tech-choice-select', 'data-tech-key':fieldKey, 'data-tech-type':'boolean', 'aria-label':String(field && field.label || 'Wartość') });
        select.hidden = true;
        select.appendChild(h('option', { value:'', text:'Nie ustawiono' }));
        select.appendChild(h('option', { value:'true', text:'Tak' }));
        select.appendChild(h('option', { value:'false', text:'Nie' }));
        select.value = raw === true ? 'true' : (raw === false ? 'false' : '');
        const mountId = 'hardwareTechChoice_' + fieldKey.replace(/[^a-zA-Z0-9_-]+/g, '_');
        const mount = h('div', { id:mountId, class:'hardware-tech-choice-launch-slot' });
        select.addEventListener('change', ()=> runTechChoiceChange(select, field, wrap, { updateAction:true }));
        wrap.appendChild(select);
        wrap.appendChild(mount);
        mountTechChoiceLauncher(select, mountId, field, wrap);
      }else if(field.fieldType === 'numberRange'){
        const row = h('div', { class:'hardware-tech-range-row' });
        const from = h('input', { class:'investor-form-input', type:'number', step:'any', placeholder:'od / dokładnie', value:value && value.from != null ? value.from : '', 'data-tech-key':field.key, 'data-tech-part':'from' });
        const to = h('input', { class:'investor-form-input', type:'number', step:'any', placeholder:'do', value:value && value.to != null ? value.to : '', 'data-tech-key':field.key, 'data-tech-part':'to' });
        from.addEventListener('input', ()=> syncHardwareTypeFromTechnicalParams({ updateAction:true })); to.addEventListener('input', ()=> syncHardwareTypeFromTechnicalParams({ updateAction:true }));
        row.appendChild(from); row.appendChild(to);
        wrap.appendChild(row);
      }else{
        const options = allowedTextOptions(field);
        if(options.length){
          createTextChoiceField(field, value, wrap);
        }else{
          const input = h('input', { class:'investor-form-input', type:'text', placeholder:'', value:value && value.value || '', 'data-tech-key':field.key, 'data-tech-type':'text' });
          input.addEventListener('input', ()=> syncHardwareTypeFromTechnicalParams({ updateAction:true }));
          wrap.appendChild(input);
        }
      }
      const preview = formatTechnicalValue(field, value);
      if(preview) wrap.appendChild(h('div', { class:'muted xs hardware-tech-preview', text:'Wartość: ' + preview }));
      markTechnicalFieldMissing(wrap, field, initialMissing.has(String(field.key || '')));
      grid.appendChild(wrap);
    });
    const initialNotice = buildTechnicalStatusNotice(category, values);
    if(initialNotice) host.appendChild(initialNotice);
    host.appendChild(grid);
    refreshTechnicalMissingHighlights(host);
    syncHardwareTypeFromTechnicalParams({ root:host, updateAction:false, remountChoice:false });
  }
  function findSupplier(id){
    const key = String(id || '');
    return getSuppliers().find((row)=> String(row && row.id || '') === key) || null;
  }
  function netToGross(value, vat){ return FC.hardwareCatalog && FC.hardwareCatalog.netToGross ? FC.hardwareCatalog.netToGross(value, vat) : round2(num(value) * (1 + num(vat) / 100)); }
  function grossToNet(value, vat){ return FC.hardwareCatalog && FC.hardwareCatalog.grossToNet ? FC.hardwareCatalog.grossToNet(value, vat) : round2(num(value) / (1 + num(vat) / 100)); }
  function bundleApi(){ return ctx.priceModalHardwareBundle || {}; }
  function supplierPricesApi(){ return ctx.priceModalHardwareSupplierPrices || {}; }

  const FIELD_IDS = [
    'hardwareCategory','hardwareUnit','hardwareType','hardwareStatus','hardwareSeries','hardwareDrawerProfile','hardwareDrawerLengthMm','hardwareDrawerLoadKg','hardwareDrawerReinforced','hardwareColor','hardwareUsage','hardwareTechnicalNote','hardwareSupplierId','hardwarePriceSource',
    'hardwareVatRate','hardwareCatalogPriceNet','hardwareCatalogPriceGross','hardwareSupplierDiscountPercent',
    'hardwarePurchasePriceNet','hardwarePurchasePriceGross','hardwareQuoteBase','hardwarePricingMode',
    'hardwareMarkupPercent','hardwareQuotePriceNet','hardwareQuotePriceGross','hardwarePriceUpdatedAt','hardwareNote',
    'hardwareBundleCostMode'
  ];

  function currentEditingId(){
    try{ const state = ctx.appUiState && ctx.appUiState(); return String(state && state.editingId || ''); }catch(_){ return ''; }
  }

  function refreshHardwareTypeOptions(selectedValue){
    if(!(ctx.buildHardwareTypeOptions && ctx.setSelectOptions)) return;
    const currentType = selectedValue != null ? String(selectedValue || '') : readString('hardwareType');
    const category = readString('hardwareCategory') || 'Inne';
    const manufacturer = readString('formManufacturer');
    ctx.setSelectOptions(ctx.byId('hardwareType'), ctx.buildHardwareTypeOptions(category, currentType, { manufacturer, hardwareSystem:ctx.byId('hardwareSeries') && ctx.byId('hardwareSeries').value, currentId:currentEditingId() }), currentType, currentType);
  }

  function defaultAccessoryDraft(){
    const settings = getSettings();
    const supplier = findSupplier(settings.defaultSupplierId) || getSuppliers()[0] || null;
    const manufacturer = ctx.firstNonEmptyValue(ctx.buildManufacturerOptions('accessories', '', '', { includeAll:false }));
    const category = ctx.firstNonEmptyValue(ctx.buildHardwareCategoryOptions ? ctx.buildHardwareCategoryOptions('Zawiasy') : [{ value:'Zawiasy' }]) || 'Zawiasy';
    return {
      manufacturer, symbol:'', name:'', price:'', hardwareCategory:category, hardwareType:'', hardwareUnit:'szt.', hardwareSystem:'', series:'', drawerProfile:'', drawerLengthMm:'', drawerLoadKg:'', drawerReinforced:false, hardwareColor:'', hardwareUsage:'', technicalNote:'', technicalParams:{},
      supplierId:supplier ? supplier.id : (settings.defaultSupplierId || ''), priceSource:supplier ? supplier.name : '',
      vatRate:settings.defaultVatRate || 23, catalogPriceNet:'', catalogPriceGross:'',
      supplierDiscountPercent:supplier ? supplier.defaultDiscountPercent : 0, purchasePriceNet:'', purchasePriceGross:'',
      quoteBase:settings.defaultQuoteBase || 'catalogGross', pricingMode:settings.defaultPricingMode || 'markup', markupPercent:settings.defaultMarkupPercent || 20,
      quotePriceNet:'', quotePriceGross:'', priceUpdatedAt:todayIso(), status:'active', note:'',
      bundleCostMode:'ownPrice', bundleItems:[], bundleComponentsCatalogGross:0, bundleComponentsPurchaseGross:0, supplierPrices:[],
    };
  }

  function clearPairIfSourceEmpty(sourceId){
    const raw = readString(sourceId);
    if(raw !== '') return false;
    if(sourceId === 'hardwareCatalogPriceNet' || sourceId === 'hardwareCatalogPriceGross'){
      setValue('hardwareCatalogPriceNet', ''); setValue('hardwareCatalogPriceGross', '');
      setValue('hardwarePurchasePriceNet', ''); setValue('hardwarePurchasePriceGross', '');
      if(readString('hardwarePricingMode') === 'markup'){ setValue('hardwareQuotePriceNet', ''); setValue('hardwareQuotePriceGross', ''); }
      return true;
    }
    if((sourceId === 'hardwareQuotePriceNet' || sourceId === 'hardwareQuotePriceGross') && readString('hardwarePricingMode') === 'manualPrice'){
      setValue('hardwareQuotePriceNet', ''); setValue('hardwareQuotePriceGross', '');
      return true;
    }
    return false;
  }

  function syncCatalogAndPurchase(sourceId, vat, discount, bundleMode){
    const bundle = bundleApi();
    const bundleComponentsMode = bundle && typeof bundle.isVisible === 'function' && bundle.isVisible() && bundleMode === 'components';
    let catalogNet = num(readString('hardwareCatalogPriceNet'));
    let catalogGross = num(readString('hardwareCatalogPriceGross'));
    let purchaseGross = 0;
    let purchaseNet = 0;
    if(bundle && typeof bundle.updatePreview === 'function') bundle.updatePreview();
    if(bundleComponentsMode){
      const totals = typeof bundle.getTotals === 'function' ? bundle.getTotals() : { catalogGross:0, purchaseGross:0 };
      catalogGross = totals.catalogGross; catalogNet = catalogGross > 0 ? grossToNet(catalogGross, vat) : 0;
      purchaseGross = totals.purchaseGross; purchaseNet = purchaseGross > 0 ? grossToNet(purchaseGross, vat) : 0;
      setValue('hardwareCatalogPriceGross', fmt(catalogGross)); setValue('hardwareCatalogPriceNet', fmt(catalogNet));
      setValue('hardwarePurchasePriceGross', fmt(purchaseGross)); setValue('hardwarePurchasePriceNet', fmt(purchaseNet));
      disableField('hardwareCatalogPriceGross', true, 'Cena katalogowa jest liczona ze składników zestawu.');
      disableField('hardwareCatalogPriceNet', true, 'Cena katalogowa jest liczona ze składników zestawu.');
      disableField('hardwareSupplierDiscountPercent', true, 'Rabat dostawcy nie działa w trybie liczenia zestawu ze składników.');
      return { catalogGross, catalogNet, purchaseGross, purchaseNet };
    }
    disableField('hardwareCatalogPriceGross', false); disableField('hardwareCatalogPriceNet', false); disableField('hardwareSupplierDiscountPercent', false);
    if(!clearPairIfSourceEmpty(sourceId)){
      if(sourceId === 'hardwareCatalogPriceNet' && catalogNet > 0){ catalogGross = netToGross(catalogNet, vat); setValue('hardwareCatalogPriceGross', fmt(catalogGross)); }
      else if(sourceId === 'hardwareCatalogPriceGross' && catalogGross > 0){ catalogNet = grossToNet(catalogGross, vat); setValue('hardwareCatalogPriceNet', fmt(catalogNet)); }
      else if(catalogGross > 0 && catalogNet <= 0){ catalogNet = grossToNet(catalogGross, vat); setValue('hardwareCatalogPriceNet', fmt(catalogNet)); }
      else if(catalogNet > 0 && catalogGross <= 0){ catalogGross = netToGross(catalogNet, vat); setValue('hardwareCatalogPriceGross', fmt(catalogGross)); }
    }
    catalogNet = num(readString('hardwareCatalogPriceNet')); catalogGross = num(readString('hardwareCatalogPriceGross'));
    purchaseGross = round2(catalogGross * (1 - discount / 100)); purchaseNet = round2(catalogNet * (1 - discount / 100));
    if(purchaseGross <= 0 && purchaseNet > 0) purchaseGross = netToGross(purchaseNet, vat);
    if(purchaseNet <= 0 && purchaseGross > 0) purchaseNet = grossToNet(purchaseGross, vat);
    setValue('hardwarePurchasePriceGross', fmt(purchaseGross)); setValue('hardwarePurchasePriceNet', fmt(purchaseNet));
    return { catalogGross, catalogNet, purchaseGross, purchaseNet };
  }

  function syncQuotePrice(sourceId, vat, pricingMode, quoteBase, catalogGross, purchaseGross){
    let baseGross = catalogGross;
    if(quoteBase === 'purchaseGross') baseGross = purchaseGross;
    if(quoteBase === 'manualGross') baseGross = num(readString('hardwareQuotePriceGross')) || catalogGross;
    let quoteGross = num(readString('hardwareQuotePriceGross'));
    let quoteNet = num(readString('hardwareQuotePriceNet'));
    if(pricingMode === 'markup'){
      const markup = num(readString('hardwareMarkupPercent'));
      quoteGross = round2(baseGross * (1 + markup / 100)); quoteNet = quoteGross > 0 ? grossToNet(quoteGross, vat) : 0;
      setValue('hardwareQuotePriceGross', fmt(quoteGross)); setValue('hardwareQuotePriceNet', fmt(quoteNet));
      disableField('hardwareMarkupPercent', false);
      disableField('hardwareQuotePriceGross', true, 'Cena do wyceny jest liczona z ceny bazowej i narzutu. Zmień tryb na Cena ręczna, aby wpisać ją ręcznie.');
      disableField('hardwareQuotePriceNet', true, 'Cena do wyceny jest liczona z ceny bazowej i narzutu.');
      setText('hardwareEffectiveMarkupPreview', 'Tryb narzutu: ' + (num(readString('hardwareMarkupPercent')) || 0).toFixed(2) + '%');
      return quoteGross;
    }
    disableField('hardwareMarkupPercent', true, 'Wyłączone, bo cena do wyceny jest wpisywana ręcznie. Narzut wynikowy jest pokazany poniżej.');
    disableField('hardwareQuotePriceGross', false); disableField('hardwareQuotePriceNet', false);
    const cleared = clearPairIfSourceEmpty(sourceId);
    quoteGross = num(readString('hardwareQuotePriceGross')); quoteNet = num(readString('hardwareQuotePriceNet'));
    if(!cleared){
      if(sourceId === 'hardwareQuotePriceNet' && quoteNet > 0){ quoteGross = netToGross(quoteNet, vat); setValue('hardwareQuotePriceGross', fmt(quoteGross)); }
      else if(sourceId === 'hardwareQuotePriceGross' && quoteGross > 0){ quoteNet = grossToNet(quoteGross, vat); setValue('hardwareQuotePriceNet', fmt(quoteNet)); }
      else if(quoteGross > 0 && quoteNet <= 0){ quoteNet = grossToNet(quoteGross, vat); setValue('hardwareQuotePriceNet', fmt(quoteNet)); }
    }
    quoteGross = num(readString('hardwareQuotePriceGross'));
    const effective = baseGross > 0 && quoteGross > 0 ? round2(((quoteGross / baseGross) - 1) * 100) : 0;
    setText('hardwareEffectiveMarkupPreview', 'Narzut wynikowy: ' + effective.toFixed(2) + '%');
    return quoteGross;
  }

  function syncHardwarePricing(opts){
    if(ctx.currentListKind && ctx.currentListKind() !== 'accessories') return;
    const cfg = Object.assign({ sourceId:'' }, opts || {});
    const vat = num(readString('hardwareVatRate')) || 23;
    const discount = num(readString('hardwareSupplierDiscountPercent'));
    const pricingMode = readString('hardwarePricingMode') || 'markup';
    const quoteBase = readString('hardwareQuoteBase') || 'catalogGross';
    const bundleMode = readString('hardwareBundleCostMode') || 'ownPrice';
    const cost = syncCatalogAndPurchase(cfg.sourceId || '', vat, discount, bundleMode);
    const quoteGross = syncQuotePrice(cfg.sourceId || '', vat, pricingMode, quoteBase, cost.catalogGross, cost.purchaseGross);
    const margin = round2((num(readString('hardwareQuotePriceGross')) || 0) - cost.purchaseGross);
    const marginPct = cost.purchaseGross > 0 ? round2((margin / cost.purchaseGross) * 100) : 0;
    setText('hardwareMarginPreview', 'Marża względem realnego zakupu: ' + margin.toFixed(2) + ' PLN brutto' + (cost.purchaseGross > 0 ? ' (' + marginPct.toFixed(2) + '%)' : ''));
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = fmt(quoteGross);
  }

  function applySupplierDefaults(){
    const supplier = findSupplier(readString('hardwareSupplierId'));
    if(!supplier) return;
    setValue('hardwarePriceSource', supplier.name || '');
    setValue('hardwareSupplierDiscountPercent', supplier.defaultDiscountPercent || 0);
    setValue('hardwareVatRate', getSettings().defaultVatRate || 23);
    syncHardwarePricing({ sourceId:'hardwareSupplierId' });
  }

  function getCurrentAccessoryDraft(opts){
    const cfg = Object.assign({ passive:false }, opts || {});
    const bundle = bundleApi();
    const totals = bundle && typeof bundle.getTotals === 'function' ? bundle.getTotals() : { catalogGross:0, purchaseGross:0 };
    const priceGross = num(readString('hardwareQuotePriceGross')) || num(ctx.byId('formPrice') && ctx.byId('formPrice').value);
    const supplier = findSupplier(readString('hardwareSupplierId'));
    const supplierPrices = supplierPricesApi();
    const dynamicTechnicalParams = readDynamicTechnicalParams();
    const generatedHardwareType = cfg.passive
      ? ((techApi() && typeof techApi().buildTypeLabel === 'function') ? techApi().buildTypeLabel(getTechnicalDefinitions(), readString('hardwareCategory') || 'Inne', dynamicTechnicalParams) : '') || readString('hardwareType')
      : (syncHardwareTypeFromTechnicalParams({ updateAction:false, remountChoice:false }) || readString('hardwareType'));
    return {
      manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(),
      symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(),
      name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(),
      price:priceGross,
      hardwareCategory:readString('hardwareCategory') || 'Inne', hardwareType:generatedHardwareType, hardwareUnit:readString('hardwareUnit') || 'szt.', hardwareSystem:readString('hardwareSeries'), series:readString('hardwareSeries'),
      drawerProfile:readString('hardwareDrawerProfile'), drawerLengthMm:readNumber('hardwareDrawerLengthMm'), drawerLoadKg:readNumber('hardwareDrawerLoadKg'), drawerReinforced:!!(ctx.byId('hardwareDrawerReinforced') && ctx.byId('hardwareDrawerReinforced').checked), hardwareColor:readString('hardwareColor'), hardwareUsage:readString('hardwareUsage'), technicalNote:readString('hardwareTechnicalNote'), technicalParams:dynamicTechnicalParams, hardwareTypeAuto:true,
      supplierId:readString('hardwareSupplierId'), supplierName:supplier ? supplier.name : readString('hardwarePriceSource'), priceSource:readString('hardwarePriceSource') || (supplier ? supplier.name : ''),
      supplierPrices:(supplierPrices && typeof supplierPrices.getItems === 'function') ? supplierPrices.getItems() : [],
      vatRate:readNumber('hardwareVatRate'), catalogPriceNet:readNumber('hardwareCatalogPriceNet'), catalogPriceGross:readNumber('hardwareCatalogPriceGross'), supplierDiscountPercent:readNumber('hardwareSupplierDiscountPercent'),
      purchasePriceNet:readNumber('hardwarePurchasePriceNet'), purchasePriceGross:readNumber('hardwarePurchasePriceGross'), purchasePrice:readNumber('hardwarePurchasePriceGross'),
      quoteBase:readString('hardwareQuoteBase') || 'catalogGross', pricingMode:readString('hardwarePricingMode') || 'markup', markupPercent:readNumber('hardwareMarkupPercent'),
      quotePriceNet:readNumber('hardwareQuotePriceNet'), quotePriceGross:priceGross, priceUpdatedAt:readString('hardwarePriceUpdatedAt'), status:readString('hardwareStatus') || 'active', note:readString('hardwareNote'),
      bundleCostMode:(bundle && typeof bundle.isVisible === 'function' && bundle.isVisible()) ? (readString('hardwareBundleCostMode') || 'ownPrice') : 'ownPrice',
      bundleItems:(bundle && typeof bundle.isVisible === 'function' && bundle.isVisible() && typeof bundle.getItems === 'function') ? bundle.getItems() : [],
      bundleComponentsCatalogGross:(bundle && typeof bundle.isVisible === 'function' && bundle.isVisible()) ? totals.catalogGross : 0,
      bundleComponentsPurchaseGross:(bundle && typeof bundle.isVisible === 'function' && bundle.isVisible()) ? totals.purchaseGross : 0,
    };
  }

  function applyAccessoryFormState(item){
    const data = Object.assign(defaultAccessoryDraft(), item || {});
    setupTechnicalAccordion();
    const bundle = bundleApi();
    const supplierPrices = supplierPricesApi();
    if(bundle && typeof bundle.setItems === 'function') bundle.setItems(data.bundleItems || []);
    if(supplierPrices && typeof supplierPrices.setItems === 'function') supplierPrices.setItems(data);
    ctx.setSelectOptions(ctx.byId('formManufacturer'), ctx.buildManufacturerOptions('accessories', '', data && data.manufacturer), String(data && data.manufacturer || ''), String(data && data.manufacturer || ''));
    if(ctx.byId('formSymbol')) ctx.byId('formSymbol').value = String(data && data.symbol || '');
    if(ctx.byId('formName')) ctx.byId('formName').value = String(data && data.name || '');
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = data && data.price != null ? data.price : '';
    if(ctx.byId('formHasGrain')) ctx.byId('formHasGrain').checked = false;
    if(ctx.buildHardwareCategoryOptions) ctx.setSelectOptions(ctx.byId('hardwareCategory'), ctx.buildHardwareCategoryOptions(data && data.hardwareCategory), String(data && data.hardwareCategory || 'Inne'), String(data && data.hardwareCategory || 'Inne'));
    if(ctx.buildHardwareUnitOptions) ctx.setSelectOptions(ctx.byId('hardwareUnit'), ctx.buildHardwareUnitOptions(data && data.hardwareUnit), String(data && data.hardwareUnit || 'szt.'), String(data && data.hardwareUnit || 'szt.'));
    if(ctx.buildHardwareTypeOptions) ctx.setSelectOptions(ctx.byId('hardwareType'), ctx.buildHardwareTypeOptions(data && data.hardwareCategory, data && data.hardwareType, { manufacturer:data && data.manufacturer, hardwareSystem:data && (data.hardwareSystem || data.series), currentId:data && data.id || currentEditingId() }), String(data && data.hardwareType || ''), String(data && data.hardwareType || ''));
    if(ctx.buildHardwareStatusOptions) ctx.setSelectOptions(ctx.byId('hardwareStatus'), ctx.buildHardwareStatusOptions(), String(data && data.status || 'active'), 'Aktywne');
    if(ctx.buildHardwareSupplierOptions) ctx.setSelectOptions(ctx.byId('hardwareSupplierId'), ctx.buildHardwareSupplierOptions(data && data.supplierId), String(data && data.supplierId || ''), String(data && data.supplierId || ''));
    if(ctx.buildHardwareQuoteBaseOptions) ctx.setSelectOptions(ctx.byId('hardwareQuoteBase'), ctx.buildHardwareQuoteBaseOptions(), String(data && data.quoteBase || 'catalogGross'), 'Cena katalogowa bez rabatu');
    if(ctx.buildHardwarePricingModeOptions) ctx.setSelectOptions(ctx.byId('hardwarePricingMode'), ctx.buildHardwarePricingModeOptions(), String(data && data.pricingMode || 'markup'), 'Narzut %');
    if(ctx.buildHardwareBundleCostModeOptions) ctx.setSelectOptions(ctx.byId('hardwareBundleCostMode'), ctx.buildHardwareBundleCostModeOptions(), String(data && data.bundleCostMode || 'ownPrice'), 'Własna cena zestawu');
    setValue('hardwareSeries', data && (data.hardwareSystem || data.series) || ''); setValue('hardwarePriceSource', data && data.priceSource || ''); setValue('hardwareVatRate', getSettings().defaultVatRate || 23);
    setValue('hardwareDrawerProfile', data && data.drawerProfile || ''); setValue('hardwareDrawerLengthMm', data && data.drawerLengthMm != null ? data.drawerLengthMm : ''); setValue('hardwareDrawerLoadKg', data && data.drawerLoadKg != null ? data.drawerLoadKg : '');
    if(ctx.byId('hardwareDrawerReinforced')) ctx.byId('hardwareDrawerReinforced').checked = !!(data && data.drawerReinforced);
    setValue('hardwareColor', data && data.hardwareColor || ''); setValue('hardwareUsage', data && data.hardwareUsage || ''); setValue('hardwareTechnicalNote', data && data.technicalNote || '');
    renderDynamicTechnicalFields(data);
    setValue('hardwareCatalogPriceNet', data && data.catalogPriceNet != null ? data.catalogPriceNet : ''); setValue('hardwareCatalogPriceGross', data && data.catalogPriceGross != null ? data.catalogPriceGross : '');
    setValue('hardwareSupplierDiscountPercent', data && data.supplierDiscountPercent != null ? data.supplierDiscountPercent : ''); setValue('hardwarePurchasePriceNet', data && data.purchasePriceNet != null ? data.purchasePriceNet : '');
    setValue('hardwarePurchasePriceGross', data && (data.purchasePriceGross != null ? data.purchasePriceGross : data.purchasePrice) || ''); setValue('hardwareMarkupPercent', data && data.markupPercent != null ? data.markupPercent : '');
    setValue('hardwareQuotePriceNet', data && data.quotePriceNet != null ? data.quotePriceNet : ''); setValue('hardwareQuotePriceGross', data && (data.quotePriceGross != null ? data.quotePriceGross : data.price) || '');
    setValue('hardwarePriceUpdatedAt', data && data.priceUpdatedAt || ''); setValue('hardwareNote', data && data.note || '');
    if(supplierPrices && typeof supplierPrices.applySelectedToLegacyFields === 'function') supplierPrices.applySelectedToLegacyFields();
    if(bundle && typeof bundle.render === 'function') bundle.render();
    syncHardwarePricing({ sourceId:'' });
  }


  function setupTechnicalAccordion(){
    const toggle = ctx.byId('hardwareTechnicalToggle');
    const body = ctx.byId('hardwareTechnicalBody');
    if(!(toggle && body) || toggle.__fcTechnicalBound) return;
    toggle.__fcTechnicalBound = true;
    toggle.addEventListener('click', ()=>{
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      body.hidden = expanded;
    });
  }

  function handleHardwareFieldInput(event){
    const target = event && event.target;
    const id = target && target.id ? String(target.id) : '';
    if(id === 'hardwareSupplierId') applySupplierDefaults();
    else {
      const bundle = bundleApi();
      if(id === 'hardwareCategory') renderDynamicTechnicalFields(getCurrentAccessoryDraft({ passive:true }));
      if((id === 'hardwareCategory' || id === 'formManufacturer') && ctx.buildHardwareTypeOptions){
        const currentType = readString('hardwareType');
        refreshHardwareTypeOptions(currentType);
        try{ ctx.mountChoice && ctx.mountChoice({ selectEl:ctx.byId('hardwareType'), mountId:'hardwareTypeLaunch', title:'Wybierz typ / cechę', buttonClass:'investor-choice-launch', placeholder:'Typ / cecha', onChange:()=>{ try{ ctx.updateItemActionState && ctx.updateItemActionState(); }catch(_){} } }); }catch(_){}
      }
      if((id === 'hardwareUnit' || id === 'hardwareBundleCostMode') && bundle && typeof bundle.render === 'function') bundle.render();
      syncHardwarePricing({ sourceId:id });
    }
  }

  ctx.priceModalHardwareForm = { FIELD_IDS, defaultAccessoryDraft, getCurrentAccessoryDraft, applyAccessoryFormState, syncHardwarePricing, handleHardwareFieldInput, applySupplierDefaults, _debug:{ readDynamicTechnicalParams, renderDynamicTechnicalFields, syncHardwareTypeFromTechnicalParams, refreshTechnicalStatusNotice } };
})();
