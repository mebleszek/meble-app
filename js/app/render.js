/* Render module extracted from app.js (minimal refactor) */
window.FC = window.FC || {};
window.FC.render = window.FC.render || {};

function renderTopHeight(){
  const el = document.getElementById('autoTopHeight');
  if(el) el.textContent = calculateAvailableTopHeight();
}

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

        applyTypeRules(room, cabinetModalState.draft, ch.key);
        const opts = getSubTypeOptionsForType(ch.key).map(o=>o.v);
        if(!opts.includes(cabinetModalState.draft.subType)) cabinetModalState.draft.subType = opts[0];
        applySubTypeRules(room, cabinetModalState.draft, cabinetModalState.draft.subType);
        ensureFrontCountRules(cabinetModalState.draft);
      }
      renderCabinetModal();
    });
    wrap.appendChild(tile);
  });
}

function renderCabinetExtraDetailsInto(container, draft){
  container.innerHTML = '';
  const t = draft.type;
  const st = draft.subType;
  const d = draft.details || {};

  function addSelect(labelText, key, options, onChangeExtra){
    const div = document.createElement('div'); div.style.marginBottom='10px';
    div.innerHTML = `<label>${labelText}</label><select></select>`;
    const sel = div.querySelector('select');
    options.forEach(opt => {
      const o = document.createElement('option'); o.value=opt.v; o.textContent=opt.t; sel.appendChild(o);
    });
    sel.value = (draft.details && draft.details[key]) ? draft.details[key] : options[0].v;
    sel.addEventListener('change', e => {
      draft.details = Object.assign({}, draft.details || {}, { [key]: e.target.value });
      if(onChangeExtra) onChangeExtra(e.target.value);
      renderCabinetModal();
    });
    container.appendChild(div);
  }

  function addNumber(labelText, key, fallback){
    const div = document.createElement('div'); div.style.marginBottom='10px';
    const raw = (draft.details && draft.details[key] != null) ? draft.details[key] : fallback;
    const existingShelves = document.getElementById('cmShelves');
    const idAttr = (!existingShelves && key === 'shelves') ? ' id="cmShelves"' : '';
    div.innerHTML = `<label>${labelText}</label><input type="number"${idAttr} value="${raw}" />`;
    const inp = div.querySelector('input');

    const apply = () => {
      // zapisuj od razu (żeby nie wymagało "odkliknięcia" pola)
      draft.details = Object.assign({}, draft.details || {}, { [key]: inp.value });
    };

    inp.addEventListener('input', apply);
    inp.addEventListener('change', apply);
    container.appendChild(div);
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
            div.innerHTML = `<label>Ilość szuflad wewnętrznych (max ${max})</label><select></select>`;
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
        <div>
          <label>Typ lodówki</label>
          <select id="cmFridgeOption">
            <option value="zabudowa">W zabudowie</option>
            <option value="wolnostojaca">Wolnostojąca</option>
          </select>
        </div>
        <div id="cmFridgeNicheWrap">
          <label>Wysokość niszy (cm)</label>
          <select id="cmFridgeNiche">
            <option value="82">82</option>
            <option value="122">122</option>
            <option value="158">158</option>
            <option value="178">178</option>
            <option value="194">194</option>
            <option value="204">204</option>
          </select>
        </div>
        <div id="cmFridgeFreeWrap" style="display:none">
          <label>Opcja</label>
          <select id="cmFridgeFree">
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

function renderSetTiles(){
  const wrap = document.getElementById('setTiles');
  wrap.innerHTML = '';

  const presets = [
    {
      id:'A',
      title:'2 dolne + górny moduł',
      desc:'Dwa dolne korpusy obok siebie + górny moduł. Wysokość górnego = pomieszczenie - dół - blenda.',
      svg: `
        <svg class="mini-svg" viewBox="0 0 56 40" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="18" width="24" height="20" rx="3" fill="#eaf6ff" stroke="#0ea5e9" />
          <rect x="30" y="18" width="24" height="20" rx="3" fill="#eaf6ff" stroke="#0ea5e9" />
          <rect x="2" y="2" width="52" height="14" rx="3" fill="#ffffff" stroke="#94a3b8" />
        </svg>
      `
    },
    {
      id:'C',
      title:'1 pion: dół + górny moduł',
      desc:'Jeden pion (dół + górny moduł). Wysokość górnego = pomieszczenie - dół - blenda.',
      svg: `
        <svg class="mini-svg" viewBox="0 0 56 40" xmlns="http://www.w3.org/2000/svg">
          <rect x="18" y="2" width="20" height="36" rx="3" fill="#eaf6ff" stroke="#0ea5e9" />
          <line x1="18" y1="22" x2="38" y2="22" stroke="#0ea5e9" stroke-width="2"/>
        </svg>
      `
    },
    {
      id:'D',
      title:'1 pion: dół + środek + góra',
      desc:'Trzy segmenty w pionie. Środkowy i górny to moduły (głębokość = dół - 1). Wysokość górnego = pomieszczenie - dół - środek - blenda.',
      svg: `
        <svg class="mini-svg" viewBox="0 0 56 40" xmlns="http://www.w3.org/2000/svg">
          <rect x="18" y="2" width="20" height="36" rx="3" fill="#ffffff" stroke="#0ea5e9" />
          <line x1="18" y1="15" x2="38" y2="15" stroke="#0ea5e9" stroke-width="2"/>
          <line x1="18" y1="26" x2="38" y2="26" stroke="#0ea5e9" stroke-width="2"/>
          <rect x="18" y="26" width="20" height="12" rx="0" fill="#eaf6ff" opacity="0.65" />
        </svg>
      `
    }
  ];

  presets.forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'mini-tile' + (cabinetModalState.setPreset === p.id ? ' selected' : '');
    tile.innerHTML = `
      <div class="mini-head">
        ${p.svg}
        <div>
          <div class="mini-title">${p.title}</div>
          <div class="muted-tag xs">Zestaw standardowy</div>
        </div>
      </div>
      <div class="mini-desc">${p.desc}</div>
    `;
    tile.addEventListener('click', () => {
      cabinetModalState.setPreset = p.id;
      renderCabinetModal();
    });
    wrap.appendChild(tile);
  });
}

function renderSetParamsUI(presetId){
  const room = uiState.roomType;
  const s = projectData[room].settings;
  const paramsWrap = document.getElementById('setParams');
  paramsWrap.innerHTML = '';
  if(!presetId){ paramsWrap.style.display='none'; return; }

  paramsWrap.style.display='grid';

  function addInput(id,label,value,extra=''){
    const d = document.createElement('div');
    d.innerHTML = `<label>${label}</label><input id="${id}" type="number" value="${value}" ${extra}/>`;
    paramsWrap.appendChild(d);
  }
  function addReadonly(id,label,value){
    const d = document.createElement('div');
    d.innerHTML = `<label>${label}</label><input id="${id}" type="number" value="${value}" disabled />`;
    paramsWrap.appendChild(d);
  }

  const defaultBlende = Number(s.ceilingBlende) || 0;

  if(presetId === 'A'){
    addInput('setW1','Szer. lewa (cm)', 60);
    addInput('setW2','Szer. prawa (cm)', 60);
    addInput('setHBottom','Wys. dolnych (cm)', Number(s.bottomHeight)||82);
    addInput('setDBottom','Głębokość dolnych (cm)', 51);
    addInput('setBlende','Blenda (cm)', defaultBlende);

    const hTop = calcTopForSet(room, defaultBlende, Number(s.bottomHeight)||82);
    addReadonly('setHTopResult','Wys. górnego (wynikowa)', hTop);
    addReadonly('setDTopResult','Głęb. górnego (dół-1)', Math.max(0, 51-1));
  }

  if(presetId === 'C'){
    addInput('setW','Szerokość (cm)', 60);
    addInput('setHBottom','Wys. dolnego z nogami (cm)', Number(s.bottomHeight)||82);
    addInput('setDBottom','Głębokość dolnego (cm)', 51);
    addInput('setBlende','Blenda (cm)', defaultBlende);

    const hTop = calcTopForSet(room, defaultBlende, Number(s.bottomHeight)||82);
    addReadonly('setHTopResult','Wys. górnego (wynikowa)', hTop);
    addReadonly('setDTopResult','Głęb. górnego (dół-1)', Math.max(0, 51-1));
  }

  if(presetId === 'D'){
    addInput('setW','Szerokość (cm)', 60);
    addInput('setHBottom','Wys. dolnego z nogami (cm)', Number(s.bottomHeight)||82);
    addInput('setHMiddle','Wys. środkowego (cm)', 100);
    addInput('setDBottom','Głębokość dolnego (cm)', 51);
    addInput('setBlende','Blenda (cm)', defaultBlende);

    const hTop = calcTopForSet(room, defaultBlende, (Number(s.bottomHeight)||82) + 100);
    addReadonly('setHTopResult','Wys. górnego (wynikowa)', hTop);
    addReadonly('setDTopResult','Głęb. modułów (dół-1)', Math.max(0, 51-1));
  }

  wireSetParamsLiveUpdate(presetId);
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

function renderTotals(container, totals){
  container.innerHTML = '';
  const rows = totalsToRows(totals);
  if(!rows.length){
    const em = document.createElement('div');
    em.className = 'muted xs';
    em.textContent = '—';
    container.appendChild(em);
    return;
  }
  rows.forEach(r => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.gap = '10px';
    row.style.padding = '2px 0';

    const left = document.createElement('div');
    left.className = 'muted xs';
    left.style.fontWeight = '900';
    left.textContent = r.material;

    const right = document.createElement('div');
    right.className = 'muted xs';
    right.style.fontWeight = '900';
    right.textContent = `${formatM2(r.m2)} m²`;

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  });
}

