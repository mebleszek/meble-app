(function(){
  const ns = (window.FC = window.FC || {});

function getCabinetModalValidationApi(){ return (window.FC && window.FC.cabinetModalValidation) || {}; }
function getCabinetModalDraftApi(){ return (window.FC && window.FC.cabinetModalDraft) || {}; }
function getCabinetModalFieldsApi(){ return (window.FC && window.FC.cabinetModalFields) || {}; }
function getCabinetModalSetWizardApi(){ return (window.FC && window.FC.cabinetModalSetWizard) || {}; }
function getCabinetModalStandingApi(){ return (window.FC && window.FC.cabinetModalStanding) || {}; }
function getCabinetModalHangingApi(){ return (window.FC && window.FC.cabinetModalHanging) || {}; }
function getCabinetModalModuleApi(){ return (window.FC && window.FC.cabinetModalModule) || {}; }
function getCabinetModalTypeApi(typeVal){
  if(typeVal === 'stojąca') return getCabinetModalStandingApi();
  if(typeVal === 'wisząca') return getCabinetModalHangingApi();
  if(typeVal === 'moduł') return getCabinetModalModuleApi();
  return {};
}

function callCabinetFrontsHelper(fnName, args, fallback){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.callCabinetFrontsHelper === 'function') return api.callCabinetFrontsHelper(fnName, args, fallback);
  if(typeof fallback === 'function') return fallback.apply(null, args || []);
  throw new Error('Brak helpera cabinetFronts: ' + fnName);
}

function callCalcHelper(fnName, args, fallback){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.callCalcHelper === 'function') return api.callCalcHelper(fnName, args, fallback);
  if(typeof fallback === 'function') return fallback.apply(null, args || []);
  throw new Error('Brak helpera calc: ' + fnName);
}

function calcTopForSetSafe(room, blende, sumLowerHeights){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.calcTopForSetSafe === 'function') return api.calcTopForSetSafe(room, blende, sumLowerHeights);
  return 0;
}

function getSubTypeOptionsForTypeSafe(typeVal){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.getSubTypeOptionsForTypeSafe === 'function') return api.getSubTypeOptionsForTypeSafe(typeVal);
  return [{ v:'standardowa', t:'Standardowa' }];
}
function applyTypeRulesSafe(room, updated, typeVal){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.applyTypeRulesSafe === 'function') return api.applyTypeRulesSafe(room, updated, typeVal);
  updated.type = typeVal;
  return updated;
}
function applySubTypeRulesSafe(room, updated, subTypeVal){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.applySubTypeRulesSafe === 'function') return api.applySubTypeRulesSafe(room, updated, subTypeVal);
  updated.subType = subTypeVal;
  return updated;
}
function ensureFrontCountRulesSafe(cab){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.ensureFrontCountRulesSafe === 'function') return api.ensureFrontCountRulesSafe(cab);
  return cab;
}
function cabinetAllowsFrontCountSafe(cab){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.cabinetAllowsFrontCountSafe === 'function') return api.cabinetAllowsFrontCountSafe(cab);
  return true;
}
function getFlapFrontCountSafe(cab){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.getFlapFrontCountSafe === 'function') return api.getFlapFrontCountSafe(cab);
  return Number(cab && cab.frontCount) || 0;
}
function syncDraftFromCabinetModalFormSafe(draft){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.syncDraftFromCabinetModalFormSafe === 'function') return api.syncDraftFromCabinetModalFormSafe(draft);
  return draft;
}
function validateAventosForDraftSafe(room, draft){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.validateAventosForDraftSafe === 'function') return api.validateAventosForDraftSafe(room, draft);
  return null;
}
function applyAventosValidationUISafe(room, draft){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.applyAventosValidationUISafe === 'function') return api.applyAventosValidationUISafe(room, draft);
  return null;
}
function addFrontSafe(room, front){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.addFrontSafe === 'function') return api.addFrontSafe(room, front);
  projectData[room].fronts = projectData[room].fronts || [];
  projectData[room].fronts.push(front);
  return front;
}
function removeFrontsForSetSafe(room, setId){
  const api = getCabinetModalValidationApi();
  if(api && typeof api.removeFrontsForSetSafe === 'function') return api.removeFrontsForSetSafe(room, setId);
  projectData[room].fronts = (projectData[room].fronts || []).filter(function(front){ return String(front && front.setId) !== String(setId); });
}

