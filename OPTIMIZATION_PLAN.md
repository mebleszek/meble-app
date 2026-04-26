# OPTIMIZATION_PLAN — plan wspólnych mechanik i porządkowania

Ten plik trzyma plan optymalizacji, scalania duplikacji i kolejności porządkowania. `DEV.md` zostaje krótką mapą zasad pracy, a `CLOUD_MIGRATION.md` trzyma tylko decyzje dotyczące danych, storage i przyszłej chmury.

## Cel

Porządkować aplikację etapami bez robienia jednego wielkiego modułu `shared` na wszystko. Wspólne mechaniki łączyć tylko wtedy, gdy mają realnie wspólny kontrakt, testy i podobną odpowiedzialność.

## Zasady scalania

1. Najpierw kontrakt/test, potem refaktor.
2. Łączyć mechaniki naprawdę wspólne, nie tylko podobnie wyglądające.
3. Nie przenosić logiki na siłę, jeśli działy mają podobny UI, ale inną logikę biznesową.
4. Nie tworzyć dużego `shared`-worka. Moduły wspólne mają być małe i nazwane odpowiedzialnością.
5. UI można ujednolicać tylko według zatwierdzonych wzorców aplikacji i bez samowolnej zmiany wyglądu.
6. Dane i storage traktować zgodnie z `CLOUD_MIGRATION.md`: user data, cache, UI state i test data muszą mieć jasne granice.

## Mapa wspólnych mechanik

### UI

- modale: potwierdzenia, informacje, panelowe okna wyboru, modale formularzy,
- przyciski: `Wyjdź`, `Wróć`, `Anuluj`, `Zapisz`, `Zatwierdź`, `Dodaj`, akcje destrukcyjne,
- accordiony i listy rozwijane,
- checkbox/chip/select launchery,
- ikony SVG,
- raporty i widoki wyników testów,
- formularze edycji/dodawania rekordów.

### Dane i domena

- storage/repozytoria/adapters,
- import/export/backup/snapshoty,
- formatki, okleiny i materiały,
- projekty, pomieszczenia i powiązanie z inwestorem,
- statusy projektu i ofert,
- katalogi/cenniki/zlecenia usługowe,
- geometria i wizualizacja RYSUNEK/ROZRYS — tylko ostrożnie, po testach kontraktowych.

## Duplikacje i wspólne obszary

| Obszary | Kandydat do wspólnej mechaniki | Ryzyko | Kolejny bezpieczny krok |
| --- | --- | --- | --- |
| Materiał + ROZRYS | formatki, okleiny, materiały, snapshot wejściowy | średnie | najpierw wspólny model danych i testy porównujące wynik |
| Inwestor + Wycena | status projektu, zaakceptowane oferty, historia ofert | wysokie | kontrakt statusów i testy synchronizacji przed dalszym splittem |
| Backup + Testy | raporty danych, audyt pamięci, cleanup testów | niskie/średnie | utrzymać narzędzia pamięci w jednym wejściu `dev_tests.html` i w małych modułach |
| Cenniki + Zlecenia usługowe + Wycena | katalogi, ceny, stawki, snapshot wartości użytych w ofercie | średnie | lokalne repo katalogów i granica snapshotu ofertowego |
| ROZRYS + RYSUNEK | geometria/wizualizacja | wysokie | nie łączyć przed usunięciem długów RYSUNKU i testami kontraktowymi |
| UI modali w działach | shell modala, stopka akcji, close/discard flow | średnie | wydzielać tylko mechanikę, nie zmieniać wyglądu bez zgody |

## Kolejność optymalizacji

### Etap 1 — niskie ryzyko

1. Utrzymać split toolingowy `tools/app-dev-smoke.js`, żeby runner APP nie mieszał listy plików, mini-DOM, storage mocka i orkiestracji.
2. Utrzymywać źródłowy audyt storage przez `tools/local-storage-source-audit.js`.
3. Przy każdej większej paczce sprawdzać, czy nowy kod nie dokłada bezpośredniego, rozproszonego `localStorage`.
4. Porządkować raporty/testy tylko w obrębie istniejącego wejścia `dev_tests.html`.

### Etap 2 — dane i katalogi

1. Materiał + ROZRYS: wspólny model formatek i oklein.
2. Cenniki/katalogi: jednoznaczne repozytoria lokalne i snapshot wartości użytych w ofercie.
3. Projekty/inwestorzy: stopniowo ograniczać stare równoległe sloty projektów bez ukrytej migracji danych.

### Etap 3 — większe moduły

1. RYSUNEK: najpierw usunąć systemowe dialogi i wzmocnić testy, dopiero potem ciąć monolit.
2. ROZRYS/RYSUNEK: rozważać wspólne helpery geometryczne dopiero po rozdzieleniu renderu, interakcji i domeny.
3. Wspólne UI: konsolidować tylko sprawdzone mechaniki modali/accordionów/list, bez zmiany zatwierdzonych styli.

## Kandydaci na przyszłe moduły wspólne

- `js/app/shared/ui/modal-actions.js` — logika stopki `Wyjdź/Anuluj/Zapisz` po zatwierdzeniu kontraktu.
- `js/app/shared/ui/accordion.js` — wspólna mechanika accordionów bez narzucania wyglądu.
- `js/app/shared/ui/icons.js` albo dalsze rozwinięcie `js/app/ui/app-icons.js`.
- `js/app/shared/data/storage-source-audit.js` — tylko jeśli audyt storage ma trafić także do UI, nie tylko do Node tooling.
- `js/app/shared/domain/material-parts.js` — formatki/płyty/elementy na styku Materiał + ROZRYS.
- `js/app/shared/domain/edges.js` — model oklein i stron oklejania.
- `js/app/shared/domain/project-status.js` — statusy projektu/ofert po ustabilizowaniu kontraktu.
- `js/app/shared/domain/export-import.js` — jeśli backup/export/import zaczną mieć wspólne kontrakty poza obecnym data-safety.

## Audyt źródeł storage — stan 2026-04-26

Źródłowy audyt uruchamiany komendą:

```bash
node tools/local-storage-source-audit.js
```

Bieżący wynik dla katalogu `js`:

- pliki z użyciem storage: 25,
- referencje storage razem: 217,
- największa część to test tooling: 146 referencji,
- właściwa aplikacja poza testami: 71 referencji,
- kontrolowane granice storage: `js/app/shared/storage.js`, `data-storage-*`, `data-backup-*`, store domenowe i `investor/session.js`,
- obszary do dalszego wygaszania bezpośrednich zapisów: `js/app.js`, `js/boot.js`, `js/app/investor/investor-project.js`, `js/app/material/*`, `js/app/rozrys/*`.

Wniosek: nie trzeba robić ukrytej migracji w tej paczce, ale każdy następny etap danych powinien przesuwać zapis/odczyt do store/repository/adaptera zamiast dopisywać kolejne bezpośrednie użycia `localStorage`.
