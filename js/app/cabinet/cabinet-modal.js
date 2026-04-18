(function(){
  const ns = (window.FC = window.FC || {});

function getCabinetModalValidationApi(){ return (window.FC && window.FC.cabinetModalValidation) || {}; }
function getCabinetModalDraftApi(){ return (window.FC && window.FC.cabinetModalDraft) || {}; }
function getCabinetModalFieldsApi(){ return (window.FC && window.FC.cabinetModalFields) || {}; }
function getCabinetModalSetWizardApi(){ return (window.FC && window.FC.cabinetModalSetWizard) || {}; }

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


  // narożna L (wisząca / stojąca): własne wymiary + szkic (bez grafik zewnętrznych)
  if((t === 'wisząca' || t === 'stojąca') && st === 'narozna_l'){
    const d0 = FC.utils.isPlainObject(draft.details) ? draft.details : {};
    // domyślne wymiary zależnie od typu
    const isStanding = (t === 'stojąca');
    const defaults = {
      gl: (d0.gl != null ? d0.gl : (isStanding ? '110' : '70')),
      gp: (d0.gp != null ? d0.gp : (isStanding ? '50'  : '36')),
      st: (d0.st != null ? d0.st : (isStanding ? '100' : '60')),
      sp: (d0.sp != null ? d0.sp : (isStanding ? '47'  : '33')),
      shelves: (d0.shelves != null ? d0.shelves : 2)
    ,
      cornerFlip: (d0.cornerFlip != null ? d0.cornerFlip : false)
    };
    draft.details = Object.assign({}, d0, defaults);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
        <div>
          <label>GL</label>
          <input id="cmGL" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Głębokość lewa (cm)</div>
        </div>
        <div>
          <label>GP</label>
          <input id="cmGP" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Głębokość prawa (cm)</div>
        </div>
        <div>
          <label>ST</label>
          <input id="cmST" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Szerokość tyłu (cm)</div>
        </div>
        <div>
          <label>SP</label>
          <input id="cmSP" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Szerokość przodu (cm)</div>
        </div>
      </div>

      <div class="flex" style="margin-top:10px;justify-content:space-between;flex-wrap:wrap">
        <button id="flipCornerBtn" class="btn" type="button">Odwróć narożnik</button>
        <div id="cornerWarn" class="warn-orange xs"></div>
      </div>

      <div class="muted xs" style="margin-top:8px">
        Widok z góry. Fronty liczone: <b>FL = |GL−GP|</b> oraz <b>FP = |ST−SP−1,8|</b> (płyta 18&nbsp;mm).
      </div>

      <div style="margin-top:10px">
        <canvas id="cornerPreview" width="520" height="360" style="width:100%;max-width:520px;border:1px solid #ddd;border-radius:10px;"></canvas>
        <div class="muted xs" id="cornerPreviewLegend" style="margin-top:6px"></div>
      </div>
    `;
    container.appendChild(wrap);

    const iGL = wrap.querySelector('#cmGL');
    const iGP = wrap.querySelector('#cmGP');
    const iST = wrap.querySelector('#cmST');
    const iSP = wrap.querySelector('#cmSP');
    const warnEl = wrap.querySelector('#cornerWarn');
    const flipBtn = wrap.querySelector('#flipCornerBtn');

    iGL.value = draft.details.gl;
    iGP.value = draft.details.gp;
    iST.value = draft.details.st;
    iSP.value = draft.details.sp;

    const widthInput = document.getElementById('cmWidth');
    const depthInput = document.getElementById('cmDepth');

    const sync = () => {
      const GL = Number(iGL.value) || 0;
      const GP = Number(iGP.value) || 0;
      const ST = Number(iST.value) || 0;
      const SP = Number(iSP.value) || 0;
      const flip = !!(draft.details && draft.details.cornerFlip);

      // Twoje zasady na fronty (cm)
      const FL = Math.abs(GL - GP);
      const FP = Math.abs(ST - SP - 1.8);

      draft.details = Object.assign({}, draft.details || {}, {
        gl: String(GL),
        gp: String(GP),
        st: String(ST),
        sp: String(SP)
      });

      // pomocniczo: uzupełnij "Szerokość" i "Głębokość" w głównych polach (żeby wycena/listy miały sens)
      // szerokość = ST, głębokość = max(GL, GP)
      draft.width = ST;
      draft.depth = Math.max(GL, GP);

      if(widthInput) widthInput.value = String(draft.width);
      if(depthInput) depthInput.value = String(draft.depth);

      drawCornerSketch({ GL, GP, ST, SP, t: 1.8, flip });

      // Ostrzeżenie: front < 15 cm
      if(warnEl){
        const msgs = [];
        if(FL > 0 && FL < 15) msgs.push('Front (FL) < 15 cm');
        if(FP > 0 && FP < 15) msgs.push('Front (FP) < 15 cm');
        if(msgs.length){
          warnEl.style.display = 'block';
          warnEl.textContent = '⚠ ' + msgs.join(' • ');
        } else {
          warnEl.style.display = 'none';
          warnEl.textContent = '';
        }
      }
    };

    [iGL,iGP,iST,iSP].filter(Boolean).forEach(inp => {
      inp.addEventListener('input', sync);
      inp.addEventListener('change', sync);
    });

    if(flipBtn){
      flipBtn.addEventListener('click', () => {
        // Odwróć tylko "stronę" narożnika (rysunek + opisy), bez zamiany wpisanych wartości.
        // Fronty i tak liczymy z wartości bezwzględnych, a GL/GP w formularzu zostają tym,
        // co wpisał operator.
        draft.details = Object.assign({}, draft.details || {}, {
          cornerFlip: !(draft.details && draft.details.cornerFlip)
        });
        sync();
      });
    }

    sync();
    return;
  }

  if(t === 'wisząca'){
    if(st === 'dolna_podblatowa'){
      // PODBLATOWA: fronty mogą być brak/drzwi/szuflady, a wnętrze: półki lub szuflady wewnętrzne
      if(!d.podFrontMode){
        // kompatybilność wstecz: jeśli stary zapis miał subTypeOption szuflady_1/2
        if(d.subTypeOption === 'szuflada_1'){ d.podFrontMode = 'szuflady'; cabinetModalState.draft.frontCount = 1; }
        else if(d.subTypeOption === 'szuflada_2'){ d.podFrontMode = 'szuflady'; cabinetModalState.draft.frontCount = 2; }
        else d.podFrontMode = (Number(cabinetModalState.draft.frontCount) === 0 ? 'brak' : 'drzwi');
      }
      if(!d.podInsideMode) d.podInsideMode = 'polki';
      if(!d.podInnerDrawerCount) d.podInnerDrawerCount = '1';

      addSelect('Front', 'podFrontMode', [
        {v:'brak', t:'Otwarta (brak frontów)'},
        {v:'drzwi', t:'Drzwi (fronty)'},
        {v:'szuflady', t:'Szuflady (zamiast drzwi)'}
      ], (val)=>{
        // synchronizacja z ilością frontów/szuflad
        if(val === 'brak'){
          cabinetModalState.draft.frontCount = 0;
        } else {
          const fc = Number(cabinetModalState.draft.frontCount);
          if(![1,2].includes(fc)) cabinetModalState.draft.frontCount = 2;
        }
      });

      if(d.podFrontMode !== 'szuflady'){
        addSelect('Wnętrze', 'podInsideMode', [
          {v:'polki', t:'Półki'},
          {v:'szuflady_wewn', t:'Szuflady wewnętrzne'}
        ]);

        if(d.podInsideMode === 'polki'){
          addNumber('Ilość półek', 'shelves', 2);
        } else {
          addSelect('Ilość szuflad wewnętrznych', 'podInnerDrawerCount', [
            {v:'1', t:'1'},
            {v:'2', t:'2'}
          ]);
        }

      // Plecy (tak/nie) – tylko dla szafki: wisząca podblatowa
      if(!(draft.details && (draft.details.hasBack !== undefined))){
        draft.details = Object.assign({}, draft.details || {}, { hasBack: '1' });
      }
      addSelect('Plecy', 'hasBack', [
        {v:'1', t:'Tak'},
        {v:'0', t:'Nie'}
      ]);
      }
    } else {
      if(st === 'rogowa_slepa') addNumber('Część zaślepiona (cm)', 'blindPart', 30);
      if(st !== 'uchylne') addNumber('Ilość półek', 'shelves', 2);
    }
  }

  if(t === 'stojąca' || t === 'moduł'){
    if(st === 'szuflady'){
      // Szafka stojąca szufladowa: układ + typ szuflad + opcjonalne szuflady wewnętrzne
      if(!d.drawerLayout){
        // kompatybilność wstecz: drawerCount 1/2/3/4/5
        const legacy = String(d.drawerCount || '3');
        if(legacy === '1') d.drawerLayout = '1_big';
        else if(legacy === '2') d.drawerLayout = '2_equal';
        else if(legacy === '3') d.drawerLayout = '3_1_2_2';
        else if(legacy === '5') d.drawerLayout = '5_equal';
        else d.drawerLayout = '3_equal';
      }
      if(!d.drawerSystem) d.drawerSystem = 'skrzynkowe';
      if(!('innerDrawerType' in d)) d.innerDrawerType = 'brak';
      if(!('innerDrawerCount' in d) || d.innerDrawerCount == null) d.innerDrawerCount = '0';
addSelect('Układ szuflad (fronty)', 'drawerLayout', [
        {v:'1_big', t:'1 duża (1:1)'},
        {v:'3_1_2_2', t:'1 mała + 2 duże (1:2:2)'},
        {v:'2_equal', t:'2 równe (1:1)'},
        {v:'3_equal', t:'3 równe (1:1:1)'},
        {v:'5_equal', t:'5 równych (1:1:1:1:1)'}
      ], () => {
        // dostosuj domyślne limity dla szuflad wewnętrznych
        const lay = String(draft.details?.drawerLayout || '3_1_2_2');
        if(lay === '5_equal'){
          draft.details = Object.assign({}, draft.details || {}, { innerDrawerType: 'brak', innerDrawerCount: '0' });
        } else if(lay === '3_equal'){
          if(String(draft.details?.innerDrawerCount || '') === '0' || !draft.details?.innerDrawerCount) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: '3' });
        } else {
          if(String(draft.details?.innerDrawerCount || '') === '0' || !draft.details?.innerDrawerCount) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: '2' });
        }
        renderCabinetModal();
      });

      // domyślne ustawienia dla szafki szufladowej
      draft.details = Object.assign({}, draft.details || {});
      const isAdd = (cabinetModalState.mode === 'add' || !cabinetModalState.editingId);

      // UWAGA: nie nadpisuj wyborów użytkownika przy każdym renderze.
      // drawerSystem przyjmuje tylko: 'skrzynkowe' | 'systemowe'
      if(!draft.details.drawerSystem || !['skrzynkowe','systemowe'].includes(String(draft.details.drawerSystem))){
        draft.details.drawerSystem = 'skrzynkowe';
      }
      if(!draft.details.innerDrawerType) draft.details.innerDrawerType = 'brak';
      if(draft.details.innerDrawerType === 'brak'){
        draft.details.innerDrawerCount = '0';
      } else if(!draft.details.innerDrawerCount){
        // domyślnie 2, dalsze ograniczenia liczy istniejąca logika układu
        draft.details.innerDrawerCount = '2';
      }
addSelect('Typ szuflad (frontowych)', 'drawerSystem', [
        {v:'skrzynkowe', t:'Skrzynkowe'},
        {v:'systemowe', t:'Systemowe'}
      ], ()=>{ renderCabinetModal(); });

      const ds = String((draft.details && draft.details.drawerSystem) ? draft.details.drawerSystem : 'skrzynkowe');
      if(ds === 'systemowe'){
        // domyślne wartości
        if(!draft.details.drawerBrand) draft.details.drawerBrand = 'blum';
        if(draft.details.drawerBrand === 'blum' && !draft.details.drawerModel) draft.details.drawerModel = 'tandembox';

        addSelect('Firma systemu', 'drawerBrand', [
          {v:'blum', t:'BLUM'},
          {v:'gtv', t:'GTV'},
          {v:'rejs', t:'Rejs'}
        ], ()=>{ renderCabinetModal(); });

        const br = String(draft.details.drawerBrand || 'blum');
        if(br === 'blum'){
          addSelect('Typ szuflady BLUM', 'drawerModel', [
            {v:'tandembox', t:'TANDEMBOX (domyślnie)'},
            {v:'legrabox', t:'LEGRABOX'},
            {v:'merivobox', t:'MERIVOBOX'},
            {v:'metabox', t:'METABOX'}
          ]);
        } else {
          const warn = document.createElement('div');
          warn.className = 'muted xs';
          warn.style.marginTop = '6px';
          warn.textContent = 'GTV/Rejs – w budowie. Nie można zatwierdzić.';
          container.appendChild(warn);
        }
      }

      const lay = String(d.drawerLayout || '3_1_2_2');
      if(lay === '5_equal'){
        // Brak szuflad wewnętrznych dla 5 szuflad
        draft.details = Object.assign({}, draft.details || {}, { innerDrawerType: 'brak', innerDrawerCount: '0' });
        const note = document.createElement('div');
        note.className = 'muted xs';
        note.style.marginTop = '6px';
        note.textContent = 'Dla układu 5 szuflad nie dodajemy szuflad wewnętrznych.';
        container.appendChild(note);
      } else {
        addSelect('Szuflady wewnętrzne', 'innerDrawerType', [
          {v:'brak', t:'Brak'},
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'blum', t:'Systemowe BLUM'}
        ], () => renderCabinetModal());

        const mode = String((draft.details && draft.details.innerDrawerType) ? draft.details.innerDrawerType : 'brak');
        const max = (lay === '3_equal') ? 3 : 2;
        const def = (lay === '3_equal') ? 3 : 2;

        if(mode !== 'brak'){
          // ilość z listy (limit)
          (function(){
            const div = document.createElement('div'); div.style.marginBottom='10px';
            div.className = 'cabinet-extra-field cabinet-extra-field--select cabinet-extra-field--compact';
            div.innerHTML = `<label class="cabinet-extra-field__label">Ilość szuflad wewnętrznych (max ${max})</label><select class="cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source" data-launcher-label="Ilość szuflad wewnętrznych (max ${max})" data-choice-title="Wybierz: Ilość szuflad wewnętrznych" data-choice-placeholder="Ilość szuflad wewnętrznych"></select>`;
            const sel = div.querySelector('select');

            const raw = (draft.details && draft.details.innerDrawerCount != null) ? draft.details.innerDrawerCount : String(def);
            let cur = parseInt(raw || '0', 10);
            if(!Number.isFinite(cur) || cur < 1) cur = def;
            if(cur > max) cur = max;

            sel.innerHTML = Array.from({length:max}, (_,i)=>i+1).map(n=>`<option value="${n}">${n}</option>`).join('');
            sel.value = String(cur);

            sel.addEventListener('change', e => {
              let v = parseInt(e.target.value || '1', 10);
              if(!Number.isFinite(v) || v < 1) v = 1;
              if(v > max) v = max;
              draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: String(v) });
              renderCabinetModal();
            });

            container.appendChild(div);
          })();
        } else {
          // utrzymuj sensowną domyślną wartość "na start"
          const cur = parseInt(d.innerDrawerCount, 10);
          if(!Number.isFinite(cur) || cur <= 0){
            draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: String(def) });
          }
        }
      }
    }

    if(st === 'zlewowa'){
      // FRONT: drzwi lub szuflada
      if(!d.sinkFront) d.sinkFront = 'drzwi';
      if(!d.sinkDoorCount) d.sinkDoorCount = '2';
      if(!d.sinkExtra) d.sinkExtra = 'brak';
      if(d.sinkExtraCount == null) d.sinkExtraCount = 1;
      if(!d.sinkInnerDrawerType) d.sinkInnerDrawerType = 'skrzynkowe';

      addSelect('Front szafki zlewowej', 'sinkFront', [
        {v:'drzwi', t:'Drzwi'},
        {v:'szuflada', t:'Szuflada (1 duży front)'}
      ], () => {
        // wymuszenia frontów
        const curFront = (draft.details && draft.details.sinkFront) ? draft.details.sinkFront : 'drzwi';
        if(curFront === 'szuflada'){
          draft.frontCount = 1;
        } else {
          const dc = Number((draft.details && draft.details.sinkDoorCount) ? draft.details.sinkDoorCount : '2') || 2;
          draft.frontCount = (dc === 1 ? 1 : 2);
        }
        renderCabinetModal();
      });

      const curFront = (draft.details && draft.details.sinkFront) ? draft.details.sinkFront : 'drzwi';

      if(curFront === 'drzwi'){
        addSelect('Ilość drzwi', 'sinkDoorCount', [
          {v:'1', t:'1 drzwi'},
          {v:'2', t:'2 drzwi'}
        ], () => {
          const dc = Number((draft.details && draft.details.sinkDoorCount) ? draft.details.sinkDoorCount : '2') || 2;
          draft.frontCount = (dc === 1 ? 1 : 2);
        });
      } else {
        // szuflada: 1 front
        draft.frontCount = 1;
      }

      if(curFront === 'szuflada'){
        if(!draft.details.drawerSystem) draft.details.drawerSystem = 'skrzynkowe';
        if(!draft.details.drawerBrand) draft.details.drawerBrand = 'blum';
        if(!draft.details.drawerModel) draft.details.drawerModel = 'tandembox';

        addSelect('Typ szuflady (zlewowa)', 'drawerSystem', [
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'systemowe', t:'Systemowe'}
        ], ()=>{ renderCabinetModal(); });

        const ds3 = String(draft.details.drawerSystem || 'skrzynkowe');
        if(ds3 === 'systemowe'){
          addSelect('Firma systemu', 'drawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ renderCabinetModal(); });
          const br3 = String(draft.details.drawerBrand || 'blum');
          if(br3 === 'blum'){
            addSelect('Typ szuflady BLUM', 'drawerModel', [
              {v:'tandembox', t:'TANDEMBOX (domyślnie)'},
              {v:'legrabox', t:'LEGRABOX'},
              {v:'merivobox', t:'MERIVOBOX'},
              {v:'metabox', t:'METABOX'}
            ]);
          } else {
            const warn3 = document.createElement('div');
            warn3.className = 'muted xs';
            warn3.style.marginTop = '6px';
            warn3.textContent = 'GTV/Rejs – w budowie. Nie można zatwierdzić.';
            container.appendChild(warn3);
          }
        }
      }

      // DODATKOWE WNĘTRZE
      addSelect('Dodatkowo w środku', 'sinkExtra', [
        {v:'brak', t:'Brak'},
        {v:'polka', t:'Dodatkowa półka'},
        {v:'szuflada_wew', t:'Szuflada wewnętrzna'}
      ], ()=>{ renderCabinetModal(); });

      const extra = (draft.details && draft.details.sinkExtra) ? draft.details.sinkExtra : 'brak';
      if(extra === 'polka'){
        addNumber('Ilość dodatkowych półek', 'sinkExtraCount', 1);
      } else if(extra === 'szuflada_wew'){
        addNumber('Ilość szuflad wewnętrznych', 'sinkExtraCount', 1);
        addSelect('Typ szuflad wewnętrznych', 'sinkInnerDrawerType', [
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'systemowe', t:'Systemowe'}
        ], ()=>{ renderCabinetModal(); });

        const stt = String((draft.details && draft.details.sinkInnerDrawerType) ? draft.details.sinkInnerDrawerType : 'skrzynkowe');
        if(stt === 'systemowe'){
          if(!draft.details.sinkInnerDrawerBrand) draft.details.sinkInnerDrawerBrand = 'blum';
          if(draft.details.sinkInnerDrawerBrand === 'blum' && !draft.details.sinkInnerDrawerModel) draft.details.sinkInnerDrawerModel = 'tandembox';

          addSelect('Firma systemu', 'sinkInnerDrawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ renderCabinetModal(); });

          const br2 = String(draft.details.sinkInnerDrawerBrand || 'blum');
          if(br2 === 'blum'){
            addSelect('Typ szuflady BLUM', 'sinkInnerDrawerModel', [
              {v:'tandembox', t:'TANDEMBOX (domyślnie)'},
              {v:'legrabox', t:'LEGRABOX'},
              {v:'merivobox', t:'MERIVOBOX'},
              {v:'metabox', t:'METABOX'}
            ]);
          } else {
            const warn2 = document.createElement('div');
            warn2.className = 'muted xs';
            warn2.style.marginTop = '6px';
            warn2.textContent = 'GTV/Rejs – w budowie. Nie można zatwierdzić.';
            container.appendChild(warn2);
          }
        }
      }
    }
    if(st === 'zmywarkowa'){
      addSelect('Szerokość zmywarki', 'dishWasherWidth', [
        {v:'45', t:'45 cm'},
        {v:'60', t:'60 cm'}
      ], (val) => {
        draft.frontCount = 1;
        draft.width = Number(val) || draft.width;
      });
    }
    if(st === 'lodowkowa'){
      // Lodówkowa: zabudowa / wolnostojąca
      const grid = document.createElement('div');
      grid.className = 'grid-2';
      grid.style.gap = '12px';
      grid.style.marginBottom = '10px';

      const cur = (draft.details && FC.utils.isPlainObject(draft.details)) ? draft.details : {};
      const opt = cur.fridgeOption ? String(cur.fridgeOption) : 'zabudowa';
      const niche = cur.fridgeNicheHeight ? String(cur.fridgeNicheHeight) : '178';
      const freeOpt = cur.fridgeFreeOption ? String(cur.fridgeFreeOption) : 'brak';

      grid.innerHTML = `
        <div class="cabinet-extra-field cabinet-extra-field--select cabinet-extra-field--compact">
          <label class="cabinet-extra-field__label">Typ lodówki</label>
          <select id="cmFridgeOption" class="cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source" data-launcher-label="Typ lodówki" data-choice-title="Wybierz typ lodówki" data-choice-placeholder="Typ lodówki">
            <option value="zabudowa">W zabudowie</option>
            <option value="wolnostojaca">Wolnostojąca</option>
          </select>
        </div>
        <div id="cmFridgeNicheWrap" class="cabinet-extra-field cabinet-extra-field--select cabinet-extra-field--compact">
          <label class="cabinet-extra-field__label">Wysokość niszy (cm)</label>
          <select id="cmFridgeNiche" class="cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source" data-launcher-label="Wysokość niszy (cm)" data-choice-title="Wybierz wysokość niszy" data-choice-placeholder="Wysokość niszy (cm)">
            <option value="82">82</option>
            <option value="122">122</option>
            <option value="158">158</option>
            <option value="178">178</option>
            <option value="194">194</option>
            <option value="204">204</option>
          </select>
        </div>
        <div id="cmFridgeFreeWrap" class="cabinet-extra-field cabinet-extra-field--select cabinet-extra-field--compact" style="display:none">
          <label class="cabinet-extra-field__label">Opcja</label>
          <select id="cmFridgeFree" class="cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source" data-launcher-label="Opcja lodówki wolnostojącej" data-choice-title="Wybierz opcję lodówki wolnostojącej" data-choice-placeholder="Opcja lodówki wolnostojącej">
            <option value="brak">Brak</option>
            <option value="podest">Podest</option>
            <option value="obudowa">Obudowa</option>
          </select>
        </div>
      `;

      const fo = grid.querySelector('#cmFridgeOption');
      const fn = grid.querySelector('#cmFridgeNiche');
      const fw = grid.querySelector('#cmFridgeFree');
      const nicheWrap = grid.querySelector('#cmFridgeNicheWrap');
      const freeWrap = grid.querySelector('#cmFridgeFreeWrap');

      fo.value = opt;
      fn.value = niche;
      fw.value = freeOpt;

      function applyFridgeDims(){
        const room = uiState.roomType;
        const s = projectData[room] ? projectData[room].settings : null;
        const bh = s ? (Number(s.bottomHeight) || 0) : 0;
        const leg = s ? (Number(s.legHeight) || 0) : 0;

        const curOpt = (draft.details && draft.details.fridgeOption) ? String(draft.details.fridgeOption) : (fo ? fo.value : 'zabudowa');
        const curFree = (draft.details && draft.details.fridgeFreeOption) ? String(draft.details.fridgeFreeOption) : (fw ? fw.value : 'brak');
        const nh = Number((draft.details && draft.details.fridgeNicheHeight) ? draft.details.fridgeNicheHeight : (fn ? fn.value : 0)) || 0;

        // zawsze utrzymuj spójne details
        draft.details = Object.assign({}, draft.details || {}, {
          fridgeOption: curOpt,
          fridgeFreeOption: curFree,
          fridgeNicheHeight: String(nh)
        });

        if(curOpt === 'zabudowa'){
          // ilość przegród technicznych liczona jak w zmywarce: od dolnego frontu (wys. dołu - nóżki)
          const bottomFrontH = Math.max(0, bh - leg);
          const div = (bottomFrontH > 74.5)
            ? Math.max(0, Math.ceil(((bottomFrontH - 74.5) / 2) - 1e-9))
            : 0;

          draft.details = Object.assign({}, draft.details, { techDividerCount: String(div) });

          // wysokość słupka lodówkowego: nisza + (przegrody * 1.8) + 3.6 + nóżki
          draft.height = nh + (div * 1.8) + 3.6 + leg;
          return;
        }

        // wolnostojąca: auto-wymiary zależnie od opcji
        if(curFree === 'podest'){
          draft.width = 60;
          draft.depth = 60;
          draft.height = 3.6 + leg;
        } else if(curFree === 'obudowa'){
          draft.width = 65;
          draft.depth = 59.2;
          draft.height = 207;
        }
      }

      function toggleFridgeUI(){
        const o = (draft.details && draft.details.fridgeOption) ? draft.details.fridgeOption : fo.value;
        const isBuiltIn = (o === 'zabudowa');
        nicheWrap.style.display = isBuiltIn ? 'block' : 'none';
        freeWrap.style.display = isBuiltIn ? 'none' : 'block';
      }

      fo.addEventListener('change', e => {
        draft.details = Object.assign({}, draft.details || {}, { fridgeOption: e.target.value });
        applyFridgeDims();
        // dla zmiany typu nie tracimy danych, ale aktualizujemy UI
        renderCabinetModal();
      });

      fn.addEventListener('change', e => {
        draft.details = Object.assign({}, draft.details || {}, { fridgeNicheHeight: e.target.value });
        applyFridgeDims();
        // odświeżamy wartości pól
        renderCabinetModal();
      });

      fw.addEventListener('change', e => {
        draft.details = Object.assign({}, draft.details || {}, { fridgeFreeOption: e.target.value });
        applyFridgeDims();
        renderCabinetModal();
      });

      container.appendChild(grid);

      // FRONTY lodówkowej: 1 lub 2 (tylko zabudowa)
      const builtInNow = (opt === 'zabudowa');
      if(builtInNow){
        addSelect('Fronty lodówki (zabudowa)', 'fridgeFrontCount', [
          {v:'1', t:'1 duży front'},
          {v:'2', t:'2 fronty (dolny + górny)'}
        ]);
      }

      toggleFridgeUI();
      // ustaw wysokość przy wejściu (zabudowa)
      draft.details = Object.assign({}, draft.details || {}, {
        fridgeOption: opt,
        fridgeNicheHeight: niche,
        fridgeFreeOption: freeOpt
      });
      applyFridgeDims();
    }
    if(st === 'piekarnikowa'){
      addSelect('Opcja piekarnika', 'ovenOption', [
        {v:'szuflada_dol', t:'Szuflada na dole'},
        {v:'szuflada_gora', t:'Szuflada na górze'},
        {v:'klapka_dol', t:'Klapka na dole'},
        {v:'klapka_gora', t:'Klapka na górze'}
      ], () => {
        draft.frontCount = 1;
      });
      addNumber('Wysokość piekarnika (cm)', 'ovenHeight', 60);
      addNumber('Przegroda techniczna (szt)', 'techShelfCount', 1);
      const oo = String((draft.details && draft.details.ovenOption) ? draft.details.ovenOption : 'szuflada_dol');
      if(oo.indexOf('szuflada') !== -1){
        if(!draft.details.drawerSystem) draft.details.drawerSystem = 'skrzynkowe';
        if(!draft.details.drawerBrand) draft.details.drawerBrand = 'blum';
        if(!draft.details.drawerModel) draft.details.drawerModel = 'tandembox';

        addSelect('Typ szuflady (piekarnikowa)', 'drawerSystem', [
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'systemowe', t:'Systemowe'}
        ], ()=>{ renderCabinetModal(); });

        const ds2 = String(draft.details.drawerSystem || 'skrzynkowe');
        if(ds2 === 'systemowe'){
          addSelect('Firma systemu', 'drawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ renderCabinetModal(); });

          const br = String(draft.details.drawerBrand || 'blum');
          if(br === 'blum'){
            addSelect('Typ szuflady BLUM', 'drawerModel', [
              {v:'tandembox', t:'TANDEMBOX (domyślnie)'},
              {v:'legrabox', t:'LEGRABOX'},
              {v:'merivobox', t:'MERIVOBOX'},
              {v:'metabox', t:'METABOX'}
            ]);
          } else {
            const warn = document.createElement('div');
            warn.className = 'muted xs';
            warn.style.marginTop = '6px';
            warn.textContent = 'GTV/Rejs – w budowie. Nie można zatwierdzić.';
            container.appendChild(warn);
          }
        }
      }
    }
    if(['standardowa','rogowa_slepa','narozna_l'].includes(st)){
      if(st !== 'standardowa'){
        const opt = (st === 'narozna_l') ? {v:'karuzela', t:'Karuzela'} : {v:'magic_corner', t:'Magic Corner'};
        if(st === 'rogowa_slepa') addNumber('Część zaślepiona (cm)', 'blindPart', 30);
        addSelect('System narożny', 'cornerOption', [
          {v:'polki', t:'Półki'},
          opt
        ], () => {
          if(st === 'rogowa_slepa' && (draft.details?.cornerOption || 'polki') === 'magic_corner'){
            draft.frontCount = 1;
          }
        });
      }
      const corner = d.cornerOption ? d.cornerOption : 'polki';

      // STANDARDOWA: wnętrze półki lub szuflady wewnętrzne
      if(st === 'standardowa'){
        if(!d.insideMode) d.insideMode = 'polki';
        if(!d.innerDrawerCount) d.innerDrawerCount = '1';
        if(!d.innerDrawerType) d.innerDrawerType = 'blum';

        addSelect('Wnętrze', 'insideMode', [
          {v:'polki', t:'Półki'},
          {v:'szuflady_wew', t:'Szuflady wewnętrzne'}
        ], (val)=>{
          // utrzymuj spójne dane: jeśli wybierasz szuflady wew., półki powinny być 0 (żeby nie mieszać w szczegółach)
          const dv = FC.utils.isPlainObject(draft.details) ? draft.details : {};
          if(String(val) === 'szuflady_wew'){
            dv.shelves = 0;
            if(!dv.innerDrawerCount) dv.innerDrawerCount = '1';
            if(!dv.innerDrawerType) dv.innerDrawerType = 'blum';
          } else {
            // półki
            if(dv.shelves == null || dv.shelves === '' || Number(dv.shelves) <= 0) dv.shelves = 1;
          }
          draft.details = dv;
        });

        const inside = (draft.details && draft.details.insideMode) ? draft.details.insideMode : 'polki';
        if(inside === 'polki'){
          addNumber('Ilość półek', 'shelves', 1);
        } else {
          addNumber('Ilość szuflad wewnętrznych', 'innerDrawerCount', 1);
          addSelect('Typ szuflad wewnętrznych', 'innerDrawerType', [
            {v:'skrzynkowe', t:'Skrzynkowe'},
            {v:'blum', t:'Systemowe BLUM'}
          ]);
        }
      } else if(corner === 'polki'){
        addNumber('Ilość półek', 'shelves', 1);
      }
    }
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

const isFlapDraft = ((draft.type === 'wisząca' || draft.type === 'moduł') && draft.subType === 'uchylne');

const BLUM_KINDS = [
  { v:'HKI', t:'HKI – zintegrowany' },
  { v:'HF_top', t:'HF top – składany (2 fronty)' },
  { v:'HS_top', t:'HS top – uchylno‑nachodzący' },
  { v:'HL_top', t:'HL top – podnoszony ponad korpus' },
  { v:'HK_top', t:'HK top – uchylny' },
  { v:'HK-S', t:'HK‑S – mały uchylny' },
  { v:'HK-XS', t:'HK‑XS – mały uchylny (z zawiasami)' }
];
const HAFELE_KINDS = [
  { v:'DUO', t:'Rozwórka nożycowa DUO.' }
];

function syncFlapUI(){
  // UI dla klap (uchylne) tylko dla: wisząca + uchylne
  if(!isFlapDraft){
    if(flapWrap) flapWrap.style.display = 'none';
    return;
  }
  if(flapWrap) flapWrap.style.display = 'block';

  const d = FC.utils.isPlainObject(draft.details) ? draft.details : {};
  let vendor = String(d.flapVendor || 'blum');
  if(!['blum','gtv','hafele'].includes(vendor)) vendor = 'blum';
  d.flapVendor = vendor;

  // vendor select
  if(flapVendorSel){
    flapVendorSel.value = vendor;
    flapVendorSel.onchange = () => {
      const dv = FC.utils.isPlainObject(draft.details) ? draft.details : {};
      const v = String(flapVendorSel.value || 'blum');
      dv.flapVendor = (['blum','gtv','hafele'].includes(v) ? v : 'blum');

      // domyślne rodzaje po zmianie firmy
      if(dv.flapVendor === 'hafele') dv.flapKind = 'DUO';
      else if(dv.flapVendor === 'gtv') dv.flapKind = '';
      else dv.flapKind = 'HKI';

      draft.details = dv;
      ensureFrontCountRulesSafe(draft);
      renderCabinetModal();
    };
  }

  // vendor specific UI
  if(vendor === 'gtv'){
    if(flapKindWrap) flapKindWrap.style.display = 'none';
    if(flapInfo){
      flapInfo.style.display = 'block';
      flapInfo.textContent = 'GTV – w budowie.';
    }
    draft.details = d;
    ensureFrontCountRulesSafe(draft);
    return;
  }

  if(flapInfo) flapInfo.style.display = 'none';
  if(flapKindWrap) flapKindWrap.style.display = 'block';

  const kindOptions = (vendor === 'hafele') ? HAFELE_KINDS : BLUM_KINDS;
  const defaultKind = (vendor === 'hafele') ? 'DUO' : 'HKI';
  const selectedKind = String(d.flapKind || defaultKind);
  d.flapKind = selectedKind;

  if(flapKindSel){
    populateSelect(flapKindSel, kindOptions, selectedKind);
    flapKindSel.onchange = () => {
      const dv = FC.utils.isPlainObject(draft.details) ? draft.details : {};
      dv.flapKind = String(flapKindSel.value || defaultKind);
      draft.details = dv;
      ensureFrontCountRulesSafe(draft);
      renderCabinetModal();
    };
  }

  draft.details = d;
  ensureFrontCountRulesSafe(draft);
}

  // Podblatowa (wisząca dolna): pozwól na brak frontów oraz rozróżnij drzwi vs szuflady
  const isPodblatowaDraft = (draft.type === 'wisząca' && draft.subType === 'dolna_podblatowa');
  const fcLabelEl = document.getElementById('cmFrontCountLabel');
  const setFcOptions = (arr) => {
    fcSel.innerHTML = arr.map(n => `<option value="${n}">${n}</option>`).join('');
  };

  if(isPodblatowaDraft){
    const d = draft.details || {};
    // domyślne wartości + kompatybilność wstecz
    if(!d.podFrontMode){
      if(d.subTypeOption === 'szuflada_1'){ d.podFrontMode = 'szuflady'; draft.frontCount = 1; }
      else if(d.subTypeOption === 'szuflada_2'){ d.podFrontMode = 'szuflady'; draft.frontCount = 2; }
      else d.podFrontMode = (Number(draft.frontCount) === 0 ? 'brak' : 'drzwi');
      draft.details = Object.assign({}, d, { podFrontMode: d.podFrontMode });
    }
    if(fcLabelEl){
      fcLabelEl.textContent = (d.podFrontMode === 'szuflady') ? 'Ilość szuflad' : 'Ilość frontów';
    }
    if(d.podFrontMode === 'brak'){
      setFcOptions([0]);
      draft.frontCount = 0;
      fcSel.disabled = true;
      if(fcHint) fcHint.textContent = 'Otwarta szafka (bez frontów).';
    } else {
      setFcOptions([1,2]);
      if(![1,2].includes(Number(draft.frontCount))) draft.frontCount = 2;
      fcSel.disabled = false;
      if(fcHint) fcHint.textContent = (d.podFrontMode === 'szuflady') ? 'Ilość szuflad = ilość frontów szuflad.' : 'Ilość drzwi/frontów.';
    }
  } else {
    // standardowe opcje: 1 lub 2 fronty
    if(fcLabelEl) fcLabelEl.textContent = 'Ilość frontów';
    setFcOptions([1,2]);
  }

  ensureFrontCountRulesSafe(draft);
  syncFlapUI();

  // Domyślnie pokazuj select, a statyczne info ukrywaj (wyjątek: klapy)
  if(fcSel) fcSel.style.display = '';
  if(fcStatic){
    fcStatic.style.display = 'none';
    fcStatic.textContent = '';
  }

  // czy pokazujemy wybór 1/2?
  const canPick = cabinetAllowsFrontCountSafe(draft);
  const fixedOne = (draft.type === 'stojąca' && (draft.subType === 'zmywarkowa' || draft.subType === 'piekarnikowa' || (draft.subType === 'rogowa_slepa' && (draft.details?.cornerOption||'polki') === 'magic_corner'))) || (draft.type === 'stojąca' && draft.subType === 'zlewowa' && (draft.details?.sinkFront||'drzwi') === 'szuflada');
  const isFridge = (draft.type === 'stojąca' && draft.subType === 'lodowkowa');

  // lodówkowa w zabudowie — zamiast frontCount używamy details.fridgeFrontCount (1/2)
  const isCornerL = (draft.subType === 'narozna_l');

  if(isFridge){
    // frontCount select ukrywamy (bo fronty lodówki wybiera się w szczegółach lodówki)
    if(fcWrap) fcWrap.style.display = 'none';
    fcHint.style.display = 'none';
    if(shelvesWrap) shelvesWrap.style.display = 'none';
  } else if(isCornerL){
    // narożna L: zawsze 2 fronty, zamiast wyboru frontów pokazujemy ilość półek
    draft.frontCount = 2;

    if(fcWrap) fcWrap.style.display = 'none';
    fcHint.style.display = 'none';

    if(shelvesWrap){
      shelvesWrap.style.display = 'block';
      const d = FC.utils.isPlainObject(draft.details) ? draft.details : {};
      const sh = (d.shelves == null ? 2 : Number(d.shelves));
      draft.details = Object.assign({}, d, { shelves: Math.max(0, Math.round(Number.isFinite(sh) ? sh : 0)) });

      if(shelvesInput){
        shelvesInput.value = String(draft.details.shelves);
        const onShelvesChange = () => {
          const v = Math.max(0, Math.round(Number(shelvesInput.value) || 0));
          draft.details = Object.assign({}, draft.details || {}, { shelves: v });
          shelvesInput.value = String(v);
        };
        shelvesInput.oninput = onShelvesChange;
        shelvesInput.onchange = onShelvesChange;
      }
    }
  } else if(isFlapDraft){
    // Klapa: ilość frontów jest automatyczna (1 lub 2 zależnie od rodzaju)
    // Półki: użytkownik może wpisać (do wyceny i rozrysu)
    if(shelvesWrap) shelvesWrap.style.display = 'block';
    if(!draft.details) draft.details = {};
    if(draft.details.shelves === undefined || draft.details.shelves === null) draft.details.shelves = 0;
    if(shelvesInput){
      shelvesInput.value = String(Math.max(0, Math.round(Number(draft.details.shelves) || 0)));
      const onShelvesChange = () => {
        const v = Math.max(0, Math.round(Number(shelvesInput.value) || 0));
        draft.details = Object.assign({}, draft.details || {}, { shelves: v });
        shelvesInput.value = String(v);
      };
      shelvesInput.oninput = onShelvesChange;
      shelvesInput.onchange = onShelvesChange;
    }


    const fcAuto = getFlapFrontCountSafe(draft);
    // dla klap ilość frontów jest automatyczna i pokazujemy ją pod wyborem podnośnika
    if(fcWrap) fcWrap.style.display = 'none';
    if(fcSel){
      fcSel.style.display = 'none';
      fcSel.innerHTML = `<option value="${fcAuto}">${fcAuto}</option>`;
      fcSel.value = String(fcAuto);
      fcSel.disabled = true;
    }
    if(fcStatic) fcStatic.style.display = 'none';
    if(fcHint) fcHint.style.display = 'none';
    if(flapFrontInfo){
      flapFrontInfo.style.display = 'inline-block';
      flapFrontInfo.textContent = `Ilość frontów: ${fcAuto}` + ((fcAuto === 2) ? ' (HF top)' : '');
    }
  } else if(!canPick){
    if(fcWrap) fcWrap.style.display = 'none';
    fcHint.style.display = 'none';
    if(shelvesWrap) shelvesWrap.style.display = 'none';
  } else if(fixedOne){
    if(fcWrap) fcWrap.style.display = 'block';
    if(shelvesWrap) shelvesWrap.style.display = 'none';

    fcSel.value = '1';
    fcSel.disabled = true;
    fcHint.style.display = 'block';
    fcHint.textContent = 'Dla tej szafki ilość frontów jest stała: 1.';
  } else {
    if(fcWrap) fcWrap.style.display = 'block';
    if(shelvesWrap) shelvesWrap.style.display = 'none';

    const podBrak = (isPodblatowaDraft && draft.details && draft.details.podFrontMode === 'brak');
    fcSel.disabled = podBrak ? true : false;
    const fcVal = (draft.frontCount === 0 ? 0 : (draft.frontCount || 2));
    fcSel.value = String(fcVal);
    if(podBrak){
      fcHint.style.display = 'block';
      fcHint.textContent = 'Otwarta szafka (bez frontów).';
    } else {
      fcHint.style.display = 'none';
    }
  }

  cmSubType.onchange = () => {
    applySubTypeRulesSafe(room, draft, cmSubType.value);
ensureFrontCountRulesSafe(draft);

// Moduł → Uchylna: wymuś tryb klapy i wyczyść ewentualne dane po szufladach
if(draft.type === 'moduł' && cmSubType.value === 'uchylne'){
  draft.subType = 'uchylne';
  draft.details = FC.utils.isPlainObject(draft.details) ? draft.details : {};
  // fronty dla klapy wynikają z rodzaju podnośnika (HF top = 2)
  draft.frontCount = getFlapFrontCountSafe(draft);
}

// zmywarkowa: szerokość szafki = szerokość zmywarki + przegrody techniczne dla wysokich frontów
if(draft.type === 'stojąca' && draft.subType === 'zmywarkowa'){
  const leg = Number(projectData[room]?.settings?.legHeight) || 0;
  const dw = (draft.details && draft.details.dishWasherWidth) ? draft.details.dishWasherWidth : (String(draft.width || '60'));
  draft.details = Object.assign({}, draft.details || {}, { dishWasherWidth: dw });
  draft.width = Number(dw) || 60;

  const frontH = (Number(draft.height) || 0) - leg;
  // Przegroda techniczna: 74.6–76.5 => 1; 76.6–78.5 => 2; itd.
  const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
  draft.details = Object.assign({}, draft.details, { techDividerCount: String(div) });
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


