(function(){
  const ns = (window.FC = window.FC || {});
  const hw = ns.frontHardware || {};
  const FC_HANDLE_WEIGHT_KG = hw.FC_HANDLE_WEIGHT_KG || 0.2;
  const getFrontWeightKgM2 = hw.getFrontWeightKgM2 || function(){ return 13; };
  const cabinetHasHandle = hw.cabinetHasHandle || function(){ return true; };

  const getProjectRoomData = hw.getProjectRoomData || function(){ return null; };

/* ===== Okucia: podnośniki BLUM AVENTOS (klapy uchylne) =====
   BLUM: współczynnik mocy (LF / power factor) = wysokość korpusu (mm) × waga frontu z uchwytem (kg).
   Źródła: dokumenty BLUM (AVENTOS) / publikacje techniczne.
   Uwaga: w wielu opracowaniach przyjmuje się podwójną masę uchwytu dla klap (bezpieczniej).
*/

const FC_BLUM_FLAP_KIND_LABEL = {
  'HKI':'HKI',
  'HF_top':'HF top (składany)',
  'HS_top':'HS top (uchylno‑nachodzący)',
  'HL_top':'HL top (ponad korpus)',
  'HK_top':'HK top',
  'HK-S':'HK‑S',
  'HK-XS':'HK‑XS'
};

function estimateFlapWeightKg(cab, room){
  if(!cab) return 0;
  // wysokość frontu dla stojących odejmujemy nogi; dla wiszących/modułów bierzemy pełną wysokość
  let hFront = Number(cab.height) || 0;
  if(cab.type === 'stojąca'){
    const roomData = getProjectRoomData(room) || {};
    const s = roomData.settings || {};
    const leg = Number(s.legHeight) || 0;
    if(leg > 0) hFront = Math.max(0, hFront - leg);
  }

  // szerokość efektywna (rogowa ślepa: odjęcie blindPart)
  let wFront = Number(cab.width) || 0;
  if(String(cab.subType||'') === 'rogowa_slepa'){
    const blind = Number(cab.details?.blindPart) || 0;
    if(blind > 0) wFront = Math.max(0, wFront - blind);
  }

  const mat = cab.frontMaterial || 'laminat';
  const wM = Math.max(0, wFront) / 100;
  const hM = Math.max(0, hFront) / 100;
  const area = wM * hM;

  // Uchwyt: BLUM liczy różnie w zależności od systemu:
  // HF/HS/HL: + masa uchwytu (1×)
  // HK/HK-S/HK-XS/HKi: + podwójna masa uchwytu (2×)
  // Tu dobieramy mnożnik na podstawie wybranego rodzaju podnośnika.
  const kind = String((cab.details || {}).flapKind || 'HK-XS');
  const singleHandleKinds = new Set(['HF_top','HS_top','HL_top']);
  const handleMul = singleHandleKinds.has(kind) ? 1 : 2;
  return area * getFrontWeightKgM2(mat) + (cabinetHasHandle(cab) ? (FC_HANDLE_WEIGHT_KG * handleMul) : 0);
}

function blumAventosPowerFactor(cab, room){
  const khMm = Math.max(0, Number(cab.height) || 0) * 10; // cm -> mm
  const fgKg = estimateFlapWeightKg(cab, room);
  return Math.round(khMm * fgKg);
}

function getBlumAventosInfo(cab, room){
  const d = (cab && cab.details) ? cab.details : {};
  const vendor = String(d.flapVendor || 'blum');
  if(vendor !== 'blum') return null;

  const kind = String(d.flapKind || 'HK-XS'); // default to HK-XS for "uchylne"
  const label = FC_BLUM_FLAP_KIND_LABEL[kind] || kind;

  const khMm = Math.max(0, Number(cab.height) || 0) * 10; // cm -> mm
  const pf = blumAventosPowerFactor(cab, room); // LF
  const widthMm = Math.round((Number(cab.width) || 0) * 10);
  const depthMm = Math.round((Number(cab.depth) || 0) * 10);

  // Uwaga o jednostkach:
  // W kodzie liczymy LF = KH(mm) × waga frontu(kg) (z uchwytem).
  // Część materiałów BLUM podaje PF w inch×lb. Wtedy przeliczamy na mm×kg:
  const INLB_TO_MMKg = 25.4 * 0.45359237; // ≈ 11.521

  // Zakresy (HK-XS) – PF/LF w mm×kg
  const HKXS_RANGES = [
    { model:'20K1101', min:200, max:1000, strength:'słaby' },
    { model:'20K1301', min:500, max:1500, strength:'średni' },
    { model:'20K1501', min:800, max:1800, strength:'mocny' }
  ];

  // Zakresy (HK top) – źródła BLUM zwykle w inch×lb -> przeliczamy
  const HKTOP_RANGES = [
    { model:'22K2300', min:Math.round(36*INLB_TO_MMKg),  max:Math.round(139*INLB_TO_MMKg), strength:'słaby' },
    { model:'22K2500', min:Math.round(80*INLB_TO_MMKg),  max:Math.round(240*INLB_TO_MMKg), strength:'średni' },
    { model:'22K2700', min:Math.round(150*INLB_TO_MMKg), max:Math.round(450*INLB_TO_MMKg), strength:'mocny' },
    { model:'22K2900', min:Math.round(270*INLB_TO_MMKg), max:Math.round(781*INLB_TO_MMKg), strength:'bardzo mocny' }
  ];

  // Zakresy (HK‑S) – PF/LF w mm×kg
  const HKS_RANGES = [
    { model:'20K2A00', min:220, max:500, strength:'słaby' },
    { model:'20K2C00', min:400, max:1000, strength:'średni' },
    { model:'20K2E00', min:960, max:2215, strength:'mocny' }
  ];

  // Zakresy (HF top) – PF/LF w mm×kg (podawane dla 2 szt. w zestawie)
  const HFTOP_RANGES = [
    { model:'22F2500', min:2700, max:13500, strength:'słaby/średni' },
    { model:'22F2800', min:10000, max:19300, strength:'mocny' }
  ];

  // Zakresy (HKi) – PF w inch×lb -> przeliczamy
  const HKI_RANGES = [
    { model:'24K2300', min:Math.round(37*INLB_TO_MMKg),  max:Math.round(142*INLB_TO_MMKg), strength:'słaby' },
    { model:'24K2500', min:Math.round(82*INLB_TO_MMKg),  max:Math.round(246*INLB_TO_MMKg), strength:'średni' },
    { model:'24K2700', min:Math.round(152*INLB_TO_MMKg), max:Math.round(458*INLB_TO_MMKg), strength:'mocny' },
    { model:'24K2800', min:Math.round(229*INLB_TO_MMKg), max:Math.round(686*INLB_TO_MMKg), strength:'bardzo mocny' }
  ];

  // HS top – dobór po tabeli „KH / waga frontu” (kg). Dane z opisów katalogowych.
  // Sprawdzamy 3 „siłowniki”: 22S2200, 22S2500, 22S2800.
  const HSTOP_TABLE = [
    { model:'22S2200', khMin:350, khMax:540, wMin0:2.0,   wMin1:3.0,  wMax0:10.25, wMax1:12.5, strength:'słaby' },
    { model:'22S2500', khMin:480, khMax:660, wMin0:2.75,  wMin1:3.0,  wMax0:12.75, wMax1:15.25, strength:'średni' },
    { model:'22S2800', khMin:650, khMax:800, wMin0:3.5,   wMin1:4.0,  wMax0:16.5,  wMax1:18.5,  strength:'mocny' }
  ];

  // HL top – dobór po tabeli „KH / waga frontu” (kg) (przedziały stałe).
  const HLTOP_TABLE = [
    { model:'22L2200', khMin:300, khMax:340, wMin:0.8, wMax:5.6,  strength:'słaby' },
    { model:'22L2500', khMin:340, khMax:390, wMin:1.1, wMax:7.5,  strength:'średni' },
    { model:'22L2800', khMin:390, khMax:580, wMin:1.3, wMax:10.3, strength:'mocny' }
  ];

  // Limity wysokości frontu (KH) dla systemów AVENTOS (wg danych katalogowych/strony BLUM)
  const MAX_FRONT_HEIGHT_BY_KIND_MM = {
    'HK-XS': 0,
    'HK_top': 600,
    'HK-S': 600,
    'HKI': 610,
    'HL_top': 580,
    'HS_top': 800,
    'HF_top': 1200
  };

  const MIN_FRONT_HEIGHT_BY_KIND_MM = {
    // źródła (BLUM):
    // HK-XS: 240–600 mm
    // HK top: 205–600 mm
    // HK-S: 180–600 mm
    // HKi: 162–610 mm
    // HL top: 300–580 mm
    // HS top: 350–800 mm
    // HF top: 480–1200 mm
    'HK-XS': 240,
    'HK_top': 205,
    'HK-S': 180,
    'HKI': 162,
    'HL_top': 300,
    'HS_top': 350,
    'HF_top': 480
  };

  // Ograniczenia szerokości frontu/korpusu dla systemów AVENTOS (typowe wartości katalogowe BLUM)
  // Uwaga: tu walidujemy szerokość korpusu (LW) w mm.
  const MAX_FRONT_WIDTH_BY_KIND_MM = {
    'HK-XS': 0,
    'HK_top': 1800,
    'HK-S': 1800,
    'HKI': 1800,
    'HL_top': 1800,
    'HS_top': 1800,
    'HF_top': 1800
  };

  const MIN_FRONT_WIDTH_BY_KIND_MM = {
    // zwykle brak twardego minimum; zostawiamy 0
    'HK-XS': 0,
    'HK_top': 0,
    'HK-S': 0,
    'HKI': 0,
    'HL_top': 0,
    'HS_top': 0,
    'HF_top': 0
  };

// Minimalna głębokość wewnętrzna korpusu (LT) dla AVENTOS (wg katalogu/BLUM)
// Walidujemy tutaj głębokość korpusu (cm -> mm). Jeśli projektujesz z plecami we wpuszczanym rowku,
// a zależy Ci na ultra-precyzji, dodaj sobie korektę o grubość pleców / cofnięcie – tu trzymamy prostą regułę "czy się zmieści".
const MIN_INTERNAL_DEPTH_BY_KIND_MM = {
  // źródła BLUM (min. głębokość wewnętrzna LT):
  // HK-XS: ≥100 mm (dla specjalnej pozycji wiercenia; standardowo często 125 mm)
  // HK-S: 163 mm
  // HK top: 187 mm (bez SERVO-DRIVE)
  // HL top / HS top / HF top: 264 mm
  // HKi: 270 mm
  'HK-XS': 100,
  'HK-S': 163,
  'HK_top': 187,
  'HL_top': 264,
  'HS_top': 264,
  'HF_top': 264,
  'HKI': 270
};

// Zalecana (bezpieczna warsztatowo) minimalna głębokość wewnętrzna korpusu (LT).
// Dla HK‑XS katalog dopuszcza LT≥100 mm przy specyficznej pozycji montażu, ale w praktyce łatwiej i bezpieczniej przyjąć ≥125 mm.
const REC_INTERNAL_DEPTH_BY_KIND_MM = {
  'HK-XS': 125
};


function suggestKindsForDepth(lt){
  const out = [];
  Object.keys(MIN_INTERNAL_DEPTH_BY_KIND_MM).forEach(k=>{
    const minD = MIN_INTERNAL_DEPTH_BY_KIND_MM[k] || 0;
    if(!lt) return;
    if(minD && lt < minD) return;
    const lbl = FC_BLUM_FLAP_KIND_LABEL[k] || k;
    out.push(lbl);
  });
  return out;
}


  function suggestKindsForWidth(lw){
    const out = [];
    Object.keys(MAX_FRONT_WIDTH_BY_KIND_MM).forEach(k=>{
      const maxW = MAX_FRONT_WIDTH_BY_KIND_MM[k] || 0;
      const minW = MIN_FRONT_WIDTH_BY_KIND_MM[k] || 0;
      if(!lw) return;
      if(minW && lw < minW) return;
      if(maxW && lw > maxW) return;
      const lbl = FC_BLUM_FLAP_KIND_LABEL[k] || k;
      out.push(lbl);
    });
    return out;
  }




  function suggestKindsForHeight(kh){
    const out = [];
    Object.keys(MAX_FRONT_HEIGHT_BY_KIND_MM).forEach(k=>{
      const maxH = MAX_FRONT_HEIGHT_BY_KIND_MM[k];
      const minH = MIN_FRONT_HEIGHT_BY_KIND_MM[k] || 0;
      if(!kh) return;
      if(minH && kh < minH) return;
      if(maxH && kh > maxH) return;
      const lbl = FC_BLUM_FLAP_KIND_LABEL[k] || k;
      out.push(lbl);
    });
    return out;
  }

  function listAllKindsHeightInfo(kh){
    const order = ['HK-XS','HK_top','HK-S','HKI','HL_top','HS_top','HF_top'];
    return order.map(k=>{
      const lbl = FC_BLUM_FLAP_KIND_LABEL[k] || k;
      const minH = MIN_FRONT_HEIGHT_BY_KIND_MM[k] || 0;
      const maxH = MAX_FRONT_HEIGHT_BY_KIND_MM[k] || 0;
      const minTxt = minH ? `${minH}` : '—';
      const maxTxt = maxH ? `${maxH}` : '—';
      const ok = kh ? ((minH ? kh >= minH : true) && (maxH ? kh <= maxH : true)) : false;
      return `${lbl} (${minTxt}–${maxTxt} mm)${kh ? (ok ? ' – pasuje' : ' – nie pasuje') : ''}`;
    });
  }




  let model = '';
  let rangeMin = 0;
  let rangeMax = 0;
  let rangeStr = '';
  let strength = '';
  let status = 'ok'; // ok | needs_more_lifts | out_pf | out_height | out_width | out_depth
  let message = '';
  let messageTone = ''; // red | orange
  let neededLiftQty = 0;

  // Dodatkowe notatki (np. zalecenia warsztatowe)
  let depthAdvisory = '';
  let depthAdvisoryTone = '';


  // Ilość mechanizmów: standardowo 2 szt. (lewy+prawy).
  // Dopuszczamy 3/4 szt. (np. szerokie fronty) — BLUM często podaje +50% dla 3. mechanizmu.
  let liftQty = 2;
  if(kind === 'HK-XS'){
    // HK‑XS może być montowany jednostronnie lub obustronnie – dobór ilości robimy niżej na podstawie LF.
    liftQty = 1;
  }


  // Ilość zawiasów dla HK-XS (wg typowych tabel: szerokość i/lub LF)
  let hkxsHinges = 0;
  if(kind === 'HK-XS'){
    hkxsHinges = 2;
    if(widthMm >= 900 || pf >= 1800) hkxsHinges = 3;
    if(widthMm >= 1200 || pf >= 2700) hkxsHinges = 4;
  }

  // Informacyjna uwaga: katalog BLUM podaje progi doboru 3/4 zawiasów. Przy bardzo szerokich lub ciężkich frontach
  // można rozważyć zastosowanie większej liczby zawiasów (nie zmienia to doboru podnośników HK‑XS).
  if(kind === 'HK-XS' && hkxsHinges === 4 && (widthMm > 1200 || pf > 2700)){
    if(!message || messageTone !== 'red'){
      messageTone = messageTone || 'orange';
      message = message || `HK‑XS: zalecane min. 4 zawiasy (KB≥1200 mm lub LF≥2700). Przy bardzo szerokich frontach możesz dać więcej zawiasów dla sztywności.`;
      status = status || 'ok';
    }
  }

  // 1) Ostrzeżenie wysokości (front za wysoki / za niski)
  const maxH = MAX_FRONT_HEIGHT_BY_KIND_MM[kind] || 0;
  const minH = MIN_FRONT_HEIGHT_BY_KIND_MM[kind] || 0;

  if(maxH && khMm > maxH){
    status = 'out_height';
    messageTone = 'red';
    message = `Za wysoki front: wysokość korpusu ${khMm} mm (dla ${label} max ${maxH} mm).`;
    const sug = suggestKindsForHeight(khMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej wysokości: ${sug.join(', ')}.`;  }else if(minH && khMm > 0 && khMm < minH){
    status = 'out_height';
    messageTone = 'red';
    message = `Za niski front: wysokość korpusu ${khMm} mm (dla ${label} min ${minH} mm).`;
    const sug = suggestKindsForHeight(khMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej wysokości: ${sug.join(', ')}.`;  }



  // 1b) Ostrzeżenie szerokości (front za szeroki)
  const maxW = MAX_FRONT_WIDTH_BY_KIND_MM[kind] || 0;
  const minW = MIN_FRONT_WIDTH_BY_KIND_MM[kind] || 0;

  if(maxW && widthMm > maxW){
    status = 'out_width';
    messageTone = 'red';
    message = `Za szeroki front: szerokość korpusu ${widthMm} mm (dla ${label} max ${maxW} mm).`;
    const sug = suggestKindsForWidth(widthMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej szerokości: ${sug.join(', ')}.`;
  }else if(minW && widthMm > 0 && widthMm < minW){
    status = 'out_width';
    messageTone = 'red';
    message = `Za wąski front: szerokość korpusu ${widthMm} mm (dla ${label} min ${minW} mm).`;
    const sug = suggestKindsForWidth(widthMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej szerokości: ${sug.join(', ')}.`;
  }

  

// 1c) Ostrzeżenie głębokości (korpus za płytki)
  const minD = MIN_INTERNAL_DEPTH_BY_KIND_MM[kind] || 0;
  const recD = REC_INTERNAL_DEPTH_BY_KIND_MM[kind] || 0;

  if(status === 'ok' && minD && depthMm > 0 && depthMm < minD){
    status = 'out_depth';
    messageTone = 'red';
    message = `Za płytki korpus: głębokość ${depthMm} mm (dla ${label} min ${minD} mm).`;
    const sug = suggestKindsForDepth(depthMm).filter(x=>x!==label);
    if(sug.length) message += ` Pasujące rodzaje dla tej głębokości: ${sug.join(', ')}.`;
  }

  // Zalecenie warsztatowe (nie blokuje): HK‑XS katalogowo bywa możliwy od LT≥100 mm, ale bezpieczniej przyjąć ≥125 mm
  if(status === 'ok' && kind === 'HK-XS' && recD && depthMm > 0 && depthMm < recD){
    depthAdvisoryTone = 'orange';
    depthAdvisory = `HK‑XS: katalogowo można zejść do LT≥${minD} mm (specyficzna pozycja montażu), ale warsztatowo bezpieczniej przyjąć ≥${recD} mm (mniej kolizji, łatwiejszy montaż).`;
  }

// Jeśli wysokość, szerokość lub głębokość jest poza zakresem — nie pokazujemy komunikatów o mocy (LF) i blokujemy zapis
  if(status === 'out_height' || status === 'out_width' || status === 'out_depth'){
    return {
      kind, label,
      status,
      message,
      messageTone: (messageTone || 'red'),
      powerFactor: pf,
      liftQty,
      hkxsHinges
    };
  }

  // 2) Dobór modelu i kontrola współczynnika mocy / wagi
  const fgKg = estimateFlapWeightKg(cab, room);

  function pickByRange(ranges){
    return ranges.find(r => pf >= r.min && pf <= r.max) || null;
  }

  function allowMoreLiftsIfPossible(maxFor2){
    if(pf <= maxFor2) return { ok:true, qty:2, tone:'' };
    if(pf <= Math.round(maxFor2 * 1.5)) return { ok:true, qty:3, tone:'orange' };
    if(pf <= Math.round(maxFor2 * 2.0)) return { ok:true, qty:4, tone:'orange' };
    return { ok:false, qty:0, tone:'red', need: Math.max(2, Math.ceil((pf / maxFor2) * 2)) };
  }

  if(kind === 'HK-XS'){
    // HK‑XS: siłownik jest symetryczny i może być stosowany z jednej lub z obu stron.
    // Przy obustronnym zastosowaniu współczynnik mocy LF (PF) się podwaja (wg katalogu BLUM 2024/2025).
    const maxPer = HKXS_RANGES[HKXS_RANGES.length - 1].max;
    const minPer = HKXS_RANGES[0].min;

    function pickForPer(pfPer){
      return HKXS_RANGES.find(r => pfPer >= r.min && pfPer <= r.max) || null;
    }

    // Preferuj minimalną liczbę mechanizmów, która mieści się w zakresie:
    // q=1 (jednostronnie), q=2 (obustronnie).
    let picked = null;
    let pickedQty = 0;

    if(pf < minPer){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      message = message || `Poza zakresem współczynnika mocy: ${pf} (min ${minPer}). Front zbyt lekki dla HK‑XS.`;
      neededLiftQty = 0;
    } else {
      for(const q of [1, 2]){
        const pfPer = Math.ceil(pf / q);
        const p = pickForPer(pfPer);
        if(p){
          picked = p;
          pickedQty = q;
          break;
        }
      }

      if(!picked){
        // Poza zakresem nawet przy 2 mechanizmach (obustronnie)
        status = (status === 'out_height') ? status : 'out_pf';
        messageTone = 'red';
        neededLiftQty = 2;
        message = `Poza zakresem współczynnika mocy dla HK‑XS nawet przy montażu obustronnym (HK‑XS przewiduje maks. 2 mechanizmy): ${pf} (max ${maxPer} na mechanizm, razem max ${maxPer*2}). Rozważ zmianę na HK top / HK‑S (tam można dobrać większą liczbę podnośników).`;
      } else {
        liftQty = pickedQty;
        if(pickedQty === 2){
          // Informacyjnie (nie blokuje): montaż obustronny
          if(!message || messageTone !== 'red'){
            status = status || 'ok';
            messageTone = messageTone || 'green';
            message = message || `Dla tej klapy zalecany montaż obustronny (2 mechanizmy) – współczynnik mocy LF podwaja się.`;
          }
        }
      }
    }

    if(picked){
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  }
 else if(kind === 'HK_top'){
    const picked = pickByRange(HKTOP_RANGES);
    if(!picked){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      const max2 = HKTOP_RANGES[HKTOP_RANGES.length - 1].max;
      const okMore = allowMoreLiftsIfPossible(max2);
      if(okMore.ok){
        status = (status === 'out_height') ? status : 'needs_more_lifts';
        messageTone = 'orange';
        liftQty = okMore.qty;
        model = HKTOP_RANGES[HKTOP_RANGES.length - 1].model;
        rangeMin = HKTOP_RANGES[HKTOP_RANGES.length - 1].min;
        rangeMax = max2;
        strength = HKTOP_RANGES[HKTOP_RANGES.length - 1].strength;
        message = `Wymagana większa liczba podnośników: przyjęto ${liftQty} szt. (na bazie najmocniejszego HK top).`;
      }else{
        neededLiftQty = okMore.need;
        message = `Poza zakresem współczynnika mocy: ${pf} (max ${max2} dla 2 szt.).`;
      }
    }else{
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  } else if(kind === 'HK-S'){
    const picked = pickByRange(HKS_RANGES);
    if(!picked){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      const max2 = HKS_RANGES[HKS_RANGES.length - 1].max;
      const okMore = allowMoreLiftsIfPossible(max2);
      if(okMore.ok){
        status = (status === 'out_height') ? status : 'needs_more_lifts';
        messageTone = 'orange';
        liftQty = okMore.qty;
        model = HKS_RANGES[HKS_RANGES.length - 1].model;
        rangeMin = HKS_RANGES[HKS_RANGES.length - 1].min;
        rangeMax = max2;
        strength = HKS_RANGES[HKS_RANGES.length - 1].strength;
        message = `Wymagana większa liczba podnośników: przyjęto ${liftQty} szt. (na bazie najmocniejszego HK‑S).`;
      }else{
        neededLiftQty = okMore.need;
        message = `Poza zakresem współczynnika mocy: ${pf} (max ${max2} dla 2 szt.).`;
      }
    }else{
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  } else if(kind === 'HF_top'){
    const picked = pickByRange(HFTOP_RANGES);
    if(!picked){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      const max2 = HFTOP_RANGES[HFTOP_RANGES.length - 1].max;
      const okMore = allowMoreLiftsIfPossible(max2);
      if(okMore.ok){
        status = (status === 'out_height') ? status : 'needs_more_lifts';
        messageTone = 'orange';
        liftQty = okMore.qty;
        model = HFTOP_RANGES[HFTOP_RANGES.length - 1].model;
        rangeMin = HFTOP_RANGES[HFTOP_RANGES.length - 1].min;
        rangeMax = max2;
        strength = HFTOP_RANGES[HFTOP_RANGES.length - 1].strength;
        message = `Wymagana większa liczba podnośników: przyjęto ${liftQty} szt. (na bazie najmocniejszego HF top).`;
      }else{
        neededLiftQty = okMore.need;
        message = `Poza zakresem współczynnika mocy: ${pf} (max ${max2} dla 2 szt.).`;
      }
    }else{
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  } else if(kind === 'HKI'){
    const picked = pickByRange(HKI_RANGES);
    if(!picked){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      const max2 = HKI_RANGES[HKI_RANGES.length - 1].max;
      const okMore = allowMoreLiftsIfPossible(max2);
      if(okMore.ok){
        status = (status === 'out_height') ? status : 'needs_more_lifts';
        messageTone = 'orange';
        liftQty = okMore.qty;
        model = HKI_RANGES[HKI_RANGES.length - 1].model;
        rangeMin = HKI_RANGES[HKI_RANGES.length - 1].min;
        rangeMax = max2;
        strength = HKI_RANGES[HKI_RANGES.length - 1].strength;
        message = `Wymagana większa liczba podnośników: przyjęto ${liftQty} szt. (na bazie najmocniejszego HKi).`;
      }else{
        neededLiftQty = okMore.need;
        message = `Poza zakresem współczynnika mocy: ${pf} (max ${max2} dla 2 szt.).`;
      }
    }else{
      model = picked.model;
      rangeMin = picked.min;
      rangeMax = picked.max;
      strength = picked.strength;
    }
  } else if(kind === 'HS_top'){
    const row = HSTOP_TABLE.find(r => khMm >= r.khMin && khMm <= r.khMax) || null;
    if(!row){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      message = message || `Poza zakresem wysokości dla HS top: KH=${khMm} mm.`;
    }else{
      const t = (khMm - row.khMin) / (row.khMax - row.khMin);
      const wMin = row.wMin0 + (row.wMin1 - row.wMin0) * t;
      const wMax = row.wMax0 + (row.wMax1 - row.wMax0) * t;
      if(fgKg < wMin || fgKg > wMax){
        status = (status === 'out_height') ? status : 'out_pf';
        messageTone = (messageTone || 'red');
        message = message || `Poza zakresem wagi frontu dla HS top (${row.model}) przy KH=${khMm} mm: waga ${fgKg.toFixed(2)} kg (dopuszczalne ok. ${wMin.toFixed(2)}–${wMax.toFixed(2)} kg).`;
      }else{
        model = row.model;
        strength = row.strength;
        rangeStr = `${wMin.toFixed(2)}–${wMax.toFixed(2)} kg (dla KH=${khMm} mm)`;
      }
    }
  } else if(kind === 'HL_top'){
    const row = HLTOP_TABLE.find(r => khMm >= r.khMin && khMm <= r.khMax) || null;
    if(!row){
      status = (status === 'out_height') ? status : 'out_pf';
      messageTone = (messageTone || 'red');
      message = message || `Poza zakresem wysokości dla HL top: KH=${khMm} mm.`;
    }else{
      if(fgKg < row.wMin || fgKg > row.wMax){
        status = (status === 'out_height') ? status : 'out_pf';
        messageTone = (messageTone || 'red');
        message = message || `Poza zakresem wagi frontu dla HL top (${row.model}) przy KH=${khMm} mm: waga ${fgKg.toFixed(2)} kg (dopuszczalne ${row.wMin}–${row.wMax} kg).`;
      }else{
        model = row.model;
        strength = row.strength;
        rangeStr = `${row.wMin}–${row.wMax} kg`;
      }
    }
  }

  let rangeStrFinal = '';
  if(rangeStr){
    rangeStrFinal = rangeStr;
  }else{
    rangeStrFinal = (rangeMin && rangeMax) ? `${rangeMin}–${rangeMax}` : '';
  }

    let finalMessage = message || '';
  let finalTone = messageTone || '';
  if(depthAdvisory){
    if(finalMessage){
      finalMessage = `${finalMessage} ${depthAdvisory}`;
      if(!finalTone) finalTone = depthAdvisoryTone || 'orange';
    }else{
      finalMessage = depthAdvisory;
      finalTone = depthAdvisoryTone || 'orange';
    }
  }

  return { kind, label, powerFactor: pf, model, rangeStr: rangeStrFinal, strength, liftQty, hkxsHinges, status, message: finalMessage, messageTone: finalTone, neededLiftQty };
}

  ns.frontHardware = Object.assign({}, ns.frontHardware, {
    FC_BLUM_FLAP_KIND_LABEL,
    estimateFlapWeightKg,
    blumAventosPowerFactor,
    getBlumAventosInfo
  });
})();
