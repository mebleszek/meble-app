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
	      let swallowNextClick = false;

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

	      const shouldSwallowNextClick = (action, actEl) => {
	        if (!action || !actEl) return false;
	        // only arm swallow when action happens inside modal (prevents swallowing user's normal clicks)
	        if (actEl.closest && actEl.closest('.modal-back')) return true;
	        // extra safety for explicit close/cancel actions
	        if (action.startsWith('close-') || action.startsWith('cancel-')) return true;
	        return false;
	      };

	      // Handle pointerup and arm a single click swallow when needed
      document.addEventListener(
        'pointerup',
        (e) => {
	          const res = dispatchActionFromEvent(e);
	          if (res.handled && shouldSwallowNextClick(res.action, res.actEl)) {
	            swallowNextClick = true;
	          }
        },
        { capture: true, passive: false }
      );

      document.addEventListener(
        'click',
        (e) => {
	          if (swallowNextClick) {
	            swallowNextClick = false;
	            e.preventDefault();
	            e.stopPropagation();
	            e.stopImmediatePropagation();
	            return;
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
