#!/usr/bin/env node
'use strict';
// Observable performance budget, never a timeout. The child owns test PASS/FAIL.
const {spawn}=require('node:child_process');
function main(args){
 const marker=args.indexOf('--');
 if(marker<1||marker===args.length-1)throw Error('CI_BUDGET_USAGE');
 const flags=args.slice(0,marker),command=args[marker+1],argv=args.slice(marker+2);
 const read=(key,fallback)=>{
  const part=flags.find(s=>s.startsWith('--'+key+'='));
  const value=part?Number(part.split('=')[1]):fallback;
  if(!Number.isSafeInteger(value)||value<1000)throw Error('CI_BUDGET_INVALID_'+key);
  return value;
 };
 const label=(flags.find(x=>x.startsWith('--label='))||'--label=CI').slice(8).replace(/[^a-zA-Z0-9_.-]/g,'_');
 const warn=read('warn-ms',75000),target=read('target-ms',90000);
 if(warn>=target)throw Error('CI_BUDGET_ORDER');
 const started=Date.now();
 const child=spawn(command,argv,{stdio:'inherit',env:process.env});
 const timers=[
  setTimeout(()=>console.log('::warning title=CI performance budget::'+label+' has exceeded '+warn+'ms; investigate optimization (non-blocking)'),warn),
  setTimeout(()=>console.log('::warning title=CI performance budget::'+label+' has exceeded target '+target+'ms; review and optimize (non-blocking)'),target)
 ];
 child.on('error',error=>{for(const t of timers)clearTimeout(t);console.error(error);process.exitCode=1;});
 child.on('exit',(code,signal)=>{
  for(const t of timers)clearTimeout(t);
  const elapsed=Date.now()-started;
  console.log('CI_BUDGET_RESULT '+JSON.stringify({label,elapsedMs:elapsed,targetMs:target,overTarget:elapsed>target}));
  if(signal){console.error('CI_TEST_CHILD_SIGNAL '+signal);process.exitCode=1;}
  else process.exitCode=code===null?1:code;
 });
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error(e);process.exitCode=1;}}
module.exports={main};
