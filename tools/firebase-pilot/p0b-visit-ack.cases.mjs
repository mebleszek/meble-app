import assert from 'node:assert/strict';
import * as f from 'firebase/firestore';
import {createP0BProtocol} from './p0b-protocol.mjs';

// The emulator performs every write; only delivery of its result is faulted.
export async function visitAckCases({client,contact}){
 const source=client('visit-ack-device'),peer=client('visit-ack-peer').protocol;
 const failure=Object.assign(Error('LF_TEST_VISIT_ACK_LOST'),{code:'LF_TEST_VISIT_ACK_LOST'});
 let mode='lost',calls=0,unreadable=false;
 const connection={...source.connection,firestore:{...f,
  async runTransaction(...args){
   calls++;
   if(mode==='denied')throw failure;
   const value=await f.runTransaction(...args);
   if(mode==='changed')await peer.updateContact('visit-ack',1,{...contact,name:'New contact'});
   if(mode==='unreadable')unreadable=true;
   if(mode!=='normal')throw failure;
   return value;
  },
  getDocFromServer(...args){if(unreadable)throw Object.assign(Error('unavailable'),{code:'unavailable'});return f.getDocFromServer(...args);}
 }};
 const protocol=createP0BProtocol(connection,'visit-ack-device');
 await peer.createInvestor('visit-ack',contact);
 await protocol.openInvestor('visit-ack','lost-open','Computer');
 assert.equal(calls,1);
 let remote=await peer.investor('visit-ack');assert.equal(remote.generation,2);
 assert.deepEqual(remote.visits,{'visit-ack-device':{token:'lost-open',label:'Computer'}});
 await protocol.closeInvestor('visit-ack','lost-open');
 assert.equal(calls,2);remote=await peer.investor('visit-ack');assert.equal(remote.generation,3);assert.deepEqual(remote.visits,{});
 mode='denied';await assert.rejects(protocol.openInvestor('visit-ack','denied','Computer'),error=>error===failure);
 assert.deepEqual(await peer.investor('visit-ack'),remote);
 mode='changed';await assert.rejects(protocol.openInvestor('visit-ack','changed','Computer'),error=>error===failure);
 const changed=await peer.investor('visit-ack');assert.equal(changed.generation,5);assert.equal(changed.contact.name,'New contact');
 assert.equal(changed.visits['visit-ack-device'].token,'changed');
 mode='normal';await assert.rejects(protocol.closeInvestor('visit-ack','wrong-token'),{code:'LF_P0B_VISIT_CONFLICT'});
 assert.deepEqual(await peer.investor('visit-ack'),changed);
 await protocol.closeInvestor('visit-ack','changed');
 const beforeUnreadable=await peer.investor('visit-ack');
 mode='unreadable';await assert.rejects(protocol.openInvestor('visit-ack','unconfirmed','Computer'),error=>error===failure);
 const unconfirmed=await peer.investor('visit-ack');assert.equal(unconfirmed.generation,beforeUnreadable.generation+1);
 assert.equal(unconfirmed.visits['visit-ack-device'].token,'unconfirmed');
 unreadable=false;mode='normal';await protocol.closeInvestor('visit-ack','unconfirmed');
}
