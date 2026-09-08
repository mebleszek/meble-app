#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');
const { makeStorage } = require('./app-dev-smoke-lib/smoke-storage');

const root = path.resolve(__dirname, '..');

function load(sandbox, relativePath){
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(source, sandbox, { filename:relativePath });
}

function assert(condition, message, details){
  if(condition) return;
  const suffix = details === undefined ? '' : `\n${JSON.stringify(details, null, 2)}`;
  throw new Error(message + suffix);
}

async function flushAsyncClick(){
  await Promise.resolve();
  await Promise.resolve();
}

async function main(){
  const document = makeMiniDocument();
  const sandbox = {
    console,
    document,
    JSON, String, Number, Array, Object, Set, Map, Math, Promise,
    setTimeout, clearTimeout,
    localStorage:makeStorage(),
    sessionStorage:makeStorage(),
    structuredClone:global.structuredClone || ((value)=> JSON.parse(JSON.stringify(value)))
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = {};
  vm.createContext(sandbox);

  load(sandbox, 'js/app/shared/utils.js');
  load(sandbox, 'js/app/shared/constants.js');
  load(sandbox, 'js/app/shared/storage.js');
  load(sandbox, 'js/app/settings/program-defaults-store.js');
  load(sandbox, 'js/app/ui/data-settings-dom.js');
  load(sandbox, 'js/app/ui/data-settings-defaults-view.js');

  sandbox.FC.catalogStore = {
    getSheetMaterials(){
      return [
        { name:'Korpus A', materialType:'laminat' },
        { name:'Korpus B', materialType:'laminat' },
        { name:'Front A', materialType:'laminat' },
        { name:'Front B', materialType:'laminat' }
      ];
    },
    getHardwareManufacturers(){ return ['Blum', 'GTV', 'Rejs']; }
  };

  const picks = [];
  sandbox.FC.rozrysChoice = {
    createChoiceLauncher(label){
      const button = document.createElement('button');
      button.textContent = String(label || '');
      return button;
    },
    setChoiceLaunchValue(button, label){ button.textContent = String(label || ''); },
    async openRozrysChoiceOverlay(){ return picks.shift(); }
  };

  sandbox.FC.programDefaults.write({
    materials:{ bodyColor:'Korpus A', frontMaterial:'laminat', frontColor:'Front A', backMaterial:'HDF 3mm biała' }
  });

  const scroll = document.createElement('div');
  document.body.appendChild(scroll);
  sandbox.FC.dataSettingsDefaultsView.render(scroll);

  const choiceButtons = Array.from(scroll.querySelectorAll('.data-settings-default-choice'));
  const saveButton = scroll.querySelector('.btn-success');
  assert(choiceButtons.length >= 4, 'Widok nie utworzył pól globalnych ustawień.', { count:choiceButtons.length });
  assert(saveButton, 'Widok nie utworzył przycisku Zapisz.');

  picks.push('Korpus B');
  choiceButtons[0].click();
  await flushAsyncClick();
  saveButton.click();

  picks.push('Front B');
  choiceButtons[2].click();
  await flushAsyncClick();
  saveButton.click();

  const stored = sandbox.FC.programDefaults.read();
  assert(stored.materials.bodyColor === 'Korpus B', 'Pierwszy zapis ustawień zginął.', stored);
  assert(stored.materials.frontColor === 'Front B', 'Zmiana wykonana po pierwszym zapisie trafiła do starej kopii draftu.', stored);
  assert(choiceButtons[0].textContent === 'Korpus B' && choiceButtons[2].textContent === 'Front B', 'Launchery nie pokazują zapisanych wartości.', choiceButtons.map((button)=> button.textContent));

  console.log('Program defaults UI save smoke: OK');
  console.log('- pierwszy zapis: OK');
  console.log('- kolejna zmiana bez ponownego otwierania widoku: OK');
  console.log('- zapis i etykiety launcherów pozostają zsynchronizowane: OK');
}

main().catch((error)=>{
  console.error('Program defaults UI save smoke: BŁĄD');
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
