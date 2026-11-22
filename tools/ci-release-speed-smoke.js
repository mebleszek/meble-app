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
 const profile=require('./ci-smoke-timings-1372.json'),shards=require('./ci-smoke-shards'),context=require('./cloud-ci-context');
 assert.equal(Object.keys(profile.observedMs).length,260);
 assert.ok(Object.values(profile.observedMs).every(n=>Number.isSafeInteger(n)&&n>0));
 const prefix='wycena-labor-norms-smoke.js::';
 assert.equal(Object.keys(profile.estimatedMs).length,7);
 assert.ok(Object.values(profile.estimatedMs).every(n=>Number.isSafeInteger(n)&&n>0));
 assert.equal([8,9,10,11,12,13].reduce((sum,n)=>sum+profile.estimatedMs[prefix+n],0),profile.observedMs[prefix+8]);
 assert.equal(profile.estimatedMs[prefix+14],profile.observedMs[prefix+9]);
 const norms=require('./wycena-labor-norms-smoke').tests;
 assert.equal(norms.length,14);
 assert.deepEqual(norms.filter(([name])=>name.startsWith('repair: legacy workshop shelf norms never suppress independent on-site placement: ')).map(([name])=>name.split(': ').at(-1)),['adjustable/none','adjustable/cabinet','adjustable/offer','fixed/none','fixed/cabinet','fixed/offer']);
 const units=shards.units(shards.inventory(__dirname,context.historicalSmoke));
 assert.equal(new Set(units).size,units.length);
 const unmeasured=units.filter(unit=>!Object.hasOwn(profile.estimatedMs,unit)&&!Object.hasOwn(profile.observedMs,unit));
 if(unmeasured.length)console.log('CI_TIMING_ESTIMATE: unmeasured future units use the explicit 1000 ms fallback; calibrate after CI: '+unmeasured.join(', '));
 assert.equal(shards.weight('future-security-regression-smoke.js'),1000,'New security tests remain scheduled before their first timing measurement');
 const groups=shards.plan(shards.inventory(__dirname,context.historicalSmoke));
 assert.equal(groups.length,36);
 assert.equal(groups.flat().filter(s=>s.startsWith('wycena-labor-norms-smoke.js::')).length,14);
 console.log('PASS release speed: checksum/size/metadata/tamper/type rejection, public-only locked caches, npm ci and complete 36-group coverage');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
