// Read-only pre-activation check. No importer, normalization, SDK configuration or writes.
import {assertEmulator,copy,equal,id,json} from '../../sync/local-first-values.mjs';

export async function inspectP0BApplicationCompatibility({reader,ownerUid,rows}){
 const identity=assertEmulator(reader);
 if(identity.uid!==ownerUid)throw Error('LF_INDEPENDENT_OWNER_REQUIRED');
 const f=reader.firestore,issues=[],counts={investors:0,projects:0,localInvestors:0,localProjects:0};
 const guard=()=>{reader.assertAccess();if(!equal(assertEmulator(reader),identity))throw Error('LF_AUTH_CHANGED');};
 async function list(collection){
  const found=[];let cursor;
  do{
   guard();
   const ref=f.collection(reader.db,'users',ownerUid,collection);
   const page=await f.getDocsFromServer(f.query(ref,f.orderBy(f.documentId()),f.limit(100),...(cursor?[f.startAfter(cursor)]:[])));
   guard();
   if(page.metadata.fromCache||page.metadata.hasPendingWrites)throw Error('LF_SERVER_UNCONFIRMED');
   for(const doc of page.docs)found.push({id:doc.id,data:doc.data()});
   cursor=page.size===100?page.docs.at(-1):null;
  }while(cursor);
  return found;
 }
 // Neither inventory may stand in for the other. The new Rules deliberately
 // deny the old query, so its absence is UNKNOWN, never proof of no legacy data.
 const [registry,legacy]=await Promise.allSettled([list('localFirstInvestors'),list('localFirstProjects')]);
 const inaccessible=(result,code)=>{
  if(result.status==='fulfilled')return false;
  const reason=result.reason?.code;
  issues.push({code,reason:reason==='permission-denied'?'permission-denied':'server-unconfirmed'});
  return true;
 };
 const missingRegistry=inaccessible(registry,'LF_P0B_REGISTRY_UNCONFIRMED');
 const missingLegacy=inaccessible(legacy,'LF_P0B_LEGACY_INVENTORY_UNCONFIRMED');
 const records=new Map(),heads=new Map();
 if(!missingRegistry){
  counts.investors=registry.value.length;
  for(const {id:iid,data:r}of registry.value){
   try{
    id(iid);
    if(r.schemaVersion!==1||r.ownerUid!==ownerUid||r.investorId!==iid
     ||!Number.isSafeInteger(r.contactRevision)||r.contactRevision<1
     ||!Number.isSafeInteger(r.generation)||r.generation<1
     ||!r.projects||Array.isArray(r.projects)||typeof r.projects!=='object'
     ||Object.entries(r.projects).some(([pid,held])=>{id(pid);return typeof held!=='boolean';}))
     throw Error();
    if(r.bulkId||r.deletionId){issues.push({code:'LF_P0B_DELETION_RECONCILIATION_REQUIRED',investorId:iid});continue;}
    const contact=JSON.parse(r.contact);
    if(!contact||Array.isArray(contact)||typeof contact!=='object'||Object.hasOwn(contact,'rooms')
     ||contact.id!==undefined&&contact.id!==iid||json(contact)!==r.contact)throw Error();
    records.set(iid,{...r,contact});
   }catch(_){issues.push({code:'LF_P0B_REGISTRY_INVALID',investorId:iid});}
  }
 }
 if(!missingLegacy){
  counts.projects=legacy.value.length;
  for(const {id:pid,data:head}of legacy.value){
   const owner=records.get(head.investorId);
   if(head.projectId!==pid||head.ownerUid!==ownerUid||!owner||!Object.hasOwn(owner.projects,pid))
    issues.push({code:'LF_P0B_UNREGISTERED_PROJECT',projectId:pid,investorId:head.investorId||null});
   heads.set(pid,head);
  }
 }
 function local(key){
  try{
   const value=JSON.parse(rows[key]||'[]');
   if(!Array.isArray(value)||value.some(r=>!r||typeof r!=='object'||Array.isArray(r))
    ||new Set(value.map(r=>r.id)).size!==value.length)throw Error();
   return value;
  }catch(_){issues.push({code:'LF_P0B_LOCAL_INVENTORY_INVALID',key});return [];}
 }
 const investors=local('fc_investors_v1'),projects=local('fc_projects_v1');
 counts.localInvestors=investors.length;counts.localProjects=projects.length;
 for(const investor of investors){
  const {rooms,...contact}=investor,r=records.get(investor.id);
  if(!r)issues.push({code:'LF_P0B_LEGACY_CONTACT',investorId:investor.id});
  else if(!equal(contact,r.contact))issues.push({code:'LF_P0B_CONTACT_RECONCILIATION_REQUIRED',investorId:investor.id});
  // Room mirrors remain untouched. This check supplies no migration proof.
  if(rooms!==undefined&&!Array.isArray(rooms))issues.push({code:'LF_P0B_ROOM_OWNERSHIP_UNCONFIRMED',investorId:investor.id});
 }
 for(const project of projects){
  const r=records.get(project.investorId),head=heads.get(project.id);
  if(!r||!Object.hasOwn(r.projects,project.id))
   issues.push({code:'LF_P0B_UNREGISTERED_LOCAL_PROJECT',projectId:project.id,investorId:project.investorId});
  if(!missingLegacy&&head&&head.investorId!==project.investorId)
   issues.push({code:'LF_P0B_PROJECT_OWNER_CONFLICT',projectId:project.id});
 }
 guard();
 // COMPATIBLE means inventory compatibility only. It does not authorize
 // migration, deletion, adoption of data or activation of the runtime.
 return copy({status:issues.length?'BLOCKED':'COMPATIBLE',readOnly:true,
  coverage:{registry:!missingRegistry,legacyProjects:!missingLegacy},counts,issues});
}
