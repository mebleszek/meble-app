/* bindings.js — wiring zdarzeń + delegacja (wydzielone z app.js)
   Cel: trzymać całą logikę "klików i startu" w jednym miejscu, bez ruszania UI.
   Uwaga: Ten plik nie uruchamia nic sam. Jest wołany z initUI() w app.js.
*/
(() => {
  'use strict';

  window.FC = window.FC || {};
  const FC = window.FC;
  FC.bindings = FC.bindings || {};

  /**
   * Instaluje delegację data-action oraz podstawowe listenery inputów.
   * Idempotentne: można wołać wielokrotnie.
   */
  FC.bindings.install = function installBindings() {
    // ===== Delegated clicks (robust against DOM re-renders / new buttons) =====
    if (!window.__FC_DELEGATION__) {
      window.__FC_DELEGATION__ = true;

	      // Mobile-safe: handle pointerup. On mobile, after pointerup browsers often emit a synthetic click
	      // (sometimes delayed by alert()/layout), and when we close a modal that click can "go through" to
	      // an element under the modal. We solve it by swallowing EXACTLY ONE next click when the action
	      // was triggered from a modal.
	      
// Mobile-safe: handle pointerup. On mobile, after pointerup browsers often emit a synthetic click
// (sometimes delayed by alert()/layout). This can cause:
//  - double-dispatch (pointerup + click) for the same button
//  - click-through: when opening/closing a modal, the synthetic click lands "under" the modal.
//
// Strategy:
// 1) Always swallow the next synthetic click on the SAME action element when we handled pointerup.
// 2) Additionally, when we detect a modal OPEN or a modal CLOSE/CANCEL, swallow exactly ONE next click globally.
let swallowNextClickGlobal = false;
let swallowNextClickFromEl = null;

const armSameEl = (el) => { swallowNextClickFromEl = el || null; };
const armGlobal = () => { swallowNextClickGlobal = true; swallowNextClickFromEl = null; };

const dispatchActionFromEvent = (e) => {
  const t = e.target;
  if (!t || !t.closest) return { handled: false };

  const actEl = t.closest('[data-action]');
  if (!actEl) return { handled: false };

  const action = actEl.getAttribute('data-action');
  if (!action) return { handled: false };

  // Unknown actions are a hard error (prevents silent broken buttons)
  if (!FC.actions || typeof FC.actions.has !== 'function' || !FC.actions.has(action)) {
    throw new Error(`Nieznana akcja data-action="${action}". Dodaj handler w Actions registry.`);
  }

  // Stop default/propa for handled actions to prevent click-through
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const ok = !!FC.actions.dispatch(action, { event: e, element: actEl, target: t });
  return { handled: ok, action, actEl };
};

const getModalTop = () => {
  try {
    return (FC.modal && typeof FC.modal.top === 'function') ? FC.modal.top() : null;
  } catch (_) { return null; }
};

const shouldSwallowGlobalAfterAction = (action, actEl) => {
  if (!action || !actEl) return false;
  // Arm global swallow when action happens inside modal (prevents click-through after close)
  if (actEl.closest && actEl.closest('.modal-back')) return true;
  // Extra safety for explicit close/cancel actions
  if (action.startsWith('close-') || action.startsWith('cancel-')) return true;
  return false;
};

document.addEventListener(
  'pointerup',
  (e) => {
    const beforeTop = getModalTop();

    const res = dispatchActionFromEvent(e);
    if (!res.handled) return;

    // Always prevent double-dispatch for the SAME element
    armSameEl(res.actEl);

    const afterTop = getModalTop();
    const modalOpened = !beforeTop && !!afterTop;

    if (modalOpened) {
      // Swallow the synthetic click that would land inside the newly opened modal
      armGlobal();
    } else if (shouldSwallowGlobalAfterAction(res.action, res.actEl)) {
      // Swallow click-through after close/cancel inside modal
      armGlobal();
    }
  },
  { capture: true, passive: false }
);

document.addEventListener(
  'click',
  (e) => {
    if (swallowNextClickGlobal) {
      swallowNextClickGlobal = false;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    if (swallowNextClickFromEl) {
      const actEl = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      // Swallow only if it's the SAME element that already handled pointerup
      if (actEl && actEl === swallowNextClickFromEl) {
        swallowNextClickFromEl = null;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      // Do not keep stale reference
      swallowNextClickFromEl = null;
    }

    // Desktop/fallback path: allow normal click handling
    dispatchActionFromEvent(e);
  },
  { capture: true, passive: false }
);
    }

    // ===== Form inputs (change/input events are fine as direct listeners) =====
    // Te funkcje istnieją w app.js. Tu tylko spinamy listenery.
    const onSetting = (key) => (e) => {
      try {
        if (typeof window.handleSettingChange === 'function') {
          window.handleSettingChange(key, e?.target?.value);
        } else if (typeof handleSettingChange === 'function') {
          handleSettingChange(key, e?.target?.value);
        }
      } catch (_) {}
    };

    const bindChange = (id, key) => {
      const el = document.getElementById(id);
      if (el && !el.__fcBound) {
        el.addEventListener('change', onSetting(key));
        el.__fcBound = true;
      }
    };

    bindChange('roomHeight', 'roomHeight');
    bindChange('bottomHeight', 'bottomHeight');
    bindChange('legHeight', 'legHeight');
    bindChange('counterThickness', 'counterThickness');
    bindChange('gapHeight', 'gapHeight');
    bindChange('ceilingBlende', 'ceilingBlende');

    const priceSearchEl = document.getElementById('priceSearch');
    if (priceSearchEl && !priceSearchEl.__fcBound) {
      priceSearchEl.addEventListener('input', () => {
        try {
          if (typeof window.renderPriceModal === 'function') window.renderPriceModal();
          else if (typeof renderPriceModal === 'function') renderPriceModal();
        } catch (_) {}
      });
      priceSearchEl.__fcBound = true;
    }
  };
})();
