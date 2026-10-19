// C2.0b — one fail-closed transition contract for leaving an active edit scope.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  let pending = false;
  let applying = false;
  let finishedScope = null;
  let calculationEpoch = 0;
  function invalidateCalculationContext(){ calculationEpoch += 1; }

  function isDivergent(){
    try{
      const runtime = FC.investorProjectRuntime;
      return !!(runtime && typeof runtime.hasProjectDivergence === 'function'
        && typeof projectData !== 'undefined' && runtime.hasProjectDivergence(projectData));
    }catch(_){ return true; }
  }
  function needsClosure(){
    return !!(FC.session && FC.session.active) || isDivergent();
  }
  function message(title, body){
    try{ if(FC.infoBox && typeof FC.infoBox.open === 'function') FC.infoBox.open({ title, message:body, okOnly:true }); }catch(_){ }
  }
  function reloadCentral(){
    try{
      if(!(FC.project && typeof FC.project.load === 'function')) return false;
      if(FC.projectStore){
        const id = FC.projectStore.getCurrentProjectId();
        const rows = JSON.parse(localStorage.getItem(FC.projectStore.PROJECTS_KEY));
        const matches = Array.isArray(rows) ? rows.filter(row=>row && String(row.id) === String(id)) : [];
        const investorId = FC.investors && FC.investors.getCurrentId ? FC.investors.getCurrentId() : localStorage.getItem('fc_current_investor_v1');
        if(!id || matches.length !== 1 || !matches[0].projectData
          || (investorId && String(matches[0].investorId || '') !== String(investorId))) return false;
      }
      const loaded = FC.project.load();
      if(!(loaded && typeof loaded === 'object')) return false;
      if(typeof projectData !== 'undefined') projectData = loaded;
      window.projectData = loaded;
      return true;
    }catch(_){ return false; }
  }
  function confirmedFinish(action){
    const session = FC.session;
    if(!(session && session.active)) return true;
    if(action === 'save'){
      if(!(FC.project && typeof FC.project.saveConfirmed === 'function')) return false;
      if(session.canSaveProject && session.canSaveProject() !== true) return false;
      const data = typeof projectData !== 'undefined' ? projectData : window.projectData;
      const result = FC.project.saveConfirmed(data);
      if(!(result && result.ok === true)) return false;
      if(typeof projectData !== 'undefined') projectData = result.project;
      window.projectData = result.project;
      if(typeof session.commit !== 'function' || session.commit() !== true) return false;
    }else if(action === 'discard'){
      if(typeof session.cancel !== 'function' || session.cancel() !== true) return false;
    }else return false;
    return reloadCentral();
  }
  async function requestTransition(destination, onApproved, options){
    if(pending){
      if(applying && !needsClosure()) return typeof onApproved === 'function' ? (await onApproved()) !== false : true;
      return false;
    }
    pending = true;
    try{
      const cfg = options || {};
      const session = FC.session;
      const sameRoom = cfg.roomId && session && session.active && String(cfg.roomId) === session.roomId
        && FC.projectStore && FC.projectStore.getCurrentProjectId() === session.projectId;
      if(needsClosure() && !sameRoom){
        const session = FC.session;
        if(!(session && typeof session.begin === 'function')) return false;
        // An untracked RAM edit must receive a durable baseline before a user can discard it.
        if(!session.active && session.begin() !== true) return false;
        const evidence = typeof session.inspectNavigationState === 'function' ? session.inspectNavigationState() : null;
        const runtime = FC.investorProjectRuntime;
        if(!evidence || !runtime || typeof runtime.hasProjectDivergence !== 'function'
          || typeof projectData === 'undefined' || !projectData || typeof projectData !== 'object'
          || !Object.prototype.hasOwnProperty.call(projectData,session.roomId)){
          message('Nie można potwierdzić stanu sesji', 'Zachowano sesję i bieżący widok. Sprawdź dane i spróbuj ponownie.');
          return false;
        }
        const ramDirty = runtime.hasProjectDivergence(projectData);
        if(typeof ramDirty !== 'boolean' || Object.keys(evidence.raws).some(key=>localStorage.getItem(key) !== evidence.raws[key])) return false;
        if(!evidence.dirty && !ramDirty){
          // A clean session needs durable cleanup only, never another project save.
          if(session.commit() !== true || session.active || localStorage.getItem('fc_edit_session_v1') !== null || !reloadCentral()){
            message('Nie udało się zakończyć edycji', 'Nie potwierdzono zakończenia czystej sesji. Nie przełączono widoku.');
            return false;
          }
        }else{
          const picker = FC.choiceBox;
          if(!(picker && typeof picker.ask === 'function')) return false;
          const label = String(destination || 'wybranego miejsca');
          const action = await picker.ask({
            title:'ZAKOŃCZ EDYCJĘ PROJEKTU',
            message:'Przed przejściem do ' + label + ' wybierz, co zrobić z bieżącą sesją.',
            dismissValue:'back',
            dismissOnOverlay:false,
            actions:[
              { value:'save', text:'Zapisz i przejdź', tone:'success' },
              { value:'discard', text:'Anuluj zmiany i przejdź', tone:'danger' },
              { value:'back', text:'Wróć do edycji', tone:'neutral' },
            ],
          });
          if(action !== 'save' && action !== 'discard') return false;
          if(confirmedFinish(action) !== true){
            message('Nie udało się zakończyć edycji',
              (session.lastError && session.lastError.message) ||
              'Nie potwierdzono bezpiecznego zapisu lub anulowania. Nie przełączono widoku.');
            return false;
          }
        }
      }else if(cfg.refreshCentral === true && !reloadCentral()){
        message('Nie udało się odczytać projektu', 'Nie potwierdzono aktualnych danych projektu. Nie przełączono widoku.');
        return false;
      }
      applying = true;
      let result;
      try{ result = typeof onApproved === 'function' ? onApproved() : true; }
      finally{ applying = false; }
      return (await result) !== false;
    }catch(_){
      message('Nie można przełączyć widoku', 'Operacja została wstrzymana. Sprawdź sesję i spróbuj ponownie.');
      return false;
    }finally{ applying = false; pending = false; }
  }
  function isEditState(state){
    return !!(state && state.entry === 'app' && state.roomType
      && !['wycena','rozrys','pokoje','inwestor'].includes(String(state.activeTab || 'wywiad')));
  }
  function prepareEditState(state, reopen){
    if(!canApplyUiState(state)) return false;
    if(!isEditState(state)) return true;
    if(!reopen && !(FC.session && FC.session.active) && finishedScope
      && finishedScope.projectId === FC.projectStore.getCurrentProjectId() && finishedScope.roomId === String(state.roomType)) return true;
    try{
      const record = FC.projectStore && FC.projectStore.getCurrentRecord();
      const investor = FC.investors && FC.investors.getCurrentId();
      if(!record || String(record.investorId) !== String(investor || '')
        || !Object.prototype.hasOwnProperty.call(record.projectData || {}, String(state.roomType))) return false;
      if(FC.projectDomainOperations && !FC.projectDomainOperations.recoverProject(record.id).ok) return false;
      if(FC.session && !FC.session.active){
        if(isDivergent() || !reloadCentral()) return false;
      }
      if(!FC.projectPcvPolicy || FC.projectPcvPolicy.ensureProjectMode(state.roomType).ok!==true) return false;
      if(!(FC.session && FC.session.begin(state.roomType) === true)) return false;
      finishedScope = null;
      return true;
    }catch(_){ return false; }
  }
  function canApplyUiState(next){
    const session = FC.session;
    if(!(session && session.active)) return true;
    const state = next || {};
    const context = session.context || {};
    const room = String(session.roomId || context.roomId || '');
    const investor = String(context.investorId || '');
    if((FC.projectStore && FC.projectStore.getCurrentProjectId() !== session.projectId)
      || ['home','modeHub','investorsList','serviceOrdersList'].includes(String(state.entry || ''))
      || ['wycena','rozrys','pokoje'].includes(String(state.activeTab || ''))
      || (room && String(state.roomType || '') !== room)
      || (investor && String(state.currentInvestorId || '') !== investor)){
      message('Najpierw zakończ edycję', 'Użyj Zapisz lub Anuluj. Zachowano bieżący projekt i sesję.');
      return false;
    }
    return true;
  }
  // Strict direct entry point for actions bypassing the tab router.
  function canCalculate(){
    if(FC.projectDomainOperations && !FC.projectDomainOperations.recoverProject(FC.projectStore.getCurrentProjectId()).ok) return false;
    if(!needsClosure()) return true;
    message('Najpierw zakończ edycję', 'Zapisz lub anuluj zmiany przed obliczeniem ROZRYSU lub utworzeniem WYCENY.');
    return false;
  }
  function calculationContext(selection){
    if(!canCalculate() || !reloadCentral()) return null;
    return {
      epoch:calculationEpoch,
      investorId:String(FC.investors && FC.investors.getCurrentId() || ''),
      projectId:FC.projectStore.getCurrentProjectId(),
      raw:localStorage.getItem(FC.projectStore.PROJECTS_KEY),
      selection:selection ? JSON.stringify(selection) : null,
    };
  }
  function calculationUnchanged(context, selection){
    return !!(context && context.epoch===calculationEpoch && !needsClosure()
      && !(FC.session && FC.session.canSaveProject && FC.session.canSaveProject()!==true) && FC.projectStore
      && String(FC.investors && FC.investors.getCurrentId() || '')===context.investorId
      && FC.projectStore.getCurrentProjectId() === context.projectId
      && window.projectData && window.projectData.meta
      && String(window.projectData.meta.assignedInvestorId)===context.investorId
      && localStorage.getItem(FC.projectStore.PROJECTS_KEY) === context.raw
      && (!context.selection || !selection || JSON.stringify(selection)===context.selection));
  }
  function assertCalculationCurrent(context, selection){
    if(calculationUnchanged(context,selection)) return true;
    const error=new Error('Dane lub zakres projektu zmieniły się. Nie zapisano wyceny. Ponów kalkulację na aktualnych danych.');
    error.code='calculation_context_changed';error.quoteValidation=true;error.title='Dane projektu zmieniły się';
    throw error;
  }

  FC.sessionNavigation = { requestTransition, needsClosure, canCalculate, confirmedFinish, reloadCentral, canApplyUiState, calculationContext, calculationUnchanged, assertCalculationCurrent, invalidateCalculationContext, prepareEditState, isEditState, sessionFinished:scope=>{ finishedScope = scope; } };
})();
