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

      // After handling a pointerup on an action element, some browsers also emit a synthetic click
      // on the SAME element. We must suppress only that synthetic click, not the user's next real click
      // on a different element.
      let __fcSuppressClickSameElUntil = 0;
      let __fcLastPointerEl = null;
      let __fcLastPointerAction = null;
      let __fcSuppressAllUntil = 0;

      const __fcIsCloseAction = (action) => {
        if (!action) return false;
        return action === 'close-price' || action === 'close-cabinet' || action.startsWith('close-') || action.startsWith('cancel-');
      };

      const __fcHandle = (e) => {
        const t = e.target;
        if (!t || !t.closest) return false;

        const actEl = t.closest('[data-action]');
        if (!actEl) return false;

        const action = actEl.getAttribute('data-action');
        if (!action) return false;

        // Unknown actions are a hard error (prevents silent broken buttons)
        if (!FC.actions || typeof FC.actions.has !== 'function' || !FC.actions.has(action)) {
          throw new Error(`Nieznana akcja data-action="${action}". Dodaj handler w Actions registry.`);
        }

        // Always stop default/propa for handled actions to prevent click-through
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        return !!FC.actions.dispatch(action, { event: e, element: actEl, target: t });
      };

      // Mobile-safe: handle pointerup, suppress exactly one subsequent click if pointerup handled something
      document.addEventListener(
        'pointerup',
        (e) => {
          // Handle actions on pointerup (mobile-friendly)
          const t = e.target;
          const actEl = (t && t.closest) ? t.closest('[data-action]') : null;
          const action = actEl ? actEl.getAttribute('data-action') : null;

          const handled = __fcHandle(e);
          if (handled) {
            // Suppress only the synthetic click that some browsers fire on the SAME element
            __fcLastPointerEl = actEl;
            __fcLastPointerAction = action;
            __fcSuppressClickSameElUntil = Date.now() + 700;

            // If we just closed/cancelled a modal, also suppress ONE click-through anywhere
            // (prevents "close -> immediately opens something under it")
            if (__fcIsCloseAction(action)) {
              __fcSuppressAllUntil = Date.now() + 500;
            }
          }
        },
        { capture: true, passive: false }
      );

      document.addEventListener(
        'click',
        (e) => {
          const now = Date.now();

          // Global click-through suppress (only right after modal close/cancel)
          if (__fcSuppressAllUntil && now < __fcSuppressAllUntil) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            __fcSuppressAllUntil = 0;
            __fcSuppressClickSameElUntil = 0;
            __fcLastPointerEl = null;
            __fcLastPointerAction = null;
            return;
          }
          if (__fcSuppressAllUntil && now >= __fcSuppressAllUntil) {
            __fcSuppressAllUntil = 0;
          }

          // Suppress only the synthetic click on the SAME action element after pointerup
          if (__fcSuppressClickSameElUntil && now < __fcSuppressClickSameElUntil) {
            const t = e.target;
            const clickedActEl = (t && t.closest) ? t.closest('[data-action]') : null;
            const clickedAction = clickedActEl ? clickedActEl.getAttribute('data-action') : null;

            if (clickedActEl && clickedActEl === __fcLastPointerEl && clickedAction === __fcLastPointerAction) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              __fcSuppressClickSameElUntil = 0;
              __fcLastPointerEl = null;
              __fcLastPointerAction = null;
              return;
            }
          }
          if (__fcSuppressClickSameElUntil && now >= __fcSuppressClickSameElUntil) {
            __fcSuppressClickSameElUntil = 0;
            __fcLastPointerEl = null;
            __fcLastPointerAction = null;
          }

          __fcHandle(e);
        },
        { capture: true, passive: false }
      );

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
