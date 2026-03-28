(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function normalizeCutDirection(dir){
    if(dir === 'start-across' || dir === 'across') return 'start-across';
    if(dir === 'start-optimax' || dir === 'optimax' || dir === 'optima') return 'start-optimax';
    return 'start-along';
  }

  function speedLabel(mode){
    const m = String(mode || 'max').toLowerCase();
    if(m === 'turbo') return 'Turbo';
    if(m === 'dokladnie' || m === 'dokładnie') return 'Dokładnie';
    return 'MAX';
  }

  function directionLabel(dir){
    const norm = normalizeCutDirection(dir);
    if(norm === 'start-across') return 'Pierwsze pasy w poprzek';
    if(norm === 'start-optimax') return 'Opti-max';
    return 'Pierwsze pasy wzdłuż';
  }

  function formatHeurLabel(st){
    if(st && st.heur === 'optimax'){
      return `${speedLabel(st.optimaxProfile || 'max')} • ${directionLabel(st.direction)}`;
    }
    return String((st && st.heur) || '');
  }

  function getOptimaxProfilePreset(){
    return {};
  }

  function toMmByStateUnit(state, value){
    const unit = (state && state.unit === 'mm') ? 'mm' : 'cm';
    const n = Number(value);
    if(!Number.isFinite(n)) return 0;
    return unit === 'mm' ? Math.round(n) : Math.round(n * 10);
  }

  function mapPartsForOptimizer(parts, state, deps){
    const cfg = Object.assign({ loadEdgeStore:null, partSignature:null, isPartRotationAllowed:null }, deps || {});
    const grainOn = !!(state && state.grain);
    const overrides = Object.assign({}, state && state.grainExceptions || {});
    const edgeStore = typeof cfg.loadEdgeStore === 'function' ? cfg.loadEdgeStore() : {};
    return (parts || []).map((p)=>{
      const sig = typeof cfg.partSignature === 'function' ? cfg.partSignature(p) : String(p && p.key || '');
      const allow = typeof cfg.isPartRotationAllowed === 'function' ? cfg.isPartRotationAllowed(p, grainOn, overrides) : true;
      const e = edgeStore[sig] || {};
      return {
        key: sig,
        name: p.name,
        w: p.w,
        h: p.h,
        qty: p.qty,
        material: p.material,
        rotationAllowed: allow,
        edgeW1: !!e.w1,
        edgeW2: !!e.w2,
        edgeH1: !!e.h1,
        edgeH2: !!e.h2,
      };
    });
  }

  function buildPlanMetaFromState(state){
    const unit = (state && state.unit === 'mm') ? 'mm' : 'cm';
    const W0 = toMmByStateUnit(state, state && state.boardW) || 2800;
    const H0 = toMmByStateUnit(state, state && state.boardH) || 2070;
    const trim = toMmByStateUnit(state, state && state.edgeTrim) || 20;
    return { trim, boardW: W0, boardH: H0, unit };
  }

  function computePlan(state, parts, deps){
    const cfg = Object.assign({ loadEdgeStore:null, partSignature:null, isPartRotationAllowed:null, cutOptimizer:null }, deps || {});
    const opt = cfg.cutOptimizer || FC.cutOptimizer;
    if(!opt) return { sheets: [], note: 'Brak modułu cutOptimizer.' };

    const partsMm = mapPartsForOptimizer(parts, state, cfg);
    const items = opt.makeItems(partsMm);
    const unit = (state && state.unit === 'mm') ? 'mm' : 'cm';
    const W0 = toMmByStateUnit(state, state && state.boardW) || 2800;
    const H0 = toMmByStateUnit(state, state && state.boardH) || 2070;
    const K = toMmByStateUnit(state, state && state.kerf) || 4;
    const trim = toMmByStateUnit(state, state && state.edgeTrim) || 20;
    const W = Math.max(10, W0 - 2 * trim);
    const H = Math.max(10, H0 - 2 * trim);

    let sheets = [];
    if(state && state.heur === 'super'){
      if(typeof opt.packSuper !== 'function') return { sheets: [], note: 'Brak modułu SUPER (packSuper).' };
      sheets = opt.packSuper(items, W, H, K, { timeMs:2600, beamWidth:140 });
    }else if(state && state.heur === 'panel30'){
      if(typeof opt.packGuillotineBeam !== 'function') return { sheets: [], note: 'Brak modułu Gilotyna PRO (packGuillotineBeam).' };
      sheets = opt.packGuillotineBeam(items, W, H, K, {
        beamWidth:260,
        timeMs:30000,
        cutPref: normalizeCutDirection(state.direction),
        scrapFirst:true,
      });
    }else if(state && state.heur === 'gpro'){
      if(typeof opt.packGuillotineBeam !== 'function') return { sheets: [], note: 'Brak modułu Gilotyna PRO (packGuillotineBeam).' };
      sheets = opt.packGuillotineBeam(items, W, H, K, { beamWidth:80, timeMs:700 });
    }else{
      const dir = normalizeCutDirection(state && state.direction);
      const toShelfDir = (d)=> (d === 'across') ? 'wpoprz' : 'wzdłuż';
      sheets = opt.packShelf(items, W, H, K, toShelfDir(dir));
    }
    return { sheets, meta: { trim, boardW: W0, boardH: H0, unit } };
  }

  function computePlanPanelProAsync(state, parts, onProgress, control, panelOpts, deps){
    const cfg = Object.assign({ loadEdgeStore:null, partSignature:null, isPartRotationAllowed:null, cutOptimizer:null }, deps || {});
    return new Promise((resolve)=>{
      const opt = cfg.cutOptimizer || FC.cutOptimizer;
      if(!opt) return resolve({ sheets: [], note: 'Brak modułu cutOptimizer.' });
      const requestedSpeedMode = opt && typeof opt.normalizeSpeedMode === 'function'
        ? opt.normalizeSpeedMode((panelOpts && (panelOpts.speedMode || panelOpts.optimaxProfile)) || state.optimaxProfile)
        : String(((panelOpts && (panelOpts.speedMode || panelOpts.optimaxProfile)) || state.optimaxProfile || 'max')).toLowerCase();
      const blockMainThreadFallback = requestedSpeedMode === 'max';
      const partsMm = mapPartsForOptimizer(parts, state, cfg);
      const items = opt.makeItems(partsMm);
      const unit = (state && state.unit === 'mm') ? 'mm' : 'cm';
      const W0 = toMmByStateUnit(state, state && state.boardW) || 2800;
      const H0 = toMmByStateUnit(state, state && state.boardH) || 2070;
      const K = toMmByStateUnit(state, state && state.kerf) || 4;
      const trim = toMmByStateUnit(state, state && state.edgeTrim) || 20;
      const W = Math.max(10, W0 - 2*trim);
      const H = Math.max(10, H0 - 2*trim);

      let worker = null;
      try{
        worker = new Worker('js/app/optimizer/panel-pro-worker.js?v=20260328_arch_dirs_tests_v1');
      }catch(_){
        if(blockMainThreadFallback){
          return resolve({ sheets: [], note: 'Nie udało się uruchomić Web Workera dla trybu MAX.', workerFailed: true, noSyncFallback: true, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
        try{
          const startMode = normalizeCutDirection(state && state.direction);
          const speedMode = FC.cutOptimizer && FC.cutOptimizer.normalizeSpeedMode ? FC.cutOptimizer.normalizeSpeedMode(state && state.optimaxProfile) : 'max';
          const startStrategy = FC.rozkrojStarts && FC.rozkrojStarts[startMode];
          const speed = FC.rozkrojSpeeds && FC.rozkrojSpeeds[speedMode];
          const packed = speed && typeof speed.pack === 'function'
            ? speed.pack(items, W, H, K, { startStrategy, startMode, speedMode })
            : { sheets: opt.packShelf(items, W, H, K, 'along') };
          return resolve({ sheets: packed.sheets || [], meta: { trim, boardW: W0, boardH: H0, unit } });
        }catch(_e){
          return resolve({ sheets: [], note: 'Nie udało się uruchomić Web Worker.', workerFailed: true, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
      }

      let settled = false;
      const runId = (control && Number(control.runId)) ? Number(control.runId) : 0;
      if(control){
        const postCancel = ()=>{ try{ worker && worker.postMessage({ cmd:'cancel', runId }); }catch(_){ } };
        control.cancel = ()=>{ control._cancelRequested = true; postCancel(); };
        if(control._cancelRequested) postCancel();
      }

      const cleanup = ()=>{
        try{ worker.removeEventListener('message', handle); }catch(_){ }
        try{ worker.removeEventListener('error', onErr); }catch(_){ }
        try{ worker.removeEventListener('messageerror', onMsgErr); }catch(_){ }
        try{ worker.terminate(); }catch(_){ }
        worker = null;
      };
      const finish = (payload)=>{
        if(settled) return;
        settled = true;
        cleanup();
        resolve(payload);
      };
      if(control){
        control._terminate = ()=>{
          try{ worker && worker.terminate && worker.terminate(); }catch(_){ }
          try{ finish({ sheets: [], cancelled: true, note: 'Generowanie przerwane.', meta: { trim, boardW: W0, boardH: H0, unit } }); }catch(_){ }
        };
      }
      const handle = (ev)=>{
        const msg = ev && ev.data ? ev.data : {};
        if(msg.type === 'progress'){
          try{ onProgress && onProgress(msg); }catch(_){ }
          return;
        }
        if(msg.type === 'done'){
          const result = msg.result || {};
          finish({ sheets: result.sheets || [], cancelled: !!result.cancelled, meta: { trim, boardW: W0, boardH: H0, unit } });
          return;
        }
        if(msg.type === 'error'){
          finish({ sheets: [], note: msg.error || 'Błąd worker', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
        }
      };
      const onErr = ()=> finish({ sheets: [], note: 'Błąd Web Workera (nie udało się wykonać obliczeń).', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      const onMsgErr = ()=> finish({ sheets: [], note: 'Błąd komunikacji z Web Workerem.', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      worker.addEventListener('message', handle);
      worker.addEventListener('error', onErr);
      worker.addEventListener('messageerror', onMsgErr);

      const o = Object.assign({ startMode: normalizeCutDirection(state && state.direction), speedMode: String((state && state.optimaxProfile) || 'max').toLowerCase(), sheetEstimate: Number(panelOpts && panelOpts.sheetEstimate) || 1 }, (panelOpts || {}));
      try{
        worker.postMessage({ cmd:'panel_pro', runId, items, W, H, K, options:o });
      }catch(_){
        finish({ sheets: [], note: 'Nie udało się wystartować liczenia.', workerFailed: true, noSyncFallback: !!blockMainThreadFallback, meta: { trim, boardW: W0, boardH: H0, unit } });
      }
    });
  }

  async function computePlanWithCurrentEngine(state, parts, panelOpts, deps){
    const cfg = Object.assign({ computePlan:null, computePlanPanelProAsync:null }, deps || {});
    if((state && state.heur) !== 'optimax'){
      return typeof cfg.computePlan === 'function' ? cfg.computePlan(state, parts) : { sheets:[], note:'Brak computePlan().' };
    }
    const preset = getOptimaxProfilePreset(state && state.optimaxProfile, state && state.direction);
    const cutMode = normalizeCutDirection(state && state.direction);
    const W0 = toMmByStateUnit(state, state && state.boardW) || 2800;
    const H0 = toMmByStateUnit(state, state && state.boardH) || 2070;
    const trim = toMmByStateUnit(state, state && state.edgeTrim) || 20;
    const minScrapW = toMmByStateUnit(state, state && state.minScrapW) || 0;
    const minScrapH = toMmByStateUnit(state, state && state.minScrapH) || 0;
    const W = Math.max(10, W0 - 2 * trim);
    const H = Math.max(10, H0 - 2 * trim);
    const roughArea = (parts || []).reduce((sum, p)=> sum + ((Number(p.w)||0) * (Number(p.h)||0) * Math.max(1, Number(p.qty)||1)), 0);
    const roughSheetsEstimate = Math.max(1, Math.ceil(roughArea / Math.max(1, W * H)));
    let plan = null;
    const control = { runId:0 };
    try{
      if(typeof cfg.computePlanPanelProAsync === 'function'){
        plan = await cfg.computePlanPanelProAsync(state, parts, null, control, {
          beamWidth: preset.beamWidth,
          endgameAttempts: preset.endgameAttempts,
          cutPref: cutMode,
          cutMode,
          minScrapW,
          minScrapH,
          speedMode: String((state && state.optimaxProfile) || 'max').toLowerCase(),
          optimaxProfile: String((state && state.optimaxProfile) || 'max').toLowerCase(),
          sheetEstimate: roughSheetsEstimate,
          optimax: true,
          realHalfQty: Math.max(0, Number(state && state.realHalfQty) || 0),
          realHalfBoardW: Math.round(Number(state && state.realHalfBoardW) || 0),
          realHalfBoardH: Math.round(Number(state && state.realHalfBoardH) || 0),
        });
      }
    }catch(_){
      plan = null;
    }
    if(plan && Array.isArray(plan.sheets) && plan.sheets.length) return plan;
    const fallback = typeof cfg.computePlan === 'function' ? cfg.computePlan(state, parts) : { sheets:[] };
    if(!fallback.meta) fallback.meta = buildPlanMetaFromState(state);
    if(plan && plan.note && !fallback.note) fallback.note = plan.note;
    return fallback;
  }

  FC.rozrysEngine = {
    normalizeCutDirection,
    speedLabel,
    directionLabel,
    formatHeurLabel,
    getOptimaxProfilePreset,
    computePlan,
    computePlanPanelProAsync,
    computePlanWithCurrentEngine,
    buildPlanMetaFromState,
  };
})();
