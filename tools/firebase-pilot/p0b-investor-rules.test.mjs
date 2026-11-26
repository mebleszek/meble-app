import assert from 'node:assert/strict';
import test from 'node:test';
import {randomInt} from 'node:crypto';
import {createRequire} from 'node:module';
import {assertFails, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import * as f from 'firebase/firestore';
import {createP0BProtocol, createP0BDeletionIntent, inspectP0BCompatibility, projectP0BContact, splitP0BLegacyContact, P0B_HEARTBEAT_MS, watchP0BEditorContact} from './p0b-protocol.mjs';

import {runP0BRecovery} from './p0b-recovery-cases.mjs';
import {visitAckCases} from './p0b-visit-ack.cases.mjs';
import {lockContentionCases} from './p0b-lock-contention.cases.mjs';

const {p0bApplicationRules} = createRequire(import.meta.url)('./p0b-application-rules.js');
const fixtureUid = 'synthetic-p0b-owner';
const uid = fixtureUid;
const claims = {email_verified:true, firebase:{sign_in_provider:'google.com'}};
const fixturePin=String(randomInt(10000)).padStart(4,'0');
const replacementPin=String((Number(fixturePin)+1)%10000).padStart(4,'0');
const contact = {name:'DEMO', phone:'111', email:'', address:'', notes:''};
const ref = (db, group, key) => f.doc(db, 'users', uid, group, key);
const acq = (iid,pid,deviceLabel = '', expectedHead = '') => ({iid,pid,deviceLabel,expectedHead});

export async function p0bFixture(t,{ownerUid:uid=fixtureUid}={}) {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:19099');
  f.setLogLevel('silent');
  const env = await initializeTestEnvironment({projectId:'demo-meble-app', firestore:{
    host:'127.0.0.1', port:18080, rules:p0bApplicationRules()
  }});
  t.after(() => env.cleanup());
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const batch = f.writeBatch(db);
    batch.set(f.doc(db,'syncConfig','owner'),{ownerUid:uid,activationId:'p0b-demo',schemaVersion:1});
    batch.set(f.doc(db,'syncAccess',uid),{activationId:'p0b-demo',schemaVersion:1});
    batch.set(f.doc(db,'authorizedUsers',uid),{appEnabled:true,enabled:false,globalDataEnabled:true,globalSchemaVersion:1});
    batch.set(f.doc(db,'appAccess',uid),{schemaVersion:1});
    await batch.commit();
  });
  function client(deviceId) {
    const db = env.authenticatedContext(uid,claims).firestore()._delegate;
    const connection = {db, firestore:f, assertAccess(){}, session:{identity:()=>({uid,epoch:1})},
      auth:{app:db.app, emulatorConfig:{host:'127.0.0.1',port:19099,protocol:'http'},
        currentUser:{uid,providerData:[{providerId:'google.com'}]}}};
    return {db,connection,protocol:createP0BProtocol(connection,deviceId)};
  }
  return {env, client};
}

test('P0-B lossless contact envelope with explicitly verified project rooms',()=>{
  const rooms=[{id:'kitchen',futureRoomField:'retained'}];
  const raw={id:'fixture',kind:'company',companyName:'Firma',nip:'0010',city:'Łódź',rooms,
    transport:{distanceKm:'17.45'},carrying:{floor:'3',future:{precision:17.125}},legacyExtension:[null,true]};
  const split=splitP0BLegacyContact(raw,rooms);
  assert.deepEqual({...split.contact,rooms:split.rooms},raw);
  assert.throws(()=>splitP0BLegacyContact(raw,[]),{code:'LF_P0B_ROOM_OWNERSHIP_UNCONFIRMED'});
  assert.throws(()=>splitP0BLegacyContact({...raw,meta:{accessToken:'synthetic'}},rooms),{code:'LF_P0B_CONTACT_INVALID'});
});

test('P0-B heartbeat scheduler handles offline and wakes a suspended tab',async()=>{
  const window=new EventTarget();
  window.navigator={onLine:true};
  window.document=new EventTarget();
  window.document.visibilityState='visible';
  let fire, count=0;
  window.setTimeout=(callback,delay)=>{assert.equal(delay,P0B_HEARTBEAT_MS);fire=callback;return 1;};
  window.clearTimeout=()=>{fire=undefined;};
  const stop=watchP0BEditorContact({window,send:async()=>{count++;}});
  await Promise.resolve();
  assert.equal(count,1);
  window.navigator.onLine=false;
  await fire();
  assert.equal(count,1);
  window.navigator.onLine=true;
  window.document.visibilityState='hidden';
  window.dispatchEvent(new Event('online'));
  assert.equal(count,1);
  window.document.visibilityState='visible';
  window.document.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  assert.equal(count,2);
  await fire();
  assert.equal(count,3);
  stop();
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(count,3);
});

test('P0-B takeover and project replacement survive Chromium SIGKILL and uncertain ACK',async t=>{
  const uid='synthetic-p0b-recovery-owner';
  const fixture=await p0bFixture(t,{ownerUid:uid});
  await runP0BRecovery(t,{...fixture,uid,pin:fixturePin,wrongPin:replacementPin,contact});
});

