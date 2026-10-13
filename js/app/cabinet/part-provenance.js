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
    for(const key of ['sourceRefs','sourceIssues'])if(Array.isArray(part&&part[key]))out[key]=part[key].map(row=>Object.assign({},row));
    if(part&&part.sourceFamily)out.sourceFamily=text(part.sourceFamily);
    if(part&&part.sourceReason)out.sourceReason=text(part.sourceReason);
    return out;
  }
  function bind(parts,owner){
    return (parts||[]).map(part=>{
      const out=Object.assign({},part,copy(part)),roles=Array.isArray(part.partRoleIds)?part.partRoleIds:[];
      const qty=Math.max(0,Math.round(Number(part.qty)||0));
      out.sourceRefs=[];out.sourceIssues=[];
      if(roles.length===qty && new Set(roles).size===qty && roles.every(role=>text(role))
        && owner.projectId && owner.roomId && owner.cabinetId){
        out.sourceRefs=roles.map(partRoleId=>({projectId:owner.projectId,roomId:owner.roomId,cabinetId:owner.cabinetId,partRoleId}));
      }else if(qty>0){
        out.sourceIssues=[{projectId:owner.projectId||null,roomId:owner.roomId||null,cabinetId:owner.cabinetId||null,
          family:part.sourceFamily||'unclassified',qty,reason:roles.length===qty?'owner_context_required':(part.sourceReason||'persistent_slots_required')}];
      }
      return out;
    });
  }
  function merge(target,part){
    for(const key of ['sourceRefs','sourceIssues']){
      if(Array.isArray(part&&part[key]))target[key]=(target[key]||[]).concat(part[key].map(row=>Object.assign({},row)));
    }
  }
  FC.partProvenance={projectContext,context,copy,bind,merge};
})();
