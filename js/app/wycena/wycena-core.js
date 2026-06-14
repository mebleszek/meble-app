(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getDeps(){
    return {
      selectionApi: FC.wycenaCoreSelection,
      catalog: FC.wycenaCoreCatalog,
      source: FC.wycenaCoreSource,
      materialPlan: FC.wycenaCoreMaterialPlan,
      offer: FC.wycenaCoreOffer,
      lines: FC.wycenaCoreLines,
      labor: FC.wycenaCoreLabor,
    };
  }

  function listMissing(deps){
    const out = [];
    if(!deps.selectionApi) out.push('FC.wycenaCoreSelection');
    if(!deps.catalog) out.push('FC.wycenaCoreCatalog');
    if(!deps.source) out.push('FC.wycenaCoreSource');
    if(!deps.materialPlan) out.push('FC.wycenaCoreMaterialPlan');
    if(!deps.offer) out.push('FC.wycenaCoreOffer');
    if(!deps.lines) out.push('FC.wycenaCoreLines');
    if(!deps.labor) out.push('FC.wycenaCoreLabor');
    return out;
  }

  function requireDeps(){
    const deps = getDeps();
    const missing = listMissing(deps);
    if(missing.length){
      throw new Error('Brak modułów FC.wycenaCore*: ' + missing.join(', ') + ' — odśwież stronę albo sprawdź kolejność ładowania Wyceny.');
    }
    return deps;
  }

  function normalizeQuoteSelection(selection){
    return requireDeps().selectionApi.normalizeQuoteSelection(selection);
  }

  function decodeSelectedRooms(selection){
    return requireDeps().selectionApi.decodeSelectedRooms(selection);
  }

  function createQuoteValidationError(message, details){
    return requireDeps().selectionApi.createQuoteValidationError(message, details);
  }

  function validateQuoteSelection(selection){
    return requireDeps().selectionApi.validateQuoteSelection(selection);
  }

  function validateQuoteContent(data){
    return requireDeps().selectionApi.validateQuoteContent(data);
  }

  function perfNow(){
    try{ return performance && typeof performance.now === 'function' ? performance.now() : Date.now(); }
    catch(_){ return Date.now(); }
  }
  function roundMs(value){ return Math.round((Number(value) || 0) * 1000) / 1000; }
  function jsonBytes(value){ try{ return JSON.stringify(value == null ? null : value).length; }catch(_){ return 0; } }
  function cabinetCountForRooms(selectedRooms){
    try{
      const project = FC.wycenaCoreSource && typeof FC.wycenaCoreSource.project === 'function' ? FC.wycenaCoreSource.project() : (window.projectData || {});
      return (Array.isArray(selectedRooms) ? selectedRooms : []).reduce((sum, roomId)=> {
        const list = project && project[roomId] && Array.isArray(project[roomId].cabinets) ? project[roomId].cabinets : [];
        return sum + list.length;
      }, 0);
    }catch(_){ return 0; }
  }
  function recordQuotePerformance(performance){
    try{ if(FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordQuotePerformance === 'function') FC.wycenaDiagnostics.recordQuotePerformance(performance); }catch(_){ }
  }

  async function collectQuoteData(options){
    const totalStart = perfNow();
    const deps = requireDeps();
    const perf = {
      build:'20260614_diag_file_labor_view_v1',
      generatedAt:new Date().toISOString(),
      timingsMs:{ cabinetFacts:0, materials:0, accessories:0, labor:0, logisticsCarrying:0, snapshot:0, total:0 },
      counts:{ cabinetCount:0, factCacheReads:0, factCacheHits:0, factRecalculations:0, factMissing:0, factStale:0, factVersion:0, factErrors:0 },
      sizes:{ snapshot:0, calculationRegister:0, labor:0 }
    };
    const draft = deps.offer.getOfferDraft();
    const normalizedSelection = deps.selectionApi.validateQuoteSelection(deps.selectionApi.normalizeQuoteSelection((options && options.selection) || (draft && draft.selection)));
    const selectedRooms = deps.selectionApi.decodeSelectedRooms(normalizedSelection);
    perf.counts.cabinetCount = cabinetCountForRooms(selectedRooms);

    let cabinetFactsSummary = null;
    let sectionStart = perfNow();
    try{
      const factsApi = FC.cabinetDerivedFacts || null;
      if(factsApi && typeof factsApi.ensureForRooms === 'function') cabinetFactsSummary = factsApi.ensureForRooms(selectedRooms, { persist:true, recalculate:true });
    }catch(_){ }
    perf.timingsMs.cabinetFacts = roundMs(perfNow() - sectionStart);
    if(cabinetFactsSummary){
      perf.counts.factCacheReads = Number(cabinetFactsSummary.cabinetCount) || 0;
      perf.counts.factCacheHits = Number(cabinetFactsSummary.cacheHits) || 0;
      perf.counts.factRecalculations = Number(cabinetFactsSummary.recalculations) || 0;
      perf.counts.factMissing = Number(cabinetFactsSummary.missing) || 0;
      perf.counts.factStale = Number(cabinetFactsSummary.stale) || 0;
      perf.counts.factVersion = Number(cabinetFactsSummary.version) || 0;
      perf.counts.factErrors = Number(cabinetFactsSummary.errors) || 0;
      perf.timingsMs.logisticsCarrying = roundMs(cabinetFactsSummary.timingsMs && cabinetFactsSummary.timingsMs.logistics || 0);
    }

    sectionStart = perfNow();
    const aggregate = deps.source.getSelectedAggregate(normalizedSelection);
    const materialLines = await deps.materialPlan.collectMaterialLines(aggregate, normalizedSelection);
    perf.timingsMs.materials = roundMs(perfNow() - sectionStart);

    sectionStart = perfNow();
    const elementLines = deps.lines.collectElementLines(normalizedSelection);
    const accessoryLines = deps.lines.collectAccessories(selectedRooms);
    const agdLines = deps.lines.collectBuiltInAppliances(selectedRooms);
    const quoteRateLines = deps.offer.collectQuoteRateLines();
    perf.timingsMs.accessories = roundMs(perfNow() - sectionStart);

    sectionStart = perfNow();
    const laborLines = deps.labor.collectCabinetLabor(selectedRooms);
    perf.timingsMs.labor = roundMs(perfNow() - sectionStart);

    const commercial = deps.offer.collectCommercialDraft(draft);
    const calculationRegister = FC.quoteCalculationRegister && typeof FC.quoteCalculationRegister.buildRegister === 'function'
      ? FC.quoteCalculationRegister.buildRegister({
          materials: materialLines,
          accessories: accessoryLines,
          agdServices: agdLines,
          quoteRates: quoteRateLines,
          labor: laborLines,
        }, commercial)
      : null;
    const totals = FC.quoteSnapshot && typeof FC.quoteSnapshot.computeTotals === 'function'
      ? FC.quoteSnapshot.computeTotals((calculationRegister && calculationRegister.totals) || {}, {
          materials: materialLines,
          accessories: accessoryLines,
          agdServices: agdLines,
          quoteRates: quoteRateLines,
          labor: laborLines,
        }, commercial)
      : {
          materials: materialLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          accessories: accessoryLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          services: agdLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          transport: quoteRateLines.filter((row)=> String(row && row.sourceRole || '') === 'transport-distance' || String(row && row.sourceType || '') === 'transport' || String(row && row.quantitySource || '') === 'transport.distance_km' || String(row && row.sourceId || '') === 'transport_distance_km').reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          quoteRates: quoteRateLines.filter((row)=> !(String(row && row.sourceRole || '') === 'transport-distance' || String(row && row.sourceType || '') === 'transport' || String(row && row.quantitySource || '') === 'transport.distance_km' || String(row && row.sourceId || '') === 'transport_distance_km')).reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          labor: laborLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          subtotal: 0,
          discount: 0,
          grand: 0,
        };
    if(!(totals.subtotal > 0)) totals.subtotal = totals.materials + totals.accessories + totals.services + totals.quoteRates + (totals.transport || 0) + (totals.labor || 0);
    if(!(totals.grand >= 0)) totals.grand = Math.max(0, totals.subtotal - (totals.discount || 0));
    perf.sizes.calculationRegister = jsonBytes(calculationRegister);
    perf.sizes.labor = jsonBytes(laborLines);
    perf.timingsMs.total = roundMs(perfNow() - totalStart);
    const result = {
      selectedRooms,
      roomLabels: selectedRooms.map(deps.source.roomLabel),
      materialScope: normalizedSelection.materialScope,
      selection: normalizedSelection,
      materialLines,
      elementLines,
      accessoryLines,
      agdLines,
      quoteRateLines,
      laborLines,
      commercial,
      calculationRegister,
      totals,
      diagnostics:{ performance:perf, cabinetFacts:cabinetFactsSummary },
      generatedAt: Date.now(),
    };
    deps.selectionApi.validateQuoteContent(result);
    recordQuotePerformance(perf);
    return result;
  }

  async function buildQuoteSnapshot(options){
    const data = await collectQuoteData(options);
    if(FC.quoteSnapshot && typeof FC.quoteSnapshot.saveSnapshot === 'function') return FC.quoteSnapshot.saveSnapshot(data);
    if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(data);
    return data;
  }

  function ensureServiceCatalog(){
    return requireDeps().catalog.ensureServiceCatalog();
  }

  function ensureServiceCatalogInRuntime(){
    return requireDeps().catalog.ensureServiceCatalogInRuntime();
  }

  function collectQuoteRateLines(){
    return requireDeps().offer.collectQuoteRateLines();
  }

  function collectCabinetLabor(selectedRooms){
    return requireDeps().labor.collectCabinetLabor(selectedRooms);
  }

  function collectCommercialDraft(draft){
    return requireDeps().offer.collectCommercialDraft(draft);
  }

  function collectElementLines(selection){
    return requireDeps().lines.collectElementLines(selection);
  }

  function collectClientPdfDetails(selection){
    return requireDeps().lines.collectClientPdfDetails(selection);
  }

  const api = {
    ensureServiceCatalog,
    ensureServiceCatalogInRuntime,
    normalizeQuoteSelection,
    collectQuoteData,
    buildQuoteSnapshot,
    collectQuoteRateLines,
    collectCabinetLabor,
    collectCommercialDraft,
    collectElementLines,
    collectClientPdfDetails,
    validateQuoteSelection,
    validateQuoteContent,
    createQuoteValidationError,
    _debugMissingDeps:function(){ return listMissing(getDeps()); },
  };

  Object.defineProperty(api, 'AGD_SERVICE_DEFAULTS', {
    enumerable: true,
    get:function(){
      const catalog = FC.wycenaCoreCatalog;
      return catalog && catalog.AGD_SERVICE_DEFAULTS ? catalog.AGD_SERVICE_DEFAULTS : [];
    },
  });

  FC.wycenaCore = api;

  try{
    if(FC.wycenaCoreCatalog && typeof FC.wycenaCoreCatalog.ensureServiceCatalogInRuntime === 'function'){
      FC.wycenaCoreCatalog.ensureServiceCatalogInRuntime();
    }
  }catch(_){ }
})();
