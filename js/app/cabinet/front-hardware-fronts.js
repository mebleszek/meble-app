(function(){
  const ns = (window.FC = window.FC || {});
  const hw = ns.frontHardware || {};
  const cabinetHasHandle = hw.cabinetHasHandle || function(){ return true; };

  function fmtCm(value){
    try{
      if(ns.materialCommon && typeof ns.materialCommon.fmtCm === 'function') return ns.materialCommon.fmtCm(value);
    }catch(_){ }
    try{
      if(typeof window.fmtCm === 'function') return window.fmtCm(value);
    }catch(_){ }
    const n = Number(value);
    return Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : String(value ?? '');
  }

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

function getRoomSetRecord(room, setId){
  const rid = String(room || '');
  const sid = String(setId || '');
  const roomData = getProjectRoomData(rid) || null;
  const sets = Array.isArray(roomData && roomData.sets) ? roomData.sets : [];
  return sets.find((set)=> String(set && set.id || '') === sid) || null;
}

function normalizeSetFrontCount(value){
  const n = Math.max(1, Math.round(Number(value) || 1));
  return n === 1 ? 1 : 2;
}

function createVirtualSetFront(set, patch){
  const source = set && set.frontSource ? set.frontSource : null;
  return Object.assign({
    id: `virtual_${String(set && set.id || 'set')}_${String(patch && patch.note || 'front').replace(/\s+/g, '_')}`,
    setId: set && set.id || null,
    setNumber: set && set.number || null,
    material: set && set.frontMaterial || 'laminat',
    color: set && set.frontColor || '',
    width: 0,
    height: 0,
    note: '',
    frontMaterialSource: source
  }, patch || {});
}

function deriveSetFrontsFromRecord(room, setId){
  const set = getRoomSetRecord(room, setId);
  if(!set || !set.presetId) return [];
  const p = set.params && typeof set.params === 'object' ? set.params : {};
  const fc = normalizeSetFrontCount(set.frontCount);
  const presetId = String(set.presetId || '');
  const setNumber = set.number || null;
  const out = [];

  function push(width, height, note, groupRoleId){
    const w = Math.max(0, Number(width) || 0);
    const h = Math.max(0, Number(height) || 0);
    if(w <= 0 || h <= 0) return;
    out.push(createVirtualSetFront(set, { width:w, height:h, groupRoleId, note:`Zestaw ${setNumber || ''}: ${note}`.replace(/\s+/g, ' ').trim() }));
  }

  if(presetId === 'A'){
    const w1 = Number(p.w1) || 0;
    const w2 = Number(p.w2) || 0;
    const totalH = (Number(p.hB) || 0) + (Number(p.hTop) || 0);
    if(fc === 1) push(w1 + w2, totalH, '1 front','front.A.single');
    else {
      push(w1, totalH, 'front lewy','front.A.left');
      push(w2, totalH, 'front prawy','front.A.right');
    }
    return out;
  }

  if(presetId === 'C'){
    const w = Number(p.w) || 0;
    const totalH = (Number(p.hB) || 0) + (Number(p.hTop) || 0);
    if(fc === 1) push(w, totalH, '1 front','front.C.panels');
    else {
      const half = Math.round((w / 2) * 10) / 10;
      push(half, totalH, 'front 1/2','front.C.panels');
      push(Math.max(0, w - half), totalH, 'front 2/2','front.C.panels');
    }
    return out;
  }

  if(presetId === 'D'){
    const w = Number(p.w) || 0;
    const totalH = (Number(p.hB) || 0) + (Number(p.hM) || 0) + (Number(p.hTop) || 0);
    if(fc === 1) push(w, totalH, '1 front','front.D.panels');
    else {
      const half = Math.round((w / 2) * 10) / 10;
      push(half, totalH, 'front 1/2','front.D.panels');
      push(Math.max(0, w - half), totalH, 'front 2/2','front.D.panels');
    }
  }
  return out;
}

function getRoomSetFronts(room, setId){
  const rid = String(room || '');
  const sid = String(setId || '');
  const roomData = getProjectRoomData(rid) || null;
  const fronts = Array.isArray(roomData && roomData.fronts) ? roomData.fronts : [];
  const stored = fronts.filter((front)=> String(front && front.setId || '') === sid);
  if(stored.length) return stored;
  return deriveSetFrontsFromRecord(rid, sid);
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

function resolveDrawerDoorCount(cab){
  const d = cab && cab.details && typeof cab.details === 'object' ? cab.details : {};
  const explicit = Number(d.doorCount || d.doorFrontCount || d.hingedDoorCount || 0);
  if(explicit > 0) return Math.max(1, Math.round(explicit));

  const count = Number(cab && cab.frontCount) || 0;
  // Legacy/cutlista mogły zapisać frontCount jako: 1 front szuflady + liczba drzwi.
  // Do zawiasów i frontów drzwiowych przy tym typie interesują nas wyłącznie drzwi.
  if(count > 2) return Math.max(1, Math.round(count - 1));

  return Math.max(1, Math.round(count || 2));
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
      name:'Front', sourceFamily:'set.front', sourceSetId:String(cab.setId), sourceReason:'unverified_set_front_structure',
      qty:1,
      a: wr,
      b: hr,
      dims:`${fmtCm(wr)} × ${fmtCm(hr)}`,
      material: materialKey
    });
  });
  // Validate stored fronts against the template before assigning structural groups.
  // Geometry checks membership; the address itself comes only from set ID and template role.
  const expected=new Map();
  deriveSetFrontsFromRecord(room,cab.setId).forEach(front=>{
    const material=String(front.material||cab.frontMaterial||'laminat');
    const color=String(front.color||cab.frontColor||'');
    const materialKey=`Front: ${material}${color ? ` • ${color}` : ''}`;
    const key=`${materialKey}|${Math.round(front.width*10)/10}|${Math.round(front.height*10)/10}`;
    const roles=expected.get(key)||[];
    roles.push(front.groupRoleId);expected.set(key,roles);
  });
  const verified=expected.size===acc.size && Array.from(acc.entries()).every(([key,row])=>{
    const roles=expected.get(key);return roles && roles.length===row.qty && roles.every(Boolean);
  });
  if(verified){
    const sourceProjectId=ns.partProvenance ? ns.partProvenance.projectContext(window.projectData).projectId : '';
    acc.forEach((row,key)=>{
      const counts=new Map();expected.get(key).forEach(role=>counts.set(role,(counts.get(role)||0)+1));
      row.sourceGroupRoles=Array.from(counts,([groupRoleId,qty])=>({ownerType:'set',setId:String(cab.setId),sourceProjectId,groupRoleId,qty}));
    });
  }
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

