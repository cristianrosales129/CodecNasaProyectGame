/* Consola de control de misión (MCC).
   - Los comandos están en inglés y son cortos, como en un sistema de control real.
   - ui.js llama a Consola.raise(tipo, alResolver) cuando la simulación genera un incidente;
     la consola avisa con alResolver(true|false) si el jugador lo resolvió a tiempo.
   - "drill <falla>" permite practicar sin afectar la misión. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const panel = $("console");
  const slot = $("console-slot");
  const out = $("console-output");
  const input = $("console-input");
  const timerEl = $("console-timer");
  const timebar = $("console-timebar");
  const banner = $("console-banner");
  const body = $("console-body");
  const guideEl = $("console-guide");
  const guideBtn = $("console-guide-toggle");
  const soundBtn = $("console-sound");
  if (!panel || !out || !input) return;

  /* ---------------------------------------------------------------
     Catálogo de incidentes (lo que ve el jugador en la consola)
     sev: advisory | warning | critical
     --------------------------------------------------------------- */
  const INCIDENTS = {
    launch: {
      sev: "critical", code: "LV-301", system: "LAUNCH VEHICLE", title: "ASCENT ANOMALY",
      detail: "Vehicle deviating from nominal ascent trajectory.",
      fix: "correct course", limit: 15,
      tel: { label: "traj.error", from: 0.4, to: 9, unit: " deg" },
      hint: "Thrust-vector control can steer the vehicle back onto its planned path.",
      ok: "Trajectory corrected. Vehicle back on nominal ascent.",
      bad: "Vehicle lost. Range safety triggered."
    },
    storm: {
      sev: "critical", code: "PWR-210", system: "POWER BUS", title: "SOLAR PARTICLE EVENT",
      detail: "Radiation surge detected on the power bus.",
      fix: "safemode", limit: 20,
      tel: { label: "radiation", from: 1.2, to: 9.8, unit: " mSv/h" },
      hint: "Safe mode shuts down sensitive electronics until the storm passes.",
      ok: "Safe mode active. Electronics protected.",
      bad: "Bus overload. Battery reserve drained."
    },
    meteoroid: {
      sev: "critical", code: "PWR-114", system: "SOLAR ARRAY", title: "METEOROID SHOWER",
      detail: "Debris field ahead. Impact on solar arrays imminent.",
      fix: "stow panels", limit: 15,
      tel: { label: "impact ETA", from: 15, to: 0, unit: " s" },
      hint: "Stowing the panels folds them behind the structure, away from the debris.",
      ok: "Panels stowed. Impact absorbed by the structure.",
      bad: "IMPACT. Solar array damaged: power output reduced."
    },
    lowpower: {
      sev: "critical", code: "PWR-305", system: "POWER BUS", title: "LOW BUS POWER",
      detail: "Available energy is below instrument demand.",
      fix: "shed load", limit: 20,
      tel: { label: "bus margin", from: -1, to: -6, unit: " u" },
      hint: "Load shedding switches off non-essential consumers so the rest can keep working.",
      ok: "Load shed. Instruments running at reduced capacity.",
      bad: "Insufficient power. Observations aborted."
    },
    antenna: {
      sev: "warning", code: "COM-102", system: "COMMUNICATIONS", title: "ANTENNA FAULT",
      detail: "Downlink lost. No data can be transmitted this turn.",
      fix: "reset antenna", limit: 25,
      tel: { label: "downlink", from: -60, to: -120, unit: " dBm" },
      hint: "Rebooting a subsystem clears most transient faults. Which unit is down?",
      ok: "Antenna reset. Downlink restored.",
      bad: "Downlink not restored. Data lost this turn."
    },
    radiation: {
      sev: "warning", code: "RAD-044", system: "RADIATION MONITOR", title: "ELEVATED RADIATION",
      detail: "Onboard systems are drawing extra power.",
      fix: "safemode", limit: 25,
      tel: { label: "radiation", from: 0.8, to: 3.2, unit: " mSv/h" },
      hint: "Radiation hurts electronics. Protect them with the same command used for solar storms.",
      ok: "Safe mode active. Extra power draw stopped.",
      bad: "Extra power consumed. Energy reserve reduced."
    },
    interference: {
      sev: "advisory", code: "COM-017", system: "COMMUNICATIONS", title: "RF INTERFERENCE",
      detail: "Noise detected on the downlink.",
      fix: "reset antenna", limit: 30,
      tel: { label: "SNR", from: 12, to: 3, unit: " dB" },
      hint: "Resetting the antenna re-synchronises the link.",
      ok: "Link re-synchronised. Signal clean.",
      bad: "Interference faded on its own. No action taken."
    }
  };

  const SEV = {
    advisory: { tag: "ADVS", cls: "adv",  label: "ADVISORY",     period: 5, every: 5000 },
    warning:  { tag: "WARN", cls: "warn", label: "WARNING",      period: 5, every: 2500 },
    critical: { tag: "CRIT", cls: "crit", label: "MASTER ALARM", period: 3, every: 1000 }
  };

  /* Comandos que resuelven fallas, con sus variantes aceptadas */
  const FIX_ALIASES = {
    "safemode":       ["safemode", "safe mode", "enter safemode", "enable safemode"],
    "reset antenna":  ["reset antenna", "antenna reset", "reboot antenna"],
    "stow panels":    ["stow panels", "panels stow", "stow", "retract panels"],
    "shed load":      ["shed load", "load shed", "reduce load", "shed"],
    "correct course": ["correct course", "course correct", "correct trajectory"]
  };

  /* Guía de comandos (comandos en inglés, explicación en español) */
  const GUIDE = [
    { group: "Responder a fallas", items: [
      ["safemode", "Apaga la electrónica sensible para protegerla.", "Tormentas solares y radiación elevada."],
      ["reset antenna", "Reinicia la antena y recupera el enlace.", "Fallas e interferencias de comunicaciones."],
      ["stow panels", "Recoge los paneles solares antes del impacto.", "Lluvia de micrometeoritos."],
      ["shed load", "Apaga consumidores no esenciales; los instrumentos trabajan con la energía que queda.", "Energía insuficiente en el bus."],
      ["correct course", "Corrige la trayectoria del cohete.", "Anomalía durante el ascenso."]
    ]},
    { group: "Consultar", items: [
      ["status", "Telemetría de la misión: turno, energía, paneles, enlace y ciencia."],
      ["hint", "Pista sobre la falla activa. Pídela dos veces para ver el comando."],
      ["help", "Lista de comandos en la terminal."],
      ["clear", "Limpia la pantalla de la terminal."]
    ]},
    { group: "Practicar y ajustar", items: [
      ["drill <fault>", "Simula una falla sin afectar tu misión. Escribe drill para ver los nombres."],
      ["sound on | off", "Activa o silencia las alarmas."],
      ["guide", "Muestra u oculta esta guía."]
    ]}
  ];

  /* ---------------------------------------------------------------
     Sonido (Web Audio, sin archivos)
     --------------------------------------------------------------- */
  const Sound = (() => {
    let ctx = null;
    let enabled = true;
    let loop = null;
    const ensure = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === "suspended") ctx.resume();
      return ctx;
    };
    const tone = (freq, dur, type = "square", vol = 0.035, delay = 0) => {
      if (!enabled) return;
      const c = ensure();
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      const t = c.currentTime + delay;
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.03);
    };
    const pulse = (sev) => {
      if (sev === "critical") { tone(880, 0.22); tone(620, 0.22, "square", 0.035, 0.25); }
      else if (sev === "warning") { tone(700, 0.15); tone(700, 0.15, "square", 0.03, 0.25); }
      else tone(520, 0.14, "sine", 0.04);
    };
    return {
      get enabled() { return enabled; },
      set enabled(value) { enabled = Boolean(value); if (!enabled) this.stop(); },
      start(sev) { this.stop(); if (!enabled) return; pulse(sev); loop = setInterval(() => pulse(sev), SEV[sev].every); },
      stop() { if (loop) clearInterval(loop); loop = null; },
      ok() { tone(660, 0.12, "sine", 0.05); tone(880, 0.2, "sine", 0.05, 0.13); },
      fail() { tone(110, 0.7, "sawtooth", 0.05); tone(82, 0.7, "sawtooth", 0.05, 0.1); },
      reject() { tone(180, 0.18, "square", 0.04); }
    };
  })();

  /* ---------------------------------------------------------------
     Pantalla
     --------------------------------------------------------------- */
  const vignette = document.createElement("div");
  vignette.className = "alarm-vignette";
  vignette.setAttribute("aria-hidden", "true");
  document.body.appendChild(vignette);

  function print(text, cls) {
    const p = document.createElement("p");
    if (cls) p.className = cls;
    p.textContent = text;
    out.appendChild(p);
    out.scrollTop = out.scrollHeight;
  }

  const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, " ");
  const fixOf = (text) => Object.keys(FIX_ALIASES).find((k) => FIX_ALIASES[k].includes(text)) || null;

  function setBanner(text) { banner.textContent = text; }
  function updateTimer() {
    if (!active) { timerEl.textContent = ""; timebar.style.width = "0"; timebar.classList.remove("low"); return; }
    timerEl.textContent = `T- ${String(active.remaining).padStart(2, "0")} s`;
    const pct = Math.max(0, (active.remaining / active.def.limit) * 100);
    timebar.style.width = pct + "%";
    timebar.classList.toggle("low", pct <= 30);
  }

  /* ---------------------------------------------------------------
     Estado de la alerta
     --------------------------------------------------------------- */
  let active = null;
  let tickId = null;
  let settleId = null;
  let locked = false;

  function dock() {
    if (slot) slot.style.minHeight = panel.offsetHeight + "px";
    panel.classList.add("is-docked");
    document.body.classList.add("console-docked");
  }
  function undock() {
    panel.classList.remove("is-docked");
    document.body.classList.remove("console-docked", "alarm-critical", "alarm-warning", "alarm-advisory");
    if (slot) slot.style.minHeight = "";
  }
  function toIdle() {
    undock();
    panel.dataset.state = "idle";
    delete panel.dataset.sev;
    setBanner("");
    updateTimer();
  }

  function raise(kind, done, opts = {}) {
    const def = INCIDENTS[kind];
    if (!def || active || locked) return false;
    const sev = SEV[def.sev];
    active = { kind, def, done, drill: Boolean(opts.drill), remaining: def.limit, elapsed: 0, hintLevel: 0 };

    dock();
    panel.dataset.sev = def.sev;
    panel.dataset.state = "alert";
    document.body.classList.add("alarm-" + def.sev);
    setBanner(`${active.drill ? "DRILL · " : ""}${def.sev === "critical" ? "⚠ " : ""}${sev.label} · ${def.code} · ${def.title}`);

    const tag = `[${sev.tag}]`;
    print("════════════════════════════════════════", "rule");
    print(`${tag} ${active.drill ? "DRILL — " : ""}${sev.label}  ${def.code}`, sev.cls);
    print(`       SYSTEM : ${def.system}`, sev.cls);
    print(`       FAULT  : ${def.title}`, sev.cls);
    print(`       ${def.detail}`, sev.cls);
    facts(kind).forEach((line) => print(`       ${line}`, sev.cls));
    print(`${tag} Respond within ${def.limit} s. Type 'hint' for help or 'guide' for the command list.`, sev.cls);
    print("════════════════════════════════════════", "rule");

    updateTimer();
    Sound.start(def.sev);
    tickId = setInterval(tick, 1000);
    input.focus({ preventScroll: true });
    return true;
  }

  /* Datos reales de la simulación para ambientar la alerta */
  function facts(kind) {
    const sim = hasMission() ? MissionState.current.simulation : null;
    if (!sim || active.drill) return [];
    if (kind === "lowpower" && sim.turnCtx && typeof sim.turnCtx.available === "number") {
      const demand = MissionRules.totals().powerUse;
      return [`Available ${sim.turnCtx.available} u / demand ${demand} u per turn.`];
    }
    if (kind === "storm" || kind === "radiation") return [`Battery reserve ${sim.energy}/${sim.maximumEnergy} u.`];
    if (kind === "meteoroid") return [`Array status: ${sim.panelDamage ? "DAMAGED" : "NOMINAL"}.`];
    return [];
  }

  function tick() {
    if (!active) return;
    active.remaining -= 1;
    active.elapsed += 1;
    updateTimer();
    if (active.remaining <= 0) { finish(false); return; }

    const { def } = active;
    const sev = SEV[def.sev];
    if (active.elapsed % sev.period === 0) {
      const t = def.tel;
      const value = t.from + (t.to - t.from) * (active.elapsed / def.limit);
      print(`[TLM ] ${t.label} = ${value.toFixed(1)}${t.unit}`, "tlm");
    }
    if (def.sev === "critical" && (active.remaining === Math.floor(def.limit / 2) || active.remaining === 5)) {
      print(`[CRIT] ${active.remaining} s to system degradation — ENTER COMMAND NOW`, "crit");
    } else if (def.sev === "warning" && active.remaining === 10) {
      print("[WARN] 10 s remaining before the fault takes effect.", "warn");
    }
  }

  function finish(solved) {
    if (!active) return;
    clearInterval(tickId);
    tickId = null;
    Sound.stop();
    const { def, done, drill } = active;
    active = null;
    locked = true;
    updateTimer();

    if (solved) {
      print(`[ OK ] ${def.ok}`, "ok");
      if (drill) print("[ OK ] Drill complete. No effect on the mission.", "ok");
      panel.dataset.state = "cleared";
      setBanner("✔ FAULT CLEARED");
      Sound.ok();
    } else if (def.sev === "advisory") {
      print(`[ADVS] ${def.bad}`, "adv");
      panel.dataset.state = "cleared";
      setBanner("ADVISORY CLOSED");
    } else {
      print(`[FAIL] Time expired. ${def.bad}`, "bad");
      panel.dataset.state = "failed";
      setBanner(`✖ FAULT UNRESOLVED · ${def.code}`);
      Sound.fail();
    }
    document.body.classList.remove("alarm-critical", "alarm-warning", "alarm-advisory");

    settleId = setTimeout(() => {
      settleId = null;
      locked = false;
      toIdle();
      if (!drill && typeof done === "function") done(solved);
    }, solved ? 1100 : 1700);
  }

  /* Cancela todo sin avisar a la simulación (reinicio de misión) */
  function reset() {
    clearInterval(tickId);
    clearTimeout(settleId);
    tickId = settleId = null;
    active = null;
    locked = false;
    Sound.stop();
    toIdle();
  }

  /* ---------------------------------------------------------------
     Comandos
     --------------------------------------------------------------- */
  const hasMission = () =>
    typeof MissionState !== "undefined" && MissionState.current && MissionState.current.simulation;

  function cmdHelp() {
    print("MISSION CONTROL COMMANDS", "hint");
    print("  Fault response:");
    Object.keys(FIX_ALIASES).forEach((c) => print("    " + c));
    print("  Query:     status   hint   help   clear");
    print("  Practice:  drill <fault>");
    print("  Settings:  sound on|off   guide");
    print("Press TAB to autocomplete. Use ↑ ↓ for history.", "dim");
  }

  function cmdStatus() {
    if (typeof MissionState === "undefined") { print("[ERR ] Mission data unavailable.", "bad"); return; }
    const state = MissionState.current;
    const sim = state.simulation;
    if (!sim) {
      print("STATUS: STANDBY — no active mission. Finish the design phase first.", "dim");
      return;
    }
    const dest = MissionRules.destination(state);
    const opStart = 2 + dest.transitTurns;
    let phase = "PRE-LAUNCH";
    if (sim.finished) phase = "MISSION COMPLETE";
    else if (sim.turn === 1) phase = "LAUNCH";
    else if (sim.turn >= opStart) phase = "OPERATION";
    else if (sim.turn > 1) phase = "TRANSIT";
    const gen = MissionSimulation.generation(state, sim);
    const faultOnAntenna = sim.pending && sim.pending.kind === "antenna";
    print("MISSION STATUS", "hint");
    print(`  PHASE     ${phase}  (turn ${sim.turn}/${sim.totalTurns})`);
    print(`  ENERGY    ${sim.energy}/${sim.maximumEnergy} u   GENERATION ${gen} u/turn`);
    print(`  PANELS    ${MissionRules.powerSystem(state).id === "rtg" ? "N/A (RTG)" : (sim.panelDamage ? "DAMAGED" : "NOMINAL")}`);
    print(`  DOWNLINK  ${faultOnAntenna ? "FAULT" : "NOMINAL"}`);
    print(`  SCIENCE   ${sim.science} pts   DATA SENT ${sim.dataSent} u`);
    print(`  ALERTS    ${sim.incidents.solved} resolved / ${sim.incidents.total} raised`);
  }

  function cmdHint() {
    if (!active) { print("No active fault. Use 'status' to review the mission or 'help' for commands.", "dim"); return; }
    if (active.hintLevel === 0) { print(`[HINT] ${active.def.hint}`, "hint"); active.hintLevel = 1; }
    else print(`[HINT] Command: ${active.def.fix}`, "hint");
  }

  function cmdDrill(arg) {
    if (active || locked) { print("[ERR ] Drill unavailable while a fault is active.", "bad"); return; }
    if (!arg || !INCIDENTS[arg]) {
      print("Drill faults: " + Object.keys(INCIDENTS).join(", "), "hint");
      print("Usage: drill <fault>   e.g.  drill storm", "dim");
      return;
    }
    raise(arg, null, { drill: true });
  }

  function cmdSound(arg) {
    if (arg === "on") Sound.enabled = true;
    else if (arg === "off") Sound.enabled = false;
    else { print(`Sound is ${Sound.enabled ? "ON" : "OFF"}. Usage: sound on|off`, "dim"); return; }
    soundBtn.setAttribute("aria-pressed", String(Sound.enabled));
    soundBtn.textContent = Sound.enabled ? "🔊" : "🔇";
    print(`Sound ${Sound.enabled ? "ON" : "OFF"}.`, "dim");
  }

  function toggleGuide(force) {
    const open = typeof force === "boolean" ? force : !body.classList.contains("with-guide");
    body.classList.toggle("with-guide", open);
    guideBtn.setAttribute("aria-expanded", String(open));
  }

  function runFix(fix) {
    if (!active) { print(`[NEG ] No active fault requires '${fix}'. Command not executed.`, "dim"); return; }
    if (active.def.fix === fix) {
      print(`> ${fix} ... EXECUTED`, "ok");
      finish(true);
      return;
    }
    print(`[REJ ] '${fix}' does not apply to ${active.def.system}.${active.def.sev === "critical" ? " Time is running out!" : ""}`, "bad");
    Sound.reject();
    panel.classList.remove("rejected");
    void panel.offsetWidth;
    panel.classList.add("rejected");
    setTimeout(() => panel.classList.remove("rejected"), 320);
  }

  function execute(raw) {
    const text = norm(raw);
    if (!text) return;
    print("MCC> " + raw.trim(), "cmd");
    if (locked) { print("Console busy — system responding...", "dim"); return; }

    const fix = fixOf(text);
    if (fix) { runFix(fix); return; }

    const [cmd, ...rest] = text.split(" ");
    const arg = rest.join(" ");
    switch (cmd) {
      case "help": case "?": cmdHelp(); break;
      case "guide": toggleGuide(); break;
      case "status": cmdStatus(); break;
      case "hint": cmdHint(); break;
      case "clear": case "cls": out.innerHTML = ""; break;
      case "sound": cmdSound(arg); break;
      case "drill": cmdDrill(arg); break;
      default:
        print(`[ERR ] Unknown command '${text}'. Type 'help'.`, active ? SEV[active.def.sev].cls : "bad");
    }
  }

  /* Historial y autocompletado con TAB */
  const history = [];
  let hpos = 0;
  const COMMANDS = [].concat(
    Object.keys(FIX_ALIASES),
    ["status", "hint", "help", "clear", "guide", "sound on", "sound off"],
    Object.keys(INCIDENTS).map((k) => "drill " + k)
  );

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const value = input.value;
      if (value.trim()) { history.push(value); hpos = history.length; }
      input.value = "";
      execute(value);
    } else if (e.key === "ArrowUp" && history.length) {
      hpos = Math.max(0, hpos - 1);
      input.value = history[hpos];
      e.preventDefault();
    } else if (e.key === "ArrowDown" && history.length) {
      hpos = Math.min(history.length, hpos + 1);
      input.value = history[hpos] || "";
      e.preventDefault();
    } else if (e.key === "Tab") {
      const typed = norm(input.value);
      if (typed) {
        const matches = COMMANDS.filter((c) => c.startsWith(typed));
        if (matches.length === 1) input.value = matches[0];
        else if (matches.length > 1) print(matches.join("   "), "dim");
      }
      e.preventDefault();
    }
  });

  /* ---------------------------------------------------------------
     Guía de comandos (se genera desde el catálogo)
     --------------------------------------------------------------- */
  function buildGuide() {
    const parts = [];
    GUIDE.forEach((section) => {
      parts.push(`<h4>${section.group}</h4><dl>`);
      section.items.forEach(([cmd, desc, use]) => {
        const base = cmd.split(" ")[0] === "drill" || cmd.startsWith("sound") ? cmd.split(" ")[0] : cmd;
        parts.push(`<dt><button type="button" class="guide-cmd" data-cmd="${base}">${cmd}</button></dt>`
          + `<dd>${desc}${use ? `<small>Úsalo en: ${use}</small>` : ""}</dd>`);
      });
      parts.push("</dl>");
    });
    parts.push(`<h4>Niveles de alerta</h4><ul class="guide-levels">
      <li><b class="lvl-adv">ADVISORY</b> — aviso. Sin consecuencias si lo ignoras.</li>
      <li><b class="lvl-warn">WARNING</b> — advertencia. Afecta el turno si no actúas.</li>
      <li><b class="lvl-crit">CRITICAL</b> — alarma maestra. Pone en riesgo la misión; el tiempo es corto.</li>
    </ul>`);
    guideEl.innerHTML = parts.join("");
    guideEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".guide-cmd");
      if (!btn) return;
      input.value = btn.dataset.cmd + (btn.dataset.cmd === "drill" ? " " : "");
      input.focus();
    });
  }

  guideBtn.addEventListener("click", () => toggleGuide());
  soundBtn.addEventListener("click", () => cmdSound(Sound.enabled ? "off" : "on"));
  panel.addEventListener("click", (e) => {
    if (!e.target.closest("button")) input.focus({ preventScroll: true });
  });

  buildGuide();
  toggleGuide(window.matchMedia("(min-width: 821px)").matches);
  panel.dataset.state = "idle";
  print("MISSION CONTROL TERMINAL // ORBITA-MCC v1.0", "hint");
  print("Link established. All systems nominal.", "ok");
  print("Type 'help' for commands, or open the command guide. Try: drill storm", "dim");

  window.Consola = {
    raise,
    reset,
    isActive: () => Boolean(active) || locked
  };
})();
