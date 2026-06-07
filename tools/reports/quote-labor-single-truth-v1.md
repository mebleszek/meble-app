# WYCENA — robocizna jako jedna prawda v1

## Paczka

`site_quote_labor_single_truth_v1.zip`

## Analiza stanu przed zmianą

- Stawki robocizny są w katalogu stawek WYCENY (`catalogSelectors.getQuoteRates()`), z domyślnymi definicjami w `labor-catalog-definitions.js` / `labor-catalog.js`.
- Ręczne pozycje robocizny WYCENY są w szkicu oferty (`quoteOfferStore.getCurrentDraft().rateSelections`) i były zbierane jako `quoteRateLines`.
- Ręczne pozycje przy konkretnej szafce są w `cab.laborItems` i były dokładane w `wycena-core-labor.js`.
- Automatyczna robocizna przed tym etapem obejmowała głównie korpus i półki; nie było centralnych automatycznych linii frontów i zawiasów opartych na tym samym źródle, które zasila MATERIAŁ/WYCENĘ.
- `quoteCalculationRegister` już był właściwym miejscem sumowania, a snapshot preferował `calculationRegister`, ale robocizna nie miała pełnych źródeł audytu i groziło rozjechanie frontów/zawiasów z MATERIAŁEM/WYCENĄ.
- Montaż AGD był agregowany po nazwie usługi, przez co ginęło źródło konkretnej szafki/urządzenia.

## Minimalny model wdrożony w tym etapie

- Automatyczna robocizna korpusu/półek nadal liczy się z istniejących szafek i istniejących stawek.
- Automatyczna robocizna frontów bierze ilość z `frontHardware.getCabinetFrontCutListForMaterials(roomId, cabinet)`.
- Automatyczna robocizna zawiasów bierze ilość z `cabinetHardwareRequirements.getHingeRequirementsWithQty(roomId, cabinet)`.
- Każda linia robocizny ma źródło: `sourceType`, `sourceLabel`, `sourceId`, `sourceRole`, `sourceKind`, notatkę, ilość, jednostkę, stawkę jednostkową i sumę.
- Ręczne pozycje robocizny są rozdzielone jako `manual` / `manual-cabinet`.
- Montaż AGD jest linią usługi z audytem szafki i trafia przez `quoteCalculationRegister`.
- Snapshot zachowuje metadane źródeł i sumy z rejestru.

## Ryzyka dublowania zabezpieczone

- Zawiasy nie są liczone przez legacy cutlistę ani przez `getHingeCountForCabinet`; robocizna używa centralnych wymagań zawiasów.
- Zestaw liczy fronty i zawiasy zgodnie z korpusem prowadzącym, bez dublowania na korpusie nieprowadzącym.
- Front szuflady nie jest traktowany jako front zawiasowy; zawiasy wynikają wyłącznie z wymagań drzwi.
- Ręczna pozycja typu front/zawias przy szafce dostaje ostrzeżenie o możliwym dublu z automatem.

## Testy

Dodano `tools/quote-labor-single-truth-smoke.js`, który sprawdza:

1. robociznę szafek w `quoteCalculationRegister`,
2. zgodność sumy robocizny z sumą linii rejestru,
3. źródła audytu robocizny,
4. robociznę frontów ze źródła MATERIAŁ/WYCENA,
5. brak liczenia frontu szuflady jako frontu zawiasowego,
6. brak dubli frontów/zawiasów w zestawie,
7. ilość zawiasów z centralnych wymagań,
8. montaż AGD w rejestrze,
9. ręczne pozycje odróżnione od automatycznych,
10. snapshot zapisujący robociznę z rejestru.

## Zakres celowo nietknięty

- Nie przebudowano prowadnic, szuflad systemowych, cargo, podnośników i innych okuć poza zawiasami.
- Nie dodano nowych wariantów szafek.
- Nie zmieniono UI katalogu okuć ani formularzy poza skutkiem danych w audycie WYCENY.
- Nie zmieniono reguły ilości zawiasów.
- Nie zmieniono import/export, backupów ani mechanizmu przyszłej chmury.
