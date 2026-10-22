// Preserve all original Worker scenarios/assertions against the shared 4.6E binding.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const original = new URL('./cloud46c-executor.test.mjs', import.meta.url);
let source = fs.readFileSync(original, 'utf8');
if (createHash('sha256').update(source).digest('hex') !== '980edffdef8f53a7dbed109501c79d0b97b57217ea27eb42978167f98e10dc83') throw Error('CLOUD46E_TEST_SOURCE_CHANGED');
for (const name of ['cloud46c-demo-transport.mjs', 'cloud46c-executor.mjs']) {
  if (source.split("import('./" + name + "')").length !== 2) throw Error('CLOUD46E_TEST_SOURCE_CHANGED');
  source = source.replace("import('./" + name + "')", "import('./cloud46e-emulator.mjs')");
}
source = source.replace('CLOUD-4.6C ', 'CLOUD-4.6E ');
// Additional sentinel assertions preserve real catalog/stock/project documents.
const businessPaths = ['catalogs/materials', 'inventory/stock', 'projects/real-project', 'settings/global'];
const seed = '    await env.clearFirestore();';
const result = '    const result = await operation;';
if (source.split(seed).length !== 2 || source.split(result).length !== 2) throw Error('CLOUD46E_TEST_SOURCE_CHANGED');
source = source.replace(seed, seed + '\n    for (const p of ' + JSON.stringify(businessPaths) + ') await f.setDoc(f.doc(administrativeDb, p), {sentinel: "preserve-business-data"});');
source = source.replace(result, result + '\n    for (const p of ' + JSON.stringify(businessPaths) + ') assert.deepEqual((await f.getDocFromServer(f.doc(administrativeDb, p))).data(), {sentinel: "preserve-business-data"});');
const existingPaths = "'catalogs/materials', 'settings/global'";
if (source.split(existingPaths).length !== 3) throw Error('CLOUD46E_TEST_SOURCE_CHANGED');
source = source.replaceAll(existingPaths, "'catalogs/materials', 'inventory/stock', 'projects/real-project', 'settings/global'");
source = source.replace(/(['"])(\.{1,2}\/[^'"\n]+)\1/g, (_all, quote, relative) => quote + new URL(relative, original).href + quote);
for (const name of ['@firebase/rules-unit-testing', 'firebase/app', 'firebase/auth', 'firebase/firestore']) {
  const specifier = "import('" + name + "')";
  if (source.split(specifier).length !== 2) throw Error('CLOUD46E_TEST_SOURCE_CHANGED');
  source = source.replace(specifier, 'import(' + JSON.stringify(import.meta.resolve(name)) + ')');
}
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
