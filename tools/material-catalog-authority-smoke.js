'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./project-navigation-blockers-smoke');
const clone=v=>JSON.parse(JSON.stringify(v));
async function main(){
 const r=fixture();for(const file of ['js/app/optimizer/speed-max-sheet-plan.js','js/app/optimizer/speed-max-half-sheet.js','js/app/rozrys/rozrys-sheet-model.js','js/app/rozrys/rozrys-stock.js'])vm.runInContext(fs.readFileSync(file,'utf8'),r.s,{filename:file});const f=r.FC,c=f.catalogStore,a=f.wycenaCoreMaterialPlan,sel=f.catalogSelectors,normalize=c.normalizeMaterialRow;let count=0;
 const hdf=sel.findSheetMaterial('HDF 3mm biała');assert.equal(hdf.id,'m4');assert.equal(sel.findSheetMaterial('HDF biały 3 mm').id,hdf.id);assert.equal(sel.findSheetMaterial('HDF 5mm biała'),null);assert.equal(sel.findSheetMaterial('HDF 3mm biała',[hdf,{...hdf,id:'other'}]),null);count++;
 const manual=normalize({id:'old',materialType:'laminat',name:'Old',price:123,priceUnit:'sheet'});assert.equal(manual.price,123);assert.equal(manual.pricingMode,undefined,'Legacy implicit manual mode stays opt-in metadata');assert.equal(manual.purchasePrice,undefined);assert.equal(manual.sheetWidthMm,undefined);assert.equal(normalize({...manual,price:0}).price,0);assert.equal(normalize({...manual,pricingMode:'markup',purchasePrice:100,markupPercent:20}).price,120);assert.equal(normalize({...manual,pricingMode:'markup',purchasePrice:0,markupPercent:20}).price,0);count++;
 const seeds=c.getSheetMaterials();for(const [id,oldPrice,newPrice]of [['m5',3,10],['m7',5,20]]){const current=seeds.find(x=>x.id===id),old={...current,price:oldPrice};delete old.pricingMode;delete old.markupPercent;delete old.purchasePrice;delete old.aliases;assert.equal(normalize(old).price,newPrice);assert.equal(normalize({...old,name:old.name+' custom'}).price,oldPrice);assert.equal(normalize({...old,priceUserEditedAt:'2026-11-01'}).price,oldPrice);assert.equal(normalize({...old,price:0}).price,0);assert.equal(normalize({...old,pricingMode:'manual'}).price,oldPrice);}count++;
 for(const thickness of [10,16])for(const color of ['white','grey']){
  const bottom=seeds.find(row=>row.id==='m_drawer_bottom_'+thickness+'_'+color);
  assert.ok(bottom,'Both 10 mm bottom colours must be available');
  const sample=[{w:1000,h:500,qty:1}];
  for(const bad of [{...bottom,price:NaN},{...bottom,price:-1},{...bottom,price:0},{...bottom,thicknessMm:18},{...bottom,sheetWidthMm:0}])assert.throws(()=>a.buildMaterialLine(bottom.name,sample,bad,{}),e=>e.code==='material_catalog_unresolved','Unconfirmed drawer material cannot become a zero-price or wrong-thickness quote');
  assert.equal(a.buildMaterialLine(bottom.name,sample,{...bottom,price:0,priceUserEditedAt:'2026-11-23'},{}).total,0,'An explicitly saved zero price remains an intentional zero');
  assert.equal(bottom.purchasePrice,200);assert.equal(bottom.priceUnit,'sheet');assert.equal(bottom.billingIncrement,'m2');assert.equal(bottom.thicknessMm,thickness);
  assert.equal(sel.materialFormat(bottom.name).thickness,thickness,'ROZRYS uses a separate physical 10 mm material');
  const line=a.buildMaterialLine(bottom.name,[{w:1000,h:500,qty:1}],bottom,{});
  assert.equal(line.billedAreaM2,1,'Keep the existing whole-m² billing rule');
  assert.ok(Math.abs(line.qty-1/(2.8*2.07))<1e-10,'A sheet purchase price is converted to billed m²');
  assert.equal(line.unitPrice,200);
  assert.equal(normalize({...bottom,pricingMode:'manual',price:123,priceUserEditedAt:'2026-11-23'}).price,123,'Never overwrite a private price with a factory starter');
 }
 const projected={id:'m5',materialType:'obrzeże',manufacturer:'Start',symbol:'PCV-STD',name:'Obrzeże PCV standard',price:3,priceUnit:'mb',hasGrain:false,starterPrice:true,priceUserEditedAt:'',note:''};
 const approved=c.applyApprovedMaterialRules([projected]);assert.equal(approved[0].price,10);assert.deepEqual(clone(c.applyApprovedMaterialRules(approved)),clone(approved));
 for(const patch of [{note:'custom'},{priceUserEditedAt:'2026-11-01'},{sheetWidthMm:2500},{price:0},{aliases:[]},{markupPercent:0},{pricingMode:'manual'}]){const row={...projected,...patch};assert.equal(c.applyApprovedMaterialRules([row])[0].price,row.price);}
 const privateRow={...projected,id:'synthetic-private-pcv',price:0,starterPrice:false,priceUserEditedAt:'2026-11-01T00:00:00.000Z',note:'PRIVATE LEGACY MUST REMAIN EXACT'};assert.deepEqual(clone(normalize(privateRow)),privateRow);assert.deepEqual(clone(c.applyApprovedMaterialRules([privateRow])),[privateRow]);
 assert.equal(Object.hasOwn(manual,'markupPercent'),false);assert.equal(Object.hasOwn(manual,'aliases'),false);count++;
 const areaParts=[{w:1000,h:100,qty:10}];assert.equal(a.partAreaM2(areaParts),1);assert.equal(a.buildMaterialLine(hdf.name,areaParts,hdf,{}).qty,1);assert.equal(a.buildMaterialLine(hdf.name,[{w:1000001,h:1,qty:1}],hdf,{}).qty,2);assert.equal(a.buildMaterialLine(hdf.name,[{w:1000,h:1000,qty:0}],hdf,{}).qty,0);count++;
 const front=seeds.find(x=>x.materialType==='lakier');assert.equal(a.buildMaterialLine(front.name,[{w:300,h:720,qty:1}],front,{}).qty,.216);count++;
 const mat=seeds.find(x=>x.id==='m1'),small=[{w:500,h:500,qty:1,name:'Bok'}],large=[{w:1500,h:1500,qty:1,name:'Bok'}];
 const smallPlan=await a.computePlanForMaterial(mat.name,small),largePlan=await a.computePlanForMaterial(mat.name,large);
 assert.equal(a.buildMaterialLine(mat.name,small,{...mat,billingIncrement:'half-sheet'},smallPlan).qty,.5);assert.equal(a.buildMaterialLine(mat.name,large,{...mat,billingIncrement:'half-sheet'},largePlan).qty,1);assert.equal(a.buildMaterialLine(mat.name,large,{...mat,billingIncrement:'sheet'},largePlan).qty,1);count++;
 assert.equal(a.buildMaterialLine(mat.name,small,{...mat,priceUnit:'m2',billingIncrement:'sheet'},smallPlan).qty,5.796);assert.equal(a.buildMaterialLine(mat.name,small,{...mat,priceUnit:'sheet',billingIncrement:'m2'},{}).qty,1/5.796);assert.equal(a.buildMaterialLine(mat.name,[],mat,{plan:{sheets:[]}}).qty,0);count++;
 const aggregate=f.rozrysScope.aggregatePartsForProject(['room_k','room_s'],{safeGetProject:()=>r.s.projectData,getRooms:()=>['room_k','room_s'],getCabinetCutList:(_cab,room)=>[{name:'Bok',material:mat.name,a:50,b:50,qty:1}],resolveRozrysPartFromSource:p=>({materialKey:p.material,name:p.name,w:p.a*10,h:p.b*10,qty:p.qty,sourceSig:p.material+'-Bok',direction:'default'})});
 assert.equal(aggregate.materials.length,1);assert.equal(aggregate.groups[mat.name].allParts[0].qty,2);const both=await a.computePlanForMaterial(mat.name,aggregate.groups[mat.name].allParts);assert.equal(a.buildMaterialLine(mat.name,aggregate.groups[mat.name].allParts,mat,both).qty,1);count++;
 assert.throws(()=>a.buildMaterialLine(mat.name,small,mat,{}),/Nie potwierdzono kompletnego/);assert.throws(()=>a.buildMaterialLine(mat.name,small,mat,{plan:{sheets:[],workerFailed:true}}),/Nie potwierdzono kompletnego/);assert.throws(()=>a.buildMaterialLine(mat.name,[...small,...small],mat,smallPlan),/Nie potwierdzono kompletnego/);assert.equal(a.buildMaterialLine(mat.name,[],mat,{plan:{sheets:[{placements:[]}]}}).qty,0);count++;
 assert.throws(()=>normalize({...manual,pricingMode:'markup'}),/MATERIAL_PURCHASE_PRICE_REQUIRED/);count++;
 assert.equal(f.rozrysSheetModel.billableSheetFraction({placements:[{x:0,y:0,w:1300,h:1900}],realHalfBoardW:1400,realHalfBoardH:2070},{width:2800,height:2070},10),.5);count++;
 const legacyHdf={...hdf,name:'HDF biały 3 mm',price:77};delete legacyHdf.sheetWidthMm;delete legacyHdf.sheetHeightMm;delete legacyHdf.thicknessMm;c.savePriceList('materials',seeds.map(x=>x.id==='m4'?legacyHdf:x));assert.equal(sel.findSheetMaterial('HDF 3mm biała').price,77);assert.equal(sel.findSheetMaterial('HDF 3mm biała').billingIncrement,'m2');count++;
 const renamed={...mat,name:'Moja płyta',aliases:[mat.name]};c.savePriceList('materials',c.getSheetMaterials().map(x=>x.id==='m1'?renamed:x));assert.equal(sel.findSheetMaterial(mat.name).id,'m1');assert.equal(sel.findSheetMaterial({materialId:'m1'}).name,'Moja płyta');count++;
 if(!f.globalDataContract)vm.runInContext(fs.readFileSync('js/app/cloud/global-data-contract.js','utf8'),r.s);for(const row of c.getSheetMaterials())f.globalDataContract.schemas.materials(row,'material');assert.throws(()=>f.globalDataContract.schemas.materials({...mat,pricingMode:'markup'},'material'),/GLOBAL_REQUIRED_FIELD/);assert.throws(()=>f.globalDataContract.schemas.materials({...mat,pricingMode:'markup',purchasePrice:100,markupPercent:20,price:999},'material'),/GLOBAL_VALUE_INVALID/);assert.throws(()=>f.globalDataContract.schemas.materials({...mat,hiddenMaterialHack:1},'material'),/GLOBAL_UNKNOWN_FIELD/);count++;
 const channel={width:60,height:82,openingSystem:'korytkowy',bodyColor:'Moja płyta',details:{channelOrientation:'horizontal'}};
 const extra=(cab,scope)=>f.materialTabData.addChannelEdges({body:0,front:0,total:0},cab,scope);
 assert.equal(extra(channel).body,1.2);
 assert.equal(extra({...channel,details:{channelOrientation:'vertical'}}).total,1.64);
 assert.equal(extra({...channel,bodyPcvMode:'front'}).front,1.2);
 assert.equal(extra(channel,{includeCorpus:false}).total,0,'Front-only selection excludes a board channel');
 assert.equal(extra(channel,{kind:'material',material:'Unrelated'}).total,0,'Other material gets no channel PCV');
 assert.equal(extra({...channel,openingSystem:'podchwyt'}).total,0);
 assert.throws(()=>extra({...channel,details:{channelOrientation:'bad'}}),/Nie potwierdzono PCV korytka/);
 count++;
 const channelQty=f.workQuantityFacts.getCabinetFact({},channel,'opening.channel_count');
 assert.equal(channelQty.value,1);assert.equal(channelQty.available,true);
 const rates={workshop:150,assembly:250};
 for(const [id,hours,price]of [['labor_channel_install',.5,125],['labor_channel_workshop',5/60,12.5]]){
  const row=f.laborCatalogDefinitions.DEFAULT_LABOR_DEFINITIONS.find(row=>row.id===id);
  assert.ok(row,id);const result=f.laborCatalog.calculateDefinition(row,{quantity:channelQty.value,hourlyRates:rates});
  assert.equal(result.pricedHours,hours);assert.equal(result.total,price);
  assert.equal(f.laborCatalog.calculateDefinition(row,{quantity:0,hourlyRates:rates}).total,0);
 }
 count++;
 const fronts=[{name:'Front',qty:2,a:30,b:60}],opening={id:'opening',type:'wisząca',subType:'standardowa',width:60,height:82,depth:36,frontCount:2,details:{}};
 const openingInfo=mode=>f.cabinetHardwareRequirements.getOpeningInfo({},Object.assign({},opening,{openingSystem:mode}),fronts);
 assert.equal(openingInfo('uchwyt klienta').handleQty,2);assert.equal(openingInfo('uchwyt klienta').hexaQty,0);
 assert.equal(openingInfo('krawędziowy HEXA GTV').hexaQty,2);
 assert.equal(openingInfo('TIP-ON').tiponQty,2);assert.equal(openingInfo('TIP-ON').handleQty,0);
 const mixed={...opening,openingSystem:'TIP-ON',drawerRequirements:[{qty:1,technical:{drawerKind:'box',usage:'frontowa'}}]};
 assert.equal(f.cabinetHardwareRequirements.getOpeningInfo({},mixed,[{qty:3,a:60,b:20}]).tiponQty,2,'A drawer excludes only its own door plunger; independent doors retain theirs');
 assert.equal(f.cabinetHardwareRequirements.getOpeningInfo({},mixed,[]).code,'OPENING_FRONTS_UNCONFIRMED','A drawer/front mismatch cannot invent a negative count');
 assert.equal(openingInfo('podchwyt').handleQty,0);assert.equal(openingInfo('korytkowy').handleQty,0);
 assert.equal(f.cabinetHardwareRequirements.getOpeningInfo({},Object.assign({},opening,{openingSystem:'krawędziowy HEXA GTV'}),[{qty:1,a:10,b:60}]).code,'OPENING_HANDLE_TOO_WIDE');
 for(const [id,rate,minutes]of [['labor_handle_layout','assembly',5],['labor_handle_install','assembly',1],['pdf_tipon_drill','workshop',5],['pdf_tipon_insert','workshop',1],['pdf_tipon_plate','assembly',1]]){
  const row=f.laborCatalogDefinitions.DEFAULT_LABOR_DEFINITIONS.find(row=>row.id===id);assert.equal(row.rateType,rate);
  assert.ok(Math.abs(f.laborCatalog.calculateDefinition(row,{quantity:2,hourlyRates:rates}).total-2*minutes/60*rates[rate])<.01);
  assert.equal(f.laborCatalog.calculateDefinition(row,{quantity:0,hourlyRates:rates}).total,0);
 }
 assert.equal(f.laborCatalogDefinitions.LABOR_REPLACEMENTS.pdf_handle_screw[0],'labor_handle_install','Old screw quantities have a separate legacy ID; never reinterpreted as handle quantities');
 for(const [id,price]of [['hw_seed_gtv_hexa_96_black',5.71],['hw_seed_blum_tipon_long_956a1004',17.9]])assert.equal(c.getAccessories().find(row=>row.id===id).purchasePriceGross,price);
 count++;
 // Exercise the real quotation resolver at its hardware boundary with pinned
 // opening requirements. Catalog edits remain live and are not a fit cache.
 const originalParts=f.cabinetCutlist.getCabinetCutList,originalCabs=f.wycenaCoreSource.selectedCabinets;
 const originalRoomSources=f.roomQuoteSources,originalAccessories=c.getAccessories;
 try{
  const req=f.cabinetHardwareRequirements.getOpeningRequirements({},Object.assign({},opening,{openingSystem:'krawędziowy HEXA GTV'}),fronts)[0];
  f.roomQuoteSources={enabled:()=>false,input:room=>room};f.wycenaCoreSource.selectedCabinets=()=>[{roomId:'test',roomLabel:'Kuchnia',cabinet:opening}];
  f.cabinetCutlist.getCabinetCutList=()=>[{a:0,b:0,material:req.label,qty:req.qty,hardwareRequirement:req}];
  const records=originalAccessories.call(c);let reads=0;
  c.getAccessories=()=>{reads++;return records;};
  let lines=f.wycenaCoreLines.collectAccessories(['test']);
  const line=lines.find(row=>row.resolvedHardwareItemId===req.catalogItemId);
  assert.ok(line);assert.equal(line.qty,2);assert.ok(line.total>0);assert.equal(reads,1,'One coherent catalog snapshot per synchronous calculation');
  const live=records.find(row=>row.id===req.catalogItemId);live.price=99;live.quotePriceGross=99;live.pricingMode='manualPrice';live.priceUserEditedAt='2026-11-23';
  assert.equal(f.wycenaCoreLines.collectAccessories(['test']).find(row=>row.resolvedHardwareItemId===req.catalogItemId).total,198,'Next calculation reads current private price');
  live.hardwareUnit='kpl.';assert.throws(()=>f.wycenaCoreLines.collectAccessories(['test']),/konkretnego okucia/,'A changed pricing unit cannot silently reuse a per-handle quantity');live.hardwareUnit='szt.';
  records.push({...live});assert.throws(()=>f.wycenaCoreLines.collectAccessories(['test']),/konkretnego okucia/,'Ambiguous ID cannot choose one price');records.pop();
  live.symbol='another handle';assert.throws(()=>f.wycenaCoreLines.collectAccessories(['test']),/konkretnego okucia/,'Changed SKU under the same ID must not bypass the fit proof');
 }finally{f.cabinetCutlist.getCabinetCutList=originalParts;f.wycenaCoreSource.selectedCabinets=originalCabs;f.roomQuoteSources=originalRoomSources;c.getAccessories=originalAccessories;}
 count++;
 const rear={name:'Plecy zewnętrzne 18 mm — PCV dookoła',material:'Laminat korpus 18 mm',backPosition:'external',materialThicknessMm:18,a:60,b:82,qty:1};
 assert.deepEqual(clone(f.materialEdgeStore.defaultEdgesForPart(rear,{})),{w1:true,w2:true,h1:true,h2:true});
 assert.equal(f.materialEdgeStore.edgingMetersForPart(rear,f.materialEdgeStore.defaultEdgesForPart(rear,{})),2.84);
 assert.deepEqual(clone(f.materialEdgeStore.defaultEdgesForPart({...rear,backPosition:'internal'},{})),{w1:false,w2:false,h1:false,h2:false},'Internal backs do not silently inherit external perimeter edging');
 count++;
 console.log('material-catalog-authority smoke: '+count+'/'+count+' PASS');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
