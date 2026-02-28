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

  function isExtraTab(tab){ return tab === 'inwestor' || tab === 'rozrys' || tab === 'magazyn'; }

  function update(){
    try{
      const ui = (typeof uiState !== 'undefined' && uiState) ? uiState : null;
      const activeTab = ui?.activeTab || 'wywiad';
      const roomType = ui?.roomType || null;

      // Render extra modules when active (fail-soft)
      if(activeTab === 'rozrys' && FC.rozrys && typeof FC.rozrys.render === 'function'){
        FC.rozrys.render();
      }
      if(activeTab === 'magazyn' && FC.magazyn && typeof FC.magazyn.render === 'function'){
        FC.magazyn.render();
      }
      if(activeTab === 'inwestor' && FC.inwestor && typeof FC.inwestor.render === 'function'){
        FC.inwestor.render();
      }
      // investors list view can render too (entry-based)
      if((ui && ui.entry === 'investors') && FC.inwestor && typeof FC.inwestor.renderList === 'function'){
        FC.inwestor.renderList();
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
