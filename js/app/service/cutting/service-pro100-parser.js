// Parser i normalizacja wklejki formatek z PRO100 dla drobnych usług stolarskich.
(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;

  function text(value){ return String(value == null ? '' : value).trim(); }
  function num(value){
    const raw = text(value).replace(/\s+/g, '').replace(',', '.');
    if(!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  function tokenEdge(value){
    const raw = text(value).replace(/[–—−]/g, '-');
    if(raw === '=') return 2;
    if(raw === '-') return 1;
    return 0;
  }
  function uid(prefix){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : `${prefix || 'pro100'}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
    catch(_){ return `${prefix || 'pro100'}_${Date.now()}`; }
  }
  function splitDelimited(line){
    const raw = String(line == null ? '' : line).replace(/\r/g, '');
    if(raw.indexOf('\t') >= 0) return raw.split('\t').map(text);
    if(raw.indexOf(';') >= 0) return raw.split(';').map(text);
    if(raw.indexOf('|') >= 0) return raw.split('|').map(text);
    return [];
  }
  function splitLoose(line){
    const raw = String(line == null ? '' : line).replace(/\r/g, '').trim();
    if(!raw) return [];
    const m = raw.match(/^(.+?)\s+([0-9]+(?:[,.][0-9]+)?)\s*(=|-|–|—|−)?\s+([0-9]+(?:[,.][0-9]+)?)\s*(=|-|–|—|−)?\s+([0-9]+(?:[,.][0-9]+)?)\s+([0-9]+(?:[,.][0-9]+)?)\s+(.+)$/);
    if(!m) return [];
    return [m[1], m[2], m[3] || '', m[4], m[5] || '', m[6], m[7], m[8]];
  }
  function readColumns(line){
    const delimited = splitDelimited(line).filter((col, idx, arr)=> idx < arr.length - 1 || col !== '');
    if(delimited.length >= 8) return delimited;
    return splitLoose(line);
  }
  function makeMaterialKey(symbol, thickness){
    return `${text(symbol).toLowerCase()}|${text(thickness).toLowerCase()}`;
  }
  function isLikelyHeader(cols){
    const list = (Array.isArray(cols) ? cols : []).map((col)=> text(col).toLowerCase());
    if(!list.length) return false;
    const joined = list.join(' ');
    const hasName = /nazwa|format/.test(joined);
    const hasDim = /dług|dlug|szer|wymiar/.test(joined);
    const hasMaterial = /kolor|dekor|materiał|material/.test(joined);
    return !!(hasName && (hasDim || hasMaterial));
  }
  function parseColumns(cols, sourceLine, raw){
    const input = Array.isArray(cols) ? cols : [];
    if(input.length < 8){
      return { ok:false, sourceLine, raw:String(raw || ''), warning:'Nie rozpoznano 8 kolumn PRO100.' };
    }
    if(isLikelyHeader(input)) return { ok:false, skip:true, sourceLine, raw:String(raw || input.join('\t')), warning:'Pominięto nagłówek.' };
    const name = text(input[0]);
    const along = num(input[1]);
    const edgesAlong = tokenEdge(input[2]);
    const across = num(input[3]);
    const edgesAcross = tokenEdge(input[4]);
    const thickness = num(input[5]);
    const qty = Math.max(1, Math.round(num(input[6]) || 1));
    const materialSymbol = text(input.slice(7).join(' '));
    const row = {
      id: uid('pro100_part'),
      sourceLine,
      name,
      along,
      across,
      edgesAlong,
      edgesAcross,
      thickness,
      qty,
      materialSymbol,
      materialKey:makeMaterialKey(materialSymbol, thickness),
      source:'pro100',
    };
    const missing = [];
    if(!name) missing.push('nazwa');
    if(!(along > 0)) missing.push('długość');
    if(!(across > 0)) missing.push('szerokość');
    if(!(thickness > 0)) missing.push('grubość');
    if(!materialSymbol) missing.push('kolor');
    if(missing.length) return { ok:false, sourceLine, raw:String(raw || input.join('\t')), warning:`Braki: ${missing.join(', ')}.`, row };
    return { ok:true, row };
  }
  function parseLine(line, sourceLine){
    return parseColumns(readColumns(line), sourceLine, String(line || ''));
  }
  function summarize(rows){
    const parsed = Array.isArray(rows) ? rows : [];
    const totalQty = parsed.reduce((sum, row)=> sum + (Number(row.qty) || 0), 0);
    const edgeMm = parsed.reduce((sum, row)=> sum + ((Number(row.edgesAlong) || 0) * (Number(row.along) || 0) + (Number(row.edgesAcross) || 0) * (Number(row.across) || 0)) * (Number(row.qty) || 0), 0);
    const cutMm = parsed.reduce((sum, row)=> sum + (2 * ((Number(row.along) || 0) + (Number(row.across) || 0))) * (Number(row.qty) || 0), 0);
    const areaMm2 = parsed.reduce((sum, row)=> sum + (Number(row.along) || 0) * (Number(row.across) || 0) * (Number(row.qty) || 0), 0);
    const materialMap = new Map();
    parsed.forEach((row)=>{
      const key = row.materialKey || makeMaterialKey(row.materialSymbol, row.thickness);
      if(!materialMap.has(key)) materialMap.set(key, { key, symbol:row.materialSymbol, thickness:row.thickness, rows:0, qty:0, areaMm2:0, edgeMm:0 });
      const bucket = materialMap.get(key);
      bucket.rows += 1;
      bucket.qty += Number(row.qty) || 0;
      bucket.areaMm2 += (Number(row.along) || 0) * (Number(row.across) || 0) * (Number(row.qty) || 0);
      bucket.edgeMm += ((Number(row.edgesAlong) || 0) * (Number(row.along) || 0) + (Number(row.edgesAcross) || 0) * (Number(row.across) || 0)) * (Number(row.qty) || 0);
    });
    return {
      rows: parsed.length,
      totalQty,
      edgeMeters: Math.round((edgeMm / 1000) * 100) / 100,
      cutMeters: Math.round((cutMm / 1000) * 100) / 100,
      areaM2: Math.round((areaMm2 / 1000000) * 1000) / 1000,
      materials:Array.from(materialMap.values()).map((row)=> Object.assign({}, row, {
        edgeMeters:Math.round((row.edgeMm / 1000) * 100) / 100,
        areaM2:Math.round((row.areaMm2 / 1000000) * 1000) / 1000,
      })),
    };
  }
  function parse(textareaValue){
    const lines = String(textareaValue == null ? '' : textareaValue).split(/\n/);
    const rows = [];
    const warnings = [];
    lines.forEach((line, index)=>{
      if(!String(line || '').trim()) return;
      const result = parseLine(line, index + 1);
      if(result.ok) rows.push(result.row);
      else if(!result.skip) warnings.push({ line:index + 1, message:result.warning, raw:result.raw, row:result.row || null });
    });
    return { ok:rows.length > 0, rows, warnings, summary:summarize(rows) };
  }
  function parseRows(rowArrays){
    const rows = [];
    const warnings = [];
    (Array.isArray(rowArrays) ? rowArrays : []).forEach((input, index)=>{
      const cols = Array.isArray(input) ? input : [input];
      const isEmpty = cols.every((col)=> !text(col));
      if(isEmpty) return;
      const result = parseColumns(cols, index + 1, cols.map(text).join('\t'));
      if(result.ok) rows.push(result.row);
      else if(!result.skip) warnings.push({ line:index + 1, message:result.warning, raw:result.raw, row:result.row || null });
    });
    return { ok:rows.length > 0, rows, warnings, summary:summarize(rows) };
  }

  FC.servicePro100Parser = {
    parse,
    parseRows,
    parseLine,
    parseColumns,
    summarize,
    tokenEdge,
    makeMaterialKey,
  };
})();
