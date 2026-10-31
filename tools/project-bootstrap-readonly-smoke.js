'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{fixture}=require('./project-selective-export-smoke');
const r=fixture(),before=r.storage.getItem('fc_projects_v1');let writes=0;
r.FC.project.save=()=>{writes++;throw Error('Navigation must not Save');};
new Function('window',fs.readFileSync('js/app/investor/project-bootstrap.js','utf8'))(r.s);
const normalize=r.FC.projectBootstrap.normalizeProjectData;
const clean=structuredClone(r.s.projectData);normalize(clean,r.FC.project.DEFAULT_PROJECT);assert.equal(writes,0);assert.equal(r.storage.getItem('fc_projects_v1'),before);
const legacy=structuredClone(clean);delete legacy.kuchnia.cabinets[0].frontCount;delete legacy.kuchnia.cabinets[0].details;
normalize(legacy,r.FC.project.DEFAULT_PROJECT);assert.equal(legacy.kuchnia.cabinets[0].frontCount,2);assert.deepEqual(legacy.kuchnia.cabinets[0].details,{});
assert.equal(writes,0);assert.equal(r.storage.getItem('fc_projects_v1'),before);
console.log('PASS navigation normalization only fills RAM defaults; no implicit Save, project timestamp or RAW mutation');

new Function('window',fs.readFileSync('js/app/bootstrap/app-state-bootstrap.js','utf8'))(r.s);
r.FC.appStateBootstrap.createInitialState({FC:r.FC,storageKeys:r.FC.constants.STORAGE_KEYS,defaultProject:r.FC.project.DEFAULT_PROJECT});
assert.equal(writes,0,'Startup validation must not invoke Save');assert.equal(r.storage.getItem('fc_projects_v1'),before);
const app=fs.readFileSync('js/app.js','utf8');
const validation=app.slice(app.indexOf('/* ===== Runtime validation'),app.indexOf('/* ===== Modal state'));
assert.equal(/FC\.project\.save\(/.test(validation),false,'Direct startup validation and normalization fallback must also be read-only');
console.log('PASS actual startup bootstrap and direct validation/fallback do not save or migrate historical project data');
