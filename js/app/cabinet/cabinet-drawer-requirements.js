// js/app/cabinet/cabinet-drawer-requirements.js
// Jedno źródło prawdy dla jawnych wymagań szuflad/prowadnic używanych przez WYCENĘ i automaty robocizny.
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
  function int(value, fallback){ return Math.max(0, Math.floor(number(value, fallback || 0))); }
  function details(cabinet){ return cabinet && cabinet.details && typeof cabinet.details === 'object' ? cabinet.details : {}; }
  function clone(value){
    try{ if(FC.utils && typeof FC.utils.clone === 'function') return FC.utils.clone(value); }catch(_){ }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }
  function typeOf(cabinet){ return text(cabinet && cabinet.type); }
  function subTypeOf(cabinet){ return text(cabinet && cabinet.subType); }
  function isNoDrawerType(value){ return !text(value) || ['brak','none','nie','0','false'].includes(text(value).toLowerCase()); }
  function cleanPositive(value, fallback){
    const n = int(value, fallback || 0);
    return n > 0 ? n : 0;
  }
  function drawerLayoutQty(layout){
    const key = text(layout) || '3_1_2_2';
    if(key === '1_big') return 1;
    if(key === '2_equal') return 2;
    if(key === '3_equal') return 3;
    if(key === '5_equal') return 5;
    if(key === '3_1_2_2') return 3;
    return 3;
  }
  function drawerLayoutLabel(layout){
    const key = text(layout) || '3_1_2_2';
    if(key === '1_big') return '1 duża';
    if(key === '2_equal') return '2 równe';
    if(key === '3_equal') return '3 równe';
    if(key === '5_equal') return '5 równych';
    return '1 mała + 2 duże';
  }
  function row(source, qty, label, technical, extra){
    const n = cleanPositive(qty, 0);
    if(!(n > 0)) return null;
    return Object.assign({
      kind:'drawer',
      requirementType:'drawerRunner',
      hardwareGroup:'drawers',
      category:'Szuflady / prowadnice',
      source:text(source) || 'manual_requirement',
      qty:n,
      unit:'szt.',
      label:text(label) || 'Szuflada / prowadnice',
      technical:Object.assign({}, technical || {})
    }, extra && typeof extra === 'object' ? extra : {});
  }
  function explicitRows(cabinet){
    const d = details(cabinet);
    const list = Array.isArray(cabinet && cabinet.drawerRequirements) ? cabinet.drawerRequirements
      : (Array.isArray(d.drawerRequirements) ? d.drawerRequirements : []);
    return list.map((item, index)=> row(
      item && (item.source || item.sourceType || item.kind) || 'manual_requirement',
      item && item.qty,
      item && (item.label || item.name) || `Ręczne wymaganie szuflady #${index + 1}`,
      item && (item.technical || item.params || {}),
      { explicit:true, id:item && item.id ? text(item.id) : `drawer_req_${index + 1}` }
    )).filter(Boolean);
  }
  function addRows(out, maybeRows){
    (Array.isArray(maybeRows) ? maybeRows : []).forEach((item)=> { if(item) out.push(item); });
  }
  function systemTechnical(d, prefix){
    const p = text(prefix);
    const direct = {
      system:text(d.drawerSystem || ''),
      brand:text(d.drawerBrand || ''),
      model:text(d.drawerModel || '')
    };
    if(p === 'sinkInner'){
      return {
        system:text(d.sinkInnerDrawerType || ''),
        brand:text(d.sinkInnerDrawerBrand || ''),
        model:text(d.sinkInnerDrawerModel || '')
      };
    }
    if(p === 'inner'){
      return {
        system:text(d.innerDrawerType || ''),
        brand:text(d.innerDrawerBrand || ''),
        model:text(d.innerDrawerModel || '')
      };
    }
    return direct;
  }
  function derivedRows(roomId, cabinet){
    const out = [];
    const type = typeOf(cabinet);
    const sub = subTypeOf(cabinet);
    const d = details(cabinet);

    if((type === 'stojąca' || type === 'moduł') && sub === 'szuflady'){
      const layout = text(d.drawerLayout) || '3_1_2_2';
      out.push(row('front_drawers', drawerLayoutQty(layout), `Szuflady frontowe — ${drawerLayoutLabel(layout)}`, Object.assign({ drawerLayout:layout }, systemTechnical(d))));
      if(!isNoDrawerType(d.innerDrawerType)){
        out.push(row('inner_drawers', d.innerDrawerCount, 'Szuflady wewnętrzne', systemTechnical(d, 'inner')));
      }
    }

    if(type === 'stojąca' && sub === 'zlewowa'){
      if(text(d.sinkFront || 'drzwi') === 'szuflada'){
        out.push(row('sink_front_drawer', 1, 'Szuflada frontowa w szafce zlewowej', systemTechnical(d)));
      }
      if(text(d.sinkExtra) === 'szuflada_wew'){
        out.push(row('sink_inner_drawers', d.sinkExtraCount || 1, 'Szuflady wewnętrzne w szafce zlewowej', systemTechnical(d, 'sinkInner')));
      }
    }

    if(type === 'stojąca' && sub === 'piekarnikowa'){
      if(text(d.ovenOption || 'szuflada_dol').indexOf('szuflada') !== -1){
        out.push(row('oven_drawer', 1, 'Szuflada przy piekarniku', systemTechnical(d)));
      }
    }

    if(type === 'wisząca' && sub === 'dolna_podblatowa'){
      const frontMode = text(d.podFrontMode || (d.subTypeOption && String(d.subTypeOption).indexOf('szuflada') === 0 ? 'szuflady' : 'drzwi')) || 'drzwi';
      if(frontMode === 'szuflady'){
        out.push(row('under_counter_front_drawers', cabinet && cabinet.frontCount, 'Szuflady frontowe w dolnej podblatowej', { drawerLayout:'equal' }));
      } else if(text(d.podInsideMode) === 'szuflady_wewn'){
        out.push(row('under_counter_inner_drawers', d.podInnerDrawerCount || 1, 'Szuflady wewnętrzne w dolnej podblatowej', {}));
      }
    }

    return out.filter(Boolean);
  }
  function getDrawerRequirements(roomId, cabinet){
    if(!cabinet || typeof cabinet !== 'object') return [];
    const explicit = explicitRows(cabinet);
    if(explicit.length) return explicit;
    return derivedRows(roomId, cabinet);
  }
  function countDrawerRequirements(rows){
    return (Array.isArray(rows) ? rows : []).reduce((sum, item)=> sum + cleanPositive(item && item.qty, 0), 0);
  }
  function labelDrawerRequirements(rows){
    const labels = [];
    (Array.isArray(rows) ? rows : []).forEach((item)=> {
      const qty = cleanPositive(item && item.qty, 0);
      const label = text(item && item.label);
      if(qty > 0 && label) labels.push(`${qty} × ${label}`);
    });
    return labels.join(', ');
  }
  function cleanDrawerTrash(cabinet){
    if(!cabinet || typeof cabinet !== 'object') return cabinet;
    const cab = cabinet;
    const d = cab.details && typeof cab.details === 'object' ? cab.details : {};
    cab.details = d;
    const type = typeOf(cab);
    const sub = subTypeOf(cab);

    delete cab.drawerCount;
    delete cab.drawers;
    delete d.drawerCount;
    delete d.drawers;

    if(!((type === 'stojąca' || type === 'moduł') && sub === 'szuflady')){
      delete d.drawerLayout;
      if(!(type === 'stojąca' && (sub === 'zlewowa' || sub === 'piekarnikowa'))){
        delete d.drawerSystem;
        delete d.drawerBrand;
        delete d.drawerModel;
      }
      delete d.innerDrawerType;
      delete d.innerDrawerCount;
      delete d.innerDrawerBrand;
      delete d.innerDrawerModel;
    } else {
      if(!d.drawerLayout) d.drawerLayout = '3_1_2_2';
      if(text(d.drawerLayout) === '5_equal' || isNoDrawerType(d.innerDrawerType)){
        d.innerDrawerType = 'brak';
        d.innerDrawerCount = '0';
      }
    }

    if(!(type === 'stojąca' && sub === 'zlewowa')){
      delete d.sinkInnerDrawerType;
      delete d.sinkInnerDrawerBrand;
      delete d.sinkInnerDrawerModel;
      delete d.sinkExtraCount;
    } else {
      if(text(d.sinkFront || 'drzwi') !== 'szuflada'){
        delete d.drawerSystem;
        delete d.drawerBrand;
        delete d.drawerModel;
      }
      if(text(d.sinkExtra) !== 'szuflada_wew'){
        delete d.sinkInnerDrawerType;
        delete d.sinkInnerDrawerBrand;
        delete d.sinkInnerDrawerModel;
        delete d.sinkExtraCount;
      }
    }

    if(!(type === 'stojąca' && sub === 'piekarnikowa' && text(d.ovenOption || 'szuflada_dol').indexOf('szuflada') !== -1)){
      if(!(type === 'stojąca' && sub === 'zlewowa' && text(d.sinkFront || 'drzwi') === 'szuflada')){
        delete d.drawerSystem;
        delete d.drawerBrand;
        delete d.drawerModel;
      }
    }

    if(!(type === 'wisząca' && sub === 'dolna_podblatowa' && text(d.podInsideMode) === 'szuflady_wewn')){
      delete d.podInnerDrawerCount;
      delete d.podInsideDrawerCount;
      delete d.podInsideDrawersCount;
    }
    return cab;
  }
  function cleanClone(cabinet){
    const copy = clone(cabinet || {});
    return cleanDrawerTrash(copy);
  }

  FC.cabinetDrawerRequirements = {
    getDrawerRequirements,
    getDrawerRequirementsWithQty:getDrawerRequirements,
    countDrawerRequirements,
    labelDrawerRequirements,
    cleanDrawerTrash,
    cleanClone,
    _debug:{ drawerLayoutQty, explicitRows, derivedRows }
  };
})();
