(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});

function getCabinetExtraSummary(room, cab){
  const d = cab.details || {};
  const parts = [];

  // wisząca: dolna_podblatowa ma osobny model (front + wnętrze)
  if(cab.type === 'wisząca' && cab.subType === 'dolna_podblatowa'){
    const mode = d.podFrontMode || (d.subTypeOption && String(d.subTypeOption).startsWith('szuflada') ? 'szuflady' : ((Number(cab.frontCount)||0) ? 'drzwi' : 'brak'));
    const inside = d.podInsideMode || 'polki';

    const getInnerCount = ()=>{
      const v = (d.podInnerDrawerCount ?? d.podInsideDrawerCount ?? d.podInsideDrawersCount);
      const n = parseInt(v, 10);
      return (Number.isFinite(n) && n > 0) ? n : 1;
    };

    if(mode === 'brak' || (Number(cab.frontCount)||0) === 0){
      parts.push('Front: brak');
    } else if(mode === 'szuflady'){
      parts.push(`Front: szuflady ${Number(cab.frontCount)||1}`);
    } else {
      parts.push(`Front: drzwi ${Number(cab.frontCount)||1}`);
    }

    if(mode !== 'szuflady'){
      // Nie pokazuj półek dla wariantów, gdzie to myli (np. zmywarka/lodówka)
      const skipShelves = (cab.subType === 'zmywarkowa' || cab.subType === 'lodowkowa');
      if(inside === 'polki'){
        if(!skipShelves && ((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
      } else if(inside === 'szuflady_wew' || inside === 'szuflady_wewn'){
        parts.push(`Szuflady wew.: ${getInnerCount()}`);
      } else if(inside === 'mieszane'){
        if(((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
        parts.push(`Szuflady wew.: ${getInnerCount()}`);
      }
    }

    // Plecy (tak/nie) — krótko w szczegółach
    const hasBack = String(d.hasBack) !== '0';
    parts.push('Plecy: ' + (hasBack ? 'tak' : 'nie'));


    return parts.join(' • ');
  }

  // pozostałe wiszące
  if(cab.type === 'wisząca'){
    if(cab.subType === 'uchylne'){
      const vendor = String(d.flapVendor || 'blum');
      const kind = String(d.flapKind || (vendor === 'hafele' ? 'DUO' : 'HKI'));

      const vendorLabel = (vendor === 'blum') ? 'BLUM'
                        : (vendor === 'gtv') ? 'GTV'
                        : 'Häfele';

      const blumKindLabel = ({
        'HKI':'HKI – zintegrowany',
        'HF_top':'HF top – składany (2 fronty)',
        'HS_top':'HS top – uchylno‑nachodzący',
        'HL_top':'HL top – podnoszony ponad korpus',
        'HK_top':'HK top – uchylny',
        'HK-S':'HK‑S – mały uchylny',
        'HK-XS':'HK‑XS – mały uchylny (z zawiasami)'
      })[kind] || kind;

      const kindLabel = (vendor === 'blum') ? blumKindLabel
                      : (vendor === 'hafele') ? 'Rozwórka nożycowa DUO.'
                      : '(w budowie)';

      parts.push(`Podnośniki: ${vendorLabel} • ${kindLabel}`);
    }
    if(((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
    if(cab.frontCount) parts.push(`Fronty: ${cab.frontCount}`);
    return parts.join(' • ');
  }

  // moduł
  if(cab.type === 'moduł'){
    // standardowa: wnętrze (półki / szuflady wewnętrzne)
    if(cab.subType === 'standardowa'){
      const inside = String(d.insideMode || 'polki');
      if(inside === 'szuflady_wew'){
        const n = parseInt(d.innerDrawerCount, 10);
        const cnt = (Number.isFinite(n) && n > 0) ? n : 1;
        const it = String(d.innerDrawerType || 'skrzynkowe');
        parts.push(`Szuflady wew.: ${cnt}${it === 'blum' ? ' (BLUM)' : ''}`);
      } else {
        const n = parseInt(d.shelves, 10);
        const cnt = (Number.isFinite(n) && n > 0) ? n : 0;
        if(cnt > 0) parts.push(`Półki: ${cnt}`);
      }
    }
    if(cab.subType === 'uchylne'){
      const vendor = String(d.flapVendor || 'blum');
      const kind = String(d.flapKind || (vendor === 'hafele' ? 'DUO' : 'HKI'));

      const vendorLabel = (vendor === 'blum') ? 'BLUM'
                        : (vendor === 'gtv') ? 'GTV'
                        : 'Häfele';

      const blumKindLabel = ({
        'HKI':'HKI – zintegrowany',
        'HF_top':'HF top – składany (2 fronty)',
        'HS_top':'HS top – uchylno‑nachodzący',
        'HL_top':'HL top – podnoszony ponad korpus',
        'HK_top':'HK top – uchylny',
        'HK-S':'HK‑S – mały uchylny',
        'HK-XS':'HK‑XS – mały uchylny (z zawiasami)'
      })[kind] || kind;

      const kindLabel = (vendor === 'blum') ? blumKindLabel
                      : (vendor === 'hafele') ? 'Rozwórka nożycowa DUO.'
                      : '(w budowie)';

      parts.push(`Podnośniki: ${vendorLabel} • ${kindLabel}`);
    }
    if(cab.subType === 'szuflady'){
      const lay = String(d.drawerLayout || '');
      let label = '';
      if(lay === '1_big') label = '1 duża';
      else if(lay === '2_equal') label = '2 równe';
      else if(lay === '3_equal') label = '3 równe';
      else if(lay === '5_equal') label = '5 równych';
      else if(lay === '3_1_2_2') label = '1 mała + 2 duże (1:2:2)';
      else {
        const lc = String(d.drawerCount || '3');
        if(lc === '1') label = '1 duża';
        else if(lc === '2') label = '2 równe';
        else if(lc === '5') label = '5 równych';
        else if(lc === '3') label = '1 mała + 2 duże (1:2:2)';
        else label = '3 równe';
      }
      const sys = String(d.drawerSystem || 'skrzynkowe');
      let sysLabel = 'Skrzynkowe';
      if(sys === 'systemowe'){
        const br = String(d.drawerBrand || 'blum');
        if(br !== 'blum'){
          sysLabel = br.toUpperCase() + ' (w budowie)';
        } else {
          const mdl = String(d.drawerModel || 'tandembox');
          const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
          sysLabel = 'BLUM ' + (map[mdl] || mdl.toUpperCase());
        }
      }
      parts.push(`Szuflady: ${label} • ${sysLabel}`);

      const innerType = String(d.innerDrawerType || 'brak');
      const innerCnt = parseInt(d.innerDrawerCount, 10);
      if(innerType !== 'brak' && Number.isFinite(innerCnt) && innerCnt > 0){
        parts.push(`Szuflady wew.: ${innerCnt}${innerType === 'blum' ? ' (BLUM)' : ''}`);
      }
    }
    if(((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
    if(cab.subType !== 'szuflady' && cab.frontCount) parts.push(`Fronty: ${cab.frontCount}`);
    return parts.join(' • ');
  }

  // stojące
  if(cab.type === 'stojąca'){
    if(cab.subType === 'szuflady'){
      const lay = String(d.drawerLayout || '');
      let label = '';
      if(lay === '1_big') label = '1 duża';
      else if(lay === '2_equal') label = '2 równe';
      else if(lay === '3_equal') label = '3 równe';
      else if(lay === '5_equal') label = '5 równych';
      else if(lay === '3_1_2_2') label = '1 mała + 2 duże (1:2:2)';
      else {
        // kompatybilność wstecz
        const lc = String(d.drawerCount || '3');
        if(lc === '1') label = '1 duża';
        else if(lc === '2') label = '2 równe';
        else if(lc === '5') label = '5 równych';
        else if(lc === '3') label = '1 mała + 2 duże (1:2:2)';
        else label = '3 równe';
      }
      const sys = String(d.drawerSystem || 'skrzynkowe');
      let sysLabel = 'Skrzynkowe';
      if(sys === 'systemowe'){
        const br = String(d.drawerBrand || 'blum');
        if(br !== 'blum'){
          sysLabel = br.toUpperCase() + ' (w budowie)';
        } else {
          const mdl = String(d.drawerModel || 'tandembox');
          const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
          sysLabel = 'BLUM ' + (map[mdl] || mdl.toUpperCase());
        }
      }
      parts.push(`Szuflady: ${label} • ${sysLabel}`);

      const innerType = String(d.innerDrawerType || 'brak');
      const innerCnt = parseInt(d.innerDrawerCount, 10);
      if(innerType !== 'brak' && Number.isFinite(innerCnt) && innerCnt > 0){
        parts.push(`Szuflady wew.: ${innerCnt}${innerType === 'blum' ? ' (BLUM)' : ''}`);
      }
    }
    if(cab.subType === 'zlewowa'){
      // zgodność wstecz: stare pole sinkOption
      let front = d.sinkFront;
      let extra = d.sinkExtra;
      let extraCount = d.sinkExtraCount;
      let innerType = d.sinkInnerDrawerType;

      if(!front && d.sinkOption){
        if(d.sinkOption === 'zwykle_drzwi') front = 'drzwi';
        else if(d.sinkOption === 'szuflada') front = 'szuflada';
        else if(d.sinkOption === 'szuflada_i_polka'){ front = 'szuflada'; extra = extra || 'polka'; extraCount = (extraCount != null ? extraCount : 1); }
      }

      if(front === 'szuflada'){
        parts.push('Zlew: szuflada (1 front)');
        const sys = String(d.drawerSystem || 'skrzynkowe');
        let sysLabel = 'Skrzynkowe';
        if(sys === 'systemowe'){
          const br = String(d.drawerBrand || 'blum');
          if(br !== 'blum') sysLabel = br.toUpperCase() + ' (w budowie)';
          else {
            const mdl = String(d.drawerModel || 'tandembox');
            const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
            sysLabel = 'BLUM ' + (map[mdl] || mdl.toUpperCase());
          }
        }
        parts.push(`Szuflada: ${sysLabel}`);
      } else {
        const dc = Number(d.sinkDoorCount || cab.frontCount || 2) || 2;
        parts.push(`Zlew: drzwi ${dc}`);
      }

      const ex = (extra || 'brak');
      const ec = (extraCount != null ? extraCount : 1);
      if(ex === 'polka'){
        parts.push(`Dodatkowo: półka ${ec}`);
      } else if(ex === 'szuflada_wew'){
        const t = (innerType || 'skrzynkowe');
        { 
        const t = String(innerType || 'skrzynkowe');
        if(t === 'systemowe'){
          const br = String(d.sinkInnerDrawerBrand || 'blum');
          if(br !== 'blum'){
            parts.push(`Szuflady wew.: ${ec} • ${br.toUpperCase()} (w budowie)`);
          } else {
            const mdl = String(d.sinkInnerDrawerModel || 'tandembox');
            const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
            parts.push(`Szuflady wew.: ${ec} • BLUM ${(map[mdl]||mdl.toUpperCase())}`);
          }
        } else {
          parts.push(`Szuflady wew.: ${ec} • Skrzynkowe`);
        }
      }
      }
    }
if(cab.subType === 'zmywarkowa'){
  const dw = (d.dishWasherWidth || '60');
  parts.push(`Zmywarka: ${dw} cm`);
  const td = parseInt(d.techDividerCount, 10);
  if(Number.isFinite(td) && td > 0) parts.push(`Przegroda techn.: ${td}`);
}
    if(cab.subType === 'lodowkowa'){
      const fo = (d.fridgeOption || 'zabudowa');
      if(fo === 'zabudowa'){
        const nh = d.fridgeNicheHeight || '178';
        parts.push(`Lodówka: zabudowa • nisza ${nh}cm`);
      } else {
        const ff = (d.fridgeFreeOption || 'brak');
        parts.push(`Lodówka: wolnostojąca • ${ff}`);
      }
      const td = parseInt(d.techDividerCount, 10);
      if(fo === 'zabudowa' && Number.isFinite(td) && td > 0) parts.push(`Przegroda techn.: ${td}`);
    }
    if(cab.subType === 'piekarnikowa'){
      parts.push(`Piekarnik: ${(d.ovenOption || 'szuflada_dol')} • H=${d.ovenHeight || '60'}cm`);
      const tc = parseInt(d.techShelfCount, 10);
      parts.push(`Przegroda techn.: ${Number.isFinite(tc) && tc>0 ? tc : 1}`);

      const oo = String(d.ovenOption || 'szuflada_dol');
      if(oo.indexOf('szuflada') !== -1){
        const sys = String(d.drawerSystem || 'skrzynkowe');
        let sysLabel = 'Skrzynkowe';
        if(sys === 'systemowe'){
          const br = String(d.drawerBrand || 'blum');
          if(br !== 'blum') sysLabel = br.toUpperCase() + ' (w budowie)';
          else {
            const mdl = String(d.drawerModel || 'tandembox');
            const map = {tandembox:'TANDEMBOX', legrabox:'LEGRABOX', merivobox:'MERIVOBOX', metabox:'METABOX'};
            sysLabel = 'BLUM ' + (map[mdl] || mdl.toUpperCase());
          }
        }
        parts.push(`Szuflada: ${sysLabel}`);
      }
    }
    const isCorner = ['rogowa_slepa','narozna_l'].includes(cab.subType || '');
    const cornerOption = (d.cornerOption || 'polki');

    if(isCorner){
      parts.push(`Narożna: ${cornerOption}`);
    }

    // STANDARDOWA: półki albo szuflady wewnętrzne
    const insideMode = (d.insideMode || 'polki');
    const wantsInnerDrawers = (cab.subType === 'standardowa') && (
      insideMode === 'szuflady_wew' || insideMode === 'szuflady_wewn' || insideMode === 'szuflady_wewnetrzne'
    );

    if(wantsInnerDrawers){
      const cnt = (d.innerDrawerCount != null) ? d.innerDrawerCount : 1;
      const t = (d.innerDrawerType || 'skrzynkowe');
      parts.push(`Szuflady wew.: ${cnt}${t === 'blum' ? ' (BLUM)' : ''}`);
    } else {
      const shelvesN = parseInt(d.shelves, 10);
      const hasShelves = Number.isFinite(shelvesN) && shelvesN > 0;
      const skipShelvesFor = ['szuflady','zlewowa','zmywarkowa','lodowkowa','piekarnikowa'];
      const showShelves = hasShelves && !skipShelvesFor.includes(cab.subType) && !(isCorner && cornerOption !== 'polki');
      if(showShelves && shelvesN > 0) parts.push(`Półki: ${shelvesN}`);
    }

    // FRONTY: niektóre warianty mają sztywne zasady
    let frontCountForSummary = cab.frontCount || 0;
    if(cab.subType === 'lodowkowa'){
      const fo = (d.fridgeOption || 'zabudowa');
      if(fo === 'zabudowa'){
        // w tej wersji lodówkowa-zabudowa generuje zawsze 2 fronty: dolny + górny (nisza)
        frontCountForSummary = 2;
      } else {
        // wolnostojąca: bez frontów
        frontCountForSummary = 0;
      }
    }
    if(frontCountForSummary > 0) parts.push(`Fronty: ${frontCountForSummary}`);
    return parts.join(' • ');
  }

  // moduł
  if(cab.type === 'moduł'){
    // standardowa: wnętrze (półki / szuflady wewnętrzne)
    if(cab.subType === 'standardowa'){
      const inside = String(d.insideMode || 'polki');
      if(inside === 'szuflady_wew'){
        const n = parseInt(d.innerDrawerCount, 10);
        const cnt = (Number.isFinite(n) && n > 0) ? n : 1;
        const it = String(d.innerDrawerType || 'skrzynkowe');
        parts.push(`Szuflady wew.: ${cnt}${it === 'blum' ? ' (BLUM)' : ''}`);
      }
    }
    if(((d.shelves ?? 0) > 0)) parts.push(`Półki: ${d.shelves}`);
    if(cab.frontCount) parts.push(`Fronty: ${cab.frontCount}`);
    return parts.join(' • ');
  }

  return '';
}


  ns.cabinetSummary = ns.cabinetSummary || {};
  ns.cabinetSummary.getCabinetExtraSummary = getCabinetExtraSummary;
})();
