// js/app/ui/wywiad-room-hardware-producers.js
// WYWIAD: preferencje producentów okuć wybierane z istniejących producentów katalogu.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});
  const EMPTY_OPTION = '— nie ustawiaj —';
  const draftCache = {};

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

  function unique(list){
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((item)=>{
      const value = text(item);
      const key = value.toLowerCase();
      if(!value || seen.has(key)) return;
      seen.add(key);
      out.push(value);
    });
    return out;
  }

  function clone(value){
    try{ if(ns.utils && typeof ns.utils.clone === 'function') return ns.utils.clone(value); }catch(_){ }
    try{ return JSON.parse(JSON.stringify(value || {})); }catch(_){ return value && typeof value === 'object' ? Object.assign({}, value) : {}; }
  }

  function draftKey(room){ return text(room) || '__current__'; }

  function rememberDraft(room, draft){
    const key = draftKey(room);
    if(!key) return;
    draftCache[key] = clone(draft || {});
  }

  function clearDraft(room){ delete draftCache[draftKey(room)]; }

  function getWorkingPreferences(room, preferences){
    const api = getApi();
    const normalized = api.normalizeRoomPreferences ? api.normalizeRoomPreferences(preferences) : clone(preferences || {});
    const cached = draftCache[draftKey(room)];
    return cached ? (api.normalizeRoomPreferences ? api.normalizeRoomPreferences(cached) : clone(cached)) : normalized;
  }

  function getSharedUiState(){
    try{ if(typeof uiState !== 'undefined' && uiState && typeof uiState === 'object') return uiState; }catch(_){ }
    try{ if(window.uiState && typeof window.uiState === 'object') return window.uiState; }catch(_){ }
    return null;
  }

  function getCurrentRoom(){
    try{ const state = getSharedUiState(); return text(state && state.roomType); }catch(_){ return ''; }
  }

  function getHardwareManufacturers(){
    try{
      if(ns.catalogStore && typeof ns.catalogStore.getHardwareManufacturers === 'function'){
        return unique(ns.catalogStore.getHardwareManufacturers());
      }
    }catch(_){ }
    try{
      if(ns.hardwareCatalog && Array.isArray(ns.hardwareCatalog.DEFAULT_MANUFACTURERS)) return unique(ns.hardwareCatalog.DEFAULT_MANUFACTURERS);
    }catch(_){ }
    return [];
  }

  function optionList(values){
    const out = [{ value:'', label:EMPTY_OPTION }];
    unique(values || []).forEach((value)=> out.push({ value, label:value }));
    return out;
  }

  function getChoiceApi(){
    const api = ns.rozrysChoice;
    if(api && typeof api.createChoiceLauncher === 'function' && typeof api.openRozrysChoiceOverlay === 'function' && typeof api.setChoiceLaunchValue === 'function') return api;
    return null;
  }

  function selectedLabel(options, value){
    const current = text(value);
    if(!current) return EMPTY_OPTION;
    const hit = unique(options || []).find((row)=> row.toLowerCase() === current.toLowerCase());
    return hit || EMPTY_OPTION;
  }

  function makeChoiceButton(label){
    const api = getChoiceApi();
    if(api){
      const btn = api.createChoiceLauncher(label, '');
      btn.classList.add('wywiad-zone-choice', 'wywiad-hardware-choice', 'rozrys-choice-launch--options-clean');
      return btn;
    }
    return h('button', { type:'button', class:'rozrys-choice-launch rozrys-choice-launch--options-clean wywiad-zone-choice wywiad-hardware-choice', text:String(label || '') });
  }

  function setChoiceButtonLabel(btn, label){
    const api = getChoiceApi();
    if(api && typeof api.setChoiceLaunchValue === 'function') return api.setChoiceLaunchValue(btn, label, '');
    btn.textContent = String(label || '');
  }

  async function openChoice(title, options, value){
    const api = getChoiceApi();
    if(api && typeof api.openRozrysChoiceOverlay === 'function') return api.openRozrysChoiceOverlay({ title, value:String(value || ''), options });
    return null;
  }

  function canonicalManufacturer(value, options){
    const raw = text(value);
    if(!raw) return '';
    const rows = unique(options || []);
    if(!rows.length) return raw;
    return rows.find((item)=> item.toLowerCase() === raw.toLowerCase()) || '';
  }

  function ensureHardwareDraft(draft){
    const api = getApi();
    const normalized = api.normalizeRoomPreferences ? api.normalizeRoomPreferences(draft) : (draft || {});
    draft.hardwareProducers = Object.assign({}, normalized.hardwareProducers || {});
    return draft.hardwareProducers;
  }

  function sanitizeDraftToExistingManufacturers(draft, options){
    const values = ensureHardwareDraft(draft);
    const api = getApi();
    const groups = Array.isArray(api.HARDWARE_PRODUCER_GROUPS) ? api.HARDWARE_PRODUCER_GROUPS : [];
    groups.forEach((group)=>{
      const key = text(group && group.key);
      if(!key) return;
      values[key] = canonicalManufacturer(values[key], options);
    });
    return draft;
  }

  function openInfo(title, message){
    try{
      if(ns.infoBox && typeof ns.infoBox.open === 'function') return ns.infoBox.open({ title, message });
    }catch(_){ }
  }

  function makeInfoButton(title, message){
    const btn = h('button', { type:'button', class:'info-trigger wywiad-hardware-info', 'aria-label':'Pokaż informację: ' + title });
    btn.addEventListener('click', (event)=>{
      try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
      openInfo(title, message);
    });
    return btn;
  }


  function createSaveFooter(sectionTitle, onSave){
    const api = ns.wywiadRoomAccordionActions;
    if(api && typeof api.createSaveFooter === 'function'){
      return api.createSaveFooter({ sectionTitle, buttonText:'Zapisz zmiany', onSave }).footer;
    }
    const footer = h('div', { class:'wywiad-room-inline-form__footer' });
    const saveBtn = h('button', { type:'button', class:'btn btn-success wywiad-room-inline-form__save', text:'Zapisz zmiany', 'aria-label':'Zapisz zmiany — ' + sectionTitle });
    saveBtn.addEventListener('click', onSave);
    footer.appendChild(saveBtn);
    return footer;
  }

  function makeProducerField(room, group, draft, form, refreshAll){
    const options = getHardwareManufacturers();
    const values = ensureHardwareDraft(draft);
    const key = text(group && group.key);
    const wrap = h('div', { class:'wywiad-zone-field wywiad-hardware-field wywiad-hardware-field--' + key });
    const labelRow = h('div', { class:'wywiad-hardware-field__label-row' });
    labelRow.appendChild(h('div', { class:'wywiad-zone-field__label', text:group.label || key }));
    if(key === 'accessories'){
      labelRow.appendChild(makeInfoButton('Pozostałe akcesoria', 'Dotyczy elementów takich jak wkłady na sztućce, sortowniki do szuflad, ociekarki, kosze i podobne akcesoria. Wybór jest tylko z istniejących producentów okuć w katalogu.'));
    }
    wrap.appendChild(labelRow);
    const current = canonicalManufacturer(values[key], options);
    values[key] = current;
    const btn = makeChoiceButton(selectedLabel(options, current));
    btn.setAttribute('aria-label', 'Wybierz producenta: ' + (group.label || key));
    btn.setAttribute('data-hardware-producer-key', key);
    btn.setAttribute('data-hardware-producer-value', current);
    btn.addEventListener('click', async ()=>{
      const nextOptions = getHardwareManufacturers();
      const picked = await openChoice('Wybierz producenta — ' + (group.label || key), optionList(nextOptions), values[key]);
      if(picked == null) return;
      values[key] = canonicalManufacturer(picked, nextOptions);
      btn.setAttribute('data-hardware-producer-value', values[key]);
      rememberDraft(room, draft);
      setChoiceButtonLabel(btn, selectedLabel(nextOptions, values[key]));
      if(typeof refreshAll === 'function') refreshAll();
    });
    wrap.appendChild(btn);
    return {
      wrap,
      refresh(){
        const nextOptions = getHardwareManufacturers();
        values[key] = canonicalManufacturer(values[key], nextOptions);
        btn.setAttribute('data-hardware-producer-value', values[key]);
        setChoiceButtonLabel(btn, selectedLabel(nextOptions, values[key]));
      }
    };
  }

  function readFormSelections(form, draft){
    const values = ensureHardwareDraft(draft);
    const options = getHardwareManufacturers();
    const buttons = form && typeof form.querySelectorAll === 'function'
      ? Array.from(form.querySelectorAll('[data-hardware-producer-key]'))
      : [];
    buttons.forEach((btn)=>{
      const key = text(btn && btn.getAttribute && btn.getAttribute('data-hardware-producer-key'));
      if(!key) return;
      values[key] = canonicalManufacturer(btn.getAttribute('data-hardware-producer-value'), options);
    });
    return draft;
  }

  function buildInlineForm(room, draft){
    const api = getApi();
    const normalized = getWorkingPreferences(room, draft);
    const working = Object.assign({}, normalized, { hardwareProducers:Object.assign({}, normalized.hardwareProducers || {}) });
    const manufacturerOptions = getHardwareManufacturers();
    sanitizeDraftToExistingManufacturers(working, manufacturerOptions);

    const form = h('div', { class:'wywiad-room-inline-form wywiad-room-inline-form--hardware-producers' });
    const refreshers = [];
    const summary = h('div', { class:'wywiad-room-shell__stats-line wywiad-room-inline-form__summary' });
    const refreshSummary = ()=>{
      const textSummary = api && typeof api.getHardwareProducerSummary === 'function'
        ? api.getHardwareProducerSummary(working)
        : 'Brak preferencji producentów okuć.';
      summary.innerHTML = '<strong>Producenci okuć:</strong> ' + escapeHtml(textSummary);
    };
    form.appendChild(summary);

    const card = h('section', { class:'wywiad-zone-card wywiad-hardware-card' });
    const titleRow = h('div', { class:'wywiad-hardware-card__title-row' }, [
      h('div', { class:'wywiad-zone-card__title', text:'Wybór z katalogu producentów okuć' })
    ]);
    titleRow.appendChild(makeInfoButton('Preferencje producentów okuć', 'Tu ustawiasz preferowanych producentów okuć dla tego pomieszczenia. Lista pochodzi z istniejących producentów w katalogu okuć. Ustawienia pomieszczenia mają pierwszeństwo przed globalnymi domyślnymi programu.'));
    card.appendChild(titleRow);

    const grid = h('div', { class:'wywiad-zone-grid wywiad-hardware-grid' });
    const groups = Array.isArray(api.HARDWARE_PRODUCER_GROUPS) ? api.HARDWARE_PRODUCER_GROUPS : [];
    groups.forEach((group)=>{
      const field = makeProducerField(room, group, working, form, ()=>{ refreshSummary(); refreshers.forEach((fn)=>{ try{ fn(); }catch(_){ } }); });
      refreshers.push(field.refresh);
      grid.appendChild(field.wrap);
    });
    card.appendChild(grid);
    form.appendChild(card);

    form.appendChild(createSaveFooter('Preferencje producentów okuć', ()=>{
      const nextApi = getApi();
      readFormSelections(form, working);
      sanitizeDraftToExistingManufacturers(working, getHardwareManufacturers());
      rememberDraft(room, working);
      if(nextApi && typeof nextApi.setRoomPreferences === 'function') nextApi.setRoomPreferences(room, working);
      clearDraft(room);
      renderSummary(room);
      try{ if(ns.wywiadRoomPreferences && typeof ns.wywiadRoomPreferences.renderSummary === 'function') ns.wywiadRoomPreferences.renderSummary(room); }catch(_){ }
    }));
    refreshSummary();
    refreshers.forEach((fn)=>{ try{ fn(); }catch(_){ } });
    return form;
  }

  function renderSummary(roomArg){
    const room = text(roomArg || getCurrentRoom());
    const wrap = document.getElementById('roomHardwareProducerPreferencesSummary');
    if(!wrap || !room) return;
    const api = getApi();
    const prefs = api && typeof api.getRoomPreferences === 'function' ? api.getRoomPreferences(room) : {};
    wrap.innerHTML = '';
    wrap.appendChild(buildInlineForm(room, prefs));
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>\"]/g, (ch)=> ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch] || ch));
  }

  ns.wywiadRoomHardwareProducers = Object.assign({}, ns.wywiadRoomHardwareProducers || {}, {
    renderSummary,
    buildInlineForm
  });
})();
