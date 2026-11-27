(function(){
  const ns = (window.FC = window.FC || {});

  function getSafeDetails(draft){
    return window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
      ? (window.FC.utils.isPlainObject(draft && draft.details) ? draft.details : {})
      : (draft && draft.details && typeof draft.details === 'object' ? draft.details : {});
  }

  function renderCornerLExtraDetails(ctx){
    const container = ctx.container;
    const draft = ctx.draft;
    const unit = ns.cabinetModalFields?.dimensions?.();
    const mm = unit?.name==='mm';
    const unitLabel = unit?.name ?? 'cm';
    const show = value=>unit?.display(value) ?? value;
    const read = input=>(unit?.read(input.value) ?? Number(input.value)) || 0;
    const d0 = getSafeDetails(draft);
    const defaults = {
      gl: (d0.gl != null ? d0.gl : '110'),
      gp: (d0.gp != null ? d0.gp : '50'),
      st: (d0.st != null ? d0.st : '100'),
      sp: (d0.sp != null ? d0.sp : '47'),
      shelves: (d0.shelves != null ? d0.shelves : 2),
      cornerFlip: (d0.cornerFlip != null ? d0.cornerFlip : false)
    };
    draft.details = Object.assign({}, d0, defaults);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
        <div>
          <label>GL</label>
          <input id="cmGL" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Głębokość lewa (${unitLabel})</div>
        </div>
        <div>
          <label>GP</label>
          <input id="cmGP" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Głębokość prawa (${unitLabel})</div>
        </div>
        <div>
          <label>ST</label>
          <input id="cmST" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Szerokość tyłu (${unitLabel})</div>
        </div>
        <div>
          <label>SP</label>
          <input id="cmSP" type="number" step="0.1" />
          <div class="muted xs" style="margin-top:4px">Szerokość przodu (${unitLabel})</div>
        </div>
      </div>

      <div class="flex" style="margin-top:10px;justify-content:space-between;flex-wrap:wrap">
        <button id="flipCornerBtn" class="btn" type="button">Odwróć narożnik</button>
        <div id="cornerWarn" class="warn-orange xs"></div>
      </div>

      <div class="muted xs" style="margin-top:8px">
        Widok z góry. Fronty liczone: <b>FL = |GL−GP|</b> oraz <b>FP = |ST−SP−${mm?18:'1,8'}|</b> (płyta 18&nbsp;mm).
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

    iGL.value = show(draft.details.gl);
    iGP.value = show(draft.details.gp);
    iST.value = show(draft.details.st);
    iSP.value = show(draft.details.sp);

    if(mm) for(const field of [iGL,iGP,iST,iSP]){field.inputMode='decimal';field.step='1';}

    const sync = () => {
      const GL = read(iGL);
      const GP = read(iGP);
      const ST = read(iST);
      const SP = read(iSP);
      const FL = Math.abs(GL - GP);
      const FP = Math.abs(ST - SP - 1.8);

      draft.details = Object.assign({}, draft.details || {}, {
        gl: String(GL),
        gp: String(GP),
        st: String(ST),
        sp: String(SP)
      });

      draft.width = ST;
      draft.depth = Math.max(GL, GP);

      const widthInput = document.getElementById('cmWidth');
      const depthInput = document.getElementById('cmDepth');
      if(widthInput) widthInput.value = show(draft.width);
      if(depthInput) depthInput.value = show(draft.depth);

      if(warnEl){
        const notes = [];
        if(FL < 15) notes.push(`FL ${mm?Math.round(FL*10):FL.toFixed(1)} ${unitLabel} < ${show(15)} ${unitLabel}`);
        if(FP < 15) notes.push(`FP ${mm?Math.round(FP*10):FP.toFixed(1)} ${unitLabel} < ${show(15)} ${unitLabel}`);
        warnEl.textContent = notes.length ? ('Uwaga: ' + notes.join(' · ')) : '';
      }

      try{
        const sketchApi = window.FC && window.FC.cornerSketch;
        if(sketchApi && typeof sketchApi.drawCornerSketch === 'function'){
          sketchApi.drawCornerSketch({
            canvas: wrap.querySelector('#cornerPreview'),
            legendEl: wrap.querySelector('#cornerPreviewLegend'),
            GL, GP, ST, SP, millimeters:mm,
            flip: !!(draft.details && draft.details.cornerFlip)
          });
        }
      }catch(_){ }
    };

    [iGL, iGP, iST, iSP].forEach((el) => {
      if(!el) return;
      el.addEventListener('input', sync);
      el.addEventListener('change', sync);
    });

    if(flipBtn){
      flipBtn.addEventListener('click', () => {
        draft.details = Object.assign({}, draft.details || {}, {
          cornerFlip: !(draft.details && draft.details.cornerFlip)
        });
        sync();
      });
    }

    sync();
  }

  function renderStandardAndCornerExtras(ctx){
    const draft = ctx.draft;
    const st = ctx.subType;
    const d = ctx.details;
    const addSelect = ctx.addSelect;
    const addNumber = ctx.addNumber;

    if(st !== 'standardowa' && st !== 'rogowa_slepa' && st !== 'narozna_l') return;

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
    if(st === 'standardowa'){
      if(!d.insideMode) d.insideMode = 'polki';
      if(!d.innerDrawerCount) d.innerDrawerCount = '1';
      if(!d.innerDrawerType) d.innerDrawerType = 'blum';
      addSelect('Wnętrze', 'insideMode', [
        {v:'polki', t:'Półki'},
        {v:'szuflady_wew', t:'Szuflady wewnętrzne'}
      ], (val)=>{
        const dv = getSafeDetails(draft);
        if(String(val) === 'szuflady_wew'){
          dv.shelves = 0;
          if(!dv.innerDrawerCount) dv.innerDrawerCount = '1';
          if(!dv.innerDrawerType) dv.innerDrawerType = 'blum';
        } else {
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

  ns.cabinetModalStandingCornerStandard = {
    getSafeDetails,
    renderCornerLExtraDetails,
    renderStandardAndCornerExtras
  };
})();
