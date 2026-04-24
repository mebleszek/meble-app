(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});
  const data = ns.frontHardwareAventosData || {};
  const calc = ns.frontHardwareAventosCalc || {};
  const selector = ns.frontHardwareAventosSelector || {};

  ns.frontHardware = Object.assign({}, ns.frontHardware || {}, {
    FC_BLUM_FLAP_KIND_LABEL: data.FC_BLUM_FLAP_KIND_LABEL || {},
    estimateFlapWeightKg: calc.estimateFlapWeightKg || function(){ return 0; },
    blumAventosPowerFactor: calc.blumAventosPowerFactor || function(){ return 0; },
    getBlumAventosInfo: selector.getBlumAventosInfo || function(){ return null; }
  });
})();
