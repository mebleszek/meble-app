/* panel-pro-worker.js — nowy, uproszczony worker rozrysu
   Kierunek startu i szybkość liczenia są rozdzielone na osobne moduły. */
self.window = self;

const SOLVER_VER = '20260315_max_virtual_half_v1';
try{
  importScripts(
    'cut-optimizer.js?v=' + SOLVER_VER,
    'start-along.js?v=' + SOLVER_VER,
    'start-across.js?v=' + SOLVER_VER,
    'start-optimax.js?v=' + SOLVER_VER,
    'speed-turbo.js?v=' + SOLVER_VER,
    'speed-dokladnie.js?v=' + SOLVER_VER,
    'speed-max.js?v=' + SOLVER_VER
  );
}catch(e){
  try{
    importScripts(
      '/js/app/cut-optimizer.js?v=' + SOLVER_VER,
      '/js/app/start-along.js?v=' + SOLVER_VER,
      '/js/app/start-across.js?v=' + SOLVER_VER,
      '/js/app/start-optimax.js?v=' + SOLVER_VER,
      '/js/app/speed-turbo.js?v=' + SOLVER_VER,
      '/js/app/speed-dokladnie.js?v=' + SOLVER_VER,
      '/js/app/speed-max.js?v=' + SOLVER_VER
    );
  }catch(_){ }
}

(function(){
  'use strict';

  const FC = self.FC || {};
  const opt = FC.cutOptimizer || {};
  const starts = FC.rozkrojStarts || {};
  const speeds = FC.rozkrojSpeeds || {};

  let _cancelled = false;
  let _activeRunId = 0;

  function now(){ return (self.performance && performance.now) ? performance.now() : Date.now(); }

  function postProgress(payload){
    try{ self.postMessage({ type:'progress', ...payload }); }catch(_){ }
  }

  function summarize(result){
    const sheets = result && result.sheets ? result.sheets : [];
    const waste = sheets.reduce((sum, s)=> sum + (opt.calcWaste ? opt.calcWaste(s).waste : 0), 0);
    return { sheets, waste };
  }

  function runPlan(data){
    const items = Array.isArray(data.items) ? data.items : [];
    const W = Math.max(1, Number(data.W) || 0);
    const H = Math.max(1, Number(data.H) || 0);
    const K = Math.max(0, Number(data.K) || 0);
    const options = data.options || {};
    const startMode = opt.normalizeStartMode ? opt.normalizeStartMode(options.startMode || options.direction) : 'start-along';
    const speedMode = opt.normalizeSpeedMode ? opt.normalizeSpeedMode(options.speedMode || options.optimaxProfile) : 'max';
    const startStrategy = starts[startMode] || starts['start-along'];
    const speed = speeds[speedMode] || speeds['max'];
    if(!speed || typeof speed.pack !== 'function'){
      return { sheets: [], note: 'Brak aktywnego modułu liczenia.' };
    }

    const roughEstimate = Math.max(1, Number(options.sheetEstimate) || (opt.estimateSheetsByArea ? opt.estimateSheetsByArea(items, W, H) : 1));
    const startedAt = now();
    postProgress({
      startedAt,
      currentAttempt: 0,
      totalAttempts: 1,
      bestSheets: null,
      sheetEstimate: roughEstimate,
      currentSheet: 0,
      speedMode,
      startMode,
    });

    const result = speed.pack(items, W, H, K, {
      startStrategy,
      speedMode,
      startMode,
      isCancelled: ()=> _cancelled,
      onProgress: (info)=>{
        postProgress({
          startedAt,
          currentAttempt: 1,
          totalAttempts: 1,
          bestSheets: info && info.bestSheets ? info.bestSheets : null,
          currentSheet: info && typeof info.currentSheet === 'number' ? info.currentSheet : 0,
          nextSheet: info && typeof info.nextSheet === 'number' ? info.nextSheet : 1,
          sheetEstimate: roughEstimate,
          phase: info && info.phase ? info.phase : 'sheet',
          remaining: info && typeof info.remaining === 'number' ? info.remaining : null,
          axis: info && info.axis ? info.axis : null,
          seedIndex: info && typeof info.seedIndex === 'number' ? info.seedIndex : null,
          seedTotal: info && typeof info.seedTotal === 'number' ? info.seedTotal : null,
          bandNo: info && typeof info.bandNo === 'number' ? info.bandNo : null,
          occupancy: info && typeof info.occupancy === 'number' ? info.occupancy : null,
          speedMode,
          startMode,
        });
      }
    });

    return Object.assign({ cancelled: !!_cancelled }, summarize(result));
  }

  self.onmessage = function(ev){
    const data = ev && ev.data ? ev.data : {};
    const cmd = data.cmd;
    if(cmd === 'cancel'){
      if(!data.runId || data.runId === _activeRunId) _cancelled = true;
      return;
    }
    if(cmd !== 'panel_pro') return;
    _activeRunId = Number(data.runId) || 0;
    _cancelled = false;
    try{
      const result = runPlan(data);
      self.postMessage({ type:'done', result });
    }catch(err){
      self.postMessage({ type:'error', error: err && err.message ? err.message : String(err || 'Błąd worker') });
    }
  };
})();
