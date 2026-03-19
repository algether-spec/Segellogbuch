/* ======================
   SW.JS – Service Worker
   Offline-Cache für Segellogbuch
====================== */

const CACHE = "segellogbuch-v1.4.0";

const ASSETS = [
    "./index.html",
    "./app.js",
    "./storage.js",
    "./config.js",
    "./style.css",
    "./manifest.json",
    "./version.json"
];

self.addEventListener("install", e => {
    /* skipWaiting sofort – nicht erst nach dem Cachen */
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS))
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

    /* version.json + sw.js: immer frisch vom Netz */
    if (sameOrigin && (
        url.pathname.endsWith("/version.json") ||
        url.pathname.endsWith("/sw.js")
    )) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
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
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
