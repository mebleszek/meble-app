// js/app/constants.js
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
        sheets: 'fc_sheets_v1',
        projectData: 'fc_project_v1',
        projectBackup: 'fc_project_backup_v1',
        projectBackupMeta: 'fc_project_backup_meta_v1',
        ui: 'fc_ui_v1',
      };
    }
  }catch(_){ }
})();
