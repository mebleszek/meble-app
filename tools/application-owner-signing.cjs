'use strict';
// Offline helper for Sign-ApplicationRelease.ps1. Private material is exchanged
// only through redirected pipes, never command arguments, files or diagnostics.
const crypto = require('node:crypto');
const {reviewApplicationRelease} = require('./application-release-package.js');
const decisionSha256 = '8c6d478efefa55d13d606ca4f71c141b681393bc73985af38ef9f3831a58f8a3';
const canonical = value => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fail(code) { throw Error(code); }
function validateDecision(decision) {
  if (!decision || sha256(Buffer.from(canonical(decision))) !== decisionSha256) fail('LF_SIGNING_DECISION_CHANGED');
  return decisionSha256;
}
function createKeyMaterial() {
  const {publicKey, privateKey} = crypto.generateKeyPairSync('ed25519');
  return {publicKeySpki: publicKey.export({type: 'spki', format: 'der'}).toString('base64'),
    privateKeyPkcs8: privateKey.export({type: 'pkcs8', format: 'der'}).toString('base64')};
}
function keyPair(input) {
  let bytes;
  try {
    bytes = Buffer.from(input.privateKeyPkcs8, 'base64');
    const key = crypto.createPrivateKey({key: bytes, format: 'der', type: 'pkcs8'});
    if (key.asymmetricKeyType !== 'ed25519') fail('LF_SIGNING_KEY_INVALID');
    const publicKey = crypto.createPublicKey(key).export({type: 'spki', format: 'der'});
    if (publicKey.toString('base64') !== input.publicKeySpki) fail('LF_SIGNING_KEY_MISMATCH');
    const fingerprint = sha256(publicKey);
    if (fingerprint !== input.expectedKeySha256) fail('LF_SIGNING_KEY_UNTRUSTED');
    return {key, publicKey, fingerprint};
  } finally { bytes?.fill(0); }
}
async function signDecision(input) {
  validateDecision(input.decision); // Refuse altered intent before importing a key.
  const {key, publicKey, fingerprint} = keyPair(input);
  const signature = crypto.sign(null, Buffer.from(canonical(input.decision)), key);
  const approval = {trustedKeySha256: fingerprint, envelope: {decision: input.decision,
    publicKeySpki: [...publicKey], signature: [...signature]}};
  await reviewApplicationRelease(approval); // Existing signature/target/exact Rules guards.
  return approval;
}
async function main(command, input) {
  if (command === 'create') return createKeyMaterial();
  if (command === 'check') return {decisionSha256: validateDecision(input.decision)};
  if (command === 'inspect') return {keySha256: keyPair(input).fingerprint};
  if (command === 'sign') return signDecision(input);
  fail('LF_SIGNING_COMMAND_INVALID');
}
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', part => {
    input += part;
    if (input.length > 65536) { input = ''; process.stderr.write('LF_SIGNING_INPUT_LIMIT\n'); process.exit(1); }
  });
  process.stdin.on('end', async () => {
    try {
      const request = JSON.parse(input); input = '';
      process.stdout.write(JSON.stringify(await main(process.argv[2], request)));
    } catch (error) {
      // Never echo input, OpenSSL exceptions, private keys or stdin to a log.
      const code = /^LF_[A-Z0-9_]+$/.test(error.message) ? error.message : 'LF_OWNER_SIGNING_FAILED';
      process.stderr.write(code + '\n'); process.exitCode = 1;
    } finally { input = ''; }
  });
}
module.exports = {decisionSha256, validateDecision, createKeyMaterial, signDecision, main};
