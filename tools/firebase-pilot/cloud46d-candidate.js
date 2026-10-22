// Source assembler only. Production output has no callable activation entry.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const contract = require('./cloud46d-contract.js');
const prior = require('./cloud46c-proof.js');
const pilot = require('./cloud42-package.js');
const file = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const fail = () => { throw Error('CLOUD46D_REVIEWED_SOURCE_CHANGED'); };
function once(source, from, to) {
  if (source.split(from).length !== 2) fail();
  return source.replace(from, to);
}
function stripImports(source) { return source.replace(/^import .*;\n/gm, ''); }
function cycleSource() {
  prior.inventory();
  let source = stripImports(file('cloud46c-executor.mjs'));
  source = once(source, '  claimAttempt(attemptKey);', '  journal.claim(reviewed);');
  for (const [phase, expression] of [
    ['stage', 'transport.apply(actions.stage)'], ['activate', 'transport.apply(actions.activate)'],
    ['write', 'transport.write(reviewed)'], ['read', 'transport.read(reviewed)'],
    ['stop', 'transport.apply(pilot.stopAction({uid: reviewed.uid, ...current}))'], ['verify-stop', 'transport.verifyStop()']
  ]) source = once(source, expression, `journal.perform('${phase}', () => ${expression})`);
  const obsolete = source.indexOf('// Emulator-only crash fence;'), boundary = source.indexOf('const fail =');
  if (obsolete < 0 || boundary < obsolete) fail();
  source = source.slice(0, obsolete) + source.slice(boundary);
  // A read receipt can diagnose an unacknowledged operation, never approve retry.
  source = once(source, "        await checkpoint();\n        if (pilot.readDecision(written, read)", "        await checkpoint();\n        journal.resolveReadback(read);\n        if (pilot.readDecision(written, read)");
  return source;
}
function transportSource() {
  let source = stripImports(file('cloud46c-demo-transport.mjs'));
  source = once(source, '        const result = await handle.write();', '        journal.recordRevision(prepared.revisionId);\n        const result = await handle.write();');
  return source;
}
function demoSources() {
  inventory();
  return {cycle: cycleSource().replace(/^export /gm, ''), transport: transportSource().replace(/^export /gm, '')};
}
function connectionSources() {
  inventory();
  let adapter = transportSource();
  const dbStart = adapter.indexOf('function assertDb(db) {'), dbEnd = adapter.indexOf('export async function createDemoTransport');
  if (dbStart < 0 || dbEnd < dbStart) fail();
  adapter = adapter.slice(0, dbStart) + 'function assertDb(db) { if (db?.app) contract.assertLiveDb(db); else contract.assertAdmin(db); }\n' + adapter.slice(dbEnd);
  adapter = once(adapter, 'adminDb === stopVerifierDb || adminDb.app === stopVerifierDb.app', 'adminDb === stopVerifierDb');
  adapter = once(adapter, 'new Set([...dbs, adminDb, stopVerifierDb].map(db => db.app))', 'new Set([dbs[0].app, dbs[1].app, adminDb, stopVerifierDb])');
  const start = adapter.indexOf('    clients.forEach((client, i) => {'), end = adapter.indexOf('\n  }\n  assertBinding();', start);
  if (start < 0 || end < start) fail();
  adapter = adapter.slice(0, start) + '    clients.forEach((client, i) => contract.assertLiveSession(client, dbs[i], uid, identities[i]));' + adapter.slice(end);
  const rulesStart = adapter.indexOf('      // Actual emulator source,'), rulesEnd = adapter.indexOf('\n    },\n    async readAdminState()', rulesStart);
  if (rulesStart < 0 || rulesEnd < rulesStart) fail();
  adapter = adapter.slice(0, rulesStart) + '      const observed = await readOfficialRules();\n      contract.verifyRulesCheckpoint({observed, expected: expectedRules});\n      assertBinding();\n      return {rulesSha256: pilot.inventory().rulesSha256};' + adapter.slice(rulesEnd);
  adapter = adapter.replace(/^export /gm, '');
  let admin = stripImports(file('cloud44-emulator-admin.mjs')).replace(/^export /gm, '');
  const adminStart = admin.indexOf('function assertDemo(db) {'), adminEnd = admin.indexOf('function paths(uid)');
  if (adminStart < 0 || adminEnd < adminStart) fail();
  admin = admin.slice(0, adminStart) + 'function assertDemo(db) { contract.assertAdmin(db); }\n' + admin.slice(adminEnd);
  // Existing transaction callback, expected-state validator and maxAttempts=1
  // stay byte-for-byte intact; only native SDK connection binding differs.
  const bridge = 'const doc = (db, path) => db.doc(path);\nconst snapshot = s => ({exists: () => s.exists, data: () => s.data()});\nconst runTransaction = (db, operation, options) => db.runTransaction(tx => operation({get: async ref => snapshot(await tx.get(ref)), update: (ref, data) => tx.update(ref, data), set: (ref, data) => tx.set(ref, data)}), options);\nconst getDocFromServer = async ref => snapshot(await ref.get());\n';
  let cycle = cycleSource().replace(/^export /gm, '');
  cycle = once(cycle, 'projectId: reviewed.projectId, origin:', "projectId: 'demo-meble-app', origin:");
  // Only the existing cooperative lifecycle is reused here. Real project/binding
  // checks live in the adapter; the lifecycle is not an external exclusion lock.
  return {adapter, admin: bridge + admin, cycle};
}
function productionSource() {
  const {adapter, admin, cycle} = connectionSources();
  return `// INERT CLOUD-4.6D CANDIDATE. No exported binder, loader or activation.\n'use strict';\n` +
    `import fs from 'node:fs';\nimport {createHash} from 'node:crypto';\nimport gate from './cloud44-gate2.js';\nimport pilot from './cloud42-package.js';\nimport contract from './cloud46d-contract.js';\nimport preparation from './cloud46d-candidate.js';\nimport fixtureRuntime from '../cloud4-pilot-readiness-smoke.js';\n` +
    `function privateBindings(journal, reviewedIntent, packageSha256, rulesCredential, expectedRules, finalChecks) {\n` +
    `if (packageSha256 !== preparation.inventory().packageSha256) throw Error('CLOUD46D_PACKAGE_CHANGED');\ncontract.reviewFinalChecks(finalChecks);\ngate.executeProduction(); // Unconditional activation fence, even if privateBindings is accidentally exposed.\n` +
    `const proof = {reviewDemoEvidence: input => { const intent = contract.reviewIntent(input, packageSha256); if (contract.reviewFinalChecks(finalChecks).blockers.some(code => code !== 'PRODUCTION_BINDING_NOT_ACTIVATED')) throw Error('CLOUD46D_FINAL_CHECKS_REQUIRED'); return intent; }};\n` +
    file('cloud46d-rules-reader.js.txt') + '\nconst readOfficialRules = createRulesReader(rulesCredential, fetch);\n' + admin + '\nconst preparedAdapter = (() => {\n' + adapter + '\nreturn {createDemoTransport, assertDemoTransport};\n})();\nconst {createDemoTransport, assertDemoTransport} = preparedAdapter;\n' + cycle +
    '\n// Deliberately no return of the private factories or handles.\n}\nexport const executeProduction = gate.executeProduction;\n';
}
function inventory() {
  prior.inventory();
  const manifest = JSON.parse(file('cloud46d-integrity.json'));
  const required = ['cloud46d-contract.js', 'cloud46d-journal.js', 'cloud46d-candidate.js', 'cloud46d-rules-reader.js.txt', 'cloud46d-rehearsal.mjs', 'cloud46d-emulator.test.mjs', 'cloud46d-preparation.test.mjs', '../cloud46d-preparation-smoke.js'];
  if (contract.sha(file('cloud46c-integrity.json')) !== manifest.upstream46cManifestSha256) fail();
  if (manifest.base !== contract.BASE || manifest.productionExecutionAllowed !== false || JSON.stringify(Object.keys(manifest.sha256).sort()) !== JSON.stringify(required.sort())) fail();
  for (const [name, digest] of Object.entries(manifest.sha256)) if (contract.sha(file(name)) !== digest) fail();
  return {base: contract.BASE, packageSha256: contract.sha(contract.canonical(manifest)), productionExecutionAllowed: false};
}
function prepareCandidate() {
  const proof = inventory();
  const source = productionSource();
  return {status: 'INERT_CANDIDATE_REVIEW_ONLY', executionAllowed: false, base: contract.BASE,
    projectId: contract.TARGET.projectId, database: contract.TARGET.database,
    ...proof, sourceSha256: contract.sha(source), source,
    upstreamExecutorSha256: prior.inventory().executorSha256, sourcePinsSha256: pilot.inventory().sourcePinsSha256};
}
module.exports = {demoSources, prepareCandidate, connectionSources, inventory};
