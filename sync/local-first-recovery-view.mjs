// Uses existing settings fields, panel and confirmation controls.
// The caller supplies the authorized P0-B recovery service.
export async function openProjectRecovery({window:w,service,roomId,roomName='',deviceLabel='',onConfirmed=()=>{}}){
  const fc=w.FC,h=fc.dataSettingsDom.h;
  const status=await service.inspect();
  const body=h('div',{class:'panel-box-form'});
  const scroll=h('div',{class:'panel-box-form__scroll'});
  const footer=h('div',{class:'panel-box-form__footer rozrys-panel-footer'});
  const result=h('p',{role:'status','aria-live':'polite'});
  scroll.append(h('p',{text:status.status.editor.active
    ? 'Projekt jest otwarty na urządzeniu '+status.deviceLabel+'.'
    : 'Projekt jest zwolniony.'}));
  const field=(label,value,attrs={})=>{
    const input=h('input',{class:'data-settings-form-control',value,...attrs});
    scroll.append(h('label',{class:'data-settings-form-field'},[
      h('span',{class:'data-settings-form-label',text:label}),input
    ]));
    return input;
  };
  const pin=status.requiresPin?field('PIN przejęcia','',{type:'password',inputmode:'numeric',autocomplete:'off',maxlength:4}):null;
  const name=roomId&&status.roomCopy.available?field('Nazwa kopii pomieszczenia',roomName||'Pomieszczenie — odzyskane',{maxlength:120}):null;
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
        const confirmed=await fc.confirmBox.ask({title:'Potwierdź odzyskanie projektu',
          message:variant==='room-copy'
            ? 'Zachowasz kopię wskazanego pomieszczenia. Projekt zostanie zastąpiony najnowszą potwierdzoną wersją, a kopia zostanie dodana do niej. Pozostałe lokalne zmiany zostaną odłożone do archiwum technicznego.'
            : 'Robocza wersja projektu i oczekujące zapisy zostaną zastąpione najnowszą potwierdzoną wersją. Poprzednie dane zostaną zachowane wyłącznie w archiwum technicznym.',
          confirmText:'Odzyskaj projekt',cancelText:'Wróć',confirmTone:'danger',dismissOnOverlay:false});
        if(!confirmed)return;
        const receipt=await service.start({variant,expected:status.status,pin:pin?.value,confirmed:true,deviceLabel,
          ...(variant==='room-copy'?{roomId,roomName:name.value}:{})});
        if(pin)pin.value='';
        fc.panelBox.close();
        fc.infoBox?.open({title:'Projekt odzyskany',message:receipt.operationId
          ? 'Projekt zapisano na tym urządzeniu. Kopia pomieszczenia oczekuje na potwierdzenie synchronizacji.'
          : 'Najnowszą potwierdzoną wersję projektu zapisano na tym urządzeniu.',okOnly:true});
        onConfirmed(receipt);
      }catch(error){result.textContent='Odzyskiwanie wstrzymane. '+(error?.code||'LF_PROJECT_RECOVERY_UNCONFIRMED');}
      finally{if(pin)pin.value='';buttons.forEach(b=>{b.disabled=false;});}
    });
    actions.append(action);
  }
  button('Pobierz najnowszą wersję','latest');
  if(name)button('Zachowaj kopię pomieszczenia','room-copy');
  footer.append(actions);body.append(scroll,footer);
  fc.panelBox.open({title:'Odzyskaj projekt',contentNode:body,width:'720px',boxClass:'panel-box--rozrys',dismissOnOverlay:false,dismissOnEsc:true,beforeClose:()=>!buttons.some(button=>button.disabled)});
}
