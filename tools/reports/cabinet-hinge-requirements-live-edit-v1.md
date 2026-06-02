# Edytowalne wymagania zawiasów w modalu szafki v1 — 2026-06-02

## Zakres

Paczka: `site_cabinet_hinge_requirements_live_edit_v1.zip`.

Celem etapu było rozwinięcie panelu `Wymagania techniczne do wyceny` z samego podglądu w aktywny, centralny panel wymagań zawiasów dla konkretnej szafki.

## Zasady biznesowe

- Panel pokazuje i pozwala zmienić wymagania techniczne, nie konkretne produkty katalogowe.
- Nie wybiera się tu producenta/modelu typu Blum/GTV. WYCENA dalej dobiera konkretną pozycję z katalogu okuć po wymaganiach technicznych.
- Domyślne wymaganie zawiasu wynika z centralnego helpera `cabinet-hardware-requirements`.
- Ręczna zmiana w panelu zapisuje tylko nadpisanie wymagań, np. dla lewych drzwiczek `wpuszczany`, a dla prawych nadal `nakładany`.
- Ilość zawiasów ma przeliczać się z aktualnego draftu szafki, bez zapisywania i ponownego otwierania modala.
- Dla korpusu dwudrzwiowego wymagania są pokazane w jednym rzędzie: lewe drzwiczki po lewej, prawe po prawej, oddzielone pionową kreską.

## Zmienione pliki

- `js/app/cabinet/cabinet-hardware-requirements.js`
  - dodano listę dostępnych typów wymagań zawiasów,
  - dodano per-drzwiowe wymagania zawiasów,
  - dodano nadpisania `cabinet.hardwareRequirementOverrides.hinges.doors`,
  - zachowano agregat `getHingeRequirementWithQty` dla zgodności z dotychczasową WYCENĄ.
- `js/app/cabinet/cabinet-hardware-requirements-panel.js`
  - panel ma wybór typu wymagań zawiasu przez aplikacyjny launcher,
  - panel renderuje dwie kolumny dla szafki dwudrzwiowej,
  - panel nadal nie pokazuje producenta ani modelu katalogowego.
- `js/app/cabinet/cabinet-modal.js`
  - dodano `refreshCabinetHardwareRequirementsPanel`,
  - panel odświeża się po zmianie liczby frontów, wymiarów i istotnych pól draftu.
- `js/app/cabinet/cabinet-cutlist.js`
  - cutlista korzysta z per-drzwiowych wymagań zawiasów, dzięki czemu różne wymagania lewych i prawych drzwiczek nie są zlewane w jeden ogólny opis.
- `css/cabinet-common.css`
  - dodano układ dwóch kolumn i pionowy separator.
- `tools/cabinet-hardware-requirements-live-edit-smoke.js`
  - dodano test regresyjny dla live/per-door/override.

## Dane

Nie dodano nowego trwałego klucza localStorage. Nadpisania są częścią danych konkretnej szafki:

```json
{
  "hardwareRequirementOverrides": {
    "hinges": {
      "doors": {
        "left": { "typeId": "hinge_110_inset" },
        "right": { "typeId": "hinge_110_overlay" }
      }
    }
  }
}
```

To jest zgodne z kierunkiem cloud-ready: wymagania są właściwością szafki/projektu, a nie osobnym cache ani równoległym licznikiem WYCENY.

## Ograniczenia pozostawione celowo

- Prowadnice/szuflady nie są jeszcze edytowalne w tym panelu. To następny etap.
- Wybór zawiasu wpuszczanego nie zmienia jeszcze geometrii frontu. Zapisane wymagania są przygotowaniem pod późniejsze spięcie logiki frontów z wymaganiami okuć.
- Podnośniki AVENTOS nadal wymagają osobnego etapu wymagań technicznych.

## Testy

- `node tools/cabinet-hardware-requirements-live-edit-smoke.js`
- `node tools/cabinet-hardware-requirements-panel-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/quote-audit-material-quantities-fix-smoke.js`
- `node tools/hardware-accessories-dev-smoke.js`
- `node tools/wycena-architecture-audit.js`
