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

  function openPriceCatalog(kind){
    try{
      uiState.showPriceList = String(kind || 'materials');
      if(window.FC && window.FC.uiState && typeof window.FC.uiState.set === 'function'){
        uiState = window.FC.uiState.set({ showPriceList: uiState.showPriceList });
      } else {
        FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      }
      renderPriceModal();
      FC.modal.open('priceModal');
    }catch(_){ }
    return true;
  }

  function openModeHub(mode){
    try{ if(FC.views && typeof FC.views.openModeHub === 'function') FC.views.openModeHub(mode); }catch(_){ }
    return true;
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

  function restoreProjectUiAfterSessionChange(){
    try{ if(typeof uiState !== 'undefined' && window.FC && window.FC.uiState && typeof window.FC.uiState.get === 'function') uiState = window.FC.uiState.get(); }catch(_){ }
    try{ if(typeof projectData !== 'undefined' && window.FC && FC.project && typeof FC.project.load === 'function') projectData = FC.project.load(); }catch(_){ }
    try{ if(typeof materials !== 'undefined' && window.FC && FC.storage && typeof FC.storage.getJSON === 'function') materials = FC.storage.getJSON(STORAGE_KEYS.materials, materials); }catch(_){ }
    try{ if(typeof services !== 'undefined' && window.FC && FC.storage && typeof FC.storage.getJSON === 'function') services = FC.storage.getJSON(STORAGE_KEYS.services, services); }catch(_){ }
    try{ if(typeof normalizeProjectData === 'function' && typeof projectData !== 'undefined') projectData = normalizeProjectData(projectData, DEFAULT_PROJECT); }catch(_){ }
    try{ if(FC.views && typeof FC.views.applyFromState === 'function' && typeof uiState !== 'undefined') FC.views.applyFromState(uiState); }catch(_){ }
    try{
      if(typeof uiState !== 'undefined' && uiState && uiState.entry === 'rooms' && uiState.roomType && typeof renderCabinets === 'function') renderCabinets();
      else if(typeof render === 'function') render();
    }catch(_){ }
    try{ if(window.FC && window.FC.investorUI && typeof window.FC.investorUI.render === 'function' && uiState && uiState.activeTab === 'inwestor') window.FC.investorUI.render(); }catch(_){ }
    try{ if(FC.sections && typeof FC.sections.update === 'function') FC.sections.update(); }catch(_){ }
    try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
  }


  const actions = {
    'wycena-generate': ({event}) => {
      try{
        if(window.FC && FC.wycenaGenerateAction && typeof FC.wycenaGenerateAction.run === 'function'){
          FC.wycenaGenerateAction.run(event || null, 'actions-registry');
          return true;
        }
      }catch(err){
        try{ console.error('[wycena] data-action generate failed', err); }catch(_){}
        throw err;
      }
      try{
        if(window.FC && FC.wycenaDiagnostics && typeof FC.wycenaDiagnostics.recordGenerateButtonEvent === 'function'){
          FC.wycenaDiagnostics.recordGenerateButtonEvent('actions-registry-missing-runtime-handler');
        }
      }catch(_){}
      return true;
    },
    'close-price': ({event}) => { closePriceModal(); return true; },
    'close-price-item': ({event}) => { try{ closePriceItemModal(); }catch(_){ } return true; },
    'price-item-exit': ({event}) => { try{ if(window.FC && FC.priceModal && typeof FC.priceModal.requestClosePriceItemModal === 'function') FC.priceModal.requestClosePriceItemModal('exit'); else closePriceItemModal(); }catch(_){ } return true; },
    'price-item-cancel': ({event}) => { try{ if(window.FC && FC.priceModal && typeof FC.priceModal.requestClosePriceItemModal === 'function') FC.priceModal.requestClosePriceItemModal('cancel'); else closePriceItemModal(); }catch(_){ } return true; },
    'price-item-save': ({event}) => { try{ if(window.FC && FC.priceModal && typeof FC.priceModal.saveActivePriceItem === 'function') FC.priceModal.saveActivePriceItem(); else if(typeof saveMaterialFromForm === 'function') saveMaterialFromForm(); }catch(_){ } return true; },
    'price-item-delete': ({event}) => { try{ if(window.FC && FC.priceModal && typeof FC.priceModal.deleteActivePriceItem === 'function') FC.priceModal.deleteActivePriceItem(); }catch(_){ } return true; },
    'close-cabinet': ({event}) => { closeCabinetModal(); return true; },
    'cancel-cabinet': ({event}) => { closeCabinetModal(); return true; },
    'create-set': ({event}) => { createOrUpdateSetFromWizard(); return true; },
    'open-room-settings': ({event}) => {
      try{
        if(window.FC && window.FC.wywiadRoomSettings && typeof window.FC.wywiadRoomSettings.open === 'function') return !!window.FC.wywiadRoomSettings.open();
      }catch(_){ }
      return true;
    },
    'open-room-preferences': ({event}) => {
      try{
        if(window.FC && window.FC.wywiadRoomPreferences && typeof window.FC.wywiadRoomPreferences.open === 'function') return !!window.FC.wywiadRoomPreferences.open();
      }catch(_){ }
      return true;
    },

    'save-material': ({event}) => {
      const btn = document.getElementById('savePriceBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      if(typeof saveMaterialFromForm === 'function') { saveMaterialFromForm(); return true; }
      return false;
    },
    'cancel-material-edit': ({event}) => {
      try{ if(window.FC && FC.priceModal && typeof FC.priceModal.requestClosePriceItemModal === 'function') FC.priceModal.requestClosePriceItemModal('cancel'); else closePriceItemModal(); }catch(_){ }
      return true;
    },
    'save-service': ({event}) => {
      const btn = document.getElementById('saveServiceBtn');
      if(btn && typeof btn.onclick === 'function') { btn.onclick(); return true; }
      if(typeof saveServiceFromForm === 'function') { saveServiceFromForm(); return true; }
      return false;
    },
    'cancel-service-edit': ({event}) => {
      try{ if(window.FC && FC.priceModal && typeof FC.priceModal.requestClosePriceItemModal === 'function') FC.priceModal.requestClosePriceItemModal('cancel'); else closePriceItemModal(); }catch(_){ }
      return true;
    },

    'open-furniture-hub': ({event}) => openModeHub('furnitureProjects'),
    'open-workshop-hub': ({event}) => openModeHub('workshopServices'),
    'open-data-settings': ({event}) => {
      try{ if(window.FC && FC.dataSettingsModal && typeof FC.dataSettingsModal.open === 'function') return !!FC.dataSettingsModal.open(); }catch(_){ }
      return true;
    },
    'close-mode-hub': ({event}) => { try{ if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ } return true; },
    'open-sheet-materials': ({event}) => openPriceCatalog('materials'),
    'open-accessories': ({event}) => openPriceCatalog('accessories'),
    'open-quote-rates': ({event}) => openPriceCatalog('quoteRates'),
    'open-workshop-services': ({event}) => openPriceCatalog('workshopServices'),

    'open-investors-list': ({event}) => {
      if(FC.views && typeof FC.views.openInvestorsList === 'function') return FC.views.openInvestorsList();
      return false;
    },

    // backward compat
    'open-investors': ({event}) => {
      try{ return FC.actions.dispatch('open-investors-list', { event }); }catch(_){ return true; }
    },

    'close-investors-list': ({event}) => {
      try{ if(FC.views && FC.views.openModeHub) FC.views.openModeHub('furnitureProjects'); else if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ }
      return true;
    },
    'open-service-orders-list': ({event}) => {
      try{ if(FC.views && FC.views.openServiceOrdersList) FC.views.openServiceOrdersList(); }catch(_){ }
      return true;
    },
    'close-service-orders-list': ({event}) => {
      try{ if(FC.views && FC.views.openModeHub) FC.views.openModeHub('workshopServices'); else if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ }
      return true;
    },
    'new-service-order': ({event}) => {
      try{ if(FC.views && FC.views.openServiceOrdersList) FC.views.openServiceOrdersList(); }catch(_){ }
      try{ if(window.FC && FC.serviceOrders && typeof FC.serviceOrders.openEditor === 'function') FC.serviceOrders.openEditor(); }catch(_){ }
      return true;
    },

    'new-investor': ({event}) => {
      try{ if(window.FC && window.FC.uiState && typeof window.FC.uiState.set === 'function') uiState = window.FC.uiState.set({ workMode:'furnitureProjects' }); }catch(_){ }
      openInvestorDraft('person');
      return true;
    },

    // Session buttons
    'session-cancel': async ({event}) => {
      const session = (window.FC && window.FC.session) ? window.FC.session : null;
      const storageDirty = !!(session && typeof session.isDirty === 'function' && session.isDirty());
      const runtime = FC.investorProjectRuntime;
      const dirty = storageDirty || !!(session && session.active && runtime && typeof runtime.hasProjectDivergence === 'function'
        && typeof projectData !== 'undefined' && runtime.hasProjectDivergence(projectData));
      const inInvestorTab = !!(typeof uiState !== 'undefined' && uiState && uiState.activeTab === 'inwestor');
      const investorEditing = !!(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock());

      if(!dirty){
        if(investorEditing) return true;
        const investor = (typeof uiState !== 'undefined' && uiState && uiState.currentInvestorId)
          || (session && session.context && session.context.investorId)
          || (FC.investors && FC.investors.getCurrentId && FC.investors.getCurrentId());
        if(investor){
          const nav = FC.sessionNavigation;
          if(!nav || typeof nav.requestTransition !== 'function') return false;
          return nav.requestTransition('listy inwestorów',()=>{
            if(!FC.views || !FC.views.openInvestorsList) return false;
            return FC.views.openInvestorsList();
          });
        }
      }

      // A failed durable cleanup leaves an active session even after data is clean.
      if(dirty || (session && session.active)){
        const roomContext = dirty && session && session.roomId ? {
          projectId:session.projectId, roomId:session.roomId,
          investorId:session.context && session.context.investorId,
          snapshot:session.snapshot,
        } : null;
        let ok = true;
        try{
          if(dirty && window.FC && window.FC.confirmBox && typeof window.FC.confirmBox.ask === 'function'){
            ok = await window.FC.confirmBox.ask({
              title:'ANULOWAĆ ZMIANY?',
              message:'Niezapisane zmiany zostaną utracone. Czy na pewno chcesz cofnąć zmiany?',
              confirmText:'✕ ANULUJ ZMIANY',
              cancelText:'WRÓĆ',
              confirmTone:'danger',
              cancelTone:'neutral',
              dismissOnOverlay:false
            });
          }
        }catch(_){ ok = false; }
        if(!ok) return true;
        if(roomContext && (session.projectId !== roomContext.projectId || session.roomId !== roomContext.roomId
          || session.snapshot !== roomContext.snapshot || !FC.projectStore || FC.projectStore.getCurrentProjectId() !== roomContext.projectId
          || !FC.investors || FC.investors.getCurrentId() !== roomContext.investorId
          || typeof uiState === 'undefined' || uiState.roomType !== roomContext.roomId)) return false;
        let cancelled = false;
        // Explicit Cancel may retry securing the original baseline; no rollback
        // is attempted unless that proof and the existing guards both succeed.
        if(session && session.retryInitialBegin && session.retryInitialBegin() !== true) return true;
        try{ if(session && typeof session.cancel === 'function') cancelled = session.cancel() === true; }catch(_){ }
        if(!cancelled){
          const message = (session.lastError && session.lastError.message) || 'Nie udało się anulować wszystkich zmian. Sesja edycji została zachowana i nie została zakończona. Spróbuj ponownie. Nie zamykaj programu, jeżeli problem się powtarza.';
          try{
            if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:'Nie udało się anulować zmian', message, sessionDiagnostic:true });
            else window.alert(message);
          }catch(_){ }
          return true;
        }
        if(roomContext){
          let reopened = false;
          try{
            const nav = FC.sessionNavigation;
            if(FC.projectStore.getCurrentProjectId() === roomContext.projectId
              && FC.investors.getCurrentId() === roomContext.investorId
              && nav && nav.reloadCentral() && FC.views && typeof FC.views.openRoom === 'function'){
              // openRoom uses prepareEditState(..., true), bypassing the finished-scope shortcut.
              reopened = await FC.views.openRoom(roomContext.roomId) === true;
            }
            reopened = reopened && session.active && session.durable
              && session.projectId === roomContext.projectId && session.roomId === roomContext.roomId;
          }catch(_){ reopened = false; }
          if(!reopened){
            // The rollback is complete, but an unsecured or stale editor must not remain usable.
            try{ FC.sessionNavigation.sessionFinished(null); }catch(_){ }
            for(const id of ['appView','floatingAdd','sessionButtons']){
              const element = document.getElementById(id);
              if(element) element.style.display = 'none';
            }
            try{ FC.infoBox.open({title:'Nie udało się ponownie zabezpieczyć edytora',sessionDiagnostic:true,message:'Zmiany zostały cofnięte, ale nie potwierdzono zabezpieczenia edytora. Edycja została zablokowana. Spróbuj ponownie otworzyć to pomieszczenie.',okOnly:true}); }catch(_){ }
          }
          return true;
        }
        try{ if(FC.uiState && typeof uiState !== 'undefined') uiState = FC.uiState.set({entry:'rooms',activeTab:'pokoje',roomType:null,lastRoomType:null,selectedCabinetId:null}); }catch(_){ }
        try{ restoreProjectUiAfterSessionChange(); }catch(_){ }
        return true;
      }

      if(inInvestorTab){
        if(investorEditing) return true;
        exitInvestorToList();
        return true;
      }

      try{ if(session && typeof session.commit === 'function') session.commit(); }catch(_){ }
      try{ if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ }
      try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
      return true;
    },
    'session-save': ({event}) => {
      const session = (window.FC && window.FC.session) ? window.FC.session : null;
      const dirty = !!(session && typeof session.isDirty === 'function' && session.isDirty());
      const inInvestorTab = !!(typeof uiState !== 'undefined' && uiState && uiState.activeTab === 'inwestor');
      const investorEditing = !!(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock());

      if(dirty || (session && session.active)){
        if(session && session.retryInitialBegin && session.retryInitialBegin() !== true) return true;
        if(session && session.canSaveProject && !session.canSaveProject()) return true;
        let saved = null;
        let previousWriteError = null;
        try{ previousWriteError = FC.storage.getLastWriteError(); }catch(_){ }
        try{ saved = FC.project.saveConfirmed(projectData); }catch(_){ }
        if(!saved || saved.ok !== true){
          // The shared session gate already explains partial/unconfirmed writes.
          if(saved && (saved.projectSaved || saved.code === 'SESSION_UNCONFIRMED')) return true;
          try{
            const recovery = FC.projectFileRecovery;
            const pending = recovery && typeof recovery.lastPendingRecord === 'function' && recovery.lastPendingRecord();
            const writeError = FC.storage && typeof FC.storage.getLastWriteError === 'function' && FC.storage.getLastWriteError();
            // The central store already reports a fresh storage error; avoid a second dialog.
            const storageReported = writeError && writeError !== previousWriteError && typeof FC.storage.notifyWriteFailure === 'function';
            if(!pending && !storageReported && FC.infoBox && typeof FC.infoBox.open === 'function'){
              FC.infoBox.open({ title:'Nie udało się zapisać projektu', sessionDiagnostic:true, message:'Zmiany nie zostały zapisane. Sesja edycji pozostała aktywna. Nie zamykaj programu i spróbuj ponownie.', okOnly:true });
            }
          }catch(_){ }
          return true;
        }
        projectData = saved.project;
        let committed = false;
        try{ committed = session.commit() === true; }catch(_){ }
        if(!committed){
          const message = 'Projekt został zapisany, ale nie udało się zakończyć sesji edycji. Spróbuj ponownie.';
          try{
            if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:'Sesja nadal aktywna', message, sessionDiagnostic:true });
            else window.alert(message);
          }catch(_){ }
          return true;
        }
        try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
        try{
          if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:'Projekt zapisany', message:'Wszystkie zmiany zostały zapisane poprawnie.', okOnly:true });
        }catch(_){ }
        return true;
      }

      if(inInvestorTab){
        if(investorEditing) return true;
        exitInvestorToList();
        return true;
      }
      try{ if(session && typeof session.commit === 'function') session.commit(); }catch(_){ }
      try{ if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ }
      return true;
    },

    // ===== INWESTOR (UI uses delegated data-action; handlers must exist in registry) =====
    'create-investor': ({event}) => {
      openInvestorDraft('person');
      return true;
    },
    'open-investor': ({event, element}) => {
      const id = element && element.getAttribute ? element.getAttribute('data-inv-id') : null;
      if(!id) return true;
      const activate = ()=>{
        try{
          const persistence = FC.investorPersistence;
          if(!(persistence && typeof persistence.setCurrentInvestorId === 'function')) return false;
          persistence.setCurrentInvestorId(id);
          const actualId = typeof persistence.getCurrentInvestorId === 'function' ? persistence.getCurrentInvestorId() : '';
          if(String(actualId || '') !== String(id)) return false;
          if(FC.investorProjectRuntime && typeof FC.investorProjectRuntime.setActiveProjectFromInvestor === 'function'
            && FC.investorProjectRuntime.setActiveProjectFromInvestor(id) !== true) return false;
          const selected = FC.projectStore && FC.projectStore.getCurrentRecord ? FC.projectStore.getCurrentRecord() : null;
          if(!selected || String(selected.investorId || '') !== String(id)) return false;
          if(typeof uiState !== 'undefined' && uiState){
            uiState.currentInvestorId = id;
            uiState.entry = 'rooms';
            uiState.activeTab = 'inwestor';
            uiState.roomType = null;
            uiState.lastRoomType = null;
            uiState.selectedCabinetId = null;
            FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
            if(FC.views && FC.views.applyFromState) FC.views.applyFromState(uiState);
          }
          if(FC.investorUI && FC.investorUI.state){
            FC.investorUI.state.selectedId = id;
            FC.investorUI.state.mode = 'detail';
            FC.investorUI.state.allowListAccess = false;
            FC.investorUI.state.newlyCreatedId = null;
            FC.investorUI.state.transientInvestor = null;
          }
          if(FC.investorUI && FC.investorUI.render) FC.investorUI.render();
          return true;
        }catch(_){ return false; }
      };
      const nav = FC.sessionNavigation;
      if(nav && typeof nav.requestTransition === 'function') return nav.requestTransition('projektu inwestora', activate);
      if(FC.session && FC.session.active) return false;
      return activate();
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
            try{ if(window.FC.roomRegistry.renderRoomsView) window.FC.roomRegistry.renderRoomsView(); }catch(_){ }
            if(FC.views && FC.views.openRoom) await FC.views.openRoom(room.id);
          }
        }
      }catch(_){ }
      return true;
    },

    'open-room': ({event, element}) => {
      if(FC.investorEditorState && FC.investorEditorState.hasUiLock && FC.investorEditorState.hasUiLock()) return false;
      const room = element && element.getAttribute ? String(element.getAttribute('data-room') || '') : '';
      return room && FC.views && FC.views.openRoom ? FC.views.openRoom(room) : false;
    },

    'tab': ({event, element}) => {
      const tab = element.getAttribute('data-tab');
      if(window.FC && window.FC.investorEditorState && typeof window.FC.investorEditorState.hasUiLock === 'function' && window.FC.investorEditorState.hasUiLock() && tab !== 'inwestor') return true;
      setActiveTab(tab);
      return true;
    },
  };
  // Guard destructive/context-changing actions before their first RAM or UI mutation.
  ['new-investor','create-investor','back-investors','assign-investor','delete-investor','new-project'].forEach(name=> {
    const action = actions[name];
    actions[name] = args=> {
      const nav = FC.sessionNavigation;
      if(nav && nav.needsClosure()) return nav.requestTransition('wybranej operacji', ()=> action(args));
      if(FC.session && FC.session.active) return false;
      return action(args);
    };
  });
  const saveAction=actions['session-save'];
  actions['session-save']=args=>{
    const integration=FC.applicationSyncActions;
    if(!integration || !integration.installed())return saveAction(args);
    return integration.save(()=>{
      const result=saveAction(args),s=FC.session;
      return {ok:result!==false && !s?.active && !s?.snapshot && !s?.durable
        && localStorage.getItem('fc_edit_session_v1')===null};
    });
  };
  FC.actions.register(actions);
})();
