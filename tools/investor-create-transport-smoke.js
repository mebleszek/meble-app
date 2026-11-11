#!/usr/bin/env node
'use strict';
// Regression: a new LOCAL-FIRST investor preserves manually entered travel
// values through the actual investors-model and investors-store contracts.
const assert=require('node:assert/strict'),fs=require('node:fs');
const FILES=[
  'js/app/investor/investors-model.js',
  'js/app/investor/investors-store.js'
];
const source=FILES.map(file=>fs.readFileSync(file,'utf8'));
function start(durable){
  const storage={
    getItem:key=>durable.has(key)?durable.get(key):null,
    setItem:(key,value)=>durable.set(key,String(value)),
    removeItem:key=>durable.delete(key)
  };
  const fc={};
  fc.investorsLocalRepository={
    readStoredAll:()=>JSON.parse(storage.getItem('fc_investors_v1')||'[]'),
    writeAll:list=>{storage.setItem('fc_investors_v1',JSON.stringify(list));return true;},
    getCurrentId:()=>storage.getItem('fc_current_investor_v1'),
    setCurrentId:id=>id?storage.setItem('fc_current_investor_v1',id):storage.removeItem('fc_current_investor_v1'),
    unmarkRemovedId:()=>{},
    readRemovedIds:()=>new Set()
  };
  fc.investorsRecovery={
    recoverMissingInvestors:rows=>rows,
    stripSnapshotOnlyPhantomInvestors:rows=>rows
  };
  const win={FC:fc,localStorage:storage};win.window=win;
  source.forEach(js=>new Function('window','localStorage',js)(win,storage));
  return win.FC.investors;
}
const durable=new Map(),api=start(durable);
const input={
  kind:'person',name:'Synthetic transport creation',
  transport:{distanceKm:'12',durationMin:'30',source:'ręcznie',status:'manual',note:'one way'},
  carrying:{floorNumber:'0',elevatorStatus:'no'}
};
const untouched=JSON.stringify(input);
const created=api.create(input);
assert.ok(created&&created.id,'new investor must be persisted');
assert.equal(created.transport.distanceKm,'12');
assert.equal(created.transport.durationMin,'30');
assert.equal(created.transport.status,'manual');
assert.equal(created.transport.source,'ręcznie');
assert.equal(created.transport.note,'one way');
assert.equal(created.carrying.floorNumber,'0');
assert.equal(JSON.stringify(input),untouched,'creation cannot mutate input');
assert.equal(api.getById(created.id).transport.durationMin,'30','readAll must preserve manual route');
const raw=durable.get('fc_investors_v1');
assert.equal(JSON.parse(raw).find(x=>x.id===created.id).transport.durationMin,'30');
const restarted=start(durable);
assert.equal(restarted.getById(created.id).transport.durationMin,'30','cold restart must preserve duration');
assert.equal(durable.get('fc_investors_v1'),raw,'read/restart may not rewrite RAW');
const empty=restarted.create({name:'Synthetic without route'});
assert.equal(empty.transport.durationMin,'','missing route must stay missing');
assert.equal(empty.transport.distanceKm,'','missing distance must stay missing');
assert.equal(restarted.getById(created.id).transport.durationMin,'30','second investor cannot overwrite first');
const edited=restarted.update(created.id,{transport:{distanceKm:'7',durationMin:'15',source:'ręcznie',status:'manual'}});
assert.equal(edited.transport.durationMin,'15','existing investor update must retain its behavior');
assert.equal(start(durable).getById(created.id).transport.durationMin,'15','update must remain durable across restart');
console.log('PASS investor create/transport, missing route, cold restart, update');
