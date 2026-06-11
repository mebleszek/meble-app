# 2026-06-11 — Sposoby naliczania ceny w cenniku v1

Paczka: `site_pricing_modes_v1.zip`

## Zakres

- Dodano w formularzu **Cennika robocizny i usług** pole **Sposób naliczania ceny**.
- Formularz pokazuje tylko pola używane przez wybrany sposób naliczania, żeby nie mieszać czasu, kilometrażu, progów i kwot stałych.
- Dodano obsługiwane tryby: kwota stała, cena za ilość, kwota startowa + cena za ilość, czas × stawka godzinowa, progi czasu, czas startowy + kolejne sztuki oraz zaawansowane.
- Domyślny transport `transport_distance_km` działa teraz jako **kwota startowa + cena za ilość** i może mieć `startPrice`, `includedQty` oraz cenę za km w polu `price`.
- Silnik `FC.laborCatalog.calculateDefinition()` liczy nowe tryby centralnie, bez osobnej logiki tylko dla transportu.
- WYCENA transportu korzysta z tego samego kalkulatora definicji, więc audyt może pokazać start, kilometry w cenie i płatne kilometry.
- Stawki godzinowe dalej są profilami z trybika i pozostają wybierane przy czynnościach zależnych od czasu.

## Nie ruszano

- Nie zmieniano kosztów firmy ani ich wpływu na WYCENĘ.
- Nie zmieniano magazynu danych inwestora ani OpenRouteService.
- Nie zmieniano `drawer.count`, szuflad, automatów AGD ani wymagań technicznych szafek.
- Nie dodano nowego klucza localStorage.

## Testy

- `node --check` zmienionych plików JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/pricing-modes-smoke.js` — OK.
- `node tools/app-dev-smoke.js` — OK, 109/109.
- `node tools/hourly-rates-settings-smoke.js` — OK.
- `node tools/labor-rate-profiles-restore-clean-smoke.js` — OK.
- `node tools/transport-catalog-quote-fix-smoke.js` — OK.
- `node tools/company-transport-business-costs-smoke.js` — OK.
- `node tools/boot-domcontentloaded-init-fix-smoke.js` — OK.

Cache-busting: `20260611_pricing_modes_v1`.
