// js/app/ui/wywiad-room-preferences.js
// UI preferencji materiałów i kolorów pokoju w WYWIADZIE.
// Etap 1B: preferencje strefowe bez natywnych pickerów/selectów telefonu.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const FINISH_STANDARDS = ['standard ekonomiczny','standard dobry','standard premium'];
  const BLEND_STANDARDS = ['standardowe','dokładne pod wymiar','minimalne / tylko konieczne'];
  const BACK_MATERIALS = ['HDF 3mm biała','HDF 3mm pod kolor','Płyta 18mm pod kolor','Brak'];
  const EMPTY_OPTION = '— nie ustawiaj —';

  function text(value){ return String(value == null ? '' : value).trim(); }
  function getApi(){ return ns.roomPreferences || {}; }
  function h(tag, attrs, children){
    const el = document.createElement(tag);
    if(attrs){
      Object.entries(attrs).forEach(([key,value])=>{
        if(value == null || value === false) return;
        if(key === 'class') el.className = value;
        else if(key === 'text') el.textContent = String(value);
        else if(key === 'html') el.innerHTML = String(value);
        else if(value === true) el.setAttribute(key, key);
        else el.setAttribute(key, String(value));
      });
    }
    (children || []).forEach((child)=>{ if(child) el.appendChild(child); });
    return el;
  }

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

  function getMaterialTypes(){ return unique(getMaterials().map((row)=> row && row.materialType)); }
  function getMaterialNamesByType(typeValue){
    const type = text(typeValue || 'laminat');
    return unique(getMaterials().filter((row)=> row && text(row.materialType) === type).map((row)=> row && row.name));
  }
  function getBodyMaterialNames(){ return getMaterialNamesByType('laminat'); }

  function optionList(values, emptyLabel){
    const out = [{ value:'', label:emptyLabel || EMPTY_OPTION }];
    unique(values || []).forEach((value)=> out.push({ value, label:value }));
    return out;
  }

  function getChoiceApi(){
    const api = ns.rozrysChoice;
    if(api && typeof api.createChoiceLauncher === 'function' && typeof api.openRozrysChoiceOverlay === 'function' && typeof api.setChoiceLaunchValue === 'function') return api;
    return null;
  }

  function selectedLabel(options, value, emptyLabel){
    const current = text(value);
    const rows = optionList(options, emptyLabel || EMPTY_OPTION);
    const hit = rows.find((row)=> String(row.value) === current);
    return hit ? hit.label : (current || emptyLabel || EMPTY_OPTION);
  }

  function makeChoiceButton(label){
    const api = getChoiceApi();
    if(api){
      const btn = api.createChoiceLauncher(label, '');
      btn.classList.add('wywiad-zone-choice', 'rozrys-choice-launch--options-clean');
      return btn;
    }
    return h('button', { type:'button', class:'rozrys-choice-launch rozrys-choice-launch--options-clean wywiad-zone-choice', text:String(label || '') });
  }

  function setChoiceButtonLabel(btn, label){
    const api = getChoiceApi();
    if(api && typeof api.setChoiceLaunchValue === 'function') return api.setChoiceLaunchValue(btn, label, '');
    btn.textContent = String(label || '');
  }


  function createSaveFooter(sectionTitle, beforeButtons, onSave){
    const api = ns.wywiadRoomAccordionActions;
    if(api && typeof api.createSaveFooter === 'function'){
      return api.createSaveFooter({ sectionTitle, buttonText:'Zapisz zmiany', split:Array.isArray(beforeButtons) && beforeButtons.length > 0, beforeButtons, onSave }).footer;
    }
    const footer = h('div', { class:'wywiad-room-inline-form__footer' + ((Array.isArray(beforeButtons) && beforeButtons.length) ? ' wywiad-room-inline-form__footer--split' : '') });
    (Array.isArray(beforeButtons) ? beforeButtons : []).forEach((btn)=>{ if(btn) footer.appendChild(btn); });
    const saveBtn = h('button', { type:'button', class:'btn btn-success wywiad-room-inline-form__save', text:'Zapisz zmiany', 'aria-label':'Zapisz zmiany — ' + sectionTitle });
    saveBtn.addEventListener('click', onSave);
    footer.appendChild(saveBtn);
    return footer;
  }

  async function openChoice(title, options, value){
    const api = getChoiceApi();
    if(api && typeof api.openRozrysChoiceOverlay === 'function') return api.openRozrysChoiceOverlay({ title, value:String(value || ''), options });
    return null;
  }

  function makeChoiceField(cfg, rootDraft, onChange){
    const wrap = h('div', { class:'wywiad-zone-field' });
    wrap.appendChild(h('div', { class:'wywiad-zone-field__label', text:cfg.label }));
    const getOptions = ()=> unique((typeof cfg.options === 'function' ? cfg.options(rootDraft) : (cfg.options || [])).concat(text(cfg.get(rootDraft)) ? [text(cfg.get(rootDraft))] : []));
    const btn = makeChoiceButton(selectedLabel(getOptions(), cfg.get(rootDraft), cfg.emptyLabel || EMPTY_OPTION));
    btn.setAttribute('aria-label', cfg.title || ('Wybierz: ' + cfg.label));
    btn.addEventListener('click', async ()=>{
      const options = optionList(getOptions(), cfg.emptyLabel || EMPTY_OPTION);
      const picked = await openChoice(cfg.title || ('Wybierz: ' + cfg.label), options, cfg.get(rootDraft));
      if(picked == null || String(picked) === String(cfg.get(rootDraft) || '')) return;
      cfg.set(rootDraft, picked);
      if(typeof cfg.onChange === 'function') cfg.onChange(rootDraft, picked, btn);
      setChoiceButtonLabel(btn, selectedLabel(getOptions(), cfg.get(rootDraft), cfg.emptyLabel || EMPTY_OPTION));
      if(typeof onChange === 'function') onChange(rootDraft);
    });
    wrap.appendChild(btn);
    return { wrap, refresh(){ setChoiceButtonLabel(btn, selectedLabel(getOptions(), cfg.get(rootDraft), cfg.emptyLabel || EMPTY_OPTION)); } };
  }

  function ensureZone(draft, zoneKey){
    draft.zones = draft.zones && typeof draft.zones === 'object' ? draft.zones : {};
    const api = getApi();
    if(!draft.zones[zoneKey]) draft.zones[zoneKey] = api.normalizeZonePreferences ? api.normalizeZonePreferences(null) : { bodyColor:'', frontMaterial:'', frontColor:'', backMaterial:'', openingSystem:'' };
    return draft.zones[zoneKey];
  }

  function buildZoneCard(zoneKey, draft, refreshers, refreshAll){
    const api = getApi();
    const zonesMeta = api.ROOM_PREFERENCE_ZONES || {};
    const meta = zonesMeta[zoneKey] || { label:zoneKey };
    const zone = ensureZone(draft, zoneKey);
    const card = h('section', { class:'wywiad-zone-card wywiad-zone-card--' + zoneKey });
    card.appendChild(h('div', { class:'wywiad-zone-card__title', text:meta.label || zoneKey }));
    const grid = h('div', { class:'wywiad-zone-grid' });

    const openingOptionsKey = meta.openingOptionsKey || (zoneKey === 'upper' ? 'hanging' : (zoneKey === 'middle' ? 'module' : 'standing'));
    const openingOptions = ()=> ((api.OPENING_OPTIONS || {})[openingOptionsKey] || []);
    const fields = [
      { label:'Korpus', title:'Wybierz korpus — ' + (meta.shortLabel || meta.label), get:()=> zone.bodyColor, set:(d,v)=>{ ensureZone(d, zoneKey).bodyColor = text(v); }, options:getBodyMaterialNames },
      { label:'Materiał frontu', title:'Wybierz materiał frontu — ' + (meta.shortLabel || meta.label), get:()=> zone.frontMaterial, set:(d,v)=>{ ensureZone(d, zoneKey).frontMaterial = text(v); }, options:getMaterialTypes, onChange:(d)=>{ const z = ensureZone(d, zoneKey); if(!getMaterialNamesByType(z.frontMaterial || 'laminat').includes(text(z.frontColor))) z.frontColor = ''; } },
      { label:'Kolor frontu', title:'Wybierz kolor frontu — ' + (meta.shortLabel || meta.label), get:()=> zone.frontColor, set:(d,v)=>{ ensureZone(d, zoneKey).frontColor = text(v); }, options:()=> getMaterialNamesByType(zone.frontMaterial || 'laminat') },
      { label:'Plecy', title:'Wybierz plecy — ' + (meta.shortLabel || meta.label), get:()=> zone.backMaterial, set:(d,v)=>{ ensureZone(d, zoneKey).backMaterial = text(v); }, options:BACK_MATERIALS },
      { label:'Otwieranie', title:'Wybierz otwieranie — ' + (meta.shortLabel || meta.label), get:()=> zone.openingSystem, set:(d,v)=>{ ensureZone(d, zoneKey).openingSystem = text(v); }, options:openingOptions }
    ];
    fields.forEach((cfg)=>{
      const field = makeChoiceField(cfg, draft, refreshAll);
      refreshers.push(field.refresh);
      grid.appendChild(field.wrap);
    });
    card.appendChild(grid);
    return card;
  }

  function buildPreferencesContent(room, draft){
    const form = h('div', { class:'wywiad-room-inline-form wywiad-room-inline-form--preferences wywiad-room-inline-form--zones' });
    const api = getApi();
    const refreshers = [];

    const summary = h('div', { class:'wywiad-room-shell__stats-line wywiad-room-inline-form__summary' });
    const refreshSummary = ()=>{ summary.innerHTML = '<strong>Materiały i kolory:</strong> ' + escapeHtml(api && typeof api.getSummary === 'function' ? api.getSummary(draft) : 'Brak zapisanych preferencji.'); };
    form.appendChild(summary);

    const note = h('div', { class:'wywiad-room-inline-form__note muted xs', text:'Strefy pokoju mają pierwszeństwo przed globalnymi domyślnymi z trybiku. Istniejące szafki nie są zmieniane w tym etapie.' });
    form.appendChild(note);

    const general = h('section', { class:'wywiad-zone-card wywiad-zone-card--general' });
    general.appendChild(h('div', { class:'wywiad-zone-card__title', text:'Standardy ogólne pomieszczenia' }));
    const generalGrid = h('div', { class:'wywiad-zone-grid' });
    [
      { key:'finishStandard', label:'Standard wykończenia', title:'Wybierz standard wykończenia', options:FINISH_STANDARDS },
      { key:'blendStandard', label:'Standard blend', title:'Wybierz standard blend', options:BLEND_STANDARDS }
    ].forEach((cfg)=>{
      const field = makeChoiceField({
        label:cfg.label,
        title:cfg.title,
        get:(d)=> d[cfg.key],
        set:(d,v)=>{ d[cfg.key] = text(v); },
        options:cfg.options
      }, draft, ()=>{ refreshSummary(); refreshers.forEach((fn)=>{ try{ fn(); }catch(_){ } }); });
      refreshers.push(field.refresh);
      generalGrid.appendChild(field.wrap);
    });
    general.appendChild(generalGrid);
    form.appendChild(general);

    const refreshAll = ()=>{
      refreshSummary();
      refreshers.forEach((fn)=>{ try{ fn(); }catch(_){ } });
    };
    const zoneKeys = Array.isArray(api.ZONE_KEYS) ? api.ZONE_KEYS : ['lower','middle','upper'];
    zoneKeys.forEach((zoneKey)=> form.appendChild(buildZoneCard(zoneKey, draft, refreshers, refreshAll)));

    const bulkBtn = h('button', { type:'button', class:'btn wywiad-room-inline-form__bulk', text:'Zastosuj do istniejących szafek' });
    bulkBtn.addEventListener('click', ()=>{
      try{
        if(ns.wywiadRoomPreferencesBulk && typeof ns.wywiadRoomPreferencesBulk.open === 'function') ns.wywiadRoomPreferencesBulk.open(room);
      }catch(_){ }
    });
    form.appendChild(createSaveFooter('Preferencje materiałów i kolorów', [bulkBtn], ()=>{
      const nextApi = getApi();
      if(nextApi && typeof nextApi.setRoomPreferences === 'function') nextApi.setRoomPreferences(room, draft);
      renderSummary(room);
    }));
    refreshAll();
    return form;
  }

  function buildInlineForm(room, draft){
    return buildPreferencesContent(room, draft);
  }

  function buildForm(room, draft){
    const form = h('div', { class:'panel-box-form rozrys-panel-form rozrys-panel-form--stock wywiad-room-settings-modal wywiad-room-preferences-modal investor-card-sync' });
    const scroll = h('div', { class:'panel-box-form__scroll wywiad-room-settings-modal__scroll' });
    const intro = h('div', { class:'wywiad-room-settings-modal__intro' });
    intro.appendChild(h('div', { class:'wywiad-room-settings-modal__room', text:getRoomLabel(room) }));
    intro.appendChild(h('div', { class:'wywiad-room-settings-modal__auto wywiad-room-preferences-modal__note', text:'Preferencje są strefowe: dolna/stojące, środkowa/moduły i górna/wiszące.' }));
    scroll.appendChild(intro);
    scroll.appendChild(buildPreferencesContent(room, draft));
    form.appendChild(scroll);

    const footer = h('div', { class:'panel-box-form__footer rozrys-picker-footer rozrys-picker-footer--material wywiad-room-settings-modal__footer' });
    const exitBtn = h('button', { type:'button', class:'btn', text:'Wyjdź' });
    exitBtn.addEventListener('click', ()=> close());
    const saveBtn = h('button', { type:'button', class:'btn btn-success', text:'Zapisz' });
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
    wrap.appendChild(buildInlineForm(room, prefs));
    bindTriggerButtons(document);
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>\"]/g, (ch)=> ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch] || ch));
  }

  function open(){
    const room = getCurrentRoom();
    if(!room) return false;
    const api = getApi();
    if(!(ns.panelBox && typeof ns.panelBox.open === 'function')) return false;
    const draft = api && typeof api.getRoomPreferences === 'function' ? api.getRoomPreferences(room) : {};
    const form = buildForm(room, draft);
    ns.panelBox.open({
      title:'Preferencje materiałów i kolorów',
      contentNode: form,
      width:'860px',
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
    renderSummary,
    buildInlineForm,
    open,
    close
  });
})();
