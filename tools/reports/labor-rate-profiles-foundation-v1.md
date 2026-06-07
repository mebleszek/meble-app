# Robocizna — profile stawek godzinowych w cenniku v1

Paczka: `site_labor_rate_profiles_foundation_v1.zip`
Data: 2026-06-07

## Cel

Rozdzielić automat robocizny od profilu stawki godzinowej. Automat odpowiada za to, co program liczy, a profil stawki za to, ile kosztuje godzina danego rodzaju pracy.

## Zmiany

- Dodano dynamiczny model profili stawek godzinowych oparty na rekordach `quoteRates` z `autoRole: hourlyRate`.
- Systemowe profile startowe są nieusuwalne:
  - `workshop` — Warsztatowa — 150 zł/h,
  - `assembly` — Montażowa — 250 zł/h,
  - `specialist` — Specjalistyczna — 300 zł/h,
  - `helper` — Pomocnika — 80 zł/h.
- Formularz pozycji cennika ma tryb `To jest stawka godzinowa`, który ukrywa pola automatyki czynności i pokazuje tylko nazwę, kod techniczny, kwotę i aktywność.
- Zwykłe czynności wybierają stawkę godzinową z dynamicznej listy aktywnych profili, także własnych dodanych przez użytkownika.
- WYCENA pobiera kwotę po dokładnym `rateType`/kodzie profilu, a nie po najniższej albo pierwszej stawce.

## Zgodność wsteczna

- Stawki pozostają w `fc_quote_rates_v1`; nie dodano nowego klucza storage.
- Legacy `autoRole: hourlyRate` pozostaje obsługiwane.
- Stare definicje robocizny bez własnych profili nadal korzystają z `workshop`, jeśli nie mają wskazanej stawki.
- Nie przypisano żadnej czynności na sztywno do konkretnej stawki. Użytkownik może wybrać profil stawki przy definicji czynności.

## Testy

Dodano `tools/labor-rate-profiles-foundation-smoke.js`, który sprawdza:

- istnienie i ceny czterech profili systemowych,
- nieusuwalność/systemowość profili startowych,
- dodanie własnego profilu, np. `painter`,
- walidację i unikalność kodu stawki,
- niezmienność kodu przy edycji,
- zmianę nazwy/kwoty bez zmiany kodu,
- liczenie czynności po wybranym `rateType`, nie po najniższej stawce,
- obecność UI trybu uproszczonej stawki godzinowej.

## Celowo poza zakresem

- Nie przebudowano działu CZYNNOŚCI.
- Nie dodano buildera czynności.
- Nie zmieniono wariantów szafek ani reguł okuć.
- Nie przypisano na sztywno, że konkretna czynność zawsze ma konkretny profil stawki.
