(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;

  const KIND = 'meble-app-project-emergency';
  const VERSION = 1;
  let pending = null;
  let dialogOpen = false;

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return value == null ? value : JSON.parse(JSON.stringify(value)); }
  }

  function normalizeProjectRecord(record){
    try{
      if(FC.projectStore && typeof FC.projectStore.normalizeRecord === 'function') return FC.projectStore.normalizeRecord(record);
    }catch(_){ }
    return record && typeof record === 'object' ? clone(record) : null;
  }

  function normalizeInvestor(record){
    try{
      if(FC.investors && typeof FC.investors.normalizeInvestor === 'function') return FC.investors.normalizeInvestor(record);
    }catch(_){ }
    return record && typeof record === 'object' ? clone(record) : null;
  }

  function associatedInvestor(projectRecord){
    const investorId = String(projectRecord && projectRecord.investorId || '').trim();
    if(!investorId) return null;
    try{
      if(FC.investors && typeof FC.investors.getById === 'function') return normalizeInvestor(FC.investors.getById(investorId));
    }catch(_){ }
    return null;
  }

  function buildPayload(record){
    const project = normalizeProjectRecord(record);
    if(!(project && String(project.id || '').trim() && project.projectData && typeof project.projectData === 'object')) return null;
    return {
      kind:KIND,
      version:VERSION,
      exportedAt:new Date().toISOString(),
      project,
      investor:associatedInvestor(project),
    };
  }

  function stringifyPayload(payload){
    return JSON.stringify(payload, null, 2);
  }

  function parseImportPayload(input){
    let parsed = input;
    try{ if(typeof input === 'string') parsed = JSON.parse(input); }catch(_){ return null; }
    if(!(parsed && typeof parsed === 'object')) return null;
    if(String(parsed.kind || '') !== KIND || Number(parsed.version) !== VERSION) return null;
    const project = normalizeProjectRecord(parsed.project);
    if(!(project && String(project.id || '').trim() && project.projectData && typeof project.projectData === 'object')) return null;
    const investor = parsed.investor && typeof parsed.investor === 'object' ? normalizeInvestor(parsed.investor) : null;
    if(investor && String(investor.id || '').trim() && String(project.investorId || '').trim() && String(investor.id || '').trim() !== String(project.investorId || '').trim()) return null;
    return {
      kind:KIND,
      version:VERSION,
      exportedAt:String(parsed.exportedAt || ''),
      project,
      investor:investor && String(investor.id || '').trim() ? investor : null,
    };
  }

  function safeName(value){
    let text = String(value || 'projekt');
    try{ if(typeof text.normalize === 'function') text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }catch(_){ }
    text = text.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return text || 'projekt';
  }

  function fileName(record){
    const project = record || {};
    const date = new Date();
    const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') + '_' + [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')].join('-');
    return `meble-app-projekt-awaryjny_${safeName(project.title || project.id)}_${stamp}.json`;
  }

  function downloadPayload(payload, filename){
    if(!(payload && typeof payload === 'object')) return false;
    if(typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
    try{
      const blob = new Blob([stringifyPayload(payload)], { type:'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = String(filename || 'meble-app-projekt-awaryjny.json');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){ } }, 1000);
      return true;
    }catch(_){ return false; }
  }

  function downloadProject(record){
    const payload = buildPayload(record);
    if(!payload) return false;
    return downloadPayload(payload, fileName(payload.project));
  }

  function getCurrentRecord(){
    try{ return FC.projectStore && typeof FC.projectStore.getCurrentRecord === 'function' ? FC.projectStore.getCurrentRecord() : null; }
    catch(_){ return null; }
  }

  function info(title, message){
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function') return FC.infoBox.open({ title:String(title || ''), message:String(message || ''), okOnly:true });
    }catch(_){ }
    try{ if(typeof alert === 'function') alert(String(title || '') + '\n\n' + String(message || '')); }catch(_){ }
  }

  function importPayload(payload){
    const parsed = parseImportPayload(payload);
    if(!parsed) return { ok:false, reason:'invalid-payload' };
    const projectStore = FC.projectStore || null;
    if(!(projectStore && typeof projectStore.upsert === 'function')) return { ok:false, reason:'project-store-unavailable' };

    if(parsed.investor && FC.investors && typeof FC.investors.getById === 'function' && typeof FC.investors.upsert === 'function'){
      const existingInvestor = FC.investors.getById(parsed.investor.id);
      if(!existingInvestor){
        const restoredInvestor = FC.investors.upsert(parsed.investor);
        if(!restoredInvestor) return { ok:false, reason:'investor-save-failed' };
      }
    }

    const saved = projectStore.upsert(parsed.project);
    if(!saved) return { ok:false, reason:'project-save-failed' };
    try{ if(typeof projectStore.setCurrentProjectId === 'function') projectStore.setCurrentProjectId(saved.id); }catch(_){ }
    try{
      const investorId = String(saved.investorId || '').trim();
      if(investorId && FC.investors && typeof FC.investors.getById === 'function' && FC.investors.getById(investorId) && typeof FC.investors.setCurrentId === 'function'){
        FC.investors.setCurrentId(investorId);
      }
    }catch(_){ }
    pending = null;
    return { ok:true, project:saved };
  }

  function lastPendingRecord(){
    return pending && pending.projectRecord ? clone(pending.projectRecord) : null;
  }

  function handleProjectWriteFailure(failure, options){
    const opts = options || {};
    const projectRecord = normalizeProjectRecord(opts.projectRecord || getCurrentRecord());
    if(!projectRecord) return false;
    if(!(FC.choiceBox && typeof FC.choiceBox.ask === 'function')) return false;

    pending = {
      projectRecord:clone(projectRecord),
      retry:typeof opts.retry === 'function' ? opts.retry : null,
      failure:failure || null,
    };
    if(dialogOpen) return true;
    dialogOpen = true;

    Promise.resolve().then(async ()=>{
      let action = null;
      try{
        action = await FC.choiceBox.ask({
          title:'Nie udało się zapisać projektu',
          message:'Nie zamykaj tej strony. Aktualny projekt jest jeszcze w pamięci programu. Możesz pobrać kopię awaryjną na urządzenie albo spróbować zapisać ponownie.',
          actions:[
            { value:'download', text:'Pobierz kopię awaryjną', tone:'success' },
            { value:'retry', text:'Spróbuj zapisać ponownie', tone:'success' },
            { value:'back', text:'Wróć do programu', tone:'neutral' },
          ],
          dismissValue:'back',
          dismissOnOverlay:false,
          dismissOnEsc:false,
        });
      }catch(_){ action = 'back'; }
      dialogOpen = false;
      const snapshot = pending;
      if(!snapshot) return;

      if(action === 'download'){
        const ok = downloadProject(snapshot.projectRecord);
        if(ok) info('Kopia awaryjna pobrana', 'Projekt został zapisany do pliku JSON na tym urządzeniu. Możesz dalej pracować, ale dopóki zwykły zapis nie zadziała, nie zamykaj strony bez kolejnej kopii aktualnych zmian.');
        else info('Nie udało się pobrać kopii', 'Przeglądarka nie pozwoliła zapisać pliku. Nie zamykaj strony i spróbuj ponownie.');
        return;
      }

      if(action === 'retry'){
        const saved = snapshot.retry ? snapshot.retry() : (FC.projectStore && typeof FC.projectStore.upsert === 'function' ? FC.projectStore.upsert(snapshot.projectRecord) : null);
        if(saved){
          pending = null;
          info('Projekt zapisany', 'Ponowna próba zapisu zakończyła się powodzeniem.');
        }
      }
    });
    return true;
  }

  FC.projectFileRecovery = {
    KIND,
    VERSION,
    buildPayload,
    stringifyPayload,
    parseImportPayload,
    importPayload,
    downloadPayload,
    downloadProject,
    handleProjectWriteFailure,
    lastPendingRecord,
  };
})();
