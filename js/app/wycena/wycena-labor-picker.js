// js/app/wycena/wycena-labor-picker.js
// Aplikacyjne okno wyboru czynności robocizny do ręcznego dodania w WYCENIE.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  let state = null;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function qty(value){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  function make(tag, className, content){
    const el = document.createElement(tag);
    if(className) el.className = className;
    if(content != null) el.textContent = content;
    return el;
  }
  function normalize(row){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.normalizeDefinition === 'function' ? FC.laborCatalog.normalizeDefinition(row) : row; }
    catch(_){ return row; }
  }
  function describe(row){
    try{ return FC.laborCatalog && typeof FC.laborCatalog.describeDefinition === 'function' ? FC.laborCatalog.describeDefinition(row) : ''; }
    catch(_){ return ''; }
  }
  function slug(value){ return text(value).toLowerCase(); }

  function normalizeCatalog(rows){
    return (Array.isArray(rows) ? rows : []).map(normalize).filter((row)=> {
      if(!row || row.active === false) return false;
      return String(row.autoRole || 'none') === 'none';
    }).sort((a,b)=> String(a.category || '').localeCompare(String(b.category || ''), 'pl') || String(a.name || '').localeCompare(String(b.name || ''), 'pl'));
  }

  function close(){
    const modal = document.getElementById('quoteLaborPickerModal');
    if(modal) modal.remove();
    state = null;
  }

  function currentRows(){
    const catalog = state ? state.catalog : [];
    return catalog.map((rate)=> ({ rateId:String(rate && rate.id || ''), qty:qty(state.qtyMap[String(rate && rate.id || '')]) })).filter((row)=> row.rateId && row.qty > 0);
  }

  function setQty(rateId, nextQty){
    if(!state) return;
    const id = String(rateId || '');
    const amount = qty(nextQty);
    if(amount > 0) state.qtyMap[id] = amount;
    else delete state.qtyMap[id];
  }

  function renderList(list, query){
    list.innerHTML = '';
    const q = slug(query || '');
    const rows = (state ? state.catalog : []).filter((row)=> {
      if(!q) return true;
      return slug(`${row.name || ''} ${row.category || ''} ${describe(row)}`).includes(q);
    });
    if(!rows.length){
      list.appendChild(make('div', 'quote-labor-picker__empty', 'Brak pasujących czynności.'));
      return;
    }
    rows.forEach((rate)=> {
      const id = String(rate.id || '');
      const item = make('article', 'quote-labor-picker__item');
      const info = make('div', 'quote-labor-picker__info');
      info.appendChild(make('div', 'quote-labor-picker__title', rate.name || id));
      const meta = [rate.category, describe(rate)].filter(Boolean).join(' • ');
      info.appendChild(make('div', 'quote-labor-picker__meta', meta || '—'));
      const controls = make('div', 'quote-labor-picker__controls');
      const minus = make('button', 'btn quote-labor-picker__step', '−');
      minus.type = 'button';
      const input = make('input', 'investor-form-input quote-labor-picker__qty');
      input.type = 'number'; input.min = '0'; input.step = '1'; input.value = String(qty(state.qtyMap[id]) || '');
      const plus = make('button', 'btn quote-labor-picker__step', '+');
      plus.type = 'button';
      minus.addEventListener('click', (event)=>{ event.preventDefault(); const next = Math.max(0, qty(input.value) - 1); input.value = next ? String(next) : ''; setQty(id, next); });
      plus.addEventListener('click', (event)=>{ event.preventDefault(); const next = qty(input.value) + 1 || 1; input.value = String(next); setQty(id, next); });
      input.addEventListener('input', ()=> setQty(id, input.value));
      controls.appendChild(minus); controls.appendChild(input); controls.appendChild(plus);
      item.appendChild(info); item.appendChild(controls);
      list.appendChild(item);
    });
  }

  function open(options){
    close();
    const opts = options && typeof options === 'object' ? options : {};
    const catalog = normalizeCatalog(opts.catalog || []);
    const selectionMap = opts.selectionMap && typeof opts.selectionMap === 'object' ? opts.selectionMap : {};
    state = {
      catalog,
      qtyMap:Object.create(null),
      onSave:typeof opts.onSave === 'function' ? opts.onSave : null,
    };
    catalog.forEach((rate)=> {
      const id = String(rate && rate.id || '');
      const amount = qty(selectionMap[id]);
      if(id && amount > 0) state.qtyMap[id] = amount;
    });

    const back = make('div', 'modal-back quote-labor-picker-back');
    back.id = 'quoteLaborPickerModal';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    const panel = make('div', 'window-modal quote-labor-picker');
    const head = make('div', 'window-modal-head');
    const icon = make('div', 'window-modal-icon', '$');
    const copy = make('div');
    copy.appendChild(make('div', 'window-modal-title', 'Dodaj czynności'));
    copy.appendChild(make('div', 'window-modal-subtitle', 'Wybierz z jednej wspólnej puli robocizny. Te pozycje są wewnętrzne dla wyceny.'));
    const x = make('button', 'window-modal-x', '×');
    x.type = 'button';
    x.addEventListener('click', close);
    head.appendChild(icon); head.appendChild(copy); head.appendChild(x);
    panel.appendChild(head);

    const body = make('div', 'quote-labor-picker__body');
    const search = make('input', 'investor-form-input quote-labor-picker__search');
    search.type = 'search';
    search.placeholder = 'Szukaj czynności...';
    body.appendChild(search);
    const list = make('div', 'quote-labor-picker__list');
    body.appendChild(list);
    search.addEventListener('input', ()=> renderList(list, search.value));
    panel.appendChild(body);

    const footer = make('div', 'quote-labor-picker__footer');
    const cancel = make('button', 'btn-primary', 'Wróć');
    cancel.type = 'button';
    cancel.addEventListener('click', close);
    const save = make('button', 'btn-success', 'Zatwierdź');
    save.type = 'button';
    save.addEventListener('click', ()=> {
      const rows = currentRows();
      if(state && state.onSave) state.onSave(rows);
      close();
    });
    footer.appendChild(cancel); footer.appendChild(save);
    panel.appendChild(footer);
    back.appendChild(panel);
    document.body.appendChild(back);
    renderList(list, '');
    setTimeout(()=>{ try{ search.focus(); }catch(_){ } }, 30);
  }

  FC.wycenaLaborPicker = { open, close, normalizeCatalog };
})();
