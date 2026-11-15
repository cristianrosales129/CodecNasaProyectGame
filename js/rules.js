const MissionRules = {
  destination(state = MissionState.current) {
    return MissionData.destinations.find((item) => item.id === state.destinationId) || null;
  },
  instruments(state = MissionState.current) {
    return state.instrumentIds
      .map((id) => MissionData.instruments.find((item) => item.id === id))
      .filter(Boolean);
  },
  launcher(state = MissionState.current) {
    return MissionData.launchers.find((item) => item.id === state.launcherId) || null;
  },
  powerSystem(state = MissionState.current) {
    return MissionData.powerSystems.find((item) => item.id === state.powerId) || null;
  },
  communication(state = MissionState.current) {
    return MissionData.communications.find((item) => item.id === state.communicationId) || null;
  },
  totals(state = MissionState.current) {
    const instruments = this.instruments(state);
    const launcher = this.launcher(state);
    const power = this.powerSystem(state);
    const communication = this.communication(state);
    return {
      budget: instruments.reduce((sum, item) => sum + item.cost, 0)
        + (launcher ? launcher.cost : 0)
        + (power ? power.cost : 0)
        + (communication ? communication.cost : 0),
      mass: instruments.reduce((sum, item) => sum + item.mass, 0)
        + (power ? power.mass : 0)
        + (communication ? communication.mass : 0),
      powerUse: instruments.reduce((sum, item) => sum + item.power, 0),
      dataOutput: instruments.reduce((sum, item) => sum + item.data, 0),
      sciencePotential: instruments.reduce((sum, item) => sum + item.science, 0)
    };
  },
  validation(step, state = MissionState.current) {
    const totals = this.totals(state);
    const issues = [];

     if (step === 0 && !this.destination(state)) issues.push("Elige un destino para la misión.");
  if (step === 1 && this.instruments(state).length === 0) issues.push("Selecciona al menos un instrumento científico.");
  if (step === 2 && !this.launcher(state)) issues.push("Selecciona un lanzador.");
  if (step === 3) {
    if (!this.powerSystem(state)) issues.push("Selecciona una fuente de energía.");
    if (!this.communication(state)) issues.push("Selecciona un sistema de comunicaciones.");
    if (this.powerSystem(state) && totals.powerUse > this.effectivePower(state)) {
      issues.push(`Los instrumentos consumen ${totals.powerUse} u/turno, pero la fuente produce ${this.effectivePower(state)} u/turno en este destino.`);
      }
    }

   const launcher = this.launcher(state);
  if (step >= 2 && launcher && totals.mass > launcher.capacity) {
    issues.push(`La carga pesa ${totals.mass} kg y supera la capacidad de ${launcher.capacity} kg.`);
  }
  if (step >= 3 && totals.budget > MissionData.budget) {
    issues.push(`El costo de ${totals.budget} MCr supera el presupuesto de ${MissionData.budget} MCr.`);
  }
    return issues;
  },
  effectivePower(state = MissionState.current) {
    const power = this.powerSystem(state);
    const destination = this.destination(state);
    if (!power) return 0;
    return Math.floor(power.output * (power.id === "rtg" ? 1 : (destination ? destination.solarFactor : 1)));
  }
};
