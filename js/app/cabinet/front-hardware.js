(function(){
  const ns = (window.FC = window.FC || {});
  const hw = ns.frontHardware || {};

  ns.frontHardware = Object.assign({}, ns.frontHardware, {
    FC_HANDLE_WEIGHT_KG: hw.FC_HANDLE_WEIGHT_KG,
    FC_FRONT_WEIGHT_KG_M2: hw.FC_FRONT_WEIGHT_KG_M2,
    getProjectRoomData: hw.getProjectRoomData,
    getCabinetFrontCutListForMaterials: hw.getCabinetFrontCutListForMaterials,
    cabinetHasHandle: hw.cabinetHasHandle,
    getFrontWeightKgM2: hw.getFrontWeightKgM2,
    estimateFrontWeightKg: hw.estimateFrontWeightKg,
    blumHingesPerDoor: hw.blumHingesPerDoor,
    getDoorFrontPanelsForHinges: hw.getDoorFrontPanelsForHinges,
    getHingeCountForCabinet: hw.getHingeCountForCabinet,
    estimateFlapWeightKg: hw.estimateFlapWeightKg,
    blumAventosPowerFactor: hw.blumAventosPowerFactor,
    getBlumAventosInfo: hw.getBlumAventosInfo
  });

  // Backward-compatible globals for existing classic scripts.
  // Tabs like js/tabs/material.js still read these names directly.
  window.FC_HANDLE_WEIGHT_KG = hw.FC_HANDLE_WEIGHT_KG;
  window.FC_FRONT_WEIGHT_KG_M2 = hw.FC_FRONT_WEIGHT_KG_M2;
  window.getCabinetFrontCutListForMaterials = hw.getCabinetFrontCutListForMaterials;
  window.estimateFlapWeightKg = hw.estimateFlapWeightKg;
  window.blumAventosPowerFactor = hw.blumAventosPowerFactor;
  window.getBlumAventosInfo = hw.getBlumAventosInfo;
})();
