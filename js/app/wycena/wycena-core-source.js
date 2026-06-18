(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const selectionApi = FC.wycenaCoreSelection;

  function retryWycenaCoreModule(apiKey, missingLabel){
    try{
      const state = FC.__wycenaCoreModuleRetries = FC.__wycenaCoreModuleRetries || {};
      const count = state[apiKey] = (Number(state[apiKey]) || 0) + 1;
      if(count > 12){
        try{ console.warn('WYCENA: moduł nie wystartował po ponowieniach', apiKey, missingLabel); }catch(_){}
        return;
      }
      const current = document.currentScript && document.currentScript.getAttribute ? (document.currentScript.getAttribute('src') || '') : '';
      if(!current) return;
      window.setTimeout(function(){
        try{
          if(FC[apiKey]) return;
          const script = document.createElement('script');
          script.defer = true;
          script.async = false;
          script.src = current + (current.indexOf('?') === -1 ? '?' : '&') + 'wycena_dep_retry=' + count + '_' + Date.now();
          document.head.appendChild(script);
        }catch(_){}
      }, Math.min(1200, 80 * count));
    }catch(_){}
  }

  if(!selectionApi){
    retryWycenaCoreModule('wycenaCoreSource', 'FC.wycenaCoreSelection');
    return;
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
      const factsApi = FC.cabinetDerivedFacts || null;
      if(factsApi && typeof factsApi.aggregatePartsForRooms === 'function'){
        const aggregate = factsApi.aggregatePartsForRooms(rooms, { ensure:true, persist:true });
        if(aggregate && Array.isArray(aggregate.materials)) return aggregate;
      }
    }catch(_){ }
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
