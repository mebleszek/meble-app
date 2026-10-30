# PREFLIGHT — zakres i procedura testów

**Źródłem wydaniowego CI jest GitHub Actions**, zgodnie z [AGENTS.md](AGENTS.md) §3 i §12 oraz faktycznym plikiem `.github/workflows/preflight-js.yml`.

Skrypt `node tools/preflight.js` sprawdza m.in. składnię JS, load-order, auto-odkrywane `tools/*-smoke.js`, zależności i storage. Samo istnienie skryptu nie oznacza PASS dla konkretnego SHA. Codex wykonuje tylko celowaną diagnostykę konieczną do implementacji, a nie ponawia pełnego CI lokalnie.

[CURRENT_STATE.md](CURRENT_STATE.md) — aktualne dowody, PR i blokery. [TEST_BASELINE.md](TEST_BASELINE.md) — pokrycie testów. `CODE_READY` nie jest `CI_PASS`; `CI_PASS` nie jest automatycznie `RELEASED` ani zgodą na Firebase LIVE i nie zastępuje testu fizycznego Androida.
