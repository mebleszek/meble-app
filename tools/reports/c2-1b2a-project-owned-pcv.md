# C2.1b.2a — kanoniczne nadpisania PCV projektu

Status: fundament domenowy, bez podłączenia starego UI PCV, MATERIAŁU, ROZRYSU ani WYCENY. Baza: `cc4d2111`, main po PR #35. D1–D6 nie są deklarowane jako naprawione w całej aplikacji.

## Dane i właściciele

Jedynym trwałym źródłem jest istniejący rekord projektu w `fc_projects_v1`. W jego `projectData[roomId].production` są trzy opcjonalne przestrzenie:

```js
{
  partOverrides: {
    [cabinetId]: { [partRoleId]: { edges: { w1, w2, h1, h2 } } }
  },
  cabinetGroupOverrides: {
    [cabinetId]: { [groupRoleId]: { edges: { w1, w2, h1, h2 } } }
  },
  setGroupOverrides: {
    [setId]: { [groupRoleId]: { edges: { w1, w2, h1, h2 } } }
  }
}
```

Wszystkie cztery flagi są boolean. Rekord roli może mieć inne pola; operacje PCV zmieniają wyłącznie `edges`, zachowując np. `grain`. Nie zapisujemy źródeł, geometrii, ilości, cutlisty ani cache. Nie ma nowego klucza storage ani automatycznej inicjalizacji projektu.

Adresy odpowiadają istniejącemu pochodzeniu:

- element: `{projectId, roomId, cabinetId, partRoleId}`;
- grupa szafki: `{projectId, roomId, ownerType:'cabinet', cabinetId, groupRoleId}`;
- grupa zestawu: `{projectId, roomId, ownerType:'set', setId, groupRoleId}`.

Opcjonalne `qty` z natywnego `sourceGroup` jest tolerowane jako dodatnia liczba całkowita, ale nie należy do adresu i nie jest zapisywane. Półki ×3 i ×5 mają jedną rolę `body.shelves`, osobną w każdej szafce. Boki lewe/prawe zachowują indywidualne role. Fronty szuflad mają m.in. oddzielne grupy `front.drawer.small` i `front.drawer.large`.

Zestaw jest właścicielem swoich grup, niezależnie od pierwszej szafki emitującej fronty. Aktualny wizard podczas edycji zachowuje `setEditId`, regenerując ID szafek; API nie przechodzi na nowego właściciela szafkowego. Zmiana/usunięcie samego `setId` oznacza innego/nieistniejącego właściciela — brak automatycznego remapowania.

## API

Moduł `js/app/project/project-pcv-overrides.js` udostępnia:

```js
FC.projectPcvOverrides.get(address)
// {ok:true, edges:{w1,w2,h1,h2}, source:'default'|'override'}
FC.projectPcvOverrides.setEdges(address, patch)
// patch: dowolny podzbiór czterech flag, wyłącznie boolean
FC.projectPcvOverrides.clearEdges(address)
// powrót do aktualnego technologicznego defaultu
// zapis: {ok:true, changed:true, edges} albo {ok:true, changed:false}
// odmowa: {ok:false, code}
```

Przykład: `setEdges({projectId:'A',roomId:'kuchnia',cabinetId:'cab-1',partRoleId:'body.side.left'}, {w2:true})`. Nie wolno interpretować `ok:false` jako zapisanej zmiany. API nie dodaje UI sukcesu ani fallbacku globalnego. Wyjątki magazynu także dają `ok:false`.

**Zakres obecnej wersji:** fizyczny projekt musi być aktualnie aktywowany istniejącą nawigacją; API nie przełącza projektów. Czytanie innego pokoju tego projektu jest możliwe przy spójnym RAM. Zapis wymaga bieżącego `uiState.roomType` oraz tego samego właściciela aktywnej sesji. Roomless/stara sesja, inne pomieszczenie lub inny `projectId` są odrzucane. Nie ma odczytu detached projektu B przez generator korzystający z ustawień projektu A.

## Weryfikacja i defaulty

Przed odczytem i zapisem sprawdzamy:

