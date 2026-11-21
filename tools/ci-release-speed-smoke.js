'use strict';
// Mandatory regression: faster scheduling/downloads must retain all evidence and checks.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {verify}=require('./ci-emulator-cache');
async function main(){
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
