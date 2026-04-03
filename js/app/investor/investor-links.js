(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function buildIcon(kind){
    if(kind === 'email'){
      return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7.5h16c.55 0 1 .45 1 1v7c0 1.66-1.34 3-3 3H6c-1.66 0-3-1.34-3-3v-7c0-.55.45-1 1-1Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m4.5 8 7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.2 4.8h2.4l1.3 3.2-1.7 1.8a14.7 14.7 0 0 0 5 5l1.8-1.7 3.2 1.3v2.4a1.8 1.8 0 0 1-1.8 1.8A14.4 14.4 0 0 1 4.8 6.6 1.8 1.8 0 0 1 6.6 4.8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function buildLabelWithAction(label, kind, value){
    const safeLabel = escapeHtml(label);
    const rawValue = String(value || '').trim();
    const href = kind === 'email' ? `mailto:${encodeURIComponent(rawValue)}` : `tel:${rawValue}`;
    const icon = buildIcon(kind);
    const title = kind === 'email' ? 'Wyślij email' : 'Zadzwoń';
    if(!rawValue) return `<div class="investor-label-row"><span>${safeLabel}</span></div>`;
    return `<div class="investor-label-row"><span>${safeLabel}</span><a class="investor-inline-link investor-inline-link--${kind}" href="${href}" aria-label="${title}: ${safeLabel}" title="${title}"><span class="investor-inline-link__icon">${icon}</span><span class="investor-inline-link__text">${title}</span></a></div>`;
  }

  FC.investorLinks = { buildLabelWithAction };
})();
