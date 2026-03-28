(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};

  function keySort(a,b){
    const aa = (Number(a.w)||0) * (Number(a.h)||0);
    const bb = (Number(b.w)||0) * (Number(b.h)||0);
    if(bb !== aa) return bb - aa;
    const aw = Math.max(Number(a.w)||0, Number(a.h)||0);
    const bw = Math.max(Number(b.w)||0, Number(b.h)||0);
    if(bw !== aw) return bw - aw;
    return String(a.name||'').localeCompare(String(b.name||''), 'pl');
  }

  function normalizeRow(row){
    const w = Math.max(1, Math.round(Number(row && row.w) || 0));
    const h = Math.max(1, Math.round(Number(row && row.h) || 0));
    const qty = Math.max(0, Math.round(Number(row && row.qty) || 0));
    const material = String((row && row.material) || '').trim();
    const name = String((row && row.name) || 'Element').trim() || 'Element';
    const key = String((row && row.key) || `${material}||${name}||${w}x${h}`);
    return {
      key,
      material,
      name,
      w,
      h,
      qty,
      room: row && row.room ? String(row.room) : '',
      source: row && row.source ? String(row.source) : '',
      sourceRows: Math.max(0, Math.round(Number(row && row.sourceRows) || 0))
    };
  }

  function aggregateRows(rows){
    const map = new Map();
    (rows || []).forEach((row)=>{
      const n = normalizeRow(row);
      if(!(n.qty > 0) || !n.key) return;
      const cur = map.get(n.key);
      if(cur){
        cur.qty += n.qty;
        cur.sourceRows += Math.max(1, n.sourceRows || 1);
      }else{
        map.set(n.key, Object.assign({}, n, { sourceRows: Math.max(1, n.sourceRows || 1) }));
      }
    });
    return Array.from(map.values()).sort(keySort);
  }

  function rowsFromParts(parts){
    return aggregateRows((parts || []).map((p)=>({
      key: String((p && p.material) || '').trim() + '||' + String((p && p.name) || 'Element').trim() + '||' + Math.max(1, Math.round(Number(p && p.w) || 0)) + 'x' + Math.max(1, Math.round(Number(p && p.h) || 0)),
      material: (p && p.material) || '',
      name: (p && p.name) || 'Element',
      w: p && p.w,
      h: p && p.h,
      qty: p && p.qty,
      sourceRows: 1,
    })));
  }

  function summarizeSheet(sheet, material){
    const map = new Map();
    ((sheet && sheet.placements) || []).forEach((p)=>{
      if(!p || p.unplaced) return;
      const key = String(p.key || `${material || ''}||${p.name || 'Element'}||0x0`);
      const cur = map.get(key);
      if(cur){
        cur.qty += 1;
      }else{
        map.set(key, {
          key,
          material: String(material || ''),
          name: String(p.name || 'Element'),
          w: Math.max(1, Math.round(Number((p.rotated ? p.h : p.w) || p.w || 0))),
          h: Math.max(1, Math.round(Number((p.rotated ? p.w : p.h) || p.h || 0))),
          qty: 1,
        });
      }
    });
    return Array.from(map.values()).sort(keySort);
  }

  function summarizePlan(plan, material){
    const sheets = ((plan && plan.sheets) || []).map((sheet, idx)=>({
      index: idx,
      rows: summarizeSheet(sheet, material),
    }));
    const rows = aggregateRows(sheets.flatMap((s)=>s.rows));
    return { rows, sheets };
  }

  function validate(expectedRows, actualRows){
    const exp = aggregateRows(expectedRows);
    const act = aggregateRows(actualRows);
    const expMap = new Map(exp.map((row)=>[row.key, row]));
    const actMap = new Map(act.map((row)=>[row.key, row]));
    const keys = Array.from(new Set(exp.concat(act).map((row)=>row.key)));
    const rows = keys.map((key)=>{
      const e = expMap.get(key);
      const a = actMap.get(key);
      const base = e || a || {};
      const expectedQty = Math.max(0, Math.round(Number(e && e.qty) || 0));
      const actualQty = Math.max(0, Math.round(Number(a && a.qty) || 0));
      const diff = actualQty - expectedQty;
      let status = 'ok';
      if(diff < 0) status = 'missing';
      else if(diff > 0) status = 'extra';
      return {
        key,
        material: String(base.material || ''),
        name: String(base.name || 'Element'),
        w: Math.max(1, Math.round(Number(base.w) || 0)),
        h: Math.max(1, Math.round(Number(base.h) || 0)),
        expectedQty,
        actualQty,
        diff,
        status,
      };
    }).sort(keySort);

    const missingQty = rows.reduce((sum, row)=> sum + (row.diff < 0 ? Math.abs(row.diff) : 0), 0);
    const extraQty = rows.reduce((sum, row)=> sum + (row.diff > 0 ? row.diff : 0), 0);
    const ok = missingQty === 0 && extraQty === 0;
    return {
      ok,
      missingQty,
      extraQty,
      rows,
      missing: rows.filter((row)=>row.status === 'missing'),
      extra: rows.filter((row)=>row.status === 'extra'),
    };
  }

  root.FC.rozrysValidation = {
    aggregateRows,
    rowsFromParts,
    summarizeSheet,
    summarizePlan,
    validate,
  };
})();
