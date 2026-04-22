(function(){
  const ns = (window.FC = window.FC || {});

function getSubTypeOptionsForType(typeVal){
  if(typeVal === 'wisząca'){
    return [
      { v:'standardowa', t:'Standardowa' },
      { v:'rogowa_slepa', t:'Rogowa ślepa' },
      { v:'narozna_l', t:'Narożna L' },
      { v:'dolna_podblatowa', t:'Dolna podblatowa' },
      { v:'okap', t:'Okapowa' },
      { v:'uchylne', t:'Uchylne (klapa)' }
    ];
  }
  if(typeVal === 'stojąca'){
    return [
      { v:'standardowa', t:'Standardowa' },
      { v:'rogowa_slepa', t:'Rogowa ślepa' },
      { v:'narozna_l', t:'Narożna L' },
      { v:'piekarnikowa', t:'Piekarnikowa' },
      { v:'zlewowa', t:'Zlewowa' },
      { v:'zmywarkowa', t:'Zmywarkowa' },
      { v:'lodowkowa', t:'Lodówkowa' },
      { v:'szuflady', t:'Szuflady' }
    ];
  }
  if(typeVal === 'moduł'){
    return [
      { v:'standardowa', t:'Standardowa' },
      { v:'szuflady', t:'Szufladowa' },
      { v:'uchylne', t:'Uchylna' }
    ];
  }
  return [{ v:'standardowa', t:'Standardowa' }];
}

/* Apply rules */
function applyTypeRules(room, updated, typeVal){
  if(typeVal === 'wisząca'){
    updated.subType = 'standardowa';
    updated.height = calculateAvailableTopHeight(room);
    updated.depth = 36;
    updated.details = Object.assign({}, updated.details || {}, { shelves: 2 });
    if(!['TIP-ON','podchwyt','uchwyt klienta','krawędziowy HEXA GTV','korytkowy','UKW'].includes(updated.openingSystem)){
      updated.openingSystem = 'uchwyt klienta';
    }
    if(typeof updated.frontCount !== 'number') updated.frontCount = 2;
  } else if(typeVal === 'stojąca'){
    updated.subType = 'standardowa';
    updated.height = projectData[room].settings.bottomHeight;
    updated.depth = 51;
    if(!['TIP-ON','uchwyt klienta','krawędziowy HEXA GTV','korytkowy','UKW'].includes(updated.openingSystem)){
      updated.openingSystem = 'uchwyt klienta';
    }
    if(typeof updated.frontCount !== 'number') updated.frontCount = 2;
  } else if(typeVal === 'moduł'){
    // Moduł: korpus jak stojąca (bez nóżek), domyślnie szer. 60, gł. 51, wys. wg obecnej logiki (gap + blat + 18mm)
    updated.subType = 'standardowa';
    const gap = Number(projectData[room].settings.gapHeight) || 0;
    const counter = Number(projectData[room].settings.counterThickness) || 0;
    updated.width = 60;
    updated.depth = 51;
    updated.height = Math.round((gap + counter + 1.8) * 10) / 10;
    updated.details = Object.assign({}, updated.details || {}, { shelves: (updated.details && updated.details.shelves != null ? updated.details.shelves : 2) });
    if(!['TIP-ON','uchwyt klienta','krawędziowy HEXA GTV','korytkowy','UKW'].includes(updated.openingSystem)){
      updated.openingSystem = 'uchwyt klienta';
    }
    // Moduł standardowy domyślnie jak drzwi (1/2 do wyboru)
    if(typeof updated.frontCount !== 'number' || ![1,2].includes(Number(updated.frontCount))) updated.frontCount = 2;
  }
  updated.type = typeVal;
  return updated;
}

function applySubTypeRules(room, updated, subTypeVal){
  if(updated.type === 'wisząca'){
    if(subTypeVal === 'dolna_podblatowa'){
      updated.depth = 57;
      updated.height = projectData[room].settings.bottomHeight;
      updated.details = Object.assign({}, updated.details || {}, { podFrontMode: 'drzwi', podInsideMode: 'polki', podInnerDrawerCount: '1', shelves: 1 });
    } else {
      updated.depth = 36;
      updated.height = calculateAvailableTopHeight(room);
    }
  } else if(updated.type === 'stojąca'){
    if(subTypeVal === 'zlewowa'){
      updated.depth = 56;
    } else if(['standardowa','rogowa_slepa','narozna_l','szuflady','piekarnikowa'].includes(subTypeVal)){
      updated.depth = 51;
    } else if(['zmywarkowa','lodowkowa'].includes(subTypeVal)){
      updated.depth = 57;
    }

    if(subTypeVal === 'piekarnikowa'){
      updated.details = FC.utils.isPlainObject(updated.details) ? updated.details : {};
      // Oven cabinet: do not treat legacy default shelf=1 as a real shelf.
      updated.details.shelves = 0;
      if(!('ovenOption' in updated.details)) updated.details.ovenOption = 'szuflada_dol';
      if(!('ovenHeight' in updated.details)) updated.details.ovenHeight = '60';
    }
  } else if(updated.type === 'moduł'){
    // Moduł: warianty jak stojąca (bez nóżek) + uchylna jak wisząca, ale głębokość zawsze 51, szerokość domyślnie 60
    updated.depth = 51;
    if(!Number(updated.width)) updated.width = 60;

    if(subTypeVal === 'szuflady'){
      const cur = (updated.details || {});
      // ustaw domyślne wartości szuflad (jak w stojącej)
      updated.details = Object.assign({}, cur, {
        drawerLayout: (cur.drawerLayout || (cur.drawerCount ? null : '3_1_2_2') || '3_1_2_2'),
        drawerSystem: (cur.drawerSystem || 'skrzynkowe'),
        innerDrawerType: (cur.innerDrawerType || 'brak'),
        innerDrawerCount: (cur.innerDrawerCount != null ? cur.innerDrawerCount : 0),
        shelves: (cur.shelves != null ? cur.shelves : 0)
      });
      updated.frontCount = 0;
    } else if(subTypeVal === 'uchylne'){
      const cur = (updated.details || {});
      const vendor = (cur.flapVendor || 'blum');
      let kind = cur.flapKind;
      if(!kind){
        kind = (vendor === 'hafele') ? 'DUO' : 'HKI';
      }

      // Usuń ślady po szufladach, żeby UI nie pokazywało pól "szufladowych"
      const clean = Object.assign({}, cur);
      delete clean.drawerLayout;
      delete clean.drawerSystem;
      delete clean.drawerCount;
      delete clean.innerDrawerType;
      delete clean.innerDrawerCount;

      updated.details = Object.assign({}, clean, {
        flapVendor: vendor,
        flapKind: kind,
        shelves: (cur.shelves != null ? cur.shelves : 2)
      });
      updated.frontCount = getFlapFrontCount(updated);
    } else {
      // standardowa
      const cur = (updated.details || {});
      updated.details = Object.assign({}, cur, { shelves: (cur.shelves != null ? cur.shelves : 2) });
      if(![1,2].includes(Number(updated.frontCount))) updated.frontCount = 2;
    }
  }

  updated.subType = subTypeVal;

  // piekarnikowa: parametry piekarnika + półka techniczna
  if(updated.type === 'stojąca' && subTypeVal === 'piekarnikowa'){
    const cur = (updated.details || {});
    updated.details = Object.assign({}, cur, {
      ovenOption: (cur.ovenOption || 'szuflada_dol'),
      ovenHeight: (cur.ovenHeight || '60'),
      techShelfCount: (cur.techShelfCount || '1'),
      shelves: (cur.shelves != null ? cur.shelves : 0)
    });
  }

  
  // szuflady (stojąca): układ + typ + opcjonalne szuflady wewnętrzne
  if(updated.type === 'stojąca' && subTypeVal === 'szuflady'){
    const cur = FC.utils.isPlainObject(updated.details) ? updated.details : {};
    let lay = cur.drawerLayout;
    if(!lay){
      const legacy = String(cur.drawerCount || '3');
      if(legacy === '1') lay = '1_big';
      else if(legacy === '2') lay = '2_equal';
      else if(legacy === '3') lay = '3_1_2_2';
      else if(legacy === '5') lay = '5_equal';
      else lay = '3_equal';
    }
    const innerDef = (lay === '3_equal') ? '3' : '2';
    updated.details = Object.assign({}, cur, {
      drawerLayout: lay,
      drawerSystem: (cur.drawerSystem || 'skrzynkowe'),
      innerDrawerType: (cur.innerDrawerType || 'brak'),
      innerDrawerCount: (cur.innerDrawerCount != null ? String(cur.innerDrawerCount) : innerDef),
      // zachowaj legacy dla kompatybilności
      drawerCount: (cur.drawerCount != null ? String(cur.drawerCount) : (lay === '1_big' ? '1' : lay === '2_equal' ? '2' : lay === '5_equal' ? '5' : '3'))
    });
    // układ 5 szuflad: brak wewnętrznych
    if(lay === '5_equal'){
      updated.details.innerDrawerType = 'brak';
      updated.details.innerDrawerCount = '0';
    }
  }

// zlewowa: wybór frontu (drzwi/szuflada) + opcje dodatkowe (półka / szuflada wewn.)
  if(updated.type === 'stojąca' && subTypeVal === 'zlewowa'){
    const cur = (updated.details || {});
    // migracja z poprzedniego pola sinkOption, jeśli istnieje
    let sinkFront = cur.sinkFront

// zmywarkowa: wybór szerokości zmywarki synchronizuje wymiar szafki + przegrody techniczne dla wysokich frontów
if(updated.type === 'stojąca' && subTypeVal === 'zmywarkowa'){
  const cur = FC.utils.isPlainObject(updated.details) ? updated.details : {};
  let dw = cur.dishWasherWidth;
  const cw = Number(updated.width) || 0;
  if(!dw){
    if(cw === 45) dw = '45';
    else if(cw === 60) dw = '60';
    else dw = '60';
  }
  updated.details = Object.assign({}, cur, { dishWasherWidth: dw });
  updated.width = Number(dw) || 60;

  const leg = Number(projectData[room]?.settings?.legHeight) || 0;
  const frontH = (Number(updated.height) || 0) - leg;
  // Przegroda techniczna: 74.6–76.5 => 1; 76.6–78.5 => 2; itd.
  const div = (frontH > 74.5) ? Math.max(0, Math.ceil(((frontH - 74.5) / 2) - 1e-9)) : 0;
  updated.details = Object.assign({}, updated.details, { techDividerCount: String(div), shelves: 0 });

  updated.frontCount = 1;
}

;
    let sinkDoorCount = cur.sinkDoorCount;
    let sinkExtra = cur.sinkExtra;
    let sinkExtraCount = cur.sinkExtraCount;
    let sinkInnerDrawerType = cur.sinkInnerDrawerType;

    if(!sinkFront && cur.sinkOption){
      if(cur.sinkOption === 'zwykle_drzwi'){
        sinkFront = 'drzwi';
      } else if(cur.sinkOption === 'szuflada'){
        sinkFront = 'szuflada';
      } else if(cur.sinkOption === 'szuflada_i_polka'){
        sinkFront = 'szuflada';
        sinkExtra = 'polka';
        sinkExtraCount = sinkExtraCount || 1;
      }
    }

    updated.details = Object.assign({}, cur, {
      sinkFront: (sinkFront || 'drzwi'),
      sinkDoorCount: (sinkDoorCount || '2'),
      sinkExtra: (sinkExtra || 'brak'),
      sinkExtraCount: (sinkExtraCount != null ? sinkExtraCount : 1),
      sinkInnerDrawerType: (sinkInnerDrawerType || 'skrzynkowe')
    });

    // półki użytkowe dla zlewowej domyślnie 0 (opcjonalne przez sinkExtra)
    if(updated.details.shelves == null) updated.details.shelves = 0;

    // jeżeli szuflada z przodu -> 1 duży front
    if(updated.details.sinkFront === 'szuflada'){
      updated.frontCount = 1;
    } else {
      const dc = Number(updated.details.sinkDoorCount) || 2;
      updated.frontCount = (dc === 1 ? 1 : 2);
    }
  }

  // rogowa_slepa: dodatkowy wymiar "część zaślepiona" (cm)
  if(subTypeVal === 'rogowa_slepa'){
    const cur = (updated.details || {});
    updated.details = Object.assign({}, cur, { blindPart: (cur.blindPart ?? 30), cornerOption: (cur.cornerOption || 'polki') });
  }

  // frontCount defaults per subtype (tam gdzie logiczne)
  if(updated.type === 'stojąca'){
    if(subTypeVal === 'zmywarkowa' || subTypeVal === 'piekarnikowa'){
      updated.frontCount = 1;
    } else if(subTypeVal === 'szuflady'){
      const d = FC.utils.isPlainObject(updated.details) ? updated.details : {};
      const lay = String(d.drawerLayout || '');
      let n = 3;
      if(lay === '1_big') n = 1;
      else if(lay === '2_equal') n = 2;
      else if(lay === '3_equal') n = 3;
      else if(lay === '5_equal') n = 5;
      else if(lay === '3_1_2_2') n = 3;
      updated.frontCount = n;
    } else if(typeof updated.frontCount !== 'number' || updated.frontCount === 0){
      updated.frontCount = 2;
    }
    if(subTypeVal === 'lodowkowa'){
      // domyślnie: lodówka w zabudowie, nisza 178, 2 fronty
      const cur = (updated.details && FC.utils.isPlainObject(updated.details)) ? updated.details : {};
      const opt = cur.fridgeOption ? String(cur.fridgeOption) : 'zabudowa';
      const niche = cur.fridgeNicheHeight ? String(cur.fridgeNicheHeight) : '178';
      const freeOpt = cur.fridgeFreeOption ? String(cur.fridgeFreeOption) : 'brak';
      const fc = cur.fridgeFrontCount ? String(cur.fridgeFrontCount) : '2';

      // szerokość: standard 60 (użytkownik może zmienić w polu szerokości)
      if(!Number.isFinite(Number(updated.width)) || Number(updated.width) <= 0){
        updated.width = 60;
      }

      // wysokość: dla zabudowy = wysokość dołu (z nogami) + nisza + (przegrody techn. * 1.8) + 3.6
      if(opt === 'zabudowa'){
        const s = projectData[room] ? projectData[room].settings : null;
        const bh = s ? (Number(s.bottomHeight) || 0) : 0;
        const leg = s ? (Number(s.legHeight) || 0) : 0;
        const bottomFrontH = Math.max(0, bh - leg);
        const div = (bottomFrontH > 74.5) ? Math.max(0, Math.ceil(((bottomFrontH - 74.5) / 2) - 1e-9)) : 0;
        const nh = Number(niche) || 0;
        if(nh > 0){
          updated.height = nh + (div * 1.8) + 3.6 + leg;
        }
      }

      // Przegroda techniczna: zależne od dolnego frontu (wys. dołu bez nóg), jak w zmywarce
      const s2 = projectData[room] ? projectData[room].settings : null;
      const leg = s2 ? (Number(s2.legHeight) || 0) : 0;
      const bottomFrontH = s2 ? Math.max(0, (Number(s2.bottomHeight) || 0) - leg) : 0;
      const div = (opt === 'zabudowa' && bottomFrontH > 74.5) ? Math.max(0, Math.ceil(((bottomFrontH - 74.5) / 2) - 1e-9)) : 0;

      updated.details = Object.assign({}, cur, {
        fridgeOption: opt,
        fridgeNicheHeight: niche,
        fridgeFreeOption: freeOpt,
        fridgeFrontCount: fc,
        techDividerCount: String(div)
      });

      // frontCount na kabinie nie używane dla lodówkowej (obsługa jest przez fridgeFrontCount),
      // ale zostawiamy niezerowe aby nie psuć UI w innych miejscach.
      if(typeof updated.frontCount !== 'number' || updated.frontCount === 0) updated.frontCount = 2;
    }
  }
  if(updated.type === 'wisząca'){
    if(typeof updated.frontCount !== 'number' || updated.frontCount === 0) updated.frontCount = 2;
  }

  return updated;
}

/* ===== Fronts storage helpers ===== */
function addFront(room, front){
  const f = Object.assign({
    id: FC.utils.uid(),
    material: 'laminat',
    color: '',
    width: 0,
    height: 0,
    note: '',
    setId: null,
    setNumber: null,
    cabId: null
  }, front);
  if(!projectData[room]) return;
  projectData[room].fronts = projectData[room].fronts || [];
  projectData[room].fronts.push(f);
}

function removeFrontsForSet(room, setId){
  projectData[room].fronts = (projectData[room].fronts || []).filter(f => f.setId !== setId);
}
function removeFrontsForCab(room, cabId){
  projectData[room].fronts = (projectData[room].fronts || []).filter(f => f.cabId !== cabId);
}
function getFrontsForSet(room, setId){
  return (projectData[room].fronts || []).filter(f => f.setId === setId);
}
function getFrontsForCab(room, cabId){
  return (projectData[room].fronts || []).filter(f => f.cabId === cabId);
}

/* ===== Front generation for cabinets (point 2 + 3) ===== */
function cabinetAllowsFrontCount(cab){
  if(cab.type !== 'stojąca' && cab.type !== 'wisząca' && cab.type !== 'moduł') return false;
  const st = cab.subType;
  if(st === 'narozna_l') return false; // narożna L: stała ilość frontów (2)
  if(st === 'uchylne') return false; // klapa: ilość frontów zależy od rodzaju
  if(st === 'szuflady') return false;
  if(st === 'zmywarkowa' || st === 'piekarnikowa') return false; // 1 front
  // reszta: pozwalamy 1/2
  return true;
}


function getFlapFrontCount(cab){
  const vendor = (cab.details && cab.details.flapVendor) ? String(cab.details.flapVendor) : 'blum';
  const kind = (cab.details && cab.details.flapKind) ? String(cab.details.flapKind) : 'HKI';
  // 2 fronty tylko dla Aventos HF top (uchylno‑składany)
  if(vendor === 'blum' && kind === 'HF_top') return 2;
  return 1;
}

// Backward-compat helper: older code may call this name.
function getFlapFrontCountFromDetails(details){
  return getFlapFrontCount({ details: details || {} });
}


function ensureFrontCountRules(cab){
  // Narożna L zawsze ma 2 fronty (liczone osobno: FL/FP)
  if(cab.subType === 'narozna_l'){
    cab.frontCount = 2;
    return;
  }

  // Uchylne (klapy): ilość frontów zależy od rodzaju podnośnika (HF top = 2, reszta = 1)
  if((cab.type === 'wisząca' || cab.type === 'moduł') && cab.subType === 'uchylne'){
    cab.frontCount = getFlapFrontCount(cab);
    return;
  }

  // Moduł: szuflady nie mają osobnego wyboru ilości frontów (fronty wynikają z układu)
  if(cab.type === 'moduł'){
    if(cab.subType === 'szuflady'){
      cab.frontCount = 0;
      return;
    }
    if(![1,2].includes(Number(cab.frontCount))) cab.frontCount = 2;
    return;
  }

  // Wisząca: domyślnie 2 fronty (chyba że specjalne tryby)
  if(cab.type === 'wisząca'){
    const isPod = (cab.subType === 'dolna_podblatowa');
    const mode = cab.details && cab.details.podFrontMode ? cab.details.podFrontMode : null;

    if(isPod && mode === 'brak'){
      cab.frontCount = 0;
      return;
    }
    if(isPod && mode === 'szuflady'){
      if(![1,2].includes(Number(cab.frontCount))) cab.frontCount = 2;
      return;
    }
    if(!cab.frontCount || cab.frontCount < 1) cab.frontCount = 2;
    return;
  }

  // Stojąca: domyślnie 2 fronty, wyjątki
  if(cab.type === 'stojąca'){
    if(cab.subType === 'rogowa_slepa'){
      const co = cab.details?.cornerOption || 'polki';
      if(co === 'magic_corner') cab.frontCount = 1;
    }
    if(!cab.frontCount || cab.frontCount < 1) cab.frontCount = 2;
    return;
  }
}


// ===== Walidacja AVENTOS (klapy uchylne) na etapie dodawania/edycji szafki =====
// Cel: jeśli KH/LF poza zakresem – nie pozwól zapisać szafki (zamiast ostrzeżeń w "Materiały").
// Używa istniejącego #cmFlapInfo (bez dodawania nowych elementów UI).
function validateAventosForDraft(room, draft){
  if(!room || !draft) return { ok:true };
  if(String(draft.subType || '') !== 'uchylne') return { ok:true };

  const info = getBlumAventosInfo(draft, room);
  if(!info) return { ok:true };

  if(info.status && info.status !== 'ok'){
    // jeśli da się dobrać poprzez zwiększenie liczby podnośników — to NIE jest błąd blokujący
    if(info.status === 'needs_more_lifts'){
      return { ok:true, warning:true, info, msg: String(info.message || '') };
    }
    let extra = '';
    if(info.status === 'out_pf' && info.neededLiftQty){
      extra = ` Potrzeba ok. ${info.neededLiftQty} podnośników.`;
    }
    const msg = String(info.message || `Poza zakresem: LF=${info.powerFactor}`) + extra;
    return { ok:false, info, msg };
  }

  // Ostrzeżenia informacyjne (np. zalecenia warsztatowe) przy status='ok'
  if(info.status === 'ok' && info.message && String(info.message).trim() && info.messageTone === 'orange'){
    return { ok:true, warning:true, info, msg: String(info.message) };
  }


  return { ok:true, info };
}

function applyAventosValidationUI(room, draft){
  const saveBtn = document.getElementById('cabinetModalSave');
  const infoEl = document.getElementById('cmFlapInfo');
  if(!saveBtn || !infoEl) return;

  const res = validateAventosForDraft(room, draft);

  // reset
  saveBtn.disabled = false;

  // domyślnie chowamy
  infoEl.style.display = 'none';
  infoEl.textContent = '';

  if(res.ok && !res.warning){
    return;
  }

  // pokaż komunikat (ostrzeżenie lub błąd)
  infoEl.style.display = 'block';
  infoEl.textContent = res.msg || '';

  if(!res.ok){
    // błąd blokujący
    saveBtn.disabled = true;
  }

  // Kolory tła: czerwony (blokuje) / pomarańczowy (ostrzeżenie lub za wysoki front)
  const tone = res.warning ? 'orange' : ((res.info && res.info.messageTone) ? res.info.messageTone : 'red');
  if(tone === 'orange'){
    infoEl.style.background = '#fff3cd';
    infoEl.style.border = '1px solid #ffecb5';
    infoEl.style.color = '#7a4b00';
  }else{
    infoEl.style.background = '#f8d7da';
    infoEl.style.border = '1px solid #f5c2c7';
    infoEl.style.color = '#7a0000';
  }
  infoEl.style.padding = '10px';
  infoEl.style.borderRadius = '8px';
}


function syncDraftFromCabinetModalForm(d){
  if(!d) return;
  const num = (id) => {
    const el = document.getElementById(id);
    if(!el) return null;
    const raw = String(el.value ?? '').trim().replace(',', '.');
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const str = (id) => {
    const el = document.getElementById(id);
    if(!el) return null;
    const v = String(el.value ?? '').trim();
    return v;
  };

  const w = num('cmWidth');  if(w !== null) d.width = w;
  const h = num('cmHeight'); if(h !== null) d.height = h;
  const dep = num('cmDepth'); if(dep !== null) d.depth = dep;

  const fc = num('cmFrontCount'); // może nie istnieć (np. klapa/narożna L)
  if(fc !== null) d.frontCount = fc;

  // półki
  // UWAGA: cmShelves istnieje w DOM zawsze (ukryty wrap), ale nie każda szafka używa tego pola.
  // Żeby nie nadpisywać wartości ustawianych w dynamicznych polach (np. Moduł→Standardowa),
  // czytamy cmShelves tylko wtedy, gdy jego wrap jest widoczny.
  const shWrap = document.getElementById('cmShelvesWrap');
  const shWrapVisible = !!(shWrap && shWrap.style.display !== 'none' && shWrap.offsetParent !== null);
  if(shWrapVisible){
    const sh = num('cmShelves');
    if(sh !== null){
      // store as integer number for consistency across cabinet types
      d.details = Object.assign({}, d.details || {}, { shelves: Math.max(0, Math.round(sh)) });
    }
  }

  // narożna L (GL/GP/ST/SP)
  const gl = num('cmGL'), gp = num('cmGP'), st = num('cmST'), sp = num('cmSP');
  if([gl,gp,st,sp].some(v => v !== null)){
    d.details = Object.assign({}, d.details || {}, {
      gl: gl !== null ? String(gl) : (d.details?.gl ?? ''),
      gp: gp !== null ? String(gp) : (d.details?.gp ?? ''),
      st: st !== null ? String(st) : (d.details?.st ?? ''),
      sp: sp !== null ? String(sp) : (d.details?.sp ?? '')
    });
    // pomocniczo: szerokość=ST, głębokość=max(GL,GP) – tak jak w sync narożnej
    if(st !== null) d.width = st;
    if(gl !== null || gp !== null) d.depth = Math.max(gl ?? 0, gp ?? 0);
  }

  // klapa (uchylne)
  const flapVendor = str('cmFlapVendor');
  const flapKind = str('cmFlapKind');
  if((d.type === 'wisząca' || d.type === 'moduł') && d.subType === 'uchylne'){
    const det = Object.assign({}, d.details || {});
    if(flapVendor) det.flapVendor = flapVendor;
    if(flapKind) det.flapKind = flapKind;
    d.details = det;
  }
}


function generateFrontsForCabinet(room, cab){
  // czyścimy stare
  removeFrontsForCab(room, cab.id);

  // tylko jeśli ma sens
  if(!(cab.type === 'stojąca' || cab.type === 'wisząca' || cab.type === 'moduł')) return;

  // wysokość frontów: dla szafek stojących odejmujemy wysokość nóżek (ustawienia pomieszczenia)
  function getFrontHeightForCab(){
    let h = Number(cab.height) || 0;
    if(cab.type === 'stojąca'){
      const s = (projectData[room] && projectData[room].settings) ? projectData[room].settings : {};
      const leg = Number(s.legHeight) || 0;
      if(leg > 0) h = Math.max(0, h - leg);
    }
    return h;
  }
  if(cab.subType === 'szuflady'){
    const d = cab.details || {};
    // układ szuflad (kompatybilność wstecz: drawerCount)
    let lay = String(d.drawerLayout || '');
    if(!lay){
      const legacy = String(d.drawerCount || '3');
      if(legacy === '1') lay = '1_big';
      else if(legacy === '2') lay = '2_equal';
      else if(legacy === '3') lay = '3_1_2_2';
      else if(legacy === '5') lay = '5_equal';
      else lay = '3_equal';
    }

    let ratios = [1,2,2];
    if(lay === '1_big') ratios = [1];
    else if(lay === '2_equal') ratios = [1,1];
    else if(lay === '3_equal') ratios = [1,1,1];
    else if(lay === '5_equal') ratios = [1,1,1,1,1];
    else if(lay === '3_1_2_2') ratios = [1,2,2];

    const cabW = Number(cab.width) || 0;
    const cabH = getFrontHeightForCab();
    const sum = ratios.reduce((a,b)=>a+b,0) || 1;

    // wylicz wysokości z zaokrągleniem do 0.1 i korektą ostatniego
    const heights = [];
    let acc = 0;
    for(let i=0;i<ratios.length;i++){
      let h = (cabH * ratios[i]) / sum;
      h = Math.round(h*10)/10;
      if(i === ratios.length-1){
        h = Math.round((cabH - acc)*10)/10;
      }
      acc += h;
      heights.push(h);
    }

    const mat = cab.frontMaterial || 'laminat';
    const col = cab.frontColor || '';
    // zapisujemy też poprawną ilość frontów dla podsumowania
    cab.frontCount = ratios.length;

    for(let i=0;i<heights.length;i++){
      addFront(room, { id: FC.utils.uid(), cabId: cab.id, setId: cab.setId||null, setNumber: cab.setNumber||null, material: mat, color: col, width: cabW, height: heights[i], note: `Szuflada ${i+1}` });
    }
    return;
  }

  const mat = cab.frontMaterial || 'laminat';
  const col = cab.frontColor || '';

  // effectiveW: szerokość używana do frontów (niektóre typy mają zaślepienia)
  let effectiveW = Number(cab.width)||0;
  if(cab.subType === 'rogowa_slepa'){
    const blind = Math.max(0, Number(cab.details?.blindPart)||0);
    effectiveW = Math.max(0, effectiveW - blind);
  }

  // dolna_podblatowa (wisząca): tryb frontu (brak / drzwi / szuflady)
  if(cab.type === 'wisząca' && cab.subType === 'dolna_podblatowa'){
    const d = cab.details || {};
    const mode = d.podFrontMode || (d.subTypeOption && String(d.subTypeOption).startsWith('szuflada') ? 'szuflady' : ((Number(cab.frontCount)||0) ? 'drzwi' : 'brak'));

    // brak frontu
    if(mode === 'brak' || (Number(cab.frontCount)||0) === 0){
      return;
    }

    // szuflady zamiast drzwi: fronty poziome na pełną szerokość
    if(mode === 'szuflady'){
      const n = Math.max(1, Number(cab.frontCount)||1);
      const cabW = Number(cab.width) || 0;
      const cabH = getFrontHeightForCab();
      const hEach = n ? Math.round((cabH / n) * 10) / 10 : 0;

      for(let i=0;i<n;i++){
        addFront(room, { id: FC.utils.uid(), cabId: cab.id, setId: cab.setId||null, setNumber: cab.setNumber||null, material: mat, color: col, width: cabW, height: hEach, note: `Szuflada ${i+1}/${n}` });
      }
      return;
    }
    // drzwi -> normalna logika poniżej (szerokość dzielona przez ilość frontów)
  }

// uchylne (klapa) – 1 front lub 2 fronty (Aventos HF)
if((cab.type === 'wisząca' || cab.type === 'moduł') && cab.subType === 'uchylne'){
  const fcFlap = getFlapFrontCount(cab);
  cab.frontCount = fcFlap; // informacyjnie + do podsumowań
  const fhFull = getFrontHeightForCab();
  const noteBase = (cab.details && cab.details.flapVendor) ? `Klapa (${cab.details.flapVendor})` : 'Klapa';
  if(fcFlap === 1){
    addFront(room, { cabId: cab.id, material: mat, color: col, width: effectiveW, height: fhFull, note: noteBase });
  } else {
    const h1 = Math.round((fhFull/2)*10)/10;
    const h2 = Math.max(0, Math.round((fhFull - h1)*10)/10);
    addFront(room, { cabId: cab.id, material: mat, color: col, width: effectiveW, height: h1, note: `${noteBase} – front 1/2` });
    addFront(room, { cabId: cab.id, material: mat, color: col, width: effectiveW, height: h2, note: `${noteBase} – front 2/2` });
  }
  return;
}

  // lodówkowa w zabudowie — specjalna logika (point 3)
  if(cab.type === 'stojąca' && cab.subType === 'lodowkowa'){
    const opt = (cab.details && cab.details.fridgeOption) ? cab.details.fridgeOption : 'zabudowa';
    

const fc = (cab.details && cab.details.fridgeFrontCount) ? String(cab.details.fridgeFrontCount) : '2';

    if(opt === 'zabudowa'){
      const s = projectData[room].settings;
      const legH = (Number(s.legHeight)||0);
      const bottomFront = Math.max(0, (Number(s.bottomHeight)||0) - legH); // dolny front bez nóg
      const totalFrontH = Math.max(0, (Number(cab.height)||0) - legH); // suma wysokości frontów (bez nóg)
      if(fc === '1'){
        addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: getFrontHeightForCab(), note: `Lodówkowa (1 front)` });
      } else {
        const topFront = Math.max(0, totalFrontH - bottomFront);
        addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: bottomFront, note: `Lodówkowa (dolny front)` });
        addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: topFront, note: `Lodówkowa (górny front)` });
      }
      return;
    }
    // wolnostojąca: brak frontów (obudowa/podest to elementy korpusu, nie fronty)
    return;
  }

  // zmywarkowa: 1 front
  if(cab.type === 'stojąca' && cab.subType === 'zmywarkowa'){
    addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: getFrontHeightForCab(), note: `zmywarkowa (1 front)` });
    return;
  }

  // piekarnikowa: front = wysokość szafki (bez nóżek) minus wysokość piekarnika
  if(cab.type === 'stojąca' && cab.subType === 'piekarnikowa'){
    const ovenH = Number(cab.details?.ovenHeight) || 60;
    const h = Math.max(0, getFrontHeightForCab() - ovenH);
    addFront(room, { cabId: cab.id, material: mat, color: col, width: Number(cab.width)||0, height: h, note: `piekarnikowa (front bez piekarnika)` });
    return;
  }

  // reszta: 1 lub 2 fronty (drzwi)


  // narożna L (wisząca / stojąca): fronty liczone z GL/GP/ST/SP (cm)
  if((cab.type === 'wisząca' || cab.type === 'stojąca') && cab.subType === 'narozna_l'){
    const d = cab.details || {};
    const GL = Number(d.gl) || 0;
    const GP = Number(d.gp) || 0;
    const ST = Number(d.st) || 0;
    const SP = Number(d.sp) || 0;
    const t = 1.8; // cm (płyta 18mm)

    const FL = Math.abs(GL - GP);
    const FP = Math.abs(ST - SP - t);

    const fh = getFrontHeightForCab();
    addFront(room, { cabId: cab.id, material: mat, color: col, width: FL, height: fh, note: `Narożna L (front A)` });
    addFront(room, { cabId: cab.id, material: mat, color: col, width: FP, height: fh, note: `Narożna L (front B)` });
    // wymuszamy 2 dla spójności podsumowania
    cab.frontCount = 2;
    return;
  }

  const fc = Math.max(1, Number(cab.frontCount||2));
  if(fc === 1){
    addFront(room, { cabId: cab.id, material: mat, color: col, width: effectiveW, height: getFrontHeightForCab(), note: `1 front` });
  } else {
    const w = effectiveW;
    const left = Math.round((w/2)*10)/10;
    const right = Math.max(0, w - left);
    addFront(room, { cabId: cab.id, material: mat, color: col, width: left, height: getFrontHeightForCab(), note: `Front 1/2` });
    addFront(room, { cabId: cab.id, material: mat, color: col, width: right, height: getFrontHeightForCab(), note: `Front 2/2` });
  }
}




  ns.cabinetFronts = {
    getSubTypeOptionsForType,
    applyTypeRules,
    applySubTypeRules,
    addFront,
    removeFrontsForSet,
    removeFrontsForCab,
    getFrontsForSet,
    getFrontsForCab,
    cabinetAllowsFrontCount,
    getFlapFrontCount,
    getFlapFrontCountFromDetails,
    ensureFrontCountRules,
    validateAventosForDraft,
    applyAventosValidationUI,
    syncDraftFromCabinetModalForm,
    generateFrontsForCabinet
  };
})();
