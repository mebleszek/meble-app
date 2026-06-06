# quote-details-accordion-scroll-fix-v1

## Cel

Poprawka po teście użytkownika na telefonie: w modalu `Analiza oferty` długi blok ostrzeżeń spychał rozwinięty akordeon `Podział kosztów` na dół okna, przez co użytkownik widział tylko mały fragment zawartości i nie mógł realnie sprawdzić detali.

## Analiza

- Problem dotyczył modalowego audytu WYCENY w `js/app/wycena/wycena-summary-details-modal.js` i styli w `css/wycena.css`.
- Wejścia do detali WYCENY są renderowane z `wycena-tab-preview.js`: `Materiały`, `Akcesoria`, `Robocizna szafek`, `Robocizna / stawki wyceny`, `Montaż AGD`, `Suma przed rabatem`, `Rabat` i `Razem`.
- Samo wyliczanie kosztów i `quoteCalculationRegister` nie wymagały zmian.
- Największe ryzyko było w widoku `total`, bo tam ostrzeżenia zbiorcze mogą mieć dużo pozycji przed pierwszym akordeonem.

## Zmiany

- Modal szczegółów dostał stałą wysokość opartą o `100dvh`, a body modala pozostało jedynym miejscem przewijania treści.
- Zastąpiono przewijanie otwartej grupy przez `scrollIntoView({ block:'nearest' })` kontrolowanym przewijaniem wewnętrznego body modala do otwartego akordeonu.
- Po otwarciu widoku `Razem` z ostrzeżeniami modal automatycznie przewija body do pierwszego otwartego akordeonu, żeby pokazać jego treść zamiast samej listy ostrzeżeń.
- Na mobile blok ostrzeżeń ma ograniczoną wysokość i własny scroll, więc ostrzeżenia nadal są dostępne, ale nie blokują detali kosztów.

## Testy

- Dodano `tools/quote-details-accordion-scroll-smoke.js`.
- Test sprawdza, że każde wejście szczegółów WYCENY nadal istnieje, modal ma własny scroll, otwarte akordeony pokazują zawartość, ostrzeżenia na mobile mają własny scroll, a cache-busting został podbity.

## Poza zakresem

- Nie zmieniano wyliczeń WYCENY.
- Nie zmieniano rejestru `quoteCalculationRegister`.
- Nie zmieniano materiałów, PCV, zawiasów, robocizny, snapshotów ani import/export.
- Nie przebudowywano UI WYCENY poza minimalnym zachowaniem i CSS modala szczegółów.
