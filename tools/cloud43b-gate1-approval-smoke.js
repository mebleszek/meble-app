'use strict';
// Public metadata checks only. No network, SDK, private Rules source or production IO.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.join(__dirname, 'firebase-pilot');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const file = path.join(root, 'cloud43b-preparation-approval.json');
const raw = fs.readFileSync(file);
assert.equal(hash(raw), 'dd6ac10928e9495ba3a45598d94a71cd04eb68ec36f9fe14cc654efc76b09795', 'Approval record changed');
const decision = JSON.parse(raw);
const baseline = require('./firebase-pilot/cloud43a-baseline.js');
const package42 = require('./firebase-pilot/cloud42-package.js');
const historical = baseline.baseline();
assert.equal(decision.schemaVersion, 1);
assert.equal(decision.baselineId, historical.baselineId);
assert.equal(decision.baselineRecordSha256, baseline.BASELINE_SHA256);
assert.equal(decision.projectId, historical.projectId);
assert.equal(decision.database, historical.database);
assert.equal(decision.releaseName, historical.release.name);
assert.equal(decision.rulesetName, historical.release.rulesetName);
assert.deepEqual(decision.productionRules, {
  utf8Bytes: historical.source.utf8Bytes,
  sha256: historical.source.sha256
});
assert.deepEqual(decision.evidence, {
  releaseGetHttpStatus: 200,
  rulesetGetHttpStatus: 200,
  observedDate: '2026-10-20',
  source: 'owner-private-MHTML-and-verified-byte-comparison',
  independentlyFetchedInThisTask: false
});
assert.deepEqual(decision.authorizations, {
  gate1RulesReadback: 'PASS_CONFIRMED_BY_OWNER_EVIDENCE',
  baselineAcceptedForGate2Preparation: true,
  openGate2ForProductionExecution: false,
  deployOrRollbackProductionRules: false,
  productionBusinessReadOrWrite: false,
  grantIamOrBillingChange: false,
  productionDataMigrationOrSync: false,
  readyPrAutoMergeOrPages: false
});
// The recorded preparation decision MUST NOT mutate the historical runtime gate.
assert.equal(historical.baselineApprovedForGate2, false);
assert.equal(historical.gate1, 'STOP_SHA_MISMATCH_REVIEW_REQUIRED');
assert.equal(historical.historicalOnly, true);
const proof = package42.inventory();
assert.equal(proof.productionBaselineApprovedForGate2, false);
assert.equal(proof.productionAuthOnlyBaselineSha256, decision.productionRules.sha256);
assert.equal(proof.rulesBaselineRecordSha256, decision.baselineRecordSha256);
const loader = fs.readFileSync(path.join(root, 'cloud42-reviewed-loader.mjs.txt'), 'utf8');
assert.match(loader, /if\(packet\.proof\.productionBaselineApprovedForGate2!==true\)throw Error\('CLOUD43A_BASELINE_REVIEW_REQUIRED'\)/);
const rollback = JSON.parse(fs.readFileSync(path.join(root, 'cloud43a-production-rollback.plan.json')));
assert.equal(rollback.executionAllowed, false);
assert.equal(rollback.isFirebaseDeployConfig, false);
assert.equal(rollback.sourceSha256, decision.productionRules.sha256);
assert.equal(rollback.repositoryTemplateIsExactRollback, false);
const rollbackConfig = JSON.parse(fs.readFileSync(path.join(root, 'cloud42-rules-rollback.json')));
assert.deepEqual(rollbackConfig, {firestore: {rules: 'firestore-auth-only.rules'}});
assert.equal(baseline.ARTIFACTS['repository-auth-only-template'].utf8Bytes, 755);
assert.equal(baseline.ARTIFACTS['production-auth-only-baseline'].utf8Bytes, 635);
console.log('CLOUD-4.3b: owner approval for PREPARATION verified; production execution and loader remain STOP: PASS');
