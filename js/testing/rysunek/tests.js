(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;
  const H = FC.testHarness;
  if(!H) throw new Error('Brak FC.testHarness');

  function readGlobal(name){
    try{ return host[name]; }catch(_){ return undefined; }
  }

  function writeGlobal(name, value){
    try{ host[name] = value; }catch(_){ }
    try{ if(host.window) host.window[name] = value; }catch(_){ }
  }

  function deleteGlobal(name, previous){
    if(previous === undefined){
      try{ delete host[name]; }catch(_){ host[name] = undefined; }
      try{ if(host.window) delete host.window[name]; }catch(_){ if(host.window) host.window[name] = undefined; }
      return;
    }
    writeGlobal(name, previous);
  }

  function syncDrawingGlobalBindings(){
    try{
      const g = host.window || host;
      g.__rysunekTestProjectData = host.projectData;
      g.__rysunekTestUiState = host.uiState;
      g.__rysunekTestStorageKeys = host.STORAGE_KEYS;
      Function('projectData = window.__rysunekTestProjectData; uiState = window.__rysunekTestUiState; STORAGE_KEYS = window.__rysunekTestStorageKeys;')();
    }catch(_){ }
  }

  function withDrawingGlobals(run){
    const prevProjectData = readGlobal('projectData');
    const prevUiState = readGlobal('uiState');
    const prevStorageKeys = readGlobal('STORAGE_KEYS');
    const prevRenderCabinets = readGlobal('renderCabinets');
    const prevSaveProject = readGlobal('saveProject');
    const prevProject = FC.project;
    const prevStorage = FC.storage;
    const prevLayoutStateSave = FC.layoutState && FC.layoutState.saveProject;
    const savedUiRaw = host.localStorage && host.localStorage.getItem ? host.localStorage.getItem('fc_ui_v1') : null;

    function cleanup(){
      deleteGlobal('projectData', prevProjectData);
      deleteGlobal('uiState', prevUiState);
      deleteGlobal('STORAGE_KEYS', prevStorageKeys);
      deleteGlobal('renderCabinets', prevRenderCabinets);
      deleteGlobal('saveProject', prevSaveProject);
      syncDrawingGlobalBindings();
      if(FC.layoutState) FC.layoutState.saveProject = prevLayoutStateSave;
      FC.project = prevProject;
      FC.storage = prevStorage;
      if(host.localStorage && host.localStorage.setItem){
        if(savedUiRaw == null) host.localStorage.removeItem('fc_ui_v1');
        else host.localStorage.setItem('fc_ui_v1', savedUiRaw);
      }
    }

    try{
      FC.project = FC.project || {};
      FC.project.save = (project)=> project;
      FC.storage = FC.storage || {};
      if(typeof FC.storage.setJSON !== 'function'){
        FC.storage.setJSON = (key, value)=>{
          if(host.localStorage && host.localStorage.setItem) host.localStorage.setItem(key, JSON.stringify(value));
        };
      }
      const projectData = {
        kuchnia:{
          cabinets:[
            { id:'rys_base_1', type:'stojąca', width:60, height:72, depth:56, name:'Dolna 60' },
            { id:'rys_wall_1', type:'wisząca', width:50, height:70, depth:32, name:'Górna 50' }
          ],
          fronts:[],
          sets:[],
          settings:{ roomHeight:260, bottomHeight:90, legHeight:10, counterThickness:4, gapHeight:55, ceilingBlende:5 }
        }
      };
      writeGlobal('projectData', projectData);
      writeGlobal('uiState', { drawing:{ zoom:6 } });
      writeGlobal('STORAGE_KEYS', (FC.constants && FC.constants.STORAGE_KEYS) || { ui:'fc_ui_v1' });
      writeGlobal('renderCabinets', function(){});
      writeGlobal('saveProject', function(){ return projectData; });
      FC.layoutState = FC.layoutState || {};
      FC.layoutState.saveProject = function(){ return projectData; };
      syncDrawingGlobalBindings();
      const out = run(projectData);
      if(out && typeof out.then === 'function'){
        return out.then((value)=>{ cleanup(); return value; }, (error)=>{ cleanup(); throw error; });
      }
      cleanup();
      return out;
    }catch(error){
      cleanup();
      throw error;
    }
  }

  function countSystemDialogCalls(){
    const fn = FC.tabsRysunek && FC.tabsRysunek.renderDrawingTab;
    const src = typeof fn === 'function' ? Function.prototype.toString.call(fn) : '';
    return {
      alert:(src.match(/\balert\s*\(/g) || []).length,
      confirm:(src.match(/\bconfirm\s*\(/g) || []).length,
      prompt:(src.match(/\bprompt\s*\(/g) || []).length,
    };
  }

  function runAll(){
    return H.runSuite('RYSUNEK smoke testy', [
      H.makeTest('Rysunek', 'Rysunek ma publiczny renderer i rejestruje zakładkę', 'Pilnuje, czy ciężki plik Rysunku jest w ogóle ładowany w testach i czy nie zniknął kontrakt renderowania zakładki.', ()=>{
        H.assert(FC.tabsRysunek && typeof FC.tabsRysunek.renderDrawingTab === 'function', 'Brak FC.tabsRysunek.renderDrawingTab');
        H.assert(FC.tabsRouter && typeof FC.tabsRouter.get === 'function', 'Brak FC.tabsRouter.get');
        const route = FC.tabsRouter.get('rysunek');
        H.assert(route && typeof route.render === 'function', 'Zakładka rysunek nie jest zarejestrowana w tabsRouter', route);
      }),

      H.makeTest('Rysunek', 'Rysunek renderuje podstawowy stage i inspektor dla pokoju', 'Daje minimalną ochronę przed białym ekranem Rysunku: renderer ma zbudować toolbar, stage SVG, inspektor i listę wykończeń dla prostego projektu.', ()=>{
        H.assert(host.document && typeof host.document.createElement === 'function', 'Brak dokumentu testowego dla Rysunku');
        H.assert(host.document && typeof host.document.createElementNS === 'function', 'Dokument testowy nie obsługuje SVG/createElementNS');
        withDrawingGlobals(()=>{
          const list = host.document.createElement('div');
          FC.tabsRysunek.renderDrawingTab(list, 'kuchnia');
          H.assert(list.querySelector('.drawing-wrap'), 'Brak głównego wrappera Rysunku', list.innerHTML);
          H.assert(list.querySelector('.drawing-toolbar'), 'Brak toolbara Rysunku', list.innerHTML);
          H.assert(list.querySelector('#svgHost') && list.querySelector('#svgHost svg'), 'Brak hosta SVG/stage Rysunku', list.innerHTML);
          H.assert(list.querySelector('#insBody'), 'Brak inspektora Rysunku', list.innerHTML);
          H.assert(list.querySelector('#finList'), 'Brak listy wykończeń Rysunku', list.innerHTML);
        });
      }),

      H.makeTest('Rysunek', 'Rysunek używa własnego adaptera dialogów aplikacji', 'Pilnuje etapu usuwania systemowych okienek: RYSUNEK ma korzystać z małego adaptera do confirmBox/infoBox/panelBox zamiast z alert/confirm/prompt.', ()=>{
        H.assert(FC.rysunekDialogs && typeof FC.rysunekDialogs.info === 'function', 'Brak FC.rysunekDialogs.info');
        H.assert(typeof FC.rysunekDialogs.askConfirm === 'function', 'Brak FC.rysunekDialogs.askConfirm');
        H.assert(typeof FC.rysunekDialogs.askNumber === 'function', 'Brak FC.rysunekDialogs.askNumber');
        H.assert(typeof FC.rysunekDialogs.confirmRebuildLayout === 'function', 'Brak FC.rysunekDialogs.confirmRebuildLayout');
        H.assert(typeof FC.rysunekDialogs.confirmDeleteGap === 'function', 'Brak FC.rysunekDialogs.confirmDeleteGap');
      }),

      H.makeTest('Rysunek', 'Odbuduj z listy szafek działa po własnym confirmBox', 'Pilnuje regresji z paczki dialogów: klik w odbudowę nie może kończyć się cichym anulowaniem, gdy adapter potwierdzenia dostanie synchroniczne true albo Promise true.', async ()=>{
        H.assert(host.document && typeof host.document.createElement === 'function', 'Brak dokumentu testowego dla Rysunku');
        const prevConfirmBox = FC.confirmBox;
        const prevRenderCabinets = readGlobal('renderCabinets');
        try{
          await withDrawingGlobals(async (projectData)=>{
            let renderCalls = 0;
            writeGlobal('renderCabinets', function(){ renderCalls += 1; });
            FC.confirmBox = { ask:()=> true };
            const list = host.document.createElement('div');
            FC.tabsRysunek.renderDrawingTab(list, 'kuchnia');
            const seg = projectData.kuchnia.layout.segments[0];
            seg.rows.base.push({ kind:'gap', id:'gap_test', width:12, label:'PRZERWA' });
            const btn = list.querySelector('#drawRebuild');
            H.assert(btn && typeof btn.onclick === 'function', 'Brak działającego przycisku odbudowy');
            const out = btn.onclick();
            if(out && typeof out.then === 'function') await out;
            H.assert(renderCalls === 1, 'Odbudowa nie odświeżyła renderCabinets po synchronicznym confirmBox.ask', { renderCalls });
            H.assert(seg.rows.base.length === 1 && seg.rows.base[0].id === 'rys_base_1', 'Odbudowa nie odtworzyła dolnych szafek albo nie usunęła przerwy', seg.rows.base);
            H.assert(seg.rows.wall.length === 1 && seg.rows.wall[0].id === 'rys_wall_1', 'Odbudowa nie odtworzyła górnych szafek', seg.rows.wall);
          });

          await withDrawingGlobals(async (projectData)=>{
            let renderCalls = 0;
            writeGlobal('renderCabinets', function(){ renderCalls += 1; });
            FC.confirmBox = { ask:()=> Promise.resolve(true) };
            const list = host.document.createElement('div');
            FC.tabsRysunek.renderDrawingTab(list, 'kuchnia');
            const seg = projectData.kuchnia.layout.segments[0];
            seg.rows.base.push({ kind:'gap', id:'gap_test_2', width:12, label:'PRZERWA' });
            const out = list.querySelector('#drawRebuild').onclick();
            if(out && typeof out.then === 'function') await out;
            H.assert(renderCalls === 1, 'Odbudowa nie odświeżyła renderCabinets po asynchronicznym confirmBox.ask', { renderCalls });
            H.assert(seg.rows.base.length === 1 && seg.rows.base[0].id === 'rys_base_1', 'Odbudowa nie działa z Promise true', seg.rows.base);
          });
        } finally {
          FC.confirmBox = prevConfirmBox;
          writeGlobal('renderCabinets', prevRenderCabinets);
        }
      }),

      H.makeTest('Rysunek', 'Rysunek nie zawiera systemowych alert/confirm/prompt', 'Pilnuje, żeby po usunięciu długu technicznego stare systemowe okienka nie wróciły do monolitu RYSUNKU podczas kolejnych zmian.', ()=>{
        const counts = countSystemDialogCalls();
        H.assert(counts.alert === 0, 'RYSUNEK nie może używać alert()', counts);
        H.assert(counts.confirm === 0, 'RYSUNEK nie może używać confirm()', counts);
        H.assert(counts.prompt === 0, 'RYSUNEK nie może używać prompt()', counts);
      }),
    ]);
  }

  FC.rysunekDevTests = { runAll, countSystemDialogCalls };
})(typeof window !== 'undefined' ? window : globalThis);
