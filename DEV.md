# DEV — jak rozwijać aplikację (żeby jej nie psuć)

## Zasady stałe dla tego repo

1. **Nie zmieniamy UI ani sposobu prezentacji/rysowania bez zgody użytkownika.**
   Wyjątek: drobne fixy typu overflow, martwy klik, literówka, błąd składni lub zabezpieczenie przed crashem — o ile nie zmienia to wyglądu.
2. **Po każdej serii zmian wydajemy kompletny `site.zip`** z całą strukturą repo, zawsze z `README.md` i `DEV.md`.
3. **Bazą do kolejnych zmian jest zawsze ostatni `site.zip` wygenerowany w rozmowie.**
4. **Nowe akcje UI dodajemy przez `data-action` + Actions registry.** Nie dokładamy luźnych klików tam, gdzie można użyć istniejącej delegacji.
5. **Optimax rozwijamy głównie w `js/app/rozrys.js` i `js/app/cut-optimizer.js`.** Do `js/app.js` trafiają tylko mosty do istniejących danych/stanu, jeśli są konieczne.
6. **Duży `js/app.js` stopniowo odchudzamy, ale bez zmiany wyglądu i bez przepisywania pół aplikacji naraz.**
7. **Szczególnie pilnować regresji w:** `js/app.js`, `js/app/bindings.js`, modale, przełączanie widoków, `renderCabinets()`, zapis/odczyt sesji projektu.

---

## 1) Dodawanie nowego przycisku / akcji UI

1. W HTML dodaj atrybut:
   - `data-action="twoja-akcja"`
2. W kodzie dopisz handler w `js/app/actions-register.js` (Actions registry) **albo** w przyszłości w module:
   - `FC.actions.register({ 'twoja-akcja': (ctx) => { ...; return true; } })`
3. Start aplikacji ma **fail-fast**: jeśli w HTML jest `data-action`, którego nie ma w Actions registry — zobaczysz błąd w czerwonym bannerze.

**Zasada:** nie dodajemy nowych `addEventListener('click', ...)` na pojedyncze przyciski, jeśli akcja może iść przez delegację + `data-action`.

## 2) Modale

Używamy `FC.modal` (plik `js/core/modals.js`):

- Otwieranie: `FC.modal.open('priceModal')`
- Zamykanie: `FC.modal.close('priceModal')` **lub** funkcja domenowa `closePriceModal()` (zarejestrowana w `FC.modal.register()`).

Wbudowane zabezpieczenia:
- klik w tło (overlay) zamyka modal,
- `ESC` zamyka ostatnio otwarty modal (stack),
- blokada scrolla jest wspólna.

## 3) Fail-fast DOM

Lista wymaganych elementów jest w `window.APP_REQUIRED_SELECTORS`.
Jeżeli po zmianach w HTML coś zniknie/zmieni ID — aplikacja nie wystartuje i pokaże listę braków w bannerze.

## 4) Minimalny check przed wrzutą na serwer

Jeśli masz Node:
- `node --check js/app.js`

To eliminuje 99% sytuacji typu `SyntaxError` na produkcji.

Dodatkowo przed wydaniem:
- sprawdź, czy `index.html` nadal ładuje komplet aktywnych skryptów,
- sprawdź, czy nowy kod nie dotyka UI poza uzgodnionym zakresem,
- sprawdź checklistę regresji z sekcji 9.

## 5) Konwencje

- Klikalne elementy: zawsze `data-action`, jeśli to możliwe.
- Dane użytkownika w UI: preferuj `textContent` / `createElement` zamiast `innerHTML`.
- Nie dokładamy nowej logiki „na skróty” do losowych miejsc w `app.js`, jeśli istnieje już właściwy moduł.
- Gdy zostawiasz fallback/adapter, opisz to komentarzem: **po co istnieje** i **czy jest tymczasowy**.

## 6) Struktura JS — aktywne pliki

### Start / core
- `js/boot.js` – bezpieczny start + czerwony pasek błędów.
- `js/core/actions.js` – Actions registry + walidacja `data-action` (fail-fast).
- `js/core/modals.js` – modal manager.

### App — aktywne moduły ładowane przez `index.html`
- `js/app/constants.js` – klucze i stałe (`STORAGE_KEYS`).
- `js/app/utils.js` – helpery (num/clone/uid/clamp).
- `js/app/storage.js` – wrappery localStorage (`getJSON` / `setJSON`).
- `js/app/ui-state.js` – pojedyncze źródło prawdy dla UI state.
- `js/app/session.js` – snapshot/restore dla workflow Anuluj/Zapisz.
- `js/app/investors-store.js` – lokalna baza inwestorów.
- `js/app/investor-ui.js` – aktywne UI inwestora.
- `js/app/investor-project.js` – separacja projektu per inwestor.
- `js/app/sections.js` – dodatkowe sekcje zależne od zakładek.
- `js/app/views.js` – przełączanie ekranów i widoków.
- `js/app/validate.js` – walidacja i „samoleczenie” danych.
- `js/app/bindings.js` – delegacja klików + listenery.
- `js/app/actions-register.js` – rejestracja `data-action`.
- `js/app.js` – główny klej aplikacji + duża część logiki domenowej.
- `js/app/tabs-router.js` – router zakładek.
- `js/tabs/wywiad.js` – zakładka WYWIAD.
- `js/tabs/rysunek.js` – zakładka RYSUNEK.
- `js/tabs/material.js` – zakładka MATERIAŁ.
- `js/tabs/czynnosci.js` – zakładka CZYNNOŚCI.
- `js/tabs/wycena.js` – zakładka WYCENA.
- `js/app/cut-optimizer.js` – silnik rozkroju / heurystyki.
- `js/app/magazyn.js` – magazyn płyt.
- `js/app/rozrys.js` – UI i logika zakładki ROZRYS / Optimax.

