// Read-only source addresses. Production grouping/signatures remain independent.
(function(){
  'use strict';
  window.FC=window.FC||{};
  const FC=window.FC;
  const text=value=>String(value==null?'':value).trim();
  function projectContext(project, explicitId){
    if(explicitId!==undefined) return {projectId:text(explicitId)};
    try{
      if(!project || project!==window.projectData || !FC.projectStore) return {projectId:''};
      const record=FC.projectStore.getCurrentRecord();
      if(!record || (project.meta && project.meta.assignedInvestorId
        && text(project.meta.assignedInvestorId)!==text(record.investorId))) return {projectId:''};
      if(FC.session && FC.session.active && FC.session.projectId!==record.id) return {projectId:''};
      return {projectId:text(record.id)};
    }catch(_){return {projectId:''};}
  }
  function context(cabinet,room,explicit){
    const roomId=typeof room==='string'||typeof room==='number'?text(room):text(explicit&&explicit.roomId);
    if(explicit && Object.prototype.hasOwnProperty.call(explicit,'projectId')) return {projectId:text(explicit.projectId),roomId,cabinetId:text(cabinet&&cabinet.id)};
    const project=window.projectData;
    const belongs=project && project[roomId] && Array.isArray(project[roomId].cabinets) && project[roomId].cabinets.includes(cabinet);
    return Object.assign({roomId,cabinetId:text(cabinet&&cabinet.id)},projectContext(belongs?project:null));
  }
  function copy(part){
    const out={};
    if(Array.isArray(part&&part.partRoleIds))out.partRoleIds=part.partRoleIds.slice();
    for(const key of ['sourceGroupRoles','sourceRefs','sourceGroups','sourceIssues'])if(Array.isArray(part&&part[key]))out[key]=part[key].map(row=>Object.assign({},row));
    if(part&&part.sourceFamily)out.sourceFamily=text(part.sourceFamily);
    if(part&&part.sourceReason)out.sourceReason=text(part.sourceReason);
    if(part&&part.sourceSetId)out.sourceSetId=text(part.sourceSetId);
    return out;
  }
  function bind(parts,owner){
    owner=owner||{};
    return (parts||[]).map(part=>{
      const out=Object.assign({},part,copy(part)),roles=Array.isArray(part.partRoleIds)?part.partRoleIds:[];
      const groups=Array.isArray(part.sourceGroupRoles)?part.sourceGroupRoles:[];
      const qty=Math.max(0,Math.round(Number(part.qty)||0));
      out.sourceRefs=[];out.sourceGroups=[];out.sourceIssues=[];
      const groupQty=groups.reduce((sum,group)=>sum+Number(group.qty),0);
      const valid=roles.length+groupQty<=qty && new Set(roles).size===roles.length && roles.every(role=>text(role))
        && groups.every(group=>text(group.groupRoleId) && Number.isInteger(group.qty) && group.qty>0
          && (group.ownerType==='cabinet' || (group.ownerType==='set' && text(group.setId))));
      if(valid && owner.projectId && owner.roomId){
        if(owner.cabinetId){
          out.sourceRefs=roles.map(partRoleId=>({projectId:owner.projectId,roomId:owner.roomId,cabinetId:owner.cabinetId,partRoleId}));
        }
        out.sourceGroups=groups.filter(group=>group.ownerType==='set'?group.sourceProjectId===owner.projectId:owner.cabinetId).map(group=>Object.assign({
          projectId:owner.projectId,roomId:owner.roomId,ownerType:group.ownerType,
          groupRoleId:group.groupRoleId,qty:group.qty
        },group.ownerType==='set'?{setId:text(group.setId)}:{cabinetId:owner.cabinetId}));
      }
      const unresolved=qty-out.sourceRefs.length-out.sourceGroups.reduce((sum,group)=>sum+group.qty,0);
      if(unresolved>0){
        const setId=part.sourceSetId;
        out.sourceIssues=[Object.assign({projectId:owner.projectId||null,roomId:owner.roomId||null,
          family:part.sourceFamily||'unclassified',qty:unresolved,
          reason:!valid?'invalid_source_metadata':(!owner.projectId||!owner.roomId||(!setId&&!owner.cabinetId))?'owner_context_required':(part.sourceReason||'unclassified_source')
        },setId?{ownerType:'set',setId:text(setId)}:{cabinetId:owner.cabinetId||null})];
      }
      return out;
    });
  }
  function merge(target,part){
    for(const key of ['sourceRefs','sourceGroups','sourceIssues']){
      if(Array.isArray(part&&part[key]))target[key]=(target[key]||[]).concat(part[key].map(row=>Object.assign({},row)));
    }
  }
  FC.partProvenance={projectContext,context,copy,bind,merge};
})();