1. Kompletny, jednoznaczny adres; odrzucamy dodatkowe pola (`sourceIssues` również), mieszanych właścicieli i niebezpieczne klucze prototypu.
2. Aktualny fizyczny `projectId`, dokładnie jeden rekord, zgodny inwestor, obecny pokój i właściciel; duplikaty szafek/setu są błędem.
3. Semantyczną zgodność źródłowego pokoju RAM z aktualnym centralnym pokojem po istniejącej normalizacji i przygotowaniu do persistence. Niezapisany lub nieaktualny RAM daje `RAM_DIVERGENCE`; nie zostaje nadpisany ani przypadkowo dopisany do zapisu PCV.
4. Rolę/grupę z natywnego `getCabinetCutList`, bez polegania na starym cache `derivedFacts`. Brak roli, niejednoznaczna rola, `sourceIssues` w pasującym wierszu, nieprawidłowa geometria lub brak technologicznej dopuszczalności PCV oznacza odmowę. Invalid `3_1_2_2` jest blokowany przez istniejący resolver geometrii.
5. Poprawną strukturę istniejącego override'u. Uszkodzone kontenery i niepełne flagi nie są zastępowane fallbackiem.

Default wyznacza **istniejące** `materialEdgeStore.defaultEdgesForPart(part,cabinet)` z istniejącą kwalifikacją materiału/PCV. Nie używamy `createEdgeStore()`, nie czytamy legacy nadpisań. Grupa musi mieć spójne defaulty wszystkich pasujących wierszy. Brak override'u oznacza bieżący default, bez zapisu.

`setEdges` buduje pełne cztery flagi. Wynik równy defaultowi usuwa wyłącznie `edges` danej roli. Puste, utworzone przez operację kontenery są usuwane; istniejące pola i puste kontenery baseline są zachowywane. Dzięki temu default → override → default może naturalnie przywrócić `session.isDirty() === false`. Nie modyfikujemy `changedKeys` ani mechanizmu sesji. Identyczna efektywna wartość (także redundantny istniejący rekord równy defaultowi) to no-op; `clearEdges` pozwala jawnie usunąć taki redundantny rekord. Brak override'u przy żądaniu defaultu również jest no-op: zero begin/write/remove.

## Bezpieczny zapis, sesja i konflikty

Zmiana jest przygotowywana na kopii projektu. Przed centralnym zapisem wymagane jest `session.begin(roomId) === true` i świeża weryfikacja trwałego payloadu przez istniejące `inspectNavigationState()`. Active + durable zachowuje pierwotny snapshot i `startedAt`; failed begin pozostawia snapshot RAM, ale nie zmienia projektu. Można ponowić operację.

Następnie kontekst i rekord są ponownie sprawdzane, a zapis wykonuje:

```js
FC.project.saveConfirmed(nextProject, {expectedRecord: observedRecord})
```

Jest to opcjonalne, addytywne rozszerzenie bridge'a. Korzysta z **istniejącego** `projectStore.updateRecordConfirmed` (porównanie wersji rekordu, ponowny odczyt RAW całego kontenera przed zapisem, potwierdzenie read-back). Dotychczasowe wywołania `saveConfirmed(data)` i kontrakt `save(data)` pozostają bez zmian. Współdzielony RAM przyjmujemy dopiero po `ok === true`, potwierdzeniu pokoju w read-back i aktualnego payloadu sesji. Istniejący scoped save nadal scala wyłącznie pokój właściciela i zachowuje świeże dane pozostałych pokoi/projektów; nie zapisuje ich z nieaktualnego RAM. Nieautoryzowane lokalne zmiany poza pokojem są blokowane.

Failed central save (`false`, wyjątek, silent no-op), konflikt lub failed begin nie publikują nowego RAM. Dane niezapisane pozostają w dotychczasowym obiekcie. Sesja nie jest lokalnie commitowana ani cancelowana przez API. Udany lokalny zapis pozostaje wewnątrz globalnej sesji; normalne Cancel przywraca tylko pokój właściciela, a Save/commit utrwala zakończenie. Restart odczytuje override z projektu, także gdy trwała sesja jeszcze istnieje.

