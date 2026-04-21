(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const core = FC.roomRegistryCore;

  if(!core){
    try{ console.error('[room-registry] Missing FC.roomRegistryCore before shell load'); }catch(_){ }
    FC.roomRegistry = FC.roomRegistry || {
      BASE_LABELS:{},
      normalizeLabel: (text)=> String(text || ''),
      normalizeComparableLabel: (text)=> String(text || '').trim().toLowerCase(),
      getActiveRoomDefs: ()=> [],
      getActiveRoomIds: ()=> [],
      getRoomLabel: (id)=> String(id || '') || 'Pomieszczenie',
      ensureRoomData: ()=> null,
      openAddRoomModal: async()=> null,
      openManageRoomsModal: async()=> null,
      openRemoveRoomModal: async()=> null,
      renderRoomsView: ()=> {},
      discoverProjectRoomKeys: ()=> [],
      hasCurrentInvestor: ()=> false,
      isRoomNameTaken: ()=> false,
      hasLegacyKitchen: ()=> false,
      createLegacyKitchenDef: ()=> null,
      _debug:{}
    };
    return;
  }

  const {
    BASE_LABELS,
    normalizeLabel,
    normalizeComparableLabel,
    normalizeRoomDef,
    getProject,
    saveProject,
    getCurrentInvestor,
    ensureProjectMeta,
    discoverProjectRoomKeys,
    roomTemplate,
    makeRoomId,
    getManageableRooms,
    getEditableRoom,
    getActiveRoomDefs,
    getActiveRoomIds,
    getRoomLabel,
    ensureRoomData,
    hasCurrentInvestor,
    isRoomNameTaken,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    applyManageRoomsDraft,
    removeRoomById,
    syncQuoteDraftSelectionAfterRoomChange,
    reconcileStatusesAfterRoomSetChange,
    buildRoomRemovalWarningMessage,
    listSnapshotsForRoomRemoval,
    countCabinetsForRoomIds,
    askDeleteRoomWithQuotes,
    updateInvestorRooms,
  } = core;

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
      const askDelete = async ()=> await askDeleteRoomWithQuotes(inv, [room.id], { deferred:false });
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
            const ok = await askDeleteRoomWithQuotes(inv, [room.id], { deferred:true });
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
      deleteBtn.addEventListener('click', async ()=>{
        if(!selectedId) return;
        const ok = await askDeleteRoomWithQuotes(inv, [selectedId], { deferred:false });
        if(!ok) return;
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
      buildRoomRemovalWarningMessage,
      listSnapshotsForRoomRemoval,
      countCabinetsForRoomIds,
    },
  };
})();
