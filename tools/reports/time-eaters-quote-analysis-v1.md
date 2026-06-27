# Analiza — brakujące zjadacze czasu w wycenie v1

Cel: wskazać rzeczy, które w stolarce realnie zjadają czas, a nie zawsze są dziś jawnie uwzględnione w WYCENIE/CZYNNOŚCIACH. To jest plan późniejszych etapów, bez zmiany bieżącej matematyki.

## 1. Pomiar i ryzyko pomiarowe

Problem: trudne wnęki, krzywe ściany, piony/poziomy, pomiar bez skanowania i późniejsze dopasowanie blend potrafią zjeść więcej czasu niż sama prosta szafka.

Propozycja uwzględnienia:
- źródło: `project.measurement_complexity` albo `room.measurement_complexity`,
- tryby: prosto / krzywe ściany / wnęka od ściany do ściany / wysoka odpowiedzialność bez blend,
- wycena: czas specjalistyczny + ewentualna dopłata ryzyka,
- klientowi: nie pokazywać jako osobnej pozycji, tylko wliczyć w cenę mebli.

## 2. Kontakt z klientem i poprawki koncepcji

Problem: rozmowy, doprecyzowania, zdjęcia, wiadomości, zmiany układu i kilka wersji projektu są pracą, ale zwykle giną.

Propozycja:
- osobna grupa `Projekt i przygotowanie`,
- źródła: liczba wersji, liczba pomieszczeń, poziom niezdecydowania/zmienności,
- naliczanie: start np. 30–60 min + czas za dodatkową wersję.

## 3. Zamawianie materiałów i okuć

Problem: zamówienia, porównanie dostawców, sprawdzanie braków, zamienniki, kompletowanie Blum/GTV/Rejs itd.

Propozycja:
- grupa `Projekt i przygotowanie` albo `Logistyka zakupowa`,
- źródła: liczba unikalnych materiałów, liczba unikalnych okuć, liczba dostawców,
- naliczanie: czas startowy + minuty za unikalną pozycję/dostawcę.

## 4. Rozładunek, segregacja i kontrola po dostawie

Problem: przyjęcie płyt/formatek/okuć, sprawdzenie uszkodzeń, segregacja pod projekt.

Propozycja:
- grupa wewnętrzna `Przygotowanie warsztatowe`,
- źródła: liczba formatek, liczba paczek okuć, gabaryt projektu,
- naliczanie: czas za formatkę albo czas za projekt + gabarytoczas.

## 5. Oklejanie / czyszczenie / finalne przygotowanie formatek

Problem: nawet gdy materiał jest rozpisany, realnie dochodzi czyszczenie kleju, opisanie elementów, drobne poprawki, kontrola obrzeży.

Propozycja:
- źródła: metry PCV, liczba formatek, liczba widocznych krawędzi,
- naliczanie: minuty/mb PCV albo minuty/formatkę,
- w WYCENIE: wewnętrznie jako robocizna warsztatowa, klientowi ukryte.

## 6. Montaż frontów i regulacja

Problem: zawiasy, prowadnice, szczeliny, regulacja frontów i testowanie pracy mechanizmów często są większym zjadaczem niż skręcenie korpusu.

Propozycja:
- źródła: liczba frontów drzwiowych, liczba szuflad, liczba podnośników, TIP-ON/BLUMOTION,
- naliczanie: osobne automaty dla montażu i regulacji: zawiasy, prowadnice, podnośniki, fronty szuflad,
- UI: automaty w CZYNNOŚCIACH per szafka.

## 7. Nietypowe cięcia i wycięcia

Problem: zlewozmywak, płyta, gniazdka, wentylacja, rury, narożniki, blendy pod krzywe ściany, docinki na montażu.

Propozycja:
- ptaszki/ilości w WYWIADZIE przy szafce albo w pomieszczeniu,
- źródła: `cabinet.cutout_count`, `cabinet.pipe_notch_count`, `room.wall_fit_complexity`,
- naliczanie: czas specjalistyczny per wycięcie + gabarytoczas dla trudnych przypadków.

## 8. Pakowanie i zabezpieczanie do transportu

Problem: folia, kartony, przekładki, opisanie paczek, zabezpieczenie lakieru/frontów, załadunek.

Propozycja:
- grupa `Logistyka`,
- źródła: liczba szafek, liczba frontów wysokich, liczba formatek, gabaryt,
- naliczanie: czas za szafkę/paczkę + materiały pakowe jako koszt.

## 9. Sprzątanie i oddanie montażu

Problem: czyszczenie, odkurzenie, wyniesienie śmieci, zdjęcia końcowe, instruktaż klienta.

Propozycja:
- grupa `Montaż u klienta`,
- źródła: liczba pomieszczeń, liczba szafek, czy jest demontaż/stare meble,
- naliczanie: czas startowy + czas za pomieszczenie/szafkę.

## 10. Bufor ryzyka projektu

Problem: nie każdy projekt da się wycenić idealnie. Braki okuć, nietypowe ściany, poprawki klienta, opóźnienia dostaw i powroty na montaż tworzą ukryty koszt.

Propozycja:
- nie robić ręcznego procentu wszędzie na ślepo,
- dodać `riskProfile`: niski / normalny / trudny / bardzo trudny,
- bufor liczyć od wybranych działów albo jako dodatkowy czas specjalistyczny,
- pokazywać tylko wewnętrznie w WYCENIE, nie jako osobną pozycję klientowi.

## Proponowana kolejność wdrażania

1. Montaż frontów, zawiasów, prowadnic, podnośników i regulacja — największy brak operacyjny przy szafkach.
2. Wycięcia/docinki/blendy i trudność wnęki — ważne przy realnych kuchniach i szafach.
3. Zamówienia, kompletowanie i kontrola dostaw — ważne dla czasu poza warsztatem.
4. Pakowanie/załadunek/sprzątanie — logistyczne zjadacze czasu.
5. Bufor ryzyka — dopiero po uporządkowaniu źródeł czasu, żeby nie maskować braków.
