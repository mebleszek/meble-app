// P0-B room boundary. Detached read models; no storage or network writes here.
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const canonical=value=>FC.cloudPilotContract.canonical(value);
 const fail=code=>{throw Object.assign(Error(code),{code});};
 const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
 const enabled=()=>FC.applicationRegistry?.id==='p0b-rooms-v1';
 function validate(record){
  const own=record?.meta?.roomProject,data=record?.projectData,roomId=own?.roomId;
  if(own?.version!==1||!validId(roomId)||record.id!==roomId||!validId(record.investorId)
    ||data?.schemaVersion!==12||data.meta?.assignedInvestorId!==record.investorId
    ||data.meta.productionPcvMode!=='project')fail('LF_ROOM_PROJECT_SCOPE_REQUIRED');
  const defs=data.meta.roomDefs,order=data.meta.roomOrder;
  if(!defs||Object.keys(defs).length!==1||defs[roomId]?.id!==roomId
    ||!Array.isArray(order)||order.length!==1||order[0]!==roomId)fail('LF_ROOM_PROJECT_SCOPE_REQUIRED');
  FC.projectExportContract.validateLocalOwnedRoom(data[roomId]);
  // Native normalization retains empty built-in templates. They may never hide
  // a second editable room or unassigned technical/material settings.
  const defaults=FC.projectModel.normalizeProjectData(FC.project.DEFAULT_PROJECT);
  for(const [key,value]of Object.entries(data)){
   if(['schemaVersion','meta',roomId].includes(key))continue;
   if(!Object.hasOwn(defaults,key)||canonical(value)!==canonical(defaults[key]))fail('LF_ROOM_PROJECT_FOREIGN_DATA');
  }
  return true;
 }
 function create(investorId,definition,room){
  if(!validId(investorId)||!validId(definition?.id))fail('LF_ROOM_PROJECT_SCOPE_REQUIRED');
  const roomId=definition.id,name=String(definition.name||definition.label||'').trim();
  if(!name||name.length>120)fail('LF_ROOM_PROJECT_NAME_REQUIRED');
  const data=FC.projectModel.normalizeProjectData({schemaVersion:12,
   meta:{assignedInvestorId:investorId,productionPcvMode:'project',roomDefs:{[roomId]:clone({...definition,name,label:name})},roomOrder:[roomId]},
   [roomId]:clone(room)});
  const record=FC.projectModel.normalizeProjectRecord({id:roomId,investorId,title:name,status:definition.projectStatus||'nowy',
   projectData:data,createdAt:Date.now(),updatedAt:Date.now(),meta:{roomProject:{version:1,roomId},source:'room-project-v1'}});
  validate(record);return record;
 }
 function list(investorId,records=FC.projectStore.readAll()){
  const rows=records.filter(record=>record.investorId===investorId);
  const seen=new Set();for(const record of rows){validate(record);if(seen.has(record.id))fail('LF_ROOM_PROJECT_DUPLICATE');seen.add(record.id);}
  return clone(rows);
 }
 function selected(investorId){
  const record=FC.projectStore.getCurrentRecord();
  if(!record||record.investorId!==investorId)return null;
  validate(record);return clone(record);
 }
 function quoteSource(investorId,roomIds,records=FC.projectStore.readAll()){
  if(!Array.isArray(roomIds)||!roomIds.length||new Set(roomIds).size!==roomIds.length)fail('LF_QUOTE_ROOM_SCOPE_REQUIRED');
  const available=list(investorId,records),chosen=roomIds.map(roomId=>{
   const record=available.find(row=>row.id===roomId&&row.meta.roomProject.removed!==true);if(!record)fail('LF_QUOTE_ROOM_SCOPE_REQUIRED');return record;
  });
  const data={schemaVersion:12,meta:{assignedInvestorId:investorId,productionPcvMode:'project',roomDefs:{},roomOrder:roomIds.slice()}};
  for(const record of chosen){const roomId=record.id;data.meta.roomDefs[roomId]=clone(record.projectData.meta.roomDefs[roomId]);data[roomId]=clone(record.projectData[roomId]);}
  return {investorId,roomIds:roomIds.slice(),projects:chosen,projectData:data};
 }
 FC.roomProjectModel={enabled,validate,create,list,selected,quoteSource};
})();
