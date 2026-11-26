// Recovery only. This module never reads storage, changes catalogs or publishes.
import {copy,equal,fail,id} from './local-first-values.mjs';

function project(rows,scope){
  const matches=JSON.parse(rows.fc_projects_v1||'[]').filter(row=>row.id===scope);
  if(matches.length!==1)fail('LF_PROJECT_RECOVERY_SCOPE');
  return matches[0];
}
function withoutRoom(record,roomId){
  const next=copy(record);
  delete next.projectData[roomId];
  delete next.projectData.meta.roomDefs[roomId];
  next.projectData.meta.roomOrder=next.projectData.meta.roomOrder.filter(room=>room!==roomId);
  // The native model derives these summaries from the room payload.
  for(const key of ['roomKeys','roomCount','cabinetCount','updatedAt'])delete next[key];
  return next;
}
function ids(room){
  return [
    ...room.cabinets.map(row=>row.id),...room.fronts.map(row=>row.id),...room.sets.map(row=>row.id),
    ...(room.layout?.segments||[]).flatMap(segment=>[segment.id,
      ...Object.values(segment.rows).flat().filter(row=>row.kind==='gap').map(row=>row.id)]),
  ];
}
function remapRoom(room,mapping){
  const next=copy(room);
  const mapped=value=>{
    if(!mapping[value])fail('LF_ROOM_COPY_REFERENCE_UNCONFIRMED');
    return mapping[value];
  };
  for(const cabinet of next.cabinets){
    cabinet.id=mapped(cabinet.id);
    if(cabinet.setId)cabinet.setId=mapped(cabinet.setId);
  }
  for(const set of next.sets)set.id=mapped(set.id);
  for(const front of next.fronts){
    front.id=mapped(front.id);
    if(front.cabId)front.cabId=mapped(front.cabId);
    if(front.setId)front.setId=mapped(front.setId);
  }
  for(const space of Object.keys(next.production||{})){
    next.production[space]=Object.fromEntries(Object.entries(next.production[space]).map(([owner,roles])=>[mapped(owner),roles]));
  }
  for(const segment of next.layout?.segments||[]){
    segment.id=mapped(segment.id);
    for(const row of Object.values(segment.rows))for(const item of row)item.id=mapped(item.id);
  }
  for(const placement of next.drawing2d?.placements||[])placement.cabinetId=mapped(placement.cabinetId);
  if(next.layout?.activeSegmentId)next.layout.activeSegmentId=mapped(next.layout.activeSegmentId);
  // Unknown identity-bearing extensions require a contract before copying.
  function check(value){
    if(typeof value==='string'&&Object.hasOwn(mapping,value))fail('LF_ROOM_COPY_REFERENCE_UNCONFIRMED');
    if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
      if(Object.hasOwn(mapping,key))fail('LF_ROOM_COPY_REFERENCE_UNCONFIRMED');
      check(item);
    }
  }
  check(next);
  return next;
}

export function prepareRoomCopy({rows,baseline,scope,roomId,name,validateRoom,newId=()=>crypto.randomUUID()}){
  id(roomId);
  if(typeof name!=='string'||!name.trim()||name.trim().length>120)fail('LF_ROOM_COPY_NAME_REQUIRED');
  if(typeof validateRoom!=='function')fail('LF_ROOM_COPY_VALIDATOR_REQUIRED');
  const local=project(rows,scope),approved=baseline?.document?.payload?.project;
  const room=local.projectData?.[roomId],definition=local.projectData?.meta?.roomDefs?.[roomId];
  if(!approved||approved.id!==scope||approved.investorId!==local.investorId
    ||local.meta?.pendingDomainOperation||!room||definition?.id!==roomId)fail('LF_ROOM_COPY_SCOPE_UNCONFIRMED');
  const session=JSON.parse(rows.fc_edit_session_v1||'null');
  if(session&&(session.projectId!==scope||session.roomId!==roomId))fail('LF_ROOM_COPY_SCOPE_UNCONFIRMED');
  if(!equal(withoutRoom(local,roomId),withoutRoom(approved,roomId)))fail('LF_ROOM_COPY_OTHER_CHANGES');
  validateRoom(room);
  const originals=[roomId,...ids(room)];
  if(originals.length!==new Set(originals).size)fail('LF_ROOM_COPY_ID_AMBIGUOUS');
  const mapping={};
  const occupied=new Set(originals);
  for(const old of originals){
    const next=id(newId());
    if(occupied.has(next))fail('LF_ROOM_COPY_ID_COLLISION');
    occupied.add(next);mapping[old]=next;
  }
  const copied=remapRoom(room,mapping);
  validateRoom(copied);
  return {id:mapping[roomId],definition:{...copy(definition),id:mapping[roomId],name:name.trim(),label:name.trim()},
    room:copied,mapping,sourceRoomId:roomId};
}

export function appendRoomCopy(remoteProject,plan,{validateRoom,summarize}){
  const next=copy(remoteProject),data=next.projectData;
  if(typeof summarize!=='function'||typeof validateRoom!=='function')fail('LF_ROOM_COPY_VALIDATOR_REQUIRED');
  const existing=new Set(Object.keys(data.meta.roomDefs));
  for(const roomId of Object.keys(data.meta.roomDefs))for(const value of ids(data[roomId]))existing.add(value);
  const added=[id(plan.id),...ids(plan.room)];
  if(new Set(added).size!==added.length||added.some(value=>existing.has(value)))fail('LF_ROOM_COPY_ID_COLLISION');
  validateRoom(plan.room);
  data[plan.id]=copy(plan.room);
  data.meta.roomDefs[plan.id]=copy(plan.definition);
  data.meta.roomOrder.push(plan.id);
  Object.assign(next,summarize(data));
  return next;
}
