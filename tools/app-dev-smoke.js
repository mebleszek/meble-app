const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = [
  'js/app/shared/utils.js',
  'js/app/shared/constants.js',
  'js/app/shared/storage.js',
  'js/app/shared/schema.js',
  'js/app/project/project-model.js',
  'js/app/project/project-store.js',
  'js/app/project/project-bridge.js',
  'js/app/shared/validate.js',
  'js/app/material/material-common.js',
  'js/app/material/material-registry.js',
  'js/app/catalog/catalog-domain.js',
  'js/app/catalog/catalog-migration.js',
  'js/app/service/service-order-store.js',
  'js/app/catalog/catalog-store.js',
  'js/app/catalog/catalog-selectors.js',
  'js/app/material/price-modal.js',
  'js/app/ui/tabs-router.js',
  'js/app/ui/info-box.js',
  'js/app/ui/app-view.js',
  'js/app/ui/wywiad-room-settings.js',
  'js/app/ui/views.js',
  'js/app/ui/work-mode-hub.js',
  'js/app/service/service-orders.js',
  'js/app/service/cutting/service-cutting-common.js',
  'js/app/service/cutting/service-cutting-rozrys.js',
  'js/app/service/cutting/service-order-detail.js',
  'js/app/investor/investors-store.js',
  'js/app/investor/session.js',
  'js/app/investor/investor-persistence.js',
  'js/app/investor/investor-navigation-guard.js',
  'js/app/investor/investor-pdf.js',
  'js/app/investor/investor-field-render.js',
  'js/app/investor/investor-actions.js',
  'js/app/shared/room-registry-foundation.js',
  'js/app/shared/room-registry-utils.js',
  'js/app/shared/room-registry-definitions.js',
  'js/app/shared/room-scope-resolver.js',
  'js/app/shared/room-registry-impact.js',
  'js/app/shared/room-registry-project-sync.js',
  'js/app/shared/room-registry-core.js',
  'js/app/shared/room-registry-modals-add-edit.js',
  'js/app/shared/room-registry-modals-manage-remove.js',
  'js/app/shared/room-registry-modals.js',
  'js/app/shared/room-registry-render.js',
  'js/app/shared/room-registry.js',
  'js/app/investor/investor-room-actions.js',
  'js/app/investor/investor-editor-state.js',
  'js/app/investor/project-bootstrap.js',
  'js/app/bootstrap/app-state-bootstrap.js',
  'js/app/bootstrap/app-ui-bootstrap.js',
  'js/app/quote/quote-offer-store.js',
  'js/app/quote/quote-snapshot-store.js',
  'js/app/quote/quote-scope-entry.js',
  'js/app/project/project-status-sync.js',
  'js/app/project/project-status-manual-guard.js',
  'js/app/rozrys/rozrys-choice.js',
  'js/app/rozrys/rozrys-prefs.js',
  'js/app/rozrys/rozrys-project-source.js',
  'js/app/rozrys/rozrys-part-helpers.js',
  'js/app/rozrys/rozrys-runtime-utils.js',
  'js/app/rozrys/rozrys-plan-helpers.js',
  'js/app/rozrys/rozrys-engine-bridge.js',
  'js/app/rozrys/rozrys-ui-tools.js',
  'js/app/rozrys/rozrys-ui-bridge.js',
  'js/app/rozrys/rozrys-panel-workspace.js',
  'js/app/rozrys/rozrys-runtime-bundle.js',
  'js/app/rozrys/rozrys-controller-bridges.js',
  'js/app/rozrys/rozrys-render-compose.js',
  'js/app/rozrys/rozrys-run-controller.js',
  'js/app/rozrys/rozrys-output-controller.js',
  'js/app/cabinet/front-hardware-weights.js',
  'js/app/cabinet/front-hardware-fronts.js',
  'js/app/cabinet/front-hardware-hinges.js',
  'js/app/cabinet/front-hardware-aventos-data.js',
  'js/app/cabinet/front-hardware-aventos-calc.js',
  'js/app/cabinet/front-hardware-aventos-selector.js',
  'js/app/cabinet/front-hardware-aventos.js',
  'js/app/cabinet/front-hardware.js',
  'js/app/quote/quote-snapshot.js',
  'js/app/quote/quote-pdf.js',
  'js/app/wycena/wycena-core.js',
  'js/app/wycena/wycena-tab-helpers.js',
  'js/app/wycena/wycena-tab-selection.js',
  'js/app/wycena/wycena-tab-editor.js',
  'js/app/wycena/wycena-tab-scroll.js',
  'js/app/wycena/wycena-tab-history.js',
  'js/app/wycena/wycena-tab-status-bridge.js',
  'js/tabs/wycena.js',
  'js/app/optimizer/cut-optimizer.js',
  'js/app/rozrys/rozrys-engine.js',
  'js/app/rozrys/rozrys-stock.js',
  'js/app/rozrys/rozrys-scope.js',
  'js/app/rozrys/rozrys.js',
  'js/app/rozrys/rozrys-state.js',
  'js/app/cabinet/cabinet-cutlist.js',
  'js/app/cabinet/cabinet-fronts.js',
  'js/app/cabinet/cabinet-modal-validation.js',
  'js/app/cabinet/cabinet-modal-draft.js',
  'js/app/cabinet/cabinet-modal-fields.js',
  'js/app/cabinet/cabinet-modal-finalize.js',
  'js/app/cabinet/cabinet-modal-set-wizard.js',
  'js/app/cabinet/cabinet-modal-standing-corner-standard.js',
  'js/app/cabinet/cabinet-modal-standing-specials.js',
  'js/app/cabinet/cabinet-modal-standing-extras.js',
  'js/app/cabinet/cabinet-modal-standing-front-controls.js',
  'js/app/cabinet/cabinet-modal-standing.js',
  'js/app/cabinet/cabinet-modal-hanging.js',
  'js/app/cabinet/cabinet-modal-module.js',
  'js/app/cabinet/cabinet-choice-launchers.js',
  'js/app/cabinet/cabinet-modal.js',
  'js/app/cabinet/cabinet-actions.js',
  'js/testing/shared/harness.js',
  'js/testing/test-data-manager.js',
  'js/testing/project/tests.js',
  'js/testing/investor/tests.js',
  'js/testing/wycena/fixtures.js',
  'js/testing/wycena/suites/core-offer-basics.js',
  'js/testing/wycena/suites/core-offer-workflow.js',
  'js/testing/wycena/suites/central-status-sync.js',
  'js/testing/wycena/suites/scope-entry.js',
  'js/testing/wycena/suites/investor-integration.js',
  'js/testing/wycena/suites/cross-systems.js',
  'js/testing/wycena/suites/status-anti-regression.js',
  'js/testing/wycena/tests.js',
  'js/testing/material/tests.js',
  'js/testing/cabinet/tests.js',
  'js/testing/service/tests.js',
];

