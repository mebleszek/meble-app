// Cargo uses the existing cabinet extra-select launcher, Save and Cancel.
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 function render(ctx){
  const draft=ctx.draft;draft.frontCount=1;draft.details=draft.details||{};draft.details.shelves=0;
  FC.cabinetDrawerRequirements?.cleanDrawerTrash?.(draft);
  ctx.addSelect('System Cargo','cargoModel',[{v:'',t:'Wybierz system Cargo'},
   ...FC.hardwareCargoCatalog.models.map(row=>({v:row.id,t:row.name}))]);
  return true;
 }
 FC.cabinetModalCargo={render};
})();
