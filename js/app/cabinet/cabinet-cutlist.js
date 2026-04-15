(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function getMaterialCommon(){
    return FC.materialCommon || {};
  }

  function getFrontHardware(){
    return FC.frontHardware || {};
  }

  function boardThicknessCm(){
    const common = getMaterialCommon();
    return Number(common.FC_BOARD_THICKNESS_CM)
      || Number(window.FC_BOARD_THICKNESS_CM)
      || 1.8;
  }

  function topTraverseDepthCm(){
    const common = getMaterialCommon();
    return Number(common.FC_TOP_TRAVERSE_DEPTH_CM)
      || Number(window.FC_TOP_TRAVERSE_DEPTH_CM)
      || 9;
  }

  function fmt(v){
    const common = getMaterialCommon();
    if(common && typeof common.fmtCm === 'function') return common.fmtCm(v);
    if(typeof window.fmtCm === 'function') return window.fmtCm(v);
    const n = Number(v);
    return Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : String(v ?? '');
  }

  function getFrontParts(room, cab){
    const hardware = getFrontHardware();
    if(hardware && typeof hardware.getCabinetFrontCutListForMaterials === 'function'){
      return hardware.getCabinetFrontCutListForMaterials(room, cab) || [];
    }
    if(typeof window.getCabinetFrontCutListForMaterials === 'function'){
      return window.getCabinetFrontCutListForMaterials(room, cab) || [];
    }
    return [];
  }

  function getHingeCount(room, cab){
    const hardware = getFrontHardware();
    if(hardware && typeof hardware.getHingeCountForCabinet === 'function'){
      return Number(hardware.getHingeCountForCabinet(room, cab)) || 0;
    }
    if(typeof window.getHingeCountForCabinet === 'function'){
      return Number(window.getHingeCountForCabinet(room, cab)) || 0;
    }
    return 0;
  }

  function getAventosInfo(cab, room){
    const hardware = getFrontHardware();
    if(hardware && typeof hardware.getBlumAventosInfo === 'function'){
      return hardware.getBlumAventosInfo(cab, room) || null;
    }
    if(typeof window.getBlumAventosInfo === 'function'){
      return window.getBlumAventosInfo(cab, room) || null;
    }
    return null;
  }

  function getCabinetCutList(cab, room){
    const t = boardThicknessCm();
    const topTraverseDepth = topTraverseDepthCm();
    const w = Number(cab && cab.width) || 0;
    const h = Number(cab && cab.height) || 0;
    const d = Number(cab && cab.depth) || 0;
    const bodyMat = cab && cab.bodyColor || 'laminat';
    const backMatRaw = cab && cab.backMaterial || 'HDF';
    const backMat = (String(backMatRaw).trim().toLowerCase() === 'brak' || String(backMatRaw).trim() === '— brak —') ? '' : backMatRaw;

    const subType = String(cab && cab.subType || '');
    const isUnderCounterWall = (String(cab && cab.type || '') === 'wisząca' && subType === 'dolna_podblatowa');
    const effType = isUnderCounterWall ? 'stojąca' : String(cab && cab.type || '');

    const hasBack = !(isUnderCounterWall && String((cab && cab.details || {}).hasBack) === '0');

    const parts = [];

    const sideH = (effType === 'stojąca' && !isUnderCounterWall) ? Math.max(0, h - t) : h;
    parts.push({ name:'Bok', qty:2, a: sideH, b: d, dims:`${fmt(sideH)} × ${fmt(d)}`, material: bodyMat });

    if(String(cab && cab.subType || '') === 'narozna_l'){
      parts.pop();

      const det = cab && cab.details || {};
      const GL = Number(det.gl) || 0;
      const GP = Number(det.gp) || 0;
      const ST = Number(det.st) || 0;
      const SP = Number(det.sp) || 0;

      const bigDepth = (GL > 0 ? GL : (ST > 0 ? ST : d));
      const smallDepth = (GP > 0 ? GP : Math.max(0, Math.min(bigDepth, d)));
      const blindDepth = Math.max(0, SP - t);

      parts.push({ name:'Bok duży', qty:1, a: sideH, b: bigDepth, dims:`${fmt(sideH)} × ${fmt(bigDepth)}`, material: bodyMat });
      parts.push({ name:'Bok mały', qty:1, a: sideH, b: smallDepth, dims:`${fmt(sideH)} × ${fmt(smallDepth)}`, material: bodyMat });

      if(blindDepth > 0){
        parts.push({ name:'Bok zaślepiający', qty:1, a: sideH, b: blindDepth, dims:`${fmt(sideH)} × ${fmt(blindDepth)}`, material: bodyMat });
      }
    }

    const wIn = Math.max(0, w - 2*t);

    if(effType === 'wisząca' && String(cab && cab.subType || '') === 'rogowa_slepa'){
      const blind = Math.max(0, Number(cab && cab.details && cab.details.blindPart) || 0);
      const zA = Math.max(0, blind - (t + 9));
      const zB = h;
      if(zA > 0 && zB > 0){
        parts.push({ name:'Zaślepka', qty:1, a:zA, b:zB, dims:`${fmt(zA)} × ${fmt(zB)}`, material: bodyMat });
      }

      const fMat = cab && cab.frontMaterial || 'laminat';
      const fCol = cab && cab.frontColor || '';
      const frontMatKey = `Front: ${fMat}${fCol ? ` • ${fCol}` : ''}`;
      parts.push({ name:'Blenda', qty:1, a:15, b:h, dims:`${fmt(15)} × ${fmt(h)}`, material: frontMatKey });
    }

    if(effType === 'wisząca' || effType === 'moduł'){
      const crownDepth = (effType === 'wisząca') ? Math.max(0, d - 2) : d;
      parts.push({ name:'Wieniec górny', qty:1, a:wIn, b:crownDepth, dims:`${fmt(wIn)} × ${fmt(crownDepth)}`, material: bodyMat });
      parts.push({ name:'Wieniec dolny', qty:1, a:wIn, b:crownDepth, dims:`${fmt(wIn)} × ${fmt(crownDepth)}`, material: bodyMat });
    }

    if(effType === 'stojąca'){
      if(isUnderCounterWall){
        parts.push({ name:'Wieniec dolny', qty:1, a:wIn, b:d, dims:`${fmt(wIn)} × ${fmt(d)}`, material: bodyMat });
      } else {
        parts.push({ name:'Wieniec dolny', qty:1, a:w, b:d, dims:`${fmt(w)} × ${fmt(d)}`, material: bodyMat });
      }

      parts.push({ name:`Trawers górny (${fmt(topTraverseDepth)} cm)`, qty:2, a:wIn, b:topTraverseDepth, dims:`${fmt(wIn)} × ${fmt(topTraverseDepth)}`, material: bodyMat });
    }

    const shelves = parseInt((cab && cab.details && cab.details.shelves) ?? 0, 10);
    const isStandingDrawerCabinet = (effType === 'stojąca' && String(cab && cab.subType || '') === 'szuflady');
    if(!isStandingDrawerCabinet && Number.isFinite(shelves) && shelves > 0){
      let shelfDepth = d;
      if(effType === 'stojąca' || effType === 'moduł') shelfDepth = Math.max(0, d - 0.5);
      if(effType === 'wisząca') shelfDepth = Math.max(0, (d - 2) - 0.5);
      parts.push({ name:'Półka', qty:shelves, a:wIn, b:shelfDepth, dims:`${fmt(wIn)} × ${fmt(shelfDepth)}`, material: bodyMat });
    }

    if(backMat && hasBack){
      let backW = w;
      let backH = h;
      if(effType === 'stojąca' || effType === 'moduł'){
        backW = Math.max(0, w - 0.5);
        backH = Math.max(0, h - 0.5);
      }
      if(effType === 'wisząca'){
        backW = Math.max(0, wIn + 2);
        backH = Math.max(0, h - 0.5);
      }
      parts.push({ name:'Plecy', qty:1, a:backW, b:backH, dims:`${fmt(backW)} × ${fmt(backH)}`, material: backMat });
    }

    getFrontParts(room, cab).forEach((p)=> parts.push(p));

    let hingeQty = getHingeCount(room, cab);
    try{
      const det = cab && cab.details || {};
      const isHKXS = (String(cab && cab.subType || '') === 'uchylne'
        && String(det.flapVendor || 'blum') === 'blum'
        && String(det.flapKind || 'HK-XS') === 'HK-XS');
      if(isHKXS) hingeQty = 0;
    }catch(_){ }

    if(hingeQty > 0){
      parts.push({ name:'Zawias BLUM', qty:hingeQty, a:0, b:0, dims:'—', material:'Okucia: zawiasy BLUM' });
    }

    if(String(cab && cab.subType || '') === 'uchylne'){
      const info = getAventosInfo(cab, room);
      if(info && (!info.status || info.status === 'ok' || info.status === 'needs_more_lifts')){
        const nameSuffix = (info.model ? ` ${info.model}` : '');
        const strengthSuffix = (info.strength ? ` (${info.strength})` : '');
        const rangeTxt = (info.rangeStr
          ? (String(info.rangeStr).includes('kg') ? `zakres wagi ${info.rangeStr}` : `zakres LF ${info.rangeStr}`)
          : 'zakres —');
        const qtyLift = (info.liftQty && info.liftQty > 0) ? info.liftQty : 2;
        parts.push({
          name:`Podnośnik BLUM AVENTOS ${info.label}${nameSuffix}${strengthSuffix}`,
          qty: qtyLift,
          a:0, b:0,
          dims:`LF=${info.powerFactor} • ${rangeTxt}${(info.status === 'needs_more_lifts' ? ` • UWAGA: przyjęto ${qtyLift} szt.` : '')}`,
          material:'Okucia: podnośniki BLUM'
        });

        if(info.status === 'needs_more_lifts') parts[parts.length-1].tone = 'orange';

        if(info.hkxsHinges && info.hkxsHinges > 0){
          parts.push({ name:'Zawias BLUM (HK‑XS)', qty:info.hkxsHinges, a:0, b:0, dims:'—', material:'Okucia: zawiasy BLUM' });
        }
      }
    }

    return parts;
  }

  window.FC.cabinetCutlist = window.FC.cabinetCutlist || {};
  window.FC.cabinetCutlist.getCabinetCutList = getCabinetCutList;
})();