function makeDefaultCabinetDraftForRoom(room){
  const api = getCabinetModalDraftApi();
  if(api && typeof api.makeDefaultCabinetDraftForRoom === 'function') return api.makeDefaultCabinetDraftForRoom(room);
  return null;
}

function openCabinetModalForAdd(){
  const draftApi = getCabinetModalDraftApi();
  if(draftApi && typeof draftApi.beginAddState === 'function') draftApi.beginAddState(uiState.roomType);
  else {
    cabinetModalState.mode = 'add';
    cabinetModalState.editingId = null;
    cabinetModalState.setEditId = null;
    cabinetModalState.chosen = null;
    cabinetModalState.setPreset = null;
    cabinetModalState.draft = makeDefaultCabinetDraftForRoom(uiState.roomType);
    try{ cabinetModalState.chosen = cabinetModalState.draft && cabinetModalState.draft.type ? cabinetModalState.draft.type : null; }catch(_){ }
  }
  renderCabinetModal();
  const m = document.getElementById('cabinetModal');
  if(m){
    m.style.display = 'flex';
    try{
      m.classList.add('modal-open-guard');
      requestAnimationFrame(() => setTimeout(() => {
        try{ m.classList.remove('modal-open-guard'); }catch(_){ }
      }, 260));
    }catch(_){ }
  }
  lockModalScroll();
}

function lockModalScroll(){
  document.documentElement.classList.add('modal-lock');
  document.body.classList.add('modal-lock');
}
function unlockModalScroll(){
  document.documentElement.classList.remove('modal-lock');
  document.body.classList.remove('modal-lock');
}

function openCabinetModalForEdit(cabId){
  cabId = String(cabId);
  try{
    const listScrollMemory = window.FC && window.FC.listScrollMemory;
    if(listScrollMemory && typeof listScrollMemory.rememberForCabinet === 'function') listScrollMemory.rememberForCabinet(uiState && uiState.activeTab, cabId);
  }catch(_){ }
  const room = uiState.roomType; if(!room) return;
  const cab = projectData[room].cabinets.find(c => String(c.id) === cabId);
  if(!cab) return;

  if(cab.setId){
    openSetWizardForEdit(cab.setId);
    return;
  }

  const draftApi = getCabinetModalDraftApi();
  if(draftApi && typeof draftApi.beginEditState === 'function') draftApi.beginEditState(cabId, cab);
  else {
    cabinetModalState.mode = 'edit';
    cabinetModalState.editingId = cabId;
    cabinetModalState.setEditId = null;
    cabinetModalState.chosen = cab.type;
    cabinetModalState.setPreset = null;
    cabinetModalState.draft = FC.utils.clone(cab);
  }
  renderCabinetModal();
  const m = document.getElementById('cabinetModal');
  if(m){
    m.style.display = 'flex';
    try{
      m.classList.add('modal-open-guard');
      requestAnimationFrame(() => setTimeout(() => {
        try{ m.classList.remove('modal-open-guard'); }catch(_){ }
      }, 260));
    }catch(_){ }
  }
  lockModalScroll();
}

function openSetWizardForEdit(setId){
  const api = getCabinetModalSetWizardApi();
  if(api && typeof api.openSetWizardForEdit === 'function') return api.openSetWizardForEdit(setId);
  return null;
}

function closeCabinetModal(){
  unlockModalScroll();
  document.getElementById('cabinetModal').style.display = 'none';
  try{
    const listScrollMemory = window.FC && window.FC.listScrollMemory;
    if(listScrollMemory && typeof listScrollMemory.restorePending === 'function') listScrollMemory.restorePending();
  }catch(_){ }
}

