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

      let __fcSuppressNextClick = false;

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
          if (handled) __fcSuppressNextClick = true;
        },
        { capture: true, passive: false }
      );

      document.addEventListener(
        'click',
        (e) => {
          if (__fcSuppressNextClick) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            __fcSuppressNextClick = false;
            return;
          }
          __fcHandle(e);
        },
        { capture: true, passive: false }
      );
    }

    // ===== Form inputs (change/input events are fine as direct listeners) =====
    // Te funkcje istnieją w app.js. Tu tylko spinamy listenery.
    const NUM_KEYS = new Set(['roomHeight','bottomHeight','legHeight','counterThickness','gapHeight','ceilingBlende']);
    const clampNum = (v, min, max) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      const a = (min != null) ? Math.max(min, n) : n;
      return (max != null) ? Math.min(max, a) : a;
    };

    const onSetting = (key) => (e) => {
      try {
        let val = e?.target?.value;
        if (NUM_KEYS.has(key)) {
          // Allow empty while typing; sanitize on change.
          const n = clampNum(val, 0, 10000);
          if (n === null) return;
          val = String(n);
        }
        if (typeof window.handleSettingChange === 'function') {
          window.handleSettingChange(key, val);
        } else if (typeof handleSettingChange === 'function') {
          handleSettingChange(key, val);
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
