# Scenariusze demonstracyjne · SPEKTRE AIR dla PGE i PGE Offshore

Dokument prowadzącego demo. Dla każdego scenariusza: **co kliknąć**, **co powiedzieć**
i **pointa**, czyli zdanie, które ma zostać w głowie po wyjściu ze spotkania.
Czasy są realne, mierzone na pełnym przebiegu.

---

## Jak prowadzić

| Wariant | Czas | Scenariusze |
|---|---|---|
| **Krótki (spotkanie zarządcze)** | 12–15 min | 1 → 3 → 2 → inteligencja |
| **Pełny (dla służb ochrony / bezpieczeństwa)** | 30–35 min | 1 → 3 → 2 → 4 → 5 → 6 → 7 → inteligencja |
| **PGE Offshore (Baltica)** | 15–18 min | 5 → 6 → 7 → inteligencja (obiekt Baltica 2) |

**Przed spotkaniem**
1. `./start.sh` (albo `start.bat`), okno przeglądarki na pełnym ekranie, F11.
2. Sprawdź dźwięk – alarmy mają sygnał, kliknij raz w stronę, żeby przeglądarka go dopuściła.
3. Podmień nagrania w `videos/` na prawdziwe, jeśli są dostępne (lista w README).
4. Zacznij przy obiekcie **Bełchatów**, panel po prawej w widoku **SYTUACJA**.
5. Nie włączaj AUTO podczas rozmowy – AUTO jest do pokazu w tle, na stoisku.

**Zasada narracji:** najpierw pokazujesz, że system **nie zawraca głowy operatorowi**
(scenariusz 3), potem że **widzi to, czego człowiek nie zobaczy** (1, 5),
potem że **prowadzi za rękę, kiedy jest naprawdę źle** (2, 4),
a na końcu, że **pamięta i wyciąga wnioski** (inteligencja).

---

## 0 · Otwarcie (40 s)

**Mów:** „To jest konsola operatora w centrum zarządzania. Jeden ekran na zmianę.
Po lewej asystent, który mówi, co się dzieje i co zrobić. Po prawej u góry obraz
powietrzny obiektu, pod spodem obraz z głowicy i – to jest najważniejsze – z czego
system zbudował ten ślad. Na górze poziom zagrożenia i stan środków aktywnych:
zwróćcie uwagę, że są **zablokowane**. Do tego wrócimy.”

**Pokaż:** przełącznik obiektu w lewym górnym rogu – ten sam system obsługuje
elektrownię konwencjonalną i morską farmę wiatrową. Potem wróć na Bełchatów.

---

## 1 · Rozpoznanie BSP nad rozdzielnią 400 kV (5–6 min)

**Kliknij:** przycisk **1**.

**Mów, kiedy ślad wchodzi z zachodu:**
„Radar złapał obiekt 2 km od rozdzielni. Czujniki RF odczytały Remote ID: to DJI
Mavic 3T, mamy numer seryjny. W PansaUTM nie ma zgłoszonego lotu. Obiekt zwalnia
nad rozdzielnią 400 kV i zaczyna krążyć – to nie jest przelot, to jest rozpoznanie.”

**Pokaż po kolei:**
1. **Fuzja sensorów** (prawy dolny panel) – „to nie jest jeden czujnik, tylko pięć
   niezależnych źródeł; radar daje pozycję i wysokość, RF daje tożsamość, EO/IR
   potwierdza wzrokowo, akustyka potwierdza klasę masy, a UTM mówi, że zgody nie ma.
   Alarm powstaje dopiero z tego zestawu – dlatego nie wyje przy każdym ptaku.”
2. **„Przejmij cel na EO/IR i zbliż”** – głowica wchodzi w autotracking,
   na mapie pole widzenia podąża za śladem.
3. **„Zlokalizuj operatora (RF/DF)”** – „trzy czujniki przecinają namiary; operator
   stoi przy drodze dojazdowej, elipsa 35 m. Nie szukamy go w polu, mamy punkt.”
4. **„Wyślij patrol do operatora”** → wybierz najbliższą jednostkę, pokaż, jak jedzie po mapie.
5. **„Zgłoś Policji i do PAŻP”** – „zgłoszenie idzie z pakietem dowodowym, nie z opisem słownym.”
6. **„Uruchom procedurę”** → przejdź 2–3 kroki, pokaż meldunki wpadające między krokami.
   Resztę kroków można kliknąć szybko.