/* ===== Cabinet Modal rendering ===== */
function renderCabinetTypeChoices(){
  const wrap = document.getElementById('cabinetTypeChoices');
  wrap.innerHTML = '';
  const choices = [
    { key:'stojąca', title:'Szafka dolna', sub:'Standardowy dół', ico:'⬇️' },
    { key:'wisząca', title:'Szafka wisząca', sub:'Standardowa góra', ico:'⬆️' },
    { key:'moduł', title:'Moduł', sub:'Wkład / segment', ico:'🧱' },
    { key:'zestaw', title:'Zestaw', sub:'Standardy na ikonkach', ico:'🧩' }
  ];

  choices.forEach(ch => {
    const tile = document.createElement('div');
    tile.className = 'choice-tile' + (cabinetModalState.chosen === ch.key ? ' selected' : '');
    tile.innerHTML = `
      <div class="choice-ico">${ch.ico}</div>
      <div>
        <div class="choice-title">${ch.title}</div>
        <div class="choice-sub">${ch.sub}</div>
      </div>
    `;
    tile.addEventListener('click', () => {
      cabinetModalState.chosen = ch.key;

      if(ch.key !== 'zestaw'){
        const room = uiState.roomType;
    projectData[room].cabinets = projectData[room].cabinets || [];
        if(!cabinetModalState.draft) cabinetModalState.draft = makeDefaultCabinetDraftForRoom(room);

        applyTypeRulesSafe(room, cabinetModalState.draft, ch.key);
        const opts = getSubTypeOptionsForTypeSafe(ch.key).map(o=>o.v);
        if(!opts.includes(cabinetModalState.draft.subType)) cabinetModalState.draft.subType = opts[0];
        applySubTypeRulesSafe(room, cabinetModalState.draft, cabinetModalState.draft.subType);
        ensureFrontCountRulesSafe(cabinetModalState.draft);
      }
      renderCabinetModal();
    });
    wrap.appendChild(tile);
  });
}

function populateSelect(el, options, selected){
  const api = getCabinetModalFieldsApi();
  if(api && typeof api.populateSelect === 'function') return api.populateSelect(el, options, selected);
  if(!el) return;
  el.innerHTML = '';
}

function populateFrontColorsTo(selectEl, typeVal, selected){
  const api = getCabinetModalFieldsApi();
  if(api && typeof api.populateFrontColorsTo === 'function') return api.populateFrontColorsTo(selectEl, typeVal, selected);
  if(!selectEl) return;
  selectEl.innerHTML = '';
}

function populateBodyColorsTo(selectEl, selected){
  const api = getCabinetModalFieldsApi();
  if(api && typeof api.populateBodyColorsTo === 'function') return api.populateBodyColorsTo(selectEl, selected);
  if(!selectEl) return;
  selectEl.innerHTML = '';
}

function populateOpeningOptionsTo(selectEl, typeVal, selected){
  const api = getCabinetModalFieldsApi();
  if(api && typeof api.populateOpeningOptionsTo === 'function') return api.populateOpeningOptionsTo(selectEl, typeVal, selected);
  if(!selectEl) return;
  selectEl.innerHTML = '';
}

function renderCabinetExtraDetailsInto(container, draft){
  container.innerHTML = '';
  try{ container.classList.add('cabinet-extra-details'); }catch(_){ }
  const t = draft.type;
  const rawSubType = String(draft && draft.subType || '');
  const validationApi = getCabinetModalValidationApi();
  const fieldsApi = getCabinetModalFieldsApi();
  const st = (validationApi && typeof validationApi.normalizeLegacySubType === 'function')
    ? validationApi.normalizeLegacySubType(rawSubType)
    : (rawSubType === 'szufladowa' ? 'szuflady' : rawSubType);
  const d = draft.details || {};

  function addSelect(labelText, key, options, onChangeExtra){
    if(fieldsApi && typeof fieldsApi.appendExtraSelectField === 'function') return fieldsApi.appendExtraSelectField(container, { draft, labelText, key, options, onChangeExtra, onRender: renderCabinetModal });
    return null;
  }

  function addNumber(labelText, key, fallback){
    if(fieldsApi && typeof fieldsApi.appendExtraNumberField === 'function') return fieldsApi.appendExtraNumberField(container, { draft, labelText, key, fallback });
    return null;
  }

  const typeApi = getCabinetModalTypeApi(t);
  if(typeApi && typeof typeApi.renderExtraDetails === 'function'){
    const handled = typeApi.renderExtraDetails({
      container,
      draft,
      subType: st,
      details: d,
      addSelect,
      addNumber,
      renderCabinetModal,
      cabinetModalState,
      uiState,
      projectData,
      ensureFrontCountRulesSafe,
      getFlapFrontCountSafe
    });
    if(handled) return;
  }
}

