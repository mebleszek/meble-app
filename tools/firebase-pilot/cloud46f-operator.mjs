// Private, offline preparation launcher. NO executable production connector here.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import history from './cloud46f-history.js';
import contract from './cloud46d-contract.js';
import gate from './cloud44-gate2.js';
import review from './cloud46f-evidence.js';
import {checkCredentials, checkRecoveryCredentials} from './cloud46e-native.mjs';
const fail = code => { throw Error('CLOUD46F_' + code); };
export function inventory(operatorRoot) {
  history.loadOperator(operatorRoot);
  const manifest = JSON.parse(fs.readFileSync(new URL('./cloud46f-integrity.json', import.meta.url)));
  const required = ['cloud46f-operator.mjs', 'cloud46f-history.js', 'cloud46f-evidence.js', 'cloud46f-recovery.js', 'cloud46f-replica.js',
    'cloud46f-demo-recovery.mjs', 'cloud46f-fixture.mjs', 'cloud46f-offline.test.mjs', 'cloud46f-recovery.cases.mjs', '../cloud46f-fast-track-smoke.js'];
  if (manifest.productionExecutionAllowed !== false || manifest.upstream46eManifestSha256 !== contract.sha(fs.readFileSync(new URL('./cloud46e-integrity.json', import.meta.url)))
    || contract.canonical(Object.keys(manifest.sha256).sort()) !== contract.canonical(required.sort())) fail('PACKAGE_CHANGED');
  for (const [name, hash] of Object.entries(manifest.sha256))
    if (contract.sha(fs.readFileSync(new URL(name, import.meta.url))) !== hash) fail('PACKAGE_CHANGED');
  return {packageSha256: contract.sha(contract.canonical(manifest)), productionExecutionAllowed: false};
}
export function preparePrivateLaunch(input) {
  const pin = inventory(input.operatorRoot);
  const {authority} = history.loadOperator(input.operatorRoot);
  // Verified E decisions already bind finalChecks.fastTrack; no unsigned bypass.
  const b = authority.verifySignedBundle(input.bundle, input.trustFile, input.ownerKeySha256);
  const files = input.artifactFiles || {};
  const artifactBytes = Object.fromEntries(Object.entries(files).map(([id, filename]) => [id, review.privateFile(filename)]));
  const receipt = review.reviewEvidence(input.evidenceEnvelope, {trustFile: input.evidenceTrustFile,
    fingerprint: input.evidenceFingerprint, artifactBytes, action: b.action});
  const e = input.evidenceEnvelope.payload, f = b.finalChecks?.fastTrack;
  if (e.executionHead !== b.executionHead || e.uid !== b.intent.uid || e.attemptId !== b.intent.attemptId
    || e.packageSha256 !== b.intent.packageSha256 || f?.sourceManifestSha256 !== pin.packageSha256
    || f?.evidenceSha256 !== receipt.evidenceSha256 || f?.reviewerFingerprint !== input.evidenceFingerprint
    || !/^[a-f0-9]{64}$/.test(f?.checkpointSha256 || '')
    || ['writer', 'reader', 'stop', 'verifier'].some(role => e.contextIds?.[role] !== b.contexts[role].id)) fail('SIGNED_EVIDENCE_MISMATCH');
  if (b.action === 'cycle') {
    const expected = b.expectedRules, source = expected?.ruleset?.source?.files;
    if (e.rules.release !== expected?.release?.name || e.rules.ruleset !== expected?.ruleset?.name
      || !Array.isArray(source) || source.length !== 1 || typeof source[0].content !== 'string'
      || contract.sha(Buffer.from(source[0].content, 'utf8')) !== e.rules.sourceSha256) fail('RULES_EVIDENCE_MISMATCH');
    checkCredentials(input.credentials, input.runtimeDirectory);
    // Existing validator checks REAL private bytes, not a reported length/hash.
    authority.reviewAuthorization({...input, privateSource: review.privateFile(input.rollbackFile)});
  } else {
    checkRecoveryCredentials(input.credentials, input.runtimeDirectory);
    // Existing recovery checks administrators first; denial verification ALSO needs reader.
    if (typeof input.credentials.readerGoogleIdToken !== 'string' || input.credentials.readerGoogleIdToken.length <= 20) fail('RECOVERY_READER_REQUIRED');
    authority.reviewAuthorization(input);
  }
  return {status: 'OFFLINE_PREPARATION_COMPLETE_ONLY', action: b.action, ...pin,
    evidenceSha256: receipt.evidenceSha256, productionExecutionAllowed: false,
    blockers: ['SEPARATE_EXECUTION_APPROVAL', 'PRIVATE_RUNTIME_AND_SECOND_HOST_VALIDATION', 'FRESH_AUTHENTICATED_OBSERVATIONS', 'PRODUCTION_LAUNCH_NOT_ACTIVATED']};
}
// No flag, environment variable, credential, loader or valid signature changes this.
export const executeProduction = gate.executeProduction;
export const recoverProduction = gate.executeProduction;
// CLI intentionally accepts no secrets or JSON on argv; it only prints pinned readiness.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.length !== 2) executeProduction();
    process.stdout.write(JSON.stringify({...inventory(), status: 'LIVE_BLOCKED'}) + '\n');
  } catch (_) { process.stderr.write('CLOUD46F_PREPARATION_REFUSED\n'); process.exitCode = 1; }
}
