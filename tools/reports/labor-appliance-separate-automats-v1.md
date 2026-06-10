# Robocizna: osobne automaty montażu AGD v1

Paczka: `site_labor_appliance_separate_automats_v1.zip`

## Zakres

- Montaż AGD nie jest już traktowany jako jeden wspólny mechanizm `appliance_mount`.
- Dodano osobne techniczne automaty robocizny:
  - `dishwasher_mount` — montaż zmywarki do zabudowy,
  - `fridge_mount` — montaż lodówki do zabudowy,
  - `oven_mount` — montaż piekarnika do zabudowy,
  - `hob_mount` — montaż płyty indukcyjnej / ceramicznej,
  - `hood_mount` — montaż okapu,
  - `microwave_mount` — montaż mikrofali do zabudowy.
- Każdy automat ma własne źródło ilości `appliance.<typ>.count`, własną nazwę przyjazną, stawkę i czas bazowy w cenniku robocizny.
- Linie nadal trafiają do działu `Montaż AGD` w WYCENIE, ale cena pochodzi z cennika robocizny/stawki wyceny, nie z jednego wspólnego cennika usług AGD.
- Opcja `Bez montażu` w szafce nadal blokuje naliczenie montażu AGD.

## Ograniczenia

- Nie dodano nowych typów szafek ani nowego UI w WYWIADZIE.
- Płyta i mikrofala mają już kody i źródła pod przyszłe typy/pozycje, ale bieżący WYWIAD naliczy je dopiero wtedy, gdy pojawi się odpowiadający typ AGD.
- Nie zmieniono historii ofert, snapshotów, `drawer.count`, robocizny szafek, warunków ani audytu robocizny.

## Testy

- `tools/labor-appliance-separate-automats-smoke.js`
- Istniejące smoke testy robocizny, WYCENY, snapshotów i load order.
