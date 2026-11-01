// Mandatory Preflight discovers this smoke; no SDK or production requests.
'use strict';
const {execFileSync} = require('node:child_process');
const path = require('node:path');
process.stdout.write(execFileSync(process.execPath, ['--test', path.join(__dirname, 'firebase-pilot/cloud46f-offline.test.mjs')], {encoding: 'utf8'}));
