# CLOUD-1B — selektywny dokument jednego inwestora i projektu

Baza: `main` po PR #49, `98fffb87`. Implementacja na osobnej gałęzi; przed scaleniem nie należy opisywać jej jako już dostępnej w opublikowanej aplikacji. Zakres: wewnętrzne przygotowanie dokumentu w RAM na syntetycznych danych. Bez UI, pobierania pliku, uploadu, importera, SDK, uwierzytelnienia i wyboru dostawcy.

Docelowe decyzje pozostają w [CLOUD_MIGRATION.md](../../CLOUD_MIGRATION.md): automatyczny autorytet chmury bez zmian UI, zachowanie Zapisz/Anuluj, cel 0 zł stałych opłat. Ręczne wywołanie API w teście nie jest ręcznym workflow użytkownika ani ukończeniem migracji.

## API i odpowiedzialności

```js
const result = await FC.projectSelectiveExport.build({
  investorId: 'inv-test', projectId: 'physical-project-test', purpose: 'pilot'
});
// {ok:true, document, utf8Bytes, dependencies, warnings}
// albo dokładnie {ok:false, code, path}
```

- `project-export-contract.js`: zamknięta, rekursywna allowlista, walidacja i projekcja, kanonizacja oraz raport referencji. Żadnego storage ani normalizowania źródła.
- `project-selective-export.js`: ścisły RAW, kontekst i sesja, wybrany zakres, dokument, WebCrypto SHA-256, rozmiar i końcowy świadek świeżości. Kod nie wywołuje funkcji zapisu, odzyskiwania ani API chmurowego.
- `storage.readRawStrict(key)`: rozróżnia brak klucza od odmowy odczytu; nie pokazuje komunikatów, nie aktualizuje dirty cache i nie parsuje/naprawia JSON.
- `session.inspectExportState()`: czysto odczytowa bramka istniejących dowodów. Sprawdza prywatny latch niepotwierdzonego zapisu, aktywność, snapshot/durable/właściciela oraz obecność trwałego payloadu. Nie zmienia `lastError`, baseline, snapshotu ani semantyki Save/Cancel i nie wywołuje `canSaveProject()`.
- Skrypty rejestrowane wyłącznie technicznie w index/dev_tests i mapie grup. Nie uruchamiają eksportu podczas startu/renderu; brak nowej kontrolki.

## Format i integralność

```json
{
  "kind": "meble-app-project-export",
  "version": 1,
  "profile": "native-project-v1",
  "projectSchemaVersion": 12,
  "metadata": {"exportedAt": "2026-10-15T12:00:00.000Z", "purpose": "pilot"},
  "payload": {"investor": {}, "project": {}},
  "integrity": {
    "algorithm": "SHA-256",
    "canonicalization": "sorted-json-v1",
    "payloadSha256": "<64 cyfry hex>",
    "documentSha256": "<64 cyfry hex>"
  }
}
```

Powyższy szkielet ilustruje opakowanie; puste rekordy payloadu nie przejdą walidacji. Pełne syntetyczne rekordy i rzeczywiste hashe buduje smoke, nie dane przeglądarki użytkownika.

Kanonizacja sortuje klucze obiektów, zachowuje kolejność tablic i typy, emituje zwarty JSON UTF-8. Niedozwolone są wartości spoza JSON, NaN/Infinity i samotne surrogaty. `payloadSha256` obejmuje sam payload; data eksportu nie zmienia tego hasha. `documentSha256` obejmuje cały dokument **bez całego pola integrity**. Końcowe `utf8Bytes` obejmuje również integrity. SHA-256 to suma integralności, nie podpis, uwierzytelnienie ani dowód właściciela chmury.

Limit: **819 200 bajtów (800 KiB)**. Nadmiar oznacza `EXPORT_SIZE_LIMIT`, bez obcinania, kompresowania ani dzielenia na dokumenty. Limit jest tymczasowy dla testu, nie jest limitem docelowego produktu ani dowodem zmieszczenia w finalnym dokumencie dowolnego dostawcy.

## Dokładna allowlista profilu v1

Pola opcjonalne nie są dodawane, brakujące wartości nie są wypełniane. Obsłużone pola zachowują typ i treść. Wymagane rdzenie: tożsamość/datowanie inwestora; tożsamość/właściciel/nazwa/status/datowanie/liczniki/roomKeys/projectData projektu; schemaVersion 12; meta z przypisanym inwestorem, projektowym markerem PCV, roomOrder i roomDefs; każdy pokój z cabinets/fronts/sets/settings/preferences; każda szafka z id/type/subType/width/height/depth/details. Identyfikatory muszą być niepuste i jednoznaczne, daty createdAt/updatedAt dodatnimi całkowitymi znacznikami ms z poprawną kolejnością. Nie generujemy nowych wartości.

