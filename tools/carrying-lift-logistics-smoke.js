#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function run(ctx, rel){ vm.runInContext(read(rel), ctx, { filename: rel }); }
function approx(actual, expected, eps = 0.0001, msg){ assert.ok(Math.abs(Number(actual) - Number(expected)) <= eps, `${msg || 'approx'}: got ${actual}, expected ${expected}`); }

const project = {
  room_a:{
    label:'A',
    cabinets:[
      { id:'cab_light', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51 },
      { id:'cab_heavy', type:'stojąca', subType:'wysoka', width:80, height:220, depth:60 }
    ]
  }
};
let investor = {
  id:'inv1',
  carrying:{
    floorNumber:'3',
    elevatorStatus:'yes',
    elevator:{ doorWidthCm:'90', doorHeightCm:'230', cabinDepthCm:'120', cabinHeightCm:'230' },
    note:''
  }
};

const context = {
  console,
  Date,
  Math,
  setTimeout,
  clearTimeout,
  window:null,
  document:{ createElement(){ return { setAttribute(){}, appendChild(){}, className:'', style:{}, children:[] }; } },
  projectData:project,
};
context.window = context;
context.globalThis = context;
context.FC = {
  utils:{
    clone(value){ return JSON.parse(JSON.stringify(value)); },
    uid(){ return 'uid_test'; }
  },
  wycenaCoreUtils:{
    slug(value){ return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
  },
  wycenaCoreSource:{
    project(){ return project; },
    roomLabel(roomId){ return project[roomId] && project[roomId].label || roomId; }
  },
  investorPersistence:{
    getCurrentInvestorId(){ return investor.id; },
    getInvestorById(){ return investor; }
  },
  cabinetCutlist:{
    getCabinetCutList(cabinet){
      if(cabinet.id === 'cab_light'){
        return [
          { name:'Bok lewy', qty:2, a:72, b:40, material:'laminat' },
          { name:'Wieniec dolny', qty:2, a:50, b:40, material:'laminat' },
          { name:'Plecy HDF', qty:1, a:70, b:48, material:'HDF' },
          { name:'Półka luźna', qty:3, a:56, b:48, material:'laminat' },
          { name:'Front', qty:2, a:78, b:29, material:'front' },
          { name:'Blenda', qty:1, a:10, b:80, material:'laminat' }
        ];
      }
      return [
        { name:'Bok lewy', qty:2, a:220, b:60, material:'laminat' },
        { name:'Wieniec dolny', qty:2, a:80, b:60, material:'laminat' },
        { name:'Trawers', qty:4, a:76, b:10, material:'laminat' },
        { name:'Plecy HDF', qty:1, a:218, b:78, material:'HDF' },
        { name:'Front', qty:2, a:216, b:39, material:'front' },
        { name:'Półka luźna', qty:5, a:76, b:56, material:'laminat' }
      ];
    }
  },
  frontHardware:{
    FC_FRONT_WEIGHT_KG_M2:{ laminat:13 },
    getCabinetFrontCutListForMaterials(){ return []; }
  },
  cabinetHardwareRequirements:{ getHingeRequirementsWithQty(){ return []; } },
  cabinetDrawerRequirements:{ getDrawerRequirementsWithQty(){ return []; } },
  laborApplianceRules:{ getApplianceForCabinet(){ return null; }, isMountingEnabled(){ return false; } }
};
vm.createContext(context);

run(context, 'js/app/pricing/labor-catalog-definitions.js');
run(context, 'js/app/pricing/labor-catalog.js');
run(context, 'js/app/pricing/work-quantity-sources.js');
run(context, 'js/app/pricing/carrying-logistics.js');
run(context, 'js/app/pricing/work-quantity-facts.js');
context.FC.catalogSelectors = {
  getQuoteRates(){ return context.FC.laborCatalog.ensureDefaultDefinitions([]); }
};
run(context, 'js/app/wycena/wycena-core-labor.js');

const carrying = context.FC.carryingLogistics;
assert.ok(carrying, 'FC.carryingLogistics exists');

let fit = carrying.orientationFits([60, 210, 51], investor.carrying);
assert.equal(fit.fits, true, 'cabinet should fit elevator orientation');
assert.deepEqual(fit.orientation.doorPair, [60, 210], 'expected door-pair orientation');
assert.equal(fit.orientation.cabinDepth, 51, 'third dimension should use cabin depth');

let noLift = carrying.orientationFits([60, 210, 51], { elevatorStatus:'no' });
assert.equal(noLift.fits, false, 'no elevator should not fit');

const lightWeight = carrying.estimateBodyWeight('room_a', project.room_a.cabinets[0]);
assert.ok(lightWeight.weightKg > 0, 'body weight should be calculated');
assert.ok(lightWeight.weightKg < 20, `light cabinet body should stay below threshold, got ${lightWeight.weightKg}`);
assert.ok(lightWeight.parts.some((p)=>p.name === 'Bok lewy'), 'body side included');
assert.ok(!lightWeight.parts.some((p)=>/^Półka|^Front|^Blenda/.test(p.name)), 'fronts/shelves/blends excluded');

let evLight = carrying.evaluateCabinet('room_a', project.room_a.cabinets[0], investor);
assert.equal(evLight.liftFits, true, 'light cabinet fits lift');
assert.equal(evLight.floorUnits, 2, 'lift fit counts as 2 carrying levels');
assert.equal(evLight.peopleCount, 1, 'light cabinet uses one helper');
assert.equal(evLight.requiresDisassembly, false, 'light cabinet does not require disassembly');

investor = { id:'inv1', carrying:{ floorNumber:'3', elevatorStatus:'no', elevator:{} } };
let evHeavy = carrying.evaluateCabinet('room_a', project.room_a.cabinets[1], investor);
assert.equal(evHeavy.liftFits, false, 'no lift means stairs');
assert.equal(evHeavy.floorUnits, 4, 'third floor without lift counts as 4 levels');
assert.equal(evHeavy.peopleCount, 1, 'disassembled heavy cabinet uses one helper per flat element');
assert.equal(evHeavy.requiresDisassembly, true, 'over-threshold stairs cabinet requires disassembly');
assert.equal(evHeavy.carryingItemCount, 3, 'after disassembly only large flat items are counted for stairs');
assert.equal(evHeavy.disassembled.stairsItemCount, 3, 'without lift all large flat items go by stairs');
assert.ok(evHeavy.bodyWeightKg > 45, `heavy body should exceed threshold, got ${evHeavy.bodyWeightKg}`);
assert.equal(evHeavy.highFronts.itemCount, 2, 'two high fronts over 2m should be detected');
assert.equal(evHeavy.highFronts.stairsItemCount, 2, 'without lift high fronts are counted for stairs');
assert.equal(evHeavy.highFronts.stairsFloorUnits, 4, 'high fronts by stairs use investor floor units');


const diagonalLift = { floorNumber:'5', elevatorStatus:'yes', elevator:{ doorWidthCm:'80', doorHeightCm:'210', cabinDepthCm:'110', cabinHeightCm:'220' } };
let evDiag = carrying.evaluateCabinet('room_a', project.room_a.cabinets[1], { id:'inv2', carrying:diagonalLift });
assert.equal(evDiag.requiresDisassembly, true, 'heavy cabinet not fitting whole requires disassembly');
assert.equal(evDiag.disassembled.stairsItemCount, 0, 'side panels fitting through door and cabin diagonal are not counted for stairs');
assert.equal(evDiag.carryingItemCount, 0, 'no stair carrying line when all large disassembled items fit lift');
assert.equal(evDiag.highFronts.elevatorItemCount, 2, 'high fronts fitting through door/cabin diagonals are counted as elevator items');
assert.equal(evDiag.highFronts.stairsItemCount, 0, 'high fronts fitting elevator are not counted for stairs');
assert.equal(evDiag.highFronts.elevatorItems[0].lift.method, 'cabin_diagonal', 'high front uses cabin diagonal when needed');

const blockedSide = carrying.flatElementFitsLift({ name:'Bok', aCm:220, bCm:90 }, diagonalLift);
assert.equal(blockedSide.fits, false, 'side wider than elevator door width must not pass only because cabin diagonal is long enough');
assert.equal(blockedSide.method, 'door_blocked', 'wide side is blocked by elevator door width');

const fact = context.FC.workQuantityFacts.getCabinetFact('room_a', project.room_a.cabinets[1], 'carrying.requires_disassembly');
assert.equal(fact.value, 1, 'requires disassembly fact should be 1');
assert.equal(context.FC.workQuantitySources.find('carrying.floor_units').status, 'system', 'carrying floor source should be system');
assert.equal(context.FC.workQuantitySources.find('carrying.stairs_item_count').status, 'system', 'carrying stair item source should be system');
assert.equal(context.FC.workQuantitySources.find('cabinet.weight_kg').status, 'system', 'cabinet weight source should be system');
const normalizedCarrying = context.FC.carryingLogistics.normalizeCarrying({ elevatorStatus:'yes', elevator:{ doorWidthCm:'80', doorHeightCm:'200', cabinWidthCm:'120', cabinDepthCm:'140', cabinHeightCm:'210', capacityKg:'400' } });
assert.ok(!Object.prototype.hasOwnProperty.call(normalizedCarrying.elevator, 'cabinWidthCm'), 'normalizeCarrying drops cabinWidthCm');
assert.ok(!Object.prototype.hasOwnProperty.call(normalizedCarrying.elevator, 'capacityKg'), 'normalizeCarrying drops capacityKg');
assert.equal(normalizedCarrying.elevator.cabinDepthCm, '140', 'normalizeCarrying keeps cabin depth');
assert.equal(normalizedCarrying.elevator.cabinHeightCm, '210', 'normalizeCarrying keeps cabin height');

const defs = context.FC.laborCatalogDefinitions.DEFAULT_LABOR_DEFINITIONS;
assert.ok(defs.some((d)=>d.id === 'labor_carrying_cabinet'), 'default labor includes carrying item');
assert.ok(defs.some((d)=>d.id === 'labor_carrying_disassembly'), 'default labor includes disassembly item');

const lines = context.FC.wycenaCoreLabor.collectCabinetLabor(['room_a']);
const heavyLine = lines.find((line)=>line.cabinetId === 'cab_heavy');
assert.ok(heavyLine, 'heavy cabinet labor line exists');
const carryingPart = heavyLine.details.find((row)=>row.sourceRole === 'carrying-labor');
assert.ok(carryingPart, 'carrying labor component exists');
assert.equal(carryingPart.rateType, 'helper', 'carrying uses helper rate');
assert.equal(carryingPart.quantitySource, 'carrying.floor_units', 'carrying quantity source is floor units');
assert.equal(carryingPart.quantity, 4, 'carrying quantity is floor units');
assert.equal(carryingPart.multiplier, 3, 'carrying multiplier is one helper times three stair elements');
approx(carryingPart.baseHours, 0.25 + 4 * 0.0833333333, 0.0002, 'base hours = 15 min + 4*5 min');
approx(carryingPart.hours, (0.25 + 4 * 0.0833333333) * 3, 0.0002, 'priced hours multiplied by disassembled stair elements');
assert.ok(carryingPart.note.includes('po schodach: 3 szt.'), 'audit note includes stair element count');
const highFrontPart = heavyLine.details.find((row)=>row.sourceRole === 'carrying-high-front-labor');
assert.ok(highFrontPart, 'high front carrying component exists');
assert.equal(highFrontPart.rateType, 'helper', 'high front carrying uses helper rate');
assert.equal(highFrontPart.name, 'Wnoszenie wysokich frontów — po schodach', 'high front carrying line is explicit');
assert.equal(highFrontPart.quantity, 4, 'high front stairs quantity is floor units');
assert.equal(highFrontPart.multiplier, 2, 'two high fronts are counted as two helper passes');
approx(highFrontPart.hours, (0.25 + 4 * 0.0833333333) * 2, 0.0002, 'high front hours = base stairs hours times front count');
assert.ok(highFrontPart.note.includes('Wysokie fronty powyżej 200 cm'), 'high front audit mentions threshold');
const disassemblyPart = heavyLine.details.find((row)=>row.sourceRole === 'carrying-disassembly-labor');
assert.ok(disassemblyPart, 'disassembly component exists');
assert.equal(disassemblyPart.rateType, 'assembly', 'disassembly uses assembly rate');
approx(disassemblyPart.hours, 1, 0.0001, 'disassembly is 1 hour');

const index = read('index.html');
const devTests = read('dev_tests.html');
assert.ok(index.includes('js/app/pricing/carrying-logistics.js?v=20260614_labor_items_time_display_v1'), 'index loads carrying-logistics');
assert.ok(index.includes('js/app/investor/investor-carrying.js?v=20260614_labor_items_time_display_v1'), 'index loads investor-carrying');
assert.ok(devTests.includes('js/app/pricing/carrying-logistics.js?v=20260614_labor_items_time_display_v1'), 'dev_tests loads carrying-logistics');
assert.ok(devTests.includes('js/app/investor/investor-carrying.js?v=20260614_labor_items_time_display_v1'), 'dev_tests loads investor-carrying');

const group = require(path.join(ROOT, 'tools/index-load-groups.js'));
const business = group.INDEX_LOAD_GROUPS.find((row)=>row.id === 'business-domains');
assert.ok(business.scripts.includes('js/app/pricing/carrying-logistics.js'), 'load group includes carrying-logistics');
assert.ok(business.scripts.includes('js/app/investor/investor-carrying.js'), 'load group includes investor-carrying');

console.log('Carrying lift logistics smoke: OK');
