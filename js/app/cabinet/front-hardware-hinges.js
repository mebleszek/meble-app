(function(){
  const ns = (window.FC = window.FC || {});
  const hw = ns.frontHardware || {};
  const estimateFrontWeightKg = hw.estimateFrontWeightKg || function(){ return 0; };
  const getSetDoorFrontPanels = hw.getSetDoorFrontPanels || function(){ return []; };
  const isLeadSetCabinet = hw.isLeadSetCabinet || function(){ return false; };
  const cabinetHasHandle = hw.cabinetHasHandle || function(){ return true; };

  const getProjectRoomData = hw.getProjectRoomData || function(){ return null; };

function blumHingesPerDoor(wCm, hCm, frontMaterial, hasHandle){
  const weightKg = estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle);
  const weightLb = weightKg * 2.20462;
  const heightIn = (Math.max(0, Number(hCm) || 0)) / 2.54;
  const widthMm = (Math.max(0, Number(wCm) || 0)) * 10;

  // Bazowo wg wagi (quick reference: <15 lb, 15–30, 30–45, 45–60 => 2–5 zawiasów)
  let hinges = 2;
  if(weightLb <= 15) hinges = 2;
  else if(weightLb <= 30) hinges = 3;
  else if(weightLb <= 45) hinges = 4;
  else if(weightLb <= 60) hinges = 5;
  else hinges = 5 + Math.ceil((weightLb - 60) / 15);

  // Korekta wg wysokości (konserwatywnie, w duchu BLUM: wyższe fronty często potrzebują dodatkowego zawiasu)
  if(hinges <= 2 && heightIn > 40) hinges = 3;
  if(hinges <= 3 && heightIn > 60) hinges = 4;
  if(hinges <= 4 && heightIn > 80) hinges = 5;
  if(hinges <= 5 && heightIn > 100) hinges = 6;

  // Korekta wg szerokości (BLUM: wartości bazowe dla szer. do 600 mm; do ~650 mm zwykle +1 zawias)
  if(widthMm > 600){
    hinges += Math.ceil((widthMm - 600) / 50);
  }

  return Math.max(0, Math.round(hinges));
}


function getDoorFrontPanelsForHinges(room, cab){
  const out = [];
  if(!cab) return out;
  const setDoors = getSetDoorFrontPanels(room, cab);
  if(setDoors.length) return setDoors;
  if(cab && cab.setId && !isLeadSetCabinet(room, cab)) return out;
  const type = String(cab.type || '');
  const sub = String(cab.subType || '');

  // brak zawiasów dla klap (AVENTOS) i frontów urządzeń
  if(sub === 'uchylne') return out;
  if(type !== 'stojąca' && type !== 'wisząca' && type !== 'moduł') return out;
  if(sub === 'szuflady' || sub === 'zmywarkowa' || sub === 'lodowkowa') return out;
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
    const fc = Math.max(1, Number(cab.details?.doorCount || cab.frontCount || 2));
    const wEach = fc ? (effectiveW / fc) : 0;
    for(let i=0;i<fc;i++) out.push({ w: wEach, h: doorH , material: (cab.frontMaterial || 'laminat') , hasHandle: hasHandle });
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
    blumHingesPerDoor,
    getDoorFrontPanelsForHinges,
    getHingeCountForCabinet
  });
})();
