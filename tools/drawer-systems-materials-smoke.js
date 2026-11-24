#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function load(ctx, rel){ vm.runInContext(read(rel), ctx, { filename:rel }); }
function assert(cond, msg, details){
  if(!cond){
    console.error('FAIL:', msg);
    if(details !== undefined){ try{ console.error(JSON.stringify(details, null, 2)); }catch(_){ console.error(details); } }
    process.exit(1);
  }
}
function clone(v){ return JSON.parse(JSON.stringify(v)); }
const FC = {
  utils:{ clone },
  frontHardware:{ getCabinetFrontCutListForMaterials(){ return []; }, getHingeCountForCabinet(){ return 0; } },
  cabinetHardwareRequirements:{ getHingeRequirementsWithQty(){ return []; }, getHingeRequirementWithQty(){ return null; } }
};
const ctx = { window:{ FC }, FC, console, JSON, String, Number, Array, Object, Set, Map, Math };
ctx.globalThis = ctx.window;
ctx.projectData = { kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{}, preferences:{ hardwareDrawerSystems:{ drawers:'gtv_axis_pro' }, hardwareProducers:{ drawers:'GTV' } } } };
ctx.window.projectData = ctx.projectData;
vm.createContext(ctx);
[
  'js/app/catalog/hardware-catalog-seed-data.js',
  'js/app/catalog/hardware-drawer-catalog.js',
  'js/app/material/material-common.js',
  'js/app/room-preferences/room-preferences-model.js',
  'js/app/cabinet/cabinet-drawer-requirements.js',
  'js/app/cabinet/cabinet-drawer-selection.js',
  'js/app/cabinet/cabinet-cutlist.js', 'js/app/cabinet/cabinet-inner-drawers.js'
].forEach((file)=> load(ctx, file));

const prefsApi = ctx.window.FC.roomPreferences;
const drawerApi = ctx.window.FC.cabinetDrawerRequirements;
const cutApi = ctx.window.FC.cabinetCutlist;
assert(prefsApi && drawerApi && cutApi, 'API szuflad/preferencji/cutlisty musi być dostępne');
const pref = prefsApi.normalizeRoomPreferences({ hardwareDrawerSystems:{ drawers:'gtv_axis_pro' } });
assert(pref.drawerPreference.kind === 'system' && pref.drawerPreference.systemKey === 'gtv_axis_pro', 'Preferencje normalizują system GTV Axis Pro', pref);
assert(/GTV Axis Pro/.test(prefsApi.getHardwareProducerSummary(pref)), 'Podsumowanie preferencji pokazuje konkretny system, nie tylko producenta', prefsApi.getHardwareProducerSummary(pref));

const boxCab = { id:'box', type:'stojąca', subType:'szuflady', width:60, height:82, depth:51, bodyColor:'Laminat korpus 18 mm', backMaterial:'HDF', frontMaterial:'laminat', frontColor:'biały', frontCount:3, details:{ drawerLayout:'3_equal', drawerSystem:'skrzynkowe', innerDrawerType:'brak' } };
const boxReqs = drawerApi.getDrawerRequirements('kuchnia', clone(boxCab));
assert(boxReqs.length === 1 && boxReqs[0].qty === 3, 'Skrzynkowa szafka zwraca 3 wymagania prowadnic', boxReqs);
assert(boxReqs[0].technical.drawerKind === 'box', 'Skrzynkowe mają drawerKind=box', boxReqs[0]);
assert(boxReqs[0].technical.boxSidesThicknessMm === 18 && boxReqs[0].technical.boxBottomThicknessMm === 10, 'Skrzynkowe zapisują 18 mm na skrzynkę i 10 mm na dno', boxReqs[0]);
assert(boxReqs[0].technical.runnerType==='undermount'&&boxReqs[0].technical.runnerSeries==='TANDEM BLUMOTION'&&boxReqs[0].technical.manufacturer==='Blum','Without a runner preference the owner default is TANDEM BLUMOTION');
assert(drawerApi.getDrawerRequirements('kuchnia',{...boxCab,details:{...boxCab.details,drawerBrand:'gtv'}})[0].technical.manufacturer==='Blum','A leftover system manufacturer is not a chosen wooden-runner preference');
const parts = cutApi.getCabinetCutList(clone(boxCab), 'kuchnia');
const whiteCab=clone(boxCab);whiteCab.details.drawerBottomColor='white';
const greyCab=clone(boxCab);greyCab.details.drawerBottomColor='grey';
const bottomOf=cab=>cutApi.getCabinetCutList(cab,'kuchnia').find(part=>/^Dno szuflady/.test(part.name));
assert(bottomOf(whiteCab).material==='Dno szuflad 10 mm białe','Białe dno ma własny materiał, niezależny od korpusu',bottomOf(whiteCab));
assert(bottomOf(greyCab).material==='Dno szuflad 10 mm szare','Szare dno ma osobny materiał i rozkrój',bottomOf(greyCab));
assert(drawerApi.needsBottomColor('kuchnia',boxCab)===true,'Każda rzeczywista szuflada skrzynkowa wymaga koloru dna');
assert(drawerApi.bottomMaterial(boxCab)===null,'Nie przypisujemy starej szufladzie koloru bez wyboru');
assert(bottomOf(whiteCab).a===bottomOf(greyCab).a&&bottomOf(whiteCab).b===bottomOf(greyCab).b,'Kolor nie zmienia zatwierdzonej geometrii dna');
const boxParts = parts.filter((part)=> part && part.group === 'Szuflady skrzynkowe');
assert(boxParts.length >= 3, 'Cutlista dodaje osobną podgrupę Szuflady skrzynkowe', parts);
assert(boxParts.filter(part=>/^Bok szuflady/.test(part.name)&&part.materialThicknessMm===18&&part.material==='Laminat korpus 18 mm').reduce((n,p)=>n+p.qty,0)===6, 'Boki szuflad skrzynkowych są z materiału korpusu 18 mm', boxParts);
assert(boxParts.filter(part=>/^Tył szuflady/.test(part.name)&&part.materialThicknessMm===18).reduce((n,p)=>n+p.qty,0)===3, 'Tyły szuflad skrzynkowych są z 18 mm', boxParts);
assert(boxParts.filter(part=>/^Dno szuflady.*10 mm/.test(part.name)&&part.materialThicknessMm===10&&/10 mm/.test(part.material)&&part.pcvEligible===false).reduce((n,p)=>n+p.qty,0)===3, 'Dna szuflad skrzynkowych są osobnym materiałem 10 mm bez PCV', boxParts);
assert(parts.some((part)=> part && part.hardwareRequirement && part.hardwareRequirement.category === 'Szuflady / prowadnice' && /prowadnice/.test(part.material)), 'Skrzynkowe dodają prowadnice jako okucie z wymaganiem katalogowym', parts);

