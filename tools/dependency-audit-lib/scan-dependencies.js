'use strict';

const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(full));
    else if (name.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function unique(arr) {
  return [...new Set(arr)];
}

function getScriptOrder(root, entry) {
  const full = path.join(root, entry);
  if (!fs.existsSync(full)) return [];
  const html = read(full);
  return [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
    .map((m) => m[1].split('?')[0].replace(/^\.\//, ''))
    .filter((src) => src.endsWith('.js'));
}

function areaOf(file) {
  if (file.startsWith('js/app/rozrys/')) return 'ROZRYS';
  if (file.startsWith('js/app/material/') || file === 'js/tabs/material.js') return 'MATERIAŁ';
  if (file.startsWith('js/app/investor/')) return 'INWESTOR';
  if (file.startsWith('js/app/wycena/') || file.startsWith('js/app/quote/') || file === 'js/tabs/wycena.js') return 'WYCENA';
  if (file.startsWith('js/app/project/')) return 'PROJEKT';
  if (file.startsWith('js/app/shared/data-') || file === 'js/app/shared/storage.js') return 'DANE/STORAGE';
  if (file.startsWith('js/app/shared/room-') || file === 'js/app/shared/room-scope-resolver.js') return 'POMIESZCZENIA';
  if (file.startsWith('js/app/shared/')) return 'SHARED';
  if (file.startsWith('js/app/ui/')) return 'UI';
  if (file.startsWith('js/app/cabinet/')) return 'SZAFKI';
  if (file.startsWith('js/app/catalog/') || file.startsWith('js/app/service/')) return 'KATALOG/USŁUGI';
  if (file.startsWith('js/app/optimizer/')) return 'OPTIMIZER';
  if (file.startsWith('js/testing/')) return 'TESTY';
  if (file.startsWith('js/tabs/rysunek.js')) return 'RYSUNEK';
  if (file.startsWith('js/tabs/')) return 'ZAKŁADKI';
  if (file.startsWith('js/core/')) return 'CORE';
  if (file.startsWith('js/app/bootstrap/') || file === 'js/app.js' || file === 'js/boot.js') return 'BOOT/APP SHELL';
  return 'INNE';
}

function categoryOf(file, src) {
  const area = areaOf(file);
  if (file === 'js/boot.js' || file.startsWith('js/app/bootstrap/') || file === 'js/app.js') return 'bootstrap/orchestrator';
  if (area === 'TESTY') return 'test';
  if (file.includes('/store') || file.includes('storage') || file.includes('backup') || src.includes('localStorage') || src.includes('sessionStorage')) return 'store/storage';
  if (file.includes('/ui/') || src.includes('addEventListener') || src.includes('querySelector') || src.includes('innerHTML')) return 'ui/render/events';
  if (file.includes('/shared/') || file.includes('/core/') || file.includes('/optimizer/')) return 'shared/domain/helper';
  if (file.includes('/tabs/')) return 'tab/controller';
  return 'domain/controller';
}

function classifyRisk(meta) {
  let score = 0;
  const reasons = [];
  if (meta.lines >= 600) { score += 4; reasons.push('600+ linii'); }
  else if (meta.lines >= 400) { score += 3; reasons.push('400+ linii'); }
  else if (meta.lines >= 250) { score += 1; reasons.push('250+ linii'); }
  if (meta.defines.length >= 8) { score += 2; reasons.push('dużo publicznych symboli FC'); }
  else if (meta.defines.length >= 4) { score += 1; reasons.push('kilka publicznych symboli FC'); }
  if (meta.incoming >= 10) { score += 3; reasons.push('dużo zależnych plików'); }
  else if (meta.incoming >= 5) { score += 2; reasons.push('kilka zależnych plików'); }
  if (meta.outgoing >= 12) { score += 2; reasons.push('dużo zależności wychodzących'); }
  else if (meta.outgoing >= 7) { score += 1; reasons.push('kilka zależności wychodzących'); }
  if (meta.storageRefs > 0 && !meta.file.includes('storage') && !meta.file.includes('backup') && !meta.file.includes('session') && !meta.file.includes('reload-restore')) {
    score += 2; reasons.push('bezpośredni storage poza oczywistą granicą');
  }
  if (meta.dialogRefs > 0) { score += 1; reasons.push('systemowe dialogi'); }
  if (meta.domRefs > 20 && meta.storageRefs > 0) { score += 2; reasons.push('łączy DOM/eventy i storage'); }
  if (meta.domRefs > 40 && meta.defines.length >= 4) { score += 1; reasons.push('dużo DOM i publicznego API'); }
  if (['RYSUNEK', 'INWESTOR', 'WYCENA', 'ROZRYS', 'PROJEKT'].includes(meta.area)) score += 1;
  let risk = 'niskie';
  if (score >= 8) risk = 'wysokie';
  else if (score >= 4) risk = 'średnie';
  if (meta.file === 'js/tabs/rysunek.js') risk = 'nie ruszać bez osobnego planu';
  return { risk, score, reasons };
}

function buildFileMeta(root, jsFiles, entrySet) {
  const sourceByFile = new Map(jsFiles.map((file) => [file, read(path.join(root, file))]));
  const definitions = new Map();
  const appDefinitions = new Map();
  const fileMeta = new Map();

  for (const file of jsFiles) {
    const src = sourceByFile.get(file);
    const lines = src.split(/\r?\n/).length;
    const defines = unique([...src.matchAll(/\b(?:window\.)?FC\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]));
    for (const sym of defines) {
      if (!definitions.has(sym)) definitions.set(sym, []);
      definitions.get(sym).push(file);
      if (!file.startsWith('js/testing/')) {
        if (!appDefinitions.has(sym)) appDefinitions.set(sym, []);
        appDefinitions.get(sym).push(file);
      }
    }
    const uses = unique([...src.matchAll(/\b(?:window\.)?FC\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
    const storageRefs = (src.match(/\b(?:localStorage|sessionStorage)\b/g) || []).length;
    const dialogRefs = (src.match(/\b(?:alert|confirm|prompt)\s*\(/g) || []).length;
    const domRefs = (src.match(/\b(?:querySelector|querySelectorAll|getElementById|addEventListener|innerHTML|insertAdjacentHTML|classList)\b/g) || []).length;
    const exportedWindow = unique([...src.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]).filter((x) => x !== 'FC'));

    fileMeta.set(file, { file, area: areaOf(file), category: categoryOf(file, src), lines, defines, uses, storageRefs, dialogRefs, domRefs, exportedWindow, unreferencedByEntrypoints: !entrySet.has(file), outgoingFiles: [], incomingFiles: [], secondLevelFiles: [] });
  }
  return { fileMeta, definitions, appDefinitions };
}

function buildEdges(fileMeta, definitions, appDefinitions) {
  const edges = [];
  for (const [file, meta] of fileMeta) {
    for (const sym of meta.uses) {
      const ownerMap = file.startsWith('js/testing/') ? definitions : appDefinitions;
      const owners = (ownerMap.get(sym) || []).filter((owner) => owner !== file);
      for (const owner of owners) edges.push({ from: file, to: owner, symbol: sym });
    }
  }
  for (const [file, meta] of fileMeta) {
    meta.outgoingFiles = unique(edges.filter((e) => e.from === file).map((e) => e.to)).sort();
    meta.incomingFiles = unique(edges.filter((e) => e.to === file).map((e) => e.from)).sort();
    meta.outgoing = meta.outgoingFiles.length;
    meta.incoming = meta.incomingFiles.length;
  }
  for (const [file, meta] of fileMeta) {
    const second = new Set();
    for (const incoming of meta.incomingFiles) {
      const m = fileMeta.get(incoming);
      if (!m) continue;
      for (const inc2 of m.incomingFiles) if (inc2 !== file) second.add(inc2);
    }
    meta.secondLevelFiles = [...second].sort();
    meta.secondLevel = meta.secondLevelFiles.length;
    Object.assign(meta, classifyRisk(meta));
  }
  return edges;
}

function scanDependencies(root) {
  const jsRoot = path.join(root, 'js');
  const jsFiles = walk(jsRoot).map((file) => rel(root, file)).sort();
  const indexOrder = getScriptOrder(root, 'index.html');
  const devOrder = getScriptOrder(root, 'dev_tests.html');
  const entrySet = new Set([...indexOrder, ...devOrder]);
  const { fileMeta, definitions, appDefinitions } = buildFileMeta(root, jsFiles, entrySet);
  const edges = buildEdges(fileMeta, definitions, appDefinitions);
  for (const [file, meta] of fileMeta) {
    meta.loadedInIndex = indexOrder.includes(file);
    meta.loadedInDevTests = devOrder.includes(file);
  }
  return { root, jsFiles, indexOrder, devOrder, fileMeta, definitions, appDefinitions, edges };
}

module.exports = { scanDependencies, areaOf, categoryOf };
