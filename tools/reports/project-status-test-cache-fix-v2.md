# project-status-test-cache-fix-v2

Cel: usunąć nieaktualne wyniki ręcznych testów Wyceny po paczce `project-status-test-fix-v1`.

Zakres:
- podbito cache-busting w `dev_tests.html` dla testów Wyceny i powiązanych modułów statusów,
- podbito cache-busting w `index.html` dla powiązanych modułów statusów Wyceny,
- nie zmieniono logiki runtime, UI ani formatu danych.

Weryfikacja:
- celowane testy `Sprzątanie ETAPU 4...` oraz `Guard ręcznej zmiany statusu...` przechodzą w runnerze Node,
- pełny WYCENA dev test runner: 97/97 OK,
- APP smoke: 27/27 OK,
- ROZRYS smoke: 72/72 OK.

Notatka antyregresyjna: przy poprawkach testów, które zmieniają pliki JS ładowane przez `dev_tests.html`, zawsze podbijać cache-busting tych konkretnych plików testowych i powiązanych modułów runtime, inaczej GitHub Pages/Chrome mobile może pokazać stare wyniki mimo poprawnej paczki.