const systemCab = { id:'sys', type:'stojąca', subType:'szuflady', width:40, height:82, depth:51, bodyColor:'Laminat', backMaterial:'HDF', frontCount:3, details:{ drawerLayout:'3_equal', drawerSystem:'systemowe', drawerBrand:'gtv', drawerModel:'axis_pro', drawerBottomColor:'white', innerDrawerType:'brak' } };
const systemReq = drawerApi.getDrawerRequirements('kuchnia', clone(systemCab))[0];
assert(systemReq.technical.drawerKind === 'system' && systemReq.technical.drawerSystemKey === 'gtv_axis_pro', 'Systemowe GTV Axis Pro zapisuje konkretny system techniczny', systemReq);
const systemParts = cutApi.getCabinetCutList(clone(systemCab), 'kuchnia');
assert(systemParts.some((part)=> part && part.hardwareRequirement && /system szuflady/i.test(part.material)), 'Systemowe dodają komplet systemu jako okucie', systemParts);
assert(!systemParts.some((part)=> part && part.group === 'Szuflady skrzynkowe'), 'Systemowe nie generują formatek skrzynkowych z 18/10 mm', systemParts);

const systemPanels=systemParts.filter(part=>part.materialThicknessMm===16);
assert(systemPanels.length===6&&systemPanels.every(p=>p.material==='Płyta szuflad systemowych 16 mm biała'),'Three real system drawers emit both16 mm panels in the chosen colour');
assert(systemPanels.filter(p=>p.name.startsWith('Dno')).every(p=>p.a===28.9&&p.b===47.6&&p.pcvEligible===false),'GTV floor uses actual selectedNL500 and LW-75/NL-24, separately from10 mm');
assert(systemPanels.filter(p=>p.name.startsWith('Tył')).every(p=>p.a===27.7&&p.b===19.9),'Selected D profile has the confirmed199 mm rear panel, not a universal height');
assert(drawerApi.needsBottomColor('kuchnia',systemCab),'System drawers require the same explicit white/grey decision');
assert(drawerApi.bottomMaterial({...systemCab,details:{...systemCab.details,drawerBottomColor:'grey'}},16).materialId==='m_drawer_bottom_16_grey','System grey resolves its own16 mm material ID');
const backGeometry=cutApi.backGeometry;
assert(typeof backGeometry==='function','A single construction source resolves rear mounting and usable drawer depth');
const baseBack={id:'back',type:'stojąca',subType:'standardowa',width:60,height:82,depth:50,backMaterial:'HDF 3mm biała',details:{}};
assert(backGeometry(baseBack,{}).usableDepthMm===500&&backGeometry(baseBack,{}).overallDepthMm===503,'Screwed lower HDF adds 3 mm outside and does not consume usable depth');
assert(backGeometry({...baseBack,backMaterial:'Brak'},{}).kind==='none','The actual existing no-back option remains supported');
assert(backGeometry({...baseBack,type:'moduł'},{}).usableDepthMm===500,'Modules use the lower-cabinet rear construction');
assert(backGeometry({...baseBack,type:'wisząca'},{}).usableDepthMm===480&&backGeometry({...baseBack,type:'wisząca'},{}).overallDepthMm===500,'Upper HDF uses the approved 20 mm setback, not another 3 mm deduction');
const boardBack={...baseBack,backMaterial:'Laminat korpus 18 mm'};
assert(backGeometry(boardBack,{}).code==='BACK_POSITION_REQUIRED','Old 18 mm backs need an explicit decision, not a hidden migration');
const inside={...boardBack,details:{backPosition:'internal'}},outside={...boardBack,details:{backPosition:'external'}};
assert(backGeometry(inside,{}).usableDepthMm===482&&backGeometry(inside,{}).overallDepthMm===500,'Internal 18 mm back consumes exactly 18 mm');
assert(backGeometry(inside,{}).backWidthCm===56.4&&backGeometry(inside,{}).backHeightCm===78.4,'Internal panel fits between the four structural boundaries');
assert(backGeometry(outside,{}).usableDepthMm===500&&backGeometry(outside,{}).overallDepthMm===518,'External 18 mm back extends the cabinet, not its interior');
const inheritedBack={...outside,bodyColor:'Laminat korpus 18 mm',backMaterial:'18 mm pod kolor korpusu'};
assert(cutApi.getCabinetCutList(inheritedBack,{}).find(p=>p.partRoleIds?.includes('body.back')).material===inheritedBack.bodyColor,'18 mm under body color resolves the actual material, not a phantom catalog item');
const externalPart=cutApi.getCabinetCutList(outside,{}).find(p=>p.partRoleIds?.includes('body.back'));
assert(externalPart.backPosition==='external'&&externalPart.materialThicknessMm===18&&/PCV/.test(externalPart.name),'Material output labels the external board and its full perimeter PCV');
const upperParts=cutApi.getCabinetCutList({...inside,type:'wisząca',details:{backPosition:'internal',shelves:1}},{});
assert(upperParts.find(p=>p.name==='Półka').b===47.7,'Shelf is 5 mm shorter than confirmed usable depth');
assert(upperParts.find(p=>p.name==='Wieniec górny').b===50,'Internal 18 mm back is between horizontal boards, not an HDF groove');
const innerLayout=cutApi.resolveInnerDrawerLayout;
assert(typeof innerLayout==='function','Inner front allocation has one physical source');
const innerCab={...baseBack,height:80,details:{}};
const full=innerLayout(innerCab,{},3,{distribution:'equal',space:'cabinet'});
assert(full.ok&&full.availableHeightMm===764,'The whole cabinet means the actual space between bottom and top, excluding 18 mm boards');
assert(full.fronts[0].bottomMm===5&&full.fronts.slice(1).every((f,i)=>f.bottomMm-full.fronts[i].topMm===30),'Inner fronts keep 5 mm below and exactly 30 mm between neighbours');
assert(full.fronts.at(-1).topMm===764&&Math.max(...full.fronts.map(f=>f.heightMm))-Math.min(...full.fronts.map(f=>f.heightMm))<=1,'Millimetre rounding conserves the complete allocated height');
const custom=innerLayout(innerCab,{},2,{distribution:'equal',space:'custom',spaceHeightCm:40});
assert(custom.ok&&custom.availableHeightMm===400&&custom.fronts.reduce((n,f)=>n+f.heightMm,0)+35===400,'The entered group height includes the declared gaps, not an extra cabinet span');
assert(innerLayout(innerCab,{},2,{space:'custom',spaceHeightCm:90}).code==='INNER_DRAWER_SPACE_EXCEEDED','A declared space cannot extend outside the cabinet');
assert(innerLayout(innerCab,{},3,{distribution:'declared',heightType:'front',heightsCm:[15,20,25]}).fronts.at(-1).topMm===665,'Independent declared front heights conserve bottom and inter-front gaps');
assert(innerLayout(innerCab,{},3,{distribution:'declared',heightType:'front',heightsCm:[30,30,30]}).code==='INNER_DRAWERS_DO_NOT_FIT','Oversized fronts cannot silently overlap');
const declaredInside=innerLayout({...innerCab,height:90},{},3,{distribution:'declared',heightType:'inside',heightsCm:[15,20,25]});
assert(declaredInside.ok&&declaredInside.fronts.map(f=>f.heightMm).join(',')==='200,250,300','The confirmed inside height is above the bottom; a wooden inner front extends30 mm above its side');
assert(declaredInside.fronts[0].boxSideHeightMm===170&&declaredInside.fronts[0].boxOverallHeightMm===170,'The owner bottom is inside extended sides; clear interior starts20 mm above their lower edge');
assert(declaredInside.fronts[0].frontWidthMm===556,'A600 mm cabinet with18 mm sides has4 mm clearance on EACH side of its inner wooden front');
load(ctx,'js/app/cabinet/cabinet-hardware-requirements.js');
const channelInfo=ctx.FC.cabinetHardwareRequirements.getChannelInfo;
assert(typeof channelInfo==='function','Korytko ma wspólne źródło ilości i długości PCV');
const channelCab={...boxCab,openingSystem:'korytkowy',details:{}};
assert(channelInfo(channelCab).count===1&&channelInfo(channelCab).edgeMeters===1.2,'Poziome korytko: jedno, dwa razy szerokość 60 cm');
channelCab.details.channelOrientation='vertical';
assert(channelInfo(channelCab).edgeMeters===1.64,'Pionowe korytko: dwa razy wysokość 82 cm');
assert(channelInfo({...channelCab,openingSystem:'podchwyt'}).count===0,'Podchwyt nie jest korytkiem');
assert(channelInfo({...channelCab,height:0}).ok===false,'Nieznany wymiar blokuje ilość, zamiast naliczać zero');
assert(channelInfo({...channelCab,details:{channelOrientation:'unknown'}}).ok===false,'Nieprawidłowy kierunek nie udaje poziomego');
load(ctx,'js/app/cabinet/cabinet-drawer-selection.js');
const choose=ctx.FC.cabinetDrawerSelection;
assert(typeof choose.woodenSection==='function','Owner construction has one runner-dependent physical section');
const ownerSection=choose.woodenSection({insideHeightMm:150});
assert(ownerSection.ok&&ownerSection.sideHeightMm===170&&ownerSection.crosspieceHeightMm===150&&ownerSection.bottomRecessMm===10&&ownerSection.bottomThicknessMm===10&&ownerSection.frontHeightMm===200,'Owner20 mm shorter crosspieces and10 mm bottom are preserved despite the documented Blum exception');
const shallowSection=choose.woodenSection({insideHeightMm:79});
assert(shallowSection.runnerType==='ball'&&shallowSection.bottomThicknessMm===3&&shallowSection.bottomRecessMm===0&&shallowSection.sideHeightMm===79,'Below80 mm clear height uses ball runners and externally screwed HDF3 mm');
assert(choose.woodenSection({insideHeightMm:80}).runnerType==='undermount','At80 mm the shallow-drawer exception ends');
const woodFit=choose.woodenGeometry({section:ownerSection,insideWidthMm:564,availableDepthMm:500});
assert(woodFit.ok&&woodFit.lengthMm===450&&woodFit.sideLengthMm===440&&woodFit.innerWidthMm===515&&woodFit.bottomWidthMm===515,'560F uses source NL-10 and LW-49, not the old50 mm heuristic or outer-width bottom');
assert(woodFit.ownerConstructionException==='BLUM_560F_RECESS_10_MM_OWNER_APPROVED','Manufacturer exception remains explicit in the physical result');
assert(choose.woodenGeometry({section:ownerSection,insideWidthMm:564,availableDepthMm:503}).lengthMm===500,'Exact external NL+3 permits the longest confirmed length');
assert(choose.woodenGeometry({section:ownerSection,insideWidthMm:564,availableDepthMm:503,inner:true}).lengthMm===450,'An18 mm inner front also consumes cabinet depth');
const gtvOptions={section:ownerSection,insideWidthMm:400,availableDepthMm:505,manufacturer:'GTV',series:'MODERN SLIDE 3D'};
assert(choose.woodenGeometry(gtvOptions).lengthMm===500&&choose.woodenGeometry({...gtvOptions,availableDepthMm:504}).lengthMm===450,'GTV18 has its own NL+5 limit; it does not inherit Blum NL+3');
assert(choose.woodenGeometry({...gtvOptions,insideWidthMm:700}).code==='DRAWER_WIDTH_EXCEEDS_RUNNER_LIMIT','A sourced GTV width restriction is never silently ignored');
const shallowFit=choose.woodenGeometry({...gtvOptions,section:shallowSection,availableDepthMm:503});
assert(shallowFit.ok&&shallowFit.sideLengthMm===500&&shallowFit.bottomWidthMm===374.6&&shallowFit.bottomThicknessMm===3,'GTV ball construction uses12.7 mm per side and a full externally screwed HDF bottom');
const variant=(id,lengthMm,installHeightMm)=>({id,sku:id,family:'blum_tandembox_antaro',usage:'frontowa',complete:true,lengthMm,installDepthMm:lengthMm+3,installHeightMm,loadKg:30,supplierId:'bivert',color:'white',sourceUrl:'https://bivert.pl/',technicalSourceUrl:'https://publications.blum.com/2026/catalogue/en/296/'});
const candidates=[variant('M450',450,98.5),variant('D450',450,224),variant('M500',500,98.5),variant('D500',500,224)];
const options={family:'blum_tandembox_antaro',availableDepthMm:500,frontHeightMm:283,candidates};
assert(choose.forFront(options).selected.id==='D450','500 mm miejsca nie mieści prowadnicy 500+3; automat bierze 450 i najwyższy profil mieszczący się pod frontem minus 40');
assert(choose.forFront({...options,availableDepthMm:backGeometry(outside,{}).usableDepthMm}).selected.id==='D450','An externally deeper cabinet must not pretend its drawer space grew');
assert(choose.forFront({...options,availableDepthMm:503}).selected.id==='D500','Dokładna granica NL+3 jest dopuszczona');
assert(choose.forFront({...options,frontHeightMm:139}).selected.id==='M450','Mniejszy front dostaje niższy profil według katalogowego miejsca');
assert(choose.forFront({...options,frontHeightMm:100}).ok===false,'Brak miejsca nie oznacza wybrania za wysokiego profilu');
assert(choose.forFront({...options,candidates:[{...candidates[0],complete:false}]}).ok===false,'Para boków nie udaje całego zestawu');
assert(choose.forFront({...options,candidates:[{...candidates[0],installDepthMm:undefined}]}).ok===false,'Nie zgadujemy brakującego luzu montażowego');
assert(choose.forFront({...options,candidates:[{...candidates[0],sourceUrl:''}]}).code==='DRAWER_SOURCE_UNCONFIRMED','Dobór wymaga źródła ceny i specyfikacji');
// Catalogue metadata is checked against the current editable record, never a
// stale price embedded in the selector. Duplicate IDs and changed SKUs refuse.

