# Prompty do Runway · nagrania dla demo SPEKTRE AIR

Demo potrzebuje **12 klipów**. Pięć to pętle dozoru głowic EO/IR (spokojne, zapętlone),
siedem to klipy zdarzeń. Trzynasty plik z listy w README (`eoir-13.mp4`) **nie jest
potrzebny** – sensor EOIR-13 jest oznaczony jako offline, więc aplikacja nigdy go nie
odtwarza, tylko pokazuje planszę „sensor offline”.

## Zasady wspólne

* **Kadr 16:9.** Aplikacja skaluje obraz z przycięciem (`object-fit: cover`), więc
  liczy się środek kadru.
* **Bez napisów i bez HUD-u.** Ramki detekcji, celownik, czas i etykiety rysuje
  aplikacja na wierzchu. Wygenerowany HUD będzie się z nimi gryzł, a generatory i tak
  źle rysują tekst – w promptach jest to pominięte celowo.
* **Pozycja celu w kadrze ma znaczenie.** Aplikacja rysuje ramki w konkretnych
  procentach kadru (podane niżej przy każdym klipie). Jeśli Runway umieści obiekt
  gdzie indziej, popraw `boxes` przy danym zdarzeniu w `js/data.js` – to dwie liczby.
* **Długość:** 5 s dla pętli dozoru, 10 s dla zdarzeń.
* **Dźwięk niepotrzebny** – odtwarzacz jest wyciszony.
* Jeśli Twój model wymaga obrazu wejściowego (tryb image-to-video), wygeneruj najpierw
  klatkę tym samym promptem, a opis ruchu z pola „Ruch” wklej jako animację.

## Po wygenerowaniu

Przekonwertuj i nazwij zgodnie z listą (nazwy muszą się zgadzać co do znaku):

```bash
ffmpeg -i pobrany-z-runway.mp4 \
  -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720" \
  -c:v libx264 -crf 23 -pix_fmt yuv420p -an videos/inc-01-recon.mp4
```

Pliki wrzuć do `antydron/videos/`, nadpisując klipy zastępcze. Wersje `.webm` można
usunąć – odtwarzacz próbuje najpierw `.mp4`.

---

# A. Pętle dozoru głowic EO/IR (5 klipów, po 5 s)

## 1. `eoir-01.mp4` — EOIR-1, rozdzielnia 400 kV (Bełchatów)

```
Long-lens security camera view of a high-voltage electrical switchyard at a large
coal-fired power plant, late afternoon. Rows of steel lattice gantries, ceramic
insulators and busbars recede into the distance, gravel ground between them, a
transformer block on the right, cooling tower vapour drifting far behind. Warm low
sunlight, long shadows, heat shimmer rising from the gravel. Static locked-off
telephoto shot with a very slow push-in, shallow compression, faint digital sensor
noise, realistic surveillance footage look.
```
**Ruch:** kamera nieruchoma, bardzo powolne zbliżenie, lekkie drganie obrazu.

## 2. `eoir-02.mp4` — EOIR-2, maszynownia / blok 858 MW

```
Rooftop surveillance camera looking along the roof of a vast power plant turbine
hall, corrugated steel roof panels stretching to the horizon, pipe bridges and
ventilation stacks, white steam venting from a relief valve in the middle distance,
a tall chimney and cooling towers behind. Overcast midday light, muted industrial
colours. Static wide telephoto shot with slow lateral drift, subtle wind movement
in the steam, realistic surveillance footage look.
```
**Ruch:** powolny przesuw w poziomie, para kłębi się w średnim planie.

## 3. `eoir-03.mp4` — EOIR-3, chłodnie kominowe

```
Surveillance camera view of two enormous hyperboloid concrete cooling towers at a
coal power plant, thick white vapour billowing from their tops and drifting
sideways in the wind, weathered concrete shells, service stairways on the outside,
a grey industrial yard at their base. Soft overcast daylight, cold colour palette.
Static locked-off shot, slow upward tilt, realistic surveillance footage look with
faint sensor grain.
```
**Ruch:** nieruchomy kadr, powolne uniesienie obiektywu, para przesuwa się z wiatrem.

## 4. `eoir-11.mp4` — EOIR-11, platforma OSS (Baltica 2, noc, IR)

```
White-hot thermal infrared camera view from an offshore substation platform at
night, monochrome greyscale thermal imaging. The steel platform railing and warm
transformer housings glow bright, the cold black sea stretches to a flat horizon,
a distant service vessel shows a hot engine exhaust signature. Gentle swell, faint
thermal noise and sensor shimmer, no colour at all, realistic cooled-IR camera
footage look.
```
**Ruch:** powolny obrót w prawo wzdłuż horyzontu.

## 5. `eoir-12.mp4` — EOIR-12, turbina B-18 (Baltica 2, dzień)

```
Camera mounted on an offshore wind turbine nacelle looking across open sea at a
neighbouring white offshore wind turbine, its three blades turning slowly, tower
rising from a yellow transition piece in the waves. More turbines fade into haze on
the horizon. Overcast marine daylight, grey-blue water with small whitecaps. Static
locked-off telephoto shot with slight platform sway, realistic surveillance footage
look.
```
**Ruch:** lekkie kołysanie platformy, łopaty obracają się miarowo.

---

# B. Klipy zdarzeń (7 klipów, po 10 s)

## 6. `inc-01-recon.mp4` — ZD-01, rozpoznanie nad rozdzielnią
**Cel w kadrze: ok. 44–57 % szerokości, 28–43 % wysokości (prawa część, górna trzecia).**

