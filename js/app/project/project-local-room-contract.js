// Native local geometry, derived from the existing creator/material generators.
// No projection, normalization, ID replacement, storage, or layout generation.
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 const fail=code=>{throw Object.assign(Error(code),{code});};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const key=f=>JSON.stringify([Number(f.width),Number(f.height),f.material||'laminat',f.color||'',f.frontMaterialSource?.part||'']);
 function compare(actual,expected){
  const counts=new Map();for(const f of expected)counts.set(key(f),(counts.get(key(f))||0)+1);
  for(const f of actual){const k=key(f),n=counts.get(k)||0;if(!n)fail('EXPORT_INVALID_GEOMETRY');counts.set(k,n-1);}
  if([...counts.values()].some(n=>n!==0))fail('EXPORT_INVALID_GEOMETRY');
 }
 function validate(room){
  const fronts=FC.cabinetFronts,hardware=FC.frontHardware,cutlist=FC.cabinetCutlist;
  if(room.cabinets.length&&(!fronts?.previewFrontsForCabinet||!hardware?.deriveSetFrontsFromRecord||!cutlist?.getCabinetCutList))fail('EXPORT_DEPENDENCY_UNAVAILABLE');
  const roles=new Map(),setRoles=new Map();
  function add(parts,id){
   const bag=roles.get(id)||{parts:new Set(),groups:new Set()};roles.set(id,bag);
   for(const p of parts){for(const r of p.partRoleIds||[])bag.parts.add(r);for(const r of p.sourceGroupRoles||[])if(r.ownerType==='cabinet')bag.groups.add(r.groupRoleId);}
  }
  for(const cab of room.cabinets){
   if(!['stojąca','wisząca','moduł'].includes(cab.type)||!fronts.getSubTypeOptionsForType(cab.type).some(option=>option.v===cab.subType))fail('EXPORT_UNSUPPORTED_STRUCTURE');
   if(cab.frontCount!=null&&(!Number.isSafeInteger(Number(cab.frontCount))||Number(cab.frontCount)<0))fail('EXPORT_INVALID_GEOMETRY');
   const copy=clone(cab);
   if(!cab.setId){
    const expected=fronts.previewFrontsForCabinet(room,copy);
    for(const f of expected)if(!(Number(f.width)>0&&Number(f.height)>0))fail('EXPORT_INVALID_GEOMETRY');
    compare(room.fronts.filter(f=>f.cabId===cab.id),expected);
    const native=hardware.getCabinetFrontPartsForLocalDraft(room,clone(cab));
    if(expected.length)add(native,cab.id);
   }
   add(cutlist.getCabinetCutList(clone(cab),room),cab.id);
  }
  for(const set of room.sets){
   if(![1,2].includes(Number(set.frontCount))||!Number.isSafeInteger(Number(set.number))||Number(set.number)<=0)fail('EXPORT_INVALID_GEOMETRY');
   const expected=hardware.deriveSetFrontsFromRecord(room,set.id);
   if(!expected.length)fail('EXPORT_INVALID_GEOMETRY');
   compare(room.fronts.filter(f=>f.setId===set.id),expected);
   setRoles.set(set.id,new Set(expected.map(f=>f.groupRoleId)));
  }
  if(room.production!==undefined&&(!room.production||typeof room.production!=='object'||Array.isArray(room.production)))fail('EXPORT_INVALID_FIELD');
  // Existing PCV API permits empty/extended entries; if present, edges are closed.
  for(const [space,owners]of Object.entries(room.production||{})){
   if(!['partOverrides','cabinetGroupOverrides','setGroupOverrides'].includes(space)||!owners||typeof owners!=='object'||Array.isArray(owners))fail('EXPORT_PCV_ROLE_INVALID');
   for(const entries of Object.values(owners)){
    if(!entries||typeof entries!=='object'||Array.isArray(entries))fail('EXPORT_INVALID_FIELD');
    for(const entry of Object.values(entries)){
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||('edges' in entry&&(!entry.edges||Object.keys(entry.edges).sort().join(',')!=='h1,h2,w1,w2'||Object.values(entry.edges).some(v=>typeof v!=='boolean'))))fail('EXPORT_INVALID_FIELD');
    }
   }
  }
  return {roleAllowed(space,role,owner){return space==='setGroupOverrides'?setRoles.get(owner.id)?.has(role):roles.get(owner.id)?.[space==='partOverrides'?'parts':'groups'].has(role);}};
 }
 FC.projectLocalRoomContract={validate};
})();
