// Run the existing 15 adversarial scenarios against the new generated binding.
// This imports no production candidate and does not weaken/copy any assertions.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const original = new URL('./cloud46c-executor.test.mjs', import.meta.url);
let source = fs.readFileSync(original, 'utf8');
if (createHash('sha256').update(source).digest('hex') !== '980edffdef8f53a7dbed109501c79d0b97b57217ea27eb42978167f98e10dc83') throw Error('CLOUD46D_TEST_SOURCE_CHANGED');
for (const name of ['cloud46c-demo-transport.mjs', 'cloud46c-executor.mjs']) {
  if (source.split("import('./" + name + "')").length !== 2) throw Error('CLOUD46D_TEST_SOURCE_CHANGED');
  source = source.replace("import('./" + name + "')", "import('./cloud46d-rehearsal.mjs')");
}
source = source.replace('CLOUD-4.6C ', 'CLOUD-4.6D ');
source = source.replace(/(['"])(\.{1,2}\/[^'"\n]+)\1/g, (_all, quote, relative) => quote + new URL(relative, original).href + quote);
// Resolve npm imports from this file-backed module before creating the data URL.
// Workers inherit the transformed source, including these absolute ESM URLs.
for (const name of ['@firebase/rules-unit-testing', 'firebase/app', 'firebase/auth', 'firebase/firestore']) {
  const specifier = "import('" + name + "')";
  if (source.split(specifier).length !== 2) throw Error('CLOUD46D_TEST_SOURCE_CHANGED');
  source = source.replace(specifier, 'import(' + JSON.stringify(import.meta.resolve(name)) + ')');
}
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
