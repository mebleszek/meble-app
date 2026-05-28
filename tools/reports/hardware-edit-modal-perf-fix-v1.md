# Hardware edit modal perf fix v1 — 2026-05-20

## Baza

`site_000_hardware_technical_params_serialization_fix_v1.zip`

## Problem

Po dodaniu dynamicznych danych technicznych okuć użytkownik zgłosił, że kliknięcie `Edytuj` przy okuciu nie zawsze reaguje za pierwszym razem, a otwarcie i zamknięcie modala potrafi przycinać interfejs na kilka sekund. Użytkownik nie testował programu od momentu wprowadzenia nowych pól danych, więc diagnostyka objęła cały tor dynamicznych danych technicznych, a nie tylko ostatnią poprawkę serializacji.

## Przyczyna techniczna

Ścieżka otwarcia i zamknięcia modala korzystała z `currentItemSignature()` / `isItemDirty()`. Dla akcesoriów wywoływało to pełny `getCurrentAccessoryDraft()`, który przy okazji synchronizował `Typ / cecha`, legacy pola techniczne i launcher wyboru. W praktyce pasywny odczyt stanu formularza miał efekty uboczne w DOM i mógł remountować launcher `hardwareTypeLaunch`.

## Zmiany

- `getCurrentAccessoryDraft(opts)` obsługuje tryb `passive:true`.
- `currentItemSignature()` używa pasywnego odczytu dla akcesoriów.
- `syncHardwareTypeFromTechnicalParams(opts)` przyjmuje opcje `updateLegacy`, `updateSelect`, `updateAction`, `remountChoice` i `root`.
- Aktualizacja etykiety launchera `Typ / cecha` odbywa się bez remountu, jeśli wystarczy zmienić label.
- Odczyt dynamicznych pól technicznych jest ograniczony do kontenera `hardwareDynamicTechnicalFields`.
- Dodano test smoke `Modal edycji okuć używa pasywnego odczytu stanu formularza`.

## Nie zmieniono

- Modelu danych okuć.
- Importu/eksportu Excel.
- Backup policy.
- PRO100, ROZRYS, WYCENY, usług.

## Testy

- `node tools/check-index-load-groups.js` — OK
- `node tools/app-dev-smoke.js` — 97/97 OK
- `node tools/rozrys-dev-smoke.js` — 72/72 OK
- `node tools/local-storage-source-audit.js` — OK
- `node tools/dependency-source-audit.js` — OK
- `node tools/wycena-architecture-audit.js` — OK
- `node tools/hardware-accessories-dev-smoke.js` — 49/49 OK
- `node tools/hardware-import-export-deep-smoke.js` — 21/21 OK
- `node tools/service-pro100-dev-smoke.js` — 18/18 OK
