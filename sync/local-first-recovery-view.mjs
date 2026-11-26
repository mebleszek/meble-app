// Uses existing settings fields, panel and confirmation controls.
// The caller supplies the authorized P0-B recovery service.
import {safeError} from './local-first-values.mjs';
export async function openProjectRecovery({window:w,service,roomId,roomName='',deviceLabel='',assertIdle,onConfirmed=()=>{}}){
  const fc=w.FC,h=fc.dataSettingsDom.h,independent=fc.roomProjectModel?.enabled()===true;
  const status=await service.inspect();
  const body=h('div',{class:'panel-box-form'});
  const scroll=h('div',{class:'panel-box-form__scroll'});
  const footer=h('div',{class:'panel-box-form__footer rozrys-panel-footer'});
  const result=h('p',{role:'status','aria-live':'polite'});
  scroll.append(h('p',{text:status.status.editor.active
    ? 'Projekt jest otwarty na urządzeniu '+status.deviceLabel+'.'
    : 'Projekt jest zwolniony.'}));
  const conflict=status.syncConflict==='conflict';
  const dependingOnAck=status.syncConflict==='awaiting-ack';
  if(conflict)scroll.append(h('p',{text:'To urządzenie ma niewysłane zmiany, a w chmurze jest już inna wersja tego pomieszczenia.'}));
  if(dependingOnAck)scroll.append(h('p',{text:'Najpierw trzeba sprawdzić potwierdzenie poprzedniego zapisu tego pomieszczenia.'}));
  const field=(label,value,attrs={})=>{
    const input=h('input',{class:'data-settings-form-control',value,...attrs});
    scroll.append(h('label',{class:'data-settings-form-field'},[
      h('span',{class:'data-settings-form-label',text:label}),input
    ]));
    return input;
  };
  const pin=status.requiresPin&&!dependingOnAck?field('PIN przejęcia','',{type:'password',inputmode:'numeric',autocomplete:'off',maxlength:4}):null;
  const name=roomId&&status.roomCopy.available&&!dependingOnAck?field('Nazwa kopii pomieszczenia',roomName||'Pomieszczenie — odzyskane',{maxlength:120}):null;
  if(!status.roomCopy.available)scroll.append(h('p',{class:'muted',text:'Kopia pomieszczenia jest wstrzymana. '+status.roomCopy.code}));
  scroll.append(h('p',{class:'muted',text:'Po odzyskaniu otwórz WYCENĘ i przelicz właściwe pomieszczenia.'}),result);
  const actions=h('div',{class:'rozrys-panel-footer__actions'});
  const buttons=[];
  function button(label,variant){
    const action=h('button',{type:'button',class:'btn btn-primary',text:label});
    buttons.push(action);
    action.addEventListener('click',async()=>{
      if(action.disabled)return;
      buttons.forEach(b=>{b.disabled=true;});
      try{
        const direction=variant==='local-wins'||variant==='remote-wins';
        const confirmed=await fc.confirmBox.ask({title:direction?'Potwierdź wybór wersji':'Potwierdź odzyskanie projektu',
          message:variant==='room-copy'
            ? (independent?'Zachowasz pomieszczenie jako osobny projekt tego inwestora. Oryginał zostanie zastąpiony najnowszą potwierdzoną wersją. Poprzednie dane i niewysłane operacje zostaną zachowane w archiwum technicznym.':'Zachowasz kopię wskazanego pomieszczenia. Projekt zostanie zastąpiony najnowszą potwierdzoną wersją, a kopia zostanie dodana do niej. Pozostałe lokalne zmiany zostaną odłożone do archiwum technicznego.')
            : variant==='local-wins'
              ? 'Wersja tego urządzenia zostanie zapisana do wysłania. Wersja z chmury zostanie zachowana w archiwum.'
              : 'Robocza wersja projektu i oczekujące zapisy zostaną zastąpione najnowszą potwierdzoną wersją. Poprzednie dane zostaną zachowane w archiwum technicznym.',
          confirmText:direction?label:'Odzyskaj projekt',cancelText:'Wróć',confirmTone:'danger',dismissOnOverlay:false});
        if(!confirmed)return;
        const receipt=await service.start({variant,expected:status.status,pin:pin?.value,confirmed:true,deviceLabel,assertIdle,
          ...(variant==='room-copy'?{roomId,roomName:name.value}:{})});
        if(pin)pin.value='';
        fc.panelBox.close();
        fc.infoBox?.open({title:direction?'Wersja zapisana':'Projekt odzyskany',message:receipt.operationId
          ? (direction?'Projekt zapisano na tym urządzeniu. Oczekuje na potwierdzenie synchronizacji.':'Projekt zapisano na tym urządzeniu. Kopia pomieszczenia oczekuje na potwierdzenie synchronizacji.')
          : 'Najnowszą potwierdzoną wersję projektu zapisano na tym urządzeniu.',okOnly:true});
        onConfirmed(receipt);
      }catch(error){result.textContent='Odzyskiwanie wstrzymane. '+safeError(error).code;}
      finally{if(pin)pin.value='';buttons.forEach(b=>{b.disabled=false;});}
    });
    actions.append(action);
  }
  if(conflict){
    button('Synchronizuj z tego urządzenia','local-wins');
    button('Synchronizuj na to urządzenie','remote-wins');
  }else if(!dependingOnAck)button('Pobierz najnowszą wersję','latest');
  if(name)button('Zachowaj kopię pomieszczenia','room-copy');
  footer.append(actions);body.append(scroll,footer);
  fc.panelBox.open({title:'Odzyskaj projekt',contentNode:body,width:'720px',boxClass:'panel-box--rozrys',dismissOnOverlay:false,dismissOnEsc:true,beforeClose:()=>!buttons.some(button=>button.disabled)});
}
