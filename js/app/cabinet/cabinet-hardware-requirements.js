// js/app/cabinet/cabinet-hardware-requirements.js
// Reguły techniczne: typ szafki -> wymagania okuć. Bez wyboru konkretnego produktu katalogowego.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const HINGE_TYPES = {
    OVERLAY_110: 'hinge_110_overlay',
    INSET_110: 'hinge_110_inset',
    ZERO_155: 'hinge_155_zero',
    CORNER_170: 'hinge_170_corner',
    PARALLEL_INSET: 'hinge_parallel_inset',
    FRIDGE_OVERLAY: 'hinge_fridge_overlay'
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function bool(value){
    if(value === true) return true;
    if(value === false) return false;
    const raw = text(value).toLowerCase();
    return ['1','true','tak','yes','y'].includes(raw);
  }
  function details(cab){ return cab && cab.details && typeof cab.details === 'object' ? cab.details : {}; }
  function typeOf(cab){ return text(cab && cab.type); }
  function subTypeOf(cab){ return text(cab && cab.subType); }
  function isSetFollower(room, cab){
    try{
      const hw = FC.frontHardware || {};
      return !!(cab && cab.setId && hw && typeof hw.isLeadSetCabinet === 'function' && !hw.isLeadSetCabinet(room, cab));
    }catch(_){ return false; }
  }
  function isFridgeBuiltIn(cab){ return text(details(cab).fridgeOption || 'zabudowa') === 'zabudowa'; }
  function needsFridgeFurnitureHinges(cab){
    const d = details(cab);
    return bool(d.requiresFurnitureHinges) || bool(d.fridgeRequiresFurnitureHinges) || bool(d.needsFurnitureHinges);
  }
  function isOvenDrawerVariant(cab){ return text(details(cab).ovenOption || 'szuflada_dol').indexOf('szuflada') !== -1; }
  function isOvenFlapVariant(cab){ return text(details(cab).ovenOption || '').indexOf('klapka') !== -1; }
  function isSinkDrawerVariant(cab){ return text(details(cab).sinkFront || 'drzwi') === 'szuflada'; }
  function podFrontMode(cab){
    const d = details(cab);
    return text(d.podFrontMode || (d.subTypeOption && String(d.subTypeOption).indexOf('szuflada') === 0 ? 'szuflady' : 'drzwi')) || 'drzwi';
  }
  function isHafeleScissorFlap(cab){
    const d = details(cab);
    return subTypeOf(cab) === 'uchylne' && text(d.flapVendor || '') === 'hafele' && text(d.flapKind || 'DUO') === 'DUO';
  }
  function isBlumHkXsFlap(cab){
    const d = details(cab);
    return subTypeOf(cab) === 'uchylne' && text(d.flapVendor || 'blum') === 'blum' && text(d.flapKind || '') === 'HK-XS';
  }

  function hingeRequirement(typeId, label, ruleId, technicalParams, extra){
    return Object.assign({
      kind:'hinge',
      hardwareGroup:'hinges',
      category:'Zawiasy',
      typeId,
      label,
      ruleId,
      technicalParams:technicalParams || {},
      resolverReady:true,
    }, extra || {});
  }
  function noHinge(ruleId, reason, extra){
    return Object.assign({ kind:'none', hardwareGroup:'hinges', ruleId, reason:text(reason), resolverReady:true }, extra || {});
  }
  function future(ruleId, reason, extra){
    return Object.assign({ kind:'future', hardwareGroup:'hinges', ruleId, reason:text(reason), resolverReady:false }, extra || {});
  }

  function overlay110(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.OVERLAY_110, 'Zawias 110° nakładany', ruleId, {
      nalozenie:{ value:'nakładany' },
      kat_otwarcia:{ from:110 },
      hamulec:{ value:true },
      prowadnik:{ value:'standardowy' }
    }, extra);
  }
  function corner170(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.CORNER_170, 'Zawias 170° narożny', ruleId, {
      nalozenie:{ value:'nakładany' },
      kat_otwarcia:{ from:170 },
      hamulec:{ value:false },
      prowadnik:{ value:'specjalny' }
    }, extra);
  }
  function blindCorner(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.PARALLEL_INSET, 'Zawias równoległy wpuszczany', ruleId, {
      nalozenie:{ value:'równoległy wpuszczany' },
      kat_otwarcia:{ from:95 },
      prowadnik:{ value:'specjalny' }
    }, extra);
  }
  function fridgeHinge(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.FRIDGE_OVERLAY, 'Zawias lodówkowy nakładany', ruleId, {
      nalozenie:{ value:'lodówkowy nakładany' },
      kat_otwarcia:{ from:95 },
      prowadnik:{ value:'specjalny' }
    }, extra);
  }

  function getBaseHingeRequirement(room, cab){
    if(!cab || typeof cab !== 'object') return noHinge('empty', 'Brak szafki.');
    if(isSetFollower(room, cab)) return noHinge('set_follower', 'Korpus zestawu nieprowadzący — okucia liczy front zestawu.');

    const type = typeOf(cab);
    const sub = subTypeOf(cab);

    if(cab.setId) return overlay110('set_fronts_110_overlay', { note:'Zestaw: v1 liczy zawiasy od frontu zestawu; przyszłe szuflady wewnętrzne mogą zmienić typ zawiasu.' });

    if(sub === 'szuflady') return noHinge('drawer_cabinet_no_hinges', 'Szafka szufladowa — bez zawiasów, później prowadnice/szuflady.');
    if(sub === 'zmywarkowa') return noHinge('dishwasher_no_furniture_hinges', 'Zmywarka — bez zawiasów meblowych, osobno montaż AGD.');

    if(sub === 'lodowkowa'){
      if(!isFridgeBuiltIn(cab)) return noHinge('freestanding_fridge_no_hinges', 'Lodówka wolnostojąca — bez zawiasów meblowych.');
      return needsFridgeFurnitureHinges(cab)
        ? fridgeHinge('built_in_fridge_furniture_hinges', { note:'Włączone pole „Wymaga zawiasów meblowych”; ilość liczona jak dla innych frontów.' })
        : noHinge('built_in_fridge_default_no_hinges', 'Lodówka w zabudowie — domyślnie bez zawiasów meblowych; włącz ptaszek przy frontach, jeśli fronty ich wymagają.', { canEnableWithFlag:'requiresFurnitureHinges' });
    }

    if(sub === 'piekarnikowa'){
      if(isOvenDrawerVariant(cab)) return noHinge('oven_drawer_no_hinges', 'Piekarnikowa z wariantem szuflady — bez zawiasów.');
      if(isOvenFlapVariant(cab)) return overlay110('oven_flap_110_overlay', { note:'Piekarnikowa z klapką — v1 zwykły zawias 110° nakładany.' });
      return overlay110('oven_default_110_overlay');
    }

    if(sub === 'zlewowa'){
      return isSinkDrawerVariant(cab)
        ? noHinge('sink_drawer_no_hinges', 'Zlewowa z dużą szufladą — bez zawiasów.')
        : overlay110('sink_doors_110_overlay');
    }

    if(sub === 'rogowa_slepa') return blindCorner(type === 'wisząca' ? 'wall_blind_corner_hinge' : 'standing_blind_corner_hinge');
    if(sub === 'narozna_l') return corner170(type === 'wisząca' ? 'wall_corner_l_170' : 'standing_corner_l_170');

    if(sub === 'dolna_podblatowa'){
      const mode = podFrontMode(cab);
      if(mode === 'brak') return noHinge('under_counter_open_no_hinges', 'Dolna podblatowa bez frontu — bez okuć frontowych.');
      if(mode === 'szuflady') return noHinge('under_counter_drawers_no_hinges', 'Dolna podblatowa z szufladami — bez zawiasów.');
      return overlay110('under_counter_doors_110_overlay', { logicalGroup:'stojąca_bez_nóg' });
    }

    if(sub === 'okap'){
      const mode = text(details(cab).hoodFrontMode || 'drzwi');
      if(mode === 'klapa') return future('hood_flap_lift_rule', 'Okapowa z klapą: do podłączenia pod logikę klap/podnośników oraz montaż AGD okapu.');
      return overlay110('hood_doors_110_overlay', { note:'Okapowa z drzwiczkami — zawias 110° nakładany; montaż AGD okapu jest osobną pozycją robocizny.' });
    }

    if(sub === 'uchylne'){
      if(isBlumHkXsFlap(cab)) return overlay110('flap_blum_hk_xs_aux_110', { auxiliaryForLift:true, note:'HK-XS wymaga zawiasów 110° według zasad producenta/podnośnika.' });
      if(isHafeleScissorFlap(cab)) return overlay110('flap_hafele_scissor_aux_110', { auxiliaryForLift:true, note:'Rozwórka nożycowa Häfele wymaga zawiasów 110° nakładanych.' });
      return noHinge('flap_lift_no_regular_hinges', 'Klapa z podnośnikiem — bez zwykłych zawiasów, poza HK-XS i nożycowym Häfele.');
    }

    if(type === 'stojąca' || type === 'wisząca' || type === 'moduł') return overlay110(`${type || 'cabinet'}_standard_110_overlay`);
    return noHinge('unsupported_type_no_hinges', 'Typ szafki nie wymaga zawiasów albo nie jest obsługiwany w regułach v1.');
  }

  function countAuxiliaryFlapHinges(room, cab){
    const d = details(cab);
    if(isBlumHkXsFlap(cab)){
      try{
        const hw = FC.frontHardware || {};
        const info = hw && typeof hw.getBlumAventosInfo === 'function' ? hw.getBlumAventosInfo(cab, room) : null;
        return Math.max(0, Math.round(number(info && info.hkxsHinges)));
      }catch(_){ return 0; }
    }
    if(isHafeleScissorFlap(cab)){
      try{
        const hw = FC.frontHardware || {};
        const fronts = hw && typeof hw.getCabinetFrontCutListForMaterials === 'function' ? hw.getCabinetFrontCutListForMaterials(room, cab) : [];
        const calc = hw && typeof hw.blumHingesPerDoor === 'function' ? hw.blumHingesPerDoor : null;
        if(calc && Array.isArray(fronts) && fronts.length){
          return fronts.reduce((sum, front)=> sum + (Math.max(1, number(front && front.qty) || 1) * calc(number(front && front.a), number(front && front.b), cab.frontMaterial || 'laminat', true)), 0);
        }
      }catch(_){ }
      return 2;
    }
    return 0;
  }

  function getHingeRequirementWithQty(room, cab){
    const req = getBaseHingeRequirement(room, cab);
    if(!req || req.kind !== 'hinge') return req;
    let qty = 0;
    if(req.auxiliaryForLift){
      qty = countAuxiliaryFlapHinges(room, cab);
    }else{
      try{
        const hw = FC.frontHardware || {};
        qty = hw && typeof hw.getHingeCountForCabinet === 'function' ? Number(hw.getHingeCountForCabinet(room, cab)) || 0 : 0;
      }catch(_){ qty = 0; }
    }
    return Object.assign({}, req, { qty:Math.max(0, Math.round(qty)) });
  }

  function getCabinetHardwareRequirements(room, cab){
    const out = [];
    const hinge = getHingeRequirementWithQty(room, cab);
    if(hinge) out.push(hinge);
    return out;
  }

  FC.cabinetHardwareRequirements = {
    HINGE_TYPES,
    getBaseHingeRequirement,
    getHingeRequirementWithQty,
    getCabinetHardwareRequirements,
    needsFridgeFurnitureHinges,
    isHafeleScissorFlap,
    isBlumHkXsFlap,
  };
})();
