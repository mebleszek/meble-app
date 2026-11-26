// Quote history + independent outbox operation share the same strict IDB commit.
// No room replica, RAW image, accepted content or foreign history can be replaced.
import {copy,id,json,equal,fail,digest} from './local-first-values.mjs';
import {prepareQuoteStatusRooms,validateQuoteStatusRooms,writeQuoteStatusRooms} from './local-first-quote-status.mjs';
import {quoteScope,validateQuoteLedgerChange,validateQuoteGenerationChange,validateQuoteVariantDraftChange,validateQuoteStatusHistoryChange} from './local-first-quote-contract.mjs';
export async function commitQuoteLedger({transaction,prepareApplication,applicationChange,rememberHandover,deviceId,args}){
 const {scope,operationId,value,expectedVersion,sourceWitness=[]}=args,application=await prepareApplication(args.application);
 const reservations=args.reservations==null?null:copy(args.reservations);
 if(!application||scope!==await quoteScope(value?.investorId))fail('LF_QUOTE_LEDGER_INVALID');
 id(operationId);validateQuoteLedgerChange(null,value);
 if(args.generationOnly&&args.rooms?.length)fail('LF_APPLICATION_SCOPE_REFUSED');
 const prepared=await prepareQuoteStatusRooms(args.rooms||[],value.investorId,deviceId);
 const encoded=json(value),hash=await digest(encoded),protection=json(application.rows),protectedHash=await digest(protection);
 return transaction('readwrite',(s,done,abort)=>{
  const r=s.replicas.getAll(),q=s.outbox.getAll(),c=s.control.getAll();let n=3;
  const finish=()=>{if(--n)return;try{
   if(!c.result.some(row=>row.key==='p0b-registry'&&row.registry==='p0b-rooms-v1'))fail('LF_P0B_REGISTRY_REQUIRED');
   if(c.result.some(row=>row.key==='retired:'+scope))fail('LF_P0B_SCOPE_RETIRED');
   const old=r.result.find(row=>row.key===scope),ops=q.result.filter(row=>row.scope===scope);
   if((old?.version||0)!==expectedVersion)fail('LF_LOCAL_CONFLICT');
   if(q.result.some(row=>row.key===operationId)||c.result.some(row=>row.key==='p1-coalesced:'+operationId))fail('LF_OPERATION_REUSED');
   validateQuoteLedgerChange(old?JSON.parse(old.json):null,value);
   const previous=old?JSON.parse(old.json):null;
   if(args.generationOnly===true)validateQuoteGenerationChange(previous,value);
   const newPins=value.offers.filter(row=>!previous?.offers.some(prior=>prior.id===row.id)).flatMap(row=>value.pins[row.id]);
   if(reservations!==null){
    const projects=[...new Set(newPins.map(pin=>pin.projectId))];
    if(!args.generationOnly||!projects.length||!Array.isArray(reservations)||reservations.length!==projects.length
     ||projects.some(projectId=>{
      const reservation=reservations.find(row=>row?.intent?.projectId===projectId);
      return reservation?.phase!=='held'||reservation.intent.investorId!==value.investorId
       ||reservation.intent.deviceId!==deviceId||!c.result.some(row=>equal(row,reservation))
       ||newPins.some(pin=>pin.projectId===projectId&&reservation.receipt.status.revision!==pin.head.currentRevisionId);
     }))fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
   }
   for(const pin of newPins){const witness=sourceWitness.find(row=>row.key===pin.projectId);if(!witness||!equal(witness.base,pin.head)||JSON.parse(witness.json).document?.integrity?.documentSha256!==pin.documentHash)fail('LF_QUOTE_SOURCE_UNCONFIRMED');}
   for(const witness of sourceWitness){
    const source=r.result.find(row=>row.key===witness.key);
    if(!source||!equal(source,witness)||source.dirty||q.result.some(op=>op.scope===source.key&&op.phase!=='verified'))fail('LF_QUOTE_SOURCE_UNCONFIRMED');
    if(c.result.some(row=>row.key==='retired:'+source.key||row.key==='projectRecovery:'+source.key||row.key==='quote-release:'+source.key))fail('LF_QUOTE_SOURCE_UNCONFIRMED');
   }
   applicationChange(s,application,before=>{
    if(args.generationOnly&&['fc_current_project_id_v1','fc_current_investor_v1'].some(key=>before.rows[key]!==application.rows[key]))fail('LF_APPLICATION_SCOPE_REFUSED');
    const variantDraft=validateQuoteVariantDraftChange(before.rows,application.rows,previous,value);
    const technical=new Set([...(variantDraft?['fc_quote_offer_drafts_v1']:[]),'fc_quote_snapshots_v1','fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1',...(prepared.length?['fc_projects_v1','fc_investors_v1']:[])]);
    for(const key of new Set([...Object.keys(before.rows),...Object.keys(application.rows)]))if(before.rows[key]!==application.rows[key]&&!technical.has(key))fail('LF_APPLICATION_SCOPE_REFUSED');
    const prior=JSON.parse(before.rows.fc_quote_snapshots_v1||'[]'),next=JSON.parse(application.rows.fc_quote_snapshots_v1||'[]'),iid=value.investorId;
    if(!equal(prior.filter(row=>row.investor?.id!==iid),next.filter(row=>row.investor?.id!==iid))
      ||!equal(next.filter(row=>row.investor?.id===iid),value.offers))fail('LF_QUOTE_OWNER_CHANGED');
    const writes=validateQuoteStatusRooms(prepared,r.result,q.result,c.result,before,application,iid);
    if(prepared.length)validateQuoteStatusHistoryChange(previous,value,prepared.map(row=>row.scope));
    writeQuoteStatusRooms({s,writes,application,protection,protectedHash,rememberHandover});
    const version=(old?.version||0)+1,previousOperation=ops.sort((a,b)=>b.localVersion-a.localVersion)[0];
    s.replicas.put({key:scope,version,json:encoded,hash,base:old?.base||null,editor:null,dirty:true});
    s.outbox.add({key:operationId,scope,localVersion:version,json:encoded,hash,base:old?.base||null,editor:null,
     previousOperation:previousOperation?.key||null,applicationHash:application.hash,...(prepared.length?{dependencies:prepared.map(row=>({scope:row.scope,key:row.operationId,hash:row.hash}))}:{}),
     ...(reservations?{reservations}:{}),phase:'queued',blockers:[],expected:null});
    s.protected.add({key:operationId,scope,json:protection,hash:protectedHash});
    done({ok:true,localConfirmed:true,cloudConfirmed:false,scope,operationId,version,scopes:[...prepared.map(row=>row.scope),scope]});
   },abort);
  }catch(e){abort(e);}};r.onsuccess=q.onsuccess=c.onsuccess=finish;
 },scope);
}
