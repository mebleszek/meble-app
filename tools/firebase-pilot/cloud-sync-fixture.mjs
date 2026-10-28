import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const fixtures = require('../cloud-global-data-smoke.js');
export const model = fixtures.model;
// node:test inherits file-level hooks into t.test() children. Independent
// top-level cases reset their own fixture; a sequential nested suite owns its
// setup/cleanup and must retain its grants, immutable revisions and CAS heads.
export function topLevelFixture(hook) {
  return async context => {
    if (typeof context?.name !== 'string' || typeof context?.fullName !== 'string') throw Error('TEST_CONTEXT_REQUIRED');
    if (context.fullName === context.name) return hook(context);
  };
}
// Configure an isolated native fixture, never an application's live selection.
// Resolve the investor from its actual project record rather than guessing it.
export function selectProjectFixture(fixture, projectId) {
  const record = JSON.parse(fixture.storage.getItem('fc_projects_v1')).find(row => row.id === projectId);
  if (!record || fixture.FC.projectStore.setCurrentProjectId(projectId) !== projectId) throw Error('TEST_PROJECT_CONTEXT_REQUIRED');
  fixture.FC.investors.setCurrentId(record.investorId);
  fixture.s.uiState.currentInvestorId = record.investorId;
  fixture.s.projectData = fixture.FC.project.load();
  // The native export fixture provides TextEncoder; independent CLOUD-2B reads
  // also require the browser's decoder. Do not relax unpack's API/integrity gate.
  fixture.s.TextDecoder = TextDecoder;
  return fixture;
}
export function runtime() {
  const r = fixtures.runtime();
  // Match global.test.mjs: SDK-facing records and transaction payloads must be
  // created in the SDK's realm. Keep each window/FC and native store isolated;
  // native catalog writers still use r.load's vm, without changing their data.
  for (const name of ['global-data-contract', 'firebase-global-transport']) {
    new Function('window', fs.readFileSync(new URL('../../js/app/cloud/' + name + '.js', import.meta.url), 'utf8'))(r.s);
  }
  return r;
}
export function seed(r, value = model()) {
  const c = r.FC.globalDataContract;
  for (const [domain, data] of Object.entries(value)) {
    r.rows.set(c.sources[domain][0], JSON.stringify(domain === 'stock' ? {sheets: data} : data));
  }
  return r.storage;
}
export function addCompatibleFields(value) {
  // Catalog-defined parameter keys are intentionally extensible in CLOUD-3.
  value.technicalParams.push({id: 'new-param', category: 'Synthetic hinges', key: 'futureCatalogKey',
    fieldType: 'text', compareMode: 'equal', options: ['unmodified value']});
  value.hardware[0].technicalParams.futureCatalogKey = {value: 'unmodified value'};
  value.hardware[0].bundleItems = [{itemId: 'h2', qty: 2}];
  value.hardware.push({...structuredClone(value.hardware[0]), id: 'h2', name: 'Synthetic compatible hinge', bundleItems: []});
  return value;
}
