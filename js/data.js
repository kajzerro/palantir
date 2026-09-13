/* ==========================================================================
   SENTINEL-CI demo data
   --------------------------------------------------------------------------
   Everything scripted lives here: cameras (with their video files), the
   anomaly scenarios the AI "detects", the decision options offered to the
   operator, and the procedures the operator must follow.

   VIDEOS
   ------
   Each camera has a `video` path. Put your file there (mp4 / webm, H.264
   recommended) and it plays when the camera is opened. Each incident can
   also carry its own `video` – when the anomaly fires, the feed switches
   to that clip instead of the camera's idle loop. Missing files simply
   show a NO SIGNAL placeholder, so you can add videos one by one.
   ========================================================================== */

window.MINE_DATA = (function () {

  const cameras = [
    { id: "CAM-01", name: "Main Gate",                 zone: "Surface · Perimeter",        x: 72,  y: 96,  dir: 30,  type: "PTZ 4K · LPR",      video: "videos/cam-01.mp4" },
    { id: "CAM-02", name: "Lamp Room / Pit-head Baths", zone: "Surface · Personnel flow",   x: 210, y: 98,  dir: 90,  type: "Dome 4K",           video: "videos/cam-02.mp4" },
    { id: "CAM-03", name: "Cage Landing · Shaft I",    zone: "Surface · Headframe",        x: 456, y: 100, dir: 200, type: "Bullet 4K · Ex-d",  video: "videos/cam-03.mp4" },
    { id: "CAM-04", name: "Coal Prep Plant · Floor 1", zone: "Surface · Processing",       x: 655, y: 100, dir: 250, type: "Thermal + RGB",     video: "videos/cam-04.mp4" },
    { id: "CAM-05", name: "Main Fan House",            zone: "Surface · Ventilation",      x: 798, y: 98,  dir: 180, type: "Dome 4K",           video: "videos/cam-05.mp4" },
    { id: "CAM-06", name: "Pit Bottom −300",           zone: "Level −300 · Shaft I",       x: 448, y: 262, dir: 0,   type: "Ex-d IP67 · IR",    video: "videos/cam-06.mp4" },
    { id: "CAM-07", name: "Longwall L-12 · Face",      zone: "Level −300 · Seam 405/1",    x: 255, y: 262, dir: 180, type: "Ex-d IP67 · IR",    video: "videos/cam-07.mp4" },
    { id: "CAM-08", name: "Conveyor Drift D-2",        zone: "Incline −300 → −500",        x: 610, y: 372, dir: 225, type: "Thermal + RGB Ex-d",video: "videos/cam-08.mp4" },
    { id: "CAM-09", name: "Pit Bottom −500",           zone: "Level −500 · Shaft I",       x: 448, y: 442, dir: 0,   type: "Ex-d IP67 · IR",    video: "videos/cam-09.mp4" },
    { id: "CAM-10", name: "Explosives Magazine",       zone: "Level −500 · Restricted",    x: 290, y: 486, dir: 180, type: "Ex-d IP67 · IR",    video: "videos/cam-10.mp4" },
    { id: "CAM-11", name: "CH₄ Drainage Station",      zone: "Level −500 · Gas plant",     x: 590, y: 486, dir: 0,   type: "Ex-d IP67 · IR",    video: "videos/cam-11.mp4" },
    { id: "CAM-12", name: "Longwall W-7 · Face",       zone: "Level −500 · Seam 510",      x: 812, y: 462, dir: 0,   type: "Ex-d IP67 · IR",    video: "videos/cam-12.mp4" },
    { id: "CAM-13", name: "Refuge Chamber RC-2",       zone: "Level −500 · Safety",        x: 790, y: 486, dir: 180, type: "Ex-d · IR",         video: "videos/cam-13.mp4", offline: true },
  ];

  /* ------------------------------------------------------------------
     Procedures – referenced by incidents. Each step is shown one at a
     time in the terminal; the operator marks it done / not possible.
     ------------------------------------------------------------------ */
  const procedures = {
    "PROC-PPE-01": {
      title: "Missing PPE / self-rescuer at shaft access",
      ref: "Mine Operating Rules §7.3 · Dz.U. 2017 poz. 1118 §82",
      steps: [
        "Stop the person at the cage landing turnstile – radio the banksman (ch. 3).",
        "Verify with the Lamp Room clerk whether a self-rescuer was issued (badge log).",
        "If not issued: send the worker back to the Lamp Room. Do NOT allow descent.",
        "Inform the shift supervisor of the breach (name, badge, time).",
        "Close the incident and attach the video clip to the shift report.",
      ],
    },
    "PROC-SEC-04": {
      title: "Unauthorised presence at the Explosives Magazine",
      ref: "Explosives Handling Instruction IE-04 · WUG regulation §46",
      steps: [
        "Remote-lock the magazine outer door (interlock EM-D1) and confirm door state.",
        "Radio the magazine keeper on duty – confirm whether the entry is authorised.",
        "Dispatch the underground security patrol to Gallery G-7 west (ETA ~6 min).",
        "Freeze the badge-access log for the last 60 min – export for evidence.",
        "If entry is confirmed unauthorised: notify the Mine Manager and the District Mining Authority (OUG) within 1 h.",
        "Perform a stock count of the magazine with two signatures.",
      ],
    },
    "PROC-F-02": {
      title: "Fire / overheating on a belt conveyor",
      ref: "Mine Emergency Plan · Section 4.2 (fire underground)",
      steps: [
        "Stop conveyor D-2 immediately (dispatcher interlock BC-D2). Confirm belt stopped on camera.",
        "Check CO / smoke sensors along D-2 in the gas-monitoring system – note readings.",
        "Alert the mine dispatcher and the Mine Rescue Station (KSRG). State: location, source, CO reading.",
        "Order all personnel downstream (Gallery G-7, Longwall W-7) to withdraw against the airflow to the pit bottom −500.",
        "Send the first-response team with extinguishers and a thermal camera to idler set B-14.",
        "If the fire is not extinguished within 10 min or CO > 200 ppm: start Level −500 evacuation.",
        "Keep the affected camera on the main feed until the rescue leader declares the area safe.",
      ],
    },
    "PROC-MED-01": {
      title: "Motionless worker / suspected injury at the face",
      ref: "Mine Emergency Plan · Section 6.1 (injury) · 3.4 (methane)",
      steps: [
        "Stop the shearer and the face conveyor remotely (interlock LW-W7). Confirm on camera.",
        "Raise the face crew on the intercom – ask a colleague to check the worker.",
        "Check CH₄ at the sensor W7 – if ≥ 1.5 %: cut power in the zone (methanometry auto-trip).",
        "Call the underground medical point and the Mine Rescue Station – give location: Longwall W-7, section 38–42.",
        "Prepare the cage at Shaft I for medical transport (priority winding).",
        "Report to the shift supervisor and open an accident record.",
      ],
    },
    "PROC-SEC-01": {
      title: "Perimeter breach",
      ref: "Physical Security Plan · Chapter 3 · Anti-terrorist Act art. 5",
      steps: [
        "Trigger the perimeter siren and floodlights at Sector A (Main Gate).",
        "Dispatch the surface security patrol; keep CAM-01 tracking the intruders (PTZ auto-track).",
        "Call the Police (112) – state: coal mine, 2 persons, vehicle without plates, direction of movement.",
        "Lock down the headframe and the lamp room – no descent until the area is cleared.",
        "Export the clip and LPR snapshots to the incident folder.",
      ],
    },
    "PROC-SEC-07": {
      title: "Unattended object near critical equipment",
      ref: "Physical Security Plan · Chapter 5 · CBRN annex",
      steps: [
        "Do NOT approach. Establish a 50 m cordon around the fan house.",
        "Keep the main fan running unless instructed otherwise by the ventilation engineer.",
        "Call the Police bomb-disposal unit (112) and the Mine Manager.",
        "Review CAM-05 recording −15 min to identify the person and their route.",
        "Route all surface personnel away from Sector C.",
      ],
    },
    "PROC-OPS-03": {
      title: "Person in the suspended-load / cage loading zone",
      ref: "Mine Operating Rules §11.2 · Shaft Winding Instruction",
      steps: [
        "Halt the winder (banksman signal 'STOP') until the zone is clear.",
        "Instruct the person over the pit-bottom intercom to leave the marked zone.",
        "Confirm the zone is clear on camera and release the winder.",
        "Log the event against the badge holder for the safety briefing.",
      ],
    },
  };

  /* ------------------------------------------------------------------
     Incidents – fired in this order by NEXT EVENT / auto mode.
     `boxes` are % coordinates of overlay boxes drawn over the video.
     ------------------------------------------------------------------ */
  const incidents = [
    {
      id: "INC-01",
      cam: "CAM-02",
      severity: "LOW",
      title: "Worker without self-rescuer heading to cage landing",
      summary: "Person track #4412 left the Lamp Room towards Shaft I without a self-rescuer on the belt. Helmet OK, lamp OK.",
      detections: [
        ["person", 0.98], ["helmet", 0.95], ["cap lamp", 0.91], ["self-rescuer MISSING", 0.87], ["direction: shaft", 0.9],
      ],
      boxes: [{ x: 41, y: 22, w: 14, h: 58, label: "PERSON · no self-rescuer", cls: "attn" }],
      procedure: "PROC-PPE-01",
      video: "videos/inc-01-ppe.mp4",
      aiNotes: "Badge reader shows worker K. Nowak (badge 2231) checked out lamp 0413 but no self-rescuer was scanned at the SR dispenser. Estimated arrival at the turnstile in 40 s.",
    },
    {
      id: "INC-02",
      cam: "CAM-10",
      severity: "HIGH",
      title: "Unauthorised presence at the Explosives Magazine",
      summary: "Outer door of the magazine open for 46 s outside the blasting window. One person inside the anteroom, no badge event on reader EM-R1.",
      detections: [
        ["person", 0.97], ["door OPEN", 0.99], ["no badge event", 1.0], ["time outside window", 1.0], ["carried object", 0.62],
      ],
      boxes: [
        { x: 30, y: 18, w: 16, h: 64, label: "PERSON · unbadged", cls: "" },
        { x: 62, y: 8,  w: 20, h: 70, label: "DOOR OPEN 46 s", cls: "attn" },
      ],
      procedure: "PROC-SEC-04",
      video: "videos/inc-02-magazine.mp4",
      aiNotes: "Last authorised entry: blasting foreman J. Kowal 05:52, exit 06:04. Door interlock EM-D1 reports 'manual override' since 06:31. The person's gait matches track #0912 seen at CAM-09 at 06:26.",
    },
    {
      id: "INC-03",
      cam: "CAM-08",
      severity: "CRITICAL",
      title: "Smoke and hot spot on conveyor D-2 – belt still running",
      summary: "Thermal channel: 214 °C at idler set B-14. RGB channel: visible smoke plume, growing. Belt speed nominal 2.5 m/s – belt has NOT stopped.",
      detections: [
        ["smoke", 0.96], ["hot spot 214 °C", 0.99], ["belt moving", 0.98], ["CO sensor D2-3: 38 ppm ↑", 1.0], ["person nearby: none", 0.9],
      ],
      boxes: [
        { x: 44, y: 34, w: 18, h: 22, label: "HOT SPOT 214 °C", cls: "" },
        { x: 36, y: 10, w: 34, h: 40, label: "SMOKE", cls: "attn" },
      ],
      procedure: "PROC-F-02",
      video: "videos/inc-03-conveyor-fire.mp4",
      aiNotes: "Temperature trend: +31 °C/min. Airflow carries smoke towards Gallery G-7 (Longwall W-7 crew of 14). Nearest fire-fighting point: FP-D2-3, 40 m upstream. Automatic belt trip did NOT engage – sensor TS-B14 last reported 09:41 (possible fault).",
      sensors: { DR: 0.21 },
    },
    {
      id: "INC-04",
      cam: "CAM-12",
      severity: "CRITICAL",
      title: "Motionless worker in the shearer path · CH₄ rising",
      summary: "Person track #7781 has been lying motionless for 74 s between sections 39–40 while the shearer approaches (12 m). CH₄ at W7: 1.38 % and rising.",
      detections: [
        ["person DOWN", 0.94], ["no motion 74 s", 1.0], ["shearer approaching", 0.97], ["CH₄ 1.38 % ↑", 1.0], ["crew nearby: 2", 0.88],
      ],
      boxes: [
        { x: 38, y: 58, w: 26, h: 18, label: "PERSON DOWN · 74 s", cls: "" },
        { x: 68, y: 20, w: 28, h: 50, label: "SHEARER · 12 m", cls: "attn" },
      ],
      procedure: "PROC-MED-01",
      video: "videos/inc-04-worker-down.mp4",
      aiNotes: "Worker identified via cap lamp ID: M. Wiśniewski (badge 1877). No radio traffic from him for 3 min. Two colleagues at sections 44–45 are facing away. Methane trend suggests roof-fall gas release; auto-trip threshold 1.5 % will be reached in ~2 min.",
      sensors: { W7: 1.38 },
    },
    {
      id: "INC-05",
      cam: "CAM-01",
      severity: "HIGH",
      title: "Perimeter breach – 2 persons over the fence, vehicle without plates",
      summary: "Two persons climbed the fence at Sector A at 02:14:07. A van without registration plates is idling 30 m outside the gate. Both persons are moving towards the headframe.",
      detections: [
        ["person ×2", 0.97], ["fence climb", 0.93], ["vehicle · no plates", 0.95], ["night · thermal", 1.0], ["heading: headframe", 0.86],
      ],
      boxes: [
        { x: 12, y: 30, w: 10, h: 40, label: "INTRUDER 1", cls: "" },
        { x: 24, y: 34, w: 10, h: 38, label: "INTRUDER 2", cls: "" },
        { x: 66, y: 44, w: 28, h: 30, label: "VEHICLE · NO PLATES", cls: "attn" },
      ],
      procedure: "PROC-SEC-01",
      video: "videos/inc-05-perimeter.mp4",
      aiNotes: "Both persons wear backpacks. No employees are scheduled at Sector A at this hour. The van entered the access road at 02:09 – LPR could not read plates (covered).",
    },
    {
      id: "INC-06",
      cam: "CAM-05",
      severity: "HIGH",
      title: "Unattended object left at the Main Fan intake",
      summary: "A person placed a bag next to the fan intake grille and walked away quickly (4.1 m/s). Object stationary for 3 min, no owner within 50 m.",
      detections: [
        ["abandoned object", 0.91], ["person leaving fast", 0.89], ["proximity: fan intake", 1.0], ["owner absent 3 min", 1.0],
      ],
      boxes: [
        { x: 52, y: 62, w: 12, h: 16, label: "OBJECT · 3 min", cls: "" },
      ],
      procedure: "PROC-SEC-07",
      video: "videos/inc-06-object.mp4",
      aiNotes: "The person was tracked from the stockyard (CAM-04 field edge) and is now outside camera coverage. Fan intake is a single point of failure for ventilation of Level −500.",
    },
    {
      id: "INC-07",
      cam: "CAM-06",
      severity: "MEDIUM",
      title: "Person in the cage loading zone under a suspended load",
      summary: "Worker standing inside the red hatched zone at Pit Bottom −300 while a materials cage is being loaded (load suspended at 1.2 m).",
      detections: [
        ["person in restricted zone", 0.96], ["suspended load", 0.93], ["banksman present", 0.9],
      ],
      boxes: [
        { x: 46, y: 36, w: 14, h: 52, label: "PERSON · RESTRICTED ZONE", cls: "" },
        { x: 40, y: 6,  w: 30, h: 32, label: "SUSPENDED LOAD", cls: "attn" },
      ],
      procedure: "PROC-OPS-03",
      video: "videos/inc-07-loading-zone.mp4",
      aiNotes: "This is the third such event in this zone this week. The zone marking may be worn – recommend a maintenance ticket.",
    },
  ];

  /* ------------------------------------------------------------------
     Canned chat replies for free-typed text (keyword → answer).
     ------------------------------------------------------------------ */
  const chatter = [
    { keys: ["hello", "hi", "hey"], reply: "Hello. Sentinel is monitoring 12 online cameras. Say 'status' for a site summary or wait for an alert." },
    { keys: ["methane", "ch4", "gas"], reply: () => "Methane readings: L-12 face 0.38 %, W-7 face 0.42 %, drainage station 0.21 %. All below the 1.0 % warning threshold." },
    { keys: ["crew", "people", "underground", "personnel"], reply: "312 persons underground (shift B). Longwall L-12: 16, Longwall W-7: 14, development headings: 41, transport/maintenance: 58, other: 183." },
    { keys: ["weather"], reply: "Surface: 4 °C, wind 12 km/h NW. No impact on ventilation." },
    { keys: ["thank", "thx"], reply: "Acknowledged. Stay sharp." },
    { keys: ["who are you", "what are you"], reply: "SENTINEL-CI: an AI video-intelligence layer over the mine's CCTV, gas-monitoring and access-control systems. I detect dangerous patterns, raise alerts and guide you through the mandatory procedures." },
  ];

  return { cameras, procedures, incidents, chatter };
})();
