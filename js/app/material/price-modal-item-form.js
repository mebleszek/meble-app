// js/app/material/price-modal-item-form.js
// Stan formularza i wewnętrzny modal dodawania/edycji pozycji katalogu.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  function filterMaterialWrapper(){ return ctx.byId('formMaterialTypeLaunch') && ctx.byId('formMaterialTypeLaunch').parentElement; }
  function filterManufacturerWrapper(){ return ctx.byId('formManufacturerLaunch') && ctx.byId('formManufacturerLaunch').parentElement; }
  function formCategoryWrapper(){ return ctx.byId('formCategoryLaunch') && ctx.byId('formCategoryLaunch').parentElement; }
  function formServiceNameWrapper(){ return ctx.byId('formServiceName') && ctx.byId('formServiceName').parentElement; }
  function formPriceWrapper(){ return ctx.byId('formPrice') && ctx.byId('formPrice').parentElement; }
  function formMaterialPriceUnitWrapper(){ return ctx.byId('formMaterialPriceUnitLaunch') && ctx.byId('formMaterialPriceUnitLaunch').parentElement; }
  function formHasGrainRow(){ return ctx.byId('formHasGrain') && ctx.byId('formHasGrain').parentElement; }
  function hardwareSeriesTopWrap(){ return ctx.byId('hardwareSeriesTopWrap'); }
  function laborFields(){ return ctx.byId('laborFormFields'); }
  function hardwareFields(){ return ctx.byId('hardwareFormFields'); }

  function setFormNameLabel(label){
    const node = ctx.byId('formNameLabel');
    if(!node) return;
    const target = node.querySelector ? (node.querySelector('.label-help__text') || node) : node;
    target.textContent = String(label || 'Nazwa');
  }
  function toggleHardwareTechnicalNamePreview(show){
    const wrap = ctx.byId('hardwareTechnicalNamePreviewWrap');
    if(wrap) wrap.style.display = show ? '' : 'none';
  }


  const LABOR_CHOICE_FIELDS = [
    { id:'laborRateType', title:'Wybierz stawkę godzinową', placeholder:'Stawka godzinowa' },
    { id:'laborTimeBlockHours', title:'Wybierz czas bazowy', placeholder:'Czas bazowy' },
    { id:'laborQuantitySource', title:'Wybierz źródło ilości', placeholder:'Źródło ilości' },
    { id:'laborQuantityMode', title:'Wybierz tryb ilości', placeholder:'Tryb ilości' },
    { id:'laborStartHours', title:'Wybierz czas startowy', placeholder:'Start h' },
    { id:'laborStepHours', title:'Wybierz czas kolejnego kroku', placeholder:'Dodaj h' },
    { id:'laborVolumeTimeMode', title:'Wybierz gabarytoczas', placeholder:'Gabarytoczas' },
  ];


  function ensureLaborChoiceMount(selectEl){
    if(!(selectEl && selectEl.parentNode)) return null;
    const mountId = String(selectEl.id || '') + 'Launch';
    let mount = ctx.byId(mountId);
    if(!mount){
      mount = document.createElement('div');
      mount.id = mountId;
      mount.className = 'price-labor-choice-slot';
      selectEl.insertAdjacentElement('afterend', mount);
    }
    try{ selectEl.hidden = true; selectEl.setAttribute('aria-hidden', 'true'); }catch(_){ }
    return mount;
  }


  function hideLaborUsageField(){
    const el = ctx.byId('laborUsage');
    if(!el) return;
    try{ el.value = 'universal'; }catch(_){ }
    const wrap = el.closest ? el.closest('div') : el.parentElement;
    if(wrap) wrap.style.display = 'none';
  }

  function mountLaborChoiceLaunchers(){
    LABOR_CHOICE_FIELDS.forEach((field)=>{
      const selectEl = ctx.byId(field.id);
      const mount = ensureLaborChoiceMount(selectEl);
      if(!(selectEl && mount)) return;
      ctx.mountChoice({
        selectEl,
        mountId:mount.id,
        title:field.title,
        buttonClass:'investor-choice-launch price-labor-choice-launch',
        placeholder:field.placeholder,
        onChange:()=>{ if(field.id === 'laborRateType') syncLaborRateProfileUi(); updateItemActionState(); },
      });
    });
  }


  function defaultMaterialPriceUnit(materialType){
    const type = String(materialType || '').trim().toLowerCase();
    if(type === 'akryl' || type === 'lakier' || type === 'hdf') return 'm2';
    if(type === 'obrzeże' || type === 'obrzeze') return 'mb';
    if(type === 'blat') return 'piece';
    return 'sheet';
  }
  function defaultMaterialDraft(){
    const type = ctx.firstNonEmptyValue(ctx.buildMaterialTypeOptions('laminat')) || 'laminat';
    const manufacturer = ctx.firstNonEmptyValue(ctx.buildManufacturerOptions('materials', type, '', { includeAll:false }));
    return { materialType:type, manufacturer, symbol:'', name:'', price:'', priceUnit:defaultMaterialPriceUnit(type), hasGrain:false };
  }
  function defaultServiceDraft(kind){
    const isQuoteRates = kind === 'quoteRates';
    return {
      category:ctx.firstNonEmptyValue(ctx.buildCategoryOptions(kind, isQuoteRates ? 'Korpusy' : 'Cięcie', { includeAll:false })) || (isQuoteRates ? 'Korpusy' : 'Cięcie'),
      name:'',
      price:'',
      usage:isQuoteRates ? 'universal' : '',
      rateType:'workshop',
      timeBlockHours:0,
      defaultMultiplier:1,
      quantityMode:'none',
      quantityTiers:[],
      startHours:0,
      startQty:1,
      stepEveryQty:1,
      stepHours:0,
      volumePricePerM3:0,
      volumeTimeMode:'none',
      volumeTimePerM3:0,
      volumeTimeTiers:[],
      conditions:[],
      active:true,
      internalOnly:true,
    };
  }

  function currentEditedItem(){
    const editingId = ctx.appUiState() && ctx.appUiState().editingId;
    if(!editingId) return null;
    return ctx.currentList().find((item)=> item && item.id === editingId) || null;
  }
  function normalizePriceValue(value){ const raw = String(value == null ? '' : value).trim(); if(!raw) return ''; const parsed = Number(raw.replace(',', '.')); return Number.isFinite(parsed) ? parsed : raw; }
  function readNumber(id){ return normalizePriceValue(ctx.byId(id) && ctx.byId(id).value); }
  function readString(id){ return String((ctx.byId(id) && ctx.byId(id).value) || '').trim(); }
  function readBool(id){ return !!(ctx.byId(id) && ctx.byId(id).checked); }
  function setValue(id, value){ const el = ctx.byId(id); if(el) el.value = value == null ? '' : String(value); }
  function setChecked(id, value){ const el = ctx.byId(id); if(el) el.checked = !!value; }

  function setServicePriceLabel(label){
    const node = ctx.byId('formServicePriceLabel');
    if(!node) return;
    const target = node.querySelector ? (node.querySelector('.label-help__text') || node) : node;
    target.textContent = String(label || 'Kwota stała / cena prosta (PLN)');
  }
  function isHourlyRateItem(item){
    const labor = FC.laborCatalog || {};
    try{ return labor.isHourlyRateDefinition ? labor.isHourlyRateDefinition(item || {}) : false; }
    catch(_){ return false; }
  }
  function isHourlyRateMode(){ return !!(ctx.byId('laborIsHourlyRate') && ctx.byId('laborIsHourlyRate').checked); }
  function getLaborRateProfiles(selectedCode){
    const labor = FC.laborCatalog || {};
    try{ return labor.buildRateProfiles ? labor.buildRateProfiles(ctx.currentList ? ctx.currentList() : [], selectedCode) : []; }
    catch(_){ return []; }
  }
  function findRateProfile(code){
    const labor = FC.laborCatalog || {};
    try{ return labor.findRateProfile ? labor.findRateProfile(ctx.currentList ? ctx.currentList() : [], code) : null; }
    catch(_){ return null; }
  }
  function buildLaborRateProfileOptions(selectedCode){
    const labor = FC.laborCatalog || {};
    try{ if(labor.rateProfileOptions) return labor.rateProfileOptions(ctx.currentList ? ctx.currentList() : [], selectedCode); }catch(_){ }
    return getLaborRateProfiles(selectedCode).map((row)=> ({ value:row.code, label:row.label || row.name || row.code }));
  }
  function buildLaborQuantitySourceOptions(selectedCode){
    const labor = FC.laborCatalog || {};
    try{ if(labor.quantitySourceOptions) return labor.quantitySourceOptions(selectedCode); }catch(_){ }
    const api = FC.workQuantitySources || {};
    try{ if(api.quantityOptions) return api.quantityOptions(selectedCode); }catch(_){ }
    return [{ value:'', label:'Brak przypisanego źródła' }];
  }
  function refreshLaborQuantitySourceSelect(selectedCode){
    const code = selectedCode || readString('laborQuantitySource') || '';
    ctx.setSelectOptions(ctx.byId('laborQuantitySource'), buildLaborQuantitySourceOptions(code), code, '');
    setValue('laborQuantitySource', code);
  }
  function laborConditionsApi(){ return ctx.priceModalLaborConditions || null; }
  function getCurrentLaborConditions(){
    const api = laborConditionsApi();
    return api && typeof api.current === 'function' ? api.current() : [];
  }
  function renderLaborConditions(rows){
    const api = laborConditionsApi();
    if(api && typeof api.render === 'function') api.render(rows || [], updateItemActionState);
  }

  function laborSourceLabel(code){
    const key = readString('laborQuantitySource') || String(code || '').trim();
    if(!key) return 'Brak przypisanego źródła';
    try{
      const api = FC.workQuantitySources || {};
      const src = api && typeof api.find === 'function' ? api.find(key) : null;
      if(src && src.label) return `${src.label} (${key})${src.unit && src.unit !== '—' ? ' — ' + src.unit : ''}`;
    }catch(_){ }
    return key;
  }
  function laborRateLabel(code){
    const key = String(code || readString('laborRateType') || 'workshop').trim();
    try{
      const profile = findRateProfile(key);
      if(profile) return `${profile.label || profile.name || key}${Number(profile.price) > 0 ? ' — ' + Number(profile.price).toFixed(2) + ' PLN/h' : ''}`;
    }catch(_){ }
    try{
      const labor = FC.laborCatalog || {};
      if(labor.getRateLabel) return labor.getRateLabel(key);
    }catch(_){ }
    return key;
  }
  function quantityModeLabel(code){
    const key = String(code || readString('laborQuantityMode') || 'none').trim();
    try{
      const labor = FC.laborCatalog || {};
      if(labor.getQuantityModeLabel) return labor.getQuantityModeLabel(key);
    }catch(_){ }
    return key || 'Bez ilości';
  }
  function conditionsHumanText(){
    const rows = getCurrentLaborConditions();
    if(!rows.length) return 'Brak ograniczeń — reguła działa dla każdej szafki, która zwróci dodatnią ilość.';
    const api = laborConditionsApi();
    return rows.map((row, idx)=> {
      try{ if(api && typeof api.conditionText === 'function') return `${idx + 1}. ${api.conditionText(row)}`; }catch(_){ }
      return `${idx + 1}. ${row.source || ''}: ${row.min == null ? '…' : row.min}–${row.max == null ? '…' : row.max}`;
    }).join(' / ');
  }
  function ensureLaborRulePreview(){
    let preview = ctx.byId('laborRulePreview');
    if(preview) return preview;
    const wrap = laborFields();
    if(!wrap) return null;
    preview = document.createElement('div');
    preview.id = 'laborRulePreview';
    preview.className = 'price-labor-rule-preview';
    wrap.appendChild(preview);
    return preview;
  }
  function addPreviewRow(rows, key, value){
    const row = document.createElement('div');
    row.className = 'price-labor-rule-preview__row';
    const k = document.createElement('div');
    k.className = 'price-labor-rule-preview__key';
    k.textContent = key;
    const v = document.createElement('div');
    v.className = 'price-labor-rule-preview__value';
    v.textContent = String(value || '—');
    row.appendChild(k);
    row.appendChild(v);
    rows.appendChild(row);
  }
  function syncLaborRulePreview(){
    if(ctx.currentListKind && ctx.currentListKind() !== 'quoteRates') return;
    const preview = ensureLaborRulePreview();
    if(!preview) return;
    const hourly = isHourlyRateMode();
    preview.style.display = hourly ? 'none' : '';
    if(hourly) return;
    preview.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'price-labor-rule-preview__title';
    title.textContent = 'Podgląd działania reguły';
    const rows = document.createElement('div');
    rows.className = 'price-labor-rule-preview__rows';
    addPreviewRow(rows, 'Ilość', laborSourceLabel(readString('laborQuantitySource')));
    addPreviewRow(rows, 'Tryb', quantityModeLabel(readString('laborQuantityMode')));
    addPreviewRow(rows, 'Czas', `${Number(readNumber('laborTimeBlockHours')) || 0} h bazowo · mnożnik x${Number(readNumber('laborDefaultMultiplier')) || 1}`);
    addPreviewRow(rows, 'Stawka', laborRateLabel(readString('laborRateType')));
    addPreviewRow(rows, 'Warunki', conditionsHumanText());
    addPreviewRow(rows, 'Zapis', 'WYCENA czyta te wartości z aktualnej szafki przez workQuantityFacts; nie tworzy drugiej kopii danych szafki.');
    preview.appendChild(title);
    preview.appendChild(rows);
  }
  function refreshLaborRateTypeSelect(selectedCode){
    const code = selectedCode || readString('laborRateType') || 'workshop';
    ctx.setSelectOptions(ctx.byId('laborRateType'), buildLaborRateProfileOptions(code), code, code);
    setValue('laborRateType', code);
  }
  function syncLaborRateProfileUi(){
    if(ctx.currentListKind && ctx.currentListKind() !== 'quoteRates') return;
    const hourly = isHourlyRateMode();
    const title = ctx.byId('laborFormSectionTitle');
    const rule = ctx.byId('laborRuleFields');
    const rateFields = ctx.byId('laborRateProfileFields');
    const conditionWrap = ctx.byId('laborConditionsWrap');
    const toggleWrap = ctx.byId('laborHourlyToggleWrap');
    const internalWrap = ctx.byId('laborInternalOnlyWrap');
    const categoryWrap = formCategoryWrapper();
    const codeInput = ctx.byId('laborRateCode');
    const preview = ctx.byId('laborRateProfilePreview');
    const item = currentEditedItem();
    const isEdit = !!(ctx.appUiState() && ctx.appUiState().editingId);
    if(toggleWrap) toggleWrap.style.display = '';
    if(rule) rule.style.display = hourly ? 'none' : '';
    if(rateFields) rateFields.style.display = hourly ? '' : 'none';
    if(conditionWrap) conditionWrap.style.display = hourly ? 'none' : '';
    const rulePreview = ctx.byId('laborRulePreview');
    if(rulePreview) rulePreview.style.display = hourly ? 'none' : '';
    if(title) title.textContent = hourly ? 'Stawka godzinowa' : 'Reguła robocizny';
    if(internalWrap) internalWrap.style.display = hourly ? 'none' : '';
    if(categoryWrap) categoryWrap.style.display = hourly ? 'none' : '';
    setServicePriceLabel(hourly ? 'Kwota stawki godzinowej (PLN/h)' : 'Kwota stała / cena prosta (PLN)');
    setFormNameLabel(hourly ? 'Nazwa przyjazna stawki' : 'Nazwa przyjazna / nazwa pozycji');
    if(hourly){
      try{ ctx.setSelectOptions(ctx.byId('formCategory'), ctx.buildCategoryOptions('quoteRates', 'Stawki godzinowe'), 'Stawki godzinowe', 'Stawki godzinowe'); }catch(_){ }
      if(ctx.byId('laborInternalOnly')) ctx.byId('laborInternalOnly').checked = false;
    }
    if(codeInput){
      if(hourly && !String(codeInput.value || '').trim() && item){
        const labor = FC.laborCatalog || {};
        const code = labor.normalizeRateCode ? labor.normalizeRateCode(item.rateKey || item.rateCode || item.rateType) : String(item.rateKey || item.rateCode || item.rateType || '');
        codeInput.value = code;
      }
      codeInput.readOnly = hourly && isEdit;
      if(codeInput.readOnly) codeInput.setAttribute('aria-readonly', 'true'); else codeInput.removeAttribute('aria-readonly');
    }
    const code = codeInput ? String(codeInput.value || '').trim() : '';
    const profile = findRateProfile(code);
    if(preview){
      const price = Number(ctx.byId('formServicePrice') && ctx.byId('formServicePrice').value || 0) || (profile ? Number(profile.price) || 0 : 0);
      preview.value = hourly && code ? `${code}${price > 0 ? ' • ' + price.toFixed(2) + ' zł/h' : ''}` : '';
    }
  }

  function syncLaborGabarytMode(){
    if(ctx.currentListKind && ctx.currentListKind() !== 'quoteRates') return;
    const modeEl = ctx.byId('laborVolumeTimeMode');
    const priceEl = ctx.byId('laborVolumePricePerM3');
    if(!(modeEl && priceEl)) return;
    const activeVolumeTime = String(modeEl.value || 'none') !== 'none';
    if(activeVolumeTime){
      if(String(priceEl.value || '') !== '0') priceEl.value = '0';
      priceEl.disabled = true;
      priceEl.setAttribute('aria-disabled', 'true');
      priceEl.title = 'Wyłączone, bo gabaryt jest liczony jako czas. Żeby użyć dopłaty PLN/m³, ustaw Gabarytoczas na Wyłączony.';
    }else{
      priceEl.disabled = false;
      priceEl.removeAttribute('aria-disabled');
      priceEl.removeAttribute('title');
    }
  }

  function getCurrentMaterialDraft(){
    const materialType = String((ctx.byId('formMaterialType') && ctx.byId('formMaterialType').value) || '');
    const priceUnit = String((ctx.byId('formMaterialPriceUnit') && ctx.byId('formMaterialPriceUnit').value) || defaultMaterialPriceUnit(materialType));
    return {
      materialType,
      manufacturer:String((ctx.byId('formManufacturer') && ctx.byId('formManufacturer').value) || '').trim(),
      symbol:String((ctx.byId('formSymbol') && ctx.byId('formSymbol').value) || '').trim(),
      name:String((ctx.byId('formName') && ctx.byId('formName').value) || '').trim(),
      price:normalizePriceValue(ctx.byId('formPrice') && ctx.byId('formPrice').value),
      priceUnit,
      hasGrain:!!(ctx.byId('formHasGrain') && ctx.byId('formHasGrain').checked)
    };
  }
  function getCurrentAccessoryDraft(opts){ return ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.getCurrentAccessoryDraft === 'function' ? ctx.priceModalHardwareForm.getCurrentAccessoryDraft(opts || {}) : {}; }
  function getCurrentLaborDraft(base){
    if(ctx.currentListKind() !== 'quoteRates') return {};
    const labor = FC.laborCatalog || {};
    if(isHourlyRateMode()){
      const code = labor.normalizeRateCode ? labor.normalizeRateCode(readString('laborRateCode')) : readString('laborRateCode');
      return {
        category:'Stawki godzinowe',
        usage:'universal',
        isHourlyRate:true,
        rateKey:code,
        rateCode:code,
        rateType:code || 'workshop',
        timeBlockHours:0,
        defaultMultiplier:1,
        quantityMode:'none',
        quantityTiers:[],
        startHours:0,
        startQty:1,
        stepEveryQty:1,
        stepHours:0,
        volumePricePerM3:0,
        volumeTimeMode:'none',
        volumeTimePerM3:0,
        volumeTimeTiers:[],
        conditions:[],
        active:readBool('laborActive'),
        internalOnly:false,
        systemRate:false,
        nonDeletable:true,
      };
    }
    const tierText = readString('laborTierText');
    const volumeTierText = readString('laborVolumeTimeTierText');
    const volumeTimeMode = readString('laborVolumeTimeMode') || 'none';
    const rateType = labor.normalizeRateCode ? labor.normalizeRateCode(readString('laborRateType')) : (readString('laborRateType') || 'workshop');
    return {
      usage:'universal',
      rateType:rateType || 'workshop',
      rateKey:'',
      rateCode:'',
      timeBlockHours:Number(readNumber('laborTimeBlockHours')) || 0,
      defaultMultiplier:Number(readNumber('laborDefaultMultiplier')) || 1,
      quantityMode:readString('laborQuantityMode') || 'none',
      quantitySource:readString('laborQuantitySource'),
      quantityTiers:labor.parseTierText ? labor.parseTierText(tierText) : [],
      startHours:Number(readNumber('laborStartHours')) || 0,
      startQty:Number(readNumber('laborStartQty')) || 1,
      stepEveryQty:Number(readNumber('laborStepEveryQty')) || 1,
      stepHours:Number(readNumber('laborStepHours')) || 0,
      volumePricePerM3:volumeTimeMode === 'none' ? (Number(readNumber('laborVolumePricePerM3')) || 0) : 0,
      volumeTimeMode,
      volumeTimePerM3:Number(readNumber('laborVolumeTimePerM3')) || 0,
      volumeTimeTiers:labor.parseVolumeTierText ? labor.parseVolumeTierText(volumeTierText) : [],
      conditions:getCurrentLaborConditions(),
      active:readBool('laborActive'),
      internalOnly:readBool('laborInternalOnly'),
    };
  }
  function getCurrentServiceDraft(){
    const base = { category:String((ctx.byId('formCategory') && ctx.byId('formCategory').value) || '').trim(), name:String((ctx.byId('formServiceName') && ctx.byId('formServiceName').value) || '').trim(), price:normalizePriceValue(ctx.byId('formServicePrice') && ctx.byId('formServicePrice').value) };
    return Object.assign(base, getCurrentLaborDraft(base));
  }
  function currentItemSignature(){ const kind = ctx.currentConfig().formKind; const data = kind === 'material' ? getCurrentMaterialDraft() : (kind === 'accessory' ? getCurrentAccessoryDraft({ passive:true }) : getCurrentServiceDraft()); return JSON.stringify(data); }
  function isItemDirty(){ return ctx.runtimeState.itemModalOpen && currentItemSignature() !== String(ctx.runtimeState.itemInitialSignature || ''); }

  function updateItemActionState(){
    syncLaborGabarytMode();
    syncLaborRateProfileUi();
    syncLaborRulePreview();
    try{ if(ctx.currentListKind && ctx.currentListKind() === 'accessories' && ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.syncHardwarePricing === 'function') ctx.priceModalHardwareForm.syncHardwarePricing(); }catch(_){ }
    const dirty = isItemDirty();
    const isEdit = !!(ctx.appUiState() && ctx.appUiState().editingId);
    const deleteBtn = ctx.byId('deletePriceItemBtn');
    const exitBtn = ctx.byId('priceItemExitBtn');
    const cancelBtn = ctx.byId('priceItemCancelBtn');
    const saveBtn = ctx.byId('priceItemSaveBtn');
    const footer = ctx.byId('priceItemFooter');
    if(footer) footer.style.display = ctx.runtimeState.itemModalOpen ? 'flex' : 'none';
    if(deleteBtn){
      const item = currentEditedItem();
      const defaultQuoteRate = !!(ctx.currentListKind && ctx.currentListKind() === 'quoteRates' && FC.laborCatalog && typeof FC.laborCatalog.isDefaultLaborDefinitionRow === 'function' && FC.laborCatalog.isDefaultLaborDefinitionRow(item));
      deleteBtn.style.display = (isEdit && !(item && item.nonDeletable === true) && !defaultQuoteRate) ? '' : 'none';
    }
    if(exitBtn) exitBtn.style.display = dirty ? 'none' : '';
    if(cancelBtn) cancelBtn.style.display = dirty ? '' : 'none';
    if(saveBtn){ saveBtn.style.display = dirty ? '' : 'none'; saveBtn.textContent = isEdit ? 'Zapisz' : ctx.currentConfig().addLabel.replace(/^Dodaj\s+/i, 'Dodaj '); }
    try{
      if(ctx.priceModalHardwareReplacements && typeof ctx.priceModalHardwareReplacements.updateActionState === 'function')
        ctx.priceModalHardwareReplacements.updateActionState({ dirty, isEdit, formKind:ctx.currentConfig().formKind, item:currentEditedItem() });
    }catch(_){ }
  }

  function wireItemDirtyEvents(){
    [
      'formSymbol','formName','formPrice','formMaterialPriceUnit','formServiceName','formServicePrice','formHasGrain','formMaterialType','formManufacturer','formCategory',
      'laborIsHourlyRate','laborRateCode','laborRateType','laborTimeBlockHours','laborDefaultMultiplier','laborQuantitySource','laborQuantityMode','laborTierText',
      'laborStartHours','laborStartQty','laborStepEveryQty','laborStepHours','laborVolumePricePerM3','laborVolumeTimeMode','laborVolumeTimePerM3',
      'laborVolumeTimeTierText','laborActive','laborInternalOnly'
    ].concat((ctx.priceModalHardwareForm && Array.isArray(ctx.priceModalHardwareForm.FIELD_IDS)) ? ctx.priceModalHardwareForm.FIELD_IDS : []).forEach((id)=>{
      const el = ctx.byId(id);
      if(!el) return;
      el.oninput = function(event){
        try{ if(ctx.currentListKind && ctx.currentListKind() === 'accessories' && ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.handleHardwareFieldInput === 'function') ctx.priceModalHardwareForm.handleHardwareFieldInput(event); }catch(_){ }
        if(id === 'laborIsHourlyRate' || id === 'laborRateCode' || id === 'formServicePrice') syncLaborRateProfileUi();
        updateItemActionState();
      };
      el.onchange = function(event){
        try{ if(ctx.currentListKind && ctx.currentListKind() === 'accessories' && ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.handleHardwareFieldInput === 'function') ctx.priceModalHardwareForm.handleHardwareFieldInput(event); }catch(_){ }
        if(id === 'laborIsHourlyRate' || id === 'laborRateCode' || id === 'formServicePrice') syncLaborRateProfileUi();
        updateItemActionState();
      };
    });
  }

  function applyMaterialFormState(item){
    const materialType = String(item && item.materialType || 'laminat');
    ctx.setSelectOptions(ctx.byId('formMaterialType'), ctx.buildMaterialTypeOptions(materialType), materialType, materialType);
    ctx.setSelectOptions(ctx.byId('formManufacturer'), ctx.buildManufacturerOptions('materials', materialType, item && item.manufacturer), String(item && item.manufacturer || ''), String(item && item.manufacturer || ''));
    if(ctx.byId('formSymbol')) ctx.byId('formSymbol').value = String(item && item.symbol || '');
    if(ctx.byId('formName')) ctx.byId('formName').value = String(item && item.name || '');
    if(ctx.byId('formPrice')) ctx.byId('formPrice').value = item && item.price != null ? item.price : '';
    const unit = String(item && item.priceUnit || defaultMaterialPriceUnit(materialType));
    if(ctx.byId('formMaterialPriceUnit')) ctx.setSelectOptions(ctx.byId('formMaterialPriceUnit'), ctx.buildMaterialPriceUnitOptions ? ctx.buildMaterialPriceUnitOptions(unit) : [{ value:'sheet', label:'Arkusz' }, { value:'m2', label:'m²' }, { value:'mb', label:'mb' }, { value:'piece', label:'szt.' }], unit, unit);
    if(ctx.byId('formHasGrain')) ctx.byId('formHasGrain').checked = !!(item && item.hasGrain);
  }
  function applyAccessoryFormState(item){
    if(ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.applyAccessoryFormState === 'function') ctx.priceModalHardwareForm.applyAccessoryFormState(item);
  }
  function applyLaborFormState(item){
    const labor = FC.laborCatalog || {};
    const raw = item || defaultServiceDraft('quoteRates');
    const def = labor.normalizeDefinition ? labor.normalizeDefinition(raw) : (raw || {});
    const hourly = def.isHourlyRate === true || isHourlyRateItem(raw);
    setChecked('laborIsHourlyRate', hourly);
    setValue('laborRateCode', hourly ? (def.rateKey || def.rateCode || def.rateType || '') : '');
    refreshLaborRateTypeSelect(def.rateType || def.rateKey || 'workshop');
    setValue('laborUsage', 'universal');
    setValue('laborRateType', def.rateType || def.rateKey || 'workshop');
    setValue('laborTimeBlockHours', Number(def.timeBlockHours) || 0);
    setValue('laborDefaultMultiplier', Number(def.defaultMultiplier) || 1);
    refreshLaborQuantitySourceSelect(def.quantitySource || '');
    setValue('laborQuantitySource', def.quantitySource || '');
    setValue('laborQuantityMode', def.quantityMode || 'none');
    setValue('laborTierText', labor.tiersToText ? labor.tiersToText(def.quantityTiers || []) : '');
    setValue('laborStartHours', Number(def.startHours) || 0);
    setValue('laborStartQty', Number(def.startQty) || 1);
    setValue('laborStepEveryQty', Number(def.stepEveryQty) || 1);
    setValue('laborStepHours', Number(def.stepHours) || 0);
    setValue('laborVolumePricePerM3', Number(def.volumePricePerM3) || 0);
    setValue('laborVolumeTimeMode', def.volumeTimeMode || 'none');
    setValue('laborVolumeTimePerM3', Number(def.volumeTimePerM3) || 0);
    setValue('laborVolumeTimeTierText', labor.volumeTiersToText ? labor.volumeTiersToText(def.volumeTimeTiers || []) : '');
    renderLaborConditions(def.conditions || []);
    setChecked('laborActive', def.active !== false);
    setChecked('laborInternalOnly', def.internalOnly !== false);
    syncLaborGabarytMode();
    syncLaborRateProfileUi();
    syncLaborRulePreview();
    try{ if(ctx.currentListKind && ctx.currentListKind() === 'accessories' && ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.syncHardwarePricing === 'function') ctx.priceModalHardwareForm.syncHardwarePricing(); }catch(_){ }
  }
  function applyServiceFormState(item){
    const kind = ctx.currentListKind();
    const category = String(item && item.category || (kind === 'workshopServices' ? 'Cięcie' : 'Korpusy'));
    ctx.setSelectOptions(ctx.byId('formCategory'), ctx.buildCategoryOptions(kind, category), category, category);
    if(ctx.byId('formServiceName')) ctx.byId('formServiceName').value = String(item && item.name || '');
    if(ctx.byId('formServicePrice')) ctx.byId('formServicePrice').value = item && item.price != null ? item.price : '';
    if(kind === 'quoteRates') applyLaborFormState(item || defaultServiceDraft(kind));
  }

  function renderItemModal(){
    const kind = ctx.currentListKind();
    const cfg = ctx.currentConfig();
    const isEdit = !!(ctx.appUiState() && ctx.appUiState().editingId);
    const item = currentEditedItem();
    if(ctx.byId('editingIndicator')) ctx.byId('editingIndicator').style.display = isEdit ? '' : 'none';
    if(ctx.byId('priceItemModalTitle')) ctx.byId('priceItemModalTitle').textContent = isEdit ? 'Edytuj pozycję' : cfg.addLabel;
    if(ctx.byId('priceItemModalSubtitle')) ctx.byId('priceItemModalSubtitle').textContent = cfg.subtitle;
    if(ctx.byId('priceItemModalIcon')) ctx.byId('priceItemModalIcon').textContent = cfg.icon;
    if(ctx.byId('priceFormTitle')) ctx.byId('priceFormTitle').textContent = isEdit ? 'Edytuj pozycję' : cfg.addLabel;
    if(ctx.byId('materialFormFields')) ctx.byId('materialFormFields').style.display = (cfg.formKind === 'material' || cfg.formKind === 'accessory') ? '' : 'none';
    if(hardwareFields()) hardwareFields().style.display = cfg.formKind === 'accessory' ? '' : 'none';
    if(ctx.byId('serviceFormFields')) ctx.byId('serviceFormFields').style.display = cfg.formKind === 'service' ? '' : 'none';
    const laborWrap = laborFields();
    if(laborWrap) laborWrap.style.display = (cfg.formKind === 'service' && kind === 'quoteRates') ? '' : 'none';
    const hourlyToggleWrap = ctx.byId('laborHourlyToggleWrap');
    if(hourlyToggleWrap) hourlyToggleWrap.style.display = (cfg.formKind === 'service' && kind === 'quoteRates') ? '' : 'none';
    const materialTypeWrap = filterMaterialWrapper();
    const manufacturerWrap = filterManufacturerWrapper();
    const grainRow = formHasGrainRow();
    const priceWrap = formPriceWrapper();
    const priceUnitWrap = formMaterialPriceUnitWrapper();
    const seriesWrap = hardwareSeriesTopWrap();
    if(materialTypeWrap) materialTypeWrap.style.display = cfg.formKind === 'material' ? '' : 'none';
    if(manufacturerWrap) manufacturerWrap.style.display = (cfg.formKind === 'material' || cfg.formKind === 'accessory') ? '' : 'none';
    if(grainRow) grainRow.style.display = cfg.formKind === 'material' ? 'flex' : 'none';
    if(priceWrap) priceWrap.style.display = cfg.formKind === 'accessory' ? 'none' : '';
    if(priceUnitWrap) priceUnitWrap.style.display = cfg.formKind === 'material' ? '' : 'none';
    if(seriesWrap) seriesWrap.style.display = cfg.formKind === 'accessory' ? '' : 'none';
    setFormNameLabel(cfg.formKind === 'accessory' ? 'Nazwa katalogowa' : 'Nazwa');
    toggleHardwareTechnicalNamePreview(cfg.formKind === 'accessory');
    if(cfg.formKind === 'material') applyMaterialFormState(item || defaultMaterialDraft());
    else if(cfg.formKind === 'accessory') applyAccessoryFormState(item || (ctx.priceModalHardwareForm && ctx.priceModalHardwareForm.defaultAccessoryDraft ? ctx.priceModalHardwareForm.defaultAccessoryDraft() : {}));
    else applyServiceFormState(item || defaultServiceDraft(kind));
    if(cfg.formKind === 'service'){
      const categoryWrap = formCategoryWrapper();
      const nameWrap = formServiceNameWrapper();
      if(categoryWrap) categoryWrap.style.display = '';
      if(nameWrap) nameWrap.style.display = '';
    }
    if(ctx.mountFormChoiceLaunchers) ctx.mountFormChoiceLaunchers(()=> updateItemActionState());
    if(kind === 'quoteRates') { hideLaborUsageField(); refreshLaborRateTypeSelect(readString('laborRateType') || 'workshop'); refreshLaborQuantitySourceSelect(readString('laborQuantitySource') || ''); mountLaborChoiceLaunchers(); syncLaborRateProfileUi(); }
    if(ctx.decorateFieldHelpLabels) ctx.decorateFieldHelpLabels();
    try{ if(ctx.priceModalHardwareReplacements && typeof ctx.priceModalHardwareReplacements.setSourceItem === 'function') ctx.priceModalHardwareReplacements.setSourceItem(item || null); }catch(_){ }
    wireItemDirtyEvents();
    ctx.runtimeState.itemInitialSignature = currentItemSignature();
    updateItemActionState();
  }

  function openPriceItemModal(id){
    const modal = ctx.byId('priceItemModal');
    if(!modal) return;
    const wasOpen = modal.style.display === 'flex';
    ctx.appUiState().editingId = id || null;
    ctx.persistUi();
    ctx.runtimeState.itemModalOpen = true;
    modal.style.display = 'flex';
    ctx.setModalShellOpen(modal, wasOpen);
    renderItemModal();
  }
  function doClosePriceItemModal(){
    ctx.runtimeState.itemModalOpen = false;
    ctx.runtimeState.itemInitialSignature = '';
    ctx.appUiState().editingId = null;
    ctx.persistUi();
    const modal = ctx.byId('priceItemModal');
    if(modal) modal.style.display = 'none';
    return true;
  }
  async function requestClosePriceItemModal(){
    if(!ctx.runtimeState.itemModalOpen) return true;
    if(isItemDirty()){
      const ok = await ctx.confirmDiscard();
      if(!ok) return false;
    }
    doClosePriceItemModal();
    return true;
  }

  Object.assign(ctx, { currentEditedItem, getCurrentMaterialDraft, getCurrentAccessoryDraft, getCurrentServiceDraft, isItemDirty, updateItemActionState, renderItemModal, openPriceItemModal, doClosePriceItemModal, requestClosePriceItemModal });
})();
