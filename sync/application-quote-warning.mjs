import {safeError} from './local-first-values.mjs';
// Existing settings/modal pattern. No new header rows or independent sync timer.
export function quoteWarning({window:w,rows,refresh,release}){
 const fc=w.FC,h=fc.dataSettingsDom.h,body=h('div',{class:'panel-box-form quote-lock-warning'});
 const scroll=h('div',{class:'panel-box-form__scroll'}),footer=h('div',{class:'panel-box-form__footer rozrys-panel-footer'});
 const list=h('ul'),note=h('p',{text:'Te pomieszczenia są nadal otwarte lub ich zajętość jest niepotwierdzona. Wycena wykorzysta ostatnie potwierdzone wersje i może nie uwzględniać najnowszych zmian. Czy kontynuować?'});
 const status=h('p',{role:'status','aria-live':'polite'}),pin=h('input',{class:'data-settings-form-control',type:'password',inputmode:'numeric',autocomplete:'off',maxlength:4});
 const field=h('label',{class:'data-settings-form-field'},[h('span',{class:'data-settings-form-label',text:'PIN'}),pin]);field.hidden=true;
 const buttons=h('div',{class:'rozrys-panel-footer__actions'}),yes=h('button',{type:'button',class:'btn-success',text:'Tak'}),no=h('button',{type:'button',class:'btn',text:'Nie'}),unlock=h('button',{type:'button',class:'btn-primary',text:'Uwolnij blokowane'});
 let busy=false,finished=false,current=rows,resolve;
 const promise=new Promise(done=>resolve=done);
 function render(){list.replaceChildren(...current.map(row=>h('li',{text:row.name+' — '+(row.state==='held'?row.deviceLabel:row.state==='released'?'Zwolnione':'Stan zajętości niepotwierdzony')})));unlock.disabled=busy||!current.some(row=>row.state==='held')||current.some(row=>row.state==='unconfirmed');}
 function finish(value){if(finished)return;finished=true;pin.value='';if(body.isConnected)fc.panelBox.close();resolve(value);}
 yes.addEventListener('click',()=>{if(!busy)finish(true);});no.addEventListener('click',()=>{if(!busy)finish(false);});
 unlock.addEventListener('click',async()=>{
  if(busy||unlock.disabled)return;
  if(field.hidden){field.hidden=false;pin.focus();return;}
  busy=true;yes.disabled=no.disabled=true;render();
  try{
   await release(current.filter(row=>row.state==='held'),pin.value);pin.value='';field.hidden=true;
   current=await refresh();render();status.textContent='Zwolnienie potwierdzone. Niewysłane zmiany innych urządzeń nie zostały pobrane. Wybierz Tak albo Nie.';
  }catch(error){pin.value='';status.textContent='Uwalnianie wstrzymane. '+safeError(error).code;try{current=await refresh();}catch(_){} }
  finally{busy=false;yes.disabled=no.disabled=false;render();}
 });
 pin.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();unlock.click();}});
 scroll.append(list,note,field,status);buttons.append(yes,no,unlock);footer.append(buttons);body.append(scroll,footer);render();
 fc.panelBox.open({title:'Pomieszczenia do wyceny',contentNode:body,width:'720px',boxClass:'panel-box--rozrys',dismissOnOverlay:false,dismissOnEsc:false,beforeClose(){if(busy)return false;finish(false);return true;}});
 return {promise,cancel:()=>finish(false)};
}
