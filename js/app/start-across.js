(function(root){
  'use strict';
  const FC = root.FC = root.FC || {};
  const reg = FC.rozkrojStarts = FC.rozkrojStarts || {};
  reg['start-across'] = {
    id: 'start-across',
    label: 'Pierwsze pasy w poprzek',
    resolvePrimaryAxis(){ return 'across'; }
  };
})(typeof self !== 'undefined' ? self : window);
