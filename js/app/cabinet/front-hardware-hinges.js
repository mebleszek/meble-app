(function(){
  const ns = (window.FC = window.FC || {});
  const hw = ns.frontHardware || {};
  const estimateFrontWeightKg = hw.estimateFrontWeightKg || function(){ return 0; };
  const getSetDoorFrontPanels = hw.getSetDoorFrontPanels || function(){ return []; };
  const isLeadSetCabinet = hw.isLeadSetCabinet || function(){ return false; };
  const cabinetHasHandle = hw.cabinetHasHandle || function(){ return true; };
  const getCabinetFrontCutListForMaterials = hw.getCabinetFrontCutListForMaterials || function(){ return []; };
  const resolveDrawerDoorCount = hw.resolveDrawerDoorCount || function(cab){
    const d = detailsOf(cab);
    const explicit = Number(d.doorCount || d.doorFrontCount || d.hingedDoorCount || 0);
    if(explicit > 0) return Math.max(1, Math.round(explicit));
    const count = Number(cab && cab.frontCount) || 0;
    if(count > 2) return Math.max(1, Math.round(count - 1));
    return Math.max(1, Math.round(count || 2));
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function bool(value){
    if(value === true) return true;
    if(value === false) return false;
    const raw = text(value).toLowerCase();
    return ['1','true','tak','yes','y'].includes(raw);
  }
  function detailsOf(cab){ return cab && cab.details && typeof cab.details === 'object' ? cab.details : {}; }
  function fridgeNeedsFurnitureHinges(cab){
    const d = detailsOf(cab);
    return bool(d.requiresFurnitureHinges) || bool(d.fridgeRequiresFurnitureHinges) || bool(d.needsFurnitureHinges);
  }

  const getProjectRoomData = hw.getProjectRoomData || function(){ return null; };

function hingesByWeightKg(weightKg){
  const kg = Math.max(0, Number(weightKg) || 0);
  if(kg <= 0) return 0;
  if(kg <= 6) return 2;
  if(kg <= 12) return 3;
  if(kg <= 17) return 4;
  if(kg <= 20) return 5;
  if(kg <= 22) return 6;
  return 6 + Math.ceil((kg - 22) / 5);
}

function hingesByHeightMm(heightMm){
  const mm = Math.max(0, Number(heightMm) || 0);
  if(mm <= 0) return 0;
  if(mm <= 1000) return 2;
  if(mm <= 1700) return 3;
  if(mm <= 2200) return 4;
  if(mm <= 2400) return 5;
  if(mm <= 2600) return 6;
  if(mm <= 2800) return 7;
  return 7 + Math.ceil((mm - 2800) / 200);
}

function hingeWidthAddOn(widthMm){
  const mm = Math.max(0, Number(widthMm) || 0);
  if(mm <= 600) return 0;
  return Math.ceil((mm - 600) / 100);
}

function universalHingesPerDoor(wCm, hCm, frontMaterial, hasHandle){
  const widthCm = Math.max(0, Number(wCm) || 0);
  const heightCm = Math.max(0, Number(hCm) || 0);
  if(widthCm <= 0 || heightCm <= 0) return 0;

  const weightKg = estimateFrontWeightKg(widthCm, heightCm, frontMaterial, hasHandle);
  const weightHinges = hingesByWeightKg(weightKg);
  const heightHinges = hingesByHeightMm(heightCm * 10);
  const widthAdd = hingeWidthAddOn(widthCm * 10);
  const hinges = Math.max(weightHinges, heightHinges) + widthAdd;

  return Math.max(0, Math.round(hinges));
}

// Backward-compatible API name kept for older modules/tests. The logic is no longer BLUM/lb based.
function blumHingesPerDoor(wCm, hCm, frontMaterial, hasHandle){
  return universalHingesPerDoor(wCm, hCm, frontMaterial, hasHandle);
}


function getDoorFrontPanelsForHinges(room, cab){
  const out = [];
  if(!cab) return out;
  const setDoors = getSetDoorFrontPanels(room, cab);
  if(setDoors.length) return setDoors;
  if(cab && cab.setId && !isLeadSetCabinet(room, cab)) return out;
  const type = String(cab.type || '');
  const sub = String(cab.subType || '');

  // brak zawiasów dla klap (AVENTOS) i frontów urządzeń, z wyjątkami obsługiwanymi osobno
  if(sub === 'uchylne') return out;
  if(type !== 'stojąca' && type !== 'wisząca' && type !== 'moduł') return out;
  if(sub === 'szuflady' || sub === 'zmywarkowa') return out;
  const det = detailsOf(cab);
  if(sub === 'zlewowa' && text(det.sinkFront || 'drzwi') === 'szuflada') return out;
  if(sub === 'piekarnikowa' && text(det.ovenOption || 'szuflada_dol').indexOf('szuflada') !== -1) return out;
  if(sub === 'dolna_podblatowa'){
    const mode = text(det.podFrontMode || (det.subTypeOption && String(det.subTypeOption).indexOf('szuflada') === 0 ? 'szuflady' : 'drzwi')) || 'drzwi';
    if(mode === 'brak' || mode === 'szuflady') return out;
  }
  if(sub === 'okap' && text(det.hoodFrontMode || 'drzwi') === 'klapa') return out;
  if(sub === 'lodowkowa' && (!fridgeNeedsFurnitureHinges(cab) || text(det.fridgeOption || 'zabudowa') !== 'zabudowa')) return out;
  const hasHandle = cabinetHasHandle(cab);


  const w = Number(cab.width) || 0;
  const d = Number(cab.depth) || 0;

  // szerokość efektywna (np. rogowa ślepa)
  let effectiveW = w;
  if(sub === 'rogowa_slepa'){
    const blind = Number(cab.details?.blindPart) || 0;
    if(blind > 0) effectiveW = Math.max(0, effectiveW - blind);
  }

  // wysokość frontu dla stojących = korpus - nóżki
  function frontHeight(){
    let hh = Number(cab.height) || 0;
    if(type === 'stojąca'){
      const roomData = getProjectRoomData(room) || {};
      const s = roomData.settings || {};
      const leg = Number(s.legHeight) || 0;
      if(leg > 0) hh = Math.max(0, hh - leg);
    }
    return hh;
  }

  // stojąca z szufladą + drzwi
  if(type === 'stojąca' && sub === 'szuflada_drzwi'){
    const fh = frontHeight();
    const drawerH = Number(cab.details?.drawerHeight) || Math.min(20, fh);
    const doorH = Math.max(0, fh - drawerH);
    if(doorH <= 0) return out;
    const fc = resolveDrawerDoorCount(cab);
    const wEach = fc ? (effectiveW / fc) : 0;
    for(let i=0;i<fc;i++) out.push({ w: wEach, h: doorH , material: (cab.frontMaterial || 'laminat') , hasHandle: hasHandle });
    return out;
  }

  // lodówkowa: zawiasy tylko po ręcznym zaznaczeniu, liczone z frontów lodówki
  if(type === 'stojąca' && sub === 'lodowkowa'){
    const parts = getCabinetFrontCutListForMaterials(room, cab) || [];
    parts.forEach((part)=>{
      const qty = Math.max(1, Number(part && part.qty) || 1);
      const ww = Number(part && part.a) || 0;
      const hh = Number(part && part.b) || 0;
      for(let i=0; i<qty; i += 1){
        if(ww > 0 && hh > 0) out.push({ w:ww, h:hh, material:(cab.frontMaterial || 'laminat'), hasHandle:hasHandle });
      }
    });
    return out;
  }

  // piekarnikowa: tylko front nad piekarnikiem
  if(type === 'stojąca' && sub === 'piekarnikowa'){
    const ovenH = Number(cab.details?.ovenHeight) || 60;
    const doorH = Math.max(0, frontHeight() - ovenH);
    if(doorH <= 0) return out;
    const fc = Math.max(1, Number(cab.details?.doorCount || cab.frontCount || 1));
    const wEach = fc ? (effectiveW / fc) : 0;
    for(let i=0;i<fc;i++) out.push({ w: wEach, h: doorH , material: (cab.frontMaterial || 'laminat') , hasHandle: hasHandle });
    return out;
  }

  // standard: drzwi wg frontCount
  const fc = Math.max(0, Number(cab.frontCount || 0));
  if(fc <= 0) return out;

  const wEach = effectiveW / fc;
  const hEach = (type === 'stojąca') ? frontHeight() : (Number(cab.height) || 0);
  for(let i=0;i<fc;i++) out.push({ w: wEach, h: hEach , material: (cab.frontMaterial || 'laminat') , hasHandle: hasHandle });
  return out;
}

function getHingeCountForCabinet(room, cab){
  const doors = getDoorFrontPanelsForHinges(room, cab);
  if(!doors.length) return 0;
  let total = 0;
  doors.forEach(d => { total += blumHingesPerDoor(d.w, d.h, d.material, d.hasHandle); });
  return Math.max(0, Math.round(total));
}

  ns.frontHardware = Object.assign({}, ns.frontHardware, {
    hingesByWeightKg,
    hingesByHeightMm,
    hingeWidthAddOn,
    universalHingesPerDoor,
    blumHingesPerDoor,
    getDoorFrontPanelsForHinges,
    getHingeCountForCabinet
  });
})();
