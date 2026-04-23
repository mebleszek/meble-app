(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function bindRoomActions(root, investor, deps){
    const cfg = Object.assign({ isInvestorEditing:null, onUpdated:null }, deps || {});
    if(!root) return;
    const isLocked = ()=> typeof cfg.isInvestorEditing === 'function' ? !!cfg.isInvestorEditing() : false;
    const refresh = ()=>{ try{ typeof cfg.onUpdated === 'function' && cfg.onUpdated(); }catch(_){ } };

    root.querySelectorAll('[data-investor-action="add-room"]').forEach((btn)=> {
      btn.addEventListener('click', async ()=>{
        if(isLocked()) return;
        try{
          if(FC.roomRegistry && typeof FC.roomRegistry.openAddRoomModal === 'function'){
            const room = await FC.roomRegistry.openAddRoomModal(investor);
            if(room) refresh();
          }
        }catch(_){ }
      });
    });

    root.querySelectorAll('[data-investor-action="manage-rooms"]').forEach((btn)=> {
      btn.addEventListener('click', async ()=>{
        if(isLocked()) return;
        try{
          if(FC.roomRegistry && typeof FC.roomRegistry.openManageRoomsModal === 'function'){
            const result = await FC.roomRegistry.openManageRoomsModal(investor);
            if(result) refresh();
          }
        }catch(_){ }
      });
    });
  }

  FC.investorRoomActions = { bindRoomActions };
})();
