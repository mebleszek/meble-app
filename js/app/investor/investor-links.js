(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function buildLabelWithAction(label, kind, value){
    const safeLabel = escapeHtml(label);
    const href = kind === 'email' ? `mailto:${encodeURIComponent(String(value || '').trim())}` : `tel:${String(value || '').trim()}`;
    const icon = kind === 'email' ? '✉' : '✆';
    if(!String(value || '').trim()) return `<div class="investor-label-row"><span>${safeLabel}</span></div>`;
    return `<div class="investor-label-row"><span>${safeLabel}</span><a class="investor-inline-link" href="${href}" aria-label="${safeLabel}">${icon}</a></div>`;
  }

  FC.investorLinks = { buildLabelWithAction };
})();
