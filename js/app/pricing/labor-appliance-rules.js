// js/app/pricing/labor-appliance-rules.js
// Reguły montażu sprzętu przypięte do typu szafki: domyślnie włączone, ale możliwe do wyłączenia w WYWIADZIE.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const MODE_MOUNT = 'mount';
  const MODE_NONE = 'none';

  const APPLIANCE_TYPES = {
    dishwasher:{ code:'dishwasher', laborCode:'dishwasher_mount', quantitySource:'appliance.dishwasher.count', serviceName:'Montaż zmywarki do zabudowy', label:'Zmywarka do zabudowy' },
    fridge:{ code:'fridge', laborCode:'fridge_mount', quantitySource:'appliance.fridge.count', serviceName:'Montaż lodówki do zabudowy', label:'Lodówka do zabudowy' },
    oven:{ code:'oven', laborCode:'oven_mount', quantitySource:'appliance.oven.count', serviceName:'Montaż piekarnika do zabudowy', label:'Piekarnik do zabudowy' },
    hob:{ code:'hob', laborCode:'hob_mount', quantitySource:'appliance.hob.count', serviceName:'Montaż płyty indukcyjnej / ceramicznej', label:'Płyta indukcyjna / ceramiczna' },
    hood:{ code:'hood', laborCode:'hood_mount', quantitySource:'appliance.hood.count', serviceName:'Montaż okapu', label:'Okap podszafkowy / teleskopowy' },
    microwave:{ code:'microwave', laborCode:'microwave_mount', quantitySource:'appliance.microwave.count', serviceName:'Montaż mikrofali do zabudowy', label:'Mikrofalówka do zabudowy' },
  };

  const APPLIANCE_BY_SUBTYPE = {
    zmywarkowa: APPLIANCE_TYPES.dishwasher,
    piekarnikowa: APPLIANCE_TYPES.oven,
    okap: APPLIANCE_TYPES.hood,
    lodowkowa: APPLIANCE_TYPES.fridge,
    plyta: APPLIANCE_TYPES.hob,
    płyta: APPLIANCE_TYPES.hob,
    mikrofalowka: APPLIANCE_TYPES.microwave,
    mikrofalówka: APPLIANCE_TYPES.microwave,
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
    APPLIANCE_TYPES,
    APPLIANCE_BY_SUBTYPE,
    getApplianceForCabinet,
    normalizeMountingMode,
    getMountingMode,
    isMountingEnabled,
    setMountingMode,
    describeCabinetMounting,
  };
})();
