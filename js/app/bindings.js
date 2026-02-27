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
      let __fcSuppressUntil = 0;
      let __fcSuppressEl = null;

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
          const handled = __fcHandle(e);
          if (handled) {
            __fcSuppressUntil = Date.now() + 700; // suppress synthetic click for ~700ms
            const t = e.target;
            __fcSuppressEl = (t && t.closest) ? t.closest('[data-action]') : null;
          }
        },
        { capture: true, passive: false }
      );

      document.addEventListener(
        'click',
        (e) => {
          if (__fcSuppressUntil && Date.now() < __fcSuppressUntil) {
            // Suppress only clicks on the same action element that triggered pointerup.
            const t = e.target;
            const clickedActEl = (t && t.closest) ? t.closest('[data-action]') : null;
            if (__fcSuppressEl && clickedActEl && __fcSuppressEl === clickedActEl) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              __fcSuppressUntil = 0;
              __fcSuppressEl = null;
              return;
            }
          }
          if (__fcSuppressUntil && Date.now() >= __fcSuppressUntil) {
            __fcSuppressUntil = 0;
            __fcSuppressEl = null;
          }
          __fcHandle(e);
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
