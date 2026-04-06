// js/app/material/price-modal.js
// Wydzielony renderer modala cenników. app.js ma tu być tylko delegatorem.

(function(){
  'use strict';
  window.FC = window.FC || {};
  window.FC.priceModal = window.FC.priceModal || {};

  const MATERIAL_TYPES = ['laminat','akryl','lakier','blat','akcesoria'];
  const DEFAULT_SERVICE_CATEGORIES = ['Montaż','AGD','Pomiar','Transport','Projekt','Inne'];

  function byId(id){ return document.getElementById(id); }

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
      const firstNonEmpty = Array.from(selectEl.options || []).find((opt)=> String(opt.value || '') !== '');
      selectEl.value = firstNonEmpty ? String(firstNonEmpty.value || '') : '';
    }
  }

  function buildMaterialTypeOptions(){
    return MATERIAL_TYPES.map((value)=> ({ value, label:value }));
  }

  function buildManufacturerOptions(typeVal, selectedValue){
    const registry = window.FC && window.FC.materialRegistry;
    const manufacturers = (registry && registry.MANUFACTURERS) || {};
    const selected = String(selectedValue || '');
    const names = (manufacturers[String(typeVal || '')] || []).slice();
    const options = [{ value:'', label:'Brak / własny wpis' }].concat(names.map((name)=> ({ value:name, label:name })));
    if(selected && !options.some((entry)=> String(entry.value || '') === selected)) options.push({ value:selected, label:selected });
    return options;
  }

  function buildServiceCategoryOptions(selectedValue){
    const seen = new Set();
    const out = [];
    const serviceList = Array.isArray((typeof services !== 'undefined') ? services : null) ? services : [];
    const add = (value)=>{
      const key = String(value || '').trim();
      if(!key || seen.has(key)) return;
      seen.add(key);
      out.push({ value:key, label:key });
    };
    DEFAULT_SERVICE_CATEGORIES.forEach(add);
    serviceList.forEach((item)=> add(item && item.category));
    add(selectedValue);
    return out;
  }

  function mountChoice(opts){
    const cfg = Object.assign({ selectEl:null, mountId:'', title:'Wybierz', buttonClass:'price-modal-choice-launch', disabled:false, placeholder:'Wybierz', onChange:null }, opts || {});
    const selectEl = cfg.selectEl;
    const mount = cfg.mountId ? byId(cfg.mountId) : null;
    if(!(mount && selectEl && window.FC && FC.investorChoice && typeof FC.investorChoice.mountChoice === 'function')) return null;
    return FC.investorChoice.mountChoice({
      mount,
      selectEl,
      title: cfg.title,
      buttonClass: `investor-choice-launch ${cfg.buttonClass}`,
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
        return !!(await FC.confirmBox.ask({ title:'Usunąć pozycję?', message:'Tej operacji nie cofnisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' }));
      }
    }catch(_){ }
    return true;
  }

  function persistUi(){
    try{ FC.storage.setJSON(STORAGE_KEYS.ui, uiState); }catch(_){ }
  }

  function clearMaterialForm(){
    byId('formSymbol').value = '';
    byId('formName').value = '';
    byId('formPrice').value = '';
    const grain = byId('formHasGrain');
    if(grain) grain.checked = false;
  }

  function clearServiceForm(){
    byId('formServiceName').value = '';
    byId('formServicePrice').value = '';
  }

  function applyMaterialFormState(item){
    const typeEl = byId('formMaterialType');
    const manufacturerEl = byId('formManufacturer');
    const materialType = String(item && item.materialType || 'laminat');
    setSelectOptions(typeEl, buildMaterialTypeOptions(), materialType, materialType);
    setSelectOptions(manufacturerEl, buildManufacturerOptions(materialType, item && item.manufacturer), String(item && item.manufacturer || ''), String(item && item.manufacturer || ''));
    byId('formSymbol').value = String(item && item.symbol || '');
    byId('formName').value = String(item && item.name || '');
    byId('formPrice').value = item && item.price != null ? item.price : '';
    const grain = byId('formHasGrain');
    if(grain) grain.checked = !!(item && item.hasGrain);
  }

  function applyServiceFormState(item){
    const categoryEl = byId('formCategory');
    const category = String(item && item.category || 'Montaż');
    setSelectOptions(categoryEl, buildServiceCategoryOptions(category), category, category);
    byId('formServiceName').value = String(item && item.name || '');
    byId('formServicePrice').value = item && item.price != null ? item.price : '';
  }

  function mountMaterialChoices(){
    const typeEl = byId('formMaterialType');
    const manufacturerEl = byId('formManufacturer');
    mountChoice({
      selectEl: typeEl,
      mountId: 'formMaterialTypeLaunch',
      title: 'Wybierz typ materiału',
      placeholder: 'Wybierz typ',
      onChange: ()=>{
        const currentManufacturer = String(manufacturerEl.value || '');
        setSelectOptions(manufacturerEl, buildManufacturerOptions(typeEl.value, currentManufacturer), currentManufacturer, currentManufacturer || 'Brak / własny wpis');
        mountMaterialChoices();
      }
    });
    mountChoice({
      selectEl: manufacturerEl,
      mountId: 'formManufacturerLaunch',
      title: 'Wybierz producenta',
      placeholder: 'Wybierz producenta',
    });
  }

  function mountServiceChoices(){
    const categoryEl = byId('formCategory');
    mountChoice({
      selectEl: categoryEl,
      mountId: 'formCategoryLaunch',
      title: 'Wybierz kategorię usługi',
      placeholder: 'Wybierz kategorię',
    });
  }

  function renderPriceModal(){
    try{ if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') window.FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const modal = byId('priceModal');
    const type = uiState.showPriceList;
    const wasOpen = modal && modal.style.display === 'flex';
    if(!type){
      if(modal) modal.style.display = 'none';
      if(wasOpen) try{ unlockModalScroll(); }catch(_){ }
      return;
    }

    modal.style.display = 'flex';
    if(!wasOpen){
      try{ lockModalScroll(); }catch(_){ }
      try{
        modal.classList.add('modal-open-guard');
        requestAnimationFrame(() => setTimeout(() => {
          try{ modal.classList.remove('modal-open-guard'); }catch(_){ }
        }, 260));
      }catch(_){ }
    }
    const isMat = type === 'materials';
    byId('priceModalTitle').textContent = isMat ? 'Cennik Materiałów' : 'Cennik Usług';
    byId('priceModalSubtitle').textContent = isMat ? 'Dodaj/edytuj materiały' : 'Dodaj/edytuj usługi';
    byId('priceModalIcon').textContent = isMat ? '🧩' : '🔧';
    byId('materialFormFields').style.display = isMat ? 'block' : 'none';
    byId('serviceFormFields').style.display = isMat ? 'none' : 'block';
    byId('editingIndicator').style.display = uiState.editingId ? 'inline-block' : 'none';
    byId('priceFormTitle').textContent = uiState.editingId ? 'Edytuj pozycję' : 'Dodaj pozycję';

    const typeEl = byId('formMaterialType');
    const manufacturerEl = byId('formManufacturer');
    setSelectOptions(typeEl, buildMaterialTypeOptions(), 'laminat', 'laminat');
    setSelectOptions(manufacturerEl, buildManufacturerOptions('laminat', ''), '', 'Brak / własny wpis');

    if(uiState.editingId){
      if(isMat){
        const item = materials.find((m)=> m.id === uiState.editingId);
        if(item) applyMaterialFormState(item);
      } else {
        const item = services.find((s)=> s.id === uiState.editingId);
        if(item) applyServiceFormState(item);
      }
      byId('cancelEditBtn').style.display = isMat ? 'inline-block' : 'none';
      byId('cancelServiceEditBtn').style.display = isMat ? 'none' : 'inline-block';
    } else {
      applyMaterialFormState({ materialType:'laminat', manufacturer:'', symbol:'', name:'', price:'', hasGrain:false });
      clearMaterialForm();
      applyServiceFormState({ category:'Montaż', name:'', price:'' });
      clearServiceForm();
      byId('cancelEditBtn').style.display = 'none';
      byId('cancelServiceEditBtn').style.display = 'none';
    }

    mountMaterialChoices();
    mountServiceChoices();

    const q = String(byId('priceSearch').value || '').trim().toLowerCase();
    const list = isMat ? materials : services;
    const filtered = list.filter((item)=>{
      const name = String(item && item.name || '').toLowerCase();
      const symbol = String(item && item.symbol || '').toLowerCase();
      const manu = String(item && item.manufacturer || '').toLowerCase();
      const mt = String(item && item.materialType || '').toLowerCase();
      const cat = String(item && item.category || '').toLowerCase();
      return name.includes(q) || symbol.includes(q) || manu.includes(q) || mt.includes(q) || cat.includes(q);
    });

    const container = byId('priceListItems');
    container.innerHTML = '';
    filtered.forEach((item)=>{
      const row = document.createElement('div');
      row.className = 'list-item';
      const left = document.createElement('div');
      left.style.minWidth = '0';
      const grainBadge = (isMat && item.hasGrain) ? ' • 🌾 słoje' : '';
      left.innerHTML = `<div style="font-weight:900">${item.name}</div><div class="muted-tag xs">${isMat ? (item.materialType + ' • ' + (item.manufacturer || '—') + (item.symbol ? ' • SYM: ' + item.symbol : '') + grainBadge) : (item.category || '—')}</div>`;
      const right = document.createElement('div');
      right.className = 'price-modal-list-actions';
      const price = document.createElement('div');
      price.className = 'price-modal-list-price';
      price.textContent = (Number(item.price) || 0).toFixed(2) + ' PLN';
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

      editBtn.addEventListener('click', ()=>{
        uiState.editingId = item.id;
        persistUi();
        renderPriceModal();
      });
      delBtn.addEventListener('click', ()=>{ deletePriceItem(item); });
    });

    byId('savePriceBtn').onclick = saveMaterialFromForm;
    byId('saveServiceBtn').onclick = saveServiceFromForm;
    byId('cancelEditBtn').onclick = ()=>{
      uiState.editingId = null;
      persistUi();
      renderPriceModal();
    };
    byId('cancelServiceEditBtn').onclick = ()=>{
      uiState.editingId = null;
      persistUi();
      renderPriceModal();
    };
  }

  function closePriceModal(){
    try{ unlockModalScroll(); }catch(_){ }
    uiState.showPriceList = null;
    uiState.editingId = null;
    persistUi();
    const modal = byId('priceModal');
    if(modal) modal.style.display = 'none';
  }

  function saveMaterialFromForm(){
    const type = String(byId('formMaterialType').value || 'laminat');
    const manufacturer = String(byId('formManufacturer').value || '').trim();
    const symbol = String(byId('formSymbol').value || '').trim();
    const name = String(byId('formName').value || '').trim();
    const price = parseFloat(byId('formPrice').value || 0);
    const hasGrain = !!(byId('formHasGrain') && byId('formHasGrain').checked);
    if(!name){
      info('Brak nazwy', 'Wprowadź nazwę materiału, zanim go zapiszesz.');
      return;
    }
    const data = { materialType:type, manufacturer, symbol, name, price, hasGrain };
    if(uiState.editingId){
      materials = materials.map((m)=> m.id === uiState.editingId ? Object.assign({}, m, data) : m);
      uiState.editingId = null;
    } else {
      const id = FC.utils.uid();
      materials.push(Object.assign({ id }, data));
    }
    FC.storage.setJSON(STORAGE_KEYS.materials, materials);
    renderPriceModal();
    try{ renderCabinetModal(); }catch(_){ }
  }

  function saveServiceFromForm(){
    try{ if(window.FC && window.FC.wycenaCore && typeof window.FC.wycenaCore.ensureServiceCatalogInRuntime === 'function') window.FC.wycenaCore.ensureServiceCatalogInRuntime(); }catch(_){ }
    const category = String(byId('formCategory').value || '').trim() || 'Montaż';
    const name = String(byId('formServiceName').value || '').trim();
    const price = parseFloat(byId('formServicePrice').value || 0);
    if(!name){
      info('Brak nazwy', 'Wprowadź nazwę usługi, zanim ją zapiszesz.');
      return;
    }
    const data = { category, name, price };
    if(uiState.editingId){
      services = services.map((s)=> s.id === uiState.editingId ? Object.assign({}, s, data) : s);
      uiState.editingId = null;
    } else {
      const id = FC.utils.uid();
      services.push(Object.assign({ id }, data));
    }
    FC.storage.setJSON(STORAGE_KEYS.services, services);
    renderPriceModal();
  }

  async function deletePriceItem(item){
    const ok = await confirmDelete();
    if(!ok) return;
    if(uiState.showPriceList === 'materials'){
      materials = materials.filter((m)=> m.id !== item.id);
      FC.storage.setJSON(STORAGE_KEYS.materials, materials);
    } else {
      services = services.filter((s)=> s.id !== item.id);
      FC.storage.setJSON(STORAGE_KEYS.services, services);
    }
    renderPriceModal();
    try{ renderCabinetModal(); }catch(_){ }
  }

  window.FC.priceModal.renderPriceModal = renderPriceModal;
  window.FC.priceModal.closePriceModal = closePriceModal;
  window.FC.priceModal.saveMaterialFromForm = saveMaterialFromForm;
  window.FC.priceModal.saveServiceFromForm = saveServiceFromForm;
  window.FC.priceModal.deletePriceItem = deletePriceItem;
  window.FC.priceModal._debug = {
    buildServiceCategoryOptions,
    buildManufacturerOptions,
    buildMaterialTypeOptions,
  };
})();
