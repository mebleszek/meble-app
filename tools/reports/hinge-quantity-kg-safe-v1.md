# Bezpieczna ilość zawiasów w kg v1

## Zakres

Paczka: `site_hinge_quantity_kg_safe_v1.zip`
Cache-busting: `20260605_hinge_quantity_kg_safe_v1`

Zmiana centralizuje i porządkuje liczenie ilości zawiasów po najnowszej paczce `site_hinge_tipon_dynamic_features_v1.zip`.

## Zmienione pliki

- `js/app/cabinet/front-hardware-weights.js`
- `js/app/cabinet/front-hardware-fronts.js`
- `js/app/cabinet/front-hardware-hinges.js`
- `js/app/cabinet/front-hardware.js`
- `js/app/cabinet/cabinet-hardware-requirements.js`
- `index.html`
- `tools/cabinet-hinge-quantity-kg-smoke.js`
- `DEV.md`
- `README.md`

## Nowa reguła ilości

```text
wynik = max(zawiasy_z_wagi, zawiasy_z_wysokości) + dodatek_szerokości
```

Waga jest liczona w kg z `estimateFrontWeightKg()`. Nie ma już przeliczenia na funty.

### Waga

- do 6 kg: 2
- >6 do 12 kg: 3
- >12 do 17 kg: 4
- >17 do 20 kg: 5
- >20 do 22 kg: 6
- powyżej 22 kg: `6 + ceil((kg - 22) / 5)`

### Wysokość

- do 1000 mm: 2
- >1000 do 1700 mm: 3
- >1700 do 2200 mm: 4
- >2200 do 2400 mm: 5
- >2400 do 2600 mm: 6
- >2600 do 2800 mm: 7
- powyżej 2800 mm: `7 + ceil((mm - 2800) / 200)`

### Szerokość

- do 600 mm: +0
- powyżej 600 mm: `ceil((szerokośćMm - 600) / 100)`

Czyli szerokość daje teraz `+1` za każde rozpoczęte 10 cm ponad 60 cm.

## Naprawa szuflada + drzwi

Dodano `resolveDrawerDoorCount()`. Dla `szuflada_drzwi` front szuflady zostaje w materiałach, ale nie trafia do `getDoorFrontPanelsForHinges()`. Legacy sytuacja, gdzie `frontCount` mógł oznaczać `1 front szuflady + liczba drzwi`, jest czytana jako liczba drzwi po odjęciu szuflady.

## Zestawy

`getSetDoorFrontPanels()` nadal jest wejściem dla frontów zestawu. Korpus prowadzący liczy zawiasy z realnych frontów zestawu, a korpusy nieprowadzące zwracają 0, więc nie ma dublowania.

## Testy

Uruchomiono:

```bash
node tools/cabinet-hinge-quantity-kg-smoke.js
node tools/app-dev-smoke.js
node tools/cabinet-hinge-tipon-spring-smoke.js
node tools/cabinet-hardware-requirements-live-edit-smoke.js
node tools/wycena-hinge-requirement-override-smoke.js
```

Wyniki:

- `OK cabinet-hinge-quantity-kg smoke`
- `APP smoke testy: 109/109 OK`
- `OK cabinet-hinge-tipon-spring smoke`
- `OK cabinet-hardware-requirements-live-edit smoke`
- `OK wycena-hinge-requirement-override smoke`

## Poza zakresem

Nie zmieniano UI, PRO100, ROZRYS/Optimax, PCV/obrzeży, backupów, import/export Excel ani modelu snapshotów ofert.
