package io.github.crys1534.mbworldeditor;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * La app abre la página de siempre (https://crys1534.github.io/MB-World-Editor/).
 * Cada archivo de la página (y de sus librerías) que llega de internet se guarda en una copia local.
 * Sin internet se usa esa copia, y si todavía no hay, la que viene dentro del APK.
 * La dirección es siempre la misma, así que los mundos, el perfil y los ajustes nunca se separan.
 */
final class OfflineCache {
    static final String SITE_HOST = "crys1534.github.io";
    static final String SITE_PATH = "/MB-World-Editor/";
    private static final Set<String> CACHE_HOSTS = Set.of(SITE_HOST, "www.gstatic.com", "unpkg.com", "cdnjs.cloudflare.com");

    private final Context ctx;
    private final File dir;
    private final AssetManager assets;
    final String userAgentSuffix;

    OfflineCache(Context ctx, String userAgentSuffix) {
        this.ctx = ctx.getApplicationContext();
        this.dir = new File(ctx.getFilesDir(), "offline-cache");
        //noinspection ResultOfMethodCallIgnored
        this.dir.mkdirs();
        this.assets = ctx.getAssets();
        this.userAgentSuffix = userAgentSuffix;
    }

    static boolean isCacheable(Uri u) {
        if (!"https".equals(u.getScheme()) || u.getHost() == null) return false;
        String host = u.getHost().toLowerCase(Locale.ROOT);
        if (!CACHE_HOSTS.contains(host)) return false;
        if (SITE_HOST.equals(host)) return u.getPath() != null && u.getPath().startsWith(SITE_PATH);
        return true;
    }

    private boolean online() {
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            Network n = cm != null ? cm.getActiveNetwork() : null;
            return n != null;
        } catch (Exception e) { return true; }
    }

    WebResourceResponse handle(WebResourceRequest req) {
        Uri u = req.getUrl();
        if (!"GET".equalsIgnoreCase(req.getMethod()) || !isCacheable(u)) return null;
        boolean isRange = req.getRequestHeaders() != null && (req.getRequestHeaders().containsKey("Range") || req.getRequestHeaders().containsKey("range"));
        boolean on = online();
        if (isRange) return on ? null : offline(u);   // audio por partes: con internet lo hace el WebView solo

        if (on) {
            boolean isDoc = req.isForMainFrame() || (u.getPath() != null && (u.getPath().endsWith(".html") || u.getPath().endsWith("/")));
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(u.toString()).openConnection();
                c.setConnectTimeout(isDoc ? 7000 : 12000);
                c.setReadTimeout(isDoc ? 10000 : 20000);
                c.setUseCaches(false);
                c.setInstanceFollowRedirects(true);
                Map<String, String> h = req.getRequestHeaders();
                if (h != null) for (Map.Entry<String, String> e : h.entrySet()) {
                    String k = e.getKey();
                    if (k == null || k.equalsIgnoreCase("Range") || k.equalsIgnoreCase("If-None-Match") || k.equalsIgnoreCase("If-Modified-Since") || k.equalsIgnoreCase("Accept-Encoding")) continue;
                    c.setRequestProperty(k, e.getValue());
                }
                int code = c.getResponseCode();
                if (code == 200) {
                    byte[] body = readAll(c.getInputStream());
                    String type = c.getContentType();
                    save(u.toString(), body, type);
                    return response(200, type, body, mimeFor(u.getPath()), "network");
                }
                if (code >= 400 && code < 500) {                      // de verdad no existe (404): se respeta
                    InputStream es = c.getErrorStream();
                    byte[] body = es != null ? readAll(es) : new byte[0];
                    return response(code, c.getContentType(), body, mimeFor(u.getPath()), "network");
                }
            } catch (IOException e) {
                // sin internet de verdad, o muy lento: se usa la copia
            } finally {
                if (c != null) c.disconnect();
            }
        }
        return offline(u);
    }

    private WebResourceResponse offline(Uri u) {
        // 1) la copia guardada la última vez que hubo internet
        byte[][] hit = new byte[1][];
        String type = readCached(u.toString(), hit);
        if (hit[0] == null && u.getQuery() != null) {
            String noQuery = u.buildUpon().clearQuery().build().toString();
            type = readCached(noQuery, hit);
        }
        if (hit[0] != null) return response(200, type, hit[0], mimeFor(u.getPath()), "cache");
        // 2) la copia que viene dentro del APK
        String asset = assetPathFor(u);
        if (asset != null) {
            try (InputStream in = assets.open(asset)) {
                return response(200, null, readAll(in), mimeFor(asset), "bundled");
            } catch (IOException e) { /* no viene incluido */ }
        }
        return null;
    }

    private static String assetPathFor(Uri u) {
        String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
        String path = u.getPath() == null ? "/" : u.getPath();
        String rel;
        if (SITE_HOST.equals(host)) {
            rel = path.substring(SITE_PATH.length());
            if (rel.isEmpty() || rel.endsWith("/")) rel += "index.html";
            rel = "site/" + rel;
        } else {
            rel = "vendor/" + host + path;
        }
        if (rel.contains("..")) return null;
        return rel.replace("//", "/");
    }

    private String key(String url) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] d = md.digest(url.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format(Locale.ROOT, "%02x", b));
            return sb.toString();
        } catch (Exception e) { return Integer.toHexString(url.hashCode()); }
    }

    private void save(String url, byte[] body, String type) {
        try {
            String k = key(url);
            File tmp = new File(dir, k + ".tmp");
            try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(body); }
            File bin = new File(dir, k + ".bin");
            //noinspection ResultOfMethodCallIgnored
            tmp.renameTo(bin);
            JSONObject meta = new JSONObject();
            meta.put("url", url);
            meta.put("type", type == null ? "" : type);
            meta.put("time", System.currentTimeMillis());
            try (FileOutputStream o = new FileOutputStream(new File(dir, k + ".json"))) { o.write(meta.toString().getBytes(StandardCharsets.UTF_8)); }
        } catch (Exception e) { /* sin espacio: no se guarda, no pasa nada */ }
    }

    private String readCached(String url, byte[][] out) {
        try {
            String k = key(url);
            File bin = new File(dir, k + ".bin"), js = new File(dir, k + ".json");
            if (!bin.exists() || !js.exists()) return null;
            JSONObject meta = new JSONObject(new String(Files.readAllBytes(js.toPath()), StandardCharsets.UTF_8));
            out[0] = Files.readAllBytes(bin.toPath());
            String t = meta.optString("type", "");
            return t.isEmpty() ? null : t;
        } catch (Exception e) { out[0] = null; return null; }
    }

    private static WebResourceResponse response(int code, String contentType, byte[] body, String fallbackMime, String source) {
        String mime = fallbackMime, enc = null;
        if (contentType != null && !contentType.isEmpty()) {
            String[] parts = contentType.split(";");
            mime = parts[0].trim();
            for (int i = 1; i < parts.length; i++) {
                String p = parts[i].trim();
                if (p.toLowerCase(Locale.ROOT).startsWith("charset=")) enc = p.substring(8).trim().replace("\"", "");
            }
        }
        if (mime == null || mime.isEmpty()) mime = "application/octet-stream";
        if (enc == null && (mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json"))) enc = "utf-8";
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-cache");
        headers.put("X-MBW-Source", source);
        headers.put("Access-Control-Expose-Headers", "X-MBW-Source");
        String reason = code == 200 ? "OK" : (code == 404 ? "Not Found" : "Error");
        return new WebResourceResponse(mime, enc, code, reason, headers, new ByteArrayInputStream(body));
    }

    private static String mimeFor(String path) {
        if (path == null) return "application/octet-stream";
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith("/") || p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".mbw") || p.endsWith(".txt")) return "text/plain";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".otf")) return "font/otf";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        int dot = p.lastIndexOf('.');
        String ext = dot >= 0 ? p.substring(dot + 1) : "";
        String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return m != null ? m : "application/octet-stream";
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        return bo.toByteArray();
    }
}
