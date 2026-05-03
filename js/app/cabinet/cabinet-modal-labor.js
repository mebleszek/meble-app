// js/app/cabinet/cabinet-modal-labor.js
// Wybór dodatkowych czynności robocizny przypiętych do konkretnej szafki w WYWIADZIE.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function qty(value){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  function getDefinitions(){
    try{
      const rows = FC.catalogStore && typeof FC.catalogStore.getPriceList === 'function' ? FC.catalogStore.getPriceList('quoteRates') : [];
      const labor = FC.laborCatalog || null;
      return (Array.isArray(rows) ? rows : []).map((row)=> labor && typeof labor.normalizeDefinition === 'function' ? labor.normalizeDefinition(row) : row).filter((row)=> {
        if(!row || row.active === false) return false;
        return String(row.usage || '') === 'cabinet' && String(row.autoRole || 'none') === 'none';
      });
    }catch(_){ return []; }
  }
  function ensureItems(draft){
    if(!draft) return [];
    draft.laborItems = Array.isArray(draft.laborItems) ? draft.laborItems : [];
    draft.laborItems = draft.laborItems.map((item)=> ({ rateId:text(item && item.rateId), qty:qty(item && item.qty), note:text(item && item.note) })).filter((item)=> !!item.rateId);
    return draft.laborItems;
  }
  function make(tag, className, textContent){
    const el = document.createElement(tag);
    if(className) el.className = className;
    if(textContent != null) el.textContent = textContent;
    return el;
  }
  function describe(def){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.describeDefinition === 'function' ? FC.laborCatalog.describeDefinition(def) : ''; }
    catch(_){ return ''; }
  }
  function renderLaborSection(container, draft, rerender){
    if(!container || !draft) return null;
    const definitions = getDefinitions();
    const items = ensureItems(draft);
    container.innerHTML = '';
    const card = make('div', 'cabinet-labor-card');
    const head = make('div', 'cabinet-labor-card__head');
    const title = make('div', 'cabinet-labor-card__title', 'Dodatki robocizny');
    const sub = make('div', 'cabinet-labor-card__sub', 'Wybierz czynności dodatkowe przypięte do tej konkretnej szafki. Koszty są wewnętrzne i widoczne w WYCENIE.');
    head.appendChild(title);
    head.appendChild(sub);
    card.appendChild(head);

    if(!definitions.length){
      card.appendChild(make('div', 'cabinet-labor-empty', 'Brak aktywnych usług dla szafki w cenniku robocizny.'));
      container.appendChild(card);
      return card;
    }

    const form = make('div', 'cabinet-labor-add-row');
    const select = make('select', 'cabinet-choice-source cabinet-extra-field__control cabinet-dynamic-choice-source');
    select.setAttribute('data-launcher-label', 'Dodatek robocizny');
    select.setAttribute('data-choice-title', 'Wybierz dodatek robocizny');
    select.setAttribute('data-choice-placeholder', 'Dodatek robocizny');
    definitions.forEach((def)=> {
      const opt = document.createElement('option');
      opt.value = def.id;
      opt.textContent = def.name || def.id;
      select.appendChild(opt);
    });
    const input = make('input', 'cabinet-extra-field__control cabinet-labor-qty');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = '1';
    const btn = make('button', 'btn cabinet-labor-add-btn', 'Dodaj');
    btn.type = 'button';
    btn.addEventListener('click', (event)=> {
      try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
      const rateId = text(select.value);
      if(!rateId) return;
      const amount = qty(input.value);
      const rows = ensureItems(draft);
      const existing = rows.find((item)=> item.rateId === rateId);
      if(existing) existing.qty = qty(existing.qty) + amount;
      else rows.push({ rateId, qty:amount, note:'' });
      draft.laborItems = rows;
      if(typeof rerender === 'function') rerender();
      else renderLaborSection(container, draft, rerender);
    });
    form.appendChild(select);
    form.appendChild(input);
    form.appendChild(btn);
    card.appendChild(form);

    const list = make('div', 'cabinet-labor-list');
    const map = new Map(definitions.map((def)=> [String(def.id), def]));
    if(!items.length){
      list.appendChild(make('div', 'cabinet-labor-empty', 'Brak dodatków robocizny przy tej szafce.'));
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
        actions.appendChild(q);
        actions.appendChild(remove);
        row.appendChild(info);
        row.appendChild(actions);
        list.appendChild(row);
      });
    }
    card.appendChild(list);
    container.appendChild(card);
    try{
      const launcherApi = FC.cabinetChoiceLaunchers;
      if(launcherApi && typeof launcherApi.mountDynamicSelectLaunchers === 'function') launcherApi.mountDynamicSelectLaunchers(container);
    }catch(_){ }
    return card;
  }

  FC.cabinetModalLabor = { getDefinitions, ensureItems, renderLaborSection };
})();
