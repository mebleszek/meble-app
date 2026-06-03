# WYCENA: ścisły dobór wariantu zawiasu po wymaganiu v1

## Paczka
`site_wycena_hinge_strict_resolver_v1.zip`

## Problem
Audyt WYCENY potrafił pokazać pozycję `170° narożny`, mimo że wymaganie w notatce było `Zawias 110° nakładany`.

Przyczyną było zbyt szerokie porównanie parametrów technicznych: kąt mógł przejść jako warunek minimalny, więc kandydat 170° mógł wygrać z właściwym wariantem 110°.

## Naprawa
- Dla wymagań zawiasów resolver WYCENY rozpoznaje kanoniczny typ kandydata z jego parametrów technicznych.
- Gdy wymaganie jest kanoniczne, kandydaci o innym kanonicznym typie są odrzucani.
- `110° nakładany` nie może dobrać `170° narożny`.
- `równoległy wpuszczany` nie może dobrać zwykłego `110°`.
- `lodówkowy nakładany` nie może dobrać zwykłego zawiasu.

## Zachowane
- Jeżeli wymaganie ma `catalogOptionSourceItemIds`, WYCENA nadal może dobrać pozycję bezpośrednio z wariantu wybranego w panelu.
- Preferencja producenta z WYWIADU nadal działa.
- Dla zawiasów WYCENA nadal bierze aktualne wymagania z `cabinet-hardware-requirements`.

## Test
`tools/wycena-hinge-requirement-override-smoke.js`

Test obejmuje:
- domyślny dobór 110°,
- legacy 110° bez source IDs,
- ręczny override na równoległy wpuszczany,
- stale cutlist, który nie może nadpisać centralnego wymagania.

## Cache-busting
`20260603_wycena_hinge_strict_resolver_v1`
