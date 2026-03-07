// js/app/cabinet-actions.js
// Proste akcje szafek wydzielone z app.js.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function addCabinet(){
    if(typeof uiState === 'undefined' || !uiState.roomType){ alert('Wybierz pomieszczenie najpierw'); return; }
    if(typeof openCabinetModalForAdd === 'function') return openCabinetModalForAdd();
  }

  function deleteCabinetById(cabId){
    const FC = window.FC || {};
    if(typeof uiState === 'undefined' || typeof projectData === 'undefined' || typeof STORAGE_KEYS === 'undefined') return;
    const room = uiState.roomType;
    if(!room) return;
    if(!cabId){ alert('Wybierz szafkę do usunięcia'); return; }

    const cab = (projectData[room] && projectData[room].cabinets || []).find(c => c.id === cabId);
    const label = cab ? `${cab.type || 'szafka'} ${cab.subType ? '('+cab.subType+')' : ''} ${cab.width}×${cab.height}×${cab.depth}` : 'szafkę';
    if(!confirm(`Usunąć ${label}?`)) return;

    if(typeof removeFrontsForCab === 'function') removeFrontsForCab(room, cabId);

    projectData[room].cabinets = (projectData[room].cabinets || []).filter(c => c.id !== cabId);

    if(uiState.selectedCabinetId === cabId) uiState.selectedCabinetId = null;

    try{ FC.storage && typeof FC.storage.setJSON === 'function' && FC.storage.setJSON(STORAGE_KEYS.projectData, projectData); }catch(_){ }
    try{ FC.storage && typeof FC.storage.setJSON === 'function' && FC.storage.setJSON(STORAGE_KEYS.ui, uiState); }catch(_){ }
    if(typeof renderCabinets === 'function') renderCabinets();
  }

  window.FC.cabinetActions = { addCabinet, deleteCabinetById };
})();
