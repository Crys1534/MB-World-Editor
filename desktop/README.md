# MB World Editor — versión de PC

Programa de Windows que abre el editor en su propia ventana.

- **Con internet** abre la página de siempre, así que el editor siempre está al día.
- **Sin internet** usa la última copia guardada (o la que viene en el instalador).
- **Doble clic en un .mbw** → se abre en el editor (si ya está abierto, en una pestaña nueva).

## Cómo se fabrica
GitHub lo fabrica solo (ver `.github/workflows/desktop.yml`):
- Cada cambio en esta carpeta → instalador de prueba en la pestaña **Actions**.
- Subir una etiqueta `desktop-vX.Y.Z` (igual a `version` en `package.json`) → se publica en **Releases**.

A mano (en una PC con Windows): `npm ci` y luego `npm run dist` → el instalador queda en `dist/`.