load(ctx,'js/app/catalog/hardware-catalog-seeds.js');
const pricebook=ctx.FC.hardwareDrawerCatalog,seeds=ctx.FC.hardwareCatalogSeedData.ACCESSORY_SEEDS;
assert(typeof pricebook.physicalLoads==='function','Load classes come from the manufacturer, independently of which class has a price');
assert(pricebook.physicalLoads({family:'blum_legrabox',lengthMm:500}).join(',')==='40,70','LEGRABOX500 offers its actual40/70 kg classes');
assert(pricebook.physicalLoads({family:'blum_legrabox',lengthMm:300}).join(',')==='40','A short LEGRABOX cannot invent a70 kg runner');
assert(pricebook.physicalLoads({family:'blum_legrabox',lengthMm:650}).join(',')==='70','The650 mm variant has only the actual70 kg class');
assert(pricebook.physicalLoads({family:'blum_tandem',lengthMm:500,motion:'push'}).join(',')==='30','Integrated TANDEM TIP-ON requires no invented selection of a separate pusher force');
assert(choose.systemForFront({family:'blum_merivobox',usage:'frontowa',availableDepthMm:503,frontHeightMm:283,insideWidthMm:564,minLoadKg:70}).selected?.loadKg===70,'The chosen70 kg capacity reaches the real sourced hardware variant');
assert(choose.systemForFront({family:'blum_legrabox',usage:'frontowa',availableDepthMm:503,frontHeightMm:283,insideWidthMm:564,minLoadKg:100}).code==='DRAWER_LOAD_UNAVAILABLE','An unavailable capacity cannot silently fall back to a weaker runner');
assert(choose.requestedLoad({details:{} })===0,'An older cabinet without a load field keeps the lowest OEM class as its default');
assert(choose.requestedLoad({details:{drawerLoadKg:'70',innerDrawerLoadKg:30}})===70&&choose.requestedLoad({details:{innerDrawerLoadKg:30}},true)===30,'Independent exterior/interior capacity choices read the persisted selection');
for(const value of [0,-1,'bad',Infinity]){let error;try{choose.requestedLoad({details:{drawerLoadKg:value}});}catch(e){error=e;}assert(error?.code==='DRAWER_LOAD_INVALID','Invalid capacities refuse instead of assuming the lowest: '+value);}
const capacityCab={...systemCab,width:60,details:{...systemCab.details,drawerBrand:'blum',drawerModel:'merivobox'}};
const capacityBefore=JSON.stringify(capacityCab);
assert(JSON.stringify(choose.capacityGroups('kuchnia',capacityCab))===JSON.stringify([{key:'drawerLoadKg',options:[40,70]}]),'The UI offers the OEM capacity classes for its actual family and length');
assert(JSON.stringify(capacityCab)===capacityBefore,'Discovering load choices cannot edit the source or start a dirty session');
const capacityParts=cutApi.getCabinetCutList({...capacityCab,details:{...capacityCab.details,drawerLoadKg:70}},'kuchnia');
assert(capacityParts.filter(p=>p.hardwareRequirement?.drawerFit).every(p=>pricebook.specFor(p.hardwareRequirement.drawerFit.selectedId).loadKg===70),'Every physical drawer retains the stronger chosen variant, not just its UI label');
const fullHeightCab={...capacityCab,height:72,details:{...capacityCab.details,drawerLayout:'1_big',heightIncludesLegs:'0',drawerLoadKg:40}};
assert(typeof choose.isFullHeightSingle==='function','The large single drawer has one shared72 cm body rule');
assert(choose.isFullHeightSingle('kuchnia',fullHeightCab),'Exactly720 mm body with one full-height drawer activates the stronger class');
assert(!choose.isFullHeightSingle('kuchnia',{...fullHeightCab,height:71.9}),'719 mm does not activate the72 cm rule');
assert(!choose.isFullHeightSingle('kuchnia',{...fullHeightCab,details:{...fullHeightCab.details,drawerLayout:'3_equal'}}),'Three smaller drawers do not inherit the full-height rule');
assert(choose.isFullHeightSingle({settings:{legHeight:10}},{...fullHeightCab,height:82,details:{...fullHeightCab.details,heightIncludesLegs:'1'}}),'Standing body height excludes the actual legs:820-100=720');
assert(!choose.isFullHeightSingle({settings:{legHeight:10.1}},{...fullHeightCab,height:82,details:{...fullHeightCab.details,heightIncludesLegs:'1'}}),'Leg height must not falsely activate the threshold');
const fullBefore=JSON.stringify(fullHeightCab),fullGroups=choose.capacityGroups('kuchnia',fullHeightCab);
assert(fullGroups[0].forced&&fullGroups[0].options.join(',')==='70','A full-height single system drawer offers the strongest class rather than the normal low default');
assert(JSON.stringify(fullHeightCab)===fullBefore,'The stronger automatic rule does not rewrite the saved source merely by opening it');
assert(cutApi.getCabinetCutList(fullHeightCab,'kuchnia').filter(p=>p.hardwareRequirement?.drawerFit).every(p=>{const fit=p.hardwareRequirement.drawerFit,spec=pricebook.specFor(fit.selectedId);return spec.loadKg===70&&spec.profile==='E'&&spec.lengthMm===500;}),'The one tall drawer reaches the strongest, highest and longest fitting physical kit');
for(const [load,module]of [[40,'L3'],[70,'L5']]){
 const push=choose.systemForFront({family:'blum_merivobox',usage:'frontowa',availableDepthMm:503,frontHeightMm:720,insideWidthMm:564,minLoadKg:load,motion:'push'});
 assert(push.ok&&push.selected.loadKg===load&&push.motionAddon?.module===module,'MERIVOBOX automatically pairs the selected runner class with its own module: '+load);
}
assert(pricebook.motionSpec({family:'blum_merivobox',lengthMm:300,loadKg:40})?.module==='S1','Short nominal lengths select their dedicated module without a contents-weight input');
assert(!pricebook.motionSpec({family:'blum_merivobox',lengthMm:300,loadKg:70}),'A short runner cannot borrow the long70 kg module');
assert(!pricebook.motionSpec({family:'blum_tandem',lengthMm:500,loadKg:30}),'An integrated TANDEM runner never adds a separate MERIVOBOX module');
const largeLegra=choose.systemForFront({family:'blum_legrabox',usage:'frontowa',availableDepthMm:503,frontHeightMm:720,insideWidthMm:564,forceMaxLoad:true,motion:'push'});
assert(largeLegra.ok&&largeLegra.selected.family==='blum_legrabox'&&largeLegra.selected.profile==='F'&&largeLegra.selected.loadKg===70&&largeLegra.selected.blumotionS&&largeLegra.motionAddon?.module==='L5','A tall LEGRABOX stays in the chosen family, with its highest solid side and stronger S runner plus automatic L5');
const ordinaryLegra=choose.systemForFront({family:'blum_legrabox',usage:'frontowa',availableDepthMm:503,frontHeightMm:720,insideWidthMm:564,motion:'push'});
assert(ordinaryLegra.ok&&ordinaryLegra.selected.loadKg===40&&ordinaryLegra.motionAddon?.module==='L3','Ordinary LEGRABOX keeps the lowest class and its own module');
assert(pricebook.motionSpec({family:'blum_legrabox',lengthMm:300,loadKg:40})?.module==='S1','A short LEGRABOX has its own S1 module');
const confirmedSpecs=pricebook.allSpecs;
try{pricebook.allSpecs=()=>confirmedSpecs().map(row=>({...row,blumotionS:false}));assert(!choose.systemForFront({family:'blum_legrabox',usage:'frontowa',availableDepthMm:503,frontHeightMm:720,insideWidthMm:564,motion:'push'}).ok,'An unspecified old runner cannot inherit BLUMOTION S compatibility');}finally{pricebook.allSpecs=confirmedSpecs;}
for(const lengthMm of [450,500,550]){
 const chosen=choose.systemForFront({family:'blum_tandembox_antaro',usage:'frontowa',availableDepthMm:lengthMm+3,frontHeightMm:720,insideWidthMm:564,forceMaxLoad:true,motion:'push'});
 assert(chosen.ok&&chosen.selected.loadKg===65&&chosen.selected.doubleGallery&&chosen.selected.lengthMm===lengthMm&&chosen.motionAddon?.sku==='T60B3560 TOB R+LV1 S','A large Antaro selects the true65 kg double-gallery BOM and its automatic push module');
 const proof=pricebook.doubleGalleryProof(chosen.selected.id),row=seeds.find(s=>s.id===chosen.selected.id);
 assert(proof.parts.some(p=>/ZRG/.test(p.sku)&&p.qty===2)&&proof.parts.some(p=>/ZRR/.test(p.sku)&&p.qty===1)&&proof.parts.some(p=>/Z30B/.test(p.sku)&&p.qty===1),'Double gallery means two L/R rail pairs AND the correct flexible/rear fixings');
 assert(!proof.parts.some(p=>/578\./.test(p.sku))&&proof.parts.some(p=>/576\./.test(p.sku)&&p.qty===1),'The BOM purchases exactly one stronger runner pair; no unused30 kg pair or second drawer kit');
 assert(Math.round(proof.parts.reduce((n,p)=>n+p.qty*p.unitGross,0)*100)/100===row.catalogPriceGross,'The explicitly assembled starter price equals every sourced component quantity, not an invented shop-kit price');
 proof.parts[0].qty=999;assert(pricebook.doubleGalleryProof(chosen.selected.id).parts[0].qty===1,'Provenance views cannot mutate the stored construction proof');
}
assert(!choose.systemForFront({family:'blum_tandembox_antaro',usage:'frontowa',availableDepthMm:603,frontHeightMm:720,insideWidthMm:564,forceMaxLoad:true}).ok,'An unconfirmed600 mm double gallery cannot silently borrow the550 mm kit or single gallery');
const allCandidates=pricebook.candidates(seeds),kits=allCandidates.filter(row=>row.productKind==='system'&&row.manufacturer==='Blum'&&row.family!=='blum_metabox');
const runners=allCandidates.filter(row=>row.productKind==='runner');
assert(runners.length===46&&runners.filter(r=>r.family==='gtv_modern_slide_3d').length===8,'The chosen GTV18 family and complete TANDEM/ball runner pairs have46 sourced price records');
assert(choose.woodenGeometry({...gtvOptions,motion:'push'}).family==='gtv_modern_slide_p2o','GTV push uses its dedicated18 mm P2O family, not a door plunger or incompatible SoftMove add-on');
assert(choose.woodenGeometry({section:ownerSection,insideWidthMm:564,availableDepthMm:300,motion:'push'}).lengthMm===270,'TANDEM TIP-ON uses its verified270 mm variant when300+3 does not fit');
const sourceSpecs=pricebook.allSpecs;
try{
 pricebook.allSpecs=()=>sourceSpecs().filter(row=>!(row.family==='gtv_gx_h45'&&row.lengthMm===450)&&!(row.family==='blum_tandem'&&row.lengthMm===270&&row.motion==='soft'));
 assert(choose.woodenGeometry({section:ownerSection,insideWidthMm:564,availableDepthMm:300}).code==='DRAWER_VARIANT_NOT_CONFIRMED','Missing confirmed270 mm soft-close kit must refuse, not silently shorten the drawer to250 mm');
 assert(choose.woodenGeometry({...gtvOptions,section:shallowSection,motion:'push',availableDepthMm:500}).code==='DRAWER_VARIANT_NOT_CONFIRMED','A missing450 mm GX push price must not silently produce a400 mm drawer');
}finally{pricebook.allSpecs=sourceSpecs;}
assert(choose.woodenGeometry({...gtvOptions,motion:'push',availableDepthMm:503}).lengthMm===500,'GTV P2O uses source NL+3, distinct from soft-close NL+5');
const meta=pricebook.allSpecs().filter(row=>row.family==='blum_metabox');assert(meta.length===15&&meta.every(row=>row.loadKg===25),'Source kits with included front mounts do not inherit an invented30 kg minimum');
assert(pricebook.panelGeometry(pricebook.allSpecs().find(row=>row.family==='blum_merivobox'&&row.profile==='N'),564).backHeightMm===60,'Owner explicitly selected a60 mm MERIVOBOX N back instead of OEM60.5');
assert(choose.systemForFront({family:'blum_merivobox',usage:'frontowa',availableDepthMm:553,frontHeightMm:139,insideWidthMm:564}).selected.sku==='Merivobox L-550 N antracyt - komplet','The complete sourced550/N kit closes its own missing length without borrowing a shorter quote');
const kg=choose.systemForFront({family:'blum_legrabox',usage:'frontowa',availableDepthMm:503,frontHeightMm:200,insideWidthMm:564});
assert(kg.ok&&kg.selected.profile==='K'&&kg.selected.sku==='8880314430'&&kg.panels.backHeightMm===101,'LEGRABOX K500 uses the exact white configuration price and real101 mm rear panel');
assert(allCandidates.filter(row=>row.manufacturer==='Rejs').length===106,'Every new Rejs price record has matching source SKU and physical metadata');
for(const family of ['rejs_comfort_box_plus','rejs_ultra_box']){
 const fit=choose.systemForFront({family,usage:'frontowa',availableDepthMm:500,frontHeightMm:283,insideWidthMm:564});
 assert(fit.ok&&fit.selected.lengthMm===450&&fit.selected.profile==='199'&&fit.panels.backHeightMm===199&&fit.panels.bottomLengthMm===426,'Each Rejs family uses its own highest fitting profile and true floor/back geometry');
 const push=choose.systemForFront({family,usage:'frontowa',motion:'push',availableDepthMm:500,frontHeightMm:283,insideWidthMm:564});
 assert(push.ok===(family==='rejs_ultra_box'),'Only the sourced dedicated Ultra Box push kit can be selected; Plus cannot inherit it');
 if(push.ok)assert(push.selected.sku==='TH03.1229.01.003'&&push.selected.loadKg===40&&push.selected.installHeightMm===230,'Push without an optional synchronizer keeps its own OEM SKU and installation envelope');
}
assert(choose.systemForFront({family:'rejs_comfort_box_plus',usage:'frontowa',availableDepthMm:500,frontHeightMm:139,insideWidthMm:564}).selected.profile==='69','The sourced PlusH69 kit fits the standard small drawer while H84 does not');
assert(prefsApi.getDrawerSystemOptions().some(row=>row.key==='rejs_comfort_box_plus')&&prefsApi.getDrawerSystemOptions().some(row=>row.key==='rejs_ultra_box')&&!prefsApi.getDrawerSystemOptions().some(row=>row.key==='rejs_systemowe'),'Only the two approved Rejs families are new choices');
assert(prefsApi.getDrawerSystemOption('rejs_systemowe').model==='rejs_systemowe','A stored older Rejs preference is retained without silently converting it to Plus');
assert(choose.systemForFront({family:'blum_metabox',usage:'frontowa',availableDepthMm:500,frontHeightMm:250,insideWidthMm:564}).selected.profile==='H','METABOX selects its tallest fitting sourced profile');
assert(choose.systemForFront({family:'blum_metabox',usage:'frontowa',availableDepthMm:553,frontHeightMm:250,insideWidthMm:564}).selected.lengthMm===550,'The configured550 mm METABOX includes confirmed and priced front mounts');
const originalSpecs=pricebook.allSpecs;
try{
 pricebook.allSpecs=()=>originalSpecs().filter(row=>!(row.family==='blum_tandembox_antaro'&&row.lengthMm===450&&row.profile==='D')&&!(row.family==='blum_metabox'&&row.lengthMm===550&&row.profile==='H'));
 assert(choose.systemForFront({family:'blum_metabox',usage:'frontowa',availableDepthMm:553,frontHeightMm:250,insideWidthMm:564}).code==='DRAWER_VARIANT_NOT_CONFIRMED','An unpriced550 mm METABOX must not silently become the priced500 mm kit');
 assert(choose.systemForFront({family:'blum_tandembox_antaro',usage:'frontowa',availableDepthMm:500,frontHeightMm:283,insideWidthMm:564}).code==='DRAWER_VARIANT_NOT_CONFIRMED','A missing tallest fitting kit must refuse rather than silently choose a lower profile');
}finally{pricebook.allSpecs=originalSpecs;}
assert(pricebook.physicalTarget({family:'blum_legrabox',availableDepthMm:353,heightLimitMm:300}).profile==='C','The manufacturer does not offer LEGRABOX F below400 mm');
assert(pricebook.physicalTarget({family:'blum_legrabox',availableDepthMm:653,heightLimitMm:150}).profile==='M','The manufacturer does not offer LEGRABOX K above600 mm');
assert(pricebook.physicalTarget({family:'blum_legrabox',usage:'wewnętrzna',availableDepthMm:503,heightLimitMm:150}).profile==='K','The OEM inner K142 envelope cannot silently become the lower priced M104 profile');
assert(kits.filter(row=>row.supplierId==='bivert').length===135,'All135 original Bivert kits retain validated physical metadata');assert(kits.filter(row=>row.supplierId==='intar').length===21,'All21 supplemental Intar kits retain full source metadata');
assert(kits.every(row=>row.installHeightMm>0&&row.installDepthMm===row.lengthMm+3&&row.sku&&row.depthSourceUrl),'Every kit has manufacturer installation space and SKU');
const kit=kits.find(row=>row.family==='blum_tandembox_antaro'&&row.usage==='frontowa'&&row.profile==='M'&&row.lengthMm===450);
assert(kit&&kit.loadKg>=30,'Confirmed Antaro M450 fixture exists');
assert(pricebook.candidates([{...kit.item,symbol:'different SKU'}]).length===0,'An edited identity cannot inherit another product specification');
assert(pricebook.candidates([{...kit.item,technicalParams:{...kit.item.technicalParams,dlugosc_mm:{from:999,to:999}}}]).length===0,'Changed length cannot inherit the factory fit');
assert(pricebook.candidates([{...kit.item,technicalParams:{...kit.item.technicalParams,nosnosc_kg:{from:999,to:999}}}]).length===0,'Edited capacity metadata cannot relabel a weaker factory kit as stronger');
assert(pricebook.candidates([{...kit.item,hardwareUnit:'szt.'}]).length===0,'A changed unit cannot masquerade as a complete kit');
assert(pricebook.candidates([{...kit.item,technicalParams:{...kit.item.technicalParams,zastosowanie:{value:'wewnętrzna'}}}]).length===0,'An inner drawer cannot inherit front-drawer fit');
assert(pricebook.candidates([kit.item,kit.item]).length===0,'Duplicate source IDs refuse rather than choose arbitrarily');
assert(pricebook.candidates([{...kit.item,status:'inactive'}]).length===0,'Inactive variant is not eligible');
assert(pricebook.candidates([{...kit.item,status:'archived'}]).length===0&&pricebook.candidates([{...kit.item,status:'hidden'}]).length===0,'Archived or hidden hardware cannot reappear through source metadata');
const edited={...kit.item,catalogPriceGross:321,purchasePriceGross:234,priceUserEditedAt:'2026-11-23'};
const merged=ctx.FC.hardwareCatalogSeeds.mergeAccessorySeeds([edited]);
assert(merged.find(row=>row.id===edited.id).catalogPriceGross===321&&merged.find(row=>row.id===edited.id).purchasePriceGross===234,'New kit seeding preserves private commercial data');
ctx.FC.catalogStore={getAccessories:()=>seeds};
assert(!prefsApi.runnerSeries('undermount','Blum').includes('TANDEMBOX antaro'),'System kits cannot masquerade as wooden drawer runners');
load(ctx,'js/app/cabinet/cabinet-modal-draft.js');
const compareDraft=ctx.FC.cabinetModalDraft.comparableCabinetDraft;
const previousCabinets=ctx.projectData.kuchnia.cabinets;
ctx.projectData.kuchnia.cabinets=[{...capacityCab,details:{...capacityCab.details,drawerLoadKg:70,innerDrawerLoadKg:70}}];
const previousSource=JSON.stringify(ctx.projectData.kuchnia.cabinets),newDraft=ctx.FC.cabinetModalDraft.makeDefaultCabinetDraftForRoom('kuchnia');
assert(choose.requestedLoad(newDraft)===0&&choose.requestedLoad(newDraft,true)===0,'A newly added cabinet starts at the lowest class, not the previous cabinet’s70 kg choice');
assert(JSON.stringify(ctx.projectData.kuchnia.cabinets)===previousSource,'Preparing the next cabinet cannot edit the saved70 kg cabinet');
ctx.projectData.kuchnia.cabinets=previousCabinets;
assert(JSON.stringify(compareDraft({...baseBack,details:{}}))===JSON.stringify(compareDraft({...baseBack,details:{backPosition:''}})),'Opening an unselected rear option cannot create a fictitious edit');


