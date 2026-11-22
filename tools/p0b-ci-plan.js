'use strict';
// Every candidate test belongs to exactly one mandatory job. No retries or LIVE.
const fs=require('node:fs'),path=require('node:path');
const groups=Object.freeze([
 {id:'startup-draft-recovery',file:'p0b-normal-application.test.mjs',pattern:'^P0-B startup draft:'},
 {id:'quote-access-contract',file:'p0b-quote-access.test.mjs',pattern:'^P0-B quote access:',emulator:false},
 {id:'manual-sync-quote',file:'p0b-normal-application.test.mjs',pattern:'^P0-B manual quote: header'},
 {id:'manual-quote-restart',file:'p0b-normal-application.test.mjs',pattern:'^P0-B manual quote: SIGKILL'},
 {id:'quote-receiver-variant',file:'p0b-normal-application.test.mjs',pattern:'^P0-B phone quote flow: fresh receiver'},
 {id:'quote-remove-overlap',file:'p0b-normal-application.test.mjs',pattern:'^P0-B phone quote flow: calculate overlaps'},
 {id:'quote-remove-single',file:'p0b-normal-application.test.mjs',pattern:'^P0-B quote removal single:'},
 {id:'quote-remove-combined',file:'p0b-normal-application.test.mjs',pattern:'^P0-B quote removal combined:'},
 {id:'desktop-presence',file:'p0b-normal-application.test.mjs',pattern:'^P0-B signed desktop presence:'},
 {id:'background-resume',file:'p0b-normal-application.test.mjs',pattern:'^P0-B signed background resume:'},
 {id:'tab-save',file:'p0b-normal-application.test.mjs',pattern:'^P1 tab Save and proceed:'},
 {id:'duplicate-replacement',file:'p0b-normal-application.test.mjs',pattern:'^P0-B duplicate replacement:'},
 {id:'project-batch-timer',file:'p0b-normal-application.test.mjs',pattern:'^P1 normal DEMO idle batching:'},
 {id:'project-offline-quote',file:'p0b-normal-application.test.mjs',pattern:'^P1 normal DEMO offline quote:'},
 {id:'project-batch-quote',file:'p0b-normal-application.test.mjs',pattern:'^P1 signed DEMO quote barrier:'},
 {id:'project-batch-recovery',file:'p0b-normal-application.test.mjs',pattern:'^P1 normal DEMO delivery:'},
 {id:'room-model',file:'p0b-room-boundary.test.mjs',pattern:'^P0-B room boundary:',emulator:false},
 {id:'room-quote-proof',file:'p0b-room-quote.test.mjs',pattern:'^P0-B room quote proof:',emulator:false},
 {id:'room-quote-rules',file:'p0b-room-quotes-rules.test.mjs',pattern:'^P0-B room quote Rules:'},
 {id:'room-quote-variants',file:'p0b-normal-application.test.mjs',pattern:'^P0-B room quote variants:'},
 {id:'room-quote-promotion',file:'p0b-normal-application.test.mjs',pattern:'^P0-B room quote promotion:'},
 {id:'room-quote-staging',file:'p0b-normal-application.test.mjs',pattern:'^P0-B room quote staging:'},
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
 {id:'signed-quote',file:'p0b-normal-application.test.mjs',pattern:'^P0-B signed room deployment:'},
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
