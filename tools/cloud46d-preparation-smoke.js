// Existing Preflight discovers this. No SDK, credentials or private bytes.
'use strict';
const {execFileSync} = require('node:child_process');
const path = require('node:path');
process.stdout.write(execFileSync(process.execPath, ['--test', path.join(__dirname, 'firebase-pilot/cloud46d-preparation.test.mjs')], {encoding: 'utf8'}));
