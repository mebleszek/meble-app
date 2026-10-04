# Lokalny preflight Meble-App

Jedno polecenie uruchamia podstawowy pakiet kontroli przed publikacją nowej wersji:

```text
node tools/preflight.js
```

Skrypt kolejno sprawdza:

1. składnię wszystkich plików JavaScript,
2. zgodność kolejności skryptów w `index.html` z konfiguracją load-groups,
3. wszystkie pliki `tools/*-smoke.js` (lista jest wykrywana automatycznie),
4. audyt zależności i brakujących plików wskazanych przez HTML,
5. audyt użycia `localStorage` / `sessionStorage`.

Poprawny koniec kontroli:

```text
PRE-FLIGHT PASS — wszystkie kontrole zakończone poprawnie
```

Jeżeli którykolwiek etap nie przejdzie, preflight kończy się kodem błędu `1`, pokazuje problem i nie uruchamia kolejnych etapów. Dzięki temu ten sam skrypt będzie można później podpiąć do GitHub Actions.

Preflight nie zmienia logiki programu i nie zapisuje raportów audytowych do repozytorium.
