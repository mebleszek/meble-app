/* actions-register.js — rejestracja data-action w jednym miejscu.
   Ładować po js/core/actions.js i PRZED js/app.js.
   Uwaga: Handlery mogą odwoływać się do globalnych bindingów z app.js (uiState, projectData, funkcje).
*/
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  if (!FC.actions || typeof FC.actions.register !== 'function') return;

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
      // Start "new client" session: snapshot current local data for Cancel
      try{ if(window.FC && window.FC.session && typeof window.FC.session.begin === 'function') window.FC.session.begin(); }catch(_){ }
      // Create investor and open investor form (no access to list from here)
      try{
        if(window.FC && window.FC.investors && typeof window.FC.investors.create === 'function'){
          const inv = window.FC.investors.create({ kind:'person' });
          if(inv && inv.id){
            uiState.currentInvestorId = inv.id;
          }
          try{
            if(window.FC && window.FC.investorUI && window.FC.investorUI.state){
              window.FC.investorUI.state.selectedId = inv.id;
              window.FC.investorUI.state.mode = 'detail';
              window.FC.investorUI.state.allowListAccess = false;
            }
          }catch(_){ }
        }
      }catch(_){ }
      uiState.entry = 'rooms';
      uiState.roomType = null;
      uiState.activeTab = 'inwestor';
      uiState.selectedCabinetId = null;
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      if(FC.views && FC.views.applyFromState) FC.views.applyFromState(uiState);
      try{ if(window.FC && window.FC.sections && typeof window.FC.sections.update === 'function') window.FC.sections.update(); }catch(_){ }
      return true;
    },

    // Session buttons
    'session-cancel': ({event}) => {
      try{ if(window.FC && window.FC.session && typeof window.FC.session.cancel === 'function') window.FC.session.cancel(); }catch(_){ }
      // IMPORTANT: po anulowaniu musimy wyczyścić stan w pamięci (uiState/projectData),
      // inaczej aplikacja może ponownie zapisać "nowe" dane do localStorage.
      // Najpewniejsze i najszybsze: pełny reload do strony głównej.
      try{ window.location.reload(); }catch(_){ }
      return true;
    },
    'session-save': ({event}) => {
      // Data is saved live (local). Commit just clears snapshot.
      try{ if(window.FC && window.FC.session && typeof window.FC.session.commit === 'function') window.FC.session.commit(); }catch(_){ }
      try{ if(FC.views && FC.views.openHome) FC.views.openHome(); }catch(_){ }
      return true;
    },

    // ===== INWESTOR (UI uses delegated data-action; handlers must exist in registry) =====
    'create-investor': ({event}) => {
      try{
        if(window.FC && window.FC.investors && typeof window.FC.investors.create === 'function'){
          const inv = window.FC.investors.create({ kind:'person' });

          // Each investor must have their own project dataset.
          // Switch to a clean project slot for this new investor.
          try{ if(window.FC && window.FC.projects && typeof window.FC.projects.switchToInvestor === 'function') window.FC.projects.switchToInvestor(inv.id, { createEmpty: true }); }catch(_){ }

          if(typeof uiState !== 'undefined' && uiState) uiState.currentInvestorId = inv.id;
          if(window.FC && window.FC.investorUI && window.FC.investorUI.state){
            window.FC.investorUI.state.selectedId = inv.id;
            window.FC.investorUI.state.mode = 'detail';
          }
          try{ window.FC.investorUI && window.FC.investorUI.render && window.FC.investorUI.render(); }catch(_){ }
        }
      }catch(_){ }
      return true;
    },
    'open-investor': ({event, element}) => {
      const id = element?.getAttribute ? element.getAttribute('data-inv-id') : null;
      if(!id) return true;

      // Switch active project to this investor (so WYWIAD/MATERIAŁ etc are not shared across investors)
      try{ if(window.FC && window.FC.projects && typeof window.FC.projects.switchToInvestor === 'function') window.FC.projects.switchToInvestor(id, { createEmpty: true }); }catch(_){ }

      // Start edit session snapshot AFTER switching (Cancel should revert investor + project changes)
      try{ if(window.FC && window.FC.session && typeof window.FC.session.begin === 'function') window.FC.session.begin(); }catch(_){ }

      try{
        if(window.FC && window.FC.investors && typeof window.FC.investors.setCurrentId === 'function'){
          window.FC.investors.setCurrentId(id);
        }
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
        // Switch active project to the selected investor (isolation guarantee)
        try{ if(window.FC && window.FC.projects && typeof window.FC.projects.switchToInvestor === 'function') window.FC.projects.switchToInvestor(id, { createEmpty: true }); }catch(_){ }

        if(window.FC && window.FC.investors && typeof window.FC.investors.setCurrentId === 'function'){
          window.FC.investors.setCurrentId(id);
        }
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
        alert('Przypisano inwestora do bieżącego projektu (lokalnie).');
      }catch(_){ }
      return true;
    },
    'delete-investor': ({event, element}) => {
      const id = element?.getAttribute ? element.getAttribute('data-inv-id') : null;
      if(!id) return true;
      if(!confirm('Usunąć inwestora?')) return true;
      try{
        if(window.FC && window.FC.investors && typeof window.FC.investors.remove === 'function'){
          window.FC.investors.remove(id);
        }
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

    'open-room': ({event, element}) => {
      const room = element.getAttribute('data-room');
      // Enter room editor
      uiState.roomType = room;
      // From investor screen we want a fast jump to pricing. From other placeholder screens, go to WYWIAD.
      if(uiState.activeTab === 'inwestor') uiState.activeTab = 'wycena';
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
      setActiveTab(tab);
      return true;
    },
  });
})();