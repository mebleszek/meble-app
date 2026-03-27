(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function formatElapsed(ms){
    return `${(Math.max(0, Number(ms)||0)/1000).toFixed(1)} s`;
  }

  function axisProgressLabel(axis){
    return axis === 'along' ? 'wzdłuż' : (axis === 'across' ? 'w poprzek' : '—');
  }

  function buildProgressMeta(info, estimate){
    const phase = String(info && info.phase || 'main');
    const currentSheet = Math.max(0, Number(info && info.currentSheet) || 0);
    const nextSheet = Math.max(1, Number(info && info.nextSheet) || (currentSheet > 0 ? currentSheet + 1 : 1));
    const seedIndex = Number(info && info.seedIndex) || 0;
    const seedTotal = Number(info && info.seedTotal) || 0;
    const axisTxt = axisProgressLabel((info && info.axis) || (info && info.to) || null);
    const suffix = (seedIndex > 0 && seedTotal > 0) ? ` • wariant ${seedIndex}/${seedTotal}` : '';
    if(phase === 'sheet-closed'){
      return (Number(info && info.remaining) || 0) > 0
        ? `Postęp: zamknięta płyta ${currentSheet} z ~${estimate} • liczę płytę ${nextSheet}`
        : `Postęp: zamknięta płyta ${currentSheet} z ~${estimate}`;
    }
    if(phase === 'sheet-start') return `Start płyty ${nextSheet} z ~${estimate}`;
    if(phase === 'mandatory-axis-switch') return `Zmiana kierunku pasów: teraz ${axisTxt}`;
    if(phase === 'axis-switch-check') return `Brak idealnego pasa ${axisTxt} — sprawdzam drugi kierunek`;
    if(phase === 'axis-switched') return `Przełączono kierunek pasów na ${axisTxt}`;
    if(phase === 'fallback-band-used') return `Brak idealnego pasa — używam najlepszego dostępnego ${axisTxt}`;
    if(phase.indexOf('start') === 0) return `Analiza pasów startowych ${axisTxt}${suffix}`;
    if(phase.indexOf('residual') === 0) return `Domykanie arkusza pasami ${axisTxt}${suffix}`;
    if(currentSheet > 0) return `Postęp: zamknięta płyta ${currentSheet} z ~${estimate} • liczę płytę ${nextSheet}`;
    return 'Trwa liczenie — worker odpowiada w tle.';
  }

  function progressPercent(info, estimate){
    const currentSheet = Math.max(0, Number(info && info.currentSheet) || 0);
    return currentSheet > 0 ? Math.min(98, (currentSheet / Math.max(estimate, currentSheet)) * 100) : NaN;
  }

  function createController(opts){
    const cfg = Object.assign({
      statusBox:null,
      statusMain:null,
      statusSub:null,
      statusMeta:null,
      statusProg:null,
      statusProgBar:null,
      genBtn:null,
    }, opts || {});

    const state = {
      runId:0,
      running:false,
      btnMode:'idle',
      cancelRequested:false,
      activeCancel:null,
      activeTerminate:null,
      cancelTimer:null,
      overallTick:null,
      overallStartedAt:0,
      globalProgressInfo:{ material:'', profile:'MAX', phase:'main', bestSheets:null, currentSheet:0, nextSheet:1, remaining:null, sheetEstimate:1, axis:null, seedIndex:null, seedTotal:null },
    };

    function setGlobalStatus(active, title, subtitle, percent, metaText){
      try{
        if(cfg.statusBox) cfg.statusBox.style.display = 'none';
        if(cfg.statusMain) cfg.statusMain.textContent = title || 'Liczę…';
        if(cfg.statusSub) cfg.statusSub.textContent = subtitle || '';
        if(cfg.statusMeta) cfg.statusMeta.textContent = metaText || '';
        if(cfg.statusProg) cfg.statusProg.classList.add('is-indeterminate');
        if(cfg.statusProgBar) cfg.statusProgBar.style.width = '';
        const n = Number(percent);
        if(cfg.statusProg && cfg.statusProgBar && Number.isFinite(n)){
          cfg.statusProg.classList.remove('is-indeterminate');
          cfg.statusProgBar.style.width = `${Math.max(0, Math.min(100, n))}%`;
        }
      }catch(_){ }
    }

    function setGenBtnMode(mode){
      state.btnMode = mode;
      const btn = cfg.genBtn;
      if(!btn) return;
      btn.classList.remove('btn-generate-green', 'btn-generate-blue', 'btn-generate-red');
      if(mode === 'running'){
        btn.textContent = 'Anuluj';
        btn.classList.add('btn-generate-red');
        btn.disabled = false;
        return;
      }
      if(mode === 'done'){
        btn.textContent = 'Generuj ponownie';
        btn.classList.add('btn-generate-blue');
        btn.disabled = false;
        return;
      }
      btn.textContent = 'Generuj rozkrój';
      btn.classList.add('btn-generate-green');
      btn.disabled = false;
    }

    function clearCancelTimer(){
      if(state.cancelTimer){
        try{ clearTimeout(state.cancelTimer); }catch(_){ }
        state.cancelTimer = null;
      }
    }

    function clearActiveHooks(){
      state.activeCancel = null;
      state.activeTerminate = null;
      clearCancelTimer();
    }

    function requestCancel(){
      if(!state.running) return;
      state.cancelRequested = true;
      try{ setGlobalStatus(true, 'Anulowanie…', 'Wysyłam przerwanie do workera.', NaN, 'Jeśli worker nie odpowie, za chwilę wymuszę zatrzymanie.'); }catch(_){ }
      try{ state.activeCancel && state.activeCancel(); }catch(_){ }
      clearCancelTimer();
      state.cancelTimer = setTimeout(()=>{
        if(!state.running) return;
        try{ state.activeTerminate && state.activeTerminate(); }catch(_){ }
      }, 700);
    }

    function refreshGlobalTicker(){
      try{
        if(!state.running) return;
        const prof = String(state.globalProgressInfo.profile || 'MAX');
        const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - state.overallStartedAt;
        const bestTxt = state.globalProgressInfo.bestSheets ? `${state.globalProgressInfo.bestSheets} płyt` : '—';
        const estimate = Math.max(1, Number(state.globalProgressInfo.sheetEstimate) || 1);
        const pct = progressPercent(state.globalProgressInfo, estimate);
        const subtitle = `Liczę kolor: ${state.globalProgressInfo.material || '—'} • Szacunek: ~${estimate} płyt • Najlepsze: ${bestTxt}`;
        const meta = buildProgressMeta(state.globalProgressInfo, estimate);
        setGlobalStatus(true, `${prof} • ${formatElapsed(elapsed)}`, subtitle, pct, meta);
      }catch(_){ }
    }

    function beginGlobalTicker(material, profile, sheetEstimate){
      state.overallStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      state.globalProgressInfo = {
        material: material || '',
        profile: profile || 'D',
        phase: 'main',
        bestSheets: null,
        currentSheet: 0,
        nextSheet: 1,
        remaining: null,
        sheetEstimate: Math.max(1, Number(sheetEstimate) || 1),
        axis: null,
        seedIndex: null,
        seedTotal: null,
      };
      refreshGlobalTicker();
      if(state.overallTick) return;
      state.overallTick = setInterval(refreshGlobalTicker, 250);
    }

    function patchGlobalProgress(patch){
      state.globalProgressInfo = Object.assign({}, state.globalProgressInfo, patch || {});
      refreshGlobalTicker();
    }

    function stopGlobalTicker(){
      try{ if(state.overallTick) clearInterval(state.overallTick); }catch(_){ }
      state.overallTick = null;
    }

    function startRun(){
      if(state.running) return null;
      state.running = true;
      state.cancelRequested = false;
      state.runId += 1;
      setGenBtnMode('running');
      return state.runId;
    }

    function finishRun(){
      state.running = false;
      stopGlobalTicker();
      clearActiveHooks();
      try{ setGlobalStatus(false); }catch(_){ }
    }

    function isActiveRun(runId){
      return Number(runId) === Number(state.runId);
    }

    try{ setGlobalStatus(false); }catch(_){ }
    setGenBtnMode('idle');

    return {
      startRun,
      finishRun,
      isRunning: ()=> !!state.running,
      isActiveRun,
      getButtonMode: ()=> state.btnMode,
      setGenBtnMode,
      setStatus: setGlobalStatus,
      requestCancel,
      wasCancelRequested: ()=> !!state.cancelRequested,
      setActiveHooks(cancelFn, terminateFn){
        state.activeCancel = (typeof cancelFn === 'function') ? cancelFn : null;
        state.activeTerminate = (typeof terminateFn === 'function') ? terminateFn : null;
      },
      clearActiveHooks,
      beginGlobalTicker,
      patchGlobalProgress,
      stopGlobalTicker,
      formatElapsed,
      buildProgressMeta,
      progressPercent,
    };
  }

  FC.rozrysProgress = {
    createController,
    formatElapsed,
    buildProgressMeta,
    progressPercent,
  };
})();
