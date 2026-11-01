// Offline authenticated handoff of the EXISTING journal. Never resumes WRITE.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const c = require('./cloud46d-contract.js'), journal = require('./cloud46d-journal.js');
const fence = require('./cloud46e-fence.js'), evidence = require('./cloud46f-evidence.js');
const DOMAIN = 'MEBLE-CLOUD46F-RECOVERY-v1';
const fail = code => { throw Error('CLOUD46F_' + code); };
function paths(directory, binding) {
  const names = fence.names(directory, binding), base = names.administrative.slice(0, -'.admin-inflight'.length);
  return {journal: base + '.jsonl', authority: base + '.authority.json', administrative: names.administrative,
    recovery: names.recovery};
}
function draftCheckpoint(directory, binding, executionHead) {
  const observed = journal.inspectJournal(directory, binding), files = paths(directory, binding);
  if (c.canonical(observed.binding) !== c.canonical(binding) || !/^[a-f0-9]{40}$/.test(executionHead || '')) fail('RECOVERY_BINDING_INVALID');
  const body = Object.fromEntries(Object.entries(files).map(([key, file]) => [key,
    fs.existsSync(file) ? evidence.privateFile(file).toString('utf8') : null]));
  if (!body.authority) fail('ORIGINAL_AUTHORITY_REQUIRED');
  const a = JSON.parse(body.authority);
  if (a.executionHead !== executionHead || !/^[a-f0-9]{64}$/.test(a.signedBundleSha256 || '')) fail('ORIGINAL_AUTHORITY_MISMATCH');
  return {v: 1, executionHead, binding: observed.binding, journalHash: observed.events.at(-1).hash,
    files: body, retryWrite: false, executionAllowed: false};
}
function restoreCheckpoint(envelope, {directory, binding, executionHead, checkpointSha256, trustFile, fingerprint}) {
  // Fingerprint AND latest capsule hash must be held independently of the primary.
  const p = evidence.verifyEnvelope(envelope, trustFile, fingerprint, DOMAIN);
  if (c.sha(c.canonical(p)) !== checkpointSha256 || p.v !== 1 || p.executionHead !== executionHead
    || c.canonical(p.binding) !== c.canonical(binding) || p.retryWrite !== false || p.executionAllowed !== false
    || Object.keys(p.files || {}).sort().join(',') !== 'administrative,authority,journal,recovery'
    || typeof p.files.journal !== 'string' || typeof p.files.authority !== 'string'
    || ['administrative', 'recovery'].some(k => p.files[k] !== null && typeof p.files[k] !== 'string')) fail('RECOVERY_CHECKPOINT_MISMATCH');
  // Do not claim a new attempt to validate paths. Original validator runs on staging.
  const stat = fs.lstatSync(directory), resolved = fs.realpathSync(directory);
  if (!path.isAbsolute(directory) || resolved !== directory || !stat.isDirectory() || stat.uid !== process.getuid()
    || stat.mode & 0o077 || /^\/(?:tmp|var\/tmp)(?:\/|$)/.test(directory)
    || resolved.startsWith(path.resolve(__dirname, '../..') + path.sep) || fs.readdirSync(directory).length) fail('EMPTY_PRIVATE_RECOVERY_DIRECTORY_REQUIRED');
  // Atomic directory publication: incomplete import never exposes a usable journal.
  const staging = fs.mkdtempSync(path.join(directory, '.import-'));
  const staged = paths(staging, binding);
  try {
    for (const [key, content] of Object.entries(p.files)) if (content !== null) {
      const fd = fs.openSync(staged[key], fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
    const inspected = journal.inspectJournal(staging, binding);
    if (inspected.events.at(-1).hash !== p.journalHash) fail('JOURNAL_HEAD_MISMATCH');
    // Validate authority against the same binding before publication.
    const a = JSON.parse(p.files.authority);
    if (a.executionHead !== executionHead || !/^[a-f0-9]{64}$/.test(a.signedBundleSha256 || '')) fail('ORIGINAL_AUTHORITY_MISMATCH');
    fence.syncDirectory(staging);
    const published = path.join(directory, 'restored');
    fs.renameSync(staging, published); fence.syncDirectory(directory);
    return {status: 'RESTORED_REVIEW_REQUIRED', directory: published, journalHash: p.journalHash,
      adminUncertain: p.files.administrative !== null, recoveryAlreadyClaimed: p.files.recovery !== null,
      retryWrite: false, executionAllowed: false, hostIndependenceProven: false};
  } catch (error) {
    // Preserve failed staging as evidence; never delete/replace a consumed attempt.
    if (/^CLOUD/.test(error.message || '')) throw error;
    fail('RECOVERY_IMPORT_UNCERTAIN');
  }
}
module.exports = {DOMAIN, paths, draftCheckpoint, restoreCheckpoint};
