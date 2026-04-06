// js/app/material/price-modal.js
// Kontekstowe katalogi/cenniki: materiały, akcesoria, stawki wyceny mebli, usługi stolarskie.

(function(){
  'use strict';
  window.FC = window.FC || {};
  window.FC.priceModal = window.FC.priceModal || {};
  const FC = window.FC;

  const MATERIAL_TYPES = ['laminat','akryl','lakier','blat'];
  const QUOTE_RATE_CATEGORIES = ['Montaż','AGD','Pomiar','Transport','Projekt','Inne'];
  const WORKSHOP_SERVICE_CATEGORIES = ['Cięcie','Oklejanie','Montaż','Naprawa','Transport','Inne'];
  const runtimeState = {
    itemModalOpen:false,
    itemInitialSignature:'',
    filters:{ materialType:'', manufacturer:'', category:'' },
  };

  function byId(id){ return document.getElementById(id); }
  function appUiState(){ return (typeof uiState !== 'undefined' && uiState) ? uiState : ((FC.uiState && FC.uiState.get) ? FC.uiState.get() : {}); }
  function catalogStore(){ return FC.catalogStore || null; }
  function currentListKind(){
    const kind = String((appUiState() && appUiState().showPriceList) || 'materials');
    return ['materials','accessories','quoteRates','workshopServices'].includes(kind) ? kind : 'materials';
  }
  function currentConfig(){ return catalogStore() && catalogStore().getPriceConfig ? catalogStore().getPriceConfig(currentListKind()) : { key:'materials', title:'Cennik materiałów', subtitle:'', addLabel:'Dodaj', icon:'🧩', formKind:'material' }; }
  function currentList(){ return catalogStore() && catalogStore().getPriceList ? catalogStore().getPriceList(currentListKind()) : []; }
  function persistUi(){ try{ FC.storage.setJSON(STORAGE_KEYS.ui, appUiState()); }catch(_){ } }
  function normalizeKey(value){ return String(value == null ? '' : value).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
  function info(title, message){ try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title, message }); }catch(_){ } }
  function askConfirm(opts){ try{ return FC.confirmBox && FC.confirmBox.ask ? FC.confirmBox.ask(opts || {}) : Promise.resolve(true); }catch(_){ return Promise.resolve(true); } }
  function confirmDelete(){ return askConfirm({ title:'Usunąć pozycję?', message:'Tej operacji nie cofnisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' }).then(Boolean); }
  function confirmDiscard(){ return askConfirm({ title:'ANULOWAĆ ZMIANY?', message:'Niezapisane zmiany w tej pozycji zostaną utracone.', confirmText:'✕ ANULUJ ZMIANY', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' }).then(Boolean); }
  function confirmSave(){
    const isEdit = !!(appUiState() && appUiState().editingId);
    const cfg = currentConfig();
    return askConfirm({ title:'ZAPISAĆ ZMIANY?', message:isEdit ? 'Zapisać zmiany w tej pozycji katalogu?' : ('Dodać nową pozycję do: ' + cfg.title + '?'), confirmText:'Zapisz', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' }).then(Boolean);
  }

  function ensureOption(selectEl, value, label){
    if(!selectEl) return null;
    const key = String(value == null ? '' : value);
    const existing = Array.from(selectEl.options || []).find((opt)=> String(opt.value || '') === key);
    if(existing) return existing;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = String(label == null ? key : label);
    selectEl.appendChild(opt);
    return opt;
  }

  function setSelectOptions(selectEl, options, selectedValue, fallbackLabel){
    if(!selectEl) return;
    const prev = String(selectedValue == null ? '' : selectedValue);
    selectEl.innerHTML = '';
    (Array.isArray(options) ? options : []).forEach((entry)=>{
      const item = entry && typeof entry === 'object' ? entry : { value:entry, label:entry };
      ensureOption(selectEl, item.value, item.label);
    });
    if(prev && !Array.from(selectEl.options || []).some((opt)=> String(opt.value || '') === prev)) ensureOption(selectEl, prev, fallbackLabel || prev);
    selectEl.value = prev;
    if(String(selectEl.value || '') !== prev){
      const first = Array.from(selectEl.options || []).find((opt)=> String(opt.value || '') !== '') || (selectEl.options && selectEl.options[0]) || null;
      selectEl.value = first ? String(first.value || '') : '';
    }
  }

  function buildOrderedValues(baseList, dynamicList, selectedValue, includeAllLabel){
    const seen = new Set();
    const out = [];
    if(includeAllLabel != null){ out.push({ value:'', label:includeAllLabel }); seen.add(''); }
    function add(value){
      const raw = String(value == null ? '' : value).trim();
      if(!raw && includeAllLabel == null) return;
      if(seen.has(raw)) return;
      seen.add(raw);
      out.push({ value:raw, label:raw || includeAllLabel || '' });
    }
    (Array.isArray(baseList) ? baseList : []).forEach(add);
    (Array.isArray(dynamicList) ? dynamicList : []).forEach(add);
    if(selectedValue != null) add(selectedValue);
    return out;
  }

  function buildMaterialTypeOptions(selectedValue, opts){
    const cfg = Object.assign({ includeAll:false }, opts || {});
    const fromItems = currentListKind() === 'materials' ? currentList().map((item)=> item && item.materialType) : [];
    return buildOrderedValues(MATERIAL_TYPES, fromItems, selectedValue, cfg.includeAll ? 'Wszystkie typy' : null);
  }

  function buildManufacturerOptions(kind, typeVal, selectedValue, opts){
    const knownKinds = ['materials','accessories','quoteRates','workshopServices'];
    let listKind = String(kind || 'materials');
    let currentType = typeVal;
    let currentSelected = selectedValue;
    let currentOpts = opts;
    if(!knownKinds.includes(listKind)){
      currentOpts = selectedValue;
      currentSelected = typeVal;
      currentType = listKind === 'akcesoria' ? '' : listKind;
      listKind = listKind === 'akcesoria' ? 'accessories' : 'materials';
    }
    const cfg = Object.assign({ includeAll:false }, currentOpts || {});
    const registry = FC.materialRegistry || {};
    const list = listKind === currentListKind() ? currentList() : [];
    const source = [];
    if(listKind === 'accessories'){
      source.push(...((registry.ACCESSORY_MANUFACTURERS || []).slice()));
      list.forEach((item)=> source.push(item && item.manufacturer));
      return buildOrderedValues([], source, currentSelected, cfg.includeAll ? 'Wszyscy producenci' : null);
    }
    const manufacturers = registry.MANUFACTURERS || {};
    const normalizedType = String(currentType || '').trim();
    if(normalizedType){
      source.push(...((manufacturers[normalizedType] || []).slice()));
      list.forEach((item)=>{ if(String(item && item.materialType || '') === normalizedType) source.push(item && item.manufacturer); });
    }else{
      Object.keys(manufacturers).forEach((key)=> source.push(...(manufacturers[key] || [])));
      list.forEach((item)=> source.push(item && item.manufacturer));
    }
    return buildOrderedValues([], source, currentSelected, cfg.includeAll ? 'Wszyscy producenci' : null);
  }

  function buildCategoryOptions(kind, selectedValue, opts){
    const cfg = Object.assign({ includeAll:false }, opts || {});
    const base = kind === 'workshopServices' ? WORKSHOP_SERVICE_CATEGORIES : QUOTE_RATE_CATEGORIES;
    const dynamic = currentList().map((item)=> item && item.category);
    return buildOrderedValues(base, dynamic, selectedValue, cfg.includeAll ? 'Wszystkie kategorie' : null);
  }

  function mountChoice(opts){
    const cfg = Object.assign({ selectEl:null, mountId:'', title:'Wybierz', buttonClass:'investor-choice-launch', disabled:false, placeholder:'Wybierz', onChange:null }, opts || {});
    const selectEl = cfg.selectEl;
    const mount = cfg.mountId ? byId(cfg.mountId) : null;
    if(!(mount && selectEl && FC.investorChoice && typeof FC.investorChoice.mountChoice === 'function')) return null;
    return FC.investorChoice.mountChoice({ mount, selectEl, title:cfg.title, buttonClass:cfg.buttonClass, disabled:!!cfg.disabled, placeholder:cfg.placeholder, onChange:cfg.onChange });
  }

  function filterMaterialWrapper(){ return byId('formMaterialTypeLaunch') && byId('formMaterialTypeLaunch').parentElement; }
  function filterManufacturerWrapper(){ return byId('formManufacturerLaunch') && byId('formManufacturerLaunch').parentElement; }
  function formCategoryWrapper(){ return byId('formCategoryLaunch') && byId('formCategoryLaunch').parentElement; }
  function formServiceNameWrapper(){ return byId('formServiceName') && byId('formServiceName').parentElement; }
  function formHasGrainRow(){ return byId('formHasGrain') && byId('formHasGrain').parentElement; }

  function mountFilterChoices(){
    const kind = currentListKind();
    const materialTypeEl = byId('priceFilterMaterialType');
    const manufacturerEl = byId('priceFilterManufacturer');
    const categoryEl = byId('priceFilterCategory');
    if(kind === 'materials'){
      mountChoice({ selectEl:materialTypeEl, mountId:'priceFilterMaterialTypeLaunch', title:'Wybierz typ materiału', buttonClass:'investor-choice-launch', placeholder:'Wszystkie typy', onChange:(value)=>{ runtimeState.filters.materialType = String(value || ''); syncFilterSelects(); renderPriceList(); } });
      mountChoice({ selectEl:manufacturerEl, mountId:'priceFilterManufacturerLaunch', title:'Wybierz producenta', buttonClass:'investor-choice-launch', placeholder:'Wszyscy producenci', onChange:(value)=>{ runtimeState.filters.manufacturer = String(value || ''); syncFilterSelects(); renderPriceList(); } });
      return;
    }
    if(kind === 'accessories'){
      mountChoice({ selectEl:manufacturerEl, mountId:'priceFilterManufacturerLaunch', title:'Wybierz producenta', buttonClass:'investor-choice-launch', placeholder:'Wszyscy producenci', onChange:(value)=>{ runtimeState.filters.manufacturer = String(value || ''); syncFilterSelects(); renderPriceList(); } });
      return;
    }
    mountChoice({ selectEl:categoryEl, mountId:'priceFilterCategoryLaunch', title:'Wybierz kategorię', buttonClass:'investor-choice-launch', placeholder:'Wszystkie kategorie', onChange:(value)=>{ runtimeState.filters.category = String(value || ''); syncFilterSelects(); renderPriceList(); } });
  }

  function syncFilterSelects(){
    const kind = currentListKind();
    const materialTypeEl = byId('priceFilterMaterialType');
    const manufacturerEl = byId('priceFilterManufacturer');
    const categoryEl = byId('priceFilterCategory');
    if(kind === 'materials'){
      setSelectOptions(materialTypeEl, buildMaterialTypeOptions(runtimeState.filters.materialType, { includeAll:true }), runtimeState.filters.materialType, 'Wszystkie typy');
      setSelectOptions(manufacturerEl, buildManufacturerOptions('materials', runtimeState.filters.materialType, runtimeState.filters.manufacturer, { includeAll:true }), runtimeState.filters.manufacturer, 'Wszyscy producenci');
    } else if(kind === 'accessories'){
      setSelectOptions(materialTypeEl, [{ value:'', label:'Wszystkie akcesoria' }], '', 'Wszystkie akcesoria');
      setSelectOptions(manufacturerEl, buildManufacturerOptions('accessories', '', runtimeState.filters.manufacturer, { includeAll:true }), runtimeState.filters.manufacturer, 'Wszyscy producenci');
    } else {
      setSelectOptions(categoryEl, buildCategoryOptions(kind, runtimeState.filters.category, { includeAll:true }), runtimeState.filters.category, 'Wszystkie kategorie');
    }
  }

  function bindToolbarEvents(){
    const search = byId('priceSearch');
    if(search){ search.oninput = ()=> renderPriceList(); search.onchange = ()=> renderPriceList(); }
    const clearBtn = byId('clearPriceFiltersBtn');
    if(clearBtn) clearBtn.onclick = ()=>{
      runtimeState.filters.materialType = '';
      runtimeState.filters.manufacturer = '';
      runtimeState.filters.category = '';
      if(search) search.value = '';
      syncFilterSelects();
      mountFilterChoices();
      renderPriceList();
    };
    const addBtn = byId('openPriceItemModalBtn');
    if(addBtn) addBtn.onclick = ()=> openPriceItemModal();
  }

  function firstNonEmptyValue(options){ const item = (Array.isArray(options) ? options : []).find((entry)=> String((entry && entry.value) != null ? entry.value : entry || '').trim() !== ''); return item ? String(item.value != null ? item.value : item) : ''; }
  function defaultMaterialDraft(){ const type = firstNonEmptyValue(buildMaterialTypeOptions('laminat')) || 'laminat'; const manufacturer = firstNonEmptyValue(buildManufacturerOptions('materials', type, '', { includeAll:false })); return { materialType:type, manufacturer, symbol:'', name:'', price:'', hasGrain:false }; }
  function defaultAccessoryDraft(){ const manufacturer = firstNonEmptyValue(buildManufacturerOptions('accessories', '', '', { includeAll:false })); return { manufacturer, symbol:'', name:'', price:'' }; }
  function defaultServiceDraft(kind){ return { category:firstNonEmptyValue(buildCategoryOptions(kind, kind === 'workshopServices' ? 'Cięcie' : 'Montaż', { includeAll:false })) || (kind === 'workshopServices' ? 'Cięcie' : 'Montaż'), name:'', price:'' }; }

  function currentEditedItem(){
    const editingId = appUiState() && appUiState().editingId;
    if(!editingId) return null;
    return currentList().find((item)=> item && item.id === editingId) || null;
  }

  function normalizePriceValue(value){ const raw = String(value == null ? '' : value).trim(); if(!raw) return ''; const parsed = Number(raw.replace(',', '.')); return Number.isFinite(parsed) ? parsed : raw; }
  function getCurrentMaterialDraft(){ return { materialType:String((byId('formMaterialType') && byId('formMaterialType').value) || ''), manufacturer:String((byId('formManufacturer') && byId('formManufacturer').value) || '').trim(), symbol:String((byId('formSymbol') && byId('formSymbol').value) || '').trim(), name:String((byId('formName') && byId('formName').value) || '').trim(), price:normalizePriceValue(byId('formPrice') && byId('formPrice').value), hasGrain:!!(byId('formHasGrain') && byId('formHasGrain').checked) }; }
  function getCurrentAccessoryDraft(){ return { manufacturer:String((byId('formManufacturer') && byId('formManufacturer').value) || '').trim(), symbol:String((byId('formSymbol') && byId('formSymbol').value) || '').trim(), name:String((byId('formName') && byId('formName').value) || '').trim(), price:normalizePriceValue(byId('formPrice') && byId('formPrice').value) }; }
  function getCurrentServiceDraft(){ return { category:String((byId('formCategory') && byId('formCategory').value) || '').trim(), name:String((byId('formServiceName') && byId('formServiceName').value) || '').trim(), price:normalizePriceValue(byId('formServicePrice') && byId('formServicePrice').value) }; }
  function currentItemSignature(){ const kind = currentConfig().formKind; const data = kind === 'material' ? getCurrentMaterialDraft() : (kind === 'accessory' ? getCurrentAccessoryDraft() : getCurrentServiceDraft()); return JSON.stringify(data); }
  function isItemDirty(){ return runtimeState.itemModalOpen && currentItemSignature() !== String(runtimeState.itemInitialSignature || ''); }

  function updateItemActionState(){
    const dirty = isItemDirty();
    const isEdit = !!(appUiState() && appUiState().editingId);
    const deleteBtn = byId('deletePriceItemBtn');
    const exitBtn = byId('priceItemExitBtn');
    const cancelBtn = byId('priceItemCancelBtn');
    const saveBtn = byId('priceItemSaveBtn');
    const footer = byId('priceItemFooter');
    if(footer) footer.style.display = runtimeState.itemModalOpen ? 'flex' : 'none';
    if(deleteBtn) deleteBtn.style.display = isEdit ? '' : 'none';
    if(exitBtn) exitBtn.style.display = dirty ? 'none' : '';
    if(cancelBtn) cancelBtn.style.display = dirty ? '' : 'none';
    if(saveBtn){ saveBtn.style.display = dirty ? '' : 'none'; saveBtn.textContent = isEdit ? 'Zapisz' : currentConfig().addLabel.replace(/^Dodaj\s+/i, 'Dodaj '); }
  }

  function wireItemDirtyEvents(){
    ['formSymbol','formName','formPrice','formServiceName','formServicePrice','formHasGrain','formMaterialType','formManufacturer','formCategory'].forEach((id)=>{
      const el = byId(id);
      if(!el) return;
      el.oninput = updateItemActionState;
      el.onchange = updateItemActionState;
    });
  }

  function setModalShellOpen(modal, wasOpen){
    if(modal && !wasOpen){
      try{ lockModalScroll(); }catch(_){ }
      try{ modal.classList.add('modal-open-guard'); requestAnimationFrame(()=> setTimeout(()=>{ try{ modal.classList.remove('modal-open-guard'); }catch(_){ } }, 260)); }catch(_){ }
    }
  }

  function applyMaterialFormState(item){
    const typeEl = byId('formMaterialType');
    const manufacturerEl = byId('formManufacturer');
    const materialType = String(item && item.materialType || 'laminat');
    setSelectOptions(typeEl, buildMaterialTypeOptions(materialType), materialType, materialType);
    setSelectOptions(manufacturerEl, buildManufacturerOptions('materials', materialType, item && item.manufacturer), String(item && item.manufacturer || ''), String(item && item.manufacturer || ''));
    if(byId('formSymbol')) byId('formSymbol').value = String(item && item.symbol || '');
    if(byId('formName')) byId('formName').value = String(item && item.name || '');
    if(byId('formPrice')) byId('formPrice').value = item && item.price != null ? item.price : '';
    if(byId('formHasGrain')) byId('formHasGrain').checked = !!(item && item.hasGrain);
  }
  function applyAccessoryFormState(item){
    const manufacturerEl = byId('formManufacturer');
    setSelectOptions(manufacturerEl, buildManufacturerOptions('accessories', '', item && item.manufacturer), String(item && item.manufacturer || ''), String(item && item.manufacturer || ''));
    if(byId('formSymbol')) byId('formSymbol').value = String(item && item.symbol || '');
    if(byId('formName')) byId('formName').value = String(item && item.name || '');
    if(byId('formPrice')) byId('formPrice').value = item && item.price != null ? item.price : '';
    if(byId('formHasGrain')) byId('formHasGrain').checked = false;
  }
  function applyServiceFormState(item){
    const categoryEl = byId('formCategory');
    const category = String(item && item.category || (currentListKind() === 'workshopServices' ? 'Cięcie' : 'Montaż'));
    setSelectOptions(categoryEl, buildCategoryOptions(currentListKind(), category), category, category);
    if(byId('formServiceName')) byId('formServiceName').value = String(item && item.name || '');
    if(byId('formServicePrice')) byId('formServicePrice').value = item && item.price != null ? item.price : '';
  }

  function renderItemModal(){
    const kind = currentListKind();
    const cfg = currentConfig();
    const isEdit = !!(appUiState() && appUiState().editingId);
    const item = currentEditedItem();
    if(byId('editingIndicator')) byId('editingIndicator').style.display = isEdit ? '' : 'none';
    if(byId('priceItemModalTitle')) byId('priceItemModalTitle').textContent = isEdit ? 'Edytuj pozycję' : cfg.addLabel;
    if(byId('priceItemModalSubtitle')) byId('priceItemModalSubtitle').textContent = cfg.subtitle;
    if(byId('priceItemModalIcon')) byId('priceItemModalIcon').textContent = cfg.icon;
    if(byId('priceFormTitle')) byId('priceFormTitle').textContent = isEdit ? 'Edytuj pozycję' : cfg.addLabel;

    const materialFields = byId('materialFormFields');
    const serviceFields = byId('serviceFormFields');
    if(materialFields) materialFields.style.display = (cfg.formKind === 'material' || cfg.formKind === 'accessory') ? '' : 'none';
    if(serviceFields) serviceFields.style.display = cfg.formKind === 'service' ? '' : 'none';

    const materialTypeWrap = filterMaterialWrapper();
    const manufacturerWrap = filterManufacturerWrapper();
    const grainRow = formHasGrainRow();
    if(materialTypeWrap) materialTypeWrap.style.display = cfg.formKind === 'material' ? '' : 'none';
    if(manufacturerWrap) manufacturerWrap.style.display = (cfg.formKind === 'material' || cfg.formKind === 'accessory') ? '' : 'none';
    if(grainRow) grainRow.style.display = cfg.formKind === 'material' ? 'flex' : 'none';

    if(cfg.formKind === 'material') applyMaterialFormState(item || defaultMaterialDraft());
    else if(cfg.formKind === 'accessory') applyAccessoryFormState(item || defaultAccessoryDraft());
    else applyServiceFormState(item || defaultServiceDraft(kind));

    if(cfg.formKind === 'service'){
      const categoryWrap = formCategoryWrapper();
      const nameWrap = formServiceNameWrapper();
      if(categoryWrap) categoryWrap.style.display = '';
      if(nameWrap) nameWrap.style.display = '';
    }

    wireItemDirtyEvents();
    runtimeState.itemInitialSignature = currentItemSignature();
    updateItemActionState();
  }

  function openPriceItemModal(id){
    const modal = byId('priceItemModal');
    if(!modal) return;
    const wasOpen = modal.style.display === 'flex';
    appUiState().editingId = id || null;
    persistUi();
    runtimeState.itemModalOpen = true;
    modal.style.display = 'flex';
    setModalShellOpen(modal, wasOpen);
    renderItemModal();
  }

  function doClosePriceItemModal(){
    runtimeState.itemModalOpen = false;
    runtimeState.itemInitialSignature = '';
    appUiState().editingId = null;
    persistUi();
    const modal = byId('priceItemModal');
    if(modal) modal.style.display = 'none';
    return true;
  }

  async function requestClosePriceItemModal(){
    if(!runtimeState.itemModalOpen) return true;
    if(isItemDirty()){
      const ok = await confirmDiscard();
      if(!ok) return false;
    }
    doClosePriceItemModal();
    return true;
  }

  function matchesSearch(item, query){
    if(!query) return true;
    const haystack = [item && item.name, item && item.symbol, item && item.manufacturer, item && item.materialType, item && item.category].map((value)=> normalizeKey(value)).join(' ');
    return haystack.includes(query);
  }

  function filteredPriceList(){
    const kind = currentListKind();
    const q = normalizeKey((byId('priceSearch') && byId('priceSearch').value) || '');
    return currentList().filter((item)=>{
      if(!matchesSearch(item, q)) return false;
      if(kind === 'materials'){
        if(runtimeState.filters.materialType && String(item && item.materialType || '') !== String(runtimeState.filters.materialType || '')) return false;
        if(runtimeState.filters.manufacturer && String(item && item.manufacturer || '') !== String(runtimeState.filters.manufacturer || '')) return false;
        return true;
      }
      if(kind === 'accessories'){
        if(runtimeState.filters.manufacturer && String(item && item.manufacturer || '') !== String(runtimeState.filters.manufacturer || '')) return false;
        return true;
      }
      if(runtimeState.filters.category && String(item && item.category || '') !== String(runtimeState.filters.category || '')) return false;
      return true;
    });
  }

  function renderPriceList(){
    const container = byId('priceListItems');
    if(!container) return;
    const kind = currentListKind();
    const filtered = filteredPriceList();
    container.innerHTML = '';
    if(!filtered.length){ container.innerHTML = '<div class="muted" style="padding:10px">Brak pozycji dla aktualnych filtrów.</div>'; return; }
    filtered.forEach((item)=>{
      const row = document.createElement('div'); row.className = 'list-item price-modal-list-row';
      const left = document.createElement('div'); left.className = 'price-modal-list-main'; left.style.minWidth = '0';
      let meta = '';
      if(kind === 'materials') meta = ((item.materialType || '—') + ' • ' + (item.manufacturer || '—') + (item.symbol ? ' • SYM: ' + item.symbol : '') + (item.hasGrain ? ' • 🌾 słoje' : ''));
      else if(kind === 'accessories') meta = ((item.manufacturer || '—') + (item.symbol ? ' • SYM: ' + item.symbol : ''));
      else meta = item.category || '—';
      left.innerHTML = `<div style="font-weight:900">${item && item.name ? item.name : '—'}</div><div class="muted-tag xs">${meta}</div>`;
      const right = document.createElement('div'); right.className = 'price-modal-list-actions';
      const price = document.createElement('div'); price.className = 'price-modal-list-price'; price.textContent = (Number(item && item.price) || 0).toFixed(2) + ' PLN';
      const editBtn = document.createElement('button'); editBtn.className = 'btn'; editBtn.type = 'button'; editBtn.textContent = 'Edytuj';
      right.appendChild(price); right.appendChild(editBtn); row.appendChild(left); row.appendChild(right); container.appendChild(row);
      editBtn.addEventListener('click', ()=> openPriceItemModal(item.id));
    });
  }

  async function closePriceModal(){
    if(runtimeState.itemModalOpen){ const ok = await requestClosePriceItemModal(); if(!ok) return false; }
    try{ unlockModalScroll(); }catch(_){ }
    appUiState().showPriceList = null; persistUi();
    const modal = byId('priceModal'); if(modal) modal.style.display = 'none';
    return true;
  }

  function validateMaterialForm(data){
    if(!String(data && data.name || '').trim()){ info('Brak nazwy', 'Wprowadź nazwę materiału, zanim go zapiszesz.'); return false; }
    if(!String(data && data.materialType || '').trim()){ info('Brak typu', 'Wybierz typ materiału.'); return false; }
    if(!String(data && data.manufacturer || '').trim()){ info('Brak producenta', 'Wybierz producenta dla materiału.'); return false; }
    return true;
  }
  function validateAccessoryForm(data){
    if(!String(data && data.name || '').trim()){ info('Brak nazwy', 'Wprowadź nazwę akcesorium, zanim je zapiszesz.'); return false; }
    if(!String(data && data.manufacturer || '').trim()){ info('Brak producenta', 'Wybierz producenta akcesorium.'); return false; }
    return true;
  }
  function validateServiceForm(data){
    if(!String(data && data.name || '').trim()){ info('Brak nazwy', 'Wprowadź nazwę usługi, zanim ją zapiszesz.'); return false; }
    if(!String(data && data.category || '').trim()){ info('Brak kategorii', 'Wybierz kategorię usługi.'); return false; }
    return true;
  }

  function saveCurrentList(next){ if(catalogStore() && typeof catalogStore().savePriceList === 'function') catalogStore().savePriceList(currentListKind(), next); }

  function saveMaterialFromForm(){
    const data = getCurrentMaterialDraft(); if(!validateMaterialForm(data)) return false;
    const payload = Object.assign({}, data, { price:Number(data.price) || 0, hasGrain:!!data.hasGrain });
    const next = currentList();
    if(appUiState().editingId){ const idx = next.findIndex((item)=> item.id === appUiState().editingId); if(idx >= 0) next[idx] = Object.assign({}, next[idx], payload); }
    else next.push(Object.assign({ id:FC.utils.uid() }, payload));
    saveCurrentList(next); doClosePriceItemModal(); renderPriceModal(); try{ renderCabinetModal(); }catch(_){ } return true;
  }
  function saveAccessoryFromForm(){
    const data = getCurrentAccessoryDraft(); if(!validateAccessoryForm(data)) return false;
    const payload = Object.assign({}, data, { price:Number(data.price) || 0 });
    const next = currentList();
    if(appUiState().editingId){ const idx = next.findIndex((item)=> item.id === appUiState().editingId); if(idx >= 0) next[idx] = Object.assign({}, next[idx], payload); }
    else next.push(Object.assign({ id:FC.utils.uid() }, payload));
    saveCurrentList(next); doClosePriceItemModal(); renderPriceModal(); return true;
  }
  function saveServiceFromForm(){
    try{ if(currentListKind() === 'quoteRates' && FC.wycenaCore && typeof FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const data = getCurrentServiceDraft(); if(!validateServiceForm(data)) return false;
    const payload = Object.assign({}, data, { price:Number(data.price) || 0 });
    const next = currentList();
    if(appUiState().editingId){ const idx = next.findIndex((item)=> item.id === appUiState().editingId); if(idx >= 0) next[idx] = Object.assign({}, next[idx], payload); }
    else next.push(Object.assign({ id:FC.utils.uid() }, payload));
    saveCurrentList(next); doClosePriceItemModal(); renderPriceModal(); return true;
  }

  async function saveActivePriceItem(){
    if(!runtimeState.itemModalOpen) return false;
    if(!isItemDirty()) return requestClosePriceItemModal('exit');
    const ok = await confirmSave(); if(!ok) return false;
    const formKind = currentConfig().formKind;
    if(formKind === 'material') return saveMaterialFromForm();
    if(formKind === 'accessory') return saveAccessoryFromForm();
    return saveServiceFromForm();
  }

  async function deletePriceItem(item){
    const ok = await confirmDelete(); if(!ok) return false;
    const next = currentList().filter((row)=> String(row.id) !== String(item && item.id));
    saveCurrentList(next);
    if(String(appUiState().editingId || '') === String(item && item.id || '')) doClosePriceItemModal();
    renderPriceModal();
    try{ renderCabinetModal(); }catch(_){ }
    return true;
  }
  function deleteActivePriceItem(){ const item = currentEditedItem(); if(!item) return false; return deletePriceItem(item); }

  function renderPriceModal(){
    const modal = byId('priceModal');
    const kind = currentListKind();
    const active = String((appUiState() && appUiState().showPriceList) || '');
    const wasOpen = modal && modal.style.display === 'flex';
    if(!active){ doClosePriceItemModal(); if(modal) modal.style.display = 'none'; if(wasOpen) try{ unlockModalScroll(); }catch(_){ } return; }
    const cfg = currentConfig();
    if(modal) modal.style.display = 'flex';
    setModalShellOpen(modal, wasOpen);

    const materialFilters = byId('materialFilters');
    const serviceFilters = byId('serviceFilters');
    const addBtn = byId('openPriceItemModalBtn');
    if(byId('priceModalTitle')) byId('priceModalTitle').textContent = cfg.title;
    if(byId('priceModalSubtitle')) byId('priceModalSubtitle').textContent = cfg.subtitle;
    if(byId('priceModalIcon')) byId('priceModalIcon').textContent = cfg.icon;
    if(addBtn) addBtn.textContent = cfg.addLabel;
    if(materialFilters) materialFilters.style.display = (kind === 'materials' || kind === 'accessories') ? 'grid' : 'none';
    if(serviceFilters) serviceFilters.style.display = (kind === 'quoteRates' || kind === 'workshopServices') ? 'grid' : 'none';
    const materialTypeWrap = byId('priceFilterMaterialTypeLaunch') && byId('priceFilterMaterialTypeLaunch').parentElement;
    if(materialTypeWrap) materialTypeWrap.style.display = kind === 'materials' ? '' : 'none';
    syncFilterSelects();
    mountFilterChoices();
    bindToolbarEvents();
    renderPriceList();
    renderItemModal();
  }

  window.FC.priceModal.renderPriceModal = renderPriceModal;
  window.FC.priceModal.closePriceModal = closePriceModal;
  window.FC.priceModal.openPriceItemModal = openPriceItemModal;
  window.FC.priceModal.closePriceItemModal = requestClosePriceItemModal;
  window.FC.priceModal.requestClosePriceItemModal = requestClosePriceItemModal;
  window.FC.priceModal.saveActivePriceItem = saveActivePriceItem;
  window.FC.priceModal.deleteActivePriceItem = deleteActivePriceItem;
  window.FC.priceModal.saveMaterialFromForm = saveMaterialFromForm;
  window.FC.priceModal.saveServiceFromForm = saveServiceFromForm;
  window.FC.priceModal.deletePriceItem = deletePriceItem;
  function buildServiceCategoryOptions(selectedValue, opts){ return buildCategoryOptions('quoteRates', selectedValue, opts); }

  window.FC.priceModal._debug = { buildCategoryOptions, buildServiceCategoryOptions, buildManufacturerOptions, buildMaterialTypeOptions, filteredPriceList, runtimeState };
})();
