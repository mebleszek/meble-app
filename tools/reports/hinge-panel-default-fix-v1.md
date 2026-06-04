# Hinge panel default fix v1

## Problem
Panel wymagań w WYWIADZIE potrafił pokazać `107°` jako domyślne wymaganie szafki, mimo że preferencja była ustawiona na Blum i reguła szafki powinna pozostać standardowym `110° nakładany`.

Drugi objaw: kliknięcie `Zmień` potrafiło nie otworzyć wyboru, a mimo to aktywować/przestawić stan panelu.

## Przyczyna
Kanoniczny typ `hinge_110_overlay` był zasilany przez scaloną opcję katalogową. Jeżeli w katalogu pojawił się GTV 107° w klasie `standardowy 90–120°`, panel mógł przepisać parametry produktu na wymaganie szafki.

## Naprawa
- Kanoniczne wymagania szafki wróciły do fabryk reguł technicznych programu.
- Katalogowe produkty są kandydatami WYCENY, nie źródłem domyślnego kąta w WYWIADZIE.
- `Zmień` nie zapisuje override, jeśli użytkownik nie dostał i nie potwierdził wyboru.
- Dodano test regresyjny dla pojedynczego frontu i kąta 110°.

## Cache
`20260604_hinge_panel_default_fix_v1`
