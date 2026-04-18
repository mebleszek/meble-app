(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

  const FIELD_DEFS = [
    { key:'roomHeight', label:'Wys. pomieszczenia (cm)', step:'0.1' },
    { key:'bottomHeight', label:'Wys. dołu z nogami (cm)', step:'0.1' },
    { key:'legHeight', label:'Wys. nóżek (cm)', step:'0.1' },
    { key:'counterThickness', label:'Gr. blatu (cm)', step:'0.1' },
    { key:'gapHeight', label:'Odstęp / gap (cm)', step:'0.1' },
    { key:'ceilingBlende', label:'Blenda góra (cm)', step:'0.1' }
  ];

  function getCurrentRoom(){
    try{ return String((window.uiState && window.uiState.roomType) || '').trim(); }catch(_){ return ''; }
  }

  function getRoomSettings(room){
    const key = String(room || '').trim();
    if(!key) return null;
    try{
      const data = window.projectData && window.projectData[key];
      if(data && typeof data === 'object') return data.settings || null;
    }catch(_){ }
    return null;
  }

  function getRoomLabel(room){
    const key = String(room || '').trim();
    if(!key) return 'Pomieszczenie';
    try{
      const registry = window.FC && window.FC.roomRegistry;
      if(registry && typeof registry.getRoomLabel === 'function') return registry.getRoomLabel(key);
    }catch(_){ }
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function formatNumber(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '0';
    const rounded = Math.round(n * 10) / 10;
    if(Math.abs(rounded - Math.round(rounded)) < 0.0001) return String(Math.round(rounded));
    return String(rounded).replace('.', ',');
  }

  function getAutoTopHeight(room, override){
    const source = override || getRoomSettings(room) || {};
    const h = (Number(source.roomHeight) || 0)
      - (Number(source.bottomHeight) || 0)
      - (Number(source.counterThickness) || 0)
      - (Number(source.gapHeight) || 0)
      - (Number(source.ceilingBlende) || 0);
    return h > 0 ? Math.round(h * 10) / 10 : 0;
  }

  function makeCompactSummary(settings){
    const line = document.createElement('div');
    line.className = 'wywiad-room-shell__stats-line';
    line.innerHTML = '<strong>Parametry:</strong> '
      + 'wys. ' + formatNumber(settings.roomHeight) + ' cm'
      + ' • dół ' + formatNumber(settings.bottomHeight) + ' cm'
      + ' • nóżki ' + formatNumber(settings.legHeight) + ' cm'
      + ' • blat ' + formatNumber(settings.counterThickness) + ' cm'
      + ' • gap ' + formatNumber(settings.gapHeight) + ' cm'
      + ' • blenda ' + formatNumber(settings.ceilingBlende) + ' cm';
    return line;
  }

  function bindTriggerButtons(root){
    const scope = root && root.querySelector ? root : document;
    const btn = scope.getElementById ? scope.getElementById('openRoomSettingsBtn') : document.getElementById('openRoomSettingsBtn');
    if(!btn || btn.__wywiadRoomSettingsBound) return;
    btn.__wywiadRoomSettingsBound = true;
    btn.addEventListener('click', (event)=>{
      try{ event.preventDefault(); event.stopPropagation(); }catch(_){ }
      open();
    });
  }

  function renderSummary(roomArg){
    const room = String(roomArg || getCurrentRoom() || '').trim();
    const wrap = document.getElementById('roomSettingsSummary');
    if(!wrap) return;
    wrap.innerHTML = '';
    const settings = getRoomSettings(room);
    if(!settings) return;
    wrap.appendChild(makeCompactSummary(settings));
    bindTriggerButtons(document);
  }

  function buildPreviewSettings(inputs){
    const preview = {};
    FIELD_DEFS.forEach((field)=>{
      const input = inputs[field.key];
      preview[field.key] = input ? input.value : 0;
    });
    return preview;
  }

  function applySetting(field, value){
    try{
      if(typeof window.handleSettingChange === 'function'){
        window.handleSettingChange(field, value);
        return;
      }
    }catch(_){ }
    try{
      const room = getCurrentRoom();
      if(!room) return;
      window.projectData[room].settings[field] = value === '' ? 0 : parseFloat(value);
      if(window.FC && window.FC.project && typeof window.FC.project.save === 'function'){
        window.projectData = window.FC.project.save(window.projectData);
      }
      try{ typeof window.renderTopHeight === 'function' && window.renderTopHeight(); }catch(_){ }
      try{ typeof window.renderCabinets === 'function' && window.renderCabinets(); }catch(_){ }
    }catch(_){ }
  }

  function open(){
    const room = getCurrentRoom();
    const settings = getRoomSettings(room);
    if(!room || !settings) return false;
    if(!(ns.panelBox && typeof ns.panelBox.open === 'function')) return false;

    const form = document.createElement('div');
    form.className = 'panel-box-form rozrys-panel-form rozrys-panel-form--stock wywiad-room-settings-modal investor-card-sync';

    const scroll = document.createElement('div');
    scroll.className = 'panel-box-form__scroll wywiad-room-settings-modal__scroll';
    form.appendChild(scroll);

    const intro = document.createElement('div');
    intro.className = 'wywiad-room-settings-modal__intro';

    const roomBadge = document.createElement('div');
    roomBadge.className = 'wywiad-room-settings-modal__room';
    roomBadge.textContent = getRoomLabel(room);

    const topStat = document.createElement('div');
    topStat.className = 'wywiad-room-settings-modal__auto';
    topStat.innerHTML = 'Auto-wysokość góry: <strong>' + formatNumber(getAutoTopHeight(room, settings)) + ' cm</strong>';

    intro.appendChild(roomBadge);
    intro.appendChild(topStat);
    scroll.appendChild(intro);

    const grid = document.createElement('div');
    grid.className = 'grid-2 wywiad-room-settings-modal__grid';
    scroll.appendChild(grid);

    const inputs = {};

    function refreshPreview(){
      const preview = buildPreviewSettings(inputs);
      topStat.innerHTML = 'Auto-wysokość góry: <strong>' + formatNumber(getAutoTopHeight(room, preview)) + ' cm</strong>';
    }

    FIELD_DEFS.forEach((field)=>{
      const fieldEl = document.createElement('div');
      fieldEl.className = 'wywiad-room-settings-modal__field';

      const label = document.createElement('label');
      label.className = 'wywiad-room-settings-modal__label';
      label.setAttribute('for', 'roomSettingModal_' + field.key);
      label.textContent = field.label;

      const input = document.createElement('input');
      input.type = 'number';
      input.id = 'roomSettingModal_' + field.key;
      input.className = 'investor-form-input wywiad-room-settings-modal__input';
      input.step = field.step || '0.1';
      input.inputMode = 'decimal';
      input.value = formatNumber(settings[field.key]).replace(',', '.');
      input.addEventListener('input', refreshPreview);
      input.addEventListener('change', ()=>{
        applySetting(field.key, input.value);
        renderSummary(room);
        refreshPreview();
      });

      inputs[field.key] = input;
      fieldEl.appendChild(label);
      fieldEl.appendChild(input);
      grid.appendChild(fieldEl);
    });

    const footer = document.createElement('div');
    footer.className = 'panel-box-form__footer rozrys-picker-footer rozrys-picker-footer--material wywiad-room-settings-modal__footer';
    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'btn';
    exitBtn.textContent = 'Wyjdź';
    exitBtn.addEventListener('click', ()=> close());
    footer.appendChild(exitBtn);
    form.appendChild(footer);

    ns.panelBox.open({
      title:'Parametry pomieszczenia',
      contentNode: form,
      width:'700px',
      boxClass:'panel-box--rozrys wywiad-room-settings-box',
      dismissOnOverlay:true,
      dismissOnEsc:true
    });

    requestAnimationFrame(()=>{
      try{ inputs.roomHeight && inputs.roomHeight.focus(); }catch(_){ }
    });
    return true;
  }

  function close(){
    try{ if(ns.panelBox && typeof ns.panelBox.close === 'function') ns.panelBox.close(); }catch(_){ }
    return true;
  }

  function init(){
    if(typeof document === 'undefined' || !document) return;
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> bindTriggerButtons(document), { once:true });
    else bindTriggerButtons(document);
  }

  init();

  ns.wywiadRoomSettings = Object.assign({}, ns.wywiadRoomSettings || {}, {
    open,
    close,
    renderSummary,
    getAutoTopHeight,
    bindTriggerButtons,
  });
})();
