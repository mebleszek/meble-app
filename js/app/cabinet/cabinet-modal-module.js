(function(){
  const ns = (window.FC = window.FC || {});

  function renderDrawerExtras(ctx){
    const container = ctx.container;
    const draft = ctx.draft;
    const d = ctx.details;
    const addSelect = ctx.addSelect;
    const renderCabinetModal = ctx.renderCabinetModal;

    if(!d.drawerLayout){
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
      const lay = String(draft.details?.drawerLayout || '3_1_2_2');
      if(lay === '5_equal') draft.details = Object.assign({}, draft.details || {}, { innerDrawerType: 'brak', innerDrawerCount: '0' });
      else if(lay === '3_equal'){
        if(String(draft.details?.innerDrawerCount || '') === '0' || !draft.details?.innerDrawerCount) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: '3' });
      } else {
        if(String(draft.details?.innerDrawerCount || '') === '0' || !draft.details?.innerDrawerCount) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: '2' });
      }
      renderCabinetModal();
    });

    draft.details = Object.assign({}, draft.details || {});
    if(!draft.details.drawerSystem || !['skrzynkowe','systemowe'].includes(String(draft.details.drawerSystem))) draft.details.drawerSystem = 'skrzynkowe';
    if(!draft.details.innerDrawerType) draft.details.innerDrawerType = 'brak';
    if(draft.details.innerDrawerType === 'brak') draft.details.innerDrawerCount = '0';
    else if(!draft.details.innerDrawerCount) draft.details.innerDrawerCount = '2';

    addSelect('Typ szuflad (frontowych)', 'drawerSystem', [{v:'skrzynkowe', t:'Skrzynkowe'},{v:'systemowe', t:'Systemowe'}], ()=>{ renderCabinetModal(); });
    const ds = String((draft.details && draft.details.drawerSystem) ? draft.details.drawerSystem : 'skrzynkowe');
    if(ds === 'systemowe'){
      if(!draft.details.drawerBrand) draft.details.drawerBrand = 'blum';
      if(draft.details.drawerBrand === 'blum' && !draft.details.drawerModel) draft.details.drawerModel = 'tandembox';
      addSelect('Firma systemu', 'drawerBrand', [{v:'blum', t:'BLUM'},{v:'gtv', t:'GTV'},{v:'rejs', t:'Rejs'}], ()=>{ renderCabinetModal(); });
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
        const div = document.createElement('div');
        div.style.marginBottom='10px';
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
      } else {
        const cur = parseInt(d.innerDrawerCount, 10);
        if(!Number.isFinite(cur) || cur <= 0) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: String(def) });
      }
    }
  }

  function renderExtraDetails(ctx){
    const st = ctx.subType;
    if(st === 'szuflady') renderDrawerExtras(ctx);
    return true;
  }

  function configureFlapUi(ctx){
    const draft = ctx.draft;
    const flapWrap = ctx.flapWrap;
    const flapVendorSel = ctx.flapVendorSel;
    const flapKindWrap = ctx.flapKindWrap;
    const flapKindSel = ctx.flapKindSel;
    const flapInfo = ctx.flapInfo;
    const isFlapDraft = (draft.subType === 'uchylne');
    const BLUM_KINDS = [
      { v:'HKI', t:'HKI – zintegrowany' },
      { v:'HF_top', t:'HF top – składany (2 fronty)' },
      { v:'HS_top', t:'HS top – uchylno‑nachodzący' },
      { v:'HL_top', t:'HL top – podnoszony ponad korpus' },
      { v:'HK_top', t:'HK top – uchylny' },
      { v:'HK-S', t:'HK‑S – mały uchylny' },
      { v:'HK-XS', t:'HK‑XS – mały uchylny (z zawiasami)' }
    ];
    const HAFELE_KINDS = [{ v:'DUO', t:'Rozwórka nożycowa DUO.' }];
    if(!isFlapDraft){ if(flapWrap) flapWrap.style.display = 'none'; return false; }
    if(flapWrap) flapWrap.style.display = 'block';
    const d = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
      ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
      : (draft.details && typeof draft.details === 'object' ? draft.details : {});
    let vendor = String(d.flapVendor || 'blum');
    if(!['blum','gtv','hafele'].includes(vendor)) vendor = 'blum';
    d.flapVendor = vendor;
    if(flapVendorSel){
      flapVendorSel.value = vendor;
      flapVendorSel.onchange = () => {
        const dv = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
          ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
          : (draft.details && typeof draft.details === 'object' ? draft.details : {});
        const v = String(flapVendorSel.value || 'blum');
        dv.flapVendor = (['blum','gtv','hafele'].includes(v) ? v : 'blum');
        if(dv.flapVendor === 'hafele') dv.flapKind = 'DUO';
        else if(dv.flapVendor === 'gtv') dv.flapKind = '';
        else dv.flapKind = 'HKI';
        draft.details = dv;
        ctx.ensureFrontCountRulesSafe(draft);
        ctx.renderCabinetModal();
      };
    }
    if(vendor === 'gtv'){
      if(flapKindWrap) flapKindWrap.style.display = 'none';
      if(flapInfo){ flapInfo.style.display = 'block'; flapInfo.textContent = 'GTV – w budowie.'; }
      draft.details = d;
      ctx.ensureFrontCountRulesSafe(draft);
      return true;
    }
    if(flapInfo) flapInfo.style.display = 'none';
    if(flapKindWrap) flapKindWrap.style.display = 'block';
    const kindOptions = (vendor === 'hafele') ? HAFELE_KINDS : BLUM_KINDS;
    const defaultKind = (vendor === 'hafele') ? 'DUO' : 'HKI';
    const selectedKind = String(d.flapKind || defaultKind);
    d.flapKind = selectedKind;
    if(flapKindSel){
      ctx.populateSelect(flapKindSel, kindOptions, selectedKind);
      flapKindSel.onchange = () => {
        const dv = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
          ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
          : (draft.details && typeof draft.details === 'object' ? draft.details : {});
        dv.flapKind = String(flapKindSel.value || defaultKind);
        draft.details = dv;
        ctx.ensureFrontCountRulesSafe(draft);
        ctx.renderCabinetModal();
      };
    }
    draft.details = d;
    ctx.ensureFrontCountRulesSafe(draft);
    return true;
  }

  function configureFrontControls(ctx){
    const draft = ctx.draft;
    const fcSel = ctx.fcSel;
    const fcStatic = ctx.fcStatic;
    const fcHint = ctx.fcHint;
    const fcWrap = ctx.fcWrap;
    const shelvesWrap = ctx.shelvesWrap;
    const shelvesInput = ctx.shelvesInput;
    const flapFrontInfo = ctx.flapFrontInfo;
    const setFcOptions = (arr) => { fcSel.innerHTML = arr.map(n => `<option value="${n}">${n}</option>`).join(''); };

    if(ctx.fcLabelEl) ctx.fcLabelEl.textContent = 'Ilość frontów';
    setFcOptions([1,2]);
    ctx.ensureFrontCountRulesSafe(draft);
    const flapActive = configureFlapUi(ctx);

    if(fcSel) fcSel.style.display = '';
    if(fcStatic){ fcStatic.style.display = 'none'; fcStatic.textContent = ''; }
    if(flapFrontInfo) flapFrontInfo.style.display = 'none';

    const canPick = ctx.cabinetAllowsFrontCountSafe(draft);
    if(flapActive){
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
      const fcAuto = ctx.getFlapFrontCountSafe(draft);
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
      return;
    }
    if(!canPick){
      if(fcWrap) fcWrap.style.display = 'none';
      if(fcHint) fcHint.style.display = 'none';
      if(shelvesWrap) shelvesWrap.style.display = 'none';
      return;
    }
    if(fcWrap) fcWrap.style.display = 'block';
    if(shelvesWrap) shelvesWrap.style.display = 'none';
    fcSel.disabled = false;
    fcSel.value = String(draft.frontCount === 0 ? 0 : (draft.frontCount || 2));
    if(fcHint) fcHint.style.display = 'none';
  }

  function afterSubTypeChange(ctx){
    const draft = ctx.draft;
    if(draft.subType === 'uchylne'){
      draft.subType = 'uchylne';
      draft.details = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
        ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
        : (draft.details && typeof draft.details === 'object' ? draft.details : {});
      draft.frontCount = ctx.getFlapFrontCountSafe(draft);
    }
  }

  ns.cabinetModalModule = {
    renderExtraDetails,
    configureFrontControls,
    afterSubTypeChange
  };
})();
