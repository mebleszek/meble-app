// js/app/shared/help-registry.js
// Centralny rejestr helperów pod ikoną ?.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const entries = Object.create(null);

  function text(value){ return String(value == null ? '' : value).trim(); }
  function safeKey(value){
    return text(value)
      .toLowerCase()
      .replace(/ł/g, 'l').replace(/Ł/g, 'l')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || '';
  }
  function titleFromKey(key){
    const last = text(key).split('.').pop() || '';
    const pretty = last.replace(/[_-]+/g, ' ').trim();
    return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : 'Informacja';
  }
  function normalizeEntry(entry, fallbackTitle){
    if(typeof entry === 'string') return { title:text(fallbackTitle) || 'Informacja', message:entry };
    const src = entry && typeof entry === 'object' ? entry : {};
    return {
      title:text(src.title || fallbackTitle) || 'Informacja',
      message:text(src.message),
      scope:text(src.scope),
    };
  }
  function register(key, entry, fallbackTitle){
    const id = safeKey(key);
    if(!id) return '';
    const normalized = normalizeEntry(entry, fallbackTitle);
    entries[id] = Object.assign({}, entries[id] || {}, normalized, { key:id });
    return id;
  }
  function registerMany(map, options){
    const src = map && typeof map === 'object' ? map : {};
    const cfg = options && typeof options === 'object' ? options : {};
    const prefix = text(cfg.prefix);
    Object.keys(src).forEach((rawKey)=>{
      const value = src[rawKey];
      const fullKey = prefix ? (prefix + rawKey) : rawKey;
      const title = cfg.titleFromKey ? cfg.titleFromKey(rawKey, value) : '';
      register(fullKey, value, title);
    });
  }
  function get(key){
    const id = safeKey(key);
    return id ? (entries[id] || null) : null;
  }
  function ensure(key, entry, fallbackTitle){
    const id = safeKey(key);
    if(!id) return '';
    if(!entries[id]) register(id, entry, fallbackTitle);
    return id;
  }
  function autoKey(scope, title, message){
    const parts = [text(scope), safeKey(title) || 'info'];
    if(text(message)) parts.push(String(text(message).length));
    return parts.filter(Boolean).join('.');
  }
  function open(key, fallback){
    const fallbackEntry = normalizeEntry(fallback, fallback && fallback.title);
    const resolved = get(key) || fallbackEntry;
    const title = text(resolved && resolved.title) || text(fallbackEntry.title) || titleFromKey(key);
    const message = text(resolved && resolved.message) || text(fallbackEntry.message);
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({ title, message });
        return true;
      }
      if(FC.panelBox && typeof FC.panelBox.open === 'function'){
        FC.panelBox.open({ title, message, width:'560px', boxClass:'panel-box--rozrys' });
        return true;
      }
    }catch(_){ }
    try{ alert(message || title); }catch(_){ }
    return false;
  }
  function createTrigger(opts){
    const cfg = Object.assign({ type:'button', className:'info-trigger', title:'Informacja', scope:'generic', key:'', message:'' }, opts || {});
    const key = text(cfg.key) || autoKey(cfg.scope, cfg.title, cfg.message);
    const id = ensure(key, { title:cfg.title, message:cfg.message, scope:cfg.scope }, cfg.title);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = text(cfg.className) || 'info-trigger';
    btn.setAttribute('aria-label', cfg.ariaLabel || ('Pokaż informację: ' + text(cfg.title || 'Informacja')));
    if(id) btn.setAttribute('data-help-key', id);
    btn.addEventListener('click', (event)=>{
      try{ if(cfg.stop !== false){ event.preventDefault(); event.stopPropagation(); } }catch(_){ }
      open(id, { title:cfg.title, message:cfg.message });
    });
    return btn;
  }
  function labelWithInfo(label, opts){
    const cfg = Object.assign({ title:label || 'Informacja', scope:'generic', className:'label-help', key:'', message:'' }, opts || {});
    const row = document.createElement('div');
    row.className = text(cfg.className) || 'label-help';
    const textNode = document.createElement('span');
    textNode.className = 'label-help__text';
    textNode.textContent = text(label || '');
    row.appendChild(textNode);
    if(text(cfg.key) || text(cfg.message)) row.appendChild(createTrigger(cfg));
    return row;
  }
  function auditInfoButtons(rootNode){
    const root = rootNode && typeof rootNode.querySelectorAll === 'function' ? rootNode : document;
    const rows = [];
    try{
      Array.from(root.querySelectorAll('.info-trigger')).forEach((node)=>{
        rows.push({
          ariaLabel:text(node.getAttribute('aria-label')),
          key:text(node.getAttribute('data-help-key')),
          ok:!!text(node.getAttribute('data-help-key')),
        });
      });
    }catch(_){ }
    return rows;
  }

  FC.helpRegistry = {
    register,
    registerMany,
    get,
    ensure,
    autoKey,
    open,
    createTrigger,
    labelWithInfo,
    auditInfoButtons,
    safeKey,
    entries,
  };
})();
