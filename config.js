/* ======================
   CONFIG.JS
   App-Version und Auto-Update-Logik
====================== */

const APP_VERSION = "1.2.0";

async function autoUpdatePruefen() {
    try {
        const res = await fetch("version.json?t=" + Date.now());
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
    if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update()));
    }
    location.reload(true);
}