const innerBox={...baseBack,height:90,id:'inner-box',details:{insideMode:'szuflady_wew',innerDrawerType:'skrzynkowe',innerDrawerCount:'3',drawerBottomColor:'white',innerDrawerDistribution:'declared',innerDrawerSpace:'cabinet',innerDrawerHeightType:'inside',innerDrawerHeightsCm:[15,20,25]}};
const innerParts=cutApi.getCabinetCutList(innerBox,{}),innerFronts=innerParts.filter(p=>p.name.startsWith('Front wewnętrzny'));
const systemInner={...innerBox,details:{...innerBox.details,innerDrawerType:'systemowe',drawerBrand:'blum',drawerModel:'tandembox_antaro'}},systemInnerBefore=JSON.stringify(systemInner);
assert(ctx.FC.cabinetInnerDrawers.layout({},systemInner).code==='INNER_SYSTEM_INSIDE_HEIGHT_UNCONFIRMED','The approved interior-height declaration cannot pretend a metal system is a wooden box');
assert(JSON.stringify(systemInner)===systemInnerBefore,'Refusing the wooden declaration on a metal system preserves every stored input');
const declaredSystemFronts=ctx.FC.cabinetInnerDrawers.layout({},{...systemInner,details:{...systemInner.details,innerDrawerHeightType:'front'}});
assert(declaredSystemFronts.ok&&declaredSystemFronts.fronts.map(f=>f.heightMm).join(',')==='150,200,250','System front-space declarations remain exact; no wooden30 mm extension is added');
assert(innerFronts.length===3&&innerFronts.every(p=>p.a===55.6),'Every inner front has the confirmed4 mm gap on both sides');
assert(innerFronts.map(p=>p.b).join(',')==='20,25,30','Each distinct declared height survives into real material parts');
assert(innerParts.filter(p=>p.name.startsWith('Bok szuflady')).map(p=>p.b).join(',')==='17,22,27','Sides extend20 mm below the declared clear interior');
assert(innerParts.filter(p=>p.name.startsWith('Dno szuflady')).length===3,'Every drawer retains its independent bottom part');
assert(JSON.stringify(innerBox.details.innerDrawerHeightsCm)==='[15,20,25]','Generating parts must not rewrite the declared source');
assert(innerParts.filter(p=>p.drawerConstructionRole==='crosspiece').map(p=>p.b).join(',')==='15,15,20,20,25,25','Both front and back crosspieces are20 mm lower than their corresponding sides');
const shallowBox={...innerBox,width:40,details:{...innerBox.details,innerDrawerCount:'1',innerDrawerHeightsCm:[7.9]}};
assert(drawerApi.needsBottomColor({},shallowBox)===false,'A shallow HDF-only drawer does not require or price a10 mm colour');
const shallowParts=cutApi.getCabinetCutList(shallowBox,{}),shallowBottom=shallowParts.find(p=>p.name.startsWith('Dno szuflady'));
assert(shallowBottom.material==='HDF'&&shallowBottom.materialThicknessMm===3&&shallowBottom.pcvEligible===false,'The selected shallow drawer emits real HDF3 mm, not a renamed10 mm plate');
load(ctx,'js/app/material/material-edge-store.js');
const edges=ctx.FC.materialEdgeStore.defaultEdgesForPart;
assert(JSON.stringify(edges(innerParts.find(p=>p.drawerConstructionRole==='side'),innerBox))===JSON.stringify({w1:true,w2:true,h1:false,h2:false}),'Drawer sides retain only top and bottom PCV');
assert(JSON.stringify(edges(innerParts.find(p=>p.drawerConstructionRole==='crosspiece'),innerBox))===JSON.stringify({w1:true,w2:false,h1:false,h2:false}),'Drawer crosspieces retain only their top PCV');

