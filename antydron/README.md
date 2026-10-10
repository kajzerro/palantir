# SPEKTRE AIR · demo centrum zarządzania systemem antydronowym (PGE / PGE Offshore)

Klikalne demo konsoli operacyjnej systemu antydronowego (C-UAS) dla infrastruktury
krytycznej energetyki: **fuzja sensorów**, **klasyfikacja AI**, **asystent prowadzący
operatora przez procedurę** i **warstwa inteligencji**, która łączy pojedyncze
zdarzenia w powtarzalne wzorce.

Dwa obiekty w jednym demo:

| Obiekt | Co pokazuje |
|---|---|
| **Elektrownia Bełchatów** (PGE GiEK) | obiekt lądowy: rozdzielnia 400 kV, transformatory blokowe, bloki energetyczne, nawęglanie, chłodnie. Radary 3D, czujniki RF/DF z Remote ID, głowice EO/IR, macierz akustyczna, ADS-B + PansaUTM, zakłócacz, moduł przejęcia protokołu, dron przechwytujący. |
| **Baltica 2** (PGE Baltica) | morska farma wiatrowa: 30 turbin, morska stacja OSS 275 kV, kabel eksportowy, jednostki SOV/CTV. Radar morski 3D, RF/DF na turbinach, EO/IR z pokładu OSS, AIS + radar nawodny, kanał satelitarny, dron przechwytujący z pokładu. |

Bez kroku budowania, bez zależności – czysty HTML / CSS / JS. Zbudowane na tym samym
szkielecie co podprojekt **Spektre** dla kopalni (katalog nadrzędny repozytorium).

## Uruchomienie

Najprościej: **dwuklik na `start.bat`** (Windows) albo `./start.sh` (macOS / Linux).
Skrypt uruchamia lokalny serwer i otwiera przeglądarkę na `http://localhost:8081`.

Ręcznie:

```bash
# z katalogu antydron/
python3 -m http.server 8081
# otwórz http://localhost:8081
```

Otwarcie `index.html` bezpośrednio z dysku też działa w Chrome/Edge.

## Układ ekranu

| Panel | Co robi |
|---|---|
| **Pasek górny** | Przełącznik obiektu (Bełchatów / Baltica 2), liczba czynnych sensorów, liczba śladów w strefie, alarmy, **poziom zagrożenia** (zielony / żółty / czerwony) oraz stan **środków aktywnych** (zablokowane / uzbrojone). |
| **Lewy – asystent operatora** | Czat prowadzący operatora: opis zdarzenia, przyciski decyzji dopasowane do scenariusza (bez linii poleceń), a po potwierdzeniu – procedura krok po kroku („Zrobione ✓” / „Nie mogę tego zrobić” / „Pokaż wszystkie kroki”) z meldunkami wpadającymi między krokami. Na dole stale widoczna tabela **środków aktywnych i podstawy prawnej**. |
| **Prawy górny – trzy widoki** | **SYTUACJA**: obraz powietrzny – plan obiektu, strefy (zakazana / ostrzegawcza / detekcji), strefa EP R, pokrycia sensorów z obracającym się snopem radaru, ślady BSP z torem przebytym i **przewidywaną trasą**, wysokość pokazana linią pionową do cienia na ziemi. **PROFIL PIONOWY**: wysokość śladu względem odległości od aktywa krytycznego, z pułapem 120 m AGL i sylwetką obiektu. **INTELIGENCJA**: statystyki 30/90 dni, rozkład dobowy, powtarzalne podmioty, ocena analityczna AI i rekomendacje. |
| **Prawy dolny – tor EO/IR + fuzja** | Obraz z głowicy z ramkami detekcji, obok: dane śladu (model, Remote ID, masa, ładunek, łącze, wysokość, prędkość, kurs, odległość od aktywa), **wkład każdego sensora w zbudowanie śladu**, widmo RF 2,4/5,8 GHz, klasyfikacja AI i dziennik zdarzeń. |

Widok **SYTUACJA** ma dwa podkłady, przełączane w nagłówku panelu:
**WEKTOR** (schemat obiektu, domyślny) i **SATELITA** (zdjęcie lotnicze / ortofotomapa
w tym samym kadrze). Warstwa taktyczna – strefy, sensory, pola widzenia, ślady, patrole –
jest ta sama w obu; na zdjęciu bryły planu schodzą do roli przezroczystych obrysów,
bo prawdziwe obiekty widać na podkładzie.

