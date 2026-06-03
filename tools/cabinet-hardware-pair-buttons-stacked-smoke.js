const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'css', 'cabinet-common.css');
const panelPath = path.join(root, 'js', 'app', 'cabinet', 'cabinet-hardware-requirements-panel.js');

const css = fs.readFileSync(cssPath, 'utf8');
const panel = fs.readFileSync(panelPath, 'utf8');

function assert(cond, msg){
  if(!cond){
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(panel.includes('Zmień oba'), 'panel should keep shared change button');
assert(panel.includes('Przywróć domyślne dla obu'), 'panel should keep shared restore button');
assert(/\.cabinet-hardware-req-pair-actions\s*\{[^}]*grid-template-columns\s*:\s*1fr/s.test(css), 'shared pair actions should be stacked in one column');
assert(!/\.cabinet-hardware-req-pair-actions\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,1fr\)\s+minmax\(0,1fr\)/s.test(css), 'shared pair actions must not use two equal columns');
assert(/\.cabinet-hardware-req-action--pair\s*\{[^}]*width\s*:\s*100%/s.test(css), 'shared pair buttons should have full width');

console.log('OK: cabinet hardware pair buttons stacked smoke');
