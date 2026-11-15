# Misión Orbital (codec37) — prototipo

Abrir `index.html` con la extensión **Live Server** de VS Code (clic derecho > Open with Live Server).

## Archivos
- `js/data.js`: elementos keplerianos de JPL (Tabla 1, 1800-2050) y constantes. Aquí se ajusta el balance.
- `js/physics.js`: Kepler, Hohmann y Tsiolkovsky. Sin DOM, se prueba con `node test/physics.test.js`.
- `js/api.js`: llamadas a NASA (APOD y Horizons experimental).
- `js/map.js`: dibujo del mapa 2D. `js/main.js`: interfaz y animación.
- `js/config.js`: claves de API.

## Claves de API
Edita `NASA_API_KEY` en `js/config.js` (gratis en https://api.nasa.gov). `DEMO_KEY` funciona con límite bajo.
Todo en el navegador es público al subir a GitHub Pages: no pongas claves privadas.

## Simplificaciones (decirlas en la demo)
Órbitas coplanares, transferencia de Hohmann, sobrevuelo (sin captura), ascenso a LEO fijo en 9,4 km/s.
