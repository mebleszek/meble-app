const fs = require('fs');
const path = require('path');

const root = process.cwd();
const bootPath = path.join(root, 'js/boot.js');
const indexPath = path.join(root, 'index.html');
const boot = fs.readFileSync(bootPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const errors = [];
function assert(cond, msg){ if(!cond) errors.push(msg); }

assert(boot.includes('boot-clean-1.6'), 'boot.js powinien mieć wersję boot-clean-1.6');
assert(boot.includes("if (document.readyState === 'complete')"), 'boot ma startować od razu tylko po pełnym load/complete');
assert(boot.includes("document.addEventListener('DOMContentLoaded', boot"), 'boot ma czekać na DOMContentLoaded przy readyState interactive/loading');
assert(boot.includes('if(!loadSeen) return false'), 'brak init nie może być raportowany przed window.load');
assert(boot.includes('Date.now() - loadAt >= BOOT_MISSING_INIT_TIMEOUT_MS + BOOT_MISSING_INIT_LOAD_GRACE_MS'), 'timeout braku init ma liczyć od loadAt');
assert(!boot.includes("if (document.readyState === 'loading')"), 'nie wolno wrócić do startu boot() już przy readyState interactive');
assert(index.includes('js/boot.js?v=20260616_czynnosci_project_preparation_v1'), 'index.html powinien mieć podbity cache-busting boot.js');
assert(!index.includes('20260611_transport_catalog_quote_fix_v1'), 'index.html nie powinien zawierać starego cache-bustingu');

if(errors.length){
  console.error('boot-domcontentloaded-init-fix smoke: FAIL');
  errors.forEach((e)=> console.error('- ' + e));
  process.exit(1);
}
console.log('boot-domcontentloaded-init-fix smoke: OK');
