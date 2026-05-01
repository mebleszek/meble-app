(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const selectionApi = FC.wycenaCoreSelection;
  if(!selectionApi){
    throw new Error('Brak FC.wycenaCoreSelection — sprawdź kolejność ładowania Wyceny.');
  }

  function roomLabel(id){
    try{ return FC.roomRegistry && typeof FC.roomRegistry.getRoomLabel === 'function' ? FC.roomRegistry.getRoomLabel(id) : String(id || '—'); }catch(_){ return String(id || '—'); }
  }

  function project(){
    try{ return FC.rozrys && typeof FC.rozrys.safeGetProject === 'function' ? FC.rozrys.safeGetProject() : (typeof projectData !== 'undefined' ? projectData : null); }catch(_){ return null; }
  }

  function selectedCabinets(selectedRooms){
    const proj = project() || {};
    const rooms = Array.isArray(selectedRooms) ? selectedRooms : [];
    const out = [];
    rooms.forEach((roomId)=>{
      const room = proj && proj[roomId];
      const cabinets = room && Array.isArray(room.cabinets) ? room.cabinets : [];
      cabinets.forEach((cab)=> out.push({ roomId, roomLabel:roomLabel(roomId), cabinet:cab }));
    });
    return out;
  }

  function getSelectedAggregate(selectionOverride){
    const rooms = selectionApi.decodeSelectedRooms(selectionOverride);
    try{
      return FC.rozrys && typeof FC.rozrys.aggregatePartsForProject === 'function'
        ? FC.rozrys.aggregatePartsForProject(rooms)
        : { byMaterial:{}, materials:[], groups:{}, selectedRooms:rooms };
    }catch(_){
      return { byMaterial:{}, materials:[], groups:{}, selectedRooms:rooms };
    }
  }

  function getScopedMaterials(aggregate, selectionOverride){
    const scope = selectionApi.decodeMaterialScope(selectionOverride);
    try{
      if(FC.rozrysScope && typeof FC.rozrysScope.getOrderedMaterialsForSelection === 'function'){
        return FC.rozrysScope.getOrderedMaterialsForSelection(scope, aggregate, { aggregatePartsForProject:()=> aggregate });
      }
    }catch(_){ }
    return Array.isArray(aggregate && aggregate.materials) ? aggregate.materials.slice() : [];
  }

  FC.wycenaCoreSource = {
    roomLabel,
    project,
    selectedCabinets,
    getSelectedAggregate,
    getScopedMaterials,
  };
})();
