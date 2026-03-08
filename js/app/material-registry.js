// js/app/material-registry.js
// Shared material registry/helpers extracted from app.js.

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const ns = window.FC.materialRegistry = window.FC.materialRegistry || {};

    if(!ns.MANUFACTURERS){
      ns.MANUFACTURERS = {
        laminat: ['Egger','KronoSpan','Swiss Krono','Woodeco'],
        akryl: ['Rehau','manufaktura Łomża'],
        lakier: ['elektronowa','Pol-wiór'],
        blat: ['Egger','KronoSpan','Swiss Krono','Woodeco'],
        akcesoria: ['blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich']
      };
    }

    if(typeof ns.materialHasGrain !== 'function'){
      ns.materialHasGrain = function(materialName, materials){
        const name = String(materialName || '').trim();
        if(!name) return false;
        try{
          const it = (Array.isArray(materials) ? materials : []).find(m => String(m && m.name || '').trim() === name);
          return !!(it && it.hasGrain);
        }catch(_){
          return false;
        }
      };
    }
  }catch(_){ }
})();