test('P0-B candidate Rules: owner CAS, registry, atomic investor deletion, stale clients and read budget',async t=>{
  const {env,client} = await p0bFixture(t);
  const {db,protocol:pc} = client('computer');
  const {protocol:phone} = client('phone');

  await pc.createInvestor('owned',contact);
  await pc.createInvestor('zero',contact);
  await pc.createInvestor('other',{...contact,name:'Other'});
  const beforeOther = await pc.investor('other');
  const r = ref(db,'localFirstInvestors','owned');
  const before = await pc.investor('owned');
  const guestDb = env.unauthenticatedContext().firestore();
  const foreignDb = env.authenticatedContext('foreign',claims).firestore();
  for (const outsider of [guestDb,foreignDb]) {
    await assertFails(f.getDoc(ref(outsider,'localFirstInvestors','owned')));
    await assertFails(f.getDocs(f.query(f.collection(outsider,'users',uid,'localFirstInvestors'),f.limit(10))));
    await assertFails(f.setDoc(ref(outsider,'localFirstInvestors','owned'),before));
  }
  await assertFails(f.getDocs(f.collection(db,'users',uid,'localFirstInvestors')));
  assert.equal((await f.getDocs(f.query(f.collection(db,'users',uid,'localFirstInvestors'),f.limit(100)))).size,3);
  for(const patch of [
    {projects:{fake:true},lastProject:'fake'},
    {ownerUid:'foreign'},
    {isAdmin:true},
    {contactRevision:-1},
    {contactRevision:2,contact:{...contact,phone:7}},
    {contactRevision:2,contact:{...contact,name:'x'.repeat(201)}},
    {contactRevision:2,contact:{name:'Required fields missing'}},
    {contactRevision:2,contact:{...contact,secret:'extra'}},
  ]) await assertFails(f.updateDoc(r,{generation:2,...patch}));
  await assertFails(f.setDoc(ref(db,'localFirstInvestors','invalid'),{...before,investorId:'invalid',projects:{pretended:false}}));
  assert.deepEqual(await pc.investor('owned'),before);

  const kitchen = await pc.acquire(acq('owned','kitchen','Komputer'));
  const wardrobe = await phone.acquire(acq('owned','wardrobe','Telefon'));
  const heartbeat = f.doc(ref(db,'localFirstEditors','wardrobe'),'presence','current');
  const stamp=await phone.heartbeat('wardrobe',wardrobe);
  assert.equal(stamp.written,true);
  assert.deepEqual(await phone.heartbeat('wardrobe',wardrobe),{...stamp,written:false});
  assert.equal((await pc.presence('owned',()=>true)).projects.find(row=>row.projectId==='wardrobe').activity,'recent');
  await assertFails(f.setDoc(heartbeat,{deviceId:'phone',epoch:wardrobe.epoch,lastContactAt:f.serverTimestamp()}));
  await assertFails(f.setDoc(f.doc(ref(guestDb,'localFirstEditors','wardrobe'),'presence','current'),{deviceId:'phone',epoch:wardrobe.epoch,lastContactAt:f.serverTimestamp()}));
  // Age the server-side fixture without changing the lock or waiting five minutes.
  await env.withSecurityRulesDisabled(c=>f.updateDoc(f.doc(ref(c.firestore(),'localFirstEditors','wardrobe'),'presence','current'),
    {lastContactAt:f.Timestamp.fromMillis(Date.now()-P0B_HEARTBEAT_MS-1000)}));
  assert.equal((await pc.presence('owned',()=>true)).projects.find(row=>row.projectId==='wardrobe').activity,'unconfirmed');
  assert.equal((await pc.presence('owned',()=>false)).state,'unconfirmed');
  assert.deepEqual((await f.getDocFromServer(ref(db,'localFirstEditors','wardrobe'))).data(),wardrobe);
  assert.equal((await phone.heartbeat('wardrobe',wardrobe)).written,true);
  assert.equal((await f.getDocFromServer(ref(db,'localFirstProjects','wardrobe'))).exists(),false,'Heartbeat never publishes a project revision');
  await pc.openInvestor('owned','recovered-visit','Komputer');
  assert.deepEqual(await client('computer').protocol.recoverOwnVisit('owned'),{token:'recovered-visit',label:'Komputer'});
  assert.equal(await phone.recoverOwnVisit('owned'),null);
  await pc.closeInvestor('owned','recovered-visit');
  assert.deepEqual((await pc.investor('owned')).projects,{kitchen:true,wardrobe:true});
  await assert.rejects(phone.acquire(acq('owned','kitchen')),{code:'LF_P0B_EDITOR_CONFLICT'});
  await assertFails(f.setDoc(ref(db,'localFirstEditors','bypass'),{
    ownerUid:uid, projectId:'bypass',deviceId:'legacy',epoch:1,active:true,headRevision:''
  }));
  await assertFails(f.setDoc(ref(db,'localFirstEditors','unpaired'),{
    ownerUid:uid, projectId:'unpaired',investorId:'owned',deviceId:'legacy',epoch:1,active:true,headRevision:'',deviceLabel:''
  }));
  await assertFails(f.updateDoc(ref(db,'localFirstEditors','kitchen'),{active:false}));
  const busy=await pc.investor('owned');
  assert.throws(()=>createP0BDeletionIntent([busy],'busy'),{code:'LF_P0B_EDITOR_CONFLICT'});
  await assertFails(f.updateDoc(r,{generation:busy.generation+1,deletionId:'forged',contact:{},lastProject:''}));
  await pc.updateContact('owned',1,{...contact,phone:'222'});
  await assert.rejects(phone.updateContact('owned',1,{...contact,phone:'333'}),{code:'LF_P0B_CONTACT_CONFLICT'});
  const current = await pc.investor('owned');
  assert.equal(projectP0BContact(current,{id:'wardrobe',investorId:'owned'},[]).contact.phone,'222');

  const sha = 'a'.repeat(64), rid = 'b'.repeat(32), gid = 'c'.repeat(32);
  const head = ref(db,'localFirstProjects','kitchen'), revision=f.doc(head,'revisions',rid);
  await env.withSecurityRulesDisabled(c=>f.setDoc(ref(c.firestore(),'globalRevisions',gid),{revisionId:gid,directoryHash:sha}));
  const content={ownerUid:uid,investorId:'owned',projectId:'kitchen',formatVersion:1,
    chunkCount:1,byteLength:1,fileSha256:sha,documentSha256:sha,payloadSha256:sha};
  const write=f.writeBatch(db);
  write.set(revision,{...content,revisionId:rid,generationCandidate:1,baseGeneration:0,baseRevisionId:'',
    baseFileSha256:'',baseDocumentSha256:'',basePayloadSha256:'',chunkSha256:[sha],createdAt:f.serverTimestamp()});
  write.set(head,{...content,generation:1,currentRevisionId:rid,editorEpoch:kitchen.epoch,deviceId:kitchen.deviceId,
    globalRevisionId:gid,globalDirectoryHash:sha,updatedAt:f.serverTimestamp()});
  await write.commit(); // Existing checked head/revision transaction, with new registry checks.
  assert.equal((await pc.heartbeat('kitchen',kitchen)).written,false,'A fresh published head is already a contact');
  const history=(await f.getDocFromServer(revision)).data();
  const discovered=await phone.listProjectHeads();
  assert.equal(discovered.find(record=>record.projectId==='kitchen').head.currentRevisionId,rid);
  assert.equal(discovered.find(record=>record.projectId==='wardrobe').head,null,'A registered project can still await its first revision');
  const latest = 'd'.repeat(32), largest = {...content,chunkCount:7,byteLength:6*131072+1};
  const maxRevision = f.doc(head,'revisions',latest), stage = f.writeBatch(db);
  stage.set(maxRevision,{...largest,revisionId:latest,generationCandidate:2,baseGeneration:1,baseRevisionId:rid,
    baseFileSha256:sha,baseDocumentSha256:sha,basePayloadSha256:sha,chunkSha256:Array(7).fill(sha),createdAt:f.serverTimestamp()});
  for(let i=0;i<7;i++){
    const byteLength=i===6?1:131072;
    stage.set(f.doc(maxRevision,'chunks',String(i)),{index:i,byteLength,bytes:f.Bytes.fromUint8Array(new Uint8Array(byteLength)),sha256:sha});
  }
  await stage.commit();
  await f.setDoc(head,{...largest,generation:2,currentRevisionId:latest,editorEpoch:kitchen.epoch,deviceId:kitchen.deviceId,
    globalRevisionId:gid,globalDirectoryHash:sha,updatedAt:f.serverTimestamp()});
  await pc.release({...acq('owned','kitchen','',latest),expectedEditor:kitchen});
  await phone.release({...acq('owned','wardrobe'),expectedEditor:wardrobe});
  const intent=createP0BDeletionIntent([await pc.investor('owned')],'terminal');
  const racing = await phone.acquire(acq('owned','wardrobe'));
  assert.equal(racing.epoch,wardrobe.epoch+1);
  await assert.rejects(phone.heartbeat('wardrobe',wardrobe),{code:'LF_P0B_EDITOR_CONFLICT'});
  await assertFails(f.setDoc(heartbeat,{deviceId:'phone',epoch:wardrobe.epoch,lastContactAt:f.serverTimestamp()}));
  assert.equal((await phone.heartbeat('wardrobe',racing)).written,true);
  await assert.rejects(pc.publishDeletion(intent),{code:'LF_P0B_DELETE_CONFLICT'});
  await phone.release({...acq('owned','wardrobe'),expectedEditor:racing});
  const target = createP0BDeletionIntent([await pc.investor('owned')],'terminal');
  await pc.publishDeletion(target);
  await pc.publishDeletion(target);
  assert.deepEqual(await phone.confirmDeletion(target),await pc.confirmDeletion(target));
  await assertFails(f.getDoc(head));await assertFails(f.getDoc(revision));
  await assertFails(f.setDoc(ref(db,'localFirstInvestors','owned'),before));
  await assertFails(f.deleteDoc(r));
  await assertFails(f.updateDoc(head,{generation:2,updatedAt:f.serverTimestamp()}));
  await assert.rejects(phone.acquire(acq('owned','new-project')),{code:'LF_P0B_INVESTOR_DELETED'});
  assert.throws(()=>projectP0BContact({...current,deletionId:'terminal'},{id:'kitchen',investorId:'owned'},[]),
    {code:'LF_P0B_INVESTOR_DELETED'});
  await env.withSecurityRulesDisabled(async c=>{
    const db=c.firestore();
    assert.deepEqual((await f.getDoc(f.doc(ref(db,'localFirstProjects','kitchen'),'revisions',rid))).data(),history);
    assert.deepEqual((await f.getDoc(ref(db,'globalRevisions',gid))).data(),{revisionId:gid,directoryHash:sha});
  });
  const zero=await pc.investor('zero');
  await pc.createInvestor('batch-a',{...contact,city:'Łódź',carrying:{floor:3},legacyExtension:{precise:17.125}});
  await pc.createInvestor('batch-z',{...contact,kind:'company',companyName:'Firma',transport:{distanceKm:'17.4'}});
  const ids=['batch-a','batch-z'];
  const selection=()=>Promise.all(ids.map(pc.investor));
  const stale=createP0BDeletionIntent(await selection(),'bulk-stale');
  await phone.openInvestor('batch-z','tab-phone','Telefon');
  await assert.rejects(pc.publishDeletion(stale),{code:'LF_P0B_DELETE_CONFLICT'});
  assert.ok((await selection()).every(record=>!record.deletionId&&!record.bulkId));
  await assert.rejects(pc.closeInvestor('batch-z','tab-phone'),{code:'LF_P0B_VISIT_CONFLICT'});
  await phone.closeInvestor('batch-z','tab-phone');
  const group=createP0BDeletionIntent(await selection(),'bulk-good');
  const op=ref(db,'p0bDeletionGroups',group.operationId), a=ref(db,'localFirstInvestors','batch-a');
  await f.setDoc(op,{ownerUid:uid,operationId:group.operationId,targets:group.targets,prepared:{},last:'',phase:'preparing'});
  await assertFails(f.updateDoc(op,{phase:'committed'}));
  const stageOne=f.writeBatch(db);
  stageOne.update(a,{bulkId:group.operationId,generation:group.targets['batch-a']+1});
  stageOne.update(op,{last:'batch-a',prepared:{'batch-a':true}});
  await stageOne.commit();
  await assertFails(f.updateDoc(op,{phase:'committed'}));
  assert.ok((await selection()).every(record=>!record.deletionId));
  assert.equal((await pc.investor('batch-a')).contact.legacyExtension.precise,17.125);
  await assert.rejects(phone.openInvestor('batch-a','new-visit'),{code:'LF_P0B_DELETE_CONFLICT'});
  assert.ok((await pc.listInvestors()).some(record=>record.investorId==='batch-z'));
  await pc.publishDeletion(group);
  assert.deepEqual((await pc.confirmDeletion(group)).investorIds,ids);
  assert.ok((await selection()).every(record=>record.deletionId===group.operationId&&record.contact===null));
  await assertFails(f.updateDoc(op,{phase:'cancelled'}));
  await assertFails(f.updateDoc(a,{bulkId:'',generation:group.targets['batch-a']+2}));
  assert.deepEqual((await pc.investor('other')),beforeOther);
  assert.deepEqual(await pc.investor('zero'),zero);
  await pc.publishDeletion(createP0BDeletionIntent([zero],'zero-delete'));
  assert.equal((await phone.investor('zero')).deletionId,'zero-delete');
  assert.deepEqual(await pc.investor('other'),beforeOther);
  await pc.createInvestor('one',contact);
  const single = await pc.acquire(acq('one','one-project'));
  await pc.release({...acq('one','one-project'),expectedEditor:single});
  await pc.publishDeletion(createP0BDeletionIntent([await pc.investor('one')],'one-delete'));
  assert.equal((await phone.investor('one')).deletionId,'one-delete');

  await pc.createInvestor('race',contact);
  const racingDelete=createP0BDeletionIntent([await pc.investor('race')],'race-delete');
  const outcomes=await Promise.allSettled([pc.publishDeletion(racingDelete),phone.acquire(acq('race','race-project'))]);
  assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
  const afterRace=await pc.investor('race');
  assert.equal(!!afterRace.deletionId,!afterRace.projects['race-project']);

  const old = {investorId:'legacy',contact};
  assert.deepEqual(inspectP0BCompatibility({records:[],snapshots:[old,{...old,contact:{...contact,phone:'old'}}],
    projectHeads:[{projectId:'legacy-project',investorId:'legacy'}]}).map(issue=>issue.code),
    ['LF_P0B_LEGACY_CONTACT','LF_P0B_LEGACY_CONTACT','LF_P0B_AMBIGUOUS_CONTACT','LF_P0B_UNREGISTERED_PROJECT']);
  await visitAckCases({client,contact});
  await lockContentionCases({client,contact});
});

