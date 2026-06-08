# cabinet-edit-no-ui-regression-fix-v1

Cel: naprawić regresję po panelu faktów roboczych bez zmian UI.

Zmiany:
- `cabinet-work-facts-preview.js` nie wywołuje ciężkich helperów frontów/zawiasów podczas otwierania modala.
- `cabinet-modal.js` nie dokłada dodatkowego harmonogramowania podglądu w ścieżce renderu wymagań technicznych.
- `cabinets-render.js` zabezpiecza widoczność istniejącego przycisku `floatingAdd` w WYWIADZIE, gdy aplikacja jest w widoku pomieszczenia.

Nie zmieniono:
- wyglądu i układu UI,
- danych szafki,
- WYCENY,
- MATERIAŁU,
- quoteCalculationRegister.
