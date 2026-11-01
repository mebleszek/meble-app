// Application projection around the existing LOCAL-FIRST channels. Import is inert.
import {copy,equal,fail,safeError,assertEmulator} from './local-first-values.mjs';
import {createDurableSynchronizer} from './local-first-sync.mjs';
import {validateProjectDependencies,createProjectChannel} from './local-first-project.mjs';

// Only verified owned records enter the image. Technical stores/RAW are retained.
export function projectApplicationRows(rows,channel,remote,globalContract,projectContract){
 const next=copy(rows);
 if(channel.scope==='globals'){
  globalContract.validateBundle(remote.value);
  for(const [domain,value]of Object.entries(remote.value)){
   const existing=globalContract.sources[domain].map(k=>rows[k]).filter(v=>v!==null&&v!==undefined).map(v=>JSON.parse(v));
   if(existing.length>1&&existing.some(v=>!equal(v,existing[0])))fail('LF_GLOBAL_ALIAS_CONFLICT');
   let local=copy(value);
   if(domain==='company'){
    const old=JSON.parse(rows[globalContract.sources.company[0]]||'null');
    if(old?.transport&&Object.hasOwn(old.transport,'apiKey'))local.transport.apiKey=old.transport.apiKey;
   }
   const raw=JSON.stringify(domain==='stock'?{sheets:local}:local);
   for(const key of globalContract.sources[domain])next[key]=raw;
  }
 }else{
  const p=remote.value.document.payload;projectContract.validate(p);
  if(p.project.id!==channel.scope)fail('LF_PROJECT_OWNER_CHANGED');
  for(const [key,row]of [['fc_projects_v1',p.project],['fc_investors_v1',p.investor]]){
   const all=JSON.parse(next[key]||'[]'),matches=all.filter(x=>x.id===row.id);
   if(matches.length>1||key==='fc_projects_v1'&&matches.length&&matches[0].investorId!==p.investor.id)fail('LF_PROJECT_OWNER_CHANGED');
   const index=all.findIndex(x=>x.id===row.id);if(index<0)all.push(row);else all[index]=row;next[key]=JSON.stringify(all);
  }
  const history=JSON.parse(next.fc_quote_snapshots_v1||'[]');
  if(!Array.isArray(history)||history.some(o=>!o.project?.id||!o.investor?.id))fail('LF_HISTORY_OWNER_REQUIRED');
  next.fc_quote_snapshots_v1=JSON.stringify([...history.filter(o=>o.project.id!==channel.scope),...p.offers]);
  // A blank recipient may select its first independently verified owner.
  if(!next.fc_current_project_id_v1){next.fc_current_project_id_v1=p.project.id;next.fc_current_investor_v1=p.investor.id;
   next.fc_ui_v1=JSON.stringify({entry:'rooms',activeTab:'inwestor',roomType:null,currentInvestorId:p.investor.id});}
 }
 return next;
}

export function createApplicationReplication({store,channels,globalContract,projectContract,eventTarget,online,onState,
 incoming,refresh,assertIdle,discovery}={}){
 const globals=channels.find(c=>c.scope==='globals');if(!globals||typeof incoming!=='function'||typeof refresh!=='function'||typeof assertIdle!=='function')fail('LF_APPLICATION_DEPENDENCIES_REQUIRED');
 const sync=createDurableSynchronizer({store,channels,eventTarget,online,onState,
  async projectRemote(channel,remote){const image=await store.readApplication();
   if(!image)fail('LF_APPLICATION_NOT_INITIALIZED');
   return incoming(projectApplicationRows(image.rows,channel,remote,globalContract,projectContract));},
  onApplied:refresh});
 let closed=false,listing=null,again=false;
 const discover=()=>{if(closed||!discovery||online&&!online())return;if(listing){again=true;return;}
  listing=(async()=>{do{again=false;const candidates=await discovery.list(scope=>!!sync.channel(scope));
   for(const channel of candidates){if(closed)return;if(!sync.channel(channel.scope)){await channel.read();if(!closed)sync.register(channel);}}
  }while(again&&!closed);})().catch(e=>{if(!closed)onState?.(safeError(e));}).finally(()=>{listing=null;if(again&&!closed)discover();});};
 const stopDiscovery=discovery?.watch(discover)||(()=>{});eventTarget.addEventListener('online',discover);discover();
 return Object.freeze({...sync,
  notify(){sync.notify();discover();},
  close(){closed=true;stopDiscovery();eventTarget.removeEventListener('online',discover);sync.close();},
  async acquireEditor(scope){await assertIdle();return sync.acquireEditor(scope);},
  async releaseEditor(scope){await assertIdle();return sync.releaseEditor(scope);},
  ...createApplicationCommitter({store,globalContract,projectContract,channel:scope=>sync.channel(scope)})
 });
}

