/* panel-pro-worker.js — worker dla Optimax
   3 tryby (wzdłuż / w poprzek / optima) jadą przez wspólny rdzeń.
   Bez watchdogów czasowych i bez końcowego porządkowania ostatnich płyt.
*/

self.window = self;

const SOLVER_VER = '20260313_cleanup_v1';
try{
  importScripts(
    'optima-core.js?v=' + SOLVER_VER,
    'along-solver.js?v=' + SOLVER_VER,
    'across-solver.js?v=' + SOLVER_VER,
    'optima-solver.js?v=' + SOLVER_VER,
    'cut-optimizer.js?v=' + SOLVER_VER
  );
}catch(e){
  try{
    importScripts(
      '/js/app/optima-core.js?v=' + SOLVER_VER,
      '/js/app/along-solver.js?v=' + SOLVER_VER,
      '/js/app/across-solver.js?v=' + SOLVER_VER,
      '/js/app/optima-solver.js?v=' + SOLVER_VER,
      '/js/app/cut-optimizer.js?v=' + SOLVER_VER
    );
  }catch(_){ }
}

(function(){
  'use strict';

  const opt = (self.FC && self.FC.cutOptimizer) ? self.FC.cutOptimizer : null;
  let cancelledRunId = 0;

  function normalizeMode(mode){
    if(mode === 'across') return 'across';
    if(mode === 'optima') return 'optima';
    return 'along';
  }

  function postDone(runId, sheets, cancelled){
    self.postMessage({
      type: 'done',
      runId,
      result: {
        sheets: Array.isArray(sheets) ? sheets : [],
        cancelled: !!cancelled,
      }
    });
  }

  self.onmessage = function(ev){
    const msg = ev && ev.data ? ev.data : {};
    if(msg.cmd === 'cancel'){
      cancelledRunId = Number(msg.runId) || 0;
      return;
    }
    if(msg.cmd !== 'panel_pro') return;

    const runId = Number(msg.runId) || 0;
    const items = Array.isArray(msg.items) ? msg.items : [];
    const W = Number(msg.W) || 0;
    const H = Number(msg.H) || 0;
    const K = Number(msg.K) || 0;
    const options = Object.assign({}, msg.options || {});
    const mode = normalizeMode(options.cutMode || options.cutPref || options.direction);
    const isCancelled = ()=> cancelledRunId && cancelledRunId === runId;
    options.isCancelled = isCancelled;
    options.profile = String(options.optimaxProfile || options.profile || 'D').toUpperCase();

    try{
      if(!opt){
        self.postMessage({ type:'error', error:'Brak cutOptimizer w workerze.' });
        return;
      }
      let sheets = [];
      if(mode === 'optima' && typeof opt.packOptima === 'function'){
        sheets = opt.packOptima(items, W, H, K, options);
      } else if(typeof opt.packStripBands === 'function'){
        sheets = opt.packStripBands(items, W, H, K, mode, options);
      } else {
        self.postMessage({ type:'error', error:'Brak solvera rozkroju w workerze.' });
        return;
      }
      postDone(runId, sheets, isCancelled());
    }catch(err){
      self.postMessage({
        type: 'error',
        error: (err && (err.stack || err.message)) ? String(err.stack || err.message) : 'Błąd workera.'
      });
    }
  };
})();
