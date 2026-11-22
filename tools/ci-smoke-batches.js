'use strict';
// 36 unchanged logical shards; heavy shards keep their own runner. Short
// shards run sequentially in pairs, with separate processes/logs/temp roots.
const {SHARDS}=require('./ci-smoke-shards');
function plan(){
 if(SHARDS!==36)throw Error('CI_SMOKE_BATCH_PLAN_CHANGED');
 const groups=Array.from({length:12},(_,i)=>[i+1]);
 for(let left=13,right=36;left<right;left++,right--)groups.push([left,right]);
 if(groups.flat().slice().sort((a,b)=>a-b).join(',')!==Array.from({length:SHARDS},(_,i)=>i+1).join(','))throw Error('CI_SMOKE_BATCH_INCOMPLETE');
 return groups;
}
function select(index){const groups=plan();if(!Number.isSafeInteger(index)||index<1||index>groups.length)throw Error('CI_SMOKE_BATCH_INVALID');return groups[index-1];}
if(require.main===module){try{if(process.argv.length!==3||!/^--batch=[1-9][0-9]*$/.test(process.argv[2]))throw Error('CI_SMOKE_BATCH_INVALID');console.log(select(Number(process.argv[2].slice(8))).join(' '));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={plan,select};
