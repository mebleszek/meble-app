// js/app/material/price-modal-labor-conditions.js
// Warunki zastosowania reguł robocizny w cenniku: UI launchera i draft warunków liczbowych.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};
  let draft = [];
  let onDirty = function(){};

  function text(value){ return String(value == null ? '' : value).trim(); }
  function numberOrNull(value){
    if(value === '' || value == null) return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function options(selected){
    const api = FC.laborCatalog || {};
    try{ if(typeof api.conditionSourceOptions === 'function') return api.conditionSourceOptions(selected || ''); }catch(_){ }
    return [{ value:'', label:'Dodaj warunek', description:'' }];
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
  function setSelectOptions(select, selected){
    if(!select) return;
    if(ctx.setSelectOptions) ctx.setSelectOptions(select, options(selected || ''), '', '');
  }
  function resetLauncher(){
    const select = ctx.byId && ctx.byId('laborConditionSourceSelect');
    if(!select) return;
    setSelectOptions(select, '');
    select.value = '';
    if(ctx.mountChoice){
      ctx.mountChoice({
        selectEl:select,
        mountId:'laborConditionSourceLaunch',
        title:'Dodaj warunek zastosowania',
        buttonClass:'investor-choice-launch price-labor-choice-launch',
        placeholder:'Dodaj warunek',
        onChange:(value)=>{
          const source = text(value);
          if(!source) return;
          draft.push({ source, operator:'range', min:null, max:null });
          render(draft);
          onDirty();
        }
      });
    }
  }
  function render(rows, dirtyCallback){
    if(typeof dirtyCallback === 'function') onDirty = dirtyCallback;
    draft = (Array.isArray(rows) ? rows : []).map(coerce).filter(Boolean);
    const list = ctx.byId && ctx.byId('laborConditionsList');
    const empty = ctx.byId && ctx.byId('laborConditionsEmpty');
    if(!list){ resetLauncher(); return; }
    list.innerHTML = '';
    if(empty) empty.style.display = draft.length ? 'none' : '';
    draft.forEach((condition, index)=>{
      const src = sourceInfo(condition.source) || { code:condition.source, label:condition.source, unit:'' };
      const row = document.createElement('div');
      row.className = 'price-labor-condition-row';
      const sourceBox = document.createElement('div');
      sourceBox.className = 'price-labor-condition-row__source';
      const label = document.createElement('div');
      label.className = 'price-labor-condition-row__label';
      label.textContent = text(src.label) || condition.source;
      const code = document.createElement('div');
      code.className = 'price-labor-condition-row__code';
      code.textContent = `${condition.source}${src.unit ? ' • ' + src.unit : ''}`;
      sourceBox.appendChild(label);
      sourceBox.appendChild(code);
      row.appendChild(sourceBox);
      ['min','max'].forEach((key)=>{
        const field = document.createElement('div');
        field.className = 'price-labor-condition-field';
        const lab = document.createElement('label');
        lab.textContent = key === 'min' ? 'Minimum' : 'Maksimum';
        const input = document.createElement('input');
        input.className = 'investor-form-input';
        input.type = 'number';
        input.step = '0.01';
        input.value = condition[key] == null ? '' : String(condition[key]);
        input.addEventListener('input', ()=>{
          draft[index] = Object.assign({}, draft[index] || condition, { [key]:input.value === '' ? null : input.value });
          onDirty();
        });
        input.addEventListener('change', onDirty);
        field.appendChild(lab);
        field.appendChild(input);
        row.appendChild(field);
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn-danger price-labor-condition-remove';
      remove.textContent = 'Usuń';
      remove.addEventListener('click', ()=>{
        draft.splice(index, 1);
        render(draft);
        onDirty();
      });
      row.appendChild(remove);
      list.appendChild(row);
    });
    resetLauncher();
  }

  ctx.priceModalLaborConditions = { render, current, resetLauncher };
})();
