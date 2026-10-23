import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const fixtures = require('../cloud-global-data-smoke.js');
export const model = fixtures.model;
export const runtime = fixtures.runtime;
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
