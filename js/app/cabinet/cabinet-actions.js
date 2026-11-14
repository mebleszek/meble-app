// js/app/cabinet/cabinet-actions.js
// Proste akcje szafek wydzielone z app.js.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function addCabinet(){
    if(typeof uiState === 'undefined' || !uiState.roomType){ try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak pomieszczenia', message:'Wybierz pomieszczenie najpierw.' }); }catch(_){} return; }
    if(typeof openCabinetModalForAdd === 'function') return openCabinetModalForAdd();
  }

  async function deleteCabinetById(cabId){
    const FC = window.FC || {};
    if(typeof uiState === 'undefined' || typeof projectData === 'undefined' || typeof STORAGE_KEYS === 'undefined') return;
    const room = uiState.roomType;
    if(!room) return;
    if(!cabId){ try{ FC.infoBox && FC.infoBox.open && FC.infoBox.open({ title:'Brak szafki', message:'Wybierz szafkę do usunięcia.' }); }catch(_){} return; }

    const cab = (projectData[room] && projectData[room].cabinets || []).find(c => c.id === cabId);
    const projectId = FC.projectStore?.getCurrentProjectId?.();
    const label = cab ? `${cab.type || 'szafka'} ${cab.subType ? '('+cab.subType+')' : ''} ${cab.width}×${cab.height}×${cab.depth}` : 'szafkę';
    let ok = false;
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
      }else if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({
          title:'Brak okna potwierdzenia',
          message:'Programowe okno potwierdzenia nie jest teraz dostępne. Odśwież aplikację i spróbuj ponownie.'
        });
      }
    }catch(_){
      try{
        FC.infoBox && typeof FC.infoBox.open === 'function' && FC.infoBox.open({
          title:'Brak okna potwierdzenia',
          message:'Programowe okno potwierdzenia nie jest teraz dostępne. Odśwież aplikację i spróbuj ponownie.'
        });
      }catch(__){ }
      ok = false;
    }
    if(!ok) return;

    const writer = FC.applicationWrite;
    const remove = ()=>{
      if(!cab || !projectId || FC.projectStore.getCurrentProjectId() !== projectId || uiState.roomType !== room
        || !projectData[room]?.cabinets?.some(row=>row.id === cabId)) return false;
      if(!FC.cabinetModalFinalize.beginCabinetDraft()) return false;
      removeCabinet(room, cabId);
      FC.cabinetModalFinalize.persistProjectAndUi();
      if(writer) writer.afterCommit(refreshCabinets);
      else refreshCabinets();
      return true;
    };
    try{
      return writer ? await writer.draftHandler(remove)() : remove();
    }catch(error){
      FC.infoBox?.open({title:'Nie udało się usunąć szafki',message:error.code || error.message,okOnly:true});
      return false;
    }
  }

  function removeCabinet(room, cabId){
    if(typeof removeFrontsForCab === 'function') removeFrontsForCab(room, cabId);
    const data = projectData[room];
    const cabinet = data.cabinets.find(c=>c.id===cabId);
    data.cabinets = data.cabinets.filter(c=>c.id!==cabId);
    for(const space of ['partOverrides','cabinetGroupOverrides']){
      if(data.production?.[space]) delete data.production[space][cabId];
    }
    for(const segment of data.layout?.segments || []){
      for(const [row,items] of Object.entries(segment.rows || {})){
        segment.rows[row] = items.filter(item=>item.kind!=='cabinet' || item.id!==cabId);
      }
    }
    const setId = cabinet?.setId;
    if(setId && !data.cabinets.some(c=>c.setId===setId)){
      data.sets = (data.sets || []).filter(set=>set.id!==setId);
      if(typeof removeFrontsForSet === 'function') removeFrontsForSet(room,setId);
      if(data.production?.setGroupOverrides) delete data.production.setGroupOverrides[setId];
    }
    if(uiState.selectedCabinetId === cabId) uiState.selectedCabinetId = null;
  }

  function refreshCabinets(){
    const FC = window.FC || {};
    try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
    if(typeof renderCabinets === 'function') renderCabinets();
  }

  window.FC.cabinetActions = { addCabinet, deleteCabinetById };
})();
