# ORS geocoding guard v1 — raport

Data: 2026-06-13
Paczka: `site_ors_geocoding_guard_v1.zip`

## Cel

Uszczelnić automatyczne przeliczanie trasy OpenRouteService po zgłoszeniu, że adres inwestora w Łodzi został rozpoznany przez API jako adres w Koluszkach. Program nie ma pokazywać listy kandydatów użytkownikowi — ma automatycznie wybrać jeden pewny wynik albo nie liczyć trasy.

## Zmiany

- `openrouteservice-transport.js` pobiera teraz do 5 kandydatów geokodowania.
- Wynik jest akceptowany tylko wtedy, gdy zgadza się miejscowość wyciągnięta z adresu firmy/inwestora.
- Jeżeli pierwszy wynik jest błędny, ale dalszy kandydat pasuje do miejscowości, program wybiera poprawnego kandydata.
- Jeżeli żaden kandydat nie pasuje, program przerywa ze statusem `geocode_mismatch` i nie wysyła zapytania o trasę.
- Diagnostyka ORS zapisuje dodatkowe dane: expectedLocality, expectedPostalCode, locality, localadmin, borough, postalcode, candidateCount.
- Panel inwestora pokazuje status `adres niepewny` i zachowuje ręczne/poprzedenie kilometry.

## Testy

`tools/openrouteservice-distance-smoke.js` sprawdza:

- pierwszy kandydat Koluszki, drugi Łódź — program wybiera Łódź,
- tylko kandydat Koluszki przy oczekiwanej Łodzi — program przerywa bez zapytania directions,
- brak klucza/adresu, ręczny fallback, tam i z powrotem, zaokrąglenia oraz integrację z WYCENĄ.
