// Temporary operator observation. Never a permission to save, cancel or recover.
(function(){
  'use strict';
  const FC=window.FC=window.FC||{};
  function authorized(){
    try{
      const d=Object.getOwnPropertyDescriptor(window,'__FC_MAIN_ACCESS__');
      return !!d && d.writable===false && d.configurable===false && d.value.isValid()===true;
    }catch(_){return false;}
  }
  const flag=x=>x===true?'TAK':x===false?'NIE':'?';
  function format(r){
    if(r.status!=='READ_ONLY')return 'Odmowa diagnostyki: '+r.status+'\nNie odczytano kompletnego raportu.\nNie zmieniono danych ani sesji.';
    return [
      'Tylko odczyt — nie odblokowuje sesji.',
      'Kod: '+r.code,
      'Storage: '+r.storage+' | Schemat: '+(r.schema??'?'),
      'Payload: '+flag(r.present)+' | Aktywna: '+flag(r.active),
      'Obiekt sesji RAM: '+flag(r.ram)+' | Trwała: '+flag(r.durable),
      'Snapshot kompletny: '+flag(r.requiredKeys),
      'Struktura dowodu: '+flag(r.payloadShape),
      'Właściciel: '+flag(r.ownerMatch),
      'Projekt/inwestor/pokój: '+flag(r.contextMatch),
      'RAM = payload: '+flag(r.ramMatch),
      'UI RAM: '+flag(r.uiRam)+' | UI = zapis: '+flag(r.uiStoredMatch),
      'Potwierdzona rewizja znana: '+flag(r.expectedKnown),
      'C = B (baseline): '+flag(r.CB),
      'C = E (potwierdzona): '+flag(r.CE),
      'Ustawienia nieskopowane: '+flag(r.partsMatch),
      'Niedokończona operacja: '+flag(r.pending),
      'To obserwacja, nie zgoda na zapis lub rollback.',
    ].concat(r.usage?usageLines(r):[]).join('\n');
  }
  function usageLines(r){
    const u=r.usage;
    const size=units=>units==null?'?':((units*2)/1024).toFixed(1)+' KiB';
    if(u.status!=='MEASURED')return ['Pomiar rozmiaru tekstu: '+u.status+' (bez próby zapisu).'];
    const labels={session:'Sesja',projects:'Projekty',investors:'Inwestorzy',catalogs:'Katalogi i cenniki',history:'Historia ofert',backups:'Kopie bezpieczeństwa',other:'Pozostałe'};
    return [
      'Rozmiar tekstu UTF-16 (~2 bajty/jednostkę), nie pomiar wolnego miejsca:',
      'Łącznie: '+size(u.totalUnits),
      ...Object.entries(labels).map(([key,label])=>label+': '+size(u.categories[key].units)),
      'Największa wartość: '+size(u.largestValueUnits),
      'Rekordy projektów: '+(u.projectCount??'?')+' | największy: '+size(u.largestProjectUnits),
      'Bieżący rekord projektu: '+size(u.currentProjectUnits),
      'Zapisany payload sesji: '+size(u.sessionPayloadUnits),
      'Aktywna sesja RAM: '+flag(r.ramActive)+' | szacowany payload: '+size(u.ramPayloadUnitsEstimate),
      'Szacowany przyrost tekstu sesji: '+size(u.replacementNetUnitsEstimate),
      'Limit quota i tymczasowy koszt aktualizacji klucza: nieznane.',
      'Obiekt RAM nie dowodzi niezapisanej edycji. Brak payloadu nie dowodzi utraty projektu.',
    ];
  }
  function open(){
    const report=FC.sessionDiagnosticsReadonly(window,{storageUsage:true});
    const text=format(report);
    FC.infoBox.open({title:'Diagnostyka sesji',message:text,okOnly:true,sessionDiagnosticReport:true,
      secondaryAction:report.status==='READ_ONLY'?{text:'Kopiuj raport',async run({button,body}){
        if(!authorized()){body.textContent=format({status:'AUTH_DENIED'});button.disabled=true;return;}
        try{
          if(!navigator.clipboard || typeof navigator.clipboard.writeText!=='function')throw Error('CLIPBOARD_UNAVAILABLE');
          await navigator.clipboard.writeText(JSON.stringify(report));
          body.textContent=text+'\nSkopiowano raport.';
        }catch(_){body.textContent=text+'\nSchowek niedostępny — zrób zrzut ekranu.';}
      }}:null});
  }
  FC.sessionDiagnostics={open};
})();
