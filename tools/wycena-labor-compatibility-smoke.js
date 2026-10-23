#!/usr/bin/env node
'use strict';
// CI regression for the implemented compatibility fragment, not the whole LABOR package.
const assert = require('node:assert/strict');
const {runtime, model} = require('./cloud-global-data-smoke.js');
const clone = value => JSON.parse(JSON.stringify(value));

async function main(){
  const r = runtime();
  r.load('js/app/pricing/labor-catalog-definitions.js');
  r.load('js/app/pricing/labor-catalog.js');
  const labor = r.FC.laborCatalog;
  for(const pricingMode of ['fixed','perUnit','startPlusUnit','time','timeTiers','timeStartStep','advanced']){
    const def = {id:'synthetic-zero',name:'Synthetic',pricingMode,price:23,startPrice:37,fixedPrice:23,
      timeBlockHours:0.25,startHours:1/12,stepHours:1/60,startQty:1,stepEveryQty:1,
      quantityTiers:[{min:1,max:5,hours:0.75}],volumeTimeMode:'perM3',volumeTimePerM3:1};
    const zero = labor.calculateDefinition(def,{quantity:0,volumeM3:1,hourlyRates:{workshop:177}});
    assert.equal(zero.quantity,0,pricingMode);
    for(const key of ['quantityHours','volumeHours','pricedHours','laborPrice','volumePrice','fixedPrice','startPrice','billableQty','total']) assert.equal(zero[key],0,pricingMode+': '+key);
  }
  const timed = {name:'Synthetic',pricingMode:'time',timeBlockHours:0.25};
  assert.equal(labor.calculateDefinition(timed,{quantity:3,hourlyRates:{workshop:177}}).total,132.75);
  assert.equal(labor.calculateDefinition(timed,{quantity:5,hourlyRates:{workshop:177}}).pricedHours,1.25);
  assert.equal(labor.calculateDefinition(timed,{}).quantity,1,'Omitted quantity keeps legacy default');
  console.log('PASS quantity=0 in all seven pricing modes; positive and omitted quantities unchanged');

  // Exercise the public modal entry/read/cancel path using select semantics, including disabled selected values.
  class Element {
    constructor(tag='input'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.style={};this._value='';this.parentElement={style:{}};this.checked=false;}
    get options(){return this.children;}
    get value(){return this._value;}
    set value(value){const v=String(value);this._value=this.tagName==='SELECT'&&!this.options.some(o=>o.value===v)?'':v;}
    appendChild(el){el.owner=this;this.children.push(el);return el;}
    remove(){if(this.owner)this.owner.children=this.owner.children.filter(el=>el!==this);}
    setAttribute(k,v){this.attrs[k]=String(v);}
    getAttribute(k){return this.attrs[k]??null;}
    removeAttribute(k){delete this.attrs[k];}
    closest(){return this.parentElement;}
  }
  const ids=['formCategory','formServiceName','formServicePrice','laborDefaultMultiplier','laborTierText','laborStartPrice','laborIncludedQty','laborStartQty','laborStepEveryQty','laborVolumePricePerM3','laborVolumeTimePerM3','laborVolumeTimeTierText','laborActive','laborInternalOnly'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  const durationIds=['laborTimeBlockHours','laborStartHours','laborStepHours'];
  for(const id of [...durationIds,'laborPricingMode','laborQuantitySource','laborRateType','laborQuantityMode','laborVolumeTimeMode'])elements[id]=new Element('select');
  for(const id of durationIds)for(const v of [0,1/60,1/12,0.25,0.5,1]){const opt=new Element('option');opt.value=v;elements[id].appendChild(opt);}
  function selectOptions(el,options,value){if(!el)return;el.children=[];for(const row of options){const opt=new Element('option');opt.value=row.value;el.appendChild(opt);}el.value=value;}
  const original={id:'synthetic-saved',name:'Synthetic saved duration',category:'Synthetic',pricingMode:'advanced',quantityMode:'startStep',timeBlockHours:0.75,startHours:0.75,stepHours:0.75,startQty:0,rateType:'workshop',active:true};
  let editing=clone(original);
  const ctx=r.FC.priceModalContext={byId:id=>elements[id]||null,currentListKind:()=> 'quoteRates',currentList:()=>[editing],appUiState:()=>({editingId:editing.id}),
    currentConfig:()=>({formKind:'service',addLabel:'Dodaj czynność'}),runtimeState:{itemModalOpen:true},setSelectOptions:selectOptions,buildCategoryOptions:()=>[{value:'Synthetic'}],confirmDiscard:async()=>true,persistUi:()=>{}};
  r.s.document={createElement:tag=>new Element(tag)};
  r.load('js/app/material/price-modal-item-form.js');
  ctx.renderItemModal();
  assert.equal(ctx.isItemDirty(),false);
  const draft=ctx.getCurrentServiceDraft();
  assert.equal(draft.startQty,0,'Zero included units survives the actual form');
  for(const key of ['timeBlockHours','startHours','stepHours'])assert.equal(draft[key],0.75,'Read/write '+key);
  for(const id of durationIds){assert.equal(elements[id].options.length,7);assert.equal(elements[id].options.filter(o=>o.disabled).length,1);assert.equal(elements[id].value,'0.75');}
  elements.laborTimeBlockHours.value='0.25';
  assert.equal(ctx.isItemDirty(),true);
  await ctx.requestClosePriceItemModal();
  assert.deepEqual(editing,original,'Cancel preserves stored definition');
  editing={...original,timeBlockHours:1,startHours:1,stepHours:1};
  ctx.runtimeState.itemModalOpen=true;ctx.renderItemModal();
  for(const id of durationIds){assert.equal(elements[id].options.length,6,'Saved-only options removed between items');assert.equal(elements[id].value,'1');}
  console.log('PASS modal read/write 45 min, standard choices, item switch and Cancel');

  const m=model();
  m.labor=labor.ensureDefaultDefinitions([]).map(row=>labor.normalizeDefinition(row));
  m.labor.push(labor.normalizeDefinition({...original,quantityTiers:[{min:1,max:2,hours:0.75}]}));
  m.workshopServices.push({id:'synthetic-service-45',name:'Synthetic service',price:0,timeBlockHours:0.75,startHours:0.75,stepHours:0.75});
  const c=r.FC.globalDataContract,before=JSON.stringify(m),packed=await c.pack('synthetic-owner',m);
  assert.deepEqual(clone((await c.unpack('synthetic-owner',packed.directory,packed.records)).model),clone(m));
  assert.equal(JSON.stringify(m),before);
  assert.deepEqual(r.calls,[],'Read and calculation do not write owner data');
  console.log('PASS closed CLOUD-3 pack/unpack preserves 45 min in labor and workshop services without writes');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
