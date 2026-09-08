#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeMiniDocument } = require('./app-dev-smoke-lib/mini-document');

const root = path.resolve(__dirname, '..');

function load(sandbox, relativePath){
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(source, sandbox, { filename:relativePath });
}

function assert(condition, message, details){
  if(condition) return;
  console.error('FAIL:', message);
  if(details !== undefined) console.error(JSON.stringify(details, null, 2));
  process.exitCode = 1;
  throw new Error(message);
}

function clone(value){ return JSON.parse(JSON.stringify(value)); }

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
    projectData:{
      schemaVersion:12,
      kuchnia:{ cabinets:[], fronts:[], sets:[], settings:{}, preferences:{} }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.FC = { utils:{ clone } };
  vm.createContext(sandbox);

  load(sandbox, 'js/app/room-preferences/room-preferences-model.js');
  load(sandbox, 'js/app/ui/wywiad-room-accordion-actions.js');
  load(sandbox, 'js/app/ui/wywiad-room-hardware-producers.js');

  sandbox.FC.catalogStore = {
    getHardwareManufacturers(){ return ['Blum', 'GTV', 'Rejs']; }
  };
  sandbox.FC.project = {
    save(data){ return clone(data); }
  };
  sandbox.FC.rozrysChoice = {
    createChoiceLauncher(label){
      const button = document.createElement('button');
      button.textContent = String(label || '');
      return button;
    },
    setChoiceLaunchValue(button, label){ button.textContent = String(label || ''); },
    async openRozrysChoiceOverlay(){ return 'blum_tandembox_antaro'; }
  };

  const ui = sandbox.FC.wywiadRoomHardwareProducers;
  const preferences = sandbox.FC.roomPreferences;
  const form = ui.buildInlineForm('kuchnia', preferences.getRoomPreferences('kuchnia'));
  document.body.appendChild(form);

  const systemButton = form.querySelector('[data-hardware-drawer-system-key]');
  assert(systemButton, 'Formularz nie utworzył launchera systemu szuflad');
  systemButton.click();
  await flushAsyncClick();

  assert(
    systemButton.getAttribute('data-hardware-drawer-system-value') === 'blum_tandembox_antaro',
    'Wybrany system zniknął ze stanu launchera przed zapisem',
    { value:systemButton.getAttribute('data-hardware-drawer-system-value'), label:systemButton.textContent }
  );
  assert(/Blum TANDEMBOX Antaro/.test(systemButton.textContent), 'Launcher nie pokazuje wybranego systemu', systemButton.textContent);

  const saveButton = form.querySelector('.wywiad-room-inline-form__save');
  assert(saveButton, 'Formularz nie utworzył przycisku Zapisz zmiany');
  saveButton.click();

  const saved = preferences.getRoomPreferences('kuchnia');
  assert(
    saved.hardwareDrawerSystems && saved.hardwareDrawerSystems.drawers === 'blum_tandembox_antaro',
    'Zapis preferencji zgubił wybrany system szuflad',
    saved
  );
  assert(saved.hardwareProducers && saved.hardwareProducers.drawers === 'Blum', 'System nie zsynchronizował producenta Blum', saved);

  const reopened = ui.buildInlineForm('kuchnia', preferences.getRoomPreferences('kuchnia'));
  const reopenedSystemButton = reopened.querySelector('[data-hardware-drawer-system-key]');
  assert(
    reopenedSystemButton && reopenedSystemButton.getAttribute('data-hardware-drawer-system-value') === 'blum_tandembox_antaro',
    'Ponownie otwarty formularz nie odczytał zapisanego systemu',
    reopenedSystemButton && reopenedSystemButton.getAttribute('data-hardware-drawer-system-value')
  );
  assert(/Blum TANDEMBOX Antaro/.test(reopenedSystemButton.textContent), 'Ponownie otwarty formularz ma błędną etykietę systemu', reopenedSystemButton.textContent);

  console.log('OK drawer system selection save smoke');
  console.log(' - wybór pozostaje w launcherze');
  console.log(' - zapisuje się w hardwareDrawerSystems.drawers');
  console.log(' - wraca po ponownym zbudowaniu formularza');
}

main().catch((error)=>{
  if(!process.exitCode){
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  }
});
