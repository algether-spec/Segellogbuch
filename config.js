/* ======================
   CONFIG.JS
   App-Version und Auto-Update-Logik
====================== */

const APP_VERSION = "1.2.8";

async function autoUpdatePruefen() {
    try {
        /* no-store: immer frisch vom Server, nie aus Browser- oder SW-Cache */
        const res = await fetch("version.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== APP_VERSION) {
            const btn = document.getElementById("btn-update");
            if (btn) {
                btn.hidden = false;
                btn.textContent = "🔄 Update " + data.version + " verfügbar";
                btn.classList.add("btn-update-available");
            }
        }
    } catch { /* kein Netz – kein Problem */ }
}

async function updateErzwingen() {
    /* 1. Alle SW-Caches löschen – localStorage bleibt unangetastet */
    if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
    }
    /* 2. Service Worker deregistrieren (damit alter SW nicht mehr abfängt) */
    if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
    }
    /* 3. Erst jetzt neu laden – alle Dateien kommen frisch vom Server */
    location.reload(true);
}
