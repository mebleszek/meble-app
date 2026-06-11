# hourly-rates-settings-v1

Data: 2026-06-11
Paczka: `site_hourly_rates_settings_v1.zip`
Cache-busting: `20260611_hourly_rates_settings_v1`

## Cel

Przenieść zarządzanie profilami stawek godzinowych z cennika robocizny/usług do trybika bez zmiany logiki liczenia robocizny. Czynności czasowe nadal wybierają konkretny profil stawki godzinowej, a użytkownik nadal może dodawać własne stawki.

## Zmiany

- Dodano `FC.hourlyRatesSettings` jako fasadę ustawień stawek godzinowych firmy.
- Dodano widok trybika **Stawki godzinowe firmy**.
- Stawki systemowe można edytować nazwą przyjazną, ceną PLN/h, notatką i aktywnością.
- Własne stawki można dodawać w trybiku; kod techniczny nowej stawki jest wpisywany przy tworzeniu, a po zapisie jest zablokowany.
- Źródłem prawdy dla WYCENY pozostaje `quoteRates`, więc stare mechanizmy `FC.laborCatalog.buildHourlyRates()` i wybór profilu przy czynności czasowej nadal działają.
- Cennik robocizny/usług filtruje definicje stawek godzinowych i nie pokazuje już kategorii **Stawki godzinowe**.
- Ukryto checkbox tworzenia stawki godzinowej w formularzu cennika.
- Zmieniono nazwę okna na **Cennik robocizny i usług**.
- Zmieniono etykietę WYCENY **Robocizna / stawki wyceny** na **Usługi dodatkowe** bez ukrywania zer.

## Poza zakresem

- Nie zmieniono jeszcze transportu na model `kwota startowa + kilometry`.
- Nie zmieniono silnika robocizny, automatów AGD, `drawer.count`, kosztów firmy ani danych inwestora.

## Testy

- `node --check` zmienionych JS — OK
- `node tools/check-index-load-groups.js` — OK
- `node tools/hourly-rates-settings-smoke.js` — OK
- `node tools/labor-rate-profiles-restore-clean-smoke.js` — OK
- `node tools/transport-catalog-quote-fix-smoke.js` — OK
- `node tools/company-transport-business-costs-smoke.js` — OK
- `node tools/boot-domcontentloaded-init-fix-smoke.js` — OK
- `node tools/app-dev-smoke.js` — OK, 109/109
