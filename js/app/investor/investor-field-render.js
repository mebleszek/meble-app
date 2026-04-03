(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s){ return escapeHtml(s).replace(/\n/g, ' '); }

  function buildStaticLabel(label){
    return `<label class="investor-field-label">${escapeHtml(label)}</label>`;
  }

  function buildChoiceField(id, label, options, value, extraClass, opts){
    const cfg = Object.assign({ readonlyPreview:false }, opts || {});
    const optsHtml = (options || []).map((opt)=> `<option value="${escapeAttr(opt.value)}" ${String(opt.value) === String(value) ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('');
    const currentLabel = (options || []).find((opt)=> String(opt.value) === String(value))?.label || value || '';
    if(cfg.readonlyPreview){
      const display = String(currentLabel || '').trim() ? escapeHtml(currentLabel) : '<span class="investor-form-value__empty">—</span>';
      return `
        <div class="investor-choice-field investor-choice-field--readonly ${extraClass || ''}">
          ${buildStaticLabel(label)}
          <select id="${escapeAttr(id)}" hidden>${optsHtml}</select>
          <div class="investor-form-value investor-form-value--choice" id="${escapeAttr(id)}Preview">${display}</div>
          <div id="${escapeAttr(id)}Launch" hidden></div>
        </div>
      `;
    }
    return `
      <div class="investor-choice-field ${extraClass || ''}">
        ${buildStaticLabel(label)}
        <select id="${escapeAttr(id)}" hidden>${optsHtml}</select>
        <div id="${escapeAttr(id)}Launch"></div>
      </div>
    `;
  }

  function buildInputField(id, labelHtml, value, opts){
    const cfg = Object.assign({ full:false, readonly:false, textarea:false, rows:3, compact:false }, opts || {});
    const classes = [
      'investor-field-shell',
      cfg.full ? 'investor-field--full' : '',
      cfg.textarea ? 'investor-field-shell--textarea' : '',
      cfg.compact ? 'investor-field-shell--compact' : ''
    ].filter(Boolean).join(' ');
    const textValue = String(value == null ? '' : value);
    if(cfg.readonly){
      const display = textValue.trim() ? escapeHtml(textValue) : '<span class="investor-form-value__empty">—</span>';
      return `
        <div class="${classes}">
          ${labelHtml}
          <div class="investor-form-value${cfg.textarea ? ' investor-form-value--textarea' : ''}" id="${escapeAttr(id)}">${display}</div>
        </div>
      `;
    }
    if(cfg.textarea){
      return `
        <div class="${classes}">
          ${labelHtml}
          <textarea class="investor-form-input" id="${escapeAttr(id)}" rows="${cfg.rows}">${escapeHtml(textValue)}</textarea>
        </div>
      `;
    }
    return `
      <div class="${classes}">
        ${labelHtml}
        <input class="investor-form-input" id="${escapeAttr(id)}" value="${escapeAttr(textValue)}" />
      </div>
    `;
  }

  function buildPairRow(leftHtml, rightHtml, opts){
    const cfg = Object.assign({ full:false }, opts || {});
    if(cfg.full) return `<div class="investor-details-row investor-details-row--full">${leftHtml}</div>`;
    return `<div class="investor-details-row">${leftHtml}${rightHtml || '<div></div>'}</div>`;
  }

  FC.investorFieldRender = {
    escapeHtml,
    escapeAttr,
    buildStaticLabel,
    buildChoiceField,
    buildInputField,
    buildPairRow,
  };
})();
