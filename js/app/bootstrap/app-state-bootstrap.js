(function(){
  'use strict';

  try{
    window.FC = window.FC || {};
    const ns = window.FC.appStateBootstrap = window.FC.appStateBootstrap || {};

    if(typeof ns.createInitialState !== 'function'){
      ns.createInitialState = function createInitialState(cfg){
        cfg = cfg || {};
        const FC = cfg.FC || window.FC || {};
        const storageKeys = cfg.storageKeys || (FC.constants && FC.constants.STORAGE_KEYS) || {};
        const storage = FC.storage || {
          getJSON(_key, fallback){ return fallback; },
          setJSON(){},
        };
        const catalogStore = FC.catalogStore || null;
        const validator = FC.validate || null;

        let materials = (catalogStore && typeof catalogStore.getSheetMaterials === 'function')
          ? catalogStore.getSheetMaterials()
          : storage.getJSON(storageKeys.materials, [
              { id: 'm1', materialType: 'laminat', manufacturer: 'Egger', symbol: 'W1100', name: 'Egger W1100 ST9 Biały Alpejski', price: 35, hasGrain: false },
              { id: 'm2', materialType: 'akryl', manufacturer: 'Rehau', symbol: 'A01', name: 'Akryl Biały', price: 180, hasGrain: false },
            ]);

        let services = (catalogStore && typeof catalogStore.getQuoteRates === 'function')
          ? catalogStore.getQuoteRates()
          : storage.getJSON(storageKeys.services, [ { id: 's1', category: 'Montaż', name: 'Montaż Express', price: 120 } ]);

        let projectData = (FC.project && typeof FC.project.load === 'function')
          ? FC.project.load()
          : ((typeof cfg.defaultProject !== 'undefined') ? cfg.defaultProject : null);

        const uiDefaults = ((FC.uiState && typeof FC.uiState.defaults === 'function')
          ? FC.uiState.defaults()
          : { activeTab:'wywiad', roomType:null, showPriceList:null, expanded:{}, matExpandedId:null, searchTerm:'', editingId:null, selectedCabinetId:null }) || {};
        uiDefaults.lastAddedAt = null;
        uiDefaults.lastAddedCabinetId = null;
        uiDefaults.lastAddedCabinetType = null;

        let uiState = ((FC.uiState && typeof FC.uiState.get === 'function')
          ? FC.uiState.get()
          : storage.getJSON(storageKeys.ui, uiDefaults)) || {};

        try{
          if(validator){
            materials = validator.validateMaterials ? validator.validateMaterials(materials) : materials;
            services = validator.validateServices ? validator.validateServices(services) : services;
            projectData = validator.validateProject ? validator.validateProject(projectData) : projectData;
            uiState = validator.validateUIState ? validator.validateUIState(uiState) : uiState;

            if(validator.persistIfPossible){
              validator.persistIfPossible(storageKeys.materials, materials);
              validator.persistIfPossible(storageKeys.services, services);
              validator.persistIfPossible(storageKeys.projectData, projectData);
              validator.persistIfPossible(storageKeys.ui, uiState);
            } else {
              if(catalogStore){
                try{
                  if(typeof catalogStore.setSheetMaterials === 'function') materials = catalogStore.setSheetMaterials(materials);
                }catch(_){ storage.setJSON(storageKeys.materials, materials); }
                try{
                  if(typeof catalogStore.setQuoteRates === 'function') services = catalogStore.setQuoteRates(services);
                }catch(_){ storage.setJSON(storageKeys.services, services); }
              } else {
                storage.setJSON(storageKeys.materials, materials);
                storage.setJSON(storageKeys.services, services);
              }
              storage.setJSON(storageKeys.projectData, projectData);
              storage.setJSON(storageKeys.ui, uiState);
            }
          }
        }catch(_){ }

        return {
          materials,
          services,
          projectData,
          uiDefaults,
          uiState,
        };
      };
    }
  }catch(_){ }
})();
