import assert from 'node:assert/strict';
import * as f from 'firebase/firestore';
import {createP0BProtocol} from './p0b-protocol.mjs';

async function orderedPair(left,right,operation){
 let arrived=0,releaseReads,releaseSecond,first=true,second=true;
 const reads=new Promise(resolve=>releaseReads=resolve),committed=new Promise(resolve=>releaseSecond=resolve);
 function participant(device,position){
  return createP0BProtocol({...device.connection,firestore:{...f,
   runTransaction(db,work,options){
    return f.runTransaction(db,async tx=>{
     const hold=position===0?first:second;
     if(position===0)first=false;else second=false;
     const result=await work({get:ref=>tx.get(ref),set:(...args)=>tx.set(...args)});
     if(hold){if(++arrived===2)releaseReads();await reads;if(position===1)await committed;}
     return result;
    },options);
   }
  }},position===0?'parallel-left':'parallel-right');
 }
 const pc=participant(left,0),phone=participant(right,1),timer=setTimeout(()=>{releaseReads();releaseSecond();},5000);
 try{return await Promise.all([operation(pc,0).finally(releaseSecond),operation(phone,1)]);}finally{clearTimeout(timer);}
}
export async function lockContentionCases({client,contact}){
 const left=client('parallel-left'),right=client('parallel-right');
 const iid='parallel-locks',ids=['parallel-kitchen','parallel-wardrobe'],args=pid=>({iid,pid,expectedHead:'',deviceLabel:pid});
 await left.protocol.createInvestor(iid,contact);
 for(const [device,pid]of [[left,ids[0]],[right,ids[1]]]){
  const editor=await device.protocol.acquire(args(pid));
  await device.protocol.release({...args(pid),expectedEditor:editor});
 }
 const [kitchen,wardrobe]=await orderedPair(left,right,(protocol,i)=>protocol.acquire(args(ids[i])));
 const record=await left.protocol.investor(iid);
 assert.deepEqual(record.projects,{'parallel-kitchen':true,'parallel-wardrobe':true});
 assert.equal(kitchen.deviceId,'parallel-left');assert.equal(wardrobe.deviceId,'parallel-right');
 assert.equal(kitchen.epoch,2);assert.equal(wardrobe.epoch,2);
 assert.deepEqual(record.contact,contact);
 await assert.rejects(right.protocol.acquire(args('parallel-kitchen')),{code:'LF_P0B_EDITOR_CONFLICT'});
 await orderedPair(left,right,(protocol,i)=>protocol.release({...args(ids[i]),expectedEditor:[kitchen,wardrobe][i]}));
 assert.deepEqual((await left.protocol.investor(iid)).projects,{'parallel-kitchen':false,'parallel-wardrobe':false});
 await orderedPair(left,right,protocol=>protocol.ensureInvestorVisit(iid,'Device'));
 let visits=(await left.protocol.investor(iid)).visits;assert.equal(Object.keys(visits).length,2);
 await orderedPair(left,right,(protocol,i)=>protocol.closeInvestor(iid,visits[['parallel-left','parallel-right'][i]].token));
 assert.deepEqual((await left.protocol.investor(iid)).visits,{});
 await assert.rejects(orderedPair(left,right,protocol=>protocol.acquire(args(ids[0]))));
 const held=(await f.getDocFromServer(f.doc(left.db,'users',left.connection.auth.currentUser.uid,'localFirstEditors',ids[0]))).data();
 assert.equal(held.deviceId,'parallel-left');assert.equal(held.active,true);
 await left.protocol.release({...args(ids[0]),expectedEditor:held});
 // A TOCTOU between recoverOwnVisit and open must not replace an own token.
 assert.equal(await left.protocol.recoverOwnVisit(iid),null);
 await left.protocol.openInvestor(iid,'already-open','Original label');
 await assert.rejects(left.protocol.openInvestor(iid,'new-token','New label'),{code:'LF_P0B_VISIT_CONFLICT'});
 const own=await left.protocol.investor(iid);await left.protocol.ensureInvestorVisit(iid,'Ignored replacement');
 assert.deepEqual(await left.protocol.investor(iid),own);
 await left.protocol.closeInvestor(iid,'already-open');
 // A retired runtime cannot commit buffered work after its read completes.
 let current=true;
 const retired=createP0BProtocol({...left.connection,firestore:{...f,runTransaction:(db,work,opts)=>f.runTransaction(db,tx=>work({get:async ref=>{const value=await tx.get(ref);current=false;return value;},set:(...a)=>tx.set(...a)}),opts)}},'parallel-left',()=>{if(!current)throw Object.assign(Error('LF_CLOSED'),{code:'LF_CLOSED'});});
 const prior=await left.protocol.investor(iid);
 await assert.rejects(retired.ensureInvestorVisit(iid,'Retired'),{code:'LF_CLOSED'});
 assert.deepEqual(await left.protocol.investor(iid),prior);
 // Independent contact changes are deliberately NOT a room-lock replan.
 let writes=0;
 const contactConflict=createP0BProtocol({...left.connection,firestore:{...f,runTransaction:(db,work,opts)=>f.runTransaction(db,async tx=>{
  let writing=false;const result=await work({get:ref=>tx.get(ref),set:(...a)=>{writing=true;return tx.set(...a);}});
  if(writing){writes++;await right.protocol.updateContact(iid,1,{...contact,name:'Concurrent contact'});}return result;
 },opts)}},'parallel-left');
 await assert.rejects(contactConflict.acquire(args(ids[0])));assert.equal(writes,1);
 const conflicted=await left.protocol.investor(iid);assert.equal(conflicted.projects[ids[0]],false);assert.equal(conflicted.contact.name,'Concurrent contact');
 // Repeated proven disjoint conflicts exhaust a fixed three-plan budget.
 let peerEditor=null;const generations=[];
 const bounded=createP0BProtocol({...left.connection,firestore:{...f,runTransaction:(db,work,opts)=>f.runTransaction(db,async tx=>{
  let writing=false;const result=await work({get:ref=>tx.get(ref),set:(ref,data)=>{writing=true;if(ref.parent.id==='localFirstInvestors')generations.push(data.generation);return tx.set(ref,data);}});
  if(writing){if(peerEditor){await right.protocol.release({...args(ids[1]),expectedEditor:peerEditor});peerEditor=null;}else peerEditor=await right.protocol.acquire(args(ids[1]));}return result;
 },opts)}},'parallel-left');
 await assert.rejects(bounded.acquire(args(ids[0])));assert.equal(generations.length,3);
 assert.ok(generations.every((n,i)=>!i||n>generations[i-1]));assert.equal((await left.protocol.investor(iid)).projects[ids[0]],false);
 if(peerEditor)await right.protocol.release({...args(ids[1]),expectedEditor:peerEditor});
}