**Awaria częściowa istniejącego mechanizmu:** zapis projektu może się powieść, a zapis obserwowanej rewizji `fc_edit_session_v1` nie. API sprawdza to po zapisie i zwraca `{ok:false, code:'SESSION_UNCONFIRMED', projectSaved:true}`. Nie ogłasza pełnego sukcesu i nie wykonuje destrukcyjnej kompensacji ani lokalnego Cancel. Stary RAM i snapshot są zachowane. Po restarcie istniejąca kontrola konfliktu blokuje rollback ze starego trwałego payloadu. Integrujący UI musi pokazać informację o częściowym wykonaniu oraz zablokować dalsze działania do odzyskania zgodnego kontekstu; nie może udawać, że centralny projekt nie został zapisany. Analogiczny read-back konflikt po zapisie daje `SAVE_UNCONFIRMED` z `projectSaved:true`. Obsługa tych ścieżek nie wymaga przebudowy sesji w tym etapie.

LocalStorage nie ma atomowego compare-and-swap między kartami. Podwójny odczyt i read-back wykrywają testowane konflikty, ale nie eliminują wszystkich możliwych wyścigów pomiędzy ostatnim odczytem a setItem. Docelowy backend będzie musiał zapewnić warunkowy zapis; nowy framework/transakcje/chmura są poza zakresem.

## Kopiowanie i usuwanie

Override znajduje się poza obiektem szafki. Kopia szafki z nowym ID otrzymuje własne defaulty, nawet gdy kopiowane są pola/cache szafki. Usunięty właściciel nie jest adresowalny. Pozostały wpis jest nieaktywny i nie przechodzi na kopię z nowym ID; nie wykonujemy automatycznego pruningu ani zmian obecnej operacji usuwania. Ponowne użycie tego samego trwałego ID nie jest wspieranym sposobem tworzenia nowej szafki. Przyszłe świadome kopiowanie/cleanup produkcji powinno dostać własny bezpieczny kontrakt.

## Ochrona danych i przyszła integracja

Nie zmieniono sesji, rollbacku, geometrii, algorytmu PCV, optymalizatora, cen ani historycznych ofert. Nie ma migracji/resetu/importu, `clear()` ani usuwania kluczy. `fc_edge_v1`, `fc_material_part_options_v1`, `fc_rozrys_grain_state_v1`, katalogi, cenniki i globalne domyślne są nietknięte przez nowe API. Istniejący confirmed save nadal wykonuje swoją zwykłą kopię bezpieczeństwa projektu; nie zmieniono retencji ani mechanizmu backupów.

Do realnego użycia PCV brakuje wspólnego adaptera efektywnych ustawień produkcyjnych dla MATERIAŁU, ROZRYSU i WYCENY oraz jednoznacznej edycji wierszy mających więcej niż jeden adres (np. `Bok ×2` zawierający lewy i prawy bok). Adapter musi zachować adresy poszczególnych źródeł/grup przed agregacją, policzyć PCV dla ich ilości i dopiero potem agregować kompatybilne elementy. Stare settery UI nie mogą być przełączane fragmentarycznie. Należy też przed integracją ustalić UX odmowy przy niezapisanym RAM i stanach częściowych. Słoje/rotacja oraz ewentualny jawny import legacy nadpisań to kolejne, osobne zakresy. D1–D6 pozostają otwarte w obecnych ścieżkach użytkownika.

## Testy

`tools/project-owned-pcv-smoke.js` używa izolowanego MemoryStorage i rzeczywistych modułów projectStore/bridge/session/generatorów. Sprawdza RAW oraz RAM, nie tylko wynik funkcji. Wynik: **33/33 PASS**. Obejmuje wymagane 18 przypadków, w tym izolację A/B, room/other, boków/grup/setu, liczbę półek, geometrię frontów, restart/Cancel, zachowanie grain, uszkodzone adresy/dane, false/throw/no-op storage, stale RAM, aktywny snapshot i jawny stan częściowy po awarii zapisu rewizji sesji.

Dodatkowe regresje: 18/18 plików PASS (pochodzenie, grupy szablonowe, geometria frontów, kalkulacje wielopomieszczeniowe, owner rollback, begin durability, confirmed save, cancel failure safety, global rollback isolation, navigation blockers, project storage write failure, single write source, central read truth, derived persistence, semantic edges/options, read-only grain i drawer materials). Referencyjne kalkulacje pozostają **4 / 3 / 6 arkuszy**. Finalny pełny preflight: **PRE-FLIGHT PASS**, składnia **516/516**, kolejność ładowania **316**, smoke **112/112**, APP **110/110**, audyty zależności/storage PASS. `node --check` wszystkich pięciu zmienionych plików JS oraz `git diff --check`: PASS.
