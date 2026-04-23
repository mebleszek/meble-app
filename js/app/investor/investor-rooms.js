(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }


  function resolveDisplayedRooms(inv){
    try{
      if(FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function'){
        const active = FC.roomRegistry.getActiveRoomDefs() || [];
        if(active.length) return active;
      }
    }catch(_){ }
    try{
      const defsApi = FC.roomRegistryDefinitions;
      const foundation = FC.roomRegistryFoundation;
      const project = foundation && typeof foundation.getProject === 'function' ? foundation.getProject() : null;
      const defs = defsApi && typeof defsApi.getProjectRoomDefs === 'function' ? (defsApi.getProjectRoomDefs(project) || []) : [];
      if(defs.length) return defs;
      const rooms = Array.isArray(inv && inv.rooms) ? inv.rooms : [];
      if(rooms.length && defsApi && typeof defsApi.normalizeRoomDef === 'function') return rooms.map((room)=> defsApi.normalizeRoomDef(room, room)).filter((room)=> room && room.id);
      return rooms;
    }catch(_){ }
    return [];
  }

  function getRoomStatus(inv, roomId){
    const rooms = inv && Array.isArray(inv.rooms) ? inv.rooms : [];
    const found = rooms.find((room)=> room && String(room.id || '') === String(roomId || ''));
    return String((found && (found.projectStatus || found.status)) || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
  }

  function buildProjectCards(inv, disabled, statusOptions){
    const rooms = resolveDisplayedRooms(inv);
    if(!rooms.length) return '<div class="muted">Brak dodanych pomieszczeń.</div>';
    const optsHtml = (statusOptions || []).map((opt)=> `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('');
    return rooms.map((room)=> {
      const status = getRoomStatus(inv, room.id);
      const buttonDisabled = disabled ? 'disabled' : '';
      const statusOptionsHtml = optsHtml.replace(`value="${escapeHtml(status)}"`, `value="${escapeHtml(status)}" selected`);
      return `
        <div class="investor-project-card">
          <div class="investor-project-card__top">
            <button class="btn investor-room-quick-btn${disabled ? ' is-disabled' : ''}" data-action="open-room" data-room="${escapeHtml(room.id)}" ${buttonDisabled}>${escapeHtml(room.label || room.name || room.id)}</button>
          </div>
          <div class="investor-project-status-shell${disabled ? ' is-disabled' : ''}">
            <select id="invProjectStatus_${escapeHtml(room.id)}" hidden>${statusOptionsHtml}</select>
            <div id="invProjectStatus_${escapeHtml(room.id)}Launch"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function mountProjectStatusChoices(inv, statusOptions, opts){
    const cfg = Object.assign({ disabled:false, onChange:null }, opts || {});
    const rooms = resolveDisplayedRooms(inv);
    const choiceApi = FC.investorChoice;
    if(!(choiceApi && typeof choiceApi.mountChoice === 'function')) return;
    rooms.forEach((room)=> {
      const selectEl = document.getElementById(`invProjectStatus_${room.id}`);
      const mount = document.getElementById(`invProjectStatus_${room.id}Launch`);
      if(!(selectEl && mount)) return;
      try{
        const currentValue = String(selectEl.value || '');
        let validationMap = null;
        try{
          if(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.buildManualStatusChoiceStates === 'function'){
            const built = FC.projectStatusManualGuard.buildManualStatusChoiceStates(
              String(inv && inv.id || ''),
              String(room.id || ''),
              Array.from(selectEl.options || []).map((opt)=> String(opt && opt.value || ''))
            );
            validationMap = built && built.states && typeof built.states === 'object' ? built.states : null;
          }
        }catch(_){ validationMap = null; }
        Array.from(selectEl.options || []).forEach((opt)=> {
          if(!opt) return;
          opt.disabled = false;
          opt.removeAttribute('data-description');
          if(cfg.disabled) return;
          try{
            const value = String(opt.value || '');
            let validation = validationMap ? validationMap[value] : null;
            if(!validation && FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function'){
              validation = FC.projectStatusManualGuard.validateManualStatusChange(String(inv && inv.id || ''), String(room.id || ''), value);
            }
            if(validation && validation.blocked){
              opt.disabled = true;
              opt.setAttribute('data-description', String(validation.title || validation.message || 'Niedostępne w tym stanie.'));
            }
          }catch(_){ }
          if(String(opt.value || '') === currentValue) opt.selected = true;
        });
      }catch(_){ }
      choiceApi.mountChoice({
        mount,
        selectEl,
        title:'Wybierz status projektu',
        buttonClass:'investor-choice-launch investor-project-status-btn',
        disabled: !!cfg.disabled,
        onChange: (value)=> {
          if(typeof cfg.onChange === 'function') cfg.onChange(String(room.id || ''), String(value || ''));
        }
      });
    });
  }

  FC.investorRooms = {
    buildProjectCards,
    mountProjectStatusChoices,
    getRoomStatus,
  };
})();
