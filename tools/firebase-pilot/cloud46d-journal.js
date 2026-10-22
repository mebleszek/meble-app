// Private local crash journal. Contains no payload, credentials or Rules source.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const {canonical, sha, TARGET} = require('./cloud46d-contract.js');
const fail = code => { throw Error('CLOUD46D_JOURNAL_' + code); };
const PHASES = ['stage', 'activate', 'write', 'read', 'stop', 'verify-stop'];
function safeDirectory(directory) {
  if (!path.isAbsolute(directory)) fail('PRIVATE_DIRECTORY_REQUIRED');
  const resolved = path.resolve(directory), repo = path.resolve(__dirname, '../..');
  if (resolved === repo || resolved.startsWith(repo + path.sep)) fail('OUTSIDE_REPO_REQUIRED');
  for (let current = resolved;; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) fail('SYMLINK_REFUSED');
    if (path.dirname(current) === current) break;
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail('PRIVATE_DIRECTORY_REQUIRED');
  return resolved;
}
function filename(directory, binding) {
  if (binding.projectId !== TARGET.projectId || binding.database !== TARGET.database || !/^[A-Za-z0-9_-]{1,128}$/.test(binding.uid || '')) fail('BINDING_INVALID');
  // Fixed scope: changing attemptId/package cannot bypass an uncertain old run.
  return path.join(safeDirectory(directory), sha(canonical({projectId: binding.projectId, database: binding.database,
    uid: binding.uid, projectIdInData: TARGET.projectIdInData})) + '.jsonl');
}
function inspectJournal(directory, binding) {
  const file = filename(directory, binding), stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) fail('UNSAFE_FILE');
  const bytes = fs.readFileSync(file, 'utf8');
  if (!bytes.endsWith('\n')) fail('TRUNCATED');
  let previous = '', seq = 0;
  const events = bytes.trimEnd().split('\n').map(line => {
    let row; try { row = JSON.parse(line); } catch (_) { fail('CORRUPT'); }
    const {hash, ...body} = row;
    if (body.seq !== seq++ || body.previous !== previous || hash !== sha(canonical(body))) fail('CORRUPT');
    previous = hash; return row;
  });
  if (!events.length || events[0].kind !== 'CLAIM' || events[0].binding.uid !== binding.uid
    || events[0].binding.projectId !== binding.projectId || events[0].binding.database !== binding.database) fail('BINDING_INVALID');
  return {status: events.at(-1).kind === 'CONFIRMED' && events.at(-1).phase === 'verify-stop' ? 'STOP_RECORDED_REVIEW_REQUIRED' : 'RESULT_UNCERTAIN_REVIEW_REQUIRED',
    retryWrite: false, binding: events[0].binding, events};
}
function createJournal(directory) {
  let fd, file, previous = '', seq = 0, claimed = false, stopped = false;
  const consumed = new Set(), confirmed = new Set(), active = new Set();
  let revisionId, expectedDocumentSha256;
  function append(kind, phase, receipt = null, binding) {
    const body = {seq: seq++, previous, kind, phase, receipt, ...(binding ? {binding} : {})};
    const hash = sha(canonical(body));
    fs.writeFileSync(fd, canonical({...body, hash}) + '\n'); fs.fsyncSync(fd); previous = hash;
  }
  return Object.freeze({
    claim(binding) {
      if (claimed) fail('ATTEMPT_CONSUMED'); claimed = true;
      file = filename(directory, binding);
      try { fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); }
      catch (e) { if (e.code === 'EEXIST') fail('ATTEMPT_CONSUMED'); throw e; }
      const safe = {projectId: binding.projectId, database: binding.database, uid: binding.uid,
        attemptId: binding.attemptId, packageSha256: binding.packageSha256, rulesSha256: binding.rulesSha256,
        payloadSha256: binding.payloadSha256, documentSha256: binding.documentSha256};
      expectedDocumentSha256 = binding.documentSha256;
      append('CLAIM', null, null, safe);
      const parent = fs.openSync(directory, 'r'); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    },
    async perform(phase, operation) {
      if (fd === undefined || !PHASES.includes(phase) || consumed.has(phase) || (stopped && !['stop', 'verify-stop'].includes(phase))) fail('PHASE_REFUSED');
      if (phase === 'activate' && !confirmed.has('stage') || phase === 'write' && !confirmed.has('activate')
        || phase === 'read' && !consumed.has('write') || phase === 'verify-stop' && !confirmed.has('stop')) fail('ORDER_INVALID');
      if (phase === 'stop') stopped = true;
      consumed.add(phase); active.add(phase); append('INTENT', phase);
      try {
        const result = await operation();
        if (stopped && !['stop', 'verify-stop'].includes(phase)) fail('LATE_RESULT');
        const ok = phase === 'verify-stop' ? result === true : !['write', 'read'].includes(phase) || result?.ok === true;
        const receipt = {};
        if (result?.revisionId && /^[a-f0-9]{32}$/.test(result.revisionId)) receipt.revisionId = result.revisionId;
        append(ok ? 'CONFIRMED' : 'UNCERTAIN', phase, receipt);
        if (ok) confirmed.add(phase);
        return result;
      } catch (e) { append('UNCERTAIN', phase); throw e; } finally { active.delete(phase); }
    },
    recordRevision(value) {
      if (fd === undefined || stopped || !active.has('write') || revisionId || !/^[a-f0-9]{32}$/.test(value || '')) fail('REVISION_INVALID');
      revisionId = value; append('REVISION_PREPARED', 'write', {revisionId});
    },
    resolveReadback(read) {
      if (fd === undefined || !revisionId || read?.ok !== true || read.sourceMatches !== true || read.revisionId !== revisionId || read.documentSha256 !== expectedDocumentSha256 || read.utf8Bytes !== 6797) fail('READBACK_UNATTRIBUTED');
      append('READBACK_MATCHED', 'read', {revisionId});
      return {status: 'SAME_ATTEMPT_REVISION', retryWrite: false};
    },
    close() { if (fd !== undefined) { fs.closeSync(fd); fd = undefined; } }
  });
}
function recordRecovery(directory, binding, read) {
  const record = inspectJournal(directory, binding), original = record.binding;
  if (binding.attemptId !== original.attemptId || binding.packageSha256 !== original.packageSha256) fail('BINDING_INVALID');
  const revision = record.events.find(row => row.kind === 'REVISION_PREPARED')?.receipt?.revisionId;
  const match = !!revision && read?.ok === true && read.sourceMatches === true && read.revisionId === revision
    && read.documentSha256 === original.documentSha256 && read.utf8Bytes === 6797;
  const result = {version: 1, status: match ? 'SAME_ATTEMPT_STATE_OBSERVED_ONLY' : 'UNRESOLVED', retryWrite: false,
    journalHash: record.events.at(-1).hash, revisionId: revision || null, independentReadMatched: match,
    stopVerified: false, productionExecutionAllowed: false};
  const file = filename(directory, binding) + '.resolution.json';
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, canonical(result) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const parent = fs.openSync(directory, 'r'); try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  return result;
}
module.exports = {createJournal, inspectJournal, recordRecovery};
