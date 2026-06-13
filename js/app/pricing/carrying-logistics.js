// js/app/pricing/carrying-logistics.js
// Kalkulator wnoszenia: inwestor + winda + wymiary/waga korpusu -> fakty do robocizny i WYCENY.
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
    mdfWeightKgM2:14.44
  };

  const BODY_PART_NAME_RE = /^(bok|wieniec|trawers|plecy|przegroda|zaślepka|zaslepka)/i;
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

  function normalizeCarrying(input){
    const src = input && typeof input === 'object' ? input : {};
    const elevator = src.elevator && typeof src.elevator === 'object' ? src.elevator : src;
    const statusRaw = text(src.elevatorStatus || src.liftStatus || src.hasElevator);
    let elevatorStatus = '';
    if(statusRaw === 'yes' || statusRaw === 'tak' || statusRaw === 'true' || statusRaw === '1') elevatorStatus = 'yes';
    else if(statusRaw === 'no' || statusRaw === 'nie' || statusRaw === 'false' || statusRaw === '0') elevatorStatus = 'no';
    return {
      floorNumber:asTextNumber(src.floorNumber != null ? src.floorNumber : src.floor),
      elevatorStatus,
      elevator:{
        doorWidthCm:asTextNumber(elevator.doorWidthCm),
        doorHeightCm:asTextNumber(elevator.doorHeightCm),
        cabinWidthCm:asTextNumber(elevator.cabinWidthCm),
        cabinDepthCm:asTextNumber(elevator.cabinDepthCm),
        cabinHeightCm:asTextNumber(elevator.cabinHeightCm),
        capacityKg:asTextNumber(elevator.capacityKg != null ? elevator.capacityKg : elevator.liftCapacityKg)
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
      const area = qty > 0 && a > 0 && b > 0 ? qty * (a / 100) * (b / 100) : 0;
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
        weightKg:round(kg, 2)
      };
    });
    return { weightKg:round(total, 2), parts };
  }

  function orientationFits(dims, carrying){
    const c = normalizeCarrying(carrying);
    if(c.elevatorStatus !== 'yes') return { fits:false, reason:c.elevatorStatus === 'no' ? 'brak windy' : 'winda nieokreślona', orientation:null };
    const e = c.elevator || {};
    const doorW = cm(e.doorWidthCm);
    const doorH = cm(e.doorHeightCm);
    const cabinDepth = cm(e.cabinDepthCm);
    const cabinW = cm(e.cabinWidthCm);
    const cabinH = cm(e.cabinHeightCm);
    if(!(doorW > 0 && doorH > 0 && cabinDepth > 0)){
      return { fits:false, reason:'brak wymaganych wymiarów windy: drzwi szer., drzwi wys. i głębokość kabiny', orientation:null };
    }
    const values = (Array.isArray(dims) ? dims : []).map((v)=> cm(v)).filter((v)=> v > 0);
    if(values.length !== 3) return { fits:false, reason:'brak trzech wymiarów korpusu', orientation:null };
    const labels = ['A','B','C'];
    const permutations = [
      [0,1,2], [1,0,2], [0,2,1], [2,0,1], [1,2,0], [2,1,0]
    ];
    for(const p of permutations){
      const throughW = values[p[0]];
      const throughH = values[p[1]];
      const depth = values[p[2]];
      const doorFits = throughW <= doorW && throughH <= doorH;
      const cabinDepthFits = depth <= cabinDepth;
      const cabinWidthFits = !(cabinW > 0) || throughW <= cabinW;
      const cabinHeightFits = !(cabinH > 0) || throughH <= cabinH;
      if(doorFits && cabinDepthFits && cabinWidthFits && cabinHeightFits){
        return {
          fits:true,
          reason:'para wymiarów przechodzi przez drzwi, trzeci wymiar mieści się w głębokości kabiny',
          orientation:{ doorPair:[round(throughW, 1), round(throughH, 1)], cabinDepth:round(depth, 1), order:[labels[p[0]], labels[p[1]], labels[p[2]]] }
        };
      }
    }
    return { fits:false, reason:'żadna orientacja nie spełnia warunku: para przez drzwi + trzeci wymiar w głębokość kabiny', orientation:null };
  }

  function floorUnits(carrying, liftFits){
    const c = normalizeCarrying(carrying);
    if(liftFits) return DEFAULTS.liftFloorUnits;
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

  function evaluateCabinet(roomId, cabinet, investorOrCarrying){
    const inv = investorOrCarrying && investorOrCarrying.carrying ? investorOrCarrying : null;
    const carrying = normalizeCarrying(inv ? inv.carrying : (investorOrCarrying || (currentInvestor() || {}).carrying));
    const dims = getCabinetDimensions(cabinet);
    const lift = orientationFits(dims, carrying);
    const weight = estimateBodyWeight(roomId, cabinet);
    const units = floorUnits(carrying, lift.fits);
    const people = peopleForWeight(weight.weightKg);
    const overDisassembly = weight.weightKg > DEFAULTS.disassemblyMinKg;
    const requiresDisassembly = !!(overDisassembly && !lift.fits);
    const startMin = DEFAULTS.stairsMinutesStart;
    const floorMin = DEFAULTS.stairsMinutesPerFloorUnit;
    const baseMinutes = startMin + (units * floorMin);
    const helperMinutes = baseMinutes * people;
    const warnings = [];
    if(!lift.fits && carrying.elevatorStatus === 'yes') warnings.push(lift.reason);
    if(requiresDisassembly) warnings.push(`waga korpusu ${round(weight.weightKg, 1)} kg przekracza próg ${DEFAULTS.disassemblyMinKg} kg dla wnoszenia po schodach w całości`);
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
      requiresDisassembly,
      overDisassemblyThreshold:overDisassembly,
      baseMinutes,
      helperMinutes,
      startMinutes:startMin,
      minutesPerFloorUnit:floorMin,
      disassemblyThresholdKg:DEFAULTS.disassemblyMinKg,
      lightThresholdKg:DEFAULTS.lightMaxKg,
      warnings,
      formula:`${startMin} min + ${units} poziom(y) × ${floorMin} min = ${baseMinutes} min${people > 1 ? ` × ${people} osoby` : ''}`
    };
  }

  function labelForEvaluation(ev){
    const e = ev || {};
    const lift = e.liftFits ? 'winda: mieści się' : 'winda/schody';
    const dis = e.requiresDisassembly ? ' • wymaga rozkręcenia' : '';
    return `${round(e.bodyWeightKg || 0, 1)} kg • ${e.floorUnits || 0} poziom(y) • ${e.peopleCount || 1} os. • ${lift}${dis}`;
  }

  FC.carryingLogistics = {
    DEFAULTS:clone(DEFAULTS),
    normalizeCarrying,
    currentInvestor,
    estimateBodyWeight,
    materialKgM2,
    orientationFits,
    floorUnits,
    peopleForWeight,
    evaluateCabinet,
    labelForEvaluation,
    _debug:{ isBodyPart, cabinetCutList, getCabinetDimensions }
  };
})();
