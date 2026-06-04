(function(){
  const ns = (window.FC = window.FC || {});

/* ===== Okucia: waga frontu do uniwersalnego doboru zawiasów =====
   Waga jest liczona w kg z wymiarów frontu i materiału. Kalkulator ilości zawiasów
   korzysta z kg bez przeliczania na funty.
*/
const FC_HANDLE_WEIGHT_KG = 0.2; // orientacyjna masa uchwytu/gałki (na 1 front)

// Czy w danej szafce jest faktycznie uchwyt dla obliczeń wagi frontu?
// TIP-ON oraz podchwyt traktujemy jako "bez uchwytu".
function cabinetHasHandle(cab){
  const os = String(cab?.openingSystem || '').toLowerCase();
  if(!os) return true; // domyślnie: jest uchwyt
  if(os.includes('tip-on')) return false;
  if(os.includes('podchwyt')) return false;
  return true;
}


// Wagi frontów liczone po m² (źródła: SEVROLL – tabela "Wagi wypełnień")
const FC_FRONT_WEIGHT_KG_M2 = {
  laminat: 13.0,   // płyta wiórowa 18 mm ≈ 13 kg/m²
  akryl:   14.44,  // MDF 18 mm ≈ 14,44 kg/m² (typowy rdzeń frontu akrylowego)
  lakier:  14.44   // MDF 18 mm ≈ 14,44 kg/m² (typowy rdzeń frontu lakierowanego)
};

function getFrontWeightKgM2(frontMaterial){
  const m = String(frontMaterial || 'laminat').toLowerCase();
  return (m in FC_FRONT_WEIGHT_KG_M2) ? FC_FRONT_WEIGHT_KG_M2[m] : FC_FRONT_WEIGHT_KG_M2.laminat;
}

function estimateFrontWeightKg(wCm, hCm, frontMaterial, hasHandle){
  const wM = Math.max(0, Number(wCm) || 0) / 100;
  const hM = Math.max(0, Number(hCm) || 0) / 100;
  const area = wM * hM;
  const handleKg = hasHandle ? FC_HANDLE_WEIGHT_KG : 0;
  return area * getFrontWeightKgM2(frontMaterial) + handleKg;
}

  ns.frontHardware = Object.assign({}, ns.frontHardware, {
    FC_HANDLE_WEIGHT_KG,
    FC_FRONT_WEIGHT_KG_M2,
    cabinetHasHandle,
    getFrontWeightKgM2,
    estimateFrontWeightKg
  });
})();
