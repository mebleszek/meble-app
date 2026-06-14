# diag-file-labor-view-v1 — 2026-06-14

Zakres:
- WYCENA/Diag: usunięto `Kopiuj raport`, dodano `Zapisz raport` jako pobranie pełnego pliku `.txt`.
- WYWIAD: usunięto szczegółowy dolny blok `Czynności robocizny`; pomarańczowe linie czynności w nagłówku karty zostały bez zmiany.
- CZYNNOŚCI: czas w widoku technicznym jest formatowany jako `h:mm`; brak normoczasu pokazuje `Brak informacji o czasie`.
- CZYNNOŚCI: ręczne czynności nie pokazują finalnych złotówek w podsumowaniu.
- Dokumentacja: dodano `MD_CLEANUP_AUDIT.md` z analizą plików `.md` do przyszłego porządkowania.

Poza zakresem: cache faktów szafki, ORS, PDF, oferta klienta, PCV, transport, `drawer.count`, automaty AGD, wymagania techniczne szafek.

Smoke:
- `tools/wywiad-czynnosci-report-ui-smoke.js`
- `tools/wycena-diagnostics-report-smoke.js`
