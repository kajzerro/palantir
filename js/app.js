/* ==========================================================================
   SENTINEL-CI · demo application
   Terminal (left) · Digital twin (top right) · Live feed (bottom right)
   No build step, no dependencies.
   ========================================================================== */
(function () {
  "use strict";

  const D = window.MINE_DATA;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const now = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  const state = {
    selectedCam: null,
    incidentCursor: 0,          // next incident index to fire
    active: null,               // currently handled incident record
    closed: [],                 // finished incident records
    auto: false,
    autoTimer: null,
    pendingOptions: null,       // { el, options } of the latest un-answered option group
    sensors: { L12: 0.38, W7: 0.42, DR: 0.21 },
    sensorOverride: {},
    audioCtx: null,
    seq: 0,
  };

  const els = {
    log: $("#term-log"), form: $("#term-form"), input: $("#term-in"),
    btnAuto: $("#btn-auto"), btnNext: $("#btn-next"), termMode: $("#term-mode"),
    camLayer: $("#cam-layer"), svg: $("#mine-svg"), tooltip: $("#twin-tooltip"),
    video: $("#feed-video"), noise: $("#feed-noise"), overlay: $("#feed-overlay"),
    feedMain: document.querySelector(".feed-main"), feedStatus: $("#feed-status"),
    feedCamId: $("#feed-cam-id"), osdCam: $("#osd-cam"), osdZone: $("#osd-zone"), osdTime: $("#osd-time"),
    nosigSub: $("#nosig-sub"), detections: $("#feed-detections"), meta: $("#feed-meta"), events: $("#feed-events"),
    kpiCams: $("#kpi-cams"), kpiAlerts: $("#kpi-alerts"), kpiCh4: $("#kpi-ch4"),
    clockDate: $("#clock-date"), clockTime: $("#clock-time"),
  };

  const camById = (id) => D.cameras.find((c) => c.id === id);
  const camIndex = (n) => D.cameras[n - 1];

  /* ==================================================================
     TERMINAL
     ================================================================== */
  const queue = [];
  let draining = false;
  let typingEl = null;

  function scrollLog() { els.log.scrollTop = els.log.scrollHeight; }

  function renderMessage({ kind, from, html, options, danger }) {
    const el = document.createElement("div");
    el.className = `msg ${kind}`;
    el.innerHTML = `<div class="hdr"><span class="from">${esc(from)}</span><span class="t">${now()}</span></div><div class="body">${html}</div>`;
    if (options && options.length) {
      const wrap = document.createElement("div");
      wrap.className = "opts";
      options.forEach((o, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `opt ${o.cls || ""}`;
        b.innerHTML = `<span class="n">${i + 1}</span>${esc(o.label)}`;
        b.addEventListener("click", () => chooseOption(wrap, i));
        wrap.appendChild(b);
      });
      wrap._options = options;
      el.appendChild(wrap);
      if (state.pendingOptions && state.pendingOptions.el !== wrap) state.pendingOptions.el.classList.add("used");
      state.pendingOptions = { el: wrap, options };
    }
    els.log.appendChild(el);
    scrollLog();
    return el;
  }

  /** Queue a message with a small "typing" delay so the terminal feels alive. */
  function say(kind, from, html, opts = {}) {
    return new Promise((resolve) => {
      queue.push({ kind, from, html, options: opts.options, delay: opts.delay ?? (kind === "ai" ? 550 : 220), resolve });
      drain();
    });
  }
  const sys = (html, o) => say("sys", "SYSTEM", html, o);
  const ai = (html, o) => say("ai", "SENTINEL", html, o);
  const ok = (html, o) => say("ok", "SENTINEL", html, o);
  const warn = (html, o) => say("warn", "SENTINEL", html, o);

  function op(text) {
    // operator lines are instant
    renderMessage({ kind: "op", from: "OPERATOR", html: esc(text) });
  }

  function drain() {
    if (draining) return;
    const item = queue.shift();
    if (!item) return;
    draining = true;
    typingEl = document.createElement("div");
    typingEl.className = "typing";
    typingEl.textContent = item.from.toLowerCase() + " ";
    els.log.appendChild(typingEl);
    scrollLog();
    setTimeout(() => {
      typingEl.remove(); typingEl = null;
      const el = renderMessage(item);
      item.resolve(el);
      draining = false;
      drain();
    }, item.delay);
  }

  function chooseOption(wrap, i) {
    if (wrap.classList.contains("used")) return;
    const o = wrap._options[i];
    wrap.classList.add("used");
    wrap.children[i].classList.add("chosen");
    if (state.pendingOptions && state.pendingOptions.el === wrap) state.pendingOptions = null;
    op(o.label);
    o.action && o.action();
  }

  /* ---------- commands ---------- */
  const HELP = `
<span class="b">Commands</span>
  <span class="h">help</span>               this list
  <span class="h">status</span>             site summary (cameras, gas, crew, alerts)
  <span class="h">cams</span>               list cameras
  <span class="h">cam &lt;n|id&gt;</span>         open camera on the live feed, e.g. <span class="h">cam 8</span>
  <span class="h">next</span>               fire the next scripted event (demo control)
  <span class="h">auto</span>               toggle automatic scenario playback
  <span class="h">proc</span>               show the procedure for the active incident
  <span class="h">log</span>                incident log
  <span class="h">clear</span>              clear the terminal
  <span class="k">During an alert you can also type the option number (1, 2, 3…).</span>`.trim();

  function handleInput(raw) {
    const text = raw.trim();
    if (!text) return;
    op(text);
    const low = text.toLowerCase();
    const [cmd, ...rest] = low.split(/\s+/);
    const arg = rest.join(" ");

    // numeric answer to pending options
    if (/^\d+$/.test(low) && state.pendingOptions) {
      const i = parseInt(low, 10) - 1;
      const po = state.pendingOptions;
      if (po.options[i]) { po.el.classList.add("used"); po.el.children[i].classList.add("chosen"); state.pendingOptions = null; po.options[i].action && po.options[i].action(); }
      else warn(`No option ${i + 1}. Pick 1–${po.options.length}.`);
      return;
    }
    // label match to pending options
    if (state.pendingOptions) {
      const po = state.pendingOptions;
      const i = po.options.findIndex((o) => o.label.toLowerCase().startsWith(low) || (o.keys || []).some((k) => low.includes(k)));
      if (i >= 0) { po.el.classList.add("used"); po.el.children[i].classList.add("chosen"); state.pendingOptions = null; po.options[i].action && po.options[i].action(); return; }
    }

    switch (cmd) {
      case "help": case "?": sys(HELP); return;
      case "status": cmdStatus(); return;
      case "cams": case "cameras": cmdCams(); return;
      case "cam": case "open": case "show": {
        const id = /^\d+$/.test(arg) ? camIndex(parseInt(arg, 10))?.id : arg.toUpperCase().replace(/^CAM-?/, "CAM-").replace(/^CAM-(\d)$/, "CAM-0$1");
        const c = id && camById(id);
        if (!c) { warn(`Unknown camera "${esc(arg)}". Type <span class="h">cams</span>.`); return; }
        selectCamera(c.id, { announce: true });
        return;
      }
      case "next": case "event": fireNextIncident(); return;
      case "auto": toggleAuto(); return;
      case "proc": case "procedure": cmdProc(); return;
      case "log": case "incidents": cmdLog(); return;
      case "clear": els.log.innerHTML = ""; return;
      case "ack": case "confirm": if (state.active && state.active.status === "new") { confirmIncident(); return; } break;
    }
    // canned chatter
    const hit = D.chatter.find((c) => c.keys.some((k) => low.includes(k)));
    if (hit) { ai(esc(typeof hit.reply === "function" ? hit.reply() : hit.reply)); return; }
    ai(`I did not understand <span class="k">"${esc(text)}"</span>. Type <span class="h">help</span> for commands${state.pendingOptions ? " or answer with an option number" : ""}.`);
  }

  function cmdStatus() {
    const online = D.cameras.filter((c) => !c.offline).length;
    const ch4 = Object.entries(currentSensors()).map(([k, v]) => `${k} ${v.toFixed(2)} %`).join(" · ");
    sys(`<table class="kv">
<tr><td>cameras</td><td>${online}/${D.cameras.length} online ${D.cameras.filter((c) => c.offline).map((c) => `<span class="k">(${c.id} offline)</span>`).join("")}</td></tr>
<tr><td>methane</td><td>${ch4}</td></tr>
<tr><td>crew u/g</td><td>312 (shift B)</td></tr>
<tr><td>ventilation</td><td><span class="g">main fan nominal · 312 m³/s</span></td></tr>
<tr><td>active alerts</td><td>${state.active ? `<span class="r">1 · ${state.active.inc.id} · ${state.active.status.toUpperCase()}</span>` : `<span class="g">none</span>`}</td></tr>
<tr><td>closed today</td><td>${state.closed.length}</td></tr>
<tr><td>ai model</td><td>sentinel-vision v4.2 · 25 fps · 13 streams</td></tr></table>`);
  }

  function cmdCams() {
    const rows = D.cameras.map((c, i) => `<tr><td>${i + 1}</td><td><span class="h">${c.id}</span></td><td>${esc(c.name)}</td><td class="k">${esc(c.zone)}</td><td>${c.offline ? '<span class="k">OFFLINE</span>' : '<span class="g">ONLINE</span>'}</td></tr>`).join("");
    sys(`<table class="kv">${rows}</table><span class="k">Open with </span><span class="h">cam &lt;n&gt;</span><span class="k"> or click a dot on the digital twin.</span>`);
  }

  function cmdProc() {
    if (!state.active || state.active.status === "new") { warn("No confirmed incident. Procedures are shown once an anomaly is confirmed."); return; }
    sys(procedureHtml(state.active));
  }

  function cmdLog() {
    if (!state.closed.length && !state.active) { sys("Incident log is empty."); return; }
    const rows = [...state.closed, ...(state.active ? [state.active] : [])].map((r) =>
      `<tr><td><span class="h">${r.inc.id}</span></td><td><span class="tag ${r.inc.severity}">${r.inc.severity}</span></td><td>${esc(r.inc.title)}</td><td>${r.inc.cam}</td><td>${r.status === "closed" ? '<span class="g">CLOSED</span>' : r.status === "false" ? '<span class="k">FALSE ALARM</span>' : `<span class="y">${r.status.toUpperCase()}</span>`}</td></tr>`).join("");
    sys(`<table class="kv log">${rows}</table>`);
  }

  els.form.addEventListener("submit", (e) => { e.preventDefault(); const v = els.input.value; els.input.value = ""; handleInput(v); });
  els.btnNext.addEventListener("click", () => { op("next"); fireNextIncident(); });
  els.btnAuto.addEventListener("click", () => { op("auto"); toggleAuto(); });

  /* ==================================================================
     DIGITAL TWIN
     ================================================================== */
  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs = {}) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

  function fovPath(x, y, dirDeg, r = 34, half = 26) {
    const a1 = (dirDeg - half) * Math.PI / 180, a2 = (dirDeg + half) * Math.PI / 180;
    // SVG y grows downwards; dir 0 = up, 90 = right
    const px = (a) => x + r * Math.sin(a), py = (a) => y - r * Math.cos(a);
    return `M ${x} ${y} L ${px(a1).toFixed(1)} ${py(a1).toFixed(1)} A ${r} ${r} 0 0 1 ${px(a2).toFixed(1)} ${py(a2).toFixed(1)} Z`;
  }

  function renderCameras() {
    els.camLayer.innerHTML = "";
    D.cameras.forEach((c) => {
      const g = svgEl("g", { class: `cam${c.offline ? " off" : ""}`, "data-id": c.id, tabindex: 0, role: "button" });
      g.appendChild(svgEl("path", { class: "fov", d: fovPath(c.x, c.y, c.dir) }));
      g.appendChild(svgEl("circle", { class: "hit", cx: c.x, cy: c.y, r: 15 }));
      g.appendChild(svgEl("circle", { class: "pulse", cx: c.x, cy: c.y, r: 8 }));
      g.appendChild(svgEl("circle", { class: "ring", cx: c.x, cy: c.y, r: 7.5 }));
      g.appendChild(svgEl("circle", { class: "core", cx: c.x, cy: c.y, r: 4 }));
      const left = c.x > 930;
      const t = svgEl("text", { class: "id", x: left ? c.x - 11 : c.x + 11, y: c.y + 3, "text-anchor": left ? "end" : "start" });
      t.textContent = c.id.replace("CAM-", "C");
      g.appendChild(t);
      g.addEventListener("click", () => selectCamera(c.id, { announce: true }));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCamera(c.id, { announce: true }); } });
      g.addEventListener("mouseenter", (e) => showTooltip(c, e));
      g.addEventListener("mousemove", (e) => moveTooltip(e));
      g.addEventListener("mouseleave", hideTooltip);
      els.camLayer.appendChild(g);
    });
  }
  const camNode = (id) => els.camLayer.querySelector(`[data-id="${id}"]`);
  function setCamState(id, cls) {
    const n = camNode(id); if (!n) return;
    n.classList.remove("alert", "attn");
    if (cls) n.classList.add(cls);
  }

  function camStatusText(c) {
    if (c.offline) return '<span style="color:#7f93a4">OFFLINE</span>';
    if (state.active && state.active.inc.cam === c.id) return state.active.status === "new" ? '<span style="color:#ff4d5e">⚠ ANOMALY</span>' : '<span style="color:#ffb347">● IN PROCEDURE</span>';
    return '<span style="color:#43d9a0">● NOMINAL</span>';
  }
  function showTooltip(c, e) {
    els.tooltip.innerHTML = `<div class="t">${c.id} · ${esc(c.name)}</div><div class="s">${esc(c.zone)} · ${esc(c.type)}</div><div class="st">${camStatusText(c)}</div>`;
    els.tooltip.hidden = false; moveTooltip(e);
  }
  function moveTooltip(e) {
    const r = els.svg.parentElement.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    if (x + 190 > r.width) x = e.clientX - r.left - 200;
    if (y + 70 > r.height) y = e.clientY - r.top - 76;
    els.tooltip.style.left = x + "px"; els.tooltip.style.top = y + "px";
  }
  function hideTooltip() { els.tooltip.hidden = true; }

  /* ---------- sensors ---------- */
  function currentSensors() {
    const out = {};
    for (const k in state.sensors) out[k] = state.sensorOverride[k] ?? state.sensors[k];
    return out;
  }
  function tickSensors() {
    for (const k in state.sensors) {
      state.sensors[k] = Math.max(0.1, Math.min(0.6, state.sensors[k] + (Math.random() - 0.5) * 0.03));
      if (state.sensorOverride[k] != null && state.sensorOverride[k] < 1.6 && state.sensorOverride._rising) state.sensorOverride[k] += 0.02;
      if (state.sensorOverride[k] != null && state.sensorOverride._falling) { state.sensorOverride[k] -= 0.04; if (state.sensorOverride[k] <= state.sensors[k]) delete state.sensorOverride[k]; }
    }
    const s = currentSensors();
    document.querySelectorAll("#ch4-sensors .sensor").forEach((t) => {
      const k = t.dataset.sensor, v = s[k];
      t.textContent = `CH₄ ${v.toFixed(2)}%`;
      t.classList.toggle("warn", v >= 1.0 && v < 1.5);
      t.classList.toggle("alert", v >= 1.5);
    });
    const max = Math.max(...Object.values(s));
    els.kpiCh4.textContent = max.toFixed(2) + "%";
    els.kpiCh4.style.color = max >= 1.5 ? "var(--alert)" : max >= 1.0 ? "var(--attn)" : "";
  }

  /* ==================================================================
     LIVE FEED
     ================================================================== */
  let noiseRAF = null;
  function drawNoise() {
    const c = els.noise, ctx = c.getContext("2d");
    const w = 160, h = 90;
    if (c.width !== w) { c.width = w; c.height = h; }
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() * 255) | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    noiseRAF = setTimeout(() => requestAnimationFrame(drawNoise), 70);
  }
  function setNoSignal(on, hint) {
    els.feedMain.classList.toggle("nosignal", on);
    if (on) { els.nosigSub.innerHTML = hint || ""; if (!noiseRAF) drawNoise(); }
    else if (noiseRAF) { clearTimeout(noiseRAF); noiseRAF = null; }
  }

  function loadVideo(src) {
    const v = els.video;
    v.onerror = null; v.onloadeddata = null;
    if (!src) { v.removeAttribute("src"); v.load(); setNoSignal(true, "no video configured for this camera"); return; }
    setNoSignal(true, `waiting for stream… <code>${esc(src)}</code>`);
    v.onloadeddata = () => { setNoSignal(false); v.play().catch(() => {}); };
    v.onerror = () => setNoSignal(true, `stream unavailable — place your clip at <code>${esc(src)}</code> and reload`);
    v.src = src; v.load();
  }

  function renderBoxes(boxes) {
    els.overlay.innerHTML = "";
    if (!boxes || !boxes.length) return;
    boxes.forEach((b) => {
      const d = document.createElement("div");
      d.className = `bbox ${b.cls || ""}`;
      d.dataset.label = b.label;
      d.style.cssText = `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%`;
      d.innerHTML = '<i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i>';
      els.overlay.appendChild(d);
    });
    const s = document.createElement("div"); s.className = "scanline"; els.overlay.appendChild(s);
  }

  function renderDetections(list, hot) {
    if (!list || !list.length) { els.detections.innerHTML = '<li class="muted">no detections · scene nominal</li>'; return; }
    els.detections.innerHTML = list.map(([l, c]) => `<li class="${hot ? (c >= 0.95 ? "hot" : "warn") : ""}"><span>${esc(l)}</span><span class="c">${(c * 100).toFixed(0)}%</span></li>`).join("");
  }

  function renderMeta(c) {
    els.meta.innerHTML = `<dt>zone</dt><dd>${esc(c.zone)}</dd><dt>type</dt><dd>${esc(c.type)}</dd><dt>ai model</dt><dd>sentinel-vision v4.2</dd><dt>uptime</dt><dd>${c.offline ? "—" : (140 + (parseInt(c.id.slice(4), 10) * 37) % 200) + " d"}</dd><dt>stream</dt><dd>${esc(c.video || "—")}</dd>`;
  }

  function setFeedStatus(text, cls) { els.feedStatus.textContent = text; els.feedStatus.className = `pill ${cls || ""}`; }

  /** Open a camera on the live feed. If it carries the active incident, show the incident clip + overlays. */
  function selectCamera(id, { announce = false } = {}) {
    const c = camById(id); if (!c) return;
    state.selectedCam = id;
    els.camLayer.querySelectorAll(".cam.selected").forEach((n) => n.classList.remove("selected"));
    camNode(id)?.classList.add("selected");
    els.feedCamId.textContent = `${c.id} · ${c.name.toUpperCase()}`;
    els.osdCam.textContent = `${c.id} ${c.name}`;
    els.osdZone.textContent = c.zone;
    renderMeta(c);

    const inc = state.active && state.active.inc.cam === id && state.active.status !== "closed" ? state.active : null;
    if (c.offline) {
      loadVideo(null); setNoSignal(true, "camera offline · maintenance ticket MT-4471"); renderBoxes([]); renderDetections([]); setFeedStatus("OFFLINE", "");
      els.feedMain.classList.remove("alert");
    } else if (inc) {
      loadVideo(inc.inc.video || c.video);
      renderBoxes(inc.inc.boxes); renderDetections(inc.inc.detections, true);
      setFeedStatus(inc.status === "new" ? "ANOMALY" : "IN PROCEDURE", inc.status === "new" ? "alert" : "attn");
      els.feedMain.classList.toggle("alert", inc.status === "new");
    } else {
      loadVideo(c.video); renderBoxes([]); renderDetections([]); setFeedStatus("LIVE", "live");
      els.feedMain.classList.remove("alert");
    }
    if (announce) sys(`Live feed → <span class="h">${c.id}</span> ${esc(c.name)} <span class="k">(${esc(c.zone)})</span>${c.offline ? ' · <span class="r">camera offline</span>' : ""}`, { delay: 80 });
  }

  function pushEvent(text, cls, camId) {
    const li = document.createElement("li");
    li.className = cls || "";
    li.innerHTML = `<span class="t">${now()}</span><span class="s">${text}</span>`;
    if (camId) li.addEventListener("click", () => selectCamera(camId, { announce: true }));
    els.events.prepend(li);
    while (els.events.children.length > 14) els.events.lastChild.remove();
  }

  $("#btn-fullscreen").addEventListener("click", () => { (els.feedMain.requestFullscreen || (() => {})).call(els.feedMain); });

  /* ==================================================================
     INCIDENT ENGINE
     ================================================================== */
  function beep(kind) {
    try {
      if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = state.audioCtx, t = ctx.currentTime;
      const tones = kind === "CRITICAL" ? [[880, 0], [660, 0.18], [880, 0.36], [660, 0.54]] : kind === "ok" ? [[520, 0], [780, 0.12]] : [[740, 0], [740, 0.22]];
      tones.forEach(([f, dt]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = f; g.gain.value = 0.03;
        o.connect(g).connect(ctx.destination); o.start(t + dt); o.stop(t + dt + 0.12);
      });
    } catch (_) { /* audio not permitted yet */ }
  }

  function updateKpis() {
    els.kpiCams.textContent = `${D.cameras.filter((c) => !c.offline).length}/${D.cameras.length}`;
    const n = state.active && state.active.status !== "closed" ? 1 : 0;
    els.kpiAlerts.textContent = n;
    els.kpiAlerts.parentElement.classList.toggle("hot", n > 0);
    els.termMode.textContent = state.auto ? "AUTO" : "MANUAL";
    els.termMode.className = `pill ${state.auto ? "ok" : ""}`;
    els.btnAuto.classList.toggle("active", state.auto);
  }

  function toggleAuto() {
    state.auto = !state.auto;
    updateKpis();
    if (state.auto) { sys(`Automatic scenario playback <span class="g">ON</span>. Next event in 8 s unless an incident is open.`); scheduleAuto(8000); }
    else { sys(`Automatic scenario playback <span class="y">OFF</span>. Use <span class="h">next</span> or NEXT EVENT.`); clearTimeout(state.autoTimer); }
  }
  function scheduleAuto(ms) {
    clearTimeout(state.autoTimer);
    if (!state.auto) return;
    state.autoTimer = setTimeout(() => { if (state.auto && !state.active) fireNextIncident(); else if (state.auto) scheduleAuto(5000); }, ms);
  }

  function severityTag(s) { return `<span class="tag ${s}">${s}</span>`; }

  function fireNextIncident() {
    if (state.active && state.active.status !== "closed") {
      warn(`Incident <span class="h">${state.active.inc.id}</span> is still open. Close it (finish the procedure or mark it a false alarm) before the next event.`);
      return;
    }
    if (state.incidentCursor >= D.incidents.length) {
      ok(`All ${D.incidents.length} scripted events have been played. Reload the page to restart the scenario, or type <span class="h">log</span> for the incident summary.`);
      state.auto = false; updateKpis();
      return;
    }
    const inc = D.incidents[state.incidentCursor++];
    const cam = camById(inc.cam);
    const rec = { inc, cam, status: "new", step: 0, steps: [], openedAt: now(), n: ++state.seq };
    state.active = rec;
    if (inc.sensors) { Object.assign(state.sensorOverride, inc.sensors); state.sensorOverride._rising = true; state.sensorOverride._falling = false; }

    // twin + feed + sound
    setCamState(inc.cam, "alert");
    document.body.classList.remove("flash"); void document.body.offsetWidth; document.body.classList.add("flash");
    beep(inc.severity);
    selectCamera(inc.cam);
    pushEvent(`${inc.id} ${esc(inc.title)}`, "alert", inc.cam);
    updateKpis();

    // terminal
    const conf = Math.round(inc.detections.reduce((a, d) => a + d[1], 0) / inc.detections.length * 100);
    const kind = inc.severity === "CRITICAL" ? "alert crit" : "alert";
    say(kind, `⚠ ALERT · ${inc.id}`, `${severityTag(inc.severity)} <span class="b">${esc(inc.title)}</span>
<table class="kv">
<tr><td>camera</td><td><span class="h">${cam.id}</span> ${esc(cam.name)} · ${esc(cam.zone)}</td></tr>
<tr><td>pattern</td><td>${inc.detections.map((d) => esc(d[0])).join(" · ")}</td></tr>
<tr><td>confidence</td><td>${conf} %</td></tr>
<tr><td>time</td><td>${rec.openedAt}</td></tr>
</table>${esc(inc.summary)}`, { delay: 120 });

    ai(`Live feed switched to <span class="h">${cam.id}</span>. The camera dot on the digital twin is flashing red. <span class="b">What do you want to do next?</span>`, {
      options: assessmentOptions(rec, true),
    });
  }

  function assessmentOptions(rec, withAnalysis) {
    const o = [
      { label: "Confirm anomaly & open the procedure", cls: "danger", keys: ["confirm", "yes"], action: confirmIncident },
    ];
    if (withAnalysis) o.push({ label: "Request detailed AI analysis", keys: ["analy", "detail", "more"], action: () => analysis(rec) });
    o.push({ label: "Keep watching – re-alert in 20 s if it persists", keys: ["watch", "hold", "wait"], action: () => holdIncident(rec) });
    o.push({ label: "Mark as false alarm", cls: "good", keys: ["false"], action: () => falseAlarm(rec) });
    return o;
  }

  function analysis(rec) {
    const inc = rec.inc;
    const rows = inc.detections.map((d) => `<tr><td>${esc(d[0])}</td><td>${(d[1] * 100).toFixed(0)} %</td></tr>`).join("");
    ai(`<span class="b">Extended analysis · ${inc.id}</span>
<table class="kv">${rows}</table>${esc(inc.aiNotes)}

<span class="b">Recommended procedure:</span> <span class="h">${inc.procedure}</span> "${esc(D.procedures[inc.procedure].title)}" <span class="k">(${esc(D.procedures[inc.procedure].ref)})</span>
Your decision?`, { options: assessmentOptions(rec, false) });
  }

  function holdIncident(rec) {
    ai(`Holding. I will keep tracking on <span class="h">${rec.inc.cam}</span> and re-alert in 20 s if the pattern persists.`);
    setTimeout(() => {
      if (state.active !== rec || rec.status !== "new") return;
      beep(rec.inc.severity);
      say("alert", `⚠ RE-ALERT · ${rec.inc.id}`, `${severityTag(rec.inc.severity)} Pattern <span class="b">persists</span> on ${rec.inc.cam} after 20 s. ${esc(rec.inc.detections[0][0])} still detected. The procedure requires a decision now.`, { options: assessmentOptions(rec, false), delay: 100 });
    }, 20000);
  }

  function falseAlarm(rec) {
    rec.status = "false"; rec.closedAt = now();
    closeIncidentVisuals(rec);
    ok(`<span class="b">${rec.inc.id} marked as FALSE ALARM</span> at ${rec.closedAt}. The clip is kept for model retraining and sensitivity for this pattern on ${rec.inc.cam} is lowered for 24 h. Camera returns to nominal.`);
    pushEvent(`${rec.inc.id} false alarm`, "ok", rec.inc.cam);
    scheduleAuto(10000);
  }

  function confirmIncident() {
    const rec = state.active; if (!rec || rec.status !== "new") return;
    rec.status = "confirmed";
    const inc = rec.inc, proc = D.procedures[inc.procedure];
    rec.steps = proc.steps.map(() => "todo");
    setCamState(inc.cam, "attn");
    if (state.selectedCam === inc.cam) { setFeedStatus("IN PROCEDURE", "attn"); els.feedMain.classList.remove("alert"); }
    updateKpis();
    pushEvent(`${inc.id} confirmed → ${inc.procedure}`, "attn", inc.cam);

    ai(`Incident <span class="h">${inc.id}</span> <span class="b">confirmed</span>. Notifying the dispatcher and opening the mandatory procedure:
<span class="b">${inc.procedure} · ${esc(proc.title)}</span> <span class="k">(${esc(proc.ref)})</span>
${proc.steps.length} steps. Complete each step and confirm it here – every confirmation is time-stamped in the incident record.`);
    rec.checklistEl = null;
    sys(procedureHtml(rec)).then((el) => { rec.checklistEl = el; });
    askStep(rec);
  }

  function procedureHtml(rec) {
    const proc = D.procedures[rec.inc.procedure];
    const items = proc.steps.map((s, i) => {
      const st = rec.steps[i] === "done" ? "done" : rec.steps[i] === "skip" ? "skip" : i === rec.step && rec.status === "confirmed" ? "cur" : "";
      return `<li class="${st}">${i + 1}. ${esc(s)}</li>`;
    }).join("");
    return `<span class="b">${rec.inc.procedure} · ${esc(proc.title)}</span><ul class="steps">${items}</ul>`;
  }
  function refreshChecklist(rec) {
    if (rec.checklistEl) rec.checklistEl.querySelector(".body").innerHTML = procedureHtml(rec);
  }

  function askStep(rec) {
    const proc = D.procedures[rec.inc.procedure];
    const i = rec.step;
    if (i >= proc.steps.length) { completeIncident(rec); return; }
    refreshChecklist(rec);
    ai(`<span class="y">Step ${i + 1}/${proc.steps.length}</span> · ${esc(proc.steps[i])}`, {
      options: [
        { label: "Done – confirm step", cls: "good", keys: ["done", "ok", "complete"], action: () => stepDone(rec) },
        { label: "Not possible – flag deviation & continue", cls: "danger", keys: ["not", "skip", "cannot"], action: () => stepSkip(rec) },
        { label: "Show full procedure", keys: ["show", "proc", "full"], action: () => { sys(procedureHtml(rec)); askStep(rec); } },
      ],
    });
  }
  function stepDone(rec) {
    rec.steps[rec.step] = "done"; rec.step++;
    if (rec.inc.id === "INC-04" && rec.step === 3) { state.sensorOverride._rising = false; state.sensorOverride._falling = true; }
    interjection(rec);
    askStep(rec);
  }
  function stepSkip(rec) {
    rec.steps[rec.step] = "skip"; rec.step++;
    warn(`Deviation logged for step ${rec.step}. The dispatcher and the shift supervisor have been notified of the deviation.`);
    askStep(rec);
  }

  /** Scripted live updates during critical procedures, keyed by incident + completed step count. */
  const interjections = {
    "INC-03": { 1: `<span class="g">Belt D-2 stopped</span> – confirmed on camera (speed 0.0 m/s).`, 2: `Update: CO at sensor D2-3 now <span class="r">84 ppm ↑</span>, D2-4 <span class="y">41 ppm</span>. Smoke moving towards Gallery G-7 at 1.1 m/s.`, 4: `Longwall W-7 crew (14) confirms withdrawal towards pit bottom −500. CAM-12 shows the face empty.`, 5: `Rescue team RT-1 at idler set B-14. Extinguishing in progress – hot spot temperature falling (214 → 96 °C).` },
    "INC-04": { 1: `<span class="g">Shearer and face conveyor stopped.</span> Interlock LW-W7 engaged.`, 2: `Colleague at section 44 reached the worker – he is <span class="y">unconscious but breathing</span>.`, 3: `CH₄ at W7 stabilising and falling. Power in the zone stays on for lighting; methanometry watch continues.`, 4: `Medical team en route from the −500 medical point, ETA 7 min. Rescue Station acknowledged.` },
    "INC-02": { 1: `<span class="g">EM-D1 locked.</span> Door sensor reports CLOSED. The person is now confined to the anteroom.`, 2: `Magazine keeper: <span class="r">no authorised entry</span> scheduled until 10:00.`, 3: `Patrol P-2 confirms departure from pit bottom −500. ETA 5 min.` },
    "INC-05": { 1: `Siren and floodlights active. Both persons stopped and are looking towards the gate.`, 2: `PTZ auto-track locked on both targets. Surface patrol moving in from the admin building.`, 3: `Police acknowledged – unit ETA 9 min. Intruders retreating towards the fence.` },
    "INC-06": { 2: `Ventilation engineer: keep the fan running; the intake is not obstructed.`, 3: `Bomb-disposal unit dispatched, ETA 25 min. Mine Manager informed.` },
    "INC-01": { 2: `Lamp Room clerk confirms: no self-rescuer issued to badge 2231 today.` },
    "INC-07": { 1: `Winder halted – banksman confirms.`, 2: `The worker left the zone. Zone clear on CAM-06.` },
  };
  function interjection(rec) {
    const t = interjections[rec.inc.id]?.[rec.step];
    if (t) sys(t);
  }

  function completeIncident(rec) {
    rec.status = "closed"; rec.closedAt = now();
    refreshChecklist(rec);
    closeIncidentVisuals(rec);
    const skipped = rec.steps.filter((s) => s === "skip").length;
    const reportId = `R-2026-0913-${String(rec.n).padStart(3, "0")}`;
    beep("ok");
    ok(`<span class="b">Procedure ${rec.inc.procedure} complete. Incident ${rec.inc.id} closed</span> at ${rec.closedAt}.
Report <span class="h">${reportId}</span> filed to the shift log${skipped ? ` with <span class="y">${skipped} flagged deviation${skipped > 1 ? "s" : ""}</span>` : ""}; clip, detections and your time-stamped decisions are attached. ${rec.inc.cam} returns to nominal monitoring.`);
    pushEvent(`${rec.inc.id} closed · ${reportId}`, "ok", rec.inc.cam);
    scheduleAuto(12000);
  }

  function closeIncidentVisuals(rec) {
    state.closed.push(rec);
    if (state.active === rec) state.active = null;
    setCamState(rec.inc.cam, null);
    state.sensorOverride._rising = false; state.sensorOverride._falling = true;
    if (state.selectedCam === rec.inc.cam) selectCamera(rec.inc.cam);   // back to idle loop, no overlays
    updateKpis();
  }

  /* ==================================================================
     BOOT
     ================================================================== */
  function tickClock() {
    const d = new Date();
    els.clockTime.textContent = now();
    els.clockDate.textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} · ${["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()]}`;
    els.osdTime.textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${now()}`;
  }

  async function boot() {
    renderCameras();
    updateKpis();
    tickClock(); setInterval(tickClock, 1000);
    tickSensors(); setInterval(tickSensors, 2000);
    setNoSignal(true, "select a camera on the digital twin");
    ["click", "keydown"].forEach((ev) => window.addEventListener(ev, () => { if (!state.audioCtx) { try { state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } }, { once: true }));

    await sys(`SENTINEL-CI v4.2.1 · critical infrastructure video intelligence`, { delay: 60 });
    await sys(`connecting to VMS … <span class="g">ok</span> · 13 streams · 12 online · 1 offline (CAM-13)`, { delay: 300 });
    await sys(`connecting to gas-monitoring (methanometry) … <span class="g">ok</span>`, { delay: 220 });
    await sys(`connecting to access control &amp; badge log … <span class="g">ok</span>`, { delay: 220 });
    await sys(`loading anomaly models: person-down · ppe · fire/smoke · restricted-zone · perimeter · abandoned-object … <span class="g">ok</span>`, { delay: 320 });
    await ai(`Good morning, operator. I am watching <span class="b">12 cameras</span> across KWK "Wschód-1" – surface, Level −300 and Level −500. Click any camera dot on the digital twin to open its live feed. When I detect a dangerous pattern I will raise an alert here, switch the feed to that camera and guide you through the required procedure.`);
    await sys(`Demo controls: press <span class="h">NEXT EVENT</span> (or type <span class="h">next</span>) to trigger the next scripted anomaly, or <span class="h">AUTO</span> to let the scenario play by itself. Type <span class="h">help</span> for all commands.`);
    els.input.focus();
  }

  boot();
})();
