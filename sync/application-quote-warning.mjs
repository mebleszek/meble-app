import {safeError} from './local-first-values.mjs';
// Existing settings/modal pattern. No new header rows or independent sync timer.
export function quoteWarning({window:w,rows,refresh,release,offline=false,reservation=false}){
 const fc=w.FC,h=fc.dataSettingsDom.h,body=h('div',{class:'panel-box-form quote-lock-warning'});
 const scroll=h('div',{class:'panel-box-form__scroll'}),footer=h('div',{class:'panel-box-form__footer rozrys-panel-footer'});
 const list=h('ul'),note=h('p',{text:offline?'Brak połączenia. Wycena użyje pomieszczeń i cenników zapisanych na tym urządzeniu. Zapisze się tutaj jako niepotwierdzona. Czy kontynuować?':reservation
  ?'Wycena poczeka na potwierdzenie rezerwacji wszystkich wybranych pomieszczeń.'
  :'Te pomieszczenia są nadal otwarte lub ich zajętość jest niepotwierdzona. Wycena wykorzysta ostatnie potwierdzone wersje i może nie uwzględniać najnowszych zmian. Czy kontynuować?'});
 const status=h('p',{role:'status','aria-live':'polite'}),pin=h('input',{class:'data-settings-form-control',type:'password',inputmode:'numeric',autocomplete:'off',maxlength:4});
 const field=h('label',{class:'data-settings-form-field'},[h('span',{class:'data-settings-form-label',text:'PIN'}),pin]);field.hidden=true;
 const buttons=h('div',{class:'rozrys-panel-footer__actions'}),yes=h('button',{type:'button',class:'btn-success',text:'Tak'}),no=h('button',{type:'button',class:'btn',text:reservation?'Anuluj':'Nie'}),unlock=h('button',{type:'button',class:'btn-primary',text:reservation?'Przejmij PIN-em':'Uwolnij blokowane'});
 const retry=reservation?h('button',{type:'button',class:'btn-success',text:'Spróbuj ponownie'}):null;
 let busy=false,finished=false,current=rows,resolve;
 const promise=new Promise(done=>resolve=done);
 const ready=()=>current.length>0&&current.every(row=>row.state==='reserved');
 const canTake=row=>reservation?['held','waiting','declined'].includes(row.state):row.state==='held';
 function render(){
  const labels={reserved:'Rezerwacja potwierdzona',waiting:'Oczekiwanie na odpowiedź · ',declined:'Odmowa · ',occupied:'Zarezerwowane do wyceny · '};
  list.replaceChildren(...current.map(row=>h('li',{text:row.name+' — '+(labels[row.state]
   ?labels[row.state]+(row.state==='reserved'?'':row.deviceLabel)
   :row.state==='held'?row.deviceLabel:row.state==='released'?'Zwolnione':'Stan zajętości niepotwierdzony')})));
  unlock.disabled=busy||!current.some(canTake)||!reservation&&current.some(row=>row.state==='unconfirmed');
  if(retry)retry.disabled=busy;
 }
 function finish(value){if(finished)return;finished=true;pin.value='';if(body.isConnected)fc.panelBox.close();resolve(value);}
 yes.addEventListener('click',()=>{if(!busy)finish(true);});no.addEventListener('click',()=>{if(!busy)finish(false);});
 unlock.addEventListener('click',async()=>{
  if(busy||unlock.disabled)return;
  if(field.hidden){field.hidden=false;pin.focus();return;}
  busy=true;yes.disabled=no.disabled=true;render();
  try{
    const updated=await release(current.filter(canTake),pin.value);pin.value='';field.hidden=true;
    current=reservation?updated:await refresh();
    if(reservation&&ready()){finish(true);return;}
    render();status.textContent=reservation?'Sprawdź stan pozostałych pomieszczeń.':'Zwolnienie potwierdzone. Niewysłane zmiany innych urządzeń nie zostały pobrane. Wybierz Tak albo Nie.';
  }catch(error){pin.value='';status.textContent='Uwalnianie wstrzymane. '+safeError(error).code;try{current=await refresh();}catch(_){} }
  finally{busy=false;yes.disabled=no.disabled=false;render();}
 });
 retry?.addEventListener('click',async()=>{
  if(busy)return;
  busy=true;no.disabled=true;render();
  try{current=await refresh({retry:true});if(ready())finish(true);else status.textContent='Sprawdzono zaznaczone pomieszczenia.';}
  catch(error){status.textContent='Rezerwacja niepotwierdzona. '+safeError(error).code;}
  finally{busy=false;no.disabled=false;render();}
 });
 pin.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();unlock.click();}});
 scroll.append(list,note,field,status);buttons.append(retry||yes,no);if(!offline)buttons.append(unlock);footer.append(buttons);body.append(scroll,footer);render();
 fc.panelBox.open({title:'Pomieszczenia do wyceny',contentNode:body,width:'720px',boxClass:'panel-box--rozrys',dismissOnOverlay:false,dismissOnEsc:false,beforeClose(){if(busy)return false;finish(false);return true;}});
 return {promise,cancel:()=>finish(false)};
}