// Price the actual cutlist through the same production collector. Source rows
// and dimensions must agree; a generic cheap runner never substitutes for it.
load(ctx,'js/app/cabinet/front-hardware-fronts.js');
load(ctx,'js/app/catalog/hardware-technical-params.js');
load(ctx,'js/app/catalog/hardware-catalog.js');
let pricedCab={...whiteCab,id:'priced'},pricedRows=seeds;
ctx.FC.catalogStore={getAccessories:()=>pricedRows,getHardwareTechnicalParams:()=>ctx.FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS};
ctx.FC.wycenaCoreUtils={slug:s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'_')};
ctx.FC.wycenaCoreCatalog={accessoryPriceLookup:()=>null,servicePriceLookup:()=>null};
ctx.FC.wycenaCoreSource={selectedCabinets:()=>[{roomId:'kuchnia',roomLabel:'Kuchnia',cabinet:pricedCab}],roomLabel:r=>r};
ctx.FC.wycenaCoreOffer={collectQuoteRateLines:()=>[]};
ctx.FC.wycenaCoreSelection={createQuoteValidationError:(code,title,message)=>Object.assign(Error(message),{code})};
load(ctx,'js/app/wycena/wycena-core-lines.js');
const actualPrices=()=>ctx.FC.wycenaCoreLines.collectAccessories(['kuchnia']).filter(r=>r.hardwareRequirement?.kind==='drawer');
const priced=actualPrices();
assert(priced.length===1&&priced[0].qty===3&&/560F5000B/.test(priced[0].resolvedHardwareSymbol)&&priced[0].total>0,'Three actual drawers select and price the complete500 mm TANDEM pairs');
const priceSource=seeds.find(r=>r.symbol===priced[0].resolvedHardwareSymbol),baselineSource=JSON.stringify(seeds);
pricedRows=seeds.map(r=>r.id===priceSource.id?{...r,catalogPriceGross:300,purchasePriceGross:300,pricingMode:'manual',priceManual:300,price:300,priceUserEditedAt:'2026-11-23'}:r);
assert(actualPrices()[0].total!==priced[0].total,'Changing the current editable runner price changes the quote; fit metadata does not cache money');
pricedRows=seeds.map(r=>r.id===priceSource.id?{...r,symbol:'different product'}:r);
let refused;try{actualPrices();}catch(e){refused=e;}
assert(refused?.code==='drawer_hardware_unresolved','An identity mismatch refuses; it cannot fall back to a generic or shorter runner');
assert(JSON.stringify(seeds)===baselineSource,'Pricing and rejected selection leave original catalog records unchanged');
pricedRows=seeds;pricedCab=clone(systemCab);
const systemPrices=actualPrices();assert(systemPrices.length===1&&systemPrices[0].qty===3&&systemPrices[0].resolvedHardwareSymbol==='PB-AXISPRO-KPL500D1','Production pricing uses the same GTV profile and length as the16 mm panels');
pricedCab={...capacityCab,details:{...capacityCab.details,drawerLoadKg:70}};
const strongerPrices=actualPrices();assert(strongerPrices.length===1&&pricebook.allSpecs().find(s=>s.sku===strongerPrices[0].resolvedHardwareSymbol)?.loadKg===70,'The quote prices the actual stronger OEM kit from the saved70 kg choice');
pricedCab={...capacityCab,openingSystem:'TIP-ON',details:{...capacityCab.details,drawerLoadKg:70}};
const withMotion=ctx.FC.wycenaCoreLines.collectAccessories(['kuchnia']);
const modulePrice=withMotion.find(row=>row.hardwareRequirement?.kind==='drawer-motion');
assert(modulePrice?.resolvedHardwareSymbol==='T60H4570'&&modulePrice.qty===3&&modulePrice.total>0,'Three MERIVOBOX drawers price exactly three complete L5 modules, separately from their sourced runner kits');
assert(!withMotion.some(row=>row.resolvedHardwareSymbol?.includes('956A1004')),'The automatic drawer module is never the door plunger');
pricedRows=seeds.map(row=>row.id==='hw_wior_drawer_12212'?{...row,symbol:'different module'}:row);
let moduleRefused;try{ctx.FC.wycenaCoreLines.collectAccessories(['kuchnia']);}catch(e){moduleRefused=e;}assert(moduleRefused?.code==='opening_hardware_unresolved','A changed module identity refuses the entire quote instead of skipping its cost');
pricedRows=seeds;
pricedCab={...fullHeightCab,openingSystem:'TIP-ON',details:{...fullHeightCab.details,drawerModel:'tandembox_antaro'}};
const doublePrices=ctx.FC.wycenaCoreLines.collectAccessories(['kuchnia']);
assert(doublePrices.filter(r=>r.hardwareRequirement?.kind==='drawer').length===1&&doublePrices.find(r=>r.hardwareRequirement?.kind==='drawer').resolvedHardwareSymbol==='BOM-ANTARO-D-2REL-500-65-WHITE','The large cabinet prices one actual stronger double-gallery BOM');
assert(doublePrices.find(r=>r.hardwareRequirement?.kind==='drawer-motion').resolvedHardwareSymbol==='T60B3560 TOB R+LV1 S','A separate dedicated Antaro push module is charged once, without a door plunger');
pricedCab={...fullHeightCab,openingSystem:'TIP-ON',details:{...fullHeightCab.details,drawerModel:'legrabox'}};
const legraPrices=ctx.FC.wycenaCoreLines.collectAccessories(['kuchnia']);
assert(legraPrices.find(r=>r.hardwareRequirement?.kind==='drawer').resolvedHardwareSymbol==='TAMFK-427212'&&legraPrices.find(r=>r.hardwareRequirement?.kind==='drawer-motion').resolvedHardwareSymbol==='T60L7570 TOB R+LV1 S','The actual quote prices one complete LEGRABOX F70 kit and one matching module, preserving family and source identities');
pricedCab={...capacityCab,details:{...capacityCab.details,drawerLoadKg:100}};let loadRefused;try{actualPrices();}catch(e){loadRefused=e;}assert(loadRefused?.code==='DRAWER_LOAD_UNAVAILABLE','Unsupported capacity cannot publish a cheaper weaker quote');
pricedCab={...systemCab,details:{...systemCab.details,drawerBottomColor:''}};let colorRefused;try{actualPrices();}catch(e){colorRefused=e;}assert(colorRefused?.code==='drawer_material_unconfirmed','Missing16 mm colour is refused, not silently assigned or charged as10 mm');
pricedRows=seeds;pricedCab={...whiteCab,openingSystem:'TIP-ON'};
const pushPrices=actualPrices();assert(pushPrices.length===1&&pushPrices[0].qty===3&&/560F5000T/.test(pushPrices[0].resolvedHardwareSymbol),'Drawer TIP-ON prices actual dedicated TANDEM pairs, not BLUMOTION or a door plunger');
pricedCab={...whiteCab,openingSystem:'TIP-ON',details:{...whiteCab.details,drawerRunnerType:'undermount',drawerRunnerSeries:'MODERN SLIDE 3D',drawerBrand:'gtv'}};
assert(actualPrices()[0].resolvedHardwareSymbol==='PB-0FPO18-500','GTV drawers choose their own P2O model and current price');
pricedCab={...whiteCab,details:{...whiteCab.details,drawerSystem:'systemowe',drawerBrand:'blum',drawerModel:'metabox'}};const mp=actualPrices();assert(mp.length===1&&mp[0].qty===3&&mp[0].resolvedHardwareSymbol==='320H500','METABOX includes a complete sourced hardware kit with front mounts');
const mparts=cutApi.getCabinetCutList(pricedCab,'kuchnia').filter(p=>p.materialThicknessMm===16);assert(mparts.length===6&&mparts.some(p=>p.a===53.3&&p.b===49.8)&&mparts.some(p=>p.a===53.3&&p.b===13.5),'METABOX16 mm panels use LW-31/NL-2 and source back height, not generic Antaro geometry');
pricedCab={...whiteCab,openingSystem:'TIP-ON',details:{...whiteCab.details,drawerSystem:'systemowe',drawerBrand:'rejs',drawerModel:'ultra_box'}};
assert(actualPrices()[0].resolvedHardwareSymbol==='TH03.1230.01.003','Production quote uses the sourced Ultra Box500/H199 push kit and its editable price');
pricedCab={...whiteCab,openingSystem:'TIP-ON'};
assert(ctx.FC.cabinetHardwareRequirements.getOpeningInfo('kuchnia',pricedCab,[{qty:3,a:60}]).tiponQty===0,'Drawer TIP-ON never adds three door956A1004 mechanisms or their door-specific labour');

