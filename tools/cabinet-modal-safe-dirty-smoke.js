#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const clone = (value)=> JSON.parse(JSON.stringify(value));

// Small DOM adapter for the real modal, form helpers, and bubbling input/change events.
function makeDocument(){
  const ids = new Map();
  class Node{
    constructor(tag){
      this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
      this.style = {}; this.className = ''; this.attributes = {}; this.listeners = {};
      this._value = ''; this.disabled = false; this.checked = false; this.textContent = '';
      this.classList = {
        add:(...names)=> names.forEach((name)=> this.classList.toggle(name, true)),
        remove:(...names)=> names.forEach((name)=> this.classList.toggle(name, false)),
        toggle:(name, on)=>{
          const classes = new Set(this.className.split(/\s+/).filter(Boolean));
          if(on) classes.add(name); else classes.delete(name);
          this.className = Array.from(classes).join(' ');
        },
      };
    }
    setAttribute(key, value){
      this.attributes[key] = String(value);
      if(key === 'id'){ this.id = String(value); ids.set(this.id, this); }
      if(key === 'class') this.className = String(value);
      if(key === 'value') this.value = value;
      if(key === 'style' && /display\s*:\s*none/.test(value)) this.style.display = 'none';
    }
    getAttribute(key){ return this.attributes[key] ?? null; }
    removeAttribute(key){ delete this.attributes[key]; }
    get value(){ return this._value; }
    set value(value){ this._value = String(value ?? ''); }
    get options(){ return this.children.filter((node)=> node.tagName === 'OPTION'); }
    get offsetParent(){ return this.style.display === 'none' ? null : this.parentNode; }
    appendChild(child){
      if(child.parentNode) child.parentNode.children = child.parentNode.children.filter((node)=> node !== child);
      child.parentNode = this; this.children.push(child);
      if(this.tagName === 'SELECT' && (child.selected || this.options.length === 1)) this.value = child.value;
      return child;
    }
    set innerHTML(html){
      const removeIds = (node)=> { if(node.id) ids.delete(node.id); node.children.forEach(removeIds); };
      this.children.forEach(removeIds); this.children = []; this._html = String(html);
      for(const match of this._html.matchAll(/<(input|select|option)\b([^>]*)>/g)){
        const child = new Node(match[1]);
        for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) child.setAttribute(attr[1], attr[2]);
        this.appendChild(child);
      }
    }
    get innerHTML(){ return this._html || ''; }
    querySelector(selector){
      for(const child of this.children){
        if(selector.startsWith('#') ? child.id === selector.slice(1) : child.tagName.toLowerCase() === selector) return child;
        const nested = child.querySelector(selector); if(nested) return nested;
      }
      return null;
    }
    closest(selector){ return selector === 'div' ? this.parentNode : null; }
    addEventListener(type, handler){ (this.listeners[type] ||= []).push(handler); }
    blur(){}
    async emit(type){
      const event = { target:this, prevented:false, stopped:false,
        preventDefault(){ this.prevented = true; }, stopPropagation(){ this.stopped = true; } };
      const route = []; for(let node = this; node; node = node.parentNode) route.push(node);
      for(const node of route){
        if(typeof node['on' + type] === 'function') await node['on' + type](event);
        for(const listener of node.listeners[type] || []) await listener(event);
        if(event.stopped) break;
      }
      return event;
    }
  }
  const document = { createElement:(tag)=> new Node(tag), getElementById:(id)=> ids.get(id) || null,
    querySelector(){ return null; }, documentElement:new Node('html'), body:new Node('body') };
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const modalHtml = html.slice(html.indexOf('id="cabinetModal"'));
  const modal = new Node('div'); modal.setAttribute('id', 'cabinetModal'); modal.style.display = 'none';
  for(const match of modalHtml.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
    const node = new Node(match[1]);
    for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(attr[1], attr[2]);
    modal.appendChild(node);
  }
  const shelves = ids.get('cmShelves'), shelvesWrap = ids.get('cmShelvesWrap');
  if(shelves && shelvesWrap) shelvesWrap.appendChild(shelves);
  return document;
}

