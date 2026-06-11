// js/app/settings/business-costs-store.js
// Koszty firmy do późniejszego narzutu i kontroli rentowności.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const STORAGE_KEY = (FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.businessCosts) || 'fc_business_costs_v1';

  const DEFAULT_ROWS = Object.freeze([
    ['Lokal', 'Czynsz / najem lokalu'],
    ['Media', 'Prąd'],
    ['Media', 'Ogrzewanie / gaz'],
    ['Media', 'Woda i kanalizacja'],
    ['Media', 'Odpady / wywóz śmieci'],
    ['Administracja', 'Księgowa / biuro rachunkowe'],
    ['Bezpieczeństwo', 'Ochrona / monitoring / alarm'],
    ['Bezpieczeństwo', 'Ubezpieczenie firmy / lokalu'],
    ['Finanse', 'Bank / terminal / opłaty płatnicze'],
    ['Łączność', 'Telefon i internet'],
    ['Programy', 'Programy, abonamenty, chmura'],
    ['Warsztat', 'Serwis maszyn i narzędzi'],
    ['Warsztat', 'Materiały pomocnicze i eksploatacyjne'],
    ['Transport', 'Samochód — paliwo, serwis, leasing'],
    ['Marketing', 'Reklama / wizytówki / banery'],
    ['Podatki i opłaty', 'Podatki, opłaty urzędowe, koncesje']
  ]);

  const DEFAULT_BUSINESS_COSTS = Object.freeze({
    rows:DEFAULT_ROWS.map((row, index)=>({
      id:'cost_' + String(index + 1).padStart(2, '0'),
      category:row[0],
      name:row[1],
      amountNet:'',
      vatRate:23,
      billingPeriod:'monthly',
      paymentDay:'',
      note:'',
      active:true
    })),
    meta:{ updatedAt:'' }
  });

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : (Number.isFinite(fallback) ? fallback : 0);
  }
  function money(value){ return Math.round(number(value, 0) * 100) / 100; }
  function deepClone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return Object.assign({}, value || {}); } }
  function uid(){ return 'cost_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
  function getStorage(){ try{ return root.localStorage || null; }catch(_){ return null; } }

  function normalizeRow(row, index){
    const src = row && typeof row === 'object' ? row : {};
    return {
      id:text(src.id) || ('cost_' + String(index + 1).padStart(2, '0')),
      category:text(src.category) || 'Inne',
      name:text(src.name) || 'Koszt firmy',
      amountNet:src.amountNet === '' || src.amountNet == null ? '' : String(src.amountNet),
      vatRate:Math.max(0, number(src.vatRate, 23)),
      billingPeriod:'monthly',
      paymentDay:text(src.paymentDay),
      note:text(src.note),
      active:src.active !== false
    };
  }

  function normalizeCosts(input){
    const src = input && typeof input === 'object' ? input : {};
    const rows = Array.isArray(src.rows) && src.rows.length ? src.rows : DEFAULT_BUSINESS_COSTS.rows;
    return {
      rows:rows.map(normalizeRow),
      meta:{ updatedAt:text(src.meta && src.meta.updatedAt) }
    };
  }

  function read(){
    const storage = getStorage();
    if(!storage) return normalizeCosts(DEFAULT_BUSINESS_COSTS);
    try{
      const raw = storage.getItem(STORAGE_KEY);
      if(!raw) return normalizeCosts(DEFAULT_BUSINESS_COSTS);
      return normalizeCosts(JSON.parse(raw));
    }catch(_){ return normalizeCosts(DEFAULT_BUSINESS_COSTS); }
  }

  function write(input){
    const data = normalizeCosts(input);
    data.meta.updatedAt = new Date().toISOString();
    const storage = getStorage();
    if(storage){
      try{ storage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(_){ }
    }
    return data;
  }

  function reset(){ return write(deepClone(DEFAULT_BUSINESS_COSTS)); }

  function createBlankRow(){
    return normalizeRow({ id:uid(), category:'Inne', name:'Nowy koszt', amountNet:'', vatRate:23, paymentDay:'', note:'', active:true }, 0);
  }

  function monthlyTotals(input){
    const data = normalizeCosts(input || read());
    return data.rows.reduce((acc, row)=>{
      if(!row.active) return acc;
      const net = money(row.amountNet);
      if(net <= 0) return acc;
      const gross = money(net * (1 + number(row.vatRate, 0) / 100));
      acc.net = money(acc.net + net);
      acc.gross = money(acc.gross + gross);
      acc.filled += 1;
      return acc;
    }, { net:0, gross:0, filled:0, rows:data.rows.length });
  }

  function formatMoney(value){
    try{ return money(value).toLocaleString('pl-PL', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' zł'; }
    catch(_){ return String(money(value)) + ' zł'; }
  }

  function buildSummary(input){
    const totals = monthlyTotals(input || read());
    return `${totals.filled}/${totals.rows} kosztów uzupełnionych • netto miesięcznie ${formatMoney(totals.net)} • brutto ${formatMoney(totals.gross)}`;
  }

  FC.businessCosts = {
    STORAGE_KEY,
    DEFAULT_BUSINESS_COSTS:deepClone(DEFAULT_BUSINESS_COSTS),
    normalizeCosts,
    read,
    write,
    reset,
    createBlankRow,
    monthlyTotals,
    buildSummary,
    formatMoney
  };
})();
