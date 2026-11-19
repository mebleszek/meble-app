import {equal,fail,id} from '../../sync/local-first-values.mjs';

export function p0bDeletionGroup({uid,ref,investorRef,transaction,read,readServer,isIdle}) {
  const group = operationId => ref('p0bDeletionGroups',operationId);
  async function state(operationId) { return readServer(group(operationId)); }

  async function reserve(intent, iid) {
    await transaction(async tx => {
      const r=group(intent.operationId), operation=read(await tx.get(r));
      const target=investorRef(iid), record=read(await tx.get(target));
      if (operation.phase === 'committed') return;
      if (operation.phase !== 'preparing') fail('LF_P0B_DELETE_CONFLICT');
      if (operation.prepared[iid]) {
        if (record?.bulkId !== intent.operationId) fail('LF_P0B_ACK_UNCONFIRMED');
        return;
      }
      if (!record || record.deletionId || record.bulkId || record.generation !== intent.targets[iid])
        fail('LF_P0B_DELETE_CONFLICT');
      if (!isIdle(record)) fail('LF_P0B_EDITOR_CONFLICT');
      tx.set(target,{...record,generation:record.generation+1,bulkId:intent.operationId});
      tx.set(r,{...operation,last:iid,prepared:{...operation.prepared,[iid]:true}});
    });
  }

  async function clearCancelled(intent) {
    const current=await state(intent.operationId);
    if(current?.phase!=='cancelled') return;
    for(const iid of Object.keys(current.prepared)){
      await transaction(async tx=>{
        const r=investorRef(iid), record=read(await tx.get(r));
        if(record?.bulkId===intent.operationId)
          tx.set(r,{...record,generation:record.generation+1,bulkId:''});
      });
    }
  }

  async function cancel(intent) {
    await transaction(async tx=>{
      const r=group(intent.operationId), operation=read(await tx.get(r));
      if(operation.phase==='preparing') tx.set(r,{...operation,phase:'cancelled'});
    });
    await clearCancelled(intent);
  }

  return Object.freeze({
    state,
    async publish(intent) {
      id(intent.operationId);
      const phase=await transaction(async tx=>{
        const r=group(intent.operationId), previous=read(await tx.get(r));
        if(previous){
          if(!equal(previous.targets,intent.targets)) fail('LF_OPERATION_REUSED');
          return previous.phase;
        }
        tx.set(r,{ownerUid:uid,operationId:intent.operationId,targets:intent.targets,prepared:{},last:'',phase:'preparing'});
        return 'preparing';
      });
      if(phase==='committed') return;
      if(phase==='cancelled'){
        await clearCancelled(intent);
        fail('LF_P0B_DELETE_CONFLICT');
      }
      try{
        for(const iid of Object.keys(intent.targets)) await reserve(intent,iid);
      }catch(error){
        if(['LF_P0B_DELETE_CONFLICT','LF_P0B_EDITOR_CONFLICT'].includes(error.code)) await cancel(intent);
        throw error;
      }
      await transaction(async tx=>{
        const r=group(intent.operationId), operation=read(await tx.get(r));
        if(operation.phase==='committed') return;
        if(operation.phase!=='preparing') fail('LF_P0B_DELETE_CONFLICT');
        tx.set(r,{...operation,phase:'committed'});
      });
    },
    async confirm(intent) {
      const operation=await state(intent.operationId);
      if(operation?.phase!=='committed' || !equal(operation.targets,intent.targets))
        fail('LF_P0B_ACK_UNCONFIRMED');
      return {operationId:intent.operationId,investorIds:Object.keys(operation.targets).sort()};
    }
  });
}
