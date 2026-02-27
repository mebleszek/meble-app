// js/app/calc.js
// Minimal calculation layer extracted from app.js (Etap 3A)
// Keep as classic script (no ES modules) for maximum GitHub Pages compatibility.

(function(){
  'use strict';
  window.FC = window.FC || {};

  /**
   * Calculation helpers.
   * Functions accept projectData explicitly to avoid hidden coupling.
   */
  const calc = {
    // Kitchen: available top cabinet height = roomHeight - bottom - counter - gap - ceiling blende
    calculateAvailableTopHeight(projectData){
      try{
        const s = projectData && projectData.kuchnia && projectData.kuchnia.settings ? projectData.kuchnia.settings : {};
        const h = (Number(s.roomHeight)||0) - (Number(s.bottomHeight)||0) - (Number(s.counterThickness)||0) - (Number(s.gapHeight)||0) - (Number(s.ceilingBlende)||0);
        return h>0 ? Math.round(h*10)/10 : 0;
      }catch(_){
        return 0;
      }
    },

    // Sets: top = roomHeight - sum of lower heights - blende
    calcTopForSet(projectData, room, blende, sumLowerHeights){
      try{
        const s = projectData && projectData[room] && projectData[room].settings ? projectData[room].settings : {};
        const h = (Number(s.roomHeight)||0) - (Number(sumLowerHeights)||0) - (Number(blende)||0);
        return h>0 ? Math.round(h*10)/10 : 0;
      }catch(_){
        return 0;
      }
    }
  };

  // Expose
  window.FC.calc = window.FC.calc || calc;
})();
