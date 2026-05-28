(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const model = FC.wycenaTabSelectionModel || {};
  const pickers = FC.wycenaTabSelectionPickers || {};
  const render = FC.wycenaTabSelectionRender || {};

  FC.wycenaTabSelection = Object.assign({}, model, pickers, render);
})();
