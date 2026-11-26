// Independently authorized room-registry quote CAS. Staged revisions/chunks are immutable;
// ACK is read through the separate reader SDK, never inferred from setDoc.
import {equal,fail,id,digest,json} from './local-first-values.mjs';
import {assertP0BConnection} from './firebase-activation.mjs';
import {quoteScope,validateQuoteLedger,validateQuoteLedgerChange} from './local-first-quote-contract.mjs';
export async function createQuoteChannel({writer,reader,ownerUid,investorId,sourceChannel,normalizeProject,reservationAuthority}){
 assertP0BConnection(writer);assertP0BConnection(reader);id(investorId);
 const scope=await quoteScope(investorId),f=writer.firestore,r=reader.firestore;
 if(reservationAuthority&&writer.db.app.options.projectId!=='demo-meble-app')fail('LF_EMULATOR_REQUIRED');
 const guard=()=>{if(assertP0BConnection(writer).uid!==ownerUid||assertP0BConnection(reader).uid!==ownerUid)fail('LF_AUTH_CHANGED');writer.assertAccess();reader.assertAccess();};
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
 async function prepare(value,base,resumeExpected=null,reservations=null){
   guard();if(value.investorId!==investorId)fail('LF_QUOTE_OWNER_CHANGED');await verifySources(value);
   let prior=null;try{prior=await read();}catch(e){if(e.code!=='LF_QUOTE_NOT_FOUND')throw e;}
   // An outstanding original RPC can commit between the uncertain probe and
   // this read. Full content/source validation above is an exact ACK proof,
   // not a foreign CAS conflict and not permission to publish a second head.
   if(resumeExpected&&equal(prior?.head,resumeExpected)&&equal(prior.value,value))
    return {expected:resumeExpected,async publish(){guard();}};
   if(!equal(prior?.head||null,base))fail('LF_QUOTE_CAS_CONFLICT');
   validateQuoteLedgerChange(prior?.value,value);
   const introduced=value.offers.filter(offer=>!prior?.value.offers.some(old=>old.id===offer.id));
   if(reservationAuthority&&introduced.length&&reservations===null)fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
   let reservationPins;
   if(reservations!==null){
    if(!reservationAuthority)fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
    const byRoom=new Map();
    for(const offer of introduced)for(const pin of value.pins[offer.id]){
     const priorPin=byRoom.get(pin.projectId);
     if(priorPin&&!equal(priorPin,pin))fail('LF_QUOTE_RESERVATION_UNCONFIRMED');
     byRoom.set(pin.projectId,pin);
    }
    reservationPins=[...byRoom.values()];
   }
   const text=json(value),hash=await digest(text),revisionId=resumeExpected?.revisionId||crypto.randomUUID().replaceAll('-','');
   if(!/^[a-f0-9]{32}$/.test(revisionId))fail('LF_QUOTE_STAGED_INTEGRITY');
   const expected={ownerUid,investorId,version:1,generation:(base?.generation||0)+1,revisionId,hash},chunks=[];
   if(resumeExpected&&!equal(resumeExpected,expected))fail('LF_QUOTE_STAGED_INTEGRITY');
   for(let i=0;i<text.length;){let end=Math.min(text.length,i+100000);if(end<text.length&&text.charCodeAt(end-1)>=0xd800&&text.charCodeAt(end-1)<=0xdbff)end++;const part=text.slice(i,end);i=end;chunks.push({index:chunks.length,text:part,hash:await digest(part)});}
   if(!chunks.length||chunks.length>64)fail('LF_QUOTE_SIZE_LIMIT');
   const revision={...expected,previous:base?.revisionId||'',chunks:chunks.map(row=>row.hash),createdAt:f.serverTimestamp()};
   return {expected,async publish(){
    guard();
    await f.runTransaction(writer.db,async tx=>{
     const inv=fresh(await tx.get(f.doc(writer.db,'users',ownerUid,'p0bRoomInvestors',investorId)));
     if(!inv||inv.deletionId||inv.bulkId)fail('LF_P0B_INVESTOR_DELETED');
     const current=bare(fresh(await tx.get(ref(f,writer.db))));
     const staged=fresh(await tx.get(ref(f,writer.db,'revisions',revisionId)));
     if(!equal(current,base))fail('LF_QUOTE_CAS_CONFLICT');
     if(staged){if(!equal(bare(staged),expected)||staged.previous!==revision.previous||!equal(staged.chunks,revision.chunks)||!staged.createdAt)fail('LF_QUOTE_STAGED_INTEGRITY');}
     else tx.set(ref(f,writer.db,'revisions',revisionId),revision);
    },{maxAttempts:1});
    for(const chunk of chunks){
     guard();const target=ref(f,writer.db,'revisions',revisionId,'chunks',String(chunk.index));
     if(!resumeExpected)await f.setDoc(target,chunk);
     else await f.runTransaction(writer.db,async tx=>{
      const saved=fresh(await tx.get(target));
      if(saved){if(!equal(saved,chunk))fail('LF_QUOTE_STAGED_INTEGRITY');}
      else tx.set(target,chunk);
     },{maxAttempts:1});
    }
    await f.runTransaction(writer.db,async tx=>{
     const inv=fresh(await tx.get(f.doc(writer.db,'users',ownerUid,'p0bRoomInvestors',investorId)));
     const current=bare(fresh(await tx.get(ref(f,writer.db))));
     if(!inv||inv.deletionId||inv.bulkId)fail('LF_P0B_INVESTOR_DELETED');
     if(equal(current,expected))return;
     if(!equal(current,base))fail('LF_QUOTE_CAS_CONFLICT');
     if(reservationPins)await reservationAuthority.assertPublication(tx,{investorId,pins:reservationPins,proofs:reservations});
     guard();tx.set(ref(f,writer.db),{...expected,updatedAt:f.serverTimestamp()});
    },{maxAttempts:1});
   }};
 }
 return {scope,kind:'quote',guard,read,readHead:head,
  watch:notify=>r.onSnapshot(ref(r,reader.db),notify,notify),
  prepare:(value,base,_editor,reservations)=>prepare(value,base,null,reservations),
  resume:(value,base,expected,reservations)=>prepare(value,base,expected,reservations)};
}
