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

Kółko myszy przybliża mapę, przeciąganie przesuwa, `⟲` wraca do widoku obiektu.
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

Akcje przycisków decyzji (`options[].action`) obsługuje `js/app.js`:
`lock` (autotracking EO/IR), `locate` (triangulacja RF/DF), `patrol`, `notify`,
`jam`, `takeover`, `intercept`, `sat`, `hail`, `permit`, `suspend`, `stopops`,
`gnss`, `priority`, `roe`, `intel`, `analysis`, `confirm`, `hold`, `false`, `close`.
