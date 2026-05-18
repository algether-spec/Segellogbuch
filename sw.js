/* ======================
   SW.JS – Service Worker
   Offline-Cache für Segellogbuch
====================== */

const CACHE = "segellogbuch-v2.5.139-dev";

const ASSETS = [
    "./index.html",
    "./app.js",
    "./icon-192.png",
    "./icon-512.png",
    "./storage.js",
    "./config.js",
    "./track.js",
    "./karte.js",
    "./statistik.js",
    "./modals.js",
    "./style.css",
    "./leaflet.js",
    "./leaflet.css",
    "./manifest.json",
    "./testdaten-adria.json"
    /* version.json absichtlich NICHT gecacht – immer frisch vom Netz */
];

self.addEventListener("install", e => {
    /* skipWaiting erst NACH erfolgreichem Cache – verhindert kaputten Cache-Zustand */
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", e => {
    const url = new URL(e.request.url);
    const sameOrigin = url.origin === self.location.origin;

    /* version.json + sw.js: immer frisch, HTTP-Cache umgehen */
    if (sameOrigin && (
        url.pathname.endsWith("/version.json") ||
        url.pathname.endsWith("/sw.js")
    )) {
        e.respondWith(
            fetch(new Request(e.request, { cache: "no-store" }))
                .catch(() => caches.match(e.request))
        );
        return;
    }

    /* Navigation (index.html): Network-First, Cache als Fallback */
    if (e.request.mode === "navigate") {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
                    return res;
                })
                .catch(() => caches.match("./index.html"))
        );
        return;
    }

    /* Alle anderen Assets: Cache-First */
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => new Response("", { status: 503 })))
    );
});
