// Apply EXISTING CLOUD-4.2 CAS plans only to the fixed demo emulator.
import {doc, runTransaction, getDocFromServer} from 'firebase/firestore';
import pilot from './cloud42-package.js';
function assertDemo(db) {
  const native = db?._delegate || db;
  if (db?.app?.options?.projectId !== 'demo-meble-app'
    || native?._settings?.host !== '127.0.0.1:18080' || native?._settings?.ssl !== false
    || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099') throw Error('CLOUD44_DEMO_LOOPBACK_REQUIRED');
}
function paths(uid) { return ['authorizedUsers/' + uid, 'appAccess/' + uid, 'pilotControl/cloud4']; }
export async function readDemoState(db, uid) {
  assertDemo(db);
  const rows = await Promise.all(paths(uid).map(async p => { const s = await getDocFromServer(doc(db, p)); return s.exists() ? s.data() : null; }));
  return {grant: rows[0], appAccess: rows[1], control: rows[2]};
}
export async function applyDemoAction(db, action, uid) {
  assertDemo(db);
  const allowed = paths(uid);
  if (action?.projectId !== pilot.PRODUCTION.projectId || action.database !== '(default)'
    || JSON.stringify(Object.keys(action.expected).sort()) !== JSON.stringify([...allowed].sort())
    || action.writes.length !== 2 || action.writes.some(w => ![allowed[0], allowed[2]].includes(w.path)
      || !['update', 'create'].includes(w.method))) throw Error('CLOUD44_ADMIN_SCOPE_INVALID');
  // One attempt: contention/abort is STOP, never an automatic replay.
  return runTransaction(db, async tx => {
    const observed = Object.fromEntries(await Promise.all(allowed.map(async p => {
      const s = await tx.get(doc(db, p)); return [p, s.exists() ? s.data() : null];
    })));
    pilot.assertExpected(action, observed);
    for (const w of action.writes) {
      if (w.method === 'update') tx.update(doc(db, w.path), w.fields);
      else tx.set(doc(db, w.path), w.fields);
    }
  }, {maxAttempts: 1});
}
export async function verifyDemoStop(db, uid) {
  const s = await readDemoState(db, uid);
  // Independent read confirms both pilot switches. Auth-only is tested separately.
  return s.grant?.enabled === false && s.control?.enabled === false;
}
