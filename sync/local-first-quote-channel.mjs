// Emulator-only independent quote CAS. Staged revisions/chunks are immutable;
// ACK is read through the separate reader SDK, never inferred from setDoc.
import {equal,fail,id,digest,json,assertEmulator} from './local-first-values.mjs';
import {quoteScope,validateQuoteLedger,validateQuoteLedgerChange} from './local-first-quote-contract.mjs';
export async function createQuoteChannel({writer,reader,ownerUid,investorId,sourceChannel,normalizeProject}){
 assertEmulator(writer);assertEmulator(reader);id(investorId);
 const scope=await quoteScope(investorId),f=writer.firestore,r=reader.firestore;
 const guard=()=>{if(assertEmulator(writer).uid!==ownerUid||assertEmulator(reader).uid!==ownerUid)fail('LF_AUTH_CHANGED');writer.assertAccess();reader.assertAccess();};
 const ref=(sdk,db,...path)=>sdk.doc(db,'users',ownerUid,'p0bRoomQuotes',investorId,...path);
 const fresh=snap=>{if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)fail('LF_QUOTE_SERVER_UNCONFIRMED');return snap.exists()?snap.data():null;};
 const bare=head=>head?Object.fromEntries(['ownerUid','investorId','version','generation','revisionId','hash'].map(key=>[key,head[key]])):null;
 async function head(){
  guard();
  // A new server read time, independent of an already-current watch target.
  const value=await r.runTransaction(reader.db,async tx=>bare(fresh(await tx.get(ref(r,reader.db)))),{maxAttempts:1});
  guard();return value;
 }
 async function verifySources(value){
  validateQuoteLedger(value);
  for(const pins of Object.values(value.pins))for(const pin of pins){
   const ch=sourceChannel(pin.projectId,investorId);
   const remote=await ch.readPinned(pin.head),project=remote.value.document.payload.project;
   if(project.id!==pin.projectId||project.investorId!==investorId||remote.value.document.integrity.documentSha256!==pin.documentHash
    ||await digest(normalizeProject(project))!==pin.recordHash)fail('LF_QUOTE_SOURCE_INTEGRITY');
  }
 }
 async function read(){
  guard();const h=await head();if(!h)fail('LF_QUOTE_NOT_FOUND');
  if(h.ownerUid!==ownerUid||h.investorId!==investorId||h.version!==1||!Number.isSafeInteger(h.generation)||h.generation<1)fail('LF_QUOTE_REMOTE_INTEGRITY');
  const revision=fresh(await r.getDocFromServer(ref(r,reader.db,'revisions',h.revisionId)));
  if(!revision||!equal(bare(revision),h)||!Array.isArray(revision.chunks)||revision.chunks.length<1||revision.chunks.length>64)fail('LF_QUOTE_REMOTE_INTEGRITY');
  let text='';
  for(const [index,hash]of revision.chunks.entries()){
   const chunk=fresh(await r.getDocFromServer(ref(r,reader.db,'revisions',h.revisionId,'chunks',String(index))));
   if(!chunk||chunk.index!==index||typeof chunk.text!=='string'||chunk.hash!==hash||await digest(chunk.text)!==hash)fail('LF_QUOTE_REMOTE_INTEGRITY');
   text+=chunk.text;
  }
  if(await digest(text)!==h.hash)fail('LF_QUOTE_REMOTE_INTEGRITY');
  const value=JSON.parse(text);if(json(value)!==text||value.investorId!==investorId)fail('LF_QUOTE_REMOTE_INTEGRITY');
  await verifySources(value);guard();return {head:h,value};
 }
 return {scope,kind:'quote',guard,read,readHead:head,
  watch:notify=>r.onSnapshot(ref(r,reader.db),notify,notify),
  async prepare(value,base){
   guard();if(value.investorId!==investorId)fail('LF_QUOTE_OWNER_CHANGED');await verifySources(value);
   let prior=null;try{prior=await read();}catch(e){if(e.code!=='LF_QUOTE_NOT_FOUND')throw e;}
   if(!equal(prior?.head||null,base))fail('LF_QUOTE_CAS_CONFLICT');
   validateQuoteLedgerChange(prior?.value,value);
   const text=json(value),hash=await digest(text),revisionId=crypto.randomUUID().replaceAll('-','');
   const expected={ownerUid,investorId,version:1,generation:(base?.generation||0)+1,revisionId,hash},chunks=[];
   for(let i=0;i<text.length;){let end=Math.min(text.length,i+100000);if(end<text.length&&text.charCodeAt(end-1)>=0xd800&&text.charCodeAt(end-1)<=0xdbff)end++;const part=text.slice(i,end);i=end;chunks.push({index:chunks.length,text:part,hash:await digest(part)});}
   if(!chunks.length||chunks.length>64)fail('LF_QUOTE_SIZE_LIMIT');
   const revision={...expected,previous:base?.revisionId||'',chunks:chunks.map(row=>row.hash),createdAt:f.serverTimestamp()};
   return {expected,async publish(){
    guard();
    await f.runTransaction(writer.db,async tx=>{
     const inv=fresh(await tx.get(f.doc(writer.db,'users',ownerUid,'p0bRoomInvestors',investorId)));
     if(!inv||inv.deletionId||inv.bulkId)fail('LF_P0B_INVESTOR_DELETED');
     const current=bare(fresh(await tx.get(ref(f,writer.db))));
     if(!equal(current,base))fail('LF_QUOTE_CAS_CONFLICT');
     tx.set(ref(f,writer.db,'revisions',revisionId),revision);
    },{maxAttempts:1});
    for(const chunk of chunks){guard();await f.setDoc(ref(f,writer.db,'revisions',revisionId,'chunks',String(chunk.index)),chunk);}
    await f.runTransaction(writer.db,async tx=>{
     const inv=fresh(await tx.get(f.doc(writer.db,'users',ownerUid,'p0bRoomInvestors',investorId)));
     const current=bare(fresh(await tx.get(ref(f,writer.db))));
     if(!inv||inv.deletionId||inv.bulkId)fail('LF_P0B_INVESTOR_DELETED');
     if(!equal(current,base))fail('LF_QUOTE_CAS_CONFLICT');
     guard();tx.set(ref(f,writer.db),{...expected,updatedAt:f.serverTimestamp()});
    },{maxAttempts:1});
   }};
  }
 };
}
