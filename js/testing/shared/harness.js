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

  let progressSink = null;

  function setProgressSink(fn){
    progressSink = typeof fn === 'function' ? fn : null;
  }

  function emitProgress(event){
    if(!progressSink) return;
    try{ progressSink(event || {}); }catch(_error){}
  }

  function makeTest(group, name, explain, fn){
    return { group, name, explain, fn };
  }

  async function runSuite(label, tests){
    const started = Date.now();
    const groupsMap = new Map();
    const results = [];
    const queue = Array.isArray(tests) ? tests : [];
    emitProgress({ type:'suite-start', label, total:queue.length });
    for(let index = 0; index < queue.length; index += 1){
      const test = queue[index];
      emitProgress({ type:'test-start', label, index:index + 1, total:queue.length, test });
      try{
        const out = test && typeof test.fn === 'function' ? test.fn() : null;
        if(out && typeof out.then === 'function') await out;
        const row = { group:test.group, name:test.name, explain:test.explain, ok:true };
        results.push(row);
        emitProgress({ type:'test-done', label, index:index + 1, total:queue.length, row });
      }catch(error){
        const row = { group:test.group, name:test.name, explain:test.explain, ok:false, message:error && error.message ? error.message : String(error), details:error && error.details };
        results.push(row);
        emitProgress({ type:'test-done', label, index:index + 1, total:queue.length, row });
      }
    }
    emitProgress({ type:'suite-done', label, total:queue.length });
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

  host.FC.testHarness = { assert, makeTest, runSuite, makeClipboardReport, detailsToText, setProgressSink, emitProgress };
})(typeof window !== 'undefined' ? window : globalThis);
