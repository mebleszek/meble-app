// js/app/shared/xlsx-lite.js
// Minimalny zapis/odczyt XLSX dla prostych arkuszy katalogowych bez zewnętrznych bibliotek.
(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  function text(value){ return String(value == null ? '' : value); }
  function xmlEscape(value){
    return text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function xmlUnescape(value){
    return text(value)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function colName(index){
    let n = Number(index) + 1;
    let out = '';
    while(n > 0){
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out || 'A';
  }
  function colIndex(ref){
    const letters = text(ref).replace(/[^A-Z]/gi, '').toUpperCase();
    let n = 0;
    for(let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return Math.max(0, n - 1);
  }
  function utf8Bytes(str){
    if(typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text(str));
    const s = unescape(encodeURIComponent(text(str)));
    const out = new Uint8Array(s.length);
    for(let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function utf8Text(bytes){
    if(typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    let s = '';
    for(let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try{ return decodeURIComponent(escape(s)); }catch(_){ return s; }
  }
  function concatBytes(parts){
    const total = parts.reduce((sum, part)=> sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part)=>{ out.set(part, offset); offset += part.length; });
    return out;
  }
  const CRC_TABLE = (function(){
    const table = new Uint32Array(256);
    for(let i = 0; i < 256; i++){
      let c = i;
      for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes){
    let c = 0xFFFFFFFF;
    for(let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function writeU16(out, offset, value){ out[offset] = value & 255; out[offset + 1] = (value >>> 8) & 255; }
  function writeU32(out, offset, value){ out[offset] = value & 255; out[offset + 1] = (value >>> 8) & 255; out[offset + 2] = (value >>> 16) & 255; out[offset + 3] = (value >>> 24) & 255; }
  function dosTime(date){
    const d = date || new Date();
    const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | Math.floor((d.getSeconds() & 63) / 2);
    const day = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, day };
  }
  function zipStore(files){
    const now = dosTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    files.forEach((file)=>{
      const nameBytes = utf8Bytes(file.name);
      const data = file.data instanceof Uint8Array ? file.data : utf8Bytes(file.data || '');
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      writeU32(local, 0, 0x04034b50); writeU16(local, 4, 20); writeU16(local, 6, 0x0800); writeU16(local, 8, 0);
      writeU16(local, 10, now.time); writeU16(local, 12, now.day); writeU32(local, 14, crc); writeU32(local, 18, data.length); writeU32(local, 22, data.length);
      writeU16(local, 26, nameBytes.length); writeU16(local, 28, 0); local.set(nameBytes, 30);
      localParts.push(local, data);
      const central = new Uint8Array(46 + nameBytes.length);
      writeU32(central, 0, 0x02014b50); writeU16(central, 4, 20); writeU16(central, 6, 20); writeU16(central, 8, 0x0800); writeU16(central, 10, 0);
      writeU16(central, 12, now.time); writeU16(central, 14, now.day); writeU32(central, 16, crc); writeU32(central, 20, data.length); writeU32(central, 24, data.length);
      writeU16(central, 28, nameBytes.length); writeU16(central, 30, 0); writeU16(central, 32, 0); writeU16(central, 34, 0); writeU16(central, 36, 0); writeU32(central, 38, 0); writeU32(central, 42, offset);
      central.set(nameBytes, 46);
      centralParts.push(central);
      offset += local.length + data.length;
    });
    const central = concatBytes(centralParts);
    const end = new Uint8Array(22);
    writeU32(end, 0, 0x06054b50); writeU16(end, 8, files.length); writeU16(end, 10, files.length); writeU32(end, 12, central.length); writeU32(end, 16, offset); writeU16(end, 20, 0);
    return concatBytes(localParts.concat([central, end]));
  }
  function sheetXml(rows){
    const xmlRows = (Array.isArray(rows) ? rows : []).map((row, rIndex)=>{
      const cells = (Array.isArray(row) ? row : []).map((value, cIndex)=>{
        const ref = colName(cIndex) + String(rIndex + 1);
        const content = xmlEscape(value == null ? '' : value);
        return `<c r="${ref}" t="inlineStr"><is><t>${content}</t></is></c>`;
      }).join('');
      return `<row r="${rIndex + 1}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRows}</sheetData></worksheet>`;
  }
  function workbookXml(sheets){
    const body = sheets.map((sheet, idx)=> `<sheet name="${xmlEscape(sheet.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${body}</sheets></workbook>`;
  }
  function workbookRelsXml(sheets){
    const rels = sheets.map((sheet, idx)=> `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
  }
  function contentTypesXml(sheets){
    const overrides = sheets.map((_sheet, idx)=> `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`;
  }
  function makeWorkbookBlob(sheetMap){
    const sheets = Object.keys(sheetMap || {}).map((name)=> ({ name, rows:Array.isArray(sheetMap[name]) ? sheetMap[name] : [] }));
    const files = [
      { name:'[Content_Types].xml', data:contentTypesXml(sheets) },
      { name:'_rels/.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name:'xl/workbook.xml', data:workbookXml(sheets) },
      { name:'xl/_rels/workbook.xml.rels', data:workbookRelsXml(sheets) },
    ];
    sheets.forEach((sheet, idx)=> files.push({ name:`xl/worksheets/sheet${idx + 1}.xml`, data:sheetXml(sheet.rows) }));
    return new Blob([zipStore(files)], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function findEocd(bytes){
    for(let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--){
      if(bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
    }
    return -1;
  }
  function u16(bytes, offset){ return bytes[offset] | (bytes[offset + 1] << 8); }
  function u32(bytes, offset){ return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0; }
  async function inflateRaw(bytes){
    if(typeof DecompressionStream === 'undefined') throw new Error('Ten plik XLSX jest skompresowany, a ta przeglądarka nie udostępnia DecompressionStream. Wyeksportuj plik z aplikacji albo użyj nowszego Chrome/Edge.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }
  async function readZipEntries(arrayBuffer){
    const bytes = new Uint8Array(arrayBuffer);
    const eocd = findEocd(bytes);
    if(eocd < 0) throw new Error('Nieprawidłowy plik XLSX: brak katalogu ZIP.');
    const count = u16(bytes, eocd + 10);
    const dirOffset = u32(bytes, eocd + 16);
    const entries = {};
    let ptr = dirOffset;
    for(let i = 0; i < count; i++){
      if(u32(bytes, ptr) !== 0x02014b50) break;
      const method = u16(bytes, ptr + 10);
      const compSize = u32(bytes, ptr + 20);
      const nameLen = u16(bytes, ptr + 28);
      const extraLen = u16(bytes, ptr + 30);
      const commentLen = u16(bytes, ptr + 32);
      const localOffset = u32(bytes, ptr + 42);
      const name = utf8Text(bytes.slice(ptr + 46, ptr + 46 + nameLen));
      const localNameLen = u16(bytes, localOffset + 26);
      const localExtraLen = u16(bytes, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const raw = bytes.slice(dataStart, dataStart + compSize);
      let data = raw;
      if(method === 8) data = await inflateRaw(raw);
      else if(method !== 0) throw new Error('Nieobsługiwana kompresja XLSX: ' + method);
      entries[name] = data;
      ptr += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }
  function parseAttrs(raw){
    const attrs = {};
    text(raw).replace(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_m, key, _q, dq, sq)=>{ attrs[key] = xmlUnescape(dq != null ? dq : sq); return ''; });
    return attrs;
  }
  function parseSharedStrings(xml){
    const out = [];
    text(xml).replace(/<si[\s\S]*?<\/si>/g, (chunk)=>{
      const parts = [];
      chunk.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, (_m, value)=>{ parts.push(xmlUnescape(value)); return ''; });
      out.push(parts.join(''));
      return '';
    });
    return out;
  }
  function parseSheet(xml, sharedStrings){
    const rows = [];
    text(xml).replace(/<row([^>]*)>([\s\S]*?)<\/row>/g, (_rowMatch, _rowAttrs, rowXml)=>{
      const row = [];
      rowXml.replace(/<c([^>]*)>([\s\S]*?)<\/c>/g, (_cellMatch, attrRaw, cellXml)=>{
        const attrs = parseAttrs(attrRaw);
        const idx = attrs.r ? colIndex(attrs.r) : row.length;
        let value = '';
        const inline = cellXml.match(/<is[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
        const v = cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        if(inline) value = xmlUnescape(inline[1]);
        else if(attrs.t === 's' && v) value = sharedStrings[Number(v[1]) || 0] || '';
        else if(v) value = xmlUnescape(v[1]);
        row[idx] = value;
        return '';
      });
      rows.push(row.map((value)=> value == null ? '' : value));
      return '';
    });
    return rows;
  }
  function parseWorkbookSheets(workbookXmlText, relsXmlText){
    const rels = {};
    text(relsXmlText).replace(/<Relationship([^>]*)\/>/g, (_m, raw)=>{ const attrs = parseAttrs(raw); if(attrs.Id && attrs.Target) rels[attrs.Id] = attrs.Target; return ''; });
    const out = [];
    text(workbookXmlText).replace(/<sheet([^>]*)\/>/g, (_m, raw)=>{
      const attrs = parseAttrs(raw);
      const target = rels[attrs['r:id']] || '';
      out.push({ name:attrs.name || ('Arkusz' + (out.length + 1)), path:target ? ('xl/' + target.replace(/^\//, '').replace(/^xl\//, '')) : ('xl/worksheets/sheet' + (out.length + 1) + '.xml') });
      return '';
    });
    return out;
  }
  async function readWorkbook(fileOrBuffer){
    const buffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    const entries = await readZipEntries(buffer);
    const sharedStrings = entries['xl/sharedStrings.xml'] ? parseSharedStrings(utf8Text(entries['xl/sharedStrings.xml'])) : [];
    const sheets = parseWorkbookSheets(utf8Text(entries['xl/workbook.xml'] || new Uint8Array()), utf8Text(entries['xl/_rels/workbook.xml.rels'] || new Uint8Array()));
    const out = {};
    sheets.forEach((sheet)=>{ if(entries[sheet.path]) out[sheet.name] = parseSheet(utf8Text(entries[sheet.path]), sharedStrings); });
    return out;
  }

  root.FC.xlsxLite = { makeWorkbookBlob, readWorkbook, _debug:{ zipStore, readZipEntries, parseSheet, parseSharedStrings, colName, colIndex } };
})();
