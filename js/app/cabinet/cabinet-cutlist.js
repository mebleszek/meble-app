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

  function getFrontParts(room, cab, sourceContext){
    try{
      const hardware = getFrontHardware();
      if(hardware && typeof hardware.getCabinetFrontPartsForLocalDraft === 'function'){
        return hardware.getCabinetFrontPartsForLocalDraft(room,cab,sourceContext) || [];
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
    const bottomChoice=FC.cabinetDrawerRequirements?.bottomMaterial(cab);
    const bottomRow=bottomChoice&&FC.catalogSelectors?.findSheetMaterial?.(bottomChoice.materialId);
    const bottomMaterial=bottomRow?.name||bottomChoice?.materialName||'Dno szuflad 10 mm — wybierz kolor';

    let innerOffset=0;
    reqs.forEach((req)=>{
      const qty = Math.max(0, Math.round(Number(req && req.qty) || 0));
      if(qty <= 0) return;
      const tech = req && req.technical && typeof req.technical === 'object' ? req.technical : {};
      const label = tech.systemLabel || req.label || 'Szuflada / prowadnice';
      const material = tech.drawerKind === 'box' ? 'Okucia: prowadnice szuflad skrzynkowych' : 'Okucia: system szuflady';
      const offset=innerOffset;if(tech.usage==='wewnętrzna')innerOffset+=qty;
      const knownSource=!req.explicit && ['front_drawers','inner_drawers','sink_front_drawer','sink_inner_drawers','oven_drawer','under_counter_front_drawers','under_counter_inner_drawers'].includes(req.source)
        && reqs.filter(item=>item.source===req.source).length===1;
      const singleton=knownSource && qty===1 && ['sink_front_drawer','oven_drawer'].includes(req.source);
      const drawerSource=(roles,count)=>singleton ? {partRoleIds:roles.map(role=>'drawer.'+req.source+'.'+role)}
        : knownSource ? {sourceGroupRoles:[{ownerType:'cabinet',groupRoleId:'drawer.'+req.source+'.'+(roles.length===2?'sides':roles[0]),qty:count*roles.length}]}
        : {sourceFamily:'drawer.'+String(req.source||'manual'),sourceReason:'ambiguous_drawer_requirement'};

      if(tech.drawerKind !== 'box'){
        const result=FC.cabinetDrawerSelection.frontsForRequirement(room,cab,req,offset);
        if(!result.ok||result.fronts.length!==qty)throw Object.assign(Error(result.code||'DRAWER_FRONT_HEIGHT_UNCONFIRMED'),{code:result.code||'DRAWER_FRONT_HEIGHT_UNCONFIRMED'});
        const choice=FC.cabinetDrawerRequirements.bottomMaterial(cab,16),row=choice&&FC.catalogSelectors?.findSheetMaterial?.(choice.materialId),panelMaterial=row?.name||choice?.materialName||'Płyta szuflad systemowych16 mm — wybierz kolor';
        for(const front of result.fronts){
          const fit={productKind:'system',family:tech.drawerSystemKey,usage:tech.usage,availableDepthMm:Math.round(d*10),frontHeightMm:front.heightMm,insideWidthMm:Math.round(wIn*10),motion:tech.usage!=='wewnętrzna'&&String(cab.openingSystem).toLowerCase()==='tip-on'?'push':'soft'};
          fit.minLoadKg=FC.cabinetDrawerSelection.requestedLoad(cab,tech.usage==='wewnętrzna');
          fit.forceMaxLoad=tech.usage!=='wewnętrzna'&&FC.cabinetDrawerSelection.isFullHeightSingle(room,cab);
          const selected=FC.cabinetDrawerSelection.systemForFront(fit);
          if(!selected.ok)throw Object.assign(Error(selected.code),{code:selected.code});
          fit.motion=selected.selected.motion;
          parts.push({name:label,qty:1,a:0,b:0,dims:selected.selected.sku,material,hardwareRequirement:{...req,qty:1,drawerFit:{...fit,selectedId:selected.selected.id,panelColor:choice?.v||null}}});
          if(selected.motionAddon){
            const addon=selected.motionAddon,label=({blum_merivobox:'MERIVOBOX',blum_legrabox:'LEGRABOX',blum_tandembox_antaro:'TANDEMBOX'})[addon.family]+' TIP-ON BLUMOTION '+addon.module;
            parts.push({name:label,qty:1,a:0,b:0,dims:'komplet modułu L+P',material:'Okucia: otwieranie szuflady',hardwareRequirement:{kind:'drawer-motion',hardwareGroup:'drawers',category:'Inne',catalogItemId:addon.id,expectedManufacturer:addon.manufacturer,expectedSymbol:addon.sku,expectedUnit:'kpl.',label,qty:1}});
          }
          const panels=selected.panels;
          parts.push({name:'Dno szuflady systemowej16 mm'+(panels.bottomProcessing?' — '+panels.bottomProcessing:''),group:'Szuflady systemowe',...drawerSource(['bottom'],1),qty:1,a:panels.bottomWidthMm/10,b:panels.bottomLengthMm/10,dims:fmt(panels.bottomWidthMm/10)+' × '+fmt(panels.bottomLengthMm/10),material:panelMaterial,materialThicknessMm:16,pcvEligible:false});
          parts.push({name:'Tył szuflady systemowej16 mm',group:'Szuflady systemowe',...drawerSource(['back'],1),qty:1,a:panels.backWidthMm/10,b:panels.backHeightMm/10,dims:fmt(panels.backWidthMm/10)+' × '+fmt(panels.backHeightMm/10),material:panelMaterial,materialThicknessMm:16,drawerConstructionRole:'crosspiece'});
        }
        return;
      }
      const group = 'Szuflady skrzynkowe';
      const sourceLabel = req.label ? ` — ${req.label}` : '';
      const inner=tech.usage==='wewnętrzna';
      const layout=inner?FC.cabinetInnerDrawers?.layout(room,cab):null;
      if(inner&&!layout?.ok)throw Object.assign(Error(layout?.code||'INNER_DRAWER_LAYOUT_UNCONFIRMED'),{code:layout?.code||'INNER_DRAWER_LAYOUT_UNCONFIRMED'});
      const fronts=FC.cabinetDrawerSelection.frontsForRequirement(room,cab,req,offset);
      if(!fronts.ok||fronts.fronts.length!==qty)throw Object.assign(Error(fronts.code||'DRAWER_FRONT_HEIGHT_UNCONFIRMED'),{code:fronts.code||'DRAWER_FRONT_HEIGHT_UNCONFIRMED'});
      for(const front of fronts.fronts){
        const n=1,section=front.section||FC.cabinetDrawerSelection.woodenSection({frontHeightMm:front.heightMm,inner});
        const geometry=FC.cabinetDrawerSelection.woodenGeometry({section,insideWidthMm:Math.round(wIn*10),availableDepthMm:Math.round(d*10),inner,manufacturer:tech.manufacturer||'Blum',series:tech.runnerSeries||'TANDEM BLUMOTION',motion:!inner&&String(cab.openingSystem).toLowerCase()==='tip-on'?'push':'soft',minLoadKg:FC.cabinetDrawerSelection.requestedLoad(cab,inner)});
        if(!geometry.ok)throw Object.assign(Error(geometry.code),{code:geometry.code});
        parts.push({name:geometry.series+' '+geometry.lengthMm+' mm',qty:1,a:0,b:0,dims:'komplet prowadnic L+P',material,
          hardwareRequirement:{...req,qty:1,drawerFit:{productKind:'runner',...geometry}}});
        const height=geometry.sideHeightMm/10,crossHeight=geometry.crosspieceHeightMm/10,boxDepth=geometry.sideLengthMm/10,backWidth=geometry.innerWidthMm/10;
        const construction=geometry.runnerType==='undermount';
        parts.push({name:'Bok szuflady skrzynkowej'+sourceLabel,group,...drawerSource(['side.left','side.right'],n),qty:2,a:boxDepth,b:height,dims:fmt(boxDepth)+' × '+fmt(height),material:bodyMat,materialThicknessMm:18,drawerConstructionRole:'side'});
        parts.push({name:'Tył szuflady skrzynkowej'+sourceLabel,group,...drawerSource(['back'],n),qty:n,a:backWidth,b:crossHeight,dims:fmt(backWidth)+' × '+fmt(crossHeight),material:bodyMat,materialThicknessMm:18,drawerConstructionRole:'crosspiece'});
        const bw=geometry.bottomWidthMm/10,bd=geometry.bottomLengthMm/10;
        parts.push({name:'Dno szuflady skrzynkowej '+geometry.bottomThicknessMm+' mm'+sourceLabel,group,...drawerSource(['bottom'],n),qty:n,a:bw,b:bd,dims:fmt(bw)+' × '+fmt(bd),material:construction?bottomMaterial:'HDF',materialThicknessMm:geometry.bottomThicknessMm,pcvEligible:false});
        if(inner){
          const w=front.frontWidthMm/10,h=front.heightMm/10;
          parts.push({name:'Front wewnętrzny szuflady skrzynkowej'+sourceLabel,group,...drawerSource(['inner-front'],n),qty:n,a:w,b:h,dims:fmt(w)+' × '+fmt(h),material:bodyMat,materialThicknessMm:18});
        }
        if(construction||tech.hasConstructionFront){
          parts.push({name:'Przód konstrukcyjny szuflady skrzynkowej'+sourceLabel,group,...drawerSource(['construction-front'],n),qty:n,a:backWidth,b:crossHeight,dims:fmt(backWidth)+' × '+fmt(crossHeight),material:bodyMat,materialThicknessMm:18,drawerConstructionRole:'crosspiece'});
        }
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

  // Owner's construction decision, 23.11.2026. Cabinet depth remains the
  // side length; usable depth and exterior depth are distinct derived values.
  function backGeometry(cab,room){
    const raw=String(cab?.backMaterial||'HDF').trim(),under=cab?.type==='wisząca'&&cab?.subType==='dolna_podblatowa';
    const type=under?'stojąca':cab?.type,sideDepthMm=Math.round(Number(cab?.depth)*10),t=boardThicknessCm();
    const bodyH=bodyHeightCm(cab,room,type,under),width=Number(cab?.width),insideWidth=Math.round((width-2*t)*10)/10;
    if(!(sideDepthMm>0&&width>0&&bodyH>0))return {ok:false,code:'BACK_DIMENSIONS_REQUIRED'};
    const material=/^(18\s*mm|płyta\s*18\s*mm)\s*pod\s*kolor(?:\s*korpusu)?$/i.test(raw)?String(cab?.bodyColor||''):raw;
    const base={material,sideDepthMm,usableDepthMm:sideDepthMm,overallDepthMm:sideDepthMm,backWidthCm:width,backHeightCm:bodyH};
    if(['brak','— brak —'].includes(raw.toLowerCase())||under&&String(cab?.details?.hasBack)==='0')return {...base,ok:true,kind:'none',materialThicknessMm:0};
    let row=null;try{row=FC.catalogSelectors?.findSheetMaterial?.(material)||null;}catch(_){}
    const hdf=/^hdf/i.test(raw)||String(row?.materialType).toLowerCase()==='hdf';
    if(hdf){
      const upper=type==='wisząca',hdfThickness=Number(row?.thicknessMm)||3;
      return {...base,ok:true,kind:'hdf',position:upper?'grooved':'external',materialThicknessMm:hdfThickness,
        usableDepthMm:sideDepthMm-(upper?20:0),overallDepthMm:sideDepthMm+(upper?0:hdfThickness),
        backWidthCm:Math.max(0,upper?insideWidth+2:width-.5),backHeightCm:Math.max(0,bodyH-.5)};
    }
    const board=String(row?.materialType).toLowerCase()==='laminat'||/laminat|płyta|plyta|18\s*mm/i.test(raw);
    if(!board||Number(row?.thicknessMm)>0&&Number(row.thicknessMm)!==18)return {...base,ok:false,kind:'unknown',code:'BACK_MATERIAL_UNCONFIRMED'};
    const position=cab?.details?.backPosition;
    if(!['internal','external'].includes(position))return {...base,ok:false,kind:'board',code:'BACK_POSITION_REQUIRED'};
    const internal=position==='internal';
    return {...base,ok:true,kind:'board',position,materialThicknessMm:18,
      usableDepthMm:sideDepthMm-(internal?18:0),overallDepthMm:sideDepthMm+(internal?0:18),
      backWidthCm:internal?insideWidth:width,backHeightCm:internal?Math.round((bodyH-2*t)*10)/10:bodyH};
  }

  function resolveInnerDrawerLayout(cab,room,count,options={}){
    const refusal=code=>({ok:false,code,fronts:[]});
    if(!Number.isSafeInteger(count)||count<1)return refusal('INNER_DRAWER_COUNT_INVALID');
    const under=cab?.type==='wisząca'&&cab?.subType==='dolna_podblatowa',type=under?'stojąca':cab?.type;
    const interiorHeightMm=Math.round((bodyHeightCm(cab,room,type,under)-2*boardThicknessCm())*10);
    const space=options.space||'cabinet',distribution=options.distribution||'equal';
    if(!['cabinet','custom'].includes(space)||!['equal','declared'].includes(distribution))return refusal('INNER_DRAWER_LAYOUT_INVALID');
    const availableHeightMm=space==='cabinet'?interiorHeightMm:Math.round(Number(options.spaceHeightCm)*10);
    if(!(availableHeightMm>0))return refusal('INNER_DRAWER_SPACE_REQUIRED');
    if(availableHeightMm>interiorHeightMm)return refusal('INNER_DRAWER_SPACE_EXCEEDED');
    // Owner: 5 mm below the first front, 30 mm BETWEEN consecutive fronts.
    const bottomGapMm=5,gapMm=30,forFronts=availableHeightMm-bottomGapMm-gapMm*(count-1);
    if(forFronts<count)return refusal('INNER_DRAWERS_DO_NOT_FIT');
    let heights;
    if(distribution==='equal'){
      const each=Math.floor(forFronts/count),remainder=forFronts%count;
      heights=Array.from({length:count},(_,i)=>each+(i<remainder?1:0));
    }else{
      if(!['front','inside'].includes(options.heightType||'front'))return refusal('INNER_DRAWER_LAYOUT_INVALID');
      if(!Array.isArray(options.heightsCm)||options.heightsCm.length!==count||options.heightsCm.some(h=>!(Number(h)>0&&Number.isFinite(Number(h)))))return refusal('INNER_DRAWER_HEIGHTS_REQUIRED');
      heights=options.heightsCm.map(h=>options.heightType==='inside'
        ? FC.cabinetDrawerSelection.woodenSection({insideHeightMm:Math.round(Number(h)*10)}).frontHeightMm
        : Math.round(Number(h)*10));
      if(heights.some(h=>h<1)||heights.reduce((n,h)=>n+h,0)>forFronts)return refusal('INNER_DRAWERS_DO_NOT_FIT');
    }
    if(heights.some(h=>h<=30))return refusal('INNER_DRAWER_HEIGHT_INVALID');
    const frontWidthMm=Math.round((Number(cab.width)-2*boardThicknessCm())*10)-8;
    if(!(frontWidthMm>0))return refusal('INNER_DRAWER_WIDTH_INVALID');
    let bottomMm=bottomGapMm;
    const fronts=heights.map((heightMm,index)=>{const section=FC.cabinetDrawerSelection.woodenSection({frontHeightMm:heightMm});const row={index,heightMm,frontWidthMm,insideHeightMm:section.insideHeightMm,boxSideHeightMm:section.sideHeightMm,boxOverallHeightMm:section.boxOverallHeightMm,section,bottomMm,topMm:bottomMm+heightMm};bottomMm=row.topMm+gapMm;return row;});
    if(fronts.some(f=>!f.section.ok))return refusal('INNER_DRAWER_HEIGHT_INVALID');
    return {ok:true,distribution,space,interiorHeightMm,availableHeightMm,bottomGapMm,gapMm,fronts,unusedHeightMm:availableHeightMm-fronts.at(-1).topMm};
  }

  function getCabinetCutList(cab, room, sourceContext){
    return room&&typeof room==='object'&&FC.workQuantityPrepared?.readParts
      ? FC.workQuantityPrepared.readParts(room,cab,sourceContext,(r,c,owner)=>calculateCabinetCutList(c,r,owner)) : calculateCabinetCutList(cab,room,sourceContext);
  }
  function calculateCabinetCutList(cab, room, sourceContext){
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
    const back=backGeometry(cab,room);
    if(!back.ok)throw Object.assign(new Error(back.code),{code:back.code});

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
      const crownDepth = back.kind==='hdf'&&effType==='wisząca' ? Math.max(0,d-2) : d;
      parts.push({ name:'Wieniec górny', partRoleIds:['body.top'], qty:1, a:wIn, b:crownDepth, dims:`${fmt(wIn)} × ${fmt(crownDepth)}`, material: bodyMat });
      parts.push({ name:'Wieniec dolny', partRoleIds:['body.bottom'], qty:1, a:wIn, b:crownDepth, dims:`${fmt(wIn)} × ${fmt(crownDepth)}`, material: bodyMat });
    }

    if(effType === 'stojąca'){
      if(isUnderCounterWall){
        parts.push({ name:'Wieniec dolny', partRoleIds:['body.bottom'], qty:1, a:wIn, b:d, dims:`${fmt(wIn)} × ${fmt(d)}`, material: bodyMat });
      } else {
        parts.push({ name:'Wieniec dolny', partRoleIds:['body.bottom'], qty:1, a:w, b:d, dims:`${fmt(w)} × ${fmt(d)}`, material: bodyMat });
      }

      if(FC.hardwareCargoCatalog?.requiresFullTop(cab))parts.push({name:'Wieniec górny',partRoleIds:['body.top'],qty:1,a:wIn,b:d,dims:`${fmt(wIn)} × ${fmt(d)}`,material:bodyMat});
      else parts.push({ name:`Trawers górny (${fmt(topTraverseDepth)} cm)`, partRoleIds:['body.top-traverse.a','body.top-traverse.b'], qty:2, a:wIn, b:topTraverseDepth, dims:`${fmt(wIn)} × ${fmt(topTraverseDepth)}`, material: bodyMat });
    }

    const shelves = parseInt((cab && cab.details && cab.details.shelves) ?? 0, 10);
    const isStandingDrawerCabinet = cab?.subType==='cargo'||(effType === 'stojąca' && String(cab && cab.subType || '') === 'szuflady');
    if(!isStandingDrawerCabinet && Number.isFinite(shelves) && shelves > 0){
      let shelfDepth = d;
      shelfDepth = Math.max(0,Math.round(back.usableDepthMm-5)/10);
      parts.push({ name:'Półka', sourceGroupRoles:[{ownerType:'cabinet',groupRoleId:'body.shelves',qty:shelves}], qty:shelves, a:wIn, b:shelfDepth, dims:`${fmt(wIn)} × ${fmt(shelfDepth)}`, material: bodyMat });
    }

    if(backMat && hasBack){
      const backW=back.backWidthCm,backH=back.backHeightCm;
      parts.push({name:back.kind==='board'?(back.position==='external'?'Plecy zewnętrzne 18 mm — PCV dookoła':'Plecy wewnętrzne 18 mm'):'Plecy',
        partRoleIds:['body.back'],qty:1,a:backW,b:backH,dims:fmt(backW)+' × '+fmt(backH),material:back.kind==='board'?back.material:backMat,
        ...(back.kind==='board'?{backPosition:back.position,materialThicknessMm:18}:{})});
    }

    const frontParts=getFrontParts(room,cab,sourceContext);
    frontParts.forEach(p=>parts.push(p));
    const openingApi=getHardwareRequirements();
    if(openingApi.getOpeningRequirements)openingApi.getOpeningRequirements(room,cab,frontParts).forEach(req=>parts.push({name:req.label,qty:req.qty,a:0,b:0,dims:'—',material:'Okucia: '+req.label,hardwareRequirement:req}));

    addDrawerHardwareAndBoxParts(parts, room, cab, { wIn, depth:back.usableDepthMm/10 });

    let hingeQty = cab?.subType==='cargo'?0:getHingeCount(room, cab);
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
      parts.push(...FC.hardwareLiftCatalog.parts(room,cab,info));
      if(info && (!info.status || info.status === 'ok' || info.status === 'needs_more_lifts')){
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
    if(cab?.subType==='cargo')parts.push(...FC.hardwareCargoCatalog.parts(room,cab));
    if(supportApi && typeof supportApi.getSupportRequirements === 'function'){
      supportApi.getSupportRequirements(room, cab).forEach(req=>parts.push({name:req.label,qty:req.qty,a:0,b:0,dims:'—',material:'Okucia: '+req.label,hardwareRequirement:req}));
    }
    return provenance ? provenance.bind(parts,owner) : parts;
  }

  window.FC.cabinetCutlist = window.FC.cabinetCutlist || {};
  window.FC.cabinetCutlist.getCabinetCutList = getCabinetCutList;
  window.FC.cabinetCutlist.backGeometry = backGeometry;
  window.FC.cabinetCutlist.interiorDimensions = function(cab,room){
    const back=backGeometry(cab,room),t=boardThicknessCm();if(!back.ok)return back;
    return {ok:true,widthMm:Math.round((Number(cab.width)-2*t)*10),heightMm:Math.round((bodyHeightCm(cab,room,cab.type,false)-2*t)*10),depthMm:back.usableDepthMm};
  };
  window.FC.cabinetCutlist.resolveInnerDrawerLayout = resolveInnerDrawerLayout;
  window.FC.cabinetCutlist.resolveDrawerFrontGeometry = resolveDrawerFrontGeometry;
  window.FC.cabinetCutlist.requireDrawerFrontGeometry = requireDrawerFrontGeometry;
})();
