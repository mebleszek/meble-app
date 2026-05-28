# hardware param dictionary choices v1

Baza startowa: `site_hardware_replacement_button_visibility_fix_v1.zip`.

## Zakres

- Tekstowe parametry techniczne okuć, które mają zdefiniowane dozwolone wartości w słowniku, są w formularzu okucia wybierane przez launcher/listę aplikacyjną, a nie przez ręczne pole tekstowe.
- Wartości spoza listy słownika są celowo czyszczone przy normalizacji parametru. Istniejące ręczne wpisy nie są chronione: pole w formularzu pozostaje puste do czasu wybrania wartości ze słownika.
- Parametry tekstowe bez dozwolonych wartości nadal pozostają zwykłym polem tekstowym.
- Parametry liczbowe od-do i boolean nie zmieniły sposobu obsługi.
- W słownikach zmieniono opis pola z `Wartości podpowiedzi` na `Dozwolone wartości` i dopisano instrukcję pod ikoną `?`.

## Pliki

- `js/app/catalog/hardware-technical-params.js`
- `js/app/material/price-modal-hardware-form.js`
- `js/app/material/price-modal-hardware-dictionaries.js`
- `js/testing/material/accessories-tests.js`
- `README.md`
- `DEV.md`
- `dev_tests.html`
- `index.html`

## Decyzje

- Brak migracji starych wartości i brak zabezpieczeń dla kilku obecnych testowych pozycji katalogu.
- Brak nowego klucza storage.
- Brak zmian w backupie i retencji backupów.
- Brak zmian w import/export Excel. Istniejące wartości nadal idą przez ten sam model `technicalParams`, ale tekstowe parametry z listą są normalizowane do wartości słownika albo pustej wartości.

## Testy

- Dodano test kontraktowy, że tekstowy parametr ze słownika czyści wartość spoza listy i nie przepuszcza starych wpisów legacy.