function renderMaterialsTab(listEl, room){
  const cabinets = projectData[room].cabinets || [];

  // Suma projektu
  const projectTotals = {};
  cabinets.forEach(cab => {
    const parts = getCabinetCutList(cab, room);
    mergeTotals(projectTotals, totalsFromParts(parts));
  });

  const top = document.createElement('div');
  top.className = 'card';
  top.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h3 style="margin:0">Materiały — rozpiska mebli</h3>
</div>
    <p class="muted" style="margin:6px 0 0">
      Poniżej jest rozpisany każdy dodany mebel (korpus). Wymiary są liczone "na czysto" z założeniem płyty 18&nbsp;mm.
      Nie uwzględnia to oklein, wpustów pod plecy ani luzów technologicznych.
    </p>

    <div class="hr"></div>
    <div class="muted xs" style="line-height:1.55">
      <div><strong>Zasady skręcania:</strong></div>
      <div>• Wiszące: wieniec górny i dolny między boki.</div>
      <div>• Modułowe: jak wiszące.</div>
      <div>• Stojące: wieniec dolny pod boki (boki niższe o ${FC_BOARD_THICKNESS_CM} cm); trawersy górne: głębokość ${FC_TOP_TRAVERSE_DEPTH_CM} cm.</div>
    </div>

    <div class="hr"></div>
    <div>
      <div class="muted xs" style="font-weight:900; margin-bottom:6px">Suma m² materiałów — cały projekt</div>
      <div id="projectMatTotals"></div>
      <div class="muted xs" style="margin-top:8px;line-height:1.45">
        <div><strong>Założenia do obliczeń zawiasów/podnośników (waga frontów):</strong></div>
        <div>• Laminat 18&nbsp;mm: <span id="wLam"></span> kg/m²</div>
        <div>• Akryl (MDF 18&nbsp;mm): <span id="wAkr"></span> kg/m²</div>
        <div>• Lakier (MDF 18&nbsp;mm): <span id="wLak"></span> kg/m²</div>
        <div>• Uchwyt (zawiasy): ${FC_HANDLE_WEIGHT_KG} kg / front; (podnośniki klap): ${FC_HANDLE_WEIGHT_KG*2} kg / klapa</div>
        <div style="font-size:12px;color:#5b6b7c;margin-top:6px">Uchwyty doliczane tylko gdy wybrany system z uchwytem (TIP-ON/podchwyt = 0 kg).</div>
      </div>
    </div>
  `;
  listEl.appendChild(top);

  // wypełnij sumy projektu
  const projTotalsEl = top.querySelector('#projectMatTotals');
  if(projTotalsEl) renderTotals(projTotalsEl, projectTotals);

  // wagi założone (kg/m²) — do informacji na górze
  const wLamEl = top.querySelector('#wLam');
  const wAkrEl = top.querySelector('#wAkr');
  const wLakEl = top.querySelector('#wLak');
  if(wLamEl) wLamEl.textContent = String(FC_FRONT_WEIGHT_KG_M2.laminat);
  if(wAkrEl) wAkrEl.textContent = String(FC_FRONT_WEIGHT_KG_M2.akryl);
  if(wLakEl) wLakEl.textContent = String(FC_FRONT_WEIGHT_KG_M2.lakier);


  if(!cabinets.length){
    const empty = document.createElement('div');
    empty.className = 'build-card';
    empty.innerHTML = '<h3>Brak mebli</h3><p class="muted">Dodaj szafki, żeby pojawiła się rozpiska materiałów.</p>';
    listEl.appendChild(empty);
    return;
  }

  cabinets.forEach((cab, idx) => {
    const card = document.createElement('div');
    card.className = 'card';

    card.id = `mat-${cab.id}`;

    const badge = cab.setId && typeof cab.setNumber === 'number'
      ? `<span class="badge">Zestaw ${cab.setNumber}</span>`
      : '';

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '12px';
    head.innerHTML = `
      <div>
        <div style="font-weight:900">#${idx+1} • ${cab.type || ''} • ${cab.subType || ''} ${badge}</div>
        <div class="muted xs">${cab.width} × ${cab.height} × ${cab.depth} • korpus: ${cab.bodyColor || ''} • plecy: ${cab.backMaterial || ''}</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap">
        <div class="muted xs" style="white-space:nowrap">${getCabinetAssemblyRuleText(cab)}</div>
        <button class="btn" type="button" data-act="editCab" data-cab="${cab.id}">Edytuj</button>
        <button class="btn" type="button" data-act="jumpCab" data-cab="${cab.id}">← Szafka</button>
      </div>
    `;
    card.appendChild(head);

    const isOpen = String(uiState.matExpandedId || '') === String(cab.id);
    if(isOpen) card.classList.add('selected');

    head.style.cursor = 'pointer';
    head.addEventListener('click', (e) => {
      if(e && e.target && e.target.closest && e.target.closest('button')) return;
      const nowOpen = String(uiState.matExpandedId || '') === String(cab.id);
      uiState.matExpandedId = nowOpen ? null : String(cab.id);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      renderCabinets();
    });

    const _editCabBtn = head.querySelector('[data-act="editCab"]');
    if(_editCabBtn){
      _editCabBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        openCabinetModalForEdit(_editCabBtn.getAttribute('data-cab'));
      });
    }

    const _jumpCabBtn = head.querySelector('[data-act=\"jumpCab\"]');
    if(_jumpCabBtn){
      _jumpCabBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        jumpToCabinetFromMaterials(_jumpCabBtn.getAttribute('data-cab'));
      });
    }

    if(!isOpen){
      const collapsedHint = document.createElement('div');
      collapsedHint.className = 'muted xs';
      collapsedHint.style.marginTop = '10px';
      collapsedHint.textContent = 'Kliknij nagłówek, aby rozwinąć rozpis materiałów tej szafki.';
      card.appendChild(collapsedHint);
      listEl.appendChild(card);
      return;
    }

    const parts = getCabinetCutList(cab, room);

    // SUMA m² dla szafki
    const cabTotalsBox = document.createElement('div');
    cabTotalsBox.style.marginTop = '10px';
    cabTotalsBox.style.paddingTop = '10px';
    cabTotalsBox.style.borderTop = '1px solid #eef6fb';
    cabTotalsBox.innerHTML = `<div class="muted xs" style="font-weight:900; margin-bottom:6px">Suma m² materiałów — ta szafka</div>`;
    const cabTotalsEl = document.createElement('div');
    cabTotalsBox.appendChild(cabTotalsEl);
    card.appendChild(cabTotalsBox);
    renderTotals(cabTotalsEl, totalsFromParts(parts));

    const table = document.createElement('div');
    table.style.marginTop = '12px';
    table.style.border = '1px solid #eef6fb';
    table.style.borderRadius = '12px';
    table.style.overflow = 'hidden';

    const tHead = document.createElement('div');
    tHead.className = 'front-row';
    tHead.style.background = '#f8fbff';
    tHead.innerHTML = `
      <div style="font-weight:900">Element</div>
      <div class="front-meta">Ilość</div>
      <div class="front-meta">Wymiar (cm)</div>
      <div class="front-meta">Materiał</div>
    `;
    tHead.style.display = 'grid';
    tHead.style.gridTemplateColumns = '1.4fr 0.4fr 0.7fr 1fr';
    tHead.style.gap = '10px';
    table.appendChild(tHead);

    
parts.forEach(p => {
      const row = document.createElement('div');
      row.className = 'front-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1.4fr 0.4fr 0.7fr 1fr';
      row.style.gap = '10px';

      if(p.tone === 'red'){
        row.style.background = '#ffe1e1';
        row.style.borderLeft = '6px solid #d33';
      }else if(p.tone === 'orange'){
        row.style.background = '#fff0d6';
        row.style.borderLeft = '6px solid #f0a000';
      }

      row.innerHTML = `
        <div style="font-weight:900">${p.name}</div>
        <div style="font-weight:900">${p.qty}</div>
        <div style="font-weight:900">${p.dims}</div>
        <div class="front-meta">${p.material || ''}</div>
      `;
      table.appendChild(row);
    });

    card.appendChild(table);

    // najpierw dodaj kartę (żeby nawet przy błędzie w rysunku nie zniknęły materiały)
    listEl.appendChild(card);
  });
}

function renderCabinets(){
  const list = document.getElementById('cabinetsList'); list.innerHTML = '';
  const room = uiState.roomType;
  document.getElementById('roomTitle').textContent = room ? room.charAt(0).toUpperCase()+room.slice(1) : 'Pomieszczenie';
  if(!room) return;

  const s = projectData[room].settings;
  document.getElementById('roomHeight').value = s.roomHeight;
  document.getElementById('bottomHeight').value = s.bottomHeight;
  document.getElementById('legHeight').value = s.legHeight;
  document.getElementById('counterThickness').value = s.counterThickness;
  document.getElementById('gapHeight').value = s.gapHeight;
  document.getElementById('ceilingBlende').value = s.ceilingBlende;
  renderTopHeight();
  // zakładki
  if(uiState.activeTab === 'material'){
    renderMaterialsTab(list, room);
    return;
  }
  if(uiState.activeTab === 'rysunek'){
    renderDrawingTab(list, room);
    return;
  }

  if(uiState.activeTab !== 'wywiad'){
    const buildCard = document.createElement('div');
    buildCard.className='build-card';
    buildCard.innerHTML = '<h3>Strona w budowie</h3><p class="muted">Sekcja jest w trakcie przygotowania.</p>';
    list.appendChild(buildCard);
    return;
  }

  // grupowanie: zestawy renderujemy jako blok: korpusy + fronty zestawu pod spodem
  const cabinets = projectData[room].cabinets || [];
  const renderedSets = new Set();

  cabinets.forEach((cab, idx) => {
    // jeśli element zestawu i nie renderowaliśmy jeszcze zestawu -> render cały zestaw blokiem
    if(cab.setId && !renderedSets.has(cab.setId)){
      const setId = cab.setId;
      renderedSets.add(setId);
      const setNumber = cab.setNumber;

      // wszystkie korpusy zestawu w kolejności jak w tablicy
      const setCabs = cabinets.filter(c => c.setId === setId);
      setCabs.forEach((sc, jdx) => {
        renderSingleCabinetCard(list, room, sc, idx + jdx + 1);
      });
      return;
    }

    // jeśli to element zestawu, ale zestaw już wyrenderowany — pomijamy
    if(cab.setId && renderedSets.has(cab.setId)) return;

    // normalna szafka
    renderSingleCabinetCard(list, room, cab, idx+1);
  });
}

function renderSingleCabinetCard(list, room, cab, displayIndex){
  const cabEl = document.createElement('div');
  cabEl.className = 'cabinet';
  cabEl.id = `cab-${cab.id}`;
  if(uiState.selectedCabinetId === cab.id) cabEl.classList.add('selected');

  const header = document.createElement('div');
  header.className = 'cabinet-header';

  const left = document.createElement('div');
  const badge = cab.setId && typeof cab.setNumber === 'number'
    ? `<span class="badge">Zestaw ${cab.setNumber}</span>`
    : '';
  left.innerHTML = (() => {
    const base = `<div style="font-weight:900">#${displayIndex} • ${cab.type} • ${cab.subType||''}${badge}</div>
                    <div class="muted xs">${cab.frontMaterial || ''} • ${cab.frontColor || ''}</div>`;
    return base;
  })();

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.gap = '10px';
  right.style.alignItems = 'center';

  const dims = document.createElement('div');
  dims.className = 'muted xs';
  dims.textContent = `${cab.width} × ${cab.height} × ${cab.depth}`;

  const actions = document.createElement('div');
  actions.className = 'cab-actions';
  actions.innerHTML = `<button class="btn" data-act="edit" type="button">Edytuj</button> <button class="btn" data-act="mat" type="button">Materiały</button> <button class="btn btn-danger" data-act="del" type="button">Usuń</button>`;

  right.appendChild(dims);
  right.appendChild(actions);

  header.appendChild(left);
  header.appendChild(right);
  cabEl.appendChild(header);

  // actions: edit/delete per-cabinet
  actions.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if(!btn) return;
    const act = btn.getAttribute('data-act');
    if(act === 'edit'){
      openCabinetModalForEdit(cab.id);
      return;
    }
    if(act === 'mat'){
      jumpToMaterialsForCabinet(cab.id);
      return;
    }
    if(act === 'del'){
      deleteCabinetById(cab.id);
      return;
    }
  });

  header.addEventListener('click', (e) => {
    if(e.target && e.target.closest && e.target.closest('button')) return;

    if(uiState.activeTab === 'wywiad'){
      uiState.selectedCabinetId = (uiState.selectedCabinetId === cab.id) ? null : cab.id;
    }
    toggleExpandAll(cab.id);
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    renderCabinets();
  });

  actions.querySelector('[data-act="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openCabinetModalForEdit(cab.id);
  });

  

    const _matBtn = actions.querySelector('[data-act="mat"]');
  if(_matBtn){
    _matBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      jumpToMaterialsForCabinet(cab.id);
    });
  }

  actions.querySelector('[data-act=\"del\"]').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCabinetById(cab.id);
  });
if(uiState.expanded[cab.id]){
    const body = document.createElement('div');
    body.className = 'cabinet-body';

    const summary = getCabinetExtraSummary(room, cab);

    const ro = document.createElement('div');
    ro.className = 'ro-grid';
    ro.innerHTML = `
      <div class="ro-box"><div class="muted xs">Rodzaj</div><div class="ro-val">${cab.type || ''}</div></div>
      <div class="ro-box"><div class="muted xs">Wariant</div><div class="ro-val">${cab.subType || ''}</div></div>
      <div class="ro-box"><div class="muted xs">Szczegóły</div><div class="ro-val">${summary || '—'}</div></div>

      <div class="ro-box"><div class="muted xs">Wymiary</div><div class="ro-val">${cab.width} × ${cab.height} × ${cab.depth}</div></div>
      <div class="ro-box"><div class="muted xs">Front</div><div class="ro-val">${cab.frontMaterial || ''}</div><div class="muted xs">${cab.frontColor || ''}</div></div>
      <div class="ro-box"><div class="muted xs">Korpus / Plecy</div><div class="ro-val">${cab.bodyColor || ''}</div><div class="muted xs">${cab.backMaterial || ''}</div></div>

      <div class="ro-box"><div class="muted xs">Otwieranie</div><div class="ro-val">${cab.openingSystem || ''}</div></div>
    `;
    body.appendChild(ro);

    // FRONTY (wewnątrz tej samej szafki / zestawu — zwijają się razem)
    const frontsForThis = cab.setId ? getFrontsForSet(room, cab.setId) : getFrontsForCab(room, cab.id);
    if(frontsForThis && frontsForThis.length){
      const fb = document.createElement('div');
      fb.className = 'front-block';
      const title = cab.setId
        ? `Fronty zestawu <span class="badge">Zestaw ${cab.setNumber}</span>`
        : 'Fronty szafki';
      fb.innerHTML = `
        <div class="head">
          <div>${title}</div>
          <div class="front-meta">${frontsForThis.length} szt.</div>
        </div>
      `;
      frontsForThis.forEach((f) => {
        const row = document.createElement('div');
        row.className = 'front-row';
        row.innerHTML = `
          <div>
            <div style="font-weight:900">Front: ${f.width} × ${f.height}</div>
            <div class="front-meta">${(f.material||'')}${(f.color ? ' • ' + f.color : '')}${(f.note ? ' • ' + f.note : '')}</div>
          </div>
          <div style="font-weight:900">${Number(f.width)||0}×${Number(f.height)||0}</div>
        `;
        fb.appendChild(row);
      });
      body.appendChild(fb);
    }


    const hint = document.createElement('div');
    hint.className = 'muted xs';
    hint.style.marginTop = '10px';
    hint.style.padding = '10px';
    hint.style.border = '1px solid #eef6fb';
    hint.style.borderRadius = '10px';
    hint.style.background = '#fbfdff';
    hint.textContent = 'Edycja tylko przez przycisk „Edytuj”.';
    body.appendChild(hint);

    cabEl.appendChild(body);
  }

  list.appendChild(cabEl);
}

function renderPriceModal(){
  const modal = document.getElementById('priceModal'); const type = uiState.showPriceList;
  if(!type){ modal.style.display = 'none'; return; }
  modal.style.display = 'flex';
  const isMat = type === 'materials';
  document.getElementById('priceModalTitle').textContent = isMat ? 'Cennik Materiałów' : 'Cennik Usług';
  document.getElementById('priceModalSubtitle').textContent = isMat ? 'Dodaj/edytuj materiały' : 'Dodaj/edytuj usługi';
  document.getElementById('priceModalIcon').textContent = isMat ? '🧩' : '🔧';
  document.getElementById('materialFormFields').style.display = isMat ? 'block' : 'none';
  document.getElementById('serviceFormFields').style.display = isMat ? 'none' : 'block';
  document.getElementById('editingIndicator').style.display = uiState.editingId ? 'inline-block' : 'none';

  const formMaterialType = document.getElementById('formMaterialType'); formMaterialType.innerHTML = '';
  ['laminat','akryl','lakier','blat','akcesoria'].forEach(t => { const o=document.createElement('option'); o.value=t; o.textContent=t; formMaterialType.appendChild(o); });
  const formManufacturer = document.getElementById('formManufacturer');
  function populateManufacturersFor(typeVal){ formManufacturer.innerHTML=''; (MANUFACTURERS[typeVal]||[]).forEach(m=>{const o=document.createElement('option'); o.value=m; o.textContent=m; formManufacturer.appendChild(o)}); }
  populateManufacturersFor(formMaterialType.value);
  formMaterialType.onchange = () => populateManufacturersFor(formMaterialType.value);

  if(uiState.editingId){
    if(isMat){
      const item = materials.find(m => m.id === uiState.editingId);
      if(item){
        formMaterialType.value = item.materialType || 'laminat';
        populateManufacturersFor(formMaterialType.value);
        document.getElementById('formManufacturer').value = item.manufacturer || '';
        document.getElementById('formSymbol').value = item.symbol || '';
        document.getElementById('formName').value = item.name || '';
        document.getElementById('formPrice').value = item.price || '';
      }
    } else {
      const item = services.find(s => s.id === uiState.editingId);
      if(item){
        document.getElementById('formCategory').value = item.category || 'Montaż';
        document.getElementById('formServiceName').value = item.name || '';
        document.getElementById('formServicePrice').value = item.price || '';
      }
    }
    document.getElementById('cancelEditBtn').style.display = isMat ? 'inline-block' : 'none';
    document.getElementById('cancelServiceEditBtn').style.display = isMat ? 'none' : 'inline-block';
  } else {
    formMaterialType.value = 'laminat'; populateManufacturersFor('laminat');
    document.getElementById('formSymbol').value = '';
    document.getElementById('formName').value = '';
    document.getElementById('formPrice').value = '';
    document.getElementById('formCategory').value = 'Montaż';
    document.getElementById('formServiceName').value = '';
    document.getElementById('formServicePrice').value = '';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('cancelServiceEditBtn').style.display = 'none';
  }

  const q = document.getElementById('priceSearch').value.trim().toLowerCase();
  const list = isMat ? materials : services;
  const filtered = list.filter(item => {
    const name = (item.name||'').toLowerCase(); const symbol=(item.symbol||'').toLowerCase(); const manu=(item.manufacturer||'').toLowerCase();
    const mt=(item.materialType||'').toLowerCase(); const cat=(item.category||'').toLowerCase();
    return name.includes(q) || symbol.includes(q) || manu.includes(q) || mt.includes(q) || cat.includes(q);
  });

  const container = document.getElementById('priceListItems'); container.innerHTML = '';
  filtered.forEach(item => {
    const row = document.createElement('div'); row.className='list-item';
    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:900">${item.name}</div><div class="muted-tag xs">${isMat ? (item.materialType + ' • ' + (item.manufacturer||'') + (item.symbol ? ' • SYM: '+item.symbol : '')) : (item.category || '')}</div>`;
    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';
    const price = document.createElement('div'); price.style.fontWeight='900'; price.textContent = (Number(item.price)||0).toFixed(2) + ' PLN';
    const editBtn = document.createElement('button'); editBtn.className='btn'; editBtn.textContent='Edytuj';
    const delBtn = document.createElement('button'); delBtn.className='btn-danger'; delBtn.textContent='Usuń';
    right.appendChild(price); right.appendChild(editBtn); right.appendChild(delBtn);
    row.appendChild(left); row.appendChild(right); container.appendChild(row);

    editBtn.addEventListener('click', () => { uiState.editingId = item.id; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); });
    delBtn.addEventListener('click', () => deletePriceItem(item));
  });

  document.getElementById('savePriceBtn').onclick = saveMaterialFromForm;
  document.getElementById('saveServiceBtn').onclick = saveServiceFromForm;
  document.getElementById('cancelEditBtn').onclick = () => { uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); };
  document.getElementById('cancelServiceEditBtn').onclick = () => { uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); renderPriceModal(); };
}

function renderCabinetTypeChoicesPlaceholder(){}

