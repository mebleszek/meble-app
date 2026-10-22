import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
import proof from './cloud46c-proof.js';
import gate from './cloud44-gate2.js';
const require = createRequire(import.meta.url);
const now = Date.now();
function evidence() {
  const pin = proof.inventory(), expiresAt = now + 600000;
  const input = {type: 'emulator-rehearsal-only', projectId: 'demo-meble-app', database: '(default)',
    uid: 'synthetic-owner', attemptId: 'synthetic-attempt', base: proof.BASE,
    executorSha256: pin.executorSha256, packageSha256: pin.packageSha256, rulesSha256: pin.rulesSha256, expiresAt};
  input.approvals = proof.SCOPES.map(scope => ({type: input.type, scope, decisionId: 'synthetic-' + scope,
    projectId: input.projectId, database: input.database, uid: input.uid, attemptId: input.attemptId,
    executorSha256: pin.executorSha256, expiresAt}));
  return input;
}
test('Demo receipts bind exact package, UID, deadline, base and four distinct decisions', () => {
  const input = evidence(), result = proof.reviewDemoEvidence(input, now);
  assert.deepEqual(result, input); assert.notEqual(result, input);
  for (const change of [x => x.projectId = 'mebleszek-meble-app', x => x.database = 'foreign', x => x.base = 'f'.repeat(40),
    x => x.uid = '../foreign', x => x.attemptId = '', x => x.type = 'explicit-production-decision',
    x => x.executorSha256 = 'f'.repeat(64), x => x.rulesSha256 = 'f'.repeat(64), x => x.expiresAt = now,
    x => x.approvals.pop(), x => x.approvals[1].decisionId = x.approvals[0].decisionId,
    x => x.approvals[0].uid = 'foreign', x => x.approvals[0].attemptId = 'foreign']) {
    const altered = structuredClone(input); change(altered);
    assert.throws(() => proof.reviewDemoEvidence(altered, now), /CLOUD46C_/);
  }
  assert.equal(proof.inventory().productionExecutionAllowed, false);
  assert.throws(() => gate.executeProduction(input), /PRODUCTION_EXECUTION_DISABLED/);
});
test('Changing executor bytes refuses the package without changing files on disk', () => {
  const filename = new URL('./cloud46c-proof.js', import.meta.url);
  const facade = {...fs, readFileSync(file, ...args) {
    const out = fs.readFileSync(file, ...args);
    return String(file).endsWith('cloud46c-executor.mjs') ? Buffer.concat([Buffer.from(out), Buffer.from('\n')]) : out;
  }};
  const module = {exports: {}};
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {module, require: name => name === 'node:fs' ? facade : require(name),
    __dirname: path.dirname(filename.pathname), Buffer, structuredClone});
  assert.throws(() => module.exports.inventory(), /PACKAGE_CHANGED/);
});
test('Normal UI and startup do not load the executor, transport, source or a production launcher', () => {
  for (const name of ['index.html', 'js/main-login.js', 'js/boot.js', 'js/app.js']) {
    assert.equal(/cloud46c|cloud44-gate2|cloud42-reviewed-loader/.test(fs.readFileSync(new URL('../../' + name, import.meta.url), 'utf8')), false, name);
  }
});
