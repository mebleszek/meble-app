// js/tabs/material.js
// Zakładka MATERIAŁ — rozpiska elementów (bez zmian UI).

(function(){
  'use strict';
  window.FC = window.FC || {};

  function render(ctx){
    if(typeof window.renderMaterialsTab === 'function'){
      window.renderMaterialsTab(ctx.listEl, ctx.room);
    }
  }

  (window.FC.tabsRouter || window.FC.tabs || {}).register?.('material', { mount(){}, render, unmount(){} });
})();
