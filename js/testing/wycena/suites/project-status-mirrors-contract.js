(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  if(!(FC.testHarness && typeof FC.registerWycenaTests === 'function')) return;

  function makeRooms(statusA, statusB){
    return [
      { id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:statusA || 'nowy' },
      { id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:statusB || 'nowy' },
    ];
  }

  function makeProjectData(statusA, statusB){
    return {
      schemaVersion:2,
      meta:{
        projectStatus:'nowy',
        roomDefs:{
          room_a:{ id:'room_a', baseType:'kuchnia', name:'Kuchnia A', label:'Kuchnia A', projectStatus:statusA || 'nowy' },
          room_b:{ id:'room_b', baseType:'pokoj', name:'Salon B', label:'Salon B', projectStatus:statusB || 'nowy' },
        },
        roomOrder:['room_a','room_b'],
      },
      room_a:{ cabinets:[{ id:'cab_a' }], fronts:[], sets:[], settings:{} },
      room_b:{ cabinets:[{ id:'cab_b' }], fronts:[], sets:[], settings:{} },
    };
  }

  FC.registerWycenaTests(({ FC, H, clone, withInvestorProjectFixture })=> [
    H.makeTest('Wycena ↔ Project status mirrors split', 'Moduł projectStatusMirrors istnieje, a projectStatusSync zachowuje publiczny kontrakt', 'Pilnuje, żeby split zapisu mirrorów statusu nie zgubił funkcji używanych przez synchronizację projektu, inwestora i Wyceny.', ()=> {
      H.assert(FC.projectStatusMirrors && typeof FC.projectStatusMirrors === 'object', 'Brak FC.projectStatusMirrors');
      [
        'saveInvestorRooms',
        'updateProjectRecord',
        'updateLoadedProject',
        'syncStatusMirrors',
        'refreshStatusViews',
      ].forEach((name)=> {
        H.assert(typeof FC.projectStatusMirrors[name] === 'function', `projectStatusMirrors.${name} musi pozostać funkcją`, { name, keys:Object.keys(FC.projectStatusMirrors || {}) });
      });
      H.assert(FC.projectStatusSync.syncStatusMirrors === FC.projectStatusMirrors.syncStatusMirrors, 'projectStatusSync.syncStatusMirrors ma delegować do projectStatusMirrors.syncStatusMirrors');
      H.assert(FC.projectStatusSync._debug && FC.projectStatusSync._debug.saveInvestorRooms === FC.projectStatusMirrors.saveInvestorRooms, 'Debug saveInvestorRooms ma wskazywać wydzielony moduł mirrorów');
      H.assert(FC.projectStatusSync._debug && FC.projectStatusSync._debug.updateLoadedProject === FC.projectStatusMirrors.updateLoadedProject, 'Debug updateLoadedProject ma wskazywać wydzielony moduł mirrorów');
    }),

    H.makeTest('Wycena ↔ Project status mirrors split', 'syncStatusMirrors zapisuje status projektu i roomDefs jak przed splitem', 'Pilnuje, żeby wydzielenie mirrorów nie zmieniło zapisu projectStore ani meta.roomDefs w aktywnym projekcie.', ()=> withInvestorProjectFixture({
      investorId:'inv_status_mirrors_sync',
      projectId:'proj_status_mirrors_sync',
      rooms:makeRooms('nowy', 'nowy'),
      status:'nowy',
      projectData:makeProjectData('nowy', 'nowy'),
    }, ({ projectId })=> {
      const prevProjectApi = FC.project;
      let savedProject = null;
      FC.project = Object.assign({}, FC.project || {}, {
        save(project){
          savedProject = clone(project);
          return savedProject;
        }
      });
      try{
        const projectRecord = FC.projectStore.getById(projectId);
        const loadedProject = makeProjectData('nowy', 'nowy');
        const result = FC.projectStatusMirrors.syncStatusMirrors(projectRecord, loadedProject, 'zaakceptowany', {
          room_a:'zaakceptowany',
          room_b:'wstepna_wycena',
        });
        const storedRecord = FC.projectStore.getById(projectId);
        H.assert(result && result.mirrorStatus === 'zaakceptowany', 'Mirror status ma wrócić jako zaakceptowany', result);
        H.assert(storedRecord && storedRecord.status === 'zaakceptowany', 'projectStore ma dostać status mirror po splicie', storedRecord);
        H.assert(savedProject && savedProject.meta && savedProject.meta.projectStatus === 'zaakceptowany', 'FC.project.save ma dostać meta.projectStatus', savedProject);
        H.assert(savedProject && savedProject.meta && savedProject.meta.roomDefs && savedProject.meta.roomDefs.room_a.projectStatus === 'zaakceptowany', 'room_a ma dostać status z mapy', savedProject);
        H.assert(savedProject && savedProject.meta && savedProject.meta.roomDefs && savedProject.meta.roomDefs.room_b.projectStatus === 'wstepna_wycena', 'room_b ma dostać status z mapy', savedProject);
      }finally{
        FC.project = prevProjectApi;
      }
    })),

    H.makeTest('Wycena ↔ Project status mirrors split', 'applyProjectStatusChange nadal aktualizuje pokoje inwestora przez wydzielone mirrory', 'Pilnuje realnej ścieżki statusu: publiczne API status sync ma nadal zapisywać status pokoju w inwestorze.', ()=> withInvestorProjectFixture({
      investorId:'inv_status_mirrors_apply',
      projectId:'proj_status_mirrors_apply',
      rooms:makeRooms('nowy', 'nowy'),
      status:'nowy',
      projectData:makeProjectData('nowy', 'nowy'),
    }, ({ investorId, projectId })=> {
      const result = FC.projectStatusSync.applyProjectStatusChange({ projectId, investorId, roomIds:['room_a'], status:'pomiar', refreshUi:false });
      const investor = FC.investors.getById(investorId);
      const roomA = investor && Array.isArray(investor.rooms) ? investor.rooms.find((room)=> room && room.id === 'room_a') : null;
      H.assert(result && result.roomStatusMap && result.roomStatusMap.room_a === 'pomiar', 'Wynik applyProjectStatusChange ma zawierać status pokoju A', result);
      H.assert(roomA && roomA.projectStatus === 'pomiar', 'Status pokoju inwestora ma zostać zapisany przez wydzielony mirror', { roomA, investor });
    })),
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
