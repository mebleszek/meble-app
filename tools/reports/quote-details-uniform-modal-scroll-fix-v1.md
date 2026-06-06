# 2026-06-06 — WYCENA: jednolite modale szczegółów i pełna widoczność sekcji v1

- Paczka: `site_quote_details_uniform_modal_scroll_fix_v1.zip`.
- Problem: w `Analiza oferty` / szczegółach WYCENY część sekcji i akordeonów potrafiła chować się przy dolnej krawędzi modala; przy dłuższych ostrzeżeniach nie wszystkie wejścia zachowywały się tak samo.
- Zmiana: modal ma jednolity układ grid `header / body / footer`, większy dolny bufor scrolla, `scroll-padding` oraz przewijanie, które stara się odsłonić całą otwartą sekcję, jeśli mieści się w viewportcie body.
- Mobile: ostrzeżenia dalej mają ograniczoną wysokość i własny scroll.
- Bez zmian: brak zmian w wyliczeniach WYCENY, rejestrze, snapshotach, zawiasach, materiałach i robociźnie.
