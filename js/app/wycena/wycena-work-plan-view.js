// Presentation of the shared work plan; saves only through the existing offer-draft transaction.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const labels={room:'Raz na pomieszczenie',quote:'Raz na wycenę',day:'Raz na dzień pracy'};
  function el(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
  const serviceLabels={delivery:'Dostawa',carrying:'Wnoszenie',assembly:'Montaż'};
  function servicesLauncher(card,ctx,deps={}){
    const draft=FC.quoteOfferStore?.getCurrentDraft?.();if(!draft)return;
    const current=FC.laborWorkPlan.normalizeServices(draft.services);
    const label=Object.keys(serviceLabels).filter(key=>current[key]).map(key=>serviceLabels[key]).join(' · ')||'Wykonanie warsztatowe';
    const launch=el('button',null,'btn rozrys-picker-launch rozrys-picker-launch--material');launch.type='button';launch.dataset.serviceScope='true';
    const value=el('div',null,'rozrys-picker-launch__value');
    value.appendChild(el('div','Zakres usług','rozrys-picker-launch__title'));
    value.appendChild(el('div',label,'rozrys-picker-launch__subtitle'));launch.appendChild(value);card.appendChild(launch);
    launch.addEventListener('click',()=>{
      const next={...current},body=el('div',null,'rozrys-picker-modal'),list=el('div',null,'rozrys-picker-list');
      const option=el('div',null,'rozrys-picker-option rozrys-picker-card is-selected');
      option.appendChild(el('div','Usługi do nowej wyceny','rozrys-picker-option__title'));
      option.appendChild(el('div','Dostawa obejmuje załadunek i rozładunek. Przejazd ekipy jest wspólny dla wybranych usług.','rozrys-picker-option__subtitle'));
      const chips=el('div',null,'rozrys-scope-chips quote-scope-picker-chips');
      let pending=false;
      const dirty=()=>JSON.stringify(next)!==JSON.stringify(current);
      const notice=el('p',null,'muted');notice.setAttribute('role','status');
      const footer=el('div',null,'rozrys-picker-footer rozrys-picker-footer--material'),actions=el('div',null,'rozrys-picker-footer-actions');
      const exit=el('button','Wyjdź','btn-primary'),cancel=el('button','Anuluj','btn-danger'),save=el('button','Zatwierdź','btn-success');
      for(const button of [exit,cancel,save])button.type='button';
      const update=()=>{actions.replaceChildren(...(dirty()?[cancel,save]:[exit]));save.disabled=pending;cancel.disabled=pending;};
      for(const [key,title]of Object.entries(serviceLabels)){
        const chip=el('label',null,'rozrys-scope-chip rozrys-scope-chip--room-match'+(next[key]?' is-checked':''));
        const input=el('input');input.type='checkbox';input.checked=next[key];input.dataset.service=key;
        input.addEventListener('change',()=>{next[key]=input.checked;chip.classList.toggle('is-checked',input.checked);update();});
        chip.append(input,el('span',title));chips.appendChild(chip);
      }
      const discard=()=>!pending&&(!dirty()||deps.askConfirm?.({title:'ANULOWAĆ ZMIANY?',message:'Niezapisane zmiany zakresu usług zostaną utracone.',confirmText:'✕ ANULUJ ZMIANY',cancelText:'WRÓĆ',confirmTone:'danger',cancelTone:'neutral'})||false);
      exit.addEventListener('click',()=>FC.panelBox.close());
      cancel.addEventListener('click',async()=>{if(await discard())FC.panelBox.close();});
      save.addEventListener('click',async()=>{
        if(pending||!dirty())return;
        pending=true;for(const input of chips.querySelectorAll('input'))input.disabled=true;update();
        const persist=()=>{const active=FC.quoteOfferStore.getCurrentDraft();
          if(active.projectId!==draft.projectId||active.investorId!==draft.investorId||JSON.stringify(FC.laborWorkPlan.normalizeServices(active.services))!==JSON.stringify(current))return false;
          return !!FC.quoteOfferStore.patchCurrentDraft({services:next});};
        try{const writer=FC.applicationWrite;const result=await(writer?.localOnly?writer.projectHandler(persist)():persist());if(!result)throw Error();Object.assign(current,next);FC.panelBox.close();deps.render?.(ctx);}
        catch(_){notice.textContent='Nie potwierdzono zapisu. Zachowano wybrany zakres usług.';}
        finally{pending=false;for(const input of chips.querySelectorAll('input'))input.disabled=false;update();}
      });
      option.appendChild(chips);list.appendChild(option);body.append(list,notice);footer.appendChild(actions);body.appendChild(footer);update();
      FC.panelBox.open({title:'Zakres usług',contentNode:body,width:'820px',boxClass:'panel-box--rozrys',dismissOnOverlay:false,beforeClose:discard});
    });
  }
  function accordion(card,title){
    // Copy the complete ROZRYS pattern, including its shared animation/group behavior.
    const box=el('div',null,'rozrys-material-accordion');
    const head=el('div',null,'rozrys-material-accordion__head');
    const trigger=el('button',null,'rozrys-material-accordion__trigger');
    trigger.type='button';trigger.setAttribute('aria-expanded','false');
    const caption=el('div',null,'rozrys-material-accordion__title');
    caption.appendChild(el('div',title,'rozrys-material-accordion__title-line1'));
    trigger.appendChild(caption);
    const arrow=el('span',null,'rozrys-material-accordion__chevron');arrow.setAttribute('aria-hidden','true');
    trigger.appendChild(arrow);head.appendChild(trigger);box.appendChild(head);
    const body=el('div',null,'rozrys-material-accordion__body');body.hidden=true;box.appendChild(body);
    trigger.addEventListener('click',()=>{
      const behavior=FC.accordionBehavior;
      if(box.classList.contains('is-open'))behavior.animateClose(box);
      else{behavior.closeInGroup(box);behavior.animateOpen(box);}
    });
    card.appendChild(box);return body;
  }
  function activities(card,room){
    if(!room)return;
    let plan,error;try{plan=FC.laborWorkPlan.collect([room]);}catch(e){error=e.code||'WORK_PLAN_UNAVAILABLE';}
    for(const [scope,title]of Object.entries(labels)){
      const body=accordion(card,title);body.dataset.billingScope=scope;
      const rows=(plan?.scoped||[]).filter(r=>r.billingScope===scope);
      if(error)body.appendChild(el('p','Nie można obliczyć zakresu: '+error));
      else if(!rows.length)body.appendChild(el('p','Brak czynności w aktualnym pomieszczeniu.'));
      for(const row of rows){const stages=row.dailyStages==='both'?'warsztat i montaż':row.dailyStages==='assembly'?'montaż':'warsztat';
        body.appendChild(el('p',row.name+' — '+(row.hours*60).toFixed(2)+' min'+(scope==='day'?' / dzień ('+stages+')':'')+'; ilość: '+row.quantity));
      }
      if(scope==='quote')body.appendChild(el('p','WYCENA połączy ilości z zaznaczonych pomieszczeń i zastosuje formułę jeden raz.'));
    }
  }
  function schedule(card,quote){
    const body=accordion(card,'HARMONOGRAM');body.dataset.workSchedule='true';
    const draft=FC.quoteOfferStore?.getCurrentDraft?.();
    let value=quote?.schedule;
    if(quote&&!value)body.appendChild(el('p','Ta oferta nie ma zapisanego harmonogramu. Nie przeliczono jej według obecnego cennika.'));
    if(!quote&&draft){try{value=FC.laborWorkPlan.collect(draft.selection.selectedRooms,draft.helperHours).schedule;}catch(e){body.appendChild(el('p','Nie można obliczyć harmonogramu: '+(e.code||'WORK_PLAN_UNAVAILABLE')));}}
    if(value){
      body.appendChild(el('p',quote?'Harmonogram zapisany w ofercie.':'Podgląd nowej wyceny.'));
      for(const [kind,label]of [['workshop','Warsztat'],['assembly','Montaż']]){
        const s=value[kind];body.appendChild(el('p',label+': '+(s?((s.minutes/60).toFixed(2)+' h prac + '+((s.totalMinutes-s.minutes)/60).toFixed(2)+' h czynności codziennych i przejazdów; dni: '+s.days):'brak aktualnego czasu trasy')));
        if(s?.conditionalOccurrences){const count=s.conditionalOccurrences.labor_daily_break||0;body.appendChild(el('p','Przerwy: '+count+'. '+(value.billBreaks===false?'Koszt pokrywa firma; czas pozostaje w harmonogramie.':'Koszt według reguły cennika.')));}
        if(s?.dayGroups?.length>1){const last=s.dayGroups[s.dayGroups.length-1];body.appendChild(el('p','Ostatni dzień: '+(last.totalMinutes/60).toFixed(2)+' h łącznie.'));}
      }
      body.appendChild(el('p','Wyjazdy montażowe: '+value.trips+'. Wspólny przejazd dla dostawy, wnoszenia i montażu. Etapy następują po sobie; dzień firmy: '+(Number.isFinite(value.dayMinutes)?(value.dayMinutes/60)+' h':'brak zapisanej długości')+'.'));
      if(value.services)body.appendChild(el('p','Zakres zapisany w harmonogramie: '+(Object.keys(serviceLabels).filter(key=>value.services[key]).map(key=>serviceLabels[key]).join(', ')||'wykonanie warsztatowe')+'.'));
      if(value.status!=='READY')body.appendChild(el('p','Harmonogram i koszty codzienne montażu są niekompletne. Uzupełnij aktualny czas trasy.'));
    }
    if(!draft)return;
    const label=el('label','Dodatkowa trzecia osoba — godziny do nowej wyceny');
    const input=el('input');input.type='number';input.min='0';input.step='any';input.value=String(draft.helperHours||0);input.dataset.helperHours='true';label.appendChild(input);body.appendChild(label);
    const button=el('button','Zapisz godziny pomocnika','btn btn-primary');button.type='button';button.dataset.helperSave='true';button.hidden=true;body.appendChild(button);
    let storedHours=Number(draft.helperHours)||0;
    input.addEventListener('input',()=>{button.hidden=Number(input.value)===storedHours;});
    const notice=el('p');body.appendChild(notice);
    button.addEventListener('click',async()=>{
      const hours=Number(input.value);if(!Number.isFinite(hours)||hours<0){notice.textContent='Podaj nieujemną liczbę godzin.';return;}
      const save=()=>{const current=FC.quoteOfferStore.getCurrentDraft();if(current.projectId!==draft.projectId||current.investorId!==draft.investorId)return false;return !!FC.quoteOfferStore.patchCurrentDraft({helperHours:hours});};
      button.disabled=true;
      try{const writer=FC.applicationWrite,result=await (writer?.localOnly?writer.projectHandler(save)():save());if(!result)throw Error();storedHours=hours;button.hidden=true;notice.textContent='Zapisano do nowej wyceny. Istniejąca oferta pozostaje bez zmian.';}
      catch(_){notice.textContent='Nie potwierdzono zapisu. Zachowano wpisane godziny.';}
      finally{button.disabled=false;}
    });
  }
  FC.wycenaWorkPlanView={activities,schedule,servicesLauncher};
})();
