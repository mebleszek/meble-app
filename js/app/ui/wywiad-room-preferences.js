// js/app/ui/wywiad-room-preferences.js
// UI preferencji standardu pokoju w WYWIADZIE.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const FINISH_STANDARDS = ['standard ekonomiczny','standard dobry','standard premium'];
  const BLEND_STANDARDS = ['standardowe','dokładne pod wymiar','minimalne / tylko konieczne'];
  const BACK_MATERIALS = ['HDF 3mm biała','HDF 3mm pod kolor','Płyta 18mm pod kolor','Brak'];

  function text(value){ return String(value == null ? '' : value).trim(); }

  function getApi(){ return ns.roomPreferences || {}; }

  function getSharedUiState(){
    try{ if(typeof uiState !== 'undefined' && uiState && typeof uiState === 'object') return uiState; }catch(_){ }
    try{ if(window.uiState && typeof window.uiState === 'object') return window.uiState; }catch(_){ }
    return null;
  }

  function getCurrentRoom(){
    try{ const state = getSharedUiState(); return text(state && state.roomType); }catch(_){ return ''; }
  }

  function getRoomLabel(room){
    const key = text(room);
    if(!key) return 'Pomieszczenie';
    try{
      const registry = ns.roomRegistry;
      if(registry && typeof registry.getRoomLabel === 'function') return registry.getRoomLabel(key);
    }catch(_){ }
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function getMaterials(){
    try{ if(Array.isArray(materials)) return materials; }catch(_){ }
    try{ if(ns.catalogStore && typeof ns.catalogStore.getSheetMaterials === 'function') return ns.catalogStore.getSheetMaterials(); }catch(_){ }
    return [];
  }

  function unique(list){
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((item)=>{
      const value = text(item);
      if(!value || seen.has(value)) return;
      seen.add(value);
      out.push(value);
    });
    return out;
  }

  function getMaterialTypes(){
    return unique(getMaterials().map((row)=> row && row.materialType)).concat([]);
  }

  function getMaterialNamesByType(typeValue){
    const type = text(typeValue || 'laminat');
    return unique(getMaterials().filter((row)=> row && text(row.materialType) === type).map((row)=> row && row.name));
  }

  function getBodyMaterialNames(){ return getMaterialNamesByType('laminat'); }

  function getHardwareManufacturers(){
    try{
      if(ns.catalogStore && typeof ns.catalogStore.getHardwareManufacturers === 'function') return unique(ns.catalogStore.getHardwareManufacturers());
    }catch(_){ }
    return ['Blum','GTV','Peka','Rejs','Nomet','Häfele','Sevroll','Laguna','Hettich'];
  }

  function optionList(values, includeEmpty){
    const out = includeEmpty === false ? [] : [{ value:'', label:'— bez preferencji —' }];
    unique(values || []).forEach((value)=> out.push({ value, label:value }));
    return out;
  }

  function createField(form, cfg, draft){
    const wrap = document.createElement('div');
    wrap.className = 'wywiad-room-preferences-field cabinet-extra-field cabinet-extra-field--select';

    const label = document.createElement('label');
    label.className = 'wywiad-room-settings-modal__label cabinet-extra-field__label';
    label.textContent = String(cfg.label || 'Wybierz');
    label.setAttribute('for', cfg.id);

    const select = document.createElement('select');
    select.id = cfg.id;
    select.className = 'cabinet-extra-field__control cabinet-dynamic-choice-source';
    select.setAttribute('data-launcher-label', cfg.label || 'Wybierz');
    select.setAttribute('data-choice-title', cfg.title || ('Wybierz: ' + (cfg.label || 'Opcja')));
    select.setAttribute('data-choice-placeholder', cfg.label || 'Wybierz');

    const options = typeof cfg.options === 'function' ? cfg.options(draft) : (cfg.options || []);
    optionList(options, cfg.includeEmpty).forEach((opt)=>{
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });
    select.value = text(draft[cfg.key]);
    select.addEventListener('change', ()=>{
      draft[cfg.key] = select.value;
      if(typeof cfg.onChange === 'function') cfg.onChange(draft, select.value, form);
      refreshDependentFields(form, draft);
    });

    wrap.appendChild(label);
    wrap.appendChild(select);
    form.appendChild(wrap);
    return select;
  }

  function rebuildSelect(select, options, value){
    if(!select) return;
    select.innerHTML = '';
    optionList(options, true).forEach((opt)=>{
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });
    select.value = text(value);
  }

  function refreshDependentFields(form, draft){
    try{
      const frontColor = form.querySelector('#roomPref_frontColor');
      if(frontColor){
        const values = getMaterialNamesByType(draft.frontMaterial || 'laminat');
        const current = values.includes(text(draft.frontColor)) ? draft.frontColor : '';
        draft.frontColor = current;
        rebuildSelect(frontColor, values, current);
      }
      if(ns.cabinetChoiceLaunchers && typeof ns.cabinetChoiceLaunchers.refreshCabinetChoices === 'function'){
        ns.cabinetChoiceLaunchers.refreshCabinetChoices(form);
      }
    }catch(_){ }
  }

  function buildForm(room, draft){
    const form = document.createElement('div');
    form.className = 'panel-box-form rozrys-panel-form rozrys-panel-form--stock wywiad-room-settings-modal wywiad-room-preferences-modal investor-card-sync cabinet-choice-sync';

    const scroll = document.createElement('div');
    scroll.className = 'panel-box-form__scroll wywiad-room-settings-modal__scroll';
    form.appendChild(scroll);

    const intro = document.createElement('div');
    intro.className = 'wywiad-room-settings-modal__intro';
    const roomBadge = document.createElement('div');
    roomBadge.className = 'wywiad-room-settings-modal__room';
    roomBadge.textContent = getRoomLabel(room);
    const note = document.createElement('div');
    note.className = 'wywiad-room-settings-modal__auto wywiad-room-preferences-modal__note';
    note.textContent = 'Dotyczy nowych szafek. Istniejące szafki nie są zmieniane w tym etapie.';
    intro.appendChild(roomBadge);
    intro.appendChild(note);
    scroll.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'grid-2 wywiad-room-settings-modal__grid wywiad-room-preferences-modal__grid';
    scroll.appendChild(grid);

    createField(grid, { key:'finishStandard', id:'roomPref_finishStandard', label:'Standard wykończenia', title:'Wybierz standard wykończenia', options:FINISH_STANDARDS }, draft);
    createField(grid, { key:'blendStandard', id:'roomPref_blendStandard', label:'Standard blend', title:'Wybierz standard blend', options:BLEND_STANDARDS }, draft);
    createField(grid, { key:'bodyColor', id:'roomPref_bodyColor', label:'Korpus', title:'Wybierz korpus', options:getBodyMaterialNames }, draft);
    createField(grid, { key:'frontMaterial', id:'roomPref_frontMaterial', label:'Materiał frontu', title:'Wybierz materiał frontu', options:getMaterialTypes, onChange(next){ if(!getMaterialNamesByType(next.frontMaterial).includes(text(next.frontColor))) next.frontColor = ''; } }, draft);
    createField(grid, { key:'frontColor', id:'roomPref_frontColor', label:'Kolor frontu', title:'Wybierz kolor frontu', options:(next)=> getMaterialNamesByType(next.frontMaterial || 'laminat') }, draft);
    createField(grid, { key:'backMaterial', id:'roomPref_backMaterial', label:'Plecy', title:'Wybierz plecy', options:BACK_MATERIALS }, draft);
    createField(grid, { key:'openingSystemStanding', id:'roomPref_openingStanding', label:'Otwieranie — dolne / stojące', title:'Wybierz otwieranie dolnych / stojących', options:()=> (getApi().OPENING_OPTIONS || {}).standing || [] }, draft);
    createField(grid, { key:'openingSystemHanging', id:'roomPref_openingHanging', label:'Otwieranie — górne / wiszące', title:'Wybierz otwieranie górnych / wiszących', options:()=> (getApi().OPENING_OPTIONS || {}).hanging || [] }, draft);
    createField(grid, { key:'openingSystemModule', id:'roomPref_openingModule', label:'Otwieranie — moduł', title:'Wybierz otwieranie modułu', options:()=> (getApi().OPENING_OPTIONS || {}).module || [] }, draft);
    createField(grid, { key:'hardwareManufacturer', id:'roomPref_hardwareManufacturer', label:'Preferowany producent okuć', title:'Wybierz producenta okuć', options:getHardwareManufacturers }, draft);

    const footer = document.createElement('div');
    footer.className = 'panel-box-form__footer rozrys-picker-footer rozrys-picker-footer--material wywiad-room-settings-modal__footer';
    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'btn';
    exitBtn.textContent = 'Wyjdź';
    exitBtn.addEventListener('click', ()=> close());
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-success';
    saveBtn.textContent = 'Zapisz';
    saveBtn.addEventListener('click', ()=>{
      const api = getApi();
      if(api && typeof api.setRoomPreferences === 'function') api.setRoomPreferences(room, draft);
      renderSummary(room);
      try{ if(typeof renderCabinets === 'function') renderCabinets(); }catch(_){ }
      close();
    });
    footer.appendChild(exitBtn);
    footer.appendChild(saveBtn);
    form.appendChild(footer);

    requestAnimationFrame(()=>{
      try{
        if(ns.cabinetChoiceLaunchers && typeof ns.cabinetChoiceLaunchers.refreshCabinetChoices === 'function'){
          ns.cabinetChoiceLaunchers.refreshCabinetChoices(form);
        }
      }catch(_){ }
    });

    return form;
  }

  function bindTriggerButtons(root){
    const scope = root && root.querySelector ? root : document;
    const btn = scope.getElementById ? scope.getElementById('openRoomPreferencesBtn') : document.getElementById('openRoomPreferencesBtn');
    if(!btn || btn.__wywiadRoomPreferencesBound) return;
    btn.__wywiadRoomPreferencesBound = true;
    btn.addEventListener('click', (event)=>{
      try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
      open();
    });
  }

  function renderSummary(roomArg){
    const room = text(roomArg || getCurrentRoom());
    const wrap = document.getElementById('roomPreferencesSummary');
    if(!wrap) return;
    const api = getApi();
    const prefs = api && typeof api.getRoomPreferences === 'function' ? api.getRoomPreferences(room) : {};
    wrap.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'wywiad-room-shell__stats-line';
    line.innerHTML = '<strong>Preferencje:</strong> ' + escapeHtml(api && typeof api.getSummary === 'function' ? api.getSummary(prefs) : 'Brak zapisanych preferencji.');
    wrap.appendChild(line);
    bindTriggerButtons(document);
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, (ch)=> ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch] || ch));
  }

  function open(){
    const room = getCurrentRoom();
    if(!room) return false;
    const api = getApi();
    if(!(ns.panelBox && typeof ns.panelBox.open === 'function')) return false;
    const draft = api && typeof api.getRoomPreferences === 'function' ? api.getRoomPreferences(room) : {};
    const form = buildForm(room, draft);
    ns.panelBox.open({
      title:'Preferencje standardu',
      contentNode: form,
      width:'760px',
      boxClass:'panel-box--rozrys wywiad-room-settings-box wywiad-room-preferences-box',
      dismissOnOverlay:true,
      dismissOnEsc:true
    });
    return true;
  }

  function close(){
    try{ if(ns.panelBox && typeof ns.panelBox.close === 'function') ns.panelBox.close(); }catch(_){ }
    return true;
  }

  function init(){
    if(typeof document === 'undefined' || !document) return;
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> bindTriggerButtons(document), { once:true });
    else bindTriggerButtons(document);
  }

  init();

  ns.wywiadRoomPreferences = Object.assign({}, ns.wywiadRoomPreferences || {}, {
    open,
    close,
    renderSummary,
    bindTriggerButtons,
  });
})();
