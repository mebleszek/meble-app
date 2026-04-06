(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  const MODES = {
    furnitureProjects: {
      key:'furnitureProjects',
      title:'Projekty meblowe',
      subtitle:'Wybierz obszar związany z projektami meblowymi.',
      actions:[
        { label:'Materiały', action:'open-sheet-materials', tone:'neutral' },
        { label:'Akcesoria', action:'open-accessories', tone:'neutral' },
        { label:'Stawki wyceny mebli', action:'open-quote-rates', tone:'neutral' },
        { label:'Lista inwestorów', action:'open-investors-list', tone:'neutral' },
        { label:'Nowy inwestor', action:'new-investor', tone:'primary' },
      ],
    },
    workshopServices: {
      key:'workshopServices',
      title:'Drobne usługi stolarskie',
      subtitle:'Wybierz obszar związany z drobnymi usługami stolarskimi.',
      actions:[
        { label:'Usługi stolarskie', action:'open-workshop-services', tone:'neutral' },
        { label:'Lista zleceń usługowych', action:'open-service-orders-list', tone:'neutral' },
        { label:'Nowe zlecenie usługowe', action:'new-service-order', tone:'primary' },
      ],
    },
  };

  function byId(id){ return document.getElementById(id); }
  function escapeHtml(value){ return String(value == null ? '' : value).replace(/[&<>"']/g, (ch)=> ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch] || ch)); }

  function readMode(mode){ return MODES[String(mode || '')] || MODES.furnitureProjects; }

  function renderModeHub(mode){
    const root = byId('modeHubRoot');
    if(!root) return;
    const cfg = readMode(mode);
    root.innerHTML = `
      <div class="card home-hero">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div>
            <h2 style="margin:0">${escapeHtml(cfg.title)}</h2>
            <p class="muted" style="margin:6px 0 0">${escapeHtml(cfg.subtitle)}</p>
          </div>
          <button class="window-close-btn" type="button" aria-label="Wróć do startu" data-action="close-mode-hub">×</button>
        </div>
        <div class="home-actions" style="margin-top:14px">
          ${cfg.actions.map((item)=> `<button class="${item.tone === 'primary' ? 'btn-primary' : 'btn'} home-btn" type="button" data-action="${escapeHtml(item.action)}">${escapeHtml(item.label)}</button>`).join('')}
        </div>
      </div>
    `;
  }

  FC.workModeHub = {
    MODES,
    getModeConfig: readMode,
    renderModeHub,
  };
})();