class SmokeStorage{
  constructor(){ this._data = new Map(); }
  get length(){ return this._data.size; }
  key(index){ return Array.from(this._data.keys())[Number(index)] || null; }
  getItem(key){ return this._data.has(String(key)) ? this._data.get(String(key)) : null; }
  setItem(key, value){ this._data.set(String(key), String(value)); }
  removeItem(key){ this._data.delete(String(key)); }
  clear(){ this._data.clear(); }
}

function makeStorage(){ return new SmokeStorage(); }

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

const sandbox = {
  console,
  setTimeout, clearTimeout,
  Date, Math, JSON,
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  Storage: SmokeStorage,
  document: makeMiniDocument(),
  structuredClone: global.structuredClone || ((x)=> JSON.parse(JSON.stringify(x))),
  crypto: require('crypto').webcrypto,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.FC = {};
vm.createContext(sandbox);

FILES.forEach((file)=>{
  const code = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  vm.runInContext(code, sandbox, { filename:file });
});

function mergeReports(reports){
  const out = { label:'APP smoke testy', total:0, passed:0, failed:0, durationMs:0, groups:[] };
  reports.forEach((report)=>{
    if(!report) return;
    out.total += report.total || 0;
    out.passed += report.passed || 0;
    out.failed += report.failed || 0;
    out.durationMs += report.durationMs || 0;
    (report.groups || []).forEach((group)=> out.groups.push(group));
  });
  return out;
}

(async ()=>{
  const smokeDocument = sandbox.document;
  sandbox.document = smokeDocument;
  const projectReport = await sandbox.FC.projectDevTests.runAll();
  sandbox.document = undefined;
  const reports = [
    projectReport,
    await sandbox.FC.investorDevTests.runAll(),
    await sandbox.FC.materialDevTests.runAll(),
    await sandbox.FC.wycenaDevTests.runAll(),
    await sandbox.FC.cabinetDevTests.runAll(),
    await sandbox.FC.serviceDevTests.runAll(),
  ];
  const final = mergeReports(reports);
  const text = sandbox.FC.testHarness.makeClipboardReport(final);
  console.log(text);
  if(final.failed > 0) process.exit(1);
})().catch((error)=>{
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(2);
});
