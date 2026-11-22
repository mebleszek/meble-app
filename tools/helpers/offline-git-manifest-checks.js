'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {verify}=require('../offline-git-manifest');
function run(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'meble-git-manifest-')),runner=fs.mkdtempSync(path.join(os.tmpdir(),'meble-git-manifest-runner-'));
 const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 const files=['assets/probe.png','index.html','js/main.js'];
 const write=()=>{const rows=files.map(file=>{const bytes=fs.readFileSync(path.join(root,file));return {path:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
  const version=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');fs.writeFileSync(path.join(root,'offline-assets.js'),'self.MEBLE_OFFLINE_ASSETS='+JSON.stringify({version,files:rows})+';\n');};
 const commit=()=>{git('add','.');git('-c','user.name=CI fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','--quiet','-m','Synthetic manifest');};
 try{
  git('init','--quiet');git('config','core.autocrlf','true');
  for(const dir of ['assets','js','sync'])fs.mkdirSync(path.join(root,dir));
  fs.writeFileSync(path.join(root,'.gitattributes'),'*.js text eol=lf\n*.html text eol=lf\n*.png -text\n');
  fs.writeFileSync(path.join(root,'assets/probe.png'),Buffer.from([137,80,13,10,0,255]));
  fs.writeFileSync(path.join(root,'index.html'),'<!doctype html>\n');fs.writeFileSync(path.join(root,'js/main.js'),'window.synthetic=true;\n');
  fs.writeFileSync(path.join(root,'private.json'),'NOT_A_PUBLIC_ASSET');write();commit();
  const first=verify(root);assert.equal(first.count,3);assert.deepEqual(verify(root,'INDEX').version,first.version);
  fs.writeFileSync(path.join(root,'js/main.js'),'window.synthetic=true;\r\n');write();git('add','.');
  assert.equal(verify(root).version,first.version,'Mutable working bytes cannot alter a committed proof');
  assert.throws(()=>verify(root,'INDEX'),/OFFLINE_GIT_MANIFEST_STALE/);commit();assert.throws(()=>verify(root),/OFFLINE_GIT_MANIFEST_STALE/);
  const badHead=git('rev-parse','HEAD'),base=git('rev-parse','HEAD^');
  assert.throws(()=>require('../cloud-ci-prepare').prepare(root,badHead,runner,base),/OFFLINE_GIT_MANIFEST_STALE/);
  assert.deepEqual(fs.readdirSync(runner),[],'Safety rejects stale committed bytes before historical cloning, SDK installation or GITHUB_ENV writes');
  fs.writeFileSync(path.join(root,'js/main.js'),'window.synthetic=true;\n');write();git('add','.');assert.equal(verify(root,'INDEX').version,first.version);commit();assert.equal(verify(root).version,first.version);
  fs.appendFileSync(path.join(root,'assets/probe.png'),Buffer.from([13,10,254]));git('add','.');assert.throws(()=>verify(root,'INDEX'),/OFFLINE_GIT_MANIFEST_STALE/);
  write();git('add','.');assert.notEqual(verify(root,'INDEX').version,first.version,'Binary bytes are hashed exactly, without newline normalization');
  fs.writeFileSync(path.join(root,'sync/extra.mjs'),'export const extra=true;\n');git('add','.');assert.throws(()=>verify(root,'INDEX'),/OFFLINE_GIT_MANIFEST_STALE/);
  git('update-index','--force-remove','sync/extra.mjs');const blob=git('rev-parse','HEAD:js/main.js');git('update-index','--cacheinfo','120000,'+blob+',js/main.js');assert.throws(()=>verify(root,'INDEX'),/OFFLINE_GIT_SOURCE_INVALID/);
  assert.throws(()=>verify(root,'main'),/OFFLINE_GIT_REVISION_INVALID/);
  console.log('PASS exact Git manifest: committed/index bytes, real CRLF staging RED→GREEN, binary integrity, missing assets and unsafe modes');
 }finally{
  for(const dir of [root,runner]){const absolute=path.resolve(dir),temp=path.resolve(os.tmpdir())+path.sep;
   if(!absolute.startsWith(temp)||!path.basename(absolute).startsWith('meble-git-manifest-'))throw Error('FIXTURE_CLEANUP_PATH_INVALID');
   fs.rmSync(absolute,{recursive:true,force:true});}
 }
}
module.exports={run};
