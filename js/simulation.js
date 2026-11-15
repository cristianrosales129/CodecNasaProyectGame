const MissionSimulation = {
  start(state = MissionState.current) {
    const destination = MissionRules.destination(state);
    const power = MissionRules.powerSystem(state);
    const totals = MissionRules.totals(state);
    const totalTurns = 1 + destination.transitTurns + 3;
    const simulation = {
      turn: 0,
      totalTurns,
      energy: power.storage,
      maximumEnergy: power.storage,
      science: 0,
      dataGenerated: 0,
      dataSent: 0,
      panelDamage: false,
      antennaDisabled: false,
      failed: false,
      finished: false,
      launchSucceeded: false,
      pending: null,
      turnCtx: null,
      incidents: { total: 0, solved: 0 },
      log: []
    };
    state.simulation = simulation;
    state.report = null;
    state.reportVisible = false;
    return simulation;
  },
  /* El turno se calcula por fases. Si ocurre un incidente, el turno queda en pausa
     (sim.pending) hasta que la consola de control lo resuelva con un comando o se agote el tiempo. */
  nextTurn(state = MissionState.current, random = Math.random) {
    const sim = state.simulation;
    if (!sim || sim.finished || sim.pending) return null;

    sim.turn += 1;
    const destination = MissionRules.destination(state);
    const launcher = MissionRules.launcher(state);
    const power = MissionRules.powerSystem(state);
    const communication = MissionRules.communication(state);
    const isLaunch = sim.turn === 1;
    const operationStart = 2 + destination.transitTurns;
    const isOperation = sim.turn >= operationStart;
    const stage = isLaunch ? "LANZAMIENTO" : (isOperation ? "OPERACIÓN" : "TRÁNSITO");
    sim.turnCtx = { stage, isLaunch, isOperation, messages: [], event: false };

    if (isLaunch) {
      sim.launchSucceeded = random() < launcher.reliability;
      if (sim.launchSucceeded) {
        sim.turnCtx.messages.push(`Lanzamiento exitoso. La nave inicia su viaje hacia ${destination.name.toLowerCase()}.`);
        return this.closeTurn(state);
      }
      return this.raise(state, "launch");
    }

    if (random() < 0.14) {
      const eventChoice = Math.floor(random() * 3);
      if (eventChoice === 0) return this.raise(state, "storm");
      if (eventChoice === 1) {
        if (!isOperation) return this.raise(state, "interference");
        if (random() > communication.reliability) return this.raise(state, "antenna");
        return this.raise(state, "interference");
      }
      if (power.id !== "rtg" && !sim.panelDamage) return this.raise(state, "meteoroid");
      return this.raise(state, "radiation");
    }
    return this.continueTurn(state);
  },
  raise(state, kind) {
    const sim = state.simulation;
    sim.turnCtx.event = true;
    sim.incidents.total += 1;
    sim.pending = { kind, turn: sim.turn, stage: sim.turnCtx.stage };
    return null;
  },
  /* Aplica el resultado de un incidente (solved = true si el jugador escribió el comando correcto a tiempo). */
  resolveIncident(state = MissionState.current, solved = false) {
    const sim = state.simulation;
    const incident = sim && sim.pending;
    if (!incident) return null;
    sim.pending = null;
    if (solved) sim.incidents.solved += 1;
    const ctx = sim.turnCtx;
    const destination = MissionRules.destination(state);
    const say = (text) => ctx.messages.push(text);

    switch (incident.kind) {
      case "launch":
        if (solved) {
          sim.launchSucceeded = true;
          say(`Anomalía de ascenso corregida desde control de misión. Lanzamiento exitoso: la nave inicia su viaje hacia ${destination.name.toLowerCase()}.`);
        } else {
          sim.failed = true;
          say("El lanzador sufrió una anomalía durante el ascenso. La nave no alcanzó la órbita.");
        }
        return this.closeTurn(state);
      case "storm": {
        const loss = Math.ceil(sim.maximumEnergy * (solved ? 0.1 : 0.4));
        sim.energy = Math.max(0, sim.energy - loss);
        say(solved
          ? "Tormenta solar: el modo seguro protegió la electrónica y la reserva de energía casi no se redujo."
          : "Tormenta solar: una descarga de radiación redujo la reserva de energía.");
        break;
      }
      case "interference":
        if (!ctx.isOperation) say("Interferencia de radio durante el tránsito; no había datos que transmitir." + (solved ? " El enlace se reinició desde control de misión." : ""));
        else say("Interferencia de radio detectada; la antena mantuvo el enlace." + (solved ? " El enlace se resincronizó desde control de misión." : ""));
        break;
      case "antenna":
        if (solved) say("Falla de antena: el reinicio desde control de misión restableció el enlace.");
        else { sim.antennaDisabled = true; say("Falla de antena: no se podrán transmitir datos durante este turno."); }
        break;
      case "meteoroid":
        if (solved) say("Micrometeoritos: los paneles se recogieron a tiempo y no sufrieron daños.");
        else { sim.panelDamage = true; say("Micrometeorito: los paneles recibieron daños y generarán menos energía."); }
        break;
      case "radiation":
        if (solved) say("Radiación elevada: el modo seguro evitó el consumo adicional de energía.");
        else { sim.energy = Math.max(0, sim.energy - 3); say("Radiación elevada: los sistemas consumieron energía adicional."); }
        break;
      case "lowpower": {
        const available = ctx.available;
        const totals = MissionRules.totals(state);
        if (solved) {
          const ratio = available / totals.powerUse;
          const result = this.observe(state, ratio, available);
          say(`Carga reducida (${Math.round(ratio * 100)}%): ${result.science} puntos de ciencia potencial, ${result.sent}/${result.generated} unidades de datos transmitidas.`);
        } else {
          sim.energy = Math.min(sim.maximumEnergy, available);
          say("Energía insuficiente: los instrumentos no pudieron completar las observaciones.");
        }
        return this.closeTurn(state);
      }
    }
    return this.continueTurn(state);
  },
  continueTurn(state) {
    const sim = state.simulation;
    const ctx = sim.turnCtx;
    const totals = MissionRules.totals(state);

    if (ctx.isOperation && !sim.failed) {
      const available = sim.energy + this.generation(state, sim);
      if (available < totals.powerUse) {
        ctx.available = available;
        return this.raise(state, "lowpower");
      }
      const result = this.observe(state, 1, totals.powerUse);
      ctx.messages.push(`Observaciones completadas: ${result.science} puntos de ciencia potencial, ${result.sent}/${result.generated} unidades de datos transmitidas.`);
    } else {
      sim.energy = Math.min(sim.maximumEnergy, sim.energy + this.generation(state, sim));
      if (!ctx.isOperation) ctx.messages.push(`Tránsito nominal. Energía a bordo: ${sim.energy}/${sim.maximumEnergy} unidades.`);
    }
    return this.closeTurn(state);
  },
  /* Observaciones científicas del turno. ratio < 1 significa carga reducida (se apagaron consumidores). */
  observe(state, ratio, powerUsed) {
    const sim = state.simulation;
    const totals = MissionRules.totals(state);
    const destination = MissionRules.destination(state);
    const communication = MissionRules.communication(state);
    const available = sim.energy + this.generation(state, sim);
    const used = ratio >= 1 ? powerUsed : available;
    sim.energy = Math.min(sim.maximumEnergy, available - used);
    const generated = ratio >= 1 ? totals.dataOutput : Math.floor(totals.dataOutput * ratio);
    const sent = sim.antennaDisabled ? 0 : Math.min(communication.rate, generated);
    const scienceShare = generated === 0 ? 0 : sent / generated;
    const science = Math.round(totals.sciencePotential * destination.scienceBonus * ratio * scienceShare);
    sim.dataGenerated += generated;
    sim.dataSent += sent;
    sim.science += science;
    return { science, sent, generated };
  },
  closeTurn(state) {
    const sim = state.simulation;
    const ctx = sim.turnCtx;
    sim.antennaDisabled = false;
    sim.log.unshift({ turn: sim.turn, stage: ctx.stage, event: ctx.event, success: ctx.isLaunch && sim.launchSucceeded, text: ctx.messages.join(" ") });
    sim.turnCtx = null;
    if (sim.failed || sim.turn >= sim.totalTurns) {
      sim.finished = true;
      state.report = this.createReport(state);
    }
    return sim.log[0];
  },
  generation(state, sim) {
    const power = MissionRules.powerSystem(state);
    const destination = MissionRules.destination(state);
    const factor = power.id === "rtg" ? 1 : destination.solarFactor;
    const damageFactor = sim.panelDamage && power.id !== "rtg" ? 0.65 : 1;
    return Math.max(0, Math.floor(power.output * factor * damageFactor));
  },
  createReport(state) {
    const sim = state.simulation;
    const destination = MissionRules.destination(state);
    const totals = MissionRules.totals(state);
    const theoreticalScience = totals.sciencePotential * destination.scienceBonus * 3;
    const scienceScore = theoreticalScience ? Math.round((sim.science / theoreticalScience) * 100) : 0;
    const success = !sim.failed && sim.dataSent > 0 && sim.science > 0;
    const explanations = [];

    if (sim.incidents && sim.incidents.total > 0) explanations.push(`Control de misión: resolviste ${sim.incidents.solved} de ${sim.incidents.total} alertas con comandos.`);
    if (sim.failed) explanations.push("La misión no llegó a completar el lanzamiento; revisa la fiabilidad del lanzador.");
    if (!sim.failed && totals.powerUse > MissionRules.effectivePower(state)) explanations.push("La demanda de energía superó la generación disponible en este destino.");
    if (sim.dataGenerated > sim.dataSent) explanations.push(`Se generaron ${sim.dataGenerated} unidades de datos y se transmitieron ${sim.dataSent}; una antena con más capacidad habría recuperado más ciencia.`);
    if (sim.panelDamage) explanations.push("El impacto de un micrometeorito redujo la generación de los paneles solares.");
    if (sim.science === 0 && !sim.failed) explanations.push("No se logró transmitir ciencia útil; revisa energía, antena y carga de instrumentos.");
    if (success && scienceScore >= 75) explanations.push("Excelente rendimiento científico: los instrumentos y subsistemas trabajaron bien en conjunto.");
    else if (success) explanations.push("La misión cumplió su objetivo, aunque hay margen para mejorar la energía o el retorno de datos.");
    if (sim.log.some((entry) => entry.text.includes("Tormenta solar"))) explanations.push("Una tormenta solar redujo la reserva de energía durante el viaje.");

    return {
      success,
      score: Math.max(0, Math.min(100, scienceScore)),
      science: sim.science,
      dataGenerated: sim.dataGenerated,
      dataSent: sim.dataSent,
      turns: sim.turn,
      explanations
    };
  }
};
