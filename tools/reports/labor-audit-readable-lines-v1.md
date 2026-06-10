# 2026-06-10 — Robocizna: czytelny audyt czynności v1

Paczka: `site_labor_audit_readable_lines_v1.zip`.

## Cel

Poprawić czytelność modala `Szczegóły: Robocizna szafek` po naprawie zasady `1 szafka = 1 akordeon`.

## Zmiany

- Linie robocizny nie pokazują już głównego opisu jako jednego długiego zdania sklejonego separatorami `•`.
- Dla robocizny renderer pokazuje dane jedno pod drugim: `Dotyczy`, `Ilość`, `Czas`, `Stawka`, `Warunki`, `Źródło ilości`, `Rozbicie` i `Wyliczenie`.
- Rozbicie zawiasów w robociźnie pokazuje tylko ludzką ilość per drzwiczki, np. `Lewe drzwiczki: 2 szt.`, `Prawe drzwiczki: 2 szt.`.
- Techniczne opisy typu `170° nakładany`, `reguła`, `forma krzyżowy`, wymiary frontu itp. nie są już dokładane do głównego opisu montażu zawiasu w robociźnie.
- `quoteCalculationRegister` i odchudzony snapshot zachowują strukturalne pola robocizny potrzebne do czytelnego audytu: czas, stawkę, mnożnik, gabaryt, sourceRole/sourceKind.

## Bez zmian

- Nie zmieniono wyniku WYCENY.
- Nie zmieniono automatów robocizny, `quantitySource`, warunków ani stawek.
- Nie ruszano `drawer.count`, wymagań szuflad/prowadnic, WYWIADU, plusa dodawania szafki ani modala szafki.
- Nie zmieniono flow historii ofert/statusów.

## Testy

- `node tools/labor-audit-readable-lines-smoke.js`
- `node tools/labor-cabinet-single-accordion-dedupe-smoke.js`
- `node tools/quote-details-accordion-scroll-smoke.js`
- `node tools/cabinet-drawer-requirements-smoke.js`
- `node tools/work-quantity-facts-cabinet-smoke.js`
- `node tools/labor-quantity-values-link-smoke.js`
- `node tools/app-dev-smoke.js`
- `node tools/check-index-load-groups.js`
- `node tools/index-load-groups.js`
