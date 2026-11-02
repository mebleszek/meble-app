'use strict';
const assert=require('node:assert/strict'),{rescueFixture}=require('./helpers/local-first-rescue-fixture');
const tests=[],test=(name,fn)=>tests.push([name,fn]),password='synthetic private backup passphrase';
const code=value=>e=>e.code===value;
const immutable=r=>JSON.stringify({local:[...r.rows],session:[...r.session],tables:r.tables});
(async()=>{
 const {createLocalFirstRescue}=await import('../sync/local-first-rescue-file.mjs'),{readRescueSnapshot}=await import('../sync/local-first-rescue-snapshot.mjs');
 test('full native originals/aliases/known RAM/all four stores and uncertain ACK are captured with no WRITE',async()=>{
  const r=await rescueFixture(),before=immutable(r),data=await readRescueSnapshot(r.context);
  assert.equal(data.local.rows.find(r=>r.key==='fc_quote_offer_drafts_v1').raw,'PRIVATE_DRAFT');assert.equal(data.local.rows.find(r=>r.key==='fc_hardware_replacement_rules_v1').raw,'PRIVATE_REPLACEMENT');
  assert.equal(data.local.rows.find(r=>r.key==='fc_lone_surrogate_v1').raw,'A\ud800B');assert.equal(data.databases.authority.outbox[0].phase,'uncertain');assert.deepEqual(Object.keys(data.databases.authority).sort(),['control','outbox','protected','replicas']);
  assert.equal(data.ram.data.project.unsaved,'PRIVATE_UNSAVED_RAM');assert.equal(data.session.rows[0].raw,'PRIVATE_SESSION');assert.equal(JSON.stringify(data).includes('AUTH_TOKEN_MUST_NOT_ENTER_BACKUP'),false);
  assert.equal(immutable(r),before);assert.ok(r.trace.filter(x=>x.startsWith('tx:')).every(x=>x==='tx:readonly'));assert.ok(r.connections.every(c=>c.closed));
  for(const key of ['hardwareSuppliers','hardwareSettings','hardwareCategories','hardwareTypes','hardwareTechnicalParams'])assert.ok(data.local.rows.some(r=>r.key===key));
  const {readCurrentBusinessRam}=await import('../sync/local-first-rescue-ram.mjs');assert.equal(readCurrentBusinessRam(r.w).available,false);
  r.w.projectData={unsaved:'PRIVATE_PROJECT_RAM'};r.w.uiState={activeRoom:'synthetic-room'};r.w.document.querySelectorAll=()=>[{tagName:'INPUT',id:'synthetic',name:'synthetic',value:'PRIVATE_CONTROL_RAM',checked:false,closest:()=>null}];
  const ram=readCurrentBusinessRam(r.w);assert.equal(ram.data.project.unsaved,'PRIVATE_PROJECT_RAM');assert.equal(ram.data.controls[0].value,'PRIVATE_CONTROL_RAM');
 });
 test('prepare and download stay pending; only independent selected file/decryption/full verification creates a capability',async()=>{
  const r=await rescueFixture(),x=createLocalFirstRescue(r.context),before=immutable(r),token=await x.prepare(password);assert.equal(token.status,'BACKUP_PENDING');assert.equal('text' in token,false);
  assert.throws(()=>x.analyzePrivate({status:'BACKUP_PASS'}),code('RESCUE_VERIFIED_FILE_REQUIRED'));
  const selected=r.selection(new File(['{}'],'wrong.json'));await assert.rejects(x.verifySelection(selected.input,selected.event,password,token),code('RESCUE_DOWNLOAD_REQUIRED'));
  assert.equal((await x.download(token)).status,'BACKUP_PENDING');const file=await r.file(),s=r.selection(file),proof=await x.verifySelection(s.input,s.event,password,token);
  assert.equal(proof.status,'BACKUP_PASS');assert.equal(x.summary(proof).repair,'REPAIR_BLOCKED');assert.equal(x.analyzePrivate(proof).scope,'PRIVATE_LOCAL_ONLY');assert.equal(immutable(r),before);
  assert.throws(()=>x.summary({...proof}),code('RESCUE_VERIFIED_FILE_REQUIRED'));assert.equal((await file.text()).includes('PRIVATE_'),false);
 });
 test('untrusted selection, incomplete download, wrong password, corrupt manifest, mismatched hash and disk failure never pass',async()=>{
  const r=await rescueFixture(),x=createLocalFirstRescue(r.context),token=await x.prepare(password);await x.download(token);const file=await r.file(),s=r.selection(file,false);
  await assert.rejects(x.verifySelection(s.input,s.event,password,token),code('RESCUE_INDEPENDENT_FILE_REQUIRED'));
  const good=r.selection(file);await assert.rejects(x.verifySelection(good.input,good.event,'wrong but long passphrase',token),code('RESCUE_DECRYPT_OR_FORMAT'));
  const corrupt=JSON.parse(await file.text());corrupt.ciphertext=(corrupt.ciphertext[0]==='A'?'B':'A')+corrupt.ciphertext.slice(1);const corruptSelection=r.selection(await r.file(JSON.stringify(corrupt)));
  await assert.rejects(x.verifySelection(corruptSelection.input,corruptSelection.event,password),code('RESCUE_DECRYPT_OR_FORMAT'));
  const truncated=r.selection(await r.file((await file.text()).slice(0,-30)));await assert.rejects(x.verifySelection(truncated.input,truncated.event,password,token),code('RESCUE_FILE_HASH_MISMATCH'));
  const body=await r.w.FC.storageRecoveryExport.privateCodec.open(await file.text(),password);body.manifestHash='a'.repeat(64);
  const tampered=r.selection(await r.file(await r.w.FC.storageRecoveryExport.privateCodec.seal(body,password)));await assert.rejects(x.verifySelection(tampered.input,tampered.event,password),code('RESCUE_FILE_INTEGRITY'));
  const d=await rescueFixture(),api=createLocalFirstRescue(d.context),t=await api.prepare(password);d.options.downloadFailure=true;await assert.rejects(api.download(t),code('RESCUE_DOWNLOAD_FAILED'));
  const fake=d.selection(await d.file('{}'));await assert.rejects(api.verifySelection(fake.input,fake.event,password,t),code('RESCUE_DOWNLOAD_REQUIRED'));
 });
 test('wrong identity, missing receipt, foreign binding, invalid hashes and unknown databases refuse before a trusted image read',async()=>{
  for(const mode of ['owner','receipt','binding','hash','phase','unknown','upgrade','release','production']){
   const r=await rescueFixture();if(mode==='owner')r.context.ownerUid='other';if(mode==='receipt')r.rows.delete('meble_application_authority_v1');if(mode==='binding')r.tables.control[0].ownerUid='other';if(mode==='hash')r.tables.outbox[0].hash='b'.repeat(64);if(mode==='phase')r.tables.outbox[0].expected=null;
   if(mode==='unknown')r.options.inventory=[{name:r.context.name,version:1},{name:'private-unknown',version:1}];if(mode==='upgrade')r.options.upgrade=true;
   if(mode==='release')r.context.release={};if(mode==='production')r.context.name='meble-local-first-v1';
   const before=immutable(r);await assert.rejects(readRescueSnapshot(r.context),e=>/^RESCUE_/.test(e.code));assert.equal(immutable(r),before);
   if(['owner','receipt','unknown','release','production'].includes(mode))assert.equal(r.trace.some(x=>x.startsWith('open:')),false);if(mode==='binding')assert.equal(r.trace.some(x=>x.startsWith('all:')),false);
  }
 });
 test('authorization loss, second editor, busy writer, missing RAM, changed data and size limits stop without probes or repair',async()=>{
  for(const mode of ['auth','second','busy','ram','changed','size']){
   const r=await rescueFixture();if(mode==='auth')r.deny();if(mode==='second')r.options.otherClient=true;if(mode==='busy')r.options.busy=true;if(mode==='ram')r.setRam(null);
   if(mode==='changed')r.options.onComplete=()=>r.rows.set('fc_data_backups_v1','changed');if(mode==='size')r.rows.set('fc_oversized_v1','x'.repeat(8*1024*1024+1));
   await assert.rejects(readRescueSnapshot(r.context),e=>/^RESCUE_/.test(e.code));assert.equal(r.trace.includes('tx:readwrite'),false);
  }
 });
 test('existing archive is copied in full; its control/source/RAW/hash/route integrity is never weakened',async()=>{
  const r=await rescueFixture(),f=r.w.FC.backupArchiveFormat,raw=' [ {"id":"synthetic-backup","snapshot":{"keys":{"fc_services_v1":"PRIVATE_BACKUP"}},"pinned":true} ] ',sourceHash=await f.hash(raw);
  r.options.archive={control:[{key:'archive',schema:1,phase:'COPIED',sourceHash,revision:2,count:1}],sources:[{sha256:sourceHash,raw}],records:[await f.encode(JSON.parse(raw)[0],f.rawRecords(raw)[0])]};
  const archive=JSON.stringify(r.options.archive),before=immutable(r),snapshot=await readRescueSnapshot(r.context);assert.deepEqual(snapshot.databases.archive,JSON.parse(archive));assert.equal(immutable(r),before);
  r.options.archive.records[0].sha256='b'.repeat(64);await assert.rejects(readRescueSnapshot(r.context),code('RESCUE_ARCHIVE_INTEGRITY'));
  r.options.archive=JSON.parse(archive);r.rows.set('meble_backup_archive_backend_v1','{"v":1,"backend":"indexeddb"}');await assert.rejects(readRescueSnapshot(r.context),code('RESCUE_ARCHIVE_INTEGRITY'));
  assert.equal(r.trace.includes('tx:readwrite'),false);
  const legacy=await rescueFixture();legacy.rows.delete('meble_application_authority_v1');legacy.w.localStorage.getItem=key=>legacy.rows.get(key)??null;legacy.w.document.querySelectorAll=()=>[];
  await assert.rejects(legacy.w.FC.storageRecoveryExport.prepare(password),/RECOVERY_UNKNOWN_DATABASE/,'Legacy export must still refuse LOCAL-FIRST');assert.equal(legacy.trace.some(t=>t.startsWith('open:')),false);
 });
 test('mid-operation Auth/data changes, database corruption, failed file reads and forged FileLists cannot become proof',async()=>{
  for(const mode of ['auth-mid-read','image','source','protected','schema','read']){
   const r=await rescueFixture();if(mode==='auth-mid-read')r.options.onComplete=()=>r.deny();if(mode==='image')r.tables.control[2].hash='a'.repeat(64);if(mode==='source')r.tables.control[1].hash='a'.repeat(64);if(mode==='protected')r.tables.protected[0].hash='a'.repeat(64);if(mode==='schema')r.options.badSchema=true;if(mode==='read')r.options.readError='fc_projects_v1';
   const before=immutable(r);await assert.rejects(readRescueSnapshot(r.context),e=>/^RESCUE_/.test(e.code));assert.equal(immutable(r),before);
  }
  const r=await rescueFixture(),x=createLocalFirstRescue(r.context),token=await x.prepare(password);await x.download(token);const file=await r.file(),bad=r.selection(file);
  Object.defineProperty(file,'arrayBuffer',{value:()=>Promise.reject(Error('PRIVATE_FILE_ERROR'))});await assert.rejects(x.verifySelection(bad.input,bad.event,password,token),code('RESCUE_FILE_READ_FAILED'));
  const good=r.selection(await r.file());Object.defineProperty(good.input,'files',{value:[new File(['{}'],'forged.json')]});assert.equal((await x.verifySelection(good.input,good.event,password,token)).status,'BACKUP_PASS','Native prototype getter must ignore an overridden files property');
  r.rows.set('fc_data_backups_v1','CHANGED');await assert.rejects(x.verifySelection(good.input,good.event,password,token),code('RESCUE_SOURCE_CHANGED'));await assert.rejects(x.download(token),code('RESCUE_SOURCE_CHANGED'));
 });
 test('restart re-verifies the saved file, marks lost RAM stale, keeps private analysis and cannot grant future WRITE',async()=>{
  const r=await rescueFixture(),x=createLocalFirstRescue(r.context),token=await x.prepare(password);await x.download(token);const file=await r.file(),before=immutable(r);
  r.setRam(null);const reboot=createLocalFirstRescue(r.context),s=r.selection(file),proof=await reboot.verifySelection(s.input,s.event,password);
  assert.equal(proof.status,'FILE_VERIFIED_STALE');assert.equal(proof.completeWithinScope,false);assert.equal(reboot.analyzePrivate(proof).plan.executeAvailable,false);assert.equal(immutable(r),before);
  await assert.rejects(reboot.prepare(password),code('RESCUE_RAM_UNAVAILABLE'));
 });
 for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log(`LOCAL-FIRST private rescue: ${tests.length}/${tests.length} PASS`);
})().catch(e=>{console.error(e.code||e.name||'TEST_FAILED');process.exitCode=1;});
