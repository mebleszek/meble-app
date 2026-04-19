(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function fallbackH(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.keys(attrs).forEach((key)=>{
        if(key === 'class') el.className = attrs[key];
        else if(key === 'html') el.innerHTML = attrs[key];
        else if(key === 'text') el.textContent = attrs[key];
        else el.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach((child)=> el.appendChild(child));
    return el;
  }

  function fallbackLabelWithInfo(title){
    const row = document.createElement('div');
    row.className = 'label-help';
    const text = document.createElement('span');
    text.className = 'label-help__text';
    text.textContent = String(title || '');
    row.appendChild(text);
    return row;
  }

  function fallbackChoiceLauncher(label){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rozrys-choice-launch';
    btn.textContent = String(label || '');
    return btn;
  }

  function fallbackSelectOptionLabel(select){
    try{
      if(select && select.options && select.selectedIndex >= 0){
        const opt = select.options[select.selectedIndex];
        if(opt && typeof opt.textContent === 'string' && opt.textContent.trim()) return opt.textContent.trim();
      }
    }catch(_){ }
    return String(select && select.value || '');
  }

  function fallbackSetChoiceLaunchValue(btn, label){
    if(btn) btn.textContent = String(label || '');
  }

  function createWorkspace(ctx, deps){
    const cfg = Object.assign({
      h: null,
      labelWithInfo: null,
      createChoiceLauncher: null,
      getSelectOptionLabel: null,
      setChoiceLaunchValue: null,
      openRozrysChoiceOverlay: null,
      card: null,
      state: null,
      panelPrefs: null,
      getSelectedRooms: null,
      getMaterialScope: null,
      encodeRoomsSelection: null,
      encodeMaterialScope: null,
      loadPanelPrefs: null,
      savePanelPrefs: null,
      rozState: null,
    }, ctx || {});
    const d = Object.assign({
      normalizeCutDirection: (value)=> String(value || 'start-optimax'),
    }, deps || {});

    if(!cfg.card) return null;

    const h = typeof cfg.h === 'function' ? cfg.h : fallbackH;
    const labelWithInfo = typeof cfg.labelWithInfo === 'function' ? cfg.labelWithInfo : fallbackLabelWithInfo;
    const createChoiceLauncher = typeof cfg.createChoiceLauncher === 'function' ? cfg.createChoiceLauncher : fallbackChoiceLauncher;
    const getSelectOptionLabel = typeof cfg.getSelectOptionLabel === 'function' ? cfg.getSelectOptionLabel : fallbackSelectOptionLabel;
    const setChoiceLaunchValue = typeof cfg.setChoiceLaunchValue === 'function' ? cfg.setChoiceLaunchValue : fallbackSetChoiceLaunchValue;
    const openRozrysChoiceOverlay = typeof cfg.openRozrysChoiceOverlay === 'function'
      ? cfg.openRozrysChoiceOverlay
      : (async ()=> null);
    const loadPanelPrefs = typeof cfg.loadPanelPrefs === 'function' ? cfg.loadPanelPrefs : (()=> ({}));
    const savePanelPrefs = typeof cfg.savePanelPrefs === 'function' ? cfg.savePanelPrefs : (()=> undefined);
    const encodeRoomsSelection = typeof cfg.encodeRoomsSelection === 'function' ? cfg.encodeRoomsSelection : (()=> '');
    const encodeMaterialScope = typeof cfg.encodeMaterialScope === 'function' ? cfg.encodeMaterialScope : (()=> '{}');
    const state = cfg.state && typeof cfg.state === 'object' ? cfg.state : {};
    const panelPrefs = cfg.panelPrefs && typeof cfg.panelPrefs === 'object' ? cfg.panelPrefs : {};

    const unitWrap = h('div', { class:'rozrys-field' });
    unitWrap.appendChild(h('label', { class:'rozrys-field__label', text:'Jednostki' }));
    const unitSel = h('select', { id:'rozUnit' });
    unitSel.innerHTML = `
      <option value="cm" ${state.unit==='cm'?'selected':''}>cm</option>
      <option value="mm" ${state.unit==='mm'?'selected':''}>mm</option>
    `;
    unitWrap.appendChild(unitSel);

    const edgeWrap = h('div', { class:'rozrys-field' });
    edgeWrap.appendChild(h('label', { class:'rozrys-field__label', text:'Wymiary do cięcia' }));
    const edgeSel = h('select', { id:'rozEdgeSub' });
    edgeSel.innerHTML = `
      <option value="0">Nominalne</option>
      <option value="1">Po odjęciu 1 mm okleiny</option>
      <option value="2">Po odjęciu 2 mm okleiny</option>
    `;
    edgeSel.value = ['0','1','2'].includes(String(panelPrefs.edgeSubMm)) ? String(panelPrefs.edgeSubMm) : '0';
    edgeWrap.appendChild(edgeSel);

    const inW = h('input', { id:'rozW', type:'number', value:String(state.boardW) });
    const inH = h('input', { id:'rozH', type:'number', value:String(state.boardH) });
    inW.classList.add('rozrys-format-input');
    inH.classList.add('rozrys-format-input');
    const addStockBtn = h('button', { class:'btn-success rozrys-action-btn', type:'button', text:'Dodaj płytę' });
    const openOptionsBtnInline = h('button', { class:'btn rozrys-action-btn rozrys-action-btn--light', type:'button', text:'Opcje' });

    const kerfWrap = h('div', { class:'rozrys-field' });
    kerfWrap.appendChild(h('label', { class:'rozrys-field__label', text:`Rzaz piły (${state.unit})` }));
    const inK = h('input', { id:'rozK', type:'number', value:String(state.kerf) });
    kerfWrap.appendChild(inK);

    const trimWrap = h('div', { class:'rozrys-field' });
    trimWrap.appendChild(h('label', { class:'rozrys-field__label', text:`Obrównanie krawędzi — arkusz standardowy (${state.unit})` }));
    const inTrim = h('input', { id:'rozTrim', type:'number', value:String(state.edgeTrim) });
    trimWrap.appendChild(inTrim);

    const minScrapWrap = h('div', { class:'rozrys-field' });
    minScrapWrap.appendChild(h('label', { class:'rozrys-field__label', text:`Najmniejszy użyteczny odpad (${state.unit})` }));
    const minScrapRow = h('div', { class:'rozrys-inline-row', style:'display:flex;gap:8px' });
    const inMinW = h('input', { id:'rozMinScrapW', type:'number', value:String(state.minScrapW) });
    const inMinH = h('input', { id:'rozMinScrapH', type:'number', value:String(state.minScrapH) });
    minScrapRow.appendChild(inMinW);
    minScrapRow.appendChild(inMinH);
    minScrapWrap.appendChild(minScrapRow);

    const controls2 = h('div', { class:'rozrys-secondary-grid', style:'margin-top:12px' });

    const heurWrap = h('div', { class:'rozrys-field' });
    heurWrap.appendChild(labelWithInfo('Szybkość liczenia', 'Szybkość liczenia', 'Turbo = najprostszy shelf. Dokładnie = lżejsze myślenie pasowe. MAX = Twój algorytm 1–7 bez otwierania nowej płyty przed domknięciem poprzedniej.'));
    const heurSel = h('select', { id:'rozHeur', hidden:'hidden' });
    heurSel.innerHTML = `
      <option value="turbo">Turbo</option>
      <option value="dokladnie">Dokładnie</option>
      <option value="max" selected>MAX</option>
    `;
    const heurBtn = createChoiceLauncher(getSelectOptionLabel(heurSel), '');
    heurBtn.classList.add('rozrys-choice-launch--compact');
    heurBtn.addEventListener('click', async ()=>{
      const picked = await openRozrysChoiceOverlay({
        title:'Szybkość liczenia',
        value: heurSel.value,
        options:[
          { value:'turbo', label:'Turbo', description:'Najszybszy wariant. Najprostsze liczenie pasowe.' },
          { value:'dokladnie', label:'Dokładnie', description:'Lżejsze myślenie pasowe z lepszym dopasowaniem niż Turbo.' },
          { value:'max', label:'MAX', description:'Najmocniejsze liczenie Twoim algorytmem 1–7 bez otwierania nowej płyty przed domknięciem poprzedniej.' }
        ]
      });
      if(picked == null || picked === heurSel.value) return;
      heurSel.value = picked;
      setChoiceLaunchValue(heurBtn, getSelectOptionLabel(heurSel), '');
      heurSel.dispatchEvent(new Event('change', { bubbles:true }));
    });
    heurWrap.appendChild(heurBtn);
    heurWrap.appendChild(heurSel);
    controls2.appendChild(heurWrap);

    const dirWrap = h('div', { class:'rozrys-field' });
    dirWrap.appendChild(labelWithInfo('Kierunek cięcia', 'Kierunek startu', 'Pierwsze pasy wzdłuż / w poprzek wymuszają start. Opti-max wybiera lepszy start dla każdej płyty osobno.'));
    const dirSel = h('select', { id:'rozDir', hidden:'hidden' });
    dirSel.innerHTML = `
      <option value="start-along">Pierwsze pasy wzdłuż</option>
      <option value="start-across">Pierwsze pasy w poprzek</option>
      <option value="start-optimax" selected>Opti-max</option>
    `;
    const dirBtn = createChoiceLauncher(getSelectOptionLabel(dirSel), '');
    dirBtn.classList.add('rozrys-choice-launch--compact');
    dirBtn.addEventListener('click', async ()=>{
      const picked = await openRozrysChoiceOverlay({
        title:'Kierunek cięcia',
        value: dirSel.value,
        options:[
          { value:'start-along', label:'Pierwsze pasy wzdłuż', description:'Wymusza start od pasów wzdłuż struktury / długości arkusza.' },
          { value:'start-across', label:'Pierwsze pasy w poprzek', description:'Wymusza start od pasów w poprzek struktury / szerokości arkusza.' },
          { value:'start-optimax', label:'Opti-max', description:'Dla każdej płyty wybiera korzystniejszy kierunek startu.' }
        ]
      });
      if(picked == null || picked === dirSel.value) return;
      dirSel.value = picked;
      setChoiceLaunchValue(dirBtn, getSelectOptionLabel(dirSel), '');
      dirSel.dispatchEvent(new Event('change', { bubbles:true }));
    });
    dirWrap.appendChild(dirBtn);
    dirWrap.appendChild(dirSel);
    controls2.appendChild(dirWrap);

    cfg.card.appendChild(controls2);

    function persistOptionPrefs(){
      const selectedRooms = typeof cfg.getSelectedRooms === 'function' ? cfg.getSelectedRooms() : [];
      const materialScope = typeof cfg.getMaterialScope === 'function' ? cfg.getMaterialScope() : null;
      savePanelPrefs(Object.assign({}, loadPanelPrefs(), {
        selectedRooms: encodeRoomsSelection(selectedRooms),
        materialScope: encodeMaterialScope(materialScope),
        unit: unitSel.value,
        boardW: Math.max(1, Number(inW.value) || (unitSel.value === 'mm' ? 2800 : 280)),
        boardH: Math.max(1, Number(inH.value) || (unitSel.value === 'mm' ? 2070 : 207)),
        edgeSubMm: Math.max(0, Number(edgeSel.value) || 0),
        kerf: Math.max(0, Number(inK.value) || 0),
        edgeTrim: Math.max(0, Number(inTrim.value) || 0),
        minScrapW: Math.max(0, Number(inMinW.value) || 0),
        minScrapH: Math.max(0, Number(inMinH.value) || 0),
      }));
    }

    function applyUnitChange(next){
      const prev = state.unit;
      if(prev === next) return;
      const factor = (prev === 'cm' && next === 'mm') ? 10 : (prev === 'mm' && next === 'cm') ? 0.1 : 1;
      const conv = (el)=>{
        const n = Number(el && el.value);
        if(!Number.isFinite(n)) return;
        const v = n * factor;
        el.value = (next === 'cm') ? String(Math.round(v * 10) / 10) : String(Math.round(v));
      };
      [inW, inH, inK, inTrim, inMinW, inMinH].forEach(conv);
      state.unit = next;
      unitSel.value = next;
      const kerfLabel = kerfWrap.querySelector && kerfWrap.querySelector('label');
      const trimLabel = trimWrap.querySelector && trimWrap.querySelector('label');
      const minLabel = minScrapWrap.querySelector && minScrapWrap.querySelector('label');
      if(kerfLabel) kerfLabel.textContent = `Rzaz piły (${next})`;
      if(trimLabel) trimLabel.textContent = `Obrównanie krawędzi — arkusz standardowy (${next})`;
      if(minLabel) minLabel.textContent = `Najmniejszy użyteczny odpad (${next})`;
    }

    const actionRow = h('div', { class:'rozrys-actions-row' });
    const genBtn = h('button', { class:'btn-generate-green rozrys-action-btn rozrys-action-btn--generate', type:'button' });
    genBtn.textContent = 'Generuj rozkrój';
    actionRow.appendChild(openOptionsBtnInline);
    actionRow.appendChild(addStockBtn);
    actionRow.appendChild(genBtn);
    cfg.card.appendChild(actionRow);

    const statusBox = h('div', { class:'rozrys-status', style:'display:none;margin-top:12px' });
    const statusTop = h('div', { class:'rozrys-status-top' });
    const statusSpinner = h('div', { class:'rozrys-spinner' });
    const statusCopy = h('div', { class:'rozrys-status-copy' });
    const statusMain = h('div', { class:'rozrys-status-main', text:'Liczę…' });
    const statusSub = h('div', { class:'muted xs rozrys-status-sub', text:'' });
    const statusProg = h('div', { class:'rozrys-progress is-indeterminate' });
    const statusProgBar = h('div', { class:'rozrys-progress-bar' });
    const statusMeta = h('div', { class:'muted xs rozrys-progress-meta', text:'' });
    statusProg.appendChild(statusProgBar);
    statusCopy.appendChild(statusMain);
    statusCopy.appendChild(statusSub);
    statusCopy.appendChild(statusProg);
    statusCopy.appendChild(statusMeta);
    statusTop.appendChild(statusSpinner);
    statusTop.appendChild(statusCopy);
    statusBox.appendChild(statusTop);
    cfg.card.appendChild(statusBox);

    const out = h('div', { style:'margin-top:12px' });
    cfg.card.appendChild(out);

    function getBaseState(){
      const base = (FC.rozrysState && typeof FC.rozrysState.buildBaseStateFromControls === 'function')
        ? FC.rozrysState.buildBaseStateFromControls({ unitSel, edgeSel, inW, inH, inK, inTrim, inMinW, inMinH, heurSel, dirSel }, { normalizeCutDirection: d.normalizeCutDirection })
        : {
            unit: unitSel.value,
            edgeSubMm: Math.max(0, Number(edgeSel.value) || 0),
            boardW: Number(inW.value) || (unitSel.value === 'mm' ? 2800 : 280),
            boardH: Number(inH.value) || (unitSel.value === 'mm' ? 2070 : 207),
            kerf: Number(inK.value) || (unitSel.value === 'mm' ? 4 : 0.4),
            edgeTrim: Number(inTrim.value) || (unitSel.value === 'mm' ? 10 : 1),
            minScrapW: Math.max(0, Number(inMinW.value) || 0),
            minScrapH: Math.max(0, Number(inMinH.value) || 0),
            heur: 'optimax',
            optimaxProfile: heurSel.value,
            direction: d.normalizeCutDirection(dirSel.value),
          };
      try{ if(cfg.rozState && typeof cfg.rozState.setOptionState === 'function') cfg.rozState.setOptionState(Object.assign({}, state, base)); }catch(_){ }
      return base;
    }

    return {
      unitWrap,
      edgeWrap,
      kerfWrap,
      trimWrap,
      minScrapWrap,
      unitSel,
      edgeSel,
      inW,
      inH,
      inK,
      inTrim,
      inMinW,
      inMinH,
      heurSel,
      dirSel,
      heurBtn,
      dirBtn,
      addStockBtn,
      openOptionsBtnInline,
      genBtn,
      statusBox,
      statusMain,
      statusSub,
      statusMeta,
      statusProg,
      statusProgBar,
      out,
      persistOptionPrefs,
      applyUnitChange,
      getBaseState,
    };
  }

  FC.rozrysPanelWorkspace = {
    createApi(){
      return { createWorkspace };
    }
  };
})();
