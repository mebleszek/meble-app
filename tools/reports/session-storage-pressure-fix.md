# Sesja Pixela — rozmiar snapshotu i fałszywa blokada wskaźnika

Baza main: `0cb7044e5feec71d462354efc501dc9e4278cdb6` (tree identyczne
z poprzednią gałęzią diagnostyczną). Gałąź: `fix/session-begin-storage-proof`.
Zakres: tylko bieżący incydent, bez wydania i bez danych właściciela.

## Potwierdzone mechanizmy, granica dowodu

**A.** `begin()` kopiował całe `fc_projects_v1` do snapshotu, choć rollback v4
od dawna odtwarza wyłącznie właściciela i, w sesji pokojowej, tylko jego pokój
z definicją. Rozmiar sesji rósł więc także od cudzych projektów. W natywnym
Chromium zmierzono w osobnym pustym profilu limit **5 242 880 jednostek UTF-16**
(klucze + wartości). Przy sześciu projektach i dziewięciu szafkach aktywnego
pokoju main miał **3 719 355** zajętych jednostek i próbował dopisać payload
**3 636 601**: rzeczywisty **QuotaExceededError**. Stan: active RAM=true,
durable=false, payload nieobecny, code=NONE. Ten kod wynikał z braku `fail()`
przed `notifyBeginFailure()`, nie z braku błędu. Po poprawce ten sam magazyn
projektów **3 628 287** znaków potrzebuje payloadu **11 381**; begin potwierdzony.
W teście VM magazyn **3 512 336** → payload **9 318** znaków.

**B.** Niezależny przypadek bez aktywnej sesji: wejście do inwestora próbuje
aktywować legacy PCV; nieudany zapis projektu nie zmienia żadnego rekordu.
Ponowny zapis niezmienionego currentProjectId przy ładowaniu i następnie
przywracaniu wskaźnika też odmawia. Runtime wywołuje wówczas
`markUnconfirmedProjectWrite()`. Powstaje trwała do końca dokumentu blokada RAM
`writeUnconfirmed` mimo braku payloadu i faktycznego zapisu projektu. Samo
ustąpienie awarii storage nie pomaga; kolejne canSaveProject odmawia.
Przypadek odtworzono bez wcześniejszego begin. Przy już aktywnym projektowym
PCV zbędny zapis wskaźnika również niepotrzebnie odmawiał aktywacji.

To dwa udowodnione mechanizmy zgodne z opisanymi obserwacjami, **nie dowód
konkretnego wyjątku na fizycznym Pixelu**. Raport telefonu nie zawierał wyjątku,
rozmiaru ani rzeczywistego active RAM. Nie pozyskano prywatnego eksportu.
PCV nie jest błędem matematyki: w A potwierdzona aktywacja może poprzedzać
odmowę begin, a w B jest wyzwalaczem odmów zapisu i zbędnego przywracania ID.
Historia ofert/backupy/katalogi mogą zajmować pozostałą przestrzeń, ale nie
są kopiowane do snapshotu sesji; nie przypisuje się im bez dowodu incydentu.

## Minimalna naprawa i bezpieczeństwo

- `session.js`: **tylko nowa** sesja zapisuje w snapshot.projects tablicę
  zawierającą pełny rekord właściciela (także nieznane pola i inne jego pokoje),
  zamiast wszystkich inwestorów. Ten sam schemaVersion=4, klucze, JSON-array,
  expected scope i wymagania read-back. Bez zmiany Anuluj i guardów.
  Sprawdzono wszystkich konsumentów: session scope/rollback, scoped bridge,
  baseline PCV oraz kolektor diagnostyczny wybierają rekord po projectId.
- Stare pełne snapshoty v4 działają i są odtwarzane bez przepisywania baseline.
  Ponowienie nieudanej próby również zachowuje oryginalne bajty snapshotu.
  Nie ma migracji, retencji ani usuwania jakichkolwiek danych w celu zwolnienia
  miejsca. Za duży sam rekord właściciela nadal odmawia.
- `project-store.js`: po dotychczasowej walidacji sesji odczyt dokładnie tego
  samego, fizycznie zapisanego stringa ID potwierdza wskaźnik bez setItem.
  Brak/odmienny/nieczytelny wskaźnik zachowuje poprzednią ścieżkę zapisu i
  potwierdzenia. Nie zeruje się writeUnconfirmed. Rzeczywista nieudana zmiana
  lub rollback wskaźnika nadal odmawia; częściowy zapis projektu pozostaje
  zablokowany. Nie zmieniono zasad aktywacji projektowego PCV.
- Początkowa awaria ustawia ostatni kod: quota, SecurityError, inny wyjątek
  zapisu, brak potwierdzenia albo serializacja. Kolektor ma te stałe na
  zamkniętej liście. Nigdy nie ujawnia treści wyjątku lub danych. Bez przebudowy UI.
