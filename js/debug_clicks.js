(() => {
  'use strict';

  // Minimalny overlay debug – pokazuje co kliknąłeś i czy pasuje do naszych "akcji"
  const BOX_ID = 'fc-debug-box';

  function ensureBox() {
    let box = document.getElementById(BOX_ID);
    if (box) return box;
    box = document.createElement('div');
    box.id = BOX_ID;
    box.style.cssText = [
      'position:fixed',
      'bottom:10px',
      'left:10px',
      'right:10px',
      'z-index:999999',
      'background:rgba(0,0,0,.85)',
      'color:#fff',
      'font:12px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
      'padding:10px',
      'border-radius:12px',
      'box-shadow:0 6px 20px rgba(0,0,0,.35)',
      'max-height:40vh',
      'overflow:auto',
      'display:none'
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:8px;';
    const title = document.createElement('div');
    title.textContent = 'DEBUG KLIKÓW (tymczasowe)';
    title.style.cssText = 'font-weight:700;flex:1;';
    const btn = document.createElement('button');
    btn.textContent = 'X';
    btn.style.cssText = 'border:0;background:rgba(255,255,255,.15);color:#fff;padding:6px 10px;border-radius:10px;';
    btn.onclick = () => (box.style.display = 'none');

    header.appendChild(title);
    header.appendChild(btn);

    const pre = document.createElement('pre');
    pre.id = 'fc-debug-pre';
    pre.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;';

    box.appendChild(header);
    box.appendChild(pre);
    document.body.appendChild(box);
    return box;
  }

  function info(el) {
    if (!el) return '(brak)';
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className ? `.${String(el.className).trim().replace(/\s+/g,'.')}` : '';
    const data = [];
    if (el.dataset) {
      for (const [k,v] of Object.entries(el.dataset)) data.push(`data-${k}="${v}"`);
    }
    const txt = (el.textContent || '').trim().slice(0, 60).replace(/\s+/g, ' ');
    return `<${el.tagName.toLowerCase()}${id}${cls}> ${data.join(' ')} text="${txt}"`;
  }

  function match(el, sel) {
    try { return el && el.closest && el.closest(sel); } catch { return null; }
  }

  function onEvent(e) {
    const box = ensureBox();
    const pre = box.querySelector('#fc-debug-pre');

    const t = e.target;
    const aRoom = match(t, '.room-btn,[data-action="open-room"]');
    const aTab  = match(t, '.tab-btn,[data-action="tab"]');
    const aPlus = match(t, '#floatingAdd,[data-action="add"]');
    const aPriceM = match(t, '#openMaterialsBtn,[data-action="open-materials"]');
    const aPriceS = match(t, '#openServicesBtn,[data-action="open-services"]');
    const aClose = match(t, '[data-action="close"],.close-btn,#closePriceModal,#closeCabinetModal');

    pre.textContent =
      `EVENT: ${e.type}  (capture)\n\n` +
      `target:\n  ${info(t)}\n\n` +
      `closest room:\n  ${info(aRoom)}\n` +
      `closest tab:\n  ${info(aTab)}\n` +
      `closest plus:\n  ${info(aPlus)}\n` +
      `closest cennik-mat:\n  ${info(aPriceM)}\n` +
      `closest cennik-usl:\n  ${info(aPriceS)}\n` +
      `closest zamknij:\n  ${info(aClose)}\n\n` +
      `FLAGS:\n  __FC_DELEGATION__=${String(window.__FC_DELEGATION__)}\n  __HOTFIX_DELEGATION__=${String(window.__HOTFIX_DELEGATION__)}\n`;

    box.style.display = 'block';
  }

  // Listener w capture, żeby zobaczyć klik nawet gdy coś blokuje bubbling
  document.addEventListener('pointerup', onEvent, { capture: true });
  document.addEventListener('click', onEvent, { capture: true });
})();
