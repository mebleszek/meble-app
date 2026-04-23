(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const core = FC.roomRegistryCore;

  if(!core){
    try{ console.error('[room-registry-render] Missing FC.roomRegistryCore before render layer load'); }catch(_){ }
    FC.roomRegistryRender = FC.roomRegistryRender || {
      renderRoomsView: ()=> {},
    };
    return;
  }

  const {
    getActiveRoomDefs,
    getProject,
    getProjectRoomDefs,
    normalizeRoomDef,
  } = core;

  function resolveDisplayedRooms(){
    try{
      const active = getActiveRoomDefs() || [];
      if(active.length) return active;
    }catch(_){ }
    try{
      const defs = getProjectRoomDefs(getProject()) || [];
      if(defs.length) return defs.map((room)=> normalizeRoomDef(room, room)).filter((room)=> room && room.id);
    }catch(_){ }
    return [];
  }

function renderRoomsView(){
    const view = document.getElementById('roomsView');
    if(!view) return;
    const rooms = resolveDisplayedRooms();
    const list = view.querySelector('.rooms');
    if(!list) return;
    list.innerHTML = '';
    if(!rooms.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Brak dodanych pomieszczeń. Dodaj pierwsze pomieszczenie.';
      list.appendChild(empty);
    }
    rooms.forEach((room)=>{
      const tile = document.createElement('div');
      tile.className = 'room-btn';
      tile.setAttribute('data-action', 'open-room');
      tile.setAttribute('data-room', room.id);
      const icon = room.baseType === 'kuchnia' ? '🍳' : room.baseType === 'szafa' ? '🚪' : room.baseType === 'lazienka' ? '🛁' : '🏠';
      tile.innerHTML = `<div style="font-size:28px">${icon}</div><span>${room.label}</span>`;
      list.appendChild(tile);
    });
    let addBtn = view.querySelector('.rooms-add-btn');
    const headerRow = view.querySelector('div');
    if(!addBtn && headerRow){
      addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-primary rooms-add-btn';
      addBtn.setAttribute('data-action', 'add-room');
      addBtn.textContent = 'Dodaj pomieszczenie';
      headerRow.appendChild(addBtn);
    }
  }

  FC.roomRegistryRender = {
    renderRoomsView,
  };
})();