const definitions=clone(ctx.FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS).filter(row=>row.key!=='profil_szuflady');
const privateDefinition=definitions.find(row=>row.key==='kolor_okucia');privateDefinition.options=['biały'];privateDefinition.label='Private label';
const suppliers=[{id:'bivert',name:'Private Bivert',defaultDiscountPercent:17,active:true}];
const inputBefore=JSON.stringify({definitions,suppliers}),deps=pricebook.seedDependencies({definitions,defaultDefinitions:ctx.FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS,suppliers,defaultSuppliers:ctx.FC.hardwareCatalog.DEFAULT_SUPPLIERS});
assert(JSON.stringify({definitions,suppliers})===inputBefore,'Dependency preparation cannot mutate private source rows');
assert(deps.definitions.find(row=>row.key==='profil_szuflady').options.includes('F')&&deps.definitions.find(row=>row.key==='kolor_okucia').options.includes('czarny carbon'),'Missing definitions and used enum values are available before normalization');
assert(deps.definitions.find(row=>row.key==='kolor_okucia').label==='Private label'&&deps.suppliers[0].name==='Private Bivert'&&deps.suppliers[0].defaultDiscountPercent===17,'Existing labels and supplier discounts are preserved');
const incompatible=clone(deps.definitions);incompatible.find(row=>row.key==='profil_szuflady').fieldType='number';
let definitionRefused;try{pricebook.seedDependencies({definitions:incompatible,defaultDefinitions:ctx.FC.hardwareTechnicalParams.DEFAULT_DEFINITIONS,suppliers,defaultSuppliers:ctx.FC.hardwareCatalog.DEFAULT_SUPPLIERS});}catch(e){definitionRefused=e;}
assert(definitionRefused?.message==='DRAWER_CATALOG_DEFINITION_CONFLICT','A private incompatible field type refuses before insertion, never strips a SKU identity');
console.log('OK drawer-systems-materials smoke');
console.log(' - preferencje szuflad przechowują konkretny system/model');
console.log(' - skrzynkowe generują prowadnice + formatki 18 mm i dno 10 mm');
console.log(' - systemowe zapisują wymaganie katalogowe bez udawania skrzynkowych');
