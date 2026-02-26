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
    'create-set': ({event, element}) => {
      try{
        const state = (window.FC && FC.uiState && typeof FC.uiState.get==='function') ? FC.uiState.get() : (typeof uiState!=='undefined'?uiState:{});
        const room = state.roomType || (uiState && uiState.roomType) || null;
        const beforeCab = room && projectData && projectData[room] && Array.isArray(projectData[room].cabinets) ? projectData[room].cabinets.length : 0;
        const beforeSets = room && projectData && projectData[room] && Array.isArray(projectData[room].sets) ? projectData[room].sets.length : 0;

        const ok = (typeof createOrUpdateSetFromWizard==='function') ? createOrUpdateSetFromWizard() : false;

        const afterCab = room && projectData && projectData[room] && Array.isArray(projectData[room].cabinets) ? projectData[room].cabinets.length : 0;
        const afterSets = room && projectData && projectData[room] && Array.isArray(projectData[room].sets) ? projectData[room].sets.length : 0;

        if(!ok || (afterCab===beforeCab && afterSets===beforeSets)){
          const presetEl = document.querySelector('#setTiles .mini-tile.selected') || document.querySelector('#setTiles .mini-tile');
          const preset = presetEl ? (presetEl.getAttribute('data-preset')||presetEl.dataset.preset||presetEl.textContent||'') : '';
          alert(
            'Nie dodano zestawu.
' +
            'roomType=' + (room||'BRAK') + '
' +
            'preset=' + (preset||'BRAK') + '
' +
            'frontCount=' + (document.getElementById('setFrontCount')?.value||'BRAK') + '
' +
            'material=' + (document.getElementById('setFrontMaterial')?.value||'BRAK') + '
' +
            'color=' + (document.getElementById('setFrontColor')?.value||'BRAK')
          );
          // zdejmij focus z przycisku, żeby nie wyglądał jak "zablokowany"
          try{ (element||event?.target)?.blur?.(); }catch(_){}
        }
        return true;
      }catch(e){
        alert('Błąd w create-set: ' + (e && e.message ? e.message : e));
        return true;
      }
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