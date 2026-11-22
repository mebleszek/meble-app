import {copy,equal,fail,digest} from './local-first-values.mjs';
import {prepareApplicationRooms} from './application-room-commit.mjs';
import {createQuoteChannel} from './local-first-quote-channel.mjs';
import {quoteScope,validateQuoteLedgerChange,validateQuoteLedger} from './local-first-quote-contract.mjs';
// Integration of a separate investor-owned ledger, never a synthetic room.
export function createApplicationQuoteLedger({fc,store,writer,reader,getSync,sourceChannel}){
 const owners=new Map(),normalizeProject=row=>fc.projectModel.normalizeProjectRecord(copy(row));
 async function channel(iid){
  const ch=await createQuoteChannel({writer,reader,ownerUid:store.ownerUid,investorId:iid,sourceChannel,normalizeProject});
  owners.set(ch.scope,iid);return ch;
 }
 async function sources(refs){
  if(!Array.isArray(refs)||!refs.length)fail('LF_QUOTE_SOURCE_INVALID');
  // A frozen quote pins confirmed room revisions. Finish pending room writes,
  // including ordinary status commits after deletion, before reading pins.
  const pending=await Promise.all(refs.map(ref=>store.snapshot(ref.projectId)));
  if(pending.some(source=>source.operations.some(op=>op.phase!=='verified'))){
   const result=await getSync().flush();if(!result.ok)fail(result.code);
  }
  const out=[];
  for(const ref of refs){
   const source=await store.snapshot(ref.projectId),replica=source.replica;
   if(!replica?.base||replica.dirty||source.operations.some(op=>op.phase!=='verified')||await digest(replica.json)!==replica.hash||await store.retired(ref.projectId))fail('LF_QUOTE_SOURCE_UNCONFIRMED');
   const document=JSON.parse(replica.json).document,record=normalizeProject(document.payload.project);
   if(record.id!==ref.projectId||ref.roomId!==record.id||record.investorId!==ref.investorId||ref.investorId!==fc.investors.getCurrentId()||await digest(record)!==ref.recordHash)fail('LF_QUOTE_SOURCE_INTEGRITY');
   out.push({projectId:ref.projectId,recordHash:ref.recordHash,documentHash:document.integrity.documentSha256,head:copy(replica.base)});
  }
  return out;
 }
 const proof=Object.freeze({sources});
 async function commit(application,declaredScopes){
  const before=await store.readApplication(),prior=JSON.parse(before.rows.fc_quote_snapshots_v1||'[]'),next=JSON.parse(application.rows.fc_quote_snapshots_v1||'[]');
  const changed=new Set([...prior,...next].filter(row=>!equal(prior.find(r=>r.id===row.id),next.find(r=>r.id===row.id))).map(row=>row.investor?.id));
  if(changed.size!==1)fail('LF_QUOTE_OWNER_CHANGED');
  const iid=[...changed][0],scope=await quoteScope(iid);
  if(iid!==application.rows.fc_current_investor_v1||!JSON.parse(application.rows.fc_investors_v1||'[]').some(row=>row.id===iid))fail('LF_QUOTE_OWNER_CHANGED');
  const local=await store.snapshot(scope),previous=local.replica?JSON.parse(local.replica.json):null;
  if(!equal(previous?.offers||[],prior.filter(row=>row.investor?.id===iid)))fail('LF_QUOTE_BASE_UNCONFIRMED');
  const offers=next.filter(row=>row.investor?.id===iid),pins={},sourceWitness=new Map();
  for(const offer of offers){
   const old=previous?.offers.find(row=>row.id===offer.id);
   if(old){pins[offer.id]=copy(previous.pins[offer.id]);continue;}
   const refs=offer.scope?.sourceProjects;
   if(!Array.isArray(refs)||!refs.length)fail('LF_QUOTE_SOURCE_INVALID');
   pins[offer.id]=[];
   for(const ref of refs){
    const source=await store.snapshot(ref.projectId),replica=source.replica;
    if(!replica?.base||replica.dirty||source.operations.some(op=>op.phase!=='verified')||await digest(replica.json)!==replica.hash)fail('LF_QUOTE_SOURCE_UNCONFIRMED');
    const document=JSON.parse(replica.json).document,record=normalizeProject(document.payload.project);
    if(record.id!==ref.projectId||record.investorId!==iid||ref.roomId!==record.id||await digest(record)!==ref.recordHash||!equal(ref.revision,replica.base)||ref.documentHash!==document.integrity.documentSha256)fail('LF_QUOTE_SOURCE_INTEGRITY');
    sourceWitness.set(ref.projectId,copy(replica));
    pins[offer.id].push({projectId:ref.projectId,recordHash:ref.recordHash,documentHash:document.integrity.documentSha256,head:copy(replica.base)});
   }
  }
  const value={kind:'p0b-room-quotes',investorId:iid,offers,pins};validateQuoteLedgerChange(previous,value);
  if(before.rows.fc_quote_offer_drafts_v1!==application.rows.fc_quote_offer_drafts_v1)
   fc.businessProjectContract.validateOfferDraftChange(before.rows,application.rows,before.rows.fc_current_project_id_v1);
  if(!getSync().channel(scope))getSync().register(await channel(iid));
  const oldProjects=JSON.parse(before.rows.fc_projects_v1||'[]'),newProjects=JSON.parse(application.rows.fc_projects_v1||'[]');
  const modified=newProjects.filter(row=>!equal(row,oldProjects.find(old=>old.id===row.id)));
  if(oldProjects.length!==newProjects.length||modified.some(row=>!oldProjects.some(old=>old.id===row.id)))fail('LF_APPLICATION_SCOPE_REFUSED');
  const rooms=modified.length?await prepareApplicationRooms({fc,store,getSync,application,records:modified,declaredScopes}):[];
  return store.commitQuoteLedger({scope,rooms,operationId:crypto.randomUUID(),value,expectedVersion:local.replica?.version||0,application,sourceWitness:[...sourceWitness.values()]});
 }
 async function projectRows(rows,ch,remote){
  const iid=owners.get(ch.scope);validateQuoteLedger(remote.value);
  if(remote.value.investorId!==iid||!JSON.parse(rows.fc_investors_v1||'[]').some(row=>row.id===iid))fail('LF_QUOTE_OWNER_CHANGED');
  const local=JSON.parse(rows.fc_quote_snapshots_v1||'[]'),old=local.filter(row=>row.investor?.id===iid);
  const stored=(await store.snapshot(ch.scope)).replica,previous=stored?JSON.parse(stored.json):null;
  if(!equal(previous?.offers||[],old))fail('LF_QUOTE_BASE_UNCONFIRMED');
  validateQuoteLedgerChange(previous,remote.value);
  return {...rows,fc_quote_snapshots_v1:JSON.stringify([...local.filter(row=>row.investor?.id!==iid),...copy(remote.value.offers)])};
 }
 return {channel,commit,projectRows,proof};
}
