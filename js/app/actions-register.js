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
    'create-set': ({event}) => {
      try{
        const room = (typeof uiState !== 'undefined' && uiState) ? uiState.roomType : null;
        if(!room){ alert('Wybierz pomieszczenie'); return true; }

        const beforeCab = (projectData && projectData[room] && Array.isArray(projectData[room].cabinets)) ? projectData[room].cabinets.length : 0;
        const beforeSet = (projectData && projectData[room] && Array.isArray(projectData[room].sets)) ? projectData[room].sets.length : 0;

        const ok = (typeof createOrUpdateSetFromWizard === 'function') ? createOrUpdateSetFromWizard() : false;

        const afterCab = (projectData && projectData[room] && Array.isArray(projectData[room].cabinets)) ? projectData[room].cabinets.length : 0;
        const afterSet = (projectData && projectData[room] && Array.isArray(projectData[room].sets)) ? projectData[room].sets.length : 0;

        if(ok === false || (afterCab === beforeCab && afterSet === beforeSet)){
          alert('Nie dodano zestawu. Sprawdź: czy wybrany jest zestaw (A/C/D) oraz czy pola są wypełnione.');
        }
      }catch(err){
        alert('Błąd przy dodawaniu zestawu: ' + (err && (err.message || err) ? (err.message || err) : 'nieznany'));
      }
      return true;
    },

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
      uiState.roomType = null;
      uiState.selectedCabinetId = null;
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      document.getElementById('roomsView').style.display='block';
      document.getElementById('appView').style.display='none';
      document.getElementById('topTabs').style.display = 'none';
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
      uiState.roomType = room;
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      document.getElementById('roomsView').style.display='none';
      document.getElementById('appView').style.display='block';
      document.getElementById('topTabs').style.display = 'inline-block';
      uiState.activeTab = 'wywiad';
      FC.storage.setJSON(STORAGE_KEYS.ui, uiState);
      document.querySelectorAll('.tab-btn').forEach(tbtn => tbtn.style.background = (tbtn.getAttribute('data-tab') === uiState.activeTab) ? '#e6f7ff' : 'var(--card)');
      renderCabinets();
      return true;
    },

    'tab': ({event, element}) => {
      const tab = element.getAttribute('data-tab');
      setActiveTab(tab);
      return true;
    },
  });
})();