/* ===== Zestawy (presety) ===== */
function renderSetTiles(){
  const api = getCabinetModalSetWizardApi();
  if(api && typeof api.renderSetTiles === 'function') return api.renderSetTiles();
  return null;
}

function renderSetParamsUI(presetId){
  const api = getCabinetModalSetWizardApi();
  if(api && typeof api.renderSetParamsUI === 'function') return api.renderSetParamsUI(presetId);
  return null;
}

function wireSetParamsLiveUpdate(presetId){
  const api = getCabinetModalSetWizardApi();
  if(api && typeof api.wireSetParamsLiveUpdate === 'function') return api.wireSetParamsLiveUpdate(presetId);
  return null;
}

/* ===== Cabinet modal render ===== */
function renderCabinetModal(){
  const isSetEdit = !!cabinetModalState.setEditId;

  // Nagłówek: Anuluj zawsze widoczne, Zatwierdź tylko gdy pokazujemy formularz / zestaw.
  const saveTopBtn = document.getElementById('cabinetModalSave');
  const cancelTopBtn = document.getElementById('cabinetModalCancel');
  if(cancelTopBtn){
    cancelTopBtn.style.display = 'inline-flex';
    cancelTopBtn.disabled = false;
    cancelTopBtn.textContent = 'Anuluj';
  }
  if(saveTopBtn){
    saveTopBtn.style.display = 'none';
    saveTopBtn.disabled = true;
  }

  document.getElementById('cabinetModalIcon').textContent = isSetEdit ? '✏️' : (cabinetModalState.mode === 'edit' ? '✏️' : '➕');
  document.getElementById('cabinetModalTitle').textContent = isSetEdit ? 'Edytuj zestaw' : (cabinetModalState.mode === 'edit' ? 'Edytuj szafkę' : 'Dodaj');

  const choiceCard = document.getElementById('cabinetChoiceCard');
  choiceCard.style.display = isSetEdit ? 'none' : 'block';

  if(!isSetEdit){
    renderCabinetTypeChoices();
  } else {
    cabinetModalState.chosen = 'zestaw';
  }

  const formArea = document.getElementById('cabinetFormArea');
  const setArea = document.getElementById('setWizardArea');

  formArea.style.display = 'none';
  setArea.style.display = 'none';

  if(cabinetModalState.chosen === 'zestaw'){
    const setApi = getCabinetModalSetWizardApi();
    if(setApi && typeof setApi.renderSetWizardMode === 'function'){
      setApi.renderSetWizardMode({ isSetEdit, saveTopBtn });
      return;
    }
    return;
  }

  if(!cabinetModalState.chosen) return;

  formArea.style.display = 'block';
  try{ formArea.classList.add('cabinet-choice-sync'); }catch(_){ }

  if(saveTopBtn){
    saveTopBtn.style.display = 'inline-flex';
    saveTopBtn.disabled = false;
    // IMPORTANT: when leaving set mode, reset the CTA label so it doesn't stick as "Dodaj zestaw".
    saveTopBtn.textContent = (cabinetModalState.mode === 'edit') ? 'Zapisz zmiany' : 'Dodaj';
  }

  // pokazujemy Zatwierdź w nagłówku dopiero gdy jest formularz
  if(saveTopBtn){
    saveTopBtn.style.display = 'inline-flex';
    saveTopBtn.disabled = false;
    saveTopBtn.textContent = (cabinetModalState.mode === 'edit') ? 'Zapisz zmiany' : 'Dodaj';
  }

  const draft = cabinetModalState.draft;
  const room = uiState.roomType;

  // Rodzaj z kafelka
  draft.type = cabinetModalState.chosen;

  const cmSubType = document.getElementById('cmSubType');
  populateSelect(cmSubType, getSubTypeOptionsForTypeSafe(draft.type), draft.subType);

  renderCabinetExtraDetailsInto(document.getElementById('cmExtraDetails'), draft);

  document.getElementById('cmWidth').value = draft.width;
  document.getElementById('cmHeight').value = draft.height;
  document.getElementById('cmDepth').value = draft.depth;

  document.getElementById('cmFrontMaterial').value = draft.frontMaterial || 'laminat';
  document.getElementById('cmBackMaterial').value = draft.backMaterial || 'HDF 3mm biała';

  populateFrontColorsTo(document.getElementById('cmFrontColor'), draft.frontMaterial || 'laminat', draft.frontColor || '');
  populateBodyColorsTo(document.getElementById('cmBodyColor'), draft.bodyColor || '');
  populateOpeningOptionsTo(document.getElementById('cmOpeningSystem'), draft.type, draft.openingSystem || 'uchwyt klienta');

  // FRONT COUNT UI
  const fcSel = document.getElementById('cmFrontCount');
  const fcStatic = document.getElementById('cmFrontCountStatic');
  const fcHint = document.getElementById('cmFrontCountHint');
  const fcWrap = document.getElementById('cmFrontCountWrap');
  const shelvesWrap = document.getElementById('cmShelvesWrap');
  const shelvesInput = document.getElementById('cmShelves');

  const flapWrap = document.getElementById('cmFlapWrap');
  const flapVendorSel = document.getElementById('cmFlapVendor');
  const flapKindWrap = document.getElementById('cmFlapKindWrap');
  const flapKindSel = document.getElementById('cmFlapKind');
  const flapInfo = document.getElementById('cmFlapInfo');
  const flapFrontInfo = document.getElementById('cmFlapFrontInfo');
  const fcLabelEl = document.getElementById('cmFrontCountLabel');

  const typeApi = getCabinetModalTypeApi(draft.type);
  if(typeApi && typeof typeApi.configureFrontControls === 'function'){
    typeApi.configureFrontControls({
      draft,
      room,
      fcSel,
      fcStatic,
      fcHint,
      fcWrap,
      shelvesWrap,
      shelvesInput,
      flapWrap,
      flapVendorSel,
      flapKindWrap,
      flapKindSel,
      flapInfo,
      flapFrontInfo,
      fcLabelEl,
      renderCabinetModal,
      populateSelect,
      ensureFrontCountRulesSafe,
      cabinetAllowsFrontCountSafe,
      getFlapFrontCountSafe
    });
  }

  cmSubType.onchange = () => {
    applySubTypeRulesSafe(room, draft, cmSubType.value);
    ensureFrontCountRulesSafe(draft);
    const currentTypeApi = getCabinetModalTypeApi(draft.type);
    if(currentTypeApi && typeof currentTypeApi.afterSubTypeChange === 'function'){
      currentTypeApi.afterSubTypeChange({ draft, room, nextSubType: cmSubType.value, projectData, getFlapFrontCountSafe });
    }
    renderCabinetModal();
  };

  fcSel.onchange = () => {
    draft.frontCount = Number(fcSel.value || 2);
  };

  document.getElementById('cmWidth').onchange = e => { draft.width = parseFloat(e.target.value || 0); };

  // Live re-check dla uchylnych: po zmianie wysokości od razu przelicz LF i sprawdź zakresy
  const _liveAventosCheck = () => {
    try{
      const room = uiState.roomType;
      syncDraftFromCabinetModalFormSafe(draft);
      ensureFrontCountRulesSafe(draft);

      // Walidacja szuflad systemowych (GTV/Rejs – w budowie -> blokada zapisu)
      const _drawerBlockMsg = (function(){
        const dd = draft.details || {};
        const checkSystem = (sys, brand, ctx) => {
          if(String(sys||'') !== 'systemowe') return null;
          const b = String(brand||'blum');
          if(b !== 'blum') return `Szuflady ${ctx}: ${b.toUpperCase()} – w budowie. Nie można zatwierdzić.`;
          return null;
        };
        // główna szuflada (szufladowa / moduł / zlewowa front / piekarnikowa)
        let m = checkSystem(dd.drawerSystem, dd.drawerBrand, 'frontowe');
        if(m) return m;
        // zlewowa: szuflada wewnętrzna
        m = checkSystem(dd.sinkInnerDrawerType, dd.sinkInnerDrawerBrand, 'wewnętrzne (zlewowa)');
        if(m) return m;
        return null;
      })();
      if(_drawerBlockMsg){ showCabinetInfo('Zmiana zablokowana', _drawerBlockMsg); return; }
      applyAventosValidationUISafe(room, draft);
    }catch(_e){ /* nie psuj modala */ }
  };
  const _cmHeightEl = document.getElementById('cmHeight');
  if(_cmHeightEl){
    _cmHeightEl.oninput = _liveAventosCheck;
    _cmHeightEl.onchange = _liveAventosCheck;
  }

  const _cmWidthEl = document.getElementById('cmWidth');
  if(_cmWidthEl){
    _cmWidthEl.oninput = _liveAventosCheck;
    _cmWidthEl.onchange = _liveAventosCheck;
  }
  const _cmDepthEl = document.getElementById('cmDepth');
  if(_cmDepthEl){
    _cmDepthEl.oninput = _liveAventosCheck;
    _cmDepthEl.onchange = _liveAventosCheck;
  }

  document.getElementById('cmFrontMaterial').onchange = e => {
    draft.frontMaterial = e.target.value;
    const first = materials.find(m => m.materialType === draft.frontMaterial);
    draft.frontColor = first ? first.name : '';
    renderCabinetModal();
  };
  document.getElementById('cmFrontColor').onchange = e => { draft.frontColor = e.target.value; };
  document.getElementById('cmBackMaterial').onchange = e => { draft.backMaterial = e.target.value; };
  document.getElementById('cmBodyColor').onchange = e => { draft.bodyColor = e.target.value; };
  document.getElementById('cmOpeningSystem').onchange = e => { draft.openingSystem = e.target.value; };

  try{
    const launcherApi = window.FC && window.FC.cabinetChoiceLaunchers;
    if(launcherApi && typeof launcherApi.refreshCabinetChoices === 'function') launcherApi.refreshCabinetChoices(document.getElementById('cabinetModal'));
    else {
      if(launcherApi && typeof launcherApi.mountSafeFieldLaunchers === 'function') launcherApi.mountSafeFieldLaunchers();
      if(launcherApi && typeof launcherApi.mountDynamicSelectLaunchers === 'function'){
        launcherApi.mountDynamicSelectLaunchers(document.getElementById('cmExtraDetails'));
        launcherApi.mountDynamicSelectLaunchers(document.getElementById('setFrontBlock'));
      }
      if(launcherApi && typeof launcherApi.mountVisibleFallbackLaunchers === 'function'){
        launcherApi.mountVisibleFallbackLaunchers(document.getElementById('cabinetFormArea'));
      }
    }
  }catch(_){ }

  const _cabCancel = document.getElementById('cabinetModalCancel');
  if(_cabCancel) _cabCancel.onclick = closeCabinetModal;
  document.getElementById('cabinetModalSave').onclick = (e) => {
    // twarde zabezpieczenie: żadnego "przebicia" kliknięcia do innych handlerów
    if(e){ e.preventDefault(); e.stopPropagation(); }

    // Tryb zestawu: Zatwierdź działa jak "Dodaj zestaw / Zapisz zmiany"
    const setApi = getCabinetModalSetWizardApi();
    const inSetMode = !!(setApi && typeof setApi.isSetModeActive === 'function' && setApi.isSetModeActive());
    if(inSetMode){
      if(setApi && typeof setApi.handleTopSaveClick === 'function') return setApi.handleTopSaveClick(e);
      return;
    }
    try{
      if(!uiState.roomType){ showCabinetInfo('Brak pomieszczenia', 'Wybierz pomieszczenie.'); return; }
      const room = uiState.roomType;

      syncDraftFromCabinetModalFormSafe(draft);
      ensureFrontCountRulesSafe(draft);

      // Walidacja podnośników (AVENTOS) na etapie zapisu – jeśli poza zakresem, nie dodawaj/nie zapisuj
      const _av = validateAventosForDraftSafe(room, draft);
      if(_av && _av.ok === false){
        applyAventosValidationUISafe(room, draft);
        return;
      }

      const beforeCount = (projectData[room].cabinets || []).length;

      const isAdd = (cabinetModalState.mode === 'add' || !cabinetModalState.editingId);
      if(isAdd){
        const newCab = FC.utils.clone(draft);
        newCab.id = FC.utils.uid();
        projectData[room].cabinets.push(newCab);
        // Po dodaniu: otwórz (rozwiń) ostatnio dodaną szafkę
        uiState.expanded = {};
        uiState.expanded[String(newCab.id)] = true;
        uiState.selectedCabinetId = newCab.id;

        // Zapamiętaj „dopiero co dodaną” (do domyślnego typu przy kolejnym dodawaniu)
        uiState.lastAddedAt = Date.now();
        uiState.lastAddedCabinetId = String(newCab.id);
        uiState.lastAddedCabinetType = String(newCab.type || '');

        // generuj fronty jeśli trzeba (lodówkowa też)
        generateFrontsForCabinet(room, newCab);
      } else {
        const id = cabinetModalState.editingId;
        projectData[room].cabinets = projectData[room].cabinets.map(c => c.id === id ? Object.assign({}, FC.utils.clone(draft), { id }) : c);

        const updated = projectData[room].cabinets.find(c => c.id === id);
        if(updated) generateFrontsForCabinet(room, updated);
      }

      projectData = FC.project.save(projectData);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);

      // najpierw odśwież widok — jeśli coś się wysypie, modal ma zostać otwarty
      renderCabinets();

      const afterCount = (projectData[room].cabinets || []).length;
      if(isAdd && afterCount <= beforeCount){
        showCabinetInfo('Nie udało się dodać szafki', 'Wystąpił błąd logiki zapisu.');
        return;
      }

      closeCabinetModal();
    }catch(err){
      console.error('Błąd zapisu szafki:', err);
      showCabinetInfo('Błąd podczas zapisu', 'Sprawdź konsolę. Modal pozostaje otwarty.');
    }
  };

  // Walidacja klapy (AVENTOS) – blokuj zapis jeśli poza zakresem
  applyAventosValidationUISafe(room, draft);
}