**Pointa:** „Operator nie musi wiedzieć, co zrobić. Musi tylko potwierdzać.
Czas od detekcji do skierowania patrolu – poniżej minuty, a cała ścieżka dowodowa
nagrywa się sama.”

---

## 2 · BSP z ładunkiem i zrzut przedmiotu (6–7 min)

**Kliknij:** przycisk **2**. Wejdź w to po scenariuszu 3, jeśli grasz wariant krótki.

**Mów:** „Tu jest inaczej. Brak Remote ID, łącze szyfrowane, 14 kg, ładunek
podwieszony – widać go w kanale termowizyjnym. Leci poniżej linii dachów, czyli
celowo chowa się przed radarem, najkrótszą trasą do transformatorów blokowych.”

**Pokaż:**
1. **„Przejmij cel na EO/IR i zbliż”** – ładunek w kadrze.
2. **Zakłócanie** – kliknij „Zakłócaj łącze RC”. System **odmawia**: brak zgody.
   „To jest świadoma decyzja projektowa. W Polsce zakłócanie to nie jest przycisk
   dla operatora – to decyzja z podstawą prawną. System sam przygotowuje wniosek.”
3. **„Wystąp o zgodę na środki aktywne (art. 26a)”** – po chwili zgoda wpada,
   pasek u góry zmienia się na **UZBROJONE**, tabela środków po lewej na dole też.
4. Zwróć uwagę na ostrzeżenie systemu: zakłócanie nad transformatorem oznacza
   niekontrolowany upadek ładunku. „System nie tylko wykonuje – on podpowiada,
   dlaczego akurat tutaj nie warto.”
5. **„Wyślij dron przechwytujący”** – pokaż przechwycenie poza obrysem aktywa.
6. Po ok. 2,5 min od startu scenariusza następuje **zrzut przedmiotu** –
   punkt pojawia się na mapie, system od razu mówi: nie wysyłaj nikogo w promieniu 100 m.
7. **„Uruchom procedurę”** – pierwsze kroki to ewakuacja rejonu i wstrzymanie prac,
   dopiero potem służby. „Kolejność nie jest przypadkowa.”

**Pointa:** „Najdroższy element elektrowni to transformator blokowy, a czas dostawy
nowego liczy się w miesiącach. To jest scenariusz, w którym system zarabia na siebie
jeden raz i na zawsze.”

---

## 3 · Dwa ślady odrzucone automatycznie (3–4 min)

**Kliknij:** przycisk **3**. **To jest najważniejszy scenariusz dla operatora i dla kosztów.**

**Mów:** „Zobaczcie, że nie ma alarmu. Są dwa nowe ślady i oba system zamknął sam.
Pierwszy to klucz ptaków: radar widzi mikro-Doppler trzepotania 3,8 Hz zamiast
wirnika, nie ma żadnej emisji RF, a wysokość rośnie i spada z kominem termicznym.
Drugi to dron inspekcyjny wykonawcy – Remote ID zgadza się z planem lotu w PansaUTM
i lata w zatwierdzonym korytarzu.”

**Pokaż:**
1. **„Pokaż uzasadnienie klasyfikacji”** – przeczytaj na głos liczby.
2. **„Sprawdź zgodę i plan lotu BSP”** – zgoda, wykonawca, pilot, ważność.
3. Widok **INTELIGENCJA** → kafelek „zamkniętych automatycznie: 1 284 z 1 309”.

**Pointa:** „System, który budzi operatora 40 razy na dobę, zostaje wyłączony
po tygodniu. Ten budzi 25 razy na miesiąc – i za każdym razem ma rację.”

---

## 4 · Rój pięciu BSP (4–5 min)

**Kliknij:** przycisk **4**.

**Mów:** „Pięć śladów w dwadzieścia sekund, z czterech kierunków, identyczny profil
prędkości. Korelacja czasowa 0,96 – to nie jest przypadek, to jest atak skoordynowany.
I teraz najważniejsze: **żaden z nich nie ma łącza RC**. To lot autonomiczny,
po zaprogramowanych punktach.”

**Pokaż:**
1. **„Przypisz priorytety celów”** – lista P1…P5 według odległości do aktywa.
2. **„Zakłócaj łącze RC”** (po uzyskaniu zgody) – **bez efektu**.
   „To jest pytanie, które warto zadać każdemu dostawcy: co wasz system robi,
   kiedy dron nie ma łącza do zakłócenia?”
