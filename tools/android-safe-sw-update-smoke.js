'use strict';
// Two real public deployments, one private Chromium profile; no Firebase RPC.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const {browser}=require('./trusted-session-browser-smoke');
// Only startup may append factories or correct exact approved factory records.
// Worker installation, private records and every unrelated RAW remain exact.
const legacyService=({id,category,name,price})=>({id,category,name,price});
// Independent expected image, not the production normalizer/correction function.
// Historical 2930e0d7 split projected away note/edgeWaste; normalization supplied empty note.
function expectedMaterialUpgrade(before,candidate){
 const image=Object.fromEntries(JSON.parse(before)),expected={};
 const factories=[
  {id:'m5',materialType:'obrzeże',manufacturer:'Start',symbol:'PCV-STD',name:'Obrzeże PCV standard',price:3,priceUnit:'mb',hasGrain:false,starterPrice:true,priceUserEditedAt:'',note:''},
  {id:'m7',materialType:'obrzeże',manufacturer:'Start',symbol:'PCV-FRONT',name:'PCV pod kolor frontów',price:5,priceUnit:'mb',hasGrain:false,starterPrice:true,priceUserEditedAt:'',note:''},
 ];
 for(const key of ['fc_sheet_materials_v1','fc_materials_v1']){
  if(!Object.hasOwn(image,key))continue;
  const old=JSON.parse(image[key]);
  const upgraded=old.map(row=>{
   const exactFactory=value=>factories.find(known=>Object.keys(value).length===Object.keys(known).length&&Object.keys(known).every(field=>value[field]===known[field]));
   let factory=exactFactory(row);
   // The legacy app persists this separate seven-field material compatibility projection.
   // It may follow a price correction only with the complete primary-row proof, never by ID alone.
   const compactKeys=['id','materialType','manufacturer','symbol','name','price','hasGrain'];
   if(!factory&&key==='fc_materials_v1'&&Object.keys(row).length===compactKeys.length&&compactKeys.every(field=>Object.hasOwn(row,field))){
    const primary=JSON.parse(image.fc_sheet_materials_v1||'[]').find(candidate=>candidate.id===row.id);
    if(primary&&compactKeys.every(field=>row[field]===primary[field]))factory=exactFactory(primary);
   }
   const billing=!Object.hasOwn(row,'billingIncrement')?({laminat:'sheet',hdf:'m2'}[row.materialType]):null;
   const next={};for(const [field,value]of Object.entries(row)){
    next[field]=factory&&field==='price'?(row.id==='m5'?10:20):value;
    if(field==='priceUnit'&&billing)next.billingIncrement=billing;
   }
   return next;
  });
  if(candidate)for(const row of candidate.materials.filter(row=>/^m_drawer_bottom_(?:10|16)_(?:white|grey)$/.test(row.id))){
   if(!old.some(previous=>previous.id===row.id))upgraded.push(key==='fc_materials_v1'
    ?Object.fromEntries(['id','materialType','manufacturer','symbol','name','price','hasGrain'].map(field=>[field,row[field]]))
    :{...structuredClone(row),priceUserEditedAt:''});
  }
  expected[key]=JSON.stringify(upgraded);
 }
 return expected;
}
function expectedPricingUpgrade(before,candidate){
 const expected=expectedMaterialUpgrade(before,candidate),image=Object.fromEntries(JSON.parse(before));
 if(Object.hasOwn(image,'fc_accessories_v1')){
  const old=JSON.parse(image.fc_accessories_v1),seen=new Set(old.map(row=>row.id));
  const missing=candidate.hardware.filter(row=>!seen.has(row.id));
  assert.equal(missing.length,392,'The historical16 hardware records receive exactly392 approved new entries');
  expected.fc_accessories_v1=JSON.stringify(old.concat(missing));
 }
 const required=new Set(candidate.hardware.flatMap(row=>Object.keys(row.technicalParams||{}).map(key=>row.hardwareCategory+'\0'+key)));
 const supplierIds=new Set(candidate.hardware.map(row=>row.supplierId));
 for(const [key,rows]of [['fc_hardware_suppliers_v1',candidate.suppliers.filter(row=>supplierIds.has(row.id))],['fc_hardware_technical_params_v1',candidate.technicalParams.filter(row=>required.has(row.category+'\0'+row.key))]]){
  if(!Object.hasOwn(image,key))continue;
  const old=JSON.parse(image[key]),next=structuredClone(old),identity=row=>key.includes('technical')?row.category+'\0'+row.key:row.id;
  for(const row of rows)if(!old.some(previous=>identity(previous)===identity(row)))next.push(structuredClone(row));
  if(key.includes('technical'))for(const item of candidate.hardware)for(const [field,value]of Object.entries(item.technicalParams||{})){
   const row=next.find(row=>row.category===item.hardwareCategory&&row.key===field);
   if(row?.fieldType==='text'&&row.options?.length&&value.value&&!row.options.includes(value.value))row.options.push(value.value);
  }
  expected[key]=JSON.stringify(next);
 }
 return expected;
}
function assertStarterAppend(before,after,templates,corrections={},materialExpected={}){
 const a=Object.fromEntries(JSON.parse(before)),b=Object.fromEntries(JSON.parse(after));
 assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort(),'No RAW key may appear/disappear through upgrade');
 const aliases=['fc_quote_rates_v1','fc_services_v1'];
 for(const key of Object.keys(a)){
  if(!aliases.includes(key)){
   if(Object.hasOwn(materialExpected,key)){
    const next=JSON.parse(b[key]),expected=JSON.parse(materialExpected[key]),oldCount=JSON.parse(a[key]).length;
    assert.equal(JSON.stringify(next.slice(0,oldCount)),JSON.stringify(expected.slice(0,oldCount)),'Every existing field and its encoding remain exact: '+key);
    assert.deepEqual(next.slice(oldCount),expected.slice(oldCount),'Every new field/value and row is approved; object key insertion order is immaterial: '+key);
    assert.equal(b[key],JSON.stringify(next),'Compact deterministic RAW encoding: '+key);
   }else assert.equal(b[key],a[key],'Exact original unrelated RAW: '+key);
   continue;
  }
  const old=JSON.parse(a[key]),next=JSON.parse(b[key]),ids=new Set(old.map(row=>row.id));
  assert.equal(ids.size,old.length,'Original IDs remain unambiguous');
  const expected=key==='fc_services_v1'?templates.map(legacyService):templates;
  const missing=expected.filter(row=>!ids.has(row.id));
  assert.equal(next.length,old.length+missing.length,'Exactly the missing factory rows, no extra or removed records');
  for(let i=0;i<old.length;i++){const approved=corrections[old[i].id];const expectedRow=approved?(key==='fc_services_v1'?legacyService(approved):approved):old[i];assert.equal(JSON.stringify(next[i]),JSON.stringify(expectedRow),'Exact original or explicitly approved factory correction: '+key+'/'+i);}
  assert.deepEqual(next.slice(old.length),missing,'Every appended field must match the approved code definitions');
  assert.equal(new Set(next.map(row=>row.id)).size,next.length,'No duplicated IDs');
  assert.equal(b[key],JSON.stringify(next),'Exact compact RAW encoding: '+key);
 }
 assert.deepEqual(JSON.parse(b.fc_services_v1),JSON.parse(b.fc_quote_rates_v1).map(legacyService),'Legacy service projection must match every canonical record');
}
function assertFullStarters(catalog,templates,ids){
 const wanted=new Set(ids);
 assert.deepEqual(catalog.filter(row=>wanted.has(row.id)),templates.filter(row=>wanted.has(row.id)),'WYCENA catalog must retain every complete starter definition, not the legacy RAW projection');
}
function verifyUpgradeAssertions(){
 const original=[{id:'old',category:'Synthetic',name:'Old',price:12.125,minutes:45}],templates=original.concat({id:'new',category:'Synthetic',name:'New',price:0,minutes:5});
 const pack=rows=>JSON.stringify(Object.entries({fc_quote_rates_v1:JSON.stringify(rows),fc_services_v1:JSON.stringify(rows.map(legacyService)),fc_projects_v1:'EXACT_PROJECT'}));
 const before=pack(original),after=pack(templates);assertStarterAppend(before,after,templates);
 for(const mutate of [
  rows=>{rows[0].price++;},rows=>{rows[1].minutes++;},rows=>{rows.shift();},rows=>{rows.push({id:'unexpected'});}
 ]){const rows=structuredClone(templates);mutate(rows);assert.throws(()=>assertStarterAppend(before,pack(rows),templates),{code:'ERR_ASSERTION'});}
 for(const change of [map=>{map.fc_projects_v1='LOST';},map=>{delete map.fc_projects_v1;},map=>{map.fc_unknown='EXTRA';},map=>{map.fc_services_v1=JSON.stringify(original);},map=>{map.fc_services_v1+=' ';}]){
  const map=Object.fromEntries(JSON.parse(after));change(map);assert.throws(()=>assertStarterAppend(before,JSON.stringify(Object.entries(map)),templates),{code:'ERR_ASSERTION'});
 }
 const pcv={id:'m5',materialType:'obrzeże',manufacturer:'Start',symbol:'PCV-STD',name:'Obrzeże PCV standard',price:3,priceUnit:'mb',hasGrain:false,starterPrice:true,priceUserEditedAt:'',note:''};
 const custom=[{...pcv,id:'own',price:0,starterPrice:false},{...pcv,id:'edited',priceUserEditedAt:'2026-11-01'},{...pcv,id:'alias',aliases:['own name']},{...pcv,id:'format',sheetWidthMm:2500,sheetHeightMm:1250}];
 const materials=[{id:'board',materialType:'laminat',price:0,priceUnit:'sheet'},pcv,...custom];
 const materialBefore=JSON.stringify(Object.entries({...Object.fromEntries(JSON.parse(before)),fc_sheet_materials_v1:JSON.stringify(materials),fc_materials_v1:JSON.stringify(materials),fc_quote_snapshots_v1:'EXACT_FROZEN',fc_private:'EXACT_PRIVATE'}));
 const approved=expectedMaterialUpgrade(materialBefore),image={...Object.fromEntries(JSON.parse(after)),fc_sheet_materials_v1:approved.fc_sheet_materials_v1,fc_materials_v1:approved.fc_materials_v1,fc_quote_snapshots_v1:'EXACT_FROZEN',fc_private:'EXACT_PRIVATE'},materialAfter=JSON.stringify(Object.entries(image));
 assertStarterAppend(materialBefore,materialAfter,templates,{},approved);
 assert.equal(JSON.parse(approved.fc_sheet_materials_v1)[1].price,10);assert.deepEqual(JSON.parse(approved.fc_sheet_materials_v1).slice(2),custom);
 for(const mutate of [rows=>{rows[0].price=1;},rows=>{rows[0].billingIncrement='m2';},rows=>{rows[1].price=11;},rows=>{rows[2].price=10;},rows=>{rows[3].priceUserEditedAt='';},rows=>{delete rows[4].aliases;},rows=>{rows[5].sheetWidthMm=2800;},rows=>{rows.push({id:'extra'});}]){
  const changed=structuredClone(image),rows=JSON.parse(changed.fc_sheet_materials_v1);mutate(rows);changed.fc_sheet_materials_v1=JSON.stringify(rows);assert.throws(()=>assertStarterAppend(materialBefore,JSON.stringify(Object.entries(changed)),templates,{},approved),{code:'ERR_ASSERTION'});
 }
 for(const key of ['fc_quote_snapshots_v1','fc_private']){const changed={...image,[key]:'CHANGED'};assert.throws(()=>assertStarterAppend(materialBefore,JSON.stringify(Object.entries(changed)),templates,{},approved),{code:'ERR_ASSERTION'});}
 assertFullStarters(templates,templates,['new']);
 const damaged=structuredClone(templates);damaged[1].minutes=99;assert.throws(()=>assertFullStarters(damaged,templates,['new']),{code:'ERR_ASSERTION'});
 console.log('PASS upgrade assertions reject old-price/new-norm mutations, missing/extra rows or keys, changed projects and divergent aliases');
}
async function main(){
 verifyUpgradeAssertions();
 const {codeCandidate}=await import('../sync/code-global-catalogs.generated.mjs');
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-sw-upgrade-')),old=path.join(dir,'old'),profile=path.join(dir,'profile');fs.mkdirSync(old);
 const archive=path.join(dir,'old.tar');
 await execFile('git',['archive','-o',archive,'2930e0d769d9576d387764af439eab7df9fd5636'],{cwd:root,timeout:30000});
 await execFile('tar',['-xf',archive,'-C',old],{timeout:30000});
 // The incremental worker reuses unchanged resources. Hold a file that is
 // provably DIFFERENT across the old and current release, so the slow-install
 // regression still exercises a real network download.
 assert.notEqual(fs.readFileSync(path.join(old,'index.html'),'utf8'),
   fs.readFileSync(path.join(root,'index.html'),'utf8'),
   'Slow-install fixture must target a changed manifest resource');
 const oldManifest=JSON.parse(fs.readFileSync(path.join(old,'offline-assets.js'),'utf8').match(/^self\.MEBLE_OFFLINE_ASSETS=(.*);$/m)[1]);
 const previous=new Map(oldManifest.files.map(file=>[file.path,file.sha256]));
 const candidate=require('./offline-assets').manifest();
 const candidatePaths=new Set(candidate.files.map(file=>'/'+file.path));
 const changed=candidate.files.filter(file=>previous.get(file.path)!==file.sha256).map(file=>'/'+file.path).sort();
 assert.ok(changed.includes('/index.html'));
 let deployment=old,one,stopped=false,heldAsset=false,releasedAsset=false,failDownload=true,failedDownloads=0;
 const downloaded=[],timers=new Set();
 let inFlight=0,peak=0;
 function later(fn,ms){const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);}
 const server=http.createServer((req,res)=>{try{const pathname=new URL(req.url,'http://127.0.0.1').pathname,file=path.resolve(deployment,'.'+pathname);if(!file.startsWith(deployment+path.sep))throw Error();const data=fs.readFileSync(file);
  const respond=()=>{res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'image/jpeg','cache-control':'no-store'});res.end(data);};
  // Real SW install fetch, not a page timer or mocked registration. Exceed the
  // former shared deadline while the same old dirty application stays open.
  if(deployment===root&&req.headers['sec-fetch-dest']==='empty'&&candidatePaths.has(pathname)){
   if(failDownload){
    if(pathname==='/index.html'){
     failedDownloads++;
     later(()=>{res.writeHead(503,{'cache-control':'no-store'});res.end('synthetic unavailable asset');},300);
    }else respond();
    return;
   }
   downloaded.push(pathname);peak=Math.max(peak,++inFlight);
   res.once('close',()=>inFlight--);
   if(!heldAsset&&pathname==='/index.html'){
    heldAsset=true;console.log('START real Chromium: hold one changed manifest download for 32s');
    later(()=>{releasedAsset=true;respond();},32000);
   }else later(respond,50);
  }else respond();
 }catch(_){res.writeHead(404);res.end();}});
 try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 one=await browser(profile,base+'/index.html',{inject:true});await one.until('document.body.dataset.authState==="unauthenticated"');await one.tap('auth-google');await one.until('document.body.dataset.businessState==="ready"');
 await one.tap('main-trust-phone');await one.until('document.getElementById("main-trust-phone").checked&&!document.getElementById("main-trust-phone").disabled');await one.until('__AUTH_INPUT_DIAGNOSTICS__().mode==="trusted"&&__FC_MAIN_ACCESS__.isValid()');
 // Real private legacy material belongs to the protected preimage, including legal zero.
 await one.evaluate(`(()=>{const fc=window.FC,rows=fc.catalogStore.getSheetMaterials();rows.push({id:'synthetic-private-pcv',materialType:'obrzeże',manufacturer:'Synthetic owner',symbol:'OWN-PCV',name:'Private PCV zero',price:0,priceUnit:'mb',hasGrain:false,starterPrice:false,priceUserEditedAt:'2026-11-01T00:00:00.000Z',note:'PRIVATE LEGACY MUST REMAIN EXACT'});fc.catalogStore.savePriceList('materials',rows);return true;})()`);
 // Complete the old deployment's ordinary startup validators before recording RAW.
 await one.reload();await one.until('document.body.dataset.businessState==="ready"');

 const privateBefore=await one.evaluate('JSON.parse(localStorage.getItem("fc_sheet_materials_v1")).find(row=>row.id==="synthetic-private-pcv")');
 assert.deepEqual(await one.evaluate('Object.keys(JSON.parse(localStorage.getItem("fc_materials_v1")).find(row=>row.id==="synthetic-private-pcv"))'),['id','materialType','manufacturer','symbol','name','price','hasGrain']);
 assert.equal(privateBefore.price,0);assert.equal(privateBefore.priceUserEditedAt,'2026-11-01T00:00:00.000Z');assert.equal(privateBefore.note,'PRIVATE LEGACY MUST REMAIN EXACT');
 const fixtures=require('./project-navigation-blockers-smoke'),fixture=fixtures.fixture();fixtures.offers(fixture);const source=fixture.seed();
 const seed=Object.fromEntries(['fc_investors_v1','fc_projects_v1','fc_quote_snapshots_v1'].map(key=>[key,source[key]]));seed.fc_quote_offer_drafts_v1=JSON.stringify([{projectId:'P',investorId:'K',syntheticPrice:12.125}]);
 await one.evaluate(`(()=>{for(const [k,v]of Object.entries(${JSON.stringify(seed)}))localStorage.setItem(k,v);const fc=window.FC;fc.projectStore.setCurrentProjectId('P');projectData=fc.project.load();window.projectData=projectData;fc.views.openInvestorsList();})()`);

 const raw=()=>one.evaluate('JSON.stringify(Object.keys(localStorage).filter(k=>k.startsWith("fc_")&&!["fc_ui_v1","fc_current_investor_v1","fc_current_project_id_v1"].includes(k)).sort().map(k=>[k,localStorage.getItem(k)]))');let before;
 assert.equal(await one.evaluate('!!document.querySelector("[data-action=remove-investor-from-list]")'),false);
 const cache=await one.evaluate('window.FC.offlineShell.prepare().then(r=>r.version)');
 // An old client cannot acquire new UI by an import or forced takeover.
 await one.evaluate(`(async()=>{const fc=window.FC,inv=fc.investors.readAll()[0];if(await fc.actions.dispatch('open-investor',{element:{getAttribute:()=>inv.id}})!==true)throw Error('Open refused');fc.investorEditorState.enter(inv);fc.investorEditorState.setField('name','EXACT UNSAVED RAM');fc.investorUI.render();})()`);
 await one.evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('synthetic-safe-sw-data',1);r.onupgradeneeded=()=>r.result.createObjectStore('rows');r.onerror=reject;r.onsuccess=()=>{const db=r.result,tx=db.transaction('rows','readwrite',{durability:'strict'});tx.objectStore('rows').put('EXACT-IDB-12.125','saved');tx.oncomplete=()=>{db.close();resolve(true);};tx.onabort=reject;};})`);
 before=await raw(); // Baseline after intentional fixture activation/edit setup, before deployment.
 deployment=root;
 const endpoint=await one.evaluate('location.origin');assert.equal(endpoint,base);
 // Public recovery URL is not in the old worker cache allowlist. Same browser
 // process via CDP Target: the old dirty page stays open throughout detection.
 const target=await one.send('Target.createTarget',{url:'about:blank'});
 // Inspect the new bootstrap target in the same owned process.
 const targets=await(await fetch('http://127.0.0.1:'+new URL(one.endpoint).port+'/json/list')).json();
 const ws=new WebSocket(targets.find(t=>t.id===target.targetId).webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let serial=0;const pending=new Map(),resources=[];
 ws.onmessage=({data})=>{const m=JSON.parse(data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Network.requestWillBeSent')resources.push({type:m.params.type,initiator:m.params.initiator.type});};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Update test CDP timeout: '+method));},30000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable');await send('Network.enable');await send('Page.navigate',{url:base+'/sw-update.html'});
 const statusOf=()=>evaluate('(()=>{const s=document.getElementById("sw-update-status");return s?{...s.dataset}:null;})()');
 let failure;
 for(let i=0;i<400;i++){
  const status=await statusOf();
  if(status&&status.state!=='checking'){failure=status;break;}
  await new Promise(r=>setTimeout(r,50));
 }
 assert.equal(failure?.state,'unconfirmed',JSON.stringify(failure));
 assert.equal(failure.reason,'INSTALL_REDUNDANT');
 assert.ok(failedDownloads>0,'Chromium must hit the actual failed asset request');
 assert.equal(await raw(),before);
 assert.equal(await one.evaluate('window.FC.investorEditorState.state.draft.name'),'EXACT UNSAVED RAM');
 const cacheNames=await evaluate('caches.keys()');
 assert.ok(cacheNames.includes('meble-static-'+cache));
 assert.ok(!cacheNames.includes('meble-static-'+candidate.version),'Failed candidate must be removed');
 console.log('PASS real Chromium: asset HTTP 503 refused the candidate, preserved the old cache, data and unsaved form');
 failDownload=false;
 // A deliberate retry starts the successful installation on the same origin and profile.
 await evaluate('document.getElementById("sw-update-check").click()');
 const started=Date.now();let longInstallSeen=false,progressSeen=false;
 while(Date.now()-started<90000){
  const status=await statusOf();
  if(await evaluate('(()=>{const b=document.getElementById("sw-update-bar");return b?.value>0&&b.value<b.max;})()'))progressSeen=true;
  if(status&&status.state!=='checking'){assert.equal(status.state,'ready',JSON.stringify(status));break;}
  if(Date.now()-started>30000&&heldAsset&&!releasedAsset){
   assert.equal(status.state,'checking');assert.equal(status.stage,'installation');longInstallSeen=true;
  }
  await new Promise(r=>setTimeout(r,50));
 }
 assert.equal(longInstallSeen,true,'Real installation >30s must remain checking, without false FAIL');assert.equal(releasedAsset,true);
 assert.equal(progressSeen,true,'Page must display intermediate measured progress');
 assert.deepEqual(downloaded.sort(),changed,'Only manifest paths with changed or missing SHA-256 may be fetched once');
 assert.ok(peak>1&&peak<=4,'Expected 2–4 simultaneous downloads, saw '+peak);
 const totals=await evaluate('document.getElementById("sw-update-counts").textContent');
 assert.ok(totals.includes('Pobrane: '+changed.length+' · Z cache: '+(candidate.files.length-changed.length)),totals);
 assert.ok(totals.endsWith('Zweryfikowane: '+candidate.files.length),totals);
 console.log('PASS real Chromium: '+changed.length+' downloads, '+(candidate.files.length-changed.length)+' verified cache reuses, peak '+peak);

 assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.state'),'ready');
 assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.reason'),'NONE');
 console.log('PASS real Chromium: delayed installation >30s then complete active/waiting ACK');
 assert.equal(await evaluate('document.getElementById("sw-update-active-version").textContent'),cache);
 assert.equal(await evaluate('document.getElementById("sw-update-waiting-version").textContent'),require('./offline-assets').manifest().version);
 assert.equal(await evaluate('document.getElementById("sw-update-help").hidden'),false);
 assert.equal(resources.filter(r=>r.type==='Stylesheet'||r.type==='Script'&&r.initiator==='parser').length,0,'Network page must not depend on a script or style from the old cache');
 assert.equal(await one.evaluate('window.FC.investorEditorState.state.draft.name'),'EXACT UNSAVED RAM');assert.equal(await raw(),before);
 assert.equal(await one.evaluate('window.FC.offlineShell.prepare().then(r=>r.version)'),cache);
 await send('Page.bringToFront');await send('Emulation.setTouchEmulationEnabled',{enabled:true});
 for(const width of [320,360,412]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:852,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,'No update-page overflow at '+width);
  assert.equal(await evaluate('document.getElementById("sw-update-check").getBoundingClientRect().height>=44'),true);
 }
 const point=await evaluate('(()=>{const r=document.getElementById("sw-update-check").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 for(let i=0;i<200&&!(await evaluate('!document.getElementById("sw-update-check").disabled'));i++)await new Promise(r=>setTimeout(r,50));
 assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.state'),'ready');
 assert.equal(await evaluate('document.getElementById("sw-update-help").hidden'),false);
 // A loaded network page also gives a truthful result after actual loss of
 // connectivity. Rechecks are explicit native gestures, never a browser retry.
 async function recheck(){
  const p=await evaluate('(()=>{const r=document.getElementById("sw-update-check").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  for(let i=0;i<200&&!(await evaluate('!document.getElementById("sw-update-check").disabled'));i++)await new Promise(r=>setTimeout(r,50));
 }
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await send('Network.overrideNetworkState',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 assert.equal(await evaluate('navigator.onLine'),false);await recheck();assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.state'),'offline');
 assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.reason'),'OFFLINE');
 await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await send('Network.overrideNetworkState',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await recheck();assert.equal(await evaluate('document.getElementById("sw-update-status").dataset.state'),'ready');
 ws.close();
 await one.send('Target.closeTarget',{targetId:target.targetId});
 await one.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update())');
 assert.equal(await one.evaluate('window.FC.investorEditorState.state.draft.name'),'EXACT UNSAVED RAM');
 // Explicit safe user decision: the synthetic draft is accounted for; close
 // all app tabs. No product code reloads, closes or writes this draft.
 assert.equal(await one.evaluate('window.FC.investorEditorState.hasUiLock()'),true);
 await one.evaluate('window.FC.investorEditorState.exit(window.FC.investors.readAll()[0]);window.FC.views.openInvestorsList();true');
 const trustBeforeClose=await one.evaluate('('+require('./helpers/trusted-cold-start').inspectTrustStorage.toString()+')()');
 assert.equal(trustBeforeClose.fence,'active','Old synthetic trusted profile must still have its fence before orderly close');
 assert.equal(trustBeforeClose.fenceMatches,true,'Signed trust must match its fence before closing the old document');
 await one.close();one=null;await new Promise(r=>server.close(r));stopped=true;
 one=await browser(profile,base+'/index.html',{offline:true});try{await one.until('document.body.dataset.businessState==="ready"');}catch(error){console.log('DIAG cold trust '+JSON.stringify(await one.evaluate('('+require('./helpers/trusted-cold-start').inspectTrustStorage.toString()+')()')));throw error;}
 await one.evaluate('window.FC.views.openInvestorsList();true');assert.equal(await one.evaluate('!!document.querySelector("[data-action=remove-investor-from-list]")'),true);
 const missing=codeCandidate.model.labor.filter(row=>!JSON.parse(Object.fromEntries(JSON.parse(before)).fc_quote_rates_v1).some(old=>old.id===row.id));
 assert.equal(missing.length,72,'Legacy update adds 65 existing plus 7 approved opening/channel norms');
 for(const id of ['labor_channel_install','labor_channel_workshop','labor_handle_layout','labor_handle_install','pdf_tipon_drill','pdf_tipon_insert','pdf_tipon_plate'])assert.ok(missing.some(row=>row.id===id),'Missing approved new norm '+id);
 // This fixture deliberately exercises the legacy validator (LOCAL-FIRST
 // deployment is isolated by trusted-session-browser). Its persisted service
 // compatibility alias has four fields; the canonical catalog and its cache
 // must retain the full norms. These two persisted formats are not interchangeable.
 const originalCatalog=JSON.parse(Object.fromEntries(JSON.parse(before)).fc_quote_rates_v1);
 const factoryLabor=require('./helpers/code-global-catalogs').buildCodeCatalogs().context.FC.laborCatalog;
 const corrected=factoryLabor.applyApprovedFactoryRules(originalCatalog);
 const corrections=Object.fromEntries(corrected.filter((row,i)=>JSON.stringify(row)!==JSON.stringify(originalCatalog[i])).map(row=>[row.id,structuredClone(factoryLabor.normalizeDefinition(row))]));
 assert.ok(Object.keys(corrections).every(id=>['labor_carrying_cabinet','labor_carrying_disassembly','transport_distance_km','labor_daily_break'].includes(id)));
 const permittedFields=new Set(['rateType','note','minimumLevels','liftLevels','disassemblyWeightKg','breakAfterHours','workdayHours','unitPriceSource']);
 for(const old of originalCatalog){const next=corrections[old.id];if(next)for(const key of Object.keys(old))if(!permittedFields.has(key))assert.deepEqual(next[key],old[key],'Factory upgrade must preserve '+old.id+'/'+key);}
 assertStarterAppend(before,await raw(),codeCandidate.model.labor,corrections,expectedPricingUpgrade(before,codeCandidate.model));
 assertFullStarters(await one.evaluate('window.FC.catalogStore.getQuoteRates()'),codeCandidate.model.labor,missing.map(row=>row.id));
 assert.notEqual(await one.evaluate('window.FC.offlineShell.prepare().then(r=>r.version)'),cache);
 assert.equal(await one.evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('synthetic-safe-sw-data',1);r.onerror=reject;r.onsuccess=()=>{const db=r.result,tx=db.transaction('rows'),q=tx.objectStore('rows').get('saved');tx.oncomplete=()=>{db.close();resolve(q.result);};tx.onabort=reject;};})`),'EXACT-IDB-12.125');

 await one.reload();await one.until('document.body.dataset.businessState==="ready"');assertStarterAppend(before,await raw(),codeCandidate.model.labor,corrections,expectedPricingUpgrade(before,codeCandidate.model));
 console.log('PASS real old-SW → independent network page/active+waiting hashes/native retry/320,360,412px → dirty RAM/multiple clients protected → natural activation/new offline shell/Delete/exact original RAW+IDB and precisely verified new factory norms');
 }finally{for(const timer of timers)clearTimeout(timer);await one?.close();if(!stopped){server.closeAllConnections();await new Promise(r=>server.close(r));}fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
