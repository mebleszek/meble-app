// Run the existing 15 adversarial scenarios against the new generated binding.
// This imports no production candidate and does not weaken/copy any assertions.
import fs from 'node:fs';
const original = new URL('./cloud46c-executor.test.mjs', import.meta.url);
let source = fs.readFileSync(original, 'utf8');
for (const name of ['cloud46c-demo-transport.mjs', 'cloud46c-executor.mjs']) {
  if (source.split("import('./" + name + "')").length !== 2) throw Error('CLOUD46D_TEST_SOURCE_CHANGED');
  source = source.replace("import('./" + name + "')", "import('./cloud46d-rehearsal.mjs')");
}
source = source.replace('CLOUD-4.6C ', 'CLOUD-4.6D ');
source = source.replace(/(['"])(\.{1,2}\/[^'"\n]+)\1/g, (_all, quote, relative) => quote + new URL(relative, original).href + quote);
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
