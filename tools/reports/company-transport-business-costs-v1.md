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


## Transport LOCAL-FIRST — 07.11.2026

Gałąź `fix/local-first-transport-delete-20261107`, BASE/main
`26dd3c2581e8dbaad64f0fa643c58153789ac845`; jeden commit, wynikowy HEAD w przekazaniu.

### Potwierdzona przyczyna i poprawka

`calculate-ors` ignorowało wynik `saveTransport()`. Repozytorium odmawiało zapisu
poza asynchroniczną transakcją obrazu, lecz handler wyświetlał „Zapisano”. Teraz
sieć pozostaje poza transakcją, natomiast aktualizacja inwestora przechodzi przez
istniejące `applicationWrite.project`, sprawdzenie repozytorium i ACK IDB.
Spóźniony wynik po zmianie inwestora/projektu/adresu/profilu trasy, instancji boundary,
Auth albo rozpoczęciu edycji odmawia zapisu. Błąd nie nadpisuje ostatniej poprawnej
trasy; komunikat sukcesu następuje dopiero po commit. Zachowano dokładne metry
oraz sekundy, również zero, zamiast bazować na zaokrąglonych minutach ORS.

### Zatwierdzone liczenie

- Ustawienia w jednej stronie: minimum 5 min i 2 km, krok 1 min i 1 km.
  Najpierw minimum/zaokrąglenie w górę jednej strony, następnie powrót.
  Zachowano istniejący wybór one_way/round_trip dla kilometrów; przejazd ekipy
  pozostaje tam i z powrotem w harmonogramie i koszcie czasu.
- Paliwo 10 l/100 km, 7 zł/l, mnożnik 2: 1,40 zł/km. Mnożnik obejmuje już paliwo
  i amortyzację; nie dodaje drugiego kosztu paliwa. Edytowalne pola i pochodna
  cena używają istniejących komponentów ustawień, bez nowej formuły cennika.
- Ten sam minimalny/zaokrąglony czas ogranicza dostępność dnia i jest płatny.
  Domyślny najkrótszy kurs: 10 min × 250 zł/h / 60 + 4 km × 1,40 = 47,27 zł.
  Zmiana liczby dni mnoży kursy dopiero po obliczeniu dostępności; nie tworzy pętli.
  Zera prac niecodziennych nadal dają zero dni/przejazdów.
- Pochodna cena zasila tylko nieedytowaną fabryczną pozycję zerową.
  Ręcznie zapisane stawki (w tym zero), start/includedQty, konflikty i przypisania
  zachowują pierwszeństwo oraz dotychczasowe odmowy. Żaden katalog nie jest
  przepisywany podczas wyliczenia. Stare oferty i rejestry pozostają zamrożone.
- Nowe pola schematu firmy są opcjonalne: stary model nadal waliduje się.
  Zapisane wcześniej minima/zaokrąglenia, również 0, pozostają; wartości domyślne
  nie są migracją. Brakujące nowe pola są dostępne przy odczycie, a zapis następuje
  dopiero przy „Zapisz”. Klucz ORS nadal wykluczony z kontraktu chmurowego.

### Celowane dowody

Node 24.19.0: `transport-settings-pricing-smoke` 4 grupy PASS,
`openrouteservice-distance-smoke`, `company-transport-business-costs-smoke`,
`transport-catalog-quote-fix-smoke` PASS; `labor-work-plan-smoke` 23 grupy,
`quote-exact-calculations-smoke` 83 przypadki, `code-global-catalogs-smoke` 7/7
(14 domen), `main-login-smoke` 36/36 PASS. Stary test ORS oczekiwał zaokrąglenia
całego powrotnego dystansu: 12,4 × 2 → 25 km. Zgodnie z nowym kontraktem oczekuje
12,4 → 15 km × 2 = 30 km i 130 zł; nadal niezależnie sprawdza niezmienioną
formułę 50 + (25 − 10) × 4 = 110 zł. Nie osłabiono pozostałych asercji.

Rzeczywisty Chromium: `local-first-transport-delete-browser-smoke` 9 grup PASS,
actual forms/Cancel/Save/quota/retry, real client-fence, Auth i zmiana kontekstu,
RAW/RAM/4 store/uncertain ACK/stare oferty, zimny restart; pełny
`android-local-first-browser-smoke` 13 grup PASS z rzeczywistym panelem,
WYCENĄ i restartem offline. Dane i odpowiedzi ORS wyłącznie syntetyczne;
zero zewnętrznych żądań. Fixture ma jawne trwałe createdAt/updatedAt, tak jak nowe
rekordy aplikacji: brak tych dat generował Date.now() przy normalizacji obcego
rekordu i prawidłową odmowę scope; asercje ochrony innych rekordów pozostawiono.

Obowiązkowy routing: 207 smoke / 7 rozłącznych grup; nowy test przeglądarkowy 6/7,
obliczenia 5/7, pełny Android 5/7, ORS 6/7. Skrypty obu HTML wersjonowane,
kanoniczna lista nadal 347 wpisów; generator katalogów i manifest odtworzone.
Pełnego CI ani GitHub Actions nie uruchamiano.

### Po osobnym wydaniu

Sprawdzić zapisane minima w trybik → Dane firmy i transport (starsze własne wartości
nie są nadpisywane). Przeliczyć trasę u inwestora, sprawdzić tabelę i utworzyć
nową wersję WYCENY; porównać czas przejazdu z HARMONOGRAMEM. Dawna oferta nie zmieni
się sama. Rzeczywisty ORS nadal wymaga własnego klucza i prawidłowych adresów.
Nie czyścić danych i nie przeładowywać niezapisanego formularza.

**CODE_READY / CI_PENDING / RELEASE_BLOCKED / PHONE_PENDING / LIVE_BLOCKED.**
Nie jest to dowód z fizycznego Pixela, wydanie ani zgoda Firebase LIVE.
