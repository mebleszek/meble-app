# carrying-disassembled-elements-v2 — raport

Data: 2026-06-14
Paczka: `site_carrying_disassembled_elements_v2.zip`
Baza: `site_carrying_lift_logistics_v1.zip`

## Cel

Uprościć i urealnić automat wnoszenia po uwagach z testu praktycznego:

- nie liczyć udźwigu windy,
- nie traktować kabiny windy jako pełnego kontenera 3D,
- sprawdzać przekątne tylko dla płaskich elementów po rozkręceniu,
- po rozkręceniu liczyć po schodach wyłącznie duże elementy, które nie weszły do windy.

## Zmienione moduły

- `js/app/pricing/carrying-logistics.js`
- `js/app/investor/investor-carrying.js`
- `js/app/pricing/work-quantity-facts.js`
- `js/app/pricing/work-quantity-sources.js`
- `js/app/pricing/labor-catalog-definitions.js`
- `js/app/wycena/wycena-core-labor.js`
- `tools/carrying-lift-logistics-smoke.js`

## Reguły v2

### Korpus w całości

Korpus mieści się do windy tylko wtedy, gdy jedna para wymiarów przejdzie przez drzwi windy, a trzeci wymiar zmieści się w głębokości windy. Logika nie sprawdza już szerokości kabiny ani udźwigu.

### Rozkręcenie

Jeżeli korpus nie mieści się do windy / idzie po schodach i przekracza próg wagowy, uruchamia się osobny automat rozkręcenia i ponownego skręcenia.

Po rozkręceniu program sprawdza duże płaskie elementy z formatek korpusu, m.in. boki, plecy, przegrody i długie wieńce.

### Przekątne płaskich elementów

Dla boku/płaskiego elementu program dopuszcza przekątną drzwi i przekątną windy. Warunek krytyczny: element może wejść po przekątnej kabiny tylko wtedy, gdy drugi wymiar elementu mieści się w szerokości drzwi windy.

Przykład: bok 220 × 60 cm przy drzwiach 80 cm może być sprawdzony po przekątnej; bok 220 × 90 cm nie przejdzie przez drzwi 80 cm, nawet jeśli przekątna windy jest długa.

### Wnoszenie po rozkręceniu

Wnoszenie po schodach jest doliczane jako:

`15 min + 5 min × poziomy`

pomnożone przez liczbę dużych elementów, które nie weszły do windy. Dla rozkręconych elementów liczony jest 1 pomocnik na element.

Jeżeli wszystkie duże elementy po rozkręceniu mieszczą się do windy, program dolicza rozkręcenie/składanie, ale nie dolicza wnoszenia po schodach dla tych elementów.

## Testy

Zaktualizowano `tools/carrying-lift-logistics-smoke.js` o scenariusze:

- ciężki korpus bez windy jest rozkręcany, a po schodach liczone są duże elementy,
- bok mieszczący się przez drzwi i po przekątnej windy nie trafia do schodów,
- bok szerszy niż drzwi windy nie może przejść tylko dlatego, że przekątna windy jest długa,
- cennik nadal ma dwie osobne pozycje: wnoszenie i rozkręcenie/składanie.
