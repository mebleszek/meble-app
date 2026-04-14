(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const BASE_LABELS = {
    kuchnia:'Kuchnia',
    szafa:'Szafa',
    pokoj:'Pokój',
    lazienka:'Łazienka'
  };

  function clone(obj){
    try{ return (FC.utils && FC.utils.clone) ? FC.utils.clone(obj) : JSON.parse(JSON.stringify(obj)); }
    catch(_){ return JSON.parse(JSON.stringify(obj || {})); }
  }

  function getProject(){
    try{ if(typeof projectData !== 'undefined' && projectData) return projectData; }catch(_){ }
    try{ if(window.projectData) return window.projectData; }catch(_){ }
    return null;
  }

  function saveProject(proj, opts){
    const cfg = Object.assign({ suspendSessionTracking:true }, opts || {});
    try{
      if(typeof projectData !== 'undefined') projectData = proj;
      window.projectData = proj;
    }catch(_){ }
    try{
      if(FC.project && typeof FC.project.save === 'function'){
        const shouldSuspend = !!cfg.suspendSessionTracking;
        const previous = !!FC.project.__suspendSessionTracking;
        if(shouldSuspend) FC.project.__suspendSessionTracking = true;
        try{ FC.project.save(proj); }
        finally{ FC.project.__suspendSessionTracking = previous; }
      }
    }catch(_){ }
  }

  function getCurrentInvestor(){
    try{
      if(FC.investors && typeof FC.investors.getCurrentId === 'function' && typeof FC.investors.getById === 'function'){
        const id = FC.investors.getCurrentId();
        return id ? FC.investors.getById(id) : null;
      }
    }catch(_){ }
    return null;
  }

  function ensureProjectMeta(proj){
    if(!proj || typeof proj !== 'object') return null;
    proj.meta = proj.meta || {};
    proj.meta.roomDefs = proj.meta.roomDefs || {};
    proj.meta.roomOrder = Array.isArray(proj.meta.roomOrder) ? proj.meta.roomOrder : [];
    return proj.meta;
  }

  function discoverProjectRoomKeys(proj){
    if(!proj || typeof proj !== 'object') return [];
    return Object.keys(proj).filter((key)=>{
      if(!key || key === 'schemaVersion' || key === 'meta') return false;
      const room = proj[key];
      return !!(room && typeof room === 'object' && (Array.isArray(room.cabinets) || Array.isArray(room.fronts) || Array.isArray(room.sets) || room.settings));
    });
  }

  function roomTemplate(baseType){
    const defs = (FC.project && FC.project.DEFAULT_PROJECT) || (FC.schema && FC.schema.DEFAULT_PROJECT) || {};
    return clone(defs[baseType] || defs.kuchnia || { cabinets:[], fronts:[], sets:[], settings:{} });
  }

  function slugify(text){
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'pomieszczenie';
  }

  function makeRoomId(baseType, name){
    return 'room_' + String(baseType || 'pokoj') + '_' + slugify(name || BASE_LABELS[baseType] || 'pomieszczenie') + '_' + Date.now().toString(36).slice(-6);
  }

  function normalizeLabel(text){
    return String(text || '').trim().replace(/\s+/g, ' ');
  }

  function prettifyTechnicalRoomText(text, fallbackBaseType){
    const raw = String(text || '').trim();
    if(!raw) return '';
    const match = raw.match(/^room_([^_]+)_(.+)_([a-z0-9]{4,})$/i);
    if(!match) return raw;
    const baseType = String(match[1] || fallbackBaseType || '').trim();
    let middle = String(match[2] || '').trim();
    if(baseType && middle.toLowerCase().startsWith(baseType.toLowerCase() + '_')) middle = middle.slice(baseType.length + 1);
    middle = middle.replace(/_/g, ' ').trim();
    if(!middle) middle = BASE_LABELS[baseType] || baseType || raw;
    return middle;
  }

  function normalizeComparableLabel(text){
    return normalizeLabel(text)
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (ch)=> ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'}[ch] || ch))
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function normalizeRoomDef(raw, fallback){
    const src = Object.assign({}, fallback || {}, raw || {});
    const baseType = String(src.baseType || src.kind || src.type || fallback && fallback.baseType || 'pokoj');
    const id = String(src.id || fallback && fallback.id || '');
    const rawName = src.name || src.label || fallback && fallback.name || BASE_LABELS[baseType] || id;
    const safeName = prettifyTechnicalRoomText(rawName, baseType);
    const safeLabel = prettifyTechnicalRoomText(src.label || safeName, baseType);
    const finalName = normalizeLabel(safeName || BASE_LABELS[baseType] || id);
    const finalLabel = normalizeLabel(safeLabel || finalName);
    return {
      id,
      baseType,
      name: finalName,
      label: finalLabel,
      legacy: !!src.legacy,
    };
  }

  function getProjectRoomDefs(proj){
    const meta = ensureProjectMeta(proj);
    const defs = [];
    if(meta){
      meta.roomOrder.forEach((id)=>{
        const raw = meta.roomDefs[id];
        if(raw && !defs.find((x)=> x.id === id)) defs.push(normalizeRoomDef(raw, { id, baseType: raw.baseType || id }));
      });
      Object.keys(meta.roomDefs).forEach((id)=>{
        const raw = meta.roomDefs[id];
        if(raw && !defs.find((x)=> x.id === id)) defs.push(normalizeRoomDef(raw, { id, baseType: raw.baseType || id }));
      });
    }
    if(defs.length) return defs;
    return discoverProjectRoomKeys(proj).map((id)=> normalizeRoomDef({ id, baseType:id, name:BASE_LABELS[id] || id, label:BASE_LABELS[id] || id }));
  }

  function hasLegacyKitchen(proj){
    if(!proj || typeof proj !== 'object') return false;
    const room = proj.kuchnia;
    return !!(room && typeof room === 'object' && (Array.isArray(room.cabinets) && room.cabinets.length || Array.isArray(room.fronts) && room.fronts.length || Array.isArray(room.sets) && room.sets.length));
  }

  function createLegacyKitchenDef(){
    return normalizeRoomDef({ id:'kuchnia', baseType:'kuchnia', name:'kuchnia stary program', label:'kuchnia stary program', legacy:true });
  }

  function hasCurrentInvestor(){ return !!getCurrentInvestor(); }

  function getActiveRoomDefs(){
    const proj = getProject();
    const inv = getCurrentInvestor();
    const defs = [];
    const seen = new Set();
    const push = (room)=>{
      const normalized = normalizeRoomDef(room);
      if(!normalized.id || seen.has(normalized.id)) return;
      seen.add(normalized.id);
      defs.push(normalized);
    };

    const projectMetaRooms = getProjectRoomDefs(proj);
    const projectMap = new Map(projectMetaRooms.map((room)=> [room.id, room]));

    if(inv && Array.isArray(inv.rooms) && inv.rooms.length){
      inv.rooms.forEach((room)=>{
        const id = String(room && room.id || '');
        push(Object.assign({}, projectMap.get(id) || {}, room || {}, { id }));
      });
    }else{
      projectMetaRooms.filter((room)=> String(room.id || '').startsWith('room_')).forEach(push);
    }

    if(hasLegacyKitchen(proj) && !seen.has('kuchnia')){
      push(createLegacyKitchenDef());
    }

    return defs;
  }

  function getActiveRoomIds(){
    return getActiveRoomDefs().map((r)=> r.id).filter(Boolean);
  }

  function getRoomLabel(id){
    const key = String(id || '');
    const found = getActiveRoomDefs().find((room)=> room.id === key);
    if(found) return found.label || found.name || prettifyTechnicalRoomText(key, found.baseType) || key;
    return prettifyTechnicalRoomText(key, '') || key || 'Pomieszczenie';
  }

  function ensureRoomData(id, baseType){
    const proj = getProject();
    if(!proj || !id) return null;
    const meta = ensureProjectMeta(proj);
    if(!proj[id]) proj[id] = roomTemplate(baseType);
    if(!meta.roomDefs[id]) meta.roomDefs[id] = { id, baseType, name: BASE_LABELS[baseType] || id, label: BASE_LABELS[baseType] || id };
    if(!meta.roomOrder.includes(id)) meta.roomOrder.push(id);
    saveProject(proj);
    return proj[id];
  }

  function isRoomNameTaken(name, investor, exceptId){
    const normalized = normalizeComparableLabel(name);
    if(!normalized || !investor || !Array.isArray(investor.rooms)) return false;
    return investor.rooms.some((room)=>{
      if(!room) return false;
      if(exceptId && String(room.id || '') === String(exceptId)) return false;
      const label = normalizeComparableLabel(room.label || room.name || '');
      return label === normalized;
    });
  }


  function syncRoomSelectionAfterRemoval(selectedId){
    try{
      if(window.FC && window.FC.uiState && typeof window.FC.uiState.get === 'function' && typeof window.FC.uiState.set === 'function'){
        const st = window.FC.uiState.get();
        if(String(st.roomType || '') === String(selectedId)) window.FC.uiState.set({ roomType:null, lastRoomType:null });
      }else if(typeof uiState !== 'undefined' && uiState){
        if(String(uiState.roomType || '') === String(selectedId)){
          uiState.roomType = null;
          uiState.lastRoomType = null;
          try{ FC.storage && FC.storage.setJSON && typeof STORAGE_KEYS !== 'undefined' && FC.storage.setJSON(STORAGE_KEYS.ui, uiState); }catch(_){ }
        }
      }
    }catch(_){ }
  }

  function syncQuoteDraftSelectionAfterRoomChange(keepIds){
    const allowed = new Set(Array.isArray(keepIds) ? keepIds.map((id)=> String(id || '').trim()).filter(Boolean) : []);
    try{
      if(!(FC.quoteOfferStore && typeof FC.quoteOfferStore.getCurrentDraft === 'function' && typeof FC.quoteOfferStore.patchCurrentDraft === 'function')) return;
      const draft = FC.quoteOfferStore.getCurrentDraft();
      const current = Array.isArray(draft && draft.selection && draft.selection.selectedRooms) ? draft.selection.selectedRooms.map((id)=> String(id || '').trim()).filter(Boolean) : [];
      const next = current.filter((id)=> allowed.has(id));
      if(current.length !== next.length) FC.quoteOfferStore.patchCurrentDraft({ selection:{ selectedRooms:next } });
    }catch(_){ }
  }

  function reconcileStatusesAfterRoomSetChange(inv, keepIds){
    const ids = Array.isArray(keepIds) ? keepIds.map((id)=> String(id || '').trim()).filter(Boolean) : [];
    syncQuoteDraftSelectionAfterRoomChange(ids);
    try{
      if(FC.projectStatusSync && typeof FC.projectStatusSync.reconcileProjectStatuses === 'function'){
        FC.projectStatusSync.reconcileProjectStatuses({
          investorId: inv && inv.id,
          roomIds: ids,
          restrictToRoomIds:true,
          fallbackStatus:'nowy',
          refreshUi:false,
        });
        return;
      }
    }catch(_){ }
    try{
      if(FC.projectStore && typeof FC.projectStore.getByInvestorId === 'function'){
        const record = FC.projectStore.getByInvestorId(inv && inv.id || '');
        if(record && FC.projectStore && typeof FC.projectStore.upsert === 'function'){
          FC.projectStore.upsert(Object.assign({}, record, { status:'nowy', updatedAt:Date.now() }));
        }
      }
    }catch(_){ }
    try{
      const proj = getProject() || {};
      const meta = ensureProjectMeta(proj);
      if(meta) meta.projectStatus = 'nowy';
      saveProject(proj);
    }catch(_){ }
  }

  function updateInvestorRooms(inv, rooms){
    try{ FC.investors && FC.investors.update && FC.investors.update(inv.id, { rooms }); }catch(_){ }
  }

  function removeRoomById(roomId){
    const inv = getCurrentInvestor();
    const selectedId = String(roomId || '').trim();
    if(!(inv && selectedId)) return null;
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    try{ delete proj[selectedId]; }catch(_){ }
    try{ if(meta && meta.roomDefs) delete meta.roomDefs[selectedId]; }catch(_){ }
    try{ if(meta && Array.isArray(meta.roomOrder)) meta.roomOrder = meta.roomOrder.filter((id)=> String(id || '') !== selectedId); }catch(_){ }
    saveProject(proj);
    const currentRooms = Array.isArray(inv.rooms) ? inv.rooms : [];
    const nextRooms = currentRooms.filter((room)=> String(room && room.id || '') !== selectedId).map((room)=> ({
      id: room.id,
      baseType: room.baseType,
      name: room.name,
      label: room.label,
      projectStatus: room.projectStatus || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy'
    }));
    updateInvestorRooms(inv, nextRooms);
    syncRoomSelectionAfterRemoval(selectedId);
    reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
    return selectedId;
  }


  function getManageableRooms(inv){
    const roomMap = new Map();
    const activeRooms = getActiveRoomDefs();
    activeRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(normalized && normalized.id) roomMap.set(String(normalized.id), normalized);
    });
    const investorRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
    investorRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(!(normalized && normalized.id)) return;
      const key = String(normalized.id);
      roomMap.set(key, normalizeRoomDef(Object.assign({}, roomMap.get(key) || {}, normalized), roomMap.get(key) || normalized));
    });
    if(hasLegacyKitchen(getProject()) && !roomMap.has('kuchnia')){
      const legacy = createLegacyKitchenDef();
      roomMap.set('kuchnia', legacy);
    }
    return Array.from(roomMap.values()).filter((room)=> room && room.id);
  }

  function applyManageRoomsDraft(inv, drafts){
    const currentDrafts = Array.isArray(drafts) ? drafts.map((room)=> normalizeRoomDef(room, room)).filter((room)=> room && room.id) : [];
    const keepIds = new Set(currentDrafts.map((room)=> String(room.id || '')));
    const proj = getProject() || {};
    const meta = ensureProjectMeta(proj);
    const previousRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];

    discoverProjectRoomKeys(proj).forEach((roomId)=>{
      const key = String(roomId || '');
      if(key === 'kuchnia' && hasLegacyKitchen(proj)) return;
      if(keepIds.has(key)) return;
      try{ delete proj[key]; }catch(_){ }
      try{ if(meta && meta.roomDefs) delete meta.roomDefs[key]; }catch(_){ }
      try{ if(meta && Array.isArray(meta.roomOrder)) meta.roomOrder = meta.roomOrder.filter((id)=> String(id || '') !== key); }catch(_){ }
      syncRoomSelectionAfterRemoval(key);
    });

    currentDrafts.forEach((room)=>{
      if(!proj[room.id]) proj[room.id] = roomTemplate(room.baseType);
      if(meta && meta.roomDefs) meta.roomDefs[room.id] = { id:room.id, baseType:room.baseType, name:room.name, label:room.label, legacy:!!room.legacy };
      if(meta && Array.isArray(meta.roomOrder) && !meta.roomOrder.includes(room.id)) meta.roomOrder.push(room.id);
    });
    try{ if(meta && Array.isArray(meta.roomOrder)) meta.roomOrder = meta.roomOrder.filter((id)=> keepIds.has(String(id || '')) || String(id || '') === 'kuchnia'); }catch(_){ }
    saveProject(proj);

    const nextRooms = currentDrafts.map((room)=> {
      const prev = previousRooms.find((item)=> String(item && item.id || '') === String(room.id || '')) || {};
      return {
        id: room.id,
        baseType: room.baseType,
        name: room.name,
        label: room.label,
        projectStatus: prev.projectStatus || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy'
      };
    });
    updateInvestorRooms(inv, nextRooms);
    reconcileStatusesAfterRoomSetChange(inv, nextRooms.map((room)=> room.id));
    return nextRooms;
  }

  function getEditableRoom(inv, roomId){
    const activeRooms = getActiveRoomDefs();
    const roomMap = new Map();
    activeRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(normalized && normalized.id) roomMap.set(String(normalized.id), normalized);
    });
    const investorRooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
    investorRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(!(normalized && normalized.id)) return;
      const key = String(normalized.id);
      roomMap.set(key, normalizeRoomDef(Object.assign({}, roomMap.get(key) || {}, normalized), roomMap.get(key) || normalized));
    });
    if(hasLegacyKitchen(getProject()) && !roomMap.has('kuchnia')){
      const legacy = createLegacyKitchenDef();
      roomMap.set('kuchnia', legacy);
    }
    return roomMap.get(String(roomId || '')) || null;
  }

  async function openEditRoomModal(roomId){
    const inv = getCurrentInvestor();
    if(!inv || !(FC.panelBox && typeof FC.panelBox.open === 'function')) return null;
    const room = getEditableRoom(inv, roomId);
    if(!(room && room.id)) return null;
    const h = (tag, attrs, children)=>{
      const el = document.createElement(tag);
      if(attrs){ Object.keys(attrs).forEach((k)=>{ if(k === 'class') el.className = attrs[k]; else if(k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }); }
      (children || []).forEach((ch)=> el.appendChild(ch));
      return el;
    };
    return new Promise((resolve)=>{
      let selectedBase = String(room.baseType || 'pokoj');
      let dirty = false;
      const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock room-registry-modal' });
      const scroll = h('div', { class:'panel-box-form__scroll' });
      const form = h('div', { class:'grid-2 rozrys-panel-grid rozrys-panel-grid--stock room-registry-grid' });
      const baseWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--full' });
      baseWrap.appendChild(h('label', { text:'Typ pomieszczenia' }));
      const chips = h('div', { class:'room-registry-type-grid' });
      Object.keys(BASE_LABELS).forEach((baseType)=>{
        const btn = h('button', { type:'button', class:'room-registry-type-btn' + (baseType === selectedBase ? ' is-selected' : ''), 'data-base':baseType, text:BASE_LABELS[baseType] });
        btn.addEventListener('click', ()=>{
          if(selectedBase === baseType) return;
          selectedBase = baseType;
          dirty = true;
          chips.querySelectorAll('.room-registry-type-btn').forEach((node)=> node.classList.toggle('is-selected', node.getAttribute('data-base') === baseType));
        });
        chips.appendChild(btn);
      });
      baseWrap.appendChild(chips);
      form.appendChild(baseWrap);
      const nameWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--full' });
      nameWrap.appendChild(h('label', { text:'Nazwa pomieszczenia' }));
      const nameInput = h('input', { type:'text', placeholder:'Np. Kuchnia góra / Kuchnia garaż', value:room.label || room.name || '' });
      nameWrap.appendChild(nameInput);
      form.appendChild(nameWrap);
      scroll.appendChild(form);
      body.appendChild(scroll);
      const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = h('div', { class:'rozrys-panel-footer__actions' });
      const deleteBtn = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
      const cancelBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wyjdź' });
      const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
      saveBtn.style.display = 'none';
      actions.appendChild(deleteBtn);
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      footer.appendChild(actions);
      body.appendChild(footer);
      const refreshFooter = ()=>{
        cancelBtn.textContent = dirty ? 'Anuluj' : 'Wyjdź';
        cancelBtn.className = dirty ? 'btn btn-danger' : 'btn btn-primary';
        saveBtn.style.display = dirty ? '' : 'none';
      };
      const done = (result)=>{ try{ FC.panelBox.close(); }catch(_){ } resolve(result || null); };
      const askDiscard = async ()=>{
        if(!dirty) return true;
        try{
          if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
            return await FC.confirmBox.ask({ title:'Anulować zmiany?', message:'Niezapisane zmiany w pomieszczeniu zostaną utracone.', confirmText:'Anuluj', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
          }
        }catch(_){ }
        return true;
      };
      const askDelete = async ()=>{
        try{
          if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
            return await FC.confirmBox.ask({ title:'Usunąć pomieszczenie?', message:'Tej operacji nie cofnisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
          }
        }catch(_){ }
        return true;
      };
      nameInput.addEventListener('input', ()=>{
        dirty = normalizeLabel(nameInput.value) !== normalizeLabel(room.label || room.name || '') || selectedBase !== String(room.baseType || 'pokoj');
        refreshFooter();
      });
      nameInput.addEventListener('change', ()=>{
        dirty = normalizeLabel(nameInput.value) !== normalizeLabel(room.label || room.name || '') || selectedBase !== String(room.baseType || 'pokoj');
        refreshFooter();
      });
      cancelBtn.addEventListener('click', async ()=>{
        const ok = await askDiscard();
        if(ok) done(null);
      });
      saveBtn.addEventListener('click', async ()=>{
        const name = normalizeLabel(nameInput.value);
        if(!name){
          try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak nazwy pomieszczenia', message:'Nadaj nazwę pomieszczeniu, zanim je zapiszesz.' }); }catch(_){ }
          try{ nameInput.focus(); }catch(_){ }
          return;
        }
        if(isRoomNameTaken(name, inv, room.id)){
          try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Ta nazwa już istnieje', message:'Dla tego inwestora istnieje już pomieszczenie o tej nazwie. Nadaj inną nazwę.' }); }catch(_){ }
          try{ nameInput.focus(); nameInput.select && nameInput.select(); }catch(_){ }
          return;
        }
        let confirmed = true;
        try{
          if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
            confirmed = await FC.confirmBox.ask({ title:'Zapisać zmiany?', message:'Zmiany w pomieszczeniu zostaną zapisane.', confirmText:'Zapisz', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' });
          }
        }catch(_){ }
        if(!confirmed) return;
        const proj = getProject() || {};
        const meta = ensureProjectMeta(proj);
        const currentDef = normalizeRoomDef(meta && meta.roomDefs && meta.roomDefs[room.id], room);
        if(meta && meta.roomDefs){
          meta.roomDefs[room.id] = Object.assign({}, currentDef, { id:room.id, baseType:selectedBase, name, label:name });
        }
        if(!proj[room.id]) proj[room.id] = roomTemplate(selectedBase);
        saveProject(proj);
        const currentRooms = Array.isArray(inv.rooms) ? inv.rooms : [];
        const nextRooms = currentRooms.map((item)=> {
          if(String(item && item.id || '') !== String(room.id || '')) return item;
          return Object.assign({}, item || {}, { id:room.id, baseType:selectedBase, name, label:name, projectStatus:(item && item.projectStatus) || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy' });
        });
        updateInvestorRooms(inv, nextRooms);
        dirty = false;
        done({ id:room.id, baseType:selectedBase, name, label:name });
      });
      deleteBtn.addEventListener('click', async ()=>{
        const ok = await askDelete();
        if(!ok) return;
        const removedId = removeRoomById(room.id);
        done(removedId ? { deleted:true, roomId:removedId } : null);
      });
      refreshFooter();
      FC.panelBox.open({ title:'Edytuj pomieszczenie', contentNode: body, width:'640px', boxClass:'panel-box--rozrys' });
      setTimeout(()=>{ try{ nameInput.focus(); nameInput.select && nameInput.select(); }catch(_){ } }, 20);
    });
  }


  async function openManageRoomsModal(){
    const inv = getCurrentInvestor();
    if(!inv || !(FC.panelBox && typeof FC.panelBox.open === 'function')) return null;
    const rooms = getManageableRooms(inv);
    if(!rooms.length){
      try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak pomieszczeń', message:'Najpierw dodaj pomieszczenie, żeby móc nimi zarządzać.' }); }catch(_){ }
      return null;
    }
    const h = (tag, attrs, children)=>{
      const el = document.createElement(tag);
      if(attrs){ Object.keys(attrs).forEach((k)=>{ if(k === 'class') el.className = attrs[k]; else if(k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }); }
      (children || []).forEach((ch)=> el.appendChild(ch));
      return el;
    };
    return new Promise((resolve)=>{
      const cloneDrafts = (list)=> (Array.isArray(list) ? list.map((room)=> ({ id:room.id, baseType:room.baseType, name:room.name, label:room.label, legacy:!!room.legacy })) : []);
      const serializeDrafts = (list)=> JSON.stringify((Array.isArray(list) ? list : []).map((room)=> ({ id:room.id, baseType:room.baseType, name:normalizeLabel(room.name), label:normalizeLabel(room.label) })));
      let drafts = cloneDrafts(rooms);
      let initialDrafts = cloneDrafts(drafts);
      let initial = serializeDrafts(initialDrafts);
      const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock room-registry-modal room-registry-manage-modal' });
      const scroll = h('div', { class:'panel-box-form__scroll' });
      const intro = h('div', { class:'muted', text:'Tutaj zarządzasz wszystkimi pomieszczeniami tego inwestora. Możesz zmienić ich nazwy albo usunąć wybrane pozycje.' });
      scroll.appendChild(intro);
      const list = h('div', { class:'room-registry-manage-list' });
      scroll.appendChild(list);
      body.appendChild(scroll);
      const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = h('div', { class:'rozrys-panel-footer__actions' });
      const exitBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wyjdź' });
      const cancelBtn = h('button', { type:'button', class:'btn btn-danger', text:'Anuluj' });
      const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
      cancelBtn.style.display = 'none';
      saveBtn.style.display = 'none';
      actions.appendChild(exitBtn);
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      footer.appendChild(actions);
      body.appendChild(footer);

      const isDirty = ()=> serializeDrafts(drafts) !== initial;
      const refreshFooter = ()=>{
        const dirty = isDirty();
        exitBtn.style.display = dirty ? 'none' : '';
        cancelBtn.style.display = dirty ? '' : 'none';
        saveBtn.style.display = dirty ? '' : 'none';
      };
      const done = (result)=>{ try{ FC.panelBox.close(); }catch(_){ } resolve(result || null); };
      const askDiscard = async ()=>{
        if(!isDirty()) return true;
        try{
          if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
            return await FC.confirmBox.ask({ title:'ANULOWAĆ ZMIANY?', message:'Niezapisane zmiany w pomieszczeniach zostaną utracone.', confirmText:'✕ ANULUJ ZMIANY', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
          }
        }catch(_){ }
        return true;
      };
      const renderRows = ()=>{
        list.innerHTML = '';
        drafts.forEach((room)=>{
          const row = h('div', { class:'investor-project-card room-registry-manage-row' });
          const top = h('div', { class:'investor-project-card__top room-registry-manage-row__top' });
          const badge = h('div', { class:'muted-tag xs', text: BASE_LABELS[room.baseType] || room.baseType || 'Pomieszczenie' });
          const removeBtn = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
          top.appendChild(badge);
          top.appendChild(removeBtn);
          row.appendChild(top);
          const field = h('div', { class:'rozrys-panel-field room-registry-manage-row__field' });
          field.appendChild(h('label', { text:'Nazwa pomieszczenia' }));
          const input = h('input', { type:'text', class:'investor-form-input', value: room.label || room.name || '' });
          field.appendChild(input);
          row.appendChild(field);
          input.addEventListener('input', ()=>{
            room.name = normalizeLabel(input.value);
            room.label = room.name;
            refreshFooter();
          });
          input.addEventListener('change', ()=>{
            room.name = normalizeLabel(input.value);
            room.label = room.name;
            refreshFooter();
          });
          removeBtn.addEventListener('click', async ()=>{
            let ok = true;
            try{
              if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') ok = await FC.confirmBox.ask({ title:'Usunąć pomieszczenie?', message:'Ta zmiana zostanie zapisana po kliknięciu Zapisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
            }catch(_){ }
            if(!ok) return;
            drafts = drafts.filter((item)=> String(item.id || '') !== String(room.id || ''));
            renderRows();
            refreshFooter();
          });
          list.appendChild(row);
        });
        if(!drafts.length){
          list.appendChild(h('div', { class:'muted', text:'Brak pomieszczeń. Możesz zamknąć okno albo dodać nowe pomieszczenie poza tym ekranem.' }));
        }
      };
      exitBtn.addEventListener('click', ()=> done(null));
      cancelBtn.addEventListener('click', async ()=>{
        if(!(await askDiscard())) return;
        drafts = cloneDrafts(initialDrafts);
        renderRows();
        refreshFooter();
        try{
          const firstInput = body.querySelector('input');
          firstInput && firstInput.focus();
        }catch(_){ }
      });
      saveBtn.addEventListener('click', async ()=>{
        const seen = new Map();
        for(const room of drafts){
          const name = normalizeLabel(room.label || room.name || '');
          if(!name){
            try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak nazwy pomieszczenia', message:'Każde pomieszczenie musi mieć nazwę.' }); }catch(_){ }
            return;
          }
          const key = normalizeComparableLabel(name);
          if(seen.has(key)){
            try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Powielona nazwa pomieszczenia', message:'Nazwy pomieszczeń muszą być unikalne dla jednego inwestora.' }); }catch(_){ }
            return;
          }
          seen.set(key, room.id);
          room.name = name;
          room.label = name;
        }
        let ok = true;
        try{
          if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') ok = await FC.confirmBox.ask({ title:'ZAPISAĆ ZMIANY?', message:'Zapisać zmiany w liście pomieszczeń?', confirmText:'Zapisz', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' });
        }catch(_){ }
        if(!ok) return;
        applyManageRoomsDraft(inv, drafts);
        initialDrafts = cloneDrafts(drafts);
        initial = serializeDrafts(initialDrafts);
        done({ saved:true, rooms:drafts.map((room)=> Object.assign({}, room)) });
      });
      renderRows();
      refreshFooter();
      FC.panelBox.open({ title:'Edytuj pomieszczenia', contentNode: body, width:'760px', boxClass:'panel-box--rozrys', dismissOnOverlay:false, dismissOnEsc:true, beforeClose: async ()=> await askDiscard() });
      setTimeout(()=>{
        try{
          const firstInput = body.querySelector('input');
          firstInput && firstInput.focus();
        }catch(_){ }
      }, 20);
    });
  }


  async function openRemoveRoomModal(){
    const inv = getCurrentInvestor();
    if(!inv || !(FC.panelBox && typeof FC.panelBox.open === 'function')) return null;
    const investorRooms = Array.isArray(inv.rooms) ? inv.rooms : [];
    const activeRooms = getActiveRoomDefs();
    const roomMap = new Map();

    activeRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(normalized && normalized.id) roomMap.set(String(normalized.id), normalized);
    });

    investorRooms.forEach((room)=> {
      const normalized = normalizeRoomDef(room, room);
      if(!(normalized && normalized.id)) return;
      const key = String(normalized.id);
      roomMap.set(key, normalizeRoomDef(Object.assign({}, roomMap.get(key) || {}, normalized), roomMap.get(key) || normalized));
    });

    if(hasLegacyKitchen(getProject()) && !roomMap.has('kuchnia')){
      const legacy = createLegacyKitchenDef();
      roomMap.set('kuchnia', legacy);
    }

    const rooms = Array.from(roomMap.values()).filter((room)=> room && room.id);
    if(!rooms.length){
      try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak pomieszczeń', message:'Najpierw dodaj pomieszczenie, żeby móc je usunąć.' }); }catch(_){ }
      return null;
    }
    const h = (tag, attrs, children)=>{
      const el = document.createElement(tag);
      if(attrs){ Object.keys(attrs).forEach((k)=>{ if(k === 'class') el.className = attrs[k]; else if(k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }); }
      (children || []).forEach((ch)=> el.appendChild(ch));
      return el;
    };
    return new Promise((resolve)=>{
      let selectedId = String(rooms[0].id || '');
      const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock room-registry-modal' });
      const scroll = h('div', { class:'panel-box-form__scroll' });
      const list = h('div', { class:'room-registry-remove-list' });
      const sync = ()=>{
        list.querySelectorAll('.room-registry-remove-btn').forEach((btn)=> btn.classList.toggle('is-selected', btn.getAttribute('data-room-id') === selectedId));
      };
      rooms.forEach((room)=>{
        const btn = h('button', { type:'button', class:'room-registry-remove-btn', 'data-room-id':room.id, text:room.label || room.name || room.id });
        btn.addEventListener('click', ()=>{ selectedId = room.id; sync(); });
        list.appendChild(btn);
      });
      sync();
      scroll.appendChild(list);
      body.appendChild(scroll);
      const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = h('div', { class:'rozrys-panel-footer__actions' });
      const cancelBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wróć' });
      const deleteBtn = h('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
      actions.appendChild(cancelBtn);
      actions.appendChild(deleteBtn);
      footer.appendChild(actions);
      body.appendChild(footer);
      const done = (result)=>{ try{ FC.panelBox.close(); }catch(_){ } resolve(result || null); };
      cancelBtn.addEventListener('click', ()=> done(null));
      deleteBtn.addEventListener('click', ()=>{
        if(!selectedId) return;
        const removedId = removeRoomById(selectedId);
        done(removedId);
      });
      FC.panelBox.open({ title:'Usuń pomieszczenie', contentNode: body, width:'640px', boxClass:'panel-box--rozrys' });
    });
  }

  async function openAddRoomModal(){
    const inv = getCurrentInvestor();
    if(!inv || !(FC.panelBox && typeof FC.panelBox.open === 'function')) return null;
    const h = (tag, attrs, children)=>{
      const el = document.createElement(tag);
      if(attrs){ Object.keys(attrs).forEach((k)=>{ if(k === 'class') el.className = attrs[k]; else if(k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }); }
      (children || []).forEach((ch)=> el.appendChild(ch));
      return el;
    };
    return new Promise((resolve)=>{
      let selectedBase = 'kuchnia';
      const body = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock room-registry-modal' });
      const scroll = h('div', { class:'panel-box-form__scroll' });
      const form = h('div', { class:'grid-2 rozrys-panel-grid rozrys-panel-grid--stock room-registry-grid' });
      const baseWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--full' });
      baseWrap.appendChild(h('label', { text:'Typ pomieszczenia' }));
      const chips = h('div', { class:'room-registry-type-grid' });
      Object.keys(BASE_LABELS).forEach((baseType)=>{
        const btn = h('button', { type:'button', class:'room-registry-type-btn' + (baseType === selectedBase ? ' is-selected' : ''), 'data-base':baseType, text:BASE_LABELS[baseType] });
        btn.addEventListener('click', ()=>{
          selectedBase = baseType;
          chips.querySelectorAll('.room-registry-type-btn').forEach((node)=> node.classList.toggle('is-selected', node.getAttribute('data-base') === baseType));
        });
        chips.appendChild(btn);
      });
      baseWrap.appendChild(chips);
      form.appendChild(baseWrap);
      const nameWrap = h('div', { class:'rozrys-panel-field rozrys-panel-field--full' });
      nameWrap.appendChild(h('label', { text:'Nazwa pomieszczenia' }));
      const nameInput = h('input', { type:'text', placeholder:'Np. Kuchnia góra / Kuchnia garaż' });
      nameWrap.appendChild(nameInput);
      form.appendChild(nameWrap);
      scroll.appendChild(form);
      body.appendChild(scroll);
      const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = h('div', { class:'rozrys-panel-footer__actions' });
      const cancelBtn = h('button', { type:'button', class:'btn btn-danger', text:'Anuluj' });
      const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Dodaj' });
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      footer.appendChild(actions);
      body.appendChild(footer);
      function done(result){ try{ FC.panelBox.close(); }catch(_){ } resolve(result || null); }
      cancelBtn.addEventListener('click', ()=> done(null));
      saveBtn.addEventListener('click', ()=>{
        const name = normalizeLabel(nameInput.value);
        if(!name){
          try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak nazwy pomieszczenia', message:'Nadaj nazwę pomieszczeniu, zanim je dodasz.' }); }catch(_){ }
          try{ nameInput.focus(); }catch(_){ }
          return;
        }
        if(isRoomNameTaken(name, inv)){
          try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Ta nazwa już istnieje', message:'Dla tego inwestora istnieje już pomieszczenie o tej nazwie. Nadaj inną nazwę.' }); }catch(_){ }
          try{ nameInput.focus(); nameInput.select && nameInput.select(); }catch(_){ }
          return;
        }
        const id = makeRoomId(selectedBase, name);
        const proj = getProject() || {};
        const meta = ensureProjectMeta(proj);
        meta.roomDefs[id] = { id, baseType:selectedBase, name, label:name };
        if(!meta.roomOrder.includes(id)) meta.roomOrder.push(id);
        if(!proj[id]) proj[id] = roomTemplate(selectedBase);
        saveProject(proj);
        const rooms = Array.isArray(inv.rooms) ? inv.rooms.slice() : [];
        rooms.push({ id, baseType:selectedBase, name, label:name, projectStatus:(FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy' });
        try{ FC.investors.update(inv.id, { rooms }); }catch(_){ }
        done({ id, baseType:selectedBase, name, label:name });
      });
      FC.panelBox.open({ title:'Dodaj pomieszczenie', contentNode: body, width:'640px', boxClass:'panel-box--rozrys' });
      setTimeout(()=>{ try{ nameInput.focus(); }catch(_){ } }, 20);
    });
  }

  function renderRoomsView(){
    const view = document.getElementById('roomsView');
    if(!view) return;
    const rooms = getActiveRoomDefs();
    const list = view.querySelector('.rooms');
    if(!list) return;
    list.innerHTML = '';
    if(!rooms.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Brak dodanych pomieszczeń. Dodaj pierwsze pomieszczenie.';
      list.appendChild(empty);
    }
    rooms.forEach((room)=>{
      const tile = document.createElement('div');
      tile.className = 'room-btn';
      tile.setAttribute('data-action', 'open-room');
      tile.setAttribute('data-room', room.id);
      const icon = room.baseType === 'kuchnia' ? '🍳' : room.baseType === 'szafa' ? '🚪' : room.baseType === 'lazienka' ? '🛁' : '🏠';
      tile.innerHTML = `<div style="font-size:28px">${icon}</div><span>${room.label}</span>`;
      list.appendChild(tile);
    });
    let addBtn = view.querySelector('.rooms-add-btn');
    const headerRow = view.querySelector('div');
    if(!addBtn && headerRow){
      addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-primary rooms-add-btn';
      addBtn.setAttribute('data-action', 'add-room');
      addBtn.textContent = 'Dodaj pomieszczenie';
      headerRow.appendChild(addBtn);
    }
  }

  FC.roomRegistry = {
    BASE_LABELS,
    normalizeLabel,
    normalizeComparableLabel,
    getActiveRoomDefs,
    getActiveRoomIds,
    getRoomLabel,
    ensureRoomData,
    openAddRoomModal,
    openManageRoomsModal,
    openRemoveRoomModal,
    renderRoomsView,
    discoverProjectRoomKeys,
    hasCurrentInvestor,
    isRoomNameTaken,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    _debug:{
      applyManageRoomsDraft,
      removeRoomById,
      syncQuoteDraftSelectionAfterRoomChange,
      reconcileStatusesAfterRoomSetChange,
    },
  };
})();
