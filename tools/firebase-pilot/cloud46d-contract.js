// Pure production review contract. No credentials, SDK, network or activation.
'use strict';
const {createHash} = require('node:crypto');
const gate = require('./cloud44-gate2.js');
const pilot = require('./cloud42-package.js');
const baseline = require('./cloud43a-baseline.js');
const TARGET = Object.freeze({...gate.TARGET, investorId: 'cloud4-investor-v1', projectIdInData: 'cloud4-project-v1'});
const BASE = 'fd36b2e6fee433c92676d7619dc672d4361d9d59';
const fail = code => { throw Error('CLOUD46D_' + code); };
const canonical = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function reviewIntent(input, packageSha256, now = Date.now()) {
  if (!input || input.projectId !== TARGET.projectId || input.database !== TARGET.database || input.base !== BASE
    || !/^[A-Za-z0-9_-]{1,128}$/.test(input.uid || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(input.attemptId || '')
    || input.packageSha256 !== packageSha256 || !/^[a-f0-9]{64}$/.test(packageSha256 || '')
    || input.investorId !== TARGET.investorId || input.projectIdInData !== TARGET.projectIdInData
    || !Number.isFinite(now) || !Number.isFinite(input.expiresAt) || input.expiresAt <= now
    || input.expiresAt > now + 900000 || input.type !== 'explicit-production-decision') fail('INTENT_INVALID');
  const pin = pilot.inventory();
  if (input.rulesSha256 !== pin.rulesSha256 || input.payloadSha256 !== pin.payloadSha256
    || input.documentSha256 !== pin.documentSha256) fail('SOURCE_CHANGED');
  const approvals = input.approvals;
  if (!Array.isArray(approvals) || approvals.length !== gate.FUTURE_SCOPES.length
    || new Set(approvals.map(a => a?.decisionId)).size !== gate.FUTURE_SCOPES.length
    || !gate.FUTURE_SCOPES.every(scope => approvals.some(a => a?.scope === scope && typeof a.decisionId === 'string'
      && a.decisionId.trim() && a.type === input.type && a.uid === input.uid && a.attemptId === input.attemptId
      && a.projectId === input.projectId && a.database === input.database && a.packageSha256 === packageSha256
      && a.rulesSha256 === input.rulesSha256 && a.expiresAt === input.expiresAt))) fail('SEPARATE_DECISIONS_REQUIRED');
  return structuredClone(input);
}
function assertLiveSession(client, db, uid, identity) {
  const native = db?._delegate || db, ctx = client?.authSession?.verificationContext(), who = client?.authSession?.identity();
  if (ctx?.target !== 'live-auth' || ctx.app?.options?.projectId !== TARGET.projectId
    || ctx.app.options.authDomain !== pilot.PRODUCTION.authDomain || ctx.app.options.appId !== pilot.PRODUCTION.appId
    || ctx.app !== db?.app || ctx.auth?.app !== ctx.app || ctx.auth?.emulatorConfig
    || ctx.emulator || ctx.auth.currentUser?.uid !== uid || who?.uid !== uid || who.epoch !== identity?.epoch
    || native?._databaseId?.projectId !== TARGET.projectId || native?._databaseId?.database !== TARGET.database
    || native?._settings?.host !== 'firestore.googleapis.com' || native?._settings?.ssl !== true) fail('LIVE_IDENTITY_MISMATCH');
  client.lease.assert();
  if (client.lease.uid !== uid || client.lease.isValid() !== true) fail('ACCESS_REVOKED');
}
function assertLiveDb(db) {
  const native = db?._delegate || db;
  if (db?.app?.options?.projectId !== TARGET.projectId || native?._databaseId?.projectId !== TARGET.projectId
    || native?._databaseId?.database !== TARGET.database || native?._settings?.host !== 'firestore.googleapis.com'
    || native?._settings?.ssl !== true || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) fail('LIVE_IDENTITY_MISMATCH');
}
function assertAdmin(db) {
  if (db?.projectId !== TARGET.projectId || db?.databaseId !== TARGET.database
    || db?._settings?.host !== 'firestore.googleapis.com' || db?._settings?.ssl === false
    || typeof db.doc !== 'function' || typeof db.runTransaction !== 'function'
    || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) fail('ADMIN_IDENTITY_MISMATCH');
}
function verifyRulesCheckpoint({observed, expected, privateSource, role = 'minimal-pilot'}, now = Date.now()) {
  if (!Number.isFinite(now) || typeof observed?.observedAt !== 'string' || !Number.isFinite(Date.parse(observed.observedAt))
    || Date.parse(observed.observedAt) > now || now - Date.parse(observed.observedAt) > 5000) fail('FRESH_RULES_REQUIRED');
  if (role === 'production-auth-only-baseline') {
    baseline.verifyProductionObservation(observed);
    if (gate.rollbackReadiness(privateSource).status !== 'PRIVATE_BYTES_VERIFIED_PLAN_ONLY') fail('PRIVATE_ROLLBACK_REQUIRED');
  } else if (role === 'minimal-pilot') {
    gate.verifyPostOperation({observed, expected, sourceRole: role,
      sourceBytes: require('node:fs').readFileSync(require('node:path').join(__dirname, 'firestore-live-pilot.rules'))});
  } else fail('RULES_ROLE_INVALID');
  return {status: 'IDENTITY_AND_SOURCE_MATCH', authenticatedOriginProvenByJson: false, executionAllowed: false};
}
function reviewFinalChecks(input = {}, now = Date.now()) {
  const blockers = [];
  if (gate.rollbackReadiness(input.privateSource).status !== 'PRIVATE_BYTES_VERIFIED_PLAN_ONLY') blockers.push('PRIVATE_ROLLBACK_REQUIRED');
  const a = input.account;
  if (a?.projectId !== TARGET.projectId || a?.database !== TARGET.database || a?.plan !== 'Spark'
    || a?.billingEnabled !== false || !Number.isSafeInteger(a.remainingReads) || a.remainingReads < 500
    || !Number.isSafeInteger(a.remainingWrites) || a.remainingWrites < 30 || !Number.isFinite(a.observedAt)
    || a.observedAt > now || now - a.observedAt > 300000) blockers.push('FRESH_ACCOUNT_REQUIRED');
  // A bounded operator handover check; historical audit logs are not exclusion.
  const x = input.exclusion;
  if (!x || !Number.isFinite(x.checkedAt) || x.checkedAt > now || now - x.checkedAt > 300000
    || !['console', 'cli-rest', 'automation', 'service-accounts-delegation'].every(kind => x.paths?.some(p => p.kind === kind
      && typeof p.evidenceRef === 'string' && p.evidenceRef.trim() && p.state === 'paused-or-owner-controlled'))
    || !x.operator || !x.stopOperator || !x.verifier || !x.currentIamEvidenceRef || !x.noUnknownPublisherEvidenceRef) blockers.push('CURRENT_EXCLUSION_EVIDENCE_REQUIRED');
  blockers.push('PRODUCTION_BINDING_NOT_ACTIVATED');
  return {executionAllowed: false, status: 'LIVE_BLOCKED', blockers, assertionsAreNotAuthenticatedReceipts: true};
}
module.exports = {BASE, TARGET, canonical, sha, reviewIntent, assertLiveSession, assertLiveDb, assertAdmin, verifyRulesCheckpoint, reviewFinalChecks};
