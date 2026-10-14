// Project-owned PCV foundation. Deliberately not connected to legacy material UI.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const has = (value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const object = value=>!!value && typeof value === 'object' && !Array.isArray(value);
  const clone = value=>JSON.parse(JSON.stringify(value));
  const edgeKeys = ['w1','w2','h1','h2'];
  const failure = code=>({ok:false,code});
  const safeId = value=>typeof value === 'string' && value.trim() === value && !!value
    && !['__proto__','prototype','constructor'].includes(value);
  function comparable(value){
    if(Array.isArray(value)) return value.map(comparable);
    if(object(value)) return Object.fromEntries(Object.keys(value).sort().map(key=>[key,comparable(value[key])]));
    return value;
  }
  const equal = (a,b)=>JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
  function edgesValid(value){
    return object(value) && Object.keys(value).length === 4
      && edgeKeys.every(key=>has(value,key) && typeof value[key] === 'boolean');
  }
  function addressInfo(address){
    if(!object(address) || !safeId(address.projectId) || !safeId(address.roomId)) return null;
    let space, ownerId, roleId, allowed;
    if(has(address,'partRoleId')){
      space='partOverrides'; ownerId=address.cabinetId; roleId=address.partRoleId;
      allowed=['projectId','roomId','cabinetId','partRoleId'];
    }else if(address.ownerType === 'cabinet'){
      space='cabinetGroupOverrides'; ownerId=address.cabinetId; roleId=address.groupRoleId;
      allowed=['projectId','roomId','cabinetId','ownerType','groupRoleId','qty'];
    }else if(address.ownerType === 'set'){
      space='setGroupOverrides'; ownerId=address.setId; roleId=address.groupRoleId;
      allowed=['projectId','roomId','setId','ownerType','groupRoleId','qty'];
    }else return null;
    if(!safeId(ownerId) || !safeId(roleId) || Object.keys(address).some(key=>!allowed.includes(key))) return null;
    if(has(address,'qty') && (!Number.isInteger(address.qty) || address.qty<=0)) return null;
    return {space,ownerId,roleId}; // qty is a generated contribution, never an identity or persisted value.
  }
  function persisted(project){
    return FC.projectStore.prepareProjectDataForPersistence(FC.project.normalize(clone(project)));
  }
  function matchingSource(source,address,info){
    return source.projectId === address.projectId && source.roomId === address.roomId
      && (info.space === 'partOverrides'
        ? source.cabinetId === info.ownerId && source.partRoleId === info.roleId
        : source.ownerType === address.ownerType && source.groupRoleId === info.roleId
          && (source.ownerType === 'set' ? source.setId : source.cabinetId) === info.ownerId);
  }
  function roomContext(projectId,roomId){
    if(!safeId(projectId) || !safeId(roomId)) return failure('INVALID_ADDRESS');
    const store=FC.projectStore, project=window.projectData;
    if(!store || !FC.project || !FC.cabinetCutlist || !FC.materialEdgeStore) return failure('DEPENDENCIES_UNAVAILABLE');
    // Native generators resolve room settings and set definitions from activated RAM.
    // Never bind detached data to an arbitrary project ID or silently switch context.
    if(store.getCurrentProjectId() !== projectId) return failure('PROJECT_CONTEXT_MISMATCH');
    const records=store.readAll().filter(row=>String(row.id) === projectId);
    if(records.length !== 1) return failure('PROJECT_OWNER_AMBIGUOUS');
    const record=records[0], investorId=FC.investors && FC.investors.getCurrentId && FC.investors.getCurrentId();
    if(!investorId || String(record.investorId) !== String(investorId)
      || !project || !project.meta || String(project.meta.assignedInvestorId) !== String(record.investorId)) return failure('INVESTOR_CONTEXT_MISMATCH');
    if(!has(project,roomId) || !has(record.projectData,roomId)) return failure('ROOM_NOT_FOUND');
    const room=project[roomId];
    if(!equal(persisted(project)[roomId],persisted(record.projectData)[roomId])) return failure('RAM_DIVERGENCE');
    return {ok:true,project,record,room};
  }
  function inspectRoom(projectId,roomId){
    try{ const state=roomContext(projectId,roomId); return state.ok ? {ok:true} : state; }catch(_){return failure('READ_FAILED');}
  }
  function context(address, calculation){
    const info=addressInfo(address);
    if(!info) return failure('INVALID_ADDRESS');
    const state=roomContext(address.projectId,address.roomId);
    if(!state.ok) return state;
    const {project,record,room}=state;
    const cabinets=room.cabinets;
    if(!Array.isArray(cabinets) || new Set(cabinets.map(c=>c && c.id)).size !== cabinets.length) return failure('CABINET_OWNER_AMBIGUOUS');
    let owners;
    if(info.space === 'setGroupOverrides'){
      const sets=room.sets;
      if(!Array.isArray(sets) || sets.filter(set=>set && String(set.id) === info.ownerId).length !== 1) return failure('SET_NOT_FOUND');
      owners=cabinets.filter(c=>String(c.setId || '') === info.ownerId);
    }else owners=cabinets.filter(c=>c && String(c.id) === info.ownerId);
    if(!owners.length || (info.space !== 'setGroupOverrides' && owners.length !== 1)) return failure('OWNER_NOT_FOUND');
    const matches=[];
    for(const cabinet of owners){
      const parts=FC.cabinetCutlist.getCabinetCutList(cabinet,address.roomId,{projectId:address.projectId});
      for(const part of parts){
        const sources=info.space === 'partOverrides' ? part.sourceRefs : part.sourceGroups;
        const matching=(sources || []).filter(source=>matchingSource(source,address,info));
        if(!matching.length) continue;
        if((part.sourceIssues || []).length) return failure('SOURCE_UNRESOLVED');
        if(![part.a,part.b,part.qty].every(value=>Number.isFinite(Number(value)) && Number(value)>0)) return failure('PCV_INELIGIBLE');
        if(calculation && part.pcvEligible!==false && !FC.materialEdgeStore.resolveMaterialType(part.material))return failure('MATERIAL_TYPE_UNRESOLVED');
        if(!calculation && !FC.materialEdgeStore.isPcvEligiblePart(part)) return failure('PCV_INELIGIBLE');
        matches.push({part,cabinet,count:matching.length,qty:info.space==='partOverrides'?matching.length:matching.reduce((n,source)=>n+source.qty,0)});
      }
    }
    if(!matches.length) return failure('ROLE_NOT_FOUND');
    if(info.space === 'partOverrides' && matches.reduce((n,row)=>n+row.count,0)!==1) return failure('ROLE_AMBIGUOUS');
    const eligible=FC.materialEdgeStore.isPcvEligiblePart(matches[0].part);
    if(matches.some(row=>FC.materialEdgeStore.isPcvEligiblePart(row.part)!==eligible)) return failure('DEFAULTS_AMBIGUOUS');
    const defaults=eligible ? FC.materialEdgeStore.defaultEdgesForPart(matches[0].part,matches[0].cabinet) : {w1:false,w2:false,h1:false,h2:false};
    if(!edgesValid(defaults) || eligible && matches.some(row=>!equal(defaults,FC.materialEdgeStore.defaultEdgesForPart(row.part,row.cabinet)))) return failure('DEFAULTS_AMBIGUOUS');
    const production=record.projectData[address.roomId].production;
    let entry;
    if(production !== undefined){
      if(!object(production)) return failure('INVALID_PRODUCTION_DATA');
      const space=production[info.space];
      if(space !== undefined){
        if(!object(space)) return failure('INVALID_OVERRIDE_DATA');
        const owner=space[info.ownerId];
        if(owner !== undefined){
          if(!object(owner)) return failure('INVALID_OVERRIDE_DATA');
          entry=owner[info.roleId];
          if(entry !== undefined && (!object(entry) || (has(entry,'edges') && !edgesValid(entry.edges)))) return failure('INVALID_OVERRIDE_DATA');
        }
      }
    }
    return {ok:true,address,info,project,record,defaults,entry,eligible,matches,edges:clone(eligible && entry && entry.edges || defaults)};
  }
  function get(address, calculation){
    try{
      const state=context(address,calculation);
      if(!state.ok) return state;
      return Object.assign({ok:true,edges:state.edges,defaults:clone(state.defaults),source:state.eligible ? (state.entry && has(state.entry,'edges') ? 'override' : 'default') : 'ineligible',eligible:state.eligible},calculation?{geometries:state.matches.map(row=>({aCm:Number(row.part.a),bCm:Number(row.part.b),qty:row.qty,material:FC.materialEdgeStore.normalizeMaterialKey(row.part.material),mode:FC.materialEdgeStore.getCabinetPcvMode(row.cabinet)}))}:{});
    }catch(error){return failure(error && error.code === 'INVALID_DRAWER_FRONT_GEOMETRY' ? error.code : 'READ_FAILED');}
  }
  function baselineProduction(session,address){
    const rows=JSON.parse(session.snapshot.fc_projects_v1);
    const record=rows.find(row=>String(row.id) === address.projectId);
    return record.projectData[address.roomId].production;
  }
  function change(address,patch,clear){
    try{
      const sessionGuard=FC.session;
      if(addressInfo(address) && sessionGuard && sessionGuard.active && sessionGuard.durable
        && sessionGuard.projectId === address.projectId && sessionGuard.roomId === address.roomId
        && sessionGuard.canSaveProject && !sessionGuard.canSaveProject()){
        return Object.assign({ok:false},sessionGuard.lastError || {code:'SESSION_UNCONFIRMED'});
      }
      const state=context(address);
      if(!state.ok) return state;
      const ui=window.uiState, session=FC.session;
      if(!ui || ui.roomType !== address.roomId || !session || typeof session.begin !== 'function'
        || (session.active && (session.projectId !== address.projectId || session.roomId !== address.roomId))) return failure('EDIT_CONTEXT_MISMATCH');
      if(!clear && (!object(patch) || Object.keys(patch).some(key=>!edgeKeys.includes(key) || typeof patch[key] !== 'boolean'))) return failure('INVALID_EDGES');
      const desired=clear ? state.defaults : Object.assign({},state.edges,patch);
      if(!clear && equal(desired,state.edges)) return {ok:true,changed:false};
      const remove=equal(desired,state.defaults);
      const existing=state.entry && state.entry.edges;
      if(remove ? !existing : existing && equal(existing,desired)) return {ok:true,changed:false};
      if(session.begin(address.roomId) !== true) return failure('BEGIN_FAILED');
      if(!session.inspectNavigationState || !session.inspectNavigationState()) return failure('SESSION_UNCONFIRMED');
      const fresh=context(address);
      if(!fresh.ok) return fresh;
      if(fresh.project !== state.project || !equal(fresh.record,state.record)) return failure('PROJECT_WRITE_CONFLICT');
      const next=clone(state.project), room=next[address.roomId], info=state.info;
      const production=room.production || (room.production={});
      const space=production[info.space] || (production[info.space]={});
      const owner=space[info.ownerId] || (space[info.ownerId]={});
      const entry=owner[info.roleId] || (owner[info.roleId]={});
      if(remove) delete entry.edges; else entry.edges=clone(desired);
      // Prune only the addressed path. Preserve grain, other roles and baseline empty containers.
      const baseline=baselineProduction(session,address);
      const baselineSpace=baseline && baseline[info.space], baselineOwner=baselineSpace && baselineSpace[info.ownerId];
      if(!Object.keys(entry).length && !(baselineOwner && object(baselineOwner[info.roleId]) && !Object.keys(baselineOwner[info.roleId]).length)) delete owner[info.roleId];
      if(!Object.keys(owner).length && !(baselineSpace && object(baselineSpace[info.ownerId]) && !Object.keys(baselineSpace[info.ownerId]).length)) delete space[info.ownerId];
      if(!Object.keys(space).length && !(baseline && object(baseline[info.space]) && !Object.keys(baseline[info.space]).length)) delete production[info.space];
      if(!Object.keys(production).length && baseline === undefined) delete room.production;
      const result=FC.project.saveConfirmed(next,{expectedRecord:state.record});
      if(!result || result.ok !== true){
        return result && result.projectSaved
          ? {ok:false,code:result.code || 'SAVE_UNCONFIRMED',projectSaved:true}
          : failure(result && result.code || 'SAVE_FAILED');
      }
      // A central write with failed session revision persistence is partial, never a full success.
      if(!session.inspectNavigationState()) return {ok:false,code:'SESSION_UNCONFIRMED',projectSaved:true};
      const readBack=FC.projectStore.getById(address.projectId);
      if(!readBack || !equal(persisted(readBack.projectData)[address.roomId],persisted(next)[address.roomId])){
        if(session.markUnconfirmedProjectWrite) session.markUnconfirmedProjectWrite();
        return {ok:false,code:'SAVE_UNCONFIRMED',projectSaved:true};
      }
      try{ if(typeof projectData !== 'undefined') projectData=result.project; }catch(_){ }
      window.projectData=result.project;
      return {ok:true,changed:true,edges:clone(desired)};
    }catch(error){return failure(error && error.code === 'INVALID_DRAWER_FRONT_GEOMETRY' ? error.code : 'WRITE_FAILED');}
  }
  FC.projectPcvOverrides={inspectRoom,get:address=>get(address,false),getForCalculation:address=>get(address,true),setEdges:(address,patch)=>change(address,patch,false),clearEdges:address=>change(address,null,true)};
})();
