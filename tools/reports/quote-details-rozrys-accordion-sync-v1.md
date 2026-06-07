# WYCENA — akordeony audytu zgodne ze wzorcem ROZRYS v1

Paczka: `site_quote_details_rozrys_accordion_sync_v1.zip`
Data: 2026-06-07

## Zakres

Poprawka dotyczy wyłącznie modala szczegółów/audytu WYCENY (`quoteSummaryDetailsModal`). Celem było usunięcie różnic między działami WYCENY i dopasowanie akordeonów do działającego wzorca z ROZRYS / `dev_ui_patterns`.

## Zmiany

- Wszystkie akordeony szczegółów WYCENY korzystają z klas wzorca `rozrys-material-accordion`.
- Usunięto twarde minimalne wysokości nagłówków, które przycinały długie nazwy pozycji na telefonie.
- Wysokość nagłówka i rozwiniętej sekcji wynika z treści.
- Dodano animowane otwieranie przez `scrollHeight` / `max-height`, z fallbackiem dla `prefers-reduced-motion`.
- Zamykanie innych sekcji jest natychmiastowe, tak jak we wzorcu UI.
- Ostrzeżenia pozostały akordeonem bez zagnieżdżonego scrolla.
- Zachowano główny scroll modala, stałą stopkę i przewijanie otwartej sekcji do początku.

## Poza zakresem

Nie zmieniano logiki WYCENY, robocizny, rejestru wyliczeń, materiałów, zawiasów, snapshotów, import/export, backupów ani wariantów szafek.

## Testy

- `tools/quote-details-accordion-scroll-smoke.js` zabezpiecza teraz użycie wzorca ROZRYS, brak twardych wysokości i animację opartą o `scrollHeight`.
