(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  async function ask(cfg){
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function') return !!(await FC.confirmBox.ask(cfg));
    }catch(_){ }
    return true;
  }

  function info(title, message){
    try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title, message }); }catch(_){ }
  }

  function confirmDiscardInvestorChanges(){
    return ask({ title:'ANULOWAĆ ZMIANY?', message:'Niezapisane zmiany inwestora zostaną utracone.', confirmText:'✕ ANULUJ ZMIANY', cancelText:'WRÓĆ', confirmTone:'danger', cancelTone:'neutral' });
  }

  function confirmSaveInvestorChanges(){
    return ask({ title:'ZAPISAĆ ZMIANY?', message:'Zapisać zmiany w danych inwestora?', confirmText:'Zapisz', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' });
  }

  function confirmDeleteInvestor(){
    return ask({ title:'Usunąć inwestora?', message:'Tej operacji nie cofnisz.', confirmText:'Usuń', cancelText:'Wróć', confirmTone:'danger', cancelTone:'neutral' });
  }

  function confirmStatusChange(prevLabel, nextLabel){
    return ask({ title:'ZMIENIĆ STATUS?', message:`Status zmieni się z "${prevLabel}" na "${nextLabel}".`, confirmText:'Zmień', cancelText:'Wróć', confirmTone:'success', cancelTone:'neutral' });
  }

  FC.investorModals = {
    ask,
    info,
    confirmDiscardInvestorChanges,
    confirmSaveInvestorChanges,
    confirmDeleteInvestor,
    confirmStatusChange,
  };
})();
