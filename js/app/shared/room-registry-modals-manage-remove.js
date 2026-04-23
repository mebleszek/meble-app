(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const core = FC.roomRegistryCore;
  const utils = FC.roomRegistryUtils;

  if(!(core && utils)){
    try{ console.error('[room-registry-modals-manage-remove] Missing FC.roomRegistryCore/utils before modal layer load'); }catch(_){ }
    FC.roomRegistryModalsManageRemove = FC.roomRegistryModalsManageRemove || {
      openManageRoomsModal: async()=> null,
      openRemoveRoomModal: async()=> null,
    };
    return;
  }

  const {
    normalizeLabel,
    normalizeComparableLabel,
    getCurrentInvestor,
    getManageableRooms,
    askDeleteRoomWithQuotes,
    applyManageRoomsDraftDetailed,
    removeRoomByIdDetailed,
  } = core;
  const {
    createElement,
    cloneRoomDrafts,
  } = utils;

  const BASE_LABELS = (FC.roomRegistryFoundation && FC.roomRegistryFoundation.BASE_LABELS) || {
    kuchnia:'Kuchnia',
    szafa:'Szafa',
    pokoj:'Pokój',
    lazienka:'Łazienka',
  };

  function openInfo(title, message){
    try{ if(FC.infoBox && typeof FC.infoBox.show === 'function') return FC.infoBox.show(title, message); }catch(_){ }
    try{ alert(message || title); }catch(_){ }
  }

  async function openManageRoomsModal(){
    const inv = getCurrentInvestor();
    if(!(inv && FC.panelBox && typeof FC.panelBox.open === 'function')) return null;
    const rooms = getManageableRooms(inv);
    if(!rooms.length){
      openInfo('Brak pomieszczeń', 'Najpierw dodaj pomieszczenie, żeby móc nim zarządzać.');
      return null;
    }
    return new Promise((resolve)=>{
      let drafts = cloneRoomDrafts(rooms);
      let initialDrafts = cloneRoomDrafts(drafts);
      const initialById = new Map(initialDrafts.map((room)=> [String(room && room.id || ''), {
        name: normalizeLabel(room && (room.label || room.name || '')),
        baseType: String(room && room.baseType || 'pokoj'),
      }]));
      const changedRoomIds = new Set();
      const removedRoomIds = new Set();
      const body = createElement('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock room-registry-modal room-registry-manage-modal' });
      const scroll = createElement('div', { class:'panel-box-form__scroll' });
      const list = createElement('div', { class:'room-registry-manage-list' });
      scroll.appendChild(list);
      body.appendChild(scroll);
      const footer = createElement('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = createElement('div', { class:'rozrys-panel-footer__actions' });
      const exitBtn = createElement('button', { type:'button', class:'btn btn-primary', text:'Wyjdź' });
      const cancelBtn = createElement('button', { type:'button', class:'btn btn-danger', text:'Anuluj' });
      const saveBtn = createElement('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
      actions.appendChild(exitBtn);
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      footer.appendChild(actions);
      body.appendChild(footer);

      const isDirty = ()=> changedRoomIds.size > 0 || removedRoomIds.size > 0 || drafts.length !== initialDrafts.length;
      const refreshFooter = ()=>{
        const dirty = isDirty();
        exitBtn.style.display = dirty ? 'none' : '';
        cancelBtn.style.display = dirty ? '' : 'none';
        saveBtn.style.display = dirty ? '' : 'none';
      };
      const recalcRoomDirty = (room)=>{
        const roomId = String(room && room.id || '');
        const initial = initialById.get(roomId);
        if(!initial){
          changedRoomIds.add(roomId);
          return;
        }
        const currentName = normalizeLabel(room && (room.label || room.name || ''));
        const currentBaseType = String(room && room.baseType || 'pokoj');
        if(currentName !== initial.name || currentBaseType !== initial.baseType) changedRoomIds.add(roomId);
        else changedRoomIds.delete(roomId);
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
          const row = createElement('div', { class:'investor-project-card room-registry-manage-row' });
          const badge = createElement('div', { class:'muted-tag xs room-registry-manage-row__badge', text: BASE_LABELS[room.baseType] || room.baseType || 'Pomieszczenie' });
          row.appendChild(badge);
          const field = createElement('div', { class:'rozrys-panel-field room-registry-manage-row__field' });
          field.appendChild(createElement('label', { text:'Nazwa pomieszczenia' }));
          const controls = createElement('div', { class:'room-registry-manage-row__controls' });
          const input = createElement('input', { type:'text', class:'investor-form-input room-registry-manage-row__input', value: room.label || room.name || '' });
          const removeBtn = createElement('button', { type:'button', class:'btn btn-danger room-registry-manage-row__remove', text:'Usuń' });
          controls.appendChild(input);
          controls.appendChild(removeBtn);
          field.appendChild(controls);
          row.appendChild(field);
          const syncRoomFromInput = ()=>{
            room.name = normalizeLabel(input.value);
            room.label = room.name;
            recalcRoomDirty(room);
            refreshFooter();
          };
          input.addEventListener('input', syncRoomFromInput);
          input.addEventListener('change', syncRoomFromInput);
          removeBtn.addEventListener('click', async ()=>{
            const ok = await askDeleteRoomWithQuotes(inv, [room.id], { deferred:true });
            if(!ok) return;
            const roomId = String(room && room.id || '');
            drafts = drafts.filter((item)=> String(item && item.id || '') !== roomId);
            changedRoomIds.delete(roomId);
            removedRoomIds.add(roomId);
            renderRows();
            refreshFooter();
          });
          list.appendChild(row);
        });
        if(!drafts.length){
          list.appendChild(createElement('div', { class:'muted', text:'Brak pomieszczeń. Możesz zamknąć okno albo dodać nowe pomieszczenie poza tym ekranem.' }));
        }
      };

      exitBtn.addEventListener('click', ()=> done(null));
      cancelBtn.addEventListener('click', async ()=>{
        if(!(await askDiscard())) return;
        drafts = cloneRoomDrafts(initialDrafts);
        changedRoomIds.clear();
        removedRoomIds.clear();
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
            openInfo('Brak nazwy pomieszczenia', 'Każde pomieszczenie musi mieć nazwę.');
            return;
          }
          const key = normalizeComparableLabel(name);
          if(seen.has(key)){
            openInfo('Powielona nazwa pomieszczenia', 'Nazwy pomieszczeń muszą być unikalne dla jednego inwestora.');
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
        const result = applyManageRoomsDraftDetailed(inv, drafts);
        if(!(result && result.ok)) return;
        initialDrafts = cloneRoomDrafts(drafts);
        initialById.clear();
        initialDrafts.forEach((room)=> initialById.set(String(room && room.id || ''), {
          name: normalizeLabel(room && (room.label || room.name || '')),
          baseType: String(room && room.baseType || 'pokoj'),
        }));
        changedRoomIds.clear();
        removedRoomIds.clear();
        done({ saved:true, rooms:cloneRoomDrafts(drafts), removedRoomIds:result.removedRoomIds || [] });
      });
      renderRows();
      refreshFooter();
      FC.panelBox.open({ title:'Edytuj pomieszczenia', contentNode: body, width:'760px', boxClass:'panel-box--rozrys room-registry-manage-modal', dismissOnOverlay:false, dismissOnEsc:true, beforeClose: async ()=> await askDiscard() });
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
    const rooms = getManageableRooms(inv);
    if(!rooms.length){
      openInfo('Brak pomieszczeń', 'Najpierw dodaj pomieszczenie, żeby móc je usunąć.');
      return null;
    }
    return new Promise((resolve)=>{
      let selectedId = String(rooms[0].id || '');
      const body = createElement('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock room-registry-modal' });
      const scroll = createElement('div', { class:'panel-box-form__scroll' });
      const list = createElement('div', { class:'room-registry-remove-list' });
      const sync = ()=>{
        list.querySelectorAll('.room-registry-remove-btn').forEach((btn)=> btn.classList.toggle('is-selected', btn.getAttribute('data-room-id') === selectedId));
      };
      rooms.forEach((room)=>{
        const btn = createElement('button', { type:'button', class:'room-registry-remove-btn', 'data-room-id':room.id, text:room.label || room.name || room.id });
        btn.addEventListener('click', ()=>{ selectedId = room.id; sync(); });
        list.appendChild(btn);
      });
      sync();
      scroll.appendChild(list);
      body.appendChild(scroll);
      const footer = createElement('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = createElement('div', { class:'rozrys-panel-footer__actions' });
      const cancelBtn = createElement('button', { type:'button', class:'btn btn-primary', text:'Wróć' });
      const deleteBtn = createElement('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
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
        const result = removeRoomByIdDetailed(selectedId);
        done(result && result.ok ? result.roomId : null);
      });
      FC.panelBox.open({ title:'Usuń pomieszczenie', contentNode: body, width:'640px', boxClass:'panel-box--rozrys' });
    });
  }

  FC.roomRegistryModalsManageRemove = {
    openManageRoomsModal,
    openRemoveRoomModal,
  };
})();
