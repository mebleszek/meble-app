// Reviewed Bivert prices and actual package contents,25.11.2026.
// Manufacturer BOM: https://publications.blum.com/2024/catalogue/en/
(function(){
 'use strict';const FC=window.FC=window.FC||{};
 const products=[
  {"id":"hw_bivert_lift_12528","symbol":"175H3100","name":"Prowadnik prosty mimośrodowy na wkręty CLIP 0mm, niklowany, BLUM 175H3100","price":1.85,"pack":1,"url":"https://bivert.pl/blum-prowadnik-do-zawiasu-clip-175h3100-h-0,3,2432,12528"},
  {"id":"hw_bivert_lift_12637","symbol":"20K5101","name":"Mocowanie korpusu do AVENTOS HK-XS, BLUM 20K5101","price":2.27,"pack":1,"url":"https://bivert.pl/aventos-hk-xs-do-frontow-uchylnych-mocowanie-korp,3,1211,12637"},
  {"id":"hw_bivert_lift_12699","symbol":"20K1501","name":"Siłownik AVENTOS HK-XS z blumotion, BLUM 20K1501","price":35.89,"pack":1,"url":"https://bivert.pl/blum-20k1501-silownik-aventos-hk-xs-z-blumotion,3,1211,12699"},
  {"id":"hw_bivert_lift_13076","symbol":"70T5550.TL","name":"Zawias nakładany CLIP TOP 120°, bez sprężyny, na wkręty, niklowany, BLUM 70T5550","price":5.92,"pack":1,"url":"https://bivert.pl/blum-aventos-hf-70t5550-tl-zawias-clip-top-120,3,2420,13076"},
  {"id":"hw_bivert_lift_13121","symbol":"20K1101","name":"BLUM 20K1101 AVENTOS HK-XS do frontów uchylnych, siłownik, współczynnik mocy=200-1000 (siłownik jednostronny), niklowany","price":35.89,"pack":1,"url":"https://bivert.pl/blum-20k1101-silownik-aventos-hk-xs-z-blumotion,3,1211,13121"},
  {"id":"hw_bivert_lift_13123","symbol":"20K1101T","name":"Siłownik AVENTOS HK-XS z Tip-On,. BLUM 20K1101T","price":38.64,"pack":1,"url":"https://bivert.pl/blum-20k1101t-silownik-aventos-hk-xs-z-tip-on,3,1211,13123"},
  {"id":"hw_bivert_lift_13125","symbol":"20K1301","name":"Siłownik AVENTOS HK-XS z blumotion, BLUM 20K1301","price":35.89,"pack":1,"url":"https://bivert.pl/blum-20k1301-silownik-aventos-hk-xs-z-blumotion,3,1211,13125"},
  {"id":"hw_bivert_lift_13127","symbol":"20K1301T","name":"Siłownik AVENTOS HK-XS z Tip-On, BLUM 20K1301T","price":38.64,"pack":1,"url":"https://bivert.pl/blum-20k1301t-silownik-aventos-hk-xs-z-tip-on,3,1211,13127"},
  {"id":"hw_bivert_lift_13130","symbol":"20K1501T","name":"Siłownik AVENTOS HK-XS z Tip-On, BLUM 20K1501T","price":38.64,"pack":1,"url":"https://bivert.pl/blum-20k1501t-silownik-aventos-hk-xs-z-tip-on,3,1211,13130"},
  {"id":"hw_bivert_lift_13132","symbol":"20K4101","name":"Mocowanie frontu AVENTOS HK-XS do frontów drewnianych, na wkręty, BLUM 20K4101","price":1.56,"pack":1,"url":"https://bivert.pl/aventos-hk-xs-do-frontow-uchylnych-mocowanie-fron,3,1211,13132"},
  {"id":"hw_bivert_lift_121426","symbol":"22K2500","name":"Siłownik (zestaw L+P) AVENTOS HK top do frontów uchylnych, współczynnik mocy=930-2800 (przy 2 sztukach), odpowiedni do SERVO-DRIVE, BLUM 22K2500","price":169.93,"pack":2,"url":"https://bivert.pl/blum-aventos-hk-top-22k2500-silownik-zestaw-l-p,3,1211,121426"},
  {"id":"hw_bivert_lift_121427","symbol":"22K2500T","name":"Siłownik (zestaw L+P) AVENTOS HK top do frontów uchylnych, współczynnik mocy=930-2800 (przy 2 sztukach), do TIP-ON, BLUM 22K2500T","price":192.26,"pack":2,"url":"https://bivert.pl/blum-front-uchylny-aventos-hk-top-silownik-zesta,3,1211,121427"},
  {"id":"hw_bivert_lift_121428","symbol":"22K2700","name":"Siłownik (zestaw L+P) AVENTOS HK top do frontów uchylnych, współczynnik mocy=1730-5200 (przy 2 sztukach), odpowiedni do SERVO-DRIVE, BLUM 22K2700","price":179.99,"pack":2,"url":"https://bivert.pl/blum-front-uchylny-aventos-hk-top-silownik-zesta,3,1211,121428"},
  {"id":"hw_bivert_lift_121430","symbol":"22K2700T","name":"Front uchylny AVENTOS HK top, siłownik (zestaw L+P), współczynnik mocy=1730-5200 (przy 2 sztukach), do TIP-ON, BLUM 22K2700T","price":204.53,"pack":2,"url":"https://bivert.pl/blum-front-uchylny-aventos-hk-top-silownik-zesta,3,1211,121430"},
  {"id":"hw_bivert_lift_121431","symbol":"22K2900","name":"Siłownik (zestaw L+P) AVENTOS HK top do frontów uchylnych, współczynnik mocy=3200-9000 przy 2 szt., odpowiedni do SERVO-DRIVE, BLUM 22K2900","price":210.63,"pack":2,"url":"https://bivert.pl/blum-front-uchylny-aventos-hk-top-silownik-zesta,3,1211,121431"},
  {"id":"hw_bivert_lift_121432","symbol":"22K2900T","name":"Front uchylny AVENTOS HK top, siłownik (zestaw L+P), współczynnik mocy=3200-9000 przy 2 szt., do TIP-ON, BLUM 22K2900T","price":235.12,"pack":2,"url":"https://bivert.pl/blum-front-uchylny-aventos-hk-top-silownik-zesta,3,1211,121432"},
  {"id":"hw_bivert_lift_121433","symbol":"22K8000 szary","name":"Zestaw zaślepek AVENTOS HK top do frontów uchylnych, lewa/prawa, jasnoszary/inox, BLUM 22K8000","price":25.81,"pack":2,"url":"https://bivert.pl/blum-front-uchylny-aventos-hk-top-zestaw-zaslepek,3,1211,121433"},
  {"id":"hw_bivert_lift_121861","symbol":"22K2300","name":"Siłownik (zestaw L+P) AVENTOS HK top do frontów uchylnych, współczynnik mocy=420-1610 (przy 2 sztukach), odpowiedni do SERVO-DRIVE, BLUM 22K2300","price":179.14,"pack":2,"url":"https://bivert.pl/blum-aventos-hk-top-22k2300-silownik-zestaw-l-p,3,1211,121861"},
  {"id":"hw_bivert_lift_121862","symbol":"22K2300T","name":"Front uchylny AVENTOS HK top, siłownik (zestaw L+P), współczynnik mocy=420-1610 (przy 2 sztukach), do TIP-ON, BLUM 22K2300T","price":192.26,"pack":2,"url":"https://bivert.pl/blum-front-uchylny-aventos-hk-top-silownik-zesta,3,1211,121862"},
  {"id":"hw_bivert_lift_125548","symbol":"20K2C01 + zaślepki + 175H3100","name":"Siłownik (zestaw) AVENTOS HK-S do małych frontów uchylnych, jasnoszary, BLUM 20K2C","price":95.06,"pack":2,"url":"https://bivert.pl/blum-20k2c-aventos-hk-s-zestaw-jasnoszary,3,1211,125548"},
  {"id":"hw_bivert_lift_131593","symbol":"20K2B00.06 + zaślepki","name":"Siłownik AVENTOS HK-S do małych frontów uchylnych, współczynnik mocy=220-500 przy 2 szt., jasnoszary/inox, BLUM 20K2B00.06","price":95.04,"pack":2,"url":"https://bivert.pl/blum-20k2b00-06-aventos-hk-s-do-malych-frontow-uch,3,1211,131593"},
  {"id":"hw_bivert_lift_132821","symbol":"20K2E01 + zaślepki + 175H3100","name":"Podnośnik Aventos HK-S najmocniejszy, szary, BLUM 20K2E00","price":95.06,"pack":2,"url":"https://bivert.pl/blum-aventos-hk-s-najmocniejszy-20k2e00-szary,3,1211,132821"},
  {"id":"hw_bivert_lift_140167","symbol":"20K2C00T06 + 175H3100","name":"Zestaw AVENTOS HK-S TIP-ON  jasnoszary, współczynnik mocy: 400-1000 (przy 2 szt), BLUM 20K2C00T06","price":109.63,"pack":2,"url":"https://bivert.pl/blum-20k2c00t06-aventos-hk-s-tip-on-zestaw-jasnosz,3,1211,140167"},
  {"id":"hw_bivert_lift_140170","symbol":"20K2B00T06 + 175H3100","name":"Zestaw AVENTOS HK-S TIP-ON jasnoszary, współczynnik mocy: 220-500 (przy 2 szt), BLUM 20K2B00T06","price":99.49,"pack":2,"url":"https://bivert.pl/blum-20k2b00t06-aventos-hk-s-tip-on-zestaw-jasnosz,3,1211,140170"},
  {"id":"hw_bivert_lift_140506","symbol":"956.1004 czarny","name":"Odbojnik krótki TIP-ON, czarny BLUM 956.1004","price":13.52,"pack":1,"url":"https://bivert.pl/blum-956-1004-tip-on-do-drzwi-zestaw-wersja-sta,3,2503,140506"},
  {"id":"hw_bivert_lift_148022","symbol":"22F2500","name":"AVENTOS HF Top do frontów uchylno - składanych, siłownik (zestaw), współczynnik mocy=2700-13500 przy 2 szt., na wkręty, odpowiedni do SERVO-DRIVE, BLUM 22F2500","price":200.41,"pack":2,"url":"https://bivert.pl/blum-22f2500-aventos-hf-top-do-frontow-uchylno-s,3,1211,148022"},
  {"id":"hw_bivert_lift_148023","symbol":"22F3500","name":"Top do frontów AVENTOS HF uchylno - składanych, podnośnik (zestaw), wys. korpusu=600-910 mm, symetryczny+niklowany, BLUM 22F3500","price":111,"pack":2,"url":"https://bivert.pl/blum-22f3500-aventos-hf-top-do-frontow-uchylno-s,3,1211,148023"},
  {"id":"hw_bivert_lift_148024","symbol":"22F3900","name":"Top AVENTOS HF do frontów uchylno - składanych, podnośnik (zestaw), wys. korpusu=840-1200 mm, symetryczny+niklowany, BLUM 22F3900","price":138.75,"pack":2,"url":"https://bivert.pl/blum-22f3900-aventos-hf-top-do-frontow-uchylno-s,3,1211,148024"},
  {"id":"hw_bivert_lift_148025","symbol":"22S2200","name":"AVENTOS HS top do frontów nachodzących, siłownik (zestaw), na wkręty, odpowiedni do SERVO-DRIVE+cynkowana, BLUM 22S2200","price":212.82,"pack":2,"url":"https://bivert.pl/blum-22s2200-aventos-hs-top-do-frontow-nachodzacyc,3,1211,148025"},
  {"id":"hw_bivert_lift_148026","symbol":"22S2500","name":"AVENTOS HS Top do frontów nachodzących, siłownik (zestaw), na wkręty, odpowiedni do SERVO-DRIVE+cynkowana, BLUM 22S2500","price":225.27,"pack":2,"url":"https://bivert.pl/blum-22s2500-aventos-hs-top-do-frontow-nachodzacyc,3,1211,148026"},
  {"id":"hw_bivert_lift_148027","symbol":"22S2800","name":"AVENTOS HS top do frontów nachodzących, siłownik (zestaw), na wkręty, odpowiedni do SERVO-DRIVE+cynkowana, BLUM 22S2800","price":239.24,"pack":2,"url":"https://bivert.pl/blum-22s2800-aventos-hs-top-do-frontow-nachodzacyc,3,1211,148027"},
  {"id":"hw_bivert_lift_148028","symbol":"22S3500","name":"Top AVENTOS HS do frontów nachodzących, podnośnik (zestaw), wys. korpusu=350-800 mm, symetryczny+niklowany, BLUM 22S3500","price":141.83,"pack":2,"url":"https://bivert.pl/blum-22s3500-aventos-hs-top-do-frontow-nachodzacyc,3,1211,148028"},
  {"id":"hw_bivert_lift_148035","symbol":"22F2800","name":"AVENTOS HF Top do frontów uchylno - składanych, siłownik (zestaw), współczynnik mocy=10000-19300 przy 2 szt, na wkręty, odpowiedni do SERVO-DRIVE, BLUM 22F2800","price":219.06,"pack":2,"url":"https://bivert.pl/blum-22f2800-aventos-hf-top-do-frontow-uchylno-s,3,1211,148035"},
  {"id":"hw_bivert_lift_148036","symbol":"22F3200","name":"Top AVENTOS HF do frontów uchylno - składanych, podnośnik (zestaw), wys. korpusu=480-610 mm, symetryczny+niklowany, BLUM 22F3200","price":95.23,"pack":2,"url":"https://bivert.pl/blum-22f3200-aventos-hf-top-do-frontow-uchylno-s,3,1211,148036"},
  {"id":"hw_bivert_lift_148040","symbol":"22L2200","name":"AVENTOS HL Top do frontów nad korpusem, siłownik (zestaw), na wkręty, odpowiedni do SERVO-DRIVE+cynkowana, BLUM 22L2200","price":212.82,"pack":2,"url":"https://bivert.pl/blum-22l2200-aventos-hl-top-do-frontow-nad-korpuse,3,1211,148040"},
  {"id":"hw_bivert_lift_148041","symbol":"22L2500","name":"AVENTOS HL TOP do frontów nad korpusem, siłownik (zestaw), na wkręty, odpowiedni do SERVO-DRIVE+cynkowana, BLUM 22L2500","price":216.61,"pack":2,"url":"https://bivert.pl/blum-22l2500-aventos-hl-top-do-frontow-nad-korpuse,3,1211,148041"},
  {"id":"hw_bivert_lift_148042","symbol":"22L3200","name":"BLUM 22L3200 AVENTOS HL top do frontów nad korpusem, podnośnik (zestaw), wys. korpusu=300-340 mm, symetryczny+niklowany","price":149.64,"pack":2,"url":"https://bivert.pl/blum-22l3200-aventos-hl-top-do-frontow-nad-korpuse,3,1211,148042"},
  {"id":"hw_bivert_lift_148043","symbol":"22L3500","name":"Top AVENTOS HL do frontów nad korpusem, podnośnik (zestaw), wys. korpusu=340-390 mm, symetryczny+niklowany, BLUM 22L3500","price":152.76,"pack":2,"url":"https://bivert.pl/blum-22l3500-aventos-hl-top-do-frontow-nad-korpuse,3,1211,148043"},
  {"id":"hw_bivert_lift_148044","symbol":"22L3800","name":"Podnośnik (zestaw) AVENTOS HL top do frontów nad korpusem, wys. korpusu=390-540 mm, symetryczny+niklowany, BLUM 22L3800","price":149.32,"pack":2,"url":"https://bivert.pl/blum-22l3800-aventos-hl-top-do-frontow-nad-korpuse,3,1211,148044"},
  {"id":"hw_bivert_lift_148045","symbol":"22L3900","name":"Podnośnik (zestaw) AVENTOS HL top do frontów nad korpusem, wys. korpusu=480-580 mm, symetryczny+niklowany, BLUM 22L3900","price":174.5,"pack":2,"url":"https://bivert.pl/blum-22l3900-aventos-hl-top-do-frontow-nad-korpuse,3,1211,148045"},
  {"id":"hw_bivert_lift_148046","symbol":"22Q080Z","name":"AVENTOS HL top do frontów nad korpusem, łącznik do stabilizacji poprzecznej, okrągła, długość: 80 mm+ciemnoszara, BLUM 22Q080Z","price":37.31,"pack":1,"url":"https://bivert.pl/blum-22q080z-aventos-hl-top-do-frontow-nad-korpuse,3,1211,148046"},
  {"id":"hw_bivert_lift_148047","symbol":"22Q1076U","name":"Top do frontów AVENTOS HL nad korpusem, stabilizacja poprzeczna, okrągła, długość: 1076 mm+Aluminium, BLUM 22Q1076U","price":38.89,"pack":1,"url":"https://bivert.pl/blum-22q1076u-aventos-hl-top-do-frontow-nad-korpus,3,1211,148047"},
  {"id":"hw_bivert_lift_148049","symbol":"22.8000 szary","name":"Zestaw zaślepek AVENTOS HF/HS/HL top, gładki, prawy+lewy, nadrukowany (wskazówka bezpieczeństwa)+jasnoszary/inox, BLUM 22.8000","price":30.68,"pack":2,"url":"https://bivert.pl/blum-22-8000-zestaw-zaslepek-aventos-hf-hs-hl-top,3,1211,148049"},
  {"id":"hw_bivert_lift_148136","symbol":"20K2E01T + zaślepki + 175H3100","name":"Podnośnik AVENTOS HK-S TIP-ON szary, BLUM 20K2E01T","price":96.67,"pack":2,"url":"https://bivert.pl/blum-podnosnik-aventos-hk-s-20k2e01t-tip-on-bialy,3,1211,148136"},
  {"id":"hw_bivert_lift_156400","symbol":"24K42E1","name":"Mocowanie frontu AVENTOS HKi zintegrowane do frontów drewnianych, EXPANDO, BLUM 24K42E1","price":25.53,"pack":1,"url":"https://bivert.pl/blum-24k42e1-aventos-hki-zintegrowany-mocowanie-f,3,1211,156400"},
  {"id":"hw_bivert_lift_156401","symbol":"24K2300","name":"Siłownik AVENTOS HKi zintegrowany, współczynnik mocy=420-1610 przy 2 szt. BLUM 24K2300","price":977.98,"pack":2,"url":"https://bivert.pl/blum-24k2300-aventos-hki-zintegrowany-wspolczynni,3,1211,156401"},
  {"id":"hw_bivert_lift_156402","symbol":"24K2500","name":"Siłownik AVENTOS HKi zintegrowany, współczynnik mocy=930-2800 przy 2 szt. BLUM 24K2500","price":977.98,"pack":2,"url":"https://bivert.pl/blum-24k2500-aventos-hki-zintegrowany-silownik-ws,3,1211,156402"},
  {"id":"hw_bivert_lift_156403","symbol":"24K2700","name":"Siłownik AVENTOS HKi zintegrowany, współczynnik mocy=1730-5200 przy 2 szt. BLUM 24K2700","price":994.97,"pack":2,"url":"https://bivert.pl/blum-24k2700-aventos-hki-zintegrowany-silownik-ws,3,1211,156403"},
  {"id":"hw_bivert_lift_156404","symbol":"24K2800","name":"Siłownik AVENTOS HKi zintegrowany, współczynnik mocy=2600-7800 przy 2 szt. BLUM 24K2800","price":1037.51,"pack":2,"url":"https://bivert.pl/blum-24k2800-aventos-hki-zintegrowany-silownik-ws,3,1211,156404"},
  {"id":"hw_bivert_lift_156405","symbol":"24K2300T","name":"Siłownik AVENTOS HKi zintegrowany, współczynnik mocy=420-1610 przy 2szt do TIP-ON, BLUM 24K2300T","price":991.1,"pack":2,"url":"https://bivert.pl/blum-24k2300t-aventos-hki-zintegrowany-silownik-w,3,1211,156405"},
  {"id":"hw_bivert_lift_156406","symbol":"24K2500T","name":"Siłownik AVENTOS HKi zintegrowany, współczynnik mocy=930-2800 przy 2szt do TIP-ON, BLUM 24K2500T","price":991.1,"pack":2,"url":"https://bivert.pl/blum-24k2500t-aventos-hki-zintegrowany-silownik-w,3,1211,156406"},
  {"id":"hw_bivert_lift_156407","symbol":"24K2700T","name":"Siłownik AVENTOS HKi zintegrowany, współczynnik mocy=1730-5200 przy 2szt do TIP-ON, BLUM 24K2700T","price":1019.46,"pack":2,"url":"https://bivert.pl/blum-24k2700t-aventos-hki-zintegrowany-silownik-w,3,1211,156407"},
  {"id":"hw_bivert_lift_156408","symbol":"24K2800T","name":"Siłownik AVENTOS HKi zintegrowany, współczynnik mocy=2600-7800 przy 2szt do TIP-ON, BLUM 24K2800T","price":1061.98,"pack":2,"url":"https://bivert.pl/blum-24k2800t-aventos-hki-zintegrowany-silownik-w,3,1211,156408"},
  {"id":"hw_bivert_lift_156410","symbol":"24K8000 szary","name":"Zestaw zaślepek AVENTOS HKi zintegrowany, gładki, lewa/prawa, BLUM 24K8000","price":81.64,"pack":2,"url":"https://bivert.pl/blum-24k8000-aventos-hki-zintegrowany-zestaw-zasl,3,1211,156410"},
  {"id":"hw_bivert_lift_156918","symbol":"78Z5500T czarny","name":"CLIP top Zawias środkowy do AVENTOS HF, uchylno-składanego 134°, bez sprężyny, Mocowanie puszki: na wkręty, czarny, BLUM 78Z5500T","price":12.55,"pack":1,"url":"https://bivert.pl/clip-top-zawias-srodkowy-do-aventos-hf-uchylno-sk,3,1211,156918"},
  {"id":"hw_bivert_lift_156935","symbol":"20S4200","name":"Systemy podnośników AVENTOS HS/HL/HK i HK top, Mocowanie frontu do frontów drewnianych (zestaw), na wkręty, czarny, BLUM 20S4200","price":12.88,"pack":2,"url":"https://bivert.pl/systemy-podnosnikow-aventos-hs-hl-hk-i-hk-top-moc,3,1211,156935"}
 ];
 products.push(
  {id:'hw_gral_lift_duo_37366612',symbol:'373.66.612',name:'Häfele DUO standard37 mm — kompletny mechanizm z dwoma mocowaniami',manufacturer:'Häfele',supplierId:'gral',supplier:'PHU GRAL',price:34.68,pack:1,url:'https://phu-gral.eu/podnosniki-do-drzwiczek/podnosniki-hafele/podnosnik-klap-huwil-duo'},
  {id:'hw_stolmet_lift_duo_37366632',symbol:'373.66.632',name:'Häfele DUO forte37 mm — kompletny mechanizm z dwoma mocowaniami',manufacturer:'Häfele',supplierId:'stolmet',supplier:'Stolmet',price:56.75,pack:1,url:'https://stolmet.pl/pl/p/Podnosnik-gornydolny-DUO-do-klap-o-szer.-od-45-mm/3124'});
 const byId=new Map(products.map(row=>[row.id,row]));
 const hingeParams=angle=>({rola_kompletu:{value:'zawias'},system_kompatybilnosci:{value:'CLIP top'},nalozenie:{value:'nakładany'},
  kat_rzeczywisty:{from:angle,to:''},klasa_kata:{value:angle===120?'standardowy 90–120°':'AVENTOS HF środkowy134°'},
  hamulec:{value:false},sprezyna:{value:false},typ_prowadnika:{value:'standardowy'},forma_prowadnika:{value:'prosty'},pokrycie_prowadnika:{value:'osobno'}});
 const seeds=products.map(row=>({id:row.id,manufacturer:row.manufacturer||'Blum',supplierId:row.supplierId||'bivert',symbol:row.symbol,name:row.name,series:row.manufacturer?'DUO':'AVENTOS',
  hardwareCategory:['13076','156918'].includes(row.id.split('_').pop())?'Zawiasy':row.id.endsWith('_12528')?'Prowadniki':'Podnośniki',
  hardwareUnit:row.pack===2?'kpl.':'szt.',catalogPriceGross:row.price,purchasePriceGross:row.price,
  priceSource:row.supplier||'Bivert',priceUpdatedAt:'2026-11-25',
  technicalParams:row.id.endsWith('_13076')?hingeParams(120):row.id.endsWith('_156918')?hingeParams(134):row.id.endsWith('_12528')?
   {rola_kompletu:{value:'prowadnik'},system_kompatybilnosci:{value:'CLIP top'},typ_prowadnika:{value:'standardowy'},forma_prowadnika:{value:'prosty'}}:{},
  note:'Cena jednostki handlowej; '+row.pack+' element(y) w opakowaniu. Nie jest to cena pojedynczego siłownika, jeśli opakowanie zawiera parę. '+
   (row.manufacturer?'Kompletny DUO z mocowaniem korpusu i frontu; cena brutto, bez dodatkowego VAT.':'Zakres kompletu i dodatki według katalogu Blum2024/2025.')+' Źródło: '+row.url}));
 function item(id,usedQty,kind='lift'){
  const p=byId.get('hw_bivert_lift_'+id);if(!p)throw Error('LIFT_CATALOG_SOURCE_MISSING');
  return {kind,hardwareGroup:kind==='hinge'?'hinges':'lifts',category:seeds.find(row=>row.id===p.id).hardwareCategory,catalogItemId:p.id,
   expectedManufacturer:'Blum',expectedSymbol:p.symbol,expectedUnit:p.pack===2?'kpl.':'szt.',label:p.name,
   qty:Math.ceil(usedQty/p.pack),physicalQty:usedQty,packSize:p.pack};
 }
 function refused(code,label){return [{kind:'lift',hardwareGroup:'lifts',category:'Podnośniki',catalogItemId:'hw_lift_unconfirmed',
  expectedManufacturer:'Blum',expectedSymbol:'UNCONFIRMED',expectedUnit:'szt.',label:label||'Niepotwierdzony komplet podnośnika',qty:1,sourceIssue:code}];}
 function isFlap(cab){return cab?.subType==='uchylne';}
 function hfHinges(room,cab){
  if(!isFlap(cab)||cab.details?.flapVendor==='hafele'||cab.details?.flapKind!=='HF_top')return null;
  const kg=FC.frontHardwareAventosCalc?.estimateFlapWeightKg(cab,room),mm=Number(cab.width)*10;
  if(!(kg>0&&mm>0))return refused('LIFT_FRONT_UNCONFIRMED');
  const n=mm>=1800||kg>=20?4:mm>=1200||kg>=12?3:2;
  return [item('13076',n,'hinge'),item('156918',n,'hinge')].map(row=>({...row,auxiliaryForLift:true,doorKey:row.catalogItemId,
   technicalParams:hingeParams(row.catalogItemId.endsWith('_13076')?120:134)}));
 }
 // Häfele installation732.23.702/703,25.08/12.09.2011: holding function1,
 // not the higher braking-function capacity. >=600mm wide requires two.
 const duoCapacity={standard:{75:[[9,15],[7,15],[6,12],[5,10],[4.5,9],[4,8],[3.5,7]],
  90:[[7.5,15],[6,12],[5,10],[4,8.5],[3.5,7],[3.5,6.5],[3,6]],110:[[6,12],[5,9.5],[4,8],[3.5,7],[3,6],[2.5,5.5],[2,5]]},
  forte:{75:[[14,15],[11.5,15],[9,15],[8,15],[7,14],[6,12.5],[5.5,11],[5,10],[5,9.5],[4,8.5],[4,8]],
  90:[[12.5,15],[9.5,15],[8,15],[7,13.5],[6,12],[5,11],[5,9.5],[4,8.5],[4,8],[3.5,7],[3,7]],
  110:[[9.5,15],[7.5,15],[6.5,12.5],[5.5,11],[4.5,9.5],[4,8.5],[4,7.5],[3.5,7],[3,6],[3,5.5],[3,5]]}};
 function duoInfo(room,cab){
  if(!isFlap(cab)||cab.details?.flapVendor!=='hafele'||(cab.details.flapKind||'DUO')!=='DUO')return null;
  const error=(status,message)=>({kind:'DUO',status,message,liftQty:0,model:null});
  const angle=Number(cab.details.flapAngle),h=Number(cab.height)*10,w=Number(cab.width)*10;
  if(![75,90,110].includes(angle))return error('angle_required','Wybierz kąt otwarcia DUO.');
  const kg=FC.frontHardwareAventosCalc?.estimateFlapWeightKg(cab,room);
  const depth=FC.cabinetCutlist?.backGeometry?.(cab,room)?.usableDepthMm;
  if(!(h>=200&&h<=700&&w>0&&kg>0&&Number.isFinite(depth)))return error('out_dimensions','Niepotwierdzone wymiary lub ciężar frontu DUO.');
  if(String(cab.openingSystem||'').toLowerCase()==='tip-on')return error('unsupported_opening','Brak potwierdzonego rozwiązania TIP-ON dla DUO.');
  // Between tabulated heights use the next taller row, never a favourable
  // interpolation. Both SKU sets include the same two separate mountings.
  const index=Math.ceil((h-200)/50);
  for(let qty=w>=600?2:1;qty<=2;qty++)for(const family of ['standard','forte']){
   const limit=duoCapacity[family][angle][index]?.[qty-1];
   if(!(limit>=kg&&depth>=(family==='standard'?135:175)))continue;
   return {kind:'DUO',status:'ok',model:family==='standard'?'373.66.612':'373.66.632',liftQty:qty,angle,weightKg:kg,
    message:'DUO '+family+' '+angle+'°: '+qty+' szt.; nośność tabeli '+limit+' kg, wiersz '+(200+index*50)+' mm.'};
  }
  return error('out_capacity','Brak potwierdzonego DUO dla wymiarów, kąta i ciężaru frontu.');
 }
 function infoFor(room,cab){return duoInfo(room,cab)||FC.frontHardware?.getBlumAventosInfo?.(cab,room)||null;}
 function requirements(room,cab,providedInfo){
  if(!isFlap(cab))return [];
  if(cab.details?.flapVendor==='hafele'){
   const selected=duoInfo(room,cab);if(selected?.status!=='ok')return refused('LIFT_DUO_UNCONFIRMED');
   const p=products.find(row=>row.manufacturer==='Häfele'&&row.symbol===selected.model);
   return [{kind:'lift',hardwareGroup:'lifts',category:'Podnośniki',catalogItemId:p.id,expectedManufacturer:p.manufacturer,
    expectedSymbol:p.symbol,expectedUnit:'szt.',label:p.name,qty:selected.liftQty,physicalQty:selected.liftQty,packSize:1}];
  }
  const info=providedInfo||infoFor(room,cab),d=cab.details||{},qty=Number(info?.liftQty),kind=info?.kind;
  if(!info||!['ok','needs_more_lifts'].includes(info.status||'ok')||!Number.isSafeInteger(qty)||qty<1||qty>3||!info.model)
   return refused('LIFT_SELECTION_UNCONFIRMED');
  const tipon=String(cab.openingSystem||'').toLowerCase()==='tip-on',out=[],add=(id,n=qty)=>out.push(item(id,n));
  const h=Number(cab.height)*10,w=Number(cab.width)*10;
  if(!(h>0&&w>0))return refused('LIFT_DIMENSIONS_UNCONFIRMED');
  const depth=FC.cabinetCutlist?.backGeometry?.(cab,room)?.usableDepthMm;
  const minDepth={'HK-XS':100,'HK-S':163,HK_top:187,HKI:271,HF_top:264,HS_top:264,HL_top:264}[kind];
  if(!(Number.isFinite(depth)&&depth>=minDepth))return refused('LIFT_DEPTH_UNCONFIRMED');
  if(['HK-XS','HK-S','HK_top','HKI'].includes(kind)&&h>600)return refused('LIFT_HEIGHT_UNCONFIRMED');
  if(tipon&&['HF_top','HS_top','HL_top'].includes(kind))return refused('LIFT_TIPON_UNSUPPORTED');
  if(kind==='HK-XS'){
   if(qty>2)return refused('LIFT_QUANTITY_UNCONFIRMED');
   const id=({'20K1101':tipon?'13123':'13121','20K1301':tipon?'13127':'13125','20K1501':tipon?'13130':'12699'})[info.model];
   if(!id)return refused('LIFT_MODEL_UNCONFIRMED');add(id);add('13132');add('12637');
  }else if(kind==='HK-S'){
   // 20K2A00 is the old local selector token for LF220–500. The actual
   // current order code, proven by the manufacturer, is20K2B00.06.
   const id=({'20K2A00':tipon?'140170':'131593','20K2B00':tipon?'140170':'131593',
    '20K2C00':tipon?'140167':'125548','20K2E00':tipon?'148136':'132821'})[info.model];
   if(!id)return refused('LIFT_MODEL_UNCONFIRMED');add(id);
   if(id==='131593')add('12528'); // Other selected HK-S packs include the front plates.
  }else if(kind==='HK_top'){
   const id=({'22K2300':tipon?'121862':'121861','22K2500':tipon?'121427':'121426',
    '22K2700':tipon?'121430':'121428','22K2900':tipon?'121432':'121431'})[info.model];
   if(!id)return refused('LIFT_MODEL_UNCONFIRMED');add(id);add('156935');add('121433');
  }else if(kind==='HKI'){
   if(!['full','partial'].includes(d.flapIntegration))return refused('LIFT_INTEGRATION_UNCONFIRMED');
   if(FC.cabinetHardwareRequirements?.supportQuantities(cab).hangers>0&&!FC.hardwareSupportCatalog.concealedFit(room,cab))return refused('LIFT_CONCEALED_HANGER_REQUIRED');
   const id=({'24K2300':tipon?'156405':'156401','24K2500':tipon?'156406':'156402',
    '24K2700':tipon?'156407':'156403','24K2800':tipon?'156408':'156404'})[info.model];
   if(!id)return refused('LIFT_MODEL_UNCONFIRMED');add(id);add('156400');if(d.flapIntegration==='partial')add('156410');
  }else if(kind==='HF_top'){
   const id=({'22F2500':'148022','22F2800':'148035'})[info.model];
   const arm=h>=480&&h<=610?'148036':h>=600&&h<=910?'148023':h>=840&&h<=1200?'148024':null;
   if(!id||!arm)return refused('LIFT_MODEL_UNCONFIRMED');add(id);add(arm);add('148049');
   const hinges=hfHinges(room,cab);if(!hinges||hinges.some(row=>row.sourceIssue))return refused('LIFT_FRONT_UNCONFIRMED');
   out.push(...hinges);add('12528',hinges[1].qty+qty); // Second centre-hinge plates and arm fixings; first plates follow bare hinges.
  }else if(kind==='HS_top'){
   const id=({'22S2200':'148025','22S2500':'148026','22S2800':'148027'})[info.model];
   if(!id)return refused('LIFT_MODEL_UNCONFIRMED');add(id);add('148028');add('148049');add('156935');
  }else if(kind==='HL_top'){
   const id=({'22L2200':'148040','22L2500':'148041'})[info.model];
   const arm=({'22L3200':'148042','22L3500':'148043','22L3800':'148044','22L3900':'148045'})[info.armModel];
   if(!id||!arm||qty!==2)return refused('LIFT_MODEL_UNCONFIRMED');add(id);add(arm);add('148049');add('156935');
   const inside=w-36,split=inside>=1190;
   if(!(inside>113))return refused('LIFT_WIDTH_UNCONFIRMED');
   // Purchase full rods, not fractional lengths. No assumed pooling of
   // offcuts: the wide variant has one separate stock rod per segment.
   const cut=split?inside/2-105:inside-113;
   if(cut>1076)return refused('LIFT_WIDTH_UNCONFIRMED');add('148047',split?2:1);if(split)add('148046',1);
  }else return refused('LIFT_MODEL_UNCONFIRMED');
  return out;
 }
 function openingRequirements(room,cab,qty){
  if(!isFlap(cab)||cab.details?.flapVendor==='hafele'||String(cab.openingSystem||'').toLowerCase()!=='tip-on')return null;
  if(!['HK-XS','HK-S','HK_top','HKI'].includes(cab.details?.flapKind||'HK-XS'))return refused('LIFT_TIPON_UNSUPPORTED');
  return qty>0?[item('140506',qty,'opening')]:[];
 }
 function parts(room,cab,info){return requirements(room,cab,info).filter(req=>req.kind!=='hinge').map(req=>({name:req.label,qty:req.qty,a:0,b:0,
  dims:req.packSize===2?'Opakowanie:2 szt.; potrzebne:'+req.physicalQty+' szt.':'—',material:'Okucia: '+req.label,hardwareRequirement:req}));}
 function hingeFittingCount(room,cab){
  const rows=hfHinges(room,cab);if(!rows||rows.some(row=>row.sourceIssue))return null;
  const info=infoFor(room,cab);return info?rows.reduce((sum,row)=>sum+row.qty*2,0)+rows[1].qty+Number(info.liftQty):null;
 }
 function plateRequirement(req){return ['hw_bivert_lift_13076','hw_bivert_lift_156918'].includes(req?.catalogItemId)?item('12528',1):null;}
 function laborFacts(room,cab,frontCount){
  const keys=['hkxs','hk_set','mechanisms','fronts','other_prepare','other_set','hki_set','hki_partial','hki_full','arms','stabilizer_cuts','stabilizer_sets','other_fronts','other_mechanisms','force'];
  const values=value=>Object.fromEntries(keys.map(key=>[key,value]));
  const kind=cab.details?.flapKind||'HK-XS',vendor=cab.details?.flapVendor||'blum';
  if(!isFlap(cab))return values(0);
  if(vendor==='blum'&&['HK-XS','HK-S','HK_top'].includes(kind)){
   const info=infoFor(room,cab),known=info&&info.kind===kind&&info.status==='ok'&&info.liftQty>0&&frontCount===1,out=values(0);
   out.hkxs=known?(kind==='HK-XS'?info.liftQty:0):null;out.hk_set=known?(kind==='HK-XS'?0:1):null;
   out.mechanisms=known?(kind==='HK-XS'?0:info.liftQty):null;out.fronts=known?(kind==='HK-XS'?0:1):null;out.force=known?1:null;return out;
  }
  const info=infoFor(room,cab),rows=requirements(room,cab,info),count=kind==='HF_top'?2:1;
  if(frontCount!==count||!rows.length||rows.some(row=>row.sourceIssue))return values(null);
  const out=values(0),hki=kind==='HKI';
  out.other_set=out.force=1;out.other_prepare=hki?0:1;out.other_fronts=count;out.other_mechanisms=info.liftQty;
  if(hki){out.hki_set=1;out['hki_'+cab.details.flapIntegration]=1;}
  if(['HF_top','HS_top','HL_top'].includes(kind))out.arms=info.liftQty;
  if(kind==='HL_top'){out.stabilizer_cuts=rows.find(row=>row.catalogItemId==='hw_bivert_lift_148047').physicalQty;out.stabilizer_sets=1;}
  return out;
 }
 FC.hardwareLiftCatalog={products,seeds,requirements,parts,hfHinges,hingeFittingCount,openingRequirements,plateRequirement,laborFacts,duoInfo};
})();
