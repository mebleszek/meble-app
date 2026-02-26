// js/app/modals/cabinet.js
// Cabinet modal logic extracted from app.js
(function(){
  'use strict';
  window.FC = window.FC || {};
function syncDraftFromCabinetModalForm(d){
  if(!d) return;
  const num = (id) => {
    const el = document.getElementById(id);
    if(!el) return null;
    const raw = String(el.value ?? '').trim().replace(',', '.');
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const str = (id) => {
    const el = document.getElementById(id);
    if(!el) return null;
    const v = String(el.value ?? '').trim();
    return v;
  };

  const w = num('cmWidth');  if(w !== null) d.width = w;
  const h = num('cmHeight'); if(h !== null) d.height = h;
  const dep = num('cmDepth'); if(dep !== null) d.depth = dep;

  const fc = num('cmFrontCount'); // może nie istnieć (np. klapa/narożna L)
  if(fc !== null) d.frontCount = fc;

  // półki
  // UWAGA: cmShelves istnieje w DOM zawsze (ukryty wrap), ale nie każda szafka używa tego pola.
  // Żeby nie nadpisywać wartości ustawianych w dynamicznych polach (np. Moduł→Standardowa),
  // czytamy cmShelves tylko wtedy, gdy jego wrap jest widoczny.
  const shWrap = document.getElementById('cmShelvesWrap');
  const shWrapVisible = !!(shWrap && shWrap.style.display !== 'none' && shWrap.offsetParent !== null);
  if(shWrapVisible){
    const sh = num('cmShelves');
    if(sh !== null){
      // store as integer number for consistency across cabinet types
      d.details = Object.assign({}, d.details || {}, { shelves: Math.max(0, Math.round(sh)) });
    }
  }

  // narożna L (GL/GP/ST/SP)
  const gl = num('cmGL'), gp = num('cmGP'), st = num('cmST'), sp = num('cmSP');
  if([gl,gp,st,sp].some(v => v !== null)){
    d.details = Object.assign({}, d.details || {}, {
      gl: gl !== null ? String(gl) : (d.details?.gl ?? ''),
      gp: gp !== null ? String(gp) : (d.details?.gp ?? ''),
      st: st !== null ? String(st) : (d.details?.st ?? ''),
      sp: sp !== null ? String(sp) : (d.details?.sp ?? '')
    });
    // pomocniczo: szerokość=ST, głębokość=max(GL,GP) – tak jak w sync narożnej
    if(st !== null) d.width = st;
    if(gl !== null || gp !== null) d.depth = Math.max(gl ?? 0, gp ?? 0);
  }

  // klapa (uchylne)
  const flapVendor = str('cmFlapVendor');
  const flapKind = str('cmFlapKind');
  if((d.type === 'wisząca' || d.type === 'moduł') && d.subType === 'uchylne'){
    const det = Object.assign({}, d.details || {});
    if(flapVendor) det.flapVendor = flapVendor;
    if(flapKind) det.flapKind = flapKind;
    d.details = det;
  }
}

function openCabinetModalForAdd(){
  cabinetModalState.mode = 'add';
  cabinetModalState.editingId = null;
  cabinetModalState.setEditId = null;
  cabinetModalState.chosen = null;
  cabinetModalState.setPreset = null;
  cabinetModalState.draft = makeDefaultCabinetDraftForRoom(uiState.roomType);
  renderCabinetModal();
  document.getElementById('cabinetModal').style.display = 'flex';
  lockModalScroll();
}

function openCabinetModalForEdit(cabId){
  cabId = String(cabId);
  const room = uiState.roomType; if(!room) return;
  const cab = projectData[room].cabinets.find(c => String(c.id) === cabId);
  if(!cab) return;

  if(cab.setId){
    openSetWizardForEdit(cab.setId);
    return;
  }

  cabinetModalState.mode = 'edit';
  cabinetModalState.editingId = cabId;
  cabinetModalState.setEditId = null;
  cabinetModalState.chosen = cab.type;
  cabinetModalState.setPreset = null;
  cabinetModalState.draft = FC.utils.clone(cab);
  renderCabinetModal();
  document.getElementById('cabinetModal').style.display = 'flex';
  lockModalScroll();
}

function closeCabinetModal(){
  unlockModalScroll();
  document.getElementById('cabinetModal').style.display = 'none';
}

function renderCabinetModal(){
  const isSetEdit = !!cabinetModalState.setEditId;

  // Zatwierdź w nagłówku: widoczne tylko gdy pokazujemy formularz szafki (nie przy wyborze typu i nie w zestawie)
  const saveTopBtn = document.getElementById('cabinetModalSave');
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
    setArea.style.display = 'block';
    renderSetTiles();

    // W trybie zestawu pokaż \"Zatwierdź\" w nagłówku (działa jak Dodaj zestaw / Zapisz zmiany)
    if(saveTopBtn){
      const _btn = document.getElementById('setWizardCreate');
      saveTopBtn.style.display = 'inline-flex';
      saveTopBtn.disabled = false;
      saveTopBtn.textContent = _btn ? _btn.textContent : (isSetEdit ? 'Zapisz zmiany' : 'Dodaj zestaw');
    }

    if(isSetEdit){
      document.querySelectorAll('#setTiles .mini-tile').forEach(tile=>{
        tile.style.pointerEvents = 'none';
        tile.style.opacity = '0.8';
      });
      document.getElementById('setWizardCreate').textContent = 'Zapisz zmiany';
      document.getElementById('setWizardTitle').textContent = 'Zestaw (edycja)';
      document.getElementById('setWizardDesc').textContent = 'Zmieniasz parametry zestawu. Program przeliczy korpusy i fronty.';
    } else {
      document.getElementById('setWizardCreate').textContent = 'Dodaj zestaw';
      document.getElementById('setWizardTitle').textContent = 'Zestaw';
      document.getElementById('setWizardDesc').textContent = 'Wybierz standardowy układ. Program doda kilka korpusów oraz fronty.';
    }

    const hasPreset = !!cabinetModalState.setPreset;
    renderSetParamsUI(cabinetModalState.setPreset);
    document.getElementById('setParams').style.display = hasPreset ? 'grid' : 'none';

    const frontBlock = document.getElementById('setFrontBlock');
    frontBlock.style.display = hasPreset ? 'block' : 'none';

    if(hasPreset){
      const cntSel = document.getElementById('setFrontCount');
      const matSel = document.getElementById('setFrontMaterial');
      const colSel = document.getElementById('setFrontColor');

      if(!cntSel.value) cntSel.value = '2';
      if(!matSel.value) matSel.value = 'laminat';
      populateFrontColorsTo(colSel, matSel.value, colSel.value || '');

      matSel.onchange = () => { populateFrontColorsTo(colSel, matSel.value, ''); };

      const hint = document.getElementById('setFrontHint');
      const updateHint = () => {
        const c = Number(cntSel.value || 1);
        if(c === 1){
          hint.textContent = 'Powstanie 1 front (na całą szerokość zestawu) o wysokości sumy segmentów.';
        } else {
          hint.textContent = 'Powstaną 2 fronty. Dla zestawu A: lewy/prawy. Dla pionów: po 1/2 szerokości każdy.';
        }
      };
      cntSel.onchange = updateHint;
      updateHint();
    }

    return;
  }

  if(!cabinetModalState.chosen) return;

  formArea.style.display = 'block';

  if(saveTopBtn){
    saveTopBtn.style.display = 'inline-flex';
    saveTopBtn.disabled = false;
  }

  // pokazujemy Zatwierdź w nagłówku dopiero gdy jest formularz
  if(saveTopBtn){
    saveTopBtn.style.display = 'inline-flex';
    saveTopBtn.disabled = false;
  }

  const draft = cabinetModalState.draft;
  const room = uiState.roomType;

  // Rodzaj z kafelka
  draft.type = cabinetModalState.chosen;

  const cmSubType = document.getElementById('cmSubType');
  populateSelect(cmSubType, getSubTypeOptionsForType(draft.type), draft.subType);

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
      ensureFrontCountRules(draft);
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
    ensureFrontCountRules(draft);
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
      ensureFrontCountRules(draft);
      renderCabinetModal();
    };
  }

  draft.details = d;
  ensureFrontCountRules(draft);
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

  ensureFrontCountRules(draft);
  syncFlapUI();

  // Domyślnie pokazuj select, a statyczne info ukrywaj (wyjątek: klapy)
  if(fcSel) fcSel.style.display = '';
  if(fcStatic){
    fcStatic.style.display = 'none';
    fcStatic.textContent = '';
  }

  // czy pokazujemy wybór 1/2?
  const canPick = cabinetAllowsFrontCount(draft);
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


    const fcAuto = getFlapFrontCount(draft);
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
    applySubTypeRules(room, draft, cmSubType.value);
ensureFrontCountRules(draft);

// Moduł → Uchylna: wymuś tryb klapy i wyczyść ewentualne dane po szufladach
if(draft.type === 'moduł' && cmSubType.value === 'uchylne'){
  draft.subType = 'uchylne';
  draft.details = FC.utils.isPlainObject(draft.details) ? draft.details : {};
  // fronty dla klapy wynikają z rodzaju podnośnika (HF top = 2)
  draft.frontCount = getFlapFrontCount(draft);
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
      syncDraftFromCabinetModalForm(draft);
      ensureFrontCountRules(draft);

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
      if(_drawerBlockMsg){ alert(_drawerBlockMsg); return; }
      applyAventosValidationUI(room, draft);
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

  const _cabCancel = document.getElementById('cabinetModalCancel');
  if(_cabCancel) _cabCancel.onclick = closeCabinetModal;
  document.getElementById('cabinetModalSave').onclick = (e) => {
    // twarde zabezpieczenie: żadnego "przebicia" kliknięcia do innych handlerów
    if(e){ e.preventDefault(); e.stopPropagation(); }

    // Tryb zestawu: Zatwierdź działa jak "Dodaj zestaw / Zapisz zmiany"
    const _setArea = document.getElementById('setWizardArea');
    const inSetMode = (cabinetModalState && cabinetModalState.chosen === 'zestaw') ||
                      (cabinetModalState && cabinetModalState.setEditId) ||
                      (_setArea && _setArea.style.display === 'block');
    if(inSetMode){
      try{
        createOrUpdateSetFromWizard();
      } catch(err){
        console.error(err);
        alert('Błąd zapisu zestawu: ' + (err && (err.message || err) ? (err.message || err) : 'nieznany błąd'));
      }
      return;
    }
    try{
      if(!uiState.roomType){ alert('Wybierz pomieszczenie'); return; }
      const room = uiState.roomType;

      syncDraftFromCabinetModalForm(draft);
      ensureFrontCountRules(draft);

      // Walidacja podnośników (AVENTOS) na etapie zapisu – jeśli poza zakresem, nie dodawaj/nie zapisuj
      const _av = validateAventosForDraft(room, draft);
      if(_av && _av.ok === false){
        applyAventosValidationUI(room, draft);
        return;
      }

      const beforeCount = (projectData[room].cabinets || []).length;

      const isAdd = (cabinetModalState.mode === 'add' || !cabinetModalState.editingId);
      if(isAdd){
        const newCab = FC.utils.clone(draft);
        newCab.id = FC.utils.uid();
        projectData[room].cabinets.push(newCab);
        uiState.expanded = {};
        // domyślnie zwinięte
        
        uiState.selectedCabinetId = newCab.id;

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
        alert('Nie udało się dodać szafki (błąd logiki zapisu).');
        return;
      }

      closeCabinetModal();
    }catch(err){
      console.error('Błąd zapisu szafki:', err);
      alert('Błąd podczas zapisu (sprawdź konsolę). Modal pozostaje otwarty.');
    }
  };

  // Walidacja klapy (AVENTOS) – blokuj zapis jeśli poza zakresem
  applyAventosValidationUI(room, draft);
}

  // Export to global (app.js expects these names)
  window.syncDraftFromCabinetModalForm = syncDraftFromCabinetModalForm;
  window.openCabinetModalForAdd = openCabinetModalForAdd;
  window.openCabinetModalForEdit = openCabinetModalForEdit;
  window.closeCabinetModal = closeCabinetModal;
  window.renderCabinetModal = renderCabinetModal;
})();
