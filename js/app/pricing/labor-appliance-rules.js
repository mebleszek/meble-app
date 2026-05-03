// js/app/pricing/labor-appliance-rules.js
// Reguły montażu sprzętu przypięte do typu szafki: domyślnie włączone, ale możliwe do wyłączenia w WYWIADZIE.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const MODE_MOUNT = 'mount';
  const MODE_NONE = 'none';

  const APPLIANCE_BY_SUBTYPE = {
    zmywarkowa: { serviceName:'Zmywarka do zabudowy', label:'Zmywarka do zabudowy' },
    piekarnikowa: { serviceName:'Piekarnik do zabudowy', label:'Piekarnik do zabudowy' },
    okap: { serviceName:'Okap podszafkowy / teleskopowy', label:'Okap podszafkowy / teleskopowy' },
    lodowkowa: { serviceName:'Lodówka do zabudowy', label:'Lodówka do zabudowy' },
  };

  function details(cabinet){
    if(cabinet && cabinet.details && typeof cabinet.details === 'object') return cabinet.details;
    return {};
  }

  function getApplianceForCabinet(cabinet){
    const cab = cabinet && typeof cabinet === 'object' ? cabinet : {};
    const sub = String(cab.subType || '').trim();
    const base = APPLIANCE_BY_SUBTYPE[sub] || null;
    if(!base) return null;
    if(sub === 'lodowkowa'){
      const fridgeMode = String(details(cab).fridgeOption || 'zabudowa');
      if(fridgeMode !== 'zabudowa') return null;
    }
    return Object.assign({ subType:sub }, base);
  }

  function normalizeMountingMode(value){
    const raw = String(value == null ? '' : value).trim();
    return raw === MODE_NONE ? MODE_NONE : MODE_MOUNT;
  }

  function getMountingMode(cabinet){
    const d = details(cabinet);
    return normalizeMountingMode(d.applianceMountingMode || d.applianceMounting || MODE_MOUNT);
  }

  function isMountingEnabled(cabinet){
    return !!getApplianceForCabinet(cabinet) && getMountingMode(cabinet) !== MODE_NONE;
  }

  function setMountingMode(draft, mode){
    if(!(draft && typeof draft === 'object')) return draft;
    draft.details = Object.assign({}, draft.details || {}, { applianceMountingMode: normalizeMountingMode(mode) });
    return draft;
  }

  function describeCabinetMounting(cabinet){
    const appliance = getApplianceForCabinet(cabinet);
    if(!appliance) return '';
    return isMountingEnabled(cabinet)
      ? `Montaż sprzętu: ${appliance.label}`
      : `Montaż sprzętu: bez montażu`;
  }

  FC.laborApplianceRules = {
    MODE_MOUNT,
    MODE_NONE,
    APPLIANCE_BY_SUBTYPE,
    getApplianceForCabinet,
    normalizeMountingMode,
    getMountingMode,
    isMountingEnabled,
    setMountingMode,
    describeCabinetMounting,
  };
})();
