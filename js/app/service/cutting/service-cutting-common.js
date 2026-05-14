(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function normalizeText(value){ return String(value == null ? '' : value).trim(); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return null; } }
  function uid(){ try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('svc_' + Date.now()); }catch(_){ return 'svc_' + Date.now(); } }

  function getCatalogMaterials(){
    try{
      if(FC.catalogSelectors && typeof FC.catalogSelectors.getSheetMaterials === 'function') return FC.catalogSelectors.getSheetMaterials() || [];
      if(FC.catalogStore && typeof FC.catalogStore.getSheetMaterials === 'function') return FC.catalogStore.getSheetMaterials() || [];
    }catch(_){ }
    return [];
  }

  function normalizePart(part, index){
    const src = part && typeof part === 'object' ? part : {};
    return {
      id: normalizeText(src.id) || uid(),
      name: normalizeText(src.name) || `Formatka ${Number(index || 0) + 1}`,
      qty: Math.max(1, Number(src.qty) || 1),
      along: Math.max(0, Number(src.along) || 0),
      across: Math.max(0, Number(src.across) || 0),
      edgesAlong: Math.max(0, Math.min(2, Number(src.edgesAlong) || 0)),
      edgesAcross: Math.max(0, Math.min(2, Number(src.edgesAcross) || 0)),
      thickness: Math.max(0, Number(src.thickness) || 0),
      materialId: normalizeText(src.materialId),
      materialName: normalizeText(src.materialName),
      materialSymbol: normalizeText(src.materialSymbol),
      hasGrain: !!src.hasGrain,
      source: normalizeText(src.source),
    };
  }

  function normalizeDraft(input){
    const src = input && typeof input === 'object' ? input : {};
    return {
      enabled: src.enabled !== false,
      materialMode: normalizeText(src.materialMode || 'catalog') === 'client' ? 'client' : 'catalog',
      materialId: normalizeText(src.materialId),
      materialName: normalizeText(src.materialName),
      boardW: Math.max(0, Number(src.boardW) || 2800),
      boardH: Math.max(0, Number(src.boardH) || 2070),
      unit: normalizeText(src.unit || 'mm') === 'cm' ? 'cm' : 'mm',
      kerf: Math.max(0, Number(src.kerf) || 4),
      edgeTrim: Math.max(0, Number(src.edgeTrim) || 10),
      parts: Array.isArray(src.parts) ? src.parts.map(normalizePart).filter(Boolean) : [],
      plan: src.plan && typeof src.plan === 'object' ? clone(src.plan) : null,
      generatedAt: Number(src.generatedAt) > 0 ? Number(src.generatedAt) : 0,
    };
  }

  function resolveMaterialMeta(draft, override){
    const normalized = normalizeDraft(draft);
    if(override && typeof override === 'object'){
      const list = getCatalogMaterials();
      const byId = normalizeText(override.materialId) ? list.find((item)=> String(item && item.id || '') === String(override.materialId)) : null;
      const bySymbol = normalizeText(override.materialSymbol) ? list.find((item)=> normalizeText(item && item.symbol).toLowerCase() === normalizeText(override.materialSymbol).toLowerCase()) : null;
      const byName = normalizeText(override.materialName) ? list.find((item)=> normalizeText(item && item.name).toLowerCase() === normalizeText(override.materialName).toLowerCase()) : null;
      const row = byId || bySymbol || byName || null;
      if(row || normalizeText(override.materialName || override.materialSymbol)){
        return {
          id: normalizeText(row && row.id) || normalizeText(override.materialId),
          name: normalizeText(row && row.name) || normalizeText(override.materialName || override.materialSymbol) || 'Materiał z importu',
          symbol: normalizeText(row && row.symbol) || normalizeText(override.materialSymbol),
          boardW: Math.max(0, Number(row && (row.sheetWidth || row.width || row.boardW)) || normalized.boardW || 2800),
          boardH: Math.max(0, Number(row && (row.sheetHeight || row.height || row.boardH)) || normalized.boardH || 2070),
          hasGrain: !!(row ? row.hasGrain : override.hasGrain),
          thickness: Math.max(0, Number(override.thickness) || 0),
        };
      }
    }
    if(normalized.materialMode === 'client'){
      return {
        id:'client_material',
        name: normalized.materialName || 'Materiał klienta',
        boardW: normalized.boardW,
        boardH: normalized.boardH,
      };
    }
    const list = getCatalogMaterials();
    const row = list.find((item)=> String(item && item.id || '') === String(normalized.materialId || ''))
      || list.find((item)=> normalizeText(item && item.name).toLowerCase() === normalizeText(normalized.materialName).toLowerCase())
      || null;
    return {
      id: normalizeText(row && row.id) || normalized.materialId,
      name: normalizeText(row && row.name) || normalized.materialName || 'Materiał z cennika',
      boardW: Math.max(0, Number(row && (row.sheetWidth || row.width || row.boardW)) || normalized.boardW || 2800),
      boardH: Math.max(0, Number(row && (row.sheetHeight || row.height || row.boardH)) || normalized.boardH || 2070),
      hasGrain: !!(row && row.hasGrain),
      thickness: 0,
    };
  }

  function partMaterialKey(part, draft){
    const row = normalizePart(part || {}, 0);
    const base = normalizeText(row.materialId || row.materialName || row.materialSymbol || (draft && draft.materialId) || (draft && draft.materialName) || 'material');
    const thickness = Number(row.thickness) || 0;
    return `${base.toLowerCase()}|${thickness}`;
  }

  function groupPartsByMaterial(draft){
    const normalized = normalizeDraft(draft);
    const map = new Map();
    normalized.parts.forEach((part)=>{
      const key = partMaterialKey(part, normalized);
      const meta = resolveMaterialMeta(normalized, part);
      const finalKey = `${normalizeText(meta.id || meta.name || key).toLowerCase()}|${Number(part.thickness) || Number(meta.thickness) || 0}`;
      if(!map.has(finalKey)) map.set(finalKey, { key:finalKey, materialMeta:Object.assign({}, meta, { thickness:Number(part.thickness) || Number(meta.thickness) || 0 }), parts:[] });
      map.get(finalKey).parts.push(part);
    });
    return Array.from(map.values());
  }

  function buildEdgeStore(parts){
    const out = {};
    (Array.isArray(parts) ? parts : []).forEach((part, index)=>{
      const row = normalizePart(part, index);
      out[row.id] = {
        w1: row.edgesAlong >= 1,
        w2: row.edgesAlong >= 2,
        h1: row.edgesAcross >= 1,
        h2: row.edgesAcross >= 2,
      };
    });
    return out;
  }

  function buildPlanParts(parts, materialName){
    return (Array.isArray(parts) ? parts : []).map((part, index)=>{
      const row = normalizePart(part, index);
      return {
        key: row.id,
        id: row.id,
        name: row.name,
        qty: row.qty,
        w: row.along,
        h: row.across,
        material: row.materialName || materialName || 'Materiał klienta',
        thickness: row.thickness,
        sourceSig: row.source || '',
      };
    }).filter((row)=> Number(row.w) > 0 && Number(row.h) > 0 && Number(row.qty) > 0);
  }

  FC.serviceCuttingCommon = {
    getCatalogMaterials,
    normalizeDraft,
    normalizePart,
    resolveMaterialMeta,
    buildEdgeStore,
    buildPlanParts,
    groupPartsByMaterial,
    partMaterialKey,
  };
})();