function runtime(){
  const document = makeDocument();
  const metrics = { ready:true, begins:0, saves:0, uiWrites:0, renders:0, frontGenerations:0, confirms:[], discard:false, messages:[], sequence:[] };
  const cabinet = { id:'cabinet', type:'stojąca', subType:'standardowa', width:60, height:82, depth:51,
    bodyColor:'Test', frontMaterial:'laminat', frontColor:'Test', backMaterial:'HDF 3mm biała',
    openingSystem:'uchwyt klienta', bodyPcvMode:'body', frontCount:2, details:{ shelves:1 } };
  const sandbox = {
    console, document, Date, requestAnimationFrame(){}, setTimeout(){},
    localStorage:{ getItem(){ return null; }, setItem(){ throw new Error('Local draft must not write storage'); }, clear(){ throw new Error('clear forbidden'); } },
    uiState:{ roomType:'kuchnia', activeTab:'wywiad', selectedCabinetId:'cabinet' },
    projectData:{ kuchnia:{ cabinets:[cabinet], fronts:[{ id:'front', cabId:'cabinet', width:30 }], sets:[], settings:{ bottomHeight:82, roomHeight:240, legHeight:10 } } },
    cabinetModalState:{}, materials:[{ name:'Test', materialType:'laminat' }, { name:'Other', materialType:'laminat' }],
    STORAGE_KEYS:{ ui:'fc_ui_v1' },
    renderCabinets(){ metrics.renders += 1; },
    FC:{
      utils:{ clone, uid(){ return 'new-' + metrics.frontGenerations; } },
      session:{ begin(){ metrics.begins += 1; metrics.sequence.push({ action:'begin', project:JSON.stringify(sandbox.projectData) }); return metrics.ready; },
        cancel(){ throw new Error('Local Cancel must not call global session.cancel'); } },
      project:{ save(data){ metrics.saves += 1; metrics.sequence.push({ action:'save' }); return data; } },
      storage:{ setJSON(){ metrics.uiWrites += 1; } },
      infoBox:{ open(payload){ metrics.messages.push(payload); } },
      confirmBox:{ async ask(payload){ metrics.confirms.push(payload); return metrics.discard; } },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of [
    'js/app/cabinet/cabinet-drawer-requirements.js', 'js/app/cabinet/cabinet-fronts.js',
    'js/app/cabinet/cabinet-modal-validation.js', 'js/app/cabinet/cabinet-modal-fields.js',
    'js/app/cabinet/cabinet-modal-standing-corner-standard.js', 'js/app/cabinet/cabinet-modal-standing-extras.js',
    'js/app/cabinet/cabinet-modal-standing-front-controls.js', 'js/app/cabinet/cabinet-modal-standing.js',
    'js/app/cabinet/cabinet-modal-draft.js', 'js/app/cabinet/cabinet-modal-finalize.js',
    'js/app/cabinet/cabinet-modal-set-wizard.js', 'js/app/cabinet/cabinet-modal.js',
  ]) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename:file });
  sandbox.generateFrontsForCabinet = (room, cab)=> {
    metrics.frontGenerations += 1;
    sandbox.FC.cabinetFronts.generateFrontsForCabinet(room, cab);
  };
  const get = (id)=> document.getElementById(id);
  const edit = ()=> sandbox.FC.cabinetModal.openCabinetModalForEdit('cabinet');
  const setWidth = async (width)=> { get('cmWidth').value = width; await get('cmWidth').emit('input'); };
  return { sandbox, metrics, get, edit, setWidth, state:sandbox.cabinetModalState, FC:sandbox.FC };
}

