# Raport — Robocizna: fundament automatów w cenniku v1

## Analiza stanu przed zmianą

1. Pole „Automat” było legacy polem `autoRole` w `quoteRates`. Obsługiwane role: `none`, `hourlyRate`, `cabinetBody`, `cabinetLooseShelves`.
2. Stawki robocizny były przechowywane w katalogu `quoteRates`, seedowanym przez `labor-catalog-definitions.js` i normalizowanym przez `labor-catalog.js` / `catalog-store.js`.
3. WYCENA znajdowała robociznę tak:
   - skręcenie korpusu: po `autoRole === cabinetBody` i progach wysokości,
   - półki: po `autoRole === cabinetLooseShelves`,
   - fronty: po stałym ID `labor_mount_front`,
   - zawiasy: po stałym ID `labor_mount_hinge`,
   - AGD: przez usługę AGD po nazwie z `servicePriceLookup`, nie przez roboczy automat,
   - pozycje ręczne: z draftu oferty, tylko dla pozycji z `autoRole === none`.
4. Legacy fallback zostaje: `autoRole`, ID `labor_mount_front` / `labor_mount_hinge` oraz lookup usług AGD po nazwie.

## Zmiana

- Dodano słownik `laborAutomats` z trwałymi kodami technicznymi.
- Dodano walidację unikalności, formatu i niezmienności kodu.
- Jednoznaczne istniejące stawki dostały `workAutomatCode`.
- UI cennika stawek wyceny mebli pozwala wybrać istniejący automat i utworzyć nowy aplikacyjnym modalem.
- Kod techniczny istniejącego automatu jest widoczny, ale nieedytowalny.
- `quoteCalculationRegister` przenosi `workAutomatCode` na linie robocizny i AGD.

## Zakres świadomie nietknięty

- Nie przebudowano WYCENY na builder czynności.
- Nie przebudowano działu CZYNNOŚCI.
- Nie dodano nowych wariantów szafek.
- Nie ruszono prowadnic, szuflad systemowych, cargo, podnośników ani ich logiki doboru.
- Nie przebudowano obecnego liczenia AGD — dodano tylko bezpieczne kody automatów per sprzęt.
