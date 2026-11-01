'use strict';
// Mandatory Preflight: offline boundaries; full browser/SDK path belongs to CURRENT.
const {execFileSync}=require('node:child_process'),path=require('node:path');
process.stdout.write(execFileSync(process.execPath,['--test',path.join(__dirname,'firebase-pilot/normal-startup-boundary.test.mjs')],{encoding:'utf8'}));
