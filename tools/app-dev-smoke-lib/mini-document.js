function makeMiniDocument(){
  const voidTags = new Set(['input','br','hr','img','meta','link']);
  function parseStyle(value){
    const style = {};
    String(value || '').split(';').forEach((chunk)=>{
      const idx = chunk.indexOf(':');
      if(idx < 0) return;
      const key = chunk.slice(0, idx).trim();
      const val = chunk.slice(idx + 1).trim();
      if(key) style[key] = val;
    });
    return style;
  }
  function parseAttributes(raw){
    const attrs = {};
    String(raw || '').replace(/([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g, (_m, key, _full, dq, sq, bare)=>{
      attrs[key] = dq !== undefined ? dq : (sq !== undefined ? sq : (bare !== undefined ? bare : ''));
      return '';
    });
    return attrs;
  }
  function matchesSimple(el, selector){
    const sel = String(selector || '').trim();
    if(!sel || !el) return false;
    if(sel.startsWith('#')) return String(el.id || '') === sel.slice(1);
    if(sel.startsWith('.')){
      const needed = sel.slice(1).split('.').filter(Boolean);
      const have = String(el.className || '').split(/\s+/).filter(Boolean);
      return needed.every((name)=> have.includes(name));
    }
    const attrMatch = sel.match(/^([a-zA-Z0-9_-]+)?\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
    if(attrMatch){
      const tag = attrMatch[1];
      const attr = attrMatch[2];
      const val = attrMatch[3];
      if(tag && String(el.tagName || '').toLowerCase() !== tag.toLowerCase()) return false;
      const actual = el.getAttribute(attr);
      return val === undefined ? actual !== null : String(actual) === String(val);
    }
    if(sel.includes('.')){
      const parts = sel.split('.');
      const tag = parts.shift();
      const have = String(el.className || '').split(/\s+/).filter(Boolean);
      return String(el.tagName || '').toLowerCase() === tag.toLowerCase() && parts.every((name)=> have.includes(name));
    }
    return String(el.tagName || '').toLowerCase() === sel.toLowerCase();
  }
  class MiniElement{
    constructor(tagName){
      this.tagName = String(tagName || 'div').toUpperCase();
      this.nodeName = this.tagName;
      this.children = [];
      this.parentNode = null;
      this.style = {};
      this.attributes = {};
      this.dataset = {};
      this.className = '';
      this.id = '';
      this.value = '';
      this.checked = false;
      this._textContent = '';
      this.__listeners = {};
      const self = this;
      this.classList = {
        add(...names){ names.forEach((name)=>{ const cls = String(name || '').trim(); if(!cls) return; const list = new Set(String(self.className || '').split(/\s+/).filter(Boolean)); list.add(cls); self.className = Array.from(list).join(' '); self.attributes.class = self.className; }); },
        remove(...names){ const remove = new Set(names.map((name)=> String(name || '').trim()).filter(Boolean)); const list = String(self.className || '').split(/\s+/).filter(Boolean).filter((name)=> !remove.has(name)); self.className = list.join(' '); self.attributes.class = self.className; },
        contains(name){ return String(self.className || '').split(/\s+/).includes(String(name || '')); },
        toggle(name, force){ const has = this.contains(name); const shouldAdd = force === undefined ? !has : !!force; if(shouldAdd) this.add(name); else this.remove(name); return shouldAdd; }
      };
    }
    get childElementCount(){ return this.children.length; }
    get childNodes(){ return this.children; }
    get textContent(){ return this._textContent + this.children.map((c)=> c.textContent || '').join(''); }
    set textContent(value){ this._textContent = String(value ?? ''); this.children = []; }
    get innerHTML(){ return this._innerHTML || ''; }
    set innerHTML(html){
      this._innerHTML = String(html || '');
      this.children = [];
      this._textContent = '';
      const stack = [this];
      const re = /<\/?[a-zA-Z][^>]*>|[^<]+/g;
      let match;
      while((match = re.exec(this._innerHTML))){
        const token = match[0];
        if(!token) continue;
        if(token.startsWith('</')){ if(stack.length > 1) stack.pop(); continue; }
        if(token.startsWith('<')){
          const tagMatch = token.match(/^<\s*([a-zA-Z0-9_-]+)([^>]*)>/);
          if(!tagMatch) continue;
          const tag = tagMatch[1];
          const attrRaw = tagMatch[2] || '';
          const el = new MiniElement(tag);
          const attrs = parseAttributes(attrRaw);
          Object.keys(attrs).forEach((key)=> el.setAttribute(key, attrs[key]));
          stack[stack.length - 1].appendChild(el);
          if(!token.endsWith('/>') && !voidTags.has(tag.toLowerCase())) stack.push(el);
          continue;
        }
        const text = token.replace(/\s+/g, ' ').trim();
        if(text) stack[stack.length - 1]._textContent += text;
      }
    }
    appendChild(child){ if(!child) return child; child.parentNode = this; this.children.push(child); return child; }
    removeChild(child){ const idx = this.children.indexOf(child); if(idx >= 0){ this.children.splice(idx, 1); child.parentNode = null; } return child; }
    remove(){ if(!this.parentNode) return; const arr = this.parentNode.children; const idx = arr.indexOf(this); if(idx >= 0) arr.splice(idx, 1); this.parentNode = null; }
    setAttribute(key, value){
      const k = String(key); const v = String(value ?? '');
      this.attributes[k] = v;
      if(k === 'id') this.id = v;
      if(k === 'class') this.className = v;
      if(k === 'style') this.style = parseStyle(v);
      if(k === 'value') this.value = v;
      if(k === 'checked') this.checked = !!v;
      if(k === 'type') this.type = v;
      if(k.startsWith('data-')){
        const dsKey = k.slice(5).replace(/-([a-z])/g, (_m, c)=> c.toUpperCase());
        this.dataset[dsKey] = v;
      }
    }
    getAttribute(key){ const k = String(key); return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
    addEventListener(type, fn){ this.__listeners[type] = this.__listeners[type] || []; this.__listeners[type].push(fn); }
    removeEventListener(type, fn){ const arr = this.__listeners[type] || []; const idx = arr.indexOf(fn); if(idx >= 0) arr.splice(idx, 1); }
    dispatchEvent(event){ const ev = event || {}; ev.target = ev.target || this; ev.currentTarget = this; ev.preventDefault = ev.preventDefault || function(){}; ev.stopPropagation = ev.stopPropagation || function(){}; (this.__listeners[ev.type] || []).slice().forEach((fn)=> fn(ev)); return true; }
    click(){ return this.dispatchEvent({ type:'click' }); }
    focus(){}
    select(){}
    querySelectorAll(selector){ return querySelectorAllFrom(this, selector); }
    querySelector(selector){ return this.querySelectorAll(selector)[0] || null; }
  }
  function collect(root, out){
    (root.children || []).forEach((child)=>{ out.push(child); collect(child, out); });
  }
  function querySelectorAllFrom(root, selector){
    const parts = String(selector || '').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return [];
    let current = [root];
    parts.forEach((part)=>{
      const next = [];
      current.forEach((base)=>{
        const nodes = [];
        collect(base, nodes);
        nodes.forEach((node)=>{ if(matchesSimple(node, part)) next.push(node); });
      });
      current = next;
    });
    return current;
  }
  const document = {
    documentElement: new MiniElement('html'),
    body: new MiniElement('body'),
    __listeners:{},
    createElement(tag){ return new MiniElement(tag); },
    createElementNS(_ns, tag){ return new MiniElement(tag); },
    getElementById(id){ return this.body.querySelector('#' + id); },
    querySelector(selector){ return this.body.querySelector(selector); },
    querySelectorAll(selector){ return this.body.querySelectorAll(selector); },
    addEventListener(type, fn){ this.__listeners[type] = this.__listeners[type] || []; this.__listeners[type].push(fn); },
    removeEventListener(type, fn){ const arr = this.__listeners[type] || []; const idx = arr.indexOf(fn); if(idx >= 0) arr.splice(idx, 1); },
  };
  const bootstrap = document.createElement('div');
  bootstrap.innerHTML = '<div id="homeView" style="display:block"></div><div id="modeHubView" style="display:none"><div id="modeHubRoot"></div></div><div id="roomsView" style="display:none"></div><div id="appView" style="display:none"></div><div id="investorView" style="display:none"></div><div id="rozrysView" style="display:none"></div><div id="magazynView" style="display:none"></div><div id="investorsListView" style="display:none"><div id="investorsListRoot"></div></div><div id="serviceOrdersListView" style="display:none"><div id="serviceOrdersListRoot"></div></div><div id="topBar" style="display:none"></div><div id="topTabs" style="display:none"><button class="tab-btn" data-tab="wywiad"></button><button class="tab-btn" data-tab="material"></button><button class="tab-btn" data-tab="rysunek"></button><button class="tab-btn" data-tab="czynnosci"></button><button class="tab-btn" data-tab="inwestor"></button><button class="tab-btn" data-tab="wycena"></button><button class="tab-btn" data-tab="rozrys"></button><button class="tab-btn" data-tab="magazyn"></button></div><div id="sessionButtons" style="display:none"><button id="sessionCancel"></button><button id="sessionSave"></button></div><div id="floatingAdd" style="display:none"></div>';
  document.body.appendChild(bootstrap);
  return document;
}

module.exports = { makeMiniDocument };