function renderFinishList(container, room){
  const seg = getActiveSegment(room);
  const finishes = (projectData[room].finishes||[]).filter(f=>f.segmentId===seg.id);
  const wrap = document.createElement('div');
  wrap.className='finish-list';
  if(finishes.length===0){
    const empty = document.createElement('div');
    empty.className='muted xs';
    empty.textContent = 'Brak dodanych wykończeń w tym segmencie.';
    wrap.appendChild(empty);
  } else {
    finishes.forEach(f=>{
      const item = document.createElement('div');
      item.className='finish-item';
      const meta = document.createElement('div');
      meta.className='meta';
      const b = document.createElement('b'); b.textContent = finishLabel(f);
      const p = document.createElement('p'); p.className='muted xs'; p.style.margin='0';
      let extra = [];
      if(f.type==='panel'){
        const cabId = f.cabinetId || null;
        const c = cabId ? getCabById(room, cabId) : null;
        const fbH = (f.row==='base') ? (Math.max(40, Number(s.bottomHeight)||90) - Math.max(0, Number(s.legHeight)||0)) : (f.row==='wall') ? defaultWallH : defaultModuleH;
        const korpusH = c ? (Number(c.height)||fbH) : fbH;

        // GŁĘBOKOŚĆ panelu: wg zasad
        const cabDepth = c && c.depth!=null ? Number(c.depth)||0 : (f.row==='wall' ? 32 : 59.2);
        const isModuleLikeWall = (f.row==='module') && (cabDepth <= 40); // moduły płytkie traktujemy jak górne
        let depth = 0;

        if(f.row==='wall' || isModuleLikeWall){
          depth = cabDepth + 2.2; // górne: +2,2cm
        } else {
          // dolne (i moduły głębokie): jeśli <=57 -> 59,2; jeśli >57 -> depth + 2,5
          depth = (cabDepth > 57) ? (cabDepth + 2.5) : 59.2;
        }

        // WYSOKOŚĆ panelu: korpus + cokół/blenda zależnie od rzędu
        let height = korpusH;
        if(f.row==='wall') height += Math.max(0, Number(s.ceilingBlende)||0);
        if(f.row==='base') height += Math.max(0, Number(s.legHeight)||0);
        // moduły: bez dodatków wysokości

        extra.push(`wymiar: ${depth.toFixed(1)}×${height.toFixed(1)}cm (gł.×wys.)`);
        if(f.width!=null) extra.push(`gr.: ${Number(f.width).toFixed(1)}cm`);
      } else if(f.type==='blenda_pion'){
        extra.push(`Szafka: ${f.cabinetId || '-'}`);
        if(f.width != null) extra.push(`szer.: ${f.width}cm`);
      }
            if(f.type==='blenda_pion_full' || f.type==='panel_pion_full'){
        const wcm = Number(f.width)||2;
        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        const order = ['wall','module','base'];
        const i0 = Math.min(order.indexOf(topRow), order.indexOf(bottomRow));
        const i1 = Math.max(order.indexOf(topRow), order.indexOf(bottomRow));
        const segRows = (Array.isArray(f.rows) && f.rows.length) ? f.rows : order.slice(i0, i1+1);

        let hcm = 0;
        for(const rk of segRows){ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); }
        // dodatki wysokości wg zasad: jeśli w zakresie jest górna -> + blenda; jeśli dolna -> + cokół
        if(segRows.includes('wall')) hcm += Math.max(0, Number(s.ceilingBlende)||0);
        if(segRows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);

        if(f.type==='blenda_pion_full'){
          extra.push(`wymiar: ${wcm.toFixed(1)}×${hcm.toFixed(1)}cm (szer.×wys.)`);
        } else {
          // PANEL pełny: głębokość wg zasad (bazujemy na najgłębszej szafce w kolumnie)
          const x0 = Math.min(Number(f.x0cm)||0, Number(f.x1cm)||0);
          const x1 = Math.max(Number(f.x0cm)||0, Number(f.x1cm)||0);
          let maxDepth = 0;
          for(const rk of segRows){
            const pos = computeXPositionsCm(room, seg, rk);
            for(const pp of pos){
              if(!pp || !pp.el || pp.el.kind!=='cabinet') continue;
              if(pp.x1<=x0 || pp.x0>=x1) continue;
              const cab = getCabById(room, pp.el.id);
              if(!cab) continue;
              const d = (cab.depth!=null) ? Number(cab.depth)||0 : (rk==='wall'?32:59.2);
              maxDepth = Math.max(maxDepth, d);
            }
          }
          const depth = (maxDepth > 57) ? (maxDepth + 2.5) : 59.2;
          extra.push(`wymiar: ${depth.toFixed(1)}×${hcm.toFixed(1)}cm (gł.×wys.)`);
          if(f.width!=null) extra.push(`gr.: ${Number(f.width).toFixed(1)}cm`);
        }
        extra.push((f.side||'R')==='L' ? 'lewa' : 'prawa');
      }

            if(f.type==='blenda_pion_full' || f.type==='panel_pion_full'){
        const x0cm = Number(f.x0cm)||0;
        const x1cm = Number(f.x1cm)||0;
        const wcm = Number(f.width)||2;
        const side = f.side || 'R';
        const x0 = PAD_L + x0cm*SCALE;
        const x1 = PAD_L + x1cm*SCALE;
        const w = Math.max(8, wcm*SCALE);
        const x = (side==='L') ? (x0 - w) : x1;

        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        const order = ['wall','module','base'];
        const i0 = Math.min(order.indexOf(topRow), order.indexOf(bottomRow));
        const i1 = Math.max(order.indexOf(topRow), order.indexOf(bottomRow));
        const segRows = (Array.isArray(f.rows) && f.rows.length) ? f.rows : order.slice(i0, i1+1);

        // y start = górna krawędź topRow, y end = dolna krawędź bottomRow
        if(rowY[topRow]==null || rowY[bottomRow]==null) return;

        let topY = rowY[topRow] + LABEL_H;
        let bottomY = rowY[bottomRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        bottomY += botHcm*SCALE;

        // dodatki: jeśli w zakresie jest wall -> blenda; jeśli base -> cokół
        if(segRows.includes('wall')) topY -= Math.max(0, Number(s.ceilingBlende)||0)*SCALE;
        if(segRows.includes('base')) bottomY += Math.max(0, Number(s.legHeight)||0)*SCALE;

        const y = Math.min(topY, bottomY);
        const h = Math.max(10, Math.abs(bottomY - topY));

        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);

        if(f.type==='blenda_pion_full'){
          rr.setAttribute('fill', 'rgba(14,165,233,0.18)');
          rr.setAttribute('stroke', 'rgba(14,165,233,0.85)');
          rr.setAttribute('stroke-width', '3');
        } else {
          rr.setAttribute('fill', 'rgba(148,163,184,0.22)');
          rr.setAttribute('stroke', 'rgba(100,116,139,0.9)');
          rr.setAttribute('stroke-width', '3');
        }
        finG.appendChild(rr);
      }

      if(f.type==='cokol' || f.type==='blenda_gorna'){
        const x0 = (f.x0cm!=null) ? Number(f.x0cm) : null;
        const x1 = (f.x1cm!=null) ? Number(f.x1cm) : null;
        if(x0!=null && x1!=null){
          extra.push(`dł.: ${((f.lengthCm!=null)?Number(f.lengthCm):Math.abs(x1-x0)).toFixed(1)}cm`);
        } else if(f.startIndex!=null && f.endIndex!=null){
          extra.push(`Zakres: ${f.startIndex+1}→${f.endIndex+1}`);
        }
        if(f.height != null) extra.push(`wys.: ${f.height}cm`);
      }
      p.textContent = extra.join(' • ');
      meta.appendChild(b); meta.appendChild(p);

      const btns = document.createElement('div');
      const del = document.createElement('button');
      del.className='btn-danger';
      del.textContent='Usuń';
      del.onclick = ()=>{ if(confirm('Usunąć to wykończenie?')){ removeFinish(room, f.id); renderCabinets(); } };
      btns.appendChild(del);

      item.appendChild(meta);
      item.appendChild(btns);
      wrap.appendChild(item);
    });
  }
  container.appendChild(wrap);
}

