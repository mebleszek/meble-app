/* tap_guard.js — global mobile double-fire guard
   Goal: prevent "pointer/touch then synthetic click" from triggering twice (open->close etc.)
   How: record last pointer timestamp; cancel the subsequent click if it happens shortly after.
   Safe: does NOT block keyboard-triggered clicks (detail === 0).
*/
(() => {
  'use strict';

  const WINDOW_MS = 650; // tweak if needed
  let lastPointerTs = 0;

  function hardStop(e){
    try{ e.preventDefault(); }catch{}
    try{ e.stopPropagation(); }catch{}
    try{ e.stopImmediatePropagation(); }catch{}
  }

  // Pointer events (mobile + modern desktop)
  document.addEventListener('pointerdown', () => { lastPointerTs = Date.now(); }, { capture:true, passive:true });
  document.addEventListener('pointerup',   () => { lastPointerTs = Date.now(); }, { capture:true, passive:true });

  // Some browsers still fire touch events separately
  document.addEventListener('touchstart', () => { lastPointerTs = Date.now(); }, { capture:true, passive:true });
  document.addEventListener('touchend',   () => { lastPointerTs = Date.now(); }, { capture:true, passive:true });

  // Cancel synthetic click right after pointer/touch.
  document.addEventListener('click', (e) => {
    // Keyboard activation: e.detail === 0 -> don't block
    if (e.detail === 0) return;

    const dt = Date.now() - lastPointerTs;
    if (dt >= 0 && dt < WINDOW_MS) {
      hardStop(e);
      return;
    }
  }, { capture:true, passive:false });
})();
