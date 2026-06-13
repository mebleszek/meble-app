# Raport — podgląd oferty dla klienta v1

Paczka: `site_client_offer_preview_v1.zip`
Cache-busting: `20260613_client_offer_preview_v1`
Data: 2026-06-13

## Zakres

Dodano pierwszy podgląd handlowej oferty dla klienta w WYCENIE. Podgląd jest modalem w aplikacji i nie jest finalnym PDF-em.

## Co pokazuje podgląd

- dane firmy i inwestora,
- zakres pomieszczeń i tryb wyceny,
- zakres oferty bez cen składowych,
- podział zabudowy na strefy: dolna/stojąca, środkowa, górna/wisząca,
- kolory korpusów i frontów,
- PCV korpusu opisowo,
- materiały opisowo bez arkuszy i metrów,
- modele i ilości okuć/akcesoriów,
- montaż AGD, jeżeli występuje,
- jedną cenę końcową.

## Czego nie pokazuje klientowi

Podgląd nie pokazuje kilometrów, roboczogodzin, stawek godzinowych, arkuszy, metrów PCV, cen jednostkowych, marż ani szczegółowego kosztorysu operacyjnego.

## PDF

PDF klienta zostaje etapem końcowym programu. W tym etapie istniejącego mechanizmu PDF nie przebudowano.

## Testy

- `node --check js/app/quote/quote-client-preview.js`
- `node --check js/app/wycena/wycena-tab-shell.js`
- `node tools/client-offer-preview-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/pcv-front-color-mode-smoke.js`
- `node tools/pricing-modes-calculation-coverage-smoke.js`
- `node tools/app-dev-smoke.js`
