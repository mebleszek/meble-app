(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createFallbackController(ctx, deps){
    const controls = (ctx && ctx.controls) || {};
    const state = ctx && ctx.state ? ctx.state : { unit:'cm' };
    const normalizeCutDirection = deps && typeof deps.normalizeCutDirection === 'function'
      ? deps.normalizeCutDirection
      : ((value)=> String(value || 'start-optimax'));
    return {
      persistOptionPrefs(){},
      applyUnitChange(next){ state.unit = next; if(controls.unitSel) controls.unitSel.value = next; },
      getBaseState(){
        return {
          unit: controls.unitSel && controls.unitSel.value ? controls.unitSel.value : state.unit,
          edgeSubMm: Math.max(0, Number(controls.edgeSel && controls.edgeSel.value) || 0),
          boardW: Number(controls.inW && controls.inW.value) || 0,
          boardH: Number(controls.inH && controls.inH.value) || 0,
          kerf: Number(controls.inK && controls.inK.value) || 0,
          edgeTrim: Number(controls.inTrim && controls.inTrim.value) || 0,
          minScrapW: Math.max(0, Number(controls.inMinW && controls.inMinW.value) || 0),
          minScrapH: Math.max(0, Number(controls.inMinH && controls.inMinH.value) || 0),
          heur: 'optimax',
          optimaxProfile: controls.heurSel && controls.heurSel.value ? controls.heurSel.value : 'max',
          direction: normalizeCutDirection(controls.dirSel && controls.dirSel.value),
        };
      },
    };
  }

  function createController(ctx, deps){
    const cfg = Object.assign({
      controls:null,
      state:null,
      selectedRooms:null,
      materialScope:null,
      rozState:null,
    }, ctx || {});
    const helpers = Object.assign({
      savePanelPrefs:null,
      loadPanelPrefs:null,
      encodeRoomsSelection:null,
      encodeMaterialScope:null,
      normalizeCutDirection:null,
    }, deps || {});
    const controls = cfg.controls || {};
    const state = cfg.state || { unit:'cm' };
    const savePanelPrefs = typeof helpers.savePanelPrefs === 'function' ? helpers.savePanelPrefs : null;
    const loadPanelPrefs = typeof helpers.loadPanelPrefs === 'function' ? helpers.loadPanelPrefs : (()=> ({}));
    const encodeRoomsSelection = typeof helpers.encodeRoomsSelection === 'function' ? helpers.encodeRoomsSelection : (()=> '');
    const encodeMaterialScope = typeof helpers.encodeMaterialScope === 'function' ? helpers.encodeMaterialScope : (()=> '');
    const normalizeCutDirection = typeof helpers.normalizeCutDirection === 'function' ? helpers.normalizeCutDirection : ((value)=> String(value || 'start-optimax'));

    if(!controls.unitSel || !controls.inW || !controls.inH || !controls.inK || !controls.inTrim || !controls.inMinW || !controls.inMinH || !controls.heurSel || !controls.dirSel){
      return createFallbackController(cfg, helpers);
    }

    function persistOptionPrefs(){
      if(!savePanelPrefs) return;
      savePanelPrefs(Object.assign({}, loadPanelPrefs(), {
        selectedRooms: encodeRoomsSelection(typeof cfg.selectedRooms === 'function' ? cfg.selectedRooms() : []),
        materialScope: encodeMaterialScope(typeof cfg.materialScope === 'function' ? cfg.materialScope() : { kind:'all' }),
        unit: controls.unitSel.value,
        boardW: Math.max(1, Number(controls.inW.value) || (controls.unitSel.value === 'mm' ? 2800 : 280)),
        boardH: Math.max(1, Number(controls.inH.value) || (controls.unitSel.value === 'mm' ? 2070 : 207)),
        edgeSubMm: Math.max(0, Number(controls.edgeSel.value) || 0),
        kerf: Math.max(0, Number(controls.inK.value) || 0),
        edgeTrim: Math.max(0, Number(controls.inTrim.value) || 0),
        minScrapW: Math.max(0, Number(controls.inMinW.value) || 0),
        minScrapH: Math.max(0, Number(controls.inMinH.value) || 0),
      }));
    }

    function applyUnitChange(next){
      const prev = state.unit;
      if(prev === next) return;
      const factor = (prev==='cm' && next==='mm') ? 10 : (prev==='mm' && next==='cm') ? 0.1 : 1;
      const conv = (el)=>{
        const n = Number(el && el.value);
        if(!Number.isFinite(n)) return;
        const v = n * factor;
        el.value = (next==='cm') ? String(Math.round(v*10)/10) : String(Math.round(v));
      };
      conv(controls.inW); conv(controls.inH); conv(controls.inK); conv(controls.inTrim); conv(controls.inMinW); conv(controls.inMinH);
      state.unit = next;
      controls.unitSel.value = next;
      try{ if(controls.kerfWrap && typeof controls.kerfWrap.querySelector === 'function'){ const label = controls.kerfWrap.querySelector('label'); if(label) label.textContent = `Rzaz piły (${next})`; } }catch(_){ }
      try{ if(controls.trimWrap && typeof controls.trimWrap.querySelector === 'function'){ const label = controls.trimWrap.querySelector('label'); if(label) label.textContent = `Obrównanie krawędzi — arkusz standardowy (${next})`; } }catch(_){ }
      try{ if(controls.minScrapWrap && typeof controls.minScrapWrap.querySelector === 'function'){ const label = controls.minScrapWrap.querySelector('label'); if(label) label.textContent = `Najmniejszy użyteczny odpad (${next})`; } }catch(_){ }
    }

    function getBaseState(){
      const base = (FC.rozrysState && typeof FC.rozrysState.buildBaseStateFromControls === 'function')
        ? FC.rozrysState.buildBaseStateFromControls({
            unitSel: controls.unitSel,
            edgeSel: controls.edgeSel,
            inW: controls.inW,
            inH: controls.inH,
            inK: controls.inK,
            inTrim: controls.inTrim,
            inMinW: controls.inMinW,
            inMinH: controls.inMinH,
            heurSel: controls.heurSel,
            dirSel: controls.dirSel,
          }, { normalizeCutDirection })
        : {
            unit: controls.unitSel.value,
            edgeSubMm: Math.max(0, Number(controls.edgeSel.value)||0),
            boardW: Number(controls.inW.value)|| (controls.unitSel.value==='mm'?2800:280),
            boardH: Number(controls.inH.value)|| (controls.unitSel.value==='mm'?2070:207),
            kerf: Number(controls.inK.value)|| (controls.unitSel.value==='mm'?4:0.4),
            edgeTrim: Number(controls.inTrim.value)|| (controls.unitSel.value==='mm'?10:1),
            minScrapW: Math.max(0, Number(controls.inMinW.value)||0),
            minScrapH: Math.max(0, Number(controls.inMinH.value)||0),
            heur: 'optimax',
            optimaxProfile: controls.heurSel.value,
            direction: normalizeCutDirection(controls.dirSel.value),
          };
      try{ if(cfg.rozState && typeof cfg.rozState.setOptionState === 'function') cfg.rozState.setOptionState(Object.assign({}, state, base)); }catch(_){ }
      return base;
    }

    return {
      persistOptionPrefs,
      applyUnitChange,
      getBaseState,
    };
  }

  FC.rozrysOptionsState = {
    createApi(){
      return { createController };
    }
  };
})();
