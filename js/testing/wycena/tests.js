(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  const FX = FC.wycenaTestFixtures;
  if(!FX || typeof FX.clone !== 'function' || typeof FX.withInvestorProjectFixture !== 'function') throw new Error('Brak FC.wycenaTestFixtures');
  const clone = FX.clone;
  const withInvestorProjectFixture = FX.withInvestorProjectFixture;

  function cloneListFrom(api){
    try{ return api && typeof api.readAll === 'function' ? clone(api.readAll()) : null; }catch(_){ return null; }
  }

  function restoreListTo(api, rows){
    try{ if(rows !== null && api && typeof api.writeAll === 'function') api.writeAll(clone(rows)); }catch(_){ }
  }

  function shallowFns(api){
    const out = {};
    try{
      if(api && typeof api === 'object') Object.keys(api).forEach((key)=> { if(typeof api[key] === 'function') out[key] = api[key]; });
    }catch(_){ }
    return out;
  }

  function restoreFns(api, fns){
    try{
      if(api && fns && typeof fns === 'object') Object.keys(fns).forEach((key)=> { api[key] = fns[key]; });
    }catch(_){ }
  }

  function makeIsolationSnapshot(){
    return {
      investors: cloneListFrom(FC.investors),
      currentInvestorId: FC.investors && typeof FC.investors.getCurrentId === 'function' ? FC.investors.getCurrentId() : null,
      projects: cloneListFrom(FC.projectStore),
      currentProjectId: FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? FC.projectStore.getCurrentProjectId() : null,
      snapshots: cloneListFrom(FC.quoteSnapshotStore),
      drafts: cloneListFrom(FC.quoteOfferStore),
      hasProjectData: Object.prototype.hasOwnProperty.call(host, 'projectData'),
      projectData: Object.prototype.hasOwnProperty.call(host, 'projectData') ? clone(host.projectData) : undefined,
      rozrysProjectOverride: FC.rozrys ? FC.rozrys.__projectOverride : undefined,
      projectStatusSyncFns: shallowFns(FC.projectStatusSync),
      investorPersistenceFns: shallowFns(FC.investorPersistence),
      roomRegistryFns: shallowFns(FC.roomRegistry),
      wycenaCoreFns: shallowFns(FC.wycenaCore),
      quoteScopeEntryFns: shallowFns(FC.quoteScopeEntry),
      infoBoxFns: shallowFns(FC.infoBox),
      confirmBoxFns: shallowFns(FC.confirmBox),
    };
  }

  function restoreIsolationSnapshot(snapshot){
    if(!snapshot) return;
    restoreFns(FC.projectStatusSync, snapshot.projectStatusSyncFns);
    restoreFns(FC.investorPersistence, snapshot.investorPersistenceFns);
    restoreFns(FC.roomRegistry, snapshot.roomRegistryFns);
    restoreFns(FC.wycenaCore, snapshot.wycenaCoreFns);
    restoreFns(FC.quoteScopeEntry, snapshot.quoteScopeEntryFns);
    restoreFns(FC.infoBox, snapshot.infoBoxFns);
    restoreFns(FC.confirmBox, snapshot.confirmBoxFns);
    restoreListTo(FC.quoteOfferStore, snapshot.drafts);
    restoreListTo(FC.quoteSnapshotStore, snapshot.snapshots);
    restoreListTo(FC.projectStore, snapshot.projects);
    try{ if(FC.projectStore && typeof FC.projectStore.setCurrentProjectId === 'function') FC.projectStore.setCurrentProjectId(snapshot.currentProjectId || ''); }catch(_){ }
    restoreListTo(FC.investors, snapshot.investors);
    try{ if(FC.investors && typeof FC.investors.setCurrentId === 'function') FC.investors.setCurrentId(snapshot.currentInvestorId || ''); }catch(_){ }
    try{ if(FC.rozrys) FC.rozrys.__projectOverride = snapshot.rozrysProjectOverride; }catch(_){ }
    try{
      if(snapshot.hasProjectData) host.projectData = clone(snapshot.projectData);
      else delete host.projectData;
    }catch(_){ host.projectData = snapshot.hasProjectData ? clone(snapshot.projectData) : undefined; }
  }

  function wrapIsolated(test){
    if(!test || typeof test.fn !== 'function') return test;
    const original = test.fn;
    return Object.assign({}, test, {
      fn(){
        const snapshot = makeIsolationSnapshot();
        let out;
        try{ out = original(); }
        catch(error){ restoreIsolationSnapshot(snapshot); throw error; }
        if(out && typeof out.then === 'function'){
          return out.then((value)=> { restoreIsolationSnapshot(snapshot); return value; }, (error)=> { restoreIsolationSnapshot(snapshot); throw error; });
        }
        restoreIsolationSnapshot(snapshot);
        return out;
      }
    });
  }

  function collectRegisteredTests(){
    const providers = Array.isArray(FC.wycenaTestRegistry) ? FC.wycenaTestRegistry.slice() : [];
    return providers.flatMap((provider)=> {
      const rows = provider({ FC, H, clone, withInvestorProjectFixture });
      return Array.isArray(rows) ? rows.map(wrapIsolated) : [];
    });
  }

  function isNodeStableSmokeTest(test){
    const group = String(test && test.group || '');
    return group === 'Wycena ↔ Kontrakt architektury' || group === 'Wycena ↔ Core selection split' || group === 'Wycena ↔ Snapshot scope split' || group === 'Wycena ↔ Snapshot selection split' || group === 'Wycena ↔ Project status scope split' || group === 'Wycena ↔ Project status mirrors split';
  }

  function runAll(){
    return H.runSuite('WYCENA smoke testy', collectRegisteredTests());
  }

  function runNodeSmoke(){
    return H.runSuite('WYCENA node smoke testy', collectRegisteredTests().filter(isNodeStableSmokeTest));
  }

  FC.wycenaDevTests = { runAll, runNodeSmoke };
})(typeof window !== 'undefined' ? window : globalThis);
