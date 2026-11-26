'use strict';
// Mandatory regression: faster scheduling/downloads must retain all evidence and checks.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {verify}=require('./ci-emulator-cache');
async function main(){
 const {verify:publicAssets,manifestOf}=require('./ci-public-assets');
 const blobs={'index.html':Buffer.from('synthetic index'),'js/app/a.js':Buffer.from('synthetic module'),'offline-worker.js':Buffer.from('worker'),'sw-update.html':Buffer.from('update')};
 const files=['index.html','js/app/a.js'].map(path=>({path,bytes:blobs[path].length,sha256:crypto.createHash('sha256').update(blobs[path]).digest('hex')}));
 blobs['offline-assets.js']=Buffer.from('self.MEBLE_OFFLINE_ASSETS='+JSON.stringify({files,version:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex')})+';\n');
 const base={head:'a'.repeat(40),merge:'b'.repeat(40),readBlob:name=>blobs[name]};
 let active=0,peak=0,calls=[];
 const publicFetch=async(url,options)=>{
   assert.equal(new URL(url).origin,'https://mebleszek.github.io');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
   const name=new URL(url).pathname.slice('/meble-app/'.length);calls.push(name);active++;peak=Math.max(peak,active);
   await new Promise(resolve=>setImmediate(resolve));active--;
   return {status:200,arrayBuffer:async()=>blobs[name]};
 };
 let checked=await publicAssets({...base,fetchImpl:publicFetch});assert.equal(checked.status,'PASS');assert.equal(checked.checked,4);assert.equal(checked.expected,4);assert.equal(new Set(calls).size,5);assert.ok(peak<=4);
 for(const name of ['index.html','js/app/a.js','offline-worker.js','sw-update.html']){
   const bytes=blobs[name];blobs[name]=Buffer.from('tampered');
   // Keep immutable expected Git bytes separate from the public response.
   checked=await publicAssets({...base,readBlob:key=>key===name?bytes:blobs[key],fetchImpl:publicFetch});
   assert.equal(checked.status,'FAIL');assert.ok(checked.failures.some(row=>row.path===name));blobs[name]=bytes;
 }
 await assert.rejects(publicAssets({...base,fetchImpl:async()=>({status:404})}),/HTTP_404/);
 await assert.rejects(publicAssets({...base,head:'main',fetchImpl:publicFetch}),/EXACT_SHA/);
 const original=blobs['offline-assets.js'];blobs['offline-assets.js']=Buffer.from('stale');
 await assert.rejects(publicAssets({...base,readBlob:key=>key==='offline-assets.js'?original:blobs[key],fetchImpl:publicFetch}),/MANIFEST_MISMATCH/);blobs['offline-assets.js']=original;
 for(const path of ['//example.invalid/a.js','js/../secret.js','js/a.js?token=1']){
   const invalid=[{path,bytes:1,sha256:'a'.repeat(64)}];
   assert.throws(()=>manifestOf(Buffer.from('self.MEBLE_OFFLINE_ASSETS='+JSON.stringify({files:invalid,version:crypto.createHash('sha256').update(JSON.stringify(invalid)).digest('hex')})+';\n')),/MANIFEST_INVALID/);
 }
 const failedFiles=Array.from({length:20},(_,i)=>({path:'js/app/f'+String(i).padStart(2,'0')+'.js',bytes:1,sha256:crypto.createHash('sha256').update('x').digest('hex')}));
 const failedManifest=Buffer.from('self.MEBLE_OFFLINE_ASSETS='+JSON.stringify({files:failedFiles,version:crypto.createHash('sha256').update(JSON.stringify(failedFiles)).digest('hex')})+';\n');let failedReads=0;
 checked=await publicAssets({...base,readBlob:key=>key==='offline-assets.js'?failedManifest:blobs[key],fetchImpl:async url=>{
   if(url.endsWith('/offline-assets.js'))return {status:200,arrayBuffer:async()=>failedManifest};
   failedReads++;await new Promise(resolve=>setImmediate(resolve));throw Error('Synthetic unavailable public files');
 }});
 assert.equal(checked.status,'FAIL');assert.equal(checked.checked,0);assert.equal(checked.expected,22);assert.equal(checked.unverified,22);assert.equal(failedReads,4,'Stop queuing after failure, finish only the already owned requests');
 console.log('PASS published release: exact manifest/Git bytes, all files and SW/update, tamper/HTTP/stale/path refusal, bounded parallel reads without retry');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'meble-cache-proof-'));
 try{
  const downloadPath=path.join(root,'cloud-firestore-emulator-v1.22.0.jar'),bytes=Buffer.from('synthetic public emulator bytes');
  const opts={expectedSize:bytes.length,expectedChecksumSHA256:crypto.createHash('sha256').update(bytes).digest('hex')};
  const details={downloadPath,opts};
  assert.deepEqual(await verify(details),{status:'MISS',algorithm:'sha256'});
  fs.writeFileSync(downloadPath,bytes);
  assert.deepEqual(await verify(details),{status:'VERIFIED',algorithm:'sha256'});
  await assert.rejects(verify({...details,opts:{...opts,expectedSize:bytes.length+1}}),/CI_EMULATOR_CACHE_INTEGRITY/);
  fs.writeFileSync(downloadPath,Buffer.alloc(bytes.length,0));
  await assert.rejects(verify(details),/CI_EMULATOR_CACHE_INTEGRITY/);
  fs.writeFileSync(downloadPath,bytes);
  for(const bad of [{...details,opts:{...opts,expectedChecksumSHA256:'invalid'}},{...details,downloadPath:path.join(root,'application.json')},{...details,opts:{...opts,expectedSize:0}}])
   await assert.rejects(verify(bad),/CI_EMULATOR_CACHE_METADATA_INVALID/);
  const old={expectedSize:bytes.length,expectedChecksum:crypto.createHash('md5').update(bytes).digest('hex')};
  assert.deepEqual(await verify({downloadPath,opts:old}),{status:'VERIFIED',algorithm:'md5'});
  fs.unlinkSync(downloadPath);fs.mkdirSync(downloadPath);
  await assert.rejects(verify(details),/CI_EMULATOR_CACHE_INTEGRITY/);
  fs.rmdirSync(downloadPath);
  // A directory symlink/junction requires no elevation on Windows either.
  const target=path.join(root,'public-download');fs.mkdirSync(target);fs.symlinkSync(target,downloadPath,'junction');
  await assert.rejects(verify(details),/CI_EMULATOR_CACHE_INTEGRITY/);
  fs.rmdirSync(target);
  await assert.rejects(verify(details),/CI_EMULATOR_CACHE_INTEGRITY/,'Broken symlink is not a cache miss');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/preflight-js.yml'),'utf8');
 const action=fs.readFileSync(path.join(__dirname,'../.github/actions/test-download-cache/action.yml'),'utf8');
 assert.equal((workflow.match(/uses: \.\/\.github\/actions\/test-download-cache/g)||[]).length,5);
 assert.equal((workflow.match(/ci --prefer-offline --no-audit --no-fund/g)||[]).length,5,'npm ci still verifies locked dependency integrity');
 assert.equal((workflow.match(/node tools\/ci-emulator-cache\.js/g)||[]).length,4);
 assert.deepEqual([...action.matchAll(/path: (.+)/g)].map(m=>m[1].trim()),['~/.npm','~/.cache/firebase/emulators']);
 assert.ok(action.includes("hashFiles('tools/firebase-pilot/package-lock.json')"));
 assert.ok(!action.includes('restore-keys:'),'No fallback to an unrelated dependency lock');
 const profile=require('./ci-smoke-timings-1367.json'),shards=require('./ci-smoke-shards'),context=require('./cloud-ci-context');
 assert.equal(Object.keys(profile.observedMs).length,253);
 assert.ok(Object.values(profile.observedMs).every(n=>Number.isSafeInteger(n)&&n>0));
 assert.equal(profile.normCaseEstimatesMs.length,9);
 assert.ok(profile.normCaseEstimatesMs.every(n=>Number.isSafeInteger(n)&&n>0));
 assert.equal(profile.normCaseEstimatesMs.reduce((a,b)=>a+b,0),[1,2,3,4].reduce((sum,n)=>sum+profile.observedMs['wycena-labor-norms-smoke.js::'+n],0));
 const groups=shards.plan(shards.inventory(__dirname,context.historicalSmoke));
 assert.equal(groups.length,36);
 assert.equal(groups.flat().filter(s=>s.startsWith('wycena-labor-norms-smoke.js::')).length,9);
 console.log('PASS release speed: checksum/size/metadata/tamper/type rejection, public-only locked caches, npm ci and complete 36-group coverage');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
