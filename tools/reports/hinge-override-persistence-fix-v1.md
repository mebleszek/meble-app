# Hinge override persistence fix v1 — 2026-06-04

## Problem

Panel `Wymagania techniczne do wyceny` podpinał delegowany listener tylko raz na kontenerze `#cmHardwareRequirements`, ale listener pamiętał `room`, `draft` i `opts` z pierwszego renderu. Po ponownym otwarciu lub odświeżeniu modala kliknięcie `Zmień` mogło zmienić stary draft, a nie aktualnie zapisywaną szafkę. Efekt: panel chwilowo pokazywał `Ręcznie`, natomiast po `Zapisz zmiany` MATERIAŁ i ponowna edycja wracały do domyślnego `110° nakładany`.

## Zmiana

- `cabinet-hardware-requirements-panel.js` zapisuje aktualny kontekst renderu na kontenerze jako `__cabinetHardwareReqContext`.
- Listener kliknięć jest nadal podpinany raz, ale za każdym kliknięciem pobiera bieżący kontekst z kontenera.
- Po asynchronicznym wyborze zawiasu listener ponownie pobiera aktualny kontekst, żeby nie zapisać starego draftu.
- Wybór buduje patch override z `typeId`, `label` i `technicalParams`, bez producenta/modelu katalogowego.
- `cabinet-hardware-requirements.js` czyści override przy pustym `typeId`, usuwa puste struktury i zachowuje techniczny snapshot wymagań.

## Kontrakt danych

Jedna prawda pozostaje tutaj:

```json
{
  "hardwareRequirementOverrides": {
    "hinges": {
      "doors": {
        "single": {
          "typeId": "hinge_parallel_inset",
          "label": "Zawias równoległy wpuszczany",
          "technicalParams": {
            "nalozenie": { "value": "równoległy wpuszczany" },
            "kat_rzeczywisty": { "from": 95, "to": "" },
            "klasa_kata": { "value": "równoległy wpuszczany 95°" },
            "typ_prowadnika": { "value": "specjalny" }
          }
        }
      }
    }
  }
}
```

Dla jednego frontu używany jest tylko klucz `single`. Dla dwóch frontów używane są `left` i `right`.

## Testy

- `tools/cabinet-hardware-requirements-live-edit-smoke.js` — zapis i odczyt override, stale-listener regression, cutlista/MATERIAŁ.
- `tools/cabinet-hardware-requirements-panel-smoke.js` — obecność panelu i cache-busting.
- `tools/wycena-hinge-requirement-override-smoke.js` — WYCENA bierze ręczne wymagania z centralnego helpera, nie ze starej cutlisty.
