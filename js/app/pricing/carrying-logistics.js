// js/app/pricing/carrying-logistics.js
// Kalkulator wnoszenia: inwestor + winda + wymiary/waga korpusu -> fakty do robocizny i WYCENY.
// v3: wysokie fronty (>2 m) są osobnymi elementami logistycznymi sprawdzanymi jak płaskie płyty.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const DEFAULTS = {
    lightMaxKg:20,
    disassemblyMinKg:45,
    stairsMinutesStart:15,
    stairsMinutesPerFloorUnit:5,
    liftFloorUnits:2,
    boardWeightKgM2:13,
    hdfWeightKgM2:3.2,
    mdfWeightKgM2:14.44,
    largeFlatItemMinLongCm:120,
    highFrontMinLongCm:200
  };

  const BODY_PART_NAME_RE = /^(bok|wieniec|trawers|plecy|przegroda|zaślepka|zaslepka)/i;
  const LARGE_FLAT_PART_RE = /^(bok|plecy|przegroda|zaślepka|zaslepka|wieniec)/i;
  const EXCLUDED_PART_NAME_RE = /^(front|półka|polka|blenda|cokół|cokol|listwa|uchwyt|zawias|prowadnik|podnośnik|podnosnik|okucie|cargo|szuflada)/i;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : (Number.isFinite(fallback) ? fallback : 0);
  }
  function round(value, digits){
    const d = Math.max(0, Math.round(Number(digits) || 0));
    const m = Math.pow(10, d);
    return Math.round((Number(value) || 0) * m) / m;
  }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value || {})); }catch(_){ return Object.assign({}, value || {}); } }
  function cm(value){
    const n = Math.max(0, num(value, 0));
    return n > 1000 ? n / 10 : n;
  }
  function asTextNumber(value){
    const raw = text(value);
    if(!raw) return '';
    const n = num(raw, null);
    return Number.isFinite(n) ? String(n) : raw;
  }
  function diag(a, b){
    const x = Math.max(0, num(a, 0));
    const y = Math.max(0, num(b, 0));
    return Math.sqrt((x * x) + (y * y));
  }

  function normalizeCarrying(input){
    const src = input && typeof input === 'object' ? input : {};
    const elevator = src.elevator && typeof src.elevator === 'object' ? src.elevator : src;
    const statusRaw = text(src.elevatorStatus || src.liftStatus || src.hasElevator).toLowerCase();
    let elevatorStatus = '';
    if(statusRaw === 'yes' || statusRaw === 'tak' || statusRaw === 'true' || statusRaw === '1') elevatorStatus = 'yes';
    else if(statusRaw === 'no' || statusRaw === 'nie' || statusRaw === 'false' || statusRaw === '0') elevatorStatus = 'no';
    return {
      floorNumber:asTextNumber(src.floorNumber != null ? src.floorNumber : src.floor),
      elevatorStatus,
      elevator:{
        doorWidthCm:asTextNumber(elevator.doorWidthCm),
        doorHeightCm:asTextNumber(elevator.doorHeightCm),
        cabinDepthCm:asTextNumber(elevator.cabinDepthCm),
        cabinHeightCm:asTextNumber(elevator.cabinHeightCm)
      },
      note:text(src.note || '')
    };
  }

  function currentInvestor(){
    try{
      const persistence = FC.investorPersistence || {};
      if(typeof persistence.getCurrentInvestorId === 'function' && typeof persistence.getInvestorById === 'function'){
        const id = persistence.getCurrentInvestorId();
        if(id) return persistence.getInvestorById(id) || null;
      }
      if(typeof persistence.getSelectedInvestor === 'function') return persistence.getSelectedInvestor() || null;
    }catch(_){ }
    return null;
  }

  function materialKgM2(material){
    const key = text(material).toLowerCase();
    if(key.includes('hdf')) return DEFAULTS.hdfWeightKgM2;
    if(key.includes('mdf') || key.includes('akryl') || key.includes('lakier')) return DEFAULTS.mdfWeightKgM2;
    try{
      const weights = FC.frontHardware && FC.frontHardware.FC_FRONT_WEIGHT_KG_M2;
      if(weights && Number(weights.laminat) > 0) return Number(weights.laminat);
    }catch(_){ }
    return DEFAULTS.boardWeightKgM2;
  }

  function isBodyPart(part){
    const name = text(part && part.name);
    if(!name) return false;
    if(EXCLUDED_PART_NAME_RE.test(name)) return false;
    if(BODY_PART_NAME_RE.test(name)) return true;
    const mat = text(part && part.material).toLowerCase();
    if(mat.includes('okucia') || mat.includes('front:')) return false;
    return false;
  }

  function cabinetCutList(roomId, cabinet){
    try{
      const api = FC.cabinetCutlist || FC.cabinetCutList || {};
      if(api && typeof api.getCabinetCutList === 'function') return api.getCabinetCutList(cabinet || {}, roomId) || [];
    }catch(_){ }
    return [];
  }

  function estimateBodyWeight(roomId, cabinet){
    const rows = cabinetCutList(roomId, cabinet).filter(isBodyPart);
    let total = 0;
    const parts = rows.map((part)=> {
      const qty = Math.max(0, num(part && part.qty, 0));
      const a = cm(part && part.a);
      const b = cm(part && part.b);
      const areaEach = a > 0 && b > 0 ? (a / 100) * (b / 100) : 0;
      const area = qty > 0 ? qty * areaEach : 0;
      const kgM2 = materialKgM2(part && part.material);
      const kg = area * kgM2;
      total += kg;
      return {
        name:text(part && part.name),
        qty,
        aCm:round(a, 1),
        bCm:round(b, 1),
        material:text(part && part.material),
        kgM2,
        weightKg:round(kg, 2),
        weightKgEach:round(areaEach * kgM2, 2)
      };
    });
    return { weightKg:round(total, 2), parts };
  }


  function isFrontPart(part){
    const name = text(part && part.name).toLowerCase();
    return name === 'front' || name.indexOf('front ') === 0 || name.indexOf('front-') === 0;
  }

  function frontCutList(roomId, cabinet){
    let rows = [];
    try{
      const hw = FC.frontHardware || {};
      if(hw && typeof hw.getCabinetFrontCutListForMaterials === 'function'){
        rows = hw.getCabinetFrontCutListForMaterials(roomId, clone(cabinet || {})) || [];
      }
    }catch(_){ rows = []; }
    rows = (Array.isArray(rows) ? rows : []).filter(isFrontPart);
    if(rows.length) return rows;
    return cabinetCutList(roomId, cabinet).filter(isFrontPart);
  }

  function expandHighFrontItems(roomId, cabinet){
    const items = [];
    frontCutList(roomId, cabinet).forEach((part)=> {
      const qty = Math.max(0, Math.round(num(part && part.qty, 0)));
      const a = cm(part && part.a);
      const b = cm(part && part.b);
      const long = Math.max(a, b);
      if(!(qty > 0 && a > 0 && b > 0 && long > DEFAULTS.highFrontMinLongCm)) return;
      const areaEach = (a / 100) * (b / 100);
      const kgM2 = materialKgM2(part && part.material);
      const weightKgEach = round(areaEach * kgM2, 2);
      for(let i = 0; i < qty; i += 1){
        items.push({
          name:'Front wysoki',
          originalName:text(part && part.name) || 'Front',
          index:i + 1,
          qtyTotal:qty,
          aCm:round(a, 1),
          bCm:round(b, 1),
          material:text(part && part.material),
          weightKg:weightKgEach,
          peopleCount:peopleForWeight(weightKgEach),
          thresholdCm:DEFAULTS.highFrontMinLongCm
        });
      }
    });
    return items;
  }

  function sumPeople(items){
    return (Array.isArray(items) ? items : []).reduce((sum, item)=> sum + Math.max(1, Number(item && item.peopleCount) || 1), 0);
  }

  function evaluateHighFronts(roomId, cabinet, carrying){
    const items = expandHighFrontItems(roomId, cabinet);
    const checked = items.map((item)=> Object.assign({}, item, { lift:flatElementFitsLift(item, carrying) }));
    const elevator = checked.filter((item)=> item.lift && item.lift.fits);
    const stairs = checked.filter((item)=> !(item.lift && item.lift.fits));
    return {
      thresholdCm:DEFAULTS.highFrontMinLongCm,
      items:checked,
      itemCount:checked.length,
      elevatorItemCount:elevator.length,
      stairsItemCount:stairs.length,
      elevatorItems:elevator,
      stairsItems:stairs,
      elevatorPeopleCount:sumPeople(elevator),
      stairsPeopleCount:sumPeople(stairs),
      elevatorFloorUnits:elevator.length ? DEFAULTS.liftFloorUnits : 0,
      stairsFloorUnits:stairs.length ? stairsFloorUnits(carrying) : 0
    };
  }

  function orientationFits(dims, carrying){
    const c = normalizeCarrying(carrying);
    if(c.elevatorStatus !== 'yes') return { fits:false, reason:c.elevatorStatus === 'no' ? 'brak windy' : 'winda nieokreślona', orientation:null };
    const e = c.elevator || {};
    const doorW = cm(e.doorWidthCm);
    const doorH = cm(e.doorHeightCm);
    const cabinDepth = cm(e.cabinDepthCm);
    if(!(doorW > 0 && doorH > 0 && cabinDepth > 0)){
      return { fits:false, reason:'brak wymaganych wymiarów windy: drzwi szer., drzwi wys. i głębokość windy', orientation:null };
    }
    const values = (Array.isArray(dims) ? dims : []).map((v)=> cm(v)).filter((v)=> v > 0);
    if(values.length !== 3) return { fits:false, reason:'brak trzech wymiarów korpusu', orientation:null };
    const labels = ['A','B','C'];
    const permutations = [[0,1,2], [1,0,2], [0,2,1], [2,0,1], [1,2,0], [2,1,0]];
    for(const p of permutations){
      const throughW = values[p[0]];
      const throughH = values[p[1]];
      const depth = values[p[2]];
      if(throughW <= doorW && throughH <= doorH && depth <= cabinDepth){
        return {
          fits:true,
          reason:'para wymiarów przechodzi przez drzwi, trzeci wymiar mieści się w głębokości windy',
          orientation:{ doorPair:[round(throughW, 1), round(throughH, 1)], cabinDepth:round(depth, 1), order:[labels[p[0]], labels[p[1]], labels[p[2]]] }
        };
      }
    }
    return { fits:false, reason:'żadna orientacja nie spełnia warunku: para przez drzwi + trzeci wymiar w głębokość windy', orientation:null };
  }

  function flatElementFitsLift(part, carrying){
    const c = normalizeCarrying(carrying);
    if(c.elevatorStatus !== 'yes') return { fits:false, reason:c.elevatorStatus === 'no' ? 'brak windy' : 'winda nieokreślona', method:'stairs' };
    const e = c.elevator || {};
    const doorW = cm(e.doorWidthCm);
    const doorH = cm(e.doorHeightCm);
    const cabinDepth = cm(e.cabinDepthCm);
    const cabinH = cm(e.cabinHeightCm);
    const a = cm(part && part.aCm != null ? part.aCm : part && part.a);
    const b = cm(part && part.bCm != null ? part.bCm : part && part.b);
    if(!(doorW > 0 && doorH > 0 && cabinDepth > 0)) return { fits:false, reason:'brak wymiarów drzwi/głębokości windy', method:'missing_dims' };
    if(!(a > 0 && b > 0)) return { fits:true, reason:'element bez wymiarów problemowych', method:'small' };

    const long = Math.max(a, b);
    const short = Math.min(a, b);
    const doorDiag = diag(doorW, doorH);
    const cabinDiag = cabinH > 0 ? diag(cabinDepth, cabinH) : cabinDepth;

    const directDoor = (a <= doorW && b <= doorH) || (b <= doorW && a <= doorH);
    const diagonalDoor = short <= doorW && long <= doorDiag;
    const passesDoor = directDoor || diagonalDoor;
    if(!passesDoor){
      return { fits:false, reason:`nie przechodzi przez drzwi windy ${round(doorW,1)} × ${round(doorH,1)} cm`, method:'door_blocked', longCm:round(long,1), shortCm:round(short,1) };
    }

    // Warunek ustalony praktycznie: bok może wejść po przekątnej kabiny tylko wtedy,
    // gdy jego drugi wymiar mieści się w szerokości drzwi windy.
    const shortFitsDoorWidth = short <= doorW;
    const directCabin = shortFitsDoorWidth && long <= cabinDepth;
    const diagonalCabin = shortFitsDoorWidth && cabinH > 0 && long <= cabinDiag;
    if(directCabin){
      return { fits:true, reason:'element przechodzi przez drzwi i mieści się w głębokości windy', method:directDoor ? 'direct' : 'door_diagonal', longCm:round(long,1), shortCm:round(short,1) };
    }
    if(diagonalCabin){
      return { fits:true, reason:'element przechodzi przez drzwi, a długi wymiar mieści się po przekątnej wysokość × głębokość windy', method:'cabin_diagonal', longCm:round(long,1), shortCm:round(short,1), cabinDiagonalCm:round(cabinDiag,1) };
    }
    return { fits:false, reason:`element przechodzi przez drzwi, ale nie mieści się w głębokości ani po przekątnej windy`, method:'cabin_blocked', longCm:round(long,1), shortCm:round(short,1), cabinDiagonalCm:round(cabinDiag,1) };
  }

  function floorUnits(carrying, liftFits){
    const c = normalizeCarrying(carrying);
    if(liftFits) return DEFAULTS.liftFloorUnits;
    const floor = Math.max(0, Math.floor(num(c.floorNumber, 0)));
    return floor + 1;
  }

  function stairsFloorUnits(carrying){
    const c = normalizeCarrying(carrying);
    const floor = Math.max(0, Math.floor(num(c.floorNumber, 0)));
    return floor + 1;
  }

  function peopleForWeight(weightKg){
    const kg = Math.max(0, num(weightKg, 0));
    if(!(kg > 0)) return 1;
    return kg <= DEFAULTS.lightMaxKg ? 1 : 2;
  }

  function getCabinetDimensions(cabinet){
    const cab = cabinet || {};
    return [cm(cab.width), cm(cab.height), cm(cab.depth)];
  }

  function isLargeFlatPart(part){
    const name = text(part && part.name);
    if(!name || !LARGE_FLAT_PART_RE.test(name)) return false;
    const a = cm(part && part.aCm);
    const b = cm(part && part.bCm);
    const maxDim = Math.max(a, b);
    return maxDim >= DEFAULTS.largeFlatItemMinLongCm || /^(bok|plecy|przegroda|zaślepka|zaslepka)/i.test(name);
  }

  function expandDisassembledItems(parts){
    const items = [];
    (Array.isArray(parts) ? parts : []).forEach((part)=> {
      if(!isLargeFlatPart(part)) return;
      const qty = Math.max(1, Math.round(num(part && part.qty, 1)));
      for(let i = 0; i < qty; i += 1){
        items.push({
          name:text(part && part.name),
          index:i + 1,
          qtyTotal:qty,
          aCm:round(cm(part && part.aCm), 1),
          bCm:round(cm(part && part.bCm), 1),
          material:text(part && part.material),
          weightKg:round(num(part && part.weightKgEach, 0), 2)
        });
      }
    });
    return items;
  }

  function evaluateDisassembledItems(parts, carrying){
    const items = expandDisassembledItems(parts);
    const checked = items.map((item)=> Object.assign({}, item, { lift:flatElementFitsLift(item, carrying) }));
    const elevator = checked.filter((item)=> item.lift && item.lift.fits);
    const stairs = checked.filter((item)=> !(item.lift && item.lift.fits));
    return {
      items:checked,
      itemCount:checked.length,
      elevatorItemCount:elevator.length,
      stairsItemCount:stairs.length,
      stairsItems:stairs,
      elevatorItems:elevator
    };
  }

  function evaluateCabinet(roomId, cabinet, investorOrCarrying){
    const inv = investorOrCarrying && investorOrCarrying.carrying ? investorOrCarrying : null;
    const carrying = normalizeCarrying(inv ? inv.carrying : (investorOrCarrying || (currentInvestor() || {}).carrying));
    const dims = getCabinetDimensions(cabinet);
    const lift = orientationFits(dims, carrying);
    const weight = estimateBodyWeight(roomId, cabinet);
    const overDisassembly = weight.weightKg > DEFAULTS.disassemblyMinKg;
    const requiresDisassembly = !!(overDisassembly && !lift.fits);
    const disassembled = requiresDisassembly ? evaluateDisassembledItems(weight.parts, carrying) : { items:[], itemCount:0, elevatorItemCount:0, stairsItemCount:0, stairsItems:[], elevatorItems:[] };
    const highFronts = evaluateHighFronts(roomId, cabinet, carrying);
    const units = requiresDisassembly
      ? (disassembled.stairsItemCount > 0 ? stairsFloorUnits(carrying) : 0)
      : floorUnits(carrying, lift.fits);
    const people = requiresDisassembly ? 1 : peopleForWeight(weight.weightKg);
    const carryingItemCount = requiresDisassembly ? disassembled.stairsItemCount : 1;
    const startMin = DEFAULTS.stairsMinutesStart;
    const floorMin = DEFAULTS.stairsMinutesPerFloorUnit;
    const baseMinutes = units > 0 ? startMin + (units * floorMin) : 0;
    const helperMinutes = baseMinutes * people * Math.max(0, carryingItemCount);
    const warnings = [];
    if(!lift.fits && carrying.elevatorStatus === 'yes') warnings.push(lift.reason);
    if(highFronts.itemCount > 0){
      const parts = [];
      if(highFronts.elevatorItemCount > 0) parts.push(`windą: ${highFronts.elevatorItemCount} szt.`);
      if(highFronts.stairsItemCount > 0) parts.push(`po schodach: ${highFronts.stairsItemCount} szt.`);
      warnings.push(`wysokie fronty powyżej ${DEFAULTS.highFrontMinLongCm} cm liczone osobno (${parts.join(', ') || 'brak'})`);
    }
    if(requiresDisassembly){
      warnings.push(`waga korpusu ${round(weight.weightKg, 1)} kg przekracza próg ${DEFAULTS.disassemblyMinKg} kg dla wnoszenia po schodach w całości`);
      if(disassembled.stairsItemCount > 0) warnings.push(`po rozkręceniu po schodach liczono tylko elementy niewchodzące do windy: ${disassembled.stairsItemCount} szt.`);
      if(disassembled.stairsItemCount === 0 && disassembled.itemCount > 0) warnings.push('po rozkręceniu wszystkie duże elementy mieszczą się do windy — nie doliczono wnoszenia po schodach dla elementów');
    }
    return {
      roomId:text(roomId),
      cabinetId:text(cabinet && cabinet.id),
      carrying,
      dimensionsCm:{ width:round(dims[0], 1), height:round(dims[1], 1), depth:round(dims[2], 1) },
      bodyWeightKg:weight.weightKg,
      bodyWeightParts:weight.parts,
      liftFits:lift.fits,
      liftReason:lift.reason,
      liftOrientation:lift.orientation,
      floorNumber:Math.max(0, Math.floor(num(carrying.floorNumber, 0))),
      floorUnits:units,
      peopleCount:people,
      carryingItemCount,
      requiresDisassembly,
      overDisassemblyThreshold:overDisassembly,
      disassembled,
      highFronts,
      baseMinutes,
      helperMinutes,
      startMinutes:startMin,
      minutesPerFloorUnit:floorMin,
      disassemblyThresholdKg:DEFAULTS.disassemblyMinKg,
      lightThresholdKg:DEFAULTS.lightMaxKg,
      warnings,
      formula:requiresDisassembly
        ? (carryingItemCount > 0 ? `${startMin} min + ${units} poziom(y) × ${floorMin} min = ${baseMinutes} min × ${carryingItemCount} element(y)` : 'wszystkie duże elementy po rozkręceniu weszły do windy — bez wnoszenia po schodach')
        : `${startMin} min + ${units} poziom(y) × ${floorMin} min = ${baseMinutes} min${people > 1 ? ` × ${people} osoby` : ''}`
    };
  }

  function labelForEvaluation(ev){
    const e = ev || {};
    const lift = e.liftFits ? 'winda: mieści się' : 'winda/schody';
    const dis = e.requiresDisassembly ? ` • rozkręcenie • po schodach: ${e.carryingItemCount || 0} elem.` : '';
    const hf = e.highFronts && e.highFronts.itemCount ? ` • fronty >2 m: ${e.highFronts.itemCount} szt.` : '';
    return `${round(e.bodyWeightKg || 0, 1)} kg • ${e.floorUnits || 0} poziom(y) • ${e.peopleCount || 1} os. • ${lift}${dis}${hf}`;
  }

  FC.carryingLogistics = {
    DEFAULTS:clone(DEFAULTS),
    normalizeCarrying,
    currentInvestor,
    estimateBodyWeight,
    materialKgM2,
    orientationFits,
    flatElementFitsLift,
    expandDisassembledItems,
    evaluateDisassembledItems,
    expandHighFrontItems,
    evaluateHighFronts,
    floorUnits,
    peopleForWeight,
    evaluateCabinet,
    labelForEvaluation,
    _debug:{ isBodyPart, isFrontPart, isLargeFlatPart, cabinetCutList, frontCutList, getCabinetDimensions }
  };
})();
