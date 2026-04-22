// AKTYWNY MODUŁ: plik ładowany przez index.html w tej wersji.
// Trzyma lekkie helpery obliczeniowe wykorzystywane przez app.js i modal szafki.
// js/app/shared/calc.js
// Minimal calculation layer extracted from app.js (aktywny moduł)
// Keep as classic script (no ES modules) for maximum GitHub Pages compatibility.

(function(){
  'use strict';
  window.FC = window.FC || {};

  /**
   * Calculation helpers.
   * Functions accept projectData explicitly to avoid hidden coupling.
   */
  const calc = {
    // Available top cabinet height for the active room = roomHeight - bottom - counter - gap - ceiling blende
    calculateAvailableTopHeight(projectData, room){
      try{
        const roomKey = String(room || '').trim() || 'kuchnia';
        const settings = projectData && projectData[roomKey] && projectData[roomKey].settings ? projectData[roomKey].settings : {};
        const h = (Number(settings.roomHeight)||0) - (Number(settings.bottomHeight)||0) - (Number(settings.counterThickness)||0) - (Number(settings.gapHeight)||0) - (Number(settings.ceilingBlende)||0);
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
  try{
    window.calculateAvailableTopHeight = function(room){
      const hostProjectData = (typeof projectData !== 'undefined') ? projectData : (window.projectData || {});
      const roomKey = String(room || (((typeof uiState !== 'undefined' && uiState) ? uiState.roomType : (window.uiState && window.uiState.roomType)) || '')).trim() || 'kuchnia';
      return calc.calculateAvailableTopHeight(hostProjectData, roomKey);
    };
  }catch(_){ }
})();
