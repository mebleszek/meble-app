(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      for(const k in attrs){
        if(k === 'class') el.className = attrs[k];
        else if(k === 'html') el.innerHTML = attrs[k];
        else if(k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((ch)=> el.appendChild(ch));
    return el;
  }

  async function generate(force, deps){
    const cfg = Object.assign({ progressCtrl:null }, deps || {});
    const progress = cfg.progressCtrl;
    if(!progress || typeof progress.startRun !== 'function') return;
    const runId = progress.startRun();
    if(runId == null) return;
    try{ await new Promise((resolve)=>{ try{ requestAnimationFrame(()=> resolve()); } catch(_){ setTimeout(resolve, 0); } }); }catch(_){ }
    try{
      const scope = cfg.normalizeMaterialScopeForAggregate(cfg.decodeMaterialScope(cfg.matSelValue), cfg.agg);
      const baseSt = {
        unit: cfg.unitValue,
        edgeSubMm: Math.max(0, Number(cfg.edgeValue)||0),
        boardW: Number(cfg.boardWValue)|| (cfg.unitValue==="mm"?2800:280),
        boardH: Number(cfg.boardHValue)|| (cfg.unitValue==="mm"?2070:207),
        kerf: Number(cfg.kerfValue)|| (cfg.unitValue==="mm"?4:0.4),
        edgeTrim: Number(cfg.trimValue)|| (cfg.unitValue==="mm"?20:2),
        minScrapW: Math.max(0, Number(cfg.minScrapWValue)||0),
        minScrapH: Math.max(0, Number(cfg.minScrapHValue)||0),
        heur: 'optimax',
        optimaxProfile: cfg.heurValue,
        direction: cfg.normalizeCutDirection(cfg.directionValue),
      };

      const cache = cfg.loadPlanCache();

      const runOne = async (material, parts, target)=>{
        if(!progress.isActiveRun(runId)) return;
        const hasGrain = cfg.materialHasGrain(material);
        const st = Object.assign({}, baseSt, {
          material,
          grain: !!(hasGrain && cfg.getMaterialGrainEnabled(material, hasGrain)),
          grainExceptions: cfg.getMaterialGrainExceptions(material, parts.map((p)=> cfg.partSignature(p)), hasGrain)
        });
        const unit3 = (st.unit === 'mm') ? 'mm' : 'cm';
        const toMm3 = (v)=>{
          const n = Number(v);
          if(!Number.isFinite(n)) return 0;
          return unit3 === 'mm' ? Math.round(n) : Math.round(n * 10);
        };
        const fullWmmForStock = toMm3(st.boardW) || 2800;
        const fullHmmForStock = toMm3(st.boardH) || 2070;
        const halfStock = cfg.getRealHalfStockForMaterial(material, fullWmmForStock, fullHmmForStock);
        st.realHalfQty = Math.max(0, Number(halfStock.qty) || 0);
        st.realHalfBoardW = Math.round(Number(halfStock.width) || 0);
        st.realHalfBoardH = Math.round(Number(halfStock.height) || 0);
        const exactStock = cfg.getExactSheetStockForMaterial(material, fullWmmForStock, fullHmmForStock);
        const fullStock = cfg.getLargestSheetFormatForMaterial(material, fullWmmForStock, fullHmmForStock);
        st.stockExactQty = Math.max(0, Number(exactStock.qty) || 0);
        st.stockFullBoardW = Math.round(Number(fullStock.width) || 0);
        st.stockFullBoardH = Math.round(Number(fullStock.height) || 0);
        st.stockPolicy = 'stock_limit_v4';
        st.stockSignature = cfg.buildStockSignatureForMaterial(material);
        const cacheKey = cfg.makePlanCacheKey(st, parts);
        if(!force && cache[cacheKey] && cache[cacheKey].plan){
          const cached = cache[cacheKey].plan;
          if(!progress.isActiveRun(runId)) return;
          cfg.renderOutput(cached, { material, kerf: st.kerf, heur: cfg.formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: cached.meta, parts, scopeMode: cfg.getRozrysScopeMode(scope), selectedRooms: cfg.agg.selectedRooms }, target);
          progress.setGenBtnMode('done');
          return;
        }

        if(st.heur === 'optimax'){
          const preset = cfg.getOptimaxProfilePreset(st.optimaxProfile, st.direction);
          const cutMode = cfg.normalizeCutDirection(st.direction);
          const unit2 = (st.unit === 'mm') ? 'mm' : 'cm';
          const toMm2 = (v)=>{
            const n = Number(v);
            if(!Number.isFinite(n)) return 0;
            return unit2 === 'mm' ? Math.round(n) : Math.round(n * 10);
          };
          const W02 = toMm2(st.boardW) || 2800;
          const H02 = toMm2(st.boardH) || 2070;
          const trim2 = toMm2(st.edgeTrim) || 20;
          const minScrapW2 = toMm2(st.minScrapW) || 0;
          const minScrapH2 = toMm2(st.minScrapH) || 0;
          const W2 = Math.max(10, W02 - 2*trim2);
          const H2 = Math.max(10, H02 - 2*trim2);
          const roughArea = (parts||[]).reduce((sum, p)=> sum + ((Number(p.w)||0) * (Number(p.h)||0) * Math.max(1, Number(p.qty)||1)), 0);
          const roughSheetsEstimate = Math.max(1, Math.ceil(roughArea / Math.max(1, W2 * H2)));

          const profileLabel = cfg.speedLabel(st.optimaxProfile || 'max');
          const loading = cfg.renderLoadingInto(target || null, `${profileLabel} • ${cfg.directionLabel(st.direction)} • 0.0 s`, `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Najlepsze: —`);
          progress.beginGlobalTicker(material, profileLabel, roughSheetsEstimate);
          const materialStartedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          const materialProgress = { phase:'main', bestSheets:null, currentSheet:0, nextSheet:1, remaining:null, sheetEstimate:roughSheetsEstimate, axis:null, seedIndex:null, seedTotal:null };
          function refreshMaterialTicker(){
            try{
              const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - materialStartedAt;
              const bestTxt = materialProgress.bestSheets ? `${materialProgress.bestSheets} płyt` : '—';
              const currentSheet = Math.max(0, Number(materialProgress.currentSheet) || 0);
              const est = Math.max(1, Number(materialProgress.sheetEstimate) || roughSheetsEstimate || 1);
              const pct = progress.progressPercent(materialProgress, est);
              const metaText = progress.buildProgressMeta(materialProgress, est);
              if(loading && loading.textEl) loading.textEl.textContent = `${profileLabel} • ${cfg.directionLabel(st.direction)} • ${progress.formatElapsed(elapsed)}`;
              if(loading && loading.subEl) loading.subEl.textContent = `Liczę kolor: ${material} • Szacunek: ~${est} płyt • Najlepsze: ${bestTxt}`;
              if(loading && typeof loading.setProgress === 'function') loading.setProgress(pct, metaText);
              progress.patchGlobalProgress({
                material,
                profile: profileLabel,
                phase: materialProgress.phase,
                bestSheets: materialProgress.bestSheets,
                currentSheet,
                nextSheet: Math.max(1, Number(materialProgress.nextSheet) || (currentSheet > 0 ? currentSheet + 1 : 1)),
                remaining: materialProgress.remaining,
                sheetEstimate: est,
                axis: materialProgress.axis,
                seedIndex: materialProgress.seedIndex,
                seedTotal: materialProgress.seedTotal,
              });
            }catch(_){ }
          }
          const materialTicker = setInterval(refreshMaterialTicker, 250);
          refreshMaterialTicker();
          try{
            if(loading && typeof loading.setProgress === 'function') loading.setProgress(NaN, 'Inicjalizacja workera…');
            if(loading && loading.subEl) loading.subEl.textContent = `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Start workera…`;
            progress.setStatus(true, `${profileLabel} • ${cfg.directionLabel(st.direction)} • 0.0 s`, `Liczę kolor: ${material} • Szacunek: ~${roughSheetsEstimate} płyt • Start workera…`, NaN, 'Inicjalizacja workera…');
          }catch(_){ }
          let plan = null;
          const control = { runId };
          progress.setActiveHooks(()=>{
            try{ control._cancelRequested = true; }catch(_){ }
            try{ control.cancel && control.cancel(); }catch(_){ }
          }, ()=>{
            try{ control._terminate && control._terminate(); }catch(_){ }
          });
          try{
            plan = await cfg.computePlanPanelProAsync(st, parts, (p)=>{
              try{
                materialProgress.phase = (p && p.phase) ? String(p.phase) : 'main';
                materialProgress.bestSheets = (p && Number(p.bestSheets)) ? Number(p.bestSheets) : null;
                materialProgress.currentSheet = (p && typeof p.currentSheet === 'number') ? Number(p.currentSheet) : materialProgress.currentSheet;
                materialProgress.nextSheet = (p && typeof p.nextSheet === 'number') ? Number(p.nextSheet) : materialProgress.nextSheet;
                materialProgress.remaining = (p && typeof p.remaining === 'number') ? Number(p.remaining) : materialProgress.remaining;
                materialProgress.sheetEstimate = (p && Number(p.sheetEstimate)) ? Number(p.sheetEstimate) : materialProgress.sheetEstimate;
                materialProgress.axis = (p && p.axis) ? String(p.axis) : materialProgress.axis;
                materialProgress.seedIndex = (p && typeof p.seedIndex === 'number') ? Number(p.seedIndex) : materialProgress.seedIndex;
                materialProgress.seedTotal = (p && typeof p.seedTotal === 'number') ? Number(p.seedTotal) : materialProgress.seedTotal;
                refreshMaterialTicker();
              }catch(_){ }
            }, control, {
              beamWidth: preset.beamWidth,
              endgameAttempts: preset.endgameAttempts,
              cutPref: cutMode,
              cutMode,
              minScrapW: minScrapW2,
              minScrapH: minScrapH2,
              speedMode: String(st.optimaxProfile || 'max').toLowerCase(),
              optimaxProfile: String(st.optimaxProfile || 'max').toLowerCase(),
              sheetEstimate: roughSheetsEstimate,
              optimax: true,
              realHalfQty: Math.max(0, Number(st.realHalfQty) || 0),
              realHalfBoardW: Math.round(Number(st.realHalfBoardW) || 0),
              realHalfBoardH: Math.round(Number(st.realHalfBoardH) || 0),
            });
          }catch(_){
            plan = { sheets: [], note: 'Błąd podczas liczenia (Optimax).' };
          } finally {
            try{ clearInterval(materialTicker); }catch(_){ }
            progress.clearActiveHooks();
          }

          if((!plan || !Array.isArray(plan.sheets) || plan.sheets.length === 0) && !(plan && plan.noSyncFallback)){
            try{
              const opt2 = FC.cutOptimizer;
              const grainOn2 = !!st.grain;
              const overrides2 = Object.assign({}, st.grainExceptions || {});
              const edgeStore2 = cfg.loadEdgeStore();
              const partsMm2 = (parts||[]).map((p)=>{
                const sig = cfg.partSignature(p);
                const allow = cfg.isPartRotationAllowed(p, grainOn2, overrides2);
                const e = edgeStore2[sig] || {};
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
              const items2 = opt2.makeItems(partsMm2);
              const unit2 = (st.unit === 'mm') ? 'mm' : 'cm';
              const toMm2 = (v)=>{
                const n = Number(v);
                if(!Number.isFinite(n)) return 0;
                return unit2 === 'mm' ? Math.round(n) : Math.round(n * 10);
              };
              const W02 = toMm2(st.boardW) || 2800;
              const H02 = toMm2(st.boardH) || 2070;
              const K2  = toMm2(st.kerf)   || 4;
              const trim2 = toMm2(st.edgeTrim) || 20;
              const minScrapW2 = toMm2(st.minScrapW) || 0;
              const minScrapH2 = toMm2(st.minScrapH) || 0;
              const W2 = Math.max(10, W02 - 2*trim2);
              const H2 = Math.max(10, H02 - 2*trim2);
              const startMode2 = cfg.normalizeCutDirection(st.direction);
              const speedMode2 = FC.cutOptimizer && FC.cutOptimizer.normalizeSpeedMode ? FC.cutOptimizer.normalizeSpeedMode(st.optimaxProfile) : 'max';
              const startStrategy2 = FC.rozkrojStarts && FC.rozkrojStarts[startMode2];
              const speed2 = FC.rozkrojSpeeds && FC.rozkrojSpeeds[speedMode2];
              const packed2 = speed2 && typeof speed2.pack === 'function'
                ? speed2.pack(items2, W2, H2, K2, {
                    startStrategy: startStrategy2,
                    startMode: startMode2,
                    speedMode: speedMode2,
                    realHalfQty: Math.max(0, Number(st.realHalfQty) || 0),
                    realHalfBoardW: Math.round(Number(st.realHalfBoardW) || 0),
                    realHalfBoardH: Math.round(Number(st.realHalfBoardH) || 0),
                  })
                : { sheets: opt2.packShelf(items2, W2, H2, K2, 'along') };
              plan = { sheets: packed2.sheets || [], cancelled: !!(plan && plan.cancelled), meta: { trim: trim2, boardW: W02, boardH: H02, unit: unit2 }, note: plan && plan.note ? plan.note : undefined };
            }catch(_){ }
          }
          plan = await cfg.applySheetStockLimit(material, st, parts, plan, {
            onStatus: (message)=>{
              try{
                if(loading && loading.subEl) loading.subEl.textContent = `Liczę kolor: ${material} • ${message}`;
                progress.setStatus(true, `${profileLabel} • ${cfg.directionLabel(st.direction)} • ${progress.formatElapsed(((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - materialStartedAt)}`, `Liczę kolor: ${material} • ${message}`, NaN, message);
              }catch(_){ }
            }
          });
          try{ cache[cacheKey] = { ts: Date.now(), plan }; cfg.savePlanCache(cache); }catch(_){ }
          cfg.renderOutput(plan, { material, kerf: st.kerf, heur: cfg.formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta, cancelled: !!plan.cancelled, parts, scopeMode: cfg.getRozrysScopeMode(scope), selectedRooms: cfg.agg.selectedRooms }, target);
          try{ progress.setStatus(false, '', ''); }catch(_){ }
          progress.setGenBtnMode('done');
          return;
        }

        let plan = cfg.computePlan(st, parts);
        plan = await cfg.applySheetStockLimit(material, st, parts, plan);
        try{ cache[cacheKey] = { ts: Date.now(), plan }; cfg.savePlanCache(cache); }catch(_){ }
        cfg.renderOutput(plan, { material, kerf: st.kerf, heur: cfg.formatHeurLabel(st), unit: st.unit, edgeSubMm: st.edgeSubMm, meta: plan.meta, parts, scopeMode: cfg.getRozrysScopeMode(scope), selectedRooms: cfg.agg.selectedRooms }, target);
        progress.setGenBtnMode('done');
      };

      cfg.out.innerHTML = '';
      const entries = cfg.buildEntriesForScope(scope, cfg.agg);
      if(!entries.length){
        cfg.out.appendChild(h('div', { class:'muted', text:'Brak elementów do wygenerowania dla wybranego zakresu.' }));
        return;
      }
      const accordionScopeKey = cfg.getAccordionScopeKey(scope, cfg.agg);
      const accordionPref = cfg.getAccordionPref(accordionScopeKey);
      for(const entry of entries){
        const material = entry.material;
        const parts = entry.parts || [];
        if(!parts.length) continue;
        const hasGrain = cfg.materialHasGrain(material);
        const grainEnabled = hasGrain ? cfg.getMaterialGrainEnabled(material, hasGrain) : false;
        const section = cfg.createMaterialAccordionSection(material, {
          open: !!(accordionPref && accordionPref.open && accordionPref.material === material),
          grain: hasGrain,
          grainEnabled,
          grainDisabled: !hasGrain,
          onToggle: (isOpen, materialName)=> cfg.setAccordionPref(accordionScopeKey, materialName, isOpen),
          onGrainToggle: (checked)=>{
            cfg.setMaterialGrainEnabled(material, checked, hasGrain);
            cfg.tryAutoRenderFromCache();
          },
          onExceptionsClick: ()=> cfg.openMaterialGrainExceptions(material, parts || [])
        });
        cfg.out.appendChild(section.wrap);
        await runOne(material, parts, section.body);
        if(progress.wasCancelRequested()) break;
      }
    } finally {
      progress.finishRun();
      if(progress.getButtonMode() === 'running') progress.setGenBtnMode('idle');
    }
  }

  FC.rozrysRunner = {
    generate,
  };
})();
