import {copy,equal,fail} from './local-first-values.mjs';
import {validateProjectDependencies} from './local-first-project.mjs';
// Values and permissions remain per room. The image/outbox commit is atomic.
export async function prepareApplicationRooms({fc,store,getSync,application,records,declaredScopes}){
 if(!Array.isArray(declaredScopes)||records.some(row=>!declaredScopes.includes(row.id)))fail('LF_APPLICATION_SCOPE_REFUSED');
 const current=application.rows.fc_current_project_id_v1,entries=[],g=await store.snapshot('globals');
 const confirmed=g.replica?.base&&!g.replica.dirty&&g.operations.every(op=>op.phase==='verified');
 for(const record of records){
  fc.roomProjectModel.validate(record);
  if(getSync()?.channel(record.id)?.kind!=='project')fail('LF_PROJECT_CHANNEL_REQUIRED');
  const local=await store.snapshot(record.id),editor=local.replica?.editor;
  if(!editor?.active||editor.deviceId!==store.deviceId)fail('LF_EDITOR_REQUIRED');
  const pinned=local.replica&&JSON.parse(local.replica.json).globals;
  const catalogs=confirmed?{head:g.replica.base,model:JSON.parse(g.replica.json)}:pinned;
  if(!catalogs)fail('LF_GLOBAL_DEPENDENCIES_UNCONFIRMED');
  const built=await fc.businessProjectContract.build({getItem:key=>application.rows[key]??null},record.id);
  const requirements=validateProjectDependencies(fc.businessProjectContract,fc.globalDataContract,built.document,catalogs.model);
  entries.push({scope:record.id,operationId:crypto.randomUUID(),expectedVersion:local.replica.version,editor:copy(editor),
   value:{document:built.document,globals:catalogs,requirements},releaseAfterSync:record.id!==current||record.meta.roomProject.removed===true});
 }
 return entries;
}
export async function commitApplicationRooms(args){
 const {store,application}=args,entries=await prepareApplicationRooms(args);
 if(args.batchable===true&&entries.length===1)entries[0].batchable=true;
 if(!entries.length){await store.checkpointApplication(application);return {localConfirmed:true,cloudConfirmed:false,unchanged:true,scopes:[]};}
 return store.commitRoomBatch({entries,application});
}
