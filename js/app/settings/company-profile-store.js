// js/app/settings/company-profile-store.js
// Dane firmy, adres startowy transportu i konfiguracja darmowej integracji OpenRouteService.

(function(){
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.FC = root.FC || {};
  const FC = root.FC;
  const STORAGE_KEY = (FC.constants && FC.constants.STORAGE_KEYS && FC.constants.STORAGE_KEYS.companyProfile) || 'fc_company_profile_v1';

  const DEFAULT_COMPANY_PROFILE = Object.freeze({
    company:{
      displayName:'Stolarnia Format',
      legalName:'Stolarnia Format Paweł Tadajczyk',
      ownerName:'Paweł Tadajczyk',
      nip:'7281003180',
      regon:'470019679',
      addressLine:'ul. Retkińska 29',
      postalCode:'94-012',
      city:'Łódź',
      country:'Polska',
      phone:'504-094-799',
      email:'biuro@stolarnia.net',
      website:'stolarnia.net',
      notes:'Telefon kontaktowy ustawiony według danych użytkownika programu.'
    },
    transport:{
      provider:'openrouteservice',
      apiKey:'',
      profile:'driving-car',
      billingMode:'round_trip',
      roundingKm:1,
      minimumBillableKm:0,
      attribution:'© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors'
    },
    meta:{ updatedAt:'' }
  });

  function text(value){ return String(value == null ? '' : value).trim(); }
  function number(value, fallback){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : (Number.isFinite(fallback) ? fallback : 0);
  }
  function deepClone(value){
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return Object.assign({}, value || {}); }
  }
  function getStorage(){ try{ return root.localStorage || null; }catch(_){ return null; } }

  function normalizeCompany(src){
    const source = src && typeof src === 'object' ? src : {};
    const def = DEFAULT_COMPANY_PROFILE.company;
    return {
      displayName:text(source.displayName || def.displayName),
      legalName:text(source.legalName || def.legalName),
      ownerName:text(source.ownerName || def.ownerName),
      nip:text(source.nip || def.nip),
      regon:text(source.regon || def.regon),
      addressLine:text(source.addressLine || def.addressLine),
      postalCode:text(source.postalCode || def.postalCode),
      city:text(source.city || def.city),
      country:text(source.country || def.country),
      phone:text(source.phone || def.phone),
      email:text(source.email || def.email),
      website:text(source.website || def.website),
      notes:text(source.notes || '')
    };
  }

  function normalizeTransport(src){
    const source = src && typeof src === 'object' ? src : {};
    const def = DEFAULT_COMPANY_PROFILE.transport;
    const billing = text(source.billingMode || def.billingMode);
    const profile = text(source.profile || def.profile);
    return {
      provider:text(source.provider || def.provider) || 'openrouteservice',
      apiKey:text(source.apiKey || ''),
      profile:['driving-car','driving-hgv'].includes(profile) ? profile : 'driving-car',
      billingMode:['one_way','round_trip'].includes(billing) ? billing : 'round_trip',
      roundingKm:Math.max(0, number(source.roundingKm, def.roundingKm)),
      minimumBillableKm:Math.max(0, number(source.minimumBillableKm, def.minimumBillableKm)),
      attribution:text(source.attribution || def.attribution)
    };
  }

  function normalizeProfile(input){
    const src = input && typeof input === 'object' ? input : {};
    return {
      company:normalizeCompany(src.company || src),
      transport:normalizeTransport(src.transport),
      meta:{ updatedAt:text(src.meta && src.meta.updatedAt) }
    };
  }

  function read(){
    const storage = getStorage();
    if(!storage) return normalizeProfile(DEFAULT_COMPANY_PROFILE);
    try{
      const raw = storage.getItem(STORAGE_KEY);
      if(!raw) return normalizeProfile(DEFAULT_COMPANY_PROFILE);
      return normalizeProfile(JSON.parse(raw));
    }catch(_){ return normalizeProfile(DEFAULT_COMPANY_PROFILE); }
  }

  function write(input){
    const profile = normalizeProfile(input);
    profile.meta.updatedAt = new Date().toISOString();
    const storage = getStorage();
    if(storage){
      try{ storage.setItem(STORAGE_KEY, JSON.stringify(profile)); }catch(_){ }
    }
    return profile;
  }

  function reset(){ return write(deepClone(DEFAULT_COMPANY_PROFILE)); }

  function companyAddress(profile){
    const c = normalizeProfile(profile || read()).company;
    return [c.addressLine, [c.postalCode, c.city].filter(Boolean).join(' '), c.country].filter(Boolean).join(', ');
  }

  function billingModeLabel(mode){
    return text(mode) === 'one_way' ? 'w jedną stronę' : 'tam i z powrotem';
  }

  function billableDistanceKm(distanceKm, profile){
    const p = normalizeProfile(profile || read());
    const oneWay = Math.max(0, number(distanceKm, 0));
    let billable = p.transport.billingMode === 'one_way' ? oneWay : oneWay * 2;
    const step = Math.max(0, number(p.transport.roundingKm, 0));
    if(step > 0) billable = Math.ceil((billable - 1e-9) / step) * step;
    const min = Math.max(0, number(p.transport.minimumBillableKm, 0));
    if(min > 0) billable = Math.max(billable, min);
    return Math.round(billable * 100) / 100;
  }

  function buildSummary(profile){
    const p = normalizeProfile(profile || read());
    const c = p.company;
    const t = p.transport;
    const api = t.apiKey ? 'klucz OpenRouteService wpisany' : 'brak klucza OpenRouteService';
    return `${c.displayName || 'Firma'} • ${companyAddress(p) || 'brak adresu'} • ${billingModeLabel(t.billingMode)} • ${api}`;
  }

  FC.companyProfile = {
    STORAGE_KEY,
    DEFAULT_COMPANY_PROFILE:deepClone(DEFAULT_COMPANY_PROFILE),
    normalizeProfile,
    read,
    write,
    reset,
    companyAddress,
    billingModeLabel,
    billableDistanceKm,
    buildSummary
  };
})();
