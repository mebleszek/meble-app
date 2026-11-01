// Offline evidence review. A signed inventory is not a production observation.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const {createPublicKey, verify} = require('node:crypto');
const c = require('./cloud46d-contract.js');
const fail = code => { throw Error('CLOUD46F_' + code); };
const PATHS = ['console', 'cli-rest', 'automation', 'service-accounts-delegation'];
const COVERAGE = ['direct', 'inherited', 'groups', 'delegation', 'federation', 'iam-mutation'];
function privateFile(filename) {
  const repo = path.resolve(__dirname, '../..');
  if (!path.isAbsolute(filename || '') || filename === repo || filename.startsWith(repo + path.sep)) fail('PRIVATE_FILE_REQUIRED');
  for (let p = filename;; p = path.dirname(p)) {
    if (fs.lstatSync(p).isSymbolicLink()) fail('SYMLINK_REFUSED');
    if (path.dirname(p) === p) break;
  }
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.uid !== process.getuid() || stat.mode & 0o077 || stat.size > 1048576) fail('PRIVATE_FILE_REQUIRED');
  return fs.readFileSync(filename);
}
function signingBytes(domain, payload) { return Buffer.from(c.canonical({domain, payload})); }
function verifyEnvelope(envelope, trustFile, fingerprint, domain) {
  const key = createPublicKey(privateFile(trustFile));
  if (key.asymmetricKeyType !== 'ed25519' || c.sha(key.export({type: 'spki', format: 'der'})) !== fingerprint) fail('REVIEWER_KEY_MISMATCH');
  if (!envelope?.payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature || '')
    || !verify(null, signingBytes(domain, envelope.payload), key, Buffer.from(envelope.signature, 'base64'))) fail('EVIDENCE_SIGNATURE_INVALID');
  return structuredClone(envelope.payload);
}
function reviewEvidence(envelope, {trustFile, fingerprint, artifactBytes, action = 'cycle', now = Date.now()}) {
  const e = verifyEnvelope(envelope, trustFile, fingerprint, 'MEBLE-CLOUD46F-EVIDENCE-v1');
  const exact = (actual, expected) => Array.isArray(actual) && new Set(actual).size === expected.length
    && actual.length === expected.length && expected.every(v => actual.includes(v));
  const fresh = t => Number.isFinite(t) && t <= now && now - t <= 300000;
  if (!['cycle', 'recover-stop'].includes(action) || e.action !== action || e.v !== 1 || e.projectId !== c.TARGET.projectId || e.database !== '(default)' || !fresh(e.observedAt)
    || !Number.isFinite(now) || !/^[a-f0-9]{40}$/.test(e.executionHead || '') || !/^[a-f0-9]{64}$/.test(e.packageSha256 || '')
    || !/^[A-Za-z0-9_-]{1,128}$/.test(e.attemptId || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(e.uid || '')) fail('EVIDENCE_BINDING_INVALID');
  if (!Array.isArray(e.artifacts) || !e.artifacts.length || new Set(e.artifacts.map(a => a.id)).size !== e.artifacts.length) fail('ARTIFACTS_REQUIRED');
  const refs = new Set(e.artifacts.map(a => a.id));
  for (const a of e.artifacts) if (!/^[A-Za-z0-9_-]{1,128}$/.test(a.id || '') || !Buffer.isBuffer(artifactBytes?.[a.id])
    || c.sha(artifactBytes[a.id]) !== a.sha256) fail('ARTIFACT_BYTES_MISMATCH');
  const ref = value => typeof value === 'string' && refs.has(value);
  // Emergency recovery does not depend on Rules/Spark/publisher APIs or rollback.
  if (action === 'cycle') {
    const x = e.exclusion;
    if (!exact(x?.coverage, COVERAGE) || !ref(x.effectiveIamRef) || !ref(x.noUnknownPublisherRef)
      || !ref(x.monitorRef) || !fresh(x.windowStart) || x.windowStart > e.observedAt
      || !Number.isFinite(x.windowEnd) || x.windowEnd <= now || x.windowEnd > now + 900000) fail('EXCLUSION_COVERAGE_REQUIRED');
    if (!Array.isArray(x.publishers) || !x.publishers.length || new Set(x.publishers.map(p => p.id)).size !== x.publishers.length
      || x.publishers.some(p => !/^[A-Za-z0-9_-]{1,128}$/.test(p.id || '') || p.control !== 'held-for-window' || !ref(p.evidenceRef))) fail('PUBLISHERS_UNCONTROLLED');
    const ids = x.publishers.map(p => p.id);
    if (!Array.isArray(x.paths) || !exact(x.paths.map(p => p.kind), PATHS)
      || x.paths.some(p => !exact(p.publisherIds, ids) || !ref(p.evidenceRef))
      || !Array.isArray(x.delegations) || x.delegations.some(d => !ids.includes(d.from) || !ids.includes(d.to) || !ref(d.evidenceRef))) fail('PUBLISHER_CLOSURE_REQUIRED');
    const r = e.rules;
    // Detect observed changes; neither this comparison nor two GETs acquire exclusion.
    if (!r || !ref(r.sourceRef) || c.sha(artifactBytes[r.sourceRef]) !== r.sourceSha256
      || !Array.isArray(r.checkpoints) || r.checkpoints.length !== 2
      || r.checkpoints.some(p => !fresh(p.at) || now - p.at > 5000 || p.release !== r.release || p.ruleset !== r.ruleset || p.sourceSha256 !== r.sourceSha256)
      || r.checkpoints[0].at > r.checkpoints[1].at
      || r.release !== 'projects/mebleszek-meble-app/releases/cloud.firestore'
      || !/^projects\/mebleszek-meble-app\/rulesets\/[A-Za-z0-9_-]+$/.test(r.ruleset || '')) fail('RULES_CHANGED_OR_UNCONFIRMED');
    const stateHash = c.sha(c.canonical({publishers: x.publishers, paths: x.paths, delegations: x.delegations,
      artifacts: e.artifacts.filter(a => [x.effectiveIamRef, x.noUnknownPublisherRef, x.monitorRef].includes(a.id))}));
    if (!Array.isArray(e.stateCheckpoints) || e.stateCheckpoints.length !== 2
      || e.stateCheckpoints.some(p => !fresh(p.at) || now - p.at > 5000 || p.sha256 !== stateHash)
      || e.stateCheckpoints[0].at > e.stateCheckpoints[1].at) fail('IAM_STATE_CHANGED_OR_UNCONFIRMED');
  }
  if (!e.contextIds || !exact(Object.keys(e.contextIds), ['writer', 'reader', 'stop', 'verifier'])
    || new Set(Object.values(e.contextIds)).size !== 4
    || Object.values(e.contextIds).some(id => !/^[A-Za-z0-9_-]{1,128}$/.test(id || ''))) fail('FOUR_CONTEXTS_REQUIRED');
  const h = e.hosts;
  if (!h?.primary || !h.recovery || !h.primary.id || !h.recovery.id || h.primary.id === h.recovery.id
    || !h.primary.failureDomain || !h.recovery.failureDomain || h.primary.failureDomain === h.recovery.failureDomain
    || !ref(h.recovery.credentialsRef) || !ref(h.recovery.replicaRef) || !ref(h.recovery.fenceRef) || !ref(h.recovery.rehearsalRef)
    || h.recovery.fenceMethod !== 'external-primary-admin-fence') fail('INDEPENDENT_HOST_PROOF_REQUIRED');
  return {status: 'SUPPLIED_EVIDENCE_COMPLETE_ONLY', evidenceSha256: c.sha(c.canonical(e)),
    executionAllowed: false, authenticatedProductionObservation: false};
}
module.exports = {PATHS, COVERAGE, privateFile, signingBytes, verifyEnvelope, reviewEvidence};
