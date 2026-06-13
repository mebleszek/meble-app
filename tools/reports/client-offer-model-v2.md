# client-offer-model-v2

Etap normalizuje podgląd oferty klienta przez dodanie zamrożonego modelu `snapshot.clientOffer`.

## Zakres

- Nowy moduł: `js/app/quote/quote-client-offer-model.js`.
- `quote-snapshot.js` buduje `clientOffer` przy tworzeniu snapshotu.
- `quote-snapshot-store.js` zachowuje `clientOffer` przy zapisie/odczycie historii.
- `quote-client-preview.js` renderuje podgląd z `clientOffer`, a nie z bieżącego projektu.
- Test `tools/client-offer-preview-smoke.js` sprawdza zamrożenie firmy, inwestora i stref po zmianie danych runtime.

## Granice

Nie ruszano PDF, WYCENY, PCV, ORS/transportu, kosztów firmy, stawek, `drawer.count`, AGD, wymagań technicznych, materiałów ani okuć.
