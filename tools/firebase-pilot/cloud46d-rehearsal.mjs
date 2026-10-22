// The only executable binding of the prepared source is fixed to demo emulators.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import gate from './cloud44-gate2.js';
import pilot from './cloud42-package.js';
import proof from './cloud46c-proof.js';
import candidate from './cloud46d-candidate.js';
import contract from './cloud46d-contract.js';
import journalApi from './cloud46d-journal.js';
import fixtureRuntime from '../cloud4-pilot-readiness-smoke.js';
import {applyDemoAction, readDemoState, verifyDemoStop} from './cloud44-emulator-admin.mjs';
const bound = new WeakMap();
export async function createDemoTransport(options) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18080'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099'
    || options?.adminDb?.app?.options?.projectId !== 'demo-meble-app') throw Error('CLOUD46C_DEMO_CONNECTION_REQUIRED');
  const firestore = await import('firebase/firestore');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud46d-demo-journal-'));
  const local = journalApi.createJournal(directory);
  const journal = {...local, claim: binding => local.claim({...binding, projectId: contract.TARGET.projectId, database: contract.TARGET.database, payloadSha256: pilot.inventory().payloadSha256, documentSha256: pilot.inventory().documentSha256})};
  const parts = candidate.demoSources();
  const source = parts.transport.replace('const f = await import(\'firebase/firestore\');', 'const f = firestore;')
    .replaceAll('import.meta.url', JSON.stringify(new URL('./cloud46c-demo-transport.mjs', import.meta.url).href));
  const adapter = new Function('fs', 'createHash', 'pilot', 'fixtureRuntime', 'applyDemoAction', 'readDemoState', 'verifyDemoStop', 'firestore', 'journal',
    source + '\nreturn {createDemoTransport, assertDemoTransport};')(fs, createHash, pilot, fixtureRuntime, applyDemoAction, readDemoState, verifyDemoStop, firestore, journal);
  const transport = await adapter.createDemoTransport(options);
  const open = new Function('fs', 'createHash', 'gate', 'pilot', 'proof', 'assertDemoTransport', 'journal',
    parts.cycle + '\nreturn openDemoExecutor;')(fs, createHash, gate, pilot, proof, adapter.assertDemoTransport, journal);
  bound.set(transport, {open, journal});
  return transport;
}
export function openDemoExecutor(options) {
  const binding = bound.get(options?.transport);
  if (!binding) throw Error('CLOUD46C_FIXED_DEMO_TRANSPORT_REQUIRED');
  const executor = binding.open(options);
  return Object.freeze({...executor, async run() { try { return await executor.run(); } finally { binding.journal.close(); } }});
}
export const executeProduction = gate.executeProduction;
