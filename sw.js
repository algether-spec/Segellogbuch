/* Service Worker – Segellogbuch Native
   In der Capacitor-App werden Assets aus dem APK geladen,
   daher nur minimales Caching für den PWA-Kompatibilitätsmodus. */

/* Cache-Name wird automatisch aus der Registrierungs-URL gelesen (?v=APP_VERSION).
   Kein manueller Bump nötig – reicht APP_VERSION in config.js zu erhöhen. */
const CACHE = "segellogbuch-" + (new URL(self.location.href).searchParams.get("v") || "v2");
/* Relativ zum SW-Pfad, damit es auch unter einem Unterpfad (GitHub Pages
   /Segellogbuch/) funktioniert (Issue #16). */
const ASSETS = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png",
                "vendor/leaflet.js", "vendor/html2canvas.min.js", "vendor/jspdf.umd.min.js"];
/* Die von Vite gebündelten Dateien (assets/index-<hash>.js/.css) haben wechselnde Namen
   und werden beim ersten Online-Start über den network-first-Handler mitgecacht. */

/* Eigener, von APP_VERSION unabhängiger Cache für Kartenkacheln (OSM/OpenSeaMap) –
   bleibt über App-Updates hinweg erhalten (siehe activate-Handler), damit einmal
   gesehene/heruntergeladene Seegebiete offline verfügbar bleiben. */
const TILE_CACHE = "segellogbuch-tiles-v1";

/* OSM nutzt {s}-Subdomains (a/b/c), die Leaflet beim Live-Browsen zufällig wählt.
   Ohne Normalisierung würde dieselbe Kachel unter b.tile... nicht die zuvor unter
   a.tile... gecachte Kachel treffen (Cache-Miss trotz identischem Inhalt). */
function _kachelKanonisch(url) {
    return url.replace(/^https:\/\/[abc]\.tile\.openstreetmap\.org\//, "https://a.tile.openstreetmap.org/");
}
function _istKachel(url) {
    return /^https:\/\/[abc]\.tile\.openstreetmap\.org\//.test(url) || url.startsWith("https://tiles.openseamap.org/");
}

self.addEventListener("install", e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
    self.skipWaiting();
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE && k !== TILE_CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

/* Kachel LESBAR (mode "cors") laden – OSM und OpenSeaMap erlauben CORS. Die Live-Karte fragt
   per <img> (no-cors) an; früher landete dann eine undurchsichtige Kopie im Cache, die die
   Karte zwar zeigen, das Kartenbild im PDF aber nicht lesen kann (offline: PDF ohne Seekarte).
   Verweigert ein Server CORS, wird wie angefragt geladen. */
function kachelLesbarLaden(request) {
    return fetch(request.url, { mode: "cors", credentials: "omit" }).catch(() => fetch(request));
}

async function kachelAntwort(e) {
    const cache = await caches.open(TILE_CACHE);
    const key = _kachelKanonisch(e.request.url);
    const cached = await cache.match(key);
    const speichern = res => {
        /* Fehlerseiten (z.B. "Access blocked") nicht dauerhaft speichern; bei
           undurchsichtigen Antworten ist der Status nicht prüfbar (Issue #16) */
        if (res.ok || res.type === "opaque") return cache.put(key, res.clone()).catch(() => {});
        return Promise.resolve();
    };
    if (cached && cached.type !== "opaque") return cached;
    if (cached && e.request.mode !== "cors") {
        /* Anzeige: alte undurchsichtige Kopie sofort zeigen und im Hintergrund lesbar ersetzen */
        e.waitUntil(fetch(e.request.url, { mode: "cors", credentials: "omit" })
            .then(res => (res.ok ? cache.put(key, res) : undefined)).catch(() => {}));
        return cached;
    }
    /* nichts im Cache – oder lesbar nötig (PDF), aber nur undurchsichtig vorhanden */
    try {
        const res = await kachelLesbarLaden(e.request);
        await speichern(res);
        return res;
    } catch {
        return cached || Response.error();
    }
}

self.addEventListener("fetch", e => {
    if (e.request.method !== "GET") return;

    if (_istKachel(e.request.url)) {
        e.respondWith(kachelAntwort(e));
        return;
    }

    /* App-Dateien: NETWORK-FIRST. Online kommt immer der aktuelle Stand (früher
       cache-first → nach Update kurz altes index.html), offline die zuletzt geladene
       Kopie. ignoreSearch, weil die Seite app.js?v=… anfragt, gecacht ist app.js
       (Issue #16). Fremde Hosts (APIs) gehen unverändert durch. */
    if (new URL(e.request.url).origin !== self.location.origin) return;
    e.respondWith(
        fetch(e.request).then(res => {
            if (res.ok && res.type === "basic") {
                const kopie = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, kopie)).catch(() => {});
            }
            return res;
        }).catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
});
