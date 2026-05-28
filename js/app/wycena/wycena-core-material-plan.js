(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const utils = FC.wycenaCoreUtils;
  const catalog = FC.wycenaCoreCatalog;
  const source = FC.wycenaCoreSource;
  const selectionApi = FC.wycenaCoreSelection;
  if(!(utils && catalog && source && selectionApi)){
    throw new Error('Brak zależności FC.wycenaCoreMaterialPlan — sprawdź kolejność ładowania Wyceny.');
  }

  function isPartRotationAllowed(part, grainOn, overrides){
    if(!grainOn) return true;
    if(part && part.ignoreGrain) return true;
    const sig = FC.rozrysPrefs && typeof FC.rozrysPrefs.partSignature === 'function'
      ? FC.rozrysPrefs.partSignature(part)
      : `${part && part.material || ''}||${part && part.name || ''}||${part && part.w || 0}x${part && part.h || 0}`;
    return !!(overrides && overrides[sig]);
  }

  function readRozrysControl(id, fallback){
    try{
      const el = document.getElementById(id);
      return el ? el.value : fallback;
    }catch(_){
      return fallback;
    }
  }

  async function computePlanForMaterial(material, parts){
    const unit = String(readRozrysControl('rozUnit', 'cm') || 'cm');
    const st = {
      material,
      unit,
      boardW: Number(readRozrysControl('rozW', unit === 'mm' ? 2800 : 280)) || (unit === 'mm' ? 2800 : 280),
      boardH: Number(readRozrysControl('rozH', unit === 'mm' ? 2070 : 207)) || (unit === 'mm' ? 2070 : 207),
      kerf: Number(readRozrysControl('rozK', unit === 'mm' ? 4 : 0.4)) || (unit === 'mm' ? 4 : 0.4),
      edgeTrim: Number(readRozrysControl('rozTrim', unit === 'mm' ? 10 : 1)) || (unit === 'mm' ? 10 : 1),
      minScrapW: Number(readRozrysControl('rozMinScrapW', 0)) || 0,
      minScrapH: Number(readRozrysControl('rozMinScrapH', 0)) || 0,
      heur: String(readRozrysControl('rozHeur', 'max') || 'max'),
      direction: String(readRozrysControl('rozDir', 'start-optimax') || 'start-optimax'),
      edgeSubMm: Math.max(0, Number(readRozrysControl('rozEdgeSub', 0)) || 0),
    };
    const hasGrain = !!(FC.materialHasGrain && typeof FC.materialHasGrain === 'function' ? FC.materialHasGrain(material, typeof materials !== 'undefined' ? materials : []) : false);
    const grainExceptions = FC.rozrysPrefs && typeof FC.rozrysPrefs.getMaterialGrainExceptions === 'function'
      ? FC.rozrysPrefs.getMaterialGrainExceptions(material, (parts || []).map((part)=> FC.rozrysPrefs.partSignature(part)), hasGrain)
      : {};
    st.grain = !!(FC.rozrysPrefs && typeof FC.rozrysPrefs.getMaterialGrainEnabled === 'function' ? FC.rozrysPrefs.getMaterialGrainEnabled(material, hasGrain) : hasGrain);
    st.grainExceptions = grainExceptions || {};
    const mmToUnit = (unitName, mm)=> unitName === 'mm' ? Math.round(Number(mm)||0) : Math.round((Number(mm)||0)/10*10)/10;
    const largest = FC.rozrysStock && typeof FC.rozrysStock.getLargestSheetFormatForMaterial === 'function'
      ? FC.rozrysStock.getLargestSheetFormatForMaterial(material, unit === 'mm' ? 2800 : 2800, unit === 'mm' ? 2070 : 2070)
      : { width:2800, height:2070 };
    if(largest && largest.width && largest.height){
      st.boardW = mmToUnit(unit, largest.width);
      st.boardH = mmToUnit(unit, largest.height);
    }
    if(FC.rozrysStock && typeof FC.rozrysStock.getRealHalfStockForMaterial === 'function'){
      const half = FC.rozrysStock.getRealHalfStockForMaterial(material, largest.width || 2800, largest.height || 2070);
      st.realHalfQty = Math.max(0, Number(half && half.qty) || 0);
      st.realHalfBoardW = Math.max(0, Number(half && half.width) || 0);
      st.realHalfBoardH = Math.max(0, Number(half && half.height) || 0);
    }
    if(FC.rozrysStock && typeof FC.rozrysStock.getExactSheetStockForMaterial === 'function'){
      const exact = FC.rozrysStock.getExactSheetStockForMaterial(material, Math.round(Number(largest.width)||2800), Math.round(Number(largest.height)||2070));
      st.stockExactQty = Math.max(0, Number(exact && exact.qty) || 0);
      st.stockFullBoardW = Math.max(0, Number(exact && exact.width) || 0);
      st.stockFullBoardH = Math.max(0, Number(exact && exact.height) || 0);
    }
    st.stockSignature = FC.rozrysStock && typeof FC.rozrysStock.buildStockSignatureForMaterial === 'function'
      ? FC.rozrysStock.buildStockSignatureForMaterial(material)
      : '';
    const cache = FC.rozrysCache && typeof FC.rozrysCache.loadPlanCache === 'function' ? (FC.rozrysCache.loadPlanCache() || {}) : {};
    const cacheKey = FC.rozrysCache && typeof FC.rozrysCache.makePlanCacheKey === 'function'
      ? FC.rozrysCache.makePlanCacheKey(st, parts, { partSignature:FC.rozrysPrefs && FC.rozrysPrefs.partSignature, isPartRotationAllowed, loadEdgeStore:FC.rozrysPrefs && FC.rozrysPrefs.loadEdgeStore })
      : '';
    if(cacheKey && cache[cacheKey] && cache[cacheKey].plan){
      return { plan:cache[cacheKey].plan, source:'cache' };
    }
    let plan = null;
    if(FC.rozrysEngine && typeof FC.rozrysEngine.computePlanWithCurrentEngine === 'function'){
      plan = await FC.rozrysEngine.computePlanWithCurrentEngine(st, parts, {}, {
        computePlan: FC.rozrysEngine.computePlan,
        computePlanPanelProAsync: FC.rozrysEngine.computePlanPanelProAsync,
      });
    }
    if(FC.rozrysStock && typeof FC.rozrysStock.applySheetStockLimit === 'function'){
      plan = await FC.rozrysStock.applySheetStockLimit(material, st, parts, plan, {}, { computePlanWithCurrentEngine:(nextSt, nextParts)=> FC.rozrysEngine.computePlanWithCurrentEngine(nextSt, nextParts, {}, { computePlan: FC.rozrysEngine.computePlan, computePlanPanelProAsync: FC.rozrysEngine.computePlanPanelProAsync }), partSignature:FC.rozrysPrefs && FC.rozrysPrefs.partSignature, isPartRotationAllowed });
    }
    if(cacheKey && plan && FC.rozrysCache && typeof FC.rozrysCache.savePlanCache === 'function'){
      cache[cacheKey] = { ts:Date.now(), plan:utils.clone(plan) };
      FC.rozrysCache.savePlanCache(cache);
    }
    return { plan, source:'generated' };
  }

  async function collectMaterialLines(aggregate, selectionOverride){
    const scope = selectionApi.decodeMaterialScope(selectionOverride);
    const materialsOrdered = source.getScopedMaterials(aggregate, selectionOverride);
    const lines = [];
    for(const material of materialsOrdered){
      const group = aggregate && aggregate.groups ? aggregate.groups[material] : null;
      const selectedParts = FC.rozrysScope && typeof FC.rozrysScope.getGroupPartsForScope === 'function'
        ? FC.rozrysScope.getGroupPartsForScope(group, scope)
        : ((group && group.parts) || []);
      if(!selectedParts || !selectedParts.length) continue;
      let planInfo = { plan:null, source:'missing' };
      try{ planInfo = await computePlanForMaterial(material, selectedParts); }catch(_){ }
      const sheets = Array.isArray(planInfo && planInfo.plan && planInfo.plan.sheets) ? planInfo.plan.sheets : [];
      const qty = sheets.length;
      const priceItem = catalog.materialPriceLookup(material);
      const unitPrice = Number(priceItem && priceItem.price) || 0;
      lines.push({
        key:utils.slug(material),
        type:'material',
        name:material,
        qty,
        unit:'ark.',
        unitPrice,
        total:qty * unitPrice,
        rooms:(aggregate.selectedRooms || []).map(source.roomLabel).join(', '),
        source:planInfo.source,
        note: planInfo.source === 'generated' ? 'arkusze z rozkroju wygenerowane do wyceny' : planInfo.source === 'cache' ? 'arkusze z ostatniego rozkroju' : 'brak rozkroju',
      });
    }
    return lines;
  }

  FC.wycenaCoreMaterialPlan = {
    isPartRotationAllowed,
    computePlanForMaterial,
    collectMaterialLines,
  };
})();
