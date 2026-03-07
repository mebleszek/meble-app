// js/app/project-bootstrap.js
// Boot-time helpers extracted from app.js.

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};
    const ns = window.FC.projectBootstrap = window.FC.projectBootstrap || {};

    if(typeof ns.normalizeProjectData !== 'function'){
      ns.normalizeProjectData = function(projectData, DEFAULT_PROJECT){
        const FC = window.FC || {};
        const clone = FC.utils && typeof FC.utils.clone === 'function'
          ? FC.utils.clone
          : (obj)=>JSON.parse(JSON.stringify(obj || {}));
        ['kuchnia','szafa','pokoj','lazienka'].forEach(r=>{
          if(!projectData[r]) projectData[r] = clone(DEFAULT_PROJECT[r]);
          if(!Array.isArray(projectData[r].cabinets)) projectData[r].cabinets = [];
          if(!projectData[r].settings) projectData[r].settings = clone(DEFAULT_PROJECT[r].settings);
          if(!Array.isArray(projectData[r].fronts)) projectData[r].fronts = [];
          if(!Array.isArray(projectData[r].sets)) projectData[r].sets = [];

          let n = 1;
          projectData[r].sets.forEach(s=>{
            if(typeof s.number !== 'number') s.number = n;
            n = Math.max(n, s.number + 1);
          });

          const map = new Map(projectData[r].sets.map(s=>[s.id, s.number]));
          projectData[r].cabinets.forEach(c=>{
            if(c.setId && typeof c.setNumber !== 'number'){
              const num = map.get(c.setId);
              if(typeof num === 'number') c.setNumber = num;
            }
            if(typeof c.frontCount !== 'number') c.frontCount = 2;
            if(!c.details) c.details = {};
          });
        });
        return FC.project.save(projectData);
      };
    }
  }catch(_){ }
})();