Po uruchomieniu scenariusza mapa sama kadruje się na zdarzeniu (aktywo krytyczne,
punkty wejścia śladów i rejon ich działania). Kółko myszy przybliża, przeciąganie
przesuwa, `⟲` wraca do widoku całego obiektu.
Kliknięcie sensora przełącza na niego podgląd; sensory bez kanału wizyjnego (radar, RF,
AIS, ADS-B) pokazują swoje dane zamiast obrazu.

## Scenariusze demo

Przyciski **1…7** w nagłówku lewego panelu (można je przełączać w dowolnej kolejności;
otwarty scenariusz jest wtedy przerywany). **AUTO** odtwarza je po kolei.
Scenariusz sam przełącza obiekt, na którym się dzieje.

| # | Obiekt | Zdarzenie | Co pokazuje |
|---|---|---|---|
| 1 | Bełchatów | **Rozpoznanie BSP nad rozdzielnią 400 kV** – DJI Mavic 3T, Remote ID odczytany, lot niezgłoszony | pełna fuzja (radar + RF/DF + EO/IR + akustyka + brak planu lotu w UTM), triangulacja operatora, patrol, zgłoszenie Policji i PAŻP, korelacja z dwoma wcześniejszymi wejściami tego samego numeru seryjnego |
| 2 | Bełchatów | **BSP z ładunkiem · zrzut przedmiotu** przy transformatorach blokowych | cel bez Remote ID, łącze szyfrowane, ładunek widoczny w IR, moment zrzutu zaznaczony na mapie; ścieżka zgody na środki aktywne (art. 26a), zakłócanie vs dron przechwytujący, procedura ewakuacji rejonu |
| 3 | Bełchatów | **Dwa ślady odrzucone automatycznie** – klucz ptaków i autoryzowany dron inspekcyjny | dlaczego system *nie* budzi operatora: mikro-Doppler i brak emisji RF przy ptakach, zgodność Remote ID z planem lotu w PansaUTM przy dronie wykonawcy |
| 4 | Bełchatów | **Rój pięciu BSP, lot autonomiczny** | korelacja czasowa wejść, brak łącza RC (zakłócanie RC bezskuteczne), priorytetyzacja celów, przechwycenie celu priorytetowego, procedura ochrony fizycznej |
| 5 | Baltica 2 | **BSP startujący z jednostki bez AIS** | korelacja ślad powietrzny ↔ echo nawodne ↔ namiar RF, luka w transmisji AIS jako dowód, wywołanie VHF, Straż Graniczna i VTS, zamówienie zobrazowania satelitarnego, wstrzymanie transferów |
| 6 | Baltica 2 | **Zakłócanie GNSS w akwenie farmy** | potwierdzenie na trzech niezależnych odbiornikach, wpływ operacyjny (loty BSP, DP jednostek), namiar źródła, zgłoszenie do UKE i PAŻP |
| 7 | Baltica 2 | **Autoryzowany BSP poza korytarzem inspekcyjnym** | wymiar bezpieczeństwa pracy i zgodności: 22 m od pracującego wirnika, ostrzeżenie operatora, nakaz zawieszenia lotu, karta niezgodności wykonawcy |

Szczegółowy scenariusz prezentacji (co klikać, co mówić, ile to trwa) jest
w pliku [`SCENARIUSZE.md`](SCENARIUSZE.md).

## Środki aktywne i podstawa prawna

Demo celowo pokazuje, że **środki aktywne są domyślnie zablokowane**. Zakłócanie,
przejęcie protokołu i dron przechwytujący wymagają wcześniejszego wystąpienia o zgodę
(w demo: przycisk „Wystąp o zgodę na środki aktywne (art. 26a)”), a ich użycie jest
rejestrowane. Odniesienia prawne w procedurach (`js/data.js`, sekcja `procedures`) są
**poglądowe** – przed wdrożeniem operacyjnym wymagają potwierdzenia z działem prawnym
oraz uzgodnienia z Policją, ABW, PAŻP, UKE i (dla obiektów morskich) Strażą Graniczną.

## Nagrania

W `videos/` są **zastępcze klipy demo** (wygenerowane, z napisem „NAGRANIE ZASTĘPCZE –
DEMO”), więc podgląd odtwarza wideo od razu. Każdy klip jest w dwóch wersjach: `.mp4`
(H.264) i `.webm` (VP9) – odtwarzacz próbuje najpierw MP4, potem WebM.

