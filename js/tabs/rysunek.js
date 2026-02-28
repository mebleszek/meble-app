// js/tabs/rysunek.js
// Zakładka RYSUNEK — wykorzystuje istniejący renderer z app.js.

(function(){
  'use strict';
  window.FC = window.FC || {};

  function render(ctx){
    if(typeof window.renderDrawingTab === 'function'){
      window.renderDrawingTab(ctx.listEl, ctx.room);
    }
  }

  (window.FC.tabsRouter || window.FC.tabs || {}).register?.('rysunek', { mount(){}, render, unmount(){} });
})();
