(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function buildLabelWithAction(label, kind, value){
    const safeLabel = escapeHtml(label);
    const rawValue = String(value || '').trim();
    const href = kind === 'email' ? `mailto:${encodeURIComponent(rawValue)}` : `tel:${rawValue}`;
    const icon = kind === 'email' ? '@' : '☎';
    const chipText = kind === 'email' ? 'Email' : 'Zadzwoń';
    if(!rawValue) return `<div class="investor-label-row"><span>${safeLabel}</span></div>`;
    return `<div class="investor-label-row"><span>${safeLabel}</span><a class="investor-inline-link investor-inline-link--${kind}" href="${href}" aria-label="${safeLabel}"><span class="investor-inline-link__icon">${icon}</span><span class="investor-inline-link__text">${chipText}</span></a></div>`;
  }

  FC.investorLinks = { buildLabelWithAction };
})();
