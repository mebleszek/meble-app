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
    const angle = formatTechnicalValue(param(params, 'kat_otwarcia'), 'kat_otwarcia');
    const overlay = formatTechnicalValue(param(params, 'nalozenie'), 'nalozenie');
    const parts = [];
    if(angle) parts.push(angle.replace(/^min\.\s*/i, ''));
    if(overlay) parts.push(overlay);
    const label = parts.join(' ').replace(/\s+/g, ' ').trim();
    return label || text(fallback) || 'wymaganie techniczne';
  }

  function hingeSummary(req){
    const params = req && req.technicalParams || {};
    const qty = Math.max(0, Math.round(number(req && req.qty)));
    const bits = [];
    const typeLabel = typeLabelFromParams(params, req && req.label);
    if(typeLabel) bits.push(typeLabel);
    const prowadnik = formatTechnicalValue(param(params, 'prowadnik'), 'prowadnik');
    if(prowadnik) bits.push('prowadnik: ' + prowadnik);
    if(param(params, 'hamulec') != null) bits.push('hamulec: ' + formatTechnicalValue(param(params, 'hamulec'), 'hamulec'));
    bits.push('ilość: ' + (qty > 0 ? `${qty} kpl.` : '0 kpl.'));
    return bits.join(' • ');
  }

  function addChoiceOption(map, option, sourceReq){
    const value = text(option && (option.typeId || option.value)) || text(sourceReq && sourceReq.typeId);
    if(!value || map.has(value)) return;
    const params = (option && option.technicalParams) || (sourceReq && sourceReq.technicalParams) || {};
    const label = text(option && option.label) || typeLabelFromParams(params, sourceReq && sourceReq.label) || value;
    map.set(value, {
      value,
      label,
      description: hingeSummary(Object.assign({}, sourceReq || {}, { technicalParams:params, label, typeId:value }))
    });
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

  async function openHingeChoice(req){
    const choiceApi = FC && FC.rozrysChoice;
    if(!(choiceApi && typeof choiceApi.openRozrysChoiceOverlay === 'function')) return null;
    const options = buildHingeChoiceOptions(req);
    if(!options.length) return null;
    return choiceApi.openRozrysChoiceOverlay({
      title:'Wybierz wymaganie kompletu zawiasowego',
      value:text(req && req.typeId),
      options
    });
  }

  function actionButtons(req){
    const doorKey = text(req && req.doorKey) || 'single';
    const disabledRestore = req && req.overridden ? '' : ' disabled aria-disabled="true"';
    return '<div class="cabinet-hardware-req-actions">' +
      '<button type="button" class="cabinet-hardware-req-action cabinet-hardware-req-action--change" data-req-action="hinge-change" data-door-key="' + esc(doorKey) + '">Zmień</button>' +
      '<button type="button" class="cabinet-hardware-req-action cabinet-hardware-req-action--default" data-req-action="hinge-default" data-door-key="' + esc(doorKey) + '"' + disabledRestore + '>Przywróć domyślne</button>' +
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
      return '<div class="cabinet-hardware-req-door-pair cabinet-hardware-req-door-pair--compact">' +
        compactDoor(doors[0], 'left') +
        '<div class="cabinet-hardware-req-door-divider" aria-hidden="true"></div>' +
        compactDoor(doors[1], 'right') +
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
      if(action !== 'hinge-change' && action !== 'hinge-default') return;
      ev.preventDefault();
      const doorKey = target.getAttribute('data-door-key') || 'single';
      const api = FC.cabinetHardwareRequirements;
      if(action === 'hinge-default'){
        if(api && typeof api.setHingeDoorOverride === 'function') api.setHingeDoorOverride(draft, doorKey, { typeId:'' });
        if(opts && typeof opts.onChange === 'function') opts.onChange({ doorKey, typeId:'', restoredDefault:true, draft });
        renderPanel(container, room, draft, opts || {});
        return;
      }
      const req = findDoorRequirement(container, doorKey);
      const picked = await openHingeChoice(req);
      if(picked == null) return;
      if(api && typeof api.setHingeDoorOverride === 'function') api.setHingeDoorOverride(draft, doorKey, { typeId:picked });
      if(opts && typeof opts.onChange === 'function') opts.onChange({ doorKey, typeId:picked, draft });
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
  };
})();
