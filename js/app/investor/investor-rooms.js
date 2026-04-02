(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function buildRoomButtons(disabled){
    const rooms = (FC.roomRegistry && typeof FC.roomRegistry.getActiveRoomDefs === 'function') ? FC.roomRegistry.getActiveRoomDefs() : [];
    if(!rooms.length) return '<div class="muted">Brak dodanych pomieszczeń.</div>';
    return rooms.map((room)=> `<button class="btn investor-room-quick-btn${disabled ? ' is-disabled' : ''}" data-action="open-room" data-room="${escapeHtml(room.id)}" ${disabled ? 'disabled' : ''}>${escapeHtml(room.label || room.name || room.id)}</button>`).join('');
  }

  FC.investorRooms = { buildRoomButtons };
})();
