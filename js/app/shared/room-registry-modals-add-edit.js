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
    createElement,
    normalizeLabel,
    getCurrentInvestor,
    getEditableRoom,
    isRoomNameTaken,
    askDeleteRoomWithQuotes,
    createRoomRecord,
    updateRoomRecord,
    removeRoomByIdDetailed,
  } = core;

  function openInfo(title, message){
    try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title, message }); }catch(_){ }
  }

  async function openEditRoomModal(roomId){
    const inv = getCurrentInvestor();
    const openingProject = FC.projectStore && FC.projectStore.getCurrentRecord();
    if(!inv || !(FC.panelBox && typeof FC.panelBox.open === 'function')) return null;
    const room = getEditableRoom(inv, roomId);
    if(!(room && room.id)) return null;
    return new Promise((resolve)=>{
      let selectedBase = String(room.baseType || 'pokoj');
      let dirty = false;
      const body = createElement('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock room-registry-modal' });
      const scroll = createElement('div', { class:'panel-box-form__scroll' });
      const form = createElement('div', { class:'grid-2 rozrys-panel-grid rozrys-panel-grid--stock room-registry-grid' });
      const baseWrap = createElement('div', { class:'rozrys-panel-field rozrys-panel-field--full' });
      baseWrap.appendChild(createElement('label', { text:'Typ pomieszczenia' }));
      const chips = createElement('div', { class:'room-registry-type-grid' });
      Object.keys(BASE_LABELS).forEach((baseType)=>{
        const btn = createElement('button', { type:'button', class:'room-registry-type-btn' + (baseType === selectedBase ? ' is-selected' : ''), 'data-base':baseType, text:BASE_LABELS[baseType] });
        btn.addEventListener('click', ()=>{
          if(selectedBase === baseType) return;
          selectedBase = baseType;
          dirty = true;
          chips.querySelectorAll('.room-registry-type-btn').forEach((node)=> node.classList.toggle('is-selected', node.getAttribute('data-base') === baseType));
          refreshFooter();
        });
        chips.appendChild(btn);
      });
      baseWrap.appendChild(chips);
      form.appendChild(baseWrap);
      const nameWrap = createElement('div', { class:'rozrys-panel-field rozrys-panel-field--full' });
      nameWrap.appendChild(createElement('label', { text:'Nazwa pomieszczenia' }));
      const nameInput = createElement('input', { type:'text', placeholder:'Np. Kuchnia góra / Kuchnia garaż', value:room.label || room.name || '' });
      nameWrap.appendChild(nameInput);
      form.appendChild(nameWrap);
      scroll.appendChild(form);
      body.appendChild(scroll);
      const footer = createElement('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = createElement('div', { class:'rozrys-panel-footer__actions' });
      const deleteBtn = createElement('button', { type:'button', class:'btn btn-danger', text:'Usuń' });
      const cancelBtn = createElement('button', { type:'button', class:'btn btn-primary', text:'Wyjdź' });
      const saveBtn = createElement('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
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
      const done = (result)=>{ const finish=()=>{try{ FC.panelBox.close(); }catch(_){ } resolve(result || null);};if(FC.applicationWrite)FC.applicationWrite.afterCommit(finish);else finish(); };
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
      const syncDirty = ()=>{
        dirty = normalizeLabel(nameInput.value) !== normalizeLabel(room.label || room.name || '') || selectedBase !== String(room.baseType || 'pokoj');
        refreshFooter();
      };
      nameInput.addEventListener('input', syncDirty);
      nameInput.addEventListener('change', syncDirty);
      cancelBtn.addEventListener('click', async ()=>{
        const ok = await askDiscard();
        if(ok) done(null);
      });
      saveBtn.addEventListener('click', (FC.applicationWrite?.projectHandler||((fn)=>fn))(async ()=>{
        const name = normalizeLabel(nameInput.value);
        if(!name){
          openInfo('Brak nazwy pomieszczenia', 'Nadaj nazwę pomieszczeniu, zanim je zapiszesz.');
          try{ nameInput.focus(); }catch(_){ }
          return;
        }
        if(isRoomNameTaken(name, inv, room.id)){
          openInfo('Ta nazwa już istnieje', 'Dla tego inwestora istnieje już pomieszczenie o tej nazwie. Nadaj inną nazwę.');
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
        if(!openingProject || !FC.projectStore.getCurrentRecord() || FC.projectStore.getCurrentProjectId() !== openingProject.id
          || JSON.stringify(FC.projectStore.getCurrentRecord().projectData) !== JSON.stringify(openingProject.projectData) && !FC.projectDomainOperations.hasPending(openingProject.id)) { openInfo('Projekt zmienił się', 'Zamknij formularz i otwórz go ponownie.'); return; }
        const result = updateRoomRecord(inv, room.id, { baseType:selectedBase, name, label:name });
        if(!(result && result.ok && result.room)) return false;
        dirty = false;
        done(result.room);
      }));
      deleteBtn.addEventListener('click', (FC.applicationWrite?.projectHandler||((fn)=>fn))(async ()=>{
        const ok = await askDelete();
        if(!ok) return;
        if(!openingProject || !FC.projectStore.getCurrentRecord() || FC.projectStore.getCurrentProjectId() !== openingProject.id
          || JSON.stringify(FC.projectStore.getCurrentRecord().projectData) !== JSON.stringify(openingProject.projectData) && !FC.projectDomainOperations.hasPending(openingProject.id)) { openInfo('Projekt zmienił się', 'Zamknij formularz i otwórz go ponownie.'); return; }
        const result = removeRoomByIdDetailed(room.id);
        if(result && result.ok) done({ deleted:true, roomId:result.roomId });
      }));
      refreshFooter();
      FC.panelBox.open({ title:'Edytuj pomieszczenie', contentNode: body, width:'640px', boxClass:'panel-box--rozrys' });
      setTimeout(()=>{ try{ nameInput.focus(); nameInput.select && nameInput.select(); }catch(_){ } }, 20);
    });
  }

  async function openAddRoomModal(){
    const inv = getCurrentInvestor();
    const openingProject = FC.projectStore && FC.projectStore.getCurrentRecord();
    if(!inv || !(FC.panelBox && typeof FC.panelBox.open === 'function')) return null;
    return new Promise((resolve)=>{
      let selectedBase = 'kuchnia';
      const body = createElement('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock room-registry-modal' });
      const scroll = createElement('div', { class:'panel-box-form__scroll' });
      const form = createElement('div', { class:'grid-2 rozrys-panel-grid rozrys-panel-grid--stock room-registry-grid' });
      const baseWrap = createElement('div', { class:'rozrys-panel-field rozrys-panel-field--full' });
      baseWrap.appendChild(createElement('label', { text:'Typ pomieszczenia' }));
      const chips = createElement('div', { class:'room-registry-type-grid' });
      Object.keys(BASE_LABELS).forEach((baseType)=>{
        const btn = createElement('button', { type:'button', class:'room-registry-type-btn' + (baseType === selectedBase ? ' is-selected' : ''), 'data-base':baseType, text:BASE_LABELS[baseType] });
        btn.addEventListener('click', ()=>{
          selectedBase = baseType;
          chips.querySelectorAll('.room-registry-type-btn').forEach((node)=> node.classList.toggle('is-selected', node.getAttribute('data-base') === baseType));
        });
        chips.appendChild(btn);
      });
      baseWrap.appendChild(chips);
      form.appendChild(baseWrap);
      const nameWrap = createElement('div', { class:'rozrys-panel-field rozrys-panel-field--full' });
      nameWrap.appendChild(createElement('label', { text:'Nazwa pomieszczenia' }));
      const nameInput = createElement('input', { type:'text', placeholder:'Np. Kuchnia góra / Kuchnia garaż' });
      nameWrap.appendChild(nameInput);
      form.appendChild(nameWrap);
      scroll.appendChild(form);
      body.appendChild(scroll);
      const footer = createElement('div', { class:'panel-box-form__footer rozrys-panel-footer' });
      const actions = createElement('div', { class:'rozrys-panel-footer__actions' });
      const cancelBtn = createElement('button', { type:'button', class:'btn btn-danger', text:'Anuluj' });
      const saveBtn = createElement('button', { type:'button', class:'btn btn-success', text:'Dodaj' });
      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      footer.appendChild(actions);
      body.appendChild(footer);
      function done(result){ const finish=()=>{try{ FC.panelBox.close(); }catch(_){ } resolve(result || null);};if(FC.applicationWrite)FC.applicationWrite.afterCommit(finish);else finish(); }
      cancelBtn.addEventListener('click', ()=> done(null));
      saveBtn.addEventListener('click', (FC.applicationWrite?.projectHandler||((fn)=>fn))(()=>{
        const name = normalizeLabel(nameInput.value);
        if(!name){
          openInfo('Brak nazwy pomieszczenia', 'Nadaj nazwę pomieszczeniu, zanim je dodasz.');
          try{ nameInput.focus(); }catch(_){ }
          return;
        }
        if(isRoomNameTaken(name, inv)){
          openInfo('Ta nazwa już istnieje', 'Dla tego inwestora istnieje już pomieszczenie o tej nazwie. Nadaj inną nazwę.');
          try{ nameInput.focus(); nameInput.select && nameInput.select(); }catch(_){ }
          return;
        }
        if(!openingProject || !FC.projectStore.getCurrentRecord() || FC.projectStore.getCurrentProjectId() !== openingProject.id
          || JSON.stringify(FC.projectStore.getCurrentRecord().projectData) !== JSON.stringify(openingProject.projectData) && !FC.projectDomainOperations.hasPending(openingProject.id)) { openInfo('Projekt zmienił się', 'Zamknij formularz i otwórz go ponownie.'); return; }
        const result = createRoomRecord(inv, { baseType:selectedBase, name, label:name });
        if(!(result && result.ok && result.room)) return false;
        done(result.room);
      }));
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
