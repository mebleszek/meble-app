// js/app/material/price-modal.js
// Renderer i kontroler modali cenników. Lista oraz formularz pozycji są rozdzielone,
// żeby dodawanie/edycja nie były doklejane do listy.

(function(){
  'use strict';
  window.FC = window.FC || {};
  window.FC.priceModal = window.FC.priceModal || {};
  const FC = window.FC;

  const MATERIAL_TYPES = ['laminat','akryl','lakier','blat','akcesoria'];
  const DEFAULT_SERVICE_CATEGORIES = ['Montaż','AGD','Pomiar','Transport','Projekt','Inne'];
  const runtimeState = {
    itemModalOpen: false,
    filters: {
      materialType: '',
      manufacturer: '',
      serviceCategory: '',
    },
  };

  function byId(id){ return document.getElementById(id); }

  function currentListType(){
    return uiState && uiState.showPriceList === 'services' ? 'services' : 'materials';
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
    const fromItems = (Array.isArray(typeof materials !== 'undefined' ? materials : null) ? materials : []).map((item)=> item && item.materialType);
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
    return buildOrderedValues([], source, selectedValue, cfg.includeAll ? 'Wszyscy producenci' : 'Brak / własny wpis');
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

  async function confirmDelete(){
    try{
      if(window.FC && FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
        return !!(await FC.confirmBox.ask({
          title:'Usunąć pozycję?',
          message:'Tej operacji nie cofnisz.',
          confirmText:'Usuń',
          cancelText:'Wróć',
          confirmTone:'danger',
          cancelTone:'neutral'
        }));
      }
    }catch(_){ }
    return true;
  }

  function persistUi(){
    try{ FC.storage.setJSON(STORAGE_KEYS.ui, uiState); }catch(_){ }
  }

  function clearMaterialForm(){
    const ids = ['formSymbol','formName','formPrice'];
    ids.forEach((id)=>{ const el = byId(id); if(el) el.value = ''; });
    const grain = byId('formHasGrain');
    if(grain) grain.checked = false;
  }

  function clearServiceForm(){
    const ids = ['formServiceName','formServicePrice'];
    ids.forEach((id)=>{ const el = byId(id); if(el) el.value = ''; });
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
        setSelectOptions(manufacturerEl, buildManufacturerOptions(typeEl && typeEl.value, currentManufacturer), currentManufacturer, currentManufacturer || 'Brak / własny wpis');
        mountItemChoices();
      }
    });
    mountChoice({
      selectEl: manufacturerEl,
      mountId: 'formManufacturerLaunch',
      title: 'Wybierz producenta',
      placeholder: 'Wybierz producenta'
    });
    mountChoice({
      selectEl: categoryEl,
      mountId: 'formCategoryLaunch',
      title: 'Wybierz kategorię usługi',
      placeholder: 'Wybierz kategorię'
    });
  }

  function bindToolbarEvents(){
    const search = byId('priceSearch');
    if(search){
      search.oninput = ()=>{ renderPriceModal(); };
    }
    const addBtn = byId('openPriceItemModalBtn');
    if(addBtn){
      addBtn.onclick = ()=>{ openPriceItemModal(null); };
    }
    const closeItemBtn = byId('closePriceItemModal');
    if(closeItemBtn) closeItemBtn.onclick = ()=>{ closePriceItemModal(); };
    const cancelMaterialBtn = byId('cancelEditBtn');
    if(cancelMaterialBtn) cancelMaterialBtn.onclick = ()=>{ closePriceItemModal(); };
    const cancelServiceBtn = byId('cancelServiceEditBtn');
    if(cancelServiceBtn) cancelServiceBtn.onclick = ()=>{ closePriceItemModal(); };
  }

  function currentEditedItem(){
    if(!uiState || !uiState.editingId) return null;
    if(currentListType() === 'materials') return (Array.isArray(materials) ? materials.find((item)=> item.id === uiState.editingId) : null) || null;
    return (Array.isArray(services) ? services.find((item)=> item.id === uiState.editingId) : null) || null;
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
    const isEdit = !!(uiState && uiState.editingId && item);
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
        applyMaterialFormState({ materialType:'laminat', manufacturer:'', symbol:'', name:'', price:'', hasGrain:false });
        clearMaterialForm();
      }
    }else{
      try{ if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') window.FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
      if(isEdit) applyServiceFormState(item);
      else {
        applyServiceFormState({ category:'Montaż', name:'', price:'' });
        clearServiceForm();
      }
    }
    mountItemChoices();
    bindToolbarEvents();
  }

  function openPriceItemModal(itemId){
    uiState.editingId = itemId || null;
    persistUi();
    runtimeState.itemModalOpen = true;
    renderItemModal();
  }

  function closePriceItemModal(){
    runtimeState.itemModalOpen = false;
    uiState.editingId = null;
    persistUi();
    const modal = byId('priceItemModal');
    if(modal) modal.style.display = 'none';
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
    const list = isMat ? (Array.isArray(materials) ? materials : []) : (Array.isArray(services) ? services : []);
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
      row.className = 'list-item';
      const left = document.createElement('div');
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
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger';
      delBtn.type = 'button';
      delBtn.textContent = 'Usuń';
      right.appendChild(price);
      right.appendChild(editBtn);
      right.appendChild(delBtn);
      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);

      editBtn.addEventListener('click', ()=>{ openPriceItemModal(item.id); });
      delBtn.addEventListener('click', ()=>{ deletePriceItem(item); });
    });
  }

  function renderPriceModal(){
    try{ if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') window.FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const modal = byId('priceModal');
    const type = uiState.showPriceList;
    const wasOpen = modal && modal.style.display === 'flex';
    if(!type){
      closePriceItemModal();
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

  function closePriceModal(){
    closePriceItemModal();
    try{ unlockModalScroll(); }catch(_){ }
    uiState.showPriceList = null;
    persistUi();
    const modal = byId('priceModal');
    if(modal) modal.style.display = 'none';
  }

  function saveMaterialFromForm(){
    const type = String((byId('formMaterialType') && byId('formMaterialType').value) || 'laminat');
    const manufacturer = String((byId('formManufacturer') && byId('formManufacturer').value) || '').trim();
    const symbol = String((byId('formSymbol') && byId('formSymbol').value) || '').trim();
    const name = String((byId('formName') && byId('formName').value) || '').trim();
    const price = parseFloat((byId('formPrice') && byId('formPrice').value) || 0);
    const hasGrain = !!(byId('formHasGrain') && byId('formHasGrain').checked);
    if(!name){
      info('Brak nazwy', 'Wprowadź nazwę materiału, zanim go zapiszesz.');
      return;
    }
    const data = { materialType:type, manufacturer, symbol, name, price, hasGrain };
    if(uiState.editingId){
      materials = (Array.isArray(materials) ? materials : []).map((m)=> m.id === uiState.editingId ? Object.assign({}, m, data) : m);
    } else {
      const id = FC.utils.uid();
      materials = (Array.isArray(materials) ? materials : []).concat([Object.assign({ id }, data)]);
    }
    FC.storage.setJSON(STORAGE_KEYS.materials, materials);
    closePriceItemModal();
    renderPriceModal();
    try{ renderCabinetModal(); }catch(_){ }
  }

  function saveServiceFromForm(){
    try{ if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') window.FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const category = String((byId('formCategory') && byId('formCategory').value) || '').trim() || 'Montaż';
    const name = String((byId('formServiceName') && byId('formServiceName').value) || '').trim();
    const price = parseFloat((byId('formServicePrice') && byId('formServicePrice').value) || 0);
    if(!name){
      info('Brak nazwy', 'Wprowadź nazwę usługi, zanim ją zapiszesz.');
      return;
    }
    const data = { category, name, price };
    if(uiState.editingId){
      services = (Array.isArray(services) ? services : []).map((s)=> s.id === uiState.editingId ? Object.assign({}, s, data) : s);
    } else {
      const id = FC.utils.uid();
      services = (Array.isArray(services) ? services : []).concat([Object.assign({ id }, data)]);
    }
    FC.storage.setJSON(STORAGE_KEYS.services, services);
    closePriceItemModal();
    renderPriceModal();
  }

  async function deletePriceItem(item){
    const ok = await confirmDelete();
    if(!ok) return;
    if(currentListType() === 'materials'){
      materials = (Array.isArray(materials) ? materials : []).filter((m)=> m.id !== item.id);
      FC.storage.setJSON(STORAGE_KEYS.materials, materials);
    } else {
      services = (Array.isArray(services) ? services : []).filter((s)=> s.id !== item.id);
      FC.storage.setJSON(STORAGE_KEYS.services, services);
    }
    if(String(uiState.editingId || '') === String(item && item.id || '')) closePriceItemModal();
    renderPriceModal();
    try{ renderCabinetModal(); }catch(_){ }
  }

  window.FC.priceModal.renderPriceModal = renderPriceModal;
  window.FC.priceModal.closePriceModal = closePriceModal;
  window.FC.priceModal.openPriceItemModal = openPriceItemModal;
  window.FC.priceModal.closePriceItemModal = closePriceItemModal;
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
