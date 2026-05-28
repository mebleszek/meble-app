# WYCENA click no output fix v1 — 2026-05-27

## Cel

Naprawić zgłoszoną regresję: kliknięcie zielonego `Wyceń` daje reakcję przycisku, ale użytkownik nie widzi wygenerowanej wyceny.

## Zakres

- Baza startowa: `site_hardware_hinge_dictionary_cleanup_v1.zip`.
- Nowa paczka: `site_wycena_click_no_output_fix_v1.zip`.
- Zmienione obszary: wyłącznie render/akcja zakładki WYCENA, test regresji kliknięcia i korekta testu szafek po zmianie nazw zawiasów.
- Nie ruszano resolvera konkretnych okuć katalogowych, import/export Excel, backupu, storage, PRO100, usług stolarskich, ROZRYS ani RYSUNKU.

## Zmiany techniczne

1. `js/app/wycena/wycena-tab-shell.js`
   - Po wygenerowaniu snapshotu `Wyceń` zapisuje jawnie `lastQuote`, `previewSnapshotId` i przewija do podglądu.
   - Po synchronizacji statusu projektu odświeżany jest baseline statusu, żeby świeżo wygenerowany snapshot nie został natychmiast wyczyszczony przez `reconcileStatusPreviewState`.
   - Walidacyjny błąd tworzenia wyceny nadal próbuje otworzyć aplikacyjny modal, ale dodatkowo trafia do widocznego podglądu błędu w sekcji WYCENY.

2. `js/app/wycena/wycena-tab-render-bridge.js`
   - Ciche `catch(_){}` w renderze podglądu, historii i shellu zastąpiono logowaniem błędu oraz widoczną kartą `Błąd podglądu WYCENY`.
   - Dzięki temu kolejna awaria renderowania nie będzie wyglądała jak brak reakcji po kliknięciu.

3. `js/testing/cabinet/tests.js`
   - Test zestawu nie szuka już starej, sztywnej nazwy `Zawias BLUM`.
   - Zawiasy są sprawdzane po `hardwareRequirement.kind === 'hinge'` albo po nazwie zaczynającej się od `Zawias`.

4. `tools/wycena-click-regression-smoke.js`
   - Dodano regresyjny test kliknięcia zielonego `Wyceń`: renderuje zakładkę, klika przycisk, sprawdza zapis snapshotu, widoczny podgląd, podsumowanie i historię wycen.

5. `tools/app-dev-smoke.js`
   - Dodano kontrakt pilnujący, że `Wyceń` zachowuje świeżo wygenerowany podgląd po synchronizacji statusu i że błędy renderu nie są ukrywane po cichu.

## Cache-busting

Zaktualizowano wersje w `index.html` i `dev_tests.html` dla:

- `js/app/wycena/wycena-tab-render-bridge.js`
- `js/app/wycena/wycena-tab-shell.js`
- `js/testing/cabinet/tests.js` w `dev_tests.html`

## Testy

Wymagane testy przeprowadzone przed paczką:

- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/rozrys-dev-smoke.js`
- `node tools/local-storage-source-audit.js`
- `node tools/dependency-source-audit.js`
- `node tools/wycena-architecture-audit.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/hardware-import-export-deep-smoke.js`
- `node tools/service-pro100-dev-smoke.js`
- `node tools/wycena-click-regression-smoke.js`
- `node --check` dla zmienionych/dodanych JS
- `unzip -t` gotowego ZIP-a
- kontrola uprawnień ZIP-a: katalogi `drwxr-xr-x`, pliki `rw-r--r--`
