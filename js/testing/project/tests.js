(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function withInvestorStorage(run){
    const inv = FC.investors;
    if(!inv) throw new Error('Brak FC.investors');
    const prevAll = inv.readAll();
    const prevCurrent = inv.getCurrentId();
    try{
      inv.writeAll([]);
      inv.setCurrentId(null);
      return run(inv);
    } finally {
      inv.writeAll(prevAll);
      inv.setCurrentId(prevCurrent);
    }
  }

  function buildDefaultProject(){
    return {
      kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{ roomHeight:260 } },
      szafa:{ cabinets:[], fronts:[], sets:[], settings:{} },
      pokoj:{ cabinets:[], fronts:[], sets:[], settings:{} },
      lazienka:{ cabinets:[], fronts:[], sets:[], settings:{} },
    };
  }

  function runAll(){
    return H.runSuite('APP smoke testy', [
      H.makeTest('Projekt', 'Normalizer projektu uzupełnia brakujące pokoje i tablice', 'Sprawdza, czy bootstrap projektu nie zostawia brakujących pokoi albo pustych struktur po starych danych.', ()=>{
        if(!FC.projectBootstrap || typeof FC.projectBootstrap.normalizeProjectData !== 'function') throw new Error('Brak normalizeProjectData');
        FC.project = FC.project || {};
        FC.project.DEFAULT_PROJECT = buildDefaultProject();
        FC.project.save = (pd)=> pd;
        const project = { kuchnia:{ cabinets:[{ id:'cab1' }], settings:{} } };
        const out = FC.projectBootstrap.normalizeProjectData(project, buildDefaultProject());
        H.assert(Array.isArray(out.kuchnia.cabinets), 'Kuchnia nie ma cabinets', out);
        H.assert(Array.isArray(out.szafa.cabinets), 'Brak domyślnej szafy po normalizacji', out);
        H.assert(Array.isArray(out.pokoj.fronts), 'Brak domyślnych fronts w pokoju', out);
      }),
      H.makeTest('Projekt', 'Store inwestorów tworzy, wyszukuje i aktualizuje wpis bez gubienia bieżącego ID', 'Sprawdza, czy lokalna baza inwestorów działa stabilnie przy tworzeniu i edycji.', ()=>{
        withInvestorStorage((inv)=>{
          const created = inv.create({ name:'Jan Test', email:'jan@test.pl', city:'Łódź' });
          H.assert(created && created.id, 'Nie utworzono inwestora', created);
          H.assert(inv.getCurrentId() === created.id, 'Nie ustawiono current investor', { current:inv.getCurrentId(), created });
          const found = inv.search('jan@test.pl');
          H.assert(Array.isArray(found) && found.length === 1, 'Wyszukiwanie inwestora nie zwróciło wpisu', found);
          const updated = inv.update(created.id, { city:'Pabianice' });
          H.assert(updated && updated.city === 'Pabianice', 'Update inwestora nie zapisał zmian', updated);
          H.assert(inv.getById(created.id).city === 'Pabianice', 'getById nie widzi zmian inwestora', inv.getById(created.id));
        });
      }),
    ]);
  }

  FC.projectDevTests = { runAll };
})(typeof window !== 'undefined' ? window : globalThis);
