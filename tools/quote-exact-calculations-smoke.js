'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),cp=require('node:child_process'),fs=require('node:fs'),crypto=require('node:crypto');
const {fixture}=require('./wycena-labor-norms-smoke');
const BASE='e37502125dd846ae883f65e013ecdf0489dc500f';
const baselineHashes={'js/app/quote/quote-calculation-register.js':'c4eff3f1ae09f605284dace40957cc513fd616f9','js/app/wycena/wycena-core-offer.js':'6767cd65b6839c57b89df7aead9e878b44c924bb'};
// A local executor may disallow Node child processes. Preloaded BASE bytes must
// match the same immutable Git blobs; CI normally reads them directly with Git.
const preloaded=process.env.EXACT_CALC_BASELINE_FILE?JSON.parse(fs.readFileSync(process.env.EXACT_CALC_BASELINE_FILE,'utf8')):null;
const baseline=file=>{
  const source=preloaded?preloaded[file]:cp.execFileSync('git',['show',BASE+':'+file],{encoding:'utf8'});
  assert.equal(crypto.createHash('sha1').update('blob '+Buffer.byteLength(source)+'\0').update(source).digest('hex'),baselineHashes[file],'Exact BASE bytes required');return source;
};
const oldContext={window:{FC:{}}};vm.createContext(oldContext);vm.runInContext(baseline('js/app/quote/quote-calculation-register.js'),oldContext);
const old=oldContext.window.FC.quoteCalculationRegister;
const cents=value=>Math.round(value*100)/100;
const copy=value=>JSON.parse(JSON.stringify(value));
// Independent arithmetic parser: evaluate the visible operands, never the source calc.
function evaluate(equation){
  const match=equation.match(/^(?:Cena|Transport) = (.*?) = (-?[\d,]+) zł /);assert.ok(match,'Missing verifiable equation: '+equation);
  const expression=match[1].replace(/(\d),(\d)/g,'$1.$2').replace(/zł\/jedn\.|zł\/m³|zł\/km|zł\/h|min\/m³|m³|min|km|zł/g,'').replaceAll('×','*').replaceAll('÷','/').replace(/\s/g,'');
  const tokens=expression.match(/\d+(?:\.\d+)?(?:e[+-]?\d+)?|ceil|max|min|[()+*/,-]/g)||[];assert.equal(tokens.join(''),expression,'Unknown visible operator');let i=0;
  function value(){
    const token=tokens[i++];if(token==='-')return -value();
    if(token==='('){const n=add();assert.equal(tokens[i++],')');return n;}
    if(['ceil','max','min'].includes(token)){
      assert.equal(tokens[i++],'(');const args=[add()];while(tokens[i]===','){i++;args.push(add());}assert.equal(tokens[i++],')');return Math[token](...args);
    }
    assert.ok(token!==undefined&&!Number.isNaN(Number(token)),'Invalid operand');return Number(token);
  }
  function multiply(){let n=value();while(['*','/'].includes(tokens[i])){const op=tokens[i++],rhs=value();n=op==='*'?n*rhs:n/rhs;}return n;}
  function add(){let n=multiply();while(['+','-'].includes(tokens[i])){const op=tokens[i++],rhs=multiply();n=op==='+'?n+rhs:n-rhs;}return n;}
  const result=add();assert.equal(i,tokens.length);assert.equal(cents(result),Number(match[2].replace(',','.')),equation);return cents(result);
}
function numericRegister(register){const r=copy(register);delete r.generatedAt;r.lines.forEach(line=>delete line.calculation);return r;}
function unchangedTotals(FC,lines,commercial={}){
  oldContext.window.FC.utils=FC.utils;oldContext.window.FC.wycenaCoreUtils=FC.wycenaCoreUtils;
  const current=FC.quoteCalculationRegister.buildRegister(lines,commercial),previous=old.buildRegister(lines,commercial);
  assert.deepEqual(numericRegister(current),numericRegister(previous),'Presentation must not change amounts, norms, IDs or schema');
  for(const line of current.lines){
    if(line.sourceKind==='automatic-blocked'){assert.equal(line.total,0);assert.ok(line.calculation.startsWith('STOP:'));}
    else assert.equal(evaluate(line.calculation),cents(line.total));
  }
  return current;
}
function manualCase(def,quantity=1,rate=150){
  const r=fixture();r.rates().find(row=>row.id==='labor_rate_workshop').price=rate;
  r.rates().push({id:'private-exact',name:'Synthetic exact audit',rateType:'workshop',active:true,...def});
  r.cab.laborItems=[{rateId:'private-exact',qty:quantity,note:'Keep private manual quantity'}];
  const labor=r.FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia']);
  const result=unchangedTotals(r.FC,{labor});
  return {r,result,line:result.lines.find(row=>row.name==='Synthetic exact audit')};
}
let checks=0;
for(const minutes of [1,4,5,6,7,9,10,13,15,45])for(const rate of [150,250])for(const multiplier of [0.5,1,1.3]){
  const {line}=manualCase({pricingMode:'time',quantityMode:'linear',timeBlockHours:minutes===45?0.75:1/60,defaultMultiplier:multiplier},minutes===45?1:minutes,rate);
  assert.equal(evaluate(line.calculation),cents(minutes/60*multiplier*rate));checks++;
}
console.log('PASS 60 minute/rate/multiplier cases with independent visible-equation evaluation');
for(const def of [
  {pricingMode:'timeStartStep',startHours:5/60,startQty:0,stepEveryQty:1,stepHours:1/60},
  {pricingMode:'timeStartStep',startHours:15/60,startQty:2,stepEveryQty:3,stepHours:15/60},
  {pricingMode:'timeTiers',quantityTiers:[{min:1,max:5,hours:0.25},{min:6,max:10,hours:0.75}]},
  {pricingMode:'fixed',fixedPrice:7.125,price:7.125},
  {pricingMode:'perUnit',price:7.125},
  {pricingMode:'advanced',quantityMode:'linear',timeBlockHours:1,volumeTimeMode:'perM3',volumeTimePerM3:1,fixedPrice:1.375,defaultMultiplier:1.3},
  {pricingMode:'advanced',quantityMode:'linear',timeBlockHours:1/60,volumePricePerM3:173.125},
]){const {line}=manualCase(def,4,173.125);evaluate(line.calculation);checks++;}
console.log('PASS start/step, tiers, fixed, per-unit, volume time/surcharge and private fractional rates');
for(const pricingMode of ['fixed','perUnit','startPlusUnit','time','timeTiers','timeStartStep','advanced']){
  const {line}=manualCase({pricingMode,price:7.125,fixedPrice:7.125,startPrice:3,startHours:5/60,startQty:0,stepHours:1/60,stepEveryQty:1,timeBlockHours:0.75},0);
  assert.equal(line.quantity,0);assert.equal(line.total,0);assert.equal(evaluate(line.calculation),0);checks++;
}
{
  const r=fixture(),FC=r.FC,details=r.details();
  const register=unchangedTotals(FC,{labor:FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia'])});
  const get=id=>register.lines.find(row=>row.name===r.rates().find(def=>def.id===id).name);
  const oldPack=old.buildRegister({labor:FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia'])},{}).lines.find(row=>row.name===get('labor_door_pack').name);
  const operands=oldPack.calculation.match(/([\d.]+) × ([\d.]+) h × ([\d.]+) PLN\/h/);assert.ok(operands);
  assert.equal(cents(Number(operands[1])*Number(operands[2])*Number(operands[3])),24);assert.equal(oldPack.total,25,'BASE reproduces the misleading rounded operands');
  assert.equal(evaluate(get('labor_door_pack').calculation),25);assert.ok(get('labor_door_pack').calculation.includes('2 × 5 min'));
  assert.equal(evaluate(get('labor_door_trial').calculation),10);
  assert.equal(evaluate(get('labor_door_rehang').calculation),25);assert.ok(get('labor_door_rehang').calculation.includes('(2 + 4)'));
  assert.equal(evaluate(get('labor_shelves_place').calculation),29.17);
  const body={...details.find(row=>row.volumeHours>0),quantity:1,quantityMode:'linear',timeBlockHours:1,baseHours:1,volumeM3:0.05088,volumeHours:0.05088,volumeTimeMode:'perM3',volumeTimePerM3:1,multiplier:1,hourlyRate:150,hours:1.05088,total:157.632,fixedPrice:0,volumePrice:0};
  const equation=FC.quoteCalculationRegister.describeCalculation(body);assert.equal(evaluate(equation),157.63);assert.ok(equation.includes('0,05088 m³ × 60 min/m³'));
  console.log('PASS physical operations: pack 25.00, trial 10.00, rehang 25.00, placement 29.17, body 157.63');checks++;
}
for(const [type,height,depth,shelves,expected]of [['moduł',82,50,1,352.5],['wisząca',106,32,2,421.8]]){
  const r=fixture();Object.assign(r.cab,{type,height,depth,width:60});r.cab.details.shelves=shelves;
  const register=unchangedTotals(r.FC,{labor:r.FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia'])});
  assert.equal(register.totals.labor,expected);console.log('PASS explicit synthetic '+type+' reference '+expected.toFixed(2)+' unchanged against BASE');checks++;
}
{
  const r=fixture(),FC=r.FC;
  const project=FC.wycenaCoreLabor.collectProjectPreparationLines(['kuchnia']);
  assert.ok(project.length>0);const projectRegister=unchangedTotals(FC,{project});assert.ok(projectRegister.lines.some(row=>row.section==='project'&&row.total>0));
  const def=r.rates().find(row=>row.id==='labor_carrying_cabinet');
  const calc=FC.laborCatalog.calculateDefinition(def,{quantity:3,multiplier:2,hourlyRates:{helper:150}});
  const detail={...def,quantity:3,hourlyRate:calc.hourlyRate,baseHours:calc.quantityHours,hours:calc.pricedHours,multiplier:calc.multiplier,total:calc.total,volumeHours:0,fixedPrice:0};
  const carrying=unchangedTotals(FC,{carrying:[{name:'Synthetic carrying',details:[detail]}]});
  assert.equal(evaluate(carrying.lines[0].calculation),125);console.log('PASS actual project preparation and carrying start/step with two helpers');checks++;
}
{
  const r=fixture(),FC=r.FC;let selections=[];
  FC.quoteOfferStore={getCurrentDraft:()=>({rateSelections:selections})};
  FC.investorTransport={getCurrentTransportContext:()=>({billableKm:36,durationMin:7})};
  Object.assign(r.rates().find(row=>row.id==='transport_distance_km'),{price:5.125,startPrice:50,includedQty:10,starterPrice:false,priceUserEditedAt:'synthetic'});
  r.rates().push({id:'private-manual',name:'Private manual',rateType:'workshop',pricingMode:'timeStartStep',startQty:0,startHours:5/60,stepEveryQty:1,stepHours:1/60});
  const original=baseline('js/app/wycena/wycena-core-offer.js');vm.runInContext(original,r.s);
  const numeric=rows=>copy(rows.map(row=>({qty:row.qty,unitPrice:row.unitPrice,total:row.total,hours:row.hours,sourceId:row.sourceId})));
  for(const manual of [false,true]){
    selections=manual?[{rateId:'private-manual',qty:4}]:[];
    vm.runInContext(original,r.s);const before=numeric(FC.wycenaCoreOffer.collectQuoteRateLines());r.load('js/app/wycena/wycena-core-offer.js');
    const lines=FC.wycenaCoreOffer.collectQuoteRateLines();assert.deepEqual(numeric(lines),before);
    const register=unchangedTotals(FC,{quoteRates:lines});assert.ok(register.lines.some(line=>line.section==='transport'));
    if(manual){const row=register.lines.find(line=>line.sourceId==='private-manual');assert.ok(row.calculation.includes('min'));assert.equal(evaluate(row.calculation),22.5);}
  }
  console.log('PASS actual transport and manual offer integration: all pre-existing quantities and prices unchanged');checks++;
}
{
  const r=fixture(),FC=r.FC;FC.quoteOfferStore={getCurrentDraft:()=>({rateSelections:[]})};FC.investorTransport={getCurrentTransportContext:()=>({billableKm:12})};
  r.rates().push({id:'private-km-1',quantitySource:'transport.distance_km',price:5,starterPrice:false},{id:'private-km-2',quantitySource:'transport.distance_km',price:7,starterPrice:false});
  r.load('js/app/wycena/wycena-core-offer.js');const lines=FC.wycenaCoreOffer.collectQuoteRateLines();assert.equal(lines.length,1);assert.equal(lines[0].sourceKind,'automatic-blocked');
  unchangedTotals(FC,{quoteRates:lines});console.log('PASS transport conflict retains STOP and zero charge');checks++;
}
{
  const r=fixture(),FC=r.FC;
  for(const commercial of [{},{discountPercent:7.125},{discountPercent:100},{discountPercent:200},{discountAmount:0.005}]){
    const lines={materials:[{qty:1.123456,unitPrice:173.125,total:1.123456*173.125}],accessories:[{qty:4,unitPrice:7.125,total:28.5}],agdServices:[{qty:1,unitPrice:45,total:45}],quoteRates:[{qty:1,unitPrice:0.004,total:0.004},{qty:1,unitPrice:0.004,total:0.004}]};
    const register=unchangedTotals(FC,lines,commercial),before=JSON.stringify(register);
    const explanation=FC.quoteCalculationRegister.roundingExplanation(register,commercial);
    assert.ok(explanation.includes('do najbliższego grosza'));assert.ok(explanation.includes('zaokrąglamy niezależnie'));
    FC.quoteCalculationRegister.normalizeRegister(register);assert.equal(JSON.stringify(register),before,'Frozen source must not be rewritten');
    if(commercial.discountPercent>=100)assert.equal(register.totals.grand,0);
  }
  console.log('PASS materials, hardware, services, sub-cent sums, discounts and frozen source preservation');checks++;
}
assert.ok(fixture().FC.quoteCalculationRegister.describeCalculation({quantity:2,unitPrice:10,total:99}).includes('Brak pełnego rozbicia'),'Do not fabricate an equation for incomplete source data');
{
  const r=fixture(),ids=new Map();
  class Element{
    constructor(){this.children=[];this.style={};this.className='';this._text='';}
    appendChild(child){child.parentNode=this;this.children.push(child);return child;}
    setAttribute(key,value){if(key==='id')ids.set(value,this);}
    addEventListener(){}
    set textContent(value){this._text=String(value);this.children=[];}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    set innerHTML(value){this._text='';this.children=[];}
    get innerHTML(){return '';}
  }
  r.s.document={body:new Element(),createElement:()=>new Element(),getElementById:id=>ids.get(id)||null,addEventListener(){}};
  r.load('js/app/wycena/wycena-summary-details-modal.js');
  const register=r.FC.quoteCalculationRegister.buildRegister({labor:r.FC.wycenaCoreLabor.collectCabinetLabor(['kuchnia'])},{});
  const snapshot={calculationRegister:register,commercial:{}},before=JSON.stringify(snapshot);
  const walk=node=>[node,...node.children.flatMap(walk)],has=(node,name)=>node.className.split(' ').includes(name);
  r.FC.wycenaSummaryDetailsModal.open(snapshot,'labor');
  const rendered=walk(ids.get('quoteSummaryDetailsBody')).filter(node=>has(node,'quote-detail-line--labor'));assert.equal(rendered.length,register.lines.length);
  for(const line of rendered){
    const nodes=walk(line),fact=nodes.find(node=>has(node,'quote-detail-line__fact')&&node.children[0].textContent==='Wyliczenie');
    assert.ok(fact);const amount=nodes.find(node=>has(node,'quote-detail-line__total')).textContent;
    assert.equal(evaluate(fact.children[1].textContent),Number(amount.replace(' PLN','')),'Actual DOM equation and displayed amount agree');
  }
  const archived={calculationRegister:{lines:[copy(register.lines.find(line=>line.name==='Zdjęcie, pakowanie i odłożenie drzwi'))]},commercial:{}};
  archived.calculationRegister.lines[0].calculation='Cena = 2 × 0.08 h × 150 PLN/h.';
  const archivedBytes=JSON.stringify(archived);r.FC.catalogSelectors.getQuoteRates=()=>{throw Error('Historical view must not consult current rates');};
  r.FC.wycenaSummaryDetailsModal.open(archived,'labor');
  const oldFact=walk(ids.get('quoteSummaryDetailsBody')).find(node=>has(node,'quote-detail-line__fact')&&node.children[0].textContent==='Wyliczenie');
  assert.equal(evaluate(oldFact.children[1].textContent),25);assert.equal(JSON.stringify(archived),archivedBytes,'Only presentation changes; frozen amounts and saved description remain intact');
  const material=r.FC.quoteCalculationRegister.buildRegister({materials:[{qty:1.23456,unit:'m²',unitPrice:173.125,total:1.23456*173.125}]},{});
  r.FC.wycenaSummaryDetailsModal.open({calculationRegister:material},'materials');
  const materialNodes=walk(ids.get('quoteSummaryDetailsBody'));
  const materialFact=materialNodes.find(node=>has(node,'quote-detail-line__fact')&&node.children[0].textContent==='Wyliczenie');
  assert.equal(evaluate(materialFact.children[1].textContent),cents(material.lines[0].total));
  assert.equal(materialNodes.find(node=>has(node,'quote-detail-line__qty')).textContent,'1,23456 m²','Long formulas belong to wrapping facts, not the nowrap price column');
  const zero=r.FC.quoteCalculationRegister.buildRegister({accessories:[{qty:1,unitPrice:100,total:100}]},{discountPercent:100});
  r.FC.wycenaSummaryDetailsModal.open({calculationRegister:zero,commercial:{discountPercent:100}},'total');
  const displayed=walk(ids.get('quoteSummaryDetailsBody'));
  assert.ok(displayed.some(node=>has(node,'rozrys-material-accordion__title-line2')&&node.textContent==='9 poz. • 0.00 PLN'),'A zero grand total must not fall back to subtotal');
  assert.equal(JSON.stringify(snapshot),before,'Rendering never rewrites frozen data');console.log('PASS actual DOM equations, zero grand total and immutable snapshot');checks++;
}
console.log(`Exact calculations: ${checks} cases PASS; full CI/Chromium/SDK pending`);
module.exports={evaluate};
