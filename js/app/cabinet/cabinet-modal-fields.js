(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  function getMaterials(){
    try{ return Array.isArray(materials) ? materials : []; }catch(_){ return []; }
  }

  function populateSelect(el, options, selected){
    if(!el) return;
    el.innerHTML = '';
    (Array.isArray(options) ? options : []).forEach(function(o){
      const opt = document.createElement('option');
      opt.value = o.v;
      opt.textContent = o.t;
      if(selected === o.v) opt.selected = true;
      el.appendChild(opt);
    });
  }

  function populateFrontColorsTo(selectEl, typeVal, selected){
    if(!selectEl) return;
    selectEl.innerHTML = '';
    getMaterials().filter(function(m){ return m && m.materialType === typeVal; }).forEach(function(m){
      const o = document.createElement('option');
      o.value = m.name;
      o.textContent = m.name;
      if(m.name === selected) o.selected = true;
      selectEl.appendChild(o);
    });
    if(selectEl.options.length === 0){
      const o = document.createElement('option');
      o.value = '';
      o.textContent = '— brak —';
      selectEl.appendChild(o);
    }
  }

  function populateBodyColorsTo(selectEl, selected){
    if(!selectEl) return;
    selectEl.innerHTML = '';
    getMaterials().filter(function(m){ return m && m.materialType === 'laminat'; }).forEach(function(m){
      const o = document.createElement('option');
      o.value = m.name;
      o.textContent = m.name;
      if(m.name === selected) o.selected = true;
      selectEl.appendChild(o);
    });
    if(selectEl.options.length === 0){
      const o = document.createElement('option');
      o.value = '';
      o.textContent = '— brak —';
      selectEl.appendChild(o);
    }
  }

  function populateOpeningOptionsTo(selectEl, typeVal, selected){
    if(!selectEl) return;
    selectEl.innerHTML = '';
    const isHanging = typeVal === 'wisząca';
    const options = isHanging
      ? ['uchwyt klienta','podchwyt','TIP-ON','krawędziowy HEXA GTV','korytkowy','UKW']
      : ['uchwyt klienta','TIP-ON','krawędziowy HEXA GTV','UKW','korytkowy'];
    options.forEach(function(v){
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      if(v === selected) o.selected = true;
      selectEl.appendChild(o);
    });
  }

  function makeExtraFieldId(prefix, key){
    const rawKey = String(key || '');
    return 'cmExtra' + String(prefix || '') + rawKey.charAt(0).toUpperCase() + rawKey.slice(1);
  }

  function shouldUseCompactNumberField(key, labelText){
    const compactKeys = new Set(['shelves','innerDrawerCount','techShelfCount','blindPart','dishWasherWidth','ovenHeight','fridgeWidth','fridgeNicheHeight','fridgeFreeOption','drawerCount','fridgeFrontCount']);
    if(compactKeys.has(String(key || ''))) return true;
    const label = String(labelText || '').toLowerCase();
    return /(ilość|szt|cm\)|cm$|wysokość|szerokość|głębokość|blenda)/.test(label);
  }

  function appendExtraSelectField(container, cfg){
    if(!container || !cfg) return null;
    const draft = cfg.draft;
    const labelText = String(cfg.labelText || '');
    const key = String(cfg.key || '');
    const options = Array.isArray(cfg.options) ? cfg.options : [];
    const onChangeExtra = cfg.onChangeExtra;
    const onRender = cfg.onRender;

    const div = document.createElement('div');
    div.className = 'cabinet-extra-field cabinet-extra-field--select';
    const selectId = makeExtraFieldId('Select', key);
    div.innerHTML = '<label class="cabinet-extra-field__label" for="' + selectId + '">' + labelText + '</label><select id="' + selectId + '" class="cabinet-choice-source cabinet-extra-field__control" data-launcher-label="' + labelText + '" data-choice-title="Wybierz: ' + labelText + '" data-choice-placeholder="' + labelText + '"></select>';
    const sel = div.querySelector('select');
    try{ sel.classList.add('cabinet-choice-source','set-front-choice-source','cabinet-dynamic-choice-source'); }catch(_){ }
    options.forEach(function(opt){
      const o = document.createElement('option');
      o.value = opt.v;
      o.textContent = opt.t;
      sel.appendChild(o);
    });
    sel.value = (draft && draft.details && draft.details[key]) ? draft.details[key] : ((options[0] && options[0].v) || '');
    sel.addEventListener('change', function(e){
      draft.details = Object.assign({}, draft.details || {}, { [key]: e.target.value });
      if(typeof onChangeExtra === 'function') onChangeExtra(e.target.value, e);
      if(typeof onRender === 'function') onRender();
    });
    container.appendChild(div);
    return div;
  }

  function appendExtraNumberField(container, cfg){
    if(!container || !cfg) return null;
    const draft = cfg.draft;
    const labelText = String(cfg.labelText || '');
    const key = String(cfg.key || '');
    const fallback = cfg.fallback;
    const onApply = cfg.onApply;
    const compact = shouldUseCompactNumberField(key, labelText);
    const div = document.createElement('div');
    div.className = 'cabinet-extra-field cabinet-extra-field--number' + (compact ? ' cabinet-extra-field--compact' : '');
    const raw = (draft && draft.details && draft.details[key] != null) ? draft.details[key] : fallback;
    const existingShelves = document.getElementById('cmShelves');
    const inputId = cfg.inputId || ((!existingShelves && key === 'shelves') ? 'cmShelves' : '');
    const idAttr = inputId ? ' id="' + inputId + '"' : '';
    div.innerHTML = '<label class="cabinet-extra-field__label">' + labelText + '</label><input class="cabinet-extra-field__control" type="number"' + idAttr + ' value="' + raw + '" />';
    const inp = div.querySelector('input');

    const apply = function(){
      draft.details = Object.assign({}, draft.details || {}, { [key]: inp.value });
      if(typeof onApply === 'function') onApply(inp.value, inp);
    };

    inp.addEventListener('input', apply);
    inp.addEventListener('change', apply);
    container.appendChild(div);
    return div;
  }

  ns.cabinetModalFields = {
    populateSelect,
    populateFrontColorsTo,
    populateBodyColorsTo,
    populateOpeningOptionsTo,
    makeExtraFieldId,
    shouldUseCompactNumberField,
    appendExtraSelectField,
    appendExtraNumberField,
  };
})();
