(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const core = FC.roomRegistryCore;

  if(!core){
    try{ console.error('[room-registry-modals-manage-remove] Missing FC.roomRegistryCore before modal layer load'); }catch(_ ){ }
    FC.roomRegistryModalsManageRemove = FC.roomRegistryModalsManageRemove || {
      openManageRoomsModal: async()=> null,
      openRemoveRoomModal: async()=> null,
    };
    return;
  }

  const {
    BASE_LABELS,
    normalizeLabel,
    normalizeComparableLabel,
    normalizeRoomDef,
    getProject,
    getCurrentInvestor,
    getManageableRooms,
    getActiveRoomDefs,
    hasLegacyKitchen,
    createLegacyKitchenDef,
    applyManageRoomsDraft,
    removeRoomById,
    askDeleteRoomWithQuotes,
  } = core;

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

  FC.roomRegistryModalsManageRemove = {
    openManageRoomsModal,
    openRemoveRoomModal,
  };
})();
