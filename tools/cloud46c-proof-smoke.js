// Discovered by the existing Preflight. No SDK, emulator or private rollback.
'use strict';
const {execFileSync} = require('node:child_process');
const path = require('node:path');
process.stdout.write(execFileSync(process.execPath, ['--test', path.join(__dirname, 'firebase-pilot/cloud46c-proof.test.mjs')], {encoding: 'utf8'}));
