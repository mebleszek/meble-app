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
  function formServicePriceWrapper(){ return ctx.byId('formServicePrice') && ctx.byId('formServicePrice').parentElement; }
  function formPriceWrapper(){ return ctx.byId('formPrice') && ctx.byId('formPrice').parentElement; }
  function formMaterialPriceUnitWrapper(){ return ctx.byId('formMaterialPriceUnitLaunch') && ctx.byId('formMaterialPriceUnitLaunch').parentElement; }
  function formHasGrainRow(){ return ctx.byId('formHasGrain') && ctx.byId('formHasGrain').parentElement; }
  function hardwareSeriesTopWrap(){ return ctx.byId('hardwareSeriesTopWrap'); }
  function laborFields(){ return ctx.byId('laborFormFields'); }
  function hardwareFields(){ return ctx.byId('hardwareFormFields'); }
  function controlWrapper(id){ const el = ctx.byId(id); return el && el.parentElement ? el.parentElement : null; }
  function setWrapperVisible(id, show){ const wrap = controlWrapper(id); if(wrap) wrap.style.display = show ? '' : 'none'; }
  function setBlockVisible(id, show){ const el = ctx.byId(id); if(el) el.style.display = show ? '' : 'none'; }

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
    { id:'laborUnitPriceSource', title:'Cena kilometra', placeholder:'Źródło ceny kilometra' },
    { id:'laborPricingMode', title:'Wybierz sposób naliczania ceny', placeholder:'Sposób naliczania ceny' },
    { id:'laborRateType', title:'Wybierz stawkę godzinową', placeholder:'Stawka godzinowa' },
    { id:'laborTimeBlockHours', title:'Wybierz czas bazowy', placeholder:'Czas bazowy' },
    { id:'laborQuantitySource', title:'Wybierz źródło ilości', placeholder:'Źródło ilości' },
    { id:'laborQuantityMode', title:'Wybierz sposób liczenia ilości', placeholder:'Sposób liczenia ilości' },
    { id:'laborStartHours', title:'Wybierz czas startowy', placeholder:'Czas startowy' },
    { id:'laborStepHours', title:'Wybierz czas kolejnego kroku', placeholder:'Czas za krok' },
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
        onChange:()=>{ if(field.id === 'laborRateType') syncLaborRateProfileUi(); if(field.id === 'laborPricingMode') syncLaborPricingModeUi(); if(field.id==='laborUnitPriceSource')syncRulePrice(); updateItemActionState(); },
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
      pricingMode:isQuoteRates ? 'time' : 'fixed',
      quantityMode:'none',
      quantityTiers:[],
      startPrice:0,
      includedQty:0,
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
  function setDurationValue(id, value){
    const el = ctx.byId(id);
    if(!el) return;
    Array.from(el.options || []).filter((opt)=> opt.getAttribute('data-saved-duration') === 'true').forEach((opt)=> opt.remove());
    const hours = Number(value) || 0;
    const customBreak=id==='laborTimeBlockHours'&&currentEditedItem()?.id==='labor_daily_break'&&!Array.from(el.options||[]).some(opt=>Number(opt.value)===hours);
    if(hours === 0.75 || customBreak){
      const opt = document.createElement('option');
      opt.value = String(hours);
      opt.textContent = 'Zapisany czas: '+(hours*60)+' min';
      opt.disabled = !customBreak;
      opt.setAttribute('data-saved-duration', 'true');
      el.appendChild(opt);
    }
    setValue(id, hours);
  }
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
  function isHourlyRateMode(){ return false; }
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
  function pricingModeLabel(code){
    const key = String(code || readString('laborPricingMode') || 'fixed').trim();
    try{
      const labor = FC.laborCatalog || {};
      if(labor.getPricingModeLabel) return labor.getPricingModeLabel(key);
    }catch(_){ }
    return key || 'Kwota stała';
  }
  function formatLaborTime(value){
    try{
      const labor = FC.laborCatalog || {};
      if(labor.formatHoursAsMinutes) return labor.formatHoursAsMinutes(value);
    }catch(_){ }
    const n = Math.max(0, Number(String(value == null ? '' : value).replace(',', '.')) || 0);
    if(!(n > 0)) return 'Brak';
    return Math.round(n * 60) + ' min';
  }
  function isTimePricingMode(mode){ return ['time','timeTiers','timeStartStep','advanced'].includes(String(mode || readString('laborPricingMode') || '')); }
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
    const hourly = false;
    preview.style.display = hourly ? 'none' : '';
    if(hourly) return;
    preview.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'price-labor-rule-preview__title';
    title.textContent = 'Podgląd działania reguły';
    const rows = document.createElement('div');
    rows.className = 'price-labor-rule-preview__rows';
    const mode = readString('laborPricingMode') || 'fixed';
    const automation=syncLaborAutomationModeUi();
    addPreviewRow(rows, 'Dodawanie', automation==='factory'?'AUTOMAT FABRYCZNY':automation==='automatic'?'AUTOMAT':'RĘCZNA');
    addPreviewRow(rows, 'Sposób naliczania', pricingModeLabel(mode));
    if(automation!=='manual') addPreviewRow(rows, 'Źródło automatu', laborSourceLabel(readString('laborQuantitySource')));
    if(mode === 'startPlusUnit') addPreviewRow(rows, 'Start', `${Number(readNumber('laborStartPrice')) || 0} PLN · w cenie ${Number(readNumber('laborIncludedQty')) || 0} jedn.`);
    if(isTimePricingMode(mode)){
      addPreviewRow(rows, 'Tryb czasu', mode === 'advanced' ? quantityModeLabel(readString('laborQuantityMode')) : pricingModeLabel(mode));
      addPreviewRow(rows, 'Czas', `${formatLaborTime(readNumber('laborTimeBlockHours'))} bazowo · mnożnik x${readNumber('laborDefaultMultiplier') === '' ? 1 : Math.max(0,Number(readNumber('laborDefaultMultiplier')) || 0)}`);
      addPreviewRow(rows, 'Stawka', laborRateLabel(readString('laborRateType')));
    }
    addPreviewRow(rows, 'Warunki', conditionsHumanText());
    addPreviewRow(rows, 'Zapis', 'WYCENA czyta te wartości z aktualnej szafki przez workQuantityFacts; nie tworzy drugiej kopii danych szafki.');
    preview.appendChild(title);
    preview.appendChild(rows);
  }

  function refreshLaborPricingModeSelect(selectedCode){
    const code = selectedCode || readString('laborPricingMode') || 'fixed';
    const labor = FC.laborCatalog || {};
    const defs = Array.isArray(labor.PRICING_MODES) ? labor.PRICING_MODES : [
      { key:'fixed', label:'Kwota stała' },
      { key:'perUnit', label:'Cena za ilość' },
      { key:'startPlusUnit', label:'Kwota startowa + cena za ilość' },
      { key:'time', label:'Czas × stawka godzinowa' },
      { key:'timeTiers', label:'Progi czasu' },
      { key:'timeStartStep', label:'Czas startowy + kolejne sztuki' },
      { key:'advanced', label:'Zaawansowane' },
    ];
    ctx.setSelectOptions(ctx.byId('laborPricingMode'), defs.map((row)=> ({ value:row.key, label:row.label })), code, code);
    setValue('laborPricingMode', code);
  }
  function syncLaborAutomationModeUi(){
    const select=ctx.byId('laborAutomationMode');
    if(!select || ctx.currentListKind?.()!=='quoteRates')return 'manual';
    const factory=FC.laborCatalog?.isFactoryAutomaticDefinition(currentEditedItem())===true;
    if(factory){select.value='factory';select.disabled=true;}
    else{select.disabled=false;if(select.value==='factory')select.value='manual';}
    const kind=factory?'factory':(select.value==='automatic'?'automatic':'manual');
    const hint=ctx.byId('laborAutomationModeHint');
    if(hint)hint.textContent=kind==='factory'
      ? 'AUTOMAT FABRYCZNY: można edytować cenę, czas, formułę i pozostałe parametry, ale nie sposób uruchamiania.'
      : kind==='automatic'
        ? 'Automat wymaga aktywnego, policzalnego źródła ilości. Nie jest dodawany ręcznie.'
        : 'Czynność jest dodatkiem ręcznym. Zakres naliczania wybierasz osobno.';
    return kind;
  }
  function syncLaborPricingModeUi(){
    const daily=ctx.byId('laborDailyStagesWrap');if(daily)daily.style.display=readString('laborBillingScope')==='day'?'':'none';
    if(ctx.currentListKind && ctx.currentListKind() !== 'quoteRates') return;
    const mode = readString('laborPricingMode') || 'fixed';
    const autoMode=syncLaborAutomationModeUi()!=='manual';
    const isFixed = mode === 'fixed';
    const isPerUnit = mode === 'perUnit';
    const isStartPlusUnit = mode === 'startPlusUnit';
    const isTime = mode === 'time';
    const isTiers = mode === 'timeTiers';
    const isStartStep = mode === 'timeStartStep';
    const isAdvanced = mode === 'advanced';
    const timeMode = isTime || isTiers || isStartStep || isAdvanced;
    const priceWrap = formServicePriceWrapper();
    if(priceWrap) priceWrap.style.display = (isFixed || isPerUnit || isStartPlusUnit || isAdvanced) ? '' : 'none';
    if(isFixed) setServicePriceLabel('Kwota stała (PLN)');
    else if(isPerUnit) setServicePriceLabel('Cena za jednostkę (PLN)');
    else if(isStartPlusUnit) setServicePriceLabel('Cena za jednostkę po starcie (PLN)');
    else if(isAdvanced) setServicePriceLabel('Kwota stała / dopłata (PLN)');
    setBlockVisible('laborPricingModeWrap', true);
    setWrapperVisible('laborRateType', timeMode);
    setWrapperVisible('laborTimeBlockHours', isTime || isAdvanced);
    setWrapperVisible('laborDefaultMultiplier', timeMode);
    setWrapperVisible('laborQuantitySource', autoMode);
    setWrapperVisible('laborQuantityMode', isAdvanced);
    setWrapperVisible('laborStartPrice', isStartPlusUnit);
    setWrapperVisible('laborIncludedQty', isStartPlusUnit);
    setWrapperVisible('laborTierText', isTiers || isAdvanced);
    setWrapperVisible('laborStartHours', isStartStep || isAdvanced);
    setWrapperVisible('laborStartQty', isStartStep || isAdvanced);
    setWrapperVisible('laborStepEveryQty', isStartStep || isAdvanced);
    setWrapperVisible('laborStepHours', isStartStep || isAdvanced);
    setWrapperVisible('laborVolumePricePerM3', isAdvanced);
    setWrapperVisible('laborVolumeTimeMode', isAdvanced);
    setWrapperVisible('laborVolumeTimePerM3', isAdvanced);
    setWrapperVisible('laborVolumeTimeTierText', isAdvanced);
    setBlockVisible('laborConditionsWrap', isPerUnit || isStartPlusUnit || timeMode || autoMode);
    if(!isAdvanced){
      if(isTiers) setValue('laborQuantityMode', 'tiers');
      else if(isStartStep) setValue('laborQuantityMode', 'startStep');
      else if(isPerUnit || isStartPlusUnit || isTime) setValue('laborQuantityMode', 'linear');
      else setValue('laborQuantityMode', 'none');
      setValue('laborVolumeTimeMode', 'none');
      setValue('laborVolumePricePerM3', 0);
      setValue('laborVolumeTimePerM3', 0);
      setValue('laborVolumeTimeTierText', '');
    }
    syncLaborGabarytMode();
  }
  function refreshLaborRateTypeSelect(selectedCode){
    const code = selectedCode || readString('laborRateType') || 'workshop';
    ctx.setSelectOptions(ctx.byId('laborRateType'), buildLaborRateProfileOptions(code), code, code);
    setValue('laborRateType', code);
  }
  function syncLaborRateProfileUi(){
    if(ctx.currentListKind && ctx.currentListKind() !== 'quoteRates') return;
    const hourly = false;
    const toggleEl = ctx.byId('laborIsHourlyRate');
    if(toggleEl) toggleEl.checked = false;
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
    if(toggleWrap) toggleWrap.style.display = 'none';
    if(rule) rule.style.display = hourly ? 'none' : '';
    if(rateFields) rateFields.style.display = hourly ? '' : 'none';
    if(conditionWrap) conditionWrap.style.display = hourly ? 'none' : '';
    const rulePreview = ctx.byId('laborRulePreview');
    if(rulePreview) rulePreview.style.display = hourly ? 'none' : '';
    if(title) title.textContent = hourly ? 'Stawka godzinowa' : 'Reguła robocizny';
    if(internalWrap) internalWrap.style.display = hourly ? 'none' : '';
    if(categoryWrap) categoryWrap.style.display = hourly ? 'none' : '';
    syncLaborPricingModeUi();
    setFormNameLabel('Nazwa przyjazna / nazwa pozycji');
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
      priceEl.title = 'Wyłączone, bo gabaryt jest liczony jako czas. Żeby użyć dopłaty zł za gabaryt, ustaw Gabarytoczas na Wyłączony.';
    }else{
      priceEl.disabled = false;
      priceEl.removeAttribute('aria-disabled');
      priceEl.removeAttribute('title');
    }
  }

  const ruleFieldIds={minimumLevels:'laborMinimumLevels',liftLevels:'laborLiftLevels',disassemblyWeightKg:'laborDisassemblyWeightKg',breakAfterHours:'laborBreakAfterHours',workdayHours:'laborWorkdayHours'};
  function getRuleParametersDraft(){
    const id=String(ctx.appUiState().editingId||'');
    const defaults=FC.laborCatalog?.ruleParameters?.({id})||{};
    const result=Object.fromEntries(Object.keys(defaults).map(key=>[key,Math.max(0,Number(readNumber(ruleFieldIds[key]))||0)]));
    if(id==='transport_distance_km')result.unitPriceSource=readString('laborUnitPriceSource')==='fuel'?'fuel':'manual';
    return result;
  }
  function syncRulePrice(){
    const fuel=String(ctx.appUiState().editingId||'')==='transport_distance_km'&&readString('laborUnitPriceSource')==='fuel';
    const input=ctx.byId('formServicePrice');if(input){input.readOnly=fuel;if(fuel)input.value=String(FC.laborCatalog.effectiveUnitPrice({unitPriceSource:'fuel'}));}
    const preview=ctx.byId('laborFuelPricePreview');if(preview)preview.textContent=fuel?'Aktualnie '+FC.laborCatalog.effectiveUnitPrice({unitPriceSource:'fuel'}).toFixed(2)+' zł/km. Źródło: Ustawienia → Transport i trasy (spalanie, cena paliwa, mnożnik).':'Cena ręczna — także 0 zł — pochodzi z pola ceny tej reguły.';
  }
  function syncEdgeWaste(){
    setBlockVisible('formEdgeWasteWrap',ctx.currentConfig().formKind==='material'&&String(ctx.byId('formMaterialPriceUnit')?.value)==='mb');
  }
  function syncMaterialPricing(){
    const material=ctx.currentConfig().formKind==='material';
    setBlockVisible('formMaterialPricingWrap',material);
    if(!material)return;
    const sheet=['laminat','hdf'].includes(readString('formMaterialType').toLowerCase());
    setBlockVisible('formMaterialSheetWrap',sheet);
    const markup=readString('formMaterialPricingMode')==='markup',price=ctx.byId('formPrice');
    const purchase=Math.max(0,Number(readNumber('formMaterialPurchasePrice'))||0),percent=Math.max(0,Number(readNumber('formMaterialMarkup'))||0);
    setWrapperVisible('formMaterialMarkup',markup);
    setWrapperVisible('formPrice',!markup);
    if(price)price.readOnly=markup;
    const preview=ctx.byId('formMaterialPricePreview'),value=markup?Math.round(purchase*(1+percent/100)*100)/100:Math.max(0,Number(price?.value)||0);
    if(preview)preview.textContent=value.toFixed(2)+' PLN'+(readString('formMaterialPurchasePrice')===''?' • cena zakupu niepodana':' • różnica '+(value-purchase).toFixed(2)+' PLN');
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
      ...(readString('formMaterialPurchasePrice')===''?{}:{purchasePrice:Math.max(0,Number(readNumber('formMaterialPurchasePrice'))||0)}),pricingMode:readString('formMaterialPricingMode')==='markup'?'markup':'manual',markupPercent:Math.max(0,Number(readNumber('formMaterialMarkup'))||0),
      ...(['laminat','hdf'].includes(materialType.toLowerCase())?{billingIncrement:readString('formMaterialBillingIncrement')||(materialType==='hdf'?'m2':'sheet'),sheetWidthMm:Number(readNumber('formMaterialSheetWidth')),sheetHeightMm:Number(readNumber('formMaterialSheetHeight')),thicknessMm:Number(readNumber('formMaterialThickness'))}:{}),
      ...(priceUnit==='mb'?{edgeWastePercent:Math.max(0,Number(readNumber('formEdgeWastePercent'))||0)}:{}),
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
    const pricingMode = readString('laborPricingMode') || 'fixed';
    const automationMode=FC.laborCatalog?.isFactoryAutomaticDefinition(currentEditedItem())===true || readString('laborAutomationMode')==='factory' ? 'automatic' : (readString('laborAutomationMode')==='automatic'?'automatic':'manual');
    const volumeTimeMode = pricingMode === 'advanced' ? (readString('laborVolumeTimeMode') || 'none') : 'none';
    const rateType = labor.normalizeRateCode ? labor.normalizeRateCode(readString('laborRateType')) : (readString('laborRateType') || 'workshop');
    const usesQuantity = ['perUnit','startPlusUnit','time','timeTiers','timeStartStep','advanced'].includes(pricingMode);
    const quantityMode = pricingMode === 'timeTiers' ? 'tiers' : (pricingMode === 'timeStartStep' ? 'startStep' : (pricingMode === 'advanced' ? (readString('laborQuantityMode') || 'none') : (['perUnit','startPlusUnit','time'].includes(pricingMode) ? 'linear' : 'none')));
    return {
      usage:'universal',
      ...getRuleParametersDraft(),
      billingScope:readString('laborBillingScope') || 'standard', dailyStages:readString('laborDailyStages') || 'both',
      automationMode, pricingMode,
      rateType:rateType || 'workshop',
      rateKey:'',
      rateCode:'',
      timeBlockHours:Number(readNumber('laborTimeBlockHours')) || 0,
      defaultMultiplier:readNumber('laborDefaultMultiplier')===''?1:Math.max(0,Number(readNumber('laborDefaultMultiplier'))||0),
      quantityMode,
      quantitySource:automationMode==='automatic' ? readString('laborQuantitySource') : '',
      startPrice:pricingMode === 'startPlusUnit' ? (Number(readNumber('laborStartPrice')) || 0) : 0,
      includedQty:pricingMode === 'startPlusUnit' ? (Number(readNumber('laborIncludedQty')) || 0) : 0,
      quantityTiers:labor.parseTierText ? labor.parseTierText(tierText) : [],
      startHours:Number(readNumber('laborStartHours')) || 0,
      startQty:readNumber('laborStartQty') === '' ? 1 : Math.max(0, Number(readNumber('laborStartQty')) || 0),
      stepEveryQty:Number(readNumber('laborStepEveryQty')) || 1,
      stepHours:Number(readNumber('laborStepHours')) || 0,
      volumePricePerM3:volumeTimeMode === 'none' ? (Number(readNumber('laborVolumePricePerM3')) || 0) : 0,
      volumeTimeMode,
      volumeTimePerM3:Number(readNumber('laborVolumeTimePerM3')) || 0,
      volumeTimeTiers:labor.parseVolumeTierText ? labor.parseVolumeTierText(volumeTierText) : [],
      conditions:(usesQuantity || automationMode==='automatic') ? getCurrentLaborConditions() : [],
      active:readBool('laborActive'),
      internalOnly:readBool('laborInternalOnly'),
    };
  }
  function getCurrentServiceDraft(){
    const base = { category:String((ctx.byId('formCategory') && ctx.byId('formCategory').value) || '').trim(), name:String((ctx.byId('formServiceName') && ctx.byId('formServiceName').value) || '').trim(), price:normalizePriceValue(ctx.byId('formServicePrice') && ctx.byId('formServicePrice').value) };
    const laborDraft=getCurrentLaborDraft(base);
    if(ctx.currentListKind()==='quoteRates' && ['fixed','advanced'].includes(laborDraft.pricingMode))laborDraft.fixedPrice=Math.max(0,Number(base.price)||0);
    if(laborDraft.unitPriceSource==='fuel')base.price=Number(currentEditedItem()?.price)||0;
    return Object.assign(base, laborDraft);
  }
  function currentItemSignature(){ const kind = ctx.currentConfig().formKind; const data = kind === 'material' ? getCurrentMaterialDraft() : (kind === 'accessory' ? getCurrentAccessoryDraft({ passive:true }) : getCurrentServiceDraft()); return JSON.stringify(data); }
  function isItemDirty(){ return ctx.runtimeState.itemModalOpen && currentItemSignature() !== String(ctx.runtimeState.itemInitialSignature || ''); }

  function updateItemActionState(){
    syncLaborPricingModeUi();
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
      'formMaterialPurchasePrice','formMaterialPricingMode','formMaterialMarkup','formMaterialBillingIncrement','formMaterialSheetWidth','formMaterialSheetHeight','formMaterialThickness','formSymbol','formName','formPrice','formMaterialPriceUnit','formServiceName','formServicePrice','formHasGrain','formMaterialType','formManufacturer','formCategory',
      'laborAutomationMode','laborPricingMode','laborRateType','laborTimeBlockHours','laborDefaultMultiplier','laborQuantitySource','laborQuantityMode','laborTierText',
      'laborStartPrice','laborIncludedQty','laborStartHours','laborStartQty','laborStepEveryQty','laborStepHours','laborVolumePricePerM3','laborVolumeTimeMode','laborVolumeTimePerM3',
      'laborVolumeTimeTierText','laborActive','laborInternalOnly','laborBillingScope','laborDailyStages','formEdgeWastePercent','laborMinimumLevels','laborLiftLevels','laborDisassemblyWeightKg','laborBreakAfterHours','laborWorkdayHours','laborUnitPriceSource'
    ].concat((ctx.priceModalHardwareForm && Array.isArray(ctx.priceModalHardwareForm.FIELD_IDS)) ? ctx.priceModalHardwareForm.FIELD_IDS : []).forEach((id)=>{
      const el = ctx.byId(id);
      if(!el) return;
      el.oninput = function(event){
        try{ if(ctx.currentListKind && ctx.currentListKind() === 'accessories' && ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.handleHardwareFieldInput === 'function') ctx.priceModalHardwareForm.handleHardwareFieldInput(event); }catch(_){ }
        if(id === 'laborRateCode' || id === 'formServicePrice') syncLaborRateProfileUi();
        if(id==='laborBillingScope') syncLaborPricingModeUi();
        if(id==='laborUnitPriceSource')syncRulePrice();
        if(id==='formMaterialPriceUnit')syncEdgeWaste();
        if(ctx.currentConfig().formKind==='material')syncMaterialPricing();
        updateItemActionState();
      };
      el.onchange = function(event){
        try{ if(ctx.currentListKind && ctx.currentListKind() === 'accessories' && ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.handleHardwareFieldInput === 'function') ctx.priceModalHardwareForm.handleHardwareFieldInput(event); }catch(_){ }
        if(id === 'laborRateCode' || id === 'formServicePrice') syncLaborRateProfileUi();
        if(id==='laborBillingScope') syncLaborPricingModeUi();
        if(id==='laborUnitPriceSource')syncRulePrice();
        if(id==='formMaterialPriceUnit')syncEdgeWaste();
        if(ctx.currentConfig().formKind==='material')syncMaterialPricing();
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
    setValue('formEdgeWastePercent',item?.edgeWastePercent??10);syncEdgeWaste();
    if(ctx.byId('formHasGrain')) ctx.byId('formHasGrain').checked = !!(item && item.hasGrain);
    setValue('formMaterialPurchasePrice',item?.purchasePrice??'');setValue('formMaterialPricingMode',item?.pricingMode==='markup'?'markup':'manual');setValue('formMaterialMarkup',item?.markupPercent??0);
    setValue('formMaterialBillingIncrement',item?.billingIncrement||(materialType==='hdf'?'m2':'sheet'));
    const format=FC.rozrysStock?.getLargestSheetFormatForMaterial(item?.name||'',2800,2070)||{width:2800,height:2070};
    setValue('formMaterialSheetWidth',item?.sheetWidthMm??format.width);setValue('formMaterialSheetHeight',item?.sheetHeightMm??format.height);setValue('formMaterialThickness',item?.thicknessMm??(materialType==='hdf'?3:18));syncMaterialPricing();
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
    setValue('laborAutomationMode',labor.automationMode?.(raw)||'manual');
    syncLaborAutomationModeUi();
    refreshLaborPricingModeSelect(def.pricingMode || 'fixed');
    setValue('laborPricingMode', def.pricingMode || 'fixed');
    refreshLaborRateTypeSelect(def.rateType || def.rateKey || 'workshop');
    setValue('laborBillingScope', def.billingScope || 'standard');
    setValue('laborDailyStages', def.dailyStages || 'both');
    const params=labor.ruleParameters(def);
    for(const [key,id] of Object.entries(ruleFieldIds)){setWrapperVisible(id,Object.hasOwn(params,key));setValue(id,params[key]??'');}
    setWrapperVisible('laborUnitPriceSource',def.id==='transport_distance_km');setValue('laborUnitPriceSource',def.unitPriceSource||'manual');
    syncRulePrice();
    setValue('laborUsage', 'universal');
    setValue('laborRateType', def.rateType || def.rateKey || 'workshop');
    setDurationValue('laborTimeBlockHours', def.timeBlockHours);
    setValue('laborDefaultMultiplier', def.defaultMultiplier == null ? 1 : def.defaultMultiplier);
    refreshLaborQuantitySourceSelect(def.quantitySource || '');
    setValue('laborQuantitySource', def.quantitySource || '');
    setValue('laborQuantityMode', def.quantityMode || 'none');
    setValue('laborTierText', labor.tiersToText ? labor.tiersToText(def.quantityTiers || []) : '');
    setValue('laborStartPrice', Number(def.startPrice) || 0);
    setValue('laborIncludedQty', Number(def.includedQty) || 0);
    setDurationValue('laborStartHours', def.startHours);
    setValue('laborStartQty', def.startQty == null ? 1 : def.startQty);
    setValue('laborStepEveryQty', Number(def.stepEveryQty) || 1);
    setDurationValue('laborStepHours', def.stepHours);
    setValue('laborVolumePricePerM3', Number(def.volumePricePerM3) || 0);
    setValue('laborVolumeTimeMode', def.volumeTimeMode || 'none');
    setValue('laborVolumeTimePerM3', Number(def.volumeTimePerM3) || 0);
    setValue('laborVolumeTimeTierText', labor.volumeTiersToText ? labor.volumeTiersToText(def.volumeTimeTiers || []) : '');
    renderLaborConditions(def.conditions || []);
    setChecked('laborActive', def.active !== false);
    setChecked('laborInternalOnly', def.internalOnly !== false);
    syncLaborPricingModeUi();
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
    const fixedMode=['fixed','advanced'].includes(item?.pricingMode||'fixed') && !isHourlyRateItem(item);
    const shownPrice=kind==='quoteRates' && fixedMode && item?.fixedPrice!=null ? item.fixedPrice : (item?.price??'');
    if(ctx.byId('formServicePrice')) ctx.byId('formServicePrice').value=shownPrice;
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
    if(hourlyToggleWrap) hourlyToggleWrap.style.display = 'none';
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
    setBlockVisible('formMaterialPricingWrap',cfg.formKind==='material');
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
    if(kind === 'quoteRates') { setChecked('laborIsHourlyRate', false); hideLaborUsageField(); refreshLaborPricingModeSelect(readString('laborPricingMode') || 'fixed'); refreshLaborRateTypeSelect(readString('laborRateType') || 'workshop'); refreshLaborQuantitySourceSelect(readString('laborQuantitySource') || ''); mountLaborChoiceLaunchers(); syncLaborPricingModeUi(); syncLaborRateProfileUi(); }
    if(ctx.decorateFieldHelpLabels) ctx.decorateFieldHelpLabels();
    try{ if(ctx.priceModalHardwareReplacements && typeof ctx.priceModalHardwareReplacements.setSourceItem === 'function') ctx.priceModalHardwareReplacements.setSourceItem(item || null); }catch(_){ }
    syncEdgeWaste();
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
  function doClosePriceItemModal(options){
    ctx.runtimeState.itemModalOpen = false;
    ctx.runtimeState.itemInitialSignature = '';
    ctx.appUiState().editingId = null;
    if(options?.persist!==false)ctx.persistUi();
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
