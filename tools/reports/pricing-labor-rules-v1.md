# Pricing labor rules v1 — 2026-05-03

## Baza

Start: `site_optimization_checkpoint_v1.zip`.

## Zakres

Wprowadzono pierwszy etap nowego modelu robocizny/czynności w meble-app. Zmiana dotyczy tylko czynności i wewnętrznego rozbicia kosztów WYCENY; nie zmienia RYSUNKU, materiałów, okuć ani publicznego PDF dla klienta.

## Nowe granice

- `js/app/pricing/labor-catalog-definitions.js` — stałe, typy i domyślne definicje robocizny.
- `js/app/pricing/labor-catalog.js` — normalizacja, opis i kalkulacja uniwersalnych definicji robocizny.
- `js/app/wycena/wycena-core-labor.js` — zbieranie wewnętrznych kosztów robocizny po szafkach z zachowaniem numerów szafek z WYWIADU.

## Model robocizny

Uniwersalna definicja robocizny obsługuje opcjonalne składniki:

- blok czasu `0.25 h`, `0.5 h`, `1 h`,
- stawkę godzinową: warsztatowa, montażowa, pomocnik, specjalistyczna,
- ilość liniową,
- progi/pakiety ilościowe,
- start + kolejne sztuki,
- dopłatę gabarytową `PLN/m³`,
- gabarytoczas: progi objętościowe albo `h/m³`,
- kwotę stałą,
- mnożnik domyślny,
- zakres wysokości dla automatu skręcenia korpusu.

Domyślne pozycje startowe obejmują stawki godzinowe, skręcenie korpusu wg wysokości, półki luźne jako pakiet oraz wybrane usługi przy szafce: otwór fi 60, wcięcie na rury, zabudowa rur, przegroda pionowa długa.

## WYWIAD / szafki

- Dodano `js/app/cabinet/cabinet-modal-labor.js`, który w modalu szafki pozwala wybrać aktywne usługi robocizny przypięte do `usage: cabinet` i `autoRole: none`.
- Wybrane dodatki zapisują się w szafce jako `laborItems` (`rateId`, `qty`, opcjonalnie `note`).
- To jest wewnętrzny wybór czynności do późniejszej WYCENY, nie pozycja klienta/PDF.

## WYCENA

- Wewnętrzne koszty robocizny szafek trafiają do snapshotu jako `lines.labor`.
- Podgląd WYCENY pokazuje sekcję `Robocizna — szafki` z listą szafek po numerach z WYWIADU.
- Każdą szafkę można rozwinąć w podglądzie, żeby zobaczyć szczegóły składników: normoczas, stawka, mnożnik, gabaryt, dopłata, kwota.
- `quote-pdf.js` nie dostał renderu `lines.labor`, więc szczegóły są tylko wewnętrzne i nie są pokazywane klientowi.

## Cennik

Sekcja `Stawki wyceny mebli` pozostaje miejscem edycji robocizny. Formularz dla `quoteRates` został rozszerzony o pola reguł robocizny, a lista pokazuje opis reguły zamiast wymagać prostej ceny.

Ręczne stawki WYCENY filtrują automatyczne i wewnętrzne definicje robocizny, żeby reguły korpusów/gabarytu nie wpadały do ręcznych pozycji klienta.

## Architektura / chmura

- Nie dodano nowych bezpośrednich zapisów `localStorage`.
- Robocizna używa istniejącego katalogu `quoteRates`, ale zapisuje pełniejszy model definicji.
- Snapshot oferty zamraża przeliczone linie robocizny, żeby późniejsza zmiana cennika nie przeliczała starej oferty.
- Później katalog robocizny można wydzielić w chmurze jako osobną kolekcję lub namespace katalogu wycen.

## Testy

- `node --check` dla nowych/zmienionych JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 39/39 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `FC.wycenaDevTests.runAll()` w Node — 113/113 OK.
- `node tools/local-storage-source-audit.js` — OK.
- `node tools/dependency-source-audit.js` — OK.
- `node tools/wycena-architecture-audit.js` — OK.