function assertButtons(r, dirty){
  assert.equal(r.FC.cabinetModalDraft.isEditDirty(), dirty);
  assert.equal(r.get('cabinetModalCancel').textContent, dirty ? 'Anuluj' : 'Wyjdź');
  assert.equal(r.get('cabinetModalCancel').className, dirty ? 'btn btn-danger' : 'btn btn-primary');
  assert.equal(r.get('cabinetModalSave').style.display, dirty ? 'inline-flex' : 'none');
  assert.equal(r.get('cabinetModalSave').disabled, !dirty);
}

function openClean(){
  const r = runtime(); const before = JSON.stringify(r.sandbox.projectData);
  r.edit(); assertButtons(r, false);
  assert.notEqual(r.state.draft, r.state.initialDraft);
  assert.notEqual(r.state.draft.details, r.state.initialDraft.details);
  assert.equal(JSON.stringify(r.sandbox.projectData), before);
  assert.equal(r.metrics.begins, 0); assert.equal(r.metrics.saves, 0); assert.equal(r.metrics.uiWrites, 0);
  return r;
}

async function dirtyAndRevert(){
  const r = openClean(); const before = JSON.stringify(r.sandbox.projectData);
  const baseline = JSON.stringify(r.state.initialDraft);
  await r.setWidth(70); assertButtons(r, true);
  await r.setWidth(60); assertButtons(r, false);
  assert.equal(JSON.stringify(r.state.initialDraft), baseline);
  assert.equal(JSON.stringify(r.sandbox.projectData), before);
  assert.equal(r.metrics.begins, 0); assert.equal(r.metrics.saves, 0);
}

function derivedAndEquivalent(){
  const r = openClean();
  r.state.draft.derivedFacts = { cached:1 }; r.state.draft._derivedFacts = { cached:2 };
  r.state.draft.drawerCount = 100; // Existing cleaner removes obsolete drawer fields on a clone.
  r.FC.cabinetModal.refreshCabinetModalButtons(); assertButtons(r, false);
  const source = clone(r.state.initialDraft);
  const equivalent = Object.fromEntries(Object.entries(source).reverse()); equivalent.width = '60.0'; equivalent.details.shelves = '1';
  assert.deepEqual(clone(r.FC.cabinetModalDraft.comparableCabinetDraft(source)), clone(r.FC.cabinetModalDraft.comparableCabinetDraft(equivalent)));
  assert.equal(r.state.draft.drawerCount, 100, 'Comparison must clean clones, never the draft or initial baseline');
}

async function localCancel(){
  const r = openClean(); const before = JSON.stringify(r.sandbox.projectData);
  await r.setWidth(70);
  assert.equal(r.get('cabinetModalCancel').getAttribute('data-action'), null, 'Global delegation must not bypass local confirmation');
  await r.get('cabinetModalCancel').emit('click');
  assert.equal(r.metrics.confirms.length, 1);
  assert.equal(r.metrics.confirms[0].title, 'ANULOWAĆ ZMIANY?');
  assert.equal(r.metrics.confirms[0].message, 'Niezapisane zmiany w szafce zostaną utracone.');
  assert.equal(r.metrics.confirms[0].cancelText, 'WRÓĆ');
  assert.equal(r.get('cabinetModal').style.display, 'flex'); assert.equal(r.state.draft.width, 70);
  r.metrics.discard = true;
  await r.get('cabinetModalCancel').emit('click');
  assert.equal(r.get('cabinetModal').style.display, 'none');
  assert.equal(JSON.stringify(r.sandbox.projectData), before); assert.equal(r.metrics.begins, 0);
  const clean = openClean(); await clean.get('cabinetModalCancel').emit('click');
  assert.equal(clean.metrics.confirms.length, 0); assert.equal(clean.get('cabinetModal').style.display, 'none');
}