/* ===== set wizard delegated to js/app/cabinet/cabinet-modal-set-wizard.js ===== */
function getSetParamsFromUI(presetId){
  const api = getCabinetModalSetWizardApi();
  if(api && typeof api.getSetParamsFromUI === 'function') return api.getSetParamsFromUI(presetId);
  return null;
}

function fillSetParamsUIFromSet(set){
  const api = getCabinetModalSetWizardApi();
  if(api && typeof api.fillSetParamsUIFromSet === 'function') return api.fillSetParamsUIFromSet(set);
  return null;
}

function getNextSetNumber(room){
  const api = getCabinetModalSetWizardApi();
  if(api && typeof api.getNextSetNumber === 'function') return api.getNextSetNumber(room);
  return 1;
}

function createOrUpdateSetFromWizard(){
  const api = getCabinetModalSetWizardApi();
  if(api && typeof api.createOrUpdateSetFromWizard === 'function') return api.createOrUpdateSetFromWizard();
  return null;
}

/* ===== Read-only: cabinet details summary ===== */

  ns.cabinetModal = {
    makeDefaultCabinetDraftForRoom,
    openCabinetModalForAdd,
    lockModalScroll,
    unlockModalScroll,
    openCabinetModalForEdit,
    openSetWizardForEdit,
    closeCabinetModal,
    renderCabinetTypeChoices,
    populateSelect,
    populateFrontColorsTo,
    populateBodyColorsTo,
    populateOpeningOptionsTo,
    renderCabinetExtraDetailsInto,
    renderSetTiles,
    renderSetParamsUI,
    wireSetParamsLiveUpdate,
    renderCabinetModal,
    getSetParamsFromUI,
    fillSetParamsUIFromSet,
    getNextSetNumber,
    createOrUpdateSetFromWizard
  };
})();
function showCabinetInfo(title, message){
  try{
    if(FC.infoBox && typeof FC.infoBox.open === 'function'){
      FC.infoBox.open({ title:String(title || 'Informacja'), message:String(message || '') });
      return;
    }
  }catch(_){ }
  try{ console.warn('[cabinetModal]', title, message); }catch(_){ }
}

async function askCabinetConfirm(cfg){
  try{
    if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') return !!(await FC.confirmBox.ask(cfg || {}));
  }catch(_){ }
  return true;
}


