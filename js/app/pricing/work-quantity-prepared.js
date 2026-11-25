// Rebuildable quantities only. No priced lines, writes, source pins or access grants.
(function(){
 'use strict';const FC=window.FC=window.FC||{},entries=new Map(),LIMIT=64;
 const clone=value=>JSON.parse(JSON.stringify(value));
 function withoutCache(cabinet){
  const {derivedFacts,_derivedFacts,...source}=cabinet||{};return source;
 }
 let hits=0,rebuilds=0;
 function proof(room,cabinet){
  try{
   const sources=FC.globalDataContract?.sources,read=FC.storage?.getRaw;
   if(!sources||!read||!room||typeof room!=='object')return null;
   const rows=Object.values(sources).flat().map(key=>read.call(FC.storage,key));
   // Missing source storage cannot certify a reusable prepared quantity.
   if(rows.some(value=>typeof value!=='string'))return null;
   return [FC.investors?.getCurrentId?.(),FC.projectStore?.getCurrentProjectId?.(),
    JSON.stringify([{...room,cabinets:Array.isArray(room.cabinets)?room.cabinets.map(withoutCache):room.cabinets},withoutCache(cabinet)]),...rows,
    JSON.stringify(FC.carryingLogistics?.currentInvestor?.()||null),
    JSON.stringify(typeof materials==='undefined'?null:materials),
    JSON.stringify([FC.materialCommon?.FC_BOARD_THICKNESS_CM,FC.materialCommon?.FC_TOP_TRAVERSE_DEPTH_CM,window.FC_BOARD_THICKNESS_CM,window.FC_TOP_TRAVERSE_DEPTH_CM]),
    JSON.stringify(FC.laborCatalogDefinitions?.PDF_QUANTITY_SOURCES||[]),
    FC.workQuantitySources?.list,FC.workQuantitySources?.find,
    FC.cabinetCutlist?.getCabinetCutList,FC.cabinetHardwareRequirements?.getHingeRequirementsWithQty,
    FC.cabinetDrawerRequirements?.getDrawerRequirementsWithQty,FC.carryingLogistics?.evaluateCabinet,
    FC.frontHardware?.getCabinetFrontCutListForMaterials,
    FC.hardwareLiftCatalog?.laborFacts,FC.hardwareLiftCatalog?.hingeFittingCount,
    FC.hardwareCargoCatalog?.laborFacts,FC.laborApplianceRules?.getApplianceForCabinet,FC.laborApplianceRules?.isMountingEnabled];
  }catch(_){return null;}
 }
 const same=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);
 function read(room,cabinet,calculate){
  const before=proof(room,cabinet),key=before?.[2]||String(cabinet?.id||'');
  const previous=entries.get(key);
  if(before&&same(before,previous?.proof)){
   hits++;entries.delete(key);entries.set(key,previous);return clone(previous.facts);
  }
  const facts=calculate(clone(room),clone(cabinet));
  if(facts?.then||!Array.isArray(facts))throw Error('QUANTITY_PREPARATION_INVALID');
  rebuilds++;
  if(before&&same(before,proof(room,cabinet))){
   entries.delete(key);entries.set(key,{proof:before,facts:clone(facts)});
   if(entries.size>LIMIT)entries.delete(entries.keys().next().value);
  }
  return facts;
 }
 FC.workQuantityPrepared={read,canPrepare:(room,cabinet)=>!!proof(room,cabinet),inspect:()=>({hits,rebuilds,entries:entries.size,limit:LIMIT})};
})();
