(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function getSuiteRegistry(){
    return [
      { key:'rozrys', name:'ROZRYS', inApp:false, run: FC.rozrysDevTests && typeof FC.rozrysDevTests.runAll === 'function' ? ()=> FC.rozrysDevTests.runAll() : null },
      { key:'project', name:'PROJEKT', inApp:true, run: FC.projectDevTests && typeof FC.projectDevTests.runAll === 'function' ? ()=> FC.projectDevTests.runAll() : null },
      { key:'investor', name:'INWESTOR', inApp:true, run: FC.investorDevTests && typeof FC.investorDevTests.runAll === 'function' ? ()=> FC.investorDevTests.runAll() : null },
      { key:'material', name:'MATERIAŁY', inApp:true, run: FC.materialDevTests && typeof FC.materialDevTests.runAll === 'function' ? ()=> FC.materialDevTests.runAll() : null },
      { key:'data', name:'DANE', inApp:true, run: FC.dataSafetyDevTests && typeof FC.dataSafetyDevTests.runAll === 'function' ? ()=> FC.dataSafetyDevTests.runAll() : null },
      { key:'rysunek', name:'RYSUNEK', inApp:true, run: FC.rysunekDevTests && typeof FC.rysunekDevTests.runAll === 'function' ? ()=> FC.rysunekDevTests.runAll() : null },
      { key:'wycena', name:'WYCENA', inApp:true, run: FC.wycenaDevTests && typeof FC.wycenaDevTests.runAll === 'function' ? ()=> FC.wycenaDevTests.runAll() : null },
      { key:'cabinet', name:'SZAFKI', inApp:true, run: FC.cabinetDevTests && typeof FC.cabinetDevTests.runAll === 'function' ? ()=> FC.cabinetDevTests.runAll() : null },
      { key:'service', name:'USŁUGI', inApp:true, run: FC.serviceDevTests && typeof FC.serviceDevTests.runAll === 'function' ? ()=> FC.serviceDevTests.runAll() : null },
    ].filter((entry)=> typeof entry.run === 'function');
  }

  async function mergeAppReports(){
    const reports = [];
    const registry = getSuiteRegistry().filter((entry)=> entry.inApp);
    for(const entry of registry){
      const report = await entry.run();
      if(report) reports.push(report);
    }
    const merged = {
      label:'APP smoke testy',
      total:0,
      passed:0,
      failed:0,
      durationMs:0,
      groups:[],
    };
    reports.forEach((report)=>{
      merged.total += report.total || 0;
      merged.passed += report.passed || 0;
      merged.failed += report.failed || 0;
      merged.durationMs += report.durationMs || 0;
      (report.groups || []).forEach((group)=> merged.groups.push(group));
    });
    merged.ok = merged.failed === 0;
    merged.summaryText = `${merged.passed}/${merged.total} OK`;
    merged.clipboardText = FC.testHarness && typeof FC.testHarness.makeClipboardReport === 'function'
      ? FC.testHarness.makeClipboardReport(merged)
      : '';
    return merged;
  }

  async function collectSuites(mode){
    const suites = [];
    const registry = getSuiteRegistry();
    if(mode === 'all'){
      const rozrys = registry.find((entry)=> entry.key === 'rozrys');
      if(rozrys) suites.push({ name:rozrys.name, report: await rozrys.run() });
      suites.push({ name:'APP', report: await mergeAppReports() });
      return suites;
    }
    if(mode === 'app'){
      suites.push({ name:'APP', report: await mergeAppReports() });
      return suites;
    }
    const single = registry.find((entry)=> entry.key === mode);
    if(single) suites.push({ name:single.name, report: await single.run() });
    return suites;
  }

  FC.devTestsRegistry = { getSuiteRegistry, mergeAppReports, collectSuites };
})(typeof window !== 'undefined' ? window : globalThis);
