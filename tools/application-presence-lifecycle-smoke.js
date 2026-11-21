'use strict';
const assert=require('node:assert/strict');
async function main(){
 const {applicationPresence}=await import('../sync/application-presence.mjs');
 const fc={},presence=applicationPresence(fc);assert.equal(applicationPresence(fc),presence);
 let creates=0,closes=0,reads=0;const received=[],callbacks=[];
 const protocol=()=>({watchPresence(id,online,receive){
  creates++;callbacks.push(receive);assert.equal(id,'investor');
  receive({state:'held',label:'device-'+creates});
  return {refresh(){reads++;},close(){closes++;}};
 }});
 const watch=presence.watchPresence('investor',()=>true,v=>received.push(v));
 assert.deepEqual(received.at(-1),{state:'unconfirmed'});
 const old=protocol();presence.bind(old);assert.equal(creates,1);watch.refresh();assert.equal(reads,1);
 presence.detach(old);assert.equal(closes,1);assert.deepEqual(received.at(-1),{state:'unconfirmed'});
 callbacks[0]({state:'released'});assert.deepEqual(received.at(-1),{state:'unconfirmed'},'Late old SDK results cannot confirm release');
 const next=protocol();presence.bind(next);assert.equal(creates,2);assert.equal(received.at(-1).state,'held');
 presence.detach(old);watch.refresh();assert.equal(reads,2,'Late old-runtime cleanup cannot detach the new owner');
 watch.close();watch.close();assert.equal(closes,2);watch.refresh();assert.equal(reads,2);
 callbacks[1]({state:'released'});assert.equal(received.at(-1).state,'held');
 presence.detach(next);
 const refused={watchPresence(){throw Error('AUTH_ACCESS_REVOKED');}};
 presence.bind(refused);
 const denied=[];const blocked=presence.watchPresence('investor',()=>true,v=>denied.push(v));
 assert.deepEqual(denied,[{state:'unconfirmed'}]);blocked.refresh();assert.equal(denied.at(-1).state,'unconfirmed');
 presence.detach(refused);presence.bind(protocol());assert.equal(denied.at(-1).state,'held','Existing UI reattaches only to a newly bound protocol');
 blocked.close();
 presence.bind({watchPresence(){throw TypeError('actual programming error');}});
 assert.throws(()=>presence.watchPresence('investor',()=>true,()=>{}),/actual programming error/,'Unrelated failures must remain visible');
 console.log('PASS presence lifecycle: revoked lease refuses, no false release, exact cleanup, late callbacks fenced and fresh SDK rebind');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
