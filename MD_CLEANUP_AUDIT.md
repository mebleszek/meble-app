# MD cleanup audit — 2026-06-14

Cel: wskazać, co można odchudzić bez ruszania działania aplikacji. W tej paczce nie usuwam dużej historii na ślepo — to byłoby ryzykowne, bo część wpisów zawiera zasady, których trzeba pilnować przy kolejnych etapach.

## Największe pliki

- `DEV.md` — ok. 273 KB. Zawiera aktywne zasady oraz bardzo długi dziennik zmian. Do odchudzenia: zostawić zasady + ostatnie 10–15 etapów, a starsze wpisy przenieść do jednego archiwum albo skrócić do indeksu.
- `DEV_HISTORY_20260425.md` — ok. 248 KB. To archiwum historyczne. Jeżeli nie jest już realnie czytane przy pracy, można je spakować/usunąć z paczek wdrożeniowych, ale zostawić w repo albo backupie.
- `README.md` — ok. 159 KB. Jest zdublowany z `DEV.md`. Do odchudzenia: README powinien opisywać uruchomienie, strukturę i ostatni build, a nie pełną historię wszystkich paczek.
- `CLOUD_MIGRATION.md` — ok. 87 KB. Do odchudzenia: zostawić zasady chmurowe i aktualne decyzje, a stare wpisy historyczne przenieść do archiwum.
- `OPTIMIZATION_PLAN.md` — ok. 65 KB. Plan historyczny; można skrócić do statusu aktualnego i listy otwartych tematów.
- `tools/reports/*.md` — dużo małych raportów etapowych. Program ich nie używa runtime. Można je usunąć z paczek dla użytkownika albo przenieść do archiwum raportów, jeżeli nie są potrzebne przy bieżącej pracy.

## Bezpieczne cięcie na następny etap

1. `README.md`: zostawić tylko opis projektu, deploy, testy, aktualny build i linki do dokumentów.
2. `DEV.md`: zostawić zasady pracy + ostatnie aktywne decyzje, bez pełnego dziennika od kwietnia.
3. `CLOUD_MIGRATION.md`: zostawić stałe zasady danych/chmury + aktualne modele, stare wpisy historyczne przenieść do archiwum.
4. `tools/reports/*.md`: wyłączyć z paczek wdrożeniowych albo przenieść do `docs/archive/reports/`.
5. Nie usuwać bez decyzji: `QUOTE_CALCULATION_REGISTER.md`, `DEPENDENCY_MAP.md`, `BACKUP.md`, bo zawierają aktywne granice i dane kontrolne.

## Wniosek

Największy zysk da nie dokładanie kolejnych pełnych raportów do `README.md` i `DEV.md`. Od teraz wpisy powinny być krótkie, a pełne raporty tylko wtedy, gdy naprawdę są potrzebne.
