# status-reconcile-v1

## Cel

Naprawić regresję, w której akceptacja wyceny wstępnej dla jednego lub części pomieszczeń resetowała ręczne statusy `Pomiar/Wycena` innych pomieszczeń do `Nowy`.

## Zmiany runtime

- `project-status-snapshot-flow.js` przed akceptacją snapshotu zapamiętuje poprzednio wybrane oferty i rozpoznaje pokoje zwolnione po zmianie zaakceptowanego zakresu.
- `commitAcceptedSnapshot()` przekazuje do centralnego status sync ochronę przed resetem pokoi bez snapshotów oraz ochronę przed cofaniem postępu statusu.
- `project-status-sync.js` obsługuje `preserveForwardProgress`: snapshot może przesunąć pokój do przodu, ale nie cofa go z dalszego etapu bez jawnej decyzji użytkownika.
- `project-status-manual-guard.js` dla wspólnych zaakceptowanych ofert zwraca modal decyzyjny: `Tylko pokój` albo zaakceptowany zakres. Dla konfliktu solo + wspólna oferta również wymaga decyzji.

## Zmiany testowe

Dodano `js/testing/wycena/suites/status-reconciliation-regression.js` z kontraktami dla przypadków:

1. Akceptacja wstępnej solo nie resetuje ręcznego `Pomiar` poza zakresem.
2. Akceptacja wstępnej solo nie resetuje ręcznej `Wycena` poza zakresem.
3. Akceptacja wspólnej wstępnej zmienia tylko jej zakres i zachowuje obcy ręczny status.
4. Jedna wspólna zaakceptowana oferta wymaga modala: tylko pokój albo cały zakres.
5. Oferta solo i wspólna dla tego samego pokoju wymagają decyzji zakresu.
6. Akceptacja oferty nie cofa pokoju, który jest już dalej w procesie.

Zaktualizowano istniejący test investor-integration pod nową zasadę modala decyzyjnego dla wspólnej zaakceptowanej oferty.

## Wyniki testów

- `node --check` dla zmienionych JS — OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 32/32 OK.
- `FC.wycenaDevTests.runAll()` w Node — 109/109 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/local-storage-source-audit.js` — OK.
- `node tools/dependency-source-audit.js` — OK.
- `node tools/wycena-architecture-audit.js` — OK.

## Nie ruszano

- RYSUNEK.
- Backupi i retencja backupów.
- Storage/model danych trwałych.
- UI poza istniejącym modalem decyzyjnym zakresu.
