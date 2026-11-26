// Rebuildable quantities only. No priced lines, writes, source pins or access grants.
(function(){
 'use strict';const FC=window.FC=window.FC||{},entries=new Map(),LIMIT=64;
 const clone=value=>JSON.parse(JSON.stringify(value));
 function withoutCache(cabinet){
  const {derivedFacts,_derivedFacts,...source}=cabinet||{};return source;
 }
 let hits=0,rebuilds=0,partsHits=0,partsRebuilds=0,scope=null;
 const input=(room,cabinet)=>JSON.stringify([{...room,cabinets:Array.isArray(room.cabinets)?room.cabinets.map(withoutCache):room.cabinets},withoutCache(cabinet)]);
 function commonProof(){
  try{
   const sources=FC.globalDataContract?.sources,read=FC.storage?.getRaw;
   if(!sources||!read)return null;
   const rows=Object.values(sources).flat().map(key=>read.call(FC.storage,key));
   // Missing source storage cannot certify a reusable prepared quantity.
   if(rows.some(value=>typeof value!=='string'))return null;
   return [FC.investors?.getCurrentId?.(),FC.projectStore?.getCurrentProjectId?.(),
    ...rows,
    JSON.stringify(FC.carryingLogistics?.currentInvestor?.()||null),
    JSON.stringify(typeof materials==='undefined'?null:materials),
    JSON.stringify([FC.materialCommon?.FC_BOARD_THICKNESS_CM,FC.materialCommon?.FC_TOP_TRAVERSE_DEPTH_CM,window.FC_BOARD_THICKNESS_CM,window.FC_TOP_TRAVERSE_DEPTH_CM]),
    JSON.stringify(FC.laborCatalogDefinitions?.PDF_QUANTITY_SOURCES||[]),
    FC.workQuantitySources?.list,FC.workQuantitySources?.find,
    FC.cabinetCutlist?.getCabinetCutList,FC.cabinetHardwareRequirements?.getHingeRequirementsWithQty,
    FC.cabinetDrawerRequirements?.getDrawerRequirementsWithQty,FC.carryingLogistics?.evaluateCabinet,
    FC.frontHardware?.getCabinetFrontCutListForMaterials,FC.frontHardware?.getCabinetFrontPartsForLocalDraft,
    FC.partProvenance?.context,FC.partProvenance?.bind,
    FC.hardwareLiftCatalog?.laborFacts,FC.hardwareLiftCatalog?.hingeFittingCount,
    FC.hardwareCargoCatalog?.laborFacts,FC.laborApplianceRules?.getApplianceForCabinet,FC.laborApplianceRules?.isMountingEnabled];
  }catch(_){return null;}
 }
 const same=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((value,index)=>value===b[index]);
 function proof(room,cabinet){
  try{
   if(!room||typeof room!=='object')return null;
   const common=scope?scope.common:commonProof();if(!common)return null;
   let entry=scope?.rooms.get(room)?.get(cabinet);
   if(!entry){
    const value=input(room,cabinet),witness=[common[0],common[1],value,...common.slice(2)];
    entry={room,cabinet,value,witness,...(scope?{data:JSON.parse(value)}:{})};
    if(scope){if(!scope.rooms.has(room))scope.rooms.set(room,new Map());scope.rooms.get(room).set(cabinet,entry);scope.inputs.push(entry);}
   }
   return entry.witness;
  }catch(_){return null;}
 }
 const fail=code=>{throw Object.assign(Error(code),{code});};
 function invoke(callback){const result=callback();if(result?.then)fail('QUANTITY_PREPARATION_ASYNC');return result;}
 // Quantities may share source bytes only inside this synchronous read. Every
 // accessed room/cabinet and all common sources are checked before returning.
 // Failure discards rebuildable entries; no access/ACK proof is ever cached.
 function withCalculationRead(callback){
  if(scope){try{return invoke(callback);}catch(error){scope.failure=error;throw error;}}
  const current=scope={common:commonProof(),rooms:new WeakMap(),inputs:[],owners:[],failure:null};
  try{
   const result=invoke(callback);if(current.failure)throw current.failure;
   const next=commonProof();
   if(!(current.common===null&&next===null)&&!same(current.common,next))fail('QUANTITY_PREPARATION_CONFLICT');
   for(const entry of current.inputs)if(input(entry.room,entry.cabinet)!==entry.value)fail('QUANTITY_PREPARATION_CONFLICT');
   for(const entry of current.owners)if(JSON.stringify(entry.owner)!==entry.value)fail('QUANTITY_PREPARATION_CONFLICT');
   return result;
  }catch(error){entries.clear();throw error;}finally{scope=null;}
 }
 function read(room,cabinet,calculate,family='work'){
  const before=proof(room,cabinet),key=family+':'+(before?.[2]||String(cabinet?.id||''));
  const previous=entries.get(key);
  if(before&&same(before,previous?.proof)){
   if(family==='work')hits++;else partsHits++;entries.delete(key);entries.set(key,previous);return clone(previous.facts);
  }
  const captured=scope?.rooms.get(room)?.get(cabinet)?.data;
  const facts=calculate(clone(captured?captured[0]:room),clone(captured?captured[1]:cabinet));
  if(facts?.then||!Array.isArray(facts))throw Error('QUANTITY_PREPARATION_INVALID');
  if(family==='work')rebuilds++;else partsRebuilds++;
  if(before&&same(before,proof(room,cabinet))){
   entries.delete(key);entries.set(key,{proof:before,facts:clone(facts)});
   if(entries.size>LIMIT)entries.delete(entries.keys().next().value);
  }
  return facts;
 }
 function readParts(room,cabinet,owner,calculate){
  if(!owner||typeof owner.projectId!=='string'||!owner.projectId||typeof owner.roomId!=='string'||!owner.roomId||Object.keys(owner).some(key=>!['projectId','roomId'].includes(key)))return calculate(room,cabinet,owner);
  const value=JSON.stringify(owner);if(scope)scope.owners.push({owner,value});
  try{
   const result=read(room,cabinet,(r,c)=>calculate(r,c,JSON.parse(value)),'parts:'+value);
   if(JSON.stringify(owner)!==value)fail('QUANTITY_PREPARATION_CONFLICT');return result;
  }catch(error){entries.clear();throw error;}
 }
 FC.workQuantityPrepared={read,readParts,withCalculationRead,canPrepare:(room,cabinet)=>!!proof(room,cabinet),inspect:()=>({hits,rebuilds,partsHits,partsRebuilds,entries:entries.size,limit:LIMIT})};
})();
