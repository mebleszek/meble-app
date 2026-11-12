'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {existingImage,clone}=require('./helpers/global-diagnostics-fixture'),{world}=require('./trusted-main-login-smoke');
const tests=[],test=(name,fn)=>tests.push([name,fn]);
async function until(fn){const deadline=Date.now()+3000;while(Date.now()<deadline){if(fn())return;await new Promise(r=>setTimeout(r,1));}assert.fail('Startup diagnostic did not settle');}
async function blockedLogin(unavailable=false,startupCode=null){
 const r=await existingImage(),{digest,json}=await import('../sync/local-first-values.mjs'),reader=await import('../sync/local-first-global-diagnostics.mjs');
 r.receipt.ownerUid='owner';r.control.binding.ownerUid='owner';
 const v=JSON.parse(r.rows.get('fc_materials_v1'));v[0].price+=12.125;r.rows.set('fc_materials_v1',JSON.stringify(v));
 const source=Object.fromEntries([...r.rows].filter(([k])=>k!=='meble_application_authority_v1'));
 r.control.source.rows=clone(source);r.control.source.hash=await digest(source);r.receipt.sourceHash=r.control.source.hash;
 r.control.application.rows=clone(source);r.control.application.hash=await digest(json(source));r.rows.set('meble_application_authority_v1',JSON.stringify(r.receipt));
 const before={raw:[...r.rows],control:clone(r.control),queue:clone(r.queue)};let api,starts=0;
 const d=world({},null,{beforeMain(w){
  w.location.hostname='localhost';const profileDB=w.indexedDB;
  w.indexedDB={...r.w.indexedDB,open(name,version){return name===r.args.name?r.w.indexedDB.open(name,version):profileDB.open(name,version);}};w.FC.globalDataContract=r.c;
  new Function('window',fs.readFileSync('js/app/cloud/global-data-diagnostics.js','utf8'))(w);
  const modules={'./global-data-contract.js':{},'./global-data-diagnostics.js':{},'./cloud-pilot-contract.js':{},'./firebase-global-transport.js':{},
   '../../../sync/application-boot.mjs':{prepareApplicationBoot:async()=>({readNative:r.args.readNative})},
   '../../../sync/local-first-global-diagnostics.mjs':unavailable?{collectGlobalDiagnostics:async()=>{throw Error('PRIVATE_EXCEPTION_TOKEN');}}:reader,
   '../../../sync/application-runtime.mjs':{startApplicationRuntime:async({onStage})=>{starts++;onStage('initial-global-revision');if(startupCode)throw Object.assign(Error('PRIVATE_FAILURE'),{code:startupCode});r.c.capture(r.storage,Object.keys(r.c.sources));}}};
  const source=fs.readFileSync('js/app/cloud/application-bootstrap.js','utf8').replace(/\bimport\(/g,'loadModule(');
  new Function('window','document','localStorage','location','navigator','loadModule',source)(w,w.document,w.localStorage,w.location,w.navigator,async path=>{assert.ok(path in modules,path);return modules[path];});
  api=w.FC.applicationStartup;api.configureEmulator({name:r.args.name,connections:async()=>({})});
 }});
 return {...r,d,api,before,starts:()=>starts};
}
test('blocked main-login exposes all domains after real capture failure; original error/fatal gate and source/image/queue are unchanged',async()=>{
 const r=await blockedLogin();
 try{
  await until(()=>r.d.nodes['auth-google']?.disabled===false);r.d.input('click','auth-google');
  try{await until(()=>r.d.nodes['auth-error']?.textContent?.includes('DANE GLOBALNE'));}catch(_){assert.fail('Startup result: '+JSON.stringify({diagnostic:r.api.diagnostics(),state:r.d.w.document.body.dataset,error:r.d.nodes['auth-error']?.textContent}));}
  const report=r.api.diagnostics(),text=r.d.nodes['auth-error'].textContent;
  assert.deepEqual(report.firstError,{stage:'initial-global-revision',code:'GLOBAL_ALIAS_CONFLICT'});assert.equal(report.globalConsistency.status,'READ_ONLY');
  assert.equal(report.globalConsistency.originals.domains.length,14);assert.equal(report.globalConsistency.localFirst.domains.length,14);
  for(const domain of Object.keys(r.c.sources))assert.ok(text.includes(domain+' ['),domain);
  assert.equal(r.d.ready(),false);assert.equal(r.starts(),1);assert.equal(r.d.w.__FC_MAIN_ACCESS__.isValid(),false);
  assert.doesNotMatch(text,/PRIVATE|Synthetic|private-owner|private-device|private-instance|12\.125/);
  r.d.input('click','auth-google');await until(()=>r.d.nodes['auth-error'].textContent.includes('AUTH_RELOAD_REQUIRED'));
  assert.equal(r.starts(),1);assert.deepEqual(r.api.diagnostics().firstError,report.firstError);
  assert.deepEqual([...r.rows],r.before.raw);assert.deepEqual(r.control,r.before.control);assert.deepEqual(r.queue,r.before.queue);assert.deepEqual(r.calls,[]);
  const beforeReads=r.trace.length;const denied=await r.api.inspectGlobalConsistency();assert.equal(denied.code,'DIAG_AUTH_BLOCKED');assert.equal(r.trace.length,beforeReads);
 }finally{r.d.close();}
});
test('diagnostic failure is anonymous BLOCKED and cannot replace the original startup refusal or grant login',async()=>{
 const r=await blockedLogin(true);
 try{
  await until(()=>r.d.nodes['auth-google']?.disabled===false);r.d.input('click','auth-google');await until(()=>r.d.nodes['auth-error']?.textContent?.includes('GLOBAL_ALIAS_CONFLICT'));
  assert.equal(r.api.diagnostics().globalConsistency.code,'DIAG_READ_BLOCKED');assert.equal(r.api.diagnostics().firstError.code,'GLOBAL_ALIAS_CONFLICT');assert.equal(r.d.ready(),false);assert.equal(r.starts(),1);
  assert.doesNotMatch(r.d.nodes['auth-error'].textContent,/PRIVATE_EXCEPTION_TOKEN/);assert.deepEqual([...r.rows],r.before.raw);
 }finally{r.d.close();}
});
test('an unrecognized global-stage failure still observes all domains without echoing its exception or changing fatal refusal',async()=>{
 const r=await blockedLogin(false,'PRIVATE_UNKNOWN_CODE');
 try{
  await until(()=>r.d.nodes['auth-google']?.disabled===false);r.d.input('click','auth-google');await until(()=>r.d.nodes['auth-error']?.textContent?.includes('DANE GLOBALNE'));
  assert.equal(r.api.diagnostics().firstError.code,'UNRECOGNIZED_ERROR');assert.equal(r.api.diagnostics().globalConsistency.originals.domains.length,14);assert.equal(r.d.ready(),false);assert.equal(r.starts(),1);assert.doesNotMatch(r.d.nodes['auth-error'].textContent,/PRIVATE/);
 }finally{r.d.close();}
});
test('existing session modal/copy includes a closed anonymous snapshot; loss of access still refuses copy and further reads',async()=>{
 const r=await existingImage(),reader=await import('../sync/local-first-global-diagnostics.mjs'),snapshot=await reader.collectGlobalDiagnostics(r.args);
 const p=require('./project-navigation-blockers-smoke').fixture(undefined,{timers:{setTimeout:()=>0,clearTimeout:()=>{}}});assert.equal(await p.open(),true);
 let valid=true,calls=0,modal,copied;const w=p.s;w.location={origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html'};
 Object.defineProperty(w,'__FC_MAIN_ACCESS__',{value:Object.freeze({isValid:()=>valid}),writable:false,configurable:false});
 w.FC.globalDataDiagnostics=r.data;w.FC.applicationStartup={async inspectGlobalConsistency(){calls++;assert.ok(valid);return snapshot;},diagnostics:()=>({status:'READ_ONLY',stage:'ready',code:null,transferStatus:'cycle-confirmed',globalConsistency:snapshot})};
 w.FC.infoBox={open:value=>{modal=value;}};w.FC.sessionDiagnosticsReadonly=require('../js/app/ui/session-diagnostics-readonly');
 new Function('window','navigator',fs.readFileSync('js/app/ui/session-diagnostics.js','utf8'))(w,{clipboard:{writeText:async text=>{copied=text;}}});
 const tiles=new Map();
 const h=(_tag,attrs={},children=[])=>{
  const node={children:[...children],events:{},setAttribute(){},appendChild(child){this.children.push(child);},addEventListener(type,fn){this.events[type]=fn;}};
  if(attrs['data-settings-section'])tiles.set(attrs['data-settings-section'],node);
  return node;
 };
 let settingsClosed=false;
 w.FC.dataSettingsDom={h};w.FC.panelBox={close(){settingsClosed=true;}};
 new Function('window','FC',fs.readFileSync('js/app/ui/data-settings-menu-view.js','utf8'))(w,w.FC);
 w.FC.dataSettingsMenuView.render(h('div'),()=>assert.fail('The diagnostic should open the report directly'));
 const before=p.seed();await tiles.get('sessionDiagnostics').events.click();
 assert.equal(settingsClosed,true);assert.equal(calls,1);assert.match(modal.message,/Istniejący obraz LOCAL-FIRST/);
 await modal.secondaryAction.run({button:{},body:{}});assert.equal(JSON.parse(copied).localFirst.globalConsistency.originals.domains.length,14);
 assert.match(snapshot.catalogDirectoryHash,/^[a-f0-9]{64}$/);
 assert.equal(JSON.parse(copied).localFirst.globalConsistency.catalogDirectoryHash,snapshot.catalogDirectoryHash);
 assert.deepEqual(JSON.parse(copied).localFirst.globalConsistency.catalogDomains,JSON.parse(JSON.stringify(snapshot.catalogDomains)));
 assert.doesNotMatch(copied,/Synthetic|private-owner|private-device|private-instance/);assert.deepEqual(p.seed(),before);
 valid=false;const body={},button={};await modal.secondaryAction.run({button,body});assert.equal(button.disabled,true);assert.match(body.textContent,/AUTH_DENIED/);
 await w.FC.sessionDiagnostics.open();assert.equal(calls,1,'No diagnostic collection after access was revoked');assert.deepEqual(p.seed(),before);
});
test('a stalled diagnostic import times out without a late data read or replacement of the first startup error',async()=>{
 const {fixture}=require('./helpers/global-diagnostics-fixture'),r=fixture();let expire,finishImport,reads=0,readerImports=0,cleared=false;
 const w={FC:{globalDataContract:r.c},location:{hostname:'localhost'},localStorage:{getItem:()=>null},document:{baseURI:'http://localhost/',addEventListener(){}},addEventListener(){}};
 const load=async path=>{
  if(path==='./global-data-contract.js')return {};
  if(path==='../../../sync/application-boot.mjs')return {prepareApplicationBoot:async()=>({readNative(){reads++;assert.fail('Late data read');}})};
  if(path==='./global-data-diagnostics.js')return new Promise(resolve=>{finishImport=resolve;});
  readerImports++;assert.fail('Expired import must not load the reader');
 };
 const source=fs.readFileSync('js/app/cloud/application-bootstrap.js','utf8').replace(/\bimport\(/g,'loadModule(');
 new Function('window','document','localStorage','location','navigator','loadModule','setTimeout','clearTimeout',source)(w,w.document,w.localStorage,w.location,{},load,(fn,ms)=>{assert.equal(ms,12000);expire=fn;return 1;},()=>{cleared=true;});
 const api=w.FC.applicationStartup;api.configureEmulator({name:'meble-lf-test-import-timeout'});await api.beforeBusiness({ownerUid:'private-owner'});
 api.recordFailure({code:'GLOBAL_ALIAS_CONFLICT',path:'materials'},'initial-global-revision');const first=api.diagnostics().firstError;
 const pending=api.inspectGlobalConsistency();assert.equal(typeof finishImport,'function');expire();assert.equal((await pending).code,'DIAG_TIMEOUT');assert.equal(cleared,true);
 finishImport({});await new Promise(resolve=>setImmediate(resolve));assert.equal(api.diagnostics().globalConsistency.code,'DIAG_TIMEOUT');assert.deepEqual(api.diagnostics().firstError,first);assert.equal(reads,0);assert.equal(readerImports,0);
});
test('new observation paths are in mandatory CI and old contracts remain registered',()=>{
 const ci=require('./ci-smoke-shards'),all=ci.plan(ci.inventory('tools',require('./cloud-ci-context').historicalSmoke)).flat();
 for(const name of ['global-consistency-startup-smoke.js','global-consistency-browser-smoke.js','global-consistency-diagnostics-smoke.js','global-data-write-safety-smoke.js','cloud-global-data-smoke.js'])assert.equal(all.filter(x=>x===name).length,1);
});
(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log(`Global consistency startup/session: ${tests.length}/${tests.length} PASS`);})().catch(error=>{console.error(error.stack);process.exitCode=1;});
