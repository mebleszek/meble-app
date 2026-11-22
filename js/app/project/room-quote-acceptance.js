// Room-protocol acceptance composes existing status plans, never recalculates prices.
// The native write boundary commits all status records and history in one IDB tx.
(function(){
 'use strict';const FC=window.FC=window.FC||{},clone=v=>JSON.parse(JSON.stringify(v));
 const same=(a,b)=>FC.cloudPilotContract.canonical(a)===FC.cloudPilotContract.canonical(b);
 const fail=code=>{throw Object.assign(Error(code),{code});};
 function plan(input){
  const {investorId,targetRoomIds,releasedRoomIds,history,nextStatus,manualBaseStatusMap,restoreManualStatusMap,forceStatusRoomIds}=input;
  const ids=[...new Set([...targetRoomIds,...releasedRoomIds])],plans=[];
  if(FC.session.active||FC.investors.getCurrentId()!==investorId)fail('LF_ACTIVE_RAM_PROTECTED');
  for(const id of ids){
   const record=FC.projectStore.getById(id);FC.roomProjectModel.validate(record);
   if(record.investorId!==investorId||record.meta.roomProject.removed||record.meta.pendingDomainOperation)fail('LF_PROJECT_OPERATION_PENDING');
   const target=targetRoomIds.includes(id),options={projectId:id,investorId,roomIds:[id],preview:true,historyRows:history,syncSelection:false,refreshUi:false,
    preserveCurrentWhenNoQuoteRows:true,preserveForwardProgress:true,recordManualStatus:false,forceStatusRoomIds,
    manualBaseStatusMap,restoreManualStatusMap,restrictToRoomIds:true,restoreManualForReleasedRooms:true,fallbackStatus:'nowy'};
   const result=target?FC.projectStatusSync.applyProjectStatusChange({...options,status:nextStatus}):FC.projectStatusSync.reconcileProjectStatuses(options);
   if(!result?.ok)fail('LF_QUOTE_STATUS_PLAN_INVALID');
   plans.push({record:clone(record),status:result.roomStatusMap[id],manual:result.projectRecord.projectData.meta.roomDefs[id].lastManualProjectStatus||''});
  }
  return {ids,plans};
 }
 async function commitPlanned(input){
  const initial=plan(input),before=FC.projectDomainOperations.readHistory(),iid=input.investorId;
  const result=await FC.applicationWrite.quoteAcceptance(initial.ids,()=>{
   if(!same(FC.projectDomainOperations.readHistory(),before))fail('LF_QUOTE_ACCEPTANCE_CONTEXT_CHANGED');
   for(const row of initial.plans)if(!same(FC.projectStore.getById(row.record.id),row.record))fail('LF_QUOTE_ACCEPTANCE_CONTEXT_CHANGED');
   const current=plan(input);
   if(!same(current,initial))fail('LF_QUOTE_ACCEPTANCE_CONTEXT_CHANGED');
   for(const row of current.plans){
    const id=row.record.id,investor=FC.investors.getById(iid);
    const saved=FC.projectStatusSync.persistStatusPlan(row.record,investor,{[id]:row.status},{[id]:row.manual},[id],row.status,before,{});
    if(!saved?.ok)fail(saved?.partial?'LF_PROJECT_OPERATION_PENDING':'LF_QUOTE_STATUS_PLAN_INVALID');
   }
   FC.quoteSnapshotStore.writeAll(input.history);
   const selected=FC.quoteSnapshotStore.getById(input.selected.id);
   if(!selected?.meta?.selectedByClient)fail('LF_QUOTE_SELECTION_UNCONFIRMED');
   return {ok:true,snapshot:selected,selectedSnapshot:selected,...(input.promote?{convertedSnapshot:selected}:{}),roomIds:input.targetRoomIds,affectedRoomIds:current.ids,localConfirmed:true,cloudConfirmed:false};
  });
  return result?.ok===true?result:{ok:false,code:result?.code||'LF_QUOTE_ACCEPTANCE_UNCONFIRMED'};
 }
 function removalPlan(snapshot){
  const iid=FC.investors.getCurrentId(),before=FC.projectDomainOperations.readHistory(),stored=before.find(row=>row.id===snapshot.id);
  if(!stored||!same(stored,snapshot)||stored.investor?.id!==iid)fail('LF_QUOTE_DELETE_CONTEXT_CHANGED');
  const ids=stored.scope?.selectedRooms,refs=stored.scope?.sourceProjects;
  if(!ids?.length||!Array.isArray(refs)||!same(ids.slice().sort(),refs.map(ref=>ref.projectId).sort())||refs.some(ref=>ref.roomId!==ref.projectId||ref.investorId!==iid))fail('LF_QUOTE_SOURCE_INVALID');
  const history=before.filter(row=>row.id!==stored.id),plans=[];
  for(const id of ids){
   const record=FC.projectStore.getById(id);FC.roomProjectModel.validate(record);
   if(record.investorId!==iid||record.meta.roomProject.removed||record.meta.pendingDomainOperation)fail('LF_PROJECT_OPERATION_PENDING');
   const preview=FC.projectStatusSync.reconcileProjectStatuses({projectId:id,investorId:iid,roomIds:[id],restrictToRoomIds:true,historyRows:history,preview:true,refreshUi:false,fallbackStatus:'nowy'});
   if(!preview?.ok)fail('LF_QUOTE_STATUS_PLAN_INVALID');
   plans.push({record:clone(record),status:preview.roomStatusMap[id],manual:preview.projectRecord.projectData.meta.roomDefs[id].lastManualProjectStatus||'',
    changed:!same(record,preview.projectRecord)||!same(FC.investors.getById(iid),preview.investor)});
  }
  return {iid,ids,before,plans};
 }
 async function commitRemoval(snapshot,validate){
  validate();const initial=removalPlan(snapshot),changed=initial.plans.filter(row=>row.changed).map(row=>row.record.id);
  return FC.applicationWrite.quoteRemoval(initial.ids,changed,()=>{
   validate();const current=removalPlan(snapshot);if(!same(current,initial))fail('LF_QUOTE_DELETE_CONTEXT_CHANGED');
   for(const row of current.plans.filter(row=>row.changed)){
    const id=row.record.id,result=FC.projectStatusSync.persistStatusPlan(row.record,FC.investors.getById(current.iid),{[id]:row.status},{[id]:row.manual},[id],row.status,current.before,{});
    if(!result?.ok)fail(result?.partial?'LF_PROJECT_OPERATION_PENDING':'LF_QUOTE_STATUS_PLAN_INVALID');
   }
   if(!FC.quoteSnapshotStore.remove(snapshot.id)||FC.quoteSnapshotStore.getById(snapshot.id))fail('LF_QUOTE_DELETE_COMMIT_UNCONFIRMED');
   return true;
  });
 }
 FC.roomQuoteAcceptance={plan,commitPlanned,commitRemoval};
})();
