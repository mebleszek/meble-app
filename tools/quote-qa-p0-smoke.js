'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(original){
 const s={console};s.window=s;s.FC={utils:{uid:()=> 'synthetic-new'}};vm.createContext(s);
 const load=file=>vm.runInContext(fs.readFileSync('js/app/'+file+'.js','utf8'),s,{filename:file});
 load('pricing/labor-catalog-definitions');load('pricing/labor-catalog');
 let rows=original?[clone(original)]:[];const ui={editingId:original?.id||null},fields=Object.fromEntries(Object.entries({formCategory:'Synthetic',formServiceName:'QA',formServicePrice:String(original && ['fixed','advanced'].includes(original.pricingMode||'fixed') && original.fixedPrice!=null ? original.fixedPrice : (original?.price??100)),laborPricingMode:original?.pricingMode||'advanced',laborQuantityMode:'none',laborDefaultMultiplier:'1',laborRateType:'workshop',laborBillingScope:'standard',laborDailyStages:'both'}).map(([id,value])=>[id,{value}]));fields.laborActive={checked:true};
 const ctx=s.FC.priceModalContext={byId:id=>fields[id]||null,appUiState:()=>ui,currentList:()=>clone(rows),currentListKind:()=> 'quoteRates',currentConfig:()=>({formKind:'service'}),runtimeState:{},persistUi(){},renderPriceModal(){},info(title,message){throw Error(title+': '+message);},saveCurrentList(next){rows=clone(next);return true;}};
 load('material/price-modal-item-form');load('material/price-modal-persistence');
 return {labor:s.FC.laborCatalog,ctx,rows:()=>rows};
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('advanced absent fixedPrice uses price before/after normalization, null and repeated normalization',()=>{
 const {labor}=fixture();for(const extra of [{},{fixedPrice:null}]){
  const raw={id:'qa',name:'QA',pricingMode:'advanced',price:100,quantityMode:'none',...extra};
  for(const d of [raw,labor.normalizeDefinition(raw),labor.normalizeDefinition(labor.normalizeDefinition(raw))])assert.equal(labor.calculateDefinition(d,{quantity:1}).total,100);
 }
});
test('advanced explicit fixedPrice zero remains zero with a nonzero price',()=>{
 const {labor}=fixture(),raw={id:'qa',pricingMode:'advanced',price:100,fixedPrice:0,quantityMode:'none'};
 for(const d of [raw,labor.normalizeDefinition(raw),labor.normalizeDefinition(labor.normalizeDefinition(raw))])assert.equal(labor.calculateDefinition(d,{quantity:1}).total,0);
});
for(const [name,original,expected]of [
 ['new advanced form',null,100],['legacy advanced form without fixedPrice',{id:'qa',price:100,pricingMode:'advanced'},100],['advanced form with explicit zero',{id:'qa',price:100,pricingMode:'advanced',fixedPrice:0},0]
])test(name+' saves the intended fixed component',()=>{
 const r=fixture(original);assert.equal(r.ctx.saveServiceFromForm(),true);const saved=r.rows()[0];assert.equal(saved.price,expected);assert.equal(saved.fixedPrice,expected);assert.equal(r.labor.calculateDefinition(saved,{quantity:1}).total,expected);
 if(original)assert.equal(saved.id,original.id);
});
test('manual once-scoped extras stay selectable while day break and transport stay automatic',()=>{
 const {labor}=fixture();
 for(const scope of ['standard','room','quote','day']){
  for(const id of ['labor_hole_fi60','pdf_wall_fix','custom-extra']){
   const def=labor.normalizeDefinition({id,name:'Extra',pricingMode:'time',quantitySource:'',billingScope:scope,active:true});
   assert.equal(labor.isManualDefinition(def),true,id+' '+scope);
   assert.equal(labor.isAutomaticDefinition(def),false,id+' '+scope);
  }
 }
 for(const id of ['labor_daily_break','labor_delivery_loading','labor_mount_front','pdf_door_adjust','transport_distance_km','transport_travel_time']){
  const def=labor.DEFAULT_LABOR_DEFINITIONS.find(row=>row.id===id);
  assert.ok(def && labor.isAutomaticDefinition(def),id+' stays automatic');
 }
});
test('fixed and advanced zero survive save; editing visible price changes actual charge',()=>{
 for(const mode of ['fixed','advanced']){
  const r=fixture({id:'qa',name:'QA',price:100,fixedPrice:0,pricingMode:mode});
  assert.equal(r.ctx.byId('formServicePrice').value,'0',mode+' actual zero');
  assert.equal(r.ctx.saveServiceFromForm(),true);
  assert.equal(r.rows()[0].price,0);assert.equal(r.rows()[0].fixedPrice,0);
  assert.equal(r.labor.calculateDefinition(r.rows()[0],{quantity:1}).total,0);
  r.ctx.appUiState().editingId='qa';r.ctx.byId('formServicePrice').value='75';
  assert.equal(r.ctx.saveServiceFromForm(),true);
  assert.equal(r.rows()[0].price,75);assert.equal(r.rows()[0].fixedPrice,75);
  assert.equal(r.labor.calculateDefinition(r.rows()[0],{quantity:1}).total,75);
 }
});
test('other modes retain their existing formulas and zero quantity',()=>{
 const {labor}=fixture();for(const [d,q,expected]of [
 [{pricingMode:'fixed',price:100},3,100],[{pricingMode:'fixed',price:100,fixedPrice:0},3,0],
 [{pricingMode:'perUnit',price:100},3,300],[{pricingMode:'startPlusUnit',price:10,startPrice:20,includedQty:1},3,40],
 [{pricingMode:'time',quantityMode:'linear',timeBlockHours:0.25},2,50]
 ]){assert.equal(labor.calculateDefinition(d,{quantity:q,hourlyRate:100}).total,expected);assert.equal(labor.calculateDefinition(d,{quantity:0,hourlyRate:100}).total,0);}
});
let failures=0;for(const [name,fn]of tests){try{fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+': '+error.message);}}console.log(`${tests.length-failures}/${tests.length} QA P0 PASS`);if(failures)process.exitCode=1;
