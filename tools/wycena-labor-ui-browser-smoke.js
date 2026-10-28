#!/usr/bin/env node
'use strict';
// Actual component DOM/CSS in disposable Chromium profiles. No login, Firebase or owner storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const {dumpDom}=require('./helpers/chromium-runtime');
const css=fs.readdirSync(path.join(root,'css')).filter(name=>name.endsWith('.css')).map(name=>fs.readFileSync(path.join(root,'css',name),'utf8')).join('\n');
const js=['pricing/labor-catalog-definitions','pricing/labor-catalog','cabinet/cabinet-modal-labor','material/price-modal-list','quote/quote-calculation-register','wycena/wycena-summary-details-modal','ui/session-diagnostics-readonly','ui/session-diagnostics'].map(name=>fs.readFileSync(path.join(root,'js/app',name+'.js'),'utf8')).join('\n');
function check(){
  const assert=(yes,message)=>{if(!yes)throw Error(message);};
  const FC=window.FC,draft={id:'synthetic',type:'stojąca',subType:'standardowa',details:{shelves:4}};
  const host=document.getElementById('component'),render=()=>FC.cabinetModalLabor.renderLaborSection(host,draft,render);
  render();
  const select=(id,value)=>{const el=document.getElementById(id);assert(el,id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
  for(const id of ['additionalLegs','shelfType','hingeDrilling']){
    const el=document.getElementById('cmLabor_'+id);const b=el.getBoundingClientRect();
    assert(b.width>0&&b.left>=0&&b.right<=innerWidth+1,'Control overflows viewport: '+id);
    assert(el.labels?.length>0,'Missing label: '+id);
  }
  assert(document.getElementById('cmLabor_shelfType').options.length===2,'Exactly two shelf types');
  select('cmLabor_additionalLegs','2');select('cmLabor_shelfType','fixed');select('cmLabor_hingeDrilling','predrilled');
  assert(draft.details.additionalLegs===2&&draft.details.shelfType==='fixed'&&draft.details.hingeDrilling==='predrilled','Draft controls survive rerender');
  draft.type='wisząca';render();select('cmLabor_hangerCount','0');assert(draft.details.hangerCount===0,'Explicit zero hanger count');
  select('cmLabor_hangerCount','');assert(!Object.hasOwn(draft.details,'hangerCount'),'Blank restores automatic hangers');
  FC.priceModalContext.renderPriceList();
  const help=[...document.querySelectorAll('#priceListItems button')].find(b=>b.textContent==='?');
  assert(help&&help.getAttribute('aria-label'),'Accessible norm help');help.click();assert(window.helpPayload.message.includes('5 min'),'Help contains approved preparation');
  assert(!document.querySelector('#priceListItems input'),'No arbitrary new duration input');
  document.getElementById('result').textContent='PASS';
}
function checkQuotaAndEquations(infoBoxSource,diagnosticsOnly){
  const assert=(yes,message)=>{if(!yes)throw Error(message);};
  const FC=window.FC;
  (0,eval)(infoBoxSource);
  const storage=window.localStorage;
  storage.setItem('fc_projects_v1',JSON.stringify([{id:'PRIVATE_SENTINEL',investorId:'PRIVATE_SENTINEL_OWNER',projectData:{}}]));
  storage.setItem('fc_current_project_id_v1','PRIVATE_SENTINEL');storage.setItem('fc_current_investor_v1','PRIVATE_SENTINEL_OWNER');
  window.uiState={roomType:null,currentInvestorId:'PRIVATE_SENTINEL_OWNER'};storage.setItem('fc_ui_v1',JSON.stringify(window.uiState));
  storage.setItem('fc_quote_snapshots_v1','PRIVATE_SENTINEL_HISTORY');storage.setItem('fc_project_backup_v1','PRIVATE_SENTINEL_BACKUP');
  storage.setItem('fc_data_backups_v1','B'.repeat(100000));storage.setItem('fc_rozrys_plan_cache_v2','C'.repeat(80000));
  storage.setItem('PRIVATE_SENTINEL_DYNAMIC','D'.repeat(90000));
  FC.session={active:false,durable:false,snapshot:null,lastError:{code:'SESSION_QUOTA_EXCEEDED'}};
  let valid=true,reads=0,writes=0;
  const gate=Object.freeze({isValid:()=>valid});
  Object.defineProperty(window,'__FC_MAIN_ACCESS__',{value:gate,writable:false,configurable:false});
  // File-based component fixture: provide the collector's authorized-page
  // interface. This is not a production-origin or Google Auth integration test.
  const facade={location:{origin:'https://mebleszek.github.io',pathname:'/meble-app/index.html'},localStorage:storage,FC,uiState:window.uiState};
  Object.defineProperty(facade,'__FC_MAIN_ACCESS__',{value:gate,writable:false,configurable:false});
  const collect=FC.sessionDiagnosticsReadonly;FC.sessionDiagnosticsReadonly=(_window,options)=>collect(facade,options);
  const raw=()=>JSON.stringify(Object.keys(storage).sort().map(key=>[key,storage.getItem(key)])),before=raw();
  const get=Storage.prototype.getItem;Storage.prototype.getItem=function(key){reads++;return get.call(this,key);};
  for(const method of ['setItem','removeItem','clear'])Storage.prototype[method]=()=>{writes++;throw Error('Diagnostic write forbidden');};
  FC.sessionDiagnostics.open();
  const report=document.querySelector('.info-box__body').textContent;
  assert(report.includes('SESSION_QUOTA_EXCEEDED')&&report.includes('Rozmiar tekstu UTF-16')&&report.includes('Historia ofert'),'Actual quota report renders footprint categories');
  assert(report.includes('NAJWIĘKSZE MAGAZYNY PAMIĘCI')&&report.includes('1. fc_data_backups_v1')&&report.includes('2. ANON_02')&&report.includes('Pomiar: KOMPLETNY'),'Actual modal shows known and anonymous ranked stores');
  assert(!report.includes('PRIVATE_SENTINEL')&&writes===0&&raw()===before,'Anonymous report must not expose or mutate native storage');
  const box=document.querySelector('.info-box').getBoundingClientRect();assert(box.left>=0&&box.right<=innerWidth+1&&box.top>=0&&box.bottom<=innerHeight+1,'Quota dialog fits viewport');
  const body=document.querySelector('.info-box__body');assert(body.scrollWidth<=body.clientWidth+1,'Long store names wrap within the phone dialog');
  let copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(value){copied=value;}}});
  const copyButton=[...document.querySelectorAll('.info-box button')].find(button=>button.textContent==='Kopiuj raport');
  copyButton.scrollIntoView();copyButton.click();const payload=JSON.parse(copied);
  assert(payload.storageSizes.complete&&payload.storageSizes.largest.key==='fc_data_backups_v1'&&payload.storageSizes.top[1].key==='ANON_02','Real copy button includes the full anonymous ranking');
  const copyRect=copyButton.getBoundingClientRect();assert(copyRect.top>=0&&copyRect.bottom<=innerHeight+1,'Copy control is reachable by scrolling on Android');
  assert(raw()===before&&writes===0&&!copied.includes('PRIVATE_SENTINEL'),'Copy never changes native storage or leaks dynamic IDs');
  FC.infoBox.close();reads=0;valid=false;FC.sessionDiagnostics.open();assert(reads===0&&document.querySelector('.info-box__body').textContent.includes('AUTH_DENIED'),'Revoked gate refuses before storage access');FC.infoBox.close();
  if(diagnosticsOnly)return;
  const component={name:'Synthetic packing',quantity:2,quantityMode:'linear',timeBlockHours:5/60,baseHours:10/60,hours:10/60,hourlyRate:150,multiplier:1,total:25,unitPrice:12.5};
  const register=FC.quoteCalculationRegister.buildRegister({labor:[{name:'Synthetic cabinet',details:[component]}],materials:[{qty:1.23456,unit:'m²',unitPrice:173.125,total:1.23456*173.125}]},{});
  const frozen=JSON.stringify(register);
  for(const section of ['labor','materials']){
    FC.wycenaSummaryDetailsModal.open({calculationRegister:register},section);
    const body=document.getElementById('quoteSummaryDetailsBody');
    assert(body.textContent.includes(section==='labor'?'2 × 5 min × 150 zł/h ÷ 60 = 25,00 zł':'1,23456 × 173,125 zł'),'Exact visible operands survive actual DOM rendering');
    for(const node of body.querySelectorAll('.quote-detail-line__fact-value')){const rect=node.getBoundingClientRect();assert(rect.left>=0&&rect.right<=innerWidth+1,'Equation wraps within viewport');}
    FC.wycenaSummaryDetailsModal.close();
  }
  assert(JSON.stringify(register)===frozen&&raw()===before&&writes===0,'Rendering preserves frozen amounts and all native RAW');
}
async function main(){
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-labor-ui-'));
try{
  const infoBoxSource=fs.readFileSync(path.join(root,'js/app/ui/info-box.js'),'utf8');
  const diagnosticsOnly=process.argv.includes('--diagnostics-only');
  const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="component"></div><div id="priceListItems"></div><pre id="result"></pre><script>window.FC={infoBox:{open:value=>window.helpPayload=value},priceModalContext:{byId:id=>document.getElementById(id),currentListKind:()=>"quoteRates",filteredPriceList:()=>[{id:"synthetic-help",name:"Synthetic norm",price:0,note:"5 min przygotowania"}],openPriceItemModal:()=>{}}};\n'+js+'\ntry{'+(diagnosticsOnly?'':'('+check.toString()+')();')+'('+checkQuotaAndEquations.toString()+')('+JSON.stringify(infoBoxSource)+','+diagnosticsOnly+');document.getElementById("result").textContent="PASS";}catch(error){document.getElementById("result").textContent="FAIL: "+error.stack;}</script>';
  const file=path.join(dir,'fixture.html');fs.writeFileSync(file,html);
  for(const[profile,width,height,ua]of [['Android-size',393,851,'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'],['Windows-size',1280,900,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36']]){
    if(process.argv.includes('--mobile-only')&&width>400)continue;
    for(const name of [profile,'cache','config'])fs.mkdirSync(path.join(dir,name),{recursive:true});
    let output;
    const localFlags=process.env.MEBLE_CHROMIUM_SINGLE_PROCESS==='1'?['--no-zygote','--single-process']:[];
    output=await dumpDom({profileDir:path.join(dir,profile),args:['--disable-gpu','--disable-breakpad',...localFlags,
      '--window-size='+width+','+height,'--user-agent='+ua,'--dump-dom','--virtual-time-budget=2000','file://'+file],timeoutMs:30000,maxBuffer:8*1024*1024});
    const result=output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];assert.equal(result,'PASS',profile+': '+result);console.log('PASS real Chromium components: '+profile);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});}

}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
