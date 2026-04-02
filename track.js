/* ======================
   TRACK.JS – GPS-Track-Aufzeichnung + Wake Lock
   watchPosition-basiert (v2.5.3)
====================== */

/* --- Zustands-Variablen ------------------------------------------ */

let _watchId     = null;   /* watchPosition-Handle (null = nicht aktiv) */
let _letzterPkt  = null;   /* letzter gespeicherter Track-Punkt         */
let _highAcc     = false;  /* aktuell verwendete enableHighAccuracy-Mode */
let _wakeLock    = null;   /* WakeLock-Sentinel (null = nicht aktiv)    */
let _speicherTimer = null; /* Debounce-Timer für toernSpeichern()       */
let _sogSchwelle   = 0.1; /* SOG-Jitter-Filter-Schwelle in Knoten      */
let _startBoost    = false;   /* true = erste 60s nach Fahrtstart       */
let _startBoostTimer = null;

/* --- Haversine-Distanz (km) -------------------------------------- */

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* --- Track-Distanz (konfigurierbar) ------------------------------ */

function trackDistanzLaden() {
    const v = parseFloat(localStorage.getItem("segel_track_distanz"));
    return [0.05, 0.1, 0.2, 0.3, 0.4, 0.5].includes(v) ? v : 0.1;
}

function trackDistanzSpeichern(nm) {
    localStorage.setItem("segel_track_distanz", String(nm));
    _letzterPkt = null;
    trackDistanzSelectAktualisieren();
}

function trackDistanzSelectAktualisieren() {
    const sel = document.getElementById("track-distanz-select");
    if (sel) sel.value = String(trackDistanzLaden());
}

function sogSchwelleLaden() {
    const v = parseFloat(localStorage.getItem("segel_sog_schwelle"));
    return [0.05, 0.1, 0.2, 0.3, 0.4, 0.5].includes(v) ? v : 0.1;
}

function sogSchwelleSpeichern(kn) {
    localStorage.setItem("segel_sog_schwelle", String(kn));
    sogSchwelleSelectAktualisieren();
}

function sogSchwelleSelectAktualisieren() {
    const sel = document.getElementById("sog-schwelle-select");
    if (sel) sel.value = String(sogSchwelleLaden());
}

function trackIntervallLaden() {
    const v = parseFloat(localStorage.getItem("segel_track_intervall"));
    return [30, 60, 90, 120, 150, 180].includes(v) ? v : 120;
}

function trackIntervallSpeichern(sek) {
    localStorage.setItem("segel_track_intervall", String(sek));
    trackIntervallSelectAktualisieren();
}

function trackIntervallSelectAktualisieren() {
    const sel = document.getElementById("track-intervall-select");
    if (sel) sel.value = String(trackIntervallLaden());
}

/* --- Track-Status anzeigen --------------------------------------- */

function trackStatusAnzeigen(aktiv) {
    const el = document.getElementById("ls-track");
    if (!el) return;
    if (!aktiv) { el.textContent = "🔴 Track aus"; return; }
    el.textContent = _wakeLock !== null ? "🟢 Track · 🔆" : "🟢 Track · ⚠️";
}

/* --- Internen Punkt speichern ------------------------------------ */

function _trackPunktSpeichern(lat, lon, sog, zeitIso) {
    if (!aktuellerToern) return;
    if (!aktuellerToern.track)        aktuellerToern.track = {};
    if (!aktuellerToern.track.points) aktuellerToern.track.points = [];
    const pkt = { lat, lon, sog, zeit: zeitIso };
    aktuellerToern.track.points.push(pkt);
    aktuellerToern.track.points.sort((a, b) => a.zeit < b.zeit ? -1 : a.zeit > b.zeit ? 1 : 0);
    _letzterPkt = pkt;
    if (_speicherTimer) clearTimeout(_speicherTimer);
    _speicherTimer = setTimeout(() => {
        toernSpeichern(aktuellerToern);
        _speicherTimer = null;
    }, 5000);
}

/* --- trackManöverPunkt: immer speichern (kein Distanz-Check) ----- */
/* Wird von schnellEintragSpeichern() aufgerufen                     */

function trackManöverPunkt(lat, lon, sog, zeitIso) {
    if (!aktuellerToern) return;
    _trackPunktSpeichern(
        parseFloat(lat.toFixed(5)),
        parseFloat(lon.toFixed(5)),
        sog,
        zeitIso
    );
}

/* --- watchPosition-Callback -------------------------------------- */

