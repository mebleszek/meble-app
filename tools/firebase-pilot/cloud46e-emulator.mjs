// Only test binding. Literal demo/loopback checks precede all SDK imports.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import gate from './cloud44-gate2.js';
import pilot from './cloud42-package.js';
import contract from './cloud46d-contract.js';
import journalApi from './cloud46d-journal.js';
import {bindEmulatorRuntime} from './cloud46e-runtime.mjs';
const bindings = new WeakMap();
const fail = code => { throw Error('CLOUD46C_' + code); };
export async function createDemoTransport(options) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud46e-demo-journal-'));
  const local = journalApi.createJournal(directory);
  const journal = {...local, claim: b => local.claim({...b, projectId: contract.TARGET.projectId,
    payloadSha256: pilot.inventory().payloadSha256, documentSha256: pilot.inventory().documentSha256})};
  let runtime;
  try { runtime = await bindEmulatorRuntime({options, journal}); }
  catch (e) { local.close(); fs.rmSync(directory, {recursive: true}); throw e; }
  bindings.set(runtime.transport, {open: runtime.open, journal, directory});
  return runtime.transport;
}
export function openDemoExecutor(options) {
  const binding = bindings.get(options?.transport);
  if (!binding) fail('FIXED_DEMO_TRANSPORT_REQUIRED');
  const executor = binding.open(options);
  return Object.freeze({...executor, async run() {
    const result = await executor.run();
    if (!executor.inspect().pending) { binding.journal.close(); fs.rmSync(binding.directory, {recursive: true}); }
    return result;
  }});
}
export const executeProduction = gate.executeProduction;
