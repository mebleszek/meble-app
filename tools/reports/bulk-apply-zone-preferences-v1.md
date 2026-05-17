# Bulk apply zone preferences v1 — 2026-05-17

## Baza

- Start: `site_000_preferences_front_source_cleanup_v1.zip`.
- Wynik: `site_000_bulk_apply_zone_preferences_v1.zip`.

## Zakres

Dodano Etap 2A: kontrolowane zastosowanie preferencji strefowych do istniejących szafek w bieżącym pomieszczeniu.

Mechanizm działa w trzech krokach:

1. Użytkownik wybiera strefy i pola do zmiany.
2. Program buduje plan i pokazuje liczniki skutków.
3. Dopiero po zatwierdzeniu wykonywany jest apply.

## Nowe moduły

- `js/app/room-preferences/room-preferences-bulk-plan.js`
- `js/app/room-preferences/room-preferences-bulk-apply.js`
- `js/app/ui/wywiad-room-preferences-bulk-modal.js`

## Reguły

- Strefa `lower` obejmuje szafki stojące oraz korpus/plecy/otwieranie zestawów.
- Strefa `middle` obejmuje moduły.
- Strefa `upper` obejmuje szafki wiszące.
- Fronty zwykłych szafek są aktualizowane razem z wybraną strefą szafki.
- Fronty lodówek i zestawów reagują na `frontMaterialSource` / `frontSource`.
- `custom` jest wyjątkiem ręcznym i nie jest nadpisywany przez bulk apply.

## Poza zakresem

- Okucia i producenci okuć.
- WYCENA.
- PRO100 i usługi stolarskie.
- ROZRYS.
- Fronty wieloczęściowe.

## Testy

Dodano testy w:

- `tools/app-dev-smoke.js`
- `js/testing/cabinet/tests.js`

Testy pilnują obecności modułów plan/apply/UI, braku natywnych pickerów oraz podstawowego scenariusza zastosowania dolnej strefy z ochroną frontu `custom`.
