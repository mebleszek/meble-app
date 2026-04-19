(function(){
  'use strict';
  window.FC = window.FC || {};
  const FC = window.FC;
  const keys = (FC.constants && FC.constants.STORAGE_KEYS) || {};
  const storage = FC.storage || {
    getJSON(_key, fallback){ return JSON.parse(JSON.stringify(fallback)); },
    setJSON(){}
  };

  const ORDER_KEY = keys.serviceOrders || 'fc_service_orders_v1';

  function clone(value){
    try{ return FC.utils && typeof FC.utils.clone === 'function' ? FC.utils.clone(value) : JSON.parse(JSON.stringify(value)); }
    catch(_){ return JSON.parse(JSON.stringify(value || null)); }
  }

  function uid(){
    try{ return FC.utils && typeof FC.utils.uid === 'function' ? FC.utils.uid() : ('so_' + Date.now()); }
    catch(_){ return 'so_' + Date.now(); }
  }

  function normalizeText(value){ return String(value == null ? '' : value).trim(); }

  function normalizeStatus(value){
    const text = normalizeText(value).toLowerCase();
    if(!text) return 'nowe';
    return text;
  }

  function normalizeMeta(meta){
    const src = meta && typeof meta === 'object' ? meta : {};
    return {
      testData: !!src.testData,
      testOwner: normalizeText(src.testOwner),
      testRunId: normalizeText(src.testRunId),
      createdBy: normalizeText(src.createdBy),
      source: normalizeText(src.source),
    };
  }

  function normalizeOrder(order){
    const src = order && typeof order === 'object' ? order : {};
    const now = Date.now();
    const createdAt = Number(src.createdAt) > 0 ? Number(src.createdAt) : (Number(src.updatedAt) > 0 ? Number(src.updatedAt) : now);
    const updatedAt = Number(src.updatedAt) > 0 ? Number(src.updatedAt) : now;
    const title = normalizeText(src.title) || normalizeText(src.name) || 'Nowe zlecenie';
    const clientName = normalizeText(src.clientName || src.customerName);
    const items = Array.isArray(src.items) ? src.items.map((item)=> item && typeof item === 'object' ? {
      name: normalizeText(item.name),
      qty: Number(item.qty) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      total: Number(item.total) || ((Number(item.qty) || 0) * (Number(item.unitPrice) || 0)),
    } : null).filter(Boolean) : [];
    return {
      id: normalizeText(src.id) || uid(),
      title,
      clientName,
      customerName: clientName,
      phone: normalizeText(src.phone),
      city: normalizeText(src.city),
      address: normalizeText(src.address),
      description: normalizeText(src.description),
      orderType: normalizeText(src.orderType || src.category),
      items,
      total: Number(src.total) || items.reduce((sum, item)=> sum + (Number(item.total) || 0), 0),
      status: normalizeStatus(src.status),
      addedDate: normalizeText(src.addedDate) || (()=>{ try{ return new Date(createdAt).toISOString().slice(0, 10); }catch(_){ return ''; } })(),
      createdAt,
      updatedAt,
      meta: normalizeMeta(src.meta),
    };
  }

  function readAll(){
    const rows = storage.getJSON(ORDER_KEY, []);
    return Array.isArray(rows) ? rows.map(normalizeOrder) : [];
  }

  function writeAll(list){
    const rows = Array.isArray(list) ? list.map(normalizeOrder) : [];
    storage.setJSON(ORDER_KEY, rows);
    return rows;
  }

  function getById(id){
    const key = normalizeText(id);
    if(!key) return null;
    return readAll().find((row)=> String(row.id || '') === key) || null;
  }

  function upsert(order){
    const normalized = normalizeOrder(order);
    const list = readAll();
    const idx = list.findIndex((row)=> String(row.id || '') === String(normalized.id || ''));
    if(idx >= 0) list[idx] = normalized;
    else list.unshift(normalized);
    writeAll(list);
    return normalized;
  }

  function remove(id){
    const key = normalizeText(id);
    if(!key) return;
    writeAll(readAll().filter((row)=> String(row.id || '') !== key));
  }

  function createDraft(initial){
    return normalizeOrder(Object.assign({ id:'', title:'', clientName:'', phone:'', city:'', address:'', description:'', orderType:'', items:[], total:0, status:'nowe' }, initial || {}));
  }

  FC.serviceOrderStore = {
    ORDER_KEY,
    normalizeOrder,
    readAll,
    writeAll,
    getById,
    upsert,
    remove,
    createDraft,
  };
})();
