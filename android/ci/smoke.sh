#!/bin/bash
# Prueba automática del APK en un celular virtual: abre la app, revisa el editor con y sin internet, y toma fotos.
set -u
PKG=io.github.crys1534.mbworldeditor
OUT=android/ci-out
mkdir -p $OUT
APK=$(ls android/app/build/outputs/apk/debug/*.apk | head -1)
adb install -r "$APK" || exit 1
# (el aviso "Viendo en pantalla completa" de Android sale la primera vez y se queda con el botón Atrás: aquí ya se da por visto)
adb shell settings put secure immersive_mode_confirmations confirmed
fail=0
ok() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }

wait_loaded() {
  for i in $(seq 1 90); do
    if adb logcat -d -s MBWE:I | grep -q "page-loaded"; then return 0; fi
    sleep 2
  done
  return 1
}
connect() {
  PID=$(adb shell pidof $PKG | tr -d '\r')
  adb forward --remove-all >/dev/null 2>&1
  adb forward tcp:9222 localabstract:webview_devtools_remote_$PID >/dev/null
}
ask() { node android/ci/cdp.js 9222 "$1"; }
CHECK='(async () => { await new Promise(r => { const t = () => (typeof readWorldFile === "function" && document.readyState === "complete") ? r() : setTimeout(t, 300); t(); }); await new Promise(r => setTimeout(r, 6000)); const st = await fetch("style.css", { cache: "no-store" }); return { url: location.href, src: st.headers.get("x-mbw-source"), editor: typeof readWorldFile === "function", app: document.documentElement.classList.contains("is-app"), bridge: typeof MBWEAndroid, back: typeof mbwAppBack, body: document.body.className, landscape: innerWidth > innerHeight, w: innerWidth, h: innerHeight, fb: typeof firebase, tabs: (typeof WorldTabsManager !== "undefined" ? WorldTabsManager.openWorlds.map(w => w.filename) : []), fs: !!document.getElementById("m-fullscreen-btn") }; })()'

# ---------- 1) con internet, primera vez
adb logcat -c
adb shell am start -n $PKG/.MainActivity >/dev/null
if wait_loaded; then ok "the app opens the editor page"; else bad "the app opens the editor page"; fi
sleep 3; connect
R1=$(ask "$CHECK"); echo "online: $R1"
adb exec-out screencap -p > $OUT/1-online.png
echo "$R1" | grep -q '"editor":true' && ok "the editor works inside the app" || bad "the editor works inside the app"
echo "$R1" | grep -q '"src":"network"' && ok "with internet the files come from internet" || bad "with internet the files come from internet"
echo "$R1" | grep -q '"landscape":true' && ok "the screen is landscape" || bad "the screen is landscape"
echo "$R1" | grep -q '"app":true' && echo "$R1" | grep -q '"bridge":"object"' && ok "the page knows it is in the app (downloads + back button ready)" || bad "the page knows it is in the app"
echo "$R1" | grep -q 'Superflat World.mbw' && ok "a new user gets the Superflat World" || bad "a new user gets the Superflat World"
echo "$R1" | grep -q '"fs":false' && ok "no fullscreen button inside the app (it is already fullscreen)" || bad "no fullscreen button inside the app"
ROT=$(adb shell dumpsys window displays | grep -oE "mCurrentRotation=[^ ]+|mRotation=[0-9]+" | head -1); echo "rotation: $ROT"

# botón atrás con el inventario abierto: lo cierra (la app sigue abierta)
ask '(() => { localStorage.setItem("mbw_username", "Tester"); window.profileLocked = false; closeModal("unified-profile-modal"); toggleInventory(); return document.getElementById("inventory-modal").style.display; })()'
adb shell input keyevent KEYCODE_BACK; sleep 2
R2=$(ask '(() => ({ inv: document.getElementById("inventory-modal").style.display }))()'); echo "after back: $R2"
echo "$R2" | grep -q '"inv":"none"' && ok "the phone Back button closes the open window" || bad "the phone Back button closes the open window"
adb exec-out screencap -p > $OUT/2-after-back.png

# ---------- 2) sin internet (con la copia guardada)
adb shell svc wifi disable; adb shell svc data disable; sleep 3
adb shell am force-stop $PKG; adb logcat -c
adb shell am start -n $PKG/.MainActivity >/dev/null
if wait_loaded; then ok "without internet the app still opens the editor"; else bad "without internet the app still opens the editor"; fi
sleep 3; connect
R3=$(ask "$CHECK"); echo "offline: $R3"
adb exec-out screencap -p > $OUT/3-offline.png
echo "$R3" | grep -q '"editor":true' && echo "$R3" | grep -q '"src":"cache"' && echo "$R3" | grep -q '"fb":"object"' && ok "without internet everything comes from the saved copy" || bad "without internet everything comes from the saved copy"

# ---------- 3) sin internet y sin copia (recién instalada): usa la que viene en el APK
adb shell pm clear $PKG >/dev/null; adb logcat -c
adb shell am start -n $PKG/.MainActivity >/dev/null
if wait_loaded; then ok "first time without internet: opens from the copy inside the APK"; else bad "first time without internet: opens from the copy inside the APK"; fi
sleep 3; connect
R4=$(ask "$CHECK"); echo "bundled: $R4"
adb exec-out screencap -p > $OUT/4-bundled.png
echo "$R4" | grep -q '"editor":true' && echo "$R4" | grep -q '"src":"bundled"' && echo "$R4" | grep -q 'Superflat World.mbw' && ok "the copy inside the APK works (editor + Superflat World)" || bad "the copy inside the APK works"
adb shell svc wifi enable; adb shell svc data enable

adb logcat -d -s MBWE:* > $OUT/logcat.txt
grep -E "console (ERROR|error)" $OUT/logcat.txt | head -20
exit $fail
