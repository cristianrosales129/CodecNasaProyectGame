/* Catálogos de destinos, instrumentos, lanzadores y subsistemas. */
const MissionData = {
  budget: 520,
  steps: ["Destino", "Instrumentos", "Lanzador", "Subsistemas", "Simulación"],
  destinations: [
    { id: "earth", name: "Observación de la Tierra", tag: "ÓRBITA TERRESTRE", icon: "01", distance: "Órbita baja", transitTurns: 1, scienceBonus: 1, solarFactor: 1.2, description: "Cartografía de nubes, océanos y cambios en la superficie. El destino más cercano y accesible." },
    { id: "moon", name: "Orbitador lunar", tag: "LUNA · 384.000 KM", icon: "02", distance: "3 días", transitTurns: 2, scienceBonus: 1.12, solarFactor: 1.05, description: "Busca agua y estudia la geología de nuestro satélite con observaciones desde órbita." },
    { id: "mars", name: "Rover en Marte", tag: "MARTE · 225 M KM", icon: "03", distance: "7 meses", transitTurns: 3, scienceBonus: 1.35, solarFactor: 0.78, description: "Explora el terreno marciano y busca pistas sobre la historia del agua y la habitabilidad." },
    { id: "asteroid", name: "Encuentro con asteroide", tag: "CINTURÓN PRINCIPAL", icon: "04", distance: "18 meses", transitTurns: 4, scienceBonus: 1.5, solarFactor: 0.62, description: "Analiza un mundo antiguo para revelar los materiales que formaron el sistema solar." }
  ],
  instruments: [
    { id: "camera", name: "Cámara multiespectral", category: "IMAGEN", mass: 18, power: 3, data: 2, science: 16, cost: 50, description: "Imágenes detalladas en varias bandas para estudiar superficies y atmósferas." },
    { id: "spectrometer", name: "Espectrómetro", category: "COMPOSICIÓN", mass: 24, power: 4, data: 2, science: 22, cost: 70, description: "Identifica minerales, gases y compuestos químicos a distancia." },
    { id: "radar", name: "Radar de penetración", category: "SUBSUPERFICIE", mass: 32, power: 6, data: 3, science: 25, cost: 90, description: "Explora capas bajo la superficie, incluso a través de polvo y hielo." },
    { id: "magnetometer", name: "Magnetómetro", category: "CAMPO MAGNÉTICO", mass: 12, power: 2, data: 1, science: 13, cost: 35, description: "Mide el campo magnético y ayuda a entender el interior del destino." },
    { id: "drill", name: "Taladro de muestras", category: "IN SITU", mass: 38, power: 7, data: 1, science: 28, cost: 105, description: "Recolecta material para analizarlo directamente sobre la superficie." },
    { id: "weather", name: "Estación meteorológica", category: "CLIMA", mass: 10, power: 2, data: 1, science: 12, cost: 30, description: "Registra temperatura, presión y viento durante toda la misión." }
  ],
  launchers: [
    { id: "light", name: "Lanzador ligero", class: "CLASE LIGERA", capacity: 75, cost: 85, reliability: 0.93, description: "Económico y eficiente para cargas pequeñas." },
    { id: "medium", name: "Lanzador estándar", class: "CLASE MEDIA", capacity: 150, cost: 145, reliability: 0.97, description: "Un equilibrio fiable entre capacidad y presupuesto." },
    { id: "heavy", name: "Lanzador pesado", class: "CLASE PESADA", capacity: 260, cost: 220, reliability: 0.985, description: "Gran capacidad para misiones ambiciosas y cargas complejas." }
  ],
  powerSystems: [
    { id: "solar-small", name: "Paneles solares compactos", class: "SOLAR", output: 8, storage: 16, mass: 12, cost: 45, description: "Ligeros y asequibles; rinden menos lejos del Sol." },
    { id: "solar-large", name: "Paneles solares desplegables", class: "SOLAR", output: 15, storage: 28, mass: 25, cost: 90, description: "Buena generación de energía para instrumentos exigentes." },
    { id: "rtg", name: "Generador termoeléctrico (RTG)", class: "NUCLEAR", output: 11, storage: 24, mass: 32, cost: 135, description: "Energía estable incluso en destinos lejanos o con poca luz." }
  ],
  communications: [
    { id: "low-gain", name: "Antena de baja ganancia", class: "BÁSICA", rate: 2, mass: 6, cost: 25, reliability: 0.88, description: "Ligera y sencilla, pero limita el volumen de datos transmitidos." },
    { id: "medium-gain", name: "Antena de media ganancia", class: "ESTÁNDAR", rate: 5, mass: 13, cost: 55, reliability: 0.95, description: "Capacidad equilibrada para una misión científica típica." },
    { id: "high-gain", name: "Antena de alta ganancia", class: "ALTA CAPACIDAD", rate: 9, mass: 24, cost: 95, reliability: 0.975, description: "Envía grandes volúmenes de datos, con un mayor costo y masa." }
  ]
};
