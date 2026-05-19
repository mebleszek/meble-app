# hardware_dynamic_technical_params_v1

## Zakres

Etap przebudowuje techniczne dane okuć z pól statycznych na parametry definiowane per kategoria okucia. Zmiana dotyczy katalogu okuć, słowników, formularza pozycji, importu/eksportu XLSX oraz testów.

## Najważniejsze decyzje

- Kategorie okuć pozostają edytowalne przez użytkownika.
- Każda kategoria może mieć własne parametry techniczne.
- Formularz pozycji okucia pokazuje tylko parametry właściwe dla wybranej kategorii.
- Parametr może być tekstem, wyborem, tak/nie albo liczbą/zakresem od-do.
- Jedno pole od oznacza wartość dokładną; od + do oznacza zakres.
- Parametr może być cechą kluczową do przyszłego porównywania zamienników.
- Parametr może budować automatyczne pole `Typ / cecha`.
- Opcje porównania mają opisy pod ikoną `?`.
- Szybka aktualizacja cen przez `Ceny_dostawcow` zostaje prosta.
- Pełny katalog można uzupełniać przez arkusze grupowe `Okucia_<kategoria>`.

## Nowe dane

Nowy backupowany klucz:

- `fc_hardware_technical_params_v1`

Nowe pole w rekordzie okucia:

- `technicalParams`

Dotychczasowe pola techniczne szuflad zostają jako aliasy zgodności i szybki dostęp:

- `drawerProfile`
- `drawerLengthMm`
- `drawerLoadKg`
- `drawerReinforced`
- `hardwareColor`
- `hardwareUsage`
- `technicalNote`

Źródłem prawdy dla nowych danych jest jednak `technicalParams`.

## Import/export

Eksport XLSX zachowuje:

- `Okucia` — zbiorczy arkusz katalogowy,
- `Ceny_dostawcow` — szybka aktualizacja cen,
- `Parametry_techniczne` — definicje parametrów kategorii,
- `Okucia_<kategoria>` — arkusze grupowe z kolumnami właściwymi dla kategorii.

Import czyta zarówno zbiorczy arkusz `Okucia`, jak i arkusze grupowe. Pozycje są deduplikowane po ID albo sygnaturze producent/symbol/nazwa.

## Testy

Dodane/rozszerzone testy obejmują:

- zapis definicji parametrów kategorii,
- automatyczne budowanie `Typ / cecha`,
- wartość dokładną i zakres od-do,
- tryby porównania: dokładne, zakres, minimum takie samo lub większe,
- eksport arkuszy grupowych,
- import arkuszy grupowych,
- zachowanie prostego arkusza `Ceny_dostawcow`,
- storage/backup nowego klucza.
