'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {files,source}=require('./service-order-integrity-smoke');
async function main(){
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Service integrity fixture</title><script>window.lfReady=true;</script>');});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'meble-service-integrity-'));let browser;const external=[];
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const {openBrowserDevice}=await import('./helpers/local-first-browser.mjs');browser=await openBrowserDevice({base},profile);
  browser.onEvent(e=>{if(e.method==='Network.requestWillBeSent'&&!e.params.request.url.startsWith(base+'/'))external.push(e.params.request.url);});await browser.send('Network.enable');
  const sources=files.map(source).concat(fs.readFileSync('js/app/ui/panel-box.js','utf8'));
  await browser.evaluate(`window.FC={utils:{uid:()=>crypto.randomUUID()},infoBox:{open:cfg=>(window.messages||=[]).push(cfg)}};${sources.join('\n')}`);
  const result=await browser.evaluate(`(${async function(){
   const check=(ok,message)=>{if(!ok)throw Error(message);},clone=x=>JSON.parse(JSON.stringify(x));
   const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
   const click=async el=>{check(!!el,'MISSING_BUTTON');el.click();await tick();};
   const button=(body,text)=>Array.from(body.querySelectorAll('button')).find(el=>el.textContent===text);
   const change=(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
   const key=FC.serviceOrderStore.ORDER_KEY;window.messages=[];FC.confirmBox={ask:async()=>true};
   const cutting={materialMode:'client',materialName:'Oak',parts:[{id:'part',name:'Front',qty:2,along:700,across:300,materialName:'Oak',thickness:18,hasGrain:true}]};
   const generated=FC.serviceCuttingRozrys.generatePlan(cutting);check(generated.ok&&generated.plan,'REAL_LAYOUT_REQUIRED');
   cutting.plan=clone(generated.savedPlan);cutting.generatedAt=123;
   FC.serviceOrderStore.upsert({id:'native',title:'Before',clientName:'Client',cutting,items:[{name:'Cut',qty:2,total:24,extra:'KEEP_ITEM'}],meta:{extra:'KEEP_META'},extra:'KEEP_ORDER'});
   FC.serviceOrderStore.upsert({id:'other',title:'Other'});
   const original=clone(FC.serviceOrderStore.getById('native'));const initialRaw=localStorage.getItem(key);
   const openBasic=()=>{FC.serviceOrders.openEditor('native');return document.querySelector('.panel-box-form');};
   let body=openBasic(),input=body.querySelector('input');change(input,'After');
   for(const confirm of [null,{ask:()=>{throw Error('CONFIRM');}},{ask:()=>Promise.reject(Error('CONFIRM'))},{ask:async()=>false}]){
    FC.confirmBox=confirm;for(const text of ['Zapisz','Usuń','Anuluj']){await click(button(body,text));check(input.isConnected,'FAIL_OPEN_BASIC_'+text);check(localStorage.getItem(key)===initialRaw,'UNCONFIRMED_WRITE');}
   }
   FC.confirmBox={ask:async()=>true};const write=FC.storage.setJSON;
   for(const deny of [()=>false,()=>{throw Error('STORAGE_DENIED');}]){
    FC.storage.setJSON=deny;await click(button(body,'Zapisz'));check(input.isConnected&&input.value==='After','FAILED_SAVE_LOST_FORM');
    await click(button(body,'Usuń'));check(input.isConnected,'FAILED_DELETE_CLOSED');check(localStorage.getItem(key)===initialRaw,'FAILED_WRITE_CHANGED_STORAGE');
    FC.confirmBox.ask=async()=>false;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();check(input.isConnected,'FAILED_SAVE_CLEARED_DIRTY');FC.confirmBox.ask=async()=>true;
   }
   FC.storage.setJSON=write;await click(button(body,'Zapisz'));check(!input.isConnected,'SUCCESS_SAVE_NOT_CLOSED');
   const edited=clone(FC.serviceOrderStore.getById('native'));check(JSON.stringify(edited)===JSON.stringify({...original,title:'After'}),'BASIC_EDIT_LOST_PAYLOAD');
   FC.serviceOrderDetail.open('native');body=document.querySelector('.panel-box-form');input=body.querySelector('[data-field="name"]');change(input,'Changed front');const savedRaw=localStorage.getItem(key);
   FC.storage.setJSON=()=>false;await click(button(body,'Zapisz'));check(input.isConnected&&input.value==='Changed front','DETAIL_FORM_LOST');check(!messages.some(m=>m.title==='Zapisano'),'FALSE_SUCCESS');check(localStorage.getItem(key)===savedRaw,'DETAIL_FAILED_STORAGE_CHANGED');
   for(const confirm of [null,{ask:()=>{throw Error('CONFIRM');}},{ask:()=>Promise.reject(Error('CONFIRM'))},{ask:async()=>false}]){
    FC.confirmBox=confirm;await click(button(body,'Wyjdź'));check(input.isConnected,'DETAIL_EXIT_FAIL_OPEN');
    await click(document.querySelector('.panel-box__close'));check(input.isConnected,'DETAIL_TITLE_CLOSE_FAIL_OPEN');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();check(input.isConnected,'DETAIL_ESCAPE_FAIL_OPEN');
   }
   FC.storage.setJSON=write;await click(button(body,'Zapisz'));check(messages.at(-1).title==='Zapisano','NO_SUCCESS_AFTER_ACK');
   await click(button(body,'Wyjdź'));check(!input.isConnected,'SUCCESS_SAVE_STILL_DIRTY');
   const row=FC.serviceOrderStore.getById('native');check(row.cutting.parts[0].name==='Changed front'&&row.cutting.plan&&row.meta.extra==='KEEP_META'&&row.items[0].extra==='KEEP_ITEM','DETAIL_SAVE_LOST_DATA');
   const expected=localStorage.getItem(key);return {expected,parts:row.cutting.parts.length,plan:!!row.cutting.plan,groups:5};
  }} )()`);
  // A new page realm must read the committed record through the real storage API.
  let reloadTimer;
  const loaded=new Promise((resolve,reject)=>{reloadTimer=setTimeout(()=>reject(Error('SERVICE_RELOAD_TIMEOUT')),20000);browser.onEvent(event=>{if(event.method==='Page.loadEventFired'){clearTimeout(reloadTimer);resolve();}});});
  try{await browser.send('Page.reload');await loaded;}finally{clearTimeout(reloadTimer);}
  await browser.evaluate(`window.FC={};${source('js/app/shared/storage.js')}\n${source('js/app/service/service-order-store.js')}`);
  const reread=await browser.evaluate(`({raw:localStorage.getItem(FC.serviceOrderStore.ORDER_KEY),row:FC.serviceOrderStore.getById('native')})`);
  assert.equal(reread.raw,result.expected);assert.equal(reread.row.cutting.parts[0].name,'Changed front');assert.ok(reread.row.cutting.plan);assert.equal(reread.row.extra,'KEEP_ORDER');assert.deepEqual(external,[]);
  console.log('service-order-integrity-browser: 6/6 groups PASS (confirmations, write/delete denial, full payload, detail dirty, title/Escape, reload); zero external requests');
 }finally{try{if(browser)await browser.close();}finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});}}
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={main};
