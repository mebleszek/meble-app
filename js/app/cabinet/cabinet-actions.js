// js/app/cabinet/cabinet-actions.js
// Proste akcje szafek wydzielone z app.js.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function addCabinet(){
    if(typeof uiState === 'undefined' || !uiState.roomType){ alert('Wybierz pomieszczenie najpierw'); return; }
    if(typeof openCabinetModalForAdd === 'function') return openCabinetModalForAdd();
  }

  async function deleteCabinetById(cabId){
    const FC = window.FC || {};
    if(typeof uiState === 'undefined' || typeof projectData === 'undefined' || typeof STORAGE_KEYS === 'undefined') return;
    const room = uiState.roomType;
    if(!room) return;
    if(!cabId){ alert('Wybierz szafkę do usunięcia'); return; }

    const cab = (projectData[room] && projectData[room].cabinets || []).find(c => c.id === cabId);
    const label = cab ? `${cab.type || 'szafka'} ${cab.subType ? '('+cab.subType+')' : ''} ${cab.width}×${cab.height}×${cab.depth}` : 'szafkę';
    let ok = true;
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
        ok = await FC.confirmBox.ask({
          title:'USUNĄĆ SZAFKĘ?',
          message:`Usunąć ${label}?`,
          confirmText:'USUŃ',
          cancelText:'Wróć',
          confirmTone:'danger',
          cancelTone:'neutral',
          dismissOnOverlay:false
        });
      }else{
        ok = window.confirm(`Usunąć ${label}?`);
      }
    }catch(_){ ok = window.confirm(`Usunąć ${label}?`); }
    if(!ok) return;

    try{
      if(FC.session && typeof FC.session.begin === 'function' && !(FC.session.active)) FC.session.begin();
    }catch(_){ }

    if(typeof removeFrontsForCab === 'function') removeFrontsForCab(room, cabId);

    projectData[room].cabinets = (projectData[room].cabinets || []).filter(c => c.id !== cabId);

    if(uiState.selectedCabinetId === cabId) uiState.selectedCabinetId = null;

    try{
      if(FC.project && typeof FC.project.save === 'function') FC.project.save(projectData);
      else FC.storage && typeof FC.storage.setJSON === 'function' && FC.storage.setJSON(STORAGE_KEYS.projectData, projectData);
    }catch(_){ }
    try{ FC.storage && typeof FC.storage.setJSON === 'function' && FC.storage.setJSON(STORAGE_KEYS.ui, uiState); }catch(_){ }
    try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
    if(typeof renderCabinets === 'function') renderCabinets();
  }

  window.FC.cabinetActions = { addCabinet, deleteCabinetById };
})();
