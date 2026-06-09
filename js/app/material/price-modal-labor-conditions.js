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
  function options(selected){
    const api = FC.laborCatalog || {};
    try{ if(typeof api.conditionSourceOptions === 'function') return api.conditionSourceOptions(selected || ''); }catch(_){ }
    return [{ value:'', label:'Wybierz wartość warunku', description:'' }];
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
    return { ok:true, message:'' };
  }
  function setSelectOptions(select, selected){
    if(!select) return;
    if(ctx.setSelectOptions) ctx.setSelectOptions(select, options(selected || ''), selected || '', selected || 'Wybierz wartość warunku');
  }
  function makeSelect(index, selected){
    const select = document.createElement('select');
    select.hidden = true;
    select.id = 'laborConditionSourceSelect_' + index + '_' + (++seq);
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
    lab.textContent = key === 'min' ? 'Minimum / od' : 'Maksimum / do';
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
      code.textContent = `${source}${info.unit ? ' • ' + info.unit : ''}`;
      sourceBox.appendChild(code);
    }
    wrap.appendChild(sourceBox);
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
      hint.textContent = draft.length ? 'Wybierz kolejną wartość, jeśli ta reguła ma mieć następny warunek.' : 'Wybierz wartość warunku, jeśli reguła ma działać tylko w określonym zakresie.';
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
  }

  ctx.priceModalLaborConditions = { render, current, validate, hasSelectedIncompleteRange };
})();
