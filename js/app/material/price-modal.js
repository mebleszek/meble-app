// js/app/material/price-modal.js
// Renderer i kontroler modali cenników. Lista oraz formularz pozycji są rozdzielone,
// a dodawanie/edycja działa przez osobny modal zgodny ze stylem aplikacji.

(function(){
  'use strict';
  window.FC = window.FC || {};
  window.FC.priceModal = window.FC.priceModal || {};
  const FC = window.FC;

  const MATERIAL_TYPES = ['laminat','akryl','lakier','blat','akcesoria'];
  const DEFAULT_SERVICE_CATEGORIES = ['Montaż','AGD','Pomiar','Transport','Projekt','Inne'];
  const runtimeState = {
    itemModalOpen: false,
    itemInitialSignature: '',
    filters: {
      materialType: '',
      manufacturer: '',
      serviceCategory: '',
    },
  };

  function byId(id){ return document.getElementById(id); }

  function appUiState(){
    if(typeof uiState !== 'undefined' && uiState) return uiState;
    FC.uiState = FC.uiState || {};
    return FC.uiState;
  }

  function currentListType(){
    const state = appUiState();
    return state && state.showPriceList === 'services' ? 'services' : 'materials';
  }

  function currentList(){
    return currentListType() === 'materials'
      ? (Array.isArray(typeof materials !== 'undefined' ? materials : null) ? materials : [])
      : (Array.isArray(typeof services !== 'undefined' ? services : null) ? services : []);
  }

  function normalizeKey(value){
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ');
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
    if(prev && !Array.from(selectEl.options || []).some((opt)=> String(opt.value || '') === prev)){
      ensureOption(selectEl, prev, fallbackLabel || prev);
    }
    selectEl.value = prev;
    if(String(selectEl.value || '') !== prev){
      const first = Array.from(selectEl.options || []).find((opt)=> String(opt.value || '') !== '') || (selectEl.options && selectEl.options[0]) || null;
      selectEl.value = first ? String(first.value || '') : '';
    }
  }

  function buildOrderedValues(baseList, dynamicList, selectedValue, includeAllLabel){
    const seen = new Set();
    const out = [];
    if(includeAllLabel != null){
      out.push({ value:'', label:includeAllLabel });
      seen.add('');
    }
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
    const fromItems = currentListType() === 'materials' ? currentList().map((item)=> item && item.materialType) : [];
    return buildOrderedValues(MATERIAL_TYPES, fromItems, selectedValue, cfg.includeAll ? 'Wszystkie typy' : null);
  }

  function buildManufacturerOptions(typeVal, selectedValue, opts){
    const cfg = Object.assign({ includeAll:false }, opts || {});
    const registry = window.FC && window.FC.materialRegistry;
    const manufacturers = (registry && registry.MANUFACTURERS) || {};
    const currentType = String(typeVal || '').trim();
    const source = [];
    if(currentType){
      source.push(...((manufacturers[currentType] || []).slice()));
      (Array.isArray(typeof materials !== 'undefined' ? materials : null) ? materials : []).forEach((item)=>{
        if(String(item && item.materialType || '') === currentType) source.push(item && item.manufacturer);
      });
    }else{
      Object.keys(manufacturers).forEach((key)=> source.push(...(manufacturers[key] || [])));
      (Array.isArray(typeof materials !== 'undefined' ? materials : null) ? materials : []).forEach((item)=> source.push(item && item.manufacturer));
    }
    return buildOrderedValues([], source, selectedValue, cfg.includeAll ? 'Wszyscy producenci' : null);
  }

  function buildServiceCategoryOptions(selectedValue, opts){
    const cfg = Object.assign({ includeAll:false }, opts || {});
    const serviceList = Array.isArray((typeof services !== 'undefined') ? services : null) ? services : [];
    const dynamic = serviceList.map((item)=> item && item.category);
    return buildOrderedValues(DEFAULT_SERVICE_CATEGORIES, dynamic, selectedValue, cfg.includeAll ? 'Wszystkie kategorie' : null);
  }

  function mountChoice(opts){
    const cfg = Object.assign({ selectEl:null, mountId:'', title:'Wybierz', buttonClass:'investor-choice-launch', disabled:false, placeholder:'Wybierz', onChange:null }, opts || {});
    const selectEl = cfg.selectEl;
    const mount = cfg.mountId ? byId(cfg.mountId) : null;
    if(!(mount && selectEl && window.FC && FC.investorChoice && typeof FC.investorChoice.mountChoice === 'function')) return null;
    return FC.investorChoice.mountChoice({
      mount,
      selectEl,
      title: cfg.title,
      buttonClass: cfg.buttonClass,
      disabled: !!cfg.disabled,
      placeholder: cfg.placeholder,
      onChange: cfg.onChange,
    });
  }

  function info(title, message){
    try{
      if(window.FC && FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({ title, message });
        return;
      }
    }catch(_){ }
  }

  function askConfirm(opts){
    try{
      if(window.FC && FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
        return FC.confirmBox.ask(opts || {});
      }
    }catch(_){ }
    return Promise.resolve(true);
  }

  function confirmDelete(){
    return askConfirm({
      title:'Usunąć pozycję?',
      message:'Tej operacji nie cofnisz.',
      confirmText:'Usuń',
      cancelText:'Wróć',
      confirmTone:'danger',
      cancelTone:'neutral'
    }).then(Boolean);
  }

  function confirmDiscardPriceItemChanges(){
    return askConfirm({
      title:'ANULOWAĆ ZMIANY?',
      message:'Niezapisane zmiany w tej pozycji zostaną utracone.',
      confirmText:'✕ ANULUJ ZMIANY',
      cancelText:'Wróć',
      confirmTone:'danger',
      cancelTone:'neutral'
    }).then(Boolean);
  }

  function confirmSavePriceItemChanges(){
    const isEdit = !!(appUiState() && appUiState().editingId);
    return askConfirm({
      title:'ZAPISAĆ ZMIANY?',
      message: isEdit ? 'Zapisać zmiany w tej pozycji cennika?' : 'Dodać nową pozycję do cennika?',
      confirmText:'Zapisz',
      cancelText:'Wróć',
      confirmTone:'success',
      cancelTone:'neutral'
    }).then(Boolean);
  }

  function persistUi(){
    try{ FC.storage.setJSON(STORAGE_KEYS.ui, appUiState()); }catch(_){ }
  }

  function firstNonEmptyValue(options){
    const item = (Array.isArray(options) ? options : []).find((entry)=> String((entry && entry.value) != null ? entry.value : entry || '').trim() !== '');
    return item ? String(item.value != null ? item.value : item) : '';
  }

  function defaultMaterialDraft(){
    const type = firstNonEmptyValue(buildMaterialTypeOptions('laminat')) || 'laminat';
    const manufacturer = firstNonEmptyValue(buildManufacturerOptions(type, '', { includeAll:false }));
    return { materialType:type, manufacturer, symbol:'', name:'', price:'', hasGrain:false };
  }

  function defaultServiceDraft(){
    return { category:firstNonEmptyValue(buildServiceCategoryOptions('Montaż')) || 'Montaż', name:'', price:'' };
  }

  function clearMaterialForm(){
    ['formSymbol','formName','formPrice'].forEach((id)=>{ const el = byId(id); if(el) el.value = ''; });
    const grain = byId('formHasGrain');
    if(grain) grain.checked = false;
  }

  function clearServiceForm(){
    ['formServiceName','formServicePrice'].forEach((id)=>{ const el = byId(id); if(el) el.value = ''; });
  }

  function applyMaterialFormState(item){
    const typeEl = byId('formMaterialType');
    const manufacturerEl = byId('formManufacturer');
    const materialType = String(item && item.materialType || 'laminat');
    setSelectOptions(typeEl, buildMaterialTypeOptions(materialType), materialType, materialType);
    setSelectOptions(manufacturerEl, buildManufacturerOptions(materialType, item && item.manufacturer), String(item && item.manufacturer || ''), String(item && item.manufacturer || ''));
    const symbolEl = byId('formSymbol');
    const nameEl = byId('formName');
    const priceEl = byId('formPrice');
    if(symbolEl) symbolEl.value = String(item && item.symbol || '');
    if(nameEl) nameEl.value = String(item && item.name || '');
    if(priceEl) priceEl.value = item && item.price != null ? item.price : '';
    const grain = byId('formHasGrain');
    if(grain) grain.checked = !!(item && item.hasGrain);
  }

  function applyServiceFormState(item){
    const categoryEl = byId('formCategory');
    const category = String(item && item.category || 'Montaż');
    setSelectOptions(categoryEl, buildServiceCategoryOptions(category), category, category);
    const nameEl = byId('formServiceName');
    const priceEl = byId('formServicePrice');
    if(nameEl) nameEl.value = String(item && item.name || '');
    if(priceEl) priceEl.value = item && item.price != null ? item.price : '';
  }

  function currentEditedItem(){
    if(!appUiState() || !appUiState().editingId) return null;
    return currentList().find((item)=> item && item.id === appUiState().editingId) || null;
  }

  function normalizePriceValue(value){
    const raw = String(value == null ? '' : value).trim();
    if(!raw) return '';
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : raw;
  }

  function getCurrentMaterialDraft(){
    return {
      materialType: String((byId('formMaterialType') && byId('formMaterialType').value) || ''),
      manufacturer: String((byId('formManufacturer') && byId('formManufacturer').value) || '').trim(),
      symbol: String((byId('formSymbol') && byId('formSymbol').value) || '').trim(),
      name: String((byId('formName') && byId('formName').value) || '').trim(),
      price: normalizePriceValue(byId('formPrice') && byId('formPrice').value),
      hasGrain: !!(byId('formHasGrain') && byId('formHasGrain').checked),
    };
  }

  function getCurrentServiceDraft(){
    return {
      category: String((byId('formCategory') && byId('formCategory').value) || '').trim(),
      name: String((byId('formServiceName') && byId('formServiceName').value) || '').trim(),
      price: normalizePriceValue(byId('formServicePrice') && byId('formServicePrice').value),
    };
  }

  function currentItemSignature(){
    const data = currentListType() === 'materials' ? getCurrentMaterialDraft() : getCurrentServiceDraft();
    return JSON.stringify(data);
  }

  function isItemDirty(){
    if(!runtimeState.itemModalOpen) return false;
    return currentItemSignature() !== String(runtimeState.itemInitialSignature || '');
  }

  function updateItemActionState(){
    const dirty = isItemDirty();
    const isEdit = !!(appUiState() && appUiState().editingId);
    const isMat = currentListType() === 'materials';
    const deleteBtn = byId('deletePriceItemBtn');
    const exitBtn = byId('priceItemExitBtn');
    const cancelBtn = byId('priceItemCancelBtn');
    const saveBtn = byId('priceItemSaveBtn');
    const footer = byId('priceItemFooter');
    if(footer) footer.style.display = runtimeState.itemModalOpen ? 'flex' : 'none';
    if(deleteBtn) deleteBtn.style.display = isEdit ? '' : 'none';
    if(exitBtn) exitBtn.style.display = dirty ? 'none' : '';
    if(cancelBtn) cancelBtn.style.display = dirty ? '' : 'none';
    if(saveBtn){
      saveBtn.style.display = dirty ? '' : 'none';
      saveBtn.textContent = isEdit ? 'Zapisz' : (isMat ? 'Dodaj' : 'Dodaj');
    }
  }

  function wireItemDirtyEvents(){
    ['formSymbol','formName','formPrice','formServiceName','formServicePrice','formHasGrain','formMaterialType','formManufacturer','formCategory'].forEach((id)=>{
      const el = byId(id);
      if(!el) return;
      el.oninput = updateItemActionState;
      el.onchange = updateItemActionState;
    });
  }

  function syncFilterSelects(){
    const isMat = currentListType() === 'materials';
    const typeFilterEl = byId('priceFilterMaterialType');
    const manufacturerFilterEl = byId('priceFilterManufacturer');
    const categoryFilterEl = byId('priceFilterCategory');

    if(isMat){
      const nextType = String(runtimeState.filters.materialType || '');
      setSelectOptions(typeFilterEl, buildMaterialTypeOptions(nextType, { includeAll:true }), nextType, 'Wszystkie typy');
      const nextManufacturer = String(runtimeState.filters.manufacturer || '');
      const manufacturerOptions = buildManufacturerOptions(nextType, nextManufacturer, { includeAll:true });
      if(nextManufacturer && !manufacturerOptions.some((item)=> String(item && item.value || '') === nextManufacturer)) runtimeState.filters.manufacturer = '';
      setSelectOptions(manufacturerFilterEl, manufacturerOptions, String(runtimeState.filters.manufacturer || ''), 'Wszyscy producenci');
    }else{
      const nextCategory = String(runtimeState.filters.serviceCategory || '');
      setSelectOptions(categoryFilterEl, buildServiceCategoryOptions(nextCategory, { includeAll:true }), nextCategory, 'Wszystkie kategorie');
    }
  }

  function mountFilterChoices(){
    const isMat = currentListType() === 'materials';
    if(isMat){
      mountChoice({
        selectEl: byId('priceFilterMaterialType'),
        mountId: 'priceFilterMaterialTypeLaunch',
        title: 'Filtruj po typie materiału',
        placeholder: 'Wszystkie typy',
        onChange: (value)=>{
          runtimeState.filters.materialType = String(value || '');
          syncFilterSelects();
          mountFilterChoices();
          renderPriceModal();
        }
      });
      mountChoice({
        selectEl: byId('priceFilterManufacturer'),
        mountId: 'priceFilterManufacturerLaunch',
        title: 'Filtruj po producencie',
        placeholder: 'Wszyscy producenci',
        onChange: (value)=>{
          runtimeState.filters.manufacturer = String(value || '');
          renderPriceModal();
        }
      });
    }else{
      mountChoice({
        selectEl: byId('priceFilterCategory'),
        mountId: 'priceFilterCategoryLaunch',
        title: 'Filtruj po kategorii usługi',
        placeholder: 'Wszystkie kategorie',
        onChange: (value)=>{
          runtimeState.filters.serviceCategory = String(value || '');
          renderPriceModal();
        }
      });
    }
  }

  function mountItemChoices(){
    const typeEl = byId('formMaterialType');
    const manufacturerEl = byId('formManufacturer');
    const categoryEl = byId('formCategory');
    mountChoice({
      selectEl: typeEl,
      mountId: 'formMaterialTypeLaunch',
      title: 'Wybierz typ materiału',
      placeholder: 'Wybierz typ',
      onChange: ()=>{
        const currentManufacturer = String((manufacturerEl && manufacturerEl.value) || '');
        setSelectOptions(manufacturerEl, buildManufacturerOptions(typeEl && typeEl.value, currentManufacturer), currentManufacturer, currentManufacturer || '');
        mountItemChoices();
        updateItemActionState();
      }
    });
    mountChoice({
      selectEl: manufacturerEl,
      mountId: 'formManufacturerLaunch',
      title: 'Wybierz producenta',
      placeholder: 'Wybierz producenta',
      onChange: ()=>{ updateItemActionState(); }
    });
    mountChoice({
      selectEl: categoryEl,
      mountId: 'formCategoryLaunch',
      title: 'Wybierz kategorię usługi',
      placeholder: 'Wybierz kategorię',
      onChange: ()=>{ updateItemActionState(); }
    });
  }

  function clearFilters(){
    runtimeState.filters.materialType = '';
    runtimeState.filters.manufacturer = '';
    runtimeState.filters.serviceCategory = '';
    const search = byId('priceSearch');
    if(search) search.value = '';
  }

  function bindToolbarEvents(){
    const search = byId('priceSearch');
    if(search) search.oninput = ()=>{ renderPriceModal(); };
    const addBtn = byId('openPriceItemModalBtn');
    if(addBtn) addBtn.onclick = ()=>{ openPriceItemModal(null); };
    const clearBtn = byId('clearPriceFiltersBtn');
    if(clearBtn) clearBtn.onclick = ()=>{ clearFilters(); renderPriceModal(); };
    const closeItemBtn = byId('closePriceItemModal');
    if(closeItemBtn) closeItemBtn.onclick = ()=>{ requestClosePriceItemModal('cancel'); };
    const exitBtn = byId('priceItemExitBtn');
    if(exitBtn) exitBtn.onclick = ()=>{ requestClosePriceItemModal('exit'); };
    const cancelBtn = byId('priceItemCancelBtn');
    if(cancelBtn) cancelBtn.onclick = ()=>{ requestClosePriceItemModal('cancel'); };
    const saveBtn = byId('priceItemSaveBtn');
    if(saveBtn) saveBtn.onclick = ()=>{ saveActivePriceItem(); };
    const deleteBtn = byId('deletePriceItemBtn');
    if(deleteBtn) deleteBtn.onclick = ()=>{ deleteActivePriceItem(); };
  }

  function renderItemModal(){
    const modal = byId('priceItemModal');
    if(!modal) return;
    if(!runtimeState.itemModalOpen){
      modal.style.display = 'none';
      return;
    }
    const isMat = currentListType() === 'materials';
    const item = currentEditedItem();
    const isEdit = !!(appUiState() && appUiState().editingId && item);
    modal.style.display = 'flex';
    try{
      modal.classList.add('modal-open-guard');
      requestAnimationFrame(()=> setTimeout(()=>{ try{ modal.classList.remove('modal-open-guard'); }catch(_){ } }, 220));
    }catch(_){ }

    const title = isEdit ? 'Edytuj pozycję' : (isMat ? 'Dodaj produkt' : 'Dodaj usługę');
    const subtitle = isMat ? 'Uzupełnij dane materiału zgodnie z cennikiem.' : 'Uzupełnij dane usługi zgodnie z cennikiem.';
    const icon = isMat ? '🧩' : '🔧';
    const titleEl = byId('priceItemModalTitle');
    const subtitleEl = byId('priceItemModalSubtitle');
    const iconEl = byId('priceItemModalIcon');
    const formTitleEl = byId('priceFormTitle');
    const editingEl = byId('editingIndicator');
    const materialFields = byId('materialFormFields');
    const serviceFields = byId('serviceFormFields');
    if(titleEl) titleEl.textContent = title;
    if(subtitleEl) subtitleEl.textContent = subtitle;
    if(iconEl) iconEl.textContent = icon;
    if(formTitleEl) formTitleEl.textContent = title;
    if(editingEl) editingEl.style.display = isEdit ? 'inline-block' : 'none';
    if(materialFields) materialFields.style.display = isMat ? 'block' : 'none';
    if(serviceFields) serviceFields.style.display = isMat ? 'none' : 'block';

    if(isMat){
      if(isEdit) applyMaterialFormState(item);
      else {
        applyMaterialFormState(defaultMaterialDraft());
        clearMaterialForm();
      }
    }else{
      try{ if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') window.FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
      if(isEdit) applyServiceFormState(item);
      else {
        applyServiceFormState(defaultServiceDraft());
        clearServiceForm();
      }
    }
    mountItemChoices();
    bindToolbarEvents();
    wireItemDirtyEvents();
    runtimeState.itemInitialSignature = currentItemSignature();
    updateItemActionState();
  }

  function openPriceItemModal(itemId){
    appUiState().editingId = itemId || null;
    persistUi();
    runtimeState.itemModalOpen = true;
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

  async function requestClosePriceItemModal(reason){
    if(!runtimeState.itemModalOpen) return true;
    const dirty = isItemDirty();
    if(dirty){
      const ok = await confirmDiscardPriceItemChanges();
      if(!ok) return false;
    }
    doClosePriceItemModal();
    return true;
  }

  function matchesSearch(item, query){
    if(!query) return true;
    const haystack = [
      item && item.name,
      item && item.symbol,
      item && item.manufacturer,
      item && item.materialType,
      item && item.category,
    ].map((value)=> normalizeKey(value)).join(' ');
    return haystack.includes(query);
  }

  function filteredPriceList(){
    const isMat = currentListType() === 'materials';
    const q = normalizeKey((byId('priceSearch') && byId('priceSearch').value) || '');
    const list = currentList();
    return list.filter((item)=>{
      if(!matchesSearch(item, q)) return false;
      if(isMat){
        if(runtimeState.filters.materialType && String(item && item.materialType || '') !== String(runtimeState.filters.materialType || '')) return false;
        if(runtimeState.filters.manufacturer && String(item && item.manufacturer || '') !== String(runtimeState.filters.manufacturer || '')) return false;
        return true;
      }
      if(runtimeState.filters.serviceCategory && String(item && item.category || '') !== String(runtimeState.filters.serviceCategory || '')) return false;
      return true;
    });
  }

  function renderPriceList(){
    const isMat = currentListType() === 'materials';
    const container = byId('priceListItems');
    if(!container) return;
    const filtered = filteredPriceList();
    container.innerHTML = '';

    if(!filtered.length){
      container.innerHTML = '<div class="muted" style="padding:10px">Brak pozycji dla aktualnych filtrów.</div>';
      return;
    }

    filtered.forEach((item)=>{
      const row = document.createElement('div');
      row.className = 'list-item price-modal-list-row';
      const left = document.createElement('div');
      left.className = 'price-modal-list-main';
      left.style.minWidth = '0';
      const grainBadge = (isMat && item && item.hasGrain) ? ' • 🌾 słoje' : '';
      left.innerHTML = `<div style="font-weight:900">${item && item.name ? item.name : '—'}</div><div class="muted-tag xs">${isMat ? ((item.materialType || '—') + ' • ' + (item.manufacturer || '—') + (item.symbol ? ' • SYM: ' + item.symbol : '') + grainBadge) : (item.category || '—')}</div>`;
      const right = document.createElement('div');
      right.className = 'price-modal-list-actions';
      const price = document.createElement('div');
      price.className = 'price-modal-list-price';
      price.textContent = (Number(item && item.price) || 0).toFixed(2) + ' PLN';
      const editBtn = document.createElement('button');
      editBtn.className = 'btn';
      editBtn.type = 'button';
      editBtn.textContent = 'Edytuj';
      right.appendChild(price);
      right.appendChild(editBtn);
      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);

      editBtn.addEventListener('click', ()=>{ openPriceItemModal(item.id); });
    });
  }

  async function closePriceModal(){
    if(runtimeState.itemModalOpen){
      return requestClosePriceItemModal('close-parent');
    }
    try{ unlockModalScroll(); }catch(_){ }
    appUiState().showPriceList = null;
    persistUi();
    const modal = byId('priceModal');
    if(modal) modal.style.display = 'none';
    return true;
  }

  function validateMaterialForm(data){
    if(!String(data && data.name || '').trim()){
      info('Brak nazwy', 'Wprowadź nazwę materiału, zanim go zapiszesz.');
      return false;
    }
    if(!String(data && data.materialType || '').trim()){
      info('Brak typu', 'Wybierz typ materiału.');
      return false;
    }
    if(!String(data && data.manufacturer || '').trim()){
      info('Brak producenta', 'Wybierz producenta dla materiału.');
      return false;
    }
    return true;
  }

  function validateServiceForm(data){
    if(!String(data && data.name || '').trim()){
      info('Brak nazwy', 'Wprowadź nazwę usługi, zanim ją zapiszesz.');
      return false;
    }
    if(!String(data && data.category || '').trim()){
      info('Brak kategorii', 'Wybierz kategorię usługi.');
      return false;
    }
    return true;
  }

  function saveMaterialFromForm(){
    const data = getCurrentMaterialDraft();
    if(!validateMaterialForm(data)) return false;
    const payload = Object.assign({}, data, { price:Number(data.price) || 0, hasGrain:!!data.hasGrain });
    if(appUiState().editingId){
      materials = (Array.isArray(materials) ? materials : []).map((m)=> m.id === appUiState().editingId ? Object.assign({}, m, payload) : m);
    } else {
      const id = FC.utils.uid();
      materials = (Array.isArray(materials) ? materials : []).concat([Object.assign({ id }, payload)]);
    }
    FC.storage.setJSON(STORAGE_KEYS.materials, materials);
    doClosePriceItemModal();
    renderPriceModal();
    try{ renderCabinetModal(); }catch(_){ }
    return true;
  }

  function saveServiceFromForm(){
    try{ if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') window.FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const data = getCurrentServiceDraft();
    if(!validateServiceForm(data)) return false;
    const payload = Object.assign({}, data, { price:Number(data.price) || 0 });
    if(appUiState().editingId){
      services = (Array.isArray(services) ? services : []).map((s)=> s.id === appUiState().editingId ? Object.assign({}, s, payload) : s);
    } else {
      const id = FC.utils.uid();
      services = (Array.isArray(services) ? services : []).concat([Object.assign({ id }, payload)]);
    }
    FC.storage.setJSON(STORAGE_KEYS.services, services);
    doClosePriceItemModal();
    renderPriceModal();
    return true;
  }

  async function saveActivePriceItem(){
    if(!runtimeState.itemModalOpen) return false;
    if(!isItemDirty()) return requestClosePriceItemModal('exit');
    const ok = await confirmSavePriceItemChanges();
    if(!ok) return false;
    return currentListType() === 'materials' ? saveMaterialFromForm() : saveServiceFromForm();
  }

  async function deletePriceItem(item){
    const ok = await confirmDelete();
    if(!ok) return false;
    if(currentListType() === 'materials'){
      materials = (Array.isArray(materials) ? materials : []).filter((m)=> m.id !== item.id);
      FC.storage.setJSON(STORAGE_KEYS.materials, materials);
    } else {
      services = (Array.isArray(services) ? services : []).filter((s)=> s.id !== item.id);
      FC.storage.setJSON(STORAGE_KEYS.services, services);
    }
    if(String(appUiState().editingId || '') === String(item && item.id || '')) doClosePriceItemModal();
    renderPriceModal();
    try{ renderCabinetModal(); }catch(_){ }
    return true;
  }

  function deleteActivePriceItem(){
    const item = currentEditedItem();
    if(!item) return false;
    return deletePriceItem(item);
  }

  function renderPriceModal(){
    try{ if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') window.FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const modal = byId('priceModal');
    const type = appUiState().showPriceList;
    const wasOpen = modal && modal.style.display === 'flex';
    if(!type){
      doClosePriceItemModal();
      if(modal) modal.style.display = 'none';
      if(wasOpen) try{ unlockModalScroll(); }catch(_){ }
      return;
    }

    if(modal) modal.style.display = 'flex';
    if(modal && !wasOpen){
      try{ lockModalScroll(); }catch(_){ }
      try{
        modal.classList.add('modal-open-guard');
        requestAnimationFrame(()=> setTimeout(()=>{ try{ modal.classList.remove('modal-open-guard'); }catch(_){ } }, 260));
      }catch(_){ }
    }

    const isMat = type === 'materials';
    const titleEl = byId('priceModalTitle');
    const subtitleEl = byId('priceModalSubtitle');
    const iconEl = byId('priceModalIcon');
    const materialFilters = byId('materialFilters');
    const serviceFilters = byId('serviceFilters');
    const addBtn = byId('openPriceItemModalBtn');
    if(titleEl) titleEl.textContent = isMat ? 'Cennik materiałów' : 'Cennik usług';
    if(subtitleEl) subtitleEl.textContent = isMat ? 'Szukaj, filtruj i zarządzaj materiałami.' : 'Szukaj, filtruj i zarządzaj usługami.';
    if(iconEl) iconEl.textContent = isMat ? '🧩' : '🔧';
    if(materialFilters) materialFilters.style.display = isMat ? 'grid' : 'none';
    if(serviceFilters) serviceFilters.style.display = isMat ? 'none' : 'grid';
    if(addBtn) addBtn.textContent = isMat ? 'Dodaj produkt' : 'Dodaj usługę';

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
  window.FC.priceModal._debug = {
    buildServiceCategoryOptions,
    buildManufacturerOptions,
    buildMaterialTypeOptions,
    filteredPriceList,
    runtimeState,
  };
})();
