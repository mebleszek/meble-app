// Discovered by existing Preflight; pure boundaries only, no SDK or credentials.
'use strict';
const {execFileSync} = require('node:child_process');
const path = require('node:path');
process.stdout.write(execFileSync(process.execPath, ['--test', path.join(__dirname, 'firebase-pilot/cloud46e-boundary.test.mjs')], {encoding: 'utf8'}));
