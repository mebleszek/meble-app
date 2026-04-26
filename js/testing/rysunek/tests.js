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

  function withDrawingGlobals(run){
    const prevProjectData = readGlobal('projectData');
    const prevUiState = readGlobal('uiState');
    const prevStorageKeys = readGlobal('STORAGE_KEYS');
    const prevRenderCabinets = readGlobal('renderCabinets');
    const prevProject = FC.project;
    const prevStorage = FC.storage;
    const savedUiRaw = host.localStorage && host.localStorage.getItem ? host.localStorage.getItem('fc_ui_v1') : null;
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
      return run(projectData);
    } finally {
      deleteGlobal('projectData', prevProjectData);
      deleteGlobal('uiState', prevUiState);
      deleteGlobal('STORAGE_KEYS', prevStorageKeys);
      deleteGlobal('renderCabinets', prevRenderCabinets);
      FC.project = prevProject;
      FC.storage = prevStorage;
      if(host.localStorage && host.localStorage.setItem){
        if(savedUiRaw == null) host.localStorage.removeItem('fc_ui_v1');
        else host.localStorage.setItem('fc_ui_v1', savedUiRaw);
      }
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

      H.makeTest('Rysunek', 'Dług techniczny systemowych dialogów Rysunku jest jawnie wykryty', 'Pilnuje listy do usunięcia przed przebudową Rysunku: alert/confirm/prompt mają nie wracać po cichu do innych miejsc i są świadomym długiem tego modułu.', ()=>{
        const counts = countSystemDialogCalls();
        H.assert(counts.alert >= 1 || counts.confirm >= 1 || counts.prompt >= 1, 'Nie wykryto systemowych dialogów w Rysunku — jeśli zostały usunięte, zaktualizuj ten test i DEV.md', counts);
        H.assert(counts.prompt >= 1, 'Brak wykrytych promptów Rysunku; po ich usunięciu trzeba zmienić test na zakaz prompt()', counts);
      }),
    ]);
  }

  FC.rysunekDevTests = { runAll, countSystemDialogCalls };
})(typeof window !== 'undefined' ? window : globalThis);
