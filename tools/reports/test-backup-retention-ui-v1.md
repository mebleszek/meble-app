# Test backup retention / UI state v1

Zakres paczki:

- `Data safety` orphan cleanup test nie zakłada już, że w realnym localStorage istnieje dokładnie jedna sierota.
- Backupy testowe `before-tests` mają twardy limit maksymalnie 10 najnowszych kopii.
- Ręczne/programowe backupy pozostają na dotychczasowej polityce retencji.
- Panel backupów zachowuje stan otwarcia accordionów i scroll po ręcznym usunięciu backupu z listy.

Świadomie nieruszane:

- RYSUNEK,
- UI wizualne,
- format danych backupu,
- retencja ręcznych backupów programu,
- backupy przypięte/safe-state w grupie programu.
