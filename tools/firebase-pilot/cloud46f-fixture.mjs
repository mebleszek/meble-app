// Synthetic evidence only. Never owner's key/rollback/credentials.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateKeyPairSync, sign} from 'node:crypto';
import c from './cloud46d-contract.js';
import e from './cloud46f-evidence.js';
import history from './cloud46f-history.js';
export function fixture() {
  const directory = fs.mkdtempSync(path.join(os.homedir(), 'cloud46f-SYNTHETIC-'));
  fs.chmodSync(directory, 0o700);
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const trustFile = path.join(directory, 'synthetic-public.pem');
  fs.writeFileSync(trustFile, publicKey.export({type: 'spki', format: 'pem'}), {mode: 0o600});
  const fingerprint = c.sha(publicKey.export({type: 'spki', format: 'der'}));
  const {authority, pilot} = history.loadOperator();
  const now = Date.now(), executionHead = 'a'.repeat(40), pin = pilot.inventory();
  const binding = {projectId: c.TARGET.projectId, database: '(default)', uid: 'synthetic-cloud46f-owner',
    attemptId: 'synthetic-cloud46f-attempt', packageSha256: authority.inventory().packageSha256,
    rulesSha256: pin.rulesSha256, payloadSha256: pin.payloadSha256, documentSha256: pin.documentSha256};
  const artifactBytes = Object.fromEntries(['iam', 'publishers', 'monitor', 'host', 'rules'].map(id => [id, Buffer.from('synthetic-' + id)]));
  const exclusion = {coverage: e.COVERAGE, effectiveIamRef: 'iam', noUnknownPublisherRef: 'publishers', monitorRef: 'monitor',
    windowStart: now - 1000, windowEnd: now + 120000,
    publishers: [{id: 'synthetic-owner', control: 'held-for-window', evidenceRef: 'publishers'}], delegations: [],
    paths: e.PATHS.map(kind => ({kind, publisherIds: ['synthetic-owner'], evidenceRef: 'publishers'}))};
  const payload = {v: 1, action: 'cycle', projectId: binding.projectId, database: '(default)', uid: binding.uid, attemptId: binding.attemptId,
    executionHead, packageSha256: binding.packageSha256, observedAt: now,
    artifacts: Object.entries(artifactBytes).map(([id, bytes]) => ({id, sha256: c.sha(bytes)})), exclusion,
    contextIds: {writer: 'writer', reader: 'reader', stop: 'stop', verifier: 'verifier'},
    hosts: {primary: {id: 'host-A', failureDomain: 'provider-A'}, recovery: {id: 'host-B', failureDomain: 'provider-B',
      credentialsRef: 'host', replicaRef: 'host', fenceRef: 'host', rehearsalRef: 'host', fenceMethod: 'external-primary-admin-fence'}},
    rules: {release: 'projects/mebleszek-meble-app/releases/cloud.firestore', ruleset: 'projects/mebleszek-meble-app/rulesets/synthetic',
      sourceRef: 'rules', sourceSha256: c.sha(artifactBytes.rules)}};
  payload.rules.checkpoints = [now - 100, now].map(at => ({at, release: payload.rules.release,
    ruleset: payload.rules.ruleset, sourceSha256: payload.rules.sourceSha256}));
  const hash = c.sha(c.canonical({publishers: exclusion.publishers, paths: exclusion.paths, delegations: exclusion.delegations,
    artifacts: payload.artifacts.filter(a => ['iam', 'publishers', 'monitor'].includes(a.id))}));
  payload.stateCheckpoints = [now - 100, now].map(at => ({at, sha256: hash}));
  function seal(value, domain = 'MEBLE-CLOUD46F-EVIDENCE-v1') {
    return {payload: structuredClone(value), signature: sign(null, e.signingBytes(domain, value), privateKey).toString('base64')};
  }
  function subdir(name) { const p = path.join(directory, name); fs.mkdirSync(p, {mode: 0o700}); return p; }
  return {directory, trustFile, fingerprint, binding, executionHead, artifactBytes, payload, now, seal, subdir,
    signBytes: bytes => sign(null, bytes, privateKey).toString('base64'),
    close: () => fs.rmSync(directory, {recursive: true, force: true})};
}
