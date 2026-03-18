/* ======================
   STORAGE.JS
   localStorage-Verwaltung – zentrale Datenhaltung
====================== */

const KEY_TOERNS = "segel_logbuch_toerns";
const KEY_CREW   = "segel_logbuch_crew";
const KEY_BACKUP       = "segel_logbuch_backup"; /* wird NIE beim Update gelöscht */
const KEY_LETZTE_WERTE = "last_values";


/* --- Hilfsfunktion ---------------------------------------------- */

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}


/* --- Törns ------------------------------------------------------ */

function ladeToerns() {
    try {
        const raw = localStorage.getItem(KEY_TOERNS);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function speichereToerns(toerns) {
    localStorage.setItem(KEY_TOERNS, JSON.stringify(toerns));
}

/* Wrapper – bestehende Aufrufe in app.js bleiben kompatibel */
function alleToernsLaden() { return ladeToerns(); }

function toernSpeichern(toern) {
    const alle = ladeToerns();
    const idx = alle.findIndex(t => t.tripId === toern.tripId);
    idx >= 0 ? alle[idx] = toern : alle.push(toern);
    speichereToerns(alle);
    /* Crew-Namen dieses Törns in globale Liste übernehmen */
    const namen = new Set(ladeCrew());
    (toern.crew || []).forEach(p => { if (p.name) namen.add(p.name); });
    speichereCrew([...namen]);
}

function toernLoeschen(tripId) {
    speichereToerns(ladeToerns().filter(t => t.tripId !== tripId));
}

function neuerToern() {
    return {
        tripId: generateId(),
        tripName: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        skipper: "",
        crew: [],
        shipData: {
            name: "",
            type: "",
            registration: "",
            engine: ""
        },
        generalWeather: {
            windForce: "",
            windDirection: "",
            seaState: "",
            visibility: "",
            clouds: ""
        },
        notes: "",
        events: [],
        track: {
            enabled: false,
            intervalSeconds: 60,
            startedAt: "",
            stoppedAt: "",
            source: "device_gps",
            points: []
        }
    };
}


/* --- Crew (global) ---------------------------------------------- */

function ladeCrew() {
    try {
        const raw = localStorage.getItem(KEY_CREW);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function speichereCrew(namen) {
    const bereinigt = [...new Set(namen.filter(n => typeof n === "string" && n.trim()))];
    localStorage.setItem(KEY_CREW, JSON.stringify(bereinigt));
}


/* --- Export / Import -------------------------------------------- */

function exportJSON() {
    const data = {
        toerns: ladeToerns(),
        crew:   ladeCrew()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "segellogbuch_backup_" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
}

function importJSON(data) {
    if (data && Array.isArray(data.toerns)) {
        speichereToerns(data.toerns);
        if (Array.isArray(data.crew)) speichereCrew(data.crew);
        return data.toerns.length;
    }
    /* Legacy: einfaches Törn-Array (aus altem Format) */
    if (Array.isArray(data)) {
        speichereToerns(data);
        return data.length;
    }
    throw new Error("Ungültiges Format");
}


/* --- Letzte Werte ----------------------------------------------- */

function ladeLetzteWerte() {
    try {
        const raw = localStorage.getItem(KEY_LETZTE_WERTE);
        return raw ? JSON.parse(raw) : { wind: "", rudergaenger: "" };
    } catch { return { wind: "", rudergaenger: "" }; }
}

function speichereLetzteWerte(wind, rudergaenger) {
    localStorage.setItem(KEY_LETZTE_WERTE, JSON.stringify({ wind, rudergaenger }));
}


/* --- Auto-Backup ------------------------------------------------ */

function autoBackupSpeichern() {
    const toerns = ladeToerns();
    if (toerns.length === 0) return;
    const backup = {
        timestamp: new Date().toISOString(),
        toerns,
        crew: ladeCrew()
    };
    try {
        localStorage.setItem(KEY_BACKUP, JSON.stringify(backup));
    } catch { /* Storage voll – ignorieren */ }
}

function backupLaden() {
    try {
        const raw = localStorage.getItem(KEY_BACKUP);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function backupWiederherstellen(backup) {
    speichereToerns(backup.toerns);
    if (Array.isArray(backup.crew)) speichereCrew(backup.crew);
}


/* --- Migration (einmalig beim Start) ---------------------------- */

(function migrieren() {
    const altKey = "segel_logbuch_trips";
    const alt = localStorage.getItem(altKey);
    if (alt && !localStorage.getItem(KEY_TOERNS)) {
        localStorage.setItem(KEY_TOERNS, alt);
        localStorage.removeItem(altKey);
        /* Crew-Namen aus alten Törns in globale Liste übernehmen */
        try {
            const toerns = JSON.parse(alt);
            if (Array.isArray(toerns)) {
                const namen = new Set();
                toerns.forEach(t => (t.crew || []).forEach(p => { if (p.name) namen.add(p.name); }));
                if (namen.size) speichereCrew([...namen]);
            }
        } catch {}
    }
})();
