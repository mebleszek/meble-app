# hardware_technical_params_serialization_fix_v1

## Baza

- Start: `site_000_backup_documentation_audit_v1.zip`

## Problem

Backup pokazał wartości `"[object Object]"` w `fc_accessories_v1`, szczególnie w `hardwareType` i `technicalParams.value`. To oznaczało, że obiekty z launcherów/list aplikacyjnych lub importu były zamieniane na tekst przez `String(object)`.

## Naprawa

- `hardware-technical-params.js` dostał bezpieczną normalizację wartości skalarnych: `value/label/name/text/id` są wyciągane z obiektów, a literalny tekst `"[object Object]"` jest traktowany jako pusty śmieć.
- `hardware-catalog.js` używa tej samej logiki dla pól katalogu okuć, żeby `hardwareType` i pola tekstowe nie utrwalały obiektów jako tekstu.
- `hardware-catalog-export-xlsx.js` eksportuje dynamiczne parametry przez normalizację, więc arkusze grupowe nie wypuszczają obiektów do Excela.

## Testy dodane

- Test modelu okuć: normalizacja rekordu z obiektami wyboru nie może zawierać `"[object Object]"`.
- Test import/export deep: arkusze grupowe nie mogą eksportować `"[object Object]"`.
- Test Node smoke: rekord okucia z dynamicznymi parametrami musi mieć czysty JSON.

## Zakres celowo nietknięty

- Polityka backupów i retencja.
- Automatyczne kasowanie danych użytkownika.
- ROZRYS, WYCENA, PRO100, usługi.