| Źródło → eksport | Jawnie dozwolone pola / walidacja |
|---|---|
| inwestor → `payload.investor` | id, kind (person/company), name, companyName, ownerName, phone, email, city, address, source, nip, notes (wyłącznie pusty), addedDate (poprawne YYYY-MM-DD), createdAt, updatedAt. Dla osoby wymagana nazwa, dla firmy companyName. |
| carrying → investor.carrying | floorNumber, elevatorStatus (pusty/yes/no), elevator.doorWidthCm/doorHeightCm/cabinDepthCm/cabinHeightCm, note (pusty). |
| transport → investor.transport | distanceKm, durationMin, source, provider, status, calculatedAt, origin, destination, routeProfile, originHash, destinationHash, addressHash, routeDistanceMeters, routeDurationSeconds, orsMapsUrl; note i lastError wyłącznie puste (swobodna diagnostyka może zawierać sekrety), originGeocode/destinationGeocode wyłącznie puste obiekty. Nie ma zamkniętego kontraktu pełnych odpowiedzi geocodera; niepuste są odrzucane. |
| fizyczny rekord → `payload.project` | id, investorId, title, status, createdAt, updatedAt, roomKeys, roomCount, cabinetCount, projectData. Liczniki i roomKeys zgodne z rzeczywistymi pokojami/szafkami. |
| projectData → project.projectData | schemaVersion = 12; meta; pokoje pod ich oryginalnymi kluczami. Bez normalizowania do nowszej wersji. |
| projectData.meta → to samo miejsce | assignedInvestorId, productionPcvMode = project, roomOrder, roomDefs, opcjonalny projectStatus. Definicja: id/baseType/name/label, opcjonalne legacy/projectStatus/lastManualProjectStatus. Definicje i roomOrder muszą mieć ten sam zakres, każde ID musi wskazywać istniejący pokój. |
| pokój → ten sam roomId | cabinets, fronts, sets, settings, preferences, production, layout. |
| settings → to samo miejsce | roomHeight, bottomHeight, legHeight, counterThickness, gapHeight, ceilingBlende; skończone nieujemne liczby lub natywne liczbowe stringi. |
| preferences → to samo miejsce | finishStandard, blendStandard, hardwareManufacturer; zones.lower/middle/upper: bodyColor/frontMaterial/frontColor/backMaterial/openingSystem/bodyPcvMode/bodyPcvCustomColor; hardwareProducers: hinges/drawers/lifts/sliding/cargo/accessories; hardwareDrawerSystems.drawers; drawerPreference. |
| drawerPreference → to samo miejsce | null albo system: kind/systemKey z istniejących DRAWER_SYSTEM_OPTIONS; albo box: kind/runnerType/manufacturer/runnerSeries, z kompletnym producentem/serią i runnerType ball/undermount/roller. Bez tworzenia nowego systemu z samego producenta. |
| cabinet → cabinets[] | id,type,subType,width,height,depth,frontCount; bodyColor/frontMaterial/frontColor/backMaterial/openingSystem/bodyPcvMode/bodyPcvCustomColor; setId/setPreset/setRole/setNumber/setName; details; laborItems[].rateId/qty. Dodatnie wymiary; unikalne ID w pokoju, spójne setId/preset/number. |
| cabinet.details → details | insideMode, shelves, heightIncludesLegs, legHeightCm, projectUnusual, subTypeOption, cornerOption, cornerFlip, blindPart, gl/gp/st/sp, dishWasherWidth, ovenOption/ovenHeight, sinkOption/sinkFront/sinkExtra/sinkExtraCount/sinkDoorCount, fridgeOption/fridgeWidth/fridgeNicheHeight/fridgeFrontCount/fridgeFreeOption/fridgeRequiresFurnitureHinges/needsFurnitureHinges/requiresFurnitureHinges, techDividerCount/techShelfCount; drawerLayout/drawerSystem/drawerBrand/drawerModel/drawerRunnerType/drawerRunnerSeries/drawerPreferenceApplied; innerDrawerType/innerDrawerBrand/innerDrawerModel/innerDrawerCount; sinkInnerDrawerType/sinkInnerDrawerBrand/sinkInnerDrawerModel; podFrontMode/podInsideMode/podInnerDrawerCount; flapVendor/flapKind/hoodFrontMode/hasBack/hasHandle/applianceMounting/applianceMountingMode. Tylko deklarowane prymitywne typy; liczniki całkowite, wielkości nieujemne, bez koercji. |
| chłodziarka w details → to samo miejsce | fridgeFrontSources.single/lower/upper: source/material/color; oraz płaskie fridgeFrontSourceSingle/Lower/Upper, fridgeFrontCustomMaterialSingle/Lower/Upper, fridgeFrontCustomColorSingle/Lower/Upper. |
| set → sets[] | id,presetId (A/C/D),number,bodyColor,backMaterial,openingSystem,frontCount (1/2),frontMaterial,frontColor,frontSource,params. params A: presetId,w1,w2,hB,hTop,dBottom,dModule,blende; C: presetId,w,hB,hTop,dBottom,dModule,blende; D jak C oraz hM. Wymagane dodatnie wymiary frontów, co najmniej jeden rzeczywisty członek zestawu. |
| zapisany front → fronts[] | id,cabId,setId,setNumber,material,color,width,height,note,frontMaterialSource. Dodatnie wymiary i istniejący właściciel; zgodność cabId/setId/setNumber. Niepusta note odrzucana — wyjaśnienie poniżej. |
| frontSource/frontMaterialSource → to samo miejsce | source,label,part (wyłącznie stringi). Pełne nieschematyzowane obiekty są odrzucane. |
| layout → to samo miejsce | segments[].id/name/anchor/offsets(base,module,wall)/rows(base,module,wall). Element: cabinet z istniejącym id albo gap z id/width/label. Kolejność zachowana, powtórne ustawienie szafki odrzucane. |
| production → to samo miejsce | partOverrides[cabinetId][partRoleId].edges; cabinetGroupOverrides[cabinetId][groupRoleId].edges; setGroupOverrides[setId][groupRoleId].edges. edges: dokładnie w1/w2/h1/h2 typu boolean. |

