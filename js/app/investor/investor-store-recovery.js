(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const KEY_BACKUP = 'fc_investors_backup_v1';
  const KEY_BACKUP_META = 'fc_investors_backup_meta_v1';
  const SLOT_PREFIX = 'fc_project_inv_';
  const SLOT_SUFFIX = '_v1';
  const GENERIC_PROJECT_TITLES = new Set(['projekt meblowy', 'projekt', 'oferta']);

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function safeParse(raw){
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(_){ return null; }
  }

  function parseInvestorListRaw(raw){
    const parsed = safeParse(raw);
    if(Array.isArray(parsed)) return parsed.slice();
    if(!(parsed && typeof parsed === 'object')) return [];
    if(Array.isArray(parsed.items)) return parsed.items.slice();
    if(Array.isArray(parsed.list)) return parsed.list.slice();
    const values = Object.keys(parsed).map((key)=> parsed[key]);
    return values.every((item)=> item && typeof item === 'object') ? values : [];
  }

  function toDateInput(value){
    const text = String(value == null ? '' : value).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const numeric = Number(value);
    if(Number.isFinite(numeric) && numeric > 0){
      try{ return new Date(numeric).toISOString().slice(0, 10); }catch(_){ }
    }
    return '';
  }

  function trimText(value){
    return String(value == null ? '' : value).trim();
  }

  function inferBaseType(roomId){
    const match = String(roomId || '').trim().match(/^room_([^_]+)/i);
    return match ? String(match[1] || '').trim() : '';
  }

  function buildRoom(roomId, label, status){
    const id = trimText(roomId);
    if(!id) return null;
    const text = trimText(label) || id;
    return {
      id,
      baseType: inferBaseType(id),
      name: text,
      label: text,
      projectStatus: trimText(status) || 'nowy',
    };
  }

  function mergeRooms(currentRooms, incomingRooms){
    const map = new Map();
    (Array.isArray(currentRooms) ? currentRooms : []).forEach((room)=> {
      const key = trimText(room && room.id);
      if(!key) return;
      map.set(key, clone(room));
    });
    (Array.isArray(incomingRooms) ? incomingRooms : []).forEach((room)=> {
      const key = trimText(room && room.id);
      if(!key) return;
      const prev = map.get(key) || {};
      map.set(key, {
        id: key,
        baseType: trimText(prev.baseType) || trimText(room.baseType) || inferBaseType(key),
        name: trimText(prev.name) || trimText(room.name) || trimText(room.label) || key,
        label: trimText(prev.label) || trimText(room.label) || trimText(room.name) || key,
        projectStatus: trimText(prev.projectStatus) || trimText(room.projectStatus) || 'nowy',
      });
    });
    return Array.from(map.values());
  }

  function minPositive(a, b){
    const nums = [Number(a), Number(b)].filter((value)=> Number.isFinite(value) && value > 0);
    if(!nums.length) return 0;
    return Math.min.apply(null, nums);
  }

  function maxPositive(a, b){
    const nums = [Number(a), Number(b)].filter((value)=> Number.isFinite(value) && value > 0);
    if(!nums.length) return 0;
    return Math.max.apply(null, nums);
  }

  function isWeakName(text){
    const normalized = trimText(text).toLowerCase();
    if(!normalized) return true;
    if(GENERIC_PROJECT_TITLES.has(normalized)) return true;
    if(/^inwestor\b/.test(normalized)) return true;
    if(/^projekt\b/.test(normalized)) return true;
    return false;
  }

  function pickText(current, incoming){
    const cur = trimText(current);
    const next = trimText(incoming);
    if(!cur) return next;
    if(!next) return cur;
    return cur;
  }

  function pickName(current, incoming){
    const cur = trimText(current);
    const next = trimText(incoming);
    if(!cur) return next;
    if(!next) return cur;
    if(isWeakName(cur) && !isWeakName(next)) return next;
    return cur;
  }

  function inferNameFromProjectTitle(title){
    const text = trimText(title);
    if(!text || isWeakName(text)) return '';
    return text;
  }

  function roomIdsFromProjectData(projectData){
    const data = projectData && typeof projectData === 'object' ? projectData : {};
    const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
    const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
    const order = Array.isArray(meta.roomOrder) ? meta.roomOrder.map((item)=> trimText(item)).filter(Boolean) : [];
    const ids = order.slice();
    Object.keys(defs).forEach((key)=> { if(key && !ids.includes(key)) ids.push(key); });
    Object.keys(data).forEach((key)=> {
      if(key === 'schemaVersion' || key === 'meta') return;
      const room = data[key];
      if(room && typeof room === 'object' && Array.isArray(room.cabinets) && !ids.includes(key)) ids.push(key);
    });
    return ids;
  }

  function roomsFromProjectData(projectData, status){
    const data = projectData && typeof projectData === 'object' ? projectData : {};
    const meta = data.meta && typeof data.meta === 'object' ? data.meta : {};
    const defs = meta.roomDefs && typeof meta.roomDefs === 'object' ? meta.roomDefs : {};
    return roomIdsFromProjectData(data).map((roomId)=> {
      const def = defs[roomId] && typeof defs[roomId] === 'object' ? defs[roomId] : {};
      const label = trimText(def.label) || trimText(def.name) || roomId;
      return buildRoom(roomId, label, trimText(def.projectStatus) || status || 'nowy');
    }).filter(Boolean);
  }

  function roomsFromScope(scope, status){
    const source = scope && typeof scope === 'object' ? scope : {};
    const ids = Array.isArray(source.selectedRooms) ? source.selectedRooms.map((item)=> trimText(item)).filter(Boolean) : [];
    const labels = Array.isArray(source.roomLabels) ? source.roomLabels.map((item)=> trimText(item)) : [];
    return ids.map((roomId, index)=> buildRoom(roomId, labels[index] || roomId, status)).filter(Boolean);
  }

  function investorFromSnapshot(row){
    const snapshot = row && typeof row === 'object' ? row : {};
    const investor = snapshot.investor && typeof snapshot.investor === 'object' ? snapshot.investor : {};
    const project = snapshot.project && typeof snapshot.project === 'object' ? snapshot.project : {};
    const id = trimText(investor.id) || trimText(project.investorId);
    if(!id) return null;
    return {
      id,
      kind: trimText(investor.kind) || (trimText(investor.companyName) ? 'company' : 'person'),
      name: trimText(investor.name),
      companyName: trimText(investor.companyName),
      ownerName: trimText(investor.ownerName || investor.companyOwner),
      phone: trimText(investor.phone),
      email: trimText(investor.email),
      city: trimText(investor.city),
      address: trimText(investor.address),
      source: trimText(investor.source),
      nip: trimText(investor.nip),
      notes: trimText(investor.notes),
      rooms: roomsFromScope(snapshot.scope, trimText(project.status) || 'nowy'),
      addedDate: toDateInput(snapshot.generatedAt),
      createdAt: Number(snapshot.generatedAt) || 0,
      updatedAt: Number(snapshot.generatedAt) || 0,
      meta:{ source:'quote-snapshot-recovery' }
    };
  }

  function investorFromProjectRecord(row){
    const record = row && typeof row === 'object' ? row : {};
    const id = trimText(record.investorId);
    if(!id) return null;
    return {
      id,
      kind:'person',
      name: inferNameFromProjectTitle(record.title),
      companyName:'',
      ownerName:'',
      phone:'',
      email:'',
      city:'',
      address:'',
      source:'',
      nip:'',
      notes:'',
      rooms: roomsFromProjectData(record.projectData, trimText(record.status) || 'nowy'),
      addedDate: toDateInput(record.createdAt),
      createdAt: Number(record.createdAt) || 0,
      updatedAt: Number(record.updatedAt) || 0,
      meta:{ source:'project-store-recovery' }
    };
  }

  function investorFromDraft(row){
    const draft = row && typeof row === 'object' ? row : {};
    const id = trimText(draft.investorId);
    if(!id) return null;
    return {
      id,
      kind:'person',
      name:'',
      companyName:'',
      ownerName:'',
      phone:'',
      email:'',
      city:'',
      address:'',
      source:'',
      nip:'',
      notes:'',
      rooms: [],
      addedDate: toDateInput(draft.updatedAt),
      createdAt: Number(draft.updatedAt) || 0,
      updatedAt: Number(draft.updatedAt) || 0,
      meta:{ source:'quote-draft-recovery' }
    };
  }

  function investorFromSlotId(id){
    const key = trimText(id);
    if(!key) return null;
    return {
      id:key,
      kind:'person',
      name:'',
      companyName:'',
      ownerName:'',
      phone:'',
      email:'',
      city:'',
      address:'',
      source:'',
      nip:'',
      notes:'',
      rooms: [],
      addedDate:'',
      createdAt:0,
      updatedAt:0,
      meta:{ source:'project-slot-recovery' }
    };
  }

  function mergeInvestor(base, incoming){
    const current = base && typeof base === 'object' ? base : {};
    const next = incoming && typeof incoming === 'object' ? incoming : {};
    return {
      id: trimText(current.id) || trimText(next.id),
      kind: trimText(current.kind) === 'company' || trimText(next.kind) === 'company' ? 'company' : 'person',
      name: pickName(current.name, next.name),
      companyName: pickName(current.companyName, next.companyName),
      ownerName: pickText(current.ownerName, next.ownerName),
      phone: pickText(current.phone, next.phone),
      email: pickText(current.email, next.email),
      city: pickText(current.city, next.city),
      address: pickText(current.address, next.address),
      source: pickText(current.source, next.source),
      nip: pickText(current.nip, next.nip),
      notes: pickText(current.notes, next.notes),
      rooms: mergeRooms(current.rooms, next.rooms),
      addedDate: toDateInput(current.addedDate) || toDateInput(next.addedDate) || toDateInput(minPositive(current.createdAt, next.createdAt)),
      createdAt: minPositive(current.createdAt, next.createdAt),
      updatedAt: maxPositive(current.updatedAt, next.updatedAt),
      meta: Object.assign({}, clone(current.meta || {}), clone(next.meta || {})),
    };
  }

  function slotInvestorIds(){
    const ids = [];
    try{
      const total = Number(localStorage && localStorage.length);
      for(let i = 0; i < total; i += 1){
        const key = typeof localStorage.key === 'function' ? localStorage.key(i) : '';
        const match = String(key || '').match(/^fc_project_inv_(.+)_v1$/);
        if(match && trimText(match[1])) ids.push(trimText(match[1]));
      }
    }catch(_){ }
    return Array.from(new Set(ids));
  }

  function getStorageKey(name, fallback){
    try{
      const keys = FC.constants && FC.constants.STORAGE_KEYS ? FC.constants.STORAGE_KEYS : null;
      if(keys && keys[name]) return String(keys[name]);
    }catch(_){ }
    return String(fallback || '');
  }

  function readRowsFromStorage(key){
    const rawKey = trimText(key);
    if(!rawKey) return [];
    try{
      const parsed = safeParse(localStorage.getItem(rawKey));
      return Array.isArray(parsed) ? parsed.slice() : [];
    }catch(_){ return []; }
  }

  function backupInvestors(list){
    try{
      localStorage.setItem(KEY_BACKUP, JSON.stringify(Array.isArray(list) ? list : []));
      localStorage.setItem(KEY_BACKUP_META, JSON.stringify({ savedAt:Date.now(), count:Array.isArray(list) ? list.length : 0 }));
    }catch(_){ }
  }

  function recoverList(options){
    const opts = options && typeof options === 'object' ? options : {};
    const normalizeInvestor = typeof opts.normalizeInvestor === 'function' ? opts.normalizeInvestor : (row)=> clone(row);
    const primaryRaw = Object.prototype.hasOwnProperty.call(opts, 'primaryRaw') ? opts.primaryRaw : null;
    const backupRaw = Object.prototype.hasOwnProperty.call(opts, 'backupRaw') ? opts.backupRaw : null;
    const currentInvestorId = trimText(opts.currentInvestorId);
    const primaryList = Array.isArray(opts.primaryList) ? opts.primaryList.map((row)=> normalizeInvestor(row)).filter(Boolean) : parseInvestorListRaw(primaryRaw).map((row)=> normalizeInvestor(row)).filter(Boolean);
    const backupList = parseInvestorListRaw(backupRaw).map((row)=> normalizeInvestor(row)).filter(Boolean);
    const projectRows = Array.isArray(opts.projectRows) ? opts.projectRows.slice() : readRowsFromStorage(getStorageKey('projects', 'fc_projects_v1'));
    const draftRows = Array.isArray(opts.draftRows) ? opts.draftRows.slice() : readRowsFromStorage(getStorageKey('quoteOfferDrafts', 'fc_quote_offer_drafts_v1'));
    const snapshotRows = Array.isArray(opts.snapshotRows) ? opts.snapshotRows.slice() : readRowsFromStorage(getStorageKey('quoteSnapshots', 'fc_quote_snapshots_v1'));
    const slotIds = Array.isArray(opts.slotIds) ? opts.slotIds.map((id)=> trimText(id)).filter(Boolean) : slotInvestorIds();

    const primaryIds = new Set(primaryList.map((row)=> trimText(row && row.id)).filter(Boolean));
    const backupIds = new Set(backupList.map((row)=> trimText(row && row.id)).filter(Boolean));
    const projectIds = new Set(projectRows.map((row)=> trimText(row && row.investorId)).filter(Boolean));
    const draftIds = new Set(draftRows.map((row)=> trimText(row && row.investorId)).filter(Boolean));
    const strongIds = new Set(Array.from(backupIds));
    projectIds.forEach((id)=> strongIds.add(id));

    const allowWeakRecovery = !primaryIds.size;
    const eligibleSlotIds = [];
    const recovered = new Map();

    function upsert(row){
      const id = trimText(row && row.id);
      if(!id) return;
      const normalized = normalizeInvestor(row);
      const prev = recovered.get(id) || null;
      recovered.set(id, normalizeInvestor(prev ? mergeInvestor(prev, normalized) : normalized));
    }

    primaryList.forEach(upsert);
    backupList.forEach(upsert);
    projectRows.map(investorFromProjectRecord).filter(Boolean).forEach(upsert);
    draftRows.map(investorFromDraft).filter(Boolean).forEach((row)=> {
      if(allowWeakRecovery || strongIds.has(row.id) || primaryIds.has(row.id) || (currentInvestorId && row.id === currentInvestorId)) upsert(row);
    });
    snapshotRows.map(investorFromSnapshot).filter(Boolean).forEach((row)=> {
      if(allowWeakRecovery || strongIds.has(row.id) || draftIds.has(row.id) || primaryIds.has(row.id)) upsert(row);
    });

    if(allowWeakRecovery && !recovered.size && currentInvestorId && slotIds.includes(currentInvestorId)) upsert(investorFromSlotId(currentInvestorId));

    const list = Array.from(recovered.values());
    const missingStrongIds = Array.from(strongIds).filter((id)=> id && !primaryIds.has(id));
    const repaired = !!(missingStrongIds.length || (backupIds.size > primaryIds.size) || (primaryIds.size === 0 && list.length > 0));
    return {
      list,
      repaired,
      stats:{
        primaryCount: primaryList.length,
        backupCount: backupList.length,
        projectCount: projectRows.length,
        draftCount: draftRows.length,
        snapshotCount: snapshotRows.length,
        slotCount: eligibleSlotIds.length,
        recoveredCount: list.length,
        missingStrongIds,
      }
    };
  }

  FC.investorStoreRecovery = {
    KEY_BACKUP,
    KEY_BACKUP_META,
    parseInvestorListRaw,
    recoverList,
    backupInvestors,
  };
})();
