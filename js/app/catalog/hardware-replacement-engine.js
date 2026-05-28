// js/app/catalog/hardware-replacement-engine.js
// Czysty silnik podglądu zamienników okuć: bez UI, bez storage, bez zapisu zmian w projekcie.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function scalarValue(value, depth){
    if(value == null) return '';
    if(depth > 4) return '';
    if(typeof value === 'string') return value === '[object Object]' ? '' : value;
    if(typeof value === 'number' || typeof value === 'boolean') return value;
    if(Array.isArray(value)) return value.map((item)=> text(item)).filter(Boolean).join('; ');
    if(value && typeof value === 'object'){
      const keys = ['value','label','name','text','title','id','key'];
      for(let i = 0; i < keys.length; i += 1){
        if(Object.prototype.hasOwnProperty.call(value, keys[i])){
          const resolved = scalarValue(value[keys[i]], (depth || 0) + 1);
          if(text(resolved)) return resolved;
        }
      }
      return '';
    }
    return '';
  }
  function text(value){ return String(scalarValue(value, 0)).trim(); }
  function lower(value){ return text(value).toLowerCase(); }
  function number(value){ const n = Number(text(value).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function sameText(a, b){ return lower(a) === lower(b); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }

  function techApi(){ return FC.hardwareTechnicalParams || null; }
  function catalogApi(){ return FC.hardwareCatalog || null; }
  function normalizeDefinitions(definitions){
    const tech = techApi();
    if(tech && typeof tech.normalizeDefinitions === 'function') return tech.normalizeDefinitions(definitions || tech.DEFAULT_DEFINITIONS || []);
    return Array.isArray(definitions) ? definitions.slice() : [];
  }
  function fieldsForCategory(definitions, category){
    const tech = techApi();
    if(tech && typeof tech.fieldsForCategory === 'function') return tech.fieldsForCategory(definitions, category);
    const cat = text(category);
    return normalizeDefinitions(definitions).filter((row)=> row && row.active !== false && text(row.category) === cat);
  }
  function normalizeParamValues(values, definitions, category){
    const tech = techApi();
    if(tech && typeof tech.normalizeParamValues === 'function') return tech.normalizeParamValues(values || {}, definitions, category);
    return values && typeof values === 'object' ? clone(values) : {};
  }
  function paramValueText(field, value){
    const tech = techApi();
    if(tech && typeof tech.paramValueText === 'function') return tech.paramValueText(field, value, { withUnit:true });
    if(!value || typeof value !== 'object') return text(value);
    if(field && field.fieldType === 'numberRange'){
      const from = text(value.from);
      const to = text(value.to);
      const unit = text(field.unit);
      if(from && to) return `${from}–${to}${unit}`;
      if(from) return `${from}${unit}`;
      return '';
    }
    if(field && field.fieldType === 'boolean') return value.value ? 'tak' : 'nie';
    return text(value.value);
  }
  function compareParam(field, source, candidate){
    const tech = techApi();
    if(tech && typeof tech.compareParam === 'function') return tech.compareParam(field, source, candidate);
    return lower(source && source.value) === lower(candidate && candidate.value);
  }

  function normalizeItem(item, options){
    const source = item && typeof item === 'object' ? item : {};
    const cfg = options || {};
    const hw = catalogApi();
    const definitions = normalizeDefinitions(cfg.definitions || cfg.hardwareTechnicalParams);
    let normalized = source;
    if(hw && typeof hw.normalizeAccessory === 'function'){
      normalized = hw.normalizeAccessory(source, ()=> text(source.id) || 'replacement_preview_item', {
        defaultVatRate:number(cfg.defaultVatRate) || 23,
        hardwareSuppliers:Array.isArray(cfg.suppliers) ? cfg.suppliers : [],
        hardwareTechnicalParams:definitions,
      });
    }
    const category = text(normalized.hardwareCategory || normalized.category || source.hardwareCategory || source.category);
    const params = normalizeParamValues(normalized.technicalParams || source.technicalParams || {}, definitions, category);
    return Object.assign({}, normalized, { hardwareCategory:category, technicalParams:params });
  }

  function quotePriceInfo(item){
    const hw = catalogApi();
    const prices = Array.isArray(item && item.supplierPrices) ? item.supplierPrices : [];
    const quote = hw && typeof hw.getQuoteSupplierPrice === 'function'
      ? hw.getQuoteSupplierPrice(prices)
      : (prices.find((row)=> row && row.useForQuote) || prices[0] || null);
    const hasPrice = !!(quote && (number(quote.catalogPriceGross) > 0 || number(quote.catalogPriceNet) > 0 || number(item && item.price) > 0));
    return {
      hasPrice,
      supplierId:text(quote && quote.supplierId),
      catalogPriceGross:number(quote && quote.catalogPriceGross),
      catalogPriceNet:number(quote && quote.catalogPriceNet),
      quotePriceGross:number(item && item.price),
      priceStatus:text((quote && quote.priceStatus) || (item && item.priceStatus)),
    };
  }

  function reason(type, code, message, extra){
    return Object.assign({ type, code, message }, extra || {});
  }

  function compareItems(sourceItem, candidateItem, options){
    const cfg = Object.assign({ requireQuotePrice:false, excludeSameId:true, includeIgnored:false }, options || {});
    const definitions = normalizeDefinitions(cfg.definitions || cfg.hardwareTechnicalParams);
    const source = normalizeItem(sourceItem, Object.assign({}, cfg, { definitions }));
    const candidate = normalizeItem(candidateItem, Object.assign({}, cfg, { definitions }));
    const reasons = [];
    const checks = [];

    if(!text(source.id) && !text(source.name)) reasons.push(reason('fail', 'missing_source', 'Brak okucia źródłowego.'));
    if(!text(candidate.id) && !text(candidate.name)) reasons.push(reason('fail', 'missing_candidate', 'Brak kandydata na zamiennik.'));
    if(cfg.excludeSameId !== false && text(source.id) && text(source.id) === text(candidate.id)) reasons.push(reason('fail', 'same_item', 'To jest to samo okucie, więc nie jest zamiennikiem.'));
    if(text(candidate.status) && !sameText(candidate.status, 'active')) reasons.push(reason('fail', 'inactive_candidate', 'Kandydat nie jest aktywną pozycją katalogu.', { status:text(candidate.status) }));
    if(text(source.hardwareCategory) !== text(candidate.hardwareCategory)){
      reasons.push(reason('fail', 'category_mismatch', 'Inna kategoria okucia.', { source:text(source.hardwareCategory), candidate:text(candidate.hardwareCategory) }));
    }
    if(text(cfg.targetManufacturer) && !sameText(candidate.manufacturer, cfg.targetManufacturer)){
      reasons.push(reason('fail', 'target_manufacturer_mismatch', 'Kandydat nie jest od wskazanego producenta.', { expected:text(cfg.targetManufacturer), candidate:text(candidate.manufacturer) }));
    }
    if(cfg.excludeSourceManufacturer === true && text(source.manufacturer) && sameText(source.manufacturer, candidate.manufacturer)){
      reasons.push(reason('fail', 'same_manufacturer', 'Kandydat jest od tego samego producenta co okucie źródłowe.', { manufacturer:text(candidate.manufacturer) }));
    }

    if(text(source.hardwareCategory) && text(source.hardwareCategory) === text(candidate.hardwareCategory)){
      fieldsForCategory(definitions, source.hardwareCategory)
        .filter((field)=> field && field.active !== false && field.keyFeature !== false)
        .filter((field)=> cfg.includeIgnored || field.compareMode !== 'ignore')
        .forEach((field)=>{
          const sourceValue = source.technicalParams && source.technicalParams[field.key];
          const candidateValue = candidate.technicalParams && candidate.technicalParams[field.key];
          const sourceLabel = paramValueText(field, sourceValue);
          const candidateLabel = paramValueText(field, candidateValue);
          const ok = compareParam(field, sourceValue, candidateValue);
          const check = {
            key:field.key,
            label:text(field.label || field.key),
            compareMode:text(field.compareMode || 'equal'),
            ok:!!ok,
            sourceValue:sourceLabel,
            candidateValue:candidateLabel,
          };
          checks.push(check);
          if(ok){
            reasons.push(reason('pass', 'param_match', `Parametr „${check.label}” pasuje.`, check));
          }else{
            const missingCode = sourceLabel && !candidateLabel ? 'candidate_param_missing' : (!sourceLabel && candidateLabel ? 'source_param_missing' : 'param_mismatch');
            reasons.push(reason('fail', missingCode, `Parametr „${check.label}” nie pasuje.`, check));
          }
        });
    }

    const quote = quotePriceInfo(candidate);
    if(!quote.hasPrice){
      reasons.push(reason(cfg.requireQuotePrice ? 'fail' : 'warn', 'no_quote_price', 'Kandydat nie ma aktywnej ceny dostawcy do wyceny.', quote));
    }else{
      reasons.push(reason('pass', 'quote_price_available', 'Kandydat ma cenę dostawcy do wyceny.', quote));
    }

    const failures = reasons.filter((row)=> row.type === 'fail');
    const warnings = reasons.filter((row)=> row.type === 'warn');
    const passedChecks = checks.filter((row)=> row.ok).length;
    const requiredChecks = checks.length;
    const compatible = failures.length === 0;
    const scoreBase = requiredChecks ? Math.round((passedChecks / requiredChecks) * 100) : (compatible ? 100 : 0);
    const score = compatible ? Math.max(0, Math.min(100, scoreBase - warnings.length * 5)) : Math.max(0, Math.min(99, scoreBase));

    return {
      compatible,
      passed:compatible,
      score,
      sourceId:text(source.id),
      candidateId:text(candidate.id),
      source:{ id:text(source.id), name:text(source.name), manufacturer:text(source.manufacturer), category:text(source.hardwareCategory), type:text(source.hardwareType) },
      candidate:{ id:text(candidate.id), name:text(candidate.name), manufacturer:text(candidate.manufacturer), category:text(candidate.hardwareCategory), type:text(candidate.hardwareType) },
      checks,
      reasons,
      failures,
      warnings,
      quote,
    };
  }

  function sortResult(a, b){
    if(!!a.compatible !== !!b.compatible) return a.compatible ? -1 : 1;
    if(Number(a.score) !== Number(b.score)) return Number(b.score) - Number(a.score);
    if(!!(a.quote && a.quote.hasPrice) !== !!(b.quote && b.quote.hasPrice)) return a.quote && a.quote.hasPrice ? -1 : 1;
    const ap = Number((a.quote && (a.quote.quotePriceGross || a.quote.catalogPriceGross)) || 0);
    const bp = Number((b.quote && (b.quote.quotePriceGross || b.quote.catalogPriceGross)) || 0);
    if(ap > 0 && bp > 0 && ap !== bp) return ap - bp;
    return text(a.candidate && a.candidate.name).localeCompare(text(b.candidate && b.candidate.name), 'pl');
  }

  function findCandidates(sourceItem, candidates, options){
    const rows = Array.isArray(candidates) ? candidates : [];
    return rows.map((candidate)=> compareItems(sourceItem, candidate, options)).sort(sortResult);
  }

  function summarizeResult(result){
    const row = result || {};
    if(row.compatible) return `Pasuje (${Number(row.score) || 0}/100): ${text(row.candidate && row.candidate.name) || text(row.candidateId)}`;
    const first = Array.isArray(row.failures) && row.failures[0] ? row.failures[0].message : 'Brak zgodności.';
    return `Odpada: ${first}`;
  }

  FC.hardwareReplacementEngine = {
    normalizeItem,
    quotePriceInfo,
    compareItems,
    findCandidates,
    previewCandidates:findCandidates,
    summarizeResult,
  };
})();
