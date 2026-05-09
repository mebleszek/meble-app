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
    { id:'hardwareCategory', mountId:'hardwareCategoryLaunch', title:'Wybierz kategorię okucia', placeholder:'Kategoria okucia' },
    { id:'hardwareUnit', mountId:'hardwareUnitLaunch', title:'Wybierz jednostkę', placeholder:'Jednostka' },
    { id:'hardwareStatus', mountId:'hardwareStatusLaunch', title:'Wybierz status', placeholder:'Status' },
    { id:'hardwareSupplierId', mountId:'hardwareSupplierIdLaunch', title:'Wybierz dostawcę', placeholder:'Dostawca' },
    { id:'hardwareQuoteBase', mountId:'hardwareQuoteBaseLaunch', title:'Wybierz cenę bazową', placeholder:'Cena bazowa' },
    { id:'hardwarePricingMode', mountId:'hardwarePricingModeLaunch', title:'Wybierz sposób liczenia ceny', placeholder:'Sposób liczenia' },
    { id:'hardwareBundleCostMode', mountId:'hardwareBundleCostModeLaunch', title:'Wybierz cenę zakupu zestawu', placeholder:'Cena zakupu zestawu' },
  ];


  const FIELD_HELP = {
    formMaterialType:{ title:'Typ materiału', message:'Określa rodzaj materiału w katalogu, np. laminat, blat albo HDF. Ten wybór wpływa na dalsze filtrowanie producentów i porządek w katalogu.' },
    formManufacturer:{ title:'Producent', message:'Producent lub marka pozycji katalogowej. Ułatwia filtrowanie oraz późniejsze wybieranie materiałów i akcesoriów w programie.' },
    formSymbol:{ title:'Symbol', message:'Pole na oznaczenie handlowe, kod albo symbol katalogowy. Warto je uzupełniać, jeśli później chcesz łatwo znaleźć konkretną pozycję.' },
    formName:{ title:'Nazwa', message:'Pełna nazwa pozycji widoczna w katalogu i przy wyborze w aplikacji.' },
    formHasGrain:{ title:'Ma słoje', message:'Włącz, jeśli materiał ma kierunek słojów. Dzięki temu ROZRYS może pilnować właściwego ułożenia elementów.' },
    formPrice:{ title:'Cena (PLN)', message:'Cena jednostkowa pozycji katalogowej. Dla materiałów i akcesoriów to zwykła cena pozycji, dla czynności może to być stała kwota.' },
    hardwareCategory:{ title:'Kategoria okucia', message:'Grupa okucia, np. zawiasy, szuflady, podnośniki albo cargo. To porządkuje katalog i późniejsze filtrowanie.' },
    hardwareUnit:{ title:'Jednostka', message:'Jednostka rozliczeniowa okucia: sztuka, komplet, metr bieżący, m² albo zestaw składany.' },
    hardwareStatus:{ title:'Status', message:'Aktywne pozycje są używane normalnie. Ukryte zostają w katalogu, ale nie muszą być proponowane. Archiwalne są do historii i starych wycen.' },
    hardwareBundleCostMode:{ title:'Cena zakupu zestawu', message:'Własna cena zestawu oznacza, że wpisujesz cenę gotowego kompletu u dostawcy, a skład jest informacyjny. Licz ze składników sumuje realny zakup wybranych pozycji katalogu.' },
    hardwareSeries:{ title:'System / seria', message:'Seria lub system okucia, np. CLIP top, Aventos, Tandembox, Rejs albo cargo danego producenta.' },
    hardwareSupplierId:{ title:'Dostawca / miejsce zakupu', message:'Miejsce, z którego zwykle kupujesz tę pozycję. Zmiana dostawcy może podstawić domyślny rabat i VAT z ustawień dostawcy.' },
    hardwarePriceSource:{ title:'Źródło ceny', message:'Opis źródła ceny, np. Bivert, MAGO, faktura albo hurtownia. Może być zgodny z dostawcą albo doprecyzować konkretną fakturę.' },
    hardwareVatRate:{ title:'VAT %', message:'Stawka VAT używana do przeliczania netto/brutto w tej pozycji.' },
    hardwareCatalogPriceNet:{ title:'Cena katalogowa netto', message:'Cena przed rabatem dostawcy. Jeśli wpiszesz netto, program przeliczy brutto.' },
    hardwareCatalogPriceGross:{ title:'Cena katalogowa brutto', message:'Cena przed rabatem dostawcy. Jeśli wpiszesz brutto, program przeliczy netto.' },
    hardwareSupplierDiscountPercent:{ title:'Rabat dostawcy %', message:'Rabat, jaki realnie dostajesz u dostawcy. Służy do liczenia kosztu firmy, ale nie musi obniżać ceny do wyceny klienta.' },
    hardwarePurchasePriceNet:{ title:'Realny zakup netto', message:'Wyliczony koszt zakupu po rabacie. To jest koszt firmy do przyszłych raportów rentowności.' },
    hardwarePurchasePriceGross:{ title:'Realny zakup brutto', message:'Wyliczony koszt zakupu po rabacie. To jest koszt firmy do przyszłych raportów rentowności.' },
    hardwareQuoteBase:{ title:'Cena bazowa do wyceny', message:'Określa, od czego liczysz cenę dla klienta: od ceny katalogowej bez rabatu, od realnego zakupu po rabacie albo od ceny ręcznej.' },
    hardwarePricingMode:{ title:'Sposób liczenia ceny', message:'Tryb Narzut % liczy cenę z ceny bazowej. Tryb Cena ręczna pozwala wpisać cenę do wyceny, a program pokazuje narzut wynikowy.' },
    hardwareMarkupPercent:{ title:'Narzut %', message:'Narzut do ceny bazowej. Gdy wybierzesz cenę ręczną, pole jest blokowane i narzut jest tylko wynikiem obliczenia.' },
    hardwareQuotePriceNet:{ title:'Cena do wyceny netto', message:'Cena używana w wycenie. W trybie narzutu jest liczona automatycznie, w trybie ręcznym możesz ją wpisać.' },
    hardwareQuotePriceGross:{ title:'Cena do wyceny brutto', message:'Cena używana w wycenie i na liście katalogu. W trybie narzutu jest liczona automatycznie, w trybie ręcznym możesz ją wpisać.' },
    hardwarePriceUpdatedAt:{ title:'Data ceny', message:'Data ostatniego sprawdzenia ceny. Wpisuj w formacie RRRR-MM-DD.' },
    hardwareNote:{ title:'Notatka', message:'Notatka wewnętrzna, np. skład kompletu, uwagi zakupowe albo kiedy stosować dane okucie.' },
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
    laborVolumePricePerM3:{ title:'Gabaryt zł/m³', message:'Stała dopłata gabarytowa liczona od objętości szafki. Nie działa równocześnie z gabarytoczasem — jeśli gabaryt liczysz jako czas, ta dopłata zostaje wyłączona, żeby nie policzyć gabarytu podwójnie.' },
    laborVolumeTimeMode:{ title:'Gabarytoczas', message:'Dodatkowe liczenie czasu zależne od objętości. Po włączeniu gabarytoczasu program wyłącza dopłatę zł/m³, żeby ten sam gabaryt nie podbił ceny dwa razy.' },
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
        onChange:()=>{
          try{ if(ctx.currentListKind && ctx.currentListKind() === 'accessories' && ctx.priceModalHardwareForm && typeof ctx.priceModalHardwareForm.handleHardwareFieldInput === 'function') ctx.priceModalHardwareForm.handleHardwareFieldInput({ target:selectEl }); }catch(_){ }
          changeHandler();
        },
      });
    });
  }

  Object.assign(ctx, { mountFormChoiceLaunchers, decorateFieldHelpLabels });
})();
