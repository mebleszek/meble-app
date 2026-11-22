'use strict';
// Closed reduced scopes; unknown changes always use full CI. No runtime-file bypass.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const allowed=new Set(['AGENTS.md','CURRENT_STATE.md','docs/agents/RELEASE.md','docs/agents/TESTING.md','docs/plans/test-strategy-playwright-20261115.md']);
const tests=new Set(require('./ci-test-maintenance').standalone.map(name=>'tools/'+name));
function classify(changes){
 if(!changes.length||changes.some(c=>c.status!=='M'||c.before!=='100644'||c.after!=='100644'))return 'full';
 if(changes.every(c=>allowed.has(c.path)))return 'documents';
 return changes.every(c=>allowed.has(c.path)||tests.has(c.path))?'tests':'full';
}
const git=(root,args)=>execFileSync('git',['-c','safe.directory='+root,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
function inspect(root,base,head){
 if(!/^[a-f0-9]{40}$/.test(base||'')||!(/^[a-f0-9]{40}$/.test(head||''))||git(root,['rev-parse','HEAD']).trim()!==head||git(root,['merge-base',base,head]).trim()!==base)throw Error('CI_DOCS_EXACT_REVISION_REQUIRED');
 const tokens=git(root,['diff','--raw','-z','--no-renames','--no-abbrev',base,head,'--']).split('\0'),changes=[];
 for(let i=0;i<tokens.length-1;i+=2){const m=/^:([0-9]{6}) ([0-9]{6}) [a-f0-9]{40} [a-f0-9]{40} ([A-Z])$/.exec(tokens[i]);if(!m||!tokens[i+1])throw Error('CI_DOCS_DIFF_UNCONFIRMED');changes.push({path:tokens[i+1],before:m[1],after:m[2],status:m[3]});}
 let mode=classify(changes);
 // Both old/new versions must remain standalone, without reusable fixture exports.
 if(mode==='tests')for(const row of changes.filter(c=>tests.has(c.path)))for(const sha of [base,head]){
  if(/\bmodule\s*\.\s*exports\b|\bexports\s*[.\[]/.test(git(root,['show',sha+':'+row.path])))mode='full';
 }
 return {mode,changes};
}
function verifyDocuments(root,base,head,withTests=false){
 const result=inspect(root,base,head);if(result.mode!=='documents'&&!(withTests&&result.mode==='tests'))throw Error('CI_DOCS_FULL_TESTS_REQUIRED');
 for(const row of result.changes.filter(c=>allowed.has(c.path))){
  const raw=execFileSync('git',['-c','safe.directory='+root,'show',head+':'+row.path],{cwd:root,maxBuffer:3*1024*1024});
  const content=new TextDecoder('utf-8',{fatal:true}).decode(raw);
  if(!content.trim()||content.includes('\0')||raw.length>2*1024*1024)throw Error('CI_DOCS_CONTENT_INVALID');
  for(const m of content.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)){
   const href=m[1].replace(/^<|>$/g,'').split('#')[0];if(!href||/^https?:\/\//.test(href))continue;
   const target=path.posix.normalize(path.posix.join(path.posix.dirname(row.path),href));
   if(target.startsWith('../')||path.posix.isAbsolute(href)||href.includes('\\')||/^[a-z]+:/i.test(href))throw Error('CI_DOCS_LINK_INVALID');
   git(root,['cat-file','-e',head+':'+target]);
  }
 }
 return result;
}
if(require.main===module){try{
 const [base,head,flag]=process.argv.slice(2),root=path.resolve(__dirname,'..');
 const result=flag==='--verify-documents'?verifyDocuments(root,base,head):inspect(root,base,head);
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'release_mode='+result.mode+'\n');
 console.log('CI release scope: '+result.mode+'; '+result.changes.length+' changed paths; exact HEAD '+head+' BASE '+base);
}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={classify,inspect,verifyDocuments};
