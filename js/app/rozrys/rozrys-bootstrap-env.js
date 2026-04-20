(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function createProjectSource(config){
    const runtimeFC = (config && config.FC) || FC;
    const host = (config && config.host) || window;
    return (runtimeFC.rozrysProjectSource && typeof runtimeFC.rozrysProjectSource.createApi === 'function')
      ? runtimeFC.rozrysProjectSource.createApi({ FC:runtimeFC, host })
      : {};
  }

  function createPrefsApi(config){
    const runtimeFC = (config && config.FC) || FC;
    return runtimeFC.rozrysPrefs || {};
  }

  function createUiTools(config){
    const runtimeFC = (config && config.FC) || FC;
    return (runtimeFC.rozrysUiTools && typeof runtimeFC.rozrysUiTools.createApi === 'function')
      ? runtimeFC.rozrysUiTools.createApi({ FC:runtimeFC })
      : {
          h: (tag, attrs, children)=> {
            const el = document.createElement(tag);
            if(attrs){
              for(const k in attrs){
                if(k === 'class') el.className = attrs[k];
                else if(k === 'html') el.innerHTML = attrs[k];
                else if(k === 'text') el.textContent = attrs[k];
                else el.setAttribute(k, attrs[k]);
              }
            }
            (children || []).forEach((child)=> el.appendChild(child));
            return el;
          },
          labelWithInfo: ()=> document.createElement('div'),
          openRozrysInfo: ()=> undefined,
          getSelectOptionLabel: ()=> '',
          setChoiceLaunchValue: ()=> undefined,
          createChoiceLauncher: (label)=> {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rozrys-choice-launch';
            btn.textContent = String(label || '');
            return btn;
          },
          openRozrysChoiceOverlay: ()=> Promise.resolve(null),
          askRozrysConfirm: ()=> Promise.resolve(false),
        };
  }

  function createPartHelpers(config){
    config = config || {};
    const runtimeFC = config.FC || FC;
    const host = config.host || window;
    const cmToMm = typeof config.cmToMm === 'function'
      ? config.cmToMm
      : ((v)=> {
          const s = String(v == null ? '' : v).trim().replace(',', '.');
          const n = Number(s);
          return Number.isFinite(n) ? Math.round(n * 10) : 0;
        });
    const partSignature = typeof config.partSignature === 'function'
      ? config.partSignature
      : ((part)=> `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`);

    return (runtimeFC.rozrysPartHelpers && typeof runtimeFC.rozrysPartHelpers.createApi === 'function')
      ? runtimeFC.rozrysPartHelpers.createApi({ FC:runtimeFC, host, cmToMm, partSignature })
      : (()=> {
          function getPartOptionsStore(){
            return (runtimeFC && runtimeFC.materialPartOptions) || null;
          }
          function normalizeFrontLaminatMaterialKey(materialKey){
            const match = String(materialKey || '').match(/^\s*Front\s*:\s*laminat\s*•\s*(.+)$/i);
            return match ? String(match[1] || '').trim() : String(materialKey || '').trim();
          }
          function resolveCabinetCutListFn(){
            try{
              if(runtimeFC.cabinetCutlist && typeof runtimeFC.cabinetCutlist.getCabinetCutList === 'function') return runtimeFC.cabinetCutlist.getCabinetCutList.bind(runtimeFC.cabinetCutlist);
            }catch(_){ }
            try{
              if(typeof getCabinetCutList === 'function') return getCabinetCutList;
            }catch(_){ }
            try{
              if(typeof host.getCabinetCutList === 'function') return host.getCabinetCutList;
            }catch(_){ }
            return null;
          }
          function resolveRozrysPartFromSource(part){
            try{
              const store = getPartOptionsStore();
              if(store && typeof store.resolvePartForRozrys === 'function') return store.resolvePartForRozrys(part);
            }catch(_){ }
            const materialKey = normalizeFrontLaminatMaterialKey(String((part && part.material) || '').trim());
            return {
              materialKey,
              name: String((part && part.name) || 'Element'),
              sourceSig: `${materialKey}||${String((part && part.name) || 'Element')}||${cmToMm(part && part.a)}x${cmToMm(part && part.b)}`,
              direction: 'default',
              ignoreGrain: false,
              w: cmToMm(part && part.a),
              h: cmToMm(part && part.b),
              qty: Math.max(1, Math.round(Number(part && part.qty) || 0)),
            };
          }
          function materialPartDirectionLabel(part){
            try{
              const store = getPartOptionsStore();
              if(store && typeof store.labelForDirection === 'function') return store.labelForDirection(part && part.direction);
            }catch(_){ }
            return 'Domyślny z materiału';
          }
          function isPartRotationAllowed(part, grainOn, overrides){
            if(!grainOn) return true;
            if(part && part.ignoreGrain) return true;
            const sig = partSignature(part);
            return !!(overrides && overrides[sig]);
          }
          function isFrontMaterialKey(materialKey){
            return /^\s*Front\s*:/i.test(String(materialKey || ''));
          }
          return { getPartOptionsStore, resolveCabinetCutListFn, resolveRozrysPartFromSource, materialPartDirectionLabel, isPartRotationAllowed, isFrontMaterialKey, normalizeFrontLaminatMaterialKey };
        })();
  }

  function createEngineBridge(config){
    config = config || {};
    const runtimeFC = config.FC || FC;
    return (runtimeFC.rozrysEngineBridge && typeof runtimeFC.rozrysEngineBridge.createApi === 'function')
      ? runtimeFC.rozrysEngineBridge.createApi({
          FC: runtimeFC,
          loadEdgeStore: config.loadEdgeStore,
          partSignature: config.partSignature,
          isPartRotationAllowed: config.isPartRotationAllowed,
          mmToUnitStr: config.mmToUnitStr,
        })
      : {};
  }

  function createUiBridge(config){
    const runtimeFC = (config && config.FC) || FC;
    return (runtimeFC.rozrysUiBridge && typeof runtimeFC.rozrysUiBridge.createApi === 'function')
      ? runtimeFC.rozrysUiBridge.createApi({ FC:runtimeFC })
      : {
          createProgressApi: ()=> ({
            controller:null,
            setGenBtnMode: ()=> undefined,
            requestCancel: ()=> undefined,
            isRozrysRunning: ()=> false,
            getRozrysBtnMode: ()=> 'idle',
          }),
          openOptionsModal: ()=> undefined,
          openAddStockModal: ()=> undefined,
        };
  }

  function createRuntimeUtils(config){
    config = config || {};
    const runtimeFC = config.FC || FC;
    return (runtimeFC.rozrysRuntimeUtils && typeof runtimeFC.rozrysRuntimeUtils.createApi === 'function')
      ? runtimeFC.rozrysRuntimeUtils.createApi({
          FC: runtimeFC,
          safeGetProject: config.safeGetProject,
          getRooms: config.getRooms,
          normalizeRoomSelection: config.normalizeRoomSelection,
          resolveCabinetCutListFn: config.resolveCabinetCutListFn,
          resolveRozrysPartFromSource: config.resolveRozrysPartFromSource,
          isFrontMaterialKey: config.isFrontMaterialKey,
          partSignature: config.partSignature,
          mmToUnitStr: config.mmToUnitStr,
          openRozrysInfo: config.openRozrysInfo,
        })
      : {
          buildResolvedSnapshotFromParts: ()=> [],
          buildRawSnapshotForMaterial: ()=> [],
          buildRozrysDiagnostics: ()=> null,
          validationSummaryLabel: ()=> ({ text:'Walidacja: brak danych', tone:'is-warn' }),
          openValidationListModal: ()=> undefined,
          openSheetListModal: ()=> undefined,
          buildCsv: ()=> '',
          downloadText: ()=> undefined,
          openPrintView: ()=> undefined,
          pxToMm: (px)=>{ const n = Number(px); return Number.isFinite(n) ? n * 25.4 / 96 : 0; },
          measurePrintHeaderMm: ()=> 14,
        };
  }

  function createApi(config){
    config = config || {};
    const prefsApi = createPrefsApi(config);
    const parseLocaleNumber = typeof prefsApi.parseLocaleNumber === 'function'
      ? prefsApi.parseLocaleNumber.bind(prefsApi)
      : ((v)=>{ if(v === null || v === undefined) return NaN; if(typeof v === 'number') return Number.isFinite(v) ? v : NaN; const s = String(v).trim().replace(',', '.'); return s ? Number(s) : NaN; });
    const cmToMm = typeof prefsApi.cmToMm === 'function'
      ? prefsApi.cmToMm.bind(prefsApi)
      : ((v)=>{ const n = parseLocaleNumber(v); return Number.isFinite(n) ? Math.round(n * 10) : 0; });
    const partSignature = typeof prefsApi.partSignature === 'function'
      ? prefsApi.partSignature.bind(prefsApi)
      : ((part)=> `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`);

    const partHelpers = createPartHelpers({ FC:config.FC, host:config.host, cmToMm, partSignature });
    const engineBridge = createEngineBridge({
      FC: config.FC,
      loadEdgeStore: typeof prefsApi.loadEdgeStore === 'function' ? prefsApi.loadEdgeStore.bind(prefsApi) : (()=> ({})),
      partSignature,
      isPartRotationAllowed: partHelpers.isPartRotationAllowed,
      mmToUnitStr: typeof prefsApi.mmToUnitStr === 'function'
        ? prefsApi.mmToUnitStr.bind(prefsApi)
        : ((mm, unit)=>{ const u = unit === 'cm' ? 'cm' : 'mm'; const n = Math.round(Number(mm) || 0); if(u === 'mm') return String(n); const cm = n / 10; const s = (Math.round(cm * 10) / 10).toFixed(1); return s.endsWith('.0') ? s.slice(0, -2) : s; }),
    });

    return {
      projectSource: createProjectSource(config),
      prefsApi,
      uiTools: createUiTools(config),
      partHelpers,
      engineBridge,
      uiBridge: createUiBridge(config),
      createRuntimeUtils,
    };
  }

  FC.rozrysBootstrapEnv = { createApi };
})();
