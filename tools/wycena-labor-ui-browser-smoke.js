#!/usr/bin/env node
'use strict';
// Actual component DOM/CSS in disposable Chromium profiles. No login, Firebase or owner storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const browser=process.env.CHROMIUM_PATH||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>fs.existsSync(p));
assert.ok(browser,'Chromium/Chrome is required for the WYCENA-LABOR UI regression');
const css=fs.readdirSync(path.join(root,'css')).filter(name=>name.endsWith('.css')).map(name=>fs.readFileSync(path.join(root,'css',name),'utf8')).join('\n');
const js=['pricing/labor-catalog-definitions','pricing/labor-catalog','cabinet/cabinet-modal-labor','material/price-modal-list'].map(name=>fs.readFileSync(path.join(root,'js/app',name+'.js'),'utf8')).join('\n');
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
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meble-labor-ui-'));
try{
  const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="component"></div><div id="priceListItems"></div><pre id="result"></pre><script>window.FC={infoBox:{open:value=>window.helpPayload=value},priceModalContext:{byId:id=>document.getElementById(id),currentListKind:()=>"quoteRates",filteredPriceList:()=>[{id:"synthetic-help",name:"Synthetic norm",price:0,note:"5 min przygotowania"}],openPriceItemModal:()=>{}}};\n'+js+'\ntry{('+check.toString()+')();}catch(error){document.getElementById("result").textContent="FAIL: "+error.stack;}</script>';
  const file=path.join(dir,'fixture.html');fs.writeFileSync(file,html);
  for(const[profile,width,height,ua]of [['Android-size',393,851,'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'],['Windows-size',1280,900,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36']]){
    if(process.argv.includes('--mobile-only')&&width>400)continue;
    for(const name of [profile,'cache','config'])fs.mkdirSync(path.join(dir,name),{recursive:true});
    let output;
    const localFlags=process.env.MEBLE_CHROMIUM_SINGLE_PROCESS==='1'?['--no-zygote','--single-process']:[];
    try{output=execFileSync(browser,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-breakpad','--no-first-run',...localFlags,'--user-data-dir='+path.join(dir,profile),'--window-size='+width+','+height,'--user-agent='+ua,'--dump-dom','--virtual-time-budget=2000','file://'+file],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe'],env:{...process.env,XDG_CACHE_HOME:path.join(dir,'cache'),XDG_CONFIG_HOME:path.join(dir,'config')}});}
    catch(error){throw Error('Chromium '+(error.code||error.status)+': '+String(error.stderr||'').slice(-1000));}
    const result=output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];assert.equal(result,'PASS',profile+': '+result);console.log('PASS real Chromium components: '+profile);
  }
}finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
