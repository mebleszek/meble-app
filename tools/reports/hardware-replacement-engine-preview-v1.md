# Hardware replacement engine preview v1 — 2026-05-22

## Baza

Start z paczki: `site_hardware_compare_modes_storage_cleanup_v1.zip`.

## Zakres

Dodano techniczny silnik podglądu zamienników okuć bez normalnego UI i bez zapisu zmian w danych użytkownika.

Nowy moduł:

```text
js/app/catalog/hardware-replacement-engine.js
```

Publiczne API:

```text
FC.hardwareReplacementEngine.compareItems(source, candidate, options)
FC.hardwareReplacementEngine.findCandidates(source, candidates, options)
FC.hardwareReplacementEngine.previewCandidates(source, candidates, options)
FC.hardwareReplacementEngine.quotePriceInfo(item)
FC.hardwareReplacementEngine.summarizeResult(result)
```

## Zasady dopasowania

Silnik porównuje:

1. kategorię okucia,
2. opcjonalnego producenta docelowego, np. `Blum → GTV`,
3. aktywność kandydata,
4. parametry kluczowe kategorii,
5. tryby porównania z `hardware-technical-params.js`,
6. informację, czy kandydat ma cenę dostawcy `Do wyceny`.

Brak ceny dostawcy jest ostrzeżeniem w trybie domyślnym albo błędem, jeżeli wywołanie użyje `requireQuotePrice:true`.

## Ważne ograniczenia

- Brak nowego przycisku w programie.
- Brak modala zamiany producentów.
- Brak zapisu w projekcie.
- Brak zapisu w katalogu okuć.
- Brak nowego storage.
- Brak zmian w import/export Excel.

## Testy dodane w tym etapie

Dodano 6 testów do `js/testing/material/accessories-tests.js`:

1. silnik działa jako podgląd i nie zmienia storage,
2. prowadnica 350 mm nie zamienia się na 400 mm przy porównaniu dokładnym,
3. nośność działa jako `minimum takie samo lub większe`,
4. `withinRange` nie zachowuje się jak luźne przecięcie zakresów,
5. producent docelowy ogranicza kandydatów,
6. brak ceny jest ostrzeżeniem albo blokadą zależnie od opcji.

## Pliki zmienione

```text
js/app/catalog/hardware-replacement-engine.js
js/testing/material/accessories-tests.js
index.html
dev_tests.html
tools/app-dev-smoke-lib/file-list.js
tools/index-load-groups.js
README.md
DEV.md
CLOUD_MIGRATION.md
BACKUP.md
tools/reports/hardware-replacement-engine-preview-v1.md
```

## Decyzja produktowa

To jest etap techniczny. Normalny użytkownik programu nie widzi jeszcze funkcji zamiany. Następny etap może dodać developerski albo aplikacyjny podgląd kandydatów, ale dopiero po akceptacji wyników testów silnika.