async function failedRegularSave(add){
  const r = runtime(); r.metrics.ready = false;
  const before = JSON.stringify(r.sandbox.projectData), beforeUi = JSON.stringify(r.sandbox.uiState);
  if(add) r.FC.cabinetModal.openCabinetModalForAdd(); else r.edit();
  await r.setWidth(70);
  await r.get('cabinetModalSave').emit('click');
  assert.equal(r.metrics.begins, 1);
  assert.equal(JSON.stringify(r.sandbox.projectData), before);
  assert.equal(JSON.stringify(r.sandbox.uiState), beforeUi);
  assert.equal(r.get('cabinetModal').style.display, 'flex'); assert.equal(r.state.draft.width, 70);
  assert.equal(r.metrics.frontGenerations, 0); assert.equal(r.metrics.saves, 0);
  assert.equal(r.metrics.uiWrites, 0); assert.equal(r.metrics.renders, 0);
  assert.equal(r.metrics.messages.length, 0, 'The session layer owns the failed-begin warning');
}

function prepareSet(r, edit){
  r.state.mode = 'add'; r.state.chosen = 'zestaw'; r.state.setPreset = 'C'; r.state.setEditId = edit ? 'set' : null;
  if(edit){
    r.sandbox.projectData.kuchnia.cabinets[0].setId = 'set';
    r.sandbox.projectData.kuchnia.fronts[0].setId = 'set';
    r.sandbox.projectData.kuchnia.sets = [{ id:'set', presetId:'C', number:1 }];
  }
  r.get('cabinetModal').style.display = 'flex';
  for(const [id, value] of Object.entries({ setW:65, setHBottom:82, setDBottom:51, setBlende:10,
    setFrontCount:2, setFrontMaterial:'laminat', setFrontColor:'Test', setBodyColor:'Test',
    setBackMaterial:'HDF 3mm biała', setOpeningSystem:'uchwyt klienta' })){
    if(!r.get(id)){
      const input = r.sandbox.document.createElement('input'); input.setAttribute('id', id); r.get('cabinetModal').appendChild(input);
    }
    r.get(id).value = value;
  }
}

function failedSetSave(){
  for(const edit of [false, true]){
    const r = runtime(); prepareSet(r, edit); r.metrics.ready = false;
    const before = JSON.stringify(r.sandbox.projectData);
    assert.equal(r.FC.cabinetModalSetWizard.createOrUpdateSetFromWizard(), false);
    assert.equal(JSON.stringify(r.sandbox.projectData), before);
    assert.equal(r.get('setW').value, '65'); assert.equal(r.get('cabinetModal').style.display, 'flex');
    assert.equal(r.metrics.begins, 1); assert.equal(r.metrics.saves, 0); assert.equal(r.metrics.uiWrites, 0);
    assert.equal(r.metrics.renders, 0); assert.equal(r.metrics.messages.length, 0);
  }
}

async function normalSave(add){
  const r = runtime(); const before = JSON.stringify(r.sandbox.projectData);
  if(add) r.FC.cabinetModal.openCabinetModalForAdd(); else r.edit();
  if(add) assert.equal(r.get('cabinetModalSave').textContent, 'Dodaj');
  await r.setWidth(70);
  await r.get('cabinetModalSave').emit('click');
  const cabinets = r.sandbox.projectData.kuchnia.cabinets;
  assert.equal(cabinets.length, add ? 2 : 1); assert.equal(cabinets[add ? 1 : 0].width, 70);
  assert.equal(r.metrics.sequence[0].action, 'begin'); assert.equal(r.metrics.sequence[0].project, before);
  assert.equal(r.metrics.saves, 1); assert.equal(r.metrics.frontGenerations, 1); assert.equal(r.metrics.renders, 1);
  assert.equal(r.get('cabinetModal').style.display, 'none');
}

