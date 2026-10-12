// C2.0b — one fail-closed transition contract for leaving an active edit scope.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  let pending = false;

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
      const loaded = FC.project.load();
      if(!(loaded && typeof loaded === 'object')) return false;
      if(typeof projectData !== 'undefined') projectData = loaded;
      else window.projectData = loaded;
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
      if(typeof session.commit !== 'function' || session.commit() !== true) return false;
    }else if(action === 'discard'){
      if(typeof session.cancel !== 'function' || session.cancel() !== true) return false;
    }else return false;
    return reloadCentral();
  }
  async function requestTransition(destination, onApproved, options){
    if(pending) return false;
    pending = true;
    try{
      const cfg = options || {};
      if(needsClosure()){
        const session = FC.session;
        if(!(session && typeof session.begin === 'function')) return false;
        // An untracked RAM edit must receive a durable baseline before a user can discard it.
        if(!session.active && session.begin() !== true) return false;
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
      }else if(cfg.refreshCentral === true && !reloadCentral()){
        message('Nie udało się odczytać projektu', 'Nie potwierdzono aktualnych danych projektu. Nie przełączono widoku.');
        return false;
      }
      return typeof onApproved === 'function' ? (await onApproved()) !== false : true;
    }catch(_){
      message('Nie można przełączyć widoku', 'Operacja została wstrzymana. Sprawdź sesję i spróbuj ponownie.');
      return false;
    }finally{ pending = false; }
  }
  // Strict direct entry point for actions bypassing the tab router.
  function canCalculate(){
    if(!needsClosure()) return true;
    message('Najpierw zakończ edycję', 'Zapisz lub anuluj zmiany przed obliczeniem ROZRYSU lub utworzeniem WYCENY.');
    return false;
  }
  FC.sessionNavigation = { requestTransition, needsClosure, canCalculate, confirmedFinish, reloadCentral };
})();