function _trackWatchCallback(pos) {
    if (!aktuellerToern || stoppZustandLaden() !== "fahrt") {
        trackStoppen();
        return;
    }

    const sogMs = pos.coords.speed;
    const sogKn = sogMs != null ? parseFloat((sogMs * 1.94384).toFixed(1)) : null;
    const sogVerfuegbar = sogMs != null;

    /* enableHighAccuracy dynamisch anpassen: Neustart bei SOG-Schwelle */
    const neueHighAcc = (sogKn ?? 0) > 3;
    if (neueHighAcc !== _highAcc) {
        _highAcc = neueHighAcc;
        navigator.geolocation.clearWatch(_watchId);
        _watchId = null;
        trackStarten();
        return;
    }

    const newLat   = parseFloat(pos.coords.latitude.toFixed(5));
    const newLon   = parseFloat(pos.coords.longitude.toFixed(5));
    const intervall = _startBoost ? 10 : trackIntervallLaden();
    const minDistM  = _startBoost ? 0 : trackDistanzLaden() * 1852;
    const distM    = _letzterPkt
        ? haversineKm(_letzterPkt.lat, _letzterPkt.lon, newLat, newLon) * 1000
        : Infinity;
    const alterSek = _letzterPkt
        ? (Date.now() - new Date(_letzterPkt.zeit + "Z").getTime()) / 1000
        : Infinity;

    /* Bewegungslos: SOG bekannt+niedrig UND kaum Distanz UND innerhalb Intervall */
    const steht = sogVerfuegbar && sogKn <= sogSchwelleLaden()
                  && distM < 20 && alterSek < intervall;
    if (steht) {
        trackStatusAnzeigen(true);
        if (typeof livePositionAktualisieren === "function") {
            livePositionAktualisieren(newLat, newLon, sogKn);
        }
        return;
    }

    if (distM >= minDistM || alterSek >= intervall) {
        _trackPunktSpeichern(newLat, newLon, sogKn, lokalZeitIso());
    }
    trackStatusAnzeigen(true);
    if (typeof livePositionAktualisieren === "function") {
        livePositionAktualisieren(newLat, newLon, sogKn);
    }
}

/* --- trackStarten ----------------------------------------------- */

function trackStarten() {
    if (_watchId !== null) return;  /* Idempotent */
    if (!aktuellerToern || stoppZustandLaden() !== "fahrt") return;
    if (!navigator.geolocation) return;

    /* _letzterPkt aus vorhandenen Punkten initialisieren */
    const pts = aktuellerToern?.track?.points || [];
    if (!_letzterPkt && pts.length) _letzterPkt = pts[pts.length - 1];

    _watchId = navigator.geolocation.watchPosition(
        _trackWatchCallback,
        () => { trackStatusAnzeigen(false); },  /* GPS-Fehler: Status ausblenden */
        { maximumAge: 30000, timeout: 10000, enableHighAccuracy: _highAcc }
    );
    _startBoost = true;
    if (_startBoostTimer) clearTimeout(_startBoostTimer);
    _startBoostTimer = setTimeout(() => {
        _startBoost = false;
        _startBoostTimer = null;
    }, 60000);  /* 60 Sekunden Boost */
    _wakeLockAnfordern();
    trackStatusAnzeigen(false);  /* initial bis erste Position */
}

/* --- Wake Lock --------------------------------------------------- */

async function _wakeLockAnfordern() {
    if (!("wakeLock" in navigator)) {
        trackStatusAnzeigen(_watchId !== null);
        return;
    }
    try {
        _wakeLock = await navigator.wakeLock.request("screen");
        _wakeLock.addEventListener("release", () => { _wakeLock = null; trackStatusAnzeigen(_watchId !== null); });
    } catch (_) {
        _wakeLock = null;
    }
    trackStatusAnzeigen(_watchId !== null);
}

function _wakeLockFreigeben() {
    if (_wakeLock !== null) {
        _wakeLock.release().catch(() => {});
        _wakeLock = null;
    }
}

/* visibilitychange: Wake Lock bei App-Rückkehr neu anfordern */
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && _watchId !== null && _wakeLock === null) {
        _wakeLockAnfordern();
    }
});

/* --- trackStoppen ----------------------------------------------- */

function trackStoppen() {
    if (_watchId !== null) {
        navigator.geolocation.clearWatch(_watchId);
        _watchId = null;
    }
    _letzterPkt = null;
    _highAcc    = false;
    if (_startBoostTimer) { clearTimeout(_startBoostTimer); _startBoostTimer = null; }
    _startBoost = false;
    _wakeLockFreigeben();
    if (_speicherTimer) {
        clearTimeout(_speicherTimer);
        _speicherTimer = null;
        toernSpeichern(aktuellerToern);
    }
    trackStatusAnzeigen(false);
}
