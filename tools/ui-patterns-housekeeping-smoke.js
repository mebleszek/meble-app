#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = (file)=> fs.readFileSync(path.join(ROOT, file), 'utf8');
const INFO_FILE = 'js/app/ui/info-box.js';
const MENU_FILE = 'js/app/ui/data-settings-menu-view.js';

function runtime(){
  function element(tag){
    const node = {
      tag, className:'', textContent:'', attributes:{}, children:[], listeners:{}, parent:null,
      appendChild(child){ child.parent = this; this.children.push(child); return child; },
      remove(){ if(this.parent) this.parent.children = this.parent.children.filter((child)=> child !== this); this.parent = null; },
      setAttribute(key, value){ this.attributes[key] = String(value); },
      addEventListener(event, handler){ this.listeners[event] = handler; },
      fire(type, extras = {}){
        const event = { target:this, preventDefault(){}, stopPropagation(){}, ...extras };
        return this.listeners[type] && this.listeners[type](event);
      },
      focus(){ this.focused = true; },
      set innerHTML(value){ this.children = []; },
    };
    node.classList = {
      add(value){ node.className = [...new Set([...node.className.split(/\s+/).filter(Boolean), value])].join(' '); },
      remove(value){ node.className = node.className.split(/\s+/).filter((name)=> name !== value).join(' '); },
    };
    return node;
  }
  const docEvents = {};
  const document = {
    createElement:element, body:element('body'), documentElement:element('html'),
    addEventListener(type, handler){ docEvents[type] = handler; },
    removeEventListener(type, handler){ if(docEvents[type] === handler) delete docEvents[type]; },
  };
  const help = [];
  const sandbox = {
    document, console, location:{ href:'index.html' },
    setTimeout(callback){ callback(); },
    localStorage:{
      setItem(){ throw new Error('UI must not write storage'); },
      removeItem(){ throw new Error('UI must not remove storage'); },
      clear(){ throw new Error('clear forbidden'); },
    },
    FC:{
      session:{ begin(){ throw new Error('UI must not start sessions'); } },
      project:{ save(){ throw new Error('UI must not save projects'); } },
      appIcons:{ create(name, classes){ const icon = element('svg'); icon.className = classes; icon.setAttribute('data-icon', name); return icon; } },
      dataSettingsDom:{
        h(tag, attrs, children){
          const node = element(tag);
          for(const [key, value] of Object.entries(attrs || {})){
            if(key === 'class') node.className = value;
            else if(key === 'text') node.textContent = value;
            else node.setAttribute(key, value);
          }
          for(const child of children || []) node.appendChild(child);
          return node;
        },
        info(title, message){ help.push({ title, message }); },
      },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for(const file of [INFO_FILE, MENU_FILE]) vm.runInContext(read(file), sandbox, { filename:file });
  const all = (node = document.body)=> [node, ...node.children.flatMap((child)=> all(child))];
  const byClass = (name)=> all().find((node)=> node.className.split(/\s+/).includes(name));
  return { sandbox, document, docEvents, element, all, byClass, help };
}
const sample = { title:'Projekt zapisany', message:'Wszystkie zmiany zostały zapisane poprawnie.', okOnly:true };
const cases = [
  ['infoBox OK uses the shared confirm button', ()=>{
    const r = runtime(); r.sandbox.FC.infoBox.open(sample);
    const ok = r.byClass('info-box__action');
    assert.equal(ok.textContent, 'OK');
    assert.ok(ok.className.split(/\s+/).includes('confirm-btn'));
    assert.ok(ok.className.split(/\s+/).includes('is-success'));
    assert.ok(!ok.className.split(/\s+/).includes('btn-success'));
    assert.equal(r.byClass('info-box__title').textContent, sample.title);
    assert.equal(r.byClass('info-box__body').textContent, sample.message);
  }],
  ['OK-only and existing dismiss behavior remain intact', ()=>{
    const r = runtime(); const api = r.sandbox.FC.infoBox;
    api.open(sample);
    assert.equal(r.byClass('info-box__close'), undefined);
    r.byClass('info-backdrop').fire('pointerdown');
    assert.ok(r.byClass('info-box'));
    r.docEvents.keydown({ key:'Escape', preventDefault(){} });
    assert.ok(r.byClass('info-box'));
    r.byClass('info-box__action').fire('click');
    assert.equal(r.document.body.children.length, 0);
    assert.equal(r.docEvents.keydown, undefined);
    assert.doesNotMatch(r.document.body.className, /modal-lock/);
    api.open({ ...sample, dismissOnOverlay:true });
    r.byClass('info-backdrop').fire('pointerdown');
    assert.equal(r.document.body.children.length, 0);
    api.open({ ...sample, dismissOnEsc:true });
    r.docEvents.keydown({ key:'Escape', preventDefault(){} });
    assert.equal(r.document.body.children.length, 0);
    api.open({ title:'Informacja', message:'Standard' });
    assert.ok(r.byClass('info-box__close'));
    assert.equal(r.byClass('info-box__action'), undefined);
    r.byClass('info-box__close').fire('click');
    assert.equal(r.document.body.children.length, 0);
    api.open({ title:'Informacja' });
    r.byClass('info-backdrop').fire('pointerdown');
    assert.equal(r.document.body.children.length, 0);
    api.open({ title:'Informacja' });
    r.docEvents.keydown({ key:'Escape', preventDefault(){} });
    assert.equal(r.document.body.children.length, 0);
  }],
  ['no local oversized OK geometry', ()=>{
    const css = read('css/shared-overlays-choice.css');
    assert.doesNotMatch(css, /\.info-box__action\s*(?:\{|:)/);
    const single = css.match(/\.info-box__actions--single\{([^}]+)\}/)[1];
    assert.match(single, /grid-template-columns:max-content/);
    assert.match(single, /justify-content:center/);
    assert.doesNotMatch(single, /minmax|\d+px|height|padding|font|border|shadow/);
    assert.match(read('css/drawing-home-confirm.css'), /\.confirm-btn\.is-success\{/);
  }],
  ['settings tile navigation, icon and help', ()=>{
    const r = runtime(); const scroll = r.element('div'); r.document.body.appendChild(scroll);
    r.sandbox.FC.dataSettingsMenuView.render(scroll, ()=> { throw new Error('Patterns must navigate directly'); });
    const tile = r.all().find((node)=> node.attributes['data-settings-section'] === 'patterns');
    assert.ok(tile);
    assert.equal(tile.className, 'data-settings-menu-tile');
    assert.equal(tile.attributes.role, 'button');
    assert.ok(r.all(tile).some((node)=> node.textContent === 'Wzorce UI'));
    assert.ok(r.all(tile).some((node)=> node.textContent === 'Wzorcowe modale, przyciski, pola, ikony i elementy interfejsu do kopiowania 1:1.'));
    assert.ok(r.all(tile).some((node)=> node.tag === 'svg' && node.attributes['data-icon'] === 'settings'));
    const helpButton = r.all(tile).find((node)=> node.className.includes('info-trigger'));
    helpButton.fire('click');
    assert.equal(r.sandbox.location.href, 'index.html');
    assert.equal(r.help[0].title, 'Wzorce UI');
    assert.equal(r.help[0].message, 'Wzorce UI są źródłem prawdy dla nowych elementów interfejsu. Przed tworzeniem nowego modala, przycisku, pola lub ikony należy użyć istniejącego wzorca zamiast tworzyć lokalny wariant.');
    tile.fire('click'); assert.equal(r.sandbox.location.href, 'dev_ui_patterns.html');
    r.sandbox.location.href = 'index.html';
    tile.fire('keydown', { key:'Enter' }); assert.equal(r.sandbox.location.href, 'dev_ui_patterns.html');
    assert.match(read(MENU_FILE), /infoKey:'patterns'/);
  }],
  ['documented patterns use production button classes', ()=>{
    const html = read('dev_ui_patterns.html');
    const article = (name)=> html.match(new RegExp(`<article[^>]*data-ui-pattern="${name}"[^>]*>([\\s\\S]*?)</article>`))[1];
    const info = article('info-ok');
    assert.match(info, /Informacja — jeden przycisk OK/);
    assert.match(info, /Projekt zapisany/);
    assert.match(info, /Wszystkie zmiany zostały zapisane poprawnie\./);
    assert.match(info, /class="confirm-btn is-success info-box__action"[^>]*>OK</);
    const confirm = article('confirm-destructive');
    assert.match(confirm, /Potwierdzenie — powrót \/ akcja destrukcyjna/);
    assert.match(confirm, /class="confirm-btn is-neutral"[^>]*>WRÓĆ</);
    assert.match(confirm, /class="confirm-btn is-danger"[^>]*>✕ ANULUJ ZMIANY</);
    const draft = article('local-draft');
    assert.match(draft, /Lokalny draft — Wyjdź vs Anuluj \/ Zapisz/);
    assert.match(draft, /CLEAN/); assert.match(draft, /DIRTY/);
    for(const [cls, label] of [['btn-primary','Wyjdź'], ['btn-danger','Anuluj'], ['btn-success','Zapisz']]){
      assert.match(draft, new RegExp(`class="${cls}"[^>]*>${label}<`));
    }
    assert.doesNotMatch(html, /ui-green-button|special-ok|modal-save-button-v2/);
  }],
  ['UI modules introduce no storage, session or project writes', ()=>{
    for(const file of [INFO_FILE, MENU_FILE, 'dev_ui_patterns.html']){
      assert.doesNotMatch(read(file), /localStorage\s*\.\s*(?:setItem|removeItem|clear)\s*\(|session\s*\.\s*begin\s*\(|project\s*\.\s*save\s*\(/);
    }
  }],
];
let passed = 0;
for(const [name, test] of cases){
  try{ test(); passed += 1; console.log('PASS ' + name); }
  catch(error){ console.error('FAIL ' + name); console.error(error); process.exitCode = 1; }
}
console.log(`UI patterns housekeeping: ${passed}/${cases.length} PASS`);
