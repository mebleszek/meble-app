const fs = require('fs');
const path = require('path');

const DEFAULT_ROOTS = ['js'];
const STORAGE_RE = /\b(?:localStorage|sessionStorage)\b/;
const METHOD_RE = /\b(localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem|clear|key|length)\b/;

function walkFiles(rootDir){
  const out = [];
  if(!fs.existsSync(rootDir)) return out;
  const stack = [rootDir];
  while(stack.length){
    const current = stack.pop();
    const stat = fs.statSync(current);
    if(stat.isDirectory()){
      fs.readdirSync(current).forEach((name)=> stack.push(path.join(current, name)));
      continue;
    }
    if(/\.(js|html)$/i.test(current)) out.push(current.replace(/\\/g, '/'));
  }
  return out.sort();
}

function classifyFile(file){
  const f = String(file || '');
  if(f.includes('/testing/') || f.startsWith('dev_') || f.includes('dev-tests')) return 'test-tooling';
  if(f.includes('/shared/storage.js') || f.includes('/shared/data-storage-') || f.includes('/shared/data-backup-')) return 'shared-storage-boundary';
  if(f.includes('/investor/session.js')) return 'session-snapshot-boundary';
  if(/\/store\.js$|\/.*-store\.js$|\/catalog-store\.js$|\/service-order-store\.js$/.test(f)) return 'domain-store';
  if(f.includes('/rozrys/') && /cache|prefs|grain/.test(f)) return 'technical-rozrys-state';
  if(f.includes('/material/')) return 'material-domain-storage';
  if(f === 'js/app.js' || f === 'js/boot.js') return 'app-shell-legacy-storage';
  return 'direct-or-legacy-storage';
}

function classifyOperation(line){
  const match = String(line || '').match(METHOD_RE);
  if(match) return `${match[1]}.${match[2]}`;
  if(/\blocalStorage\s*\.\s*length\b/.test(line)) return 'localStorage.length';
  if(/\bsessionStorage\s*\.\s*length\b/.test(line)) return 'sessionStorage.length';
  return STORAGE_RE.test(line) ? 'storage-reference' : 'none';
}

function scanFile(file){
  const text = fs.readFileSync(file, 'utf8');
  const area = classifyFile(file);
  const rows = [];
  text.split(/\r?\n/).forEach((line, idx)=>{
    if(!STORAGE_RE.test(line)) return;
    const trimmed = line.trim();
    if(!trimmed || trimmed.startsWith('//')) return;
    rows.push({ file, line:idx + 1, area, operation:classifyOperation(line), text:trimmed.slice(0, 180) });
  });
  return rows;
}

function buildAudit(roots){
  const files = roots.flatMap(walkFiles);
  const rows = files.flatMap(scanFile);
  const byArea = {};
  const byOperation = {};
  rows.forEach((row)=>{
    byArea[row.area] = (byArea[row.area] || 0) + 1;
    byOperation[row.operation] = (byOperation[row.operation] || 0) + 1;
  });
  const filesWithHits = Array.from(new Set(rows.map((row)=> row.file))).sort();
  return { roots, totalReferences:rows.length, filesWithHits, byArea, byOperation, rows };
}

function formatObject(obj){
  return Object.keys(obj).sort().map((key)=> `- ${key}: ${obj[key]}`).join('\n') || '- Brak';
}

function formatReport(audit){
  const lines = [];
  lines.push('Audyt źródeł storage');
  lines.push(`Zakres: ${audit.roots.join(', ')}`);
  lines.push(`Pliki z użyciem storage: ${audit.filesWithHits.length}`);
  lines.push(`Referencje storage razem: ${audit.totalReferences}`);
  lines.push('');
  lines.push('Według obszaru:');
  lines.push(formatObject(audit.byArea));
  lines.push('');
  lines.push('Według operacji:');
  lines.push(formatObject(audit.byOperation));
  lines.push('');
  lines.push('Pliki z referencjami:');
  audit.filesWithHits.forEach((file)=> lines.push(`- ${file}`));
  return lines.join('\n');
}

if(require.main === module){
  const roots = process.argv.slice(2).filter(Boolean);
  const audit = buildAudit(roots.length ? roots : DEFAULT_ROOTS);
  if(process.argv.includes('--json')) console.log(JSON.stringify(audit, null, 2));
  else console.log(formatReport(audit));
}

module.exports = { buildAudit, formatReport, classifyFile, classifyOperation };
