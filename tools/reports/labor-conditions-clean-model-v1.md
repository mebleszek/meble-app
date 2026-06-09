# labor-conditions-clean-model-v1

## Cel

Korekta modelu po usunięciu pola Automat z robocizny: bez migracji starych reguł `autoRole` i bez pól specyficznych `heightMinMm/heightMaxMm`.

## Ustalenie

Program jest tworzony, nie łatany produkcyjnie, więc nie utrzymujemy starych automatów jako aktywnej migracji. Obowiązuje czysty model:

- `quantitySource` — ile liczyć,
- `conditions` — kiedy liczyć,
- `conditions[].source` — fakt warunku,
- `conditions[].min` / `conditions[].max` — uniwersalny zakres.

Kod faktu typu `cabinet.height_mm` zostaje, bo jest potrzebny do odczytu danych. Nie tworzy jednak osobnych pól wysokości; zakres jest zawsze wspólny dla każdego faktu.

## Antyregresja

- `autoRole` nie występuje w aktywnych plikach runtime JS.
- `heightMinMm` i `heightMaxMm` nie są zwracane przez normalizację definicji robocizny.
- Warunki z brakiem danych nadal nie liczą reguły po cichu.
- Po korekcie użytkownika nie dodawać aktywnych warunków frontów bez osobnego etapu.
