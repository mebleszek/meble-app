'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {classify,inspect,verifyDocuments}=require('./ci-docs-scope');
const change=(p,extra={})=>({path:p,status:'M',before:'100644',after:'100644',...extra});
assert.equal(classify(['AGENTS.md','CURRENT_STATE.md','docs/agents/RELEASE.md'].map(p=>change(p))),'documents');
for(const rows of [[],[change('index.html')],[change('AGENTS.md'),change('sync/application-sync-grant.mjs')],[change('tools/ci-docs-scope.js')],[change('.github/workflows/preflight-js.yml')],[change('docs/plans/other.md')],[change('AGENTS.md',{status:'D'})],[change('AGENTS.md',{status:'A'})],[change('AGENTS.md',{after:'120000'})],[change('AGENTS.md',{before:'100755'})],[change('AGENTS.md/../index.html')]])assert.equal(classify(rows),'full');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'meble-docs-scope-'));
const git=args=>execFileSync('git',['-c','safe.directory='+root,'-c','user.name=Scope fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false',...args],{cwd:root,encoding:'utf8'}).trim();
try{
 git(['init','--quiet']);fs.writeFileSync(path.join(root,'AGENTS.md'),'Initial\n');fs.writeFileSync(path.join(root,'index.html'),'app');git(['add','.']);git(['commit','--quiet','-m','base']);const base=git(['rev-parse','HEAD']);
 fs.writeFileSync(path.join(root,'AGENTS.md'),'Approved [app](index.html)\n');git(['add','.']);git(['commit','--quiet','-m','docs']);const head=git(['rev-parse','HEAD']);
 assert.equal(inspect(root,base,head).mode,'documents');assert.equal(verifyDocuments(root,base,head).mode,'documents');assert.throws(()=>inspect(root,'main',head),/EXACT_REVISION/);
 fs.writeFileSync(path.join(root,'AGENTS.md'),'[lost](missing.md)\n');git(['add','.']);git(['commit','--quiet','-m','broken link']);assert.throws(()=>verifyDocuments(root,head,git(['rev-parse','HEAD'])));
 fs.writeFileSync(path.join(root,'index.html'),'changed app');git(['add','.']);git(['commit','--quiet','-m','app']);assert.equal(inspect(root,base,git(['rev-parse','HEAD'])).mode,'full');assert.throws(()=>verifyDocuments(root,base,git(['rev-parse','HEAD'])),/FULL_TESTS_REQUIRED/);
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('PASS documentation scope: exact commits, closed paths and modes, broken links refuse, all code/workflow changes require full CI');