3. **„Wyślij dron przechwytujący na cel priorytetowy”**.
4. **„Uruchom procedurę”** – zamknięcie bram, ludzie pod osłoną, zgłoszenie do ABW.

**Pointa:** „Zakłócanie nie jest odpowiedzią na wszystko. Dlatego system pokazuje
operatorowi, który środek ma sens w tym konkretnym zdarzeniu – i blokuje te,
które nie zadziałają.”

---

## 5 · BSP startujący z jednostki bez AIS · Baltica 2 (6–7 min)

**Kliknij:** przycisk **5** – demo samo przełączy obiekt na morską farmę wiatrową.

**Mów:** „Jesteśmy na Baltica 2, jest druga w nocy. Radar morski od czternastu minut
prowadzi echo nawodne, które **nie ma AIS**. O 02:41 z tej jednostki startuje dron
i leci na morską stację OSS – czyli na najdroższy i najbardziej krytyczny element
całej farmy.”

**Pokaż:**
1. **„Pokaż korelację AIS / radar / RF”** – „ten sam punkt na morzu jest echem
   nawodnym, źródłem łącza RC i punktem startu śladu powietrznego. Trzy niezależne
   warstwy, jedna konkluzja.”
2. **„Przejmij cel na EO/IR i zbliż”** – obraz IR: ciepłe silniki jednostki i dron nad pokładem.
3. **„Wywołaj jednostkę na VHF kanał 16”** – brak odpowiedzi, jednostka przyspiesza.
   Nagranie wywołania ląduje w karcie zdarzenia.
4. **„Powiadom Straż Graniczną i VTS”** oraz **„Zamów zobrazowanie satelitarne akwenu”**.
5. **„Wstrzymaj transfery na turbiny w sektorze”** – „to jest decyzja o bezpieczeństwie
   ludzi, nie o sprzęcie: dziewięciu techników zostaje na turbinach w procedurze oczekiwania.”
6. **„Uruchom procedurę”** – krok 1 to zapis luki w AIS jako dowodu.

**Pointa:** „Offshore nie chodzi o to, żeby zestrzelić drona 200 km od brzegu.
Chodzi o to, żeby mieć **udokumentowany, przekazywalny materiał** dla Straży Granicznej
i Marynarki Wojennej – i o to, żeby ludzie na turbinach wiedzieli wcześniej.”

---

## 6 · Zakłócanie GNSS w akwenie farmy (3–4 min)

**Kliknij:** przycisk **6**.

**Mów:** „To zdarzenie, którego nie widać na żadnej kamerze. Trzy niezależne
odbiorniki tracą jakość pozycji w tej samej sekundzie: stacja referencyjna na OSS,
dron inspekcyjny i jednostka transferowa. Spadek 14 dB, rozbieżność pozycji 160 metrów.”

**Pokaż:**
1. **„Potwierdź na niezależnych odbiornikach”** – lista.
2. **„Pokaż namiary i widmo”** – zwróć uwagę na widmo RF w prawym panelu (szerokopasmowe).
3. **„Wstrzymaj loty BSP i operacje DP”** – dron inspekcyjny wraca.
4. **„Zgłoś do UKE i PAŻP”** – „zgłoszenie z widmem i namiarami, nie e-mail «coś nam nie działa»”.

**Pointa:** „Zakłócanie GNSS zatrzymuje transfer personelu i operacje DP –
to są realne godziny przestoju. System zamienia je w udokumentowane zdarzenie
z pozycją źródła.”

---

## 7 · Autoryzowany BSP poza korytarzem inspekcyjnym (2–3 min)

**Kliknij:** przycisk **7**.

**Mów:** „Nie każde zdarzenie to zagrożenie celowe. Tu dron wykonawcy ma ważną zgodę,
poprawny Remote ID – i podchodzi na 22 metry do pracującego wirnika, chociaż warunek
zgody mówi: wirnik zatrzymany.”

**Pokaż:**
1. **„Sprawdź zgodę i warunki lotu”** – warunek niespełniony.
2. **„Ostrzeż operatora przez kanał roboczy”** – pilot wycofuje drona.
3. **„Nakaż zawieszenie lotu”** → karta niezgodności dla wykonawcy.

**Pointa:** „Ten sam system, bez dokładania sprzętu, pilnuje bezpieczeństwa pracy
i dyscypliny wykonawców. To jest argument dla służb BHP i dla nadzoru nad kontraktami.”

