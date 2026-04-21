(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const core = FC.roomRegistryCore;

  if(!core){
    try{ console.error('[room-registry-modals-add-edit] Missing FC.roomRegistryCore before modal layer load'); }catch(_ ){ }
    FC.roomRegistryModalsAddEdit = FC.roomRegistryModalsAddEdit || {
      openAddRoomModal: async()=> null,
      _debug:{
        openEditRoomModal: async()=> null,
      },
    };
    return;
  }

  const {
    BASE_LABELS,
    normalizeLabel,
    normalizeRoomDef,
    getProject,
    saveProject,
    getCurrentInvestor,
    ensureProjectMeta,
    roomTemplate,
    makeRoomId,
    getEditableRoom,
    isRoomNameTaken,
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

  FC.roomRegistryModalsAddEdit = {
    openAddRoomModal,
    _debug:{
      openEditRoomModal,
    },
  };
})();
