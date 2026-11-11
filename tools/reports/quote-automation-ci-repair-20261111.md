# PR #127 — targeted automation-mode CI repair (2026-11-11)

Original rejected PR head: `ef499c3d558fe609c21826cc110a77f933cb10ee`. Main at diagnosis: `2968f7b952ed5a6b533aceede65cd0e2e2b6760a`. Failure run: `43092359383` (one run, completed FAIL; auto-merge and post-merge verification skipped).

## Root cause and bounded fixes

1. The visible AUTOMAT/RĘCZNA setting accidentally made manual quantity-formula fields invisible and erased `quantitySource`. The form now keeps that source for quantity-based manual formulas without activating them automatically. Added a direct regression test.
2. Legacy private transport tariffs with `quantitySource='transport.distance_km'` were inferred automatic even when explicitly selected manually. Only an explicit assignment of an unmarked, non-factory legacy transport definition is permitted as an override; the transport automatic is suppressed for that assignment. Explicit new automatic definitions and factory IDs cannot be selected manually.
3. One native LOCAL-FIRST test constructs a mocked edit draft without `automationMode`. The factory lock now refuses **explicit** manual mode, but existing edits with an absent legacy field continue; canonical factory ID still enforces automatic mode in the normalization layer, so the user cannot downgrade it.
4. The isolated app-dev smoke loader lacked the actual `carrying-logistics.js` dependency. Added the production module to the real loader rather than inventing carrying results.
5. Native WYCENA fixtures now include a synthetic manual 12 km/30 min route and ground-floor/no-lift carrying settings; the Android LOCAL-FIRST browser fixture enters this route through the real investor form and checks persistence. Production still blocks quotes with missing real route.
6. A stale generated-catalog test expected legacy `automatic-suppressed` when a factory automatic was manually assigned. This conflicts with the current source-of-truth test, which requires the automatic to remain unchanged and not duplicated. The assertion now verifies the full calculation is unchanged, not a suppressed row.

## Checks before CI

- Actual staged `tools/labor-automation-mode-smoke.js`: 10/10 PASS.
- Actual staged `tools/quote-qa-p0-smoke.js`: 8/8 PASS.
- Actual staged `tools/labor-quantity-source-selector-smoke.js`: PASS.
- Real staged `wycena-core-offer.js` + existing labor catalog modules: four manual/automatic historical-transport scenarios PASS (60 zł auto; 15 zł manual; new explicit auto ignores stale manual; new explicit manual still 15 zł).
- JavaScript syntax for all edited files and entrypoint version consistency: PASS.
- Offline manifest SHA256 recomputed from production assets, with old SHA256 verified.
- Full Node/Chromium/Android CI **NOT EXECUTED** in this correction step, therefore browser tests and all CI shards remain unverified.

## Release safeguards

This corrective work belongs on a **separate branch**, not the open Ready PR #127 head. No new PR, no GitHub Actions re-run, no merge, no publication, no Firebase LIVE, no reset/migration of user data. A later release attempt requires the owner's narrow approval and valid SHA checks.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED.**

## Korekta: tworzenie inwestora i ręczne dane trasy — 11.11.2026

Przebieg CI [#43099765270](https://github.com/mebleszek/meble-app/actions/runs/43099765270) PR #128: safety, Firebase, cloud-historical, preflight-static i shardy 1–4,7 PASS; shardy 5,6 FAIL na identycznej asercji `Persisted synthetic investor must have manual travel time` (`'' !== '30'`). Auto-merge i post-merge-verify SKIPPED. Błąd był w main przed pakietem automatyki: `investors-store.create(initial)` nie podawał `initial.transport` do `normalizeInvestor`, a `update()` zachowywał trasę. Izolowane odtworzenie na prawdziwym modelu: normalizer 30 min, create pusty, update 30 min.

Minimalna korekta tylko `create()`: `transport: initial?.transport`. Test `investor-create-transport-smoke.js` sprawdza drogę create → zapisany RAW → readAll → nowy runtime, brak danych trasy bez zgadywania, izolację innych inwestorów, brak mutacji danych wejściowych i niezmienioną edycję. Uruchomiono celowany test: PASS. Wersje obu entrypointów i manifest offline aktualizowane spójnie. Brak zmian w UI, cennikach, regułach WYCENY, Firebase LIVE, danych telefonu; bez pełnego GitHub CI i bez publikacji.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED** — osobna gałąź od `e22ee9092342becea9a518d4a29912c2ca53bd73`, nowy HEAD potwierdzany po commicie.