- Wspólne cache-busting index/dev_tests oraz cztery piny integralności źródeł;
  nie zmieniono listy ochrony CLOUD-4.2, Rules, Auth ani zgód. Historyczny
  wygenerowany bookmarklet jest jedynie synchronizowany ze wspólnym źródłem;
  nie jest proponowaną drogą obsługi Pixela.

## Dowody i testy

- Identyczne regresje modułów: **przed 13/17 PASS, 4 FAIL; po 17/17 PASS**.
  Trzy porażki main dotyczą dużego snapshotu oraz dwóch przypadków wskaźnika;
  czwarta dotyczy brakującego kodu nieudanej serializacji.
- Natywny mobilny Chromium z dotykiem: main FAIL przy begin z QuotaExceededError;
  po poprawce **6/6 PASS, 0 FAIL, 0 SKIP**. Pomiar quota osobno od danych
  aplikacji, sześć projektów, dziewięć szafek, rzeczywiste Anuluj z potwierdzeniem,
  Zapisz, INWESTOR i powrót, kolejne pokoje, restart z zachowanym storage.
  Przed i po porównano pozostałe projekty, inwestorów, ceny/okucia, historię
  i dodatkowy RAW. Dotychczasowe safety backupy przy zapisie projektu mogą
  aktualizować się zgodnie z ich kontraktem; nie są danymi globalnymi.
- Regresje obejmują SecurityError, quota, brak efektu/false z setItem, utracony
  read-back, serializację, zbyt dużego właściciela, nieudany i częściowy zapis
  projektu, legacy i aktywne PCV, odmienne ID, rzeczywiście nieudany rollback
  wskaźnika, stary pełny payload, C≠B/E oraz restarty. Odmowy zachowują dowód
  i chronione RAW; nowsze dane nie są nadpisywane.
- Mobilne regresje WYCENY/ROZRYSU/PCV i sesji: **13/13 PASS**, dwie rzeczywiste
  oferty i zachowana historia. Diagnostyka ekranowa/gate: **6/6 PASS**.
  Oba runnery nie mają nowych pominięć i nie używają danych właściciela.
  Shell/loader/profil/gate są rzeczywiste, tożsamość/weryfikator syntetyczne;
  nie deklaruje się nowego testu Google SDK ani fizycznego Pixela.
- Auth/gate: **37/37 PASS**, granica main-login: **36/36 PASS**, odczytowy
  kolektor: **15/15 PASS**, ponawianie pierwszego begin: **12/12 PASS**.
- Końcowy **PRE-FLIGHT PASS**: **136/136 smoke, APP 110/110**, składnia
  **579/579**, load order 333, zależności i storage PASS; **149942 ms**.

Pierwszy Preflight zatrzymał się na jednym starym założeniu testu: całe
fc_projects w nowym snapshotcie (135/136 smoke PASS). Aktualizacja sprawdza
dokładny pełny rekord właściciela oraz identyczny snapshot w trwałym dowodzie;
nadal porównuje cały kanoniczny magazyn przed/po zakończeniu i po restarcie.
Nie zmieniono asercji bezpieczeństwa ani wyników kalkulacji.

## Istniejące dane i warunek zatrzymania

Po przyszłym, osobno zatwierdzonym wydaniu nowy begin może działać na istniejącym
magazynie bez migracji. Restart usuwa wyłącznie naturalnie nietrwały latch RAM;
brak payloadu nie zezwala na przyjęcie nowszej rewizji istniejącej sesji.
Nie wprowadzono automatycznego restartu ani resetu. **Nie zamykać dokumentu
z niezapisanym draftem RAM tylko w celu testu.**

Przy realnym C≠B/E, uszkodzonym/niepełnym dowodzie, częściowym zapisie lub
utrzymującym się braku miejsca/uprawnień blokada pozostaje. Najkrótszy kolejny
dowód z Androida to istniejący ekran Diagnostyka sesji bezpośrednio po odmowie
begin: nowy kod quota/denied/read-back/serialization; bez prób zapisu danych
właściciela, prywatnego eksportu czy resetu.

Krótka akceptacja po zgodzie na wydanie, na projekcie testowym bez niezapisanej
edycji: INWESTOR → istniejący projekt → pokój; potwierdzić brak błędu begin,
Zapisz/Anuluj, powrót do INWESTOR i dwóch pokojów, następnie WYCENA/ROZRYS oraz
zwykły ponowny start po zakończonej edycji. Przy odmowie zrobić anonimowy raport
i zatrzymać próbę. Bez PR, merge, Pages, Firebase LIVE, Rules lub grantów.
