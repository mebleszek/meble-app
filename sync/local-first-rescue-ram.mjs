// Known business state only. No whole-heap claim, getters/factories or session WRITE.
import {boundedJson,refuse} from './local-first-rescue-state.mjs';
export function readCurrentBusinessRam(w){
 const scope='CURRENT_DOCUMENT_KNOWN_BUSINESS_RAM';
 let project,ui;
 // Classic scripts keep these in the global lexical environment, not always
 // as window properties. Reading either does not initialize application data.
 try{project=typeof projectData!=='undefined'?projectData:w.projectData;ui=typeof uiState!=='undefined'?uiState:w.uiState;}catch(_){refuse('RESCUE_RAM_UNAVAILABLE');}
 if(project===undefined||ui===undefined||typeof w.document?.querySelectorAll!=='function')return {available:false,scope,data:null};
 const fields=['active','durable','projectId','roomId','startedAt','context','snapshot','expectedOwnerKnown','expectedOwnerRaw','lastError'];
 const session=w.FC.session,sessionEvidence=Object.fromEntries(fields.map(key=>[key,session?.[key]??null]));
 const controls=Array.from(w.document.querySelectorAll('#appView input, #appView select, #appView textarea, .modal input, .modal select, .modal textarea'))
  .filter(el=>!el.closest('[data-storage-recovery]')).map(el=>{
   if(el.type==='file'&&el.files?.length)refuse('RESCUE_RAM_UNAVAILABLE');
   return {tag:el.tagName,id:el.id,name:el.name,value:el.value,checked:!!el.checked,selected:el.selectedIndex??null};
  });
 const result={available:true,scope,data:{project,ui,sessionEvidence,controls}};boundedJson(result);return result;
}
