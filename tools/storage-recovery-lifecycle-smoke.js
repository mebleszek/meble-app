'use strict';
// Only fresh-IDB initialization and non-destructive COPIED cancellation.
const cp=require('node:child_process'),path=require('node:path');
require('./script-versions').assertVersions(path.join(__dirname,'..'));
const result=cp.spawnSync(process.execPath,[path.join(__dirname,'storage-recovery-browser-smoke.js'),'--lifecycle-only'],{encoding:'utf8',maxBuffer:8*1024*1024});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
if(result.error)console.error(result.error.message);
process.exitCode=result.error||result.status!==0?1:0;