// Same atomic business/image/outbox boundary for online and already-approved offline editors.
export function createApplicationCommitter({store,globalContract,projectContract,channel}){
 return Object.freeze({
  async commit(kind,application,projectId){
   const source={getItem:key=>application.rows[key]??null},old=await store.readApplication();
   if(!old||old.version!==application.expectedVersion)fail('LF_APPLICATION_CONFLICT');
   const globalKeys=new Set(Object.values(globalContract.sources).flat());
   const technical=new Set(['fc_edit_session_v1','fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1','fc_project_backup_v1','fc_project_backup_meta_v1']);
   for(const key of new Set([...Object.keys(old.rows),...Object.keys(application.rows)])){
    if(old.rows[key]===application.rows[key]||technical.has(key))continue;
    if(kind==='globals'&&globalKeys.has(key))continue;
    if(kind==='project'&&['fc_projects_v1','fc_investors_v1','fc_quote_snapshots_v1'].includes(key))continue;
    fail('LF_APPLICATION_SCOPE_REFUSED');
   }
   let scope,value,editor=null;
   if(kind==='globals'){
    scope='globals';const captured=globalContract.capture(source,Object.keys(globalContract.schemas));globalContract.validateBundle(captured.model);captured.assertUnchanged();value=captured.model;
   }else if(kind==='project'){
    scope=projectId;if(channel(scope)?.kind!=='project')fail('LF_PROJECT_CHANNEL_REQUIRED');
    const local=await store.snapshot(scope),pinned=local.replica?JSON.parse(local.replica.json).globals:null,g=await store.snapshot('globals');
    if(!pinned&&(!g.replica?.base||g.replica.dirty))fail('LF_GLOBAL_DEPENDENCIES_UNCONFIRMED');
    const built=await projectContract.build(source,projectId);
    for(const [key,owned]of [['fc_projects_v1',projectId],['fc_investors_v1',built.document.payload.investor.id]]){
     const before=JSON.parse(old.rows[key]||'[]').filter(r=>r.id!==owned),after=JSON.parse(application.rows[key]||'[]').filter(r=>r.id!==owned);
     if(!equal(before,after))fail('LF_APPLICATION_SCOPE_REFUSED');
    }
    const others=rows=>JSON.parse(rows.fc_quote_snapshots_v1||'[]').filter(o=>o.project?.id!==projectId);
    if(!equal(others(old.rows),others(application.rows)))fail('LF_APPLICATION_SCOPE_REFUSED');
    const catalogs=pinned||{head:g.replica.base,model:JSON.parse(g.replica.json)};
    const requirements=validateProjectDependencies(projectContract,globalContract,built.document,catalogs.model);
    value={document:built.document,globals:catalogs,requirements};editor=(await store.snapshot(scope)).replica?.editor;
   }else fail('LF_APPLICATION_SCOPE_REFUSED');
   const before=await store.snapshot(scope);
   const result=await store.commit({scope,operationId:crypto.randomUUID(),value,expectedVersion:before.replica?.version||0,editor,application,
    // Preserve the exact source image alongside each approved business revision.
    protectedRows:application.rows});
   if(!result.localConfirmed)fail('LF_LOCAL_ACK_UNCONFIRMED');return result;
  },
  async checkpoint(application,kind){
   if(kind==='rollback'){
    const before=await store.readApplication(),scope=application.rows.fc_current_project_id_v1,local=await store.snapshot(scope);
    if(!local.replica||local.replica.dirty)fail('LF_ROLLBACK_BASE_UNCONFIRMED');
    const approved=JSON.parse(local.replica.json).document.payload.project;
    const rows=JSON.parse(application.rows.fc_projects_v1||'[]');
    if(!equal(rows.find(r=>r.id===scope),approved))fail('LF_ROLLBACK_BASE_UNCONFIRMED');
    if(!equal(rows.filter(r=>r.id!==scope),JSON.parse(before.rows.fc_projects_v1||'[]').filter(r=>r.id!==scope)))fail('LF_APPLICATION_SCOPE_REFUSED');
    const technical=new Set(['fc_projects_v1','fc_edit_session_v1','fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1']);
    for(const k of Object.keys(before.rows))if(!technical.has(k)&&before.rows[k]!==application.rows[k])fail('LF_APPLICATION_SCOPE_REFUSED');
   }
   return store.checkpointApplication(application);
  }
 });
}

// Head queries only discover candidates. Each candidate still passes the same
// independent chunk/Rules/dependency read before registration or local apply.
export function createEmulatorProjectDiscovery(options){
 const {writer,reader,ownerUid}=options,a=assertEmulator(writer),b=assertEmulator(reader);
 if(a.uid!==ownerUid||b.uid!==ownerUid||writer.db.app===reader.db.app)fail('LF_INDEPENDENT_OWNER_REQUIRED');
 const f=reader.firestore,ref=f.collection(reader.db,'users',ownerUid,'localFirstProjects');
 const guard=()=>{writer.assertAccess?.();reader.assertAccess?.();if(!equal(assertEmulator(writer),a)||!equal(assertEmulator(reader),b))fail('LF_AUTH_CHANGED');};
 return Object.freeze({
  watch(notify){guard();return f.onSnapshot(f.query(ref,f.orderBy('updatedAt','desc'),f.limit(100)),notify,notify);},
  async list(known){guard();const found=[];let last=null;
   for(;;){const q=f.query(ref,f.orderBy(f.documentId()),f.limit(100),...(last?[f.startAfter(last)]:[])),rows=await f.getDocsFromServer(q);guard();
    if(rows.metadata.fromCache||rows.metadata.hasPendingWrites)fail('LF_SERVER_UNCONFIRMED');
    for(const row of rows.docs)if(!known(row.id))found.push(createProjectChannel({...options,projectId:row.id,investorId:row.data().investorId}));
    if(rows.size<100)break;last=rows.docs.at(-1);
   }return found;
  }
 });
}
