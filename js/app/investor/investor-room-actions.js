(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function bindRoomActions(root, investor, deps){
    const cfg = Object.assign({ isInvestorEditing:null, onUpdated:null }, deps || {});
    if(!root) return;
    const isLocked = ()=> typeof cfg.isInvestorEditing === 'function' ? !!cfg.isInvestorEditing() : false;
    const refresh = ()=>{ try{ typeof cfg.onUpdated === 'function' && cfg.onUpdated(); }catch(_){ } };
    const isSessionDirty = ()=>{
      try{ return !!(FC.session && typeof FC.session.isDirty === 'function' && FC.session.isDirty()); }catch(_){ return false; }
    };
    const closeCommittedRoomModalSession = (wasDirtyBefore)=>{
      if(wasDirtyBefore) return;
      try{
        if(FC.session && typeof FC.session.commit === 'function' && FC.session.active){
          FC.session.commit();
        }
      }catch(_){ }
      try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
    };

    root.querySelectorAll('[data-investor-action="add-room"]').forEach((btn)=> {
      btn.addEventListener('click', async ()=>{
        if(isLocked()) return;
        try{
          if(FC.roomRegistry && typeof FC.roomRegistry.openAddRoomModal === 'function'){
            const wasDirtyBefore = isSessionDirty();
            const room = await FC.roomRegistry.openAddRoomModal();
            if(room){
              closeCommittedRoomModalSession(wasDirtyBefore);
              refresh();
            }
          }
        }catch(_){ }
      });
    });

    root.querySelectorAll('[data-investor-action="manage-rooms"]').forEach((btn)=> {
      btn.addEventListener('click', async ()=>{
        if(isLocked()) return;
        try{
          if(FC.roomRegistry && typeof FC.roomRegistry.openManageRoomsModal === 'function'){
            const wasDirtyBefore = isSessionDirty();
            const result = await FC.roomRegistry.openManageRoomsModal(investor);
            if(result){
              closeCommittedRoomModalSession(wasDirtyBefore);
              refresh();
            }
          }
        }catch(_){ }
      });
    });
  }

  FC.investorRoomActions = { bindRoomActions };
})();
