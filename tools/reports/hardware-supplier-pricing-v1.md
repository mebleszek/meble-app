# Hardware supplier pricing v1 — 2026-05-04

Zakres:
- dostawcy okuć i rabaty,
- ustawienia domyślne katalogu okuć,
- rozdzielenie ceny katalogowej, realnego zakupu i ceny do wyceny,
- filtry i sortowanie katalogu okuć,
- przygotowanie danych pod przyszłe raporty rentowności.

Poza zakresem:
- realne seed pozycje Blum/GTV/Peka/Nomet/Rejs,
- zestawy/komplety składane z pozycji,
- standardy okuć klienta w WYWIADZIE,
- automatyka okuć przy szafkach,
- snapshot okuć w WYCENIE,
- raporty rentowności runtime.

Uwagi architektoniczne:
- `catalog-store.js` jest przy progu 400+ linii. Kolejny etap store powinien wydzielić hardware boundary zamiast dalej rozbudowywać ten plik.