## 7) Pliki legacy / nieaktywne (na dziś)

Te pliki **leżą w repo, ale nie są ładowane przez `index.html`**. Nie usuwać pochopnie, ale traktować jako **legacy / rezerwę / kod do weryfikacji**:

- `js/app/inwestor.js` – starsza wersja UI inwestora; nieaktywna.
- `js/app/calc.js` – wydzielona warstwa obliczeń, obecnie niepodpięta.
- `js/app/schema.js` – schema projektu, obecnie niepodpięta.
- `js/app/migrate.js` – migracje projektu, obecnie niepodpięte.
- `js/app/panel-pro-worker.js` – worker rozkroju; w repo, ale nie jest ładowany jako zwykły skrypt z `index.html`.

**Zasada:** zanim dotkniesz pliku z tej listy, sprawdź, czy naprawdę jest używany. Jeśli nie — najpierw dopisz notatkę w changelogu/DEV, po co go ruszasz.

## 8) Gdzie czego szukać (żeby nie błądzić po repo)

- Problem z niedziałającym kliknięciem → `js/app/bindings.js` albo `js/app/actions-register.js`
- Problem z nieprawidłową akcją po kliknięciu → `js/app/actions-register.js` + handler domenowy
- Problem z modalem → `js/core/modals.js` + odpowiednia funkcja domenowa w `js/app.js`
- Problem z przełączaniem ekranów / sekcji → `js/app/views.js`, `js/app/sections.js`, `setActiveTab()` w `js/app.js`
- Problem z inwestorem → `js/app/investor-ui.js`, `js/app/investors-store.js`, `js/app/investor-project.js`
- Problem z rozkrojem / Optimax → `js/app/rozrys.js`, `js/app/cut-optimizer.js`, ewentualnie `js/app/magazyn.js`
- Problem z danymi / localStorage → `js/app/storage.js`, `js/app/session.js`, `js/app/validate.js`
- Problem z ogólnym renderem szafek → `renderCabinets()` i powiązane funkcje w `js/app.js`

## 9) Checklista regresji przed wydaniem

### Start i nawigacja
- Strona startowa się otwiera.
- Kafelki/home działają.
- Przejście home → inwestor → pomieszczenia → aplikacja działa.
- Zakładki przełączają się poprawnie.
- Nie pojawia się czerwony banner błędów.

### Inwestor / sesja projektu
- Da się dodać inwestora.
- Da się wejść w inwestora i wyjść bez crasha.
- `Zapisz` zapisuje.
- `Anuluj` nie zapisuje zmian i przywraca poprzedni stan.
- Przełączenie inwestora nie miesza projektów między sobą.

### Pomieszczenia / szafki
- Da się dodać pomieszczenie.
- Da się wejść do pomieszczenia.
- Da się dodać szafkę.
- Edycja szafki działa.
- Usuwanie szafki działa.
- `renderCabinets()` nie sypie błędami po typowych akcjach.

### Zakładki robocze
- WYWIAD działa.
- RYSUNEK działa.
- MATERIAŁ działa.
- CZYNNOŚCI działa.
- WYCENA działa.

### Optimax / Rozrys
- Zakładka ROZRYS otwiera się bez błędu.
- Generowanie rozkroju działa.
- Zmiana heurystyki / preferencji nie wywala UI.
- Dane materiałów i formatek są poprawnie pobierane do rozkroju.
- Magazyn płyt nie rozwala rozrysu.

### Trwałość danych
- Odświeżenie strony nie gubi bieżącego projektu.
- Zapisane dane inwestora nadal są po odświeżeniu.
- Nie ma rozjazdu między localStorage a UI po anulowaniu / zapisie.

## 10) Co rozwijać gdzie

### Optimax / profesjonalizacja rozkroju
Rozwijać głównie w:
- `js/app/rozrys.js`
- `js/app/cut-optimizer.js`
- pomocniczo `js/app/magazyn.js`

Nie dokładać nowych dużych bloków logiki rozkroju bokiem do `js/app.js`, chyba że to tylko most do istniejącego stanu aplikacji.

### Porządki architektoniczne
Przy większych zmianach wyciągać z `js/app.js` do modułów w tej kolejności:
1. WYWIAD
2. MATERIAŁ / lista formatek
3. RYSUNEK
4. wspólne funkcje zapisu/odświeżania projektu

**Zasada:** małe, bezpieczne etapy. Bez przepisywania wszystkiego naraz.
