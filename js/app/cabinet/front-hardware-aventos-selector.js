(function(){
  'use strict';
  const ns = (window.FC = window.FC || {});
  const data = ns.frontHardwareAventosData || {};
  const calc = ns.frontHardwareAventosCalc || {};

  const LABELS = data.FC_BLUM_FLAP_KIND_LABEL || {};
  const estimateFlapWeightKg = calc.estimateFlapWeightKg || function(){ return 0; };
  const blumAventosPowerFactor = calc.blumAventosPowerFactor || function(){ return 0; };
  const pickByRange = calc.pickByRange || function(ranges, pf){ return (ranges || []).find(r => pf >= r.min && pf <= r.max) || null; };
  const allowMoreLiftsIfPossible = calc.allowMoreLiftsIfPossible || function(pf, maxFor2){
    if(pf <= maxFor2) return { ok:true, qty:2, tone:'' };
    return { ok:false, qty:0, tone:'red', need:2 };
  };

  function getLabel(kind){ return LABELS[kind] || kind; }

  function suggestKindsForDepth(lt){
    const out = [];
    const map = data.MIN_INTERNAL_DEPTH_BY_KIND_MM || {};
    Object.keys(map).forEach((kind)=>{
      const minD = map[kind] || 0;
      if(!lt) return;
      if(minD && lt < minD) return;
      out.push(getLabel(kind));
    });
    return out;
  }

  function suggestKindsForWidth(lw){
    const out = [];
    const maxMap = data.MAX_FRONT_WIDTH_BY_KIND_MM || {};
    const minMap = data.MIN_FRONT_WIDTH_BY_KIND_MM || {};
    Object.keys(maxMap).forEach((kind)=>{
      const maxW = maxMap[kind] || 0;
      const minW = minMap[kind] || 0;
      if(!lw) return;
      if(minW && lw < minW) return;
      if(maxW && lw > maxW) return;
      out.push(getLabel(kind));
    });
    return out;
  }

  function suggestKindsForHeight(kh){
    const out = [];
    const maxMap = data.MAX_FRONT_HEIGHT_BY_KIND_MM || {};
    const minMap = data.MIN_FRONT_HEIGHT_BY_KIND_MM || {};
    Object.keys(maxMap).forEach((kind)=>{
      const maxH = maxMap[kind];
      const minH = minMap[kind] || 0;
      if(!kh) return;
      if(minH && kh < minH) return;
      if(maxH && kh > maxH) return;
      out.push(getLabel(kind));
    });
    return out;
  }

  function listAllKindsHeightInfo(kh){
    const order = data.KIND_ORDER || ['HK-XS','HK_top','HK-S','HKI','HL_top','HS_top','HF_top'];
    const minMap = data.MIN_FRONT_HEIGHT_BY_KIND_MM || {};
    const maxMap = data.MAX_FRONT_HEIGHT_BY_KIND_MM || {};
    return order.map((kind)=>{
      const minH = minMap[kind] || 0;
      const maxH = maxMap[kind] || 0;
      const minTxt = minH ? `${minH}` : '—';
      const maxTxt = maxH ? `${maxH}` : '—';
      const ok = kh ? ((minH ? kh >= minH : true) && (maxH ? kh <= maxH : true)) : false;
      return `${getLabel(kind)} (${minTxt}–${maxTxt} mm)${kh ? (ok ? ' – pasuje' : ' – nie pasuje') : ''}`;
    });
  }

  function validateSize(kind, label, khMm, widthMm, depthMm){
    const maxH = (data.MAX_FRONT_HEIGHT_BY_KIND_MM || {})[kind] || 0;
    const minH = (data.MIN_FRONT_HEIGHT_BY_KIND_MM || {})[kind] || 0;
    const maxW = (data.MAX_FRONT_WIDTH_BY_KIND_MM || {})[kind] || 0;
    const minW = (data.MIN_FRONT_WIDTH_BY_KIND_MM || {})[kind] || 0;
    const minD = (data.MIN_INTERNAL_DEPTH_BY_KIND_MM || {})[kind] || 0;
    const recD = (data.REC_INTERNAL_DEPTH_BY_KIND_MM || {})[kind] || 0;

    if(maxH && khMm > maxH){
      let message = `Za wysoki front: wysokość korpusu ${khMm} mm (dla ${label} max ${maxH} mm).`;
      const sug = suggestKindsForHeight(khMm).filter(x=>x!==label);
      if(sug.length) message += ` Pasujące rodzaje dla tej wysokości: ${sug.join(', ')}.`;
      return { status:'out_height', message, messageTone:'red' };
    }
    if(minH && khMm > 0 && khMm < minH){
      let message = `Za niski front: wysokość korpusu ${khMm} mm (dla ${label} min ${minH} mm).`;
      const sug = suggestKindsForHeight(khMm).filter(x=>x!==label);
      if(sug.length) message += ` Pasujące rodzaje dla tej wysokości: ${sug.join(', ')}.`;
      return { status:'out_height', message, messageTone:'red' };
    }
    if(maxW && widthMm > maxW){
      let message = `Za szeroki front: szerokość korpusu ${widthMm} mm (dla ${label} max ${maxW} mm).`;
      const sug = suggestKindsForWidth(widthMm).filter(x=>x!==label);
      if(sug.length) message += ` Pasujące rodzaje dla tej szerokości: ${sug.join(', ')}.`;
      return { status:'out_width', message, messageTone:'red' };
    }
    if(minW && widthMm > 0 && widthMm < minW){
      let message = `Za wąski front: szerokość korpusu ${widthMm} mm (dla ${label} min ${minW} mm).`;
      const sug = suggestKindsForWidth(widthMm).filter(x=>x!==label);
      if(sug.length) message += ` Pasujące rodzaje dla tej szerokości: ${sug.join(', ')}.`;
      return { status:'out_width', message, messageTone:'red' };
    }
    if(minD && depthMm > 0 && depthMm < minD){
      let message = `Za płytki korpus: głębokość ${depthMm} mm (dla ${label} min ${minD} mm).`;
      const sug = suggestKindsForDepth(depthMm).filter(x=>x!==label);
      if(sug.length) message += ` Pasujące rodzaje dla tej głębokości: ${sug.join(', ')}.`;
      return { status:'out_depth', message, messageTone:'red' };
    }

    let depthAdvisory = '';
    let depthAdvisoryTone = '';
    if(kind === 'HK-XS' && recD && depthMm > 0 && depthMm < recD){
      depthAdvisoryTone = 'orange';
      depthAdvisory = `HK‑XS: katalogowo można zejść do LT≥${minD} mm (specyficzna pozycja montażu), ale warsztatowo bezpieczniej przyjąć ≥${recD} mm (mniej kolizji, łatwiejszy montaż).`;
    }
    return { status:'ok', message:'', messageTone:'', depthAdvisory, depthAdvisoryTone };
  }

  function createBaseResult(kind, label, pf, liftQty, hkxsHinges){
    return {
      kind,
      label,
      powerFactor: pf,
      model: '',
      rangeStr: '',
      strength: '',
      liftQty,
      hkxsHinges,
      status: 'ok',
      message: '',
      messageTone: '',
      neededLiftQty: 0
    };
  }

  function applyRangePick(result, kind, ranges, labelForMore){
    const picked = pickByRange(ranges, result.powerFactor);
    if(picked){
      result.model = picked.model;
      result.rangeMin = picked.min;
      result.rangeMax = picked.max;
      result.strength = picked.strength;
      return result;
    }

    result.status = result.status === 'out_height' ? result.status : 'out_pf';
    result.messageTone = result.messageTone || 'red';
    const max2 = ranges[ranges.length - 1].max;
    const more = allowMoreLiftsIfPossible(result.powerFactor, max2);
    if(more.ok){
      result.status = result.status === 'out_height' ? result.status : 'needs_more_lifts';
      result.messageTone = 'orange';
      result.liftQty = more.qty;
      const strongest = ranges[ranges.length - 1];
      result.model = strongest.model;
      result.rangeMin = strongest.min;
      result.rangeMax = max2;
      result.strength = strongest.strength;
      result.message = `Wymagana większa liczba podnośników: przyjęto ${result.liftQty} szt. (na bazie najmocniejszego ${labelForMore}).`;
    }else{
      result.neededLiftQty = more.need;
      result.message = `Poza zakresem współczynnika mocy: ${result.powerFactor} (max ${max2} dla 2 szt.).`;
    }
    return result;
  }

  function applyHkXs(result){
    const ranges = data.HKXS_RANGES || [];
    const maxPer = ranges.length ? ranges[ranges.length - 1].max : 0;
    const minPer = ranges.length ? ranges[0].min : 0;

    function pickForPer(pfPer){
      return ranges.find(r => pfPer >= r.min && pfPer <= r.max) || null;
    }

    let picked = null;
    let pickedQty = 0;

    if(result.powerFactor < minPer){
      result.status = result.status === 'out_height' ? result.status : 'out_pf';
      result.messageTone = result.messageTone || 'red';
      result.message = result.message || `Poza zakresem współczynnika mocy: ${result.powerFactor} (min ${minPer}). Front zbyt lekki dla HK‑XS.`;
      result.neededLiftQty = 0;
    }else{
      for(const qty of [1, 2]){
        const pfPer = Math.ceil(result.powerFactor / qty);
        const current = pickForPer(pfPer);
        if(current){
          picked = current;
          pickedQty = qty;
          break;
        }
      }
      if(!picked){
        result.status = result.status === 'out_height' ? result.status : 'out_pf';
        result.messageTone = 'red';
        result.neededLiftQty = 2;
        result.message = `Poza zakresem współczynnika mocy dla HK‑XS nawet przy montażu obustronnym (HK‑XS przewiduje maks. 2 mechanizmy): ${result.powerFactor} (max ${maxPer} na mechanizm, razem max ${maxPer*2}). Rozważ zmianę na HK top / HK‑S (tam można dobrać większą liczbę podnośników).`;
      }else{
        result.liftQty = pickedQty;
        if(pickedQty === 2 && (!result.message || result.messageTone !== 'red')){
          result.status = result.status || 'ok';
          result.messageTone = result.messageTone || 'green';
          result.message = result.message || `Dla tej klapy zalecany montaż obustronny (2 mechanizmy) – współczynnik mocy LF podwaja się.`;
        }
      }
    }

    if(picked){
      result.model = picked.model;
      result.rangeMin = picked.min;
      result.rangeMax = picked.max;
      result.strength = picked.strength;
    }
    return result;
  }

  function applyHsTop(result, khMm, fgKg){
    const row = (data.HSTOP_TABLE || []).find(r => khMm >= r.khMin && khMm <= r.khMax) || null;
    if(!row){
      result.status = result.status === 'out_height' ? result.status : 'out_pf';
      result.messageTone = result.messageTone || 'red';
      result.message = result.message || `Poza zakresem wysokości dla HS top: KH=${khMm} mm.`;
      return result;
    }
    const t = (khMm - row.khMin) / (row.khMax - row.khMin);
    const wMin = row.wMin0 + (row.wMin1 - row.wMin0) * t;
    const wMax = row.wMax0 + (row.wMax1 - row.wMax0) * t;
    if(fgKg < wMin || fgKg > wMax){
      result.status = result.status === 'out_height' ? result.status : 'out_pf';
      result.messageTone = result.messageTone || 'red';
      result.message = result.message || `Poza zakresem wagi frontu dla HS top (${row.model}) przy KH=${khMm} mm: waga ${fgKg.toFixed(2)} kg (dopuszczalne ok. ${wMin.toFixed(2)}–${wMax.toFixed(2)} kg).`;
      return result;
    }
    result.model = row.model;
    result.strength = row.strength;
    result.rangeStr = `${wMin.toFixed(2)}–${wMax.toFixed(2)} kg (dla KH=${khMm} mm)`;
    return result;
  }

  function applyHlTop(result, khMm, fgKg){
    const row = (data.HLTOP_TABLE || []).find(r => khMm >= r.khMin && khMm <= r.khMax) || null;
    if(!row){
      result.status = result.status === 'out_height' ? result.status : 'out_pf';
      result.messageTone = result.messageTone || 'red';
      result.message = result.message || `Poza zakresem wysokości dla HL top: KH=${khMm} mm.`;
      return result;
    }
    if(fgKg < row.wMin || fgKg > row.wMax){
      result.status = result.status === 'out_height' ? result.status : 'out_pf';
      result.messageTone = result.messageTone || 'red';
      result.message = result.message || `Poza zakresem wagi frontu dla HL top (${row.model}) przy KH=${khMm} mm: waga ${fgKg.toFixed(2)} kg (dopuszczalne ${row.wMin}–${row.wMax} kg).`;
      return result;
    }
    result.model = row.model;
    result.strength = row.strength;
    result.rangeStr = `${row.wMin}–${row.wMax} kg`;
    return result;
  }

  function finalizeResult(result, validation){
    result.rangeStr = result.rangeStr || ((result.rangeMin && result.rangeMax) ? `${result.rangeMin}–${result.rangeMax}` : '');
    if(validation && validation.depthAdvisory){
      if(result.message){
        result.message = `${result.message} ${validation.depthAdvisory}`;
        if(!result.messageTone) result.messageTone = validation.depthAdvisoryTone || 'orange';
      }else{
        result.message = validation.depthAdvisory;
        result.messageTone = validation.depthAdvisoryTone || 'orange';
      }
    }
    delete result.rangeMin;
    delete result.rangeMax;
    return result;
  }

  function getBlumAventosInfo(cab, room){
    const d = (cab && cab.details) ? cab.details : {};
    const vendor = String(d.flapVendor || 'blum');
    if(vendor !== 'blum') return null;

    const kind = String(d.flapKind || 'HK-XS');
    const label = getLabel(kind);
    const khMm = Math.max(0, Number(cab && cab.height) || 0) * 10;
    const pf = blumAventosPowerFactor(cab, room);
    const widthMm = Math.round((Number(cab && cab.width) || 0) * 10);
    const depthMm = Math.round((Number(cab && cab.depth) || 0) * 10);

    let liftQty = kind === 'HK-XS' ? 1 : 2;
    let hkxsHinges = 0;
    if(kind === 'HK-XS'){
      hkxsHinges = 2;
      if(widthMm >= 900 || pf >= 1800) hkxsHinges = 3;
      if(widthMm >= 1200 || pf >= 2700) hkxsHinges = 4;
    }

    const result = createBaseResult(kind, label, pf, liftQty, hkxsHinges);
    if(kind === 'HK-XS' && hkxsHinges === 4 && (widthMm > 1200 || pf > 2700)){
      result.messageTone = result.messageTone || 'orange';
      result.message = result.message || `HK‑XS: zalecane min. 4 zawiasy (KB≥1200 mm lub LF≥2700). Przy bardzo szerokich frontach możesz dać więcej zawiasów dla sztywności.`;
    }

    const validation = validateSize(kind, label, khMm, widthMm, depthMm);
    if(validation.status !== 'ok'){
      return {
        kind,
        label,
        status: validation.status,
        message: validation.message,
        messageTone: validation.messageTone || 'red',
        powerFactor: pf,
        liftQty,
        hkxsHinges
      };
    }

    const fgKg = estimateFlapWeightKg(cab, room);
    if(kind === 'HK-XS') applyHkXs(result);
    else if(kind === 'HK_top') applyRangePick(result, kind, data.HKTOP_RANGES || [], 'HK top');
    else if(kind === 'HK-S') applyRangePick(result, kind, data.HKS_RANGES || [], 'HK‑S');
    else if(kind === 'HF_top') applyRangePick(result, kind, data.HFTOP_RANGES || [], 'HF top');
    else if(kind === 'HKI') applyRangePick(result, kind, data.HKI_RANGES || [], 'HKi');
    else if(kind === 'HS_top') applyHsTop(result, khMm, fgKg);
    else if(kind === 'HL_top') applyHlTop(result, khMm, fgKg);

    return finalizeResult(result, validation);
  }

  ns.frontHardwareAventosSelector = {
    suggestKindsForDepth,
    suggestKindsForWidth,
    suggestKindsForHeight,
    listAllKindsHeightInfo,
    validateSize,
    getBlumAventosInfo
  };
})();