**Zamknięty zakres konstrukcji pierwszego profilu:** natywne szafki standardowa (stojąca/wisząca/moduł, do dwóch zwykłych frontów) i szuflady (stojąca/moduł, geometria z istniejącego resolveDrawerFrontGeometry), zestawy A/C/D. Inne podtypy, ręczne wymagania okuć i drawerRequirements, wykończenia/finishes, nieznane pola i struktury są odrzucane. Lista pól details nie deklaruje wsparcia wszystkich podtypów; zachowuje wyłącznie znane pola w obsługiwanej konstrukcji. Flagi zapisane w postaci stringów nie są konwertowane z innych typów. To świadome zawężenie pierwszego pilotażu, nie nowy limit aplikacji.

**Role PCV profilu:** indywidualne body.side.left/right, body.bottom, body.top (wisząca/moduł), body.top-traverse.a/b (stojąca), body.back gdy istnieją plecy, front.door.single albo left/right (standardowa bez zestawu). Grupy: body.shelves przy dodatniej liczbie półek poza szafką szufladową; front.drawer.small/large przy 3_1_2_2, front.drawer.standard dla innych obsługiwanych natywnych układów; drawer.front_drawers.sides/back/bottom dla skrzynkowych. Zestawy: front.A.single lub left/right według frontCount; front.C.panels i front.D.panels. Nieznana albo niepasująca rola odmawia eksportu. Weryfikacja jest strukturalna, nie przelicza katalogów/ceny ani nie odtwarza całego wizarda; rozszerzanie profilu wymaga testów kolejnych natywnych struktur.

Puste bazowe pokoje kuchnia/szafa/pokoj/lazienka mogą być zapisanymi szablonami bez roomDefs/roomOrder. Są zachowane z ustawieniami/preferencjami bez dopisywania definicji. Pokój z szafkami/frontami/zestawami/production/layout bez definicji jest odrzucany. record.roomKeys/roomCount/cabinetCount nadal obejmują wszystkie rzeczywiście zapisane pokoje, tak jak obecny projectModel.

## Jawne wykluczenia i odmowa przy utracie informacji

