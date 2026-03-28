// js/app/material/material-registry.js
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
          const fallback = (typeof root !== 'undefined' && Array.isArray(root.materials)) ? root.materials : ((typeof window !== 'undefined' && Array.isArray(window.materials)) ? window.materials : []);
          const list = Array.isArray(materials) ? materials : fallback;
          const it = list.find(m => String(m && m.name || '').trim() === name);
          return !!(it && it.hasGrain);
        }catch(_){
          return false;
        }
      };
    }

    if(typeof window.FC.materialHasGrain !== 'function'){
      window.FC.materialHasGrain = function(materialName, materials){
        return ns.materialHasGrain(materialName, materials);
      };
    }
  }catch(_){ }
})();
