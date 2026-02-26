// js/app/utils.js
// Small helpers (no DOM side-effects). Loaded before js/app.js

(function(){
  'use strict';
  try{
    window.FC = window.FC || {};

    if(!window.FC.utils){
      window.FC.utils = {
        uid(){
          // Prefer cryptographically strong UUIDs when available.
          if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
          // Fallback: time + random (kept for older browsers).
          return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
        },
        clone(x){
          // Prefer structuredClone when available; fallback to JSON for plain data.
          if (typeof structuredClone === 'function') return structuredClone(x);
          return JSON.parse(JSON.stringify(x));
        },
        num(v, fallback){
          const n = Number(v);
          return Number.isFinite(n) ? n : fallback;
        },
        clamp(n, min, max){
          const x = Number(n);
          if(!Number.isFinite(x)) return min;
          return Math.min(max, Math.max(min, x));
        },
        numClamp(v, fallback, min, max){
          const n = Number(v);
          if(!Number.isFinite(n)) return fallback;
          return Math.min(max, Math.max(min, n));
        },
        isPlainObject(v){
          return !!v && typeof v === 'object' && (v.constructor === Object || Object.getPrototypeOf(v) === null);
        }
      };
    }
  }catch(_){ }
})();
