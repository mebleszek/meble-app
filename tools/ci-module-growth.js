#!/usr/bin/env node
'use strict';
// Change-aware architectural growth gate: legacy large modules are grandfathered,
// but new mixed-responsibility monoliths and unapproved growth are not.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const count=s=>s?s.split(/\r?\n/).length:0;
const metrics=s=>({
 lines:count(s),
 dom:(s.match(/\b(?:querySelector|querySelectorAll|getElementById|addEventListener|innerHTML|insertAdjacentHTML|classList)\b/g)||[]).length,
 storage:(s.match(/\b(?:localStorage|sessionStorage|indexedDB)\b/g)||[]).length,
});
function main(){
 const base=process.env.APPROVED_BASE;
 if(!/^[a-f0-9]{40}$/.test(base||''))throw Error('CI_ARCH_BASE_REQUIRED');
 const changed=git('diff','--name-only',base,'HEAD','--','js','tools').split('\n').filter(f=>/\.(js|mjs|cjs)$/.test(f));
 const approvalFile=path.join(root,'tools/ci-module-growth-exceptions.json');
 const exceptions=JSON.parse(fs.readFileSync(approvalFile,'utf8')).exceptions;
 if(!exceptions||typeof exceptions!=='object'||Array.isArray(exceptions))throw Error('CI_ARCH_EXCEPTIONS_INVALID');
 const approved={};
 for(const [file,record] of Object.entries(exceptions)){
  if(!record||record.baseSha!==base||typeof record.reason!=='string'||record.reason.trim().length<30||
     typeof record.regressionTest!=='string'||!/^tools\/[a-zA-Z0-9_./-]+-smoke\.js$/.test(record.regressionTest)||
     !fs.existsSync(path.join(root,record.regressionTest)))continue;
  approved[file]=true;
 }
 let errors=0,warnings=0;
 for(const file of changed){
  const abs=path.join(root,file);
  if(!fs.existsSync(abs))continue;
  const current=metrics(fs.readFileSync(abs,'utf8'));
  let prior;
  try{prior=metrics(git('show',base+':'+file));}catch(_){prior={lines:0,dom:0,storage:0};}
  const mixed=current.dom>=10&&current.storage>0;
  const production=file.startsWith('js/')&&!file.startsWith('js/testing/');
  const grows=current.lines>prior.lines;
  if(current.lines>=250&&grows){
   warnings++;
   console.log('::warning title=Module growth::'+file+' '+prior.lines+' -> '+current.lines+' LOC; review module responsibility');
  }
  if(current.lines>=400&&grows)console.log('CI_ARCH_REVIEW '+file+' LOC='+current.lines+' mixedDOMStorage='+mixed);
  if(production&&grows&&current.lines>=600&&(prior.lines<600||mixed)&&!approved[file]){
   errors++;console.error('CI_ARCH_MONOLITH_BLOCKED '+file+' prior='+prior.lines+' current='+current.lines+' mixed='+mixed);
  }
 }
 console.log('CI_ARCH_AUDIT changed='+changed.length+' warnings='+warnings+' blocked='+errors);
 if(errors)process.exitCode=1;
}
if(require.main===module){try{main();}catch(e){console.error(e);process.exitCode=1;}}
module.exports={main,metrics};
