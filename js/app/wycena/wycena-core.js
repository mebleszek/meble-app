(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const selectionApi = FC.wycenaCoreSelection;
  const catalog = FC.wycenaCoreCatalog;
  const source = FC.wycenaCoreSource;
  const materialPlan = FC.wycenaCoreMaterialPlan;
  const offer = FC.wycenaCoreOffer;
  const lines = FC.wycenaCoreLines;
  const labor = FC.wycenaCoreLabor;

  if(!(selectionApi && catalog && source && materialPlan && offer && lines && labor)){
    throw new Error('Brak modułów FC.wycenaCore* — sprawdź kolejność ładowania Wyceny.');
  }

  const normalizeQuoteSelection = selectionApi.normalizeQuoteSelection;
  const decodeSelectedRooms = selectionApi.decodeSelectedRooms;
  const createQuoteValidationError = selectionApi.createQuoteValidationError;
  const validateQuoteSelection = selectionApi.validateQuoteSelection;
  const validateQuoteContent = selectionApi.validateQuoteContent;

  async function collectQuoteData(options){
    const draft = offer.getOfferDraft();
    const normalizedSelection = validateQuoteSelection(normalizeQuoteSelection((options && options.selection) || (draft && draft.selection)));
    const selectedRooms = decodeSelectedRooms(normalizedSelection);
    const aggregate = source.getSelectedAggregate(normalizedSelection);
    const materialLines = await materialPlan.collectMaterialLines(aggregate, normalizedSelection);
    const elementLines = lines.collectElementLines(normalizedSelection);
    const accessoryLines = lines.collectAccessories(selectedRooms);
    const agdLines = lines.collectBuiltInAppliances(selectedRooms);
    const quoteRateLines = offer.collectQuoteRateLines();
    const laborLines = labor.collectCabinetLabor(selectedRooms);
    const commercial = offer.collectCommercialDraft(draft);
    const totals = FC.quoteSnapshot && typeof FC.quoteSnapshot.computeTotals === 'function'
      ? FC.quoteSnapshot.computeTotals({}, {
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
          quoteRates: quoteRateLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          labor: laborLines.reduce((sum, row)=> sum + (Number(row.total) || 0), 0),
          subtotal: 0,
          discount: 0,
          grand: 0,
        };
    if(!(totals.subtotal > 0)) totals.subtotal = totals.materials + totals.accessories + totals.services + totals.quoteRates + (totals.labor || 0);
    if(!(totals.grand >= 0)) totals.grand = Math.max(0, totals.subtotal - (totals.discount || 0));
    const result = {
      selectedRooms,
      roomLabels: selectedRooms.map(source.roomLabel),
      materialScope: normalizedSelection.materialScope,
      selection: normalizedSelection,
      materialLines,
      elementLines,
      accessoryLines,
      agdLines,
      quoteRateLines,
      laborLines,
      commercial,
      totals,
      generatedAt: Date.now(),
    };
    validateQuoteContent(result);
    return result;
  }

  async function buildQuoteSnapshot(options){
    const data = await collectQuoteData(options);
    try{
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.saveSnapshot === 'function') return FC.quoteSnapshot.saveSnapshot(data);
      if(FC.quoteSnapshot && typeof FC.quoteSnapshot.buildSnapshot === 'function') return FC.quoteSnapshot.buildSnapshot(data);
    }catch(_){ }
    return data;
  }

  FC.wycenaCore = {
    AGD_SERVICE_DEFAULTS: catalog.AGD_SERVICE_DEFAULTS,
    ensureServiceCatalog: catalog.ensureServiceCatalog,
    ensureServiceCatalogInRuntime: catalog.ensureServiceCatalogInRuntime,
    normalizeQuoteSelection,
    collectQuoteData,
    buildQuoteSnapshot,
    collectQuoteRateLines: offer.collectQuoteRateLines,
    collectCabinetLabor: labor.collectCabinetLabor,
    collectCommercialDraft: offer.collectCommercialDraft,
    collectElementLines: lines.collectElementLines,
    collectClientPdfDetails: lines.collectClientPdfDetails,
    validateQuoteSelection,
    validateQuoteContent,
    createQuoteValidationError,
  };

  try{ catalog.ensureServiceCatalogInRuntime(); }catch(_){ }
})();
