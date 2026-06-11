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
    hood_under_cabinet:{ code:'hood_under_cabinet', laborCode:'hood_under_cabinet_mount', quantitySource:'appliance.hood_under_cabinet.count', serviceName:'Montaż okapu podszafkowego / teleskopowego', label:'Okap podszafkowy / teleskopowy' },
    hood_chimney:{ code:'hood_chimney', laborCode:'hood_chimney_mount', quantitySource:'appliance.hood_chimney.count', serviceName:'Montaż okapu kominowego / wyspowego', label:'Okap kominowy / wyspowy' },
    microwave:{ code:'microwave', laborCode:'microwave_mount', quantitySource:'appliance.microwave.count', serviceName:'Montaż mikrofali do zabudowy', label:'Mikrofalówka do zabudowy' },
    washer:{ code:'washer', laborCode:'washer_mount', quantitySource:'appliance.washer.count', serviceName:'Montaż pralki do zabudowy', label:'Pralka do zabudowy' },
    dryer:{ code:'dryer', laborCode:'dryer_mount', quantitySource:'appliance.dryer.count', serviceName:'Montaż suszarki do zabudowy', label:'Suszarka do zabudowy' },
    coffee_machine:{ code:'coffee_machine', laborCode:'coffee_machine_mount', quantitySource:'appliance.coffee_machine.count', serviceName:'Montaż ekspresu do zabudowy', label:'Ekspres do zabudowy' },
    warming_drawer:{ code:'warming_drawer', laborCode:'warming_drawer_mount', quantitySource:'appliance.warming_drawer.count', serviceName:'Montaż podgrzewacza szufladowego', label:'Podgrzewacz szufladowy' },
  };

  const APPLIANCE_BY_SUBTYPE = {
    zmywarkowa: APPLIANCE_TYPES.dishwasher,
    piekarnikowa: APPLIANCE_TYPES.oven,
    okap: APPLIANCE_TYPES.hood_under_cabinet,
    okap_podszafkowy: APPLIANCE_TYPES.hood_under_cabinet,
    okap_teleskopowy: APPLIANCE_TYPES.hood_under_cabinet,
    okap_kominowy: APPLIANCE_TYPES.hood_chimney,
    okap_wyspowy: APPLIANCE_TYPES.hood_chimney,
    lodowkowa: APPLIANCE_TYPES.fridge,
    plyta: APPLIANCE_TYPES.hob,
    płyta: APPLIANCE_TYPES.hob,
    mikrofalowka: APPLIANCE_TYPES.microwave,
    mikrofalówka: APPLIANCE_TYPES.microwave,
    pralka: APPLIANCE_TYPES.washer,
    suszarka: APPLIANCE_TYPES.dryer,
    ekspres: APPLIANCE_TYPES.coffee_machine,
    ekspres_do_zabudowy: APPLIANCE_TYPES.coffee_machine,
    podgrzewacz: APPLIANCE_TYPES.warming_drawer,
    podgrzewacz_szufladowy: APPLIANCE_TYPES.warming_drawer,
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
