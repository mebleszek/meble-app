(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const state = {
    investorId: null,
    isEditing: false,
    dirty: false,
    initialDraft: null,
    draft: null,
  };

  function clone(obj){
    try{ return JSON.parse(JSON.stringify(obj || {})); }catch(_){ return Object.assign({}, obj || {}); }
  }

  function normalizeText(value){
    return String(value == null ? '' : value);
  }

  function normalizeDate(value){
    const text = normalizeText(value).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }
  function normalizeCarrying(value){
    try{ if(FC.investorCarrying && typeof FC.investorCarrying.normalizeCarrying === 'function') return FC.investorCarrying.normalizeCarrying(value); }catch(_){ }
    const src = value && typeof value === 'object' ? value : {};
    const elevator = src.elevator && typeof src.elevator === 'object' ? src.elevator : {};
    const t = (v)=> normalizeText(v);
    return {
      floorNumber:t(src.floorNumber),
      elevatorStatus:['yes','no'].includes(t(src.elevatorStatus)) ? t(src.elevatorStatus) : '',
      elevator:{
        doorWidthCm:t(elevator.doorWidthCm),
        doorHeightCm:t(elevator.doorHeightCm),
        cabinWidthCm:t(elevator.cabinWidthCm),
        cabinDepthCm:t(elevator.cabinDepthCm),
        cabinHeightCm:t(elevator.cabinHeightCm),
        capacityKg:t(elevator.capacityKg)
      },
      note:t(src.note)
    };
  }

  function normalizeTransport(value){
    try{ if(FC.investorTransport && typeof FC.investorTransport.normalizeTransport === 'function') return FC.investorTransport.normalizeTransport(value); }catch(_){ }
    const src = value && typeof value === 'object' ? value : {};
    return {
      distanceKm: normalizeText(src.distanceKm),
      durationMin: normalizeText(src.durationMin),
      source: normalizeText(src.source),
      provider: normalizeText(src.provider),
      status: normalizeText(src.status),
      calculatedAt: normalizeText(src.calculatedAt),
      origin: normalizeText(src.origin),
      destination: normalizeText(src.destination),
      routeProfile: normalizeText(src.routeProfile),
      originHash: normalizeText(src.originHash),
      destinationHash: normalizeText(src.destinationHash),
      addressHash: normalizeText(src.addressHash || src.routeAddressHash),
      routeDistanceMeters: normalizeText(src.routeDistanceMeters),
      routeDurationSeconds: normalizeText(src.routeDurationSeconds),
      originGeocode: src.originGeocode && typeof src.originGeocode === 'object' ? clone(src.originGeocode) : {},
      destinationGeocode: src.destinationGeocode && typeof src.destinationGeocode === 'object' ? clone(src.destinationGeocode) : {},
      orsMapsUrl: normalizeText(src.orsMapsUrl),
      note: normalizeText(src.note),
      lastError: normalizeText(src.lastError),
    };
  }

  function buildDraft(inv){
    const investor = inv || {};
    return {
      kind: investor.kind === 'company' ? 'company' : 'person',
      name: normalizeText(investor.name),
      companyName: normalizeText(investor.companyName),
      ownerName: normalizeText(investor.ownerName || investor.companyOwner),
      phone: normalizeText(investor.phone),
      email: normalizeText(investor.email),
      city: normalizeText(investor.city),
      address: normalizeText(investor.address),
      source: normalizeText(investor.source),
      nip: normalizeText(investor.nip),
      notes: normalizeText(investor.notes),
      addedDate: normalizeDate(investor.addedDate),
      transport: normalizeTransport(investor.transport),
      carrying: normalizeCarrying(investor.carrying),
    };
  }

  function snapshotSignature(draft){
    return JSON.stringify({
      kind: normalizeText(draft && draft.kind),
      name: normalizeText(draft && draft.name),
      companyName: normalizeText(draft && draft.companyName),
      ownerName: normalizeText(draft && draft.ownerName),
      phone: normalizeText(draft && draft.phone),
      email: normalizeText(draft && draft.email),
      city: normalizeText(draft && draft.city),
      address: normalizeText(draft && draft.address),
      source: normalizeText(draft && draft.source),
      nip: normalizeText(draft && draft.nip),
      notes: normalizeText(draft && draft.notes),
      addedDate: normalizeDate(draft && draft.addedDate),
      transport: normalizeTransport(draft && draft.transport),
      carrying: normalizeCarrying(draft && draft.carrying),
    });
  }

  function syncDirty(){
    state.dirty = snapshotSignature(state.draft || {}) !== snapshotSignature(state.initialDraft || {});
    return state.dirty;
  }

  function ensureInvestor(inv){
    const id = inv && inv.id ? String(inv.id) : null;
    if(state.investorId !== id){
      state.investorId = id;
      state.isEditing = false;
      state.initialDraft = buildDraft(inv);
      state.draft = buildDraft(inv);
      state.dirty = false;
    }else if(!state.isEditing && !state.dirty){
      state.initialDraft = buildDraft(inv);
      state.draft = buildDraft(inv);
    }
    return state;
  }

  function enter(inv){
    ensureInvestor(inv);
    state.isEditing = true;
    state.initialDraft = buildDraft(inv);
    state.draft = buildDraft(inv);
    state.dirty = false;
    return clone(state.draft);
  }

  function exit(inv){
    ensureInvestor(inv);
    state.isEditing = false;
    state.initialDraft = buildDraft(inv);
    state.draft = buildDraft(inv);
    state.dirty = false;
    return clone(state.draft);
  }

  function setField(key, value){
    if(!state.draft) state.draft = {};
    state.draft[key] = (key === 'addedDate') ? normalizeDate(value) : normalizeText(value);
    if(key === 'kind'){
      if(state.draft.kind !== 'company') state.draft.nip = '';
      if(state.draft.kind === 'company') state.draft.name = '';
      if(state.draft.kind !== 'company') state.draft.companyName = '';
      if(state.draft.kind !== 'company') state.draft.ownerName = '';
    }
    syncDirty();
    return clone(state.draft);
  }

  function getDraft(inv){
    ensureInvestor(inv);
    return clone(state.draft);
  }

  function setTransportField(key, value){
    if(!state.draft) state.draft = {};
    state.draft.transport = normalizeTransport(state.draft.transport);
    state.draft.transport[key] = normalizeText(value);
    if(key === 'distanceKm' || key === 'durationMin'){
      state.draft.transport.source = 'ręcznie';
      state.draft.transport.provider = '';
      state.draft.transport.status = 'manual';
      state.draft.transport.calculatedAt = '';
      state.draft.transport.origin = '';
      state.draft.transport.destination = '';
      state.draft.transport.routeProfile = '';
      state.draft.transport.originHash = '';
      state.draft.transport.destinationHash = '';
      state.draft.transport.addressHash = '';
      state.draft.transport.routeDistanceMeters = '';
      state.draft.transport.routeDurationSeconds = '';
      state.draft.transport.originGeocode = {};
      state.draft.transport.destinationGeocode = {};
      state.draft.transport.orsMapsUrl = '';
      state.draft.transport.lastError = '';
    }else if(key === 'note'){
      state.draft.transport.source = state.draft.transport.source || 'ręcznie';
      state.draft.transport.status = state.draft.transport.status || 'manual';
    }
    syncDirty();
    return clone(state.draft);
  }

  function setCarryingField(key, value){
    if(!state.draft) state.draft = {};
    state.draft.carrying = normalizeCarrying(state.draft.carrying);
    if(key === 'elevatorStatus'){
      state.draft.carrying.elevatorStatus = normalizeText(value) === 'yes' ? 'yes' : 'no';
    }else if(key === 'floorNumber' || key === 'note'){
      state.draft.carrying[key] = normalizeText(value);
    }else{
      state.draft.carrying.elevator = state.draft.carrying.elevator || {};
      state.draft.carrying.elevator[key] = normalizeText(value);
    }
    syncDirty();
    return clone(state.draft);
  }

  function buildPatchFromDraft(draft){
    const d = draft || {};
    const isCompany = d.kind === 'company';
    return {
      kind: isCompany ? 'company' : 'person',
      name: isCompany ? '' : normalizeText(d.name),
      companyName: isCompany ? normalizeText(d.companyName) : '',
      ownerName: isCompany ? normalizeText(d.ownerName) : '',
      phone: normalizeText(d.phone),
      email: normalizeText(d.email),
      city: normalizeText(d.city),
      address: normalizeText(d.address),
      source: normalizeText(d.source),
      nip: isCompany ? normalizeText(d.nip) : '',
      notes: normalizeText(d.notes),
      addedDate: normalizeDate(d.addedDate),
      transport: normalizeTransport(d.transport),
      carrying: normalizeCarrying(d.carrying),
    };
  }

  function commit(inv){
    ensureInvestor(inv);
    const patch = buildPatchFromDraft(state.draft);
    state.initialDraft = buildDraft(Object.assign({}, inv || {}, patch));
    state.draft = clone(state.initialDraft);
    state.dirty = false;
    state.isEditing = false;
    return patch;
  }

  function hasUiLock(){
    return !!state.isEditing;
  }

  FC.investorEditorState = {
    state,
    ensureInvestor,
    buildDraft,
    buildPatchFromDraft,
    enter,
    exit,
    setField,
    setTransportField,
    setCarryingField,
    getDraft,
    commit,
    hasUiLock,
    syncDirty,
  };
})();
