# Hardware replacement preview UI v1

## Baza

- Start: `site_data_safety_backup_limit_policy_test_v2.zip`
- Wynik: `site_hardware_replacement_preview_ui_v1.zip`

## Zakres

Dodano pierwszy widoczny podgląd zamienników w katalogu okuć, bez jeszcze wykonywania zamiany w projekcie.

## Zmiany

- `index.html`
  - Dodano przycisk `Zamienniki` pod przyciskiem `Wyjdź` w stopce modala edycji pozycji.
  - Dodano kontener `hardwareReplacementPreview` na listę kandydatów.
  - Dodano ładowanie `js/app/material/price-modal-hardware-replacements.js`.
- `js/app/material/price-modal-hardware-replacements.js`
  - Nowy moduł UI podglądu zamienników.
  - Korzysta z `FC.hardwareReplacementEngine`.
  - Filtruje kandydatów do tej samej kategorii i innych producentów.
  - Renderuje pasujące zamienniki oraz najbliższe odrzucone z powodami.
  - Nie zapisuje do storage, katalogu ani projektu.
- `js/app/material/price-modal-item-form.js`
  - Przekazuje do modułu zamienników bieżący stan modala: edycja/dodawanie, dirty state i aktualnie edytowane okucie.
  - Ukrywa podgląd przy niezapisanych zmianach.
- `css/hardware-replacement-preview.css`
  - Dodano osobny, mały plik stylów przycisku i panelu listy zgodny z modalem edycji okucia.
- `js/testing/material/accessories-tests.js`
  - Dodano test, że podgląd UI używa silnika zamienników i nie pokazuje kandydata od tego samego producenta.
- `tools/app-dev-smoke.js`
  - Dodano kontrakt, że UI zamienników jest podpięty pod modal, ma osobny moduł i nie używa `localStorage`, `savePriceList` ani systemowych dialogów.

## Decyzje

- Lista jest wyłącznie podglądem. Nie ma jeszcze przycisku `Zamień`.
- Brak nowego klucza storage.
- Brak zmian w backupie, imporcie/eksporcie, PRO100, ROZRYS, RYSUNKU i WYCENIE.
- Przycisk jest widoczny tylko przy edycji istniejącego okucia i tylko gdy formularz nie jest brudny.

## Testy

- `node --check js/app/material/price-modal-hardware-replacements.js`
- `node --check js/app/material/price-modal-item-form.js`
- `node --check js/testing/material/accessories-tests.js`
- `node --check tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/app-dev-smoke.js`
- `node tools/hardware-accessories-dev-smoke.js`
- pełna lista audytów została uruchomiona przed wydaniem paczki.
