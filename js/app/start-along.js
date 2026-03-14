(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojStarts = FC.rozkrojStarts || {};
  reg['start-along'] = {
    id: 'start-along',
    label: 'Pierwsze pasy w poprzek',
    resolvePrimaryAxis(){ return 'along'; }
  };
})(typeof self !== 'undefined' ? self : window);
