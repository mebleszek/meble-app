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

  function hasOpeningProject(opening){
    if(FC.roomProjectModel?.enabled())return FC.roomProjectStore.matches(opening);
    const current=FC.projectStore.getCurrentRecord();
    return !!(opening&&current?.id===opening.id&&current.investorId===opening.investorId
      &&(JSON.stringify(current.projectData)===JSON.stringify(opening.projectData)||FC.projectDomainOperations.hasPending(opening.id)));
  }

  function projectChanged(){
    openInfo('Projekt zmienił się','Zamknij formularz i otwórz go ponownie.');
    return false;
  }

  async function writeRooms(operation,scopes){
    if(FC.roomProjectModel?.enabled())return FC.applicationWrite.roomRecords(scopes,operation);
    if(!FC.applicationWrite)return operation();
    return FC.applicationWrite.projectHandler(operation)();
  }

  async function openManageRoomsModal(){
    const inv = getCurrentInvestor();
    const openingProject = FC.roomProjectModel?.enabled()?FC.roomProjectStore.capture():FC.projectStore && FC.projectStore.getCurrentRecord();
    if(!(inv && FC.panelBox && typeof FC.panelBox.open === 'function')) return null;
    const rooms = getManageableRooms(inv);
    if(!rooms.length){
      openInfo('Brak pomieszczeń', 'Najpierw dodaj pomieszczenie, żeby móc nim zarządzać.');
      return null;
    }
    return new Promise((resolve)=>{
      let drafts = cloneRoomDrafts(rooms);
      const initialDrafts = cloneRoomDrafts(drafts);
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
      let saving=false;
      const done = (result)=>{ if(saving)return;try{ FC.panelBox.close(); }catch(_){ } resolve(result || null); };
      const askDiscard = async ()=>{
        if(saving)return false;
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
        if(saving)return;
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
        let ok = false;
        try{
          if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') ok = await FC.confirmBox.ask({ title:'ZAPISAĆ ZMIANY?', message:'Zapisać zmiany w liście pomieszczeń?', confirmText:'Zapisz', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' });
        }catch(_){ }
        if(ok!==true||saving)return;
        const submitted=cloneRoomDrafts(drafts);
        saving=true;saveBtn.disabled=true;
        try{
          const result=await writeRooms(()=>{
            if(!hasOpeningProject(openingProject))return projectChanged();
            return applyManageRoomsDraftDetailed(inv,submitted);
          },FC.roomProjectModel?.enabled()?FC.roomProjectStore.changedIds(submitted,inv.id):undefined);
          saving=false;
          if(result?.ok)done({saved:true,rooms:submitted,removedRoomIds:result.removedRoomIds||[]});
        }finally{saving=false;saveBtn.disabled=false;}
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
    const openingProject = FC.roomProjectModel?.enabled()?FC.roomProjectStore.capture():FC.projectStore && FC.projectStore.getCurrentRecord();
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
      let saving=false;
      const done = (result)=>{ if(saving)return;try{ FC.panelBox.close(); }catch(_){ } resolve(result || null); };
      cancelBtn.addEventListener('click', ()=> done(null));
      deleteBtn.addEventListener('click', async ()=>{
        if(!selectedId||saving)return;
        const roomId=selectedId;
        if(await askDeleteRoomWithQuotes(inv,[roomId],{deferred:false})!==true||saving)return;
        saving=true;deleteBtn.disabled=true;
        try{
          const result=await writeRooms(()=>{
            if(!hasOpeningProject(openingProject))return projectChanged();
            return removeRoomByIdDetailed(roomId);
          },FC.roomProjectModel?.enabled()?[roomId]:undefined);
          saving=false;
          if(result?.ok)done(result.roomId);
        }finally{saving=false;deleteBtn.disabled=false;}
      });
      FC.panelBox.open({ title:'Usuń pomieszczenie', contentNode: body, width:'640px', boxClass:'panel-box--rozrys', beforeClose:()=>!saving });
    });
  }

  FC.roomRegistryModalsManageRemove = {
    openManageRoomsModal,
    openRemoveRoomModal,
  };
})();
