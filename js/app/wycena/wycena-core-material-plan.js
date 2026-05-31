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

  function round(value, digits){
    const n = Number(value) || 0;
    const f = Math.pow(10, digits || 2);
    return Math.round(n * f) / f;
  }

  function normalizeUnit(value, materialName){
    const raw = String(value || '').trim().toLowerCase();
    if(['sheet','arkusz','ark.','ark'].includes(raw)) return 'sheet';
    if(['m2','m²'].includes(raw)) return 'm2';
    if(raw === 'mb') return 'mb';
    if(['piece','szt','szt.'].includes(raw)) return 'piece';
    const name = String(materialName || '').toLowerCase();
    if(name.includes('obrze')) return 'mb';
    if(name.includes('hdf') || name.includes('lakier') || name.includes('akryl')) return 'm2';
    if(name.includes('blat')) return 'piece';
    return 'sheet';
  }

  function unitLabel(value){
    if(value === 'sheet') return 'ark.';
    if(value === 'm2') return 'm²';
    if(value === 'mb') return 'mb';
    if(value === 'piece') return 'szt.';
    return String(value || '');
  }

  function priceUnitLabel(value){
    if(value === 'sheet') return 'arkusz';
    if(value === 'm2') return 'm²';
    if(value === 'mb') return 'mb';
    if(value === 'piece') return 'szt.';
    return String(value || '');
  }

  function partDimToMm(part, keyA, keyB){
    const raw = Number(part && (part[keyA] != null ? part[keyA] : part[keyB])) || 0;
    if(!(raw > 0)) return 0;
    // Części z agregatu ROZRYS są zapisane w mm; surowe części z MATERIAŁU mają cm.
    // Próg 300 chroni stare ścieżki cm i usuwa błąd ×100 przy m²/HDF/obrzeżach w WYCENIE.
    return raw > 300 ? raw : raw * 10;
  }

  function partAreaM2(parts){
    return (Array.isArray(parts) ? parts : []).reduce((sum, part)=>{
      const wMm = partDimToMm(part, 'w', 'a');
      const hMm = partDimToMm(part, 'h', 'b');
      const qty = Number(part && part.qty) || 1;
      return sum + (wMm * hMm * qty) / 1000000;
    }, 0);
  }

  function partCount(parts){
    return (Array.isArray(parts) ? parts : []).reduce((sum, part)=> sum + (Number(part && part.qty) || 1), 0);
  }

  function getAllMaterialItems(){
    try{
      if(FC.catalogStore && typeof FC.catalogStore === 'function'){
        const store = FC.catalogStore();
        if(store && typeof store.getMaterials === 'function') return store.getMaterials();
      }
    }catch(_){ }
    try{ return Array.isArray(typeof materials !== 'undefined' ? materials : []) ? materials : []; }catch(_){ return []; }
  }

  function findEdgePriceItem(){
    const list = getAllMaterialItems();
    return list.find((item)=> normalizeUnit(item && item.priceUnit, item && item.name) === 'mb')
      || list.find((item)=> String((item && item.name) || '').toLowerCase().includes('obrze'))
      || null;
  }

  function partsForEdgeStore(parts){
    return (Array.isArray(parts) ? parts : []).map((part)=>({
      name:String(part && part.name || 'Element'),
      material:String(part && part.material || ''),
      // materialEdgeStore liczy w cm, a agregat ROZRYS podaje mm.
      a:partDimToMm(part, 'a', 'w') / 10,
      b:partDimToMm(part, 'b', 'h') / 10,
      qty:Number(part && part.qty) || 1,
    })).filter((part)=> part.a > 0 && part.b > 0);
  }

  function edgeMeters(parts){
    try{
      const api = FC.materialEdgeStore && typeof FC.materialEdgeStore.createEdgeStore === 'function'
        ? FC.materialEdgeStore.createEdgeStore({ persist:false })
        : null;
      if(api && typeof api.calcEdgeMetersForParts === 'function') return Number(api.calcEdgeMetersForParts(partsForEdgeStore(parts), null)) || 0;
    }catch(_){ }
    return 0;
  }

  function materialCalculationText(unit, planSource){
    if(unit === 'sheet') return 'Cena = liczba arkuszy z ROZRYSU × cena za arkusz z cennika materiałów. Korpusy i fronty o tym samym realnym materiale są liczone we wspólnej grupie rozkroju.';
    if(unit === 'm2') return 'Cena = suma powierzchni elementów × cena za m² z cennika materiałów. Dla lakieru/akrylu m² oznacza gotowy front; odwierty pod zawiasy i regulacja są osobnymi czynnościami robocizny.';
    if(unit === 'piece') return 'Cena = liczba całych sztuk × cena za sztukę z cennika. Dla blatów przyjęto zakup całej sztuki 4,1 m.';
    return 'Cena = ilość × cena jednostkowa z cennika materiałów.';
  }

  function buildMaterialLine(material, selectedParts, priceItem, planInfo){
    const priceUnit = normalizeUnit(priceItem && priceItem.priceUnit, material);
    const unitPrice = Number(priceItem && priceItem.price) || 0;
    const sourceLabel = (aggregateSource)=> aggregateSource === 'generated' ? 'arkusze z rozkroju wygenerowane do wyceny' : aggregateSource === 'cache' ? 'arkusze z ostatniego rozkroju' : 'brak rozkroju';
    let qty = 0;
    let note = '';
    if(priceUnit === 'sheet'){
      const sheets = Array.isArray(planInfo && planInfo.plan && planInfo.plan.sheets) ? planInfo.plan.sheets : [];
      qty = sheets.length;
      note = sourceLabel(planInfo && planInfo.source);
    }else if(priceUnit === 'm2'){
      qty = round(partAreaM2(selectedParts), 3);
      note = `${partCount(selectedParts)} elem. • powierzchnia ${qty.toFixed(3)} m²`;
    }else if(priceUnit === 'piece'){
      qty = Math.max(1, Math.ceil(partCount(selectedParts) / Math.max(1, partCount(selectedParts))));
      note = 'Zakup całej sztuki według cennika; blaty startowo liczone jako pełna sztuka 4,1 m.';
    }else{
      qty = partCount(selectedParts);
    }
    return {
      key:utils.slug(material),
      type:'material',
      name:material,
      qty,
      unit:unitLabel(priceUnit),
      unitPrice,
      total:round(qty * unitPrice, 2),
      priceUnit,
      pricingMode:priceUnit,
      starterPrice:!!(priceItem && priceItem.starterPrice === true && !String(priceItem.priceUserEditedAt || '').trim()),
      priceUserEditedAt:String(priceItem && priceItem.priceUserEditedAt || ''),
      subsection:priceUnit === 'sheet' ? 'Arkusze / rozkrój' : (priceUnit === 'm2' ? (String(material).toLowerCase().includes('hdf') ? 'Plecy / HDF' : 'm² / gotowe fronty') : 'Sztuki / blaty'),
      rooms:'',
      source:planInfo && planInfo.source,
      note,
      calculation:materialCalculationText(priceUnit, planInfo && planInfo.source),
      warnings:priceItem ? [] : ['Brak pozycji materiału w cenniku — koszt może być zaniżony.'],
    };
  }

  async function collectMaterialLines(aggregate, selectionOverride){
    const scope = selectionApi.decodeMaterialScope(selectionOverride);
    const materialsOrdered = source.getScopedMaterials(aggregate, selectionOverride);
    const roomsText = (aggregate && Array.isArray(aggregate.selectedRooms) ? aggregate.selectedRooms : []).map(source.roomLabel).join(', ');
    const lines = [];
    let totalEdgeMeters = 0;
    for(const material of materialsOrdered){
      const group = aggregate && aggregate.groups ? aggregate.groups[material] : null;
      const selectedParts = FC.rozrysScope && typeof FC.rozrysScope.getGroupPartsForScope === 'function'
        ? FC.rozrysScope.getGroupPartsForScope(group, scope)
        : ((group && group.parts) || group && group.allParts || []);
      if(!selectedParts || !selectedParts.length) continue;
      const priceItem = catalog.materialPriceLookup(material);
      const priceUnit = normalizeUnit(priceItem && priceItem.priceUnit, material);
      let planInfo = { plan:null, source:'missing' };
      if(priceUnit === 'sheet'){
        try{ planInfo = await computePlanForMaterial(material, selectedParts); }catch(_){ }
      }
      const line = buildMaterialLine(material, selectedParts, priceItem, planInfo);
      line.rooms = roomsText;
      lines.push(line);
      totalEdgeMeters += edgeMeters(selectedParts);
    }

    const edgeItem = findEdgePriceItem();
    const rawEdgeMeters = round(totalEdgeMeters, 3);
    if(rawEdgeMeters > 0 && edgeItem){
      const quotedMeters = round(rawEdgeMeters * 1.1, 3);
      const unitPrice = Number(edgeItem && edgeItem.price) || 0;
      lines.push({
        key:'obrzeza_zapas_10',
        type:'material',
        name:String(edgeItem.name || 'Obrzeże PCV standard'),
        qty:quotedMeters,
        unit:'mb',
        unitPrice,
        total:round(quotedMeters * unitPrice, 2),
        priceUnit:'mb',
        pricingMode:'edge',
        starterPrice:!!(edgeItem && edgeItem.starterPrice === true && !String(edgeItem.priceUserEditedAt || '').trim()),
        priceUserEditedAt:String(edgeItem && edgeItem.priceUserEditedAt || ''),
        subsection:'Obrzeża',
        rooms:roomsText,
        source:'edge-store',
        note:`Z elementów: ${rawEdgeMeters.toFixed(3)} mb • zapas +10% = ${quotedMeters.toFixed(3)} mb`,
        calculation:'Cena = metry oklejanych krawędzi z elementów + 10% zapasu × cena za mb z cennika materiałów.',
      });
    }else if(rawEdgeMeters > 0 && !edgeItem){
      lines.push({
        key:'obrzeza_brak_ceny',
        type:'material',
        name:'Obrzeża — brak pozycji w cenniku',
        qty:round(rawEdgeMeters * 1.1, 3),
        unit:'mb',
        unitPrice:0,
        total:0,
        priceUnit:'mb',
        pricingMode:'edge',
        subsection:'Obrzeża',
        rooms:roomsText,
        source:'edge-store',
        note:`Z elementów: ${rawEdgeMeters.toFixed(3)} mb • zapas +10%`,
        calculation:'Cena = metry oklejanych krawędzi z elementów + 10% zapasu × cena za mb z cennika materiałów.',
        warnings:['Brak pozycji obrzeża w cenniku materiałów.'],
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
