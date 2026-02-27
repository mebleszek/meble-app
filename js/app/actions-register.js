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
      // Reset danych projektu
      projectData = FC.utils.clone(DEFAULT_PROJECT);
      // Zapis projektu (bez ryzyka nadpisania zmiennej zwrotką)
      try {
        if (FC.project && typeof FC.project.save === 'function') {
          FC.project.save(projectData);
        } else if (FC.storage && typeof FC.storage.setJSON === 'function') {
          FC.storage.setJSON(STORAGE_KEYS.project, projectData);
        }
      } catch(e) { /* noop */ }

      // Reset stanu UI (użyj jednego źródła prawdy jeśli jest)
      try {
        const ui = (FC.uiState && typeof FC.uiState.get === 'function') ? FC.uiState.get() : (window.uiState || {});
        ui.roomType = null;
        ui.selectedCabinetId = null;
        ui.expanded = {};
        ui.activeTab = 'wywiad';
        if (FC.uiState && typeof FC.uiState.set === 'function') {
          FC.uiState.set(ui);
        } else if (FC.storage && typeof FC.storage.setJSON === 'function') {
          FC.storage.setJSON(STORAGE_KEYS.ui, ui);
        } else {
          window.uiState = ui;
        }
      } catch(e) { /* noop */ }

      // Widok: wróć do listy pomieszczeń
      document.getElementById('roomsView').style.display='block';
      document.getElementById('appView').style.display='none';
      document.getElementById('topTabs').style.display='none';

      // Render bez zależności od roomType
      try {
        if (typeof renderRooms === 'function') renderRooms();
        else if (typeof renderCabinets === 'function') renderCabinets();
      } catch(e) { /* noop */ }
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