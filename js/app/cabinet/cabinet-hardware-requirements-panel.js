// js/app/cabinet/cabinet-hardware-requirements-panel.js
// Widok wymagań technicznych szafki w modalu WYWIADU. Pokazuje wymagania, nie konkretne produkty katalogowe.
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

  function hingeRows(req){
    const params = req && req.technicalParams || {};
    const qty = Math.max(0, Math.round(number(req && req.qty)));
    const rows = [];
    rows.push(row('Cecha / typ', formatTechnicalValue(param(params, 'nalozenie'), 'nalozenie') || text(req && req.label)));
    rows.push(row('Kąt otwarcia', formatTechnicalValue(param(params, 'kat_otwarcia'), 'kat_otwarcia')));
    rows.push(row('Prowadnik', formatTechnicalValue(param(params, 'prowadnik'), 'prowadnik')));
    if(param(params, 'hamulec') != null) rows.push(row('Hamulec', formatTechnicalValue(param(params, 'hamulec'), 'hamulec')));
    rows.push(row('Ilość do wyceny', qty > 0 ? `${qty} szt.` : '0 szt.'));
    if(req && req.note) rows.push(row('Uwaga', req.note, 'cabinet-hardware-req-row--note'));
    if(req && req.ruleId) rows.push(row('Reguła źródłowa', req.ruleId, 'cabinet-hardware-req-row--muted'));
    return rows.join('');
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
    const title = text((req && req.category) || (req && req.hardwareGroup) || 'Okucie');
    let body = '';
    if(req && req.kind === 'hinge') body = hingeRows(req);
    else if(req && req.kind === 'none') body = noneRows(req);
    else body = genericRows(req);
    return '<div class="cabinet-hardware-req-card" data-requirement-kind="' + esc(req && req.kind || '') + '">' +
      '<div class="cabinet-hardware-req-card__head">' +
        '<div>' +
          '<div class="cabinet-hardware-req-card__title">' + esc(title) + '</div>' +
          '<div class="cabinet-hardware-req-card__subtitle">Wymagania techniczne, nie konkretny produkt katalogowy</div>' +
        '</div>' +
        statusBadge(req) +
      '</div>' +
      '<div class="cabinet-hardware-req-card__body">' + body + '</div>' +
    '</div>';
  }

  function getRequirements(room, draft){
    const api = FC.cabinetHardwareRequirements;
    if(!(api && typeof api.getCabinetHardwareRequirements === 'function')) return [];
    try{ return api.getCabinetHardwareRequirements(room, draft) || []; }
    catch(_){ return []; }
  }

  function renderPanel(container, room, draft){
    if(!container) return [];
    const requirements = getRequirements(room, draft);
    const cards = requirements.map(requirementCard).join('');
    container.innerHTML = '<div class="cabinet-hardware-req-panel">' +
      '<div class="cabinet-hardware-req-panel__head">' +
        '<div>' +
          '<h3 class="section-title cabinet-hardware-req-panel__title">Wymagania techniczne do wyceny</h3>' +
          '<div class="cabinet-hardware-req-panel__hint">Tutaj widać cechy, które WYCENA ma później dopasować do katalogu okuć. Nie pokazujemy tu producenta ani modelu.</div>' +
        '</div>' +
      '</div>' +
      '<div class="cabinet-hardware-req-panel__cards">' + (cards || '<div class="cabinet-hardware-req-empty">Brak wymagań technicznych dla tej szafki.</div>') + '</div>' +
    '</div>';
    return requirements;
  }

  FC.cabinetHardwareRequirementsPanel = {
    renderPanel,
    getRequirements,
    formatTechnicalValue,
  };
})();