- Investor.rooms jest tylko kompatybilnościową projekcją: sprawdzamy unikalność i zgodność wybranych definicji, nie kopiujemy listy cudzych projektów. RoomOrder i roomDefs projektu są źródłem do późniejszego odtworzenia tego zakresu. Niejednoznaczność pokojów między fizycznymi projektami tego inwestora blokuje operację.
- Znane techniczne investor.meta (testData/__test/testOwner/testRunId/__testRunId/createdBy/source), rekordowe meta (source i wymienione pola testowe), __test/__testRunId są walidowane, lecz nie trafiają do payloadu. Inne klucze meta nie są arbitralnie kopiowane ani usuwane: oznaczają odmowę. pendingDomainOperation blokuje wcześniej.
- cabinet.derivedFacts/_derivedFacts i layout.activeSegmentId są jawnymi wykluczeniami technicznymi. Nie utrwalamy cutlisty, qty źródeł, sourceRefs/sourceGroups, effectivePcv ani nowego cache. Brakującego sourceIssues nie zastępujemy losowym właścicielem; obecność takiego nierozpoznanego trwałego pola oznacza odmowę.
- Nie są odczytywane katalogi/cenniki/globalne ustawienia, magazyn płyt, słoje, oferty/drafty, backupy ani profil firmy. Szczególnie nie czytamy ORS apiKey. Referencja materiału lub rateId w projekcie nie oznacza dołączenia definicji/ceny.
- **front.note:** obecny zapis nie zawiera dowodu pochodzenia opisu. Sam tekst „1 front”/„Szuflada 1” nie potwierdza, kto go wpisał. Dlatego w tym pierwszym profilu każda niepusta note jest odrzucana, także wyglądająca na generowaną. Nie usuwamy jej. Rozpoznane syntetyczne podpisy można dopuścić dopiero z jednoznacznym kontraktem pochodzenia i regresją; tego kontraktu teraz nie dopisujemy do projektów. Inwestor/transport/carrying także nie mogą mieć swobodnych niepustych notatek.
- API wymaga istniejącego znacznika `meta.testData === true` lub `__test === true` na obu wybranych rekordach (inwestora i projektu); brak oznacza `EXPORT_PILOT_DATA_REQUIRED`, bez dopisywania flag. API jest przeznaczone wyłącznie dla fikcyjnych fixture. `purpose:'pilot'` nie potrafi automatycznie udowodnić, że nazwisko czy etykieta nie są prawdziwe albo nie zawierają sekretu. Nie wolno wywoływać tego etapu na danych klienta. Allowlista blokuje obce pola i zagnieżdżone kopie; nie jest magicznym klasyfikatorem dowolnego tekstu.

## Spójność i brak skutków ubocznych

1. Jawne ID i purpose, dostępność kontraktu, strict readera i inspektora.
2. Sesja całkowicie zakończona, brak prywatnego latch/payloadu/snapshotu.
3. Odczyt trwałych wskaźników inwestora/projektu i zgodność publicznych API kontekstu (bez getById/readAll modeli).
4. Odczyt RAW obu tablic, poprawny JSON, unikalne ID. Wybrany projekt musi istnieć i należeć do wybranego inwestora; brak pendingDomainOperation.
5. Pełny RAM projektu zgodny z trwałym projectData, poza dwoma jawnymi cache szafek. Bez normalizowania, ignorowania innych pokoi czy aktualizacji RAM.
6. Projekcja według allowlisty i walidacja struktury/dat/ilości/odnośników/PCV.
7. Dwa hashe WebCrypto SHA-256 i dokładny rozmiar końcowego pliku UTF-8.
8. Ponowny odczyt tych samych wybranych rekordów i powiązań, wskaźników, sesji i RAM po obu await. Inny niepowiązany projekt może się zmienić, jeśli nie naruszył jednoznaczności właściciela/ID i wybranego inwestora/projektu. Nie porównujemy całego starego JSON magazynu jako świadectwa selected scope.

To kontrola optymistyczna w danej chwili, **nie atomowy CAS/transakcja między kartami ani chmurowa blokada**. Zmiana po powrocie build wymaga nowego dowodu w przyszłym etapie zapisu do chmury. Nie implementujemy importera, automatycznego merge, odzyskiwania sesji ani przełączania autorytetu.

Zwracane kody obejmują EXPORT_SCOPE_REQUIRED, EXPORT_PILOT_DATA_REQUIRED, EXPORT_DEPENDENCY_UNAVAILABLE, EXPORT_STORAGE_UNAVAILABLE, EXPORT_READ_FAILED, EXPORT_SOURCE_MISSING, EXPORT_SOURCE_INVALID_JSON, EXPORT_INVESTOR_NOT_FOUND, EXPORT_PROJECT_NOT_FOUND, EXPORT_DUPLICATE_ID, EXPORT_CONTEXT_MISMATCH, EXPORT_OWNER_AMBIGUOUS, EXPORT_INVESTOR_MISMATCH, EXPORT_SESSION_UNAVAILABLE, EXPORT_ACTIVE_SESSION, EXPORT_SESSION_UNCONFIRMED, EXPORT_PENDING_OPERATION, EXPORT_RAM_DIVERGENCE, EXPORT_REQUIRED_FIELD, EXPORT_INVALID_FIELD, EXPORT_INVALID_ID, EXPORT_INVALID_DATE, EXPORT_INVALID_GEOMETRY, EXPORT_INVALID_REFERENCE, EXPORT_SCHEMA_UNSUPPORTED, EXPORT_ROOM_SCOPE_MISMATCH, EXPORT_COUNT_MISMATCH, EXPORT_UNSUPPORTED_FIELD, EXPORT_UNSUPPORTED_STRUCTURE, EXPORT_UNSUPPORTED_NOTE, EXPORT_PCV_OWNER_INVALID, EXPORT_PCV_ROLE_INVALID, EXPORT_SOURCE_CHANGED, EXPORT_CRYPTO_UNAVAILABLE, EXPORT_SIZE_LIMIT. Path wskazuje stałą ścieżkę schematu, bez wartości lub nieznanych nazw kluczy/ID, RAW, wyjątków i snapshotów.

