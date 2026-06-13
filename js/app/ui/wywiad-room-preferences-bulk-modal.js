// js/app/ui/wywiad-room-preferences-bulk-modal.js
// Etap 2A: modal aplikacyjny do zastosowania preferencji strefowych do istniejących szafek.

(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const DEFAULT_SELECTION = {
    zones:{ lower:true, middle:true, upper:true },
    fields:{ body:true, front:true, back:false, opening:false, pcv:false }
  };

  function text(value){ return String(value == null ? '' : value).trim(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }
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

  function getCurrentRoom(){
    try{ if(ns.uiState && typeof ns.uiState.get === 'function') return text((ns.uiState.get() || {}).roomType); }catch(_){ }
    try{ return text(uiState && uiState.roomType); }catch(_){ return ''; }
  }

  function roomLabel(room){
    try{ if(ns.roomRegistry && typeof ns.roomRegistry.getRoomLabel === 'function') return ns.roomRegistry.getRoomLabel(room); }catch(_){ }
    return text(room) || 'Pomieszczenie';
  }

  function getPlanner(){ return ns.roomPreferencesBulkPlan || {}; }
  function getApplyApi(){ return ns.roomPreferencesBulkApply || {}; }

  function normalizeSelection(selection){
    const planner = getPlanner();
    if(planner && typeof planner.normalizeSelection === 'function') return planner.normalizeSelection(selection || DEFAULT_SELECTION);
    return clone(selection || DEFAULT_SELECTION);
  }

  function buildPlan(room, selection){
    const planner = getPlanner();
    if(planner && typeof planner.buildPlan === 'function') return planner.buildPlan(room, selection);
    return { ready:false, total:0, hasChanges:false, notes:['Brak planera zmian.'], byZone:{} };
  }

  function makeToggle(label, active, onClick){
    const btn = h('button', { type:'button', class:'room-bulk-toggle' + (active ? ' is-selected' : ''), 'aria-pressed': active ? 'true' : 'false', text:label });
    btn.addEventListener('click', ()=>{
      if(typeof onClick === 'function') onClick();
    });
    return btn;
  }

  function buildToggleGroup(title, items, values, onToggle){
    const section = h('section', { class:'room-bulk-section' });
    section.appendChild(h('div', { class:'room-bulk-section__title', text:title }));
    const grid = h('div', { class:'room-bulk-toggle-grid' });
    items.forEach((item)=>{
      grid.appendChild(makeToggle(item.label, !!values[item.key], ()=> onToggle(item.key)));
    });
    section.appendChild(grid);
    return section;
  }

  function formatCount(value, unit){
    const n = Number(value) || 0;
    if(!n) return '0';
    return String(n) + ' ' + unit;
  }

  function buildPlanPreview(plan){
    const wrap = h('div', { class:'room-bulk-preview' });
    if(!plan.ready){
      wrap.appendChild(h('div', { class:'room-bulk-empty', text:(plan.notes || []).join(' ') || 'Wybierz strefy i typ zmian.' }));
      return wrap;
    }
    if(!plan.hasChanges){
      wrap.appendChild(h('div', { class:'room-bulk-empty', text:'Brak realnych różnic do zastosowania dla wybranego zakresu.' }));
      (plan.notes || []).forEach((note)=> wrap.appendChild(h('div', { class:'room-bulk-note', text:note })));
      return wrap;
    }

    wrap.appendChild(h('div', { class:'room-bulk-total', text:'Łącznie do zmiany: ' + plan.total }));
    const planner = getPlanner();
    const zoneKeys = planner.ZONE_KEYS || ['lower','middle','upper'];
    const fieldKeys = planner.FIELD_KEYS || ['body','front','back','opening','pcv'];
    const zoneLabels = planner.ZONE_LABELS || {};
    const fieldLabels = planner.FIELD_LABELS || {};

    zoneKeys.forEach((zoneKey)=>{
      const row = plan.byZone && plan.byZone[zoneKey];
      if(!row) return;
      const card = h('div', { class:'room-bulk-preview-card' });
      card.appendChild(h('div', { class:'room-bulk-preview-card__title', text:zoneLabels[zoneKey] || zoneKey }));
      const list = h('div', { class:'room-bulk-preview-list' });
      fieldKeys.forEach((fieldKey)=>{
        const qty = row.fields && row.fields[fieldKey];
        if(!qty) return;
        list.appendChild(h('div', { class:'room-bulk-preview-row' }, [
          h('span', { text:fieldLabels[fieldKey] || fieldKey }),
          h('strong', { text:formatCount(qty, fieldKey === 'front' ? 'frontów' : 'szafek') })
        ]));
      });
      card.appendChild(list);
      wrap.appendChild(card);
    });
    (plan.notes || []).forEach((note)=> wrap.appendChild(h('div', { class:'room-bulk-note', text:note })));
    return wrap;
  }

  function open(roomArg){
    const room = text(roomArg || getCurrentRoom());
    if(!room) return false;
    if(!(ns.panelBox && typeof ns.panelBox.open === 'function')) return false;
    const state = { selection:normalizeSelection(DEFAULT_SELECTION), plan:null };
    const previewHost = h('div', { class:'room-bulk-preview-host' });
    const applyBtn = h('button', { type:'button', class:'btn btn-success', text:'Zastosuj' });

    const renderPreview = ()=>{
      state.plan = buildPlan(room, state.selection);
      previewHost.innerHTML = '';
      previewHost.appendChild(buildPlanPreview(state.plan));
      applyBtn.disabled = !(state.plan && state.plan.ready && state.plan.hasChanges);
      applyBtn.classList.toggle('is-disabled', !!applyBtn.disabled);
    };

    const content = h('div', { class:'panel-box-form rozrys-panel-form room-bulk-modal investor-card-sync' });
    const scroll = h('div', { class:'panel-box-form__scroll room-bulk-modal__scroll' });
    scroll.appendChild(h('div', { class:'room-bulk-intro' }, [
      h('div', { class:'room-bulk-intro__room', text:roomLabel(room) }),
      h('div', { class:'room-bulk-intro__text', text:'Wybierz strefy i elementy, które mają dostać aktualne preferencje. Program najpierw pokazuje licznik, a dopiero potem zapisuje zmiany.' })
    ]));

    const zones = [
      { key:'lower', label:'Dolna / stojące' },
      { key:'middle', label:'Środkowa / moduły' },
      { key:'upper', label:'Górna / wiszące' }
    ];
    const fields = [
      { key:'body', label:'Korpus' },
      { key:'front', label:'Fronty' },
      { key:'back', label:'Plecy' },
      { key:'opening', label:'Otwieranie' },
      { key:'pcv', label:'PCV korpusu' }
    ];
    scroll.appendChild(buildToggleGroup('Zakres stref', zones, state.selection.zones, (key)=>{ state.selection.zones[key] = !state.selection.zones[key]; render(); }));
    scroll.appendChild(buildToggleGroup('Co zmienić', fields, state.selection.fields, (key)=>{ state.selection.fields[key] = !state.selection.fields[key]; render(); }));
    scroll.appendChild(previewHost);
    content.appendChild(scroll);

    const footer = h('div', { class:'panel-box-form__footer rozrys-picker-footer room-bulk-modal__footer' });
    const exitBtn = h('button', { type:'button', class:'btn', text:'Wyjdź' });
    exitBtn.addEventListener('click', close);
    applyBtn.addEventListener('click', ()=>{
      if(applyBtn.disabled) return;
      const api = getApplyApi();
      if(api && typeof api.apply === 'function') api.apply(room, state.selection);
      close();
    });
    footer.appendChild(exitBtn);
    footer.appendChild(applyBtn);
    content.appendChild(footer);

    function render(){
      const oldScroll = content.querySelector('.room-bulk-modal__scroll');
      if(!oldScroll) return renderPreview();
      oldScroll.innerHTML = '';
      oldScroll.appendChild(h('div', { class:'room-bulk-intro' }, [
        h('div', { class:'room-bulk-intro__room', text:roomLabel(room) }),
        h('div', { class:'room-bulk-intro__text', text:'Wybierz strefy i elementy, które mają dostać aktualne preferencje. Program najpierw pokazuje licznik, a dopiero potem zapisuje zmiany.' })
      ]));
      oldScroll.appendChild(buildToggleGroup('Zakres stref', zones, state.selection.zones, (key)=>{ state.selection.zones[key] = !state.selection.zones[key]; render(); }));
      oldScroll.appendChild(buildToggleGroup('Co zmienić', fields, state.selection.fields, (key)=>{ state.selection.fields[key] = !state.selection.fields[key]; render(); }));
      oldScroll.appendChild(previewHost);
      renderPreview();
    }

    renderPreview();
    ns.panelBox.open({
      title:'Zastosuj preferencje do szafek',
      contentNode:content,
      width:'860px',
      boxClass:'panel-box--rozrys room-bulk-box',
      dismissOnOverlay:true,
      dismissOnEsc:true
    });
    return true;
  }

  function close(){
    try{ if(ns.panelBox && typeof ns.panelBox.close === 'function') ns.panelBox.close(); }catch(_){ }
    return true;
  }

  ns.wywiadRoomPreferencesBulk = { open, close };
})();
