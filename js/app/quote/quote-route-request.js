(function(){
  'use strict';
  const root=window,FC=root.FC=root.FC||{};
  const copy=value=>JSON.parse(JSON.stringify(value));
  function number(value){
    const raw=String(value??'').trim().replace(',','.');
    const n=raw===''?NaN:Number(raw);
    if(!Number.isFinite(n)||n<0)throw Error('TRANSPORT_INPUT_INVALID');
    return n;
  }
  function complete(context){
    if(context.isStale)return false;
    const t=context.transport||{};
    try{
      number(t.routeDistanceMeters!==''&&t.routeDistanceMeters!=null?t.routeDistanceMeters:t.distanceKm);
      number(t.routeDurationSeconds!==''&&t.routeDurationSeconds!=null?t.routeDurationSeconds:t.durationMin);
      return true;
    }catch(_){return false;}
  }
  function element(tag,attrs,children=[]){
    const node=document.createElement(tag);
    for(const [key,value]of Object.entries(attrs||{})){
      if(key==='text')node.textContent=value;
      else node.setAttribute(key,value);
    }
    children.forEach(child=>node.appendChild(child));return node;
  }
  function open(context){
    return new Promise(resolve=>{
      // Existing scrollable quote modal; four actions stay inside its scroll.
      const overlay=element('div',{class:'quote-scope-entry-backdrop'});
      const dialog=element('div',{class:'quote-scope-entry-modal',role:'dialog',tabindex:'-1','aria-modal':'true','aria-labelledby':'quoteRouteTitle'});
      const title=element('div',{class:'quote-scope-entry-modal__title',id:'quoteRouteTitle',text:'UZUPEŁNIJ DOJAZD'});
      const close=element('button',{type:'button',class:'quote-scope-entry-modal__close','aria-label':'Zamknij okno',text:'×'});
      const head=element('div',{class:'quote-scope-entry-modal__head'},[title,close]);
      const body=element('div',{class:'quote-scope-entry-modal__body'});
      body.appendChild(element('div',{class:'quote-scope-entry-modal__message',text:'Wybrane usługi wymagają aktualnej odległości i czasu dojazdu. Wpisane wartości w jedną stronę zapiszemy w kartotece inwestora.'}));
      const inputs={};
      for(const [key,label,value]of [['distanceKm','Odległość w jedną stronę (km)',context.oneWayKm],['durationMin','Czas w jedną stronę (min)',context.rawDurationMin]]){
        const input=element('input',{class:'investor-form-input quote-scope-entry-modal__input',type:'text',inputmode:'decimal','data-quote-route':key,value:completeValue(context,key)?String(value):''});
        inputs[key]=input;
        body.appendChild(element('label',{class:'quote-scope-entry-modal__field'},[element('span',{class:'quote-scope-entry-modal__field-label',text:label}),input]));
      }
      const error=element('div',{class:'quote-scope-entry-modal__hint',role:'alert'});body.appendChild(error);
      const actions=element('div',{class:'quote-scope-entry-modal__actions quote-scope-entry-modal__actions--stacked'});
      const finish=result=>{
        document.removeEventListener('keydown',onKey,true);overlay.remove();
        document.documentElement.classList.remove('modal-lock');document.body.classList.remove('modal-lock');resolve(result);
      };
      const onKey=event=>{if(event.key==='Escape'){event.preventDefault();finish({action:'cancel'});}};
      for(const [action,label,tone]of [['save','Zapisz i wyceń','btn-success'],['cancel','Anuluj','btn-danger'],['pickup','Odbiór osobisty','btn-primary'],['investor','Przejdź do danych inwestora','btn-primary']]){
        const button=element('button',{type:'button',class:tone+' quote-scope-entry-modal__action','data-quote-route':action,text:label});
        button.addEventListener('click',()=>{
          if(action==='save'){
            try{number(inputs.distanceKm.value);number(inputs.durationMin.value);}catch(_){error.textContent='Podaj odległość i czas jako liczby nie mniejsze od zera.';return;}
          }
          finish({action,distanceKm:inputs.distanceKm.value,durationMin:inputs.durationMin.value});
        });actions.appendChild(button);
      }
      dialog.appendChild(head);dialog.appendChild(body);dialog.appendChild(actions);
      overlay.appendChild(dialog);document.body.appendChild(overlay);
      close.addEventListener('click',()=>finish({action:'cancel'}));
      document.addEventListener('keydown',onKey,true);
      document.documentElement.classList.add('modal-lock');document.body.classList.add('modal-lock');
      dialog.focus({preventScroll:true});
    });
  }
  function completeValue(context,key){
    const t=context.transport||{},raw=key==='distanceKm'?(t.routeDistanceMeters!==''&&t.routeDistanceMeters!=null?t.routeDistanceMeters:t.distanceKm):(t.routeDurationSeconds!==''&&t.routeDurationSeconds!=null?t.routeDurationSeconds:t.durationMin);
    try{number(raw);return true;}catch(_){return false;}
  }
  function draftImage(draft){const value=copy(draft);delete value.updatedAt;return JSON.stringify(value);}
  async function prepare(getDraft){
    const draft=getDraft(),services=draft.services||{};
    if(!['delivery','carrying','assembly'].some(key=>services[key]!==false))return true;
    if(!FC.investorTransport)throw Error('TRANSPORT_CONTEXT_UNCONFIRMED');
    const context=FC.investorTransport.getCurrentTransportContext();
    if(!context.investor)throw Error('TRANSPORT_CONTEXT_UNCONFIRMED');
    if(complete(context))return true;
    const investor=context.investor,writer=FC.applicationWrite,projectId=FC.projectStore?.getCurrentProjectId();
    const before=draftImage(draft),contact=JSON.stringify(investor),origin=FC.investorTransport.companyAddress();
    const assertCurrent=()=>{
      root.__FC_MAIN_ACCESS__?.assert();
      if(FC.applicationWrite!==writer||FC.projectStore?.getCurrentProjectId()!==projectId||FC.investors?.getCurrentId()!==investor.id||root.uiState?.activeTab!=='wycena'||draftImage(getDraft())!==before||JSON.stringify(FC.investorPersistence.getInvestorById(investor.id))!==contact||FC.investorTransport.companyAddress()!==origin||FC.session?.active||FC.sessionNavigation?.canCalculate?.()===false)throw Error('TRANSPORT_CONTEXT_CHANGED');
    };
    assertCurrent();
    const decision=await FC.quoteRouteRequest.open(context);
    assertCurrent();
    if(decision?.action==='save'){
      const distance=number(decision.distanceKm),duration=number(decision.durationMin);
      await FC.investorTransport.saveManual(investor.id,distance,duration,assertCurrent);
      return true;
    }
    if(decision?.action==='pickup'){
      const saved=await FC.quoteOfferStore.saveSettings({projectId,investorId:investor.id},{services:{delivery:false,carrying:false,assembly:false}});
      if(!saved||!['delivery','carrying','assembly'].every(key=>getDraft().services?.[key]===false))throw Error('LF_OFFER_DRAFT_UNCONFIRMED');
      return true;
    }
    if(decision?.action==='investor'){
      const navigate=()=>{assertCurrent();return FC.tabNavigation.setActiveTab('inwestor');};
      if(writer)await writer.auto(navigate);else navigate();
    }
    return false;
  }
  FC.quoteRouteRequest={prepare,open};
})();
