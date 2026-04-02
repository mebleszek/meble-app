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

  function saveProject(proj){
    try{
      if(typeof projectData !== 'undefined') projectData = proj;
      window.projectData = proj;
    }catch(_){ }
    try{ if(FC.project && typeof FC.project.save === 'function') FC.project.save(proj); }catch(_){ }
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

  function normalizeRoomDef(raw, fallback){
    const src = Object.assign({}, fallback || {}, raw || {});
    const baseType = String(src.baseType || src.kind || src.type || fallback && fallback.baseType || 'pokoj');
    const id = String(src.id || fallback && fallback.id || '');
    const name = normalizeLabel(src.name || src.label || fallback && fallback.name || BASE_LABELS[baseType] || id);
    return {
      id,
      baseType,
      name,
      label: normalizeLabel(src.label || name),
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
    const found = getActiveRoomDefs().find((room)=> room.id === id);
    return found ? found.label : String(id || 'Pomieszczenie');
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
    const normalized = normalizeLabel(name).toLowerCase();
    if(!normalized || !investor || !Array.isArray(investor.rooms)) return false;
    return investor.rooms.some((room)=>{
      if(!room) return false;
      if(exceptId && String(room.id || '') === String(exceptId)) return false;
      const label = normalizeLabel(room.label || room.name || '');
      return label.toLowerCase() === normalized;
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
        rooms.push({ id, baseType:selectedBase, name, label:name });
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
    getActiveRoomDefs,
    getActiveRoomIds,
    getRoomLabel,
    ensureRoomData,
    openAddRoomModal,
    renderRoomsView,
    discoverProjectRoomKeys,
    hasCurrentInvestor,
    isRoomNameTaken,
    hasLegacyKitchen,
    createLegacyKitchenDef,
  };
})();