---

## 8 · Zamknięcie: warstwa inteligencji (3–4 min)

**Kliknij:** zakładkę **INTELIGENCJA** (na obiekcie Bełchatów).

**Mów:** „Tu kończy się system antydronowy, a zaczyna centrum inteligencji.
Pojedyncze zdarzenie to incydent. Dziewięć zdarzeń w trzydzieści dni to wzorzec.”

**Pokaż:**
1. **Kafelki** – 1 309 śladów, 1 284 zamknięte automatycznie, 25 alarmów, 2 fałszywe.
2. **Rozkład dobowy** – zapalony kwadrat w czwartek, 18:00–20:00.
3. **Profil OP-114** – trzy wejścia tego samego numeru seryjnego, zawsze czwartek,
   zawsze z zachodniego pobocza. **I ten sam numer w Elektrowni Turów.**
   „To jest korelacja ponadobiektowa. Pojedyncza elektrownia tego nie zobaczy.
   Grupa – tak.”
4. **Rekomendacje** – patrol Policji w czwartek 18:30–19:30, dołożenie jednego
   czujnika RF od zachodu, przygotowany z wyprzedzeniem wniosek o środki aktywne.
5. Przełącz obiekt na **Baltica 2** → **INTELIGENCJA** → profil jednostki DS-03.
   „Ta sama logika na morzu: trzy wejścia, zawsze od wschodu, zawsze z wyłączonym AIS,
   dwa razy przed planowanym transferem personelu.”

**Pointa końcowa:** „Pierwsza wartość tego systemu to wykrycie. Druga, większa,
to **pamięć**: po pół roku wiecie, kto, kiedy i którędy wraca do waszych obiektów –
i możecie z tym pójść do Policji, ABW albo Straży Granicznej z materiałem,
a nie z wrażeniem.”

---

## Pytania, które padną – i krótkie odpowiedzi

| Pytanie | Odpowiedź |
|---|---|
| „Czy możemy legalnie zakłócać drony?” | Nie z poziomu operatora i nie bez podstawy. Dlatego w demo środki aktywne są domyślnie zablokowane, a system przygotowuje wniosek i rejestruje użycie. Zakres uzgadniamy z działem prawnym, Policją/ABW i UKE przed wdrożeniem. |
| „Ile fałszywych alarmów?” | Scenariusz 3 pokazuje mechanizm: alarm powstaje z fuzji, nie z jednego czujnika. W danych demo: 25 alarmów na 1 309 śladów w 30 dni. Docelowy poziom ustalamy na danych z waszego obiektu w fazie pilotażu. |
| „Czy to integruje się z naszym systemem ochrony / SCADA?” | Warstwa zdarzeń jest otwarta: zdarzenie, ślad, pakiet dowodowy i decyzje da się wypchnąć do PSIM/SIEM, a sygnał „zagrożenie nad aktywem” do służb ruchu. Integracje projektujemy po stronie klienta, nie zamiast niej. |
| „Co z łącznością offshore?” | Przetwarzanie jest lokalne na OSS – fuzja i klasyfikacja działają bez łącza do brzegu. Na brzeg idą zdarzenia i materiał dowodowy, nie surowe wideo. |
| „Czy dron przechwytujący jest potrzebny?” | Nie na start. Detekcja, identyfikacja, lokalizacja operatora i procedura dają większość wartości. Środki fizyczne dokłada się później, razem z podstawą prawną. |
| „Co z wizerunkiem osób na nagraniach?” | Nagrania i dane operatorów są materiałem dowodowym z retencją i dostępem na zasadach jak dla monitoringu obiektu; w demo pokazujemy pakiet dowodowy z sumą kontrolną. |
| „Ile trwa wdrożenie?” | Pilotaż na jednym obiekcie: sensory + konsola + procedury. Dopiero po nim rozszerzenie na kolejne obiekty, z jedną wspólną warstwą inteligencji – bo jej wartość rośnie z liczbą obiektów. |

---

## Uwaga o danych

Wszystkie nazwy, numery seryjne, zgłoszenia, numery spraw, statystyki i profile
w demo są **przykładowe**. Odniesienia prawne w procedurach są poglądowe
i przed wdrożeniem wymagają potwierdzenia. Nagrania w `videos/` to klipy zastępcze
do czasu podmiany na materiał z obiektu.
