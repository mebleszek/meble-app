'use strict';
// 36 unchanged logical shards; heavy shards keep their own runner. Short
// shards run sequentially in pairs, with separate processes/logs/temp roots.
const shards=require('./ci-smoke-shards'),{SHARDS}=shards,crypto=require('node:crypto');
const profile=require('./ci-smoke-run-times-1382.json');
function weights(source=profile){
 if(source.groups?.length!==SHARDS||new Set(source.groups.map(row=>row.id)).size!==SHARDS
  ||source.groups.some(row=>!Number.isSafeInteger(row.id)||row.id<1||row.id>SHARDS||!Number.isSafeInteger(row.elapsedMs)||row.elapsedMs<=0||!/^[a-f0-9]{64}$/.test(row.unitSha256)))throw Error('CI_SMOKE_TIMING_PROFILE_INVALID');
 return shards.plan(shards.inventory(__dirname,require('./cloud-ci-context').historicalSmoke)).map((units,index)=>{
  const row=source.groups.find(row=>row.id===index+1),hash=crypto.createHash('sha256').update(units.slice().sort().join('\n')).digest('hex');
  const matched=row.unitSha256===hash;
  return {id:index+1,ms:matched?row.elapsedMs:units.reduce((sum,unit)=>sum+shards.weight(unit),0),matched};
 });
}
function plan(){
 if(SHARDS!==36)throw Error('CI_SMOKE_BATCH_PLAN_CHANGED');
 const ordered=weights().sort((a,b)=>b.ms-a.ms||a.id-b.id);
 const groups=ordered.slice(0,12).map(row=>[row.id]);
 const paired=ordered.slice(12);
 for(let left=0,right=paired.length-1;left<right;left++,right--)groups.push([paired[left].id,paired[right].id]);
 if(groups.flat().slice().sort((a,b)=>a-b).join(',')!==Array.from({length:SHARDS},(_,i)=>i+1).join(','))throw Error('CI_SMOKE_BATCH_INCOMPLETE');
 return groups;
}
function select(index){const groups=plan();if(!Number.isSafeInteger(index)||index<1||index>groups.length)throw Error('CI_SMOKE_BATCH_INVALID');return groups[index-1];}
if(require.main===module){try{if(process.argv.length!==3||!/^--batch=[1-9][0-9]*$/.test(process.argv[2]))throw Error('CI_SMOKE_BATCH_INVALID');console.log(select(Number(process.argv[2].slice(8))).join(' '));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={plan,select,weights};
