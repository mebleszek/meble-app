/* actions-register.js — rejestracja data-action w jednym miejscu.
   Ładować po js/core/actions.js i PRZED js/app.js.
   Uwaga: Handlery mogą odwoływać się do globalnych bindingów z app.js (uiState, projectData, funkcje).
*/
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  if (!FC.actions || typeof FC.actions.register !== 'function') return;

  function buildTransientInvestorDraft(kind){
    const store = window.FC && window.FC.investors;
    const normalize = store && typeof store.normalizeInvestor === 'function' ? store.normalizeInvestor : null;
    const now = Date.now();
    const draft = {
      id: 'draft_inv_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      kind: kind === 'company' ? 'company' : 'person',
      addedDate: (()=>{ try{ return new Date(now).toISOString().slice(0, 10); }catch(_){ return ''; } })(),
      createdAt: now,
      updatedAt: now,
      rooms: [],
      notes: 'BRAK',
    };
    return normalize ? normalize(draft) : draft;
  }

  function openInvestorDraft(kind){
    try{
      const inv = buildTransientInvestorDraft(kind || 'person');
      if(window.FC && window.FC.investorPersistence && typeof window.FC.investorPersistence.setCurrentInvestorId === 'function'){
        window.FC.investorPersistence.setCurrentInvestorId(null);
      }
      if(typeof uiState !== 'undefined' && uiState){
        uiState.currentInvestorId = null;
        uiState.entry = 'rooms';
        uiState.roomType = null;
        uiState.activeTab = 'inwestor';
        uiState.selectedCabinetId = null;
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      }
      if(window.FC && window.FC.investorUI && window.FC.investorUI.state){
        window.FC.investorUI.state.selectedId = inv.id;
        window.FC.investorUI.state.mode = 'detail';
        window.FC.investorUI.state.allowListAccess = false;
        window.FC.investorUI.state.newlyCreatedId = inv.id;
        window.FC.investorUI.state.transientInvestor = inv;
      }
      try{ if(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.enter === 'function') window.FC.investorEditorState.enter(inv); }catch(_){ }
      try{ if(FC.views && FC.views.applyFromState) FC.views.applyFromState(uiState); }catch(_){ }
      try{ window.FC.investorUI && window.FC.investorUI.render && window.FC.investorUI.render(); }catch(_){ }
      try{ if(window.FC && window.FC.sections && typeof window.FC.sections.update === 'function') window.FC.sections.update(); }catch(_){ }
    }catch(_){ }
  }

  function exitInvestorToList(){
    try{
      if(window.FC && window.FC.uiState && typeof window.FC.uiState.set === 'function') uiState = window.FC.uiState.set({ entry:'investorsList', activeTab:null, roomType:null, currentInvestorId:null });
      else if(typeof uiState !== 'undefined' && uiState){
        uiState.entry = 'investorsList';
        uiState.activeTab = null;
        uiState.roomType = null;
        uiState.currentInvestorId = null;
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      }
    }catch(_){ }
    try{
      if(window.FC && window.FC.investorUI && window.FC.investorUI.state){
        window.FC.investorUI.state.mode = 'list';
        window.FC.investorUI.state.allowListAccess = false;
        window.FC.investorUI.state.selectedId = null;
        window.FC.investorUI.state.newlyCreatedId = null;
      }
    }catch(_){ }
    try{ if(window.FC && window.FC.investorUI && typeof window.FC.investorUI.clearTransientInvestor === 'function') window.FC.investorUI.clearTransientInvestor(); }catch(_){ }
    try{ if(FC.views && FC.views.openInvestorsList) FC.views.openInvestorsList(); }catch(_){ }
  }


  FC.actions.register({
    'close-price': ({event}) => { closePriceModal(); return true; },
    'close-cabinet': ({event}) => { closeCabinetModal(); return true; },
    'cancel-cabinet': ({event}) => { closeCabinetModal(); return true; },
    'create-set': ({event}) => { createOrUpdateSetFromWizard(); return true; },

    'save-material': ({event}) => {
      const btn = document.getElementById('savePriceBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      if(typeof saveMaterialFromForm === 'function') { saveMaterialFromForm(); return true; }
      return false;
    },
    'cancel-material-edit': ({event}) => {
      const btn = document.getElementById('cancelEditBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); try{ renderPriceModal(); }catch(_){}
      return true;
    },
    'save-service': ({event}) => {
      const btn = document.getElementById('saveServiceBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      if(typeof saveServiceFromForm === 'function') { saveServiceFromForm(); return true; }
      return false;
    },
    'cancel-service-edit': ({event}) => {
      const btn = document.getElementById('cancelServiceEditBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      uiState.editingId = null; FC.storage.setJSON(STORAGE_KEYS.ui, uiState); try{ renderPriceModal(); }catch(_){}
      return true;
    },

    'open-materials': ({event}) => {
      uiState.showPriceList='materials';
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      renderPriceModal();
      FC.modal.open('priceModal');
      return true;
    },
    'open-services': ({event}) => {
      uiState.showPriceList='services';
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      renderPriceModal();
      FC.modal.open('priceModal');
      return true;
    },

    'open-investors-list': ({event}) => {
      // open separate investors list screen (no top tabs)
      try{
        if(FC.views && typeof FC.views.openInvestorsList === 'function') FC.views.openInvestorsList();
        else {
          uiState.entry = 'investorsList';
          FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
          if(FC.views && FC.views.applyFromState) FC.views.applyFromState(uiState);
        }
      }catch(_){ }

      // render list
      try{
        const root = document.getElementById('investorsListRoot');
        if(root && window.FC && window.FC.investorUI && typeof window.FC.investorUI.renderListOnly === 'function'){
          window.FC.investorUI.state.mode = 'list';
          window.FC.investorUI.state.allowListAccess = false;
          window.FC.investorUI.renderListOnly(root);
        }
      }catch(_){ }
      return true;
    },

    // backward compat
    'open-investors': ({event}) => {
      try{ return FC.actions.dispatch('open-investors-list', { event }); }catch(_){ return true; }
    },

    'close-investors-list': ({event}) => {
      try{ if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ }
      return true;
    },

    'new-investor': ({event}) => {
      openInvestorDraft('person');
      return true;
    },

    // Session buttons
    'session-cancel': async ({event}) => {
      const session = (window.FC && window.FC.session) ? window.FC.session : null;
      const dirty = !!(session && typeof session.isDirty === 'function' && session.isDirty());
      const inInvestorTab = !!(typeof uiState !== 'undefined' && uiState && uiState.activeTab === 'inwestor');
      const investorEditing = !!(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock());

      if(inInvestorTab){
        if(investorEditing) return true;
        exitInvestorToList();
        return true;
      }

      if(dirty){
        let ok = true;
        try{
          if(window.FC && window.FC.confirmBox && typeof window.FC.confirmBox.ask === 'function'){
            ok = await window.FC.confirmBox.ask({
              title:'ANULOWAĆ ZMIANY?',
              message:'Niezapisane zmiany zostaną utracone. Czy na pewno chcesz wyjść?',
              confirmText:'✕ ANULUJ ZMIANY',
              cancelText:'WRÓĆ',
              confirmTone:'danger',
              cancelTone:'neutral',
              dismissOnOverlay:false
            });
          }
        }catch(_){ ok = true; }
        if(!ok) return true;
        try{ if(session && typeof session.cancel === 'function') session.cancel(); }catch(_){ }
        try{ window.location.reload(); }catch(_){ }
        return true;
      }
      try{ if(session && typeof session.commit === 'function') session.commit(); }catch(_){ }
      try{ if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ }
      try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
      return true;
    },
    'session-save': ({event}) => {
      const inInvestorTab = !!(typeof uiState !== 'undefined' && uiState && uiState.activeTab === 'inwestor');
      const investorEditing = !!(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock());
      if(inInvestorTab){
        if(investorEditing) return true;
        exitInvestorToList();
        return true;
      }
      try{ if(window.FC && window.FC.session && typeof window.FC.session.commit === 'function') window.FC.session.commit(); }catch(_){ }
      try{ if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ }
      return true;
    },

    // ===== INWESTOR (UI uses delegated data-action; handlers must exist in registry) =====
    'create-investor': ({event}) => {
      openInvestorDraft('person');
      return true;
    },
    'open-investor': ({event, element}) => {
      const id = element?.getAttribute ? element.getAttribute('data-inv-id') : null;
      if(!id) return true;

      try{
        const persistence = (window.FC && window.FC.investorPersistence) ? window.FC.investorPersistence : null;
        if(persistence && typeof persistence.setCurrentInvestorId === 'function') persistence.setCurrentInvestorId(id);
        if(typeof uiState !== 'undefined' && uiState) uiState.currentInvestorId = id;
        // move to full workflow and open INWESTOR tab
        try{
          if(typeof uiState !== 'undefined' && uiState){
            uiState.entry = 'rooms';
            uiState.activeTab = 'inwestor';
            FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
          }
          if(FC.views && FC.views.applyFromState) FC.views.applyFromState(uiState);
        }catch(_){ }
        if(window.FC && window.FC.investorUI && window.FC.investorUI.state){
          window.FC.investorUI.state.selectedId = id;
          window.FC.investorUI.state.mode = 'detail';
          window.FC.investorUI.state.allowListAccess = false;
          window.FC.investorUI.state.newlyCreatedId = null;
          window.FC.investorUI.state.transientInvestor = null;
        }
        try{ window.FC.investorUI && window.FC.investorUI.render && window.FC.investorUI.render(); }catch(_){ }
      }catch(_){ }
      return true;
    },
    'back-investors': ({event}) => {
      try{
        if(window.FC && window.FC.investorUI && window.FC.investorUI.state){
          if(window.FC.investorUI.state.allowListAccess) window.FC.investorUI.state.mode = 'list';
        }
        try{ window.FC.investorUI && window.FC.investorUI.render && window.FC.investorUI.render(); }catch(_){ }
      }catch(_){ }
      return true;
    },
    'assign-investor': ({event, element}) => {
      const id = element?.getAttribute ? element.getAttribute('data-inv-id') : null;
      if(!id) return true;
      try{
        const persistence = (window.FC && window.FC.investorPersistence) ? window.FC.investorPersistence : null;
        if(persistence && typeof persistence.setCurrentInvestorId === 'function') persistence.setCurrentInvestorId(id);
        if(typeof uiState !== 'undefined' && uiState){
          uiState.currentInvestorId = id;
          if(window.FC && window.FC.storage && typeof window.FC.storage.setJSON === 'function' && typeof STORAGE_KEYS !== 'undefined'){
            window.FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
          }
        }
        // If project layer exists, store link (non-breaking)
        try{
          if(typeof projectData !== 'undefined' && projectData){
            projectData.meta = projectData.meta || {};
            projectData.meta.assignedInvestorId = id;
            if(window.FC && window.FC.project && typeof window.FC.project.save === 'function') window.FC.project.save(projectData);
          }
        }catch(_){ }
        try{ if(window.FC && window.FC.infoBox && typeof window.FC.infoBox.open === 'function') window.FC.infoBox.open({ title:'Przypisano inwestora', message:'Przypisano inwestora do bieżącego projektu (lokalnie).' }); }catch(_){ }
      }catch(_){ }
      return true;
    },
    'delete-investor': async ({event, element}) => {
      const id = element?.getAttribute ? element.getAttribute('data-inv-id') : null;
      if(!id) return true;
      try{
        let ok = true;
        if(window.FC && window.FC.confirmBox && typeof window.FC.confirmBox.ask === 'function'){
          ok = await window.FC.confirmBox.ask({ title:'Usunąć inwestora?', message:'Tej operacji nie cofnisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
        }
        if(!ok) return true;
        const persistence = (window.FC && window.FC.investorPersistence) ? window.FC.investorPersistence : null;
        if(persistence && typeof persistence.removeInvestor === 'function') persistence.removeInvestor(id);
        if(typeof uiState !== 'undefined' && uiState && uiState.currentInvestorId === id) uiState.currentInvestorId = null;
        if(window.FC && window.FC.investorUI && window.FC.investorUI.state){
          window.FC.investorUI.state.selectedId = null;
          window.FC.investorUI.state.mode = 'list';
        }
        try{ window.FC.investorUI && window.FC.investorUI.render && window.FC.investorUI.render(); }catch(_){ }
      }catch(_){ }
      return true;
    },


    'add-cabinet': ({event}) => {
      if(FC.actions.isLocked('add-cabinet')) return true;
      FC.actions.lock('add-cabinet');
      if(!uiState.roomType){
        alert('Wybierz pomieszczenie najpierw');
        return true;
      }
      openCabinetModalForAdd();
      FC.modal.open('cabinetModal');
      return true;
    },

    'back-rooms': ({event}) => {
      if(FC.views && FC.views.back){ FC.views.back(); }
      else {
        uiState.roomType = null;
        uiState.entry = 'home';
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      }
      return true;
    },

    'new-project': ({event}) => {
      if(!confirm('Utworzyć NOWY projekt? Wszystkie pomieszczenia zostaną wyczyszczone.')) return true;
      projectData = FC.utils.clone(DEFAULT_PROJECT);
      uiState.roomType = null;
      uiState.selectedCabinetId = null;
      uiState.expanded = {};
      projectData = FC.project.save(projectData);
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      document.getElementById('roomsView').style.display='block';
      document.getElementById('appView').style.display='none';
      document.getElementById('topTabs').style.display='none';
      renderCabinets();
      return true;
    },


    'add-room': async ({event}) => {
      try{
        if(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock()) return true;
        if(window.FC && window.FC.roomRegistry && typeof window.FC.roomRegistry.openAddRoomModal === 'function'){
          const room = await window.FC.roomRegistry.openAddRoomModal();
          if(room){
            uiState.roomType = room.id;
            uiState.lastRoomType = room.id;
            uiState.activeTab = 'wywiad';
            uiState.entry = 'app';
            FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
            try{ if(window.FC.roomRegistry.renderRoomsView) window.FC.roomRegistry.renderRoomsView(); }catch(_){ }
            if(FC.views && FC.views.openRoom) FC.views.openRoom(room.id);
          }
        }
      }catch(_){ }
      return true;
    },

    'open-room': ({event, element}) => {
      if(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock()) return true;
      const room = element.getAttribute('data-room');
      // Enter room editor
      uiState.roomType = room;
      uiState.lastRoomType = room;
      // From investor screen we want a fast jump to pricing. From other placeholder screens, go to WYWIAD.
      if(uiState.activeTab === 'inwestor') uiState.activeTab = 'wywiad';
      else if(uiState.activeTab === 'pokoje' || uiState.activeTab === 'rozrys' || uiState.activeTab === 'magazyn') uiState.activeTab = 'wywiad';
      uiState.entry = 'app';
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      if(FC.views && FC.views.openRoom) FC.views.openRoom(room);

      // Ensure tab content refreshes immediately after the navigation.
      try{ if(typeof setActiveTab === 'function' && uiState && uiState.activeTab) setActiveTab(uiState.activeTab); }catch(_){ }
      return true;
    },

    'tab': ({event, element}) => {
      const tab = element.getAttribute('data-tab');
      if(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock() && tab !== 'inwestor') return true;
      setActiveTab(tab);
      return true;
    },
  });
})();