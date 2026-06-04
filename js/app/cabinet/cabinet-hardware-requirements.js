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
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }
  function normalizedKey(value){
    return text(value).toLowerCase().replace(/ł/g, 'l').replace(/Ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function isTipOnOpening(cab){
    const raw = normalizedKey(cab && cab.openingSystem);
    return raw === 'tip on' || raw === 'tipon';
  }
  function paramCloneSet(params, key, value){
    const out = clone(params || {});
    out[key] = { value:!!value };
    return out;
  }
  function tipOnVariant(baseReq, cfg){
    const src = baseReq && typeof baseReq === 'object' ? baseReq : {};
    const spring = !!(cfg && cfg.spring);
    const variantKey = spring ? 'spring' : 'plain';
    const params = paramCloneSet(paramCloneSet(src.technicalParams || {}, 'hamulec', false), 'sprezyna', spring);
    const suffix = spring ? 'TIP-ON — ze sprężyną, bez hamulca' : 'TIP-ON — bez sprężyny i bez hamulca';
    return Object.assign({}, src, {
      typeId:(text(src.typeId) || HINGE_TYPES.OVERLAY_110) + '_tipon_' + variantKey,
      label:(text(src.label) || 'Zawias') + ' ' + suffix,
      ruleId:(text(src.ruleId) || 'hinge_requirement') + '_tipon_' + variantKey,
      technicalParams:params,
      tipOnVariant:variantKey,
      tipOnSplit:true
    });
  }
  function splitRequirementForTipOn(req){
    const qty = Math.max(0, Math.round(number(req && req.qty)));
    if(!(qty > 0)) return [];
    const springQty = Math.floor(qty / 2);
    const plainQty = Math.ceil(qty / 2);
    const rows = [];
    if(springQty > 0) rows.push(Object.assign({}, tipOnVariant(req, { spring:true }), { qty:springQty }));
    if(plainQty > 0) rows.push(Object.assign({}, tipOnVariant(req, { spring:false }), { qty:plainQty }));
    return rows;
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
      requirementType:'hingeSet',
      displayTitle:'Komplet zawiasowy',
      hardwareGroup:'hinges',
      category:'Zawiasy',
      typeId,
      label,
      ruleId,
      technicalParams:technicalParams || {},
      coverageMode:'catalogSetOrComponents',
      coverageComponents:[
        { kind:'hinge', label:'Zawias' },
        { kind:'mountingPlate', label:'Prowadnik' }
      ],
      resolverReady:true,
    }, extra || {});
  }
  function noHinge(ruleId, reason, extra){
    return Object.assign({ kind:'none', hardwareGroup:'hinges', category:'Zawiasy', ruleId, reason:text(reason), resolverReady:true }, extra || {});
  }
  function future(ruleId, reason, extra){
    return Object.assign({ kind:'future', hardwareGroup:'hinges', category:'Zawiasy', ruleId, reason:text(reason), resolverReady:false }, extra || {});
  }

  function overlay110(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.OVERLAY_110, 'Zawias 110° nakładany', ruleId, {
      nalozenie:{ value:'nakładany' },
      kat_rzeczywisty:{ from:110, to:'' },
      klasa_kata:{ value:'standardowy 90–120°' },
      hamulec:{ value:true },
      sprezyna:{ value:true },
      typ_prowadnika:{ value:'standardowy' },
      forma_prowadnika:{ value:'krzyżowy' }
    }, extra);
  }
  function inset110(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.INSET_110, 'Zawias 110° wpuszczany', ruleId, {
      nalozenie:{ value:'wpuszczany' },
      kat_rzeczywisty:{ from:110, to:'' },
      klasa_kata:{ value:'standardowy 90–120°' },
      hamulec:{ value:true },
      sprezyna:{ value:true },
      typ_prowadnika:{ value:'standardowy' },
      forma_prowadnika:{ value:'krzyżowy' }
    }, extra);
  }
  function zero155(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.ZERO_155, 'Zawias 155° zerowy uskok', ruleId, {
      nalozenie:{ value:'nakładany' },
      kat_rzeczywisty:{ from:155, to:'' },
      klasa_kata:{ value:'zerowy uskok 155°' },
      hamulec:{ value:true },
      sprezyna:{ value:true },
      typ_prowadnika:{ value:'standardowy' },
      forma_prowadnika:{ value:'krzyżowy' }
    }, extra);
  }
  function corner170(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.CORNER_170, 'Zawias 170° narożny', ruleId, {
      nalozenie:{ value:'nakładany' },
      kat_rzeczywisty:{ from:170, to:'' },
      klasa_kata:{ value:'narożny 170°' },
      hamulec:{ value:true },
      sprezyna:{ value:true },
      typ_prowadnika:{ value:'specjalny' },
      forma_prowadnika:{ value:'krzyżowy' }
    }, extra);
  }
  function blindCorner(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.PARALLEL_INSET, 'Zawias równoległy wpuszczany', ruleId, {
      nalozenie:{ value:'równoległy wpuszczany' },
      kat_rzeczywisty:{ from:95, to:'' },
      klasa_kata:{ value:'równoległy wpuszczany 95°' },
      hamulec:{ value:true },
      sprezyna:{ value:true },
      typ_prowadnika:{ value:'specjalny' },
      forma_prowadnika:{ value:'krzyżowy' }
    }, extra);
  }
  function fridgeHinge(ruleId, extra){
    return hingeRequirement(HINGE_TYPES.FRIDGE_OVERLAY, 'Zawias lodówkowy nakładany', ruleId, {
      nalozenie:{ value:'lodówkowy nakładany' },
      kat_rzeczywisty:{ from:95, to:'' },
      klasa_kata:{ value:'lodówkowy 95°' },
      hamulec:{ value:true },
      sprezyna:{ value:true },
      typ_prowadnika:{ value:'specjalny' },
      forma_prowadnika:{ value:'krzyżowy' }
    }, extra);
  }

  const DEFAULT_HINGE_REQUIREMENT_FACTORIES = [
    { typeId:HINGE_TYPES.OVERLAY_110, label:'110° nakładany', factory:overlay110 },
    { typeId:HINGE_TYPES.INSET_110, label:'110° wpuszczany', factory:inset110 },
    { typeId:HINGE_TYPES.ZERO_155, label:'155° zerowy uskok', factory:zero155 },
    { typeId:HINGE_TYPES.CORNER_170, label:'170° narożny', factory:corner170 },
    { typeId:HINGE_TYPES.PARALLEL_INSET, label:'równoległy wpuszczany 95°', factory:blindCorner },
    { typeId:HINGE_TYPES.FRIDGE_OVERLAY, label:'lodówkowy nakładany 95°', factory:fridgeHinge },
  ];

  function optionApi(){
    return FC.cabinetHardwareRequirementOptions || null;
  }
  function requirementFromOption(option, ruleId, extra){
    const opt = option && typeof option === 'object' ? option : null;
    if(!opt) return null;
    const params = clone(opt.technicalParams || {});
    delete params.rola_kompletu;
    delete params.system_kompatybilnosci;
    delete params.pokrycie_prowadnika;
    return hingeRequirement(text(opt.typeId || opt.value), 'Komplet zawiasowy ' + text(opt.label || 'z katalogu'), ruleId || ('catalog_' + text(opt.typeId || opt.value)), params, Object.assign({
      catalogDriven:!!opt.catalogDriven,
      catalogOptionSourceCount:Number(opt.sourceCount) || 0,
      catalogOptionSourceItemIds:Array.isArray(opt.sourceItemIds) ? opt.sourceItemIds.slice() : [],
      catalogHasSet:!!opt.catalogHasSet,
      coverageMode:text(opt.coverageMode) || 'catalogSetOrComponents',
      coverageComponents:Array.isArray(opt.coverageComponents) ? clone(opt.coverageComponents) : [
        { kind:'hinge', label:'Zawias' },
        { kind:'mountingPlate', label:'Prowadnik' }
      ]
    }, extra || {}));
  }
  function getHingeRequirementPreset(typeId, ruleId, extra){
    const id = text(typeId) || HINGE_TYPES.OVERLAY_110;

    // Kanoniczne wymagania szafki są regułą techniczną, nie konkretnym produktem
    // z katalogu. Katalog może mieć np. GTV 107° w klasie standardowy 90–120°,
    // ale domyślna szafka nadal wymaga standardowego 110°; 107° jest dopiero
    // kandydatem/zamiennikiem w WYCENIE, a nie źródłem prawdy dla WYWIADU.
    const found = DEFAULT_HINGE_REQUIREMENT_FACTORIES.find((row)=> row.typeId === id);
    if(found) return found.factory(ruleId || ('manual_' + found.typeId), extra || {});

    const source = optionApi();
    const catalogFound = source && typeof source.findHingeRequirementOption === 'function' ? source.findHingeRequirementOption(id) : null;
    if(catalogFound) return requirementFromOption(catalogFound, ruleId || ('manual_' + id), extra || {});

    const fallback = DEFAULT_HINGE_REQUIREMENT_FACTORIES[0];
    return fallback.factory(ruleId || ('manual_' + fallback.typeId), extra || {});
  }

  function getHingeRequirementOptions(){
    const source = optionApi();
    const catalogOptions = source && typeof source.getHingeRequirementOptions === 'function' ? source.getHingeRequirementOptions() : [];
    if(Array.isArray(catalogOptions) && catalogOptions.length){
      return catalogOptions.map((opt)=> Object.assign({}, opt, {
        requirement:requirementFromOption(opt, 'option_preview')
      }));
    }
    return [];
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

  function getHingeOverrides(cab){
    const all = cab && cab.hardwareRequirementOverrides && typeof cab.hardwareRequirementOverrides === 'object' ? cab.hardwareRequirementOverrides : {};
    const hinges = all.hinges && typeof all.hinges === 'object' ? all.hinges : {};
    return hinges;
  }

  function ensureHingeOverrideStore(cab){
    if(!cab || typeof cab !== 'object') return null;
    if(!cab.hardwareRequirementOverrides || typeof cab.hardwareRequirementOverrides !== 'object') cab.hardwareRequirementOverrides = {};
    if(!cab.hardwareRequirementOverrides.hinges || typeof cab.hardwareRequirementOverrides.hinges !== 'object') cab.hardwareRequirementOverrides.hinges = {};
    if(!cab.hardwareRequirementOverrides.hinges.doors || typeof cab.hardwareRequirementOverrides.hinges.doors !== 'object') cab.hardwareRequirementOverrides.hinges.doors = {};
    return cab.hardwareRequirementOverrides.hinges;
  }

  function doorKeyForIndex(index, total){
    const i = Math.max(0, Math.round(number(index)));
    const count = Math.max(0, Math.round(number(total)));
    if(count === 1) return 'single';
    if(count === 2) return i === 0 ? 'left' : 'right';
    return 'door_' + (i + 1);
  }

  function doorLabelForIndex(index, total){
    const i = Math.max(0, Math.round(number(index)));
    const count = Math.max(0, Math.round(number(total)));
    if(count === 1) return 'Drzwiczki';
    if(count === 2) return i === 0 ? 'Lewe drzwiczki' : 'Prawe drzwiczki';
    return 'Drzwiczki ' + (i + 1);
  }

  function cleanupEmptyHingeOverrides(cab){
    try{
      const store = cab && cab.hardwareRequirementOverrides && cab.hardwareRequirementOverrides.hinges;
      if(store && store.doors && !Object.keys(store.doors || {}).length) delete store.doors;
      if(store && !Object.keys(store || {}).length && cab.hardwareRequirementOverrides) delete cab.hardwareRequirementOverrides.hinges;
      if(cab && cab.hardwareRequirementOverrides && !Object.keys(cab.hardwareRequirementOverrides || {}).length) delete cab.hardwareRequirementOverrides;
    }catch(_){ }
  }

  function buildStoredOverridePatch(patch){
    const src = patch && typeof patch === 'object' ? patch : {};
    const id = text(src.typeId);
    if(!id) return null;
    const out = { typeId:id };
    let preset = null;
    try{ preset = getHingeRequirementPreset(id, 'manual_hinge_override_snapshot'); }catch(_){ preset = null; }
    const params = src.technicalParams && typeof src.technicalParams === 'object'
      ? src.technicalParams
      : (preset && preset.technicalParams && typeof preset.technicalParams === 'object' ? preset.technicalParams : null);
    if(params) out.technicalParams = clone(params);
    const label = text(src.label) || text(preset && preset.label);
    if(label) out.label = label;
    return out;
  }

  function setHingeDoorOverride(cab, doorKey, patch){
    const store = ensureHingeOverrideStore(cab);
    if(!store) return false;
    const key = text(doorKey) || 'single';
    if(Object.prototype.hasOwnProperty.call(patch || {}, 'typeId') && !text(patch && patch.typeId)){
      delete store.doors[key];
      cleanupEmptyHingeOverrides(cab);
      return true;
    }
    const prepared = buildStoredOverridePatch(patch);
    if(!prepared){
      delete store.doors[key];
      cleanupEmptyHingeOverrides(cab);
      return true;
    }
    store.doors[key] = Object.assign({}, store.doors[key] || {}, prepared);
    return true;
  }

  function clearInvalidDoorOverrides(cab, validKeys){
    const store = ensureHingeOverrideStore(cab);
    if(!store) return false;
    const allowed = new Set((Array.isArray(validKeys) ? validKeys : []).map(text).filter(Boolean));
    Object.keys(store.doors || {}).forEach((key)=> { if(!allowed.has(key)) delete store.doors[key]; });
    if(!Object.keys(store.doors || {}).length) delete store.doors;
    if(!Object.keys(store).length && cab.hardwareRequirementOverrides) delete cab.hardwareRequirementOverrides.hinges;
    if(cab.hardwareRequirementOverrides && !Object.keys(cab.hardwareRequirementOverrides).length) delete cab.hardwareRequirementOverrides;
    return true;
  }

  function getDoorPanelsForHinges(room, cab){
    try{
      const hw = FC.frontHardware || {};
      return hw && typeof hw.getDoorFrontPanelsForHinges === 'function' ? (hw.getDoorFrontPanelsForHinges(room, cab) || []) : [];
    }catch(_){ return []; }
  }

  function countHingesForDoorPanel(panel, cab){
    try{
      const hw = FC.frontHardware || {};
      const calc = hw && typeof hw.blumHingesPerDoor === 'function' ? hw.blumHingesPerDoor : null;
      if(calc) return Math.max(0, Math.round(number(calc(number(panel && panel.w), number(panel && panel.h), text(panel && panel.material) || (cab && cab.frontMaterial) || 'laminat', !!(panel && panel.hasHandle)))));
    }catch(_){ }
    return 0;
  }

  function applyOverrideToDoorRequirement(baseReq, override, extra){
    const hasOverride = !!(override && text(override.typeId));
    const typeId = (hasOverride ? text(override && override.typeId) : text(baseReq && baseReq.typeId)) || HINGE_TYPES.OVERLAY_110;
    let req = getHingeRequirementPreset(typeId, text(baseReq && baseReq.ruleId) || 'manual_hinge_override', {
      overridden:hasOverride,
      defaultTypeId:text(baseReq && baseReq.typeId),
      defaultLabel:text(baseReq && baseReq.label),
      sourceRuleId:text(baseReq && baseReq.ruleId),
      note:text(baseReq && baseReq.note),
      logicalGroup:baseReq && baseReq.logicalGroup,
      auxiliaryForLift:!!(baseReq && baseReq.auxiliaryForLift)
    });
    if(hasOverride && override && override.technicalParams && typeof override.technicalParams === 'object'){
      req = Object.assign({}, req, {
        label:text(override.label) || text(req && req.label),
        technicalParams:clone(override.technicalParams)
      });
    }
    return Object.assign({}, req, extra || {});
  }

  function getHingeRequirementsWithQty(room, cab){
    const baseReq = getBaseHingeRequirement(room, cab);
    if(!baseReq || baseReq.kind !== 'hinge') return baseReq ? [baseReq] : [];

    if(baseReq.auxiliaryForLift){
      const qty = Math.max(0, Math.round(countAuxiliaryFlapHinges(room, cab)));
      return [Object.assign({}, baseReq, { qty })];
    }

    const panels = getDoorPanelsForHinges(room, cab);
    if(!Array.isArray(panels) || !panels.length){
      let qty = 0;
      try{
        const hw = FC.frontHardware || {};
        qty = hw && typeof hw.getHingeCountForCabinet === 'function' ? Number(hw.getHingeCountForCabinet(room, cab)) || 0 : 0;
      }catch(_){ qty = 0; }
      const row = Object.assign({}, baseReq, { qty:Math.max(0, Math.round(qty)) });
      return isTipOnOpening(cab) ? splitRequirementForTipOn(row) : [row];
    }

    const overrides = getHingeOverrides(cab);
    const doorOverrides = overrides && overrides.doors && typeof overrides.doors === 'object' ? overrides.doors : {};
    const total = panels.length;
    const validKeys = [];
    const rows = [];
    panels.forEach((panel, index)=> {
      const doorKey = doorKeyForIndex(index, total);
      validKeys.push(doorKey);
      const override = doorOverrides[doorKey] || {};
      const qty = countHingesForDoorPanel(panel, cab);
      const doorReq = applyOverrideToDoorRequirement(baseReq, override, {
        qty,
        doorKey,
        doorIndex:index,
        doorCount:total,
        doorLabel:doorLabelForIndex(index, total),
        frontWidthCm:number(panel && panel.w),
        frontHeightCm:number(panel && panel.h),
        frontMaterial:text(panel && panel.material) || text(cab && cab.frontMaterial),
        hasHandle:!!(panel && panel.hasHandle)
      });
      if(isTipOnOpening(cab)){
        splitRequirementForTipOn(doorReq).forEach((row)=> rows.push(row));
      }else{
        rows.push(doorReq);
      }
    });
    try{ clearInvalidDoorOverrides(cab, validKeys); }catch(_){ }
    return rows;
  }

  function aggregateDoorRequirements(rows, baseReq){
    const arr = (Array.isArray(rows) ? rows : []).filter((req)=> req && req.kind === 'hinge');
    if(!arr.length) return baseReq || null;
    const totalQty = arr.reduce((sum, req)=> sum + Math.max(0, Math.round(number(req.qty))), 0);
    const first = arr[0];
    const allSame = arr.every((req)=> text(req.typeId) === text(first.typeId));
    const aggregate = Object.assign({}, allSame ? first : (baseReq || first), {
      qty:Math.max(0, Math.round(totalQty)),
      doorRequirements:arr.map((req)=> clone(req)),
      mixedDoorRequirements:!allSame
    });
    delete aggregate.doorKey;
    delete aggregate.doorIndex;
    delete aggregate.doorLabel;
    delete aggregate.frontWidthCm;
    delete aggregate.frontHeightCm;
    delete aggregate.frontMaterial;
    delete aggregate.hasHandle;
    return aggregate;
  }

  function getHingeRequirementWithQty(room, cab){
    const baseReq = getBaseHingeRequirement(room, cab);
    if(!baseReq || baseReq.kind !== 'hinge') return baseReq;
    const rows = getHingeRequirementsWithQty(room, cab);
    return aggregateDoorRequirements(rows, baseReq);
  }

  function getCabinetHardwareRequirements(room, cab){
    const out = [];
    const hinge = getHingeRequirementWithQty(room, cab);
    if(hinge) out.push(hinge);
    return out;
  }

  FC.cabinetHardwareRequirements = {
    HINGE_TYPES,
    getHingeRequirementOptions,
    getHingeRequirementPreset,
    getBaseHingeRequirement,
    getHingeRequirementWithQty,
    getHingeRequirementsWithQty,
    getCabinetHardwareRequirements,
    setHingeDoorOverride,
    clearInvalidDoorOverrides,
    doorKeyForIndex,
    doorLabelForIndex,
    needsFridgeFurnitureHinges,
    isHafeleScissorFlap,
    isBlumHkXsFlap,
    isTipOnOpening,
  };
})();
