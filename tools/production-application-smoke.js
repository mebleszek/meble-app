'use strict';
const {execFileSync}=require('node:child_process'),path=require('node:path');
process.stdout.write(execFileSync(process.execPath,['--test',path.join(__dirname,'firebase-pilot/production-application-boundary.test.mjs')],{encoding:'utf8'}));
