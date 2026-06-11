// js/app/pricing/work-quantity-facts.js
// Read-only adapter: istniejąca szafka z WYWIADU -> nazwane źródła danych do czynności i wyceny.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  function round(value, digits){
    const d = Math.max(0, Math.round(Number(digits) || 0));
    const m = Math.pow(10, d);
    return Math.round((Number(value) || 0) * m) / m;
  }
  function clone(value){
    try{ if(FC.utils && typeof FC.utils.clone === 'function') return FC.utils.clone(value); }catch(_){ }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }
  function details(cabinet){
    return cabinet && cabinet.details && typeof cabinet.details === 'object' ? cabinet.details : {};
  }
  function cmLike(value){
    const n = Math.max(0, number(value, 0));
    // Aktualny WYWIAD trzyma cm; zabezpieczenie pod przyszłe mm.
    return n > 1000 ? n / 10 : n;
  }
  function mmFromCmLike(value){ return Math.round(cmLike(value) * 10); }
  function volumeM3(cabinet){
    const w = cmLike(cabinet && cabinet.width);
    const h = cmLike(cabinet && cabinet.height);
    const d = cmLike(cabinet && cabinet.depth);
    return (w > 0 && h > 0 && d > 0) ? round((w / 100) * (h / 100) * (d / 100), 4) : 0;
  }
  function sourceInfo(code){
    try{
      const api = FC.workQuantitySources;
      return api && typeof api.find === 'function' ? api.find(code) : null;
    }catch(_){ return null; }
  }
  function makeFact(code, value, options){
    const src = sourceInfo(code) || { code, label:code, unit:'—', status:'system', calculation:'' };
    const opts = options && typeof options === 'object' ? options : {};
    const hasValue = opts.hasValue !== false && value !== undefined && value !== null && value !== '';
    return {
      code,
      label:text(src.label) || code,
      unit:text(src.unit || '—') || '—',
      group:text(src.group || 'Inne') || 'Inne',
      sourceStatus:text(src.status || 'system') || 'system',
      calculation:text(src.calculation),
      value:hasValue ? value : null,
      displayValue:hasValue ? text(opts.displayValue != null ? opts.displayValue : value) : text(opts.emptyText || 'brak'),
      available:!!hasValue,
      source:text(opts.source || 'cabinet'),
      warning:text(opts.warning || '')
    };
  }
  function frontHardware(){ return FC.frontHardware || {}; }
  function hardwareRequirements(){ return FC.cabinetHardwareRequirements || {}; }
  function drawerRequirements(){ return FC.cabinetDrawerRequirements || {}; }
  function applianceRules(){ return FC.laborApplianceRules || {}; }

  function getFrontParts(roomId, cabinet){
    try{
      const hw = frontHardware();
      if(hw && typeof hw.getCabinetFrontCutListForMaterials === 'function'){
        const safeCabinet = clone(cabinet || {});
        return (hw.getCabinetFrontCutListForMaterials(roomId, safeCabinet) || [])
          .filter((part)=> text(part && part.name).toLowerCase() === 'front');
      }
    }catch(_){ }
    return [];
  }
  function frontQty(part){ return Math.max(0, Math.round(number(part && part.qty, 0))); }
  function frontCountFromParts(parts){
    return (Array.isArray(parts) ? parts : []).reduce((sum, part)=> sum + frontQty(part), 0);
  }
  function frontCountFallback(cabinet){
    const n = Math.max(0, Math.round(number(cabinet && cabinet.frontCount, 0)));
    return n;
  }
  function frontDimensionsFromParts(parts){
    const rows = [];
    (Array.isArray(parts) ? parts : []).forEach((part)=> {
      const qty = frontQty(part);
      if(!(qty > 0)) return;
      const dims = text(part && part.dims) || [part && part.a, part && part.b].map((v)=> number(v, 0)).join(' × ');
      rows.push(`${qty} × ${dims}`);
    });
    return rows.join(', ');
  }
  function frontAreaM2(parts){
    return round((Array.isArray(parts) ? parts : []).reduce((sum, part)=> {
      const qty = frontQty(part);
      const a = cmLike(part && part.a);
      const b = cmLike(part && part.b);
      return sum + (qty > 0 && a > 0 && b > 0 ? qty * (a / 100) * (b / 100) : 0);
    }, 0), 4);
  }

  function getHingeRows(roomId, cabinet){
    try{
      const api = hardwareRequirements();
      if(api && typeof api.getHingeRequirementsWithQty === 'function'){
        const safeCabinet = clone(cabinet || {});
        return (api.getHingeRequirementsWithQty(roomId, safeCabinet) || [])
          .filter((req)=> req && req.kind === 'hinge');
      }
    }catch(_){ }
    return [];
  }
  function hingeCount(rows){
    return (Array.isArray(rows) ? rows : []).reduce((sum, req)=> sum + Math.max(0, Math.round(number(req && req.qty, 0))), 0);
  }
  function hingeRequirementLabel(rows){
    const labels = [];
    (Array.isArray(rows) ? rows : []).forEach((req)=> {
      const qty = Math.max(0, Math.round(number(req && req.qty, 0)));
      const label = text(req && (req.doorLabel ? `${req.doorLabel}: ${req.label || ''}` : req.label));
      if(qty > 0 && label) labels.push(`${qty} × ${label}`);
    });
    return labels.join(', ');
  }

  function shelfCount(cabinet){
    const d = details(cabinet);
    const candidates = [d.shelves, d.shelfCount, cabinet && cabinet.shelves, cabinet && cabinet.shelfCount];
    for(const value of candidates){
      const n = Math.max(0, Math.floor(number(value, 0)));
      if(n > 0) return n;
    }
    return 0;
  }
  function getDrawerRows(roomId, cabinet){
    try{
      const api = drawerRequirements();
      if(api && typeof api.getDrawerRequirementsWithQty === 'function'){
        const safeCabinet = clone(cabinet || {});
        return (api.getDrawerRequirementsWithQty(roomId, safeCabinet) || [])
          .filter((req)=> req && req.kind === 'drawer');
      }
      if(api && typeof api.getDrawerRequirements === 'function'){
        const safeCabinet = clone(cabinet || {});
        return (api.getDrawerRequirements(roomId, safeCabinet) || [])
          .filter((req)=> req && req.kind === 'drawer');
      }
    }catch(_){ }
    return [];
  }
  function drawerCount(rows){
    return (Array.isArray(rows) ? rows : []).reduce((sum, req)=> sum + Math.max(0, Math.round(number(req && req.qty, 0))), 0);
  }
  function drawerRequirementLabel(rows){
    const api = drawerRequirements();
    try{
      if(api && typeof api.labelDrawerRequirements === 'function') return text(api.labelDrawerRequirements(rows || []));
    }catch(_){ }
    const labels = [];
    (Array.isArray(rows) ? rows : []).forEach((req)=> {
      const qty = Math.max(0, Math.round(number(req && req.qty, 0)));
      const label = text(req && req.label);
      if(qty > 0 && label) labels.push(`${qty} × ${label}`);
    });
    return labels.join(', ');
  }
  function cabinetZone(cabinet){
    const type = text(cabinet && cabinet.type);
    if(type === 'stojąca') return 'dolna';
    if(type === 'wisząca') return 'górna';
    if(type === 'moduł') return 'moduł';
    return type || 'inne';
  }
  function cabinetKind(cabinet){
    return [text(cabinet && cabinet.type), text(cabinet && cabinet.subType)].filter(Boolean).join(' / ') || 'szafka';
  }
  function applianceInfo(cabinet){
    try{
      const api = applianceRules();
      if(api && typeof api.getApplianceForCabinet === 'function') return api.getApplianceForCabinet(cabinet) || null;
    }catch(_){ }
    return null;
  }
  function mountedApplianceInfo(cabinet){
    const appliance = applianceInfo(cabinet);
    if(!appliance) return null;
    try{
      const api = applianceRules();
      if(api && typeof api.isMountingEnabled === 'function' && !api.isMountingEnabled(cabinet)) return null;
    }catch(_){ }
    return appliance;
  }
  function applianceCountByCode(cabinet, code){
    const appliance = mountedApplianceInfo(cabinet);
    const match = appliance && text(appliance.code) === text(code);
    return { appliance, qty:match ? 1 : 0 };
  }

  const FACT_CALCULATORS = {
    'cabinet.count':(roomId, cabinet)=> makeFact('cabinet.count', cabinet && typeof cabinet === 'object' ? 1 : 0, { displayValue:cabinet ? '1' : '0', source:'typ szafki' }),
    'cabinet.width_mm':(roomId, cabinet)=> makeFact('cabinet.width_mm', mmFromCmLike(cabinet && cabinet.width), { displayValue:`${mmFromCmLike(cabinet && cabinet.width)} mm`, source:'pole szerokości' }),
    'cabinet.height_mm':(roomId, cabinet)=> makeFact('cabinet.height_mm', mmFromCmLike(cabinet && cabinet.height), { displayValue:`${mmFromCmLike(cabinet && cabinet.height)} mm`, source:'pole wysokości' }),
    'cabinet.depth_mm':(roomId, cabinet)=> makeFact('cabinet.depth_mm', mmFromCmLike(cabinet && cabinet.depth), { displayValue:`${mmFromCmLike(cabinet && cabinet.depth)} mm`, source:'pole głębokości' }),
    'cabinet.volume_m3':(roomId, cabinet)=> makeFact('cabinet.volume_m3', volumeM3(cabinet), { displayValue:`${volumeM3(cabinet).toFixed(4)} m³`, source:'wymiary korpusu' }),
    'cabinet.zone':(roomId, cabinet)=> makeFact('cabinet.zone', cabinetZone(cabinet), { source:'typ szafki' }),
    'cabinet.kind':(roomId, cabinet)=> makeFact('cabinet.kind', cabinetKind(cabinet), { source:'typ i wariant szafki' }),
    'front.count':(roomId, cabinet, cache)=> {
      const parts = cache.frontParts || [];
      const qty = frontCountFromParts(parts) || frontCountFallback(cabinet);
      return makeFact('front.count', qty, { displayValue:`${qty} szt.`, source:'fronty z materiałów/wyceny' });
    },
    'front.dimensions':(roomId, cabinet, cache)=> {
      const label = frontDimensionsFromParts(cache.frontParts || []);
      return makeFact('front.dimensions', label, { hasValue:!!label, source:'fronty z materiałów/wyceny' });
    },
    'front.area_m2':(roomId, cabinet, cache)=> {
      const area = frontAreaM2(cache.frontParts || []);
      return makeFact('front.area_m2', area, { hasValue:area > 0, displayValue:`${area.toFixed(4)} m²`, source:'wymiary frontów' });
    },
    'hinge.count':(roomId, cabinet, cache)=> {
      const qty = hingeCount(cache.hingeRows || []);
      return makeFact('hinge.count', qty, { displayValue:`${qty} szt.`, source:'wymagania zawiasów' });
    },
    'hinge.requirement':(roomId, cabinet, cache)=> {
      const label = hingeRequirementLabel(cache.hingeRows || []);
      return makeFact('hinge.requirement', label, { hasValue:!!label, source:'wymagania zawiasów' });
    },
    'shelf.count':(roomId, cabinet)=> {
      const qty = shelfCount(cabinet);
      return makeFact('shelf.count', qty, { displayValue:`${qty} szt.`, source:'pole półek' });
    },
    'drawer.count':(roomId, cabinet, cache)=> {
      const rows = cache.drawerRows || [];
      const qty = drawerCount(rows);
      const label = drawerRequirementLabel(rows);
      return makeFact('drawer.count', qty, { displayValue:`${qty} szt.`, source:label ? `wymagania szuflad/prowadnic: ${label}` : 'wymagania szuflad/prowadnic' });
    },
    'appliance.count':(roomId, cabinet)=> {
      const appliance = mountedApplianceInfo(cabinet);
      const qty = appliance ? 1 : 0;
      return makeFact('appliance.count', qty, { displayValue:`${qty} szt.`, source:'typ AGD + montaż' });
    },
    'appliance.type':(roomId, cabinet)=> {
      const appliance = mountedApplianceInfo(cabinet);
      return makeFact('appliance.type', appliance && (appliance.label || appliance.serviceName), { hasValue:!!appliance, source:'typ AGD + montaż' });
    },
    'appliance.dishwasher.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'dishwasher');
      return makeFact('appliance.dishwasher.count', data.qty, { displayValue:`${data.qty} szt.`, source:'zmywarka + montaż AGD' });
    },
    'appliance.fridge.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'fridge');
      return makeFact('appliance.fridge.count', data.qty, { displayValue:`${data.qty} szt.`, source:'lodówka + montaż AGD' });
    },
    'appliance.oven.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'oven');
      return makeFact('appliance.oven.count', data.qty, { displayValue:`${data.qty} szt.`, source:'piekarnik + montaż AGD' });
    },
    'appliance.hob.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'hob');
      return makeFact('appliance.hob.count', data.qty, { displayValue:`${data.qty} szt.`, source:'płyta + montaż AGD' });
    },
    'appliance.hood_under_cabinet.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'hood_under_cabinet');
      return makeFact('appliance.hood_under_cabinet.count', data.qty, { displayValue:`${data.qty} szt.`, source:'okap podszafkowy/teleskopowy + montaż AGD' });
    },
    'appliance.hood_chimney.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'hood_chimney');
      return makeFact('appliance.hood_chimney.count', data.qty, { displayValue:`${data.qty} szt.`, source:'okap kominowy/wyspowy + montaż AGD' });
    },
    'appliance.microwave.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'microwave');
      return makeFact('appliance.microwave.count', data.qty, { displayValue:`${data.qty} szt.`, source:'mikrofala + montaż AGD' });
    },
    'appliance.washer.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'washer');
      return makeFact('appliance.washer.count', data.qty, { displayValue:`${data.qty} szt.`, source:'pralka + montaż AGD' });
    },
    'appliance.dryer.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'dryer');
      return makeFact('appliance.dryer.count', data.qty, { displayValue:`${data.qty} szt.`, source:'suszarka + montaż AGD' });
    },
    'appliance.coffee_machine.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'coffee_machine');
      return makeFact('appliance.coffee_machine.count', data.qty, { displayValue:`${data.qty} szt.`, source:'ekspres + montaż AGD' });
    },
    'appliance.warming_drawer.count':(roomId, cabinet)=> {
      const data = applianceCountByCode(cabinet, 'warming_drawer');
      return makeFact('appliance.warming_drawer.count', data.qty, { displayValue:`${data.qty} szt.`, source:'podgrzewacz szufladowy + montaż AGD' });
    }
  };

  function buildCache(roomId, cabinet){
    return {
      frontParts:getFrontParts(roomId, cabinet),
      hingeRows:getHingeRows(roomId, cabinet),
      drawerRows:getDrawerRows(roomId, cabinet)
    };
  }
  function getSourceList(){
    try{
      const api = FC.workQuantitySources;
      return api && typeof api.list === 'function' ? api.list() : [];
    }catch(_){ return []; }
  }
  function getCabinetFacts(roomId, cabinet){
    const sources = getSourceList();
    const cache = buildCache(roomId, cabinet || {});
    return sources.map((source)=> {
      const code = text(source && source.code);
      const calc = FACT_CALCULATORS[code];
      if(typeof calc === 'function'){
        try{ return calc(roomId, cabinet || {}, cache); }
        catch(error){ return makeFact(code, null, { hasValue:false, warning:error && error.message ? error.message : String(error) }); }
      }
      return makeFact(code, null, { hasValue:false, emptyText:'niepodpięte', source:'planowane' });
    });
  }
  function getCabinetFact(roomId, cabinet, code){
    const key = text(code);
    return getCabinetFacts(roomId, cabinet).find((fact)=> fact && fact.code === key) || null;
  }
  function buildCabinetFactMap(roomId, cabinet){
    return getCabinetFacts(roomId, cabinet).reduce((acc, fact)=> {
      acc[fact.code] = fact;
      return acc;
    }, {});
  }
  function getRawCabinetFactValues(roomId, cabinet){
    return getCabinetFacts(roomId, cabinet).reduce((acc, fact)=> {
      if(fact && fact.available) acc[fact.code] = fact.value;
      return acc;
    }, {});
  }

  FC.workQuantityFacts = {
    getCabinetFacts,
    listCabinetFacts:getCabinetFacts,
    getCabinetFact,
    buildCabinetFactMap,
    getRawCabinetFactValues,
    _debug:{ clone, volumeM3, frontAreaM2, shelfCount, drawerCount, getDrawerRows }
  };
})();
