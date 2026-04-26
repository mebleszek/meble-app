'use strict';

function top(arr, n) {
  return arr.slice().sort((a, b) => b[1] - a[1]).slice(0, n);
}

function mdTable(rows, headers) {
  const out = [];
  out.push(`| ${headers.join(' | ')} |`);
  out.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) out.push(`| ${row.map((x) => String(x).replace(/\|/g, '\\|')).join(' | ')} |`);
  return out.join('\n');
}

function fmtList(files, limit = 8) {
  const arr = files.slice(0, limit);
  const more = files.length > limit ? ` +${files.length - limit}` : '';
  return arr.join('<br>') + more;
}

function buildAreaSummary(fileMeta) {
  const byArea = {};
  for (const meta of fileMeta.values()) {
    byArea[meta.area] ||= { files: 0, lines: 0, storageRefs: 0, dialogRefs: 0, high: 0, medium: 0 };
    byArea[meta.area].files += 1;
    byArea[meta.area].lines += meta.lines;
    byArea[meta.area].storageRefs += meta.storageRefs;
    byArea[meta.area].dialogRefs += meta.dialogRefs;
    if (meta.risk.includes('nie ruszać') || meta.risk === 'wysokie') byArea[meta.area].high += 1;
    else if (meta.risk === 'średnie') byArea[meta.area].medium += 1;
  }
  return byArea;
}

function buildReport(scan) {
  const { jsFiles, indexOrder, devOrder, fileMeta, definitions, appDefinitions, edges } = scan;
  const metas = [...fileMeta.values()];
  const byArea = buildAreaSummary(fileMeta);
  const topLines = top(metas.map((m) => [m.file, m.lines]), 20);
  const topIncoming = top(metas.map((m) => [m.file, m.incoming]), 20);
  const topSecond = top(metas.map((m) => [m.file, m.secondLevel]), 20);
  const topStorage = top(metas.filter((m) => m.storageRefs).map((m) => [m.file, m.storageRefs]), 20);
  const risks = metas.filter((m) => m.risk !== 'niskie').sort((a, b) => b.score - a.score || b.lines - a.lines);
  const missingIndexOrder = indexOrder.filter((f) => !fileMeta.has(f));
  const missingDevOrder = devOrder.filter((f) => !fileMeta.has(f));
  const notInAnyEntrypoint = metas.filter((m) => m.unreferencedByEntrypoints && !m.file.includes('panel-pro-worker.js')).map((m) => m.file).sort();

  const report = [];
  report.push('# DEPENDENCY_SOURCE_AUDIT — raport źródłowy');
  report.push('');
  report.push('Raport generowany przez `node tools/dependency-source-audit.js`. To jest raport pomocniczy do `DEPENDENCY_MAP.md`, nie zamiennik ręcznej analizy przed refaktorem.');
  report.push('');
  report.push('## Podsumowanie');
  report.push('');
  report.push(mdTable([
    ['Pliki JS', jsFiles.length],
    ['Skrypty w index.html', indexOrder.length],
    ['Skrypty w dev_tests.html', devOrder.length],
    ['Krawędzie zależności po symbolach FC', edges.length],
    ['Symbole FC z właścicielem produkcyjnym', appDefinitions.size],
    ['Symbole FC z właścicielem razem', definitions.size],
    ['Pliki z ryzykiem wysokim / nie ruszać', risks.filter((m) => m.risk === 'wysokie' || m.risk.includes('nie ruszać')).length],
    ['Pliki z ryzykiem średnim', risks.filter((m) => m.risk === 'średnie').length],
  ], ['Metryka', 'Wartość']));
  report.push('');
  report.push('## Obszary');
  report.push('');
  report.push(mdTable(Object.entries(byArea).sort((a, b) => b[1].lines - a[1].lines).map(([area, v]) => [area, v.files, v.lines, v.storageRefs, v.dialogRefs, v.high, v.medium]), ['Obszar', 'Pliki', 'Linie', 'Storage refs', 'Dialog refs', 'Wysokie', 'Średnie']));
  report.push('');
  report.push('## Największe pliki');
  report.push('');
  report.push(mdTable(topLines.map(([f, n]) => [f, n, fileMeta.get(f).area, fileMeta.get(f).risk]), ['Plik', 'Linie', 'Obszar', 'Ryzyko']));
  report.push('');
  report.push('## Największy wpływ bezpośredni');
  report.push('');
  report.push(mdTable(topIncoming.map(([f, n]) => [f, n, fileMeta.get(f).area, fileMeta.get(f).risk]), ['Plik', 'Zależne pliki', 'Obszar', 'Ryzyko']));
  report.push('');
  report.push('## Największy wpływ drugiego poziomu');
  report.push('');
  report.push(mdTable(topSecond.map(([f, n]) => [f, n, fileMeta.get(f).area, fileMeta.get(f).risk]), ['Plik', 'Pliki pośrednio zależne', 'Obszar', 'Ryzyko']));
  report.push('');
  report.push('## Najwięcej bezpośrednich referencji storage');
  report.push('');
  report.push(mdTable(topStorage.map(([f, n]) => [f, n, fileMeta.get(f).area, fileMeta.get(f).risk]), ['Plik', 'Referencje', 'Obszar', 'Ryzyko']));
  report.push('');
  report.push('## Pliki ryzykowne');
  report.push('');
  report.push(mdTable(risks.slice(0, 35).map((m) => [m.file, m.risk, m.score, m.lines, m.incoming, m.secondLevel, m.reasons.join('; ')]), ['Plik', 'Ryzyko', 'Score', 'Linie', 'Direct impact', '2nd level', 'Powody']));
  report.push('');
  report.push('## Potencjalnie nieładowane przez index/dev_tests');
  report.push('');
  report.push(notInAnyEntrypoint.length ? notInAnyEntrypoint.map((f) => `- ${f}`).join('\n') : 'Brak, pomijając workery/ładowanie specjalne.');
  report.push('');
  report.push('## Braki w HTML względem plików');
  report.push('');
  report.push(`- index.html — brakujące pliki wskazane w skryptach: ${missingIndexOrder.length ? missingIndexOrder.join(', ') : 'brak'}`);
  report.push(`- dev_tests.html — brakujące pliki wskazane w skryptach: ${missingDevOrder.length ? missingDevOrder.join(', ') : 'brak'}`);
  report.push('');
  report.push('## Szczegóły zależności dla największych punktów wpływu');
  report.push('');
  for (const [f] of topIncoming.slice(0, 15)) {
    const m = fileMeta.get(f);
    report.push(`### ${f}`);
    report.push('');
    report.push(`- Obszar: ${m.area}`);
    report.push(`- Kategoria: ${m.category}`);
    report.push(`- Ryzyko: ${m.risk}${m.reasons.length ? ` (${m.reasons.join('; ')})` : ''}`);
    report.push(`- Definiuje FC: ${m.defines.length ? m.defines.join(', ') : 'brak'}`);
    report.push(`- Bezpośrednio zależne pliki (${m.incomingFiles.length}): ${m.incomingFiles.length ? fmtList(m.incomingFiles) : 'brak'}`);
    report.push(`- Pośrednio zależne pliki (${m.secondLevelFiles.length}): ${m.secondLevelFiles.length ? fmtList(m.secondLevelFiles) : 'brak'}`);
    report.push('');
  }

  return { reportText: report.join('\n'), json: buildJson(scan, byArea, topLines, topIncoming, topSecond, topStorage, risks) };
}

