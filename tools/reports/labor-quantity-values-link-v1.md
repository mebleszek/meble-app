# Raport: podpięcie źródeł ilości do robocizny WYCENY v1

Paczka: `site_labor_quantity_values_link_v1.zip`

## Zakres

- Bazą jest zaakceptowana paczka `site_labor_quantity_source_selector_v1.zip`.
- WYCENA robocizny szafek używa teraz `quantitySource` z definicji cennika robocizny.
- Odczyt ilości idzie przez `FC.workQuantityFacts`, czyli przez read-only adapter istniejących danych szafki.
- Wynik trafia do komponentów robocizny i do `quoteCalculationRegister` z metadanymi źródła ilości.

## Co jest podpięte

- `cabinet.count` — skręcenie korpusu,
- `shelf.count` — półki,
- `front.count` — montaż frontu/drzwi,
- `hinge.count` — montaż zawiasu i regulacja frontu,
- `drawer.count` — montaż szuflady/prowadnic, jeżeli szafka zwraca liczbę szuflad.

## Zasady

- Źródła są liczone na żądanie. Nie są zapisywane jako druga prawda w szafce.
- Brak wartości albo 0 z danego źródła nie generuje czynności.
- `labor_mount_front` i `labor_mount_hinge` zachowują istniejące specjalne ścieżki, ale ilość jest zgodna z `quantitySource`.
- Pozostałe aktywne pozycje z `quantitySource` i `autoRole:none` mogą zostać policzone automatycznie, jeśli szafka zwraca ilość większą od 0.

## Czego nie ruszano

- Nie ruszano `cabinet-modal.js`, `cabinets-render.js`, `cabinet-common.css`.
- Nie dodawano podglądu do modala szafki.
- Nie przebudowywano działu CZYNNOŚCI ani kreatora korpusów.
- Nie zmieniano źródeł materiałów i okuć.

## Testy

- `tools/labor-quantity-values-link-smoke.js` sprawdza, że WYCENA używa `quantitySource`, a dane trafiają do `quoteCalculationRegister`.
- Regresje WYCENY i źródeł ilości zostały uruchomione razem z testami aplikacji.