Aby podmienić na prawdziwe nagrania, wystarczy nadpisać plik `.mp4` o tej samej nazwie
(wersję `.webm` można usunąć):

| Plik | Użycie |
|---|---|
| `videos/eoir-01.mp4` | EOIR-1 Bełchatów · rozdzielnia 400 kV (pętla dozoru) |
| `videos/eoir-02.mp4` | EOIR-2 Bełchatów · hala turbin |
| `videos/eoir-03.mp4` | EOIR-3 Bełchatów · chłodnie kominowe |
| `videos/eoir-11.mp4` | EOIR-11 Baltica 2 · OSS (noc, IR) |
| `videos/eoir-12.mp4` | EOIR-12 Baltica 2 · turbina B-18 |
| `videos/eoir-13.mp4` | EOIR-13 Baltica 2 · turbina B-29 (sensor offline) |
| `videos/inc-01-recon.mp4` | ZD-01 · rozpoznanie nad rozdzielnią |
| `videos/inc-02-payload.mp4` | ZD-02 · BSP z ładunkiem i zrzut |
| `videos/inc-03-birds.mp4` | ZD-03 · ptaki + dron autoryzowany |
| `videos/inc-04-swarm.mp4` | ZD-04 · rój BSP |
| `videos/inc-05-vessel.mp4` | ZD-05 · BSP startujący z jednostki (IR) |
| `videos/inc-06-gnss.mp4` | ZD-06 · BSP w zawisie po utracie GNSS |
| `videos/inc-07-corridor.mp4` | ZD-07 · BSP przy wirniku turbiny |

Ramki detekcji rysuje aplikacja (pole `boxes` w `js/data.js`, w % kadru) – po podmianie
nagrania wystarczy poprawić współrzędne ramek, żeby trafiały w obiekt na obrazie.

Zastępcze klipy można wygenerować ponownie:
`python3 tools/make_placeholder_videos.py` (wymaga `pillow`, `numpy` i ffmpeg –
systemowego albo `pip install imageio-ffmpeg`).

## Podkład satelitarny

W `assets/` leżą **prawdziwe zdjęcia** obu obiektów, pobrane skryptem
`tools/fetch_satellite.py`:

| Obiekt | Źródło | Rozdzielczość |
|---|---|---|
| `sat-belchatow.jpg` | Esri World Imagery · Maxar, Earthstar Geographics | 4000 × 2480 px (ok. 2,5 m/px) |
| `sat-baltica.jpg` | Sentinel-2 cloudless 2024 (EOX, CC BY-SA 4.0), dane Copernicus | 4000 × 2480 px |

Podpis źródła jest pokazywany w rogu mapy i pochodzi z pola `baseCredit` w `js/data.js`.
Zdjęcie Baltiki 2 pokazuje otwarty akwen – farma jest w budowie, więc turbiny i OSS
pozostają warstwą wektorową na wodzie. Zdjęcia odświeżasz tą samą komendą:

```bash
python3 tools/fetch_satellite.py            # oba obiekty
python3 tools/fetch_satellite.py belchatow  # jeden
```

Skrypt próbuje po kolei: **GUGiK · ortofotomapa Polski** (dane otwarte, najlepsza
rozdzielczość dla obiektów lądowych), **Esri World Imagery**, **Sentinel-2 cloudless**
(EOX, CC BY-SA 4.0 – dobre dla obszarów morskich). Wymaga dostępu sieciowego do
`mapy.geoportal.gov.pl`, `services.arcgisonline.com` i `tiles.maps.eox.at`.
Zdjęcia z Google Maps nie są używane celowo – ich pobieranie i redystrybucja
łamią warunki licencji.

Kadr jest liczony z punktu środkowego obiektu (`SITES` w skrypcie: Bełchatów
51,2661 N / 19,3306 E, Baltica 2 ok. 55,05 N / 17,30 E – współrzędne przybliżone,
do potwierdzenia z dokumentacją obiektu) i obejmuje dokładnie 10 × 6,2 km,
czyli ten sam prostokąt co mapa.

Skrypt próbuje też GUGiK jako pierwsze źródło dla obiektów lądowych (ortofotomapa
25 cm jest ostrzejsza), ale jego WMS bywa niedostępny: odpowiada poprawnie tylko na
`VERSION=1.1.1` z parametrem `SRS` i przy większych kadrach potrafi zwrócić pustą
ramkę. Jeśli się uda, podmień `baseCredit` na „ortofotomapa: GUGiK / geoportal.gov.pl
(dane otwarte)”.

