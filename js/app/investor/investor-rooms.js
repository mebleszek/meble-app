(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function getRoomStatus(inv, roomId){
    const rooms = inv && Array.isArray(inv.rooms) ? inv.rooms : [];
    const found = rooms.find((room)=> room && String(room.id || '') === String(roomId || ''));
    return String((found && (found.projectStatus || found.status)) || (FC.investors && FC.investors.DEFAULT_PROJECT_STATUS) || 'nowy');
  }

  function buildProjectCards(inv, disabled, statusOptions){
    const rooms = (FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function') ? FC.roomRegistry.getActiveRoomDefs() : [];
    if(!rooms.length) return '<div class="muted">Brak dodanych pomieszczeń.</div>';
    const optsHtml = (statusOptions || []).map((opt)=> `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`).join('');
    return rooms.map((room)=> {
      const status = getRoomStatus(inv, room.id);
      const buttonDisabled = disabled ? 'disabled' : '';
      const statusOptionsHtml = optsHtml.replace(`value="${escapeHtml(status)}"`, `value="${escapeHtml(status)}" selected`);
      return `
        <div class="investor-project-card">
          <button class="btn investor-room-quick-btn${disabled ? ' is-disabled' : ''}" data-action="open-room" data-room="${escapeHtml(room.id)}" ${buttonDisabled}>${escapeHtml(room.label || room.name || room.id)}</button>
          <div class="investor-project-status-shell">
            <select id="invProjectStatus_${escapeHtml(room.id)}" hidden>${statusOptionsHtml}</select>
            <div id="invProjectStatus_${escapeHtml(room.id)}Launch"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function mountProjectStatusChoices(inv, statusOptions, opts){
    const cfg = Object.assign({ disabled:false, onChange:null }, opts || {});
    const rooms = (FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function') ? FC.roomRegistry.getActiveRoomDefs() : [];
    const choiceApi = FC.investorChoice;
    if(!(choiceApi && typeof choiceApi.mountChoice === 'function')) return;
    rooms.forEach((room)=> {
      const selectEl = document.getElementById(`invProjectStatus_${room.id}`);
      const mount = document.getElementById(`invProjectStatus_${room.id}Launch`);
      if(!(selectEl && mount)) return;
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
