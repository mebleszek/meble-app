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


  function cmLike(value){
    const n = Math.max(0, Number(value) || 0);
    return n > 1000 ? n / 10 : n;
  }

  function roomSettings(room){
    if(room && typeof room === 'object' && room.settings) return room.settings || {};
    const key = String(room || '').trim();
    try{ if(key && window.projectData && window.projectData[key] && window.projectData[key].settings) return window.projectData[key].settings || {}; }catch(_){ }
    try{ if(key && FC.projectData && FC.projectData[key] && FC.projectData[key].settings) return FC.projectData[key].settings || {}; }catch(_){ }
    return {};
  }


  function heightIncludesLegs(cab){
    const det = cab && cab.details && typeof cab.details === 'object' ? cab.details : {};
    const raw = det.heightIncludesLegs;
    if(raw === false || raw === 0) return false;
    const txt = String(raw == null ? '' : raw).trim().toLowerCase();
    if(['0','false','nie','no','off'].includes(txt)) return false;
    return true;
  }


  function standingLegHeightCm(cab, room){
    const det = cab && cab.details && typeof cab.details === 'object' ? cab.details : {};
    const direct = det.legHeightCm != null && String(det.legHeightCm).trim() !== '' ? cmLike(det.legHeightCm) : null;
    if(direct != null) return direct;
    const s = roomSettings(room);
    return cmLike(s && s.legHeight);
  }

  function bodyHeightCm(cab, room, effType, isUnderCounterWall){
    const h = cmLike(cab && cab.height);
    if(effType === 'stojąca' && !isUnderCounterWall && heightIncludesLegs(cab)){
      const leg = standingLegHeightCm(cab, room);
      return Math.max(0, h - leg);
    }
    return h;
  }

  // One millimetre-based source for standard drawer fronts and their group roles.
  function resolveDrawerFrontGeometry(cab, room){
    const layout=String(cab && cab.details && cab.details.drawerLayout || '3_1_2_2');
    const rawBodyHeightMm=bodyHeightCm(cab,room,cab && cab.type,false)*10;
    const bodyHeightMm=Math.round(rawBodyHeightMm);
    const widthMm=Math.round(cmLike(cab && cab.width)*10);
    const failure=(code,message)=>({ok:false,code,message,layout,bodyHeightMm,panels:[]});
    if(!(Number.isFinite(widthMm) && Number.isFinite(bodyHeightMm) && widthMm>0 && bodyHeightMm>0)) return failure('invalid_cabinet_dimensions','Podaj dodatnią szerokość i wysokość korpusu.');
    let heights;
    if(layout==='3_1_2_2'){
      const small=bodyHeightMm-581; // 7 mm total clearance + two 4 mm gaps + two 283 mm fronts.
      if(small<=0) return failure('body_too_short','Dla układu 1 mała + 2 duże wysokość korpusu musi przekraczać 581 mm.');
      heights=[small,283,283];
    }else{
      const count={ '1_big':1,'2_equal':2,'3_equal':3,'5_equal':5 }[layout];
      if(!Number.isInteger(count)) return failure('unsupported_drawer_layout','Nieznany standardowy układ szuflad. Wybierz obsługiwany układ.');
      // Preserve the existing cabinet-fronts rounding and final panel correction.
      const equal=Math.round(rawBodyHeightMm/count);
      heights=Array(count-1).fill(equal).concat(Math.round(rawBodyHeightMm-equal*(count-1)));
      if(heights.some(height=>height<=0)) return failure('body_too_short','Wysokość korpusu jest zbyt mała dla wybranego układu szuflad.');
    }
    return {ok:true,layout,bodyHeightMm,gapMm:layout==='3_1_2_2'?4:0,totalClearanceMm:layout==='3_1_2_2'?7:0,
      panels:heights.map((heightMm,index)=>({widthMm,heightMm,groupRoleId:layout==='3_1_2_2'
        ? (index===0?'front.drawer.small':'front.drawer.large') : 'front.drawer.standard'}))};
  }

  function requireDrawerFrontGeometry(cab,room){
    const result=resolveDrawerFrontGeometry(cab,room);
    if(!result.ok){
      const error=new Error(result.message);error.code='INVALID_DRAWER_FRONT_GEOMETRY';throw error;
    }
    return result;
  }


  function fmt(v){
    const common = getMaterialCommon();
    if(common && typeof common.fmtCm === 'function') return common.fmtCm(v);
    if(typeof window.fmtCm === 'function') return window.fmtCm(v);
    const n = Number(v);
    return Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : String(v ?? '');
  }

  function getFrontParts(room, cab){
    try{
      const hardware = getFrontHardware();
      if(hardware && typeof hardware.getCabinetFrontPartsForLocalDraft === 'function'){
        return hardware.getCabinetFrontPartsForLocalDraft(room,cab) || [];
      }
      if(hardware && typeof hardware.getCabinetFrontCutListForMaterials === 'function'){
        return hardware.getCabinetFrontCutListForMaterials(room, cab) || [];
      }
      if(typeof window.getCabinetFrontCutListForMaterials === 'function'){
        return window.getCabinetFrontCutListForMaterials(room, cab) || [];
      }
    }catch(error){ if(error && error.code==='INVALID_DRAWER_FRONT_GEOMETRY') throw error; }
    return [];
  }

  function getHingeCount(room, cab){
    try{
      const hardware = getFrontHardware();
      if(hardware && typeof hardware.getHingeCountForCabinet === 'function'){
        return Number(hardware.getHingeCountForCabinet(room, cab)) || 0;
      }
      if(typeof window.getHingeCountForCabinet === 'function'){
        return Number(window.getHingeCountForCabinet(room, cab)) || 0;
      }
    }catch(_){ }
    return 0;
  }

  function getHardwareRequirements(){
    return FC.cabinetHardwareRequirements || {};
  }

  function getDrawerRequirements(room, cab){
    try{
      const api = FC.cabinetDrawerRequirements;
      if(api && typeof api.getDrawerRequirementsWithQty === 'function') return api.getDrawerRequirementsWithQty(room, cab) || [];
      if(api && typeof api.getDrawerRequirements === 'function') return api.getDrawerRequirements(room, cab) || [];
    }catch(_){ }
    return [];
  }

  function safeRoundCm(value, fallback){
    const n = Number(value);
    if(!Number.isFinite(n) || n <= 0) return fallback || 0;
    return Math.round(n * 10) / 10;
  }

  function addDrawerHardwareAndBoxParts(parts, room, cab, dims){
    const reqs = getDrawerRequirements(room, cab);
    if(!Array.isArray(reqs) || !reqs.length) return;
    const bodyMat = cab && cab.bodyColor || 'laminat';
    const wIn = Number(dims && dims.wIn) || 0;
    const d = Number(dims && dims.depth) || 0;
    const sideThicknessCm = 1.8;
    const runnerClearanceCm = 2.6;
    const boxOuterWidth = Math.max(0, safeRoundCm(wIn - runnerClearanceCm, wIn));
    const boxDepth = Math.max(25, Math.min(55, Math.floor(Math.max(0, d - 5) / 5) * 5 || Math.max(0, d - 5)));
    const boxHeight = 12;
    const backWidth = Math.max(0, safeRoundCm(boxOuterWidth - 2 * sideThicknessCm, boxOuterWidth));
    const bottomMaterial = `Dno szuflad 10 mm: ${bodyMat}`;

    reqs.forEach((req)=>{
      const qty = Math.max(0, Math.round(Number(req && req.qty) || 0));
      if(qty <= 0) return;
      const tech = req && req.technical && typeof req.technical === 'object' ? req.technical : {};
      const label = tech.systemLabel || req.label || 'Szuflada / prowadnice';
      const material = tech.drawerKind === 'box' ? 'Okucia: prowadnice szuflad skrzynkowych' : 'Okucia: system szuflady';
      parts.push({
        name: label,
        qty,
        a:0, b:0,
        dims: tech.drawerKind === 'box' ? 'same prowadnice' : 'wg specyfikacji producenta',
        material,
        hardwareRequirement:req || null
      });
      if(tech.drawerKind !== 'box') return;
      const group = 'Szuflady skrzynkowe';
      const sourceLabel = req.label ? ` — ${req.label}` : '';
      const knownSource=!req.explicit && ['front_drawers','inner_drawers','sink_front_drawer','sink_inner_drawers','oven_drawer','under_counter_front_drawers','under_counter_inner_drawers'].includes(req.source)
        && reqs.filter(item=>item.source===req.source).length===1;
      const singleton=knownSource && qty===1 && ['sink_front_drawer','oven_drawer'].includes(req.source);
      const drawerSource=(roles)=>singleton ? {partRoleIds:roles.map(role=>'drawer.'+req.source+'.'+role)}
        : knownSource ? {sourceGroupRoles:[{ownerType:'cabinet',groupRoleId:'drawer.'+req.source+'.'+(roles.length===2?'sides':roles[0]),qty:qty*roles.length}]}
        : {sourceFamily:'drawer.'+String(req.source||'manual'),sourceReason:'ambiguous_drawer_requirement'};
      parts.push({ name:'Bok szuflady skrzynkowej' + sourceLabel, group, ...drawerSource(['side.left','side.right']), qty:qty * 2, a:boxDepth, b:boxHeight, dims:`${fmt(boxDepth)} × ${fmt(boxHeight)}`, material:bodyMat, materialThicknessMm:18 });
      parts.push({ name:'Tył szuflady skrzynkowej' + sourceLabel, group, ...drawerSource(['back']), qty, a:backWidth, b:boxHeight, dims:`${fmt(backWidth)} × ${fmt(boxHeight)}`, material:bodyMat, materialThicknessMm:18 });
      parts.push({ name:'Dno szuflady skrzynkowej 10 mm' + sourceLabel, group, ...drawerSource(['bottom']), qty, a:boxOuterWidth, b:boxDepth, dims:`${fmt(boxOuterWidth)} × ${fmt(boxDepth)}`, material:bottomMaterial, materialThicknessMm:10, pcvEligible:false });
      if(tech.hasConstructionFront){
        parts.push({ name:'Przód konstrukcyjny szuflady skrzynkowej' + sourceLabel, group, ...drawerSource(['construction-front']), qty, a:backWidth, b:boxHeight, dims:`${fmt(backWidth)} × ${fmt(boxHeight)}`, material:bodyMat, materialThicknessMm:18 });
      }
    });
  }

  function getAventosInfo(cab, room){
    try{
      const hardware = getFrontHardware();
      if(hardware && typeof hardware.getBlumAventosInfo === 'function'){
        return hardware.getBlumAventosInfo(cab, room) || null;
      }
      if(typeof window.getBlumAventosInfo === 'function'){
        return window.getBlumAventosInfo(cab, room) || null;
      }
    }catch(_){ }
    return null;
  }

  function getCabinetCutList(cab, room, sourceContext){
    if(cab && (cab.type==='stojąca'||cab.type==='moduł') && cab.subType==='szuflady') requireDrawerFrontGeometry(cab,room);
    const provenance=FC.partProvenance;
    const owner=provenance ? provenance.context(cab,room,sourceContext) : null;
    // Front generation may adjust working counts; never mutate the source cabinet on read.
    cab=Object.assign({},cab,{details:Object.assign({},cab&&cab.details)});
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
    const bodyH = bodyHeightCm(cab, room, effType, isUnderCounterWall);

    const parts = [];

    const sideH = (effType === 'stojąca' && !isUnderCounterWall) ? Math.max(0, bodyH - t) : bodyH;
    parts.push({ name:'Bok', partRoleIds:['body.side.left','body.side.right'], qty:2, a: sideH, b: d, dims:`${fmt(sideH)} × ${fmt(d)}`, material: bodyMat });

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

      parts.push({ name:'Bok duży', partRoleIds:['body.corner.gl-side'], qty:1, a: sideH, b: bigDepth, dims:`${fmt(sideH)} × ${fmt(bigDepth)}`, material: bodyMat });
      parts.push({ name:'Bok mały', partRoleIds:['body.corner.gp-side'], qty:1, a: sideH, b: smallDepth, dims:`${fmt(sideH)} × ${fmt(smallDepth)}`, material: bodyMat });

      if(blindDepth > 0){
        parts.push({ name:'Bok zaślepiający', partRoleIds:['body.corner.blind-side'], qty:1, a: sideH, b: blindDepth, dims:`${fmt(sideH)} × ${fmt(blindDepth)}`, material: bodyMat });
      }
    }

    const wIn = Math.max(0, w - 2*t);

    if(effType === 'wisząca' && String(cab && cab.subType || '') === 'rogowa_slepa'){
      const blind = Math.max(0, Number(cab && cab.details && cab.details.blindPart) || 0);
      const zA = Math.max(0, blind - (t + 9));
      const zB = bodyH;
      if(zA > 0 && zB > 0){
        parts.push({ name:'Zaślepka', partRoleIds:['body.blind-panel'], qty:1, a:zA, b:zB, dims:`${fmt(zA)} × ${fmt(zB)}`, material: bodyMat });
      }

      const fMat = cab && cab.frontMaterial || 'laminat';
      const fCol = cab && cab.frontColor || '';
      const frontMatKey = `Front: ${fMat}${fCol ? ` • ${fCol}` : ''}`;
      parts.push({ name:'Blenda', partRoleIds:['body.blend'], qty:1, a:15, b:bodyH, dims:`${fmt(15)} × ${fmt(h)}`, material: frontMatKey });
    }

    if(effType === 'wisząca' || effType === 'moduł'){
      const crownDepth = (effType === 'wisząca') ? Math.max(0, d - 2) : d;
      parts.push({ name:'Wieniec górny', partRoleIds:['body.top'], qty:1, a:wIn, b:crownDepth, dims:`${fmt(wIn)} × ${fmt(crownDepth)}`, material: bodyMat });
      parts.push({ name:'Wieniec dolny', partRoleIds:['body.bottom'], qty:1, a:wIn, b:crownDepth, dims:`${fmt(wIn)} × ${fmt(crownDepth)}`, material: bodyMat });
    }

    if(effType === 'stojąca'){
      if(isUnderCounterWall){
        parts.push({ name:'Wieniec dolny', partRoleIds:['body.bottom'], qty:1, a:wIn, b:d, dims:`${fmt(wIn)} × ${fmt(d)}`, material: bodyMat });
      } else {
        parts.push({ name:'Wieniec dolny', partRoleIds:['body.bottom'], qty:1, a:w, b:d, dims:`${fmt(w)} × ${fmt(d)}`, material: bodyMat });
      }

      parts.push({ name:`Trawers górny (${fmt(topTraverseDepth)} cm)`, partRoleIds:['body.top-traverse.a','body.top-traverse.b'], qty:2, a:wIn, b:topTraverseDepth, dims:`${fmt(wIn)} × ${fmt(topTraverseDepth)}`, material: bodyMat });
    }

    const shelves = parseInt((cab && cab.details && cab.details.shelves) ?? 0, 10);
    const isStandingDrawerCabinet = (effType === 'stojąca' && String(cab && cab.subType || '') === 'szuflady');
    if(!isStandingDrawerCabinet && Number.isFinite(shelves) && shelves > 0){
      let shelfDepth = d;
      if(effType === 'stojąca' || effType === 'moduł') shelfDepth = Math.max(0, d - 0.5);
      if(effType === 'wisząca') shelfDepth = Math.max(0, (d - 2) - 0.5);
      parts.push({ name:'Półka', sourceGroupRoles:[{ownerType:'cabinet',groupRoleId:'body.shelves',qty:shelves}], qty:shelves, a:wIn, b:shelfDepth, dims:`${fmt(wIn)} × ${fmt(shelfDepth)}`, material: bodyMat });
    }

    if(backMat && hasBack){
      let backW = w;
      let backH = bodyH;
      if(effType === 'stojąca' || effType === 'moduł'){
        backW = Math.max(0, w - 0.5);
        backH = Math.max(0, bodyH - 0.5);
      }
      if(effType === 'wisząca'){
        backW = Math.max(0, wIn + 2);
        backH = Math.max(0, bodyH - 0.5);
      }
      parts.push({ name:'Plecy', partRoleIds:['body.back'], qty:1, a:backW, b:backH, dims:`${fmt(backW)} × ${fmt(backH)}`, material: backMat });
    }

    getFrontParts(room, cab).forEach((p)=> parts.push(p));

    addDrawerHardwareAndBoxParts(parts, room, cab, { wIn, depth:d });

    let hingeQty = getHingeCount(room, cab);
    try{
      const det = cab && cab.details || {};
      const isHKXS = (String(cab && cab.subType || '') === 'uchylne'
        && String(det.flapVendor || 'blum') === 'blum'
        && String(det.flapKind || 'HK-XS') === 'HK-XS');
      if(isHKXS) hingeQty = 0;
    }catch(_){ }

    if(hingeQty > 0){
      const reqApi = getHardwareRequirements();
      const reqs = reqApi && typeof reqApi.getHingeRequirementsWithQty === 'function'
        ? (reqApi.getHingeRequirementsWithQty(room, cab) || []).filter((req)=> req && req.kind === 'hinge' && (Number(req.qty) || 0) > 0)
        : [];
      if(reqs.length){
        reqs.forEach((req)=> {
          const qty = Math.max(0, Math.round(Number(req && req.qty) || 0));
          if(qty > 0){
            const suffix = req && req.doorLabel ? ' — ' + req.doorLabel : '';
            parts.push({ name:(req && req.label ? req.label : 'Zawias') + suffix, qty, a:0, b:0, dims:'—', material:'Okucia: komplet zawiasowy', hardwareRequirement:req || null });
          }
        });
      }else{
        const req = reqApi && typeof reqApi.getHingeRequirementWithQty === 'function' ? reqApi.getHingeRequirementWithQty(room, cab) : null;
        parts.push({ name:(req && req.label ? req.label : 'Komplet zawiasowy'), qty:hingeQty, a:0, b:0, dims:'—', material:'Okucia: komplet zawiasowy', hardwareRequirement:req || null });
      }
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
          const reqApi = getHardwareRequirements();
          const req = reqApi && typeof reqApi.getHingeRequirementWithQty === 'function' ? reqApi.getHingeRequirementWithQty(room, cab) : null;
          parts.push({ name:'Zawias 110° nakładany (HK‑XS)', qty:info.hkxsHinges, a:0, b:0, dims:'—', material:'Okucia: komplet zawiasowy', hardwareRequirement:req || null });
        }
      }
    }

    try{
      const reqApi = getHardwareRequirements();
      const isHafele = reqApi && typeof reqApi.isHafeleScissorFlap === 'function' && reqApi.isHafeleScissorFlap(cab);
      if(isHafele){
        const req = reqApi.getHingeRequirementWithQty(room, cab);
        const qty = Math.max(0, Math.round(Number(req && req.qty) || 0));
        if(qty > 0){
          parts.push({ name:'Zawias 110° nakładany (podnośnik nożycowy Häfele)', qty, a:0, b:0, dims:'—', material:'Okucia: komplet zawiasowy', hardwareRequirement:req || null });
        }
      }
    }catch(_){ }

    const supportApi = getHardwareRequirements();
    if(supportApi && typeof supportApi.getSupportRequirements === 'function'){
      supportApi.getSupportRequirements(room, cab).forEach(req=>parts.push({name:req.label,qty:req.qty,a:0,b:0,dims:'—',material:'Okucia: '+req.label,hardwareRequirement:req}));
    }
    return provenance ? provenance.bind(parts,owner) : parts;
  }

  window.FC.cabinetCutlist = window.FC.cabinetCutlist || {};
  window.FC.cabinetCutlist.getCabinetCutList = getCabinetCutList;
  window.FC.cabinetCutlist.resolveDrawerFrontGeometry = resolveDrawerFrontGeometry;
  window.FC.cabinetCutlist.requireDrawerFrontGeometry = requireDrawerFrontGeometry;
})();
