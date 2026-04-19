(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function roomLabel(room){
    const key = String(room || '').trim();
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function'){
        const label = String(FC.roomRegistry.getRoomLabel(key) || '').trim();
        if(label && label !== key) return label;
      }
    }catch(_){ }
    const map = { kuchnia:'Kuchnia', szafa:'Szafa', pokoj:'Pokój', lazienka:'Łazienka' };
    return map[key] || key || 'Pomieszczenie';
  }

  function normalizeRoomSelection(rooms, deps){
    const cfg = Object.assign({ getRooms:null }, deps || {});
    const allowed = typeof cfg.getRooms === 'function' ? cfg.getRooms() : [];
    const normalized = (Array.isArray(rooms) ? rooms : []).map((room)=> String(room || '').trim()).filter(Boolean);
    if(!allowed.length) return Array.from(new Set(normalized));
    const set = new Set(normalized.filter((room)=> allowed.includes(room)));
    return allowed.filter((room)=> set.has(room));
  }

  function encodeRoomsSelection(rooms, deps){
    return normalizeRoomSelection(rooms, deps).join('|');
  }

  function decodeRoomsSelection(raw, deps){
    const cfg = Object.assign({ getRooms:null }, deps || {});
    const parts = Array.isArray(raw) ? raw : String(raw || '').split('|');
    const normalized = normalizeRoomSelection(parts, cfg);
    const allowed = typeof cfg.getRooms === 'function' ? cfg.getRooms() : [];
    return normalized.length ? normalized : allowed.slice();
  }

  function makeMaterialScope(selection, opts){
    const cfg = Object.assign({ allowEmpty:false }, opts || {});
    const base = Object.assign({ kind:'all', material:'', includeFronts:true, includeCorpus:true }, selection || {});
    const kind = (base.kind === 'material' && String(base.material || '').trim()) ? 'material' : 'all';
    const scope = {
      kind,
      material: kind === 'material' ? String(base.material || '').trim() : '',
      includeFronts: base.includeFronts !== false,
      includeCorpus: base.includeCorpus !== false,
    };
    if(!cfg.allowEmpty && !scope.includeFronts && !scope.includeCorpus){
      scope.includeFronts = true;
      scope.includeCorpus = true;
    }
    return scope;
  }

  function encodeMaterialScope(selection){
    try{ return JSON.stringify(makeMaterialScope(selection)); }catch(_){ return '{"kind":"all","material":"","includeFronts":true,"includeCorpus":true}'; }
  }

  function decodeMaterialScope(raw){
    try{ return makeMaterialScope(raw ? JSON.parse(String(raw)) : null); }
    catch(_){ return makeMaterialScope(); }
  }

  function sortRozrysParts(list){
    return (Array.isArray(list) ? list.slice() : []).sort((a,b)=>{
      const aa = Math.max(Number(a && a.w) || 0, Number(a && a.h) || 0);
      const bb = Math.max(Number(b && b.w) || 0, Number(b && b.h) || 0);
      if(bb !== aa) return bb - aa;
      const aw = Math.min(Number(a && a.w) || 0, Number(a && a.h) || 0);
      const bw = Math.min(Number(b && b.w) || 0, Number(b && b.h) || 0);
      if(bw !== aw) return bw - aw;
      return String(a && a.name || '').localeCompare(String(b && b.name || ''), 'pl');
    });
  }

  function getGroupPartsForScope(group, selection){
    const scope = makeMaterialScope(selection);
    if(!group) return [];
    if(scope.includeFronts && scope.includeCorpus) return Array.isArray(group.allParts) ? group.allParts.slice() : [];
    if(scope.includeFronts) return Array.isArray(group.frontParts) ? group.frontParts.slice() : [];
    if(scope.includeCorpus) return Array.isArray(group.corpusParts) ? group.corpusParts.slice() : [];
    return [];
  }

  function normalizeMaterialScopeForAggregate(selection, aggregate, deps){
    const cfg = Object.assign({ aggregatePartsForProject:null }, deps || {});
    const scope = makeMaterialScope(selection);
    const aggRef = aggregate && typeof aggregate === 'object'
      ? aggregate
      : (typeof cfg.aggregatePartsForProject === 'function' ? cfg.aggregatePartsForProject() : { materials:[], groups:{} });
    const mats = Array.isArray(aggRef && aggRef.materials) ? aggRef.materials : [];
    if(!mats.length) return makeMaterialScope({ kind:'all', includeFronts:true, includeCorpus:true });
    if(scope.kind === 'material'){
      const group = aggRef && aggRef.groups ? aggRef.groups[scope.material] : null;
      if(!group) return makeMaterialScope({ kind:'all', includeFronts:true, includeCorpus:true });
      if(scope.includeFronts && !group.hasFronts) scope.includeFronts = false;
      if(scope.includeCorpus && !group.hasCorpus) scope.includeCorpus = false;
      if(!scope.includeFronts && !scope.includeCorpus){
        scope.includeFronts = !!group.hasFronts;
        scope.includeCorpus = !scope.includeFronts && !!group.hasCorpus;
      }
      return makeMaterialScope(scope);
    }
    const hasAnyFronts = mats.some((mat)=> !!(aggRef.groups && aggRef.groups[mat] && aggRef.groups[mat].hasFronts));
    const hasAnyCorpus = mats.some((mat)=> !!(aggRef.groups && aggRef.groups[mat] && aggRef.groups[mat].hasCorpus));
    if(scope.includeFronts && !hasAnyFronts) scope.includeFronts = false;
    if(scope.includeCorpus && !hasAnyCorpus) scope.includeCorpus = false;
    if(!scope.includeFronts && !scope.includeCorpus){
      scope.includeFronts = hasAnyFronts;
      scope.includeCorpus = !scope.includeFronts && hasAnyCorpus;
    }
    return makeMaterialScope(scope);
  }

  function getRozrysScopeMode(selection){
    const scope = makeMaterialScope(typeof selection === 'string' ? decodeMaterialScope(selection) : selection);
    if(scope.includeFronts && scope.includeCorpus) return 'both';
    return scope.includeFronts ? 'fronts' : 'corpus';
  }

  function getOrderedMaterialsForSelection(selection, aggregate, deps){
    const cfg = Object.assign({ aggregatePartsForProject:null }, deps || {});
    const scope = makeMaterialScope(typeof selection === 'string' ? decodeMaterialScope(selection) : selection);
    const aggRef = aggregate && typeof aggregate === 'object'
      ? aggregate
      : (typeof cfg.aggregatePartsForProject === 'function' ? cfg.aggregatePartsForProject() : { materials:[] });
    const allMaterials = Array.isArray(aggRef && aggRef.materials) ? aggRef.materials.slice() : [];
    if(scope.kind === 'material' && scope.material) return allMaterials.includes(scope.material) ? [scope.material] : [];
    return allMaterials;
  }

  function getAccordionScopeKey(selection, aggregate, deps){
    const cfg = Object.assign({ getRooms:null }, deps || {});
    const scope = makeMaterialScope(typeof selection === 'string' ? decodeMaterialScope(selection) : selection);
    const aggRef = aggregate && typeof aggregate === 'object' ? aggregate : { selectedRooms:[], groups:{} };
    const roomSig = encodeRoomsSelection(aggRef && aggRef.selectedRooms ? aggRef.selectedRooms : (typeof cfg.getRooms === 'function' ? cfg.getRooms() : []), cfg);
    const materialSig = scope.kind === 'material' ? scope.material : '__ALL__';
    return `scope:${roomSig}:${materialSig}:${getRozrysScopeMode(scope)}`;
  }

  function aggregatePartsForProject(selectedRooms, deps){
    const cfg = Object.assign({
      safeGetProject:null,
      getRooms:null,
      getCabinetCutList:null,
      resolveRozrysPartFromSource:null,
      isFrontMaterialKey:null,
    }, deps || {});
    const proj = typeof cfg.safeGetProject === 'function' ? cfg.safeGetProject() : null;
    const rooms = normalizeRoomSelection(Array.isArray(selectedRooms) ? selectedRooms : (typeof cfg.getRooms === 'function' ? cfg.getRooms() : []), cfg);
    if(!proj) return { byMaterial: {}, materials: [], groups: {}, selectedRooms: rooms };

    const groups = {};
    const ensureGroup = (key)=>{
      if(!groups[key]){
        groups[key] = {
          key,
          frontMap: new Map(),
          corpusMap: new Map(),
          sourceMaterials: new Set(),
          rooms: new Set(),
        };
      }
      return groups[key];
    };

    for(const room of rooms){
      const cabinets = (proj[room] && Array.isArray(proj[room].cabinets)) ? proj[room].cabinets : [];
      for(const cab of cabinets){
        if(typeof cfg.getCabinetCutList !== 'function') continue;
        const parts = cfg.getCabinetCutList(cab, room) || [];
        for(const p of parts){
          const sourceMaterial = String(p.material || '').trim();
          if(!sourceMaterial) continue;
          const resolved = typeof cfg.resolveRozrysPartFromSource === 'function' ? cfg.resolveRozrysPartFromSource(p) : null;
          if(!resolved) continue;
          const w = resolved.w;
          const h = resolved.h;
          if(!(w > 0 && h > 0)) continue;
          const qty = resolved.qty;
          if(!(qty > 0)) continue;
          const isFront = (String(resolved.name || '').trim() === 'Front') || !!(typeof cfg.isFrontMaterialKey === 'function' && cfg.isFrontMaterialKey(sourceMaterial));
          const materialKey = resolved.materialKey;
          const name = resolved.name;
          const key = `${resolved.sourceSig}||${resolved.direction}||${w}||${h}`;
          const group = ensureGroup(materialKey);
          group.sourceMaterials.add(sourceMaterial);
          group.rooms.add(room);
          const map = isFront ? group.frontMap : group.corpusMap;
          if(map.has(key)){
            map.get(key).qty += qty;
          } else {
            map.set(key, {
              name,
              w,
              h,
              qty,
              material: materialKey,
              sourceSig: resolved.sourceSig,
              grainMode: resolved.direction,
              ignoreGrain: !!resolved.ignoreGrain,
            });
          }
        }
      }
    }

    const materials = Object.keys(groups).sort((a,b)=>a.localeCompare(b,'pl'));
    const outByMat = {};
    const outGroups = {};
    for(const material of materials){
      const group = groups[material];
      const frontParts = sortRozrysParts(Array.from(group.frontMap.values()));
      const corpusParts = sortRozrysParts(Array.from(group.corpusMap.values()));
      const allParts = sortRozrysParts(frontParts.concat(corpusParts));
      outByMat[material] = allParts;
      outGroups[material] = {
        key: material,
        frontParts,
        corpusParts,
        allParts,
        hasFronts: frontParts.length > 0,
        hasCorpus: corpusParts.length > 0,
        sourceMaterials: Array.from(group.sourceMaterials),
        rooms: Array.from(group.rooms),
      };
    }
    return { byMaterial: outByMat, materials, groups: outGroups, selectedRooms: rooms };
  }

  function getScopeSummary(scope, aggregate, deps){
    const cfg = Object.assign({ splitMaterialAccordionTitle:null, aggregatePartsForProject:null }, deps || {});
    const normalized = normalizeMaterialScopeForAggregate(scope, aggregate, { aggregatePartsForProject:cfg.aggregatePartsForProject });
    const modeLabel = normalized.includeFronts && normalized.includeCorpus ? 'Fronty + korpusy' : (normalized.includeFronts ? 'Same fronty' : 'Same korpusy');
    if(normalized.kind !== 'material'){
      return { title:'Wszystkie materiały', subtitle:'', detail:modeLabel };
    }
    const split = typeof cfg.splitMaterialAccordionTitle === 'function'
      ? cfg.splitMaterialAccordionTitle(normalized.material)
      : { line1:normalized.material || 'Materiał', line2:'' };
    return {
      title: split.line1 || normalized.material || 'Materiał',
      subtitle: split.line2 || '',
      detail: modeLabel
    };
  }

  function getRoomsSummary(rooms, deps){
    const cfg = Object.assign({ getRooms:null }, deps || {});
    const normalized = decodeRoomsSelection(rooms, cfg);
    const allRooms = typeof cfg.getRooms === 'function' ? cfg.getRooms() : [];
    if(!normalized.length) return { title:'Brak pomieszczeń', subtitle:'' };
    if(normalized.length === allRooms.length) return { title:'Wszystkie pomieszczenia', subtitle:normalized.map(roomLabel).join(' • ') };
    if(normalized.length === 1) return { title:roomLabel(normalized[0]), subtitle:'Jedno pomieszczenie' };
    return { title:`${normalized.length} pomieszczenia`, subtitle:normalized.map(roomLabel).join(' • ') };
  }


  function createApi(ctx){
    const cfg = Object.assign({
      getRooms: null,
      getAggregatePartsForProject: null,
      splitMaterialAccordionTitle: null,
    }, ctx || {});

    const getRoomsBound = ()=> (typeof cfg.getRooms === 'function' ? cfg.getRooms() : []);
    const getAggregatePartsForProject = ()=> (typeof cfg.getAggregatePartsForProject === 'function' ? cfg.getAggregatePartsForProject() : null);
    const getAggregatePartsForProjectFn = ()=>{
      const fn = getAggregatePartsForProject();
      return typeof fn === 'function' ? fn : null;
    };

    return {
      roomLabel,
      normalizeRoomSelection: (rooms)=> normalizeRoomSelection(rooms, { getRooms: getRoomsBound }),
      encodeRoomsSelection: (rooms)=> encodeRoomsSelection(rooms, { getRooms: getRoomsBound }),
      decodeRoomsSelection: (raw)=> decodeRoomsSelection(raw, { getRooms: getRoomsBound }),
      makeMaterialScope,
      encodeMaterialScope,
      decodeMaterialScope,
      sortRozrysParts,
      getGroupPartsForScope,
      normalizeMaterialScopeForAggregate: (selection, aggregate)=> normalizeMaterialScopeForAggregate(selection, aggregate, { aggregatePartsForProject: getAggregatePartsForProjectFn() }),
      getRozrysScopeMode,
      getOrderedMaterialsForSelection: (selection, aggregate)=> getOrderedMaterialsForSelection(selection, aggregate, { aggregatePartsForProject: getAggregatePartsForProjectFn() }),
      getAccordionScopeKey: (selection, aggregate)=> getAccordionScopeKey(selection, aggregate, { getRooms: getRoomsBound }),
      aggregatePartsForProject: (selectedRooms, deps)=> aggregatePartsForProject(selectedRooms, deps),
      getScopeSummary: (scope, aggregate)=> getScopeSummary(scope, aggregate, {
        splitMaterialAccordionTitle: typeof cfg.splitMaterialAccordionTitle === 'function' ? cfg.splitMaterialAccordionTitle : null,
        aggregatePartsForProject: getAggregatePartsForProjectFn(),
      }),
      getRoomsSummary: (rooms)=> getRoomsSummary(rooms, { getRooms: getRoomsBound }),
    };
  }

  FC.rozrysScope = {
    createApi,
    roomLabel,
    normalizeRoomSelection,
    encodeRoomsSelection,
    decodeRoomsSelection,
    makeMaterialScope,
    encodeMaterialScope,
    decodeMaterialScope,
    sortRozrysParts,
    getGroupPartsForScope,
    normalizeMaterialScopeForAggregate,
    getRozrysScopeMode,
    getOrderedMaterialsForSelection,
    getAccordionScopeKey,
    aggregatePartsForProject,
    getScopeSummary,
    getRoomsSummary,
  };
})();
