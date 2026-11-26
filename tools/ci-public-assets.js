'use strict';
// Exact published bytes. Reads immutable Git blobs and the public Pages site only.
const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {isPublicPath}=require('./offline-assets');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const revision=value=>/^[a-f0-9]{40}$/.test(value||'');
function manifestOf(bytes){
  const source=bytes.toString('utf8'),prefix='self.MEBLE_OFFLINE_ASSETS=';
  if(!source.startsWith(prefix)||!source.endsWith(';\n'))throw Error('PUBLIC_MANIFEST_INVALID');
  const manifest=JSON.parse(source.slice(prefix.length,-2));
  if(!Array.isArray(manifest.files)||!manifest.files.length||sha(JSON.stringify(manifest.files))!==manifest.version)throw Error('PUBLIC_MANIFEST_INVALID');
  const names=new Set();let last='';
  for(const row of manifest.files){
    if(typeof row.path!=='string'||!isPublicPath(row.path)||row.path.split('/').some(s=>s==='..'||s==='.')||/[?#\\]/.test(row.path)||names.has(row.path)||row.path<=last||!Number.isSafeInteger(row.bytes)||row.bytes<0||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('PUBLIC_MANIFEST_INVALID');
    names.add(row.path);last=row.path;
  }
  return manifest;
}
async function verify({head,merge,readBlob,fetchImpl=fetch,site='https://mebleszek.github.io/meble-app/'}){
  if(!revision(head)||!revision(merge))throw Error('PUBLIC_EXACT_SHA_REQUIRED');
  const started=new Date().toISOString(),manifestBytes=readBlob('offline-assets.js'),manifest=manifestOf(manifestBytes);
  async function get(name){
    const response=await fetchImpl(new URL(name,site).href,{cache:'no-store',redirect:'error',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30000)});
    if(response.status!==200)throw Error('HTTP_'+response.status);
    return Buffer.from(await response.arrayBuffer());
  }
  if(!(await get('offline-assets.js')).equals(manifestBytes))throw Error('PUBLIC_MANIFEST_MISMATCH');
  const extra=['offline-worker.js','sw-update.html'].map(path=>{const bytes=readBlob(path);return {path,bytes:bytes.length,sha256:sha(bytes)};});
  const queue=[...manifest.files,...extra],expected=queue.length,failures=[];let checked=0;
  async function worker(){
    for(;;){if(failures.length)return;const row=queue.shift();if(!row)return;
      try{const bytes=await get(row.path);if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('PUBLIC_BYTES_MISMATCH');checked++;}
      catch(error){failures.push({path:row.path,error:error.message});}
    }
  }
  await Promise.all(Array.from({length:4},worker));
  return {status:failures.length?'FAIL':'PASS',head,merge,version:manifest.version,checked,expected,unverified:expected-checked,started,finished:new Date().toISOString(),failures};
}
async function main(){
  const head=process.env.APPROVED_HEAD,merge=process.env.MERGE_SHA;
  let result;
  try{
    if(!revision(head)||!revision(merge))throw Error('PUBLIC_EXACT_SHA_REQUIRED');
    const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
    if(git('rev-parse','HEAD')!==merge||git('rev-parse',head+'^{tree}')!==git('rev-parse',merge+'^{tree}'))throw Error('PUBLIC_GIT_TREE_MISMATCH');
    require('./offline-git-manifest').verify(process.cwd(),merge);
    result=await verify({head,merge,readBlob:name=>execFileSync('git',['show',merge+':'+name],{maxBuffer:32*1024*1024})});
  }catch(error){result={status:'FAIL',head,merge,code:error.message};}
  fs.writeFileSync('ci-public-assets.json',JSON.stringify(result,null,2));
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'status='+result.status+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\nPublic assets: **${result.status}**, ${result.checked??0}/${result.expected??'unconfirmed'}; HEAD ${head}; merge ${merge}.\n`);
  console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;
}
module.exports={verify,manifestOf,main};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
