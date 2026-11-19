// Room operations use the existing authority boundary and canonical project store.
(function(){
 'use strict';const FC=window.FC=window.FC||{},clone=value=>JSON.parse(JSON.stringify(value));
 const fail=code=>{throw Object.assign(Error(code),{code});};
 const model=()=>FC.roomProjectModel;
 const iid=()=>FC.investors.getCurrentId();
 const canonical=value=>FC.cloudPilotContract.canonical(value);
 function list(id=iid()){return model().list(id).filter(row=>row.meta.roomProject.removed!==true);}
 function definitions(id=iid()){return list(id).map(row=>clone(row.projectData.meta.roomDefs[row.id]));}
 function capture(id=iid()){return {kind:'room-project-list',investorId:id,records:canonical(model().list(id))};}
 function matches(proof){return proof?.kind==='room-project-list'&&proof.investorId===iid()&&!FC.session.active
  &&proof.records===canonical(model().list(proof.investorId));}
 function selected(id=iid()){const row=model().selected(id);return row?.meta.roomProject.removed?null:row;}
 function select(roomId){
  const record=FC.projectStore.getById(roomId);model().validate(record);
  if(record.investorId!==iid()||record.meta.roomProject.removed||FC.session.active)fail('LF_ROOM_PROJECT_CONTEXT_PROTECTED');
  if(FC.projectStore.setCurrentProjectId(record.id)!==record.id)fail('LF_ROOM_PROJECT_CONTEXT_PROTECTED');
  window.projectData=clone(record.projectData);
  return record;
 }
 function mirror(id=iid()){
  const rows=definitions(id).map(room=>({id:room.id,baseType:room.baseType,name:room.name,label:room.label,projectStatus:room.projectStatus||'nowy'}));
  const inv=FC.investors.getById(id);if(!inv)fail('LF_ROOM_PROJECT_CONTEXT_PROTECTED');
  if(canonical(inv.rooms||[])!==canonical(rows)&&!FC.investors.update(id,{rooms:rows}))fail('LF_ROOM_PROJECT_WRITE_UNCONFIRMED');
 }
 function create(inv,payload){
  if(!inv||inv.id!==iid()||FC.session.active)fail('LF_ROOM_PROJECT_CONTEXT_PROTECTED');
  const name=String(payload?.name||payload?.label||'').trim(),baseType=payload?.baseType||'kuchnia';
  if(definitions(inv.id).some(room=>room.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()))fail('LF_ROOM_PROJECT_NAME_DUPLICATE');
  const roomId=FC.roomRegistryDefinitions.makeRoomId(baseType,name);
  if(FC.projectStore.getById(roomId))fail('LF_ROOM_PROJECT_DUPLICATE');
  const definition={id:roomId,baseType,name,label:name,legacy:false,projectStatus:'nowy'};
  const record=model().create(inv.id,definition,FC.roomRegistryFoundation.roomTemplate(baseType));
  if(!FC.projectStore.upsert(record))fail('LF_ROOM_PROJECT_WRITE_UNCONFIRMED');
  // Creating a named room is an explicit choice of that new room, never an
  // implicit choice of the first pre-existing row in the registry.
  select(record.id);mirror(inv.id);
  return {ok:true,room:definition,rooms:definitions(inv.id),project:clone(record.projectData)};
 }
 function changedIds(drafts,id=iid()){
  const rows=list(id),next=new Map(drafts.map(room=>[room.id,room]));
  if(next.size!==drafts.length||drafts.some(room=>!rows.some(row=>row.id===room.id)))fail('LF_ROOM_PROJECT_SCOPE_REQUIRED');
  return rows.filter(row=>{
   const room=next.get(row.id),old=row.projectData.meta.roomDefs[row.id];
   return !room||String(room.name||room.label)!==String(old.name)||room.baseType!==old.baseType;
  }).map(row=>row.id);
 }
 function apply(inv,drafts){
  if(inv?.id!==iid()||FC.session.active)fail('LF_ROOM_PROJECT_CONTEXT_PROTECTED');
  const ids=changedIds(drafts,inv.id),names=drafts.map(room=>String(room.name||room.label||'').trim().toLocaleLowerCase());
  if(names.some(name=>!name)||new Set(names).size!==names.length)fail('LF_ROOM_PROJECT_NAME_DUPLICATE');
  for(const roomId of ids){
   const record=FC.projectStore.getById(roomId),draft=drafts.find(room=>room.id===roomId);model().validate(record);
   if(draft){const name=String(draft.name||draft.label).trim();record.title=name;
    Object.assign(record.projectData.meta.roomDefs[roomId],{name,label:name,baseType:draft.baseType});
   }else record.meta.roomProject.removed=true;
   record.updatedAt=Date.now();if(!FC.projectStore.upsert(record))fail('LF_ROOM_PROJECT_WRITE_UNCONFIRMED');
  }
  const current=FC.projectStore.getCurrentRecord();
  if(current?.investorId===inv.id){
   if(current.meta.roomProject.removed){FC.projectStore.setCurrentProjectId(null);window.projectData=clone(FC.project.DEFAULT_PROJECT);}
   else window.projectData=clone(current.projectData);
  }
  mirror(inv.id);FC.roomRegistryDefinitions.invalidateCache();
  return {ok:true,rooms:definitions(inv.id),removedRoomIds:ids.filter(id=>!drafts.some(room=>room.id===id))};
 }
 function update(inv,roomId,patch){
  const drafts=definitions(inv.id).map(room=>room.id===roomId?{...room,...patch}:room),result=apply(inv,drafts);
  return {...result,room:drafts.find(room=>room.id===roomId)};
 }
 FC.roomProjectStore={list,definitions,capture,matches,selected,select,mirror,create,changedIds,apply,update};
})();
