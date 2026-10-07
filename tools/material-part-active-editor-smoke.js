#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const OPTIONS = 'fc_material_part_options_v1';
const EDGES = 'fc_edge_v1';
const SESSION = 'fc_edit_session_v1';
const read = (file)=> fs.readFileSync(path.join(ROOT, file), 'utf8');
const clone = (value)=> JSON.parse(JSON.stringify(value));
const part = { name:'Bok A', a:80, b:50, qty:2, material:'laminat' };
const cabinet = { id:'cab', type:'stojąca', bodyPcvMode:'body' };
const defaults = { w1:true, w2:false, h1:false, h2:false };
const sig = 'laminat||Bok A||800x500';

function runtime(initial = {}){
  const metrics = { begins:0, saves:0, closes:0, refreshes:0, messages:[], confirmations:[], confirmResult:false, events:[] };
  let sandbox;
  class MemoryStorage{
    constructor(rows = {}){ this.map = new Map(Object.entries(rows)); this.calls = []; this.fail = ()=> false; }
    get length(){ return this.map.size; }
    key(index){ return [...this.map.keys()][index] ?? null; }
    getItem(key){ return this.map.get(String(key)) ?? null; }
    mutate(method, key, raw){
      const call = { method, key, raw, durable:!!(sandbox && sandbox.FC.session && sandbox.FC.session.durable) };
      this.calls.push(call); metrics.events.push(call);
      if(this.fail(method, key, raw)){
        call.failed = true;
        const error = new Error('Forced write failure: ' + key); error.name = 'QuotaExceededError'; throw error;
      }
      if(method === 'removeItem') this.map.delete(key); else this.map.set(key, String(raw));
    }
    setItem(key, raw){ this.mutate('setItem', String(key), String(raw)); }
    removeItem(key){ this.mutate('removeItem', String(key), null); }
    clear(){ throw new Error('clear forbidden'); }
  }
  const storage = new MemoryStorage(initial);
  const all = (node)=> [node, ...node.children.flatMap(all)];
  function element(tag){
    const node = {
      tag, children:[], attributes:{}, listeners:{}, className:'', textContent:'', style:{}, checked:false, _html:'',
      appendChild(child){ this.children.push(child); return child; },
      setAttribute(key, value){ this.attributes[key] = String(value); if(key === 'class') this.className = String(value); if(key === 'checked') this.checked = true; },
      getAttribute(key){ return this.attributes[key] ?? null; },
      addEventListener(type, handler){ this.listeners[type] = handler; },
      click(){
        if(this.attributes.disabled) return;
        if(this.tag === 'input' && this.attributes.type === 'checkbox'){
          this.checked = !this.checked;
          return this.listeners.change && this.listeners.change({ target:this });
        }
        return this.listeners.click && this.listeners.click({ target:this, preventDefault(){}, stopPropagation(){} });
      },
      set innerHTML(value){
        this._html = String(value); this.children = [];
        // Only controls need DOM behavior here; table summary text is asserted
        // against the HTML emitted by the real table renderer.
        for(const match of this._html.matchAll(/<(button|input)\b([^>]*)(?:>(.*?)<\/button>|\s*\/?>)/gs)){
          const child = element(match[1]); child.textContent = match[3] || '';
          for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) child.setAttribute(attr[1], attr[2]);
          this.appendChild(child);
        }
      },
      querySelector(selector){ return this.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector){
        return all(this).slice(1).filter((child)=>{
          if(selector.startsWith('.')) return child.className.split(/\s+/).includes(selector.slice(1));
          if(selector.startsWith('#')) return child.attributes.id === selector.slice(1);
          const attr = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
          return attr ? Object.hasOwn(child.attributes, attr[1]) && (attr[2] === undefined || child.attributes[attr[1]] === attr[2]) : false;
        });
      },
    };
    node.classList = {
      toggle(name, on){
        const names = new Set(node.className.split(/\s+/).filter(Boolean));
        if(on) names.add(name); else names.delete(name);
        node.className = [...names].join(' ');
      },
      add(name){ this.toggle(name, true); }, remove(name){ this.toggle(name, false); },
    };
    return node;
  }
  let panel = null;
  sandbox = {
    console, Date, Storage:MemoryStorage, localStorage:storage, sessionStorage:new MemoryStorage(),
    document:{ createElement:element, getElementById(){ return null; } },
    uiState:{ matExpandedId:'cab', selectedCabinetId:'cab' },
    FC_BOARD_THICKNESS_CM:1.8, FC_TOP_TRAVERSE_DEPTH_CM:10,
    renderCabinets(){ metrics.saves += 1; },
    FC:{
      utils:{ clone },
      views:{ refreshSessionButtons(){ metrics.refreshes += 1; } },
      infoBox:{ open(cfg){ metrics.messages.push(cfg); } },
      confirmBox:{ async ask(cfg){ metrics.confirmations.push(cfg); return metrics.confirmResult; } },
      panelBox:{
        open(cfg){ panel = cfg; },
        close(){ metrics.closes += 1; metrics.events.push({ method:'close' }); },
      },
      tabsRouter:{ register(){} },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of ['js/app/shared/constants.js', 'js/app/shared/storage.js', 'js/app/investor/session.js',
    'js/app/material/material-part-options.js', 'js/app/material/material-edge-store.js', 'js/tabs/material.js']){
    vm.runInContext(read(file), sandbox, { filename:file });
  }
  const FC = sandbox.FC;
  const originalBegin = FC.session.begin;
  FC.session.begin = ()=> { metrics.begins += 1; metrics.events.push({ method:'begin' }); return originalBegin(); };
  FC.session.commit = ()=> { throw new Error('Modal must not commit global session'); };
  FC.session.cancel = ()=> { throw new Error('Modal must not cancel global session'); };
  let edgeApi;
  const create = ()=> { edgeApi = FC.materialEdgeStore.createEdgeStore(); return edgeApi; };
  const open = (fresh = false)=>{
    if(!edgeApi || fresh) create();
    const edges = edgeApi.getEdges(sig, part, cabinet);
    edgeApi.openPartOptions(part, sig, { edges, onSave(){ metrics.saves += 1; metrics.events.push({ method:'onSave' }); } });
    assert.ok(panel);
  };
  const byClass = (name)=> all(panel.contentNode).find((node)=> node.className.split(/\s+/).includes(name));
  const input = (key)=> byClass('material-part-options__edge--' + { w1:'1a', w2:'1b', h1:'2a', h2:'2b' }[key]).children[0];
  const direction = (name)=>{
    const label = { default:'Domyślny z materiału', horizontal:'Poziom', vertical:'Pion', none:'Bez znaczenia' }[name];
    all(panel.contentNode).find((node)=> node.tag === 'button' && node.children.some((child)=> child.textContent === label)).click();
  };
  const button = (label)=> all(panel.contentNode).find((node)=> node.tag === 'button' && node.textContent === label);
  const footer = ()=> byClass('material-part-options__footer-actions').children.map((node)=> node.textContent);
  const renderTable = ()=>{
    FC.materialTabData = { collectRoomMaterials(_room, opts){
      const api = opts.edgeApi;
      return { cabinets:[cabinet], cabinetRows:[{ cabinet, parts:[part], edgeMeters:api.calcEdgeMetersForParts([part], cabinet) }], edgeApi:api, deps:{} };
    } };
    const list = element('div');
    FC.tabsMaterial.renderMaterialsTab(list, 'room');
    return { list, html:all(list).map((node)=> node._html).join('\n') };
  };
  const editor = ()=> ({ prepare:(edges)=> edgeApi.prepareEdges(sig, edges), apply:(plan)=> edgeApi.applyEdgesPlan(plan) });
  return { FC, storage, metrics, open, direction, input, footer, button, byClass, create, renderTable, editor,
    edge:()=> edgeApi, panel:()=> panel, save:()=> button('Zapisz').click() };
}
const writes = (r)=> r.storage.calls.filter(({ key })=> key === OPTIONS || key === EDGES);
const raws = (r)=> [r.storage.getItem(OPTIONS), r.storage.getItem(EDGES)];
const changeBoth = (r)=> { r.input('h1').click(); r.direction('vertical'); };
function assertDraftRetained(r){
  assert.equal(r.metrics.closes, 0); assert.equal(r.metrics.saves, 0);
  assert.deepEqual(r.footer(), ['Anuluj', 'Zapisz']);
  assert.equal(r.input('h1').checked, true);
  assert.match(r.byClass('material-part-options__surface').className, /is-vertical/);
}
function assertSaved(r, keys){
  assert.equal(r.metrics.begins, 1);
  assert.deepEqual(writes(r).map(({ key })=> key), keys);
  assert.ok(writes(r).every(({ durable })=> durable));
  assert.equal(r.metrics.saves, 1); assert.equal(r.metrics.closes, 1);
  const lastWrite = Math.max(...r.metrics.events.map((event, i)=> keys.includes(event.key) ? i : -1));
  assert.ok(r.metrics.events.findIndex((event)=> event.method === 'onSave') > lastWrite);
  assert.ok(r.metrics.events.findIndex((event)=> event.method === 'close') > lastWrite);
}
const cases = [
  ['01 open performs zero begins and writes', ()=>{
    const r = runtime(); r.open(); assert.deepEqual(r.footer(), ['Wyjdź']);
    assert.equal(r.metrics.begins, 0); assert.deepEqual(writes(r), []);
  }],
  ['02 PCV click updates local draft, preview and footer only', ()=>{
    const r = runtime(); r.open(); r.input('w1').click();
    assert.equal(r.input('w1').checked, false);
    assert.doesNotMatch(r.byClass('material-part-options__surface').className, /has-w1/);
    assert.deepEqual(r.footer(), ['Anuluj', 'Zapisz']);
    assert.equal(r.metrics.begins, 0); assert.deepEqual(writes(r), []);
    assert.deepEqual(clone(r.edge().store), {});
  }],
  ['03 direction click updates local grain only', ()=>{
    const r = runtime(); r.open(); r.direction('vertical');
    assert.match(r.byClass('material-part-options__surface').className, /is-vertical/);
    assert.deepEqual(r.footer(), ['Anuluj', 'Zapisz']);
    assert.equal(r.metrics.begins, 0); assert.deepEqual(writes(r), []);
  }],
  ['04 reverting all local changes returns clean without writes', ()=>{
    const r = runtime(); r.open(); changeBoth(r);
    r.direction('default'); assert.deepEqual(r.footer(), ['Anuluj', 'Zapisz']);
    r.input('h1').click(); assert.deepEqual(r.footer(), ['Wyjdź']);
    assert.equal(r.metrics.begins, 0); assert.deepEqual(writes(r), []);
  }],
  ['05 direction-only save writes only options', ()=>{
    const r = runtime(); r.open(); r.direction('vertical'); assert.equal(r.save(), true);
    assertSaved(r, [OPTIONS]); assert.equal(r.storage.getItem(EDGES), null);
    assert.equal(r.FC.materialPartOptions.getDirection(sig), 'vertical');
  }],
  ['06 edges-only save writes only edges', ()=>{
    const r = runtime(); r.open(); r.input('h1').click(); assert.equal(r.save(), true);
    assertSaved(r, [EDGES]); assert.equal(r.storage.getItem(OPTIONS), null);
    assert.deepEqual(clone(r.edge().store[sig]), { ...defaults, h1:true });
  }],
  ['07 both stores save after a single durable begin', ()=>{
    const r = runtime(); r.open(); changeBoth(r); assert.equal(r.save(), true);
    assertSaved(r, [OPTIONS, EDGES]);
    assert.equal(r.FC.session.snapshot[OPTIONS], null); assert.equal(r.FC.session.snapshot[EDGES], null);
    assert.equal(r.FC.materialPartOptions.getDirection(sig), 'vertical');
    assert.equal(JSON.parse(r.storage.getItem(EDGES))[sig].h1, true);
  }],
  ['08 failed begin preserves both raw values and draft, retry succeeds', ()=>{
    const r = runtime(); r.open(); changeBoth(r);
    r.storage.fail = (_method, key)=> key === SESSION;
    assert.equal(r.save(), false); assertDraftRetained(r);
    assert.deepEqual(raws(r), [null, null]); assert.deepEqual(writes(r), []);
    assert.deepEqual(clone(r.edge().store), {});
    r.storage.fail = ()=> false; assert.equal(r.save(), true);
    assert.equal(r.FC.session.durable, true); assert.equal(r.metrics.closes, 1);
  }],
  ['09 first write failure leaves both stores unchanged', ()=>{
    const r = runtime(); r.open(); changeBoth(r);
    r.storage.fail = (_method, key)=> key === OPTIONS;
    assert.equal(r.save(), false); assertDraftRetained(r);
    assert.deepEqual(raws(r), [null, null]);
    assert.deepEqual(writes(r).map(({ key })=> key), [OPTIONS]);
    assert.deepEqual(clone(r.edge().store), {});
  }],
  ['10 second write failure restores first raw and permits retry', ()=>{
    const before = '{ "other":"none" }';
    const r = runtime({ [OPTIONS]:before }); r.open(); changeBoth(r);
    r.storage.fail = (_method, key)=> key === EDGES;
    assert.equal(r.save(), false); assertDraftRetained(r);
    assert.deepEqual(raws(r), [before, null]); assert.deepEqual(clone(r.edge().store), {});
    assert.equal(r.FC.session.isDirty(), false);
    r.storage.fail = ()=> false; assert.equal(r.save(), true); assert.equal(r.metrics.closes, 1);
  }],
  ['11 compensation restores null using removeItem', ()=>{
    const r = runtime(); r.open(); changeBoth(r);
    r.storage.fail = (_method, key)=> key === EDGES;
    assert.equal(r.save(), false); assertDraftRetained(r);
    assert.equal(r.storage.getItem(OPTIONS), null);
    assert.equal(writes(r).at(-1).method, 'removeItem'); assert.equal(writes(r).at(-1).key, OPTIONS);
  }],
  ['12 compensation preserves whitespace, ordering and legacy records', ()=>{
    const before = '{ "z":"none", ' + JSON.stringify(sig) + ': "default", "a":"horizontal" }';
    const edgeBefore = '{ "other":{"h2":false,"h1":true,"w2":false,"w1":true} }';
    const r = runtime({ [OPTIONS]:before, [EDGES]:edgeBefore }); r.open(); changeBoth(r);
    const ram = JSON.stringify(r.edge().store);
    r.storage.fail = (_method, key)=> key === EDGES;
    assert.equal(r.save(), false); assertDraftRetained(r);
    assert.deepEqual(raws(r), [before, edgeBefore]);
    assert.equal(JSON.stringify(r.edge().store), ram);
  }],
  ['13 options exact baseline survives save and reopen', ()=>{
    for(const before of [null, '{}', '{ ' + JSON.stringify(sig) + ': "default" }']){
      const r = runtime(before === null ? {} : { [OPTIONS]:before });
      r.open(); r.direction('vertical'); assert.equal(r.save(), true);
      r.open(true); r.direction('default'); assert.equal(r.save(), true);
      assert.equal(r.storage.getItem(OPTIONS), before); assert.equal(r.FC.session.isDirty(), false);
    }
  }],
  ['14 edges exact baseline survives save and rerender', ()=>{
    const legacy = '{ ' + JSON.stringify(sig) + ': {"h2":false,"h1":false,"w2":false,"w1":true} }';
    for(const before of [null, '{}', legacy]){
      const r = runtime(before === null ? {} : { [EDGES]:before });
      r.open(); r.input('h1').click(); assert.equal(r.save(), true);
      r.open(true); r.input('h1').click(); assert.equal(r.save(), true);
      assert.equal(r.storage.getItem(EDGES), before); assert.equal(r.FC.session.isDirty(), false);
    }
  }],
  ['15 existing dirty global session keeps its original snapshot', ()=>{
    const r = runtime({ fc_projects_v1:'P1' });
    assert.equal(r.FC.session.begin(), true); const snapshot = r.FC.session.snapshot;
    const persisted = r.storage.getItem(SESSION);
    r.storage.setItem('fc_projects_v1', 'P2');
    r.open(); changeBoth(r); assert.equal(r.save(), true);
    assert.equal(r.FC.session.snapshot, snapshot); assert.equal(r.storage.getItem(SESSION), persisted);
    assert.equal(r.storage.getItem('fc_projects_v1'), 'P2'); assert.equal(r.FC.session.isDirty(), true);
  }],
  ['16 table has no edge checkbox editor or direct setEdges handler', ()=>{
    const r = runtime(); const { html } = r.renderTable();
    assert.doesNotMatch(html, /data-edge=/);
    const source = read('js/tabs/material.js');
    assert.doesNotMatch(source, /data-edge|\.setEdges\(/);
    assert.match(source, /edgeApi\.getEdges\(sig, p, cab\)/);
  }],
  ['17 real table renderer shows ordered PCV and grain summary', ()=>{
    const r = runtime({ [EDGES]:JSON.stringify({ [sig]:{ ...defaults, h1:true } }), [OPTIONS]:JSON.stringify({ [sig]:'vertical' }) });
    let { html } = r.renderTable();
    assert.match(html, /PCV: 1A, 2A</); assert.match(html, /Słój: Pion/);
    r.storage.setItem(EDGES, JSON.stringify({ [sig]:{ w1:false, w2:false, h1:false, h2:false } }));
    html = r.renderTable().html; assert.match(html, /PCV: brak</);
    r.storage.setItem(EDGES, JSON.stringify({ [sig]:{ w1:true, w2:true, h1:true, h2:true } }));
    html = r.renderTable().html; assert.match(html, /PCV: 1A, 1B, 2A, 2B</);
  }],
  ['18 default meters still derive from getEdges', ()=>{
    const r = runtime(); const api = r.create();
    assert.equal(api.calcEdgeMetersForParts([part], cabinet), 1.6);
    assert.equal(r.storage.getItem(EDGES), null); assert.deepEqual(clone(api.store), {});
  }],
  ['19 saved PCV override changes meters through the engine', ()=>{
    const r = runtime(); r.open(); r.input('h1').click(); assert.equal(r.save(), true);
    assert.equal(r.edge().calcEdgeMetersForParts([part], cabinet), 2.6);
  }],
  ['20 reverting override restores default meters', ()=>{
    const r = runtime(); r.open(); r.input('h1').click(); assert.equal(r.save(), true);
    r.open(true); r.input('h1').click(); assert.equal(r.save(), true);
    assert.equal(r.edge().calcEdgeMetersForParts([part], cabinet), 1.6);
    assert.equal(r.storage.getItem(EDGES), null);
  }],
  ['21 body/front PCV split stays correct', ()=>{
    const r = runtime(); r.open(); r.input('h1').click(); assert.equal(r.save(), true);
    for(const mode of ['body','front']){
      const split = r.edge().calcEdgeMetersByPcvModeForParts([part], { ...cabinet, bodyPcvMode:mode });
      assert.equal(split[mode], 2.6); assert.equal(split[mode === 'body' ? 'front' : 'body'], 0); assert.equal(split.total, 2.6);
    }
  }],
  ['22 fresh store and real table agree after save', ()=>{
    const r = runtime(); r.open(); changeBoth(r); assert.equal(r.save(), true);
    const fresh = r.create();
    assert.deepEqual(clone(fresh.getEdges(sig, part, cabinet)), { ...defaults, h1:true });
    assert.equal(fresh.getDirection(sig), 'vertical'); assert.equal(fresh.calcEdgeMetersForParts([part], cabinet), 2.6);
    const { list, html } = r.renderTable(); assert.match(html, /PCV: 1A, 2A</); assert.match(html, /Słój: Pion/);
    list.querySelector('[data-part-options]').click();
    assert.equal(r.input('h1').checked, true); assert.match(r.byClass('material-part-options__surface').className, /is-vertical/);
    assert.deepEqual(r.footer(), ['Wyjdź']);
  }],
  ['23 failed compensation preserves durable session and warns; retry completes', ()=>{
    const r = runtime(); r.open(); changeBoth(r);
    r.storage.fail = (method, key)=> key === EDGES || (key === OPTIONS && method === 'removeItem');
    assert.equal(r.save(), false); assertDraftRetained(r);
    assert.equal(r.FC.session.active, true); assert.equal(r.FC.session.durable, true);
    assert.equal(r.FC.session.snapshot[OPTIONS], null); assert.ok(r.storage.getItem(SESSION));
    assert.equal(r.FC.session.isDirty(), true); assert.deepEqual(clone(r.edge().store), {});
    assert.match(r.metrics.messages.at(-1).message, /częściowo.*globalnego Anuluj/);
    r.storage.fail = ()=> false; assert.equal(r.save(), true);
    assert.equal(r.metrics.closes, 1); assert.equal(r.FC.materialPartOptions.getDirection(sig), 'vertical');
    assert.equal(r.edge().store[sig].h1, true);
  }],
  ['24 planners and coordinated no-op have zero mutations', ()=>{
    const r = runtime(); r.open();
    const options = r.FC.materialPartOptions.prepareDirection(sig, 'vertical');
    const edges = r.edge().prepareEdges(sig, { h1:true });
    assert.equal(options.changed, true); assert.equal(edges.changed, true);
    assert.deepEqual(raws(r), [null, null]); assert.deepEqual(clone(r.edge().store), {});
    const initial = { direction:'default', edges:defaults };
    assert.equal(r.FC.materialPartOptions.saveDraft(sig, initial, clone(initial), r.editor()), true);
    assert.deepEqual(writes(r), []); assert.equal(r.metrics.begins, 0);
    assert.equal(r.FC.materialPartOptions.saveDraft(sig,
      { direction:'vertical', edges:{ ...defaults, h1:true } }, initial, r.editor()), true);
    assert.deepEqual(writes(r), []); assert.equal(r.metrics.begins, 0);
  }],
  ['25 local discard and close confirmation never cancel global session', async ()=>{
    const r = runtime(); r.open(); changeBoth(r);
    await r.button('Anuluj').click(); assertDraftRetained(r);
    assert.equal(await r.panel().beforeClose(), false);
    assert.equal(r.metrics.confirmations.at(-1).message, 'Niezapisane zmiany w opcjach formatki zostaną utracone.');
    r.metrics.confirmResult = true; await r.button('Anuluj').click();
    assert.equal(r.metrics.closes, 1); assert.deepEqual(writes(r), []); assert.equal(r.metrics.begins, 0);
    r.open(true); r.button('Wyjdź').click(); assert.equal(r.metrics.closes, 2);
  }],
  ['26 first store removal is compensated with its exact pre-save string', ()=>{
    const r = runtime(); r.open(); r.direction('vertical'); assert.equal(r.save(), true);
    r.metrics.saves = 0; r.metrics.closes = 0;
    const before = r.storage.getItem(OPTIONS);
    r.open(true); r.direction('default'); r.input('h1').click();
    r.storage.fail = (_method, key)=> key === EDGES;
    assert.equal(r.save(), false); assert.equal(r.storage.getItem(OPTIONS), before);
    assert.equal(r.storage.getItem(EDGES), null); assert.equal(r.metrics.closes, 0);
    assert.equal(writes(r).at(-1).method, 'setItem');
  }],
];
(async ()=>{
  let passed = 0;
  for(const [name, test] of cases){
    try{ await test(); passed += 1; console.log('PASS ' + name); }
    catch(error){ console.error('FAIL ' + name); console.error(error); process.exitCode = 1; }
  }
  console.log(`Material part active editor: ${passed}/${cases.length} PASS`);
})();
