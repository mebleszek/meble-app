// Approved panel/list patterns. Selection still uses the normal room action.
(function(){
 'use strict';const FC=window.FC=window.FC||{};let active=null;
 function close(){if(active?.body.isConnected)FC.panelBox.close();active?.stop();active=null;}
 function open(){
  if(!FC.roomProjectModel?.enabled()||FC.investorEditorState.hasUiLock())return false;
  const inv=FC.investors.getById(FC.investors.getCurrentId());if(!inv)return false;
  active?.stop();
  const h=FC.dataSettingsDom.h,body=h('div',{class:'panel-box-form'}),scroll=h('div',{class:'panel-box-form__scroll'});
  const controls=h('div',{class:'investor-room-head-actions'});
  controls.append(h('button',{type:'button',class:'btn-primary investor-add-room-btn','data-investor-action':'add-room',text:'Dodaj'}),
   h('button',{type:'button',class:'btn investor-manage-rooms-btn','data-investor-action':'manage-rooms',text:'Edytuj',...(!FC.roomProjectStore.list(inv.id).length?{disabled:true}:{})}));
  const list=h('div',{class:'investor-room-quick-list'});
  list.innerHTML=FC.investorRooms.buildProjectCards(inv,false,FC.investorUiRender.PROJECT_STATUS_OPTIONS);
  scroll.append(controls,list);body.append(scroll);
  FC.panelBox.open({title:'Projekty',contentNode:body,width:'720px',boxClass:'panel-box--rozrys room-project-picker',dismissOnOverlay:false});
  FC.investorRoomActions.bindRoomActions(body,inv,{isInvestorEditing:()=>FC.investorEditorState.hasUiLock(),onUpdated(){FC.investorUI.render();open();}});
  FC.investorUiStatus.mountProjectStatusChoices({roomUi:FC.investorRooms,currentInvestor:()=>FC.investors.getById(inv.id),currentState:{isEditing:false},
   persistenceApi:FC.investorPersistence,render(){FC.investorUI.render();open();},projectStatusOptions:FC.investorUiRender.PROJECT_STATUS_OPTIONS});
  const update=state=>{
   for(const node of body.querySelectorAll('[data-room-occupancy]')){
    const occupied=state.projects?.find(row=>row.projectId===node.dataset.roomOccupancy);
    node.textContent=state.state==='unconfirmed'||state.registry?.[node.dataset.roomOccupancy]===undefined?'Stan zajętości niepotwierdzony':occupied
     ? 'Otwarte: '+(occupied.label||occupied.deviceId)+(occupied.activity==='recent'?'':' · kontakt niepotwierdzony'):state.registry?.[node.dataset.roomOccupancy]===false?'Zwolnione':'Stan zajętości niepotwierdzony';
   }
  };
  const watch=FC.investorPresence?.watchPresence(inv.id,()=>navigator.onLine!==false,update);
  const refresh=()=>watch?.refresh();window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  const observer=new MutationObserver(()=>{if(!body.isConnected){stop();if(active?.body===body)active=null;}});
  let stopped=false;function stop(){if(stopped)return;stopped=true;observer.disconnect();watch?.close();window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);}
  observer.observe(document.body,{childList:true,subtree:true});active={body,stop};return true;
 }
 FC.roomProjectPicker={open,close};
})();
