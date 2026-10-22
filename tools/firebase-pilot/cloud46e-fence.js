// Same-host administrative RPC fence. Complements, never replaces, server CAS/IAM.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const {canonical, sha, TARGET} = require('./cloud46d-contract.js');
function names(directory, binding) {
  const key = sha(canonical({projectId: binding.projectId, database: binding.database,
    uid: binding.uid, projectIdInData: TARGET.projectIdInData}));
  return {administrative: path.join(directory, key + '.admin-inflight'), recovery: path.join(directory, key + '.stop-recovery.jsonl')};
}
function syncDirectory(directory) {
  const fd = fs.openSync(directory, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function fencedJournal(directory, binding, journal) {
  const files = names(directory, binding);
  function assertRunning() { if (fs.existsSync(files.recovery)) throw Error('CLOUD46E_RECOVERY_STOP_REQUESTED'); }
  return {...journal, async perform(phase, operation) {
    if (['stop', 'verify-stop'].includes(phase)) return journal.perform(phase, operation);
    if (!['stage', 'activate'].includes(phase)) { assertRunning(); return journal.perform(phase, operation); }
    const fd = fs.openSync(files.administrative, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(fd, canonical({phase, attemptId: binding.attemptId}) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    syncDirectory(directory);
    let terminal = false, issued = false;
    try {
      // Creating the claim BEFORE checking the recovery marker closes the interprocess gap.
      assertRunning();
      issued = true;
      const result = await journal.perform(phase, operation);
      assertRunning(); terminal = true; return result;
    } catch (e) {
      // This existing validator aborts the transaction before any writes are submitted.
      if (!issued || e.message === 'CLOUD42_ADMIN_CONFLICT') terminal = true;
      throw e;
    } finally { if (terminal) { fs.unlinkSync(files.administrative); syncDirectory(directory); } }
  }};
}
module.exports = {names, fencedJournal, syncDirectory};
