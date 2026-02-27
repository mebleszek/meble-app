/* sections.js — dodatkowe sekcje zakładek (INWESTOR, ROZRYS)
   Cel: bezpieczne rozszerzanie UI bez mieszania logiki w app.js.
   - steruje widocznością modułów w zależności od uiState.activeTab
   - ukrywa elementy zależne od wybranego pomieszczenia, gdy roomType=null
*/
(() => {
  'use strict';

  window.FC = window.FC || {};
  const FC = window.FC;

  function byId(id){ return document.getElementById(id); }

  function isExtraTab(tab){ return tab === 'inwestor' || tab === 'rozrys'; }

  function update(){
    try{
      const ui = (typeof uiState !== 'undefined' && uiState) ? uiState : null;
      const activeTab = ui?.activeTab || 'wywiad';
      const roomType = ui?.roomType || null;

      const investor = byId('investorModule');
      const rozrys = byId('rozrysModule');
      const roomModule = byId('roomModule');
      const floatingAdd = byId('floatingAdd');

      if(!investor || !rozrys || !roomModule) return;

      const showInvestor = activeTab === 'inwestor';
      const showRozrys = activeTab === 'rozrys';
      const showRoom = !isExtraTab(activeTab);

      investor.style.display = showInvestor ? 'block' : 'none';
      rozrys.style.display = showRozrys ? 'block' : 'none';
      roomModule.style.display = showRoom ? 'block' : 'none';

      // Floating + only makes sense in room context
      if(floatingAdd){
        floatingAdd.style.display = (showRoom && !!roomType) ? 'flex' : 'none';
      }

      // If user is on room tabs but no room is selected, we still hide room module to avoid errors
      if(showRoom && !roomType){
        roomModule.style.display = 'none';
      }
    }catch(_){
      // fail-soft: never crash app
    }
  }

  FC.sections = {
    update,
    isExtraTab
  };
})();