function renderDrawingTab(list, room){
  ensureLayout(room);
  const pd = projectData[room];
  const seg = getActiveSegment(room);

  // ephemeral UI state
  if(!uiState.drawing){
    uiState.drawing = {
      selected: null,        // {row, index}
      zoom: 6,            // px per cm (skalowanie rysunku)
      rangeStart: null,
      hRange: null,          // {row, x0cm, x1cm}
      vRange: null,          // {x0cm,x1cm, topRow, bottomRow, rows}
      drag: null             // internal
    };
  }
  const st = uiState.drawing;

  list.innerHTML = '';

  const outer = document.createElement('div');
  outer.className = 'drawing-wrap';

  // toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'drawing-toolbar';
  toolbar.innerHTML = `
    <div class="group">
      <span class="pill">Rysunek 2D (drag & drop)</span>
      <span class="muted xs">Przeciągnij kafelki aby zmienić kolejność. Kliknij, aby dodać panel/blendę/przerwę. Shift+klik zaznacza zakres (cokół / blenda górna).</span>
    </div>
    
    <div class="group" style="margin-left:auto">
      <span class="muted xs" style="margin-right:6px">Zoom:</span>
      <button id="zoomOut" class="btn" title="Pomniejsz">−</button>
      <input id="zoomSlider" type="range" min="1" max="16" step="1" style="width:140px" />
      <button id="zoomIn" class="btn" title="Powiększ">+</button>
      <span id="zoomVal" class="pill" style="min-width:64px;text-align:center">10px/cm</span>
      <button id="drawRebuild" class="btn">↻ Odbuduj z listy szafek</button>
          </div>

  `;
  outer.appendChild(toolbar);

  // layout: stage + inspector
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '1fr';
  grid.style.gap = '12px';

  const stage = document.createElement('div');
  stage.className = 'drawing-stage';
  stage.style.position = 'relative';
  stage.style.overflowX = 'auto';
  stage.style.overflowY = 'hidden';
  stage.style.webkitOverflowScrolling = 'touch';

  const svgHost = document.createElement('div');
  svgHost.id = 'svgHost';
  stage.appendChild(svgHost);

  const inspector = document.createElement('div');
  inspector.className = 'card';
  inspector.style.margin = '0';
  inspector.style.maxWidth = '520px';
  inspector.style.justifySelf='center';
  inspector.innerHTML = `
    <h3 class="section-title" style="margin:0 0 10px 0">Inspektor</h3>
    <div id="insBody" class="muted xs">Kliknij kafelek (szafkę lub przerwę).</div>
    <div class="hr"></div>
    <h3 class="section-title" style="margin:0 0 10px 0">Wykończenia (segment)</h3>
    <div id="finList"></div>
  `;

  grid.appendChild(stage);
  grid.appendChild(inspector);
  outer.appendChild(grid);
  list.appendChild(outer);

  // toolbar actions
  toolbar.querySelector('#drawRebuild').onclick = ()=>{
    if(!confirm('Odbudować układ segmentu z aktualnej listy szafek? (Uwaga: usuwa PRZERWY w układzie, NIE usuwa wykończeń)')) return;
    seg.rows.base = [];
    seg.rows.module = [];
    seg.rows.wall = [];
    (pd.cabinets||[]).forEach(c=>{
      const row = (c.type === 'wisząca') ? 'wall' : (c.type === 'moduł' ? 'module' : 'base');
      seg.rows[row].push({ kind:'cabinet', id:c.id });
    });
    st.selected = null;
    st.rangeStart = null;
    st.hRange = null;
    st.vRange = null;
    saveProject();
    renderCabinets();
  };
  // zoom controls
  const zoomSlider = toolbar.querySelector('#zoomSlider');
  const zoomVal = toolbar.querySelector('#zoomVal');
  const zoomOut = toolbar.querySelector('#zoomOut');
  const zoomIn = toolbar.querySelector('#zoomIn');
  zoomSlider.value = String(Math.max(1, Math.min(16, Number(st.zoom)||10)));
  zoomVal.textContent = `${zoomSlider.value}px/cm`;

  function setZoom(val){
    st.zoom = Math.max(1, Math.min(16, Number(val)||10));
    FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
    renderCabinets(); // prze-renderuje rysunek z nową skalą
  }
  zoomSlider.addEventListener('input', ()=>{ zoomVal.textContent = `${zoomSlider.value}px/cm`; });
  zoomSlider.addEventListener('change', ()=> setZoom(zoomSlider.value));
  zoomOut.addEventListener('click', ()=> setZoom((Number(st.zoom)||10) - 1));
  zoomIn.addEventListener('click', ()=> setZoom((Number(st.zoom)||10) + 1));


  // helpers
  const s = pd.settings || {};
  const autoTopHeight = Math.max(0,
    (Number(s.roomHeight)||0)
    - (Number(s.bottomHeight)||0)
    - (Number(s.legHeight)||0) // w Twoim UI bottomHeight jest "z nogami", ale zostawiamy to symbolicznie
    - (Number(s.counterThickness)||0)
    - (Number(s.gapHeight)||0)
    - (Number(s.ceilingBlende)||0)
  );
  const defaultBaseH = Math.max(40, Number(s.bottomHeight)||90);
const defaultWallH = Math.max(40, autoTopHeight || 70);
const defaultModuleH = 60;

function cabHeightCm(el, fallback){
  if(!el || el.kind!=='cabinet') return fallback;
  const c = getCabById(room, el.id);
  const h = c ? Number(c.height)||0 : 0;
  return (h>0) ? h : fallback;
}
function maxRowHeightCm(rowKey, fallback){
  const arr = seg.rows[rowKey] || [];
  let mx = fallback;
  arr.forEach(el=>{
    if(el.kind==='cabinet'){
      const h = cabHeightCm(el, fallback);
      if(h>mx) mx=h;
    }
  });
  return Math.max(40, mx);
}
function elHeightCm(rowKey, el){
  const fb = (rowKey==='base') ? defaultBaseH : (rowKey==='wall') ? defaultWallH : defaultModuleH;
  if(!el) return fb;
  if(el.kind==='gap') return fb;
  return cabHeightCm(el, fb);
}

const baseH = maxRowHeightCm('base', defaultBaseH);
const wallH = maxRowHeightCm('wall', defaultWallH);
const moduleH = maxRowHeightCm('module', defaultModuleH);

// rysunek w proporcji: 1cm = SCALE px (w pionie i poziomie)
  const SCALE = Math.max(1, Math.min(16, Number(st.zoom)||10)); // px/cm (skalowanie rysunku)
  const PAD_L = 20, PAD_T = 18, PAD_R = 20, PAD_B = 18;
  const ROW_GAP = 0;
  const LABEL_H = 0; 

  const rows = [
    { key:'wall', label:'GÓRNE', hCm: wallH },
    { key:'module', label:'MODUŁY', hCm: moduleH },
    { key:'base', label:'DOLNE', hCm: baseH }
  ];

  function elWidthCm(rowKey, el){
    if(el.kind==='gap') return Number(el.width)||0;
    const c = getCabById(room, el.id);
    return c ? Number(c.width)||0 : 0;
  }
  function elLabel(rowKey, el){
    if(el.kind==='gap') return `PRZERWA ${Number(el.width)||0}cm`;
    const c = getCabById(room, el.id);
    if(!c) return `SZAFKA`;
    const t = (c.subType || c.type || 'szafka');
    return `${t} ${Number(c.width)||0}cm`;
  }

  function computePositions(rowKey){
    const arr = seg.rows[rowKey] || [];
    let x = Number(seg.offsets?.[rowKey]||0);
    const pos = [];
    for(let i=0;i<arr.length;i++){
      const w = elWidthCm(rowKey, arr[i]);
      pos.push({ index:i, el:arr[i], x0:x, x1:x+w, w });
      x += w;
    }
    return pos;
  }

  const totals = rows.map(r=>{
    const pos = computePositions(r.key);
    const last = pos[pos.length-1];
    return (last ? last.x1 : 0) + Number(seg.offsets?.[r.key]||0);
  });
  const totalCm = Math.max(60, ...totals);

  // SVG sizing
  const contentW = totalCm*SCALE;
  const contentH = rows.reduce((acc,r)=>acc + (r.hCm*SCALE) + LABEL_H, 0) + ROW_GAP*(rows.length-1);
  const vbW = PAD_L + contentW + PAD_R;
  const vbH = PAD_T + contentH + PAD_B;

  // extra left space so left-side finishes (e.g., left blend/panel) are visible
  const finishesAll = (projectData[room].finishes||[]).filter(f=>f.segmentId===seg.id);
  const maxLeftCm = finishesAll.reduce((m,f)=>{
    if((f.side==='L') && (f.type==='panel' || f.type==='blenda_pion' || f.type==='blenda_pion_full')){
      return Math.max(m, Number(f.width)||0);
    }
    return m;
  }, 0);
  const EXTRA_L = Math.max(0, Math.round(maxLeftCm*SCALE + 40));

  // widen viewport to include left overhang
  const vbW2 = vbW + EXTRA_L;


  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox', `${-EXTRA_L} 0 ${vbW2} ${vbH}`);
  svg.setAttribute('preserveAspectRatio','xMinYMin meet');
  svg.style.width = `${vbW2}px`;
  svg.style.height = `${vbH}px`;
  svg.style.display = 'block';

  // defs (subtle grid)
  const defs = document.createElementNS(svgNS,'defs');
  defs.innerHTML = `
    <pattern id="gridSmall" width="${SCALE*10}" height="${SCALE*10}" patternUnits="userSpaceOnUse">
      <path d="M ${SCALE*10} 0 L 0 0 0 ${SCALE*10}" fill="none" stroke="#eef2f7" stroke-width="1"/>
    </pattern>
  `;
  svg.appendChild(defs);
  const bg = document.createElementNS(svgNS,'rect');
  bg.setAttribute('x', -EXTRA_L); bg.setAttribute('y', 0);
  bg.setAttribute('width', vbW2); bg.setAttribute('height', vbH);
  bg.setAttribute('fill', 'url(#gridSmall)');
  bg.setAttribute('rx', 12); bg.setAttribute('ry', 12);
  bg.style.opacity = '0.7';
  svg.appendChild(bg);

  function mkText(x,y,txt,cls){
    const t = document.createElementNS(svgNS,'text');
    t.setAttribute('x',x); t.setAttribute('y',y);
    t.setAttribute('class', cls||'svg-label');
    t.textContent = txt;
    svg.appendChild(t);
    return t;
  }
  function mkRect(x,y,w,h,cls,attrs){
    const r = document.createElementNS(svgNS,'rect');
    r.setAttribute('x',x); r.setAttribute('y',y);
    r.setAttribute('width',w); r.setAttribute('height',h);
    r.setAttribute('rx',10); r.setAttribute('ry',10);
    r.setAttribute('class', cls);
    if(attrs){ Object.keys(attrs).forEach(k=>r.setAttribute(k, attrs[k])); }
    svg.appendChild(r);
    return r;
  }
  function mkGroup(attrs){
    const g = document.createElementNS(svgNS,'g');
    if(attrs){ Object.keys(attrs).forEach(k=>g.setAttribute(k, attrs[k])); }
    svg.appendChild(g);
    return g;
  }

  // range highlight (non-interactive)
  const rangeG = document.createElementNS(svgNS,'g');
  rangeG.style.pointerEvents = 'none';

  // finishes overlay (non-interactive)
  const finG = document.createElementNS(svgNS,'g');
  finG.style.pointerEvents = 'none';

  // interactive elements group
  const elG = document.createElementNS(svgNS,'g');
  svg.appendChild(elG);
  svg.appendChild(finG);
  svg.appendChild(rangeG);

  

  // Ensure overlays (range highlight + finishes) render ABOVE cabinets.
  // (Appending moves existing nodes to the end of SVG children list.)
  svg.appendChild(rangeG);
  svg.appendChild(finG);
// row y mapping (anchor countertop/reference line at default base height; taller base can extend upward)
  const rowY = {};
  // floorY = bottom of BASE row when base height == defaultBaseH
  // NOTE: keep module zone anchored; do NOT shift floorY based on tallest wall cabinet.
  const wallRefH = Number((pd.settings||{}).wallRefH)||60;
  let floorY = PAD_T
    + (LABEL_H + wallRefH*SCALE + ROW_GAP)
    + (LABEL_H + moduleH*SCALE + ROW_GAP)
    + (LABEL_H + defaultBaseH*SCALE);

  // Place BASE so its bottom stays at floorY
  rowY['base'] = floorY - (LABEL_H + baseH*SCALE);
  // Countertop/reference line is based on the ROOM default base height (not the tallest base cabinet)
  const counterY = floorY - (LABEL_H + defaultBaseH*SCALE);
  // Place MODULE so its bottom sits on the countertop/reference line
  rowY['module'] = counterY - (ROW_GAP + LABEL_H + moduleH*SCALE);
// Stack WALL above MODULE
  rowY['wall'] = rowY['module'] - (ROW_GAP + LABEL_H + wallH*SCALE);

  // If anything would go above the top padding, shift everything down
  const minY = Math.min(rowY['wall'], rowY['module'], rowY['base']);
  if(minY < PAD_T){
    const shift = PAD_T - minY;
    rowY['base'] += shift;
    rowY['module'] += shift;
    rowY['wall'] += shift;
    floorY += shift;
  }

  // Render rows
  function renderAll(){
    // clear groups
    while(elG.firstChild) elG.removeChild(elG.firstChild);
    while(rangeG.firstChild) rangeG.removeChild(rangeG.firstChild);
    while(finG.firstChild) finG.removeChild(finG.firstChild);
    // (row labels hidden)
    // range highlight
    if(st.hRange && st.hRange.row){
      const row = st.hRange.row;
      const x0cm = Number(st.hRange.x0cm)||0;
      const x1cm = Number(st.hRange.x1cm)||0;
      const x0 = PAD_L + Math.min(x0cm,x1cm)*SCALE;
      const x1 = PAD_L + Math.max(x0cm,x1cm)*SCALE;
      const hcm = (row==='wall'?wallH:(row==='module'?moduleH:baseH));
      const y = rowY[row] + LABEL_H - 6;
      const h = hcm*SCALE + 12;
      const rr = document.createElementNS(svgNS,'rect');
      rr.setAttribute('x', x0);
      rr.setAttribute('y', y);
      rr.setAttribute('width', Math.max(8, x1-x0));
      rr.setAttribute('height', h);
      rr.setAttribute('rx', 14); rr.setAttribute('ry', 14);
      rr.setAttribute('class','svg-range');
      rangeG.appendChild(rr);
    }
// vertical range highlight (od dołu do góry)
if(st.vRange && st.vRange.x1cm > st.vRange.x0cm){
  const x0 = PAD_L + st.vRange.x0cm*SCALE;
  const x1 = PAD_L + st.vRange.x1cm*SCALE;
  const topRow = st.vRange.topRow || 'wall';
  const bottomRow = st.vRange.bottomRow || 'base';
  const y0 = rowY[topRow] + LABEL_H - 6;
  const y1 = rowY[bottomRow] + LABEL_H + ((rows.find(rr=>rr.key===bottomRow)?.hCm)||60)*SCALE + 6;
  const rr = document.createElementNS(svgNS,'rect');
  rr.setAttribute('x', x0);
  rr.setAttribute('y', Math.min(y0,y1));
  rr.setAttribute('width', Math.max(8, x1-x0));
  rr.setAttribute('height', Math.max(10, Math.abs(y1-y0)));
  rr.setAttribute('rx', 14); rr.setAttribute('ry', 14);
  rr.setAttribute('fill', 'rgba(14,165,233,0.08)');
  rr.setAttribute('stroke', 'rgba(14,165,233,0.65)');
  rr.setAttribute('stroke-width', '2');
  rangeG.appendChild(rr);
}
    // elements
    const drawOrder = (projectData[room].layout && Array.isArray(projectData[room].layout.zOrderRows)) ? projectData[room].layout.zOrderRows : ['base','module','wall'];
    drawOrder.forEach(rowKey=>{
      const r = rows.find(rr=>rr.key===rowKey);
      if(!r) return;
      const row = r.key;
      const pos = computePositions(row);
      pos.forEach(p=>{
        const x = PAD_L + p.x0*SCALE;
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (r.hCm - elHcm))*SCALE;
        const w = Math.max(24, p.w*SCALE);
        const h = Math.max(10, elHcm*SCALE);
        const g = document.createElementNS(svgNS,'g');
        g.setAttribute('data-row', row);
        g.setAttribute('data-index', String(p.index));
        g.setAttribute('data-kind', p.el.kind);
        g.setAttribute('data-id', p.el.id || '');
        g.style.cursor = 'grab';

        const isSel = st.selected && st.selected.row===row && st.selected.index===p.index;
        const rect = document.createElementNS(svgNS,'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', 12); rect.setAttribute('ry', 12);
        rect.setAttribute('fill', p.el.kind==='gap' ? '#fff' : '#eaf6ff');
        rect.setAttribute('stroke', isSel ? '#0ea5e9' : (p.el.kind==='gap' ? '#94a3b8' : '#8fd3ff'));
        rect.setAttribute('stroke-width', isSel ? '3' : '2');
        if(p.el.kind==='gap'){
          rect.setAttribute('stroke-dasharray', '6 4');
        }

        g.appendChild(rect);

        // drag handle (mobile)
        if(p.el.kind!=='gap'){
          const grip = document.createElementNS(svgNS,'rect');
          grip.setAttribute('x', x + w - 20);
          grip.setAttribute('y', y + 6);
          grip.setAttribute('width', 14);
          grip.setAttribute('height', 14);
          grip.setAttribute('rx', 3); grip.setAttribute('ry', 3);
          grip.setAttribute('fill', '#0ea5e9');
          grip.setAttribute('data-grip','1');
          grip.style.cursor = 'grab';
          grip.style.touchAction = 'none';
          g.appendChild(grip);

          const gripTxt = document.createElementNS(svgNS,'text');
          gripTxt.setAttribute('x', x + w - 17);
          gripTxt.setAttribute('y', y + 17);
          gripTxt.setAttribute('fill', '#fff');
          gripTxt.setAttribute('font-size','12');
          gripTxt.setAttribute('font-weight','900');
          gripTxt.setAttribute('pointer-events','none');
          gripTxt.textContent = '≡';
          g.appendChild(gripTxt);
        }

        const text = document.createElementNS(svgNS,'text');
        text.setAttribute('x', x + 8);
        text.setAttribute('y', y + 18);
        text.setAttribute('class', 'svg-label');
        text.textContent = elLabel(row, p.el);

        g.appendChild(text);
        elG.appendChild(g);

        // pointer handlers for drag & click
        g.addEventListener('pointerdown', (ev)=>{
          const isGrip = (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-grip')==='1');
          const isMouse = (ev.pointerType === 'mouse');
          const isTouch = !isMouse;
          // Drag only from grip on touch; mouse can drag from anywhere
          if(!isGrip && !isMouse){
            return;
          }

          try{ ev.preventDefault(); }catch(_){}
          g.setPointerCapture(ev.pointerId);
          st.drag = {
            pointerId: ev.pointerId,
            row,
            startIndex: p.index,
            startClientX: ev.clientX,
            moved: false,
            startPxX: x,
            gEl: g
          };
          g.style.cursor = 'grabbing';
        });

        g.addEventListener('pointermove', (ev)=>{
          // cancel long-press if user moves finger
          if(st._lp && st._lp.pointerId === ev.pointerId && !st._lp.fired){
            const dx0 = ev.clientX - st._lp.startX;
            const dy0 = ev.clientY - st._lp.startY;
            if(Math.abs(dx0) > 6 || Math.abs(dy0) > 6){
              clearTimeout(st._lp.timer);
              st._lp = null;
            }
          }

          if(!st.drag || st.drag.pointerId !== ev.pointerId) return;
          const dx = ev.clientX - st.drag.startClientX;
          if(Math.abs(dx) > 4) st.drag.moved = true;
          // translate group visually
          g.setAttribute('transform', `translate(${dx},0)`);
        });

        g.addEventListener('pointerup', (ev)=>{
          // clear long-press timer (if any)
          if(st._lp && st._lp.pointerId === ev.pointerId){
            const fired = st._lp.fired;
            clearTimeout(st._lp.timer);
            st._lp = null;
            // if long-press fired, do not also treat this as a click
            if(fired) return;
          }

          // TAP without drag context (common on mobile because we only start drag from the grip)
          if(!st.drag || st.drag.pointerId !== ev.pointerId){
            // prevent accidental "tap after drag" triggering click
            if(st._justDragged && (Date.now() - st._justDragged) < 220) return;
            handleClick(row, p.index, ev.shiftKey);
            return;
          }

          const drag = st.drag;
          g.releasePointerCapture(ev.pointerId);
          g.style.cursor = 'grab';
          const dx = ev.clientX - drag.startClientX;
          g.removeAttribute('transform');
          st.drag = null;
          st._justDragged = drag.moved ? Date.now() : 0;

          if(!drag.moved){
            handleClick(row, p.index, ev.shiftKey);
            return;
          }

          // commit reorder
          commitReorder(row, drag.startIndex, dx);
        });

        g.addEventListener('pointercancel', ()=>{
          if(st._lp){
            try{ clearTimeout(st._lp.timer); }catch(_){}
            st._lp = null;
          }
          if(st.drag && st.drag.gEl === g){
            g.removeAttribute('transform');
            g.style.cursor='grab';
            st.drag = null;
          }
        });

        // Fallback click handler (some Android viewers are flaky with pointerup on SVG)
        g.addEventListener('click', (ev)=>{
          if(st._justDragged && (Date.now() - st._justDragged) < 250) return;
          handleClick(row, p.index, !!ev.shiftKey);
        });

        // Touch fallback for drag & drop on mobile (when PointerEvents are not delivered properly)
        let _touchActive = false;
        g.addEventListener('touchstart', (ev)=>{
          const t = ev.touches && ev.touches[0];
          if(!t) return;
          const isGrip = (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-grip')==='1');
          if(!isGrip) return; // drag only from grip to keep horizontal scroll usable
          _touchActive = true;
          try{ ev.preventDefault(); }catch(_){}
          st.drag = {
            pointerId: 'touch',
            row,
            startIndex: p.index,
            startClientX: t.clientX,
            moved: false,
            startPxX: x,
            gEl: g
          };
          g.style.cursor = 'grabbing';
        }, {passive:false});

        g.addEventListener('touchmove', (ev)=>{
          if(!_touchActive || !st.drag || st.drag.pointerId !== 'touch' || st.drag.gEl !== g) return;
          const t = ev.touches && ev.touches[0];
          if(!t) return;
          try{ ev.preventDefault(); }catch(_){}
          const dx = t.clientX - st.drag.startClientX;
          if(Math.abs(dx) > 4) st.drag.moved = true;
          g.setAttribute('transform', `translate(${dx},0)`);
        }, {passive:false});

        function _touchEnd(ev){
          if(!_touchActive) return;
          _touchActive = false;
          if(!st.drag || st.drag.pointerId !== 'touch' || st.drag.gEl !== g) return;
          try{ ev.preventDefault(); }catch(_){}
          const drag = st.drag;
          const t = (ev.changedTouches && ev.changedTouches[0]) || null;
          const clientX = t ? t.clientX : drag.startClientX;
          const dx = clientX - drag.startClientX;
          g.removeAttribute('transform');
          g.style.cursor = 'grab';
          st.drag = null;
          st._justDragged = drag.moved ? Date.now() : 0;

          if(!drag.moved){
            handleClick(row, p.index, false);
            return;
          }
          commitReorder(row, drag.startIndex, dx);
        }
        g.addEventListener('touchend', _touchEnd, {passive:false});
        g.addEventListener('touchcancel', _touchEnd, {passive:false});
      });
    });


    // gap marks overlay (X) — keep gaps visible even if covered by another row
    rows.forEach(rr=>{
      const row = rr.key;
      const pos = computePositions(row);
      pos.forEach(p=>{
        if(p.el.kind!=='gap') return;
        const x = PAD_L + p.x0*SCALE;
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (rr.hCm - elHcm))*SCALE;
        const w = Math.max(24, p.w*SCALE);
        const h = Math.max(10, elHcm*SCALE);
        const inset = 8;
        const x0 = x + inset, x1 = x + w - inset;
        const y0 = y + inset, y1 = y + h - inset;

        const l1 = document.createElementNS(svgNS,'line');
        l1.setAttribute('x1', x0); l1.setAttribute('y1', y0);
        l1.setAttribute('x2', x1); l1.setAttribute('y2', y1);
        l1.setAttribute('stroke', '#94a3b8');
        l1.setAttribute('stroke-width', '2');
        finG.appendChild(l1);

        const l2 = document.createElementNS(svgNS,'line');
        l2.setAttribute('x1', x0); l2.setAttribute('y1', y1);
        l2.setAttribute('x2', x1); l2.setAttribute('y2', y0);
        l2.setAttribute('stroke', '#94a3b8');
        l2.setAttribute('stroke-width', '2');
        finG.appendChild(l2);
      });
    });

    // finishes overlays (after elements so they appear on top, but non-interactive)
    const finishes = (pd.finishes||[]).filter(f=>f.segmentId===seg.id);
    finishes.forEach(f=>{
      if(f.type==='panel' || f.type==='blenda_pion'){
        const row = f.row;
        const idx = f.index;
        const pos = computePositions(row);
        const p = pos[idx];
        if(!p) return;
        const baseX0 = PAD_L + p.x0*SCALE;
        const baseX1 = PAD_L + p.x1*SCALE;
        const rowCfg = rows.find(rr=>rr.key===row);
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (((rowCfg?.hCm||elHcm) - elHcm)))*SCALE;

        // Panele boczne: wydłuż o cokół (dolne) lub blendę górną (górne)
        const s = (pd.settings || {});
        let addHcm = 0;
        if(f.type==='panel'){
          if(row==='base') addHcm = Number(s.legHeight)||0;
          if(row==='wall') addHcm = Number(s.ceilingBlende)||0;
        }

        // dla górnych panel wydłużamy do góry (odejmujemy od y)
        if(f.type==='panel' && row==='wall' && addHcm>0){
          y = Math.max(0, y - addHcm*SCALE);
        }

        const h = Math.max(10, (elHcm + (addHcm||0))*SCALE);
        const w = Math.max(8, (Number(f.width)||2)*SCALE);
        const x = (f.side==='L') ? (baseX0 - w) : baseX1;
        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);
        rr.setAttribute('fill', f.type==='panel' ? 'rgba(2,132,199,0.35)' : 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', f.type==='panel' ? 'rgba(2,132,199,0.85)' : 'rgba(14,165,233,0.55)');
        rr.setAttribute('stroke-width', '2');
        finG.appendChild(rr);
      }

      if(f.type==='blenda_pion_full'){
        const x0cm = Number(f.x0cm)||0;
        const x1cm = Number(f.x1cm)||0;
        const wcm = Number(f.width)||2;
        const side = f.side || 'R';
        const x0 = PAD_L + x0cm*SCALE;
        const x1 = PAD_L + x1cm*SCALE;
        const w = Math.max(8, wcm*SCALE);
        const x = (side==='L') ? (x0 - w) : x1;

        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        if(rowY[topRow]==null || rowY[bottomRow]==null) return;

        const topY = rowY[topRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        const bottomY = rowY[bottomRow] + LABEL_H + botHcm*SCALE;

        const y = Math.min(topY, bottomY);
        const h = Math.max(10, Math.abs(bottomY - topY));

        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);
        rr.setAttribute('fill', 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', 'rgba(14,165,233,0.85)');
        rr.setAttribute('stroke-width', '3');
        finG.appendChild(rr);
      }

      if(f.type==='cokol' || f.type==='blenda_gorna'){
        const row = f.row;
        const pos = computePositions(row);

        let x0cm = (f.x0cm!=null) ? Number(f.x0cm) : null;
        let x1cm = (f.x1cm!=null) ? Number(f.x1cm) : null;

        // fallback: legacy indices
        if(x0cm==null || x1cm==null){
          const a = Math.max(0, Math.min(f.startIndex, f.endIndex));
          const b = Math.min(pos.length-1, Math.max(f.startIndex, f.endIndex));
          if(!pos[a] || !pos[b]) return;
          x0cm = pos[a].x0;
          x1cm = pos[b].x1;
        }

        const span0 = Math.min(x0cm,x1cm);
        const span1 = Math.max(x0cm,x1cm);

        let lenCm = (f.lengthCm!=null) ? Number(f.lengthCm)||0 : (span1 - span0);
        if(f.lengthCm==null && f.includeGaps === false){
          lenCm = 0;
          pos.forEach(pp=>{
            if(pp.el.kind!=='cabinet') return;
            const ov = Math.min(pp.x1, span1) - Math.max(pp.x0, span0);
            if(ov>0) lenCm += ov;
          });
        }

        const px0 = PAD_L + span0*SCALE;
        const pxW = Math.max(10, lenCm*SCALE);
        const isCokol = (f.type==='cokol');
        const yBase = rowY[row] + LABEL_H + (row==='wall' ? wallH : baseH)*SCALE;
        const y = isCokol ? (yBase + 8) : Math.max(2, (rowY[row] + LABEL_H - 14));
        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', px0);
        rr.setAttribute('y', y);
        rr.setAttribute('width', pxW);
        rr.setAttribute('height', 10);
        rr.setAttribute('rx', 8); rr.setAttribute('ry', 8);
        rr.setAttribute('fill', isCokol ? 'rgba(2,132,199,0.35)' : 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', isCokol ? 'rgba(2,132,199,0.85)' : 'rgba(14,165,233,0.55)');
        rr.setAttribute('stroke-width', '2');
        finG.appendChild(rr);
      }
    });
  }

  function handleClick(row, index, isShift){
    const arr = seg.rows[row] || [];
    if(!arr[index]) return;
    st.selected = { row, index };
    // Zakresy są sterowane przyciskami START/KONIEC + "Wyczyść zakres"
    // Nie kasujemy ich automatycznie przy zwykłym kliknięciu (mobile UX).
    saveProject();
    renderCabinets();
  }


function commitReorder(row, fromIndex, dxPx){
    const arr = seg.rows[row] || [];
    if(fromIndex < 0 || fromIndex >= arr.length) return;
    const pos = computePositions(row);
    const item = arr[fromIndex];
    const w = (pos[fromIndex] ? pos[fromIndex].w : elWidthCm(row, item));
    const startX0 = pos[fromIndex] ? pos[fromIndex].x0 : 0;
    const newCenterCm = (startX0 + w/2) + (dxPx / SCALE);

    // remove item
    arr.splice(fromIndex, 1);

    // compute insertion index by scanning midpoints
    let insertAt = arr.length;
    let x = Number(seg.offsets?.[row]||0);
    for(let i=0;i<arr.length;i++){
      const wi = elWidthCm(row, arr[i]);
      const mid = x + wi/2;
      if(newCenterCm < mid){
        insertAt = i;
        break;
      }
      x += wi;
    }
    arr.splice(insertAt, 0, item);

    // after reorder, keep selection on the moved item
    st.selected = { row, index: insertAt };
    st.hRange = null;

    saveProject();
    renderCabinets();
  }

  // Inspector rendering
  const insBody = inspector.querySelector('#insBody');
  const finList = inspector.querySelector('#finList');

  function renderInspector(){
    const sel = st.selected;
    if(!sel){
      insBody.innerHTML = `<div class="muted xs">Kliknij kafelek (szafkę lub przerwę).<br/>Zaznacz zakres: Ustaw START i KONIEC.</div>`;
      return;
    }
    const row = sel.row;
    const el = (seg.rows[row]||[])[sel.index];
    if(!el){
      insBody.innerHTML = `<div class="muted xs">Brak elementu.</div>`;
      return;
    }

    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.marginBottom = '8px';
    title.textContent = (el.kind==='gap')
      ? `PRZERWA • ${Number(el.width)||0}cm • ${humanRow(row)}`
      : `${(getCabById(room, el.id)?.subType || getCabById(room, el.id)?.type || 'Szafka')} • ${Number(getCabById(room, el.id)?.width)||0}cm • ${humanRow(row)}`;

    const box = document.createElement('div');
    box.innerHTML = '';
    box.appendChild(title);

    // Layer order controls (row z-order)
    const zWrap = document.createElement('div');
    zWrap.style.display='flex';
    zWrap.style.gap='8px';
    zWrap.style.alignItems='center';
    zWrap.style.margin='0 0 10px 0';
    const zLbl = document.createElement('div');
    zLbl.className='muted xs';
    zLbl.textContent = 'Warstwa: ' + humanRow(row);
    const btnUp = document.createElement('button');
    btnUp.className='btn';
    btnUp.textContent='▲ wyżej';
    const btnDn = document.createElement('button');
    btnDn.className='btn';
    btnDn.textContent='▼ niżej';
    btnUp.onclick = ()=>{
      const lo = projectData[room].layout;
      const arr = (lo && Array.isArray(lo.zOrderRows)) ? lo.zOrderRows.slice() : ['base','module','wall'];
      const i = arr.indexOf(row);
      // wyżej = bardziej na wierzch (rysowane później)
      if(i>=0 && i < arr.length-1){ const t=arr[i+1]; arr[i+1]=arr[i]; arr[i]=t; }
      if(lo) lo.zOrderRows = arr;
      saveProject();
      renderCabinets();
    };
    btnDn.onclick = ()=>{
      const lo = projectData[room].layout;
      const arr = (lo && Array.isArray(lo.zOrderRows)) ? lo.zOrderRows.slice() : ['base','module','wall'];
      const i = arr.indexOf(row);
      // niżej = bardziej pod spodem (rysowane wcześniej)
      if(i>0){ const t=arr[i-1]; arr[i-1]=arr[i]; arr[i]=t; }
      if(lo) lo.zOrderRows = arr;
      saveProject();
      renderCabinets();
    };
    zWrap.appendChild(zLbl);
    zWrap.appendChild(btnUp);
    zWrap.appendChild(btnDn);
    box.appendChild(zWrap);

    // Zakres (START/END) — mobile-friendly
    const rSel = document.createElement('div');
    rSel.style.display='flex';
    rSel.style.flexDirection='column';
    rSel.style.gap='8px';
    rSel.style.margin='0 0 12px 0';

    const rInfo = document.createElement('div');
    rInfo.className='muted xs';
    const rs = st.rangeStart;
    const rTxt = [];
    if(rs){
      const aEl = (seg.rows[rs.row]||[])[rs.index];
      const aLbl = aEl ? (aEl.kind==='gap' ? 'PRZERWA' : (getCabById(room, aEl.id)?.subType || getCabById(room, aEl.id)?.type || 'Szafka')) : '—';
      rTxt.push('START: ' + aLbl + ' (' + humanRow(rs.row) + ')');
    }
    if(st.hRange){
      const len = Math.abs((Number(st.hRange.x1cm)||0) - (Number(st.hRange.x0cm)||0));
      rTxt.push('ZAKRES: ' + humanRow(st.hRange.row) + ' • dł.: ' + len.toFixed(1) + 'cm');
    }
    if(st.vRange){
      rTxt.push('ZAKRES PION: ' + humanRow(st.vRange.topRow) + '→' + humanRow(st.vRange.bottomRow));
    }
    rInfo.textContent = rTxt.length ? rTxt.join(' • ') : 'Zakres: ustaw START i KONIEC.';

    const rBtns = document.createElement('div');
    rBtns.style.display='flex';
    rBtns.style.gap='8px';
    rBtns.style.flexWrap='wrap';

    const bStart = document.createElement('button');
    bStart.className='btn';
    bStart.textContent='Ustaw START';
    bStart.onclick = ()=>{
      if(el.kind==='gap'){ alert('START nie może być przerwą. Wybierz szafkę.'); return; }
      st.rangeStart = { row, index: sel.index };
      st.hRange = null;
      st.vRange = null;
      saveProject();
      renderCabinets();
    };

    const bEnd = document.createElement('button');
    bEnd.className='btn-primary';
    bEnd.textContent='Ustaw KONIEC';
    bEnd.onclick = ()=>{
      if(el.kind==='gap'){ alert('KONIEC nie może być przerwą. Wybierz szafkę.'); return; }
      if(!st.rangeStart){
        st.rangeStart = { row, index: sel.index };
        st.hRange = null;
        st.vRange = null;
        saveProject();
        renderCabinets();
        return;
      }
      const a = st.rangeStart;
      // same row => horizontal range (tak jak pion: po X)
      if(a.row === row){
        const pos = computePositions(row);
        const pa = pos[a.index];
        const pb = pos[sel.index];
        if(pa && pb){
          const x0cm = Math.min(pa.x0, pb.x0);
          const x1cm = Math.max(pa.x1, pb.x1);
          // Blendy/cokół tylko po ciągłych szafkach – bez przerw w środku
          const i0 = Math.min(a.index, sel.index);
          const i1 = Math.max(a.index, sel.index);
          const rowEls = (seg.rows[row]||[]);
          let hasGap = false;
          for(let i=i0;i<=i1;i++){ if(rowEls[i] && rowEls[i].kind==='gap'){ hasGap=true; break; } }
          if(hasGap){
            alert('Zakres zawiera przerwę. Blendy/cokół można dodać tylko na ciągłych szafkach.');
            st.rangeStart = { row, index: sel.index };
            st.hRange = null; st.vRange = null;
            saveProject(); renderCabinets();
            return;
          }
          st.hRange = { row, x0cm, x1cm, startIndex: a.index, endIndex: sel.index };
          st.vRange = null;
        } else {
          st.rangeStart = { row, index: sel.index };
          st.hRange = null;
          st.vRange = null;
          saveProject();
          renderCabinets();
          return;
        }
      } else {
        const posA = computePositions(a.row);
        const posB = computePositions(row);
        const pa = posA[a.index];
        const pb = posB[sel.index];
        if(pa && pb){
          const x0cm = Math.max(pa.x0, pb.x0);
          const x1cm = Math.min(pa.x1, pb.x1);
          if(x1cm > x0cm){
            const order = ['wall','module','base']; // top -> bottom
            const ia = order.indexOf(a.row);
            const ib = order.indexOf(row);
            const topRow = order[Math.min(ia, ib)];
            const bottomRow = order[Math.max(ia, ib)];
            const rowsIncl = order.slice(Math.min(ia, ib), Math.max(ia, ib)+1);
            // Blenda pion pełna tylko jeżeli w kolumnie nie ma przerw w żadnym z rzędów
            let hasGapV = false;
            for(const rk of rowsIncl){
              const posR = computePositions(rk);
              const elsR = (seg.rows[rk]||[]);
              for(let i=0;i<elsR.length;i++){
                if(elsR[i].kind==='gap'){
                  const pr = posR[i];
                  if(pr && pr.x1 > x0cm && pr.x0 < x1cm){ hasGapV = true; break; }
                }
              }
              if(hasGapV) break;
            }
            if(hasGapV){
              alert('Zakres pionowy przechodzi przez przerwę. Blendy można dodać tylko na ciągłych szafkach.');
              st.rangeStart = { row, index: sel.index };
              st.hRange = null; st.vRange = null;
              saveProject(); renderCabinets();
              return;
            }
            st.vRange = { x0cm, x1cm, topRow, bottomRow, rows: rowsIncl };
            st.hRange = null;
          } else {
            // no overlap => reset start to this
            st.rangeStart = { row, index: sel.index };
            st.hRange = null;
            st.vRange = null;
            saveProject();
            renderCabinets();
            return;
          }
        }
      }
      st.rangeStart = null;
      saveProject();
      renderCabinets();
    };

    const bClear = document.createElement('button');
    bClear.className='btn';
    bClear.textContent='Wyczyść zakres';
    bClear.onclick = ()=>{
      st.rangeStart = null;
      st.hRange = null;
      st.vRange = null;
      saveProject();
      renderCabinets();
    };

    rBtns.appendChild(bStart);
    rBtns.appendChild(bEnd);
    rBtns.appendChild(bClear);

    rSel.appendChild(rInfo);
    rSel.appendChild(rBtns);
    box.appendChild(rSel);


// Vertical range actions (od dołu do góry)
if(st.vRange && st.vRange.x1cm > st.vRange.x0cm){
  const vr = st.vRange;
  const rowDiv = document.createElement('div');
  rowDiv.style.display='flex';
  rowDiv.style.flexDirection='column';
  rowDiv.style.gap='8px';
  rowDiv.style.marginBottom='10px';

  const info = document.createElement('div');
  info.className='muted xs';
  info.textContent = `Zakres pionowy: ${humanRow(vr.topRow)} → ${humanRow(vr.bottomRow)} (kolumna)`;
  rowDiv.appendChild(info);

  // Opcje zakresu pionowego (mobile-friendly): co doliczać do wysokości
  if(vr.includeTopBlende === undefined){
    // domyślnie: jeśli w kolumnie są GÓRNE, dolicz blendę górną
    vr.includeTopBlende = true;
  }
  if(vr.includePlinth === undefined){
    // domyślnie: jeśli zakres obejmuje DOLNE, dolicz cokół
    vr.includePlinth = (Array.isArray(vr.rows)? vr.rows.includes('base') : (vr.bottomRow==='base' || vr.topRow==='base'));
  }
  const optWrap = document.createElement('div');
  optWrap.style.display='flex';
  optWrap.style.flexWrap='wrap';
  optWrap.style.gap='8px';

  const btnTopOpt = document.createElement('button');
  btnTopOpt.className='btn';
  const paintTop = ()=>{ btnTopOpt.textContent = 'Blenda górna: ' + (vr.includeTopBlende ? 'TAK' : 'NIE'); };
  paintTop();
  btnTopOpt.onclick = ()=>{ vr.includeTopBlende = !vr.includeTopBlende; paintTop(); saveProject(); renderCabinets(); };

  const btnPlOpt = document.createElement('button');
  btnPlOpt.className='btn';
  const paintPl = ()=>{ btnPlOpt.textContent = 'Cokół: ' + (vr.includePlinth ? 'TAK' : 'NIE'); };
  paintPl();
  btnPlOpt.onclick = ()=>{ vr.includePlinth = !vr.includePlinth; paintPl(); saveProject(); renderCabinets(); };

  optWrap.appendChild(btnTopOpt);
  optWrap.appendChild(btnPlOpt);
  rowDiv.appendChild(optWrap);

  const btnL = document.createElement('button');
  btnL.className='btn-primary';
  btnL.textContent='Dodaj blendę pion pełna (lewa)';
  btnL.onclick = ()=>{
    const w = parseFloat(prompt('Szerokość blendy (cm):','5')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'blenda_pion_full', segmentId:seg.id, side:'L', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnR = document.createElement('button');
  btnR.className='btn-primary';
  btnR.textContent='Dodaj blendę pion pełna (prawa)';
  btnR.onclick = ()=>{
    const w = parseFloat(prompt('Szerokość blendy (cm):','5')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'blenda_pion_full', segmentId:seg.id, side:'R', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnC = document.createElement('button');
  btnC.className='btn';
  btnC.textContent='Wyczyść zakres pionowy';
  btnC.onclick = ()=>{ st.vRange=null; saveProject(); renderCabinets(); };

    const btnPL = document.createElement('button');
  btnPL.className='btn';
  btnPL.textContent='Dodaj panel pełny (lewy)';
  btnPL.onclick = ()=>{
    const w = parseFloat(prompt('Grubość panela (cm):','1.8')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'panel_pion_full', segmentId:seg.id, side:'L', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnPR = document.createElement('button');
  btnPR.className='btn';
  btnPR.textContent='Dodaj panel pełny (prawy)';
  btnPR.onclick = ()=>{
    const w = parseFloat(prompt('Grubość panela (cm):','1.8')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'panel_pion_full', segmentId:seg.id, side:'R', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };
rowDiv.appendChild(btnL);
  rowDiv.appendChild(btnR);
  rowDiv.appendChild(btnC);

  box.appendChild(rowDiv);
}
    // Range actions
    if(st.hRange && st.hRange.row===row){
      const r = st.hRange;
      const btn1 = document.createElement('button');
      btn1.className='btn-primary';
      btn1.textContent = (row==='base') ? 'Dodaj cokół na zakresie' : (row==='wall') ? 'Dodaj blendę górną na zakresie' : 'Zakres w modułach: brak akcji';
      if(row==='module'){ btn1.disabled = true; btn1.className='btn'; }
      btn1.onclick = ()=>{
        // długość zakresu liczona jako suma szerokości SZAFEK w zakresie (bez przerw)
        const x0 = Math.min(Number(r.x0cm)||0, Number(r.x1cm)||0);
        const x1 = Math.max(Number(r.x0cm)||0, Number(r.x1cm)||0);
        let lenCm = 0;
        if(r.startIndex!=null && r.endIndex!=null){
          const i0 = Math.min(r.startIndex, r.endIndex);
          const i1 = Math.max(r.startIndex, r.endIndex);
          const rowEls = (seg.rows[row]||[]);
          for(let i=i0;i<=i1;i++){
            const e = rowEls[i];
            if(!e || e.kind!=='cabinet') continue;
            const c = getCabById(room, e.id);
            lenCm += (c ? Number(c.width)||0 : 0);
          }
        } else {
          const pos = computePositions(row);
          pos.forEach(pp=>{
            if(!pp || !pp.el || pp.el.kind!=='cabinet') return;
            const ov = Math.min(pp.x1, x1) - Math.max(pp.x0, x0);
            if(ov>0) lenCm += ov;
          });
        }
addFinish(room, {
          type: (row==='base') ? 'cokol' : 'blenda_gorna',
          segmentId: seg.id,
          row,
          startIndex: r.startIndex,
          endIndex: r.endIndex,
          x0cm: x0,
          x1cm: x1,
          lengthCm: Number(lenCm.toFixed(1)),
          includeGaps: false
        });
        st.hRange = null;
        saveProject();
        renderCabinets();
      };
      const btn2 = document.createElement('button');
      btn2.className='btn';
      btn2.textContent='Wyczyść zakres';
      btn2.onclick = ()=>{ st.hRange=null; saveProject(); renderCabinets(); };

      const rowDiv = document.createElement('div');
      rowDiv.style.display='flex';
      rowDiv.style.flexDirection='column';
      rowDiv.style.gap='8px';
      rowDiv.appendChild(btn1);
      rowDiv.appendChild(btn2);
      box.appendChild(rowDiv);

      insBody.innerHTML = '';
      insBody.appendChild(box);
      return;
    }

    // Element actions

    const actions = document.createElement('div');
    actions.style.display='flex';
    actions.style.flexDirection='column';
    actions.style.gap='8px';

    function askWidth(def){ return parseFloat(prompt('Szerokość (cm):', String(def)) || '0'); }

    if(el.kind==='cabinet'){
      const btnPL = document.createElement('button');
      btnPL.className='btn';
      btnPL.textContent='Dodaj panel lewy';
      btnPL.onclick = ()=>{
        const w = askWidth(1.8); if(!(w>0)) return;
        addFinish(room, { type:'panel', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'L', width:w });
        renderCabinets();
      };
      const btnPR = document.createElement('button');
      btnPR.className='btn';
      btnPR.textContent='Dodaj panel prawy';
      btnPR.onclick = ()=>{
        const w = askWidth(1.8); if(!(w>0)) return;
        addFinish(room, { type:'panel', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'R', width:w });
        renderCabinets();
      };
      const btnBL = document.createElement('button');
      btnBL.className='btn';
      btnBL.textContent='Dodaj blendę pion lewa';
      btnBL.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        addFinish(room, { type:'blenda_pion', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'L', width:w });
        renderCabinets();
      };
      const btnBR = document.createElement('button');
      btnBR.className='btn';
      btnBR.textContent='Dodaj blendę pion prawa';
      btnBR.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        addFinish(room, { type:'blenda_pion', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'R', width:w });
        renderCabinets();
      };
      const btnGapA = document.createElement('button');
      btnGapA.className='btn';
      btnGapA.textContent='Wstaw przerwę po prawej';
      btnGapA.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        insertGapAfter(room, seg, row, sel.index, w);
        renderCabinets();
      };

      actions.appendChild(btnPL);
      actions.appendChild(btnPR);
      actions.appendChild(btnBL);
      actions.appendChild(btnBR);
      actions.appendChild(btnGapA);
    } else {
      // gap
      const btnEdit = document.createElement('button');
      btnEdit.className='btn';
      btnEdit.textContent='Zmień szerokość przerwy';
      btnEdit.onclick = ()=>{
        const w = askWidth(Number(el.width)||5);
        if(!(w>0)) return;
        el.width = w;
        saveProject();
        renderCabinets();
      };
      const btnDel = document.createElement('button');
      btnDel.className='btn-danger';
      btnDel.textContent='Usuń przerwę';
      btnDel.onclick = ()=>{
        if(!confirm('Usunąć przerwę?')) return;
        (seg.rows[row]||[]).splice(sel.index,1);
        st.selected = null;
        saveProject();
        renderCabinets();
      };
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
    }

    box.appendChild(actions);
    insBody.innerHTML = '';
    insBody.appendChild(box);
  }

  function renderFinishListPanel(){
    const segFin = (pd.finishes||[]).filter(f=>f.segmentId===seg.id);
    finList.innerHTML = '';
    if(segFin.length===0){
      finList.innerHTML = `<div class="muted xs">Brak.</div>`;
      return;
    }
    segFin.forEach(f=>{
      const row = document.createElement('div');
      row.className = 'finish-item';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const b = document.createElement('b');
      b.textContent = finishLabel(f);
      const p = document.createElement('p');
      p.className = 'muted xs';
      p.style.margin='0';
      let extra = [];
      const s = pd.settings || {};

      const fmt = (n)=> {
        const v = Number(n);
        if(!isFinite(v)) return '0';
        // keep one decimal if needed
        return (Math.round(v*10)/10).toString();
      };

      if(f.type==='panel' || f.type==='blenda_pion'){
        const rowKey = f.row;
        const idx = Number(f.index)||0;
        const arr = seg.rows[rowKey] || [];
        const el = arr[idx] || null;
        const hCm = elHeightCm(rowKey, el);
        const wCm = Number(f.width)||0;
        extra.push(`${humanRow(rowKey)} • #${idx+1} • ${f.side} • szer ${fmt(wCm)}cm • wys ${fmt(hCm)}cm`);
      } else if(f.type==='blenda_pion_full'){
        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        const side = f.side || 'R';
        const wCm = Number(f.width)||0;

        const topY = rowY[topRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        const bottomY = rowY[bottomRow] + LABEL_H + botHcm*SCALE;
        const hCm = Math.abs(bottomY - topY)/SCALE;

        extra.push(`kolumna ${humanRow(topRow)}→${humanRow(bottomRow)} • ${side} • szer ${fmt(wCm)}cm • wys ${fmt(hCm)}cm`);
      } else if(f.type==='cokol' || f.type==='blenda_gorna'){
        const rowKey = f.row;
        const pos = computePositions(rowKey);
        const a = Math.max(0, Math.min(Number(f.startIndex)||0, Number(f.endIndex)||0));
        const b = Math.min(pos.length-1, Math.max(Number(f.startIndex)||0, Number(f.endIndex)||0));

        let lenCm = (isFinite(Number(f.lengthCm)) && Number(f.lengthCm)>0) ? Number(f.lengthCm) : NaN;
        if(pos[a] && pos[b]){
          if(!isFinite(lenCm)){
            if(f.includeGaps === false){
              lenCm = 0;
              for(let i=a;i<=b;i++){
                if(pos[i].el && pos[i].el.kind==='cabinet') lenCm += Number(pos[i].w)||0;
              }
            } else {
              lenCm = (Number(pos[b].x1)||0) - (Number(pos[a].x0)||0);
            }
          }
        }
        const hCm = (f.type==='cokol') ? (Number(s.legHeight)||0) : (Number(s.ceilingBlende)||0);
        extra.push(`${humanRow(rowKey)} • zakres ${a+1}-${b+1} • dł ${fmt(lenCm)}cm • wys ${fmt(hCm)}cm`);
      }

      p.textContent = extra.join(' | ');
      meta.appendChild(b);
      meta.appendChild(p);

      const del = document.createElement('button');
      del.className='btn-danger';
      del.textContent='Usuń';
      del.onclick = ()=>{ removeFinish(room, f.id); renderCabinets(); };

      row.appendChild(meta);
      row.appendChild(del);
      finList.appendChild(row);
    });
  }

  // mount svg and render
  svgHost.innerHTML = '';
  svgHost.appendChild(svg);

  renderAll();
  renderInspector();
  renderFinishListPanel();
}

function renderAll(){
    // clear groups
    while(elG.firstChild) elG.removeChild(elG.firstChild);
    while(rangeG.firstChild) rangeG.removeChild(rangeG.firstChild);
    while(finG.firstChild) finG.removeChild(finG.firstChild);
    // (row labels hidden)
    // range highlight
    if(st.hRange && st.hRange.row){
      const row = st.hRange.row;
      const x0cm = Number(st.hRange.x0cm)||0;
      const x1cm = Number(st.hRange.x1cm)||0;
      const x0 = PAD_L + Math.min(x0cm,x1cm)*SCALE;
      const x1 = PAD_L + Math.max(x0cm,x1cm)*SCALE;
      const hcm = (row==='wall'?wallH:(row==='module'?moduleH:baseH));
      const y = rowY[row] + LABEL_H - 6;
      const h = hcm*SCALE + 12;
      const rr = document.createElementNS(svgNS,'rect');
      rr.setAttribute('x', x0);
      rr.setAttribute('y', y);
      rr.setAttribute('width', Math.max(8, x1-x0));
      rr.setAttribute('height', h);
      rr.setAttribute('rx', 14); rr.setAttribute('ry', 14);
      rr.setAttribute('class','svg-range');
      rangeG.appendChild(rr);
    }
// vertical range highlight (od dołu do góry)
if(st.vRange && st.vRange.x1cm > st.vRange.x0cm){
  const x0 = PAD_L + st.vRange.x0cm*SCALE;
  const x1 = PAD_L + st.vRange.x1cm*SCALE;
  const topRow = st.vRange.topRow || 'wall';
  const bottomRow = st.vRange.bottomRow || 'base';
  const y0 = rowY[topRow] + LABEL_H - 6;
  const y1 = rowY[bottomRow] + LABEL_H + ((rows.find(rr=>rr.key===bottomRow)?.hCm)||60)*SCALE + 6;
  const rr = document.createElementNS(svgNS,'rect');
  rr.setAttribute('x', x0);
  rr.setAttribute('y', Math.min(y0,y1));
  rr.setAttribute('width', Math.max(8, x1-x0));
  rr.setAttribute('height', Math.max(10, Math.abs(y1-y0)));
  rr.setAttribute('rx', 14); rr.setAttribute('ry', 14);
  rr.setAttribute('fill', 'rgba(14,165,233,0.08)');
  rr.setAttribute('stroke', 'rgba(14,165,233,0.65)');
  rr.setAttribute('stroke-width', '2');
  rangeG.appendChild(rr);
}
    // elements
    const drawOrder = (projectData[room].layout && Array.isArray(projectData[room].layout.zOrderRows)) ? projectData[room].layout.zOrderRows : ['base','module','wall'];
    drawOrder.forEach(rowKey=>{
      const r = rows.find(rr=>rr.key===rowKey);
      if(!r) return;
      const row = r.key;
      const pos = computePositions(row);
      pos.forEach(p=>{
        const x = PAD_L + p.x0*SCALE;
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (r.hCm - elHcm))*SCALE;
        const w = Math.max(24, p.w*SCALE);
        const h = Math.max(10, elHcm*SCALE);
        const g = document.createElementNS(svgNS,'g');
        g.setAttribute('data-row', row);
        g.setAttribute('data-index', String(p.index));
        g.setAttribute('data-kind', p.el.kind);
        g.setAttribute('data-id', p.el.id || '');
        g.style.cursor = 'grab';

        const isSel = st.selected && st.selected.row===row && st.selected.index===p.index;
        const rect = document.createElementNS(svgNS,'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', 12); rect.setAttribute('ry', 12);
        rect.setAttribute('fill', p.el.kind==='gap' ? '#fff' : '#eaf6ff');
        rect.setAttribute('stroke', isSel ? '#0ea5e9' : (p.el.kind==='gap' ? '#94a3b8' : '#8fd3ff'));
        rect.setAttribute('stroke-width', isSel ? '3' : '2');
        if(p.el.kind==='gap'){
          rect.setAttribute('stroke-dasharray', '6 4');
        }

        g.appendChild(rect);

        // drag handle (mobile)
        if(p.el.kind!=='gap'){
          const grip = document.createElementNS(svgNS,'rect');
          grip.setAttribute('x', x + w - 20);
          grip.setAttribute('y', y + 6);
          grip.setAttribute('width', 14);
          grip.setAttribute('height', 14);
          grip.setAttribute('rx', 3); grip.setAttribute('ry', 3);
          grip.setAttribute('fill', '#0ea5e9');
          grip.setAttribute('data-grip','1');
          grip.style.cursor = 'grab';
          grip.style.touchAction = 'none';
          g.appendChild(grip);

          const gripTxt = document.createElementNS(svgNS,'text');
          gripTxt.setAttribute('x', x + w - 17);
          gripTxt.setAttribute('y', y + 17);
          gripTxt.setAttribute('fill', '#fff');
          gripTxt.setAttribute('font-size','12');
          gripTxt.setAttribute('font-weight','900');
          gripTxt.setAttribute('pointer-events','none');
          gripTxt.textContent = '≡';
          g.appendChild(gripTxt);
        }

        const text = document.createElementNS(svgNS,'text');
        text.setAttribute('x', x + 8);
        text.setAttribute('y', y + 18);
        text.setAttribute('class', 'svg-label');
        text.textContent = elLabel(row, p.el);

        g.appendChild(text);
        elG.appendChild(g);

        // pointer handlers for drag & click
        g.addEventListener('pointerdown', (ev)=>{
          const isGrip = (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-grip')==='1');
          const isMouse = (ev.pointerType === 'mouse');
          const isTouch = !isMouse;
          // Drag only from grip on touch; mouse can drag from anywhere
          if(!isGrip && !isMouse){
            return;
          }

          try{ ev.preventDefault(); }catch(_){}
          g.setPointerCapture(ev.pointerId);
          st.drag = {
            pointerId: ev.pointerId,
            row,
            startIndex: p.index,
            startClientX: ev.clientX,
            moved: false,
            startPxX: x,
            gEl: g
          };
          g.style.cursor = 'grabbing';
        });

        g.addEventListener('pointermove', (ev)=>{
          // cancel long-press if user moves finger
          if(st._lp && st._lp.pointerId === ev.pointerId && !st._lp.fired){
            const dx0 = ev.clientX - st._lp.startX;
            const dy0 = ev.clientY - st._lp.startY;
            if(Math.abs(dx0) > 6 || Math.abs(dy0) > 6){
              clearTimeout(st._lp.timer);
              st._lp = null;
            }
          }

          if(!st.drag || st.drag.pointerId !== ev.pointerId) return;
          const dx = ev.clientX - st.drag.startClientX;
          if(Math.abs(dx) > 4) st.drag.moved = true;
          // translate group visually
          g.setAttribute('transform', `translate(${dx},0)`);
        });

        g.addEventListener('pointerup', (ev)=>{
          // clear long-press timer (if any)
          if(st._lp && st._lp.pointerId === ev.pointerId){
            const fired = st._lp.fired;
            clearTimeout(st._lp.timer);
            st._lp = null;
            // if long-press fired, do not also treat this as a click
            if(fired) return;
          }

          // TAP without drag context (common on mobile because we only start drag from the grip)
          if(!st.drag || st.drag.pointerId !== ev.pointerId){
            // prevent accidental "tap after drag" triggering click
            if(st._justDragged && (Date.now() - st._justDragged) < 220) return;
            handleClick(row, p.index, ev.shiftKey);
            return;
          }

          const drag = st.drag;
          g.releasePointerCapture(ev.pointerId);
          g.style.cursor = 'grab';
          const dx = ev.clientX - drag.startClientX;
          g.removeAttribute('transform');
          st.drag = null;
          st._justDragged = drag.moved ? Date.now() : 0;

          if(!drag.moved){
            handleClick(row, p.index, ev.shiftKey);
            return;
          }

          // commit reorder
          commitReorder(row, drag.startIndex, dx);
        });

        g.addEventListener('pointercancel', ()=>{
          if(st._lp){
            try{ clearTimeout(st._lp.timer); }catch(_){}
            st._lp = null;
          }
          if(st.drag && st.drag.gEl === g){
            g.removeAttribute('transform');
            g.style.cursor='grab';
            st.drag = null;
          }
        });

        // Fallback click handler (some Android viewers are flaky with pointerup on SVG)
        g.addEventListener('click', (ev)=>{
          if(st._justDragged && (Date.now() - st._justDragged) < 250) return;
          handleClick(row, p.index, !!ev.shiftKey);
        });

        // Touch fallback for drag & drop on mobile (when PointerEvents are not delivered properly)
        let _touchActive = false;
        g.addEventListener('touchstart', (ev)=>{
          const t = ev.touches && ev.touches[0];
          if(!t) return;
          const isGrip = (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-grip')==='1');
          if(!isGrip) return; // drag only from grip to keep horizontal scroll usable
          _touchActive = true;
          try{ ev.preventDefault(); }catch(_){}
          st.drag = {
            pointerId: 'touch',
            row,
            startIndex: p.index,
            startClientX: t.clientX,
            moved: false,
            startPxX: x,
            gEl: g
          };
          g.style.cursor = 'grabbing';
        }, {passive:false});

        g.addEventListener('touchmove', (ev)=>{
          if(!_touchActive || !st.drag || st.drag.pointerId !== 'touch' || st.drag.gEl !== g) return;
          const t = ev.touches && ev.touches[0];
          if(!t) return;
          try{ ev.preventDefault(); }catch(_){}
          const dx = t.clientX - st.drag.startClientX;
          if(Math.abs(dx) > 4) st.drag.moved = true;
          g.setAttribute('transform', `translate(${dx},0)`);
        }, {passive:false});

        function _touchEnd(ev){
          if(!_touchActive) return;
          _touchActive = false;
          if(!st.drag || st.drag.pointerId !== 'touch' || st.drag.gEl !== g) return;
          try{ ev.preventDefault(); }catch(_){}
          const drag = st.drag;
          const t = (ev.changedTouches && ev.changedTouches[0]) || null;
          const clientX = t ? t.clientX : drag.startClientX;
          const dx = clientX - drag.startClientX;
          g.removeAttribute('transform');
          g.style.cursor = 'grab';
          st.drag = null;
          st._justDragged = drag.moved ? Date.now() : 0;

          if(!drag.moved){
            handleClick(row, p.index, false);
            return;
          }
          commitReorder(row, drag.startIndex, dx);
        }
        g.addEventListener('touchend', _touchEnd, {passive:false});
        g.addEventListener('touchcancel', _touchEnd, {passive:false});
      });
    });


    // gap marks overlay (X) — keep gaps visible even if covered by another row
    rows.forEach(rr=>{
      const row = rr.key;
      const pos = computePositions(row);
      pos.forEach(p=>{
        if(p.el.kind!=='gap') return;
        const x = PAD_L + p.x0*SCALE;
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (rr.hCm - elHcm))*SCALE;
        const w = Math.max(24, p.w*SCALE);
        const h = Math.max(10, elHcm*SCALE);
        const inset = 8;
        const x0 = x + inset, x1 = x + w - inset;
        const y0 = y + inset, y1 = y + h - inset;

        const l1 = document.createElementNS(svgNS,'line');
        l1.setAttribute('x1', x0); l1.setAttribute('y1', y0);
        l1.setAttribute('x2', x1); l1.setAttribute('y2', y1);
        l1.setAttribute('stroke', '#94a3b8');
        l1.setAttribute('stroke-width', '2');
        finG.appendChild(l1);

        const l2 = document.createElementNS(svgNS,'line');
        l2.setAttribute('x1', x0); l2.setAttribute('y1', y1);
        l2.setAttribute('x2', x1); l2.setAttribute('y2', y0);
        l2.setAttribute('stroke', '#94a3b8');
        l2.setAttribute('stroke-width', '2');
        finG.appendChild(l2);
      });
    });

    // finishes overlays (after elements so they appear on top, but non-interactive)
    const finishes = (pd.finishes||[]).filter(f=>f.segmentId===seg.id);
    finishes.forEach(f=>{
      if(f.type==='panel' || f.type==='blenda_pion'){
        const row = f.row;
        const idx = f.index;
        const pos = computePositions(row);
        const p = pos[idx];
        if(!p) return;
        const baseX0 = PAD_L + p.x0*SCALE;
        const baseX1 = PAD_L + p.x1*SCALE;
        const rowCfg = rows.find(rr=>rr.key===row);
        const elHcm = elHeightCm(row, p.el);
        let y = rowY[row] + LABEL_H;
        if(row!=='wall') y += Math.max(0, (((rowCfg?.hCm||elHcm) - elHcm)))*SCALE;

        // Panele boczne: wydłuż o cokół (dolne) lub blendę górną (górne)
        const s = (pd.settings || {});
        let addHcm = 0;
        if(f.type==='panel'){
          if(row==='base') addHcm = Number(s.legHeight)||0;
          if(row==='wall') addHcm = Number(s.ceilingBlende)||0;
        }

        // dla górnych panel wydłużamy do góry (odejmujemy od y)
        if(f.type==='panel' && row==='wall' && addHcm>0){
          y = Math.max(0, y - addHcm*SCALE);
        }

        const h = Math.max(10, (elHcm + (addHcm||0))*SCALE);
        const w = Math.max(8, (Number(f.width)||2)*SCALE);
        const x = (f.side==='L') ? (baseX0 - w) : baseX1;
        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);
        rr.setAttribute('fill', f.type==='panel' ? 'rgba(2,132,199,0.35)' : 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', f.type==='panel' ? 'rgba(2,132,199,0.85)' : 'rgba(14,165,233,0.55)');
        rr.setAttribute('stroke-width', '2');
        finG.appendChild(rr);
      }

      if(f.type==='blenda_pion_full'){
        const x0cm = Number(f.x0cm)||0;
        const x1cm = Number(f.x1cm)||0;
        const wcm = Number(f.width)||2;
        const side = f.side || 'R';
        const x0 = PAD_L + x0cm*SCALE;
        const x1 = PAD_L + x1cm*SCALE;
        const w = Math.max(8, wcm*SCALE);
        const x = (side==='L') ? (x0 - w) : x1;

        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        if(rowY[topRow]==null || rowY[bottomRow]==null) return;

        const topY = rowY[topRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        const bottomY = rowY[bottomRow] + LABEL_H + botHcm*SCALE;

        const y = Math.min(topY, bottomY);
        const h = Math.max(10, Math.abs(bottomY - topY));

        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', x);
        rr.setAttribute('y', y);
        rr.setAttribute('width', w);
        rr.setAttribute('height', h);
        rr.setAttribute('rx', 10); rr.setAttribute('ry', 10);
        rr.setAttribute('fill', 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', 'rgba(14,165,233,0.85)');
        rr.setAttribute('stroke-width', '3');
        finG.appendChild(rr);
      }

      if(f.type==='cokol' || f.type==='blenda_gorna'){
        const row = f.row;
        const pos = computePositions(row);

        let x0cm = (f.x0cm!=null) ? Number(f.x0cm) : null;
        let x1cm = (f.x1cm!=null) ? Number(f.x1cm) : null;

        // fallback: legacy indices
        if(x0cm==null || x1cm==null){
          const a = Math.max(0, Math.min(f.startIndex, f.endIndex));
          const b = Math.min(pos.length-1, Math.max(f.startIndex, f.endIndex));
          if(!pos[a] || !pos[b]) return;
          x0cm = pos[a].x0;
          x1cm = pos[b].x1;
        }

        const span0 = Math.min(x0cm,x1cm);
        const span1 = Math.max(x0cm,x1cm);

        let lenCm = (f.lengthCm!=null) ? Number(f.lengthCm)||0 : (span1 - span0);
        if(f.lengthCm==null && f.includeGaps === false){
          lenCm = 0;
          pos.forEach(pp=>{
            if(pp.el.kind!=='cabinet') return;
            const ov = Math.min(pp.x1, span1) - Math.max(pp.x0, span0);
            if(ov>0) lenCm += ov;
          });
        }

        const px0 = PAD_L + span0*SCALE;
        const pxW = Math.max(10, lenCm*SCALE);
        const isCokol = (f.type==='cokol');
        const yBase = rowY[row] + LABEL_H + (row==='wall' ? wallH : baseH)*SCALE;
        const y = isCokol ? (yBase + 8) : Math.max(2, (rowY[row] + LABEL_H - 14));
        const rr = document.createElementNS(svgNS,'rect');
        rr.setAttribute('x', px0);
        rr.setAttribute('y', y);
        rr.setAttribute('width', pxW);
        rr.setAttribute('height', 10);
        rr.setAttribute('rx', 8); rr.setAttribute('ry', 8);
        rr.setAttribute('fill', isCokol ? 'rgba(2,132,199,0.35)' : 'rgba(14,165,233,0.18)');
        rr.setAttribute('stroke', isCokol ? 'rgba(2,132,199,0.85)' : 'rgba(14,165,233,0.55)');
        rr.setAttribute('stroke-width', '2');
        finG.appendChild(rr);
      }
    });
  }

function renderInspector(){
    const sel = st.selected;
    if(!sel){
      insBody.innerHTML = `<div class="muted xs">Kliknij kafelek (szafkę lub przerwę).<br/>Zaznacz zakres: Ustaw START i KONIEC.</div>`;
      return;
    }
    const row = sel.row;
    const el = (seg.rows[row]||[])[sel.index];
    if(!el){
      insBody.innerHTML = `<div class="muted xs">Brak elementu.</div>`;
      return;
    }

    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.marginBottom = '8px';
    title.textContent = (el.kind==='gap')
      ? `PRZERWA • ${Number(el.width)||0}cm • ${humanRow(row)}`
      : `${(getCabById(room, el.id)?.subType || getCabById(room, el.id)?.type || 'Szafka')} • ${Number(getCabById(room, el.id)?.width)||0}cm • ${humanRow(row)}`;

    const box = document.createElement('div');
    box.innerHTML = '';
    box.appendChild(title);

    // Layer order controls (row z-order)
    const zWrap = document.createElement('div');
    zWrap.style.display='flex';
    zWrap.style.gap='8px';
    zWrap.style.alignItems='center';
    zWrap.style.margin='0 0 10px 0';
    const zLbl = document.createElement('div');
    zLbl.className='muted xs';
    zLbl.textContent = 'Warstwa: ' + humanRow(row);
    const btnUp = document.createElement('button');
    btnUp.className='btn';
    btnUp.textContent='▲ wyżej';
    const btnDn = document.createElement('button');
    btnDn.className='btn';
    btnDn.textContent='▼ niżej';
    btnUp.onclick = ()=>{
      const lo = projectData[room].layout;
      const arr = (lo && Array.isArray(lo.zOrderRows)) ? lo.zOrderRows.slice() : ['base','module','wall'];
      const i = arr.indexOf(row);
      // wyżej = bardziej na wierzch (rysowane później)
      if(i>=0 && i < arr.length-1){ const t=arr[i+1]; arr[i+1]=arr[i]; arr[i]=t; }
      if(lo) lo.zOrderRows = arr;
      saveProject();
      renderCabinets();
    };
    btnDn.onclick = ()=>{
      const lo = projectData[room].layout;
      const arr = (lo && Array.isArray(lo.zOrderRows)) ? lo.zOrderRows.slice() : ['base','module','wall'];
      const i = arr.indexOf(row);
      // niżej = bardziej pod spodem (rysowane wcześniej)
      if(i>0){ const t=arr[i-1]; arr[i-1]=arr[i]; arr[i]=t; }
      if(lo) lo.zOrderRows = arr;
      saveProject();
      renderCabinets();
    };
    zWrap.appendChild(zLbl);
    zWrap.appendChild(btnUp);
    zWrap.appendChild(btnDn);
    box.appendChild(zWrap);

    // Zakres (START/END) — mobile-friendly
    const rSel = document.createElement('div');
    rSel.style.display='flex';
    rSel.style.flexDirection='column';
    rSel.style.gap='8px';
    rSel.style.margin='0 0 12px 0';

    const rInfo = document.createElement('div');
    rInfo.className='muted xs';
    const rs = st.rangeStart;
    const rTxt = [];
    if(rs){
      const aEl = (seg.rows[rs.row]||[])[rs.index];
      const aLbl = aEl ? (aEl.kind==='gap' ? 'PRZERWA' : (getCabById(room, aEl.id)?.subType || getCabById(room, aEl.id)?.type || 'Szafka')) : '—';
      rTxt.push('START: ' + aLbl + ' (' + humanRow(rs.row) + ')');
    }
    if(st.hRange){
      const len = Math.abs((Number(st.hRange.x1cm)||0) - (Number(st.hRange.x0cm)||0));
      rTxt.push('ZAKRES: ' + humanRow(st.hRange.row) + ' • dł.: ' + len.toFixed(1) + 'cm');
    }
    if(st.vRange){
      rTxt.push('ZAKRES PION: ' + humanRow(st.vRange.topRow) + '→' + humanRow(st.vRange.bottomRow));
    }
    rInfo.textContent = rTxt.length ? rTxt.join(' • ') : 'Zakres: ustaw START i KONIEC.';

    const rBtns = document.createElement('div');
    rBtns.style.display='flex';
    rBtns.style.gap='8px';
    rBtns.style.flexWrap='wrap';

    const bStart = document.createElement('button');
    bStart.className='btn';
    bStart.textContent='Ustaw START';
    bStart.onclick = ()=>{
      if(el.kind==='gap'){ alert('START nie może być przerwą. Wybierz szafkę.'); return; }
      st.rangeStart = { row, index: sel.index };
      st.hRange = null;
      st.vRange = null;
      saveProject();
      renderCabinets();
    };

    const bEnd = document.createElement('button');
    bEnd.className='btn-primary';
    bEnd.textContent='Ustaw KONIEC';
    bEnd.onclick = ()=>{
      if(el.kind==='gap'){ alert('KONIEC nie może być przerwą. Wybierz szafkę.'); return; }
      if(!st.rangeStart){
        st.rangeStart = { row, index: sel.index };
        st.hRange = null;
        st.vRange = null;
        saveProject();
        renderCabinets();
        return;
      }
      const a = st.rangeStart;
      // same row => horizontal range (tak jak pion: po X)
      if(a.row === row){
        const pos = computePositions(row);
        const pa = pos[a.index];
        const pb = pos[sel.index];
        if(pa && pb){
          const x0cm = Math.min(pa.x0, pb.x0);
          const x1cm = Math.max(pa.x1, pb.x1);
          // Blendy/cokół tylko po ciągłych szafkach – bez przerw w środku
          const i0 = Math.min(a.index, sel.index);
          const i1 = Math.max(a.index, sel.index);
          const rowEls = (seg.rows[row]||[]);
          let hasGap = false;
          for(let i=i0;i<=i1;i++){ if(rowEls[i] && rowEls[i].kind==='gap'){ hasGap=true; break; } }
          if(hasGap){
            alert('Zakres zawiera przerwę. Blendy/cokół można dodać tylko na ciągłych szafkach.');
            st.rangeStart = { row, index: sel.index };
            st.hRange = null; st.vRange = null;
            saveProject(); renderCabinets();
            return;
          }
          st.hRange = { row, x0cm, x1cm, startIndex: a.index, endIndex: sel.index };
          st.vRange = null;
        } else {
          st.rangeStart = { row, index: sel.index };
          st.hRange = null;
          st.vRange = null;
          saveProject();
          renderCabinets();
          return;
        }
      } else {
        const posA = computePositions(a.row);
        const posB = computePositions(row);
        const pa = posA[a.index];
        const pb = posB[sel.index];
        if(pa && pb){
          const x0cm = Math.max(pa.x0, pb.x0);
          const x1cm = Math.min(pa.x1, pb.x1);
          if(x1cm > x0cm){
            const order = ['wall','module','base']; // top -> bottom
            const ia = order.indexOf(a.row);
            const ib = order.indexOf(row);
            const topRow = order[Math.min(ia, ib)];
            const bottomRow = order[Math.max(ia, ib)];
            const rowsIncl = order.slice(Math.min(ia, ib), Math.max(ia, ib)+1);
            // Blenda pion pełna tylko jeżeli w kolumnie nie ma przerw w żadnym z rzędów
            let hasGapV = false;
            for(const rk of rowsIncl){
              const posR = computePositions(rk);
              const elsR = (seg.rows[rk]||[]);
              for(let i=0;i<elsR.length;i++){
                if(elsR[i].kind==='gap'){
                  const pr = posR[i];
                  if(pr && pr.x1 > x0cm && pr.x0 < x1cm){ hasGapV = true; break; }
                }
              }
              if(hasGapV) break;
            }
            if(hasGapV){
              alert('Zakres pionowy przechodzi przez przerwę. Blendy można dodać tylko na ciągłych szafkach.');
              st.rangeStart = { row, index: sel.index };
              st.hRange = null; st.vRange = null;
              saveProject(); renderCabinets();
              return;
            }
            st.vRange = { x0cm, x1cm, topRow, bottomRow, rows: rowsIncl };
            st.hRange = null;
          } else {
            // no overlap => reset start to this
            st.rangeStart = { row, index: sel.index };
            st.hRange = null;
            st.vRange = null;
            saveProject();
            renderCabinets();
            return;
          }
        }
      }
      st.rangeStart = null;
      saveProject();
      renderCabinets();
    };

    const bClear = document.createElement('button');
    bClear.className='btn';
    bClear.textContent='Wyczyść zakres';
    bClear.onclick = ()=>{
      st.rangeStart = null;
      st.hRange = null;
      st.vRange = null;
      saveProject();
      renderCabinets();
    };

    rBtns.appendChild(bStart);
    rBtns.appendChild(bEnd);
    rBtns.appendChild(bClear);

    rSel.appendChild(rInfo);
    rSel.appendChild(rBtns);
    box.appendChild(rSel);


// Vertical range actions (od dołu do góry)
if(st.vRange && st.vRange.x1cm > st.vRange.x0cm){
  const vr = st.vRange;
  const rowDiv = document.createElement('div');
  rowDiv.style.display='flex';
  rowDiv.style.flexDirection='column';
  rowDiv.style.gap='8px';
  rowDiv.style.marginBottom='10px';

  const info = document.createElement('div');
  info.className='muted xs';
  info.textContent = `Zakres pionowy: ${humanRow(vr.topRow)} → ${humanRow(vr.bottomRow)} (kolumna)`;
  rowDiv.appendChild(info);

  // Opcje zakresu pionowego (mobile-friendly): co doliczać do wysokości
  if(vr.includeTopBlende === undefined){
    // domyślnie: jeśli w kolumnie są GÓRNE, dolicz blendę górną
    vr.includeTopBlende = true;
  }
  if(vr.includePlinth === undefined){
    // domyślnie: jeśli zakres obejmuje DOLNE, dolicz cokół
    vr.includePlinth = (Array.isArray(vr.rows)? vr.rows.includes('base') : (vr.bottomRow==='base' || vr.topRow==='base'));
  }
  const optWrap = document.createElement('div');
  optWrap.style.display='flex';
  optWrap.style.flexWrap='wrap';
  optWrap.style.gap='8px';

  const btnTopOpt = document.createElement('button');
  btnTopOpt.className='btn';
  const paintTop = ()=>{ btnTopOpt.textContent = 'Blenda górna: ' + (vr.includeTopBlende ? 'TAK' : 'NIE'); };
  paintTop();
  btnTopOpt.onclick = ()=>{ vr.includeTopBlende = !vr.includeTopBlende; paintTop(); saveProject(); renderCabinets(); };

  const btnPlOpt = document.createElement('button');
  btnPlOpt.className='btn';
  const paintPl = ()=>{ btnPlOpt.textContent = 'Cokół: ' + (vr.includePlinth ? 'TAK' : 'NIE'); };
  paintPl();
  btnPlOpt.onclick = ()=>{ vr.includePlinth = !vr.includePlinth; paintPl(); saveProject(); renderCabinets(); };

  optWrap.appendChild(btnTopOpt);
  optWrap.appendChild(btnPlOpt);
  rowDiv.appendChild(optWrap);

  const btnL = document.createElement('button');
  btnL.className='btn-primary';
  btnL.textContent='Dodaj blendę pion pełna (lewa)';
  btnL.onclick = ()=>{
    const w = parseFloat(prompt('Szerokość blendy (cm):','5')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'blenda_pion_full', segmentId:seg.id, side:'L', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnR = document.createElement('button');
  btnR.className='btn-primary';
  btnR.textContent='Dodaj blendę pion pełna (prawa)';
  btnR.onclick = ()=>{
    const w = parseFloat(prompt('Szerokość blendy (cm):','5')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'blenda_pion_full', segmentId:seg.id, side:'R', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnC = document.createElement('button');
  btnC.className='btn';
  btnC.textContent='Wyczyść zakres pionowy';
  btnC.onclick = ()=>{ st.vRange=null; saveProject(); renderCabinets(); };

    const btnPL = document.createElement('button');
  btnPL.className='btn';
  btnPL.textContent='Dodaj panel pełny (lewy)';
  btnPL.onclick = ()=>{
    const w = parseFloat(prompt('Grubość panela (cm):','1.8')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'panel_pion_full', segmentId:seg.id, side:'L', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };

  const btnPR = document.createElement('button');
  btnPR.className='btn';
  btnPR.textContent='Dodaj panel pełny (prawy)';
  btnPR.onclick = ()=>{
    const w = parseFloat(prompt('Grubość panela (cm):','1.8')||'0');
    if(!(w>0)) return;
    // wysokość pionu: suma rzędów + dodatki (blenda/cokół)
    const rows = (Array.isArray(vr.rows) && vr.rows.length) ? vr.rows : ['wall','module','base'];
    let hcm = 0;
    rows.forEach(rk=>{ hcm += (rk==='wall'?wallH:(rk==='module'?moduleH:baseH)); });
    // dodatek za blendę górną: jeśli w tej kolumnie są szafki GÓRNE (overlap w osi X)
    const _x0 = Math.min(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _x1 = Math.max(Number(vr.x0cm)||0, Number(vr.x1cm)||0);
    const _wallPos = computePositions('wall');
    const _hasWall = _wallPos.some(pp=>pp && pp.el && pp.el.kind==='cabinet' && (Math.min(pp.x1,_x1) - Math.max(pp.x0,_x0) > 0));
    if(vr.includeTopBlende && _hasWall) hcm += Math.max(0, Number(s.ceilingBlende)||0);
    if(vr.includePlinth && rows.includes('base')) hcm += Math.max(0, Number(s.legHeight)||0);
    addFinish(room, { type:'panel_pion_full', segmentId:seg.id, side:'R', width:w, heightCm:Number(hcm.toFixed(1)), x0cm:vr.x0cm, x1cm:vr.x1cm, topRow:vr.topRow, bottomRow:vr.bottomRow, rows:rows });
    st.vRange = null;
    saveProject();
    renderCabinets();
  };
rowDiv.appendChild(btnL);
  rowDiv.appendChild(btnR);
  rowDiv.appendChild(btnC);

  box.appendChild(rowDiv);
}
    // Range actions
    if(st.hRange && st.hRange.row===row){
      const r = st.hRange;
      const btn1 = document.createElement('button');
      btn1.className='btn-primary';
      btn1.textContent = (row==='base') ? 'Dodaj cokół na zakresie' : (row==='wall') ? 'Dodaj blendę górną na zakresie' : 'Zakres w modułach: brak akcji';
      if(row==='module'){ btn1.disabled = true; btn1.className='btn'; }
      btn1.onclick = ()=>{
        // długość zakresu liczona jako suma szerokości SZAFEK w zakresie (bez przerw)
        const x0 = Math.min(Number(r.x0cm)||0, Number(r.x1cm)||0);
        const x1 = Math.max(Number(r.x0cm)||0, Number(r.x1cm)||0);
        let lenCm = 0;
        if(r.startIndex!=null && r.endIndex!=null){
          const i0 = Math.min(r.startIndex, r.endIndex);
          const i1 = Math.max(r.startIndex, r.endIndex);
          const rowEls = (seg.rows[row]||[]);
          for(let i=i0;i<=i1;i++){
            const e = rowEls[i];
            if(!e || e.kind!=='cabinet') continue;
            const c = getCabById(room, e.id);
            lenCm += (c ? Number(c.width)||0 : 0);
          }
        } else {
          const pos = computePositions(row);
          pos.forEach(pp=>{
            if(!pp || !pp.el || pp.el.kind!=='cabinet') return;
            const ov = Math.min(pp.x1, x1) - Math.max(pp.x0, x0);
            if(ov>0) lenCm += ov;
          });
        }
addFinish(room, {
          type: (row==='base') ? 'cokol' : 'blenda_gorna',
          segmentId: seg.id,
          row,
          startIndex: r.startIndex,
          endIndex: r.endIndex,
          x0cm: x0,
          x1cm: x1,
          lengthCm: Number(lenCm.toFixed(1)),
          includeGaps: false
        });
        st.hRange = null;
        saveProject();
        renderCabinets();
      };
      const btn2 = document.createElement('button');
      btn2.className='btn';
      btn2.textContent='Wyczyść zakres';
      btn2.onclick = ()=>{ st.hRange=null; saveProject(); renderCabinets(); };

      const rowDiv = document.createElement('div');
      rowDiv.style.display='flex';
      rowDiv.style.flexDirection='column';
      rowDiv.style.gap='8px';
      rowDiv.appendChild(btn1);
      rowDiv.appendChild(btn2);
      box.appendChild(rowDiv);

      insBody.innerHTML = '';
      insBody.appendChild(box);
      return;
    }

    // Element actions

    const actions = document.createElement('div');
    actions.style.display='flex';
    actions.style.flexDirection='column';
    actions.style.gap='8px';

    function askWidth(def){ return parseFloat(prompt('Szerokość (cm):', String(def)) || '0'); }

    if(el.kind==='cabinet'){
      const btnPL = document.createElement('button');
      btnPL.className='btn';
      btnPL.textContent='Dodaj panel lewy';
      btnPL.onclick = ()=>{
        const w = askWidth(1.8); if(!(w>0)) return;
        addFinish(room, { type:'panel', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'L', width:w });
        renderCabinets();
      };
      const btnPR = document.createElement('button');
      btnPR.className='btn';
      btnPR.textContent='Dodaj panel prawy';
      btnPR.onclick = ()=>{
        const w = askWidth(1.8); if(!(w>0)) return;
        addFinish(room, { type:'panel', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'R', width:w });
        renderCabinets();
      };
      const btnBL = document.createElement('button');
      btnBL.className='btn';
      btnBL.textContent='Dodaj blendę pion lewa';
      btnBL.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        addFinish(room, { type:'blenda_pion', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'L', width:w });
        renderCabinets();
      };
      const btnBR = document.createElement('button');
      btnBR.className='btn';
      btnBR.textContent='Dodaj blendę pion prawa';
      btnBR.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        addFinish(room, { type:'blenda_pion', segmentId:seg.id, row, index:sel.index, cabinetId: el.id, side:'R', width:w });
        renderCabinets();
      };
      const btnGapA = document.createElement('button');
      btnGapA.className='btn';
      btnGapA.textContent='Wstaw przerwę po prawej';
      btnGapA.onclick = ()=>{
        const w = askWidth(5); if(!(w>0)) return;
        insertGapAfter(room, seg, row, sel.index, w);
        renderCabinets();
      };

      actions.appendChild(btnPL);
      actions.appendChild(btnPR);
      actions.appendChild(btnBL);
      actions.appendChild(btnBR);
      actions.appendChild(btnGapA);
    } else {
      // gap
      const btnEdit = document.createElement('button');
      btnEdit.className='btn';
      btnEdit.textContent='Zmień szerokość przerwy';
      btnEdit.onclick = ()=>{
        const w = askWidth(Number(el.width)||5);
        if(!(w>0)) return;
        el.width = w;
        saveProject();
        renderCabinets();
      };
      const btnDel = document.createElement('button');
      btnDel.className='btn-danger';
      btnDel.textContent='Usuń przerwę';
      btnDel.onclick = ()=>{
        if(!confirm('Usunąć przerwę?')) return;
        (seg.rows[row]||[]).splice(sel.index,1);
        st.selected = null;
        saveProject();
        renderCabinets();
      };
      actions.appendChild(btnEdit);
      actions.appendChild(btnDel);
    }

    box.appendChild(actions);
    insBody.innerHTML = '';
    insBody.appendChild(box);
  }

function renderFinishListPanel(){
    const segFin = (pd.finishes||[]).filter(f=>f.segmentId===seg.id);
    finList.innerHTML = '';
    if(segFin.length===0){
      finList.innerHTML = `<div class="muted xs">Brak.</div>`;
      return;
    }
    segFin.forEach(f=>{
      const row = document.createElement('div');
      row.className = 'finish-item';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const b = document.createElement('b');
      b.textContent = finishLabel(f);
      const p = document.createElement('p');
      p.className = 'muted xs';
      p.style.margin='0';
      let extra = [];
      const s = pd.settings || {};

      const fmt = (n)=> {
        const v = Number(n);
        if(!isFinite(v)) return '0';
        // keep one decimal if needed
        return (Math.round(v*10)/10).toString();
      };

      if(f.type==='panel' || f.type==='blenda_pion'){
        const rowKey = f.row;
        const idx = Number(f.index)||0;
        const arr = seg.rows[rowKey] || [];
        const el = arr[idx] || null;
        const hCm = elHeightCm(rowKey, el);
        const wCm = Number(f.width)||0;
        extra.push(`${humanRow(rowKey)} • #${idx+1} • ${f.side} • szer ${fmt(wCm)}cm • wys ${fmt(hCm)}cm`);
      } else if(f.type==='blenda_pion_full'){
        const topRow = f.topRow || 'wall';
        const bottomRow = f.bottomRow || 'base';
        const side = f.side || 'R';
        const wCm = Number(f.width)||0;

        const topY = rowY[topRow] + LABEL_H;
        const botHcm = (bottomRow==='wall'?wallH:(bottomRow==='module'?moduleH:baseH));
        const bottomY = rowY[bottomRow] + LABEL_H + botHcm*SCALE;
        const hCm = Math.abs(bottomY - topY)/SCALE;

        extra.push(`kolumna ${humanRow(topRow)}→${humanRow(bottomRow)} • ${side} • szer ${fmt(wCm)}cm • wys ${fmt(hCm)}cm`);
      } else if(f.type==='cokol' || f.type==='blenda_gorna'){
        const rowKey = f.row;
        const pos = computePositions(rowKey);
        const a = Math.max(0, Math.min(Number(f.startIndex)||0, Number(f.endIndex)||0));
        const b = Math.min(pos.length-1, Math.max(Number(f.startIndex)||0, Number(f.endIndex)||0));

        let lenCm = (isFinite(Number(f.lengthCm)) && Number(f.lengthCm)>0) ? Number(f.lengthCm) : NaN;
        if(pos[a] && pos[b]){
          if(!isFinite(lenCm)){
            if(f.includeGaps === false){
              lenCm = 0;
              for(let i=a;i<=b;i++){
                if(pos[i].el && pos[i].el.kind==='cabinet') lenCm += Number(pos[i].w)||0;
              }
            } else {
              lenCm = (Number(pos[b].x1)||0) - (Number(pos[a].x0)||0);
            }
          }
        }
        const hCm = (f.type==='cokol') ? (Number(s.legHeight)||0) : (Number(s.ceilingBlende)||0);
        extra.push(`${humanRow(rowKey)} • zakres ${a+1}-${b+1} • dł ${fmt(lenCm)}cm • wys ${fmt(hCm)}cm`);
      }

      p.textContent = extra.join(' | ');
      meta.appendChild(b);
      meta.appendChild(p);

      const del = document.createElement('button');
      del.className='btn-danger';
      del.textContent='Usuń';
      del.onclick = ()=>{ removeFinish(room, f.id); renderCabinets(); };

      row.appendChild(meta);
      row.appendChild(del);
      finList.appendChild(row);
    });
  }

Object.assign(window.FC.render, {
  renderTopHeight: renderTopHeight,
  renderCabinetTypeChoices: renderCabinetTypeChoices,
  renderCabinetExtraDetailsInto: renderCabinetExtraDetailsInto,
  renderSetTiles: renderSetTiles,
  renderSetParamsUI: renderSetParamsUI,
  renderCabinetModal: renderCabinetModal,
  renderTotals: renderTotals,
  renderMaterialsTab: renderMaterialsTab,
  renderCabinets: renderCabinets,
  renderSingleCabinetCard: renderSingleCabinetCard,
  renderPriceModal: renderPriceModal,
  renderCabinetTypeChoicesPlaceholder: renderCabinetTypeChoicesPlaceholder,
  renderFinishList: renderFinishList,
  renderDrawingTab: renderDrawingTab,
  renderAll: renderAll,
  renderInspector: renderInspector,
  renderFinishListPanel: renderFinishListPanel
});
