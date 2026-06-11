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

  async function collectQuoteData(options){
    const deps = requireDeps();
    const draft = deps.offer.getOfferDraft();
    const normalizedSelection = deps.selectionApi.validateQuoteSelection(deps.selectionApi.normalizeQuoteSelection((options && options.selection) || (draft && draft.selection)));
    const selectedRooms = deps.selectionApi.decodeSelectedRooms(normalizedSelection);
    const aggregate = deps.source.getSelectedAggregate(normalizedSelection);
    const materialLines = await deps.materialPlan.collectMaterialLines(aggregate, normalizedSelection);
    const elementLines = deps.lines.collectElementLines(normalizedSelection);
    const accessoryLines = deps.lines.collectAccessories(selectedRooms);
    const agdLines = deps.lines.collectBuiltInAppliances(selectedRooms);
    const quoteRateLines = deps.offer.collectQuoteRateLines();
    const laborLines = deps.labor.collectCabinetLabor(selectedRooms);
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
      generatedAt: Date.now(),
    };
    deps.selectionApi.validateQuoteContent(result);
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
