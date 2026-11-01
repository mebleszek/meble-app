// Emulator-only independent recovery rehearsal; never loads private native SDK.
import fs from 'node:fs';
import {doc, getDocFromServer, setDoc} from 'firebase/firestore';
import {getAuth} from 'firebase/auth';
import pilot from './cloud42-package.js';
import journal from './cloud46d-journal.js';
import contract from './cloud46d-contract.js';
import fence from './cloud46e-fence.js';
import {applyDemoAction, readDemoState, verifyDemoStop} from './cloud44-emulator-admin.mjs';
const fail = code => { throw Error('CLOUD46F_' + code); };
export async function recoverDemoStop({directory, binding, adminDb, verifierDb, readerDb}) {
  // Literal guards BEFORE journal claim or remote IO; all handles independent.
  for (const db of [adminDb, verifierDb, readerDb]) {
    const n = db?._delegate || db;
    if (db?.app?.options?.projectId !== 'demo-meble-app' || n?._databaseId?.projectId !== 'demo-meble-app' || n?._databaseId?.database !== '(default)'
      || n?._settings?.host !== '127.0.0.1:18080' || n?._settings?.ssl !== false
      || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
      || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') fail('DEMO_ONLY');
  }
  if (new Set([adminDb, verifierDb, readerDb].map(db => db.app)).size !== 3) fail('INDEPENDENT_CONTEXTS_REQUIRED');
  const auth = getAuth(readerDb.app);
  if (auth.currentUser?.uid !== binding.uid || auth.emulatorConfig?.host !== '127.0.0.1'
    || auth.emulatorConfig?.port !== 19099) fail('READER_IDENTITY_MISMATCH');
  const original = journal.inspectJournal(directory, binding);
  if (contract.canonical(original.binding) !== contract.canonical(binding)) fail('RECOVERY_BINDING_MISMATCH');
  const names = fence.names(directory, binding);
  // Preserved admin-inflight means STOP may race a delayed activation. Never certify.
  if (fs.existsSync(names.administrative)) fail('PRIMARY_ADMIN_UNCERTAIN');
  const fd = fs.openSync(names.recovery, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  const append = value => { fs.writeFileSync(fd, JSON.stringify(value) + '\n'); fs.fsyncSync(fd); };
  try {
    append({kind: 'RECOVERY_INTENT', journalHash: original.events.at(-1).hash, retryWrite: false});
    fence.syncDirectory(directory);
    const state = await readDemoState(adminDb, binding.uid);
    await applyDemoAction(adminDb, pilot.stopAction({uid: binding.uid, ...state}), binding.uid);
    append({kind: 'STOP_ACKNOWLEDGED', retryWrite: false});
    if (!await verifyDemoStop(verifierDb, binding.uid)) fail('STOP_UNCONFIRMED');
    const head = doc(readerDb, 'users', binding.uid, 'pilotProjects', 'cloud4-project-v1');
    // Both read and write denial must be the actual Rules result, not unavailable.
    for (const operation of [() => getDocFromServer(head), () => setDoc(head, {denialProbe: true})]) {
      let denied = false;
      try { await operation(); } catch (error) {
        if (error.code !== 'permission-denied') fail('DENIAL_UNCONFIRMED');
        denied = true;
      }
      if (!denied) fail('ACCESS_NOT_STOPPED');
    }
    append({kind: 'STOP_VERIFIED', retryWrite: false});
    return {status: 'DEMO_STOP_VERIFIED', retryWrite: false, hostIndependenceProven: false,
      revisionId: original.events.find(e => e.kind === 'REVISION_PREPARED')?.receipt?.revisionId || null};
  } catch (_) {
    append({kind: 'RESULT_UNCERTAIN', retryWrite: false}); fail('STOP_UNCERTAIN');
  } finally { fs.closeSync(fd); }
}
