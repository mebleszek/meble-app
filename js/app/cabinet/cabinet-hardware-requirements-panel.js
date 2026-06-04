// js/app/cabinet/cabinet-hardware-requirements-panel.js
// Skrócony widok i edycja wymagań technicznych szafki w modalu WYWIADU. Pokazuje wymagania, nie konkretne produkty katalogowe.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value){ const n = Number(String(value == null ? '' : value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function esc(value){
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatBool(value){ return value ? 'tak' : 'nie'; }

  function formatTechnicalValue(raw, key){
    if(raw == null) return '';
    if(typeof raw !== 'object'){
      if(typeof raw === 'boolean') return formatBool(raw);
      return text(raw);
    }
    if(raw.value != null){
      if(typeof raw.value === 'boolean') return formatBool(raw.value);
      if(String(key || '').indexOf('kat') !== -1 && !/[°]/.test(String(raw.value))) return `${raw.value}°`;
      return text(raw.value);
    }
    const from = raw.from != null ? number(raw.from) : null;
    const to = raw.to != null ? number(raw.to) : null;
    if(from != null && to != null && from > 0 && to > 0){
      return `${from}–${to}${String(key || '').indexOf('kat') !== -1 ? '°' : ''}`;
    }
    if(from != null && from > 0){
      return `min. ${from}${String(key || '').indexOf('kat') !== -1 ? '°' : ''}`;
    }
    if(to != null && to > 0){
      return `maks. ${to}${String(key || '').indexOf('kat') !== -1 ? '°' : ''}`;
    }
    return text(JSON.stringify(raw));
  }

  function param(params, key){
    return params && Object.prototype.hasOwnProperty.call(params, key) ? params[key] : null;
  }

  function row(label, value, extraClass){
    const val = text(value);
    if(!val) return '';
    return '<div class="cabinet-hardware-req-row' + (extraClass ? ' ' + esc(extraClass) : '') + '">' +
      '<div class="cabinet-hardware-req-row__label">' + esc(label) + '</div>' +
      '<div class="cabinet-hardware-req-row__value">' + esc(val) + '</div>' +
    '</div>';
  }

  function statusBadge(req){
    if(!req) return '';
    if(req.kind === 'hinge') return '<span class="cabinet-hardware-req-badge cabinet-hardware-req-badge--ok">wymagane</span>';
    if(req.kind === 'none') return '<span class="cabinet-hardware-req-badge cabinet-hardware-req-badge--empty">brak</span>';
    if(req.kind === 'future') return '<span class="cabinet-hardware-req-badge cabinet-hardware-req-badge--warn">w budowie</span>';
    return '<span class="cabinet-hardware-req-badge">wymaganie</span>';
  }

  function typeLabelFromParams(params, fallback){
    const angle = formatTechnicalValue(param(params, 'kat_rzeczywisty') || param(params, 'kat_otwarcia'), 'kat_rzeczywisty');
    const overlay = formatTechnicalValue(param(params, 'nalozenie'), 'nalozenie');
    const cls = formatTechnicalValue(param(params, 'klasa_kata'), 'klasa_kata');
    const parts = [];
    if(angle) parts.push(angle.replace(/^min\.\s*/i, ''));
    if(overlay) parts.push(overlay);
    if(cls && parts.join(' ').indexOf(cls) === -1) parts.push('klasa: ' + cls);
    const label = parts.join(' ').replace(/\s+/g, ' ').trim();
    return label || text(fallback) || 'wymaganie techniczne';
  }

  function hingeTechnicalSummary(req){
    const params = req && req.technicalParams || {};
    const bits = [];
    const typeLabel = typeLabelFromParams(params, req && req.label);
    if(typeLabel) bits.push(typeLabel);
    const prowadnik = formatTechnicalValue(param(params, 'typ_prowadnika') || param(params, 'prowadnik'), 'typ_prowadnika');
    if(prowadnik) bits.push('prowadnik: ' + prowadnik);
    if(param(params, 'hamulec') != null) bits.push('hamulec: ' + formatTechnicalValue(param(params, 'hamulec'), 'hamulec'));
    if(param(params, 'sprezyna') != null) bits.push('sprężyna: ' + formatTechnicalValue(param(params, 'sprezyna'), 'sprezyna'));
    return bits.join(' • ');
  }

  function hingeSummary(req){
    const qty = Math.max(0, Math.round(number(req && req.qty)));
    const bits = [];
    const tech = hingeTechnicalSummary(req);
    if(tech) bits.push(tech);
    bits.push('ilość: ' + (qty > 0 ? `${qty} kpl.` : '0 kpl.'));
    return bits.join(' • ');
  }

  function addChoiceOption(map, option, sourceReq){
    const value = text(option && (option.value || option.typeId)) || text(sourceReq && sourceReq.typeId);
    if(!value || map.has(value)) return;
    const params = (option && option.technicalParams) || (sourceReq && sourceReq.technicalParams) || {};
    const label = text(option && option.label) || typeLabelFromParams(params, sourceReq && sourceReq.label) || value;
    const sourceOption = option && typeof option === 'object' ? option : {};
    map.set(value, Object.assign({}, sourceOption, {
      value,
      typeId:value,
      label,
      technicalParams:params,
      description: hingeTechnicalSummary(Object.assign({}, sourceReq || {}, { technicalParams:params, label, typeId:value }))
    }));
  }

  function buildHingeChoiceOptions(req){
    const api = FC.cabinetHardwareRequirements;
    const map = new Map();
    let catalogOptions = api && typeof api.getHingeRequirementOptions === 'function' ? api.getHingeRequirementOptions() : [];
    catalogOptions = Array.isArray(catalogOptions) ? catalogOptions : [];
    catalogOptions.forEach((opt)=> addChoiceOption(map, opt, opt && opt.requirement));

    const current = text(req && req.typeId);
    if(current && !map.has(current)) addChoiceOption(map, { typeId:current, label:text(req && req.label) }, req);

    const defaultId = text(req && req.defaultTypeId);
    if(defaultId && !map.has(defaultId) && api && typeof api.getHingeRequirementPreset === 'function'){
      try{ addChoiceOption(map, { typeId:defaultId }, api.getHingeRequirementPreset(defaultId, 'default_preview')); }catch(_){ }
    }
    return Array.from(map.values());
  }

  function normalizeKey(value){
    return text(value).toLowerCase().replace(/ł/g, 'l').replace(/Ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function scalarParamValue(params, key){
    const raw = param(params || {}, key);
    if(raw == null) return '';
    if(typeof raw === 'object'){
      if(raw.value != null) return raw.value;
      if(raw.from != null) return raw.from;
      if(raw.to != null) return raw.to;
    }
    return raw;
  }

  function displayParamValue(params, key){
    return formatTechnicalValue(param(params || {}, key), key) || text(scalarParamValue(params || {}, key));
  }

  function sameCascadeValue(a, b){
    return normalizeKey(a) === normalizeKey(b);
  }

  function uniqueCascadeFieldOptions(options, key){
    const map = new Map();
    (Array.isArray(options) ? options : []).forEach((opt)=>{
      const params = opt && opt.technicalParams || {};
      const raw = scalarParamValue(params, key);
      const value = text(raw);
      const norm = normalizeKey(value);
      if(!norm || map.has(norm)) return;
      const label = displayParamValue(params, key) || value;
      map.set(norm, { value, label });
    });
    return Array.from(map.values()).sort((a, b)=> text(a.label).localeCompare(text(b.label), 'pl'));
  }

  function filterByCascadeValue(options, key, selected){
    const wanted = normalizeKey(selected);
    if(!wanted) return Array.isArray(options) ? options.slice() : [];
    return (Array.isArray(options) ? options : []).filter((opt)=> sameCascadeValue(scalarParamValue(opt && opt.technicalParams || {}, key), selected));
  }

  async function pickCascadeField(choiceApi, cfg){
    const values = uniqueCascadeFieldOptions(cfg.options, cfg.key);
    if(!values.length) return '';
    const current = displayParamValue(cfg.currentParams || {}, cfg.key) || text(scalarParamValue(cfg.currentParams || {}, cfg.key));
    if(values.length === 1) return values[0].value;
    const picked = await choiceApi.openRozrysChoiceOverlay({
      title:cfg.title,
      value:values.find((item)=> sameCascadeValue(item.value, current)) ? current : '',
      options:values.map((item)=> ({ value:item.value, label:item.label }))
    });
    return picked == null ? null : picked;
  }

  async function openHingeChoice(req){
    const choiceApi = FC && FC.rozrysChoice;
    if(!(choiceApi && typeof choiceApi.openRozrysChoiceOverlay === 'function')) return null;
    const allOptions = buildHingeChoiceOptions(req);
    if(!allOptions.length) return null;

    let filtered = allOptions.slice();
    const currentParams = req && req.technicalParams || {};
    const cascade = [
      { key:'nalozenie', title:'Wybierz typ / nakładanie kompletu zawiasowego' },
      { key:'klasa_kata', title:'Wybierz klasę / zakres zamienności kąta' },
      { key:'kat_rzeczywisty', title:'Wybierz kąt rzeczywisty / nominalny' },
      { key:'typ_prowadnika', title:'Wybierz typ prowadnika' },
      { key:'forma_prowadnika', title:'Wybierz formę prowadnika' },
      { key:'hamulec', title:'Wybierz hamulec / domyk' },
      { key:'sprezyna', title:'Wybierz sprężynę' }
    ];

    for(const step of cascade){
      const values = uniqueCascadeFieldOptions(filtered, step.key);
      if(values.length <= 1){
        if(values.length === 1) filtered = filterByCascadeValue(filtered, step.key, values[0].value);
        continue;
      }
      const picked = await pickCascadeField(choiceApi, Object.assign({}, step, { options:filtered, currentParams }));
      if(picked == null) return null;
      filtered = filterByCascadeValue(filtered, step.key, picked);
      if(!filtered.length) return null;
    }

    const currentType = text(req && req.typeId);
    const preferred = filtered.find((opt)=> text(opt && (opt.value || opt.typeId)) === currentType || text(opt && opt.typeId) === currentType) || filtered[0];
    return text(preferred && (preferred.value || preferred.typeId));
  }

  function actionButtons(req){
    const doorKey = text(req && req.doorKey) || 'single';
    const disabledRestore = req && req.overridden ? '' : ' disabled aria-disabled="true"';
    return '<div class="cabinet-hardware-req-actions">' +
      '<button type="button" class="cabinet-hardware-req-action cabinet-hardware-req-action--change" data-req-action="hinge-change" data-door-key="' + esc(doorKey) + '">Zmień</button>' +
      '<button type="button" class="cabinet-hardware-req-action cabinet-hardware-req-action--default" data-req-action="hinge-default" data-door-key="' + esc(doorKey) + '"' + disabledRestore + '>Przywróć domyślne</button>' +
    '</div>';
  }

  function pairActionButtons(doors){
    const list = Array.isArray(doors) ? doors.filter((item)=> item && item.kind === 'hinge') : [];
    const doorKeys = list.map((req)=> text(req && req.doorKey)).filter(Boolean);
    const anyOverride = list.some((req)=> !!(req && req.overridden));
    const disabledRestore = anyOverride ? '' : ' disabled aria-disabled="true"';
    const keysAttr = esc(doorKeys.join(','));
    return '<div class="cabinet-hardware-req-pair-actions">' +
      '<button type="button" class="cabinet-hardware-req-action cabinet-hardware-req-action--change cabinet-hardware-req-action--pair" data-req-action="hinge-change-all" data-door-keys="' + keysAttr + '">Zmień oba</button>' +
      '<button type="button" class="cabinet-hardware-req-action cabinet-hardware-req-action--default cabinet-hardware-req-action--pair" data-req-action="hinge-default-all" data-door-keys="' + keysAttr + '"' + disabledRestore + '>Przywróć domyślne dla obu</button>' +
    '</div>';
  }

  function compactDoor(req, sideClass){
    const state = req && req.overridden ? 'Ręcznie' : 'Domyślnie';
    return '<div class="cabinet-hardware-req-door cabinet-hardware-req-door--compact cabinet-hardware-req-door--' + esc(sideClass || '') + '">' +
      '<div class="cabinet-hardware-req-door__title">' + esc(req && req.doorLabel || 'Drzwiczki') + '</div>' +
      '<div class="cabinet-hardware-req-summary">' +
        '<div class="cabinet-hardware-req-summary__state">' + esc(state) + '</div>' +
        '<div class="cabinet-hardware-req-summary__value">' + esc(hingeSummary(req)) + '</div>' +
      '</div>' +
      actionButtons(req) +
    '</div>';
  }

  function compactAggregate(req){
    const state = req && req.overridden ? 'Ręcznie' : 'Domyślnie';
    return '<div class="cabinet-hardware-req-card__body cabinet-hardware-req-card__body--compact">' +
      '<div class="cabinet-hardware-req-summary">' +
        '<div class="cabinet-hardware-req-summary__state">' + esc(state) + '</div>' +
        '<div class="cabinet-hardware-req-summary__value">' + esc(hingeSummary(req)) + '</div>' +
      '</div>' +
    '</div>';
  }

  function hingeBody(req){
    const doors = Array.isArray(req && req.doorRequirements) ? req.doorRequirements.filter((item)=> item && item.kind === 'hinge') : [];
    if(doors.length === 2){
      return '<div class="cabinet-hardware-req-door-pair-wrap">' +
        '<div class="cabinet-hardware-req-door-pair cabinet-hardware-req-door-pair--compact">' +
          compactDoor(doors[0], 'left') +
          '<div class="cabinet-hardware-req-door-divider" aria-hidden="true"></div>' +
          compactDoor(doors[1], 'right') +
        '</div>' +
        pairActionButtons(doors) +
      '</div>';
    }
    if(doors.length > 0){
      return '<div class="cabinet-hardware-req-door-list cabinet-hardware-req-door-list--compact">' + doors.map((door)=> compactDoor(door, 'single')).join('') + '</div>';
    }
    return compactAggregate(req);
  }

  function noneRows(req){
    const rows = [];
    rows.push(row('Powód', req && req.reason ? req.reason : 'Ta szafka nie wymaga tego okucia.'));
    if(req && req.canEnableWithFlag) rows.push(row('Można włączyć', 'pole techniczne szafki: ' + req.canEnableWithFlag, 'cabinet-hardware-req-row--muted'));
    if(req && req.ruleId) rows.push(row('Reguła źródłowa', req.ruleId, 'cabinet-hardware-req-row--muted'));
    return rows.join('');
  }

  function genericRows(req){
    const rows = [];
    const params = req && req.technicalParams && typeof req.technicalParams === 'object' ? req.technicalParams : {};
    Object.keys(params).forEach((key)=> rows.push(row(key, formatTechnicalValue(params[key], key))));
    if(req && req.reason) rows.push(row('Powód', req.reason));
    if(req && req.note) rows.push(row('Uwaga', req.note, 'cabinet-hardware-req-row--note'));
    if(req && req.ruleId) rows.push(row('Reguła źródłowa', req.ruleId, 'cabinet-hardware-req-row--muted'));
    return rows.join('') || row('Status', 'Brak szczegółowych parametrów dla tego wymagania.');
  }

  function requirementCard(req){
    const title = text((req && req.displayTitle) || (req && req.category) || (req && req.hardwareGroup) || 'Okucie');
    let body = '';
    if(req && req.kind === 'hinge') body = hingeBody(req);
    else if(req && req.kind === 'none') body = '<div class="cabinet-hardware-req-card__body">' + noneRows(req) + '</div>';
    else body = '<div class="cabinet-hardware-req-card__body">' + genericRows(req) + '</div>';
    return '<div class="cabinet-hardware-req-card" data-requirement-kind="' + esc(req && req.kind || '') + '">' +
      '<div class="cabinet-hardware-req-card__head">' +
        '<div>' +
          '<div class="cabinet-hardware-req-card__title">' + esc(title) + '</div>' +
          '<div class="cabinet-hardware-req-card__subtitle">Skrót wymagań. Szczegóły zmieniasz tylko po kliknięciu.</div>' +
        '</div>' +
        statusBadge(req) +
      '</div>' + body +
    '</div>';
  }

  function getRequirements(room, draft){
    const api = FC.cabinetHardwareRequirements;
    if(!(api && typeof api.getCabinetHardwareRequirements === 'function')) return [];
    try{ return api.getCabinetHardwareRequirements(room, draft) || []; }
    catch(_){ return []; }
  }

  function findDoorRequirement(container, doorKey){
    const requirements = container && container.__cabinetHardwareReqLastRequirements || [];
    const hinge = requirements.find((req)=> req && req.kind === 'hinge');
    const doors = Array.isArray(hinge && hinge.doorRequirements) ? hinge.doorRequirements : [];
    return doors.find((req)=> text(req && req.doorKey) === text(doorKey || 'single')) || (text(doorKey) === 'single' ? hinge : null);
  }

  function bindEvents(container, room, draft, opts){
    if(!container || !container.addEventListener || container.__cabinetHardwareReqBound) return;
    container.__cabinetHardwareReqBound = true;
    container.addEventListener('click', async function(ev){
      const target = ev && ev.target && ev.target.closest ? ev.target.closest('[data-req-action]') : null;
      if(!target) return;
      const action = target.getAttribute('data-req-action') || '';
      if(!['hinge-change','hinge-default','hinge-change-all','hinge-default-all'].includes(action)) return;
      ev.preventDefault();
      const doorKey = target.getAttribute('data-door-key') || 'single';
      const doorKeysAttr = target.getAttribute('data-door-keys') || '';
      const doorKeys = doorKeysAttr.split(',').map(text).filter(Boolean);
      const api = FC.cabinetHardwareRequirements;
      if(action === 'hinge-default' || action === 'hinge-default-all'){
        const keys = action === 'hinge-default-all' ? doorKeys : [doorKey];
        keys.forEach((key)=> { if(api && typeof api.setHingeDoorOverride === 'function') api.setHingeDoorOverride(draft, key, { typeId:'' }); });
        if(opts && typeof opts.onChange === 'function') opts.onChange({ doorKey:keys[0] || doorKey, doorKeys:keys, typeId:'', restoredDefault:true, draft });
        renderPanel(container, room, draft, opts || {});
        return;
      }
      const req = action === 'hinge-change-all' ? (findDoorRequirement(container, doorKeys[0] || 'left') || findDoorRequirement(container, 'single')) : findDoorRequirement(container, doorKey);
      const picked = await openHingeChoice(req);
      if(picked == null) return;
      const keys = action === 'hinge-change-all' ? doorKeys : [doorKey];
      keys.forEach((key)=> { if(api && typeof api.setHingeDoorOverride === 'function') api.setHingeDoorOverride(draft, key, { typeId:picked }); });
      if(opts && typeof opts.onChange === 'function') opts.onChange({ doorKey:keys[0] || doorKey, doorKeys:keys, typeId:picked, draft });
      renderPanel(container, room, draft, opts || {});
    });
  }

  function renderPanel(container, room, draft, opts){
    if(!container) return [];
    const options = opts || {};
    const requirements = getRequirements(room, draft);
    container.__cabinetHardwareReqLastRequirements = requirements;
    const cards = requirements.map(requirementCard).join('');
    container.innerHTML = '<div class="cabinet-hardware-req-panel cabinet-hardware-req-panel--compact">' +
      '<div class="cabinet-hardware-req-panel__head">' +
        '<div>' +
          '<h3 class="section-title cabinet-hardware-req-panel__title">Wymagania techniczne do wyceny</h3>' +
          '<div class="cabinet-hardware-req-panel__hint">Skrót tego, co WYCENA ma dobrać z katalogu okuć. Nie wybieramy tu producenta ani modelu.</div>' +
        '</div>' +
      '</div>' +
      '<div class="cabinet-hardware-req-panel__cards">' + (cards || '<div class="cabinet-hardware-req-empty">Brak wymagań technicznych dla tej szafki.</div>') + '</div>' +
    '</div>';
    bindEvents(container, room, draft, options);
    return requirements;
  }

  FC.cabinetHardwareRequirementsPanel = {
    renderPanel,
    getRequirements,
    formatTechnicalValue,
    buildHingeChoiceOptions,
    openHingeChoice,
  };
})();
