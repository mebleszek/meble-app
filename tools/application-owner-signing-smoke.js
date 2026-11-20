'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const os = require('node:os'), crypto = require('node:crypto'), cp = require('node:child_process');
const signer = require('./application-owner-signing.cjs');
const {reviewApplicationRelease} = require('./application-release-package.js');
const decision = {activationId: 'meble-app-20261102-01', database: '(default)', domain: 'MEBLE_APPLICATION_DEPLOYMENT_V1',
  globalDomains: 14, migrationApproved: true, origin: 'https://mebleszek.github.io/meble-app/',
  ownerUid: 'ByBPVVNXx3fUDUmTg5yTSNVveH23', profile: 'business-room-v1', projectId: 'mebleszek-meble-app',
  protocol: 3, rulesApproved: true, rulesSha256: 'e05bef8df96a139fe061949008fea1d3187dfb0dfacc8b68606eed8047f128f4',
  sourcePreserved: true, registry: 'p0b-rooms-v1', legacyDataPolicy: 'preserve-outside-registry'};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function portable() {
  assert.equal(signer.validateDecision(decision), signer.decisionSha256);
  const material = signer.createKeyMaterial(), other = signer.createKeyMaterial();
  const fingerprint = hash(Buffer.from(material.publicKeySpki, 'base64'));
  const input = {...material, expectedKeySha256: fingerprint, decision};
  const approved = await signer.signDecision(input);
  assert.equal(approved.trustedKeySha256, fingerprint);
  const reviewed = await reviewApplicationRelease(approved);
  assert.equal(reviewed.rulesSha256, decision.rulesSha256);
  const sandbox = {window: {}, Uint8Array, Object};
  require('node:vm').runInNewContext(reviewed.source, sandbox);
  const {verifyApplicationRelease, assertApplicationRelease} = await import('../sync/application-release.mjs');
  const d = assertApplicationRelease(await verifyApplicationRelease({...sandbox.window.FC_APPLICATION_RELEASE, origin: decision.origin}));
  assert.deepEqual(d, decision); // Same verifier used at normal startup, no network.
  for (const changes of [{ownerUid: 'foreign'}, {rulesSha256: '0'.repeat(64)}, {protocol: 2}, {extra: true}]) {
    await assert.rejects(signer.signDecision({decision: {...decision, ...changes}}), /LF_SIGNING_DECISION_CHANGED/);
  }
  await assert.rejects(signer.signDecision({...input, expectedKeySha256: '0'.repeat(64)}), /LF_SIGNING_KEY_UNTRUSTED/);
  await assert.rejects(signer.signDecision({...input, privateKeyPkcs8: other.privateKeyPkcs8}), /LF_SIGNING_KEY_MISMATCH/);
  const altered = structuredClone(approved); altered.envelope.signature[0] ^= 1;
  await assert.rejects(reviewApplicationRelease(altered), /LF_OWNER_SIGNATURE_INVALID/);
  await assert.rejects(reviewApplicationRelease({...approved, trustedKeySha256: '0'.repeat(64)}), /LF_OWNER_TRUST_REQUIRED/);
  const cli = cp.spawnSync(process.execPath, [path.join(__dirname, 'application-owner-signing.cjs'), 'sign'], {
    input: JSON.stringify({...input, decision: {...decision, ownerUid: 'foreign'}}), encoding: 'utf8'});
  assert.equal(cli.status, 1); assert.equal(cli.stdout, '');
  assert.equal(cli.stderr.trim(), 'LF_SIGNING_DECISION_CHANGED');
  console.log('PASS portable: exact decision, new signature, normal verifier, wrong key/pair, tampering, secret-free errors');
}
function windows() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meble-owner-signing-'));
  const script = path.join(__dirname, 'Sign-ApplicationRelease.ps1'), vault = path.join(root, 'vault');
  const shell = process.env.PWSH_PATH || 'pwsh.exe';
  const before = hash(fs.readFileSync(path.join(__dirname, '../js/app/cloud/application-release.js')));
  const run = args => cp.spawnSync(shell, ['-NoProfile', '-NonInteractive', '-File', script, ...args], {
    encoding: 'utf8', windowsHide: true, timeout: 25000});
  let checks = 0;
  const ok = result => { assert.equal(result.status, 0, result.stderr); checks++; return result.stdout; };
  const refused = (result, code) => { assert.notEqual(result.status, 0); assert.match(result.stderr, new RegExp(code)); checks++; };
  try {
    refused(run(['-Action', 'CreateKey', '-KeyDirectory', vault]), 'LF_SIGNING_OWNER_APPROVAL_REQUIRED');
    assert.equal(fs.existsSync(vault), false);
    const created = ok(run(['-Action', 'CreateKey', '-KeyDirectory', vault, '-OwnerApproved']));
    const fingerprint = created.match(/keySha256=([a-f0-9]{64})/)[1];
    const keyFile = path.join(vault, 'deployment-key.dpapi.json'), saved = fs.readFileSync(keyFile);
    const record = JSON.parse(saved); assert.equal(record.protection, 'DPAPI-CurrentUser');
    assert.equal(record.privateKeyPkcs8, undefined); assert.equal(saved.includes('PRIVATE KEY'), false);
    const access = cp.spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command',
      '$a=Get-Acl -LiteralPath $env:MEBLE_TEST_VAULT; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; ' +
      'if(!$a.AreAccessRulesProtected){exit 3}; $r=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])); ' +
      'if($r.Count -ne 1 -or $r[0].IdentityReference.Value -ne $sid){exit 4}; "ACL_CURRENT_USER_ONLY"'],
    {encoding: 'utf8', windowsHide: true, env: {...process.env, MEBLE_TEST_VAULT: vault}});
    assert.match(ok(access), /ACL_CURRENT_USER_ONLY/);
    // A new PowerShell/Node process must unwrap the persisted key after creation.
    ok(run(['-Action', 'CheckKey', '-KeyDirectory', vault, '-ExpectedKeySha256', fingerprint]));
    refused(run(['-Action', 'CreateKey', '-KeyDirectory', vault, '-OwnerApproved']), 'LF_SIGNING_KEY_DIRECTORY_EXISTS');
    assert.deepEqual(fs.readFileSync(keyFile), saved);
    const source = path.join(root, 'decision.json'), output = path.join(root, 'signed.json');
    fs.writeFileSync(source, JSON.stringify(decision));
    const args = ['-Action', 'Sign', '-KeyDirectory', vault, '-ExpectedKeySha256', fingerprint,
      '-DecisionPath', source, '-OutputFile', output, '-OwnerApproved'];
    refused(run(args.filter(a => a !== '-OwnerApproved')), 'LF_SIGNING_OWNER_APPROVAL_REQUIRED');
    refused(run(args.map(a => a === fingerprint ? '0'.repeat(64) : a)), 'LF_SIGNING_KEY_UNTRUSTED');
    assert.equal(fs.existsSync(output), false);
    const signOutput = ok(run(args)); assert.match(signOutput, /SIGNATURE_VERIFIED_NO_DEPLOYMENT/);
    const signed = fs.readFileSync(output);
    refused(run(args), 'LF_SIGNING_OUTPUT_EXISTS'); assert.deepEqual(fs.readFileSync(output), signed);
    const second = path.join(root, 'signed-second.json');
    ok(run(args.map(a => a === output ? second : a)));
    assert.deepEqual(fs.readFileSync(second), signed); // Same decision/key after process restart.
    // Altered intent refuses before a missing vault could be accessed.
    fs.writeFileSync(source, JSON.stringify({...decision, ownerUid: 'foreign'}));
    refused(run(args.map(a => a === output ? path.join(root, 'never.json') : a === vault ? path.join(root, 'missing') : a)), 'LF_SIGNING_DECISION_CHANGED');
    fs.writeFileSync(source, JSON.stringify(decision));
    const damaged = {...record, privateKeyProtected: Buffer.from('invalid ciphertext').toString('base64')};
    fs.writeFileSync(keyFile, JSON.stringify(damaged));
    refused(run(args.map(a => a === output ? path.join(root, 'never.json') : a)), 'LF_SIGNING_KEY_UNAVAILABLE');
    assert.equal(fs.existsSync(path.join(root, 'never.json')), false);
    fs.writeFileSync(keyFile, saved); // Only this disposable fixture.
    refused(run(args.map(a => a === output ? path.join(__dirname, 'forbidden-output.json') : a)), 'LF_SIGNING_PRIVATE_PATH_REQUIRED');
    const publicApproval = JSON.parse(signed);
    assert.equal(publicApproval.trustedKeySha256, fingerprint);
    assert.equal(crypto.verify(null, Buffer.from(JSON.stringify(decision, Object.keys(decision).sort())),
      crypto.createPublicKey({key: Buffer.from(publicApproval.envelope.publicKeySpki), format: 'der', type: 'spki'}),
      Buffer.from(publicApproval.envelope.signature)), true);
    assert.equal(hash(fs.readFileSync(path.join(__dirname, '../js/app/cloud/application-release.js'))), before);
    console.log(`PASS Windows: ${checks} process checks, real DPAPI, restart, refusals, unchanged public activation`);
  } finally {
    // Delete only the fresh fixture, never the real LOCALAPPDATA signing vault.
    const resolved = fs.realpathSync(root), temp = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved).toLowerCase(), temp.toLowerCase());
    assert.match(path.basename(resolved), /^meble-owner-signing-/);
    fs.rmSync(resolved, {recursive: true});
  }
}
(async () => { await portable(); if (process.platform === 'win32') windows();
  else console.log('DPAPI requires the separate Windows check; portable coverage completed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
