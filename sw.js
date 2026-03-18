/* ======================
   SW.JS – Service Worker
   Offline-Cache für Segellogbuch
====================== */

const CACHE = "segellogbuch-v1.3.5";

const ASSETS = [
    "./",
    "./index.html",
    "./import.html",
    "./app.js",
    "./storage.js",
    "./config.js",
    "./style.css",
    "./manifest.json",
    "./version.json"
];

self.addEventListener("install", e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", e => {
    /* version.json immer frisch vom Netz – nie aus Cache */
    if (e.request.url.includes("version.json")) {
        e.respondWith(fetch(e.request, { cache: "no-store" }).catch(() => caches.match(e.request)));
        return;
    }
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
