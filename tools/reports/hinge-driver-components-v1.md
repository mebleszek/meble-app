# Zawias + prowadnik jako komplet albo składane części v1

## Paczka
`site_hinge_driver_components_v1.zip`

## Cel
Ujednolicić wycenę kompletu zawiasowego dla dwóch modeli zakupu:

1. gotowy komplet zawias + prowadnik, np. Bivert,
2. osobny zawias i osobny prowadnik, np. lokalna hurtownia.

## Model danych
Dodano/ustabilizowano jawne parametry techniczne:

- `rola_kompletu`: `komplet zawiasowy`, `zawias`, `prowadnik`,
- `system_kompatybilnosci`,
- `typ_prowadnika`,
- `forma_prowadnika`,
- `pokrycie_prowadnika`: `w komplecie`, `osobno`, `bez prowadnika`.

Nie dodano słownika zgodności. Parowanie odbywa się po jawnych parametrach.

## Zasady

- `Osobno` nie jest typem prowadnika.
- `Zerowy uskok` jest cechą zawiasu, nie prowadnika.
- Osobny prowadnik pasuje do zawiasu tylko wtedy, gdy zgadza się producent, system kompatybilności, typ prowadnika i forma prowadnika.
- Brak wymaganych danych technicznych wyklucza pozycję z automatycznego doboru i oznacza ją w UI.

## UI
Brakujące pola techniczne w formularzu okucia są zaznaczone bezpośrednio na polach czerwoną obwódką i opisem `Wymagane do wyceny`.

Booleany w danych technicznych mają trzy stany: `Nie ustawiono`, `Tak`, `Nie`.

## WYCENA
Dla wymagania `Komplet zawiasowy` resolver najpierw może użyć gotowego kompletu. Jeżeli dobrany produkt jest samym zawiasem z `pokrycie_prowadnika: osobno`, WYCENA próbuje dobrać osobny prowadnik z kategorii `Prowadniki` po tym samym producencie, systemie, typie i formie prowadnika.

## Testy

- `tools/hardware-technical-completeness-smoke.js`
- `tools/hinge-driver-components-smoke.js`
- `tools/wycena-hinge-requirement-override-smoke.js`
- testy import/export i akcesoriów

## Cache-busting
`20260604_hinge_driver_components_v1`
