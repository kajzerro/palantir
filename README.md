# SENTINEL-CI · CCTV anomaly detection demo (coal mine)

Clickable demo of a Palantir-style operations console for critical
infrastructure: an AI layer that watches a coal mine's CCTV, detects dangerous
patterns, alerts the security operator and walks them through the mandatory
procedure.

No build step, no dependencies – plain HTML / CSS / JS.

## Run

```bash
# any static server works; from the repo root:
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` straight from disk also works in Chrome/Edge/Firefox.

## Layout

| Panel | What it does |
|---|---|
| **Left – Operations terminal** | Chat-style terminal. Every SENTINEL message that needs a decision comes with numbered, clickable options. You can also type commands (`help`, `status`, `cams`, `cam 8`, `next`, `auto`, `proc`, `log`, `clear`) or answer with the option number. |
| **Top right – Digital twin** | Cross-section of the mine (surface, Shaft I, Level −300, Level −500, longwalls, conveyor drift, magazine, fan…). Each dot is a CCTV camera. Click a dot to open it on the live feed. Dots turn **red/pulsing** on an anomaly, **amber** while a procedure is running, **grey** when offline. |
| **Bottom right – Live feed** | Plays the selected camera's video, with AI detection boxes, detection list, camera metadata and the recent-events list. Shows an animated NO SIGNAL placeholder until a video file is present. |

## Demo flow

1. Press **NEXT EVENT** (or type `next`) – the next scripted anomaly fires:
   the camera dot flashes red, the feed switches to that camera with
   bounding boxes, the terminal prints an ALERT and asks *what do you want to do next?*
2. Options: confirm the anomaly, request a detailed AI analysis, keep watching
   (auto re-alert after 20 s), or mark as false alarm.
3. After confirmation SENTINEL opens the applicable procedure (e.g.
   `PROC-F-02 Fire on a belt conveyor`), shows the whole checklist and asks
   for each step in turn (**Done** / **Not possible – flag deviation** / **Show full procedure**).
   Scripted live updates (CO readings, crew confirmations, rescue team ETA) appear between steps.
4. When the last step is confirmed the incident is closed, a report ID is
   filed and the camera returns to nominal.
5. **AUTO** plays the whole scenario by itself (next event ~10 s after an
   incident is closed).

Scripted incidents, in order:

| # | Camera | Severity | Pattern |
|---|---|---|---|
| INC-01 | CAM-02 Lamp Room | LOW | Worker without self-rescuer heading to the cage |
| INC-02 | CAM-10 Explosives Magazine | HIGH | Unbadged person, door open outside blasting window |
| INC-03 | CAM-08 Conveyor Drift | CRITICAL | Smoke + hot spot on belt, belt still running |
| INC-04 | CAM-12 Longwall W-7 | CRITICAL | Motionless worker in shearer path, CH₄ rising |
| INC-05 | CAM-01 Main Gate | HIGH | Perimeter breach, vehicle without plates |
| INC-06 | CAM-05 Main Fan | HIGH | Unattended object at fan intake |
| INC-07 | CAM-06 Pit Bottom −300 | MEDIUM | Person under suspended load |

## Adding your videos

Drop files into `videos/` – nothing else to change:

| File | Used when |
|---|---|
| `videos/cam-01.mp4` … `videos/cam-13.mp4` | Idle loop for each camera (opened from the digital twin) |
| `videos/inc-01-ppe.mp4` | INC-01 fires on CAM-02 |
| `videos/inc-02-magazine.mp4` | INC-02 fires on CAM-10 |
| `videos/inc-03-conveyor-fire.mp4` | INC-03 fires on CAM-08 |
| `videos/inc-04-worker-down.mp4` | INC-04 fires on CAM-12 |
| `videos/inc-05-perimeter.mp4` | INC-05 fires on CAM-01 |
| `videos/inc-06-object.mp4` | INC-06 fires on CAM-05 |
| `videos/inc-07-loading-zone.mp4` | INC-07 fires on CAM-06 |

MP4 (H.264) or WebM. Videos autoplay muted and loop. If an incident clip is
missing the camera's idle clip is used; if that is missing too, the NO SIGNAL
placeholder tells you which file it expected.

All paths, cameras, incidents, detection boxes (`boxes`, in % of the frame),
procedures and canned chat replies are in `js/data.js`. Camera dot positions
(`x`, `y`, `dir`) are in the SVG coordinate space of the digital twin
(`viewBox 0 0 1000 560`).
