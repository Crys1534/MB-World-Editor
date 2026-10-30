# MB World Editor — app de Android

App (APK) que abre el editor en pantalla completa y siempre acostada.

- **Con internet** abre la página de siempre, así que el editor siempre está al día.
- **Sin internet** usa la última copia guardada (o la que viene dentro del APK).
- **Guardar / exportar**: el celular pregunta dónde guardar el archivo.
- **Botón atrás**: cierra la ventana abierta; si no hay ninguna, pregunta si quieres salir.

## Cómo se fabrica
GitHub lo fabrica solo (ver `.github/workflows/android.yml`):
- Cada cambio en esta carpeta → APK de prueba + prueba automática en un celular virtual (pestaña **Actions**).
- Publicar un Release con la etiqueta `android-vX.Y.Z` → GitHub fabrica esa versión, la firma y le pega el APK.
  Para firmar necesita dos secretos del repositorio: `ANDROID_KEYSTORE_B64` y `ANDROID_KEYSTORE_PASSWORD`.
  Sin ellos, el APK se pega a mano al Release.

⚠️ La llave de firma (`.jks`) NUNCA se sube al repositorio. Sin la misma llave, las versiones nuevas
no se pueden instalar encima de la anterior.
