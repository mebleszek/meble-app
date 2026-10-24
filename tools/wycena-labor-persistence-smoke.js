#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),clone=v=>JSON.parse(JSON.stringify(v));
const {fixture}=require('./project-selective-export-smoke.js');
const {runtime,assertButtons}=require('./cabinet-modal-safe-dirty-smoke.js');
async function main(){
  const r=runtime();
  vm.runInContext(fs.readFileSync(path.join(root,'js/app/cabinet/cabinet-modal-labor.js'),'utf8'),r.sandbox);
  const before=JSON.stringify(r.sandbox.projectData);r.edit();assertButtons(r,false);
  async function select(id,value){const el=r.get(id);assert.ok(el,id);el.value=value;await el.emit('change');}
  assert.equal(r.get('cmLabor_shelfType').value,'adjustable');assert.equal(r.get('cmLabor_hingeDrilling').value,'workshop');
  assert.equal(r.get('cmLabor_shelfType').options.length,2);
  await select('cmLabor_shelfType','fixed');assertButtons(r,true);
  await select('cmLabor_shelfType','adjustable');assertButtons(r,false);
  await select('cmLabor_additionalLegs','2');await select('cmLabor_hingeDrilling','predrilled');assertButtons(r,true);
  assert.equal(JSON.stringify(r.sandbox.projectData),before,'Editing only touches draft');
  r.metrics.discard=true;await r.get('cabinetModalCancel').emit('click');
  assert.equal(JSON.stringify(r.sandbox.projectData),before,'Cancel preserves source');assert.equal(r.metrics.saves,0);
  r.edit();await select('cmLabor_additionalLegs','2');await select('cmLabor_shelfType','fixed');await select('cmLabor_hingeDrilling','predrilled');
  await r.get('cabinetModalSave').emit('click');
  const saved=r.sandbox.projectData.kuchnia.cabinets[0];assert.equal(saved.details.additionalLegs,2);assert.equal(saved.details.shelfType,'fixed');assert.equal(saved.details.hingeDrilling,'predrilled');assert.equal(r.metrics.saves,1);
  saved.type='wisząca';r.edit();await select('cmLabor_hangerCount','0');await r.get('cabinetModalSave').emit('click');
  assert.equal(r.sandbox.projectData.kuchnia.cabinets[0].details.hangerCount,0);
  console.log('PASS cabinet form, default/revert, Save/Cancel and explicit zero hanger override');

  const e=fixture(),settings={additionalLegs:2,hangerCount:0,shelfType:'fixed',hingeDrilling:'predrilled'};
  e.mutate(p=>Object.assign(p.projectData.kuchnia.cabinets[0].details,settings));
  assert.ok(e.FC.projectStore.upsert(e.row()),'Native project writer accepts the parameters');
  e.s.projectData=e.FC.project.load();
  const reopened=fixture(Object.fromEntries(e.storage.rows));
  assert.deepEqual(clone(reopened.s.projectData.kuchnia.cabinets[0].details),e.row().projectData.kuchnia.cabinets[0].details);
  const raw=e.storage.getItem('fc_projects_v1');
  const out=await e.build();assert.equal(out.ok,true,JSON.stringify(out));
  const restored=out.document.payload.project;
  assert.deepEqual(clone(restored.projectData.kuchnia.cabinets[0].details),e.row().projectData.kuchnia.cabinets[0].details);
  const contract=e.FC.projectExportContract;
  const check=contract.validate(out.document.payload.investor,restored);
  assert.ok(check,'Closed export contract re-validates the serialized import payload');
  assert.equal(e.storage.getItem('fc_projects_v1'),raw,'Read/export never normalizes owner data');
  const legacy=fixture();assert.equal((await legacy.build()).ok,true,'Old project has compatible read without rewriting');
  const bad=fixture();bad.mutate(p=>{p.projectData.kuchnia.cabinets[0].details.unapprovedLaborField=1;});assert.equal((await bad.build()).ok,false,'Unknown project fields remain forbidden');
  const invalid=fixture();invalid.mutate(p=>{p.projectData.kuchnia.cabinets[0].details.shelfType='unapproved';});assert.equal((await invalid.build()).ok,false,'Closed shelf variants');
  console.log('PASS native project read, closed selective export/revalidation, old projects and unknown-field refusal');

  e.storage.rows.set('fc_quote_rates_v1','[{"id":"saved","timeBlockHours":0.75,"startQty":0}]');
  e.storage.rows.set('fc_workshop_services_v1','[{"id":"service","startHours":0.75}]');
  e.storage.rows.set('fc_quote_snapshots_v1','[{"id":"frozen","total":123.456789,"hours":0.75}]');
  const files=['data-storage-keys','data-backup-snapshot-normalizer','data-backup-snapshot-apply','data-backup-export','data-backup-snapshot'];
  function loadBackup(target){for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,'js/app/shared/'+file+'.js'),'utf8'),target.s);}
  loadBackup(e);
  const api=e.FC.dataBackupSnapshot,snapshot=api.collectSnapshot({reason:'synthetic-labor'});
  const imported=api.parseImportPayload(JSON.stringify(api.makeExportPayload(snapshot)));
  const receiver=fixture();loadBackup(receiver);receiver.FC.dataBackupSnapshot.applySnapshot(imported);
  for(const key of ['fc_projects_v1','fc_quote_rates_v1','fc_workshop_services_v1','fc_quote_snapshots_v1'])assert.equal(receiver.storage.getItem(key),e.storage.getItem(key),'Backup/import preserves exact bytes for '+key);
  console.log('PASS full backup/export/import retains new parameters, 45 min, zero startQty and frozen history bytes');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
