// js/app/material/price-modal-labor-conditions.js
// Warunki zastosowania reguł robocizny: kaskadowe pola wyboru faktu + uniwersalne min/max.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};
  let draft = [];
  let onDirty = function(){};
  let seq = 0;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function numberOrNull(value){
    if(value === '' || value == null) return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function selectedSources(exceptIndex){
    return draft.map((row, idx)=> idx === exceptIndex ? '' : text(row && row.source)).filter(Boolean);
  }
  function options(selected, index){
    const api = FC.laborCatalog || {};
    let rows = [];
    try{ if(typeof api.conditionSourceOptions === 'function') rows = api.conditionSourceOptions(selected || '') || []; }catch(_){ rows = []; }
    if(!rows.length) rows = [{ value:'', label:'Wybierz wartość warunku', description:'' }];
    const used = new Set(selectedSources(index));
    const current = text(selected);
    return rows.filter((row)=> {
      const value = text(row && row.value);
      return !value || value === current || !used.has(value);
    });
  }
  function sourceInfo(code){
    try{
      const api = FC.workQuantitySources || {};
      if(api && typeof api.find === 'function') return api.find(code) || null;
    }catch(_){ }
    return null;
  }
  function normalize(row){
    const source = text(row && row.source);
    if(!source) return null;
    const min = numberOrNull(row && row.min);
    const max = numberOrNull(row && row.max);
    if(min == null && max == null) return null;
    return { source, operator:'range', min, max };
  }
  function coerce(row){
    const source = text(row && row.source);
    if(!source) return null;
    return { source, operator:'range', min:numberOrNull(row && row.min), max:numberOrNull(row && row.max) };
  }
  function current(){
    return draft.map(normalize).filter(Boolean);
  }
  function hasSelectedIncompleteRange(){
    return draft.some((row)=> {
      if(!text(row && row.source)) return false;
      return numberOrNull(row && row.min) == null && numberOrNull(row && row.max) == null;
    });
  }
  function validate(){
    if(hasSelectedIncompleteRange()){
      return { ok:false, message:'Wybrany warunek musi mieć uzupełnione Minimum albo Maksimum. Pusty końcowy wybór warunku nie jest zapisywany.' };
    }
    const seen = new Set();
    for(const row of draft){
      const source = text(row && row.source);
      if(!source) continue;
      if(seen.has(source)) return { ok:false, message:'Ten sam warunek nie powinien być dodany dwa razy. Usuń duplikat albo zmień wartość warunku.' };
      seen.add(source);
    }
    return { ok:true, message:'' };
  }
  function sourceLabel(code){
    const info = sourceInfo(code) || {};
    return text(info.label) || text(code);
  }
  function sourceUnit(code){
    const info = sourceInfo(code) || {};
    const unit = text(info.unit || '');
    return unit && unit !== '—' ? unit : '';
  }
  function rangeText(row){
    const min = numberOrNull(row && row.min);
    const max = numberOrNull(row && row.max);
    const unit = sourceUnit(row && row.source);
    const suffix = unit ? ' ' + unit : '';
    if(min != null && max != null) return `${min}${suffix} – ${max}${suffix}`;
    if(min != null) return `od ${min}${suffix}`;
    if(max != null) return `do ${max}${suffix}`;
    return 'zakres nieuzupełniony';
  }
  function conditionText(row){
    const source = text(row && row.source);
    if(!source) return '';
    return `${sourceLabel(source)}: ${rangeText(row)}`;
  }
  function renderConditionPreview(row){
    const txt = conditionText(row);
    if(!txt) return null;
    const el = document.createElement('div');
    el.className = 'price-labor-condition-row__preview';
    el.textContent = 'Działa gdy: ' + txt;
    return el;
  }
  function renderSummary(){
    const wrap = ctx.byId && ctx.byId('laborConditionsWrap');
    if(!wrap) return;
    let summary = ctx.byId && ctx.byId('laborConditionsSummary');
    if(!summary){
      summary = document.createElement('div');
      summary.id = 'laborConditionsSummary';
      summary.className = 'price-labor-conditions__summary';
      wrap.appendChild(summary);
    }
    const rows = current();
    if(!rows.length){
      summary.textContent = 'Podgląd: brak ograniczeń — reguła zadziała dla każdej szafki, która zwróci dodatnią ilość z wybranego źródła.';
      return;
    }
    summary.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'price-labor-conditions__summary-title';
    title.textContent = 'Podgląd warunków: wszystkie poniższe muszą być spełnione';
    summary.appendChild(title);
    rows.forEach((row, idx)=> {
      const item = document.createElement('div');
      item.className = 'price-labor-conditions__summary-row';
      item.textContent = `${idx + 1}. ${conditionText(row)}`;
      summary.appendChild(item);
    });
  }
  function setSelectOptions(select, selected){
    if(!select) return;
    if(ctx.setSelectOptions) ctx.setSelectOptions(select, options(selected || '', Number(select && select.dataset ? select.dataset.conditionIndex : -1)), selected || '', selected || 'Wybierz wartość warunku');
  }
  function makeSelect(index, selected){
    const select = document.createElement('select');
    select.hidden = true;
    select.id = 'laborConditionSourceSelect_' + index + '_' + (++seq);
    select.dataset.conditionIndex = String(index);
    setSelectOptions(select, selected || '');
    select.value = selected || '';
    return select;
  }
  function mountSourceChoice(select, mount, index, selected){
    if(!ctx.mountChoice || !select || !mount) return;
    ctx.mountChoice({
      selectEl:select,
      mountId:mount.id,
      title:'Wybierz wartość warunku',
      buttonClass:'investor-choice-launch price-labor-choice-launch price-labor-condition-choice',
      placeholder:'Wybierz wartość warunku',
      onChange:(value)=>{
        const source = text(value);
        if(index < draft.length){
          if(source) draft[index] = Object.assign({}, draft[index] || {}, { source, operator:'range' });
          else draft.splice(index, 1);
        }else if(source){
          draft.push({ source, operator:'range', min:null, max:null });
        }
        render(draft);
        onDirty();
      }
    });
  }
  function renderRangeInput(row, index, key){
    const field = document.createElement('div');
    field.className = 'price-labor-condition-field';
    const lab = document.createElement('label');
    lab.textContent = (key === 'min' ? 'Minimum / od' : 'Maksimum / do') + (sourceUnit(row && row.source) ? ' (' + sourceUnit(row && row.source) + ')' : '');
    const input = document.createElement('input');
    input.className = 'investor-form-input';
    input.type = 'number';
    input.step = '0.01';
    input.inputMode = 'decimal';
    input.value = row && row[key] == null ? '' : String(row && row[key] != null ? row[key] : '');
    input.addEventListener('input', ()=>{
      if(!draft[index]) return;
      draft[index] = Object.assign({}, draft[index], { [key]:input.value === '' ? null : input.value });
      onDirty();
    });
    input.addEventListener('change', onDirty);
    field.appendChild(lab);
    field.appendChild(input);
    return field;
  }
  function renderRow(list, row, index, isBlank){
    const source = text(row && row.source);
    const wrap = document.createElement('div');
    wrap.className = 'price-labor-condition-row' + (isBlank ? ' is-empty' : '');
    const sourceBox = document.createElement('div');
    sourceBox.className = 'price-labor-condition-row__source';
    const label = document.createElement('label');
    label.className = 'price-labor-condition-row__label';
    label.textContent = 'Warunek ' + (index + 1);
    const select = makeSelect(index, source);
    const launch = document.createElement('div');
    launch.id = 'laborConditionSourceLaunch_' + index + '_' + seq;
    launch.className = 'price-labor-condition-row__launch';
    sourceBox.appendChild(label);
    sourceBox.appendChild(select);
    sourceBox.appendChild(launch);
    if(source){
      const info = sourceInfo(source) || { code:source, unit:'' };
      const code = document.createElement('div');
      code.className = 'price-labor-condition-row__code';
      code.textContent = `${source}${info.unit ? ' · ' + info.unit : ''}`;
      sourceBox.appendChild(code);
    }
    wrap.appendChild(sourceBox);
    const preview = renderConditionPreview(row);
    if(preview) wrap.appendChild(preview);
    if(source){
      wrap.appendChild(renderRangeInput(row, index, 'min'));
      wrap.appendChild(renderRangeInput(row, index, 'max'));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-danger price-labor-condition-remove';
      remove.textContent = 'Usuń';
      remove.addEventListener('click', ()=>{
        draft.splice(index, 1);
        render(draft);
        onDirty();
      });
      wrap.appendChild(remove);
    }else{
      const hint = document.createElement('div');
      hint.className = 'price-labor-condition-row__hint';
      hint.textContent = draft.length ? 'Wybierz kolejną wartość tylko wtedy, gdy reguła ma mieć następny warunek. Pusty wiersz nie jest zapisywany.' : 'Wybierz warunek, jeśli reguła ma działać tylko w określonym zakresie. Bez warunku reguła działa zawsze, gdy źródło ilości zwróci dodatnią wartość.';
      wrap.appendChild(hint);
    }
    list.appendChild(wrap);
    mountSourceChoice(select, launch, index, source);
  }
  function render(rows, dirtyCallback){
    if(typeof dirtyCallback === 'function') onDirty = dirtyCallback;
    draft = (Array.isArray(rows) ? rows : []).map(coerce).filter(Boolean);
    const list = ctx.byId && ctx.byId('laborConditionsList');
    const empty = ctx.byId && ctx.byId('laborConditionsEmpty');
    if(!list) return;
    list.innerHTML = '';
    if(empty) empty.textContent = draft.length
      ? 'Wszystkie wybrane warunki muszą być spełnione jednocześnie.'
      : 'Brak zapisanych warunków — reguła działa dla każdej szafki, która zwraca wybrane źródło ilości. Wybierz pierwszy warunek poniżej, żeby ograniczyć regułę.';
    draft.forEach((condition, index)=> renderRow(list, condition, index, false));
    renderRow(list, { source:'', min:null, max:null }, draft.length, true);
    renderSummary();
  }

  ctx.priceModalLaborConditions = { render, current, validate, hasSelectedIncompleteRange, conditionText };
})();
