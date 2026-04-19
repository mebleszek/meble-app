(function(){
  const ns = (window.FC = window.FC || {});

  function renderCornerLExtraDetails(ctx){
    const container = ctx.container;
    const draft = ctx.draft;
    const d0 = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
      ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
      : (draft.details && typeof draft.details === 'object' ? draft.details : {});
    const defaults = {
      gl: (d0.gl != null ? d0.gl : '70'),
      gp: (d0.gp != null ? d0.gp : '36'),
      st: (d0.st != null ? d0.st : '60'),
      sp: (d0.sp != null ? d0.sp : '33'),
      shelves: (d0.shelves != null ? d0.shelves : 2),
      cornerFlip: (d0.cornerFlip != null ? d0.cornerFlip : false)
    };
    draft.details = Object.assign({}, d0, defaults);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
        <div><label>GL</label><input id="cmGL" type="number" step="0.1" /><div class="muted xs" style="margin-top:4px">Głębokość lewa (cm)</div></div>
        <div><label>GP</label><input id="cmGP" type="number" step="0.1" /><div class="muted xs" style="margin-top:4px">Głębokość prawa (cm)</div></div>
        <div><label>ST</label><input id="cmST" type="number" step="0.1" /><div class="muted xs" style="margin-top:4px">Szerokość tyłu (cm)</div></div>
        <div><label>SP</label><input id="cmSP" type="number" step="0.1" /><div class="muted xs" style="margin-top:4px">Szerokość przodu (cm)</div></div>
      </div>
      <div class="flex" style="margin-top:10px;justify-content:space-between;flex-wrap:wrap">
        <button id="flipCornerBtn" class="btn" type="button">Odwróć narożnik</button>
        <div id="cornerWarn" class="warn-orange xs"></div>
      </div>
      <div class="muted xs" style="margin-top:8px">Widok z góry. Fronty liczone: <b>FL = |GL−GP|</b> oraz <b>FP = |ST−SP−1,8|</b> (płyta 18&nbsp;mm).</div>
      <div style="margin-top:10px"><canvas id="cornerPreview" width="520" height="360" style="width:100%;max-width:520px;border:1px solid #ddd;border-radius:10px;"></canvas><div class="muted xs" id="cornerPreviewLegend" style="margin-top:6px"></div></div>
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

    const sync = () => {
      const GL = Number(iGL.value) || 0;
      const GP = Number(iGP.value) || 0;
      const ST = Number(iST.value) || 0;
      const SP = Number(iSP.value) || 0;
      const FL = Math.abs(GL - GP);
      const FP = Math.abs(ST - SP - 1.8);
      draft.details = Object.assign({}, draft.details || {}, { gl:String(GL), gp:String(GP), st:String(ST), sp:String(SP) });
      draft.width = ST;
      draft.depth = Math.max(GL, GP);
      const widthInput = document.getElementById('cmWidth');
      const depthInput = document.getElementById('cmDepth');
      if(widthInput) widthInput.value = String(draft.width);
      if(depthInput) depthInput.value = String(draft.depth);
      if(warnEl){
        const notes = [];
        if(FL < 15) notes.push(`FL ${FL.toFixed(1)} cm < 15 cm`);
        if(FP < 15) notes.push(`FP ${FP.toFixed(1)} cm < 15 cm`);
        warnEl.textContent = notes.length ? ('Uwaga: ' + notes.join(' · ')) : '';
      }
      try{
        const sketchApi = window.FC && window.FC.cornerSketch;
        if(sketchApi && typeof sketchApi.drawCornerSketch === 'function'){
          sketchApi.drawCornerSketch({ canvas: wrap.querySelector('#cornerPreview'), legendEl: wrap.querySelector('#cornerPreviewLegend'), GL, GP, ST, SP, flip: !!(draft.details && draft.details.cornerFlip) });
        }
      }catch(_){ }
    };
    [iGL, iGP, iST, iSP].forEach((el)=>{ if(!el) return; el.addEventListener('input', sync); el.addEventListener('change', sync); });
    if(flipBtn){
      flipBtn.addEventListener('click', ()=>{
        draft.details = Object.assign({}, draft.details || {}, { cornerFlip: !(draft.details && draft.details.cornerFlip) });
        sync();
      });
    }
    sync();
  }

  function renderExtraDetails(ctx){
    const draft = ctx.draft;
    const st = ctx.subType;
    const d = ctx.details;
    const addSelect = ctx.addSelect;
    const addNumber = ctx.addNumber;

    if(st === 'narozna_l') renderCornerLExtraDetails(ctx);

    if(st === 'dolna_podblatowa'){
      if(!d.podFrontMode){
        if(d.subTypeOption === 'szuflada_1'){ d.podFrontMode = 'szuflady'; ctx.cabinetModalState.draft.frontCount = 1; }
        else if(d.subTypeOption === 'szuflada_2'){ d.podFrontMode = 'szuflady'; ctx.cabinetModalState.draft.frontCount = 2; }
        else d.podFrontMode = (Number(ctx.cabinetModalState.draft.frontCount) === 0 ? 'brak' : 'drzwi');
      }
      if(!d.podInsideMode) d.podInsideMode = 'polki';
      if(!d.podInnerDrawerCount) d.podInnerDrawerCount = '1';
      addSelect('Front', 'podFrontMode', [
        {v:'brak', t:'Otwarta (brak frontów)'},
        {v:'drzwi', t:'Drzwi (fronty)'},
        {v:'szuflady', t:'Szuflady (zamiast drzwi)'}
      ], (val)=>{
        if(val === 'brak'){
          ctx.cabinetModalState.draft.frontCount = 0;
        } else {
          const fc = Number(ctx.cabinetModalState.draft.frontCount);
          if(![1,2].includes(fc)) ctx.cabinetModalState.draft.frontCount = 2;
        }
      });

      if(d.podFrontMode !== 'szuflady'){
        addSelect('Wnętrze', 'podInsideMode', [
          {v:'polki', t:'Półki'},
          {v:'szuflady_wewn', t:'Szuflady wewnętrzne'}
        ]);
        if(d.podInsideMode === 'polki') addNumber('Ilość półek', 'shelves', 2);
        else addSelect('Ilość szuflad wewnętrznych', 'podInnerDrawerCount', [{v:'1', t:'1'},{v:'2', t:'2'}]);
        if(!(draft.details && (draft.details.hasBack !== undefined))){
          draft.details = Object.assign({}, draft.details || {}, { hasBack: '1' });
        }
        addSelect('Plecy', 'hasBack', [{v:'1', t:'Tak'},{v:'0', t:'Nie'}]);
      }
      return true;
    }

    if(st === 'rogowa_slepa') addNumber('Część zaślepiona (cm)', 'blindPart', 30);
    if(st !== 'uchylne') addNumber('Ilość półek', 'shelves', 2);
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

    const isPodblatowaDraft = (draft.subType === 'dolna_podblatowa');
    if(isPodblatowaDraft){
      const d = draft.details || {};
      if(!d.podFrontMode){
        if(d.subTypeOption === 'szuflada_1'){ d.podFrontMode = 'szuflady'; draft.frontCount = 1; }
        else if(d.subTypeOption === 'szuflada_2'){ d.podFrontMode = 'szuflady'; draft.frontCount = 2; }
        else d.podFrontMode = (Number(draft.frontCount) === 0 ? 'brak' : 'drzwi');
        draft.details = Object.assign({}, d, { podFrontMode: d.podFrontMode });
      }
      if(ctx.fcLabelEl) ctx.fcLabelEl.textContent = (d.podFrontMode === 'szuflady') ? 'Ilość szuflad' : 'Ilość frontów';
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
      if(ctx.fcLabelEl) ctx.fcLabelEl.textContent = 'Ilość frontów';
      setFcOptions([1,2]);
    }

    ctx.ensureFrontCountRulesSafe(draft);
    const flapActive = configureFlapUi(ctx);

    if(fcSel) fcSel.style.display = '';
    if(fcStatic){ fcStatic.style.display = 'none'; fcStatic.textContent = ''; }
    if(flapFrontInfo) flapFrontInfo.style.display = 'none';

    const canPick = ctx.cabinetAllowsFrontCountSafe(draft);
    const isCornerL = (draft.subType === 'narozna_l');
    if(isCornerL){
      draft.frontCount = 2;
      if(fcWrap) fcWrap.style.display = 'none';
      if(fcHint) fcHint.style.display = 'none';
      if(shelvesWrap){
        shelvesWrap.style.display = 'block';
        const d = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
          ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
          : (draft.details && typeof draft.details === 'object' ? draft.details : {});
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
      return;
    }
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
    const podBrak = (isPodblatowaDraft && draft.details && draft.details.podFrontMode === 'brak');
    fcSel.disabled = !!podBrak;
    fcSel.value = String(draft.frontCount === 0 ? 0 : (draft.frontCount || 2));
    if(podBrak){
      if(fcHint){ fcHint.style.display = 'block'; fcHint.textContent = 'Otwarta szafka (bez frontów).'; }
    } else if(fcHint){
      fcHint.style.display = 'none';
    }
  }

  function afterSubTypeChange(){ return null; }

  ns.cabinetModalHanging = {
    renderExtraDetails,
    configureFrontControls,
    afterSubTypeChange
  };
})();
