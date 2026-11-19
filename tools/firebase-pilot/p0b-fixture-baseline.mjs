// Fixture precondition only: Chromium's Web Storage acknowledgement is not a
// disk-flush receipt. Establish the old RAW/device identity before testing
// crashes of NEW LOCAL-FIRST data. Never turn a tested SIGKILL into clean Exit.
import assert from 'node:assert/strict';
export async function nativeFixtureState(device){
 return device.page.evaluate(async database=>{
  const q=indexedDB.open(database,1);
  const db=await new Promise((resolve,reject)=>{q.onupgradeneeded=()=>q.transaction.abort();q.onerror=()=>reject(q.error);q.onsuccess=()=>resolve(q.result);});
  try{
   const tx=db.transaction(['control','replicas','outbox','protected'],'readonly');
   const reads=Object.fromEntries(['control','replicas','outbox','protected'].map(table=>[table,tx.objectStore(table).getAll()]));
   const tables=await new Promise((resolve,reject)=>{tx.onabort=()=>reject(tx.error);tx.oncomplete=()=>resolve(Object.fromEntries(Object.entries(reads).map(([key,q])=>[key,q.result])));});
   const binding=tables.control.find(row=>row.key==='binding'),keys=Object.keys(tables.control.find(row=>row.key==='application').rows);
   return {raw:Object.fromEntries(keys.map(key=>[key,window.readNormalSource(key)])),binding,
    nativeLabel:window.readNormalSource('meble-device-label-v1:'+binding.deviceId),
    archive:tables.protected.find(row=>row.key==='p0b-previous-registry'),tables};
  }finally{db.close();}
 },device.database||'meble-lf-test-normal-'+device.name);
}
export async function checkpointNativeFixture(device,restart){
 const before=await nativeFixtureState(device);
 assert.ok(before.binding?.deviceId&&before.binding?.instanceId);
 assert.ok(before.archive,'The original source must already have an IDB archive');
 assert.equal(typeof before.nativeLabel,'string');assert.ok(before.nativeLabel);
 await restart(device); // Existing orderly browser exit + exit/cleanup proof.
 const after=await nativeFixtureState(device);
 assert.deepEqual(after.binding,before.binding,'Fixture restart must keep device and installation identity');
 assert.deepEqual(after.raw,before.raw,'Old native RAW must survive before any tested crash');
 assert.equal(after.nativeLabel,before.nativeLabel);
 assert.deepEqual(after.archive,before.archive,'The preserved old registry must not be rewritten');
 for(const table of ['replicas','outbox','protected'])assert.deepEqual(after.tables[table],before.tables[table],table);
 const rows=image=>image.tables.control.find(row=>row.key==='application').rows;
 for(const key of new Set([...Object.keys(rows(before)),...Object.keys(rows(after))]))
  if(!['fc_ui_v1','fc_current_project_id_v1','fc_current_investor_v1'].includes(key))assert.equal(rows(after)[key],rows(before)[key],key);
 return after;
}
