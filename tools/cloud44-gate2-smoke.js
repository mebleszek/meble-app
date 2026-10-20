// Public offline regressions only. Exact private 635-byte tests remain external.
'use strict';
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-pilot/cloud44-integrity.json')));
assert.equal(manifest.baseMain, 'a1f334df824c10bb54384f7c00eb77b661f9d1b0');
assert.equal(manifest.productionExecutionAllowed, false);
for (const [name, sha] of Object.entries(manifest.sha256)) {
  assert.ok(!name.startsWith('/') && !name.split('/').includes('..'));
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex'), sha, name);
}
const proof = require('./firebase-pilot/cloud42-package.js').inventory();
assert.equal(proof.sourceCount, 425);
assert.equal(proof.productionBaselineApprovedForGate2, false);
process.stdout.write(execFileSync(process.execPath, ['--test', path.join(__dirname, 'firebase-pilot/cloud44-gate2.test.mjs')], {encoding:'utf8'}));
