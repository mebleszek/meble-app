(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  host.FC_BOARD_THICKNESS_CM = host.FC_BOARD_THICKNESS_CM || (FC.materialCommon && FC.materialCommon.FC_BOARD_THICKNESS_CM) || 1.8;
  host.FC_TOP_TRAVERSE_DEPTH_CM = host.FC_TOP_TRAVERSE_DEPTH_CM || (FC.materialCommon && FC.materialCommon.FC_TOP_TRAVERSE_DEPTH_CM) || 9;
  host.fmtCm = host.fmtCm || (FC.materialCommon && FC.materialCommon.fmtCm) || function(v){ const n = Number(v); return Number.isFinite(n) ? (Math.round(n*10)/10).toString() : String(v ?? ''); };
  host.getCabinetFrontCutListForMaterials = host.getCabinetFrontCutListForMaterials || function(){ return []; };
  host.getHingeCountForCabinet = host.getHingeCountForCabinet || function(){ return 0; };
  host.getBlumAventosInfo = host.getBlumAventosInfo || function(){ return null; };

  function partByName(parts, name){ return (parts || []).find((part)=> part && part.name === name) || null; }

  function runAll(){
    return H.runSuite('APP smoke testy', [
      H.makeTest('Szafki', 'Cutlista szafki nie dodaje pleców przy materiale Brak', 'Sprawdza, czy szafka z wyłączonymi plecami nie wrzuca fikcyjnej formatki do materiałów i ROZRYS.', ()=>{
        if(!FC.cabinetCutlist || typeof FC.cabinetCutlist.getCabinetCutList !== 'function') throw new Error('Brak getCabinetCutList');
        const parts = FC.cabinetCutlist.getCabinetCutList({
          type:'stojąca', subType:'standard', width:60, height:72, depth:56, bodyColor:'MDF biały', backMaterial:'Brak', details:{}
        }, 'kuchnia');
        H.assert(!parts.some((part)=> part && part.name === 'Plecy'), 'Cutlista nadal dodała plecy mimo materiału Brak', parts);
      }),
      H.makeTest('Szafki', 'Szafka stojąca ma dolny wieniec na pełną szerokość i dwa trawersy', 'Sprawdza, czy podstawowa geometria korpusu nie rozjechała się po refaktorach modułów szafki.', ()=>{
        const parts = FC.cabinetCutlist.getCabinetCutList({
          type:'stojąca', subType:'standard', width:80, height:72, depth:56, bodyColor:'MDF biały', backMaterial:'HDF', details:{}
        }, 'kuchnia');
        const bottom = partByName(parts, 'Wieniec dolny');
        const trawers = partByName(parts, 'Trawers górny (9 cm)');
        H.assert(bottom && bottom.a === 80, 'Wieniec dolny nie ma pełnej szerokości stojącej szafki', bottom || parts);
        H.assert(trawers && trawers.qty === 2, 'Brakuje dwóch trawersów górnych', trawers || parts);
      }),
      H.makeTest('Szafki', 'Wisząca podblatowa bez pleców zachowuje pełną wysokość boków', 'Sprawdza, czy wyjątek podblatowej wiszącej nie obcina boków i respektuje wyłączenie pleców.', ()=>{
        const parts = FC.cabinetCutlist.getCabinetCutList({
          type:'wisząca', subType:'dolna_podblatowa', width:60, height:72, depth:56, bodyColor:'MDF biały', backMaterial:'HDF', details:{ hasBack:'0' }
        }, 'kuchnia');
        const side = partByName(parts, 'Bok');
        H.assert(side && side.a === 72, 'Bok podblatowej wiszącej nie zachował pełnej wysokości', side || parts);
        H.assert(!parts.some((part)=> part && part.name === 'Plecy'), 'Podblatowa wisząca z hasBack=0 nadal dodała plecy', parts);
      }),
    ]);
  }

  FC.cabinetDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
