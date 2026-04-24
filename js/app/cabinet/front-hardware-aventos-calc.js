(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});
  const hw = ns.frontHardware || {};
  const data = ns.frontHardwareAventosData || {};
  const FC_HANDLE_WEIGHT_KG = hw.FC_HANDLE_WEIGHT_KG || 0.2;
  const getFrontWeightKgM2 = hw.getFrontWeightKgM2 || function(){ return 13; };
  const cabinetHasHandle = hw.cabinetHasHandle || function(){ return true; };
  const getProjectRoomData = hw.getProjectRoomData || function(){ return null; };
  const singleHandleKinds = new Set(data.SINGLE_HANDLE_KINDS || ['HF_top','HS_top','HL_top']);

  function estimateFlapWeightKg(cab, room){
    if(!cab) return 0;
    let hFront = Number(cab.height) || 0;
    if(cab.type === 'stojąca'){
      const roomData = getProjectRoomData(room) || {};
      const s = roomData.settings || {};
      const leg = Number(s.legHeight) || 0;
      if(leg > 0) hFront = Math.max(0, hFront - leg);
    }

    let wFront = Number(cab.width) || 0;
    if(String(cab.subType||'') === 'rogowa_slepa'){
      const blind = Number(cab.details && cab.details.blindPart) || 0;
      if(blind > 0) wFront = Math.max(0, wFront - blind);
    }

    const mat = cab.frontMaterial || 'laminat';
    const area = (Math.max(0, wFront) / 100) * (Math.max(0, hFront) / 100);
    const kind = String((cab.details || {}).flapKind || 'HK-XS');
    const handleMul = singleHandleKinds.has(kind) ? 1 : 2;
    return area * getFrontWeightKgM2(mat) + (cabinetHasHandle(cab) ? (FC_HANDLE_WEIGHT_KG * handleMul) : 0);
  }

  function blumAventosPowerFactor(cab, room){
    const khMm = Math.max(0, Number(cab && cab.height) || 0) * 10;
    const fgKg = estimateFlapWeightKg(cab, room);
    return Math.round(khMm * fgKg);
  }

  function pickByRange(ranges, powerFactor){
    return (Array.isArray(ranges) ? ranges : []).find(r => powerFactor >= r.min && powerFactor <= r.max) || null;
  }

  function allowMoreLiftsIfPossible(powerFactor, maxFor2){
    if(powerFactor <= maxFor2) return { ok:true, qty:2, tone:'' };
    if(powerFactor <= Math.round(maxFor2 * 1.5)) return { ok:true, qty:3, tone:'orange' };
    if(powerFactor <= Math.round(maxFor2 * 2.0)) return { ok:true, qty:4, tone:'orange' };
    return { ok:false, qty:0, tone:'red', need: Math.max(2, Math.ceil((powerFactor / maxFor2) * 2)) };
  }

  ns.frontHardwareAventosCalc = {
    estimateFlapWeightKg,
    blumAventosPowerFactor,
    pickByRange,
    allowMoreLiftsIfPossible
  };
})();
