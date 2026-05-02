// js/app/bootstrap/app-legacy-bridges.js
// Global delegators extracted from app.js.
// They preserve the old classic-script function names while the actual implementations live in focused modules.

try{
  window.FC = window.FC || {};
  window.FC.appLegacyBridges = window.FC.appLegacyBridges || { installed:true };
}catch(_){ }


function appLegacyCallExtracted(nsName, fnName, args, fallback){
  try{
    const extracted = (typeof window !== 'undefined' && typeof window.callExtracted === 'function') ? window.callExtracted : (typeof callExtracted === 'function' ? callExtracted : null);
    if(typeof extracted === 'function') return extracted(nsName, fnName, args, fallback);
  }catch(_){ }
  try{
    const mod = window.FC && window.FC[nsName];
    const impl = mod && mod[fnName];
    if(typeof impl === 'function') return impl.apply(null, args || []);
  }catch(_){ }
  if(typeof fallback === 'function') return fallback.apply(null, args || []);
}

/* ===== Cabinet/front rules moved to js/app/cabinet/cabinet-fronts.js ===== */
function getSubTypeOptionsForType(typeVal){ return appLegacyCallExtracted('cabinetFronts','getSubTypeOptionsForType',[typeVal]); }
function applyTypeRules(room, updated, typeVal){ return appLegacyCallExtracted('cabinetFronts','applyTypeRules',[room, updated, typeVal]); }
function applySubTypeRules(room, updated, subTypeVal){ return appLegacyCallExtracted('cabinetFronts','applySubTypeRules',[room, updated, subTypeVal]); }
function addFront(room, front){ return appLegacyCallExtracted('cabinetFronts','addFront',[room, front]); }
function removeFrontsForSet(room, setId){ return appLegacyCallExtracted('cabinetFronts','removeFrontsForSet',[room, setId]); }
function removeFrontsForCab(room, cabId){ return appLegacyCallExtracted('cabinetFronts','removeFrontsForCab',[room, cabId]); }
function getFrontsForSet(room, setId){ return appLegacyCallExtracted('cabinetFronts','getFrontsForSet',[room, setId]); }
function getFrontsForCab(room, cabId){ return appLegacyCallExtracted('cabinetFronts','getFrontsForCab',[room, cabId]); }
function cabinetAllowsFrontCount(cab){ return appLegacyCallExtracted('cabinetFronts','cabinetAllowsFrontCount',[cab]); }
function getFlapFrontCount(cab){ return appLegacyCallExtracted('cabinetFronts','getFlapFrontCount',[cab]); }
function getFlapFrontCountFromDetails(details){ return appLegacyCallExtracted('cabinetFronts','getFlapFrontCountFromDetails',[details]); }
function ensureFrontCountRules(cab){ return appLegacyCallExtracted('cabinetFronts','ensureFrontCountRules',[cab]); }
function validateAventosForDraft(room, draft){ return appLegacyCallExtracted('cabinetFronts','validateAventosForDraft',[room, draft]); }
function applyAventosValidationUI(room, draft){ return appLegacyCallExtracted('cabinetFronts','applyAventosValidationUI',[room, draft]); }
function syncDraftFromCabinetModalForm(d){ return appLegacyCallExtracted('cabinetFronts','syncDraftFromCabinetModalForm',[d]); }
function generateFrontsForCabinet(room, cab){ return appLegacyCallExtracted('cabinetFronts','generateFrontsForCabinet',[room, cab]); }

