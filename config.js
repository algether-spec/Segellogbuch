/* ======================
   CONFIG.JS
   App-Version und Auto-Update-Logik
====================== */

const APP_VERSION = "1.4.6";

function updateButtonInit() {
    const btn = document.getElementById("btn-update");
    if (btn) btn.textContent = "v" + APP_VERSION;
    const lbl = document.getElementById("version-label");
    if (lbl) lbl.textContent = "v" + APP_VERSION + " · von Al.Gether";
}

async function autoUpdatePruefen() {
    try {
        /* Cache-Busting via Query-String + no-store */
        const res = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const btn = document.getElementById("btn-update");
        if (!btn) return;
        if (data.version && data.version !== APP_VERSION) {
            btn.textContent = "🔄 Update " + data.version;
            btn.classList.add("btn-update-available");
        } else {
            btn.textContent = "v" + APP_VERSION;
            btn.classList.remove("btn-update-available");
        }
    } catch { /* kein Netz – kein Problem */ }
}

async function updateErzwingen() {
    /* 1. Alle SW-Caches löschen – localStorage bleibt unangetastet */
    if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
    }
    /* 2. Service Worker deregistrieren */
    if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
    }
    /* 3. Neu laden – alle Dateien kommen frisch vom Server */
    location.reload(true);
}
