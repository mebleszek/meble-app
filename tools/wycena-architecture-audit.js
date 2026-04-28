const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGETS = [
  'js/tabs/wycena.js',
  'js/app/wycena/wycena-core.js',
  'js/app/quote/quote-snapshot-scope.js',
  'js/app/quote/quote-snapshot-store.js',
  'js/app/project/project-status-sync.js',
  'js/app/quote/quote-scope-entry.js',
  'js/app/wycena/wycena-tab-selection.js',
  'js/app/project/project-status-manual-guard.js',
  'js/app/quote/quote-pdf.js',
  'js/app/wycena/wycena-tab-editor.js',
  'js/app/quote/quote-snapshot.js',
  'js/app/wycena/wycena-tab-status-bridge.js',
  'js/app/wycena/wycena-tab-preview.js',
  'js/app/quote/quote-offer-store.js',
  'js/app/wycena/wycena-tab-history.js',
  'js/app/wycena/wycena-tab-helpers.js',
  'js/app/wycena/wycena-tab-scroll.js',
];

const RESPONSIBILITY_HINTS = [
  ['render', /render[A-Z]|createElement|appendChild|className|innerHTML|textContent/g],
  ['status', /projectStatus|Status|zaakceptowany|wstepna_wycena|pomiar/g],
  ['snapshot', /Snapshot|snapshot|quoteSnapshot/g],
  ['scope', /scope|selectedRooms|roomIds|roomLabels/g],
  ['storage-boundary', /FC\.storage|readAll|writeAll|save\(|remove\(/g],
  ['pdf-export', /pdf|PDF|print/g],
  ['modal-ui', /confirmBox|infoBox|panelBox|askConfirm/g],
  ['quote-collect', /collectQuote|collectMaterial|collectAccessories|collectCommercial/g],
];

function read(file){
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function countMatches(text, re){
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  return (text.match(copy) || []).length;
}

function analyze(file){
  const text = read(file);
  const lines = text.split(/\r?\n/);
  const hints = RESPONSIBILITY_HINTS.map(([name, re])=> [name, countMatches(text, re)])
    .filter(([, count])=> count > 0)
    .sort((a,b)=> b[1]-a[1]);
  const storageRefs = countMatches(text, /\b(?:localStorage|sessionStorage)\b/g);
  const systemDialogs = countMatches(text, /\b(?:alert|confirm|prompt)\s*\(/g);
  const warnings = [];
  if(lines.length >= 600) warnings.push('600+ lines');
  else if(lines.length >= 400) warnings.push('400+ lines');
  else if(lines.length >= 250) warnings.push('250+ lines');
  if(hints.length >= 4) warnings.push('mixed responsibilities heuristic');
  if(storageRefs > 0) warnings.push('direct storage reference');
  if(systemDialogs > 0) warnings.push('system dialog reference');
  return { file, lines:lines.length, hints, storageRefs, systemDialogs, warnings };
}

function makeReport(rows){
  const now = new Date().toISOString().slice(0,10);
  const lines = [];
  lines.push(`# WYCENA architecture audit v1 — ${now}`);
  lines.push('');
  lines.push('Zakres: statyczny audyt techniczny Wyceny/ofert/statusów bez zmian runtime, UI, danych ani storage.');
  lines.push('');
  lines.push('## Wynik skrócony');
  lines.push('');
  rows.forEach((row, index)=> {
    lines.push(`${index + 1}. \`${row.file}\` — ${row.lines} linii${row.warnings.length ? `; ostrzeżenia: ${row.warnings.join(', ')}` : ''}.`);
  });
  lines.push('');
  lines.push('## Szczegóły odpowiedzialności — heurystyka');
  lines.push('');
  rows.forEach((row)=> {
    lines.push(`### ${row.file}`);
    lines.push('');
    lines.push(`- Linie: ${row.lines}`);
    lines.push(`- Bezpośrednie storage: ${row.storageRefs}`);
    lines.push(`- Systemowe dialogi: ${row.systemDialogs}`);
    lines.push(`- Sygnały odpowiedzialności: ${row.hints.map(([name, count])=> `${name}:${count}`).join(', ') || 'brak'}`);
    lines.push('');
  });
  lines.push('## Wnioski do następnych paczek');
  lines.push('');
  lines.push('1. Nie ciąć jeszcze Wyceny na podstawie samej liczby linii — najpierw utrzymać kontrakty status/scope/snapshot.');
  lines.push('2. Pierwszy split \`js/tabs/wycena.js\` został rozpoczęty od preview; kolejne kroki powinny dalej odcinać małe odpowiedzialności, nie store/statusy.');
  lines.push('3. Następni kandydaci: dalsze odchudzanie \`js/tabs/wycena.js\` albo osobny etap \`js/app/wycena/wycena-core.js\`; store snapshotów i status sync zostawić pod dodatkowe fixture old/new.');
  lines.push('4. \`quote-snapshot-store.js\` i \`project-status-sync.js\` są krytyczne dla danych/statusów — ciąć dopiero po dodatkowych testach old/new fixture.');
  lines.push('5. W badanym zakresie nie wykryto bezpośrednich \`localStorage/sessionStorage\` ani systemowych \`alert/confirm/prompt\`; obecne granice danych idą przez store/helpery.');
  lines.push('');
  return lines.join('\n');
}

const rows = TARGETS.filter((file)=> fs.existsSync(path.join(ROOT, file))).map(analyze).sort((a,b)=> b.lines-a.lines);
const report = makeReport(rows);
const reportPath = path.join(ROOT, 'tools/reports/wycena-contracts-audit-v1.md');
fs.mkdirSync(path.dirname(reportPath), { recursive:true });
fs.writeFileSync(reportPath, report);
console.log(report);