test('P0-B two real Chromium profiles: local label, offline intent, lost ACK, reboot and archive refusal',async t=>{
  const {env}=await p0bFixture(t);
  const [{default:fs},{default:os},{default:path},{default:http},{fileURLToPath},{chromium}]=await Promise.all([
    import('node:fs'),import('node:os'),import('node:path'),import('node:http'),import('node:url'),import('playwright-core')
  ]);
  const {startBrowser}=createRequire(import.meta.url)('../helpers/chromium-runtime.js');
  const root=fileURLToPath(new URL('../..',import.meta.url));
  const authResponse=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/projects/demo-meble-app/accounts:batchCreate',{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner'},
    body:JSON.stringify({allowOverwrite:true,users:[{localId:uid,email:uid+'@example.invalid',emailVerified:true,
      providerUserInfo:[{providerId:'google.com',rawId:uid,email:uid+'@example.invalid'}]}]})
  });
  assert.equal(authResponse.ok,true);
  const {moduleAssets}=createRequire(import.meta.url)('../helpers/fixture-module-assets');
  const protocolEntries=['p0b-protocol','p0b-deletion-journal','p0b-local-tombstone'].map(name=>'tools/firebase-pilot/'+name+'.mjs');
  const assets=new Map([
    ...moduleAssets(),
    ...moduleAssets(protocolEntries),
    ...['local-first-values','local-device-label','local-first-idb','application-release','application-writer-fence'].map(name=>['/sync/'+name+'.mjs','sync/'+name+'.mjs']),
    ...['app','auth','firestore'].map(name=>['/__sdk/firebase-'+name+'.js','tools/firebase-pilot/node_modules/firebase/firebase-'+name+'.js']),
    ...['ui/data-settings-dom','ui/data-settings-company-view','ui/data-settings-menu-view','ui/data-settings-modal','settings/company-profile-store','investor/investor-ui','investor/investor-ui-render','investor/investor-deletion'].map(name=>['/js/app/'+name+'.js','js/app/'+name+'.js'])
  ]);
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><main id="company"></main><section id="list"></section>');return;}
    const file=assets.get(req.url);if(!file){res.writeHead(404).end();return;}
    res.setHeader('content-type','text/javascript; charset=utf-8');
    res.end(fs.readFileSync(path.join(root,file),'utf8').replaceAll('https://www.gstatic.com/firebasejs/12.19.0/','/__sdk/'));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const profiles=fs.mkdtempSync(path.join(os.tmpdir(),'meble-p0b-profiles-')),devices=[];
  async function stop(device) {
    await (await device.browser.newBrowserCDPSession()).send('Browser.close');
    assert.equal((await device.owner.exited).code,0);await device.owner.close();
  }
  t.after(async()=>{
    await Promise.all(devices.map(device=>device.owner.close()));
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(profiles,{recursive:true,force:true});
  });
  async function device(id) {
    const owner=await startBrowser({profileDir:path.join(profiles,id)});
    const browser=await chromium.connectOverCDP(owner.endpoint), context=browser.contexts()[0], page=context.pages()[0];
    const result={owner,browser,context,page};devices.push(result);
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.evaluate(async({uid,id})=>{
      const [app,a,f,protocol,journal,labels]=await Promise.all([
        import('/__sdk/firebase-app.js'),import('/__sdk/firebase-auth.js'),import('/__sdk/firebase-firestore.js'),
        import('/tools/firebase-pilot/p0b-protocol.mjs'),import('/tools/firebase-pilot/p0b-deletion-journal.mjs'),import('/sync/local-device-label.mjs')
      ]);
      const client=app.initializeApp({projectId:'demo-meble-app',apiKey:'demo-only',appId:'demo-only',authDomain:'demo-meble-app.firebaseapp.com'});
      const auth=a.initializeAuth(client,{persistence:a.inMemoryPersistence});
      a.connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});
      const token='e30.'+btoa(JSON.stringify({sub:uid,email:uid+'@example.invalid',email_verified:true})).replaceAll('=','')+'.';
      await a.signInWithCredential(auth,a.GoogleAuthProvider.credential(token));
      const db=f.getFirestore(client);f.connectFirestoreEmulator(db,'127.0.0.1',18080);
      const identity=()=>({uid:auth.currentUser?.uid,epoch:1});
      const guard=()=>{if(identity().uid!==uid)throw Error('Unconfirmed emulator owner');};
      window.proto=protocol.createP0BProtocol({db,auth,firestore:f,assertAccess:guard,session:{identity}},id);
      window.journal=await journal.openP0BDeletionJournal({indexedDB,locks:navigator.locks,ownerUid:uid,deviceId:id});
      window.FC={localDeviceLabel:labels.createLocalDeviceLabel({storage:localStorage,deviceId:id,assertAccess:guard})};
      window.P0B=protocol;
    },{uid,id});
    return result;
  }
  let pc=await device('p0b-pc');
  const phone=await device('p0b-phone');
  for(const name of ['data-settings-dom','data-settings-menu-view','data-settings-modal'])
    await pc.page.addScriptTag({url:'/js/app/ui/'+name+'.js'});
  await pc.page.evaluate(()=>{
    FC.projectTakeoverPin=proto.pin;
    FC.dataBackupStore={};
    FC.dataBackupSnapshot={};
    FC.panelBox={open({contentNode}){document.body.append(contentNode);}};
    FC.dataSettingsModal.open();
  });
  await pc.page.getByRole('button',{name:/Bezpieczeństwo/}).click();
  const pinAtStart=await phone.page.evaluate(()=>proto.pin.status());
  if(pinAtStart.configured)await pc.page.getByLabel('Obecny PIN').fill(fixturePin);
  await pc.page.getByLabel('Nowy PIN',{exact:true}).fill(fixturePin);
  await pc.page.getByLabel('Powtórz nowy PIN').fill(fixturePin);
  await pc.page.getByRole('button',{name:'Zapisz PIN'}).click();
  await pc.page.getByRole('status').getByText('Potwierdzono zapis PIN-u.').waitFor();
  assert.equal(await phone.page.evaluate(pin=>proto.pin.verify(pin),fixturePin),pinAtStart.revision+1);
  await pc.page.getByRole('button',{name:'Wróć'}).click();
  await pc.page.getByRole('button',{name:/Bezpieczeństwo/}).click();
  await pc.page.getByLabel('Obecny PIN').fill(fixturePin);
  await pc.page.getByLabel('Nowy PIN',{exact:true}).fill(replacementPin);
  await pc.page.getByLabel('Powtórz nowy PIN').fill(replacementPin);
  await pc.page.getByRole('button',{name:'Zapisz PIN'}).click();
  await pc.page.getByRole('status').getByText('Potwierdzono zapis PIN-u.').waitFor();
  await assert.rejects(phone.page.evaluate(pin=>proto.pin.verify(pin),fixturePin),/LF_P0B_PIN_INCORRECT/);
  assert.equal(await phone.page.evaluate(pin=>proto.pin.verify(pin),replacementPin),pinAtStart.revision+2);
  await pc.page.evaluate(()=>document.querySelector('.data-settings-modal').remove());
  for (const name of ['settings/company-profile-store','ui/data-settings-dom','ui/data-settings-company-view'])
    await pc.page.addScriptTag({url:'/js/app/'+name+'.js'});
  const companyBefore=await pc.page.evaluate(()=>{
    FC.dataSettingsCompanyView.render(document.getElementById('company'));
    return FC.companyProfile.read();
  });
  await pc.page.getByLabel('Nazwa urządzenia').fill('  Komputer w pracowni  ');
  const save=pc.page.getByRole('button',{name:'Zapisz',exact:true});
  await pc.page.getByRole('button',{name:'Przywróć firmę'}).click();
  assert.equal(await pc.page.getByLabel('Nazwa urządzenia').inputValue(),'  Komputer w pracowni  ');
  await pc.page.getByRole('button',{name:'Anuluj zmiany'}).click();
  assert.equal(await pc.page.getByLabel('Nazwa urządzenia').inputValue(),'');
  await pc.page.getByLabel('Nazwa urządzenia').fill('  Komputer w pracowni  ');
  await save.click();
  assert.equal(await pc.page.getByRole('button',{name:'Zapisz nazwę urządzenia'}).count(),0);
  assert.equal(await pc.page.evaluate(()=>FC.localDeviceLabel.read()),'Komputer w pracowni');
  assert.deepEqual(await pc.page.evaluate(()=>FC.companyProfile.read()),companyBefore);
  assert.equal(await phone.page.evaluate(()=>FC.localDeviceLabel.read()),'');
  await pc.page.evaluate(()=>{
    window.notices=[];
    FC.infoBox={open:notice=>notices.push(notice)};
    FC.applicationWrite={handler:()=>async()=>false};
    FC.dataSettingsCompanyView.render(document.getElementById('company'));
  });
  await pc.page.getByLabel('Nazwa robocza').fill('DEMO firma');
  await pc.page.getByLabel('Nazwa urządzenia').fill('Nazwa po awarii');
  await save.click();
  assert.deepEqual(await pc.page.evaluate(()=>FC.companyProfile.read()),companyBefore);
  assert.equal(await pc.page.evaluate(()=>FC.localDeviceLabel.read()),'Komputer w pracowni');
  assert.equal(await pc.page.evaluate(()=>notices.some(n=>n.title==='Zapisano')),false);
  await pc.page.evaluate(()=>{
    window.goodDeviceLabel=FC.localDeviceLabel;
    FC.localDeviceLabel={read:goodDeviceLabel.read,write(){throw Error('Synthetic label failure');}};
    delete FC.applicationWrite;
    FC.dataSettingsCompanyView.render(document.getElementById('company'));
  });
  await pc.page.getByLabel('Nazwa robocza').fill('DEMO firma');
  await pc.page.getByLabel('Nazwa urządzenia').fill('Nazwa po awarii');
  await save.click();
  assert.equal(await pc.page.evaluate(()=>FC.companyProfile.read().company.displayName),'DEMO firma');
  assert.equal(await pc.page.evaluate(()=>goodDeviceLabel.read()),'Komputer w pracowni');
  assert.equal(await pc.page.getByLabel('Nazwa urządzenia').inputValue(),'Nazwa po awarii');
  assert.deepEqual(await pc.page.evaluate(()=>notices.map(n=>n.title)),['Zapis niepełny']);
  await pc.page.evaluate(()=>{FC.localDeviceLabel=goodDeviceLabel;});

  await pc.page.evaluate(data=>proto.createInvestor('browser-investor',data),contact);
  for (const name of ['investor/investor-ui-render','investor/investor-ui'])
    await phone.page.addScriptTag({url:'/js/app/'+name+'.js'});
  await phone.page.evaluate(()=>{
    FC.investorPersistence={searchInvestors:()=>[{id:'browser-investor',name:'Inwestor DEMO'}]};
    FC.projectStore={getById:id=>id==='kitchen-browser'?{title:'Kuchnia'}:{title:'Garderoba'}};
    FC.investorPresence=proto;
    FC.investorUI.state.deleteMode=true;
    FC.investorUI.renderListOnly(document.getElementById('list'));
  });
  const choice=phone.page.getByRole('checkbox',{name:'Zaznacz do usunięcia: Inwestor DEMO'});
  await choice.check();
  await pc.page.evaluate(()=>proto.openInvestor('browser-investor','kartoteka-pc',FC.localDeviceLabel.read()));
  await phone.page.waitForFunction(()=>document.querySelector('#list input[type=checkbox]').disabled&&FC.investorUI.state.deleteIds.length===0);
  assert.equal(await choice.isChecked(),false);
  await phone.page.getByText('Kartoteka · Komputer w pracowni',{exact:true}).waitFor();
  const kitchen=await pc.page.evaluate(()=>proto.acquire({
    iid:'browser-investor',pid:'kitchen-browser',expectedHead:'',deviceLabel:FC.localDeviceLabel.read()
  }));
  const wardrobe=await phone.page.evaluate(()=>proto.acquire({iid:'browser-investor',pid:'wardrobe-browser',expectedHead:'',deviceLabel:'Telefon'}));
  await pc.page.evaluate(editor=>{window.stopContact=proto.watchEditorContact('kitchen-browser',editor,window);},kitchen);
  await phone.page.waitForFunction(async()=>(
    await proto.presence('browser-investor',()=>navigator.onLine)
  ).projects?.some(project=>project.projectId==='kitchen-browser'&&project.activity==='recent'),null,{polling:250});
  assert.equal((await phone.page.evaluate(()=>proto.listProjectHeads())).find(project=>project.projectId==='kitchen-browser').head,null);
  assert.equal(kitchen.deviceLabel,'Komputer w pracowni');
  assert.equal(wardrobe.deviceLabel,'Telefon');
  assert.deepEqual(await phone.page.evaluate(()=>proto.lockStatus('browser-investor','kitchen-browser',()=>navigator.onLine)),
    {state:'held',deviceId:'p0b-pc',deviceLabel:'Komputer w pracowni'});
  await phone.page.getByText(/Kuchnia · Komputer w pracowni/).waitFor();
  await phone.page.evaluate(()=>{
    FC.investorUI.state.deleteMode=false;
    FC.investorUI.renderListOnly(document.getElementById('list'));
  });
  await phone.page.getByText(/Kartoteka · Komputer w pracowni/).waitFor();
  await phone.context.setOffline(true);
  await phone.page.waitForFunction(()=>!navigator.onLine);
  assert.deepEqual(await phone.page.evaluate(()=>proto.lockStatus('browser-investor','kitchen-browser',()=>navigator.onLine)),{state:'unconfirmed'});
  await phone.page.evaluate(()=>{
    FC.investorUI.state.deleteMode=true;
    FC.investorUI.renderListOnly(document.getElementById('list'));
  });
  assert.ok(await choice.isDisabled());
  await phone.page.getByText('Stan zajętości niepotwierdzony',{exact:true}).waitFor();
  await phone.context.setOffline(false);
  await phone.page.waitForFunction(()=>navigator.onLine);
  await assert.rejects(phone.page.evaluate(()=>proto.acquire({iid:'browser-investor',pid:'kitchen-browser',expectedHead:''})),/LF_P0B_EDITOR_CONFLICT/);
  await pc.page.evaluate(()=>window.stopContact());
  await pc.page.evaluate(expectedEditor=>proto.release({iid:'browser-investor',pid:'kitchen-browser',expectedHead:'',expectedEditor}),kitchen);
  await phone.page.evaluate(expectedEditor=>proto.release({iid:'browser-investor',pid:'wardrobe-browser',expectedHead:'',expectedEditor}),wardrobe);
  await stop(pc);
  pc=await device('p0b-pc');
  assert.deepEqual(await pc.page.evaluate(()=>proto.recoverOwnVisit('browser-investor')),{token:'kartoteka-pc',label:'Komputer w pracowni'});
  await pc.page.evaluate(async()=>proto.closeInvestor('browser-investor',(await proto.recoverOwnVisit('browser-investor')).token));
  await pc.page.evaluate(data=>proto.createInvestor('browser-other',data),contact);
  const intent=await pc.page.evaluate(async()=>P0B.createP0BDeletionIntent(
    await Promise.all(['browser-investor','browser-other'].map(proto.investor)),'browser-delete'
  ));

  await pc.context.setOffline(true);
  await pc.page.waitForFunction(()=>navigator.onLine===false);
  await pc.page.evaluate(intent=>journal.enqueue(intent),intent);
  assert.equal((await pc.page.evaluate(()=>journal.reconcile('browser-delete',proto,()=>navigator.onLine))).phase,'queued');
  assert.equal((await phone.page.evaluate(()=>proto.investor('browser-investor'))).deletionId,'');
  await pc.context.setOffline(false);
  await pc.page.waitForFunction(()=>navigator.onLine===true);
  const lost=await pc.page.evaluate(()=>journal.reconcile('browser-delete',{
    async publishDeletion(intent){await proto.publishDeletion(intent);throw Error('Synthetic lost ACK');},
    confirmDeletion:proto.confirmDeletion
  },()=>navigator.onLine));
  assert.equal(lost.phase,'uncertain');
  const deleted=await phone.page.evaluate(()=>proto.investor('browser-investor'));
  assert.equal(deleted.deletionId,'browser-delete');
  assert.equal(deleted.generation,intent.targets['browser-investor']+1);
  assert.equal((await phone.page.evaluate(()=>proto.investor('browser-other'))).deletionId,'browser-delete');
  await stop(pc);
  pc=await device('p0b-pc');
  assert.equal(await pc.page.evaluate(()=>FC.localDeviceLabel.read()),'Komputer w pracowni');
  assert.deepEqual((await pc.page.evaluate(()=>journal.pending())).map(op=>[op.operationId,op.phase]),[['browser-delete','uncertain']]);
  const result=await pc.page.evaluate(()=>journal.reconcile('browser-delete',{
    publishDeletion(){throw Error('An uncertain operation must not publish again');},confirmDeletion:proto.confirmDeletion
  },()=>navigator.onLine));
  assert.equal(result.phase,'verified');
  assert.deepEqual(result.receipt.investorIds,['browser-investor','browser-other']);
  assert.deepEqual(await pc.page.evaluate(()=>proto.investor('browser-investor')),deleted);

  await pc.page.addScriptTag({url:'/js/app/investor/investor-deletion.js'});
  const local=await pc.page.evaluate(async({uid,intent})=>{
    const {openLocalFirstStore}=await import('/sync/local-first-idb.mjs');
    const {applyP0BTombstone}=await import('/tools/firebase-pilot/p0b-local-tombstone.mjs');
    const store=await openLocalFirstStore({indexedDB,locks:navigator.locks,name:'meble-lf-test-p0b-local',
      ownerUid:uid,deviceId:'p0b-pc',instanceId:'fixture',initialize:true});
    const rows={fc_investors_v1:JSON.stringify([{id:'browser-investor',name:'Owned'},{id:'browser-other',name:'Also owned'},{id:'foreign',name:'Retain'}]),
      fc_projects_v1:JSON.stringify([{id:'kitchen-browser',investorId:'browser-investor',projectData:{meta:{roomDefs:{kitchen:{}}}}},{id:'foreign-project',investorId:'foreign',projectData:{}}]),
      fc_quote_snapshots_v1:JSON.stringify([{id:'active-offer',investorId:'browser-investor',projectId:'kitchen-browser'},{id:'retained-offer',investorId:'foreign',projectId:'foreign-project'}]),
      fc_quote_offer_drafts_v1:JSON.stringify([{id:'active-draft',investorId:'browser-other'}]),fc_edit_session_v1:null,
      fc_investor_removed_ids_v1:null,fc_current_project_id_v1:null,fc_current_investor_v1:null,fc_ui_v1:null,fc_project_v1:null,
      fc_project_backup_v1:'exact archived bytes',fc_sheets_v1:'exact catalog bytes'};
    await store.initializeApplication(rows);
    const apply=s=>applyP0BTombstone({protocol:proto,intent,store:s,planLocal:FC.investorDeletion.planLocal,assertAccess(){}});
    await apply(store);
    const reopened=await store.readApplication(),protectedRows=(await store.snapshot('investor-deletions')).protected;
    const guarded=await openLocalFirstStore({indexedDB,locks:navigator.locks,name:'meble-lf-test-p0b-guard',
      ownerUid:uid,deviceId:'p0b-pc',instanceId:'fixture',initialize:true});
    await guarded.initializeApplication(rows);
    await guarded.apply({scope:'kitchen-browser',value:{fixture:true},head:null,expectedVersion:0,
      editor:{deviceId:'p0b-pc',active:true}});
    await guarded.commit({scope:'kitchen-browser',operationId:'guard-queued',value:{fixture:false},expectedVersion:1,
      editor:{deviceId:'p0b-pc',active:true}});
    let refusal;
    try{await apply(guarded);}catch(error){refusal=error.code||error.message;}
    return {rows:reopened.rows,receiptCount:protectedRows.length,refusal,guarded:(await guarded.readApplication()).rows,
      queue:(await guarded.snapshot('kitchen-browser')).operations.map(op=>op.phase)};
  },{uid,intent});
  assert.deepEqual(JSON.parse(local.rows.fc_investors_v1).map(row=>row.id),['foreign']);
  assert.deepEqual(JSON.parse(local.rows.fc_projects_v1).map(row=>row.id),['foreign-project']);
  assert.deepEqual(JSON.parse(local.rows.fc_quote_snapshots_v1).map(row=>row.id),['retained-offer']);
  assert.deepEqual(JSON.parse(local.rows.fc_quote_offer_drafts_v1),[]);
  assert.equal(local.rows.fc_project_backup_v1,'exact archived bytes');
  assert.equal(local.rows.fc_sheets_v1,'exact catalog bytes');
  assert.equal(local.receiptCount,1);
  assert.equal(local.refusal,'DELETE_SYNCED_PROJECT_PROTECTED');
  assert.equal(JSON.parse(local.guarded.fc_investors_v1).length,3);
  assert.deepEqual(local.queue,['queued']);
  await assert.rejects(phone.page.evaluate(async()=>P0B.projectP0BContact(
    await proto.investor('browser-investor'),{id:'kitchen-browser',investorId:'browser-investor'},[{id:'archival-offer'}]
  )),/LF_P0B_INVESTOR_DELETED/);
});
