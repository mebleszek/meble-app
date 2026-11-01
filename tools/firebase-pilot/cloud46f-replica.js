// Journal decorator: durable off-host ACK before a mutation, especially revision WRITE.
// Transport is intentionally NOT implemented by a LIVE flag, credential or local copy.
'use strict';
const c = require('./cloud46d-contract.js'), evidence = require('./cloud46f-evidence.js');
const DOMAIN = 'MEBLE-CLOUD46F-REPLICA-ACK-v1';
const fail = code => { throw Error('CLOUD46F_' + code); };
function replicatedJournal({journal, checkpoint, replicate, trustFile, fingerprint, primaryDomain, recoveryDomain, recoveryHost}) {
  if (!primaryDomain || !recoveryDomain || primaryDomain === recoveryDomain || !recoveryHost) fail('INDEPENDENT_REPLICA_REQUIRED');
  function mirror() {
    const capsule = checkpoint();
    // recordRevision is synchronous in C/D/E. An async unawaited copy is unsafe.
    const envelope = replicate(structuredClone(capsule));
    if (envelope?.then) fail('SYNCHRONOUS_DURABLE_RECEIPT_REQUIRED');
    const receipt = evidence.verifyEnvelope(envelope, trustFile, fingerprint, DOMAIN);
    if (receipt.checkpointSha256 !== c.sha(c.canonical(capsule)) || receipt.journalHash !== capsule.journalHash
      || receipt.host !== recoveryHost || receipt.failureDomain !== recoveryDomain || receipt.durable !== true) fail('REPLICA_ACK_MISMATCH');
  }
  return Object.freeze({...journal,
    // The caller stores E's authority sidecar before the first mirrored phase.
    async perform(phase, operation) {
      const result = await journal.perform(phase, () => {
        if (!['stop', 'verify-stop'].includes(phase)) mirror();
        return operation();
      });
      mirror(); return result;
    },
    recordRevision(revisionId) { journal.recordRevision(revisionId); mirror(); }
  });
}
module.exports = {DOMAIN, replicatedJournal};
