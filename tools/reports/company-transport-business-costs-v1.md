# Raport zmian — dane firmy, transport i koszty firmy

Build: `20260611_company_transport_business_costs_v1`

## Zakres

- Dodano w trybiku osobny widok **Dane firmy i transport**.
- Dodano w trybiku osobny widok **Koszty firmy**.
- Dodano do inwestora panel **Dojazd / transport**.
- Dodano źródło ilości `transport.distance_km` dla WYCENY.
- Dodano domyślną pozycję cennika `transport_distance_km` / **Transport do klienta**.
- Dodano opcjonalne przeliczanie trasy przez OpenRouteService, bez Google Maps API.

## Dane firmy

Domyślnie wpisano dane firmy:

- Nazwa widoczna: Stolarnia Format
- Nazwa pełna: Stolarnia Format Paweł Tadajczyk
- Właściciel: Paweł Tadajczyk
- Adres pracy: ul. Retkińska 29, 94-012 Łódź
- NIP: 7281003180
- REGON: 470019679
- Telefon: 504-094-799
- E-mail: biuro@stolarnia.net
- Strona: stolarnia.net

Telefon ustawiono zgodnie z poleceniem użytkownika, a nie według publicznej strony.

## Transport

W ustawieniach firmy zapisuje się:

- adres firmy,
- klucz OpenRouteService,
- profil trasy,
- tryb liczenia kilometrów: jedna strona / tam i z powrotem,
- zaokrąglanie kilometrów,
- minimalną liczbę kilometrów do wyceny,
- atrybucję OpenRouteService / OpenStreetMap.

W inwestorze zapisuje się:

- dystans w jedną stronę,
- czas przejazdu,
- źródło dystansu: ręczne / OpenRouteService,
- datę ostatniego przeliczenia,
- notatkę.

Przycisk **Otwórz trasę w mapach** otwiera podgląd trasy, ale nie pobiera płatnych danych z Google Maps API.

Przycisk **Przelicz trasę** działa tylko wtedy, gdy w ustawieniach firmy wpisano klucz OpenRouteService.

## WYCENA

Dodano źródło ilości:

- `transport.distance_km` — kilometry transportu do wyceny.

Dodano domyślną pozycję cennika:

- `transport_distance_km` / **Transport do klienta**.

Pozycja automatycznie trafia do WYCENY, gdy:

1. inwestor ma kilometry transportu większe od zera,
2. pozycja cennika transportu jest aktywna,
3. cena za km jest większa od zera,
4. użytkownik nie dodał tej pozycji ręcznie drugi raz.

## Koszty firmy

Dodano bazę kosztów miesięcznych w trybiku. Domyślna lista obejmuje m.in.:

- czynsz / najem lokalu,
- prąd,
- ogrzewanie / gaz,
- wodę i kanalizację,
- odpady,
- księgową / biuro rachunkowe,
- ochronę / monitoring / alarm,
- ubezpieczenie,
- bank / terminal,
- telefon i internet,
- programy i abonamenty,
- serwis maszyn i narzędzi,
- materiały pomocnicze,
- samochód,
- reklamę,
- podatki i opłaty urzędowe.

Na tym etapie koszty są zapisywane i sumowane miesięcznie. Nie są jeszcze automatycznie rozbijane jako narzut w WYCENIE — to powinien być osobny, kontrolowany etap.

## Bezpieczeństwo i ograniczenia

- Nie użyto Google Maps API.
- OpenRouteService wymaga darmowego klucza API wpisanego ręcznie w ustawieniach.
- Klucz OpenRouteService jest zapisywany lokalnie razem z ustawieniami programu; backup może go zawierać.
- Automatyczne przeliczanie trasy wymaga internetu i dostępności usługi OpenRouteService.

## Testy

Wykonano:

- `node --check` dla zmienionych plików JS,
- `node tools/check-index-load-groups.js`,
- `node tools/app-dev-smoke.js`,
- `node tools/company-transport-business-costs-smoke.js`.

Wynik: OK.
