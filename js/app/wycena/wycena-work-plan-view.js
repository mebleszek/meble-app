// Presentation of the shared work plan; saves only through the existing offer-draft transaction.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  const labels={room:'Raz na pomieszczenie',quote:'Raz na wycenę',day:'Raz na dzień pracy'};
  function el(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
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
      }
      body.appendChild(el('p','Wyjazdy montażowe: '+value.trips+'. Etapy następują po sobie; dzień firmy: 8 h.'));
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
  FC.wycenaWorkPlanView={activities,schedule};
})();
