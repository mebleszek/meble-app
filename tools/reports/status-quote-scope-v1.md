
# Status / quote scope v1 — 2026-05-02

## Baza

- Start: `site_multi_room_status_guard_v1.zip`.
- Zakres: naprawa logiki statusów Inwestor/Wycena i wyboru pomieszczeń do Wyceny.
- Bez RYSUNKU, bez zmiany polityki backupów i bez pełnego harmonogramu.

## Problem

W `Inwestorze` ręczna zmiana statusu mieszała etap procesu z ofertą. Użytkownik mógł dojść do sytuacji, w której:

- `Wstępna wycena` była dostępna jako ręczny status,
- pomieszczenie bez szafek trafiało do zakresu Wyceny,
- zaakceptowana wspólna wycena wstępna nie prowadziła statusów wszystkich objętych pomieszczeń razem,
- nie było dobrej ścieżki dla pomieszczeń dodanych na pomiarze bez wyceny wstępnej.

## Zmiany runtime

- `Wstępna wycena` nie jest już ręcznym statusem tworzonym z poziomu `Inwestora`.
- `Pomiar` i `Wycena` mogą być ustawione ręcznie także bez wyceny wstępnej.
- Manualny status `Pomiar/Wycena` respektuje scope zaakceptowanej wyceny wstępnej.
- Gdy istnieje więcej niż jeden zaakceptowany scope obejmujący pokój, decyzja idzie przez aplikacyjny modal wyboru.
- Wybór pomieszczeń w WYCENIE widzi pokoje bez szafek, ale blokuje ich zaznaczenie z powodem `Brak szafek`.
- `Wszystkie` w pickerze WYCENY wybiera tylko pomieszczenia możliwe do policzenia.

## Nowe moduły

- `js/app/project/project-status-scope-decision.js` — aplikacyjna decyzja zakresu statusu.
- `js/app/wycena/wycena-room-availability.js` — dostępność pokoju do kalkulacji Wyceny.

## Zmienione obszary

- `project-status-manual-guard.js` — reguły manualnego statusu i budowanie wyborów zakresu.
- `investor-persistence.js` — zapis statusu dla kilku pomieszczeń przez istniejące status sync.
- `investor-rooms.js` / `investor-ui.js` — ukrycie ręcznego wyboru `Wstępna wycena` i obsługa decyzji zakresu.
- `rozrys-pickers.js` — opcjonalne disabled state dla pokoi w pickerze.
- `wycena-tab-selection-scope.js` / `wycena-tab-selection-pickers.js` — filtrowanie pomieszczeń bez szafek z zakresu Wyceny.
- `css/rozrys-reference-sync.css` — stan disabled/notatka w stylu istniejącego pickera.
- `js/testing/wycena/fixtures.js` / `js/testing/wycena/tests.js` — izolacja fixture Wyceny czyści cache roomRegistry i techniczny edit-session na czas testu, żeby testy nie podbierały pokojów z poprzedniego przebiegu.

## Cloud-readiness

- Bez nowych bezpośrednich zapisów storage.
- Oferta pozostaje dokumentem/snapshotem ze scope `roomIds`.
- Status procesu może istnieć bez wyceny wstępnej, co przygotowuje przyszły harmonogram i filtry: `Pomiar` / `Wycena końcowa po pomiarze`.

## Testy przed wydaniem

- `node --check` dla nowych/zmienionych JS — OK.
- Pełny `WYCENA smoke testy` uruchomiony w Node — 100/100 OK.
- `node tools/check-index-load-groups.js` — OK.
- `node tools/app-dev-smoke.js` — 31/31 OK.
- `node tools/rozrys-dev-smoke.js` — 72/72 OK.
- `node tools/local-storage-source-audit.js` — OK, nowe referencje storage tylko w testowym fixture.
- `node tools/dependency-source-audit.js` — OK, raport odświeżony.
- `node tools/wycena-architecture-audit.js` — OK, ostrzeżenia bez blokujących błędów.
- `unzip -t` gotowego ZIP-a — OK.
- Uprawnienia ZIP-a sprawdzone: katalogi `drwxr-xr-x`, pliki `rw-r--r--`.
