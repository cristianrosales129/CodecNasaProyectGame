(() => {
  const workspace = document.getElementById("workspace");
  const stepList = document.getElementById("step-list");
  const format = (value) => new Intl.NumberFormat("es-CO").format(value);
  let launchCompletionTimer = null;
  let launchSequenceTimer = null;
  let launchInProgress = false;

  /* Avanza un turno. Si la simulación genera un incidente, el turno queda en pausa
     hasta que la consola lo resuelva (comando correcto) o se acabe el tiempo. */
  function advanceTurn() {
    MissionSimulation.nextTurn();
    render();
    raisePendingIncident();
  }

  function raisePendingIncident() {
    const sim = MissionState.current.simulation;
    if (!sim || !sim.pending) return;
    if (!window.Consola) {
      MissionSimulation.resolveIncident(MissionState.current, false);
      render();
      return;
    }
    window.Consola.raise(sim.pending.kind, (solved) => {
      MissionSimulation.resolveIncident(MissionState.current, solved);
      render();
      raisePendingIncident(); // un turno puede generar un segundo incidente (energía baja)
    });
  }

  function render() {
    renderStatus();
    renderSteps();
    if (MissionState.current.reportVisible) renderReport();
    else if (MissionState.current.step === 4) renderSimulation();
    else renderSetup();
  }

  function renderStatus() {
    const state = MissionState.current;
    const totals = MissionRules.totals(state);
    const launcher = MissionRules.launcher(state);
    const power = MissionRules.powerSystem(state);
    const communication = MissionRules.communication(state);
    const budgetRemaining = MissionData.budget - totals.budget;
    const massRemaining = launcher ? launcher.capacity - totals.mass : null;
    setText("budget-value", format(Math.max(0, budgetRemaining)));
    setText("budget-detail", `${format(totals.budget)} / ${format(MissionData.budget)} MCr usados`);
    setText("mass-value", launcher ? format(totals.mass) : format(totals.mass));
    setText("mass-detail", launcher ? `${format(Math.max(0, massRemaining))} kg libres de ${format(launcher.capacity)} kg` : "selecciona un lanzador");
    setText("energy-value", power ? format(MissionRules.effectivePower(state)) : "—");
    setText("energy-detail", power ? `${format(totals.powerUse)} u/turno de consumo` : "selecciona una fuente");
    setText("data-value", communication ? format(communication.rate) : "—");
    setText("data-detail", communication ? `${format(totals.dataOutput)} u/turno generadas` : "selecciona una antena");

    toggleStatusClass("budget-value", budgetRemaining < 0, "is-over");
    toggleStatusClass("mass-value", massRemaining !== null && massRemaining < 0, "is-over");
    toggleStatusClass("energy-value", power && totals.powerUse <= MissionRules.effectivePower(state), "is-good");
    toggleStatusClass("data-value", communication && communication.rate >= totals.dataOutput, "is-good");
  }

  function renderSteps() {
    const state = MissionState.current;
    stepList.innerHTML = MissionData.steps.map((name, index) => {
      const active = state.step === index;
      const done = state.report ? true : state.step > index;
      return `<li class="${active ? "active" : ""} ${done ? "done" : ""}"${active ? ' aria-current="step"' : ""}>
        <span class="step-number">${done ? "✓" : `0${index + 1}`}</span><span>${name}</span></li>`;
    }).join("");
  }

  function renderSetup() {
    const step = MissionState.current.step;
    const headings = [
      ["01 / OBJETIVO", "Elige un destino", "Cada destino ofrece una oportunidad científica distinta y exige recursos diferentes."],
      ["02 / CARGA CIENTÍFICA", "Elige tus instrumentos", "Selecciona la carga científica. Cada instrumento suma masa, consumo, costo y capacidad de descubrimiento."],
      ["03 / VEHÍCULO DE LANZAMIENTO", "Elige tu lanzador", "La capacidad debe cubrir toda la masa de los instrumentos y los subsistemas."],
      ["04 / SISTEMAS DE LA NAVE", "Equilibra energía y datos", "La energía debe cubrir el consumo y la antena debe poder transmitir las observaciones."]
    ];
    const [mark, title, subtitle] = headings[step];
    let content = "";
    if (step === 0) content = renderChoices(MissionData.destinations, "destinationId", "destination", (item) => [
      ["DISTANCIA", item.distance], ["CIENCIA", `×${item.scienceBonus.toFixed(2)}`], ["TRÁNSITO", `${item.transitTurns} turnos`]
    ]);
    if (step === 1) content = renderChoices(MissionData.instruments, "instrumentIds", "instrument", (item) => [
      ["MASA", `${item.mass} kg`], ["ENERGÍA", `${item.power} u/t`], ["DATOS", `${item.data} u/t`], ["COSTO", `${item.cost} MCr`]
    ]);
    if (step === 2) content = renderChoices(MissionData.launchers, "launcherId", "launcher", (item) => [
      ["CAPACIDAD", `${item.capacity} kg`], ["COSTO", `${item.cost} MCr`], ["FIABILIDAD", `${Math.round(item.reliability * 100)}%`]
    ]);
    if (step === 3) content = `<div class="card-grid">
      <div><p class="card-tag">FUENTE DE ENERGÍA</p>${renderChoices(MissionData.powerSystems, "powerId", "power", (item) => [
        ["SALIDA", `${item.output} u/t`], ["ALMACENAMIENTO", `${item.storage} u`], ["COSTO", `${item.cost} MCr`]
      ], true)}</div>
      <div><p class="card-tag">COMUNICACIONES</p>${renderChoices(MissionData.communications, "communicationId", "communication", (item) => [
        ["DATOS", `${item.rate} u/t`], ["FIABILIDAD", `${Math.round(item.reliability * 100)}%`], ["COSTO", `${item.cost} MCr`]
      ], true)}</div>
    </div>`;
    const issues = MissionRules.validation(step);
    workspace.innerHTML = `<div class="workspace-head"><div><p class="eyebrow">${mark}</p><h2 class="workspace-title">${title}</h2><p class="workspace-subtitle">${subtitle}</p></div><span class="phase-mark">ETAPA 0${step + 1} / 05</span></div>
      ${content}
      ${issues.length ? `<div class="validation">${issues.map(escapeHtml).join("<br>")}</div>` : ""}
      <div class="actions">
        ${step > 0 ? '<button class="button" type="button" data-action="back">← Volver</button>' : '<span></span>'}
        <div class="action-right"><button class="button primary" type="button" data-action="next" ${issues.length ? "disabled" : ""}>${step === 3 ? "Revisar misión →" : "Continuar →"}</button></div>
      </div>`;
    bindChoiceEvents();
    bindActionEvents();
  }

  function renderChoices(items, key, kind, statsFor, compact = false) {
    const state = MissionState.current;
    const selected = state[key];
    const selectedIds = Array.isArray(selected) ? selected : [selected];
    const count = kind === "instrument" ? `<span class="selection-count">${selectedIds.length} seleccionados · máximo 4</span>` : "";
    return `<div class="card-grid">${items.map((item) => {
      const isSelected = selectedIds.includes(item.id);
      const stats = statsFor(item).map(([label, value]) => `<span>${label} <strong>${escapeHtml(value)}</strong></span>`).join("");
      return `<button type="button" class="choice-card ${kind === "instrument" ? "instrument-card" : ""} ${compact ? "compact-card" : ""} ${isSelected ? "selected" : ""}" data-kind="${kind}" data-id="${item.id}" aria-pressed="${isSelected}">
        <span class="card-tag">${item.tag || item.class || item.category}</span>
        <span class="card-title">${item.name}</span>
        <span class="card-description">${item.description}</span>
        <span class="card-stats">${stats}</span>
      </button>`;
    }).join("")}</div>${count}`;
  }

  function bindChoiceEvents() {
    workspace.querySelectorAll("[data-kind]").forEach((button) => {
      button.addEventListener("click", () => {
        const { kind, id } = button.dataset;
        const state = MissionState.current;
        if (kind === "instrument") {
          const selected = state.instrumentIds;
          state.instrumentIds = selected.includes(id)
            ? selected.filter((item) => item !== id)
            : (selected.length < 4 ? [...selected, id] : selected);
        } else if (kind === "destination") {
          state.destinationId = id;
        } else if (kind === "launcher") {
          state.launcherId = id;
        } else if (kind === "power") {
          state.powerId = id;
        } else if (kind === "communication") {
          state.communicationId = id;
        }
        render();
      });
    });
  }

  function bindActionEvents() {
    workspace.querySelector('[data-action="back"]')?.addEventListener("click", () => {
      MissionState.current.step = Math.max(0, MissionState.current.step - 1);
      render();
    });
    workspace.querySelector('[data-action="next"]')?.addEventListener("click", () => {
      const step = MissionState.current.step;
      if (MissionRules.validation(step).length) return;
      if (step < 3) MissionState.current.step += 1;
      else {
        MissionState.current.step = 4;
        MissionSimulation.start();
      }
      render();
    });
    workspace.querySelector('[data-action="turn"]')?.addEventListener("click", advanceTurn);
    workspace.querySelector('[data-action="restart-simulation"]')?.addEventListener("click", () => {
      window.Consola?.reset();
      MissionSimulation.start();
      render();
    });
    workspace.querySelector('[data-action="new-mission"]')?.addEventListener("click", resetMission);
  }

  function renderSimulation() {
    const state = MissionState.current;
    const sim = state.simulation;
    const destination = MissionRules.destination(state);
    const totals = MissionRules.totals(state);
    const progress = sim ? Math.round((sim.turn / sim.totalTurns) * 100) : 0;
    const entries = sim.log.map((entry) => `<li class="log-entry ${entry.event ? "event" : ""} ${entry.success ? "success" : ""}">
      <span class="log-turn">T${String(entry.turn).padStart(2, "0")} · ${entry.stage}</span><span>${escapeHtml(entry.text)}</span></li>`).join("");
    const pendingRow = sim.pending ? `<li class="log-entry event pending" role="alert">
      <span class="log-turn">T${String(sim.turn).padStart(2, "0")} · ${sim.turnCtx ? sim.turnCtx.stage : ""}</span><span>⚠ Alerta activa. Escribe el comando correcto en la consola de control antes de que se acabe el tiempo.</span></li>` : "";
    const log = entries || pendingRow
      ? `<ul class="log">${pendingRow}${entries}</ul>`
      : '<div class="validation">Secuencia lista. Lanza la nave para iniciar el registro de misión.</div>';
    workspace.innerHTML = `<div class="workspace-head"><div><p class="eyebrow">05 / CONTROL DE MISIÓN</p><h2 class="workspace-title">Simulación en curso</h2><p class="workspace-subtitle">${destination.name} · ${totals.sciencePotential} ciencia potencial · ${sim.totalTurns} turnos previstos</p></div><span class="phase-mark">SIM-${destination.id.toUpperCase()}</span></div>
      <div class="mission-hud">
        <div class="hud-cell"><span class="hud-label">PROGRESO DE LA MISIÓN</span><span class="hud-value">Turno ${sim.turn} / ${sim.totalTurns}</span><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>
        <div class="hud-cell"><span class="hud-label">CIENCIA RECUPERADA</span><span class="hud-value">${format(sim.science)} pts</span></div>
        <div class="hud-cell"><span class="hud-label">DATOS TRANSMITIDOS</span><span class="hud-value">${format(sim.dataSent)} u</span></div>
      </div>${log}
      <div class="actions"><span></span><div class="action-right">
        ${sim.finished ? '<button class="button primary" type="button" data-action="show-report">Ver informe →</button>' : sim.pending
          ? '<button class="button primary" type="button" disabled>Alerta activa: usa la consola ↓</button>' : sim.turn === 0
          ? '<button class="button primary" type="button" data-action="launch">Ver secuencia del lanzamiento →</button>'
          : '<button class="button primary" type="button" data-action="turn">Avanzar un turno →</button>'}
      </div></div>`;
    workspace.querySelector('[data-action="launch"]')?.addEventListener("click", startLaunchCinematic);
    workspace.querySelector('[data-action="turn"]')?.addEventListener("click", advanceTurn);
    workspace.querySelector('[data-action="show-report"]')?.addEventListener("click", () => {
      MissionState.current.reportVisible = true;
      render();
});
  }

  function startLaunchCinematic() {
    if (launchInProgress) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      advanceTurn();
      return;
    }

    launchInProgress = true;
    workspace.innerHTML = `<div class="workspace-head"><div><p class="eyebrow">05 / CONTROL DE MISIÓN</p><h2 class="workspace-title">Secuencia de lanzamiento</h2><p class="workspace-subtitle">Todos los sistemas listos. Iniciando cuenta regresiva.</p></div><span class="phase-mark">LANZAMIENTO</span></div>
      <div class="launch-cinema" role="status" aria-live="polite">
        <div class="cinema-header"><span>SECUENCIA DE DESPEGUE</span><span class="cinema-live"><i></i> EN DIRECTO</span></div>
        <div class="launch-scene">
          <div class="launch-stars"></div>
          <div class="launch-moon"></div>
          <div class="launch-atmosphere"></div>
          <div class="launch-ground"></div>
          <div class="launch-pad"><span class="launch-tower"></span><span class="launch-platform"></span></div>
          <div class="launch-rocket" aria-hidden="true">
            <span class="rocket-nose"></span><span class="rocket-body"></span><span class="rocket-window"></span>
            <span class="rocket-fin rocket-fin-left"></span><span class="rocket-fin rocket-fin-right"></span>
            <span class="rocket-flame"></span>
          </div>
          <div class="launch-smoke"><i></i><i></i><i></i><i></i></div>
          <div class="cinema-caption"><strong id="launch-caption">T−04 · SECUENCIA INICIADA</strong><span>VUELO AUTOMÁTICO · TODOS LOS SISTEMAS NOMINALES</span></div>
        </div>
        <div class="cinema-footer"><span>CONTROL DE MISIÓN · TIERRA</span><button class="skip-launch" type="button" data-action="skip-launch">Saltar secuencia ↗</button></div>
      </div>`;
    workspace.querySelector('[data-action="skip-launch"]').addEventListener("click", completeLaunchCinematic);

    const captions = [
      "T−03 · TORRE LIBRE",
      "T−02 · PRESIÓN DE COMBUSTIBLE NOMINAL",
      "T−01 · TODOS LOS SISTEMAS LISTOS",
      "IGNICIÓN · DESPEGUE"
    ];
    let captionIndex = 0;
    launchSequenceTimer = window.setInterval(() => {
      const caption = document.getElementById("launch-caption");
      if (caption && captionIndex < captions.length) caption.textContent = captions[captionIndex++];
      if (captionIndex >= captions.length) {
        window.clearInterval(launchSequenceTimer);
        launchSequenceTimer = null;
      }
    }, 800);
    launchCompletionTimer = window.setTimeout(completeLaunchCinematic, 4500);
  }

  function completeLaunchCinematic() {
    if (!launchInProgress) return;
    cancelLaunchCinematic();
    advanceTurn();
  }

  function cancelLaunchCinematic() {
    if (launchCompletionTimer !== null) window.clearTimeout(launchCompletionTimer);
    if (launchSequenceTimer !== null) window.clearInterval(launchSequenceTimer);
    launchCompletionTimer = null;
    launchSequenceTimer = null;
    launchInProgress = false;
  }

  function renderReport() {
    const state = MissionState.current;
    const report = state.report;
    const destination = MissionRules.destination(state);
    const launcher = MissionRules.launcher(state);
    const totals = MissionRules.totals(state);
    const reason = report.success
      ? (report.score >= 75 ? "Misión sobresaliente" : "Objetivo científico cumplido")
      : "Misión sin retorno científico";
    workspace.innerHTML = `<div class="workspace-head"><div><p class="eyebrow">INFORME FINAL / ${destination.name.toUpperCase()}</p><h2 class="workspace-title">Resultado de la misión</h2><p class="workspace-subtitle">Resumen de rendimiento y oportunidades para el siguiente diseño.</p></div><span class="phase-mark">FIN DE MISIÓN</span></div>
      <div class="report-banner ${report.success ? "" : "failure"}">
        <div class="report-score">${report.score}<small style="font-size:11px">/100</small></div>
        <div><h3 class="report-heading">${reason}</h3><p class="report-copy">${report.success ? "La nave envió observaciones útiles desde su destino." : "La nave no logró completar una misión científica útil."}</p></div>
      </div>
      <div class="report-grid">
        <div class="report-stat"><span>CIENCIA RECUPERADA</span><strong>${format(report.science)} pts</strong></div>
        <div class="report-stat"><span>DATOS ENVIADOS</span><strong>${format(report.dataSent)} / ${format(report.dataGenerated)} u</strong></div>
        <div class="report-stat"><span>DISEÑO</span><strong>${format(totals.mass)} kg · ${launcher.name}</strong></div>
      </div>
      <h3 class="report-section-title">¿QUÉ DEFINIÓ EL RESULTADO?</h3>
      <ul class="explanation-list">${report.explanations.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
      <div class="actions"><span></span><div class="action-right"><button class="button primary" type="button" data-action="new-mission">Diseñar otra misión ↺</button></div></div>`;
    workspace.querySelector('[data-action="new-mission"]').addEventListener("click", resetMission);
  }

  function resetMission() {
    window.Consola?.reset();
    cancelLaunchCinematic();
    MissionState.reset();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setText(id, text) {
    document.getElementById(id).textContent = text;
  }

  function toggleStatusClass(valueId, active, className) {
    document.getElementById(valueId).closest(".status-item").classList.toggle(className, Boolean(active));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  document.getElementById("reset-button").addEventListener("click", resetMission);
  render();
})();
