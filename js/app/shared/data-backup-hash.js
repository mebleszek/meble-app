(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  function stableStringify(value){
    const seen = new WeakSet();
    const normalize = (entry)=>{
      if(entry == null || typeof entry !== 'object') return entry;
      if(seen.has(entry)) return '[Circular]';
      seen.add(entry);
      if(Array.isArray(entry)) return entry.map(normalize);
      const out = {};
      Object.keys(entry).sort().forEach((key)=>{ out[key] = normalize(entry[key]); });
      return out;
    };
    try{ return JSON.stringify(normalize(value)); }catch(_){ return String(value || ''); }
  }

  function hashString(text){
    const value = String(text || '');
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for(let i = 0; i < value.length; i++){
      const ch = value.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const num = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return num.toString(36);
  }

  function hashSnapshot(snapshot){
    const source = snapshot && snapshot.keys ? snapshot.keys : {};
    return hashString(stableStringify(source));
  }

  root.FC.dataBackupHash = { stableStringify, hashString, hashSnapshot };
})();