```
Long-lens surveillance camera tracking a small grey quadcopter drone hovering high
in the sky above a high-voltage switchyard, late afternoon. The drone sits in the
upper right third of the frame against pale sky, its four rotors a motion blur, a
small gimbal camera underneath pointing down. Blurred steel gantries and busbars of
the switchyard far below at the bottom edge of the frame. Strong telephoto
compression, slight hunting tracking motion as the camera follows the drone,
atmospheric haze, faint digital noise, realistic surveillance footage look.
```
**Ruch:** kamera podąża za dronem z lekkim „polowaniem”, dron dryfuje i zawisa.

## 7. `inc-02-payload.mp4` — ZD-02, BSP z ładunkiem
**Cel: ok. 38–58 % szerokości, 24–44 % wysokości; ładunek tuż pod dronem (44–53 % / 44–53 %).**

```
Telephoto surveillance camera view of a large black octocopter drone flying slowly
across a dusk sky, carrying a rectangular package slung on short straps beneath its
frame. Eight rotor discs blur, the heavy airframe sags slightly under the load.
Positioned just left of centre in the upper half of the frame, with the suspended
package hanging directly below it in the middle of the frame. Industrial silhouettes
and a transformer yard out of focus at the bottom. Fading orange dusk light, high
contrast, shallow depth of field, slight camera tracking drift, realistic
surveillance footage look.
```
**Ruch:** dron sunie powoli w poprzek kadru, ładunek kołysze się pod nim.

## 8. `inc-03-birds.mp4` — ZD-03, ptaki i dron autoryzowany
**Klucz ptaków: 24–46 % / 20–34 %. Dron inspekcyjny: 62–74 % / 46–58 %.**

```
Telephoto camera view of a bright overcast sky above an industrial site. In the
upper left area a loose V-shaped skein of about eleven large birds flaps steadily
across the frame, wings clearly beating. In the lower right area a small white
quadcopter drone flies a straight steady line, rotors blurred, clearly a machine
rather than a bird. Flat diffuse daylight, pale grey sky, distant plant structures
blurred along the bottom edge, mild atmospheric haze, realistic long-lens
surveillance footage look.
```
**Ruch:** ptaki trzepoczą i dryfują w lewo, dron leci równo i bez wahań.
*To najważniejszy klip całego demo – ma pokazywać różnicę między ptakami a maszyną.*

## 9. `inc-04-swarm.mp4` — ZD-04, rój pięciu BSP
**Cztery cele: 16–27 % / 26–37 %, 34–45 % / 20–31 %, 52–63 % / 30–41 %, 70–81 % / 22–33 %.**

```
Telephoto surveillance camera view of a dusk sky with four small dark fixed-wing
style drones flying in a loose spread formation at altitude, evenly distributed
across the frame at slightly different heights, each with a blurred nose propeller
and short straight wings. They hold a steady parallel course. Deep blue and orange
dusk gradient, thin cloud, power plant chimneys as dark silhouettes along the bottom
edge. Slight camera pan to keep the group framed, atmospheric haze, realistic
surveillance footage look.
```
**Ruch:** grupa leci równolegle, kamera lekko panoramuje, by utrzymać je w kadrze.

## 10. `inc-05-vessel.mp4` — ZD-05, start BSP z jednostki (noc, IR)
**BSP: 40–54 % / 30–44 %. Jednostka: 20–50 % / 62–78 % (lewy dolny róg).**

```
White-hot thermal infrared camera view at night over open sea, monochrome greyscale
thermal imaging. In the lower left a small vessel about twenty metres long sits on
dark water, its engine exhaust and deck machinery glowing bright white, hull a warm
grey outline, a faint wake behind it. Above and right of it a six-rotor drone climbs
slowly away from the deck, its motors reading as six hot points, body a cooler grey
shape. Flat black sea, no colour at all, thermal sensor noise, slow gentle camera
drift, realistic cooled-IR maritime surveillance footage look.
```
**Ruch:** dron wznosi się powoli znad pokładu, kamera dryfuje za nim.

## 11. `inc-06-gnss.mp4` — ZD-06, dron inspekcyjny w zawisie (utrata GNSS)
**Cel: 46–59 % / 36–49 % (środek kadru).**

```
Telephoto camera view from an offshore wind turbine looking at a white inspection
quadcopter hovering motionless in mid-air in the centre of the frame, holding
position beside the huge white tower of an offshore wind turbine. The drone drifts
very slightly and corrects itself, rotors blurred. Grey-blue sea far below, overcast
marine light, the turbine tower filling the right side of the frame out of focus.
Slight platform sway in the camera, salt haze, realistic surveillance footage look.
```
**Ruch:** dron wisi w miejscu i delikatnie dryfuje, kamera lekko się kołysze.

## 12. `inc-07-corridor.mp4` — ZD-07, BSP przy obracającej się łopacie
**Cel: 42–56 % / 34–48 % (środek kadru).**

```
Telephoto camera view of a white inspection quadcopter flying dangerously close to
the rotating blade of an offshore wind turbine, the long white blade sweeping
through the frame behind and past the drone, blade tip passing with visible speed.
The drone holds position in the centre of the frame, rotors blurred, small gimbal
camera facing the blade. Overcast marine daylight, sea surface far below, scale
emphasised by the enormous blade against the small aircraft. Slight camera sway,
realistic surveillance footage look.
```
**Ruch:** łopata przecina kadr za dronem, dron trwa w miejscu.

---

## Kolejność generowania, jeśli masz ograniczony budżet

1. `inc-01-recon` – otwiera demo
2. `inc-03-birds` – scena, która sprzedaje niską liczbę fałszywych alarmów
3. `inc-02-payload` – najmocniejszy scenariusz zagrożenia
4. `inc-05-vessel` – jedyna scena offshore z zagrożeniem
5. `eoir-01`, `eoir-11` – dwie pętle dozoru, po jednej na obiekt
6. reszta
