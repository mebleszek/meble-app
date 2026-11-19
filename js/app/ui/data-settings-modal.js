(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const dom = FC.dataSettingsDom || {};
  const h = dom.h;

  async function renderSecurity(scroll, isCurrent){
    const pin=FC.projectTakeoverPin;
    scroll.replaceChildren();
    const card=h('section',{class:'data-settings-card'},[
      h('h3',{text:'PIN przejęcia projektu'}),
      h('p',{class:'muted',text:'Wspólny dla Twoich urządzeń. Aplikacja sprawdza PIN przed przejęciem zajętego projektu.'}),
    ]);
    scroll.append(card);
    const result=h('p',{class:'muted',role:'status',text:'Sprawdzanie zapisanej konfiguracji…'});
    card.append(result);
    let status;
    try{status=await pin.status();}
    catch(_){result.textContent='Nie udało się potwierdzić konfiguracji PIN-u.';return;}
    if(!isCurrent())return;
    const field=(label,autocomplete)=>{
      const input=h('input',{class:'data-settings-form-control',type:'password',inputmode:'numeric',autocomplete,maxlength:4,pattern:'[0-9]{4}',required:'required'});
      form.append(h('label',{class:'data-settings-form-field'},[h('span',{class:'data-settings-form-label',text:label}),input]));
      return input;
    };
    const form=h('form',{class:'data-settings-form-grid'});
    const old=status.configured?field('Obecny PIN','current-password'):null;
    const next=field('Nowy PIN','new-password');
    const confirm=field('Powtórz nowy PIN','new-password');
    const save=h('button',{type:'submit',class:'btn btn-success',text:'Zapisz PIN'});
    form.append(save);
    card.insertBefore(form,result);
    result.textContent='';
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(save.disabled)return;
      save.disabled=true;
      try{
        await pin.save({currentPin:old?.value,newPin:next.value,confirmation:confirm.value,expectedRevision:status.revision});
        form.replaceChildren();
        result.textContent='Potwierdzono zapis PIN-u.';
      }catch(error){
        result.textContent=({
          LF_P0B_PIN_INVALID:'Wprowadź i powtórz ten sam czterocyfrowy PIN.',
          LF_P0B_PIN_INCORRECT:'Obecny PIN jest nieprawidłowy.',
          LF_P0B_PIN_CONFLICT:'Konfiguracja zmieniła się na innym urządzeniu. Otwórz Bezpieczeństwo ponownie.',
        })[error?.code]||'Zapis PIN-u nie został potwierdzony.';
      }finally{
        for(const input of [old,next,confirm])if(input)input.value='';
        save.disabled=false;
      }
    });
  }

  function open(){
    const store = FC.dataBackupStore;
    const snapshot = FC.dataBackupSnapshot;
    if(!(store && snapshot && h && FC.panelBox && typeof FC.panelBox.open === 'function')){
      if(dom.info) dom.info('Brak modułu backupu', 'Moduł backupu danych nie został załadowany.');
      return false;
    }

    let view = 'menu', renderVersion = 0;
    const body = h('div', { class:'panel-box-form data-settings-modal' });
    const scroll = h('div', { class:'panel-box-form__scroll data-settings-scroll' });
    const footer = h('div', { class:'panel-box-form__footer rozrys-panel-footer' });
    const footerActions = h('div', { class:'rozrys-panel-footer__actions' });
    const backBtn = h('button', { type:'button', class:'btn btn-primary', text:'Wróć' });

    footerActions.appendChild(backBtn);
    footer.appendChild(footerActions);
    body.appendChild(scroll);
    body.appendChild(footer);

    function renderFooter(){ backBtn.style.display = view === 'menu' ? 'none' : ''; footer.style.display = view === 'menu' ? 'none' : ''; }
    function setView(next){ view = (next === 'backup' || next === 'defaults' || next === 'workSources' || next === 'company' || next === 'businessCosts' || next === 'hourlyRates' || next === 'security' && FC.projectTakeoverPin) ? next : 'menu'; render(); }
    function render(){
      const version = ++renderVersion;
      renderFooter();
      if(view === 'backup') FC.dataSettingsBackupView.render({ scroll, store, snapshot, render, isCurrent:()=>view === 'backup' && renderVersion === version }).catch(error=>{if(view === 'backup' && renderVersion === version)dom.info('Backup niedostępny', String(error.message));});
      else if(view === 'security') void renderSecurity(scroll,()=>view === 'security' && renderVersion === version);
      else if(view === 'defaults' && FC.dataSettingsDefaultsView) FC.dataSettingsDefaultsView.render(scroll);
      else if(view === 'workSources' && FC.dataSettingsWorkSourcesView) FC.dataSettingsWorkSourcesView.render(scroll);
      else if(view === 'company' && FC.dataSettingsCompanyView) FC.dataSettingsCompanyView.render(scroll);
      else if(view === 'businessCosts' && FC.dataSettingsBusinessCostsView) FC.dataSettingsBusinessCostsView.render(scroll);
      else if(view === 'hourlyRates' && FC.dataSettingsHourlyRatesView) FC.dataSettingsHourlyRatesView.render(scroll);
      else FC.dataSettingsMenuView.render(scroll, setView);
    }

    backBtn.addEventListener('click', ()=> setView('menu'));
    render();
    FC.panelBox.open({ title:'Ustawienia', contentNode:body, width:'920px', boxClass:'panel-box--rozrys data-settings-panel', dismissOnOverlay:false, dismissOnEsc:true });
    return true;
  }

  FC.dataSettingsModal = { open };
})();
