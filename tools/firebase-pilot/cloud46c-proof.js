// Review evidence only. No SDK, credentials, launcher or production authority.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const pilot = require('./cloud42-package.js');
const gate = require('./cloud44-gate2.js');
const BASE = 'af75be7201f3941c639bb41e5fa0e296a5720ae8';
const SCOPES = Object.freeze(['stage-activate-grant', 'synthetic-write', 'independent-read', 'administrative-stop']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Error('CLOUD46C_' + code); };
function inventory() {
  const bytes = fs.readFileSync(path.join(__dirname, 'cloud46c-integrity.json'));
  const manifest = JSON.parse(bytes);
  if (manifest.base !== BASE || manifest.productionExecutionAllowed !== false) fail('PACKAGE_CHANGED');
  const required = ['cloud46c-proof.js', 'cloud46c-executor.mjs', 'cloud46c-demo-transport.mjs',
    'cloud46c-executor.test.mjs', 'cloud46c-proof.test.mjs', 'package.json'];
  if (JSON.stringify(Object.keys(manifest.sha256).sort()) !== JSON.stringify(required.sort())) fail('PACKAGE_CHANGED');
  for (const [name, hash] of Object.entries(manifest.sha256)) {
    if (sha(fs.readFileSync(path.join(__dirname, name))) !== hash) fail('PACKAGE_CHANGED');
  }
  const dependencyBytes = fs.readFileSync(path.join(__dirname, 'cloud44-integrity.json'));
  if (sha(dependencyBytes) !== '8c00ea9bb772a403cc678140126281f52f786ba624a4d280cfc8f4efc63cecbc') fail('DEPENDENCY_CHANGED');
  const existing = JSON.parse(dependencyBytes);
  for (const [name, hash] of Object.entries(existing.sha256)) {
    if (sha(fs.readFileSync(path.resolve(__dirname, '../..', name))) !== hash) fail('DEPENDENCY_CHANGED');
  }
  gate.preparationStatus();
  return {...pilot.inventory(), base: BASE, executorSha256: sha(bytes), productionExecutionAllowed: false};
}
function reviewDemoEvidence(evidence, now = Date.now()) {
  const proof = inventory();
  if (!evidence || evidence.type !== 'emulator-rehearsal-only' || evidence.projectId !== 'demo-meble-app'
    || evidence.database !== '(default)' || !/^[A-Za-z0-9_-]{1,128}$/.test(evidence.uid || '')
    || !/^[A-Za-z0-9_-]{1,128}$/.test(evidence.attemptId || '')
    || evidence.base !== BASE || evidence.executorSha256 !== proof.executorSha256
    || evidence.packageSha256 !== proof.packageSha256 || evidence.rulesSha256 !== proof.rulesSha256
    || !Number.isFinite(now) || !Number.isFinite(evidence.expiresAt)
    || evidence.expiresAt <= now || evidence.expiresAt > now + 900000) fail('EVIDENCE_REQUIRED');
  const approvals = evidence.approvals;
  if (!Array.isArray(approvals) || approvals.length !== SCOPES.length
    || new Set(approvals.map(a => a?.decisionId)).size !== SCOPES.length
    || !SCOPES.every(scope => approvals.some(a => a?.scope === scope && a.type === evidence.type
      && typeof a.decisionId === 'string' && a.decisionId.trim()
      && a.attemptId === evidence.attemptId && a.uid === evidence.uid
      && a.projectId === evidence.projectId && a.database === evidence.database
      && a.executorSha256 === proof.executorSha256 && a.expiresAt === evidence.expiresAt))) fail('SEPARATE_DEMO_DECISIONS_REQUIRED');
  // Preparation and demo receipts are never interpreted as production decisions.
  return structuredClone(evidence);
}
module.exports = {BASE, SCOPES, inventory, reviewDemoEvidence};
