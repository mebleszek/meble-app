(function(){
  const ns = (window.FC = window.FC || {});
  const hw = ns.frontHardware || {};
  const cabinetHasHandle = hw.cabinetHasHandle || function(){ return true; };

  function getProjectRoomData(room){
    const rid = String(room || '');
    try{
      if(window.projectData && window.projectData[rid] && typeof window.projectData[rid] === 'object') return window.projectData[rid];
    }catch(_){ }
    try{
      if(typeof projectData !== 'undefined' && projectData && projectData[rid] && typeof projectData[rid] === 'object') return projectData[rid];
    }catch(_){ }
    return null;
  }

function getRoomSetFronts(room, setId){
  const rid = String(room || '');
  const sid = String(setId || '');
  const roomData = getProjectRoomData(rid) || null;
  const fronts = Array.isArray(roomData && roomData.fronts) ? roomData.fronts : [];
  return fronts.filter((front)=> String(front && front.setId || '') === sid);
}

function isLeadSetCabinet(room, cab){
  if(!cab || !cab.setId) return false;
  const rid = String(room || '');
  const sid = String(cab.setId || '');
  const roomData = getProjectRoomData(rid) || null;
  const cabinets = Array.isArray(roomData && roomData.cabinets) ? roomData.cabinets : [];
  const first = cabinets.find((entry)=> String(entry && entry.setId || '') === sid) || null;
  return !!(first && String(first.id || '') === String(cab.id || ''));
}

function aggregateSetFrontParts(room, cab){
  if(!cab || !cab.setId || !isLeadSetCabinet(room, cab)) return [];
  const fronts = getRoomSetFronts(room, cab.setId);
  if(!fronts.length) return [];
  const acc = new Map();
  fronts.forEach((front)=>{
    const w = Math.max(0, Number(front && front.width) || 0);
    const h = Math.max(0, Number(front && front.height) || 0);
    if(w <= 0 || h <= 0) return;
    const material = String(front && front.material || cab.frontMaterial || 'laminat');
    const color = String(front && front.color || cab.frontColor || '');
    const materialKey = `Front: ${material}${color ? ` • ${color}` : ''}`;
    const wr = Math.round(w * 10) / 10;
    const hr = Math.round(h * 10) / 10;
    const key = `${materialKey}|${wr}|${hr}`;
    if(acc.has(key)){
      acc.get(key).qty += 1;
      return;
    }
    acc.set(key, {
      name:'Front',
      qty:1,
      a: wr,
      b: hr,
      dims:`${fmtCm(wr)} × ${fmtCm(hr)}`,
      material: materialKey
    });
  });
  return Array.from(acc.values());
}

function getSetDoorFrontPanels(room, cab){
  if(!cab || !cab.setId || !isLeadSetCabinet(room, cab)) return [];
  const hasHandle = cabinetHasHandle(cab);
  return getRoomSetFronts(room, cab.setId)
    .map((front)=>({
      w: Math.max(0, Number(front && front.width) || 0),
      h: Math.max(0, Number(front && front.height) || 0),
      material: String(front && front.material || cab.frontMaterial || 'laminat'),
      hasHandle
    }))
    .filter((front)=> front.w > 0 && front.h > 0);
}

function getCabinetFrontCutListForMaterials(room, cab){
  // Zwraca listę elementów "Front" do zakładki Materiały.
  // Ważne: bez komentarzy w polu wymiarów oraz z agregacją identycznych frontów (qty zamiast duplikatów).
  const out = [];
  if(!cab || !(cab.type === 'stojąca' || cab.type === 'wisząca' || cab.type === 'moduł')) return out;

  const setParts = aggregateSetFrontParts(room, cab);
  if(setParts.length) return setParts;
  if(cab && cab.setId && !isLeadSetCabinet(room, cab)) return out;

  const mat = cab.frontMaterial || 'laminat';
  const col = cab.frontColor || '';

  // Agregator: klucz = material|W|H (W/H zaokrąglone do 0,1cm)
  const acc = new Map();
  function addFront(w, h){
    const W = Math.max(0, Number(w) || 0);
    const H = Math.max(0, Number(h) || 0);
    if(W <= 0 || H <= 0) return;

    const Wr = Math.round(W * 10) / 10;
    const Hr = Math.round(H * 10) / 10;
    const materialKey = `Front: ${mat}${col ? ` • ${col}` : ''}`;
    const key = `${materialKey}|${Wr}|${Hr}`;

    if(acc.has(key)){
      acc.get(key).qty += 1;
      return;
    }
    acc.set(key, {
      name: 'Front',
      qty: 1,
      a: Wr,
      b: Hr,
      // Bez komentarzy w wymiarach
      dims: `${fmtCm(Wr)} × ${fmtCm(Hr)}`,
      material: materialKey
    });
  }
  function finalize(){ return Array.from(acc.values()); }

  // wysokość frontów: dla stojących odejmujemy wysokość nóżek (ustawienia pomieszczenia)
  function getFrontHeightForCab(){
    let h = Number(cab.height) || 0;
    if(cab.type === 'stojąca'){
      const roomData = getProjectRoomData(room) || {};
      const s = roomData.settings || {};
      const leg = Number(s.legHeight) || 0;
      if(leg > 0) h = Math.max(0, h - leg);
    }
    return h;
  }

  // effectiveW: szerokość używana do frontów (niektóre typy mają zaślepienia)
  let effectiveW = Number(cab.width)||0;
  if(cab.subType === 'rogowa_slepa'){
    const blind = Number(cab.details?.blindPart) || 0;
    // fronty w rogowej ślepej liczone jak wcześniej (fronty bazują na szerokości, a zaślepki liczone w korpusie)
    if(blind > 0) effectiveW = Math.max(0, effectiveW - blind);
  }

  // Szuflady: licz fronty szuflad wg zadeklarowanej ilości
  if(cab.type === 'stojąca' && cab.subType === 'szuflady'){
    const drawers = Math.max(1, Number(cab.details?.drawers) || 1);
    const fh = getFrontHeightForCab();
    const hEach = drawers ? (fh / drawers) : 0;
    for(let i=0;i<drawers;i++) addFront(Number(cab.width)||0, hEach);
    cab.frontCount = drawers;
    return finalize();
  }

  // Stojąca z szufladą + drzwi
  if(cab.type === 'stojąca' && cab.subType === 'szuflada_drzwi'){
    const fh = getFrontHeightForCab();
    const drawerH = Number(cab.details?.drawerHeight) || Math.min(20, fh);
    const doorH = Math.max(0, fh - drawerH);
    addFront(Number(cab.width)||0, drawerH);
    if(doorH > 0){
      const fc = Math.max(1, Number(cab.frontCount||2));
      const wEach = fc ? (effectiveW / fc) : 0;
      for(let i=0;i<fc;i++) addFront(wEach, doorH);
      cab.frontCount = 1 + fc;
    } else {
      cab.frontCount = 1;
    }
    return finalize();
  }

  // Zmywarkowa: 1 front (wysokość wg ustawień)
  if(cab.type === 'stojąca' && cab.subType === 'zmywarkowa'){
    addFront(Number(cab.width)||0, getFrontHeightForCab());
    cab.frontCount = 1;
    return finalize();
  }

  // Lodówkowa: 2 fronty (góra + dół)
  if(cab.type === 'stojąca' && cab.subType === 'lodowkowa'){
    const topH = Number(cab.details?.topFrontHeight) || 60;
    const fh = getFrontHeightForCab();
    const bottomH = Math.max(0, fh - topH);
    addFront(Number(cab.width)||0, topH);
    if(bottomH > 0) addFront(Number(cab.width)||0, bottomH);
    cab.frontCount = bottomH > 0 ? 2 : 1;
    return finalize();
  }

  // Piekarnikowa: front nad piekarnikiem (reszta to piekarnik)
  if(cab.type === 'stojąca' && cab.subType === 'piekarnikowa'){
    const ovenH = Number(cab.details?.ovenHeight) || 60;
    const hRest = Math.max(0, getFrontHeightForCab() - ovenH);
    if(hRest > 0) addFront(Number(cab.width)||0, hRest);
    cab.frontCount = hRest > 0 ? 1 : 0;
    return finalize();
  }

  // Uchylna (wisząca / moduł): 1 lub 2 fronty wg HF
  if((cab.type === 'wisząca' || cab.type === 'moduł') && cab.subType === 'uchylna'){
    const fc = Math.max(1, Number(cab.frontCount||1));
    const fh = getFrontHeightForCab();
    const wEach = fc ? (effectiveW / fc) : 0;
    for(let i=0;i<fc;i++) addFront(wEach, fh);
    cab.frontCount = fc;
    return finalize();
  }

  // Narożna L (wisząca / stojąca): 2 fronty wg GL/GP/ST/SP
  if((cab.type === 'wisząca' || cab.type === 'stojąca') && cab.subType === 'narozna_l'){
    const d = cab.details || {};
    const GL = Number(d.gl) || 0;
    const GP = Number(d.gp) || 0;
    const ST = Number(d.st) || 0;
    const SP = Number(d.sp) || 0;
    const t = 1.8; // cm (płyta 18mm)
    const FL = Math.abs(GL - GP);
    const FP = Math.abs(ST - SP - t);
    const fh = getFrontHeightForCab();
    addFront(FL, fh);
    addFront(FP, fh);
    cab.frontCount = 2;
    return finalize();
  }

  // Reszta: 1 lub 2 drzwiowe
  const fcDoors = Math.max(1, Number(cab.frontCount||2));
  const fh = getFrontHeightForCab();
  const wEach = fcDoors ? Math.round((effectiveW / fcDoors) * 10) / 10 : 0;
  for(let i=0;i<fcDoors;i++) addFront(wEach, fh);
  cab.frontCount = fcDoors;

  return finalize();
}

  ns.frontHardware = Object.assign({}, ns.frontHardware, {
    getProjectRoomData,
    getRoomSetFronts,
    isLeadSetCabinet,
    aggregateSetFrontParts,
    getSetDoorFrontPanels,
    getCabinetFrontCutListForMaterials
  });
})();