## Zależności i granica CLOUD-2A

Dependencies raportuje wyłącznie referencje występujące w payloadzie (materiały, okucia, rateId) i ogólne dziedziczenie defaultów. Nie rozstrzyga dostępności katalogu na drugim urządzeniu, nie kopiuje cen ani efektywnych globalnych defaultów. Rozróżniamy: odtworzenie danych, możliwość wyświetlenia i możliwość identycznej kalkulacji. Ostatnia zależy od katalogów/stawek/defaultów oraz globalnych słojów (Issue #47). Oferta historyczna pozostaje poza payloadem i nigdy nie jest przeliczana.

Przed CLOUD-2A: ocenić ten profil i odmowy (w szczególności notatki i konstrukcje spoza pilota), zaakceptować wyniki testów oraz osobno zlecić porównanie darmowej infrastruktury. Nie wybieramy dostawcy, modelu Firestore, logowania ani funkcji generujących koszt. Kolejne etapy muszą obsłużyć duże projekty, wszystkie wspierane struktury i prawdziwe dane; ograniczenia tego pilota nie są końcem migracji.

## Weryfikacja

`tools/project-selective-export-smoke.js` używa izolowanego MemoryStorage i rzeczywistych modułów schema/model/store/repository/bridge/session/PCV. Sprawdza m.in. setEdges/clearEdges i commit, restart, różne szafki/pokoje/projekty, grupy i setId, SHA-256 porównany z niezależnym node:crypto, daty/liczniki/odnośniki, odmowy, sekret w obcym kluczu, zero write/remove/lifecycle/normalizacji i brak zmiany RAM/messages/session, zmiany podczas asynchronicznego haszowania i niezależność zmian innego projektu.

Celowane wyniki: nowy smoke **27/27 PASS**; project-session-unconfirmed-save-safety **30/30** (P1/P2/P3); project-session-owner-rollback **26/26**; global-data-write-safety **30/30**; project-calculation-adapters **27/27** (R1/R2/W1/W2, 17,122 → 18,834 i 5,010 → 5,511 mb, zapas raz). Multiroom calculation/session: **4/3/6 arkuszy**, WYCENA odpowiednio 400/300/600, historyczny A+B bez zmian. Kontrola składni wszystkich zmienionych JS i load-order: PASS. Testy nie korzystają z localStorage użytkownika ani z API zewnętrznego.

Pierwszy pełny preflight: 118/119 smoke, wyłącznie historyczna asercja prefiksu cache-bustingu session.js; poprawiono URL, zachowując wymagany prefiks C2.1b.2c.1 i dopisując nowy sufiks CLOUD-1B. Asercji nie zmieniano. Kolejne uruchomienie: 119/119 PASS. Dodatkowy przegląd nowego kodu wykazał, że swobodny transport.lastError mógł wejść do dokumentu; syntetyczna diagnostyka potwierdziła przypadek przed poprawką. Pole jest teraz puste albo powoduje odmowę; celowana regresja przechodzi. Dodatkowa regresja wykazała fałszywą odmowę, gdy wykluczony cache RAM miał wartość undefined: porównanie odrzuca teraz dwa jawne cache na kopiach przed kanonizacją, pozostawiając RAM nietknięty.

**Końcowy PRE-FLIGHT PASS** na niezmiennym kodzie/testach (Node 22, 137,152 s): składnia **527/527**, smoke **119/119**, APP **110/110**, load-order **320**, zależności **396 domenowych JS / index 320 / dev_tests 348**, storage **341 referencji / 41 plików**. Sumy SHA-256 ośmiu plików kodu/testów/loadera przed i po uruchomieniu są identyczne. `git diff --check`: PASS. Istniejących testów ani ich asercji nie zmieniono.
