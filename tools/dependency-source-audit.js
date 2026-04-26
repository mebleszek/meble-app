#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { scanDependencies } = require('./dependency-audit-lib/scan-dependencies');
const { buildReport } = require('./dependency-audit-lib/render-report');

const ROOT = path.resolve(__dirname, '..');
const scan = scanDependencies(ROOT);
const { reportText, json } = buildReport(scan);
const outDir = path.join(ROOT, 'tools', 'reports');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'dependency-source-audit.md'), reportText);
fs.writeFileSync(path.join(outDir, 'dependency-source-audit.json'), JSON.stringify(json, null, 2));

console.log(reportText.split('\n').slice(0, 80).join('\n'));
console.log('\nRaport zapisany: tools/reports/dependency-source-audit.md');
console.log('Dane JSON zapisane: tools/reports/dependency-source-audit.json');

process.exit(0);
