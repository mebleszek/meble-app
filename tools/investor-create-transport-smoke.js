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

(async()=>{
  function fixture(){
    const rows=new Map(),investors=start(rows),investor=investors.create({name:'Route request',transport:{}});
    investors.setCurrentId(investor.id);
    const win={FC:{investors,projectStore:{getCurrentProjectId:()=> 'room'},session:{active:false},
      sessionNavigation:{canCalculate:()=>true},companyProfile:{read:()=>({}),companyAddress:()=> 'Workshop',billableDistanceKm:n=>Number(n)*2}},
      uiState:{activeTab:'wycena'},localStorage:{getItem:k=>rows.get(k)??null}};
    win.window=win;
    for(const file of ['js/app/investor/investor-persistence.js','js/app/investor/investor-transport.js','js/app/quote/quote-route-request.js'])
      new Function('window','document',fs.readFileSync(file,'utf8'))(win,{});
    let draft={projectId:'room',investorId:investor.id,selection:{selectedRooms:['room']},commercial:{versionName:'Keep'},services:{delivery:true,carrying:true,assembly:true}},choices=0,writes=0;
    const fc=win.FC;
    fc.quoteOfferStore={getCurrentDraft:()=>draft,async saveSettings(scope,patch){draft={...draft,...patch};return draft;}};
    fc.applicationWrite={async auto(fn){writes++;return fn();}};
    fc.tabNavigation={setActiveTab:name=>{win.uiState.activeTab=name;}};
    fc.quoteRouteRequest.open=async()=>{choices++;return {action:'cancel'};};
    return {win,fc,rows,investor,get draft(){return draft;},get choices(){return choices;},get writes(){return writes;},run:()=>fc.quoteRouteRequest.prepare(()=>draft)};
  }
  const cancelled=fixture(),initial=JSON.stringify([...cancelled.rows]);
  assert.equal(await cancelled.run(),false);assert.equal(cancelled.writes,0);assert.equal(JSON.stringify([...cancelled.rows]),initial);
  const manual=fixture();manual.fc.quoteRouteRequest.open=async()=>({action:'save',distanceKm:'12,5',durationMin:'30'});
  assert.equal(await manual.run(),true);
  const saved=manual.fc.investors.getById(manual.investor.id).transport;
  assert.equal(saved.distanceKm,'12.5');assert.equal(saved.durationMin,'30');assert.equal(saved.routeDurationSeconds,'');
  assert.equal(manual.fc.investorTransport.getCurrentTransportContext().billableKm,25);
  assert.equal(start(manual.rows).getById(manual.investor.id).transport.durationMin,'30','Same investor store, durable across restart');
  assert.equal(await manual.run(),true);assert.equal(manual.writes,1,'Complete current route skips dialog/write');
  manual.fc.openRouteServiceTransport={isResultStale:()=>true};manual.fc.quoteRouteRequest.open=async()=>({action:'cancel'});
  assert.equal(await manual.run(),false,'An old address witness requires a new decision even with both numbers');
  for(const value of ['', '-1','NaN','Infinity']){
    const r=fixture();r.fc.quoteRouteRequest.open=async()=>({action:'save',distanceKm:value,durationMin:'30'});
    await assert.rejects(r.run(),/TRANSPORT_INPUT_INVALID/);assert.equal(r.writes,0);
  }
  const zero=fixture();zero.fc.quoteRouteRequest.open=async()=>({action:'save',distanceKm:'0',durationMin:'0'});assert.equal(await zero.run(),true,'Explicit zero is different from missing');
  const pickup=fixture(),pickupBefore=JSON.stringify([...pickup.rows]);pickup.fc.quoteRouteRequest.open=async()=>({action:'pickup'});
  assert.equal(await pickup.run(),true);assert.deepEqual(pickup.draft.services,{delivery:false,carrying:false,assembly:false});
  assert.equal(pickup.draft.commercial.versionName,'Keep');assert.deepEqual(pickup.draft.selection.selectedRooms,['room']);
  assert.equal(JSON.stringify([...pickup.rows]),pickupBefore,'Pickup must retain the investor route');
  assert.equal(await pickup.run(),true);
  const navigate=fixture(),navigateDraft=JSON.stringify(navigate.draft);navigate.fc.quoteRouteRequest.open=async()=>({action:'investor'});
  assert.equal(await navigate.run(),false);assert.equal(navigate.win.uiState.activeTab,'inwestor');assert.equal(JSON.stringify(navigate.draft),navigateDraft);assert.equal(navigate.writes,1,'Navigation has its ordinary durable boundary, without saving route');
  for(const kind of ['owner','draft','contact','writer','tab','access']){
    const r=fixture(),before=JSON.stringify([...r.rows]);
    r.fc.quoteRouteRequest.open=async()=>{
      if(kind==='owner')r.fc.projectStore.getCurrentProjectId=()=> 'other';
      if(kind==='draft')r.draft.commercial.versionName='Changed';
      if(kind==='contact')r.fc.investors.update(r.investor.id,{address:'Changed'});
      if(kind==='writer')r.fc.applicationWrite={};
      if(kind==='tab')r.win.uiState.activeTab='material';
      if(kind==='access')r.win.__FC_MAIN_ACCESS__={assert(){throw Error('AUTH_ACCESS_REVOKED');}};
      return {action:'save',distanceKm:'12',durationMin:'30'};
    };
    await assert.rejects(r.run(),/TRANSPORT_CONTEXT_CHANGED|AUTH_ACCESS_REVOKED/);assert.equal(r.writes,0);
    if(kind!=='contact')assert.equal(JSON.stringify([...r.rows]),before);
  }
  for(const code of ['LF_OFFLINE','LF_IDB_ABORTED','LF_HANDOVER_CONFLICT']){
    const r=fixture(),before=JSON.stringify([...r.rows]);
    r.fc.quoteRouteRequest.open=async()=>({action:'save',distanceKm:'12',durationMin:'30'});
    r.fc.applicationWrite.auto=async()=>{throw Error(code);};
    await assert.rejects(r.run(),new RegExp(code));assert.equal(JSON.stringify([...r.rows]),before,'A refused checkpoint never changes the investor');
  }
  const topbar=fixture();let generated=0,asked=0;
  topbar.fc.applicationWrite={whenIdle:async()=>{},project:async()=>{generated++;}};
  topbar.fc.quoteRouteRequest.open=async()=>{asked++;return {action:'cancel'};};
  const shell=process.argv.includes('--baseline-route')
    ?require('node:child_process').execFileSync('git',['-c','safe.directory='+process.cwd(),'show','c684df4e1b74fa121b12693d334a1294096f48cf:js/app/wycena/wycena-tab-shell.js'],{encoding:'utf8'})
    :fs.readFileSync('js/app/wycena/wycena-tab-shell.js','utf8');
  new Function('window','document',shell)(topbar.win,{});
  const h=()=>({appendChild(){},setAttribute(){},addEventListener(){}});
  topbar.fc.wycenaTabShell.renderTopbar(h(),{},null,{h,getState:()=>({}),getOfferDraft:()=>topbar.draft});
  topbar.fc.wycenaGenerateAction.run();await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(asked,1,'Actual Calculate must ask before source publication or expensive generation');
  assert.equal(generated,0,'Cancellation must stop the real topbar pipeline');
  console.log('PASS quote route gate: manual/pickup/cancel/investor, restart, zero/invalid, stale, context fences and actual Calculate cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});