function buildJson(scan, byArea, topLines, topIncoming, topSecond, topStorage, risks) {
  const { jsFiles, indexOrder, devOrder, fileMeta, definitions, appDefinitions, edges } = scan;
  return {
    generatedAt: new Date().toISOString(),
    summary: { jsFiles: jsFiles.length, indexScripts: indexOrder.length, devTestScripts: devOrder.length, fcSymbols: appDefinitions.size, fcSymbolsAll: definitions.size, edges: edges.length, highRisk: risks.filter((m) => m.risk === 'wysokie' || m.risk.includes('nie ruszać')).length, mediumRisk: risks.filter((m) => m.risk === 'średnie').length },
    byArea,
    topLines,
    topIncoming,
    topSecond,
    topStorage,
    risks: risks.map((m) => ({ file: m.file, risk: m.risk, score: m.score, area: m.area, category: m.category, lines: m.lines, incoming: m.incoming, outgoing: m.outgoing, secondLevel: m.secondLevel, storageRefs: m.storageRefs, dialogRefs: m.dialogRefs, reasons: m.reasons })),
    files: Object.fromEntries([...fileMeta.entries()].map(([file, m]) => [file, { area: m.area, category: m.category, lines: m.lines, defines: m.defines, uses: m.uses, incomingFiles: m.incomingFiles, outgoingFiles: m.outgoingFiles, secondLevelFiles: m.secondLevelFiles, storageRefs: m.storageRefs, dialogRefs: m.dialogRefs, domRefs: m.domRefs, loadedInIndex: m.loadedInIndex, loadedInDevTests: m.loadedInDevTests, risk: m.risk, reasons: m.reasons }])),
  };
}

module.exports = { buildReport, mdTable };
