# 2026-06-06 — WYCENA: ostrzeżenia jako akordeon i bez zagnieżdżonego małego scrolla v1

- Paczka: `site_quote_details_warning_accordion_fix_v1.zip`.
- Problem: poprzednia poprawka ograniczyła wysokość ostrzeżeń i dodała im własny scroll, ale na telefonie wyglądało to jak kolejne małe okienko w modalu, a niższe sekcje dalej mogły wyglądać na schowane.
- Zmiana: `Ostrzeżenia / rzeczy do sprawdzenia` są normalnym akordeonem, domyślnie zwiniętym, z liczbą pozycji w nagłówku.
- Po otwarciu ostrzeżenia korzystają z głównego scrolla body modala, tak samo jak pozostałe sekcje.
- Usunięto automatyczne przewijanie przy pierwszym otwarciu totalnego audytu, żeby nie chować początku okna ani nagłówków sekcji.
- Bez zmian: brak zmian w wyliczeniach WYCENY, rejestrze, snapshotach, materiałach, zawiasach i robociźnie.
