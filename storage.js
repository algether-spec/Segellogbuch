/* ======================
   STORAGE.JS
   localStorage-Verwaltung – zentrale Datenhaltung
====================== */

const KEY_TOERNS          = "segel_logbuch_toerns";
const KEY_CREW            = "segel_logbuch_crew";
const KEY_AUTOBACKUP      = "segel_logbuch_autobackup";
const KEY_PERMANENT_BACKUP = "segel_logbuch_backup_permanent";
const KEY_LETZTE_WERTE    = "last_values";
const KEY_AKTIVER_TOERN   = "segel_logbuch_aktiver_toern";
const KEY_STOPP           = "segel_logbuch_stopp";
const KEY_SONNENMODUS     = "segel_sonnenmodus";
const KEY_PWA_MIGRATION   = "pwa_migration_done";


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
    const verbleibend = ladeToerns().filter(t => t.tripId !== tripId);
    speichereToerns(verbleibend);
    /* Crew-Namen bereinigen: nur Namen behalten die noch in anderen Törns vorkommen */
    const nochVorhanden = new Set();
    verbleibend.forEach(t => (t.crew || []).forEach(p => { if (p.name) nochVorhanden.add(p.name); }));
    speichereCrew([...nochVorhanden]);
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
        stoppZustand: "hafen",
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
    const windTs = wind ? Date.now() : 0;
    localStorage.setItem(KEY_LETZTE_WERTE, JSON.stringify({ wind, rudergaenger, windTs }));
}


/* --- Aktiver Törn ----------------------------------------------- */

function speichereAktivenToern(tripId) {
    if (tripId) localStorage.setItem(KEY_AKTIVER_TOERN, tripId);
    else        localStorage.removeItem(KEY_AKTIVER_TOERN);
}

function ladeAktivenToernId() {
    return localStorage.getItem(KEY_AKTIVER_TOERN) || null;
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
        const json = JSON.stringify(backup);
        localStorage.setItem(KEY_AUTOBACKUP, json);
        localStorage.setItem(KEY_PERMANENT_BACKUP, json); /* immer beide aktuell halten */
    } catch { /* Storage voll – ignorieren */ }
}

function backupLaden() {
    try {
        const raw = localStorage.getItem(KEY_AUTOBACKUP);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function backupWiederherstellen(backup) {
    speichereToerns(backup.toerns);
    if (Array.isArray(backup.crew)) speichereCrew(backup.crew);
}


/* --- Permanentes Backup (überlebt normale Updates) -------------- */

function permanentBackupSpeichern() {
    const toerns = ladeToerns();
    if (toerns.length === 0) return;
    try {
        localStorage.setItem(KEY_PERMANENT_BACKUP, JSON.stringify({
            timestamp: new Date().toISOString(),
            toerns,
            crew: ladeCrew()
        }));
    } catch { /* Storage voll */ }
}

function permanentBackupLaden() {
    try {
        const raw = localStorage.getItem(KEY_PERMANENT_BACKUP);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

/* Prüft beim Start ob Daten fehlen aber Backup vorhanden.
   Wenn ja: automatisch wiederherstellen.
   Wenn nein: Backup aktualisieren.
   Gibt true zurück wenn Wiederherstellung stattfand. */
function permanentBackupPruefen() {
    const toerns = ladeToerns();
    if (toerns.length > 0) {
        permanentBackupSpeichern(); /* Backup immer aktuell halten */
        return false;
    }
    const backup = permanentBackupLaden();
    if (backup && Array.isArray(backup.toerns) && backup.toerns.length > 0) {
        speichereToerns(backup.toerns);
        if (Array.isArray(backup.crew)) speichereCrew(backup.crew);
        return true;
    }
    return false;
}


/* --- Migration (einmalig beim Start) ---------------------------- */

(function migrieren() {
    /* Alten Backup-Key übernehmen */
    const altBackupKey = "segel_logbuch_backup";
    if (!localStorage.getItem(KEY_AUTOBACKUP) && localStorage.getItem(altBackupKey)) {
        localStorage.setItem(KEY_AUTOBACKUP, localStorage.getItem(altBackupKey));
    }
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


/* --- Fahrt-Zustand ---------------------------------------------- */

function ladeStoppZustand() {
    /* Rückwärtskompatibel: altes im_hafen-Flag migrieren */
    if (localStorage.getItem("segel_logbuch_im_hafen") === "true") {
        localStorage.setItem(KEY_STOPP, "hafen");
        localStorage.removeItem("segel_logbuch_im_hafen");
    }
    return localStorage.getItem(KEY_STOPP) || "hafen";
}

function speichereStoppZustand(val) {
    localStorage.setItem(KEY_STOPP, val);
}


/* --- Sonnenmodus ------------------------------------------------ */

function ladeSonnenmodus() {
    return localStorage.getItem(KEY_SONNENMODUS) === "1";
}

function speichereSonnenmodus(aktiv) {
    localStorage.setItem(KEY_SONNENMODUS, aktiv ? "1" : "0");
}


/* --- PWA-Migration ---------------------------------------------- */

function ladeMigrationFlag() {
    return !!localStorage.getItem(KEY_PWA_MIGRATION);
}

function speichereMigrationFlag() {
    localStorage.setItem(KEY_PWA_MIGRATION, "1");
}
