// Offline authority boundary. Preparation JSON and environment flags cannot sign decisions.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const {createPublicKey, verify} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const contract = require('./cloud46d-contract.js');
const candidate = require('./cloud46d-candidate.js');
const gate = require('./cloud44-gate2.js');
const BASE = '4b8ef922a4596372eba4a48b52de1bdff6585f4f';
const capabilities = new WeakSet();
const fail = code => { throw Error('CLOUD46E_' + code); };
const file = name => fs.readFileSync(path.join(__dirname, name));
function revision(clean = false) {
  const cwd = path.resolve(__dirname, '../..');
  try {
    const head = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {cwd, encoding: 'utf8'}).trim();
    if (clean && execFileSync('git', ['status', '--porcelain'], {cwd, encoding: 'utf8'}).trim()) fail('REVISION_NOT_CLEAN');
    return head;
  } catch (e) { if (e.message === 'CLOUD46E_REVISION_NOT_CLEAN') throw e; fail('REVISION_UNCONFIRMED'); }
}
function inventory() {
  candidate.inventory();
  const manifest = JSON.parse(file('cloud46e-integrity.json'));
  const required = ['cloud46e-authority.js', 'cloud46e-connection.mjs', 'cloud46e-native.mjs', 'cloud46e-fence.js',
    'cloud46e-runtime.mjs', 'cloud46e-emulator.mjs', 'cloud46e-emulator.test.mjs',
    'cloud46e-boundary.test.mjs', '../cloud46e-connection-smoke.js'];
  if (manifest.base !== BASE || manifest.productionExecutionAllowed !== false
    || contract.sha(file('cloud46d-integrity.json')) !== manifest.upstream46dManifestSha256
    || contract.canonical(Object.keys(manifest.sha256).sort()) !== contract.canonical(required.sort())) fail('PACKAGE_CHANGED');
  for (const [name, hash] of Object.entries(manifest.sha256)) if (contract.sha(file(name)) !== hash) fail('PACKAGE_CHANGED');
  return {base: BASE, packageSha256: contract.sha(contract.canonical(manifest)), productionExecutionAllowed: false};
}
function readTrust(filename, fingerprint) {
  if (!path.isAbsolute(filename || '')) fail('PRIVATE_TRUST_REQUIRED');
  const repo = path.resolve(__dirname, '../..');
  if (filename === repo || filename.startsWith(repo + path.sep)) fail('PRIVATE_TRUST_REQUIRED');
  for (let current = filename;; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) fail('PRIVATE_TRUST_REQUIRED');
    if (path.dirname(current) === current) break;
  }
  const stat = fs.lstatSync(filename);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.uid !== process.getuid() || stat.mode & 0o077) fail('PRIVATE_TRUST_REQUIRED');
  const key = createPublicKey(fs.readFileSync(filename));
  if (key.asymmetricKeyType !== 'ed25519' || contract.sha(key.export({type: 'spki', format: 'der'})) !== fingerprint) fail('OWNER_KEY_MISMATCH');
  return key;
}
function signingBytes(bundle, scope, decisionId) {
  const {approvals, ...intent} = bundle.intent;
  return Buffer.from(contract.canonical({domain: 'MEBLE-CLOUD46E-OWNER-DECISION-v1',
    ...bundle, intent, scope, decisionId}));
}
function unsignedBundle({uid, attemptId, expiresAt, contexts, expectedRules, finalChecks, action = 'cycle'}) {
  const pin = inventory(), source = require('./cloud42-package.js').inventory();
  const intent = {type: 'explicit-production-decision', projectId: contract.TARGET.projectId, database: '(default)',
    base: contract.BASE, packageSha256: pin.packageSha256, uid, attemptId, expiresAt,
    investorId: contract.TARGET.investorId, projectIdInData: contract.TARGET.projectIdInData,
    rulesSha256: source.rulesSha256, payloadSha256: source.payloadSha256, documentSha256: source.documentSha256};
  intent.approvals = gate.FUTURE_SCOPES.map(scope => ({...intent, scope, decisionId: attemptId + '-' + scope}));
  contract.reviewIntent(intent, pin.packageSha256);
  return {releaseBase: BASE, executionHead: revision(), action, intent, contexts, expectedRules, finalChecks};
}
function verifySignedBundle(bundle, trustFile, ownerKeySha256, now = Date.now()) {
  const b = structuredClone(bundle), pin = inventory();
  if (!b || b.releaseBase !== BASE || b.executionHead !== revision() || b.intent?.packageSha256 !== pin.packageSha256
    || !['cycle', 'recover-stop'].includes(b.action)) fail('OWNER_DECISIONS_REQUIRED');
  contract.reviewIntent(b.intent, pin.packageSha256, now);
  const key = readTrust(trustFile, ownerKeySha256), contexts = b.contexts;
  if (!contexts || Object.keys(contexts).sort().join(',') !== 'reader,stop,verifier,writer'
    || new Set(Object.values(contexts).map(v => v?.id)).size !== 4
    || Object.values(contexts).some(v => !/^[A-Za-z0-9_-]{1,128}$/.test(v?.id || '') || v.email !== 'mebleszek@gmail.com')) fail('FOUR_CONTEXTS_REQUIRED');
  for (const approval of b.intent.approvals) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(approval.signature || '')
      || !verify(null, signingBytes(b, approval.scope, approval.decisionId), key, Buffer.from(approval.signature, 'base64'))) fail('OWNER_SIGNATURE_INVALID');
  }
  return b; // Signature validation alone grants no executable capability.
}
function reviewAuthorization({bundle, trustFile, ownerKeySha256, privateSource}, now = Date.now()) {
  inventory();
  const b = structuredClone(bundle), rollback = Buffer.isBuffer(privateSource) ? Buffer.from(privateSource) : privateSource;
  function assert({stopping = false} = {}) {
    const time = stopping ? now : Date.now();
    verifySignedBundle(b, trustFile, ownerKeySha256, time);
    if (b.action === 'cycle') {
      const checks = contract.reviewFinalChecks({...b.finalChecks, privateSource: rollback}, time);
      if (checks.blockers.some(code => code !== 'PRODUCTION_BINDING_NOT_ACTIVATED')) fail('FINAL_CHECKS_REQUIRED');
      if (b.finalChecks.exclusion.operator !== b.contexts.writer.id || b.finalChecks.exclusion.stopOperator !== b.contexts.stop.id
        || b.finalChecks.exclusion.verifier !== b.contexts.verifier.id) fail('OPERATORS_MISMATCH');
      contract.verifyRulesCheckpoint({observed: {...b.expectedRules, observedAt: new Date(time).toISOString()}, expected: b.expectedRules}, time);
    }
    // Emergency STOP never depends on rollback bytes, Rules availability or a writer lease.
    if (revision(true) !== b.executionHead) fail('REVISION_CHANGED');
    return structuredClone(b.intent);
  }
  assert();
  const capability = Object.freeze({bundle: b, assert});
  capabilities.add(capability); return capability;
}
function assertCapability(value, action) {
  if (!capabilities.has(value) || value.bundle.action !== action) fail('AUTHENTICATED_CAPABILITY_REQUIRED');
  value.assert(); return value.bundle;
}
module.exports = {BASE, inventory, unsignedBundle, signingBytes, verifySignedBundle, reviewAuthorization, assertCapability};
