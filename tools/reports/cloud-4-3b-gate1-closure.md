# CLOUD-4.3b — Bramka 1 Rules PASS, przygotowanie Bramki 2 bez LIVE

## Weryfikacja i decyzja właściciela (20.10.2026)

- Zweryfikowany main: a1f334df824c10bb54384f7c00eb77b661f9d1b0. PR #70 (procedura GET) scalony; CI wydaniowe, auto-merge i Pages dla tego SHA były SUCCESS.
- Bazowa osobna gałąź CLOUD-4.3a: 965544c861d203b372d179c3a3fcf2ac3106e950. Nie udawać, że CLOUD-4.3/4.3a są już w main. Po przyszłym merge zachować dokument docs/firebase-rules-gate1-api-explorer.md z PR #70.
- Właściciel wykonał dwa GET REST API na Pixelu w Chrome: HTTP 200 i HTTP 200; wskazany ruleset produkcyjny ma dokładnie jeden firestore.rules, 635 B UTF-8, SHA-256 9260ebcd881e5a0cc2302e768f14e2e8152637093de071449ea90211461ffa91. Sprawdzono także oryginalne metadane release/rulesetu.
- Release: projects/mebleszek-meble-app/releases/cloud.firestore. Ruleset: projects/mebleszek-meble-app/rulesets/3e3729ee-6dae-4d91-9e7f-862e68899763.
- Właściciel formalnie odpowiedział TAK na zatwierdzenie produkcyjnego baseline WYŁĄCZNIE do PRZYGOTOWANIA Bramki 2. Nie oznacza to świeżego odczytu w tym zadaniu ani prawa do mutacji.

**Ocena:** GATE1_RULES_READBACK_PASS; BASELINE_APPROVED_FOR_GATE2_PREPARATION_ONLY. **Operacje:** GATE2_PRODUCTION_EXECUTION_CLOSED.

## Zakres zmiany i separacja uprawnień

- Nowy publiczny, przypięty metadanymi rekord tools/firebase-pilot/cloud43b-preparation-approval.json (bez pełnego źródła 635 B, MHTML, tokenów, cookies, UID lub danych klientów) rozdziela przygotowanie od produkcyjnej zgody.
- Historyczny rekord CLOUD-4.3a pozostaje bajtowo nienaruszony. Zapisane w nim gate1 STOP i baselineApprovedForGate2:false odzwierciedlają stan/historyczny warunek wykonawczy, NIE cofają nowszej zgody właściciela na samo przygotowanie.
- Nie zmieniono cloud43a-baseline.js, cloud42-package.js, cloud42-reviewed-loader.mjs.txt, żadnych Rules, konfiguracji rollbacku, skryptów aplikacji, danych ani dostępu produkcyjnego. Fail-closed loader nadal blokuje LIVE.
- Nowy smoke test sprawdza SHA i kompletny zakres decyzji, zgodność z pinned baseline, nieaktywny loader i dokładną różnicę rollbacku 635 B vs template 755 B.
- Statusy w CURRENT_STATE, ROADMAP, CLOUD_MIGRATION i BACKUP są uzupełnione. Izolowany workflow testów obejmuje nową gałąź i ścisłą allowlistę zmian; nie jest PR Ready/auto-merge/Pages.

## Warunki przyszłej Bramki 2 — STOP do nowych zgód

1. Zweryfikowane prywatne bajty produkcyjnych Rules 635 B i ich SHA — brak dokładnego źródła do rollbacku = STOP; 755 B template nie może go zastąpić.
2. Przed przyszłą mutacją osobno zatwierdzony świeży odczyt produkcyjnego release/rulesetu i zgodność aktualnego stanu, Spark, billingu, kwot. Odczyty 20.10.2026 nie gwarantują przyszłej niezmienności.
3. Ochrona przed równoległym deployem oparta na realnej wyłączności/operatorze. Dwa GET i zwykły deploy nie są atomowym CAS. Brak ochrony/rozbieżność = STOP; nie dopasowywać hashy automatycznie.
4. Gotowość operatora STOP, ograniczony grant syntetyczny, brak domniemanego server TTL z 15-minutowego limitu klienta.
5. Osobne zgody: PR Ready/wydaniowe CI/merge/Pages, produkcyjny deploy dokładnych Rules, IAM/grant, syntetyczny writer i niezależny reader do RAM, administracyjny STOP oraz ewentualny rollback.
6. Pilot nie jest pełną migracją. Globalne słoje Issue #47, aliasy legacy, PCV, 14 domen, magazyn, cenniki, frozen oferty, offline/CAS pozostają w planie.

## Testowanie

Izolowany cloud43a-emulator-tests.yml na nowej gałęzi uruchamia publiczny smoke CLOUD-4.3b, istniejące emulatory SDK/Chromium i pełny node tools/preflight.js, bez sekretów, wdrożeń ani uprawnień zapisu do repo. Wynik konkretnego push SHA musi zostać potwierdzony, nie deklarować PASS z góry.

Prywatne 635 B nie są dostępne w CI; powiązane prywatne testy pozostają tam BLOCKED. Zachowano historyczny lokalny wynik CLOUD-4.3a, lecz nie przedstawia się go jako nowego PASS. Żadnego Firebase LIVE.
