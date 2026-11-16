import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {assertFails, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import * as f from 'firebase/firestore';
import {createP0BProtocol, createP0BDeletionIntent, inspectP0BCompatibility, projectP0BContact} from './p0b-protocol.mjs';

const {p0bApplicationRules} = createRequire(import.meta.url)('./p0b-application-rules.js');
const uid = 'synthetic-p0b-owner';
const claims = {email_verified:true, firebase:{sign_in_provider:'google.com'}};
const contact = {name:'DEMO', phone:'111', email:'', address:'', notes:''};
const ref = (db, group, key) => f.doc(db, 'users', uid, group, key);
const acq = (iid,pid,deviceLabel = '', expectedHead = '') => ({iid,pid,deviceLabel,expectedHead});

export async function p0bFixture(t) {
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
    return {db, protocol:createP0BProtocol(connection,deviceId)};
  }
  return {env, client};
}

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
  const history=(await f.getDocFromServer(revision)).data();
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
  assert.throws(()=>createP0BDeletionIntent([zero,beforeOther],'bulk'),{code:'LF_P0B_BULK_ATOMICITY_REQUIRED'});
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
  const assets=new Map([
    ...['p0b-protocol','p0b-deletion-journal'].map(name=>['/tools/firebase-pilot/'+name+'.mjs','tools/firebase-pilot/'+name+'.mjs']),
    ...['local-first-values','local-device-label'].map(name=>['/sync/'+name+'.mjs','sync/'+name+'.mjs']),
    ...['app','auth','firestore'].map(name=>['/__sdk/firebase-'+name+'.js','tools/firebase-pilot/node_modules/firebase/firebase-'+name+'.js']),
    ...['ui/data-settings-dom','ui/data-settings-company-view','settings/company-profile-store'].map(name=>['/js/app/'+name+'.js','js/app/'+name+'.js'])
  ]);
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><main id="company"></main>');return;}
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
  for (const name of ['settings/company-profile-store','ui/data-settings-dom','ui/data-settings-company-view'])
    await pc.page.addScriptTag({url:'/js/app/'+name+'.js'});
  const companyBefore=await pc.page.evaluate(()=>{
    FC.dataSettingsCompanyView.render(document.getElementById('company'));
    return FC.companyProfile.read();
  });
  await pc.page.getByLabel('Nazwa urządzenia').fill('  Komputer w pracowni  ');
  await pc.page.getByRole('button',{name:'Zapisz nazwę urządzenia'}).click();
  assert.equal(await pc.page.evaluate(()=>FC.localDeviceLabel.read()),'Komputer w pracowni');
  assert.deepEqual(await pc.page.evaluate(()=>FC.companyProfile.read()),companyBefore);
  assert.equal(await phone.page.evaluate(()=>FC.localDeviceLabel.read()),'');

  await pc.page.evaluate(data=>proto.createInvestor('browser-investor',data),contact);
  const kitchen=await pc.page.evaluate(()=>proto.acquire({
    iid:'browser-investor',pid:'kitchen-browser',expectedHead:'',deviceLabel:FC.localDeviceLabel.read()
  }));
  const wardrobe=await phone.page.evaluate(()=>proto.acquire({iid:'browser-investor',pid:'wardrobe-browser',expectedHead:'',deviceLabel:'Telefon'}));
  assert.equal(kitchen.deviceLabel,'Komputer w pracowni');
  assert.equal(wardrobe.deviceLabel,'Telefon');
  assert.deepEqual(await phone.page.evaluate(()=>proto.lockStatus('browser-investor','kitchen-browser',()=>navigator.onLine)),
    {state:'held',deviceId:'p0b-pc',deviceLabel:'Komputer w pracowni'});
  await phone.context.setOffline(true);
  await phone.page.waitForFunction(()=>!navigator.onLine);
  assert.deepEqual(await phone.page.evaluate(()=>proto.lockStatus('browser-investor','kitchen-browser',()=>navigator.onLine)),{state:'unconfirmed'});
  await phone.context.setOffline(false);
  await phone.page.waitForFunction(()=>navigator.onLine);
  await assert.rejects(phone.page.evaluate(()=>proto.acquire({iid:'browser-investor',pid:'kitchen-browser',expectedHead:''})),/LF_P0B_EDITOR_CONFLICT/);
  await pc.page.evaluate(expectedEditor=>proto.release({iid:'browser-investor',pid:'kitchen-browser',expectedHead:'',expectedEditor}),kitchen);
  await phone.page.evaluate(expectedEditor=>proto.release({iid:'browser-investor',pid:'wardrobe-browser',expectedHead:'',expectedEditor}),wardrobe);
  const intent=await pc.page.evaluate(async()=>P0B.createP0BDeletionIntent([await proto.investor('browser-investor')],'browser-delete'));

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
  assert.equal(deleted.generation,intent.expectedGeneration+1);
  await stop(pc);
  pc=await device('p0b-pc');
  assert.equal(await pc.page.evaluate(()=>FC.localDeviceLabel.read()),'Komputer w pracowni');
  assert.deepEqual((await pc.page.evaluate(()=>journal.pending())).map(op=>[op.operationId,op.phase]),[['browser-delete','uncertain']]);
  const result=await pc.page.evaluate(()=>journal.reconcile('browser-delete',{
    publishDeletion(){throw Error('An uncertain operation must not publish again');},confirmDeletion:proto.confirmDeletion
  },()=>navigator.onLine));
  assert.equal(result.phase,'verified');
  assert.equal(result.receipt.generation,deleted.generation);
  assert.deepEqual(await pc.page.evaluate(()=>proto.investor('browser-investor')),deleted);
  await assert.rejects(phone.page.evaluate(async()=>P0B.projectP0BContact(
    await proto.investor('browser-investor'),{id:'kitchen-browser',investorId:'browser-investor'},[{id:'archival-offer'}]
  )),/LF_P0B_INVESTOR_DELETED/);
});
