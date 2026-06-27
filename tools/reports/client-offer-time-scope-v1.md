# Raport — podgląd oferty klienta: usługi w cenie v3

Build zmienionych plików: `20260628_client_offer_time_scope_v1`.

## Zakres

Doprecyzowano podgląd oferty klienta bez przechodzenia do PDF-a. Podgląd nadal pokazuje klientowi zakres i jedną cenę końcową, ale teraz rozróżnia też opisowo usługi ujęte w cenie.

## Zmiany

- `quote-client-offer-model.js` buduje `sections.includedServices` z istniejących `snapshot.lines` i `snapshot.totals`.
- Rozpoznawane zakresy: projekt techniczny, robocizna szafek, wnoszenie/logistyka, transport, montaż AGD, usługi dodatkowe.
- `quote-client-preview.js` renderuje nową sekcję `Usługi ujęte w cenie`.
- Sekcja nie pokazuje stawek, godzin, kilometrów, cen jednostkowych ani rejestru kosztów.
- `snapshot.clientOffer` mrozi nową sekcję razem ze starą ofertą.

## Poza zakresem

Nie zmieniono PDF-a, WYCENY, matematyki kosztów, CZYNNOŚCI, ORS, PCV, transportu, wnoszenia ani okuć.

## Testy

- `node tools/client-offer-preview-smoke.js`
- `node tools/app-dev-smoke.js`
