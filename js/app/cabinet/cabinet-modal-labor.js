// js/app/cabinet/cabinet-modal-labor.js
// Wybór czynności robocizny przypiętych do konkretnej szafki w WYWIADZIE.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function qty(value){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  function make(tag, className, textContent){
    const el = document.createElement(tag);
    if(className) el.className = className;
    if(textContent != null) el.textContent = textContent;
    return el;
  }
  function normalize(row){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' ? FC.laborCatalog.normalizeDefinition(row) : row; }
    catch(_){ return row; }
  }
  function getDefinitions(){
    try{
      const rows = FC.catalogStore && typeof FC.catalogStore.getPriceList === 'function' ? FC.catalogStore.getPriceList('quoteRates') : [];
      return (Array.isArray(rows) ? rows : []).map(normalize).filter((row)=> {
        if(!row || row.active === false) return false;
        return String(row.autoRole || 'none') === 'none';
      }).sort((a,b)=> String(a.category || '').localeCompare(String(b.category || ''), 'pl') || String(a.name || '').localeCompare(String(b.name || ''), 'pl'));
    }catch(_){ return []; }
  }
  function ensureItems(draft){
    if(!draft) return [];
    draft.laborItems = Array.isArray(draft.laborItems) ? draft.laborItems : [];
    draft.laborItems = draft.laborItems.map((item)=> ({ rateId:text(item && rateIdOf(item)), qty:qty(item && item.qty), note:text(item && item.note) })).filter((item)=> !!item.rateId);
    return draft.laborItems;
  }
  function rateIdOf(item){ return item && (item.rateId || item.id); }
  function describe(def){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.describeDefinition === 'function' ? FC.laborCatalog.describeDefinition(def) : ''; }
    catch(_){ return ''; }
  }
  function mountLaunchers(root){
    try{
      const launcherApi = FC.cabinetChoiceLaunchers;
      if(launcherApi && typeof launcherApi.mountDynamicSelectLaunchers === 'function') launcherApi.mountDynamicSelectLaunchers(root);
    }catch(_){ }
  }

  function renderApplianceSection(card, draft, rerender){
    const api = FC.laborApplianceRules;
    if(!(api && typeof api.getApplianceForCabinet === 'function')) return;
    const appliance = api.getApplianceForCabinet(draft);
    if(!appliance) return;
    const box = make('div', 'cabinet-labor-appliance');
    box.appendChild(make('div', 'cabinet-labor-appliance__title', 'Montaż sprzętu'));
    box.appendChild(make('div', 'cabinet-labor-appliance__sub', appliance.label + ' — domyślnie doliczany, ale można wyłączyć.'));
    const choices = make('div', 'cabinet-labor-appliance__choices');
    const current = api.getMountingMode(draft);
    const groupName = 'cabinet-appliance-mounting-' + String(draft.id || draft.tempId || 'draft');
    [
      { value:api.MODE_MOUNT || 'mount', label:'Z montażem' },
      { value:api.MODE_NONE || 'none', label:'Bez montażu' },
    ].forEach((opt)=>{
      const chip = make('label', `rozrys-scope-chip cabinet-labor-appliance__choice${current === opt.value ? ' is-checked' : ''}`);
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.name = groupName;
      cb.checked = current === opt.value;
      const label = make('span', '', opt.label);
      const apply = ()=>{
        api.setMountingMode(draft, opt.value);
        if(typeof rerender === 'function') rerender();
      };
      cb.addEventListener('change', (event)=>{
        try{ event.stopPropagation(); }catch(_){ }
        if(!cb.checked){ cb.checked = true; return; }
        apply();
      });
      chip.addEventListener('click', (event)=>{
        try{ event.stopPropagation(); }catch(_){ }
      });
      chip.appendChild(cb);
      chip.appendChild(label);
      choices.appendChild(chip);
    });
    box.appendChild(choices);
    card.appendChild(box);
  }

  function renderAddRow(card, draft, definitions, rerender){
    const form = make('div', 'cabinet-labor-add-row');
    const select = make('select', 'cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source');
    select.setAttribute('data-launcher-label', 'Czynność');
    select.setAttribute('data-choice-title', 'Wybierz czynność robocizny');
    select.setAttribute('data-choice-placeholder', 'Czynność robocizny');
    definitions.forEach((def)=> {
      const opt = document.createElement('option');
      opt.value = def.id;
      opt.textContent = `${def.category ? def.category + ' • ' : ''}${def.name || def.id}`;
      select.appendChild(opt);
    });
    const input = make('input', 'cabinet-extra-field__control cabinet-labor-qty');
    input.type = 'number'; input.min = '1'; input.step = '1'; input.value = '1';
    const btn = make('button', 'btn cabinet-labor-add-btn', 'Dodaj');
    btn.type = 'button';
    btn.addEventListener('click', (event)=> {
      try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
      const rateId = text(select.value);
      if(!rateId) return;
      const rows = ensureItems(draft);
      const existing = rows.find((item)=> item.rateId === rateId);
      if(existing) existing.qty = qty(existing.qty) + qty(input.value);
      else rows.push({ rateId, qty:qty(input.value), note:'' });
      draft.laborItems = rows;
      if(typeof rerender === 'function') rerender();
    });
    form.appendChild(select); form.appendChild(input); form.appendChild(btn);
    card.appendChild(form);
  }

  function renderSelectedList(card, draft, definitions, rerender){
    const items = ensureItems(draft);
    const list = make('div', 'cabinet-labor-list');
    const map = new Map(definitions.map((def)=> [String(def.id), def]));
    if(!items.length){
      list.appendChild(make('div', 'cabinet-labor-empty', 'Brak dodatkowych czynności przy tej szafce.'));
    } else {
      items.forEach((item, index)=> {
        const def = map.get(String(item.rateId));
        const row = make('div', 'cabinet-labor-item');
        const info = make('div', 'cabinet-labor-item__info');
        info.appendChild(make('div', 'cabinet-labor-item__name', def ? def.name : item.rateId));
        info.appendChild(make('div', 'cabinet-labor-item__meta', `Ilość: ${qty(item.qty)}${def ? ' • ' + describe(def) : ''}`));
        const actions = make('div', 'cabinet-labor-item__actions');
        const q = make('input', 'cabinet-extra-field__control cabinet-labor-item__qty');
        q.type = 'number'; q.min = '1'; q.step = '1'; q.value = String(qty(item.qty));
        q.addEventListener('change', ()=> { item.qty = qty(q.value); draft.laborItems = ensureItems(draft); if(typeof rerender === 'function') rerender(); });
        const remove = make('button', 'btn btn-danger cabinet-labor-remove', 'Usuń');
        remove.type = 'button';
        remove.addEventListener('click', (event)=> {
          try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
          draft.laborItems = ensureItems(draft).filter((_, idx)=> idx !== index);
          if(typeof rerender === 'function') rerender();
        });
        actions.appendChild(q); actions.appendChild(remove);
        row.appendChild(info); row.appendChild(actions);
        list.appendChild(row);
      });
    }
    card.appendChild(list);
  }

  function renderLaborSection(container, draft, rerender){
    if(!container || !draft) return null;
    const definitions = getDefinitions();
    ensureItems(draft);
    container.innerHTML = '';
    const card = make('div', 'cabinet-labor-card');
    const head = make('div', 'cabinet-labor-card__head');
    head.appendChild(make('div', 'cabinet-labor-card__title', 'Czynności robocizny'));
    head.appendChild(make('div', 'cabinet-labor-card__sub', 'Dodaj czynności do tej szafki. Ta sama pula czynności jest dostępna też w zakładce CZYNNOŚCI.'));
    card.appendChild(head);
    renderApplianceSection(card, draft, rerender);
    if(!definitions.length){
      card.appendChild(make('div', 'cabinet-labor-empty', 'Brak aktywnych czynności w cenniku robocizny.'));
      container.appendChild(card);
      return card;
    }
    renderAddRow(card, draft, definitions, rerender);
    renderSelectedList(card, draft, definitions, rerender);
    container.appendChild(card);
    mountLaunchers(container);
    return card;
  }

  FC.cabinetModalLabor = { getDefinitions, ensureItems, renderLaborSection };
})();
