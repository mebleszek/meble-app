(function(root){
  'use strict';
  const host = root || (typeof window !== 'undefined' ? window : globalThis);
  host.FC = host.FC || {};
  const FC = host.FC;

  function text(value){ return String(value == null ? '' : value); }

  function safeNow(){ return Date.now ? Date.now() : new Date().getTime(); }

  function formatElapsed(ms){
    const sec = Math.max(0, Math.round(Number(ms || 0) / 100) / 10);
    return `${sec.toFixed(1)} s`;
  }

  function createController(rootEl){
    const el = rootEl || null;
    const state = {
      active:false,
      startedAt:0,
      done:0,
      total:0,
      currentSuite:'',
      currentTest:'',
      seenSuites:0,
    };

    function render(status){
      if(!el) return;
      if(!state.active){
        el.hidden = true;
        el.innerHTML = '';
        return;
      }
      const totalText = state.total > 0 ? String(state.total) : '?';
      const pct = state.total > 0 ? Math.max(0, Math.min(100, Math.round((state.done / state.total) * 100))) : 0;
      const elapsed = state.startedAt ? formatElapsed(safeNow() - state.startedAt) : '0.0 s';
      const title = status || 'Uruchamiam testy…';
      const suite = state.currentSuite ? `Sekcja: ${state.currentSuite}` : 'Sekcja: przygotowanie';
      const current = state.currentTest ? `Aktualnie: ${state.currentTest}` : 'Aktualnie: przygotowanie środowiska';
      el.hidden = false;
      el.innerHTML = `
        <div class="test-progress__head">
          <strong>${title}</strong>
          <span>${state.done}/${totalText}</span>
        </div>
        <div class="test-progress__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <div class="test-progress__meta">${suite} • ${current} • ${elapsed}</div>
      `;
    }

    function start(mode){
      state.active = true;
      state.startedAt = safeNow();
      state.done = 0;
      state.total = 0;
      state.currentSuite = '';
      state.currentTest = '';
      state.seenSuites = 0;
      render(mode ? `Uruchamiam: ${text(mode).toUpperCase()}` : 'Uruchamiam testy…');
    }

    function handle(event){
      if(!state.active || !event) return;
      const type = text(event.type);
      if(type === 'suite-start'){
        state.seenSuites += 1;
        state.currentSuite = text(event.label || event.suite || 'testy');
        state.currentTest = '';
        const suiteTotal = Number(event.total || 0);
        if(suiteTotal > 0) state.total += suiteTotal;
        render('Trwają testy');
        return;
      }
      if(type === 'test-start'){
        state.currentSuite = text(event.label || event.suite || state.currentSuite);
        state.currentTest = event.test && event.test.name ? text(event.test.name) : `test ${Number(event.index || 0) || state.done + 1}`;
        render('Trwają testy');
        return;
      }
      if(type === 'test-done'){
        state.done += 1;
        state.currentSuite = text(event.label || event.suite || state.currentSuite);
        state.currentTest = event.row && event.row.name ? text(event.row.name) : state.currentTest;
        render('Trwają testy');
        return;
      }
      if(type === 'suite-done'){
        state.currentSuite = text(event.label || event.suite || state.currentSuite);
        state.currentTest = 'sekcja zakończona';
        render('Trwają testy');
      }
    }

    function finish(overall){
      if(!state.active) return;
      const total = Number(overall && overall.total || 0);
      const passed = Number(overall && overall.passed || 0);
      const failed = Number(overall && overall.failed || 0);
      if(total > 0){
        state.total = total;
        state.done = total;
      }
      state.currentSuite = 'zakończono';
      state.currentTest = failed ? `błędy: ${failed}` : 'bez błędów';
      render(`Zakończono: ${passed}/${total || state.total} OK`);
    }

    function fail(message){
      if(!state.active) return;
      state.currentTest = message || 'błąd uruchomienia';
      render('Testy przerwane');
    }

    function reset(){
      state.active = false;
      render('');
    }

    return { start, handle, finish, fail, reset };
  }

  FC.devTestsProgress = { createController };
})(typeof window !== 'undefined' ? window : globalThis);