/* ===== Cabinet modal + set wizard moved to js/app/cabinet/cabinet-modal.js ===== */
function makeDefaultCabinetDraftForRoom(room){ return appLegacyCallExtracted('cabinetModal','makeDefaultCabinetDraftForRoom',[room]); }
function openCabinetModalForAdd(){ return appLegacyCallExtracted('cabinetModal','openCabinetModalForAdd',[]); }
function lockModalScroll(){ return appLegacyCallExtracted('cabinetModal','lockModalScroll',[]); }
function unlockModalScroll(){ return appLegacyCallExtracted('cabinetModal','unlockModalScroll',[]); }
function openCabinetModalForEdit(cabId){ return appLegacyCallExtracted('cabinetModal','openCabinetModalForEdit',[cabId]); }
function openSetWizardForEdit(setId){ return appLegacyCallExtracted('cabinetModal','openSetWizardForEdit',[setId]); }
function closeCabinetModal(){ return appLegacyCallExtracted('cabinetModal','closeCabinetModal',[]); }
function renderCabinetTypeChoices(){ return appLegacyCallExtracted('cabinetModal','renderCabinetTypeChoices',[]); }
function populateSelect(el, options, selected){ return appLegacyCallExtracted('cabinetModal','populateSelect',[el, options, selected]); }
function populateFrontColorsTo(selectEl, typeVal, selected){ return appLegacyCallExtracted('cabinetModal','populateFrontColorsTo',[selectEl, typeVal, selected]); }
function populateBodyColorsTo(selectEl, selected){ return appLegacyCallExtracted('cabinetModal','populateBodyColorsTo',[selectEl, selected]); }
function populateOpeningOptionsTo(selectEl, typeVal, selected){ return appLegacyCallExtracted('cabinetModal','populateOpeningOptionsTo',[selectEl, typeVal, selected]); }
function renderCabinetExtraDetailsInto(container, draft){ return appLegacyCallExtracted('cabinetModal','renderCabinetExtraDetailsInto',[container, draft]); }
function renderSetTiles(){ return appLegacyCallExtracted('cabinetModal','renderSetTiles',[]); }
function renderSetParamsUI(presetId){ return appLegacyCallExtracted('cabinetModal','renderSetParamsUI',[presetId]); }
function wireSetParamsLiveUpdate(presetId){ return appLegacyCallExtracted('cabinetModal','wireSetParamsLiveUpdate',[presetId]); }
function renderCabinetModal(){ return appLegacyCallExtracted('cabinetModal','renderCabinetModal',[]); }
function getSetParamsFromUI(presetId){ return appLegacyCallExtracted('cabinetModal','getSetParamsFromUI',[presetId]); }
function fillSetParamsUIFromSet(set){ return appLegacyCallExtracted('cabinetModal','fillSetParamsUIFromSet',[set]); }
function getNextSetNumber(room){ return appLegacyCallExtracted('cabinetModal','getNextSetNumber',[room]); }
function createOrUpdateSetFromWizard(){ return appLegacyCallExtracted('cabinetModal','createOrUpdateSetFromWizard',[]); }
function drawCornerSketch(opts){
  return appLegacyCallExtracted('cornerSketch', 'drawCornerSketch', arguments, function(){ return; });
}


/* ===== add/delete cabinet actions extracted to js/app/cabinet/cabinet-actions.js ===== */
function addCabinet(){
  return appLegacyCallExtracted('cabinetActions', 'addCabinet', []);
}


/* ===== Delete cabinet by id (used by per-card delete) ===== */
function deleteCabinetById(cabId){
  return appLegacyCallExtracted('cabinetActions', 'deleteCabinetById', [cabId]);
}


/* ===== Price modal functions ===== */
function closePriceModal(){ return appLegacyCallExtracted('priceModal','closePriceModal',[]); }

function saveMaterialFromForm(){ return appLegacyCallExtracted('priceModal','saveMaterialFromForm',[]); }

function saveServiceFromForm(){ return appLegacyCallExtracted('priceModal','saveServiceFromForm',[]); }

function deletePriceItem(item){ return appLegacyCallExtracted('priceModal','deletePriceItem',[item]); }
function closePriceItemModal(){ return appLegacyCallExtracted('priceModal','closePriceItemModal',[]); }

/* ===== Cabinet Modal helpers ===== */
function getCabinetExtraSummary(room, cab){
  return appLegacyCallExtracted('cabinetSummary', 'getCabinetExtraSummary', arguments, function(){ return ''; });
}


/* ===== Materiały: rozpiska mebli (korpusy/plecy/trawersy) ===== */
const FC_BOARD_THICKNESS_CM = (window.FC && window.FC.materialCommon && window.FC.materialCommon.FC_BOARD_THICKNESS_CM) || 1.8; // domyślnie płyta 18mm
const FC_TOP_TRAVERSE_DEPTH_CM = (window.FC && window.FC.materialCommon && window.FC.materialCommon.FC_TOP_TRAVERSE_DEPTH_CM) || 9; // trawersy górne

