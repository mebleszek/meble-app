// js/app/shared/constants.js
// Centralized constants shared across the app.
// Loaded before js/app.js (via <script defer>)

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    window.FC.constants = window.FC.constants || {};

    // Storage keys and defaults
    if(!window.FC.constants.STORAGE_KEYS){
      window.FC.constants.STORAGE_KEYS = {
        materials: 'fc_materials_v1',
        services: 'fc_services_v1',
        sheetMaterials: 'fc_sheet_materials_v1',
        accessories: 'fc_accessories_v1',
        quoteRates: 'fc_quote_rates_v1',
        workshopServices: 'fc_workshop_services_v1',
        serviceOrders: 'fc_service_orders_v1',
        quoteSnapshots: 'fc_quote_snapshots_v1',
        projects: 'fc_projects_v1',
        currentProjectId: 'fc_current_project_id_v1',
        sheets: 'fc_sheets_v1',
        projectData: 'fc_project_v1',
        projectBackup: 'fc_project_backup_v1',
        projectBackupMeta: 'fc_project_backup_meta_v1',
        ui: 'fc_ui_v1',
      };
    }
  }catch(_){ }
})();