function getCabinetFrontPartsForLocalDraft(room, cab){
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
  function addFront(w, h, role, groupRoleId){
    const W = Math.max(0, Number(w) || 0);
    const H = Math.max(0, Number(h) || 0);
    if(W <= 0 || H <= 0) return;

    const Wr = Math.round(W * 10) / 10;
    const Hr = Math.round(H * 10) / 10;
    const materialKey = `Front: ${mat}${col ? ` • ${col}` : ''}`;
    const key = `${materialKey}|${Wr}|${Hr}`;

    if(acc.has(key)){
      const row=acc.get(key);row.qty += 1;
      if(role)row.partRoleIds.push(role);
      if(groupRoleId){
        const group=row.sourceGroupRoles.find(item=>item.groupRoleId===groupRoleId);
        if(group)group.qty+=1;
        else row.sourceGroupRoles.push({ownerType:'cabinet',groupRoleId,qty:1});
      }
      return;
    }
    acc.set(key, {
      partRoleIds:role?[role]:[], sourceFamily:'front', sourceReason:'persistent_front_slots_required',
      sourceGroupRoles:groupRoleId?[{ownerType:'cabinet',groupRoleId,qty:1}]:[],
      name: 'Front',
      qty: 1,
      a: Wr,
      b: Hr,
      // Bez komentarzy w wymiarach
      dims: `${fmtCm(Wr)} × ${fmtCm(Hr)}`,
      material: materialKey
    });
  }
  function finalize(){
    const rows=Array.from(acc.values());
    if(cab.setId) rows.forEach(row=>{
      row.partRoleIds=[];row.sourceGroupRoles=[];
      row.sourceSetId=String(cab.setId);row.sourceFamily='set.front';row.sourceReason='unverified_set_front_structure';
    });
    return rows;
  }
  const pairRole=(family,count,index)=>count===1?family+'.single':count===2?(index===0?family+'.left':family+'.right'):null;

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
    const layout=String(cab.details?.drawerLayout||'');
    for(let i=0;i<drawers;i++){
      const groupRoleId=layout==='3_1_2_2'
        ? (drawers===3 ? (i===0?'front.drawer.small':'front.drawer.large') : null)
        : (!layout||['1_big','2_equal','3_equal','5_equal'].includes(layout) ? 'front.drawer.standard' : null);
      addFront(Number(cab.width)||0,hEach,null,groupRoleId);
    }
    cab.frontCount = drawers;
    return finalize();
  }

  // Stojąca z szufladą + drzwi
  if(cab.type === 'stojąca' && cab.subType === 'szuflada_drzwi'){
    const fh = getFrontHeightForCab();
    const drawerH = Number(cab.details?.drawerHeight) || Math.min(20, fh);
    const doorH = Math.max(0, fh - drawerH);
    addFront(Number(cab.width)||0, drawerH,'front.drawer.main');
    if(doorH > 0){
      const fc = resolveDrawerDoorCount(cab);
      const wEach = fc ? (effectiveW / fc) : 0;
      for(let i=0;i<fc;i++) addFront(wEach, doorH,pairRole('front.door',fc,i));
      if(cab.details && typeof cab.details === 'object') cab.details.doorCount = fc;
    } else {
      cab.frontCount = 1;
    }
    return finalize();
  }

  // Zmywarkowa: 1 front (wysokość wg ustawień)
  if(cab.type === 'stojąca' && cab.subType === 'zmywarkowa'){
    addFront(Number(cab.width)||0, getFrontHeightForCab(),'front.dishwasher');
    cab.frontCount = 1;
    return finalize();
  }

  // Lodówkowa: fronty muszą wynikać z realnego ustawienia lodówki,
  // a nie ze starego założenia „zawsze góra + dół”. To samo źródło
  // służy materiałom i liczbie zawiasów lodówkowych.
  if(cab.type === 'stojąca' && cab.subType === 'lodowkowa'){
    const opt = String((cab.details && cab.details.fridgeOption) ? cab.details.fridgeOption : 'zabudowa');
    if(opt !== 'zabudowa'){
      cab.frontCount = 0;
      return finalize();
    }

    const fc = String((cab.details && cab.details.fridgeFrontCount) ? cab.details.fridgeFrontCount : '2');
    const width = Number(cab.width) || 0;
    const totalFrontH = getFrontHeightForCab();

    if(fc === '1'){
      addFront(width, totalFrontH,'front.fridge.single');
      cab.frontCount = 1;
      return finalize();
    }

    const roomData = getProjectRoomData(room) || {};
    const s = roomData.settings || {};
    const legH = Number(s.legHeight) || 0;
    const lowerH = Math.max(0, (Number(s.bottomHeight) || 0) - legH);
    const upperH = Math.max(0, totalFrontH - lowerH);
    let count = 0;
    if(lowerH > 0){ addFront(width, lowerH,'front.fridge.lower'); count += 1; }
    if(upperH > 0){ addFront(width, upperH,'front.fridge.upper'); count += 1; }
    cab.frontCount = count;
    return finalize();
  }

  // Piekarnikowa: front nad piekarnikiem (reszta to piekarnik)
  if(cab.type === 'stojąca' && cab.subType === 'piekarnikowa'){
    const ovenH = Number(cab.details?.ovenHeight) || 60;
    const hRest = Math.max(0, getFrontHeightForCab() - ovenH);
    if(hRest > 0) addFront(Number(cab.width)||0, hRest,'front.oven.cover');
    cab.frontCount = hRest > 0 ? 1 : 0;
    return finalize();
  }

  // Uchylna (wisząca / moduł): 1 lub 2 fronty wg HF
  if((cab.type === 'wisząca' || cab.type === 'moduł') && cab.subType === 'uchylna'){
    const fc = Math.max(1, Number(cab.frontCount||1));
    const fh = getFrontHeightForCab();
    const wEach = fc ? (effectiveW / fc) : 0;
    for(let i=0;i<fc;i++) addFront(wEach, fh,pairRole('front.flap',fc,i));
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
    addFront(FL, fh,'front.corner.gl-gp');
    addFront(FP, fh,'front.corner.st-sp');
    cab.frontCount = 2;
    return finalize();
  }

  // Reszta: 1 lub 2 drzwiowe
  const fcDoors = Math.max(1, Number(cab.frontCount||2));
  const fh = getFrontHeightForCab();
  const wEach = fcDoors ? Math.round((effectiveW / fcDoors) * 10) / 10 : 0;
  for(let i=0;i<fcDoors;i++) addFront(wEach, fh,pairRole('front.door',fcDoors,i));
  cab.frontCount = fcDoors;

  return finalize();
}

  function getCabinetFrontCutListForMaterials(room,cab,sourceContext){
    const provenance=ns.partProvenance;
    const owner=provenance?provenance.context(cab,room,sourceContext):null;
    const local=Object.assign({},cab,{details:Object.assign({},cab&&cab.details)});
    const parts=getCabinetFrontPartsForLocalDraft(room,local);
    return provenance?provenance.bind(parts,owner):parts;
  }

  ns.frontHardware = Object.assign({}, ns.frontHardware, {
    getProjectRoomData,
    getRoomSetRecord,
    deriveSetFrontsFromRecord,
    getRoomSetFronts,
    isLeadSetCabinet,
    resolveDrawerDoorCount,
    aggregateSetFrontParts,
    getSetDoorFrontPanels,
    getCabinetFrontCutListForMaterials,
    getCabinetFrontPartsForLocalDraft
  });
})();
