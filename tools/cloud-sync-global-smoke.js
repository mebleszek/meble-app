// Existing Preflight discovers this wrapper; emulator coverage is in npm test.
'use strict';
const {execFileSync} = require('node:child_process');
const path = require('node:path');
process.stdout.write(execFileSync(process.execPath, ['--test', path.join(__dirname, 'firebase-pilot/cloud-sync-boundary.test.mjs')], {encoding: 'utf8'}));
