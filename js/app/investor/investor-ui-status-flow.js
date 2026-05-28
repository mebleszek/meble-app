// js/app/investor/investor-ui-status-flow.js
// Handles status-choice side effects for INWESTOR room status controls.
(() => {
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function refreshSessionButtons(){
    try{ if(FC.views && typeof FC.views.refreshSessionButtons === 'function') FC.views.refreshSessionButtons(); }catch(_){ }
  }

  function openInfo(title, message){
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title:String(title || ''), message:String(message || '') });
    }catch(_){ }
  }

  async function confirmGeneration(validation){
    try{
      if(FC.confirmBox && typeof FC.confirmBox.ask === 'function'){
        return await FC.confirmBox.ask({
          title:String(validation.title || 'Brak wyceny'),
          message:String(validation.message || ''),
          confirmText: validation.generationKind === 'final' ? 'Generuj końcową' : 'Generuj wstępną',
          cancelText:'Wróć',
          confirmTone:'success',
          cancelTone:'neutral'
        });
      }
    }catch(_){ }
    return false;
  }

  function buildGeneratedQuoteMessage(validation, generated, roomId, value){
    const finalQuote = validation.generationKind === 'final';
    const roomLabel = generated && generated.roomLabel ? generated.roomLabel : (validation.roomLabel || roomId);
    return {
      title: finalQuote ? 'Wycena końcowa wygenerowana' : 'Wycena wstępna wygenerowana',
      message: `${finalQuote ? 'Wygenerowano wycenę końcową' : 'Wygenerowano wycenę wstępną'} dla pomieszczenia „${roomLabel}”. Zaakceptuj ją w dziale Wycena, aby przejść na status „${validation.targetLabel || value}”.`
    };
  }

  async function handleBlockedStatusChange({ investorId, roomId, value, validation, render }){
    if(validation.requiresGeneration){
      const confirmed = await confirmGeneration(validation);
      if(confirmed){
        try{
          const generated = await FC.projectStatusManualGuard.generateScopedQuoteForRoom(investorId, roomId, validation.generationKind, { openTab:true });
          const notice = buildGeneratedQuoteMessage(validation, generated, roomId, value);
          openInfo(notice.title, notice.message);
          refreshSessionButtons();
          return true;
        }catch(err){
          openInfo('Nie udało się wygenerować wyceny', String(err && err.message || err || 'Błąd generowania wyceny.'));
        }
      }
      render();
      return true;
    }
    openInfo(String(validation.title || 'Zmiana statusu zablokowana'), String(validation.message || ''));
    render();
    return true;
  }

  async function resolveManualStatusTargetRooms(investorId, roomId, value, render){
    let targetRoomIds = [String(roomId || '')].filter(Boolean);
    try{
      if(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.buildManualStatusScopeChoices === 'function'){
        const decision = FC.projectStatusManualGuard.buildManualStatusScopeChoices(investorId, roomId, value);
        let picked = decision && decision.autoChoice ? decision.autoChoice : null;
        if(decision && decision.needsDecision){
          picked = FC.projectStatusScopeDecision && typeof FC.projectStatusScopeDecision.pickManualStatusScope === 'function'
            ? await FC.projectStatusScopeDecision.pickManualStatusScope(decision)
            : (Array.isArray(decision.choices) ? decision.choices[0] : null);
          if(!picked){
            render();
            return null;
          }
        }
        if(picked && Array.isArray(picked.roomIds) && picked.roomIds.length) targetRoomIds = picked.roomIds.slice();
      }
    }catch(_){ }
    return targetRoomIds;
  }

  async function applyManualStatusChange({ persistenceApi, investorId, roomId, value, render }){
    const targetRoomIds = await resolveManualStatusTargetRooms(investorId, roomId, value, render);
    if(!targetRoomIds) return;
    if(targetRoomIds.length > 1 && persistenceApi && typeof persistenceApi.setInvestorProjectStatusScope === 'function'){
      persistenceApi.setInvestorProjectStatusScope(investorId, targetRoomIds, value, { skipGuard:true, syncSelection:true });
    }else if(persistenceApi && typeof persistenceApi.setInvestorProjectStatus === 'function'){
      persistenceApi.setInvestorProjectStatus(investorId, targetRoomIds[0] || roomId, value, { skipGuard:true });
    }
    refreshSessionButtons();
    render();
  }

  async function handleStatusChange(args, roomId, value){
    const currentState = args.currentState || {};
    if(currentState.isEditing) return;
    const investor = typeof args.currentInvestor === 'function' ? args.currentInvestor() : null;
    const investorId = String(investor && investor.id || '');
    try{
      if(FC.projectStatusManualGuard && typeof FC.projectStatusManualGuard.validateManualStatusChange === 'function'){
        const validation = FC.projectStatusManualGuard.validateManualStatusChange(investorId, roomId, value);
        if(validation && validation.blocked){
          const handled = await handleBlockedStatusChange({ investorId, roomId, value, validation, render:args.render });
          if(handled) return;
        }
      }
    }catch(_){ }
    await applyManualStatusChange({
      persistenceApi: args.persistenceApi,
      investorId,
      roomId,
      value,
      render: args.render,
    });
  }

  function mountProjectStatusChoices(args){
    const roomUi = args && args.roomUi;
    const currentState = args && args.currentState || {};
    if(!(roomUi && typeof roomUi.mountProjectStatusChoices === 'function')) return false;
    roomUi.mountProjectStatusChoices(args.currentInvestor(), args.projectStatusOptions || [], {
      disabled: !!currentState.isEditing,
      onChange: async (roomId, value)=> handleStatusChange(args, roomId, value),
    });
    return true;
  }

  FC.investorUiStatus = {
    mountProjectStatusChoices,
    handleStatusChange,
  };
})();