async function dynamicAndLauncherChanges(){
  const r = openClean();
  const shelves = r.get('cmExtraDetails').querySelector('input');
  assert.ok(shelves);
  shelves.value = 2; await shelves.emit('input'); assertButtons(r, true);
  shelves.value = 1; await shelves.emit('input'); assertButtons(r, false);
  r.get('cmBodyColor').value = 'Other'; await r.get('cmBodyColor').emit('change'); assertButtons(r, true);
  r.get('cmBodyColor').value = 'Test'; await r.get('cmBodyColor').emit('change'); assertButtons(r, false);
  r.get('cmSubType').value = 'rogowa_slepa'; await r.get('cmSubType').emit('change'); assertButtons(r, true);
  assert.equal(r.metrics.begins, 0); assert.equal(r.metrics.saves, 0);
  assert.equal((r.get('cabinetModal').listeners.input || []).length, 1, 'Rerenders must not multiply delegated listeners');
}

async function formSyncAndCleanSaveGuard(){
  const r = openClean(); const before = JSON.stringify(r.sandbox.projectData);
  // The form can change before any handler has synchronized the draft.
  r.get('cmWidth').value = '70';
  assert.equal(r.state.draft.width, 60);
  assert.equal(r.FC.cabinetModalDraft.isEditDirty(), true);
  assert.equal(r.state.draft.width, 70);
  r.get('cmWidth').value = '60';
  assert.equal(r.FC.cabinetModalDraft.isEditDirty(), false);
  await r.get('cabinetModalSave').emit('click');
  assert.equal(r.metrics.begins, 0, 'Even a direct clean-save invocation must not start a session');
  assert.equal(r.metrics.saves, 0);
  assert.equal(JSON.stringify(r.sandbox.projectData), before);
  assert.equal(r.get('cabinetModal').style.display, 'flex');
}

function normalSetSave(){
  const r = runtime(); prepareSet(r, true);
  const before = JSON.stringify(r.sandbox.projectData);
  r.FC.cabinetModalSetWizard.createOrUpdateSetFromWizard();
  assert.equal(r.metrics.sequence[0].project, before);
  assert.equal(r.metrics.begins, 1); assert.equal(r.metrics.saves, 1);
  assert.equal(r.sandbox.projectData.kuchnia.cabinets.length, 2);
  assert.equal(r.sandbox.projectData.kuchnia.cabinets[0].width, 65);
  assert.equal(r.sandbox.projectData.kuchnia.sets[0].params.w, 65);
  assert.equal(r.sandbox.projectData.kuchnia.fronts.length, 2);
  assert.equal(r.get('cabinetModal').style.display, 'none');
}

(async()=>{
  const scenarios = [
    ['edit opens clean with independent local baseline', openClean],
    ['60 -> 70 -> 60 updates dirty buttons and returns clean', dirtyAndRevert],
    ['derived facts, obsolete drawer fields and equivalent values stay clean', derivedAndEquivalent],
    ['local cancel confirms, respects WRÓĆ, and never rolls back the project', localCancel],
    ['failed durable begin blocks edit before all project/front/UI mutations', ()=> failedRegularSave(false)],
    ['failed durable begin blocks add and preserves modal draft', ()=> failedRegularSave(true)],
    ['failed durable begin blocks set creation and set replacement', failedSetSave],
    ['normal edit mutates only after durable begin and closes modal', ()=> normalSave(false)],
    ['normal add retains Dodaj and succeeds after durable begin', ()=> normalSave(true)],
    ['dynamic fields and launcher-style changes refresh local dirty', dynamicAndLauncherChanges],
    ['dirty check synchronizes DOM and clean save cannot mutate the project', formSyncAndCleanSaveGuard],
    ['normal set save still replaces cabinets and fronts after the gate', normalSetSave],
  ];
  for(const [name, run] of scenarios){ await run(); console.log('PASS: ' + name); }
  console.log('cabinet-modal-safe-dirty-smoke: PASS (' + scenarios.length + '/' + scenarios.length + ')');
})().catch((error)=>{ console.error(error); process.exitCode = 1; });