**Plan wektorowy Bełchatowa jest odrysowany z tego zdjęcia** – chłodnie kominowe,
kotłownia, maszynownia, blok 858 MW, absorbery IOS, nawęglanie i granica terenu leżą
na rzeczywistych obiektach, a sensory stoją na realnych budynkach i perymetrze.

**Rozdzielnie 400 kV** nie są zgadywane ze zdjęcia – ich pozycje pochodzą z
OpenStreetMap (`power=substation`, `voltage=400000`) i zostały potwierdzone wizualnie
na ortofoto (pole szyn po zachodniej stronie kotłowni):

| Obiekt | OSM | Współrzędne | Plan (jednostki) |
|---|---|---|---|
| Rozdzielnia przesyłowa 400 kV | `way/681264796` | 51,26890 N · 19,31565 E | x 392–400, y 275–283 |
| Rozdzielnia blokowa 400 kV (transformatory bloków) | `way/681264785` | 51,26879 N · 19,31738 E | x 406–410, y 277–283 |
| Pole przesyłowe wschodnie | `way/681264996` | 51,26888 N · 19,32116 E | x 431–437, y 277–281 |

Stacja PSE **Rogowiec 400/220 kV** (`way/293484891`, 51,31603 N · 19,32881 E) leży
5,6 km na północ od zakładu, czyli **poza kadrem mapy** – demo pokazuje rozdzielnie
na terenie elektrowni, a linie 400 kV wychodzące na północ prowadzą właśnie do niej.
Dane o rozmieszczeniu: © współtwórcy OpenStreetMap (ODbL).

Współrzędne poprawia się w `js/data.js` (sekcje `geo` i `sensors`); ślady scenariuszy
celują w te same punkty (`incidents[].tracks` i `events`), więc po przesunięciu aktywa
trzeba przesunąć także tor lotu i punkt zrzutu.

Gdyby trzeba było pracować bez dostępu do sieci, `python3 tools/make_satellite_placeholder.py`
generuje podkład zastępczy ze znakiem wodnym „PODKŁAD ZASTĘPCZY” (pillow, numpy, node).

## Jak to zmieniać

Wszystko, co widać w demo, jest w `js/data.js`:

* `sites` – obiekty: geometria planu, strefy, sensory i efektory (pozycje, zasięgi,
  pola widzenia), patrole i jednostki. **1 jednostka planu = 10 m** (stała `M`),
  widok mapy to 1000 × 620 jednostek, czyli ok. 10 × 6,2 km.
* `incidents` – scenariusze: opis, cel, wkład sensorów (`fusion`), klasyfikacja
  (`detections`), ramki na wideo (`boxes`), **ślady powietrzne** (`tracks[].wps` =
  `[sekunda, x, y, wysokość_m]`, opcjonalnie `orbit` = krążenie po dolocie),
  zdarzenia w czasie (`events`, np. zrzut), opcje decyzji (`options`) i komentarze
  wpadające między krokami procedury (`interjections`).
* `procedures` – listy kroków z odniesieniem do dokumentu źródłowego.
* `intel`, `intelCards` – warstwa inteligencji: statystyki, rozkłady, profile
  powtarzalnych podmiotów, ocena analityczna i rekomendacje.
* `roe` – stan środków aktywnych przed i po udzieleniu zgody.
* `sites.*.base`, `sites.*.baseCredit` – plik podkładu rastrowego dla widoku
  SATELITA i podpis źródła wyświetlany w rogu mapy.
* `sites.baltica.wtgSpin` – sekundy na obrót wirników turbin na mapie
  (`0` = turbiny nieruchome, spokojniejszy obraz taktyczny na prezentacji).
  Turbina, której dotyczy scenariusz, podświetla się na czerwono (pole
  `highlight` w zdarzeniu – działa też dla jednostek pływających).

Akcje przycisków decyzji (`options[].action`) obsługuje `js/app.js`:
`lock` (autotracking EO/IR), `locate` (triangulacja RF/DF), `patrol`, `notify`,
`jam`, `takeover`, `intercept`, `sat`, `hail`, `permit`, `suspend`, `stopops`,
`gnss`, `priority`, `roe`, `intel`, `analysis`, `confirm`, `hold`, `false`, `close`.
