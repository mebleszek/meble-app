// js/app/investor/project-bootstrap.js
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
        const pd = (typeof projectData === 'undefined' || projectData === null)
          ? (typeof window.projectData !== 'undefined' ? window.projectData : null)
          : projectData;
        const defs = (typeof DEFAULT_PROJECT === 'undefined' || DEFAULT_PROJECT === null)
          ? ((FC.project && FC.project.DEFAULT_PROJECT) || (typeof window.DEFAULT_PROJECT !== 'undefined' ? window.DEFAULT_PROJECT : null))
          : DEFAULT_PROJECT;
        if(!pd || !defs) return projectData;
        ['kuchnia','szafa','pokoj','lazienka'].forEach(r=>{
          if(!pd[r]) pd[r] = clone(defs[r]);
          if(!Array.isArray(pd[r].cabinets)) pd[r].cabinets = [];
          if(!pd[r].settings) pd[r].settings = clone(defs[r].settings);
          if(!Array.isArray(pd[r].fronts)) pd[r].fronts = [];
          if(!Array.isArray(pd[r].sets)) pd[r].sets = [];

          let n = 1;
          pd[r].sets.forEach(s=>{
            if(typeof s.number !== 'number') s.number = n;
            n = Math.max(n, s.number + 1);
          });

          const map = new Map(pd[r].sets.map(s=>[s.id, s.number]));
          pd[r].cabinets.forEach(c=>{
            if(c.setId && typeof c.setNumber !== 'number'){
              const num = map.get(c.setId);
              if(typeof num === 'number') c.setNumber = num;
            }
            if(typeof c.frontCount !== 'number') c.frontCount = 2;
            if(!c.details) c.details = {};
          });
        });
        const out = FC.project && typeof FC.project.save === 'function' ? FC.project.save(pd) : pd;
        try{ if(typeof window.projectData !== 'undefined' && (window.projectData === projectData || typeof projectData === 'undefined')) window.projectData = out; }catch(_){}
        return out;
      };
    }
  }catch(_){ }
})();