function fmtCm(v){ return appLegacyCallExtracted('materialCommon','fmtCm',[v], function(x){ const n = Number(x); return Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : String(x ?? ''); }); }
function formatM2(v){ return appLegacyCallExtracted('materialCommon','formatM2',[v], function(){ return '0.000'; }); }
function escapeHtml(str){ return appLegacyCallExtracted('materialCommon','escapeHtml',[str], function(s){ return String(s ?? ''); }); }
function calcPartAreaM2(p){ return appLegacyCallExtracted('materialCommon','calcPartAreaM2',[p], function(){ return 0; }); }
function addArea(map, material, area){ return appLegacyCallExtracted('materialCommon','addArea',[map, material, area], function(dst){ return dst; }); }
function totalsFromParts(parts){ return appLegacyCallExtracted('materialCommon','totalsFromParts',[parts], function(){ return {}; }); }
function mergeTotals(target, src){ return appLegacyCallExtracted('materialCommon','mergeTotals',[target, src], function(dst){ return dst || {}; }); }
function totalsToRows(totals){ return appLegacyCallExtracted('materialCommon','totalsToRows',[totals], function(){ return []; }); }
function renderTotals(container, totals){ return appLegacyCallExtracted('materialCommon','renderTotals',[container, totals], function(el){ if(el) el.innerHTML = ''; }); }
function getCabinetAssemblyRuleText(cab){ return appLegacyCallExtracted('materialCommon','getCabinetAssemblyRuleText',[cab], function(){ return 'Skręcanie: —'; }); }

function getCabinetFrontCutListForMaterials(room, cab){ return appLegacyCallExtracted('frontHardware','getCabinetFrontCutListForMaterials',[room, cab], function(){ return []; }); }
function cabinetHasHandle(cab){ return appLegacyCallExtracted('frontHardware','cabinetHasHandle',[cab], function(){ return true; }); }
function getFrontWeightKgM2(frontMaterial){ return appLegacyCallExtracted('frontHardware','getFrontWeightKgM2',[frontMaterial], function(){ return 13.0; }); }
function estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle){ return appLegacyCallExtracted('frontHardware','estimateFrontWeightKg',[wCm, hCm, frontMaterial, hasHandle], function(){ return 0; }); }
function blumHingesPerDoor(wCm, hCm, frontMaterial, hasHandle){ return appLegacyCallExtracted('frontHardware','blumHingesPerDoor',[wCm, hCm, frontMaterial, hasHandle], function(){ return 0; }); }
function getDoorFrontPanelsForHinges(room, cab){ return appLegacyCallExtracted('frontHardware','getDoorFrontPanelsForHinges',[room, cab], function(){ return []; }); }
function getHingeCountForCabinet(room, cab){ return appLegacyCallExtracted('frontHardware','getHingeCountForCabinet',[room, cab], function(){ return 0; }); }
function estimateFlapWeightKg(cab, room){ return appLegacyCallExtracted('frontHardware','estimateFlapWeightKg',[cab, room], function(){ return 0; }); }
function blumAventosPowerFactor(cab, room){ return appLegacyCallExtracted('frontHardware','blumAventosPowerFactor',[cab, room], function(){ return 0; }); }
function getBlumAventosInfo(cab, room){ return appLegacyCallExtracted('frontHardware','getBlumAventosInfo',[cab, room], function(){ return null; }); }

function getCabinetCutList(cab, room){
  return appLegacyCallExtracted('cabinetCutlist','getCabinetCutList',[cab, room], _getCabinetCutListFallback);
}

function _getCabinetCutListFallback(cab, room){
  // Fallback awaryjny celowo minimalny: właściwa logika siedzi w js/app/cabinet/cabinet-cutlist.js.
  // Zwracamy pustą listę zamiast dublować setki linii w app.js.
  return [];
}


/* ===== Price modal render ===== */
function renderPriceModal(){ return appLegacyCallExtracted('priceModal','renderPriceModal',[]); }


