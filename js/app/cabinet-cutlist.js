// Cabinet cut list extracted from app.js.
(function(){
  window.FC = window.FC || {};
  const ns = window.FC.cabinetCutlist = window.FC.cabinetCutlist || {};

  function getCabinetCutList(cab, room){
  const t = FC_BOARD_THICKNESS_CM;
  const w = Number(cab.width) || 0;
  const h = Number(cab.height) || 0;
  const d = Number(cab.depth) || 0;
  const bodyMat = cab.bodyColor || 'laminat';
  // Plecy: "Brak" traktujemy jak brak materiału (nie dodajemy pozycji do Materiałów ani ROZRYS)
  const backMatRaw = cab.backMaterial || 'HDF';
  const backMat = (String(backMatRaw).trim().toLowerCase() === 'brak' || String(backMatRaw).trim() === '— brak —') ? '' : backMatRaw;

  const subType = String(cab.subType || '');
  // Wisząca podblatowa ma być liczona w materiałach jak stojąca
  const isUnderCounterWall = (String(cab.type || '') === 'wisząca' && subType === 'dolna_podblatowa');
  const effType = isUnderCounterWall ? 'stojąca' : String(cab.type || '');

  // Plecy: dla "wisząca podblatowa" użytkownik może wyłączyć plecy (tak/nie w modalu)
  const hasBack = !(isUnderCounterWall && String((cab.details || {}).hasBack) === '0');

  const parts = [];

  // Stojące: boki stoją na wieńcu dolnym => boki niższe o grubość płyty
  // Wyjątek: wisząca dolna podblatowa – boki mają wysokość korpusu
  const sideH = (effType === 'stojąca' && !isUnderCounterWall) ? Math.max(0, h - t) : h;

  // Boki: zawsze 2 szt.
  parts.push({ name:'Bok', qty:2, a: sideH, b: d, dims:`${fmtCm(sideH)} × ${fmtCm(d)}`, material: bodyMat });
  // Rogowa L: 1 bok duży, 1 bok mały + bok zaślepiający (zamiast 2x bok duży)
  if(String(cab.subType || '') === 'narozna_l'){
    // usuń domyślne 2 boki
    parts.pop();

    const det = cab.details || {};
    const GL = Number(det.gl) || 0; // głębokość lewa (duży bok)
    const GP = Number(det.gp) || 0; // głębokość małego boku
    const ST = Number(det.st) || 0; // (fallback) głębokość prawa, gdy GL=0
    const SP = Number(det.sp) || 0; // szerokość boku zaślepiającego (przed korektą)

    // Zasady:
    // - Bok mały: szerokości GP
    // - Bok zaślepiający: szerokości SP - 1,8
    // - Bok duży: przyjmij GL (jeśli brak, to ST; jeśli brak, to d)
    const bigDepth = (GL > 0 ? GL : (ST > 0 ? ST : d));
    const smallDepth = (GP > 0 ? GP : Math.max(0, Math.min(bigDepth, d)));
    const blindDepth = Math.max(0, SP - t);

    parts.push({ name:'Bok duży', qty:1, a: sideH, b: bigDepth, dims:`${fmtCm(sideH)} × ${fmtCm(bigDepth)}`, material: bodyMat });
    parts.push({ name:'Bok mały', qty:1, a: sideH, b: smallDepth, dims:`${fmtCm(sideH)} × ${fmtCm(smallDepth)}`, material: bodyMat });

    if(blindDepth > 0){
      parts.push({ name:'Bok zaślepiający', qty:1, a: sideH, b: blindDepth, dims:`${fmtCm(sideH)} × ${fmtCm(blindDepth)}`, material: bodyMat });
    }
  }

  const wIn = Math.max(0, w - 2*t);

  // Wisząca rogowa ślepa: zaślepka + blenda w kolorze frontu
  if(effType === 'wisząca' && String(cab.subType || '') === 'rogowa_slepa'){
    const blind = Math.max(0, Number(cab.details?.blindPart) || 0);
    // Zaślepka: szerokość (blindPart - (1,8 + 9)), wysokość jak korpus
    const zA = Math.max(0, blind - (t + 9));
    const zB = h;
    if(zA > 0 && zB > 0){
      parts.push({ name:'Zaślepka', qty:1, a:zA, b:zB, dims:`${fmtCm(zA)} × ${fmtCm(zB)}`, material: bodyMat });
    }

    // Blenda: 15 cm szerokości, wysokość jak korpus, materiał jak front
    const fMat = cab.frontMaterial || 'laminat';
    const fCol = cab.frontColor || '';
    const frontMatKey = `Front: ${fMat}${fCol ? ` • ${fCol}` : ''}`;
    parts.push({ name:'Blenda', qty:1, a:15, b:h, dims:`${fmtCm(15)} × ${fmtCm(h)}`, material: frontMatKey });
  }

  // Wieńce
  if(effType === 'wisząca' || effType === 'moduł'){
    // Wiszące: wieńce płytsze o 2cm od korpusu; moduły: bez tej korekty (tylko jak wiszące w skręcaniu)
    const crownDepth = (effType === 'wisząca') ? Math.max(0, d - 2) : d;
    parts.push({ name:'Wieniec górny', qty:1, a:wIn, b:crownDepth, dims:`${fmtCm(wIn)} × ${fmtCm(crownDepth)}`, material: bodyMat });
    parts.push({ name:'Wieniec dolny', qty:1, a:wIn, b:crownDepth, dims:`${fmtCm(wIn)} × ${fmtCm(crownDepth)}`, material: bodyMat });
  }

  if(effType === 'stojąca'){
    if(isUnderCounterWall){
      // Wisząca dolna podblatowa: wieniec dolny MIĘDZY bokami, boki pełnej wysokości korpusu
      parts.push({ name:'Wieniec dolny', qty:1, a:wIn, b:d, dims:`${fmtCm(wIn)} × ${fmtCm(d)}`, material: bodyMat });
    } else {
      // Stojące: wieniec dolny POD bokami => szer. zewn.
      parts.push({ name:'Wieniec dolny', qty:1, a:w, b:d, dims:`${fmtCm(w)} × ${fmtCm(d)}`, material: bodyMat });
    }

    // Trawersy górne (2 szt.) między bokami, głębokość 9cm
    parts.push({ name:`Trawers górny (${fmtCm(FC_TOP_TRAVERSE_DEPTH_CM)} cm)`, qty:2, a:wIn, b:FC_TOP_TRAVERSE_DEPTH_CM, dims:`${fmtCm(wIn)} × ${fmtCm(FC_TOP_TRAVERSE_DEPTH_CM)}`, material: bodyMat });
  }

  // Półki (jeśli są w szczegółach)
  const shelves = parseInt((cab.details && cab.details.shelves) ?? 0, 10);
  // Stojące szuflady: w "Materiały" nie rozpisujemy szuflad jako półek.
  const isStandingDrawerCabinet = (effType === 'stojąca' && String(cab.subType || '') === 'szuflady');
  if(!isStandingDrawerCabinet && Number.isFinite(shelves) && shelves > 0){
    let shelfDepth = d;

    // 1) Stojące: półki płytsze o 0,5cm od korpusu
    // 2) Moduły: tak samo jak stojące
    if(effType === 'stojąca' || effType === 'moduł'){
      shelfDepth = Math.max(0, d - 0.5);
    }

    // 3) Wiszące: półki płytsze o 0,5cm od wieńców; a wieńce są płytsze o 2cm od korpusu
    if(effType === 'wisząca'){
      shelfDepth = Math.max(0, (d - 2) - 0.5); // d - 2,5
    }

    parts.push({ name:'Półka', qty:shelves, a:wIn, b:shelfDepth, dims:`${fmtCm(wIn)} × ${fmtCm(shelfDepth)}`, material: bodyMat });
  }

  // Plecy (HDF / płyta)
  if(backMat && hasBack){
    let backW = w;
    let backH = h;

    // 1) Stojące: plecy mniejsze o 0,5cm względem korpusu
    // 2) Moduły: tak samo jak stojące
    if(effType === 'stojąca' || effType === 'moduł'){
      backW = Math.max(0, w - 0.5);
      backH = Math.max(0, h - 0.5);
    }

    // 3) Wiszące:
    //   A) niższe o 0,5cm od korpusu
    //   B) szersze o 2cm względem wieńca (wieniec = szerokość wewnętrzna)
    if(effType === 'wisząca'){
      backW = Math.max(0, wIn + 2);
      backH = Math.max(0, h - 0.5);
    }

    parts.push({ name:'Plecy', qty:1, a:backW, b:backH, dims:`${fmtCm(backW)} × ${fmtCm(backH)}`, material: backMat });
  }

  // Fronty (materiały)
  const frontParts = getCabinetFrontCutListForMaterials(room, cab);
  frontParts.forEach(p => parts.push(p));

  

  // Zawiasy BLUM (okucia) — dodaj do materiałów jako ilość sztuk (bez wpływu na sumy m²)
// UWAGA: dla klap z AVENTOS HK‑XS ilość zawiasów wynika z tabel (KB/LF) i dodajemy je poniżej jako osobną pozycję.
let hingeQty = getHingeCountForCabinet(room, cab);
try{
  const det = cab.details || {};
  const isHKXS = (String(cab.subType||'') === 'uchylne'
    && String(det.flapVendor||'blum') === 'blum'
    && String(det.flapKind||'HK-XS') === 'HK-XS');
  if(isHKXS) hingeQty = 0;
}catch(e){ /* noop */ }

if(hingeQty > 0){
  parts.push({ name:'Zawias BLUM', qty:hingeQty, a:0, b:0, dims:'—', material:'Okucia: zawiasy BLUM' });
}


  
// Podnośniki BLUM AVENTOS (dla klap uchylnych) — model + zakres LF + opis "mocy"
// Ostrzeganie/przerwanie dodawania robimy na etapie MODALA (przy dodawaniu/edycji),
// więc w materiałach pokazujemy tylko poprawnie dobrane okucia.
if(String(cab.subType || '') === 'uchylne'){
  const info = getBlumAventosInfo(cab, room);
  if(info && (!info.status || info.status === 'ok' || info.status === 'needs_more_lifts')){
      const nameSuffix = (info.model ? ` ${info.model}` : '');
      const strengthSuffix = (info.strength ? ` (${info.strength})` : '');
      const rangeTxt = (info.rangeStr
        ? (String(info.rangeStr).includes('kg') ? `zakres wagi ${info.rangeStr}` : `zakres LF ${info.rangeStr}`)
        : 'zakres —');
      const qtyLift = (info.liftQty && info.liftQty > 0) ? info.liftQty : 2;
      parts.push({
        name:`Podnośnik BLUM AVENTOS ${info.label}${nameSuffix}${strengthSuffix}`,
        qty: qtyLift,
        a:0, b:0,
        dims:`LF=${info.powerFactor} • ${rangeTxt}${(info.status === 'needs_more_lifts' ? ` • UWAGA: przyjęto ${qtyLift} szt.` : '')}`,
        material:'Okucia: podnośniki BLUM'
      });

      if(info.status === 'needs_more_lifts'){
        parts[parts.length-1].tone = 'orange';
      }

      // HK-XS: zawiasy wg tabel (liczymy oddzielnie od drzwi)
      if(info.hkxsHinges && info.hkxsHinges > 0){
        parts.push({ name:'Zawias BLUM (HK‑XS)', qty:info.hkxsHinges, a:0, b:0, dims:'—', material:'Okucia: zawiasy BLUM' });
      }
  }
}

return parts;

  }

  ns.getCabinetCutList = getCabinetCutList;
})();
