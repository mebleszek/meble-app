# 2026-06-14 — Fakty pochodne szafki/cache v1

Zakres: przeniesienie ciężkich obliczeń jednej szafki do cache `cabinet.derivedFacts` z hashem danych wejściowych i wersją kalkulatora.

Najważniejsze zmiany:
- nowy moduł `FC.cabinetDerivedFacts`,
- przeliczenie po dodaniu/edycji szafki i zestawu,
- odczyt cache w CZYNNOŚCIACH, WYCENIE, materiale i robociźnie,
- diagnostyka WYCENY z czasami sekcji, licznikami cache i rozmiarami snapshot/register/labor,
- CZYNNOŚCI jako widok techniczny bez finalnych złotówek w głównym widoku szafek.

Nie ruszano: ORS, transport km, PDF, oferta klienta, PCV pod kolor frontów, koszty firmy, `drawer.count`, automaty AGD, live preview formularza szafki.

Cache-busting: `20260616_project_preparation_section_v1`.
