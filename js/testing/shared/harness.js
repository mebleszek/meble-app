(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};

  function assert(condition, message, details){
    if(!condition){
      const err = new Error(message || 'Assertion failed');
      if(details !== undefined) err.details = details;
      throw err;
    }
  }

  function detailsToText(details){
    if(details == null) return '';
    if(typeof details === 'string') return details;
    try{ return JSON.stringify(details, null, 2); }catch(_){ return String(details); }
  }

  function makeTest(group, name, explain, fn){
    return { group, name, explain, fn };
  }

  function runSuite(label, tests){
    const started = Date.now();
    const groupsMap = new Map();
    const results = [];
    (Array.isArray(tests) ? tests : []).forEach((test)=>{
      try{
        test.fn();
        results.push({ group:test.group, name:test.name, explain:test.explain, ok:true });
      }catch(error){
        results.push({ group:test.group, name:test.name, explain:test.explain, ok:false, message:error && error.message ? error.message : String(error), details:error && error.details });
      }
    });
    results.forEach((row)=>{
      if(!groupsMap.has(row.group)) groupsMap.set(row.group, { name:row.group, passed:0, failed:0, total:0, results:[] });
      const bucket = groupsMap.get(row.group);
      bucket.total += 1;
      if(row.ok) bucket.passed += 1; else bucket.failed += 1;
      bucket.results.push(row);
    });
    const groups = Array.from(groupsMap.values());
    const passed = results.filter(r=> r.ok).length;
    const failed = results.length - passed;
    return { label, total:results.length, passed, failed, durationMs:Date.now()-started, groups, results };
  }

  function makeClipboardReport(report){
    const lines = [];
    lines.push(`${report.label}: ${report.passed}/${report.total} OK`);
    lines.push(`Błędy: ${report.failed}`);
    lines.push(`Czas: ${report.durationMs} ms`);
    report.groups.forEach((group)=>{
      lines.push('');
      lines.push(`[${group.name}] ${group.passed}/${group.total} OK`);
      group.results.forEach((row)=>{
        lines.push(`- ${row.ok ? 'OK' : 'BŁĄD'}: ${row.name}`);
        if(row.explain) lines.push(`  Po co: ${row.explain}`);
        if(!row.ok && row.message) lines.push(`  Powód: ${row.message}`);
        const detailsText = !row.ok ? detailsToText(row.details) : '';
        if(detailsText) lines.push(`  Szczegóły: ${detailsText}`);
      });
    });
    return lines.join('\n');
  }

  host.FC.testHarness = { assert, makeTest, runSuite, makeClipboardReport, detailsToText };
})(typeof window !== 'undefined' ? window : globalThis);
