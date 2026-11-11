'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const clone=value=>JSON.parse(JSON.stringify(value));
const tests=[],test=(title,fn)=>tests.push([title,fn]);
function fixture(original=null,mode='manual',source='',price='45',pricing='fixed'){
 const s={console};s.window=s;s.FC={utils:{uid:()=> 'custom-new'}};vm.createContext(s);
 const load=path=>vm.runInContext(fs.readFileSync('js/app/'+path+'.js','utf8'),s,{filename:path});
 load('pricing/labor-catalog-definitions');load('pricing/work-quantity-sources');load('pricing/labor-catalog');
 const labor=s.FC.laborCatalog;
 let rows=original?[clone(original)]:[],errors=[],ui={editingId:original?.id||null};
 const initial={formCategory:'Test',formServiceName:'Test czynność',formServicePrice:price,laborPricingMode:pricing,
  laborAutomationMode:mode,laborQuantitySource:source,laborQuantityMode:'none',laborDefaultMultiplier:'1',
  laborRateType:'workshop',laborBillingScope:'standard',laborDailyStages:'both'};
 const fields=Object.fromEntries(Object.entries(initial).map(([id,value])=>[id,{value}]));
 fields.laborActive={checked:true};fields.laborInternalOnly={checked:true};
 const ctx=s.FC.priceModalContext={byId:id=>fields[id]||null,appUiState:()=>ui,
  currentList:()=>clone(rows),currentListKind:()=> 'quoteRates',currentConfig:()=>({formKind:'service'}),
  runtimeState:{},persistUi(){},renderPriceModal(){},info:(title,msg)=>errors.push(title+': '+msg),
  saveCurrentList(next){rows=clone(next);return true;}};
 load('material/price-modal-item-form');load('material/price-modal-persistence');
 return {s,labor,ctx,fields,rows:()=>clone(rows),errors,load};
}
test('factory automatic ID cannot be reclassified even after changing its formula or source',()=>{
 const f=fixture(),catalog=f.labor;
 for(const id of ['labor_mount_front','labor_body_h090','labor_daily_break','labor_delivery_loading','transport_distance_km','pdf_door_adjust']){
  const original=catalog.DEFAULT_LABOR_DEFINITIONS.find(row=>row.id===id);
  assert.ok(original,id);assert.equal(catalog.automationMode(original),'factory');
  const changed=catalog.normalizeDefinition({...original,automationMode:'manual',quantitySource:'',pricingMode:'fixed',price:99});
  assert.equal(catalog.isFactoryAutomaticDefinition(changed),true,id);
  assert.equal(catalog.automationMode(changed),'factory');assert.equal(changed.automationMode,'automatic');
 }
});
test('factory manual extras remain manual and factory auto default model unchanged',()=>{
 const {labor}=fixture();
 for(const id of ['labor_hole_fi60','labor_pipe_cutout','pdf_wall_fix']){
  const row=labor.DEFAULT_LABOR_DEFINITIONS.find(item=>item.id===id);
  assert.equal(labor.automationMode(row),'manual',id);
 }
 for(const row of labor.DEFAULT_LABOR_DEFINITIONS){
  assert.equal(Object.hasOwn(labor.normalizeDefinition(row),'automationMode'),false,'factory model unchanged: '+row.id);
 }
});
test('custom mode is explicit, preserved through normalize and independent from billing scope',()=>{
 const {labor}=fixture();
 for(const scope of ['standard','room','quote','day']){
  const manual=labor.normalizeDefinition({id:'user-x',automationMode:'manual',quantitySource:'leg.count',billingScope:scope});
  const auto=labor.normalizeDefinition({...manual,automationMode:'automatic'});
  assert.equal(labor.isManualDefinition(manual),true);assert.equal(labor.isAutomaticDefinition(manual),false);
  assert.equal(labor.isAutomaticDefinition(auto),true);assert.equal(auto.automationMode,'automatic');
 }
 assert.equal(labor.automationMode({id:'new-user',billingScope:'day'}),'manual');
 assert.equal(labor.automationMode({id:'old-user',quantitySource:'leg.count'}),'automatic','legacy inference only');
});
test('manual new record stays manual; auto fixed with source saves and does not become a manual option',()=>{
 let f=fixture(null,'manual','','12');assert.equal(f.ctx.saveServiceFromForm(),true);
 assert.equal(f.rows()[0].automationMode,'manual');assert.equal(f.labor.isManualDefinition(f.rows()[0]),true);
 f=fixture(null,'automatic','cabinet.count','12');assert.equal(f.ctx.saveServiceFromForm(),true);
 assert.equal(f.rows()[0].automationMode,'automatic');assert.equal(f.rows()[0].quantitySource,'cabinet.count');
 assert.equal(f.rows()[0].fixedPrice,12);assert.equal(f.labor.isManualDefinition(f.rows()[0]),false);
});
test('manual quantity formula keeps chosen source but is never auto-eligible',()=>{
 const f=fixture(null,'manual','cabinet.count','12','perUnit');
 assert.equal(f.ctx.getCurrentServiceDraft().quantitySource,'cabinet.count');
 assert.equal(f.ctx.saveServiceFromForm(),true);
 const row=f.rows()[0];
 assert.equal(row.automationMode,'manual');assert.equal(row.quantitySource,'cabinet.count');
 assert.equal(f.labor.isAutomaticDefinition(row),false);
 assert.equal(f.labor.calculateDefinition(row,{quantity:3}).total,36);
});
test('invalid automatic sources fail closed without persisting anything',()=>{
 for(const source of ['', 'transport.distance_km','carrying.floor_units','not.active.source']){
  const f=fixture(null,'automatic',source);
  assert.equal(f.ctx.saveServiceFromForm(),false,source);
  assert.equal(f.rows().length,0);assert.ok(f.errors.some(s=>s.includes('źródła')),source);
 }
});
test('factory auto keeps source and may update price, but cannot remove required source',()=>{
 const source=fixture().labor.DEFAULT_LABOR_DEFINITIONS.find(row=>row.id==='labor_mount_front');
 let f=fixture(source,'manual','front.count','75','fixed');
 assert.equal(f.ctx.getCurrentServiceDraft().automationMode,'automatic');
 assert.equal(f.ctx.saveServiceFromForm(),true);
 assert.equal(f.rows()[0].fixedPrice,75);
 assert.equal(f.labor.automationMode(f.rows()[0]),'factory');
 f=fixture(source,'factory','','75','fixed');
 assert.equal(f.ctx.saveServiceFromForm(),false);
 assert.equal(f.rows()[0].price,source.price);
});
test('factory daily break with no quantitySource saves as factory auto',()=>{
 const source=fixture().labor.DEFAULT_LABOR_DEFINITIONS.find(row=>row.id==='labor_daily_break');
 const f=fixture(source,'factory','','0','time');
 assert.equal(f.ctx.saveServiceFromForm(),true);
 assert.equal(f.labor.automationMode(f.rows()[0]),'factory');
});
test('custom automatic manual toggle changes eligibility without changing price formulas',()=>{
 const f=fixture(null,'automatic','cabinet.count','33','fixed');assert.equal(f.ctx.saveServiceFromForm(),true);
 const saved=f.rows()[0];const next=fixture(saved,'manual','cabinet.count','33','fixed');
 assert.equal(next.ctx.saveServiceFromForm(),true);
 assert.equal(next.rows()[0].automationMode,'manual');assert.equal(next.rows()[0].quantitySource,'');
 assert.equal(next.labor.calculateDefinition(next.rows()[0],{quantity:1}).total,33);
});
test('global labor schema accepts explicit modes and rejects a forged factory choice',()=>{
 const f=fixture();f.load('cloud/global-data-contract');
 const schema=f.s.FC.globalDataContract.schemas.labor;
 for(const mode of ['manual','automatic'])schema({id:'qa',name:'QA',price:0,automationMode:mode},'labor');
 assert.throws(()=>schema({id:'qa',name:'QA',price:0,automationMode:'factory'},'labor'),/GLOBAL_VALUE_INVALID/);
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/<option value="factory" disabled>/,'factory choice cannot be selected by users');
});
let fails=0;for(const [title,fn] of tests){try{fn();console.log('PASS '+title);}catch(error){fails++;console.error('FAIL '+title+': '+error.message);}}
console.log((tests.length-fails)+'/'+tests.length+' automation mode PASS');if(fails)process.exitCode=1;
