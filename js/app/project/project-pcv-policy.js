// One project policy; no global switch, import or alternate PCV store.
(function(){
  'use strict';
  window.FC=window.FC||{};
  const FC=window.FC,clone=value=>JSON.parse(JSON.stringify(value));
  const fail=code=>({ok:false,code});
  function comparable(value){
    if(Array.isArray(value))return value.map(comparable);
    if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,comparable(value[key])]));
    return value;
  }
  const equal=(a,b)=>JSON.stringify(comparable(a))===JSON.stringify(comparable(b));
  const persisted=value=>FC.projectStore.prepareProjectDataForPersistence(FC.project.normalize(clone(value)));
  const marker=value=>value && value.meta && value.meta.productionPcvMode;
  function read(config){
    let projectModeRequired=!!marker(window.projectData);
    const refusal=code=>Object.assign(fail(code),{projectModeRequired});
    try{
      const cfg=config||{},store=FC.projectStore,ram=window.projectData,id=store && store.getCurrentProjectId();
      if(!id)return refusal('PROJECT_REQUIRED');
      const rows=store.readAll().filter(row=>String(row.id)===String(id));
      projectModeRequired=projectModeRequired || rows.some(row=>!!marker(row.projectData));
      if(rows.length!==1)return refusal('PROJECT_OWNER_AMBIGUOUS');
      const record=rows[0],investorId=FC.investors && FC.investors.getCurrentId();
      if(!investorId || String(record.investorId)!==String(investorId)
        || !ram || !ram.meta || String(ram.meta.assignedInvestorId)!==String(investorId))return refusal('INVESTOR_CONTEXT_MISMATCH');
      const mode=marker(record.projectData),ramMode=marker(ram);
      if(mode!==ramMode)return refusal('PCV_POLICY_MISMATCH');
      if(mode!==undefined && mode!=='' && mode!=='project')return refusal('PCV_POLICY_INVALID');
      if(mode!=='project' && !cfg.allowLegacy)return Object.assign(refusal('PCV_POLICY_REQUIRED'),{projectModeRequired:true});
      const session=FC.session;
      if(session && session.canSaveProject && session.canSaveProject()!==true)return Object.assign(refusal('SESSION_UNCONFIRMED'),session.lastError||{});
      if(session && session.active && (session.projectId!==id || !session.durable))return refusal('EDIT_CONTEXT_MISMATCH');
      if((mode==='project' || cfg.strict) && !equal(persisted(ram),persisted(record.projectData)))return refusal('RAM_DIVERGENCE');
      if(cfg.roomId && (!record.projectData[cfg.roomId] || !ram[cfg.roomId]))return refusal('ROOM_NOT_FOUND');
      if(cfg.edit && (String(window.uiState && window.uiState.roomType)!==String(cfg.roomId)
        || session && session.active && session.roomId!==cfg.roomId))return refusal('EDIT_CONTEXT_MISMATCH');
      return {ok:true,mode:mode==='project'?'project':'legacy',projectId:id,investorId:String(investorId),record,
        options:mode==='project'?{pcvMode:'project',projectId:id}:{}};
    }catch(_){return refusal('POLICY_READ_FAILED');}
  }
  function calculationOptions(requested){
    const state=read({allowLegacy:requested && requested.pcvMode==='project'});
    if(!state.ok)throw FC.projectPcvResolver.error(state.code);
    const opts=requested||{};
    if(state.mode==='project' && (opts.pcvMode && opts.pcvMode!=='project' || opts.projectId && opts.projectId!==state.projectId))throw FC.projectPcvResolver.error('PCV_POLICY_MISMATCH');
    // Explicit project mode remains available to isolated callers; normal UI follows the marker.
    return Object.assign({},opts,state.options);
  }
  function notify(result){
    if(FC.infoBox)FC.infoBox.open({title:'Nie potwierdzono PCV projektu',okOnly:true,message:result && result.projectSaved
      ? 'Dane projektu mogły zostać zapisane, ale nie potwierdzono sesji. Dalszy zapis został wstrzymany, aby chronić dane. Zachowano formularz i snapshot. ('+String(result.code||'SAVE_FAILED')+')'
      : 'Operacja została wstrzymana. Zachowano ustawienia i formularz. Sprawdź projekt oraz sesję i spróbuj ponownie. ('+String(result && result.code || 'SAVE_FAILED')+')'});
  }
  function activate(expected){
    const state=read({strict:true,allowLegacy:true});
    if(!state.ok)return state;
    if(expected && (state.projectId!==expected.projectId || state.investorId!==expected.investorId))return fail('PROJECT_CONTEXT_MISMATCH');
    if(!FC.session || typeof FC.session.canSaveProject!=='function')return fail('SESSION_UNAVAILABLE');
    if(FC.session && FC.session.active || FC.sessionNavigation && FC.sessionNavigation.needsClosure())return fail('ACTIVE_EDIT');
    if(state.mode==='project')return {ok:true,changed:false};
    try{
      const next=clone(state.record.projectData);next.meta.productionPcvMode='project';
      const result=FC.project.saveConfirmed(next,{expectedRecord:state.record});
      const after=FC.projectStore.getById(state.projectId);
      const changed=after && !equal(after,state.record);
      if(!result || result.ok!==true || !after || !equal(persisted(after.projectData),persisted(next))){
        const partial=!!(result && result.projectSaved || changed || !after);
        if(partial && FC.session && FC.session.markUnconfirmedProjectWrite)FC.session.markUnconfirmedProjectWrite();
        return {ok:false,code:result && result.code || 'ACTIVATION_SAVE_FAILED',projectSaved:partial};
      }
      if(FC.projectStore.getCurrentProjectId()!==state.projectId || String(FC.investors.getCurrentId())!==state.investorId){
        if(FC.session && FC.session.markUnconfirmedProjectWrite)FC.session.markUnconfirmedProjectWrite();
        return {ok:false,code:'PROJECT_CONTEXT_MISMATCH',projectSaved:true};
      }
      window.projectData=result.project;
      try{if(typeof projectData!=='undefined')projectData=result.project;}catch(_){ }
      return {ok:true,changed:true};
    }catch(_){
      // Read-back is uncertain; never permit a later stale-RAM write to undo it.
      if(FC.session && FC.session.markUnconfirmedProjectWrite)FC.session.markUnconfirmedProjectWrite();
      return {ok:false,code:'ACTIVATION_UNCONFIRMED',projectSaved:true};
    }
  }
  function ensureProjectMode(openingRoom){
    const session=FC.session;
    if(session && session.active){
      try{
        const id=FC.projectStore.getCurrentProjectId(),record=FC.projectStore.getById(id),investor=FC.investors.getCurrentId();
        // This no-write check precedes session.begin(openingRoom), which validates
        // the durable proof and permits retry of an initial failed begin.
        if(session.projectId!==id || openingRoom && session.roomId!==String(openingRoom)
          || !record || String(record.investorId)!==String(investor) || !window.projectData || !window.projectData.meta
          || String(window.projectData.meta.assignedInvestorId)!==String(investor)
          || marker(record.projectData)!=='project' || marker(window.projectData)!=='project')return fail('ACTIVE_EDIT');
        return {ok:true,changed:false};
      }catch(_){return fail('ACTIVE_EDIT');}
    }
    return activate();
  }
  FC.projectPcvPolicy={read,calculationOptions,activate,ensureProjectMode,notify};
})();
