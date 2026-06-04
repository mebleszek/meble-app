// js/app/shared/help-registry.js
// Centralny rejestr opisów pod ikoną ?. Domeny mogą rejestrować własne wpisy,
// ale odczyt i otwieranie pomocy idą jednym kontraktem.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const entries = {};

  function text(value){ return String(value == null ? '' : value).trim(); }
  function normalizeEntry(key, value){
    if(value && typeof value === 'object'){
      return { title:text(value.title) || text(key) || 'Informacja', message:text(value.message || value.text || value.description) };
    }
    return { title:text(key) || 'Informacja', message:text(value) };
  }
  function put(key, value){
    const clean = text(key);
    if(!clean) return null;
    const entry = normalizeEntry(clean, value);
    entries[clean] = entry;
    return entry;
  }
  function register(namespace, map, opts){
    const ns = text(namespace);
    const options = opts || {};
    const source = map && typeof map === 'object' ? map : {};
    const plain = {};
    Object.keys(source).forEach((key)=>{
      const entry = normalizeEntry(key, source[key]);
      const namespaced = ns ? ns + '.' + key : key;
      put(namespaced, entry);
      if(options.alias !== false) put(key, entry);
      plain[key] = entry.message;
    });
    return plain;
  }
  function lookup(key, opts){
    const options = opts || {};
    const candidates = [];
    const direct = text(key);
    if(direct) candidates.push(direct);
    (Array.isArray(options.fallbackKeys) ? options.fallbackKeys : []).forEach((item)=>{ if(text(item)) candidates.push(text(item)); });
    for(let i = 0; i < candidates.length; i += 1){
      const found = entries[candidates[i]];
      if(found && text(found.message)) return found;
    }
    const fallbackMessage = text(options.fallbackMessage);
    if(fallbackMessage) return { title:text(options.title) || direct || 'Informacja', message:fallbackMessage };
    return null;
  }
  function message(key, fallback){
    const found = lookup(key);
    return found ? found.message : text(fallback);
  }
  function open(keyOrCfg, opts){
    const cfg = keyOrCfg && typeof keyOrCfg === 'object' ? keyOrCfg : lookup(keyOrCfg, opts);
    if(!cfg) return false;
    const title = text((opts && opts.title) || cfg.title) || 'Informacja';
    const msg = text(cfg.message);
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({ title, message:msg });
        return true;
      }
      if(FC.panelBox && typeof FC.panelBox.open === 'function'){
        FC.panelBox.open({ title, message:msg, width:'560px', boxClass:'panel-box--rozrys' });
        return true;
      }
    }catch(_){ }
    return false;
  }
  function all(){
    const out = {};
    Object.keys(entries).forEach((key)=>{ out[key] = Object.assign({}, entries[key]); });
    return out;
  }

  FC.helpRegistry = { register, put, lookup, message, open, all };
})();
