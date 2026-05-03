// js/app/material/price-modal-field-help.js
// Aplikacyjne launchery pól formularza cennika i objaśnienia pod ikoną ?.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const ctx = FC.priceModalContext || {};

  const FORM_CHOICE_FIELDS = [
    { id:'formMaterialType', mountId:'formMaterialTypeLaunch', title:'Wybierz typ materiału', placeholder:'Typ materiału' },
    { id:'formManufacturer', mountId:'formManufacturerLaunch', title:'Wybierz producenta', placeholder:'Producent' },
    { id:'formCategory', mountId:'formCategoryLaunch', title:'Wybierz kategorię', placeholder:'Kategoria' },
  ];


  const FIELD_HELP = {
    formMaterialType:{ title:'Typ materiału', message:'Określa rodzaj materiału w katalogu, np. laminat, blat albo HDF. Ten wybór wpływa na dalsze filtrowanie producentów i porządek w katalogu.' },
    formManufacturer:{ title:'Producent', message:'Producent lub marka pozycji katalogowej. Ułatwia filtrowanie oraz późniejsze wybieranie materiałów i akcesoriów w programie.' },
    formSymbol:{ title:'Symbol', message:'Pole na oznaczenie handlowe, kod albo symbol katalogowy. Warto je uzupełniać, jeśli później chcesz łatwo znaleźć konkretną pozycję.' },
    formName:{ title:'Nazwa', message:'Pełna nazwa pozycji widoczna w katalogu i przy wyborze w aplikacji.' },
    formHasGrain:{ title:'Ma słoje', message:'Włącz, jeśli materiał ma kierunek słojów. Dzięki temu ROZRYS może pilnować właściwego ułożenia elementów.' },
    formPrice:{ title:'Cena (PLN)', message:'Cena jednostkowa pozycji katalogowej. Dla materiałów i akcesoriów to zwykła cena pozycji, dla czynności może to być stała kwota.' },
    formCategory:{ title:'Kategoria', message:'Grupa porządkująca czynności w katalogu. Pomaga utrzymać porządek na liście i szybciej znaleźć właściwą pozycję.' },
    formServiceName:{ title:'Nazwa', message:'Nazwa czynności, stawki lub usługi. Powinna jasno mówić, czego dotyczy pozycja.' },
    formServicePrice:{ title:'Kwota stała / cena prosta', message:'Stała cena pozycji. Użyj jej, gdy czynność ma po prostu konkretną kwotę i nie ma być liczona z czasu albo innych parametrów.' },
    laborAutoRole:{ title:'Automat', message:'Określa, czy pozycja ma specjalną rolę w automatycznym liczeniu. Na przykład może być stawką godzinową albo regułą skręcania korpusu.' },
    laborRateType:{ title:'Stawka', message:'Wybierasz, z której stawki godzinowej korzysta dana reguła, np. warsztatowej albo montażowej.' },
    laborTimeBlockHours:{ title:'Czas bazowy', message:'Podstawowy czas doliczany dla jednej czynności albo jednego zastosowania reguły. Jeśli pozycja ma być czysto kwotowa, ustaw Brak.' },
    laborDefaultMultiplier:{ title:'Mnożnik domyślny', message:'Domyślny mnożnik trudności. Wartość 1 oznacza brak zmiany, 1.25 podnosi wynik o 25%.' },
    laborQuantityMode:{ title:'Tryb ilości', message:'Sposób liczenia przy większej liczbie sztuk. Możesz nie liczyć ilości wcale, liczyć liniowo, pakietami albo metodą start + krok.' },
    laborTierText:{ title:'Progi ilościowe', message:'Tu wpisujesz pakiety ilościowe dla trybu progowego. Przykład: 1-2=0.25;3-5=0.5;6-10=1 oznacza, ile godzin doliczyć dla danych zakresów ilości.' },
    laborStartHours:{ title:'Start h', message:'Początkowy czas przy trybie start + krok. To jednorazowa baza doliczana od startowej liczby sztuk.' },
    laborStartQty:{ title:'Start szt.', message:'Od ilu sztuk zaczyna działać wartość z pola Start h.' },
    laborStepEveryQty:{ title:'Co ile szt.', message:'Co ile kolejnych sztuk program ma doliczać następny krok czasu.' },
    laborStepHours:{ title:'Dodaj h', message:'Ile godzin doliczać za każdy kolejny krok ilości w trybie start + krok.' },
    laborVolumePricePerM3:{ title:'Gabaryt zł/m³', message:'Stała dopłata gabarytowa liczona od objętości szafki. To niezależna dopłata kwotowa za większy gabaryt.' },
    laborVolumeTimeMode:{ title:'Gabarytoczas', message:'Dodatkowe liczenie czasu zależne od objętości. Możesz je wyłączyć, liczyć stałe h/m³ albo ustawić progi objętości.' },
    laborVolumeTimePerM3:{ title:'Gabarytoczas h/m³', message:'Ile godzin doliczać za 1 m³, jeśli gabarytoczas działa w trybie h/m³.' },
    laborVolumeTimeTierText:{ title:'Progi gabarytoczasu', message:'Zakresy objętości i przypisany do nich czas. Przykład: 0.31-0.60=0.25;0.61-1=0.5.' },
    laborHeightMinMm:{ title:'Wysokość od (mm)', message:'Dolna granica wysokości, dla której reguła ma działać. Przydaje się np. do automatycznego skręcania korpusów wg wysokości.' },
    laborHeightMaxMm:{ title:'Wysokość do (mm)', message:'Górna granica wysokości, dla której reguła ma działać.' },
    laborActive:{ title:'Aktywna', message:'Jeśli zaznaczone, pozycja bierze udział w pracy programu i może być używana przy wycenie.' },
    laborInternalOnly:{ title:'Szczegóły tylko wewnętrzne', message:'Pozycja i jej szczegóły są przeznaczone do wewnętrznego liczenia. Ma pomagać Tobie, a nie być pokazywana klientowi jako jawny składnik.' },
  };

  function helpOpener(title, message){
    try{
      if(FC.infoBox && typeof FC.infoBox.open === 'function'){
        FC.infoBox.open({ title:String(title || 'Informacja'), message:String(message || '') });
        return;
      }
      if(FC.panelBox && typeof FC.panelBox.open === 'function'){
        FC.panelBox.open({ title:String(title || 'Informacja'), message:String(message || ''), width:'560px', boxClass:'panel-box--rozrys' });
      }
    }catch(_){ }
  }

  function buildLabelHelp(labelText, helpCfg){
    const row = document.createElement('div');
    row.className = 'label-help price-field-help';
    const text = document.createElement('span');
    text.className = 'label-help__text';
    text.textContent = String(labelText || '');
    row.appendChild(text);
    if(helpCfg && helpCfg.message){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'info-trigger';
      btn.setAttribute('aria-label', 'Pokaż informację: ' + String(helpCfg.title || labelText || ''));
      btn.addEventListener('click', ()=> helpOpener(helpCfg.title || labelText, helpCfg.message));
      row.appendChild(btn);
    }
    return row;
  }

  function decorateFieldHelp(fieldId){
    const control = ctx.byId(fieldId);
    const helpCfg = FIELD_HELP[fieldId];
    if(!(control && helpCfg)) return;
    let wrapper = control.parentElement;
    let label = null;
    if(fieldId === 'formHasGrain'){
      wrapper = control.parentElement;
      label = wrapper ? wrapper.querySelector('label') : null;
    }else if(wrapper){
      label = wrapper.querySelector(':scope > label');
    }
    if(!(wrapper && label) || label.dataset.helpDecorated === '1') return;
    const labelText = String(label.textContent || '').trim() || String(helpCfg.title || '');
    const helpNode = buildLabelHelp(labelText, helpCfg);
    label.replaceWith(helpNode);
    helpNode.dataset.helpDecorated = '1';
  }

  function decorateFieldHelpLabels(){
    Object.keys(FIELD_HELP).forEach(decorateFieldHelp);
  }


  function mountFormChoiceLaunchers(onChange){
    const changeHandler = typeof onChange === 'function' ? onChange : function(){};
    FORM_CHOICE_FIELDS.forEach((field)=>{
      const selectEl = ctx.byId(field.id);
      const mount = ctx.byId(field.mountId);
      if(!(selectEl && mount)) return;
      try{ selectEl.hidden = true; selectEl.setAttribute('aria-hidden', 'true'); }catch(_){ }
      ctx.mountChoice({
        selectEl,
        mountId:field.mountId,
        title:field.title,
        buttonClass:'investor-choice-launch price-labor-choice-launch',
        placeholder:field.placeholder,
        onChange:()=> changeHandler(),
      });
    });
  }

  Object.assign(ctx, { mountFormChoiceLaunchers, decorateFieldHelpLabels });
})();
