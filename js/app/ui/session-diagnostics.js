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
      'RAM: '+flag(r.ram)+' | Trwała: '+flag(r.durable),
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
    ].join('\n');
  }
  function open(){
    const report=FC.sessionDiagnosticsReadonly(window);
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
