'use strict';
// Every candidate test belongs to exactly one mandatory job. No retries or LIVE.
const fs=require('node:fs'),path=require('node:path');
const groups=Object.freeze([
 {id:'room-model',file:'p0b-room-boundary.test.mjs',pattern:'^P0-B room boundary:',emulator:false},
 {id:'room-quote-proof',file:'p0b-room-quote.test.mjs',pattern:'^P0-B room quote proof:',emulator:false},
 {id:'room-quote-rules',file:'p0b-room-quotes-rules.test.mjs',pattern:'^P0-B room quote Rules:'},
 {id:'room-quote-acceptance-conflict',file:'p0b-normal-application.test.mjs',pattern:'^P0-B room quote acceptance conflict:'},
 {id:'room-quote-acceptance',file:'p0b-normal-application.test.mjs',pattern:'^P0-B room quote acceptance:'},
 {id:'room-quote',file:'p0b-normal-application.test.mjs',pattern:'^P0-B room quote:'},
 {id:'room-storage',file:'p0b-room-storage.test.mjs',pattern:'^P0-B room storage:',emulator:false},
 {id:'normal-rules',file:'p0b-normal-rules.test.mjs',pattern:'^P0-B normal registry Rules:'},
 {id:'rules',file:'p0b-investor-rules.test.mjs',pattern:'^P0-B (lossless|heartbeat scheduler|candidate Rules:)'},
 {id:'recovery',file:'p0b-investor-rules.test.mjs',pattern:'^P0-B takeover and project replacement'},
 {id:'profiles',file:'p0b-investor-rules.test.mjs',pattern:'^P0-B two real Chromium profiles:'},
 {id:'compatibility',file:'p0b-startup-compatibility.test.mjs',pattern:'^P0-B compatibility:'},
 {id:'normal-startup',file:'p0b-startup-compatibility.test.mjs',pattern:'^P0-B normal startup diagnostic:'},
 {id:'signed-startup',file:'p0b-startup-compatibility.test.mjs',pattern:'^P0-B signed startup diagnostic:'},
 {id:'signed-clean',file:'p0b-normal-application.test.mjs',pattern:'^P0-B signed DEMO clean registry:'},
 {id:'normal-clean',file:'p0b-normal-application.test.mjs',pattern:'^P0-B normal DEMO clean registry:'},
 {id:'storage',file:'p0b-registry-storage.test.mjs',pattern:'^P0-B (registry boundary|terminal tombstone)',emulator:false}
]);
function plan(cwd){
 const files=[...new Set(groups.map(group=>group.file))],coverage=[];
 for(const file of files){
  const source=fs.readFileSync(path.join(cwd,file),'utf8');
  const names=Array.from(source.matchAll(/^test\('([^']+)'/gm),match=>match[1]);
  if(!names.length||(source.match(/^test\(/gm)||[]).length!==names.length||new Set(names).size!==names.length)throw Error('P0B_CI_TEST_INVENTORY_INVALID:'+file);
  for(const name of names){
   const owners=groups.filter(group=>group.file===file&&new RegExp(group.pattern).test(name));
   if(owners.length!==1)throw Error('P0B_CI_MISSING_OR_DUPLICATE_TEST:'+name);
  }
  coverage.push({file,names});
 }
 return groups.map(group=>({...group,names:coverage.find(row=>row.file===group.file).names.filter(name=>new RegExp(group.pattern).test(name))}));
}
function select(cwd,id){
 const selected=plan(cwd).filter(group=>group.id===id);
 if(selected.length!==1||!selected[0].names.length)throw Error('P0B_CI_SEGMENT_INVALID:'+id);
 return selected[0];
}
module.exports={groups,plan,select};
