class SmokeStorage{
  constructor(){ this._data = new Map(); }
  get length(){ return this._data.size; }
  key(index){ return Array.from(this._data.keys())[Number(index)] || null; }
  getItem(key){ return this._data.has(String(key)) ? this._data.get(String(key)) : null; }
  setItem(key, value){ this._data.set(String(key), String(value)); }
  removeItem(key){ this._data.delete(String(key)); }
  clear(){ this._data.clear(); }
}

function makeStorage(){ return new SmokeStorage(); }

module.exports = { SmokeStorage, makeStorage };
