'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {classify,inspect,verifyDocuments}=require('./ci-docs-scope');
const {standalone,selected,executeFiles}=require('./ci-test-maintenance');
const change=(p,extra={})=>({path:p,status:'M',before:'100644',after:'100644',...extra});
assert.equal(classify(['AGENTS.md','CURRENT_STATE.md','docs/agents/RELEASE.md'].map(p=>change(p))),'documents');
assert.equal(classify(['docs/agents/TESTING.md','docs/plans/test-strategy-playwright-20261115.md'].map(p=>change(p))),'documents');
assert.equal(classify([change('tools/project-owned-pcv-smoke.js'),change('CURRENT_STATE.md')]),'tests');
assert.equal(classify([change('tools/effective-project-pcv-smoke.js')]),'full','A shared fixture must retain full integration coverage');
for(const file of standalone){
 assert.equal(classify([change('tools/'+file)]),'tests');
 assert.deepEqual(selected({mode:'tests',changes:[change('tools/'+file),change('CURRENT_STATE.md')]}),['tools/'+file]);
 for(const extra of [{status:'A'},{status:'D'},{after:'120000'},{before:'100755'}])assert.equal(classify([change('tools/'+file,extra)]),'full');
 for(const other of ['js/app/project/project-pcv-overrides.js','sync/local-first-sync.mjs','tools/helpers/browser-test-readiness.js','tools/ci-test-maintenance.js','tools/firebase-pilot/p0b-normal-application.test.mjs','.github/workflows/preflight-js.yml'])assert.equal(classify([change('tools/'+file),change(other)]),'full');
}
assert.throws(()=>selected({mode:'full',changes:[]}),/SCOPE_REQUIRED/);
assert.throws(()=>selected({mode:'tests',changes:[]}),/PLAN_INVALID/);
assert.throws(()=>selected({mode:'tests',changes:[change('tools/unknown-smoke.js')]}),/PLAN_INVALID/);
const cli=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'ci-test-maintenance.js'),'main','main'],{encoding:'utf8'});
assert.equal(cli.status,1);assert.match(cli.stderr,/CI_DOCS_EXACT_REVISION_REQUIRED/);assert.doesNotMatch(cli.stderr,/circular dependency|TypeError/,'CLI must initialize the real scope policy before validating arguments');
for(const rows of [[],[change('index.html')],[change('AGENTS.md'),change('sync/application-sync-grant.mjs')],[change('tools/ci-docs-scope.js')],[change('.github/workflows/preflight-js.yml')],[change('docs/plans/other.md')],[change('AGENTS.md',{status:'D'})],[change('AGENTS.md',{status:'A'})],[change('AGENTS.md',{after:'120000'})],[change('AGENTS.md',{before:'100755'})],[change('AGENTS.md/../index.html')]])assert.equal(classify(rows),'full');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'meble-docs-scope-'));
const git=args=>execFileSync('git',['-c','safe.directory='+root,'-c','user.name=Scope fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false',...args],{cwd:root,encoding:'utf8'}).trim();
try{
 git(['init','--quiet']);fs.writeFileSync(path.join(root,'AGENTS.md'),'Initial\n');fs.writeFileSync(path.join(root,'index.html'),'app');fs.mkdirSync(path.join(root,'tools'));fs.writeFileSync(path.join(root,'tools/project-owned-pcv-smoke.js'),'console.log("fixture original");\n');git(['add','.']);git(['commit','--quiet','-m','base']);const base=git(['rev-parse','HEAD']);
 fs.writeFileSync(path.join(root,'AGENTS.md'),'Approved [app](index.html)\n');git(['add','.']);git(['commit','--quiet','-m','docs']);const head=git(['rev-parse','HEAD']);
 assert.equal(inspect(root,base,head).mode,'documents');assert.equal(verifyDocuments(root,base,head).mode,'documents');assert.throws(()=>inspect(root,'main',head),/EXACT_REVISION/);
 fs.writeFileSync(path.join(root,'tools/project-owned-pcv-smoke.js'),'console.log("fixture updated");\n');git(['add','.']);git(['commit','--quiet','-m','isolated test']);const testHead=git(['rev-parse','HEAD']);
 assert.equal(inspect(root,base,testHead).mode,'tests');assert.equal(verifyDocuments(root,base,testHead,true).mode,'tests');assert.throws(()=>verifyDocuments(root,base,testHead),/FULL_TESTS_REQUIRED/);
 assert.deepEqual(selected(inspect(root,base,testHead)),['tools/project-owned-pcv-smoke.js']);
 fs.appendFileSync(path.join(root,'tools/project-owned-pcv-smoke.js'),'module.exports={fixture:true};\n');git(['add','.']);git(['commit','--quiet','-m','shared fixture']);const shared=git(['rev-parse','HEAD']);
 assert.equal(inspect(root,base,shared).mode,'full','Adding fixture exports cannot use the standalone route');
 fs.writeFileSync(path.join(root,'tools/project-owned-pcv-smoke.js'),'console.log("fixture standalone again");\n');git(['add','.']);git(['commit','--quiet','-m','remove exports']);assert.equal(inspect(root,shared,git(['rev-parse','HEAD'])).mode,'full','Previous consumers need full coverage when removing exports');
 fs.writeFileSync(path.join(root,'AGENTS.md'),'[lost](missing.md)\n');git(['add','.']);git(['commit','--quiet','-m','broken link']);assert.throws(()=>verifyDocuments(root,head,git(['rev-parse','HEAD'])));
 fs.writeFileSync(path.join(root,'index.html'),'changed app');git(['add','.']);git(['commit','--quiet','-m','app']);assert.equal(inspect(root,base,git(['rev-parse','HEAD'])).mode,'full');assert.throws(()=>verifyDocuments(root,base,git(['rev-parse','HEAD'])),/FULL_TESTS_REQUIRED/);
}finally{fs.rmSync(root,{recursive:true,force:true});}
// Actual child processes, not application or Firebase substitutes. A failure
// must survive aggregation, while the following independent file still runs.
const children=fs.mkdtempSync(path.join(os.tmpdir(),'meble-selected-children-'));
try{
 fs.writeFileSync(path.join(children,'fail.js'),'process.exitCode=7;');
 fs.writeFileSync(path.join(children,'pass.js'),'require("fs").writeFileSync("executed","yes");');
 assert.equal(executeFiles(children,['fail.js','pass.js']),1);
 assert.equal(fs.readFileSync(path.join(children,'executed'),'utf8'),'yes');
 assert.equal(executeFiles(children,['pass.js']),0);
 assert.equal(executeFiles(children,['missing.js']),1,'Missing executable test cannot report success');
}finally{fs.rmSync(children,{recursive:true,force:true});}
console.log('PASS reduced CI scopes: exact commits, closed docs/standalone tests, mixed code/shared fixtures/unknown/new/deleted/mode changes require full CI, broken links refuse');
