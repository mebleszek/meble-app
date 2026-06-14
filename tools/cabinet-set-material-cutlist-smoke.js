#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function assert(cond, msg, data){ if(!cond){ throw new Error(msg + (data ? '\n' + JSON.stringify(data, null, 2) : '')); } }
function loadContext(){
  const ctx = { console, Math, Number, String, JSON };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.FC = { utils:{ uid:()=> 'uid_' + Math.random().toString(36).slice(2), clone:(v)=> JSON.parse(JSON.stringify(v)) } };
  ctx.projectData = {
    schemaVersion:9,
    kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ legHeight:10, bottomHeight:82 } }
  };
  vm.createContext(ctx);
  [
    'js/app/material/material-common.js',
    'js/app/cabinet/front-hardware-weights.js',
    'js/app/cabinet/front-hardware-fronts.js',
    'js/app/cabinet/front-hardware-hinges.js',
    'js/app/cabinet/front-hardware.js',
    'js/app/cabinet/cabinet-hardware-requirement-options.js',
    'js/app/cabinet/cabinet-hardware-requirements.js',
    'js/app/cabinet/cabinet-cutlist.js'
  ].forEach((file)=> vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename:file }));
  return ctx;
}
(function main(){
  const ctx = loadContext();
  const lead = { id:'lead', setId:'set-a', setNumber:1, type:'stojąca', subType:'standardowa', width:132, height:82, depth:51, bodyColor:'W1100', frontMaterial:'akryl', frontColor:'biały', frontCount:2, openingSystem:'uchwyt klienta', details:{} };
  const follower = { id:'follower', setId:'set-a', setNumber:1, type:'moduł', subType:'standardowa', width:132, height:23, depth:50, bodyColor:'W1100', frontMaterial:'akryl', frontColor:'biały', frontCount:0, openingSystem:'uchwyt klienta', details:{} };
  ctx.projectData.kuchnia.cabinets = [lead, follower];
  ctx.projectData.kuchnia.fronts = [];
  ctx.projectData.kuchnia.sets = [
    { id:'set-a', presetId:'A', number:1, params:{ w1:66, w2:66, hB:82, hTop:23 }, frontCount:2, frontMaterial:'akryl', frontColor:'biały' }
  ];

  const leadParts = ctx.FC.cabinetCutlist.getCabinetCutList(lead, 'kuchnia');
  const followerParts = ctx.FC.cabinetCutlist.getCabinetCutList(follower, 'kuchnia');
  const leadFrontQty = leadParts.filter((part)=> part && part.name === 'Front').reduce((sum, part)=> sum + Number(part.qty || 0), 0);
  const leadHingeQty = leadParts.filter((part)=> /zawias/i.test(String(part && part.name || ''))).reduce((sum, part)=> sum + Number(part.qty || 0), 0);
  const followerFrontQty = followerParts.filter((part)=> part && part.name === 'Front').reduce((sum, part)=> sum + Number(part.qty || 0), 0);
  const followerHingeQty = followerParts.filter((part)=> /zawias/i.test(String(part && part.name || ''))).reduce((sum, part)=> sum + Number(part.qty || 0), 0);

  assert(leadFrontQty === 2, 'MATERIAŁ/cutlista musi pokazać 2 fronty zestawu przy korpusie prowadzącym, nawet gdy projectData.fronts jest puste', leadParts);
  assert(leadHingeQty === 8, 'MATERIAŁ/cutlista musi pokazać zawiasy zestawu przy korpusie prowadzącym: 2×4', leadParts);
  assert(followerFrontQty === 0, 'Korpus nieprowadzący zestawu nie może dublować frontów zestawu', followerParts);
  assert(followerHingeQty === 0, 'Korpus nieprowadzący zestawu nie może dublować zawiasów zestawu', followerParts);
  console.log('OK cabinet-set-material-cutlist smoke');
})();
