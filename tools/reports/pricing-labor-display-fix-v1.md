# pricing labor display fix v1

Baza: `site_pricing_labor_native_controls_v1.zip`.

## Zakres

- Naprawiono pustą sekcję `Robocizna — szafki` w WYCENIE.
- Przyczyną było to, że `catalogSelectors.getQuoteRates()` oczekiwał metod `getQuoteRates/getSheetMaterials/...` na `catalogStore`, a store po wcześniejszym splicie wystawiał głównie `getPriceList(kind)`. W efekcie kalkulator robocizny widział pusty katalog, mimo że pozycje były widoczne w UI cennika.
- Dodano cienkie aliasy kompatybilności w `catalog-store.js` i fallback w `catalog-selectors.js`.
- Dodano moduł `js/tabs/wywiad-labor-summary.js`, który pokazuje zapisane dodatki robocizny na karcie szafki w WYWIADZIE.

## Bezpieczeństwo

- Bez zmian modelu danych i bez nowego storage.
- Bez zmian PDF klienta.
- Bez zmian RYSUNKU, materiałów, statusów i backupów.
- Dodano kontrakty smoke: selektory katalogów muszą zwracać definicje robocizny, WYCENA musi policzyć robociznę szafki z fixture, a WYWIAD musi pokazać zapisany dodatek robocizny.
