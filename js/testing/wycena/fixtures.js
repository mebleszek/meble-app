(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function clone(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function isLegacyProjectSlotKey(key){
    const k = String(key || '');
    return /^fc_project_inv_.+_v1$/.test(k) && !/^fc_project_inv_.+_backup(?:_meta)?_v1$/.test(k);
  }

  function readLegacyProjectSlots(){
    const out = {};
    try{
      for(let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i);
        if(!isLegacyProjectSlotKey(key)) continue;
        out[key] = localStorage.getItem(key);
      }
    }catch(_){ }
    return out;
  }

  function restoreLegacyProjectSlots(snapshot){
    const saved = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const currentKeys = [];
    try{
      for(let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i);
        if(isLegacyProjectSlotKey(key)) currentKeys.push(key);
      }
    }catch(_){ }
    currentKeys.forEach((key)=>{
      if(!Object.prototype.hasOwnProperty.call(saved, key)){
        try{ localStorage.removeItem(key); }catch(_){ }
      }
    });
    Object.keys(saved).forEach((key)=>{
      try{
        if(saved[key] == null) localStorage.removeItem(key);
        else localStorage.setItem(key, saved[key]);
      }catch(_){ }
    });
  }

  function snapshotLegacyProjectSlots(){
    return readLegacyProjectSlots();
  }

  function withInvestorProjectFixture(options, run){
    const cfg = options && typeof options === 'object' ? options : {};
    const prevLegacyProjectSlots = readLegacyProjectSlots();
    const prevInvestors = FC.investors && typeof FC.investors.readAll === 'function' ? FC.investors.readAll() : [];
    const prevCurrentInvestorId = FC.investors && typeof FC.investors.getCurrentId === 'function' ? FC.investors.getCurrentId() : '';
    const prevProjects = FC.projectStore && typeof FC.projectStore.readAll === 'function' ? FC.projectStore.readAll() : [];
    const prevCurrentProjectId = FC.projectStore && typeof FC.projectStore.getCurrentProjectId === 'function' ? FC.projectStore.getCurrentProjectId() : '';
    const prevSnapshots = FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.readAll === 'function' ? FC.quoteSnapshotStore.readAll() : [];
    const prevDrafts = FC.quoteOfferStore && typeof FC.quoteOfferStore.readAll === 'function' ? FC.quoteOfferStore.readAll() : [];
    const prevOverride = FC.rozrys && FC.rozrys.__projectOverride;
    const prevProjectData = Object.prototype.hasOwnProperty.call(host, 'projectData') ? host.projectData : undefined;
    const prevCutList = FC.cabinetCutlist && FC.cabinetCutlist.getCabinetCutList;
    const investorId = String(cfg.investorId || 'inv_cross');
    const projectId = String(cfg.projectId || 'proj_cross');
    const rooms = Array.isArray(cfg.rooms) ? clone(cfg.rooms) : [
      { id:'room_kuchnia_gora', baseType:'kuchnia', name:'Kuchnia góra', label:'Kuchnia góra', projectStatus:'nowy' },
      { id:'room_salon', baseType:'pokoj', name:'Salon', label:'Salon', projectStatus:'nowy' },
    ];
    const projectData = clone(cfg.projectData || {
      schemaVersion: 2,
      meta: {
        roomDefs: rooms.reduce((acc, room)=>{
          acc[room.id] = { id:room.id, baseType:room.baseType, name:room.name, label:room.label };
          return acc;
        }, {}),
        roomOrder: rooms.map((room)=> room.id),
      },
      room_kuchnia_gora: { cabinets:[{ id:'cab_k' }], fronts:[], sets:[], settings:{} },
      room_salon: { cabinets:[{ id:'cab_s' }], fronts:[], sets:[], settings:{} },
    });
    const rawInvestor = Object.assign({ id:investorId, kind:'person', name:'Jan Test', rooms:clone(rooms), meta:{} }, clone(cfg.investor || {}), { id:investorId, rooms:clone(rooms) });
    const investor = FC.testDataManager && typeof FC.testDataManager.markRecord === 'function'
      ? FC.testDataManager.markRecord('wycena-fixture-investor', rawInvestor)
      : rawInvestor;
    const rawProjectRecord = Object.assign({ id:projectId, investorId, title:'Projekt testowy', status:String(cfg.status || 'nowy'), projectData:clone(projectData), meta:{} }, clone(cfg.projectRecord || {}), { id:projectId, investorId, projectData:clone(projectData) });
    const projectRecord = FC.testDataManager && typeof FC.testDataManager.markRecord === 'function'
      ? FC.testDataManager.markRecord('wycena-fixture-project', rawProjectRecord)
      : rawProjectRecord;
    const cleanup = ()=>{
      if(FC.cabinetCutlist && prevCutList) FC.cabinetCutlist.getCabinetCutList = prevCutList;
      if(FC.rozrys) FC.rozrys.__projectOverride = prevOverride;
      if(prevProjectData === undefined) { try{ delete host.projectData; }catch(_){ host.projectData = undefined; } }
      else host.projectData = prevProjectData;
      FC.quoteOfferStore && FC.quoteOfferStore.writeAll && FC.quoteOfferStore.writeAll(prevDrafts);
      FC.quoteSnapshotStore && FC.quoteSnapshotStore.writeAll && FC.quoteSnapshotStore.writeAll(prevSnapshots);
      FC.projectStore && FC.projectStore.writeAll && FC.projectStore.writeAll(prevProjects);
      FC.projectStore && FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(prevCurrentProjectId);
      FC.investors && FC.investors.writeAll && FC.investors.writeAll(prevInvestors);
      FC.investors && FC.investors.setCurrentId && FC.investors.setCurrentId(prevCurrentInvestorId);
      restoreLegacyProjectSlots(prevLegacyProjectSlots);
    };
    try{
      FC.investors && FC.investors.writeAll && FC.investors.writeAll([investor]);
      FC.investors && FC.investors.setCurrentId && FC.investors.setCurrentId(investorId);
      FC.projectStore && FC.projectStore.writeAll && FC.projectStore.writeAll([projectRecord]);
      FC.projectStore && FC.projectStore.setCurrentProjectId && FC.projectStore.setCurrentProjectId(projectId);
      if(FC.quoteSnapshotStore && typeof FC.quoteSnapshotStore.writeAll === 'function') FC.quoteSnapshotStore.writeAll([]);
      if(FC.quoteOfferStore && typeof FC.quoteOfferStore.writeAll === 'function') FC.quoteOfferStore.writeAll([]);
      host.projectData = clone(projectData);
      if(FC.rozrys) FC.rozrys.__projectOverride = host.projectData;
      if(typeof cfg.cutListFn === 'function' && FC.cabinetCutlist){
        FC.cabinetCutlist.getCabinetCutList = cfg.cutListFn;
      }
      const result = run({ investorId, projectId, rooms:clone(rooms), projectData:host.projectData });
      if(result && typeof result.then === 'function') return result.finally(cleanup);
      cleanup();
      return result;
    } catch(err) {
      cleanup();
      throw err;
    }
  }

  FC.wycenaTestFixtures = Object.assign({}, FC.wycenaTestFixtures || {}, {
    clone,
    snapshotLegacyProjectSlots,
    withInvestorProjectFixture,
  });

  FC.wycenaTestRegistry = Array.isArray(FC.wycenaTestRegistry) ? FC.wycenaTestRegistry : [];
  FC.registerWycenaTests = function registerWycenaTests(provider){
    if(typeof provider !== 'function') throw new Error('Provider testów Wycena musi być funkcją');
    FC.wycenaTestRegistry.push(provider);
    return provider;
  };
})(typeof window !== 'undefined' ? window : globalThis);
