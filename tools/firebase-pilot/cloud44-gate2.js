// Offline Gate 2 review and demo-only operator rehearsal. No production executor.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const baseline = require('./cloud43a-baseline.js');
const pilot = require('./cloud42-package.js');
const APPROVAL_SHA = 'dd6ac10928e9495ba3a45598d94a71cd04eb68ec36f9fe14cc654efc76b09795';
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const fail = code => { throw Error('CLOUD44_' + code); };
const TARGET = Object.freeze({projectId: 'mebleszek-meble-app', database: '(default)'});
const FUTURE_SCOPES = Object.freeze(['read-production-state', 'deploy-minimal-rules', 'stage-activate-grant',
  'synthetic-write', 'independent-read', 'administrative-stop']);
function preparationStatus() {
  const bytes = fs.readFileSync(path.join(__dirname, 'cloud43b-preparation-approval.json'));
  if (hash(bytes) !== APPROVAL_SHA) fail('PREPARATION_EVIDENCE_CHANGED');
  const decision = JSON.parse(bytes), historical = baseline.baseline();
  if (decision.baselineRecordSha256 !== baseline.BASELINE_SHA256 || decision.baselineId !== historical.baselineId
    || decision.projectId !== TARGET.projectId || decision.database !== TARGET.database
    || decision.releaseName !== historical.release.name || decision.rulesetName !== historical.ruleset.name
    || decision.productionRules.sha256 !== historical.source.sha256
    || decision.productionRules.utf8Bytes !== historical.source.utf8Bytes) fail('PREPARATION_EVIDENCE_CHANGED');
  return Object.freeze({historicalApproval: historical.baselineApprovedForGate2,
    baselineAcceptedForGate2Preparation: decision.authorizations.baselineAcceptedForGate2Preparation,
    productionExecutionAllowed: false, preparationRecordSha256: APPROVAL_SHA});
}
function rollbackReadiness(privateSource) {
  if (privateSource === undefined || privateSource === null) return {status: 'BLOCKED_PRIVATE_SOURCE_REQUIRED', executionAllowed: false};
  // Only actual bytes, never a receipt containing a caller-provided SHA.
  if (!Buffer.isBuffer(privateSource)) return {status: 'BLOCKED_PRIVATE_BYTES_REQUIRED', executionAllowed: false};
  try {
    const plan = baseline.productionRollbackPlan(privateSource);
    return {status: 'PRIVATE_BYTES_VERIFIED_PLAN_ONLY', byteLength: privateSource.length,
      sourceSha256: plan.sourceSha256, automaticRetry: false, executionAllowed: false};
  } catch (error) {
    return {status: 'BLOCKED_INVALID_PRIVATE_SOURCE', reason: error.message, executionAllowed: false};
  }
}
function accountCheck(account, now) {
  return account && account.projectId === TARGET.projectId && account.database === TARGET.database
    && account.plan === 'Spark' && account.billingEnabled === false
    && Number.isSafeInteger(account.remainingReads) && account.remainingReads >= 500
    && Number.isSafeInteger(account.remainingWrites) && account.remainingWrites >= 30
    && Number.isFinite(account.observedAt) && account.observedAt <= now && now - account.observedAt <= 300000;
}
function reviewProductionGate(input = {}, now = Date.now()) {
  preparationStatus();
  const blockers = [], check = (condition, code) => { if (!condition) blockers.push(code); };
  check(Number.isFinite(now), 'CLOCK_INVALID');
  check(input.projectId === TARGET.projectId && input.database === TARGET.database, 'TARGET_MISMATCH');
  const rollback = rollbackReadiness(input.privateSource);
  check(rollback.status === 'PRIVATE_BYTES_VERIFIED_PLAN_ONLY', rollback.status);
  // Reuse the pinned verifier, rather than inventing a second baseline matcher.
  for (const observation of [input.checked, input.fresh]) {
    try { baseline.verifyProductionObservation(observation); }
    catch (error) { blockers.push(error.message); }
  }
  try {
    baseline.assertFreshUnchangedRules(input.checked, input.fresh, now);
    // Five minutes permits review; the final observation must be just-in-time.
    check(now - Date.parse(input.fresh.observedAt) <= 5000, 'JUST_IN_TIME_READ_REQUIRED');
  } catch (error) { blockers.push(error.message); }
  check(accountCheck(input.account, now), 'FRESH_SPARK_BILLING_QUOTA_EVIDENCE_REQUIRED');
  const proof = pilot.inventory();
  const approvals = input.approvals;
  check(Array.isArray(approvals) && approvals.length === FUTURE_SCOPES.length
    && new Set(approvals.map(a => a?.decisionId)).size === FUTURE_SCOPES.length
    && FUTURE_SCOPES.every(scope => approvals.some(a => a?.scope === scope
      && typeof a.decisionId === 'string' && a.decisionId.trim()
      && a.type === 'explicit-production-decision'
      && a.projectId === TARGET.projectId && a.database === TARGET.database
      && a.packageSha256 === proof.packageSha256 && a.rulesSha256 === proof.rulesSha256
      && a.baselineRecordSha256 === baseline.BASELINE_SHA256
      && Number.isFinite(a.expiresAt) && a.expiresAt > now && a.expiresAt <= now + 900000)),
    'SEPARATE_PRODUCTION_APPROVALS_REQUIRED');
  check(input.operator?.stopAvailable === true && input.operator?.independentStopVerifierAvailable === true,
    'STOP_OPERATOR_AND_INDEPENDENT_VERIFIER_REQUIRED');
  // No client boolean or two GETs can prove exclusion of other administrators.
  // releases.patch has no verified expected-ruleset/ETag CAS in this package.
  // Even supplied approvals and perfect observations cannot remove these fences.
  blockers.push('RULES_ATOMICITY_OR_VERIFIED_EXTERNAL_EXCLUSION_UNAVAILABLE', 'PRODUCTION_EXECUTOR_NOT_IMPLEMENTED');
  return {status: 'STOP', executionAllowed: false, blockers, rollback,
    rulesAtomicCas: false, observationsAreAuthenticatedReceipts: false,
    serverEnforcedExpiry: false, serverRoleSeparation: false, automaticRetry: false};
}
function executeProduction() { fail('PRODUCTION_EXECUTION_DISABLED'); }
function verifyPostOperation({observed, expected, sourceRole, sourceBytes} = {}) {
  if (!expected || !observed || !['minimal-pilot', 'production-auth-only-baseline'].includes(sourceRole)) fail('POST_READBACK_REQUIRED');
  for (const o of [expected, observed]) {
    if (o.projectId !== TARGET.projectId || o.database !== TARGET.database
      || o.release?.name !== baseline.baseline().release.name
      || o.release?.rulesetName !== o.ruleset?.name
      || !o.ruleset?.name?.startsWith('projects/mebleszek-meble-app/rulesets/')
      || !Number.isFinite(Date.parse(o.release?.createTime)) || !Number.isFinite(Date.parse(o.release?.updateTime))
      || !Number.isFinite(Date.parse(o.ruleset?.createTime))) fail('POST_IDENTITY_MISMATCH');
  }
  // The exact expected post identity must come from the separately reviewed operation;
  // never auto-accept a new ID because the source happens to match.
  for (const [section, keys] of [['release', ['name', 'rulesetName', 'createTime', 'updateTime']], ['ruleset', ['name', 'createTime']]]) {
    if (keys.some(k => observed[section][k] !== expected[section][k])) fail('POST_IDENTITY_MISMATCH');
  }
  const files = observed.ruleset.source?.files;
  if (!Array.isArray(files) || files.length !== 1 || files[0].name !== 'firestore.rules' || typeof files[0].content !== 'string') fail('POST_SOURCE_MISMATCH');
  baseline.verifyArtifact(sourceRole, sourceBytes);
  baseline.verifyArtifact(sourceRole, files[0].content);
  if (!Buffer.from(files[0].content).equals(Buffer.from(sourceBytes))) fail('POST_SOURCE_MISMATCH');
  return {status: 'POST_IDENTITY_AND_BYTES_MATCH_ONLY', executionAllowed: false, independentServerReadProven: false};
}
// A cooperative lock for isolated rehearsals only, not a cross-process/API lock.
const operators = new Set();
function openDemoOperator({projectId, origin, expiresAt, now = Date.now} = {}) {
  let url; try { url = new URL(origin); } catch (_) { fail('DEMO_LOOPBACK_REQUIRED'); }
  if (projectId !== 'demo-meble-app' || url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('DEMO_LOOPBACK_REQUIRED');
  if (!Number.isFinite(expiresAt) || expiresAt <= now() || expiresAt > now() + 900000) fail('WINDOW_INVALID');
  const key = projectId;
  if (operators.has(key)) fail('OPERATOR_CONFLICT');
  operators.add(key);
  let state = 'PREPARED', busy = false, writeUsed = false, readUsed = false, stopAttempted = false, stopping = false, epoch = 0;
  const releaseIfStopped = () => { if (state === 'STOP_VERIFIED' && !busy && !stopping) operators.delete(key); };
  async function action(expectedStates, next, operation, {stop = false} = {}) {
    if (busy) fail('OPERATION_IN_PROGRESS');
    if (!expectedStates.includes(state)) fail('STATE_CONFLICT');
    if (!stop && now() >= expiresAt) { state = 'STOP_REQUIRED'; fail('WINDOW_EXPIRED'); }
    busy = true;
    const started = epoch;
    try {
      const result = await operation();
      if (started !== epoch) fail('STOPPED_DURING_OPERATION_RESULT_UNCERTAIN');
      state = next;
      if (!stop && now() >= expiresAt) { state = 'STOP_REQUIRED'; fail('WINDOW_EXPIRED_RESULT_UNCERTAIN'); }
      return result;
    } catch (error) { if (started === epoch) state = 'STOP_REQUIRED'; throw error; }
    finally { busy = false; releaseIfStopped(); }
  }
  return Object.freeze({
    inspect: () => ({state, writeUsed, readUsed, stopAttempted, serverEnforcedExpiry: false, serverRoleSeparation: false}),
    stage: operation => action(['PREPARED'], 'STAGED', operation),
    activate: operation => action(['STAGED'], 'ACTIVE', operation),
    async write(driver, request) {
      if (writeUsed) fail('WRITE_ATTEMPT_CONSUMED');
      if (busy) fail('OPERATION_IN_PROGRESS');
      if (request?.role !== 'write') fail('ROLE_MISMATCH');
      // Consume before awaiting; ambiguity never restores the attempt.
      writeUsed = true;
      const started = epoch;
      const result = await action(['ACTIVE'], 'WRITE_ATTEMPTED', () => driver.execute(request));
      if (started !== epoch) fail('STOPPED_DURING_OPERATION_RESULT_UNCERTAIN');
      if (result?.ok !== true) state = 'PUBLICATION_UNCERTAIN';
      return result;
    },
    async read(driver, request) {
      if (readUsed) fail('READ_ATTEMPT_CONSUMED');
      if (busy) fail('OPERATION_IN_PROGRESS');
      if (request?.role !== 'read') fail('ROLE_MISMATCH');
      readUsed = true;
      const started = epoch;
      const result = await action(['WRITE_ATTEMPTED', 'PUBLICATION_UNCERTAIN'], 'READ_ATTEMPTED', () => driver.execute(request));
      if (started !== epoch) fail('STOPPED_DURING_OPERATION_RESULT_UNCERTAIN');
      if (result?.ok !== true) state = 'STOP_REQUIRED';
      return result;
    },
    // Administrative STOP remains possible after expiry or failed/partial IO.
    async stop(operation) {
      if (stopAttempted) fail('STOP_ATTEMPT_CONSUMED_REVIEW_REQUIRED');
      stopAttempted = true; stopping = true; epoch++; state = 'STOP_IN_PROGRESS';
      // Independent administration must not wait for a stuck client promise.
      try { await operation(); state = 'STOP_UNVERIFIED'; }
      catch (error) { state = 'STOP_REQUIRED'; throw error; }
      finally { stopping = false; }
    },
    async verifyStop(operation) {
      if (state !== 'STOP_UNVERIFIED' || stopping) fail('STATE_CONFLICT');
      stopping = true;
      try {
        if (await operation() !== true) fail('STOP_NOT_CONFIRMED');
        state = 'STOP_VERIFIED'; return {status: 'STOP_VERIFIED'};
      } finally { stopping = false; releaseIfStopped(); }
    }
  });
}
module.exports = {TARGET, FUTURE_SCOPES, preparationStatus, rollbackReadiness,
  reviewProductionGate, executeProduction, verifyPostOperation, openDemoOperator};
