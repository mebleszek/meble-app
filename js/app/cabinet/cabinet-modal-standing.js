(function(){
  const ns = (window.FC = window.FC || {});

  function renderCornerLExtraDetails(ctx){
    const container = ctx.container;
    const draft = ctx.draft;
    const d0 = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
      ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
      : (draft.details && typeof draft.details === 'object' ? draft.details : {});
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

    const sync = () => {
      const GL = Number(iGL.value) || 0;
      const GP = Number(iGP.value) || 0;
      const ST = Number(iST.value) || 0;
      const SP = Number(iSP.value) || 0;
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
          sketchApi.drawCornerSketch({
            canvas: wrap.querySelector('#cornerPreview'),
            legendEl: wrap.querySelector('#cornerPreviewLegend'),
            GL, GP, ST, SP,
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
      if(lay === '5_equal'){
        draft.details = Object.assign({}, draft.details || {}, { innerDrawerType: 'brak', innerDrawerCount: '0' });
      } else if(lay === '3_equal'){
        if(String(draft.details?.innerDrawerCount || '') === '0' || !draft.details?.innerDrawerCount) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: '3' });
      } else {
        if(String(draft.details?.innerDrawerCount || '') === '0' || !draft.details?.innerDrawerCount) draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: '2' });
      }
      renderCabinetModal();
    });

    draft.details = Object.assign({}, draft.details || {});
    if(!draft.details.drawerSystem || !['skrzynkowe','systemowe'].includes(String(draft.details.drawerSystem))){
      draft.details.drawerSystem = 'skrzynkowe';
    }
    if(!draft.details.innerDrawerType) draft.details.innerDrawerType = 'brak';
    if(draft.details.innerDrawerType === 'brak'){
      draft.details.innerDrawerCount = '0';
    } else if(!draft.details.innerDrawerCount){
      draft.details.innerDrawerCount = '2';
    }

    addSelect('Typ szuflad (frontowych)', 'drawerSystem', [
      {v:'skrzynkowe', t:'Skrzynkowe'},
      {v:'systemowe', t:'Systemowe'}
    ], ()=>{ renderCabinetModal(); });

    const ds = String((draft.details && draft.details.drawerSystem) ? draft.details.drawerSystem : 'skrzynkowe');
    if(ds === 'systemowe'){
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
        if(!Number.isFinite(cur) || cur <= 0){
          draft.details = Object.assign({}, draft.details || {}, { innerDrawerCount: String(def) });
        }
      }
    }
  }

  function renderExtraDetails(ctx){
    const draft = ctx.draft;
    const st = ctx.subType;
    const d = ctx.details;
    const addSelect = ctx.addSelect;
    const addNumber = ctx.addNumber;
    if(st === 'narozna_l') renderCornerLExtraDetails(ctx);

    if(st === 'szuflady'){
      renderDrawerExtras(ctx);
    }

    if(st === 'zlewowa'){
      if(!d.sinkFront) d.sinkFront = 'drzwi';
      if(!d.sinkDoorCount) d.sinkDoorCount = '2';
      if(!d.sinkExtra) d.sinkExtra = 'brak';
      if(d.sinkExtraCount == null) d.sinkExtraCount = 1;
      if(!d.sinkInnerDrawerType) d.sinkInnerDrawerType = 'skrzynkowe';

      addSelect('Front szafki zlewowej', 'sinkFront', [
        {v:'drzwi', t:'Drzwi'},
        {v:'szuflada', t:'Szuflada (1 duży front)'}
      ], () => {
        const curFront = String((draft.details && draft.details.sinkFront) ? draft.details.sinkFront : 'drzwi');
        if(curFront === 'szuflada'){
          draft.frontCount = 1;
        } else {
          const dc = Number((draft.details && draft.details.sinkDoorCount) ? draft.details.sinkDoorCount : 2);
          draft.frontCount = (dc === 1 ? 1 : 2);
        }
      });

      const curFront = String((draft.details && draft.details.sinkFront) ? draft.details.sinkFront : 'drzwi');
      if(curFront === 'drzwi'){
        addSelect('Ilość drzwi', 'sinkDoorCount', [
          {v:'1', t:'1 drzwi'},
          {v:'2', t:'2 drzwi'}
        ], ()=>{
          const dc = Number((draft.details && draft.details.sinkDoorCount) ? draft.details.sinkDoorCount : 2);
          draft.frontCount = (dc === 1 ? 1 : 2);
        });
      } else {
        draft.frontCount = 1;
      }

      if(curFront === 'szuflada'){
        if(!draft.details.drawerSystem) draft.details.drawerSystem = 'skrzynkowe';
        if(!draft.details.drawerBrand) draft.details.drawerBrand = 'blum';
        if(!draft.details.drawerModel) draft.details.drawerModel = 'tandembox';

        addSelect('Typ szuflady (zlewowa)', 'drawerSystem', [
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'systemowe', t:'Systemowe'}
        ], ()=>{ ctx.renderCabinetModal(); });

        const ds = String(draft.details.drawerSystem || 'skrzynkowe');
        if(ds === 'systemowe'){
          addSelect('Firma systemu', 'drawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ ctx.renderCabinetModal(); });

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
            ctx.container.appendChild(warn);
          }
        }
      }

      addSelect('Dodatkowo', 'sinkExtra', [
        {v:'brak', t:'Brak'},
        {v:'polka', t:'Półka'},
        {v:'szuflada_wew', t:'Szuflada wewnętrzna'}
      ], ()=>{ ctx.renderCabinetModal(); });

      const extra = String((draft.details && draft.details.sinkExtra) ? draft.details.sinkExtra : 'brak');
      if(extra === 'polka'){
        addNumber('Ilość półek', 'shelves', 1);
      } else if(extra === 'szuflada_wew'){
        addNumber('Ilość szuflad wewnętrznych', 'sinkExtraCount', 1);
        addSelect('Typ szuflad wewnętrznych', 'sinkInnerDrawerType', [
          {v:'skrzynkowe', t:'Skrzynkowe'},
          {v:'systemowe', t:'Systemowe'}
        ], ()=>{ ctx.renderCabinetModal(); });

        const inner = String(draft.details.sinkInnerDrawerType || 'skrzynkowe');
        if(inner === 'systemowe'){
          if(!draft.details.sinkInnerDrawerBrand) draft.details.sinkInnerDrawerBrand = 'blum';
          if(!draft.details.sinkInnerDrawerModel) draft.details.sinkInnerDrawerModel = 'tandembox';
          addSelect('Firma systemu', 'sinkInnerDrawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ ctx.renderCabinetModal(); });
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
            ctx.container.appendChild(warn2);
          }
        }
      }
    }

    if(st === 'zmywarkowa'){
      addSelect('Szerokość zmywarki', 'dishWasherWidth', [
        {v:'45', t:'45 cm'},
        {v:'60', t:'60 cm'}
      ], ()=>{ ctx.renderCabinetModal(); });
      const leg = Number(ctx.projectData?.[ctx.uiState?.roomType]?.settings?.legHeight) || 0;
      const dw = (draft.details && draft.details.dishWasherWidth) ? draft.details.dishWasherWidth : (String(draft.width || '60'));
      draft.details = Object.assign({}, draft.details || {}, { dishWasherWidth: dw });
      draft.width = Number(dw) || 60;
      const frontH = (Number(draft.height) || 0) - leg;
      const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
      draft.details = Object.assign({}, draft.details, { techDividerCount: String(div) });
    }

    if(st === 'lodowkowa'){
      const grid = document.createElement('div');
      const opt = String((draft.details && draft.details.fridgeOption) ? draft.details.fridgeOption : 'zabudowa');
      const niche = String((draft.details && draft.details.fridgeNicheHeight) ? draft.details.fridgeNicheHeight : '178');
      const freeOpt = String((draft.details && draft.details.fridgeFreeOption) ? draft.details.fridgeFreeOption : 'podest');
      grid.innerHTML = `
        <div class="cabinet-extra-field cabinet-extra-field--select cabinet-extra-field--compact">
          <label class="cabinet-extra-field__label">Lodówka</label>
          <select id="cmFridgeOption" class="cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source" data-launcher-label="Typ lodówki" data-choice-title="Wybierz: Typ lodówki" data-choice-placeholder="Typ lodówki">
            <option value="zabudowa">W zabudowie</option>
            <option value="wolnostojaca">Wolnostojąca</option>
          </select>
        </div>
        <div id="cmFridgeNicheWrap" class="cabinet-extra-field cabinet-extra-field--select cabinet-extra-field--compact">
          <label class="cabinet-extra-field__label">Wysokość niszy</label>
          <select id="cmFridgeNiche" class="cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source" data-launcher-label="Wysokość niszy" data-choice-title="Wybierz: Wysokość niszy" data-choice-placeholder="Wysokość niszy">
            <option value="88">88 cm</option>
            <option value="122">122 cm</option>
            <option value="140">140 cm</option>
            <option value="158">158 cm</option>
            <option value="178">178 cm</option>
          </select>
        </div>
        <div id="cmFridgeFreeWrap" class="cabinet-extra-field cabinet-extra-field--select cabinet-extra-field--compact">
          <label class="cabinet-extra-field__label">Opcja lodówki wolnostojącej</label>
          <select id="cmFridgeFree" class="cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source" data-launcher-label="Opcja lodówki wolnostojącej" data-choice-title="Wybierz opcję lodówki wolnostojącej" data-choice-placeholder="Opcja lodówki wolnostojącej">
            <option value="podest">Na podeście</option>
            <option value="obudowa">Pełna obudowa</option>
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
        const curOpt = (draft.details && draft.details.fridgeOption) ? draft.details.fridgeOption : fo.value;
        const curFree = (draft.details && draft.details.fridgeFreeOption) ? draft.details.fridgeFreeOption : fw.value;
        const nh = Number((draft.details && draft.details.fridgeNicheHeight) ? draft.details.fridgeNicheHeight : fn.value) || 178;
        const leg = Number(ctx.projectData?.[ctx.uiState?.roomType]?.settings?.legHeight) || 0;
        const bh = Number(ctx.projectData?.[ctx.uiState?.roomType]?.settings?.bottomHeight) || Number(draft.height) || 82;

        if(curOpt === 'zabudowa'){
          const bottomFrontH = Math.max(0, bh - leg);
          const div = (bottomFrontH > 74.5)
            ? Math.max(0, Math.ceil(((bottomFrontH - 74.5) / 2) - 1e-9))
            : 0;
          draft.details = Object.assign({}, draft.details, { techDividerCount: String(div) });
          draft.height = nh + (div * 1.8) + 3.6 + leg;
          return;
        }
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
        ctx.renderCabinetModal();
      });
      fn.addEventListener('change', e => {
        draft.details = Object.assign({}, draft.details || {}, { fridgeNicheHeight: e.target.value });
        applyFridgeDims();
        ctx.renderCabinetModal();
      });
      fw.addEventListener('change', e => {
        draft.details = Object.assign({}, draft.details || {}, { fridgeFreeOption: e.target.value });
        applyFridgeDims();
        ctx.renderCabinetModal();
      });

      ctx.container.appendChild(grid);
      if(opt === 'zabudowa'){
        addSelect('Fronty lodówki (zabudowa)', 'fridgeFrontCount', [
          {v:'1', t:'1 duży front'},
          {v:'2', t:'2 fronty (dolny + górny)'}
        ]);
      }
      toggleFridgeUI();
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
        ], ()=>{ ctx.renderCabinetModal(); });
        const ds2 = String(draft.details.drawerSystem || 'skrzynkowe');
        if(ds2 === 'systemowe'){
          addSelect('Firma systemu', 'drawerBrand', [
            {v:'blum', t:'BLUM'},
            {v:'gtv', t:'GTV'},
            {v:'rejs', t:'Rejs'}
          ], ()=>{ ctx.renderCabinetModal(); });
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
            ctx.container.appendChild(warn);
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
      if(st === 'standardowa'){
        if(!d.insideMode) d.insideMode = 'polki';
        if(!d.innerDrawerCount) d.innerDrawerCount = '1';
        if(!d.innerDrawerType) d.innerDrawerType = 'blum';
        addSelect('Wnętrze', 'insideMode', [
          {v:'polki', t:'Półki'},
          {v:'szuflady_wew', t:'Szuflady wewnętrzne'}
        ], (val)=>{
          const dv = window.FC && window.FC.utils && typeof window.FC.utils.isPlainObject === 'function'
            ? (window.FC.utils.isPlainObject(draft.details) ? draft.details : {})
            : (draft.details && typeof draft.details === 'object' ? draft.details : {});
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

    const setFcOptions = (arr) => {
      fcSel.innerHTML = arr.map(n => `<option value="${n}">${n}</option>`).join('');
    };

    if(ctx.fcLabelEl) ctx.fcLabelEl.textContent = 'Ilość frontów';
    setFcOptions([1,2]);
    ctx.ensureFrontCountRulesSafe(draft);

    if(fcSel) fcSel.style.display = '';
    if(fcStatic){
      fcStatic.style.display = 'none';
      fcStatic.textContent = '';
    }

    const canPick = ctx.cabinetAllowsFrontCountSafe(draft);
    const fixedOne = (draft.subType === 'zmywarkowa' || draft.subType === 'piekarnikowa' || (draft.subType === 'rogowa_slepa' && (draft.details?.cornerOption||'polki') === 'magic_corner')) || (draft.subType === 'zlewowa' && (draft.details?.sinkFront||'drzwi') === 'szuflada');
    const isFridge = (draft.subType === 'lodowkowa');
    const isCornerL = (draft.subType === 'narozna_l');

    if(isFridge){
      if(fcWrap) fcWrap.style.display = 'none';
      if(fcHint) fcHint.style.display = 'none';
      if(shelvesWrap) shelvesWrap.style.display = 'none';
      return;
    }
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
    if(!canPick){
      if(fcWrap) fcWrap.style.display = 'none';
      if(fcHint) fcHint.style.display = 'none';
      if(shelvesWrap) shelvesWrap.style.display = 'none';
      return;
    }
    if(fixedOne){
      if(fcWrap) fcWrap.style.display = 'block';
      if(shelvesWrap) shelvesWrap.style.display = 'none';
      fcSel.value = '1';
      fcSel.disabled = true;
      if(fcHint){
        fcHint.style.display = 'block';
        fcHint.textContent = 'Dla tej szafki ilość frontów jest stała: 1.';
      }
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
    if(draft.subType === 'zmywarkowa'){
      const leg = Number(ctx.projectData?.[ctx.room]?.settings?.legHeight) || 0;
      const dw = (draft.details && draft.details.dishWasherWidth) ? draft.details.dishWasherWidth : (String(draft.width || '60'));
      draft.details = Object.assign({}, draft.details || {}, { dishWasherWidth: dw });
      draft.width = Number(dw) || 60;
      const frontH = (Number(draft.height) || 0) - leg;
      const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
      draft.details = Object.assign({}, draft.details, { techDividerCount: String(div) });
    }
  }

  ns.cabinetModalStanding = {
    renderExtraDetails,
    configureFrontControls,
    afterSubTypeChange
  };
})();
