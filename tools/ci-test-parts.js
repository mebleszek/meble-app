'use strict';
// CI-only deterministic partitioning; without --ci-part the complete historical suite runs.
function select(parts,argv=process.argv.slice(2)){
  if(!Number.isSafeInteger(parts)||parts<1)throw Error('CI_TEST_PARTS_INVALID_COUNT');
  const flags=argv.filter(arg=>arg.startsWith('--ci-part='));
  if(flags.length>1)throw Error('CI_TEST_PART_DUPLICATE');
  const part=flags.length?Number(flags[0].slice('--ci-part='.length)):0;
  if(!Number.isSafeInteger(part)||part<0||part>parts||(flags.length&&part===0))throw Error('CI_TEST_PART_INVALID');
  const includes=index=>!part||index%parts===part-1;
  const expected=total=>{
    if(!Number.isSafeInteger(total)||total<parts)throw Error('CI_TEST_CASES_INCOMPLETE');
    return part?Array.from({length:total},(_,index)=>includes(index)?1:0).reduce((a,b)=>a+b,0):total;
  };
  const verify=(executed,total)=>{const count=expected(total);if(executed!==count)throw Error('CI_TEST_PART_COVERAGE:'+executed+'/'+count);};
  return {part,parts,includes,expected,verify};
}
module.exports={select};
