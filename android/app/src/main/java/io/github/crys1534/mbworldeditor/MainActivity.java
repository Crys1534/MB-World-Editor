package io.github.crys1534.mbworldeditor;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Set;

/**
 * MB World Editor para Android: la página del editor en pantalla completa y siempre acostada.
 */
public class MainActivity extends ComponentActivity {
    private static final String TAG = "MBWE";
    static final String ORIGIN = "https://" + OfflineCache.SITE_HOST;
    static final String START_URL = ORIGIN + OfflineCache.SITE_PATH + "index.html";
    private static final String RELEASES_API = "https://api.github.com/repos/Crys1534/MB-World-Editor/releases?per_page=20";

    private WebView web;
    private OfflineCache cache;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSave;
    private String pendingSaveName;
    private boolean loadedOnce = false;

    private ActivityResultLauncher<Intent> pickFile;
    private ActivityResultLauncher<Intent> createFile;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);   // siempre acostada

        // pantalla completa: sin barras de arriba ni de abajo (se asoman deslizando desde el borde)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(27, 40, 56));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        hideSystemBars();

        // que el editor no quede debajo de la cámara del celular, y que el teclado no tape lo que escribes
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets cut = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(cut.left, cut.top, cut.right, Math.max(cut.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        String version = appVersion();
        cache = new OfflineCache(this, " MBWEApp/" + version);

        // (solo en el APK de prueba: deja que las pruebas automáticas revisen la página por dentro)
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);                       // la letra grande del sistema no desarma el editor
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setUserAgentString(s.getUserAgentString() + cache.userAgentSuffix);
        web.setBackgroundColor(Color.rgb(27, 40, 56));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        Set<String> origins = Collections.singleton(ORIGIN);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "MBWEAndroid", origins, (view, message, sourceOrigin, isMainFrame, replyProxy) -> onPageMessage(message.getData()));
        }
        String appJs = readAsset("mbwe-app.js");
        boolean docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) && appJs != null;
        if (docStart) WebViewCompat.addDocumentStartJavaScript(web, appJs, origins);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return cache.handle(request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String url = u.toString();
                if (url.startsWith(ORIGIN + OfflineCache.SITE_PATH)) return false;
                // enlaces a otros sitios (Discord, GitHub...) → el navegador del celular
                if ("http".equals(u.getScheme()) || "https".equals(u.getScheme()) || "mailto".equals(u.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* nada */ }
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith(ORIGIN)) {
                    loadedOnce = true;
                    if (!docStart && appJs != null) view.evaluateJavascript(appJs, null);
                    Log.i(TAG, "page-loaded " + url);
                }
            }

            // si el motor de la página se cae (poca memoria, etc.), la app NO se cierra: vuelve a abrir el editor
            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                Log.e(TAG, "renderer-gone crash=" + detail.didCrash() + " prio=" + detail.rendererPriorityAtExit());
                ViewGroup parent = (ViewGroup) view.getParent();
                if (parent != null) parent.removeView(view);
                view.destroy();
                if (view == web) web = null;
                recreate();
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    Log.w(TAG, "main-frame-error " + error.getDescription());
                    view.loadDataWithBaseURL(null, errorPage(), "text/html", "utf-8", null);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                String type = "*/*";
                String[] acc = params.getAcceptTypes();
                if (acc != null && acc.length > 0) {
                    boolean allImages = true;
                    for (String a : acc) if (a == null || !a.trim().startsWith("image/")) { allImages = false; break; }
                    if (allImages) type = "image/*";
                }
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(type);
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { pickFile.launch(i); } catch (ActivityNotFoundException e) { fileCallback.onReceiveValue(null); fileCallback = null; return false; }
                return true;
            }

            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage m) {
                Log.d(TAG, "console " + m.messageLevel() + ": " + m.message());
                return true;
            }
        });

        pickFile = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (fileCallback == null) return;
            Uri[] out = null;
            Intent data = result.getData();
            if (result.getResultCode() == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    out = new Uri[data.getClipData().getItemCount()];
                    for (int k = 0; k < out.length; k++) out[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) out = new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(out);
            fileCallback = null;
        });

        createFile = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            byte[] bytes = pendingSave;
            String name = pendingSaveName;
            pendingSave = null;
            pendingSaveName = null;
            if (result.getResultCode() != RESULT_OK || result.getData() == null || result.getData().getData() == null || bytes == null) return;
            try (OutputStream o = getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (o == null) throw new Exception("no stream");
                o.write(bytes);
                Toast.makeText(this, getString(R.string.saved, name), Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, R.string.save_error, Toast.LENGTH_LONG).show();
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (!loadedOnce || web == null) { askExit(); return; }
                web.evaluateJavascript("(window.mbwAppBack && window.mbwAppBack()) ? 'yes' : 'no'", value -> {
                    if (value == null || !value.contains("yes")) askExit();
                });
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);

        new Handler(Looper.getMainLooper()).postDelayed(this::checkForUpdate, 8000);
    }

    // ---------------------------------------------------------------- mensajes de la página
    private void onPageMessage(String data) {
        try {
            JSONObject o = new JSONObject(data);
            if ("save".equals(o.optString("type"))) {
                pendingSave = Base64.decode(o.optString("data", ""), Base64.DEFAULT);
                pendingSaveName = o.optString("name", "download");
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String mime = o.optString("mime", "application/octet-stream");
                if (pendingSaveName.toLowerCase().endsWith(".mbw")) mime = "application/octet-stream";
                i.setType(mime.isEmpty() ? "application/octet-stream" : mime);
                i.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                createFile.launch(i);
            }
        } catch (Exception e) {
            Log.w(TAG, "bad message", e);
        }
    }

    // ---------------------------------------------------------------- salir
    private void askExit() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.exit_title)
                .setPositiveButton(R.string.exit_yes, (d, w) -> finish())
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    // ---------------------------------------------------------------- versión nueva de la app
    private void checkForUpdate() {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(RELEASES_API).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setRequestProperty("Accept", "application/vnd.github+json");
                c.setRequestProperty("User-Agent", "MB-World-Editor-Android");
                if (c.getResponseCode() != 200) return;
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                try (InputStream in = c.getInputStream()) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) bo.write(b, 0, n); }
                JSONArray arr = new JSONArray(new String(bo.toByteArray(), StandardCharsets.UTF_8));
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject r = arr.getJSONObject(i);
                    if (r.optBoolean("draft") || r.optBoolean("prerelease")) continue;
                    String tag = r.optString("tag_name", "");
                    if (!tag.startsWith("android-v")) continue;
                    String v = tag.substring("android-v".length());
                    if (!newer(v, appVersion())) return;
                    SharedPreferences p = getSharedPreferences("mbwe", MODE_PRIVATE);
                    if (tag.equals(p.getString("skip", ""))) return;
                    String page = r.optString("html_url", "https://github.com/Crys1534/MB-World-Editor/releases");
                    runOnUiThread(() -> new AlertDialog.Builder(this)
                            .setTitle(R.string.update_title)
                            .setMessage(getString(R.string.update_text, v))
                            .setPositiveButton(R.string.download, (d, w) -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(page))); } catch (Exception e) { /* nada */ } })
                            .setNeutralButton(R.string.skip, (d, w) -> p.edit().putString("skip", tag).apply())
                            .setNegativeButton(R.string.later, null)
                            .show());
                    return;
                }
            } catch (Exception e) { /* sin internet: otro día */ }
        }).start();
    }

    static boolean newer(String a, String b) {
        String[] pa = a.split("\\."), pb = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int x = i < pa.length ? parse(pa[i]) : 0, y = i < pb.length ? parse(pb[i]) : 0;
            if (x != y) return x > y;
        }
        return false;
    }

    private static int parse(String s) { try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (Exception e) { return 0; } }

    private String appVersion() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "1.0.0"; }
    }

    // ---------------------------------------------------------------- varios
    private void hideSystemBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

    @Override
    protected void onPause() { if (web != null) web.onPause(); super.onPause(); }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] b = new byte[8192]; int n;
            while ((n = in.read(b)) > 0) bo.write(b, 0, n);
            return new String(bo.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) { return null; }
    }

    private String errorPage() {
        return "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width'>"
                + "<body style='margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#1b2838;color:#fff;font:16px sans-serif;text-align:center'>"
                + "<div><h2>" + getString(R.string.no_internet_title) + "</h2><p style='max-width:480px'>" + getString(R.string.no_internet_text) + "</p>"
                + "<a href='" + START_URL + "' style='display:inline-block;font-size:16px;padding:10px 24px;border-radius:6px;background:#3b82f6;color:#fff;text-decoration:none'>"
                + getString(R.string.retry) + "</a></div></body>";
    }
